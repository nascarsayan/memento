// Server configurations
const SERVER_URL = 'http://localhost:8080';
const SAVE_DIR = 'memento_pages';
const CAPTURE_DELAY_MS = 10000; // 10 seconds

// Track pending capture timeouts
const pendingCaptures = new Map();

// Generate a unique filename based on the URL and timestamp
function generateFilename(url) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const urlSafe = url.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 100);
  return `${timestamp}_${urlSafe}`;
}

// Auto-capture when page loads completely, but only after delay
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Clear any existing timeout for this tab
  if (pendingCaptures.has(tabId)) {
    clearTimeout(pendingCaptures.get(tabId));
  }
  
  if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
    // Set a new timeout for this tab
    const timeoutId = setTimeout(() => {
      captureAndSavePage(tabId);
      pendingCaptures.delete(tabId);
    }, CAPTURE_DELAY_MS);
    
    pendingCaptures.set(tabId, timeoutId);
  }
});

// Clear pending captures when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (pendingCaptures.has(tabId)) {
    clearTimeout(pendingCaptures.get(tabId));
    pendingCaptures.delete(tabId);
  }
});

// Capture DOM from the current tab
async function capturePage(tabId) {
  try {
    // Execute script to get full page content
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      function: () => {
        return {
          url: document.location.href,
          title: document.title,
          content: document.documentElement.outerHTML,
          timestamp: new Date().toISOString()
        };
      }
    });
    
    if (!results || !results[0]) return null;
    return results[0].result;
  } catch (error) {
    console.error('Error capturing page:', error);
    return null;
  }
}

// Convert HTML content to Markdown
async function convertToMarkdown(tabId, pageData) {
  try {
    // Execute script to load Turndown first
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['turndown.js']
    });

    // Now execute the conversion script using Turndown
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      function: () => {
        // Get document and simplify it
        function simplifyHtml(html) {
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');
          
          // Remove script tags, style tags, comments, etc.
          const elementsToRemove = ['script', 'style', 'iframe', 'noscript', 'svg', 'canvas'];
          elementsToRemove.forEach(tag => {
            const elements = doc.querySelectorAll(tag);
            elements.forEach(el => el.parentNode.removeChild(el));
          });
          
          return doc;
        }
        
        function getMainContent(doc) {
          // Try to identify the main content area
          const contentSelectors = [
            'article',
            'main',
            '.content',
            '.article',
            '#content',
            '#main'
          ];
          
          for (const selector of contentSelectors) {
            const element = doc.querySelector(selector);
            if (element) return element;
          }
          
          // Fallback to body if no specific content area is found
          return doc.body;
        }
        
        // Parse the HTML content
        const doc = simplifyHtml(document.documentElement.outerHTML);
        const mainContent = getMainContent(doc);
        
        // Use TurndownService to convert HTML to Markdown
        const turndownService = new TurndownService({
          headingStyle: 'atx',
          codeBlockStyle: 'fenced',
          emDelimiter: '*',
          bulletListMarker: '-'
        });
        
        // Convert to markdown
        return turndownService.turndown(mainContent);
      }
    });
    
    if (!results || !results[0] || !results[0].result) {
      return null;
    }
    
    return results[0].result;
  } catch (error) {
    console.error('Error converting to Markdown:', error);
    return null;
  }
}

// Save the captured DOM to a local file
async function savePageData(pageData, tabId) {
  const baseFilename = generateFilename(pageData.url);
  const mdFilename = `${baseFilename}.md`;
  
  const metadata = {
    url: pageData.url,
    title: pageData.title,
    timestamp: pageData.timestamp,
    mdFilename: mdFilename
  };
  
  try {
    // Convert to Markdown and save
    const markdownContent = await convertToMarkdown(tabId, pageData);
    if (markdownContent) {
      // Add title and URL to the markdown content
      const markdownWithMeta = `# ${pageData.title}\n\nURL: ${pageData.url}\n\n${markdownContent}`;
      
      chrome.downloads.download({
        url: `data:text/markdown;charset=utf-8,${encodeURIComponent(markdownWithMeta)}`,
        filename: `${SAVE_DIR}/${mdFilename}`,
        saveAs: false
      });
      
      metadata.hasMarkdown = true;
    } else {
      metadata.hasMarkdown = false;
    }
    
    // Save metadata as JSON
    chrome.downloads.download({
      url: `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(metadata, null, 2))}`,
      filename: `${SAVE_DIR}/${baseFilename}.json`,
      saveAs: false
    }, (downloadId) => {
      console.log(`Metadata JSON saved successfully: ${SAVE_DIR}/${baseFilename}.json`);
    });
    
    return metadata;
  } catch (error) {
    console.error('Error saving page data:', error);
    return metadata;
  }
}

// Capture and save the page automatically
async function captureAndSavePage(tabId) {
  try {
    // Check if the tab is still alive
    const tab = await chrome.tabs.get(tabId);
    if (!tab || !tab.url || tab.url.startsWith('chrome://')) {
      return;
    }
    
    const pageData = await capturePage(tabId);
    if (!pageData) {
      console.error('Failed to capture page data');
      return;
    }
    
    const metadata = await savePageData(pageData, tabId);
    
    // Store the most recent captures in local storage
    chrome.storage.local.get(['recentCaptures'], function(result) {
      const recentCaptures = result.recentCaptures || [];
      recentCaptures.unshift(metadata);
      
      // Keep only the most recent 50 captures
      if (recentCaptures.length > 50) {
        recentCaptures.length = 50;
      }
      
      chrome.storage.local.set({ recentCaptures: recentCaptures });
    });
    
    return metadata;
  } catch (error) {
    console.error('Error in captureAndSavePage:', error);
    return null;
  }
}

// Search for content using the daemon
async function searchContent(query) {
  try {
    const response = await fetch(`${SERVER_URL}/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Search error:', error);
    return { error: error.message, results: [] };
  }
}

// Listen for messages from popup or content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'capturePage') {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (!tabs || !tabs[0]) {
        sendResponse({ success: false, error: 'No active tab found' });
        return;
      }
      
      const metadata = await captureAndSavePage(tabs[0].id);
      if (!metadata) {
        sendResponse({ success: false, error: 'Failed to capture page data' });
        return;
      }
      
      sendResponse({ success: true, metadata });
    });
    return true; // Keep the message channel open for async response
  }
  
  if (request.action === 'getRecentCaptures') {
    chrome.storage.local.get(['recentCaptures'], function(result) {
      sendResponse({ 
        success: true, 
        captures: result.recentCaptures || [] 
      });
    });
    return true; // Keep the message channel open for async response
  }
  
  if (request.action === 'search') {
    searchContent(request.query)
      .then(results => sendResponse({ success: true, results }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep the message channel open for async response
  }
});
