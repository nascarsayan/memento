// popup.js
/**
 * Popup script for the extension UI
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize the storage manager
    const storageManager = new StorageManager();
    
    // Load data for initial display
    updateStatsDisplay();
    
    // DOM elements
    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const resultsContainer = document.getElementById('results-container');
    const clearDataButton = document.getElementById('clear-data');
    const tabButtons = document.querySelectorAll('.tab-button');
    const searchTypeSelect = document.getElementById('search-type') || document.createElement('select');
    
    // If search type select doesn't exist, create it
    if (!document.getElementById('search-type')) {
        searchTypeSelect.id = 'search-type';
        searchTypeSelect.innerHTML = `
            <option value="hybrid">Hybrid Search</option>
            <option value="semantic">Semantic Search</option>
            <option value="keyword">Keyword Search</option>
        `;
        searchInput.parentNode.insertBefore(searchTypeSelect, searchButton);
    }
    
    // Event listeners
    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performSearch();
    });
    
    clearDataButton.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all indexed data?')) {
            storageManager.clearData(() => {
                updateStatsDisplay();
                resultsContainer.innerHTML = '<p class="empty-state">All data has been cleared</p>';
            });
        }
    });
    
    // Tab functionality
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all tabs
            tabButtons.forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
            
            // Add active class to clicked tab
            button.classList.add('active');
            
            // Show corresponding tab content
            const tabName = button.getAttribute('data-tab');
            
            if (tabName === 'search') {
                resultsContainer.style.display = 'block';
            } else if (tabName === 'journey') {
                document.getElementById('journey-tab').style.display = 'block';
                renderJourneyVisualization();
            } else if (tabName === 'settings') {
                document.getElementById('settings-tab').style.display = 'block';
            }
        });
    });
    
    /**
     * Performs a search using the inverted index
     */
    function performSearch() {
        const query = searchInput.value.trim();
        const searchType = searchTypeSelect.value;
        
        if (!query) {
            resultsContainer.innerHTML = '<p class="empty-state">Enter a search term</p>';
            return;
        }
        
        resultsContainer.innerHTML = '<p>Searching...</p>';
        
        // Send search request to background script
        chrome.runtime.sendMessage({
            action: 'search',
            query: query,
            searchType: searchType
        }, (response) => {
            if (response && response.results) {
                displaySearchResults(response.results, query, searchType);
            } else {
                resultsContainer.innerHTML = `<p class="empty-state">Error performing search</p>`;
            }
        });
    }
    
    /**
     * Displays search results in the popup
     * @param {Array} results - The search results
     * @param {string} query - The search query
     * @param {string} searchType - The type of search performed
     */
    function displaySearchResults(results, query, searchType) {
        resultsContainer.innerHTML = '';
        
        if (!results || results.length === 0) {
            resultsContainer.innerHTML = `<p class="empty-state">No results found for "${query}" using ${searchType} search</p>`;
            return;
        }
        
        // Add search info header
        const searchInfoHeader = document.createElement('div');
        searchInfoHeader.className = 'search-info';
        searchInfoHeader.innerHTML = `
            <p>Showing ${results.length} results for "${query}" using ${searchType} search</p>
        `;
        resultsContainer.appendChild(searchInfoHeader);
        
        results.forEach(result => {
            const resultItem = document.createElement('div');
            resultItem.className = 'result-item';
            
            // Format score based on search type
            let scoreDisplay = '';
            if (searchType === 'hybrid' && result.finalScore !== undefined) {
                scoreDisplay = `<div class="score">Score: ${result.finalScore.toFixed(2)} (K: ${result.keywordScore.toFixed(2)}, S: ${result.semanticScore.toFixed(2)})</div>`;
            } else {
                scoreDisplay = `<div class="score">Score: ${result.score?.toFixed(2) || 'N/A'}</div>`;
            }
            
            resultItem.innerHTML = `
                <h3>${result.title}</h3>
                <div class="url">${result.url}</div>
                ${scoreDisplay}
                <div class="preview">${result.preview}</div>
            `;
            
            resultItem.addEventListener('click', () => {
                chrome.tabs.create({ url: result.url });
            });
            
            resultsContainer.appendChild(resultItem);
        });
    }
    
    /**
     * Renders a visualization of the user's browsing journey
     */
    function renderJourneyVisualization() {
        const journeyVizElem = document.getElementById('journey-viz');
        journeyVizElem.innerHTML = '<p>Loading journey...</p>';
        
        chrome.runtime.sendMessage({ action: 'getJourney' }, (response) => {
            if (!response.journey || Object.keys(response.journey.nodes).length === 0) {
                journeyVizElem.innerHTML = '<p class="empty-state">No browsing history recorded yet</p>';
                return;
            }
            
            // For now, just display the most recent pages
            const journeyTracker = new JourneyTracker();
            journeyTracker.loadJourney(response.journey);
            const chronologicalPath = journeyTracker.getChronologicalPath();
            
            let html = '<ul class="journey-list">';
            chronologicalPath.slice(-5).forEach(page => {
                html += `
                    <li>
                        <div class="journey-item">
                            <div class="journey-time">${new Date(page.timestamp).toLocaleTimeString()}</div>
                            <div class="journey-title">${page.title}</div>
                        </div>
                    </li>
                `;
            });
            html += '</ul>';
            
            journeyVizElem.innerHTML = html;
        });
    }
    
    /**
     * Updates the stats display in the settings tab
     */
    function updateStatsDisplay() {
        storageManager.loadData(data => {
            if (!data) return;
            
            const pagesCount = data.indexData && data.indexData.documents ? 
                Object.keys(data.indexData.documents).length : 0;
                
            document.getElementById('pages-count').textContent = pagesCount;
            
            const lastUpdated = data.lastUpdated ? 
                new Date(data.lastUpdated).toLocaleString() : 'Never';
                
            document.getElementById('last-updated').textContent = lastUpdated;
        });
    }
});