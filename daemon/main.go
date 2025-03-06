package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/blevesearch/bleve"
)

const (
	indexDir       = "memento_index"
	pagesDir       = "memento_pages"
	port           = 8080
	indexBatchSize = 10
)

type PageMetadata struct {
	URL          string    `json:"url"`
	Title        string    `json:"title"`
	Timestamp    time.Time `json:"timestamp"`
	HTMLFilename string    `json:"htmlFilename"`
	MDFilename   string    `json:"mdFilename"`
	HasMarkdown  bool      `json:"hasMarkdown"`
	Indexed      bool      `json:"indexed"`
}

type SearchResult struct {
	URL     string  `json:"url"`
	Title   string  `json:"title"`
	Snippet string  `json:"snippet"`
	Score   float64 `json:"score"`
}

type PageDocument struct {
	URL     string    `json:"url"`
	Title   string    `json:"title"`
	Content string    `json:"content"`
	Time    time.Time `json:"time"`
}

var index bleve.Index

func main() {
	// Initialize the index
	setupIndex()

	// Start the file watcher in a goroutine
	go watchForNewFiles()

	// Start the HTTP server
	http.HandleFunc("/search", handleSearch)
	log.Printf("Starting server on port %d...", port)
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%d", port), nil))
}

func setupIndex() {
	var err error
	// Create index directory if it doesn't exist
	if _, err = os.Stat(indexDir); os.IsNotExist(err) {
		os.MkdirAll(indexDir, 0755)
	}

	// Create pages directory if it doesn't exist
	if _, err = os.Stat(pagesDir); os.IsNotExist(err) {
		os.MkdirAll(pagesDir, 0755)
	}

	// Open or create the index
	if _, err = os.Stat(filepath.Join(indexDir, "index_meta.json")); os.IsNotExist(err) {
		// Create a new index
		mapping := bleve.NewIndexMapping()
		index, err = bleve.New(filepath.Join(indexDir, "index"), mapping)
		if err != nil {
			log.Fatalf("Error creating index: %v", err)
		}
		log.Println("Created new search index")
	} else {
		// Open existing index
		index, err = bleve.Open(filepath.Join(indexDir, "index"))
		if err != nil {
			log.Fatalf("Error opening index: %v", err)
		}
		log.Println("Opened existing search index")
	}

	// Initial indexing of existing files
	indexExistingFiles()
}

func indexExistingFiles() {
	files, err := ioutil.ReadDir(pagesDir)
	if err != nil {
		log.Printf("Error reading pages directory: %v", err)
		return
	}

	count := 0
	for _, file := range files {
		if !file.IsDir() && strings.HasSuffix(file.Name(), ".json") {
			metadataPath := filepath.Join(pagesDir, file.Name())

			// Read and parse metadata
			metadataBytes, err := ioutil.ReadFile(metadataPath)
			if err != nil {
				log.Printf("Error reading metadata file %s: %v", metadataPath, err)
				continue
			}

			var metadata PageMetadata
			if err := json.Unmarshal(metadataBytes, &metadata); err != nil {
				log.Printf("Error parsing metadata file %s: %v", metadataPath, err)
				continue
			}

			if metadata.Indexed {
				continue // Skip already indexed files
			}

			// Determine which file to index - prefer markdown if available
			var contentPath string
			if metadata.HasMarkdown {
				contentPath = filepath.Join(pagesDir, metadata.MDFilename)
				if _, err := os.Stat(contentPath); os.IsNotExist(err) {
					// Fall back to HTML if MD file doesn't exist
					contentPath = filepath.Join(pagesDir, metadata.HTMLFilename)
				}
			} else {
				contentPath = filepath.Join(pagesDir, metadata.HTMLFilename)
			}

			// Check if the content file exists
			if _, err := os.Stat(contentPath); os.IsNotExist(err) {
				log.Printf("Content file not found: %s", contentPath)
				continue
			}

			// Read content
			contentBytes, err := ioutil.ReadFile(contentPath)
			if err != nil {
				log.Printf("Error reading content file %s: %v", contentPath, err)
				continue
			}

			// Index the document
			doc := PageDocument{
				URL:     metadata.URL,
				Title:   metadata.Title,
				Content: string(contentBytes),
				Time:    metadata.Timestamp,
			}

			docID := strings.TrimSuffix(file.Name(), ".json")
			if err := index.Index(docID, doc); err != nil {
				log.Printf("Error indexing document %s: %v", docID, err)
				continue
			}

			// Update metadata to mark as indexed
			metadata.Indexed = true
			updatedMetadata, err := json.MarshalIndent(metadata, "", "  ")
			if err != nil {
				log.Printf("Error marshaling updated metadata: %v", err)
				continue
			}

			if err := ioutil.WriteFile(metadataPath, updatedMetadata, 0644); err != nil {
				log.Printf("Error writing updated metadata: %v", err)
				continue
			}

			count++
			if count%indexBatchSize == 0 {
				log.Printf("Indexed %d documents", count)
			}
		}
	}

	if count > 0 {
		log.Printf("Completed indexing %d documents", count)
	}
}

func watchForNewFiles() {
	for {
		indexExistingFiles()
		time.Sleep(10 * time.Second)
	}
}

func handleSearch(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		http.Error(w, "Missing query parameter", http.StatusBadRequest)
		return
	}

	// Create a search query
	searchQuery := bleve.NewQueryStringQuery(query)
	searchRequest := bleve.NewSearchRequest(searchQuery)
	searchRequest.Fields = []string{"url", "title", "content", "time"}
	searchRequest.Highlight = bleve.NewHighlightWithStyle("html")
	searchRequest.Size = 20

	// Execute the search
	searchResults, err := index.Search(searchRequest)
	if err != nil {
		log.Printf("Search error: %v", err)
		http.Error(w, "Search failed", http.StatusInternalServerError)
		return
	}

	// Process results
	results := []SearchResult{}
	for _, hit := range searchResults.Hits {
		snippet := ""
		if len(hit.Fragments["content"]) > 0 {
			snippet = strings.Join(hit.Fragments["content"], "... ")
			// Clean up HTML tags from snippet
			snippet = strings.ReplaceAll(snippet, "<em>", "")
			snippet = strings.ReplaceAll(snippet, "</em>", "")
		}

		result := SearchResult{
			URL:     hit.Fields["url"].(string),
			Title:   hit.Fields["title"].(string),
			Snippet: snippet,
			Score:   hit.Score,
		}
		results = append(results, result)
	}

	// Return results as JSON
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	json.NewEncoder(w).Encode(results)
}
