// background.js
/**
 * Background script for the Memento Web Indexer extension
 */

// Import the required scripts
importScripts('storage-manager.js');
importScripts('embedding-generator.js');
importScripts('inverted-index.js');
importScripts('journey-tracker.js');

// Initialize with direct references instead of imports
let invertedIndex;
let journeyTracker;
let storageManager;
let embeddingGenerator;

// Initialize objects when script loads
async function initializeServices() {
    embeddingGenerator = new EmbeddingGenerator();
    invertedIndex = new InvertedIndex();
    journeyTracker = new JourneyTracker();
    storageManager = new StorageManager();
    
    // Initialize embedding generator
    await embeddingGenerator.initialize();
    await invertedIndex.initialize();
    
    // Define loadData method for our storage manager
    storageManager.loadData = function(callback) {
        chrome.storage.local.get(['indexData', 'journeyData'], callback);
    };
    
    // Load stored data
    storageManager.loadData(data => {
        if (data && data.indexData) {
            invertedIndex.loadIndex(data.indexData);
        }
        if (data && data.journeyData) {
            journeyTracker.loadJourney(data.journeyData);
        }
    });
}

// Call initialization function
initializeServices().catch(error => {
    console.error('Failed to initialize services:', error);
});

/**
 * Handles messages from content scripts.
 * @param {Object} request - The request object from the content script.
 * @param {Object} sender - The sender of the message.
 * @param {Function} sendResponse - The function to send a response back.
 */
function handleMessage(request, sender, sendResponse) {
    if (request.action === 'indexData') {
        invertedIndex.addDocument(request.url, request.content, request.title)
            .then(() => {
                journeyTracker.trackVisit(request);
                storageManager.saveData({
                    indexData: invertedIndex.getIndex(),
                    journeyData: journeyTracker.getJourney()
                });
                sendResponse({ status: 'success' });
            });
        return true;
    }
}

// Initialize data on extension install
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        // First-time setup
        chrome.storage.local.set({
            indexData: { index: {}, documents: {}, embeddings: {} },
            journeyData: { nodes: {}, edges: {}, root: null, current: null },
            lastUpdated: new Date().toISOString()
        });
    }
});

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'search') {
        // Load data and perform search
        chrome.storage.local.get(['indexData'], async (result) => {
            if (!result.indexData) {
                sendResponse({ results: [] });
                return;
            }
            
            try {
                // Create temporary index object to use for search
                const tempIndex = new InvertedIndex();
                await tempIndex.initialize();
                tempIndex.loadIndex(result.indexData);
                
                // Perform search with specified type
                const searchType = message.searchType || 'hybrid';
                const searchResults = await tempIndex.search(message.query, searchType, 10);
                sendResponse({ results: searchResults });
            } catch (error) {
                console.error('Search error:', error);
                sendResponse({ results: [], error: error.message });
            }
        });
        
        // Must return true for asynchronous response
        return true;
    }
    
    if (message.action === 'getJourney') {
        chrome.storage.local.get(['journeyData'], (result) => {
            sendResponse({ journey: result.journeyData || null });
        });
        return true;
    }
    
    if (message.action === 'index_page') {
        // Index the current page
        indexPage(message.data, sender.tab)
            .then(result => sendResponse({ success: true, result }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true;
    }
    
    // Handle original message handler
    return handleMessage(message, sender, sendResponse);
});

/**
 * Index a web page
 * @param {object} data - The page data
 * @param {object} tab - The tab information
 * @returns {Promise} - A promise that resolves when indexing is complete
 */
async function indexPage(data, tab) {
  try {
    // Use inverted index to properly index the page
    await invertedIndex.addDocument(data.url || tab.url, data.content, data.title);
    
    // Track this in the journey
    journeyTracker.trackVisit({
      url: data.url || tab.url,
      title: data.title,
      timestamp: Date.now()
    });
    
    // Store the indexed page data both in the inverted index and as individual entry
    await storageManager.saveData({
      [`page_${Date.now()}`]: {
        url: data.url || tab.url,
        title: data.title,
        content: data.content,
        timestamp: Date.now()
      },
      indexData: invertedIndex.getIndex(),
      journeyData: journeyTracker.getJourney()
    });
    
    return { message: "Page indexed successfully" };
  } catch (error) {
    console.error('Error indexing page:', error);
    throw error;
  }
}