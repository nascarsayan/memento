/**
 * Inverted index for document search
 */
class InvertedIndex {
  constructor() {
    this.index = {}; // term -> [docId]
    this.documents = {}; // docId -> {url, title, content}
    this.embeddings = {}; // docId -> vector
    this.embeddingGenerator = null;
    this.initialized = false;
  }

  /**
   * Initialize the inverted index
   * @returns {Promise<void>}
   */
  async initialize() {
    this.embeddingGenerator = new EmbeddingGenerator();
    await this.embeddingGenerator.initialize();
    this.initialized = true;
    console.log('InvertedIndex initialized');
  }

  /**
   * Add a document to the index
   * @param {string} url - The document URL
   * @param {string} content - The document content
   * @param {string} title - The document title
   * @returns {Promise<void>}
   */
  async addDocument(url, content, title) {
    if (!this.initialized) {
      throw new Error('InvertedIndex not initialized');
    }

    const docId = this.normalizeUrl(url);
    
    // Store the document
    this.documents[docId] = { url, title, content, timestamp: Date.now() };
    
    // Generate and store embedding
    const embedding = await this.embeddingGenerator.generateEmbedding(content);
    this.embeddings[docId] = embedding;
    
    // Tokenize and index the content
    const tokens = this.tokenize(content + ' ' + title);
    
    // Update the inverted index
    for (const token of tokens) {
      if (!this.index[token]) {
        this.index[token] = [];
      }
      
      if (!this.index[token].includes(docId)) {
        this.index[token].push(docId);
      }
    }
  }

  /**
   * Search for documents matching a query
   * @param {string} query - The search query
   * @param {string} searchType - The type of search (text, vector, hybrid)
   * @param {number} limit - Maximum number of results to return
   * @returns {Promise<Array<{url: string, title: string, content: string, score: number}>>}
   */
  async search(query, searchType = 'hybrid', limit = 10) {
    if (!this.initialized) {
      throw new Error('InvertedIndex not initialized');
    }
    
    const results = [];
    
    if (searchType === 'text' || searchType === 'hybrid') {
      // Text-based search
      const tokens = this.tokenize(query);
      const docScores = {};
      
      // Score each document based on query token matches
      for (const token of tokens) {
        const docs = this.index[token] || [];
        
        for (const docId of docs) {
          docScores[docId] = (docScores[docId] || 0) + 1;
        }
      }
      
      // Convert scores to results
      for (const [docId, score] of Object.entries(docScores)) {
        const doc = this.documents[docId];
        if (doc) {
          results.push({
            url: doc.url,
            title: doc.title,
            content: doc.content.substring(0, 200) + '...',
            score: score / tokens.length,
            timestamp: doc.timestamp
          });
        }
      }
    }
    
    if (searchType === 'vector' || searchType === 'hybrid') {
      // Vector-based search
      const queryEmbedding = await this.embeddingGenerator.generateEmbedding(query);
      
      // Score each document based on embedding similarity
      for (const [docId, embedding] of Object.entries(this.embeddings)) {
        const similarity = this.cosineSimilarity(queryEmbedding, embedding);
        const doc = this.documents[docId];
        
        // For hybrid search, boost documents that are already in results
        const existingResult = results.find(r => r.url === doc.url);
        
        if (existingResult) {
          existingResult.score = (existingResult.score + similarity) / 2;
        } else {
          results.push({
            url: doc.url,
            title: doc.title,
            content: doc.content.substring(0, 200) + '...',
            score: similarity,
            timestamp: doc.timestamp
          });
        }
      }
    }
    
    // Sort by score descending
    results.sort((a, b) => b.score - a.score);
    
    // Return limited results
    return results.slice(0, limit);
  }

  /**
   * Load index data from storage
   * @param {Object} data - The index data
   */
  loadIndex(data) {
    if (data.index) this.index = data.index;
    if (data.documents) this.documents = data.documents;
    if (data.embeddings) this.embeddings = data.embeddings;
    console.log('Index loaded with', Object.keys(this.documents).length, 'documents');
  }

  /**
   * Get the index data for storage
   * @returns {Object} - The index data
   */
  getIndex() {
    return {
      index: this.index,
      documents: this.documents,
      embeddings: this.embeddings
    };
  }

  /**
   * Normalize a URL for use as a document ID
   * @param {string} url - The URL to normalize
   * @returns {string} - The normalized URL
   */
  normalizeUrl(url) {
    // Remove protocol, www, and trailing slashes
    return url.replace(/^https?:\/\//, '')
              .replace(/^www\./, '')
              .replace(/\/$/, '');
  }

  /**
   * Tokenize text into an array of terms
   * @param {string} text - The text to tokenize
   * @returns {string[]} - The array of tokens
   */
  tokenize(text) {
    // Simple tokenization - lowercase, remove punctuation, split on whitespace
    return text.toLowerCase()
              .replace(/[^\w\s]/g, ' ')
              .split(/\s+/)
              .filter(token => token.length > 1);
  }

  /**
   * Calculate cosine similarity between two vectors
   * @param {number[]} vec1 - First vector
   * @param {number[]} vec2 - Second vector
   * @returns {number} - Cosine similarity (0-1)
   */
  cosineSimilarity(vec1, vec2) {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have the same dimensions');
    }
    
    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      mag1 += vec1[i] * vec1[i];
      mag2 += vec2[i] * vec2[i];
    }
    
    mag1 = Math.sqrt(mag1);
    mag2 = Math.sqrt(mag2);
    
    if (mag1 === 0 || mag2 === 0) {
      return 0;
    }
    
    return dotProduct / (mag1 * mag2);
  }
}
