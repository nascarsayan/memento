// Server configurations
const SERVER_URL = 'http://localhost:8080';
const SAVE_DIR = 'memento_pages';

// Generate a unique filename based on the URL and timestamp
function generateFilename(url) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const urlSafe = url.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 100);
  return `${timestamp}_${urlSafe}`;
}

// Auto-capture when page loads completely
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
    captureAndSavePage(tabId);
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
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      function: () => {
        // This is a simplified HTML to Markdown conversion.
        // In a real implementation, you'd use a more robust library or algorithm.
        function simplifyHtml(node) {
          // Create a clone of the node to avoid modifying the original DOM
          const clone = node.cloneNode(true);
          
          // Remove script tags, style tags, comments, etc.
          const elementsToRemove = ['script', 'style', 'iframe', 'noscript', 'svg', 'canvas'];
          elementsToRemove.forEach(tag => {
            const elements = clone.querySelectorAll(tag);
            elements.forEach(el => el.parentNode.removeChild(el));
          });
          
          return clone;
        }
        
        function getMainContent(document) {
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
            const element = document.querySelector(selector);
            if (element) return element;
          }
          
          // Fallback to body if no specific content area is found
          return document.body;
        }
        
        function htmlToMarkdown(element) {
          let markdown = '';
          
          // Process headings
          const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6');
          headings.forEach(heading => {
            const level = parseInt(heading.tagName[1]);
            const prefix = '#'.repeat(level) + ' ';
            heading.innerHTML = prefix + heading.innerText.trim();
          });
          
          // Process paragraphs
          const paragraphs = element.querySelectorAll('p');
          paragraphs.forEach(p => {
            p.innerHTML = p.innerText.trim() + '\n\n';
          });
          
          // Process links
          const links = element.querySelectorAll('a');
          links.forEach(link => {
            const text = link.innerText.trim();
            const href = link.getAttribute('href');
            if (href && text) {
              link.innerHTML = `[${text}](${href})`;
            }
          });
          
          // Process lists
          const listItems = element.querySelectorAll('li');
          listItems.forEach(li => {
            const parent = li.parentElement;
            const prefix = parent.tagName === 'OL' ? '1. ' : '- ';
            li.innerHTML = prefix + li.innerText.trim();
          });
          
          // Process images
          const images = element.querySelectorAll('img');
          images.forEach(img => {
            const alt = img.getAttribute('alt') || '';
            const src = img.getAttribute('src') || '';
            if (src) {
              img.outerHTML = `![${alt}](${src})`;
            }
          });
          
          // Convert blockquotes
          const quotes = element.querySelectorAll('blockquote');
          quotes.forEach(quote => {
            const lines = quote.innerText.trim().split('\n');
            quote.innerHTML = lines.map(line => `> ${line}`).join('\n');
          });
          
          // Extract text from cleaned HTML
          return element.innerText
            .replace(/\n{3,}/g, '\n\n')  // Remove excessive newlines
            .trim();
        }
        
        // Get document and simplify
        const doc = document.cloneNode(true);
        const simplified = simplifyHtml(doc);
        
        // Get the main content
        const mainContent = getMainContent(simplified);
        
        // Convert to markdown
        return htmlToMarkdown(mainContent);
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
  const htmlFilename = `${baseFilename}.html`;
  const mdFilename = `${baseFilename}.md`;
  
  const metadata = {
    url: pageData.url,
    title: pageData.title,
    timestamp: pageData.timestamp,
    htmlFilename: htmlFilename,
    mdFilename: mdFilename
  };
  
  // Create a blob with the HTML content
  const htmlBlob = new Blob([pageData.content], { type: 'text/html' });
  
  // Save the HTML content
  chrome.downloads.download({
    url: URL.createObjectURL(htmlBlob),
    filename: `${SAVE_DIR}/${htmlFilename}`,
    saveAs: false
  });
  
  // Convert to Markdown and save
  const markdownContent = await convertToMarkdown(tabId, pageData);
  if (markdownContent) {
    // Add title and URL to the markdown content
    const markdownWithMeta = `# ${pageData.title}\n\nURL: ${pageData.url}\n\n${markdownContent}`;
    const mdBlob = new Blob([markdownWithMeta], { type: 'text/markdown' });
    
    chrome.downloads.download({
      url: URL.createObjectURL(mdBlob),
      filename: `${SAVE_DIR}/${mdFilename}`,
      saveAs: false
    });
    
    metadata.hasMarkdown = true;
  } else {
    metadata.hasMarkdown = false;
  }
  
  // Save metadata as JSON
  const metadataBlob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });
  chrome.downloads.download({
    url: URL.createObjectURL(metadataBlob),
    filename: `${SAVE_DIR}/${baseFilename}.json`,
    saveAs: false
  });
  
  return metadata;
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
