// content.js
/**
 * Content script for the Memento Web Indexer extension
 */

// Initialize the inverted index, journey tracker, and storage manager
// These objects will be available from the respective JS files that are loaded before this one
let invertedIndex;
let journeyTracker;
let storageManager;
let embeddingGenerator;

/**
 * Initialize all required objects
 */
async function initialize() {
    embeddingGenerator = new EmbeddingGenerator();
    invertedIndex = new InvertedIndex();
    journeyTracker = new JourneyTracker();
    storageManager = new StorageManager();
    
    await embeddingGenerator.initialize();
    await invertedIndex.initialize();
}

/**
 * Function to extract text content from the webpage.
 * @returns {string} The text content of the webpage.
 */
function extractContent() {
    // Get the primary content by prioritizing article, main content areas
    const mainContent = document.querySelector('article, [role="main"], main, .main-content');
    if (mainContent) {
        return mainContent.innerText || '';
    }
    
    // Fallback to body text, excluding scripts and styles
    return document.body.innerText || '';
}

/**
 * Function to get the page title
 * @returns {string} The title of the webpage
 */
function getPageTitle() {
    return document.title || '';
}

/**
 * Function to handle the page visit.
 */
async function handlePageVisit() {
    // Initialize components
    await initialize();
    
    const url = window.location.href;
    const title = getPageTitle();
    const content = extractContent();
    const timestamp = new Date().toISOString();

    // Create page data object
    const pageData = {
        url,
        title,
        content,
        timestamp
    };

    try {
        // Update the inverted index with the new content
        await invertedIndex.addDocument(url, content, title);

        // Track the user's journey
        journeyTracker.trackVisit(pageData);

        // Store the updated index and journey in storage
        storageManager.saveData(invertedIndex.getIndex(), journeyTracker.getJourney());
        
        console.log('Memento: Page indexed with embeddings', url);
    } catch (error) {
        console.error('Error processing page:', error);
    }
}

// Listen for the page load event
window.addEventListener('load', () => {
    // Slight delay to ensure page is fully loaded
    setTimeout(() => {
        handlePageVisit().catch(console.error);
    }, 1000);
});

/**
 * Extract useful content from the current page
 * @returns {string} - The extracted content
 */
function extractPageContent() {
  // Simple content extraction - can be enhanced later
  const article = document.querySelector('article');
  if (article) {
    return article.innerText;
  }
  
  // Fallback to main content areas
  const mainContent = document.querySelector('main, #main, .main');
  if (mainContent) {
    return mainContent.innerText;
  }
  
  // Fallback to body content
  return document.body.innerText.substring(0, 10000); // Limit size
}

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'extract_content') {
    const pageData = {
      title: document.title,
      content: extractPageContent(),
      url: window.location.href
    };
    sendResponse(pageData);
  }
});