/**
 * Popup script for the Memento Web Indexer extension
 */

// Get elements
const indexButton = document.getElementById('indexButton');
const viewIndexedButton = document.getElementById('viewIndexedButton');
const statusElement = document.getElementById('status');

// Add click event to index button
indexButton.addEventListener('click', async () => {
  try {
    statusElement.textContent = 'Indexing page...';
    
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // Extract content from the page
    const pageData = await chrome.tabs.sendMessage(tab.id, { action: 'extract_content' });
    
    // Send the content to be indexed
    const response = await chrome.runtime.sendMessage({ 
      action: 'index_page', 
      data: pageData 
    });
    
    if (response.success) {
      statusElement.textContent = 'Page indexed successfully!';
    } else {
      statusElement.textContent = `Error: ${response.error}`;
    }
  } catch (error) {
    statusElement.textContent = `Error: ${error.message}`;
  }
});

// Add click event to view indexed button
viewIndexedButton.addEventListener('click', () => {
  chrome.tabs.create({ url: 'indexed-pages.html' });
});
