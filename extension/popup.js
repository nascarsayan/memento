document.addEventListener('DOMContentLoaded', () => {
  const manualCaptureBtn = document.getElementById('manualCaptureBtn');
  const captureStatus = document.getElementById('captureStatus');
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');
  const searchResults = document.getElementById('searchResults');
  const recentCaptures = document.getElementById('recentCaptures');
  
  // Load recent captures when popup opens
  loadRecentCaptures();
  
  // Handle manual page capture
  manualCaptureBtn.addEventListener('click', () => {
    captureStatus.textContent = 'Capturing page...';
    captureStatus.className = 'status';
    
    chrome.runtime.sendMessage({ action: 'capturePage' }, (response) => {
      if (response.success) {
        captureStatus.textContent = 'Page captured successfully!';
        captureStatus.className = 'status success';
        loadRecentCaptures(); // Reload the list
      } else {
        captureStatus.textContent = `Error: ${response.error || 'Unknown error'}`;
        captureStatus.className = 'status error';
      }
    });
  });
  
  // Function to load recent captures
  function loadRecentCaptures() {
    chrome.runtime.sendMessage({ action: 'getRecentCaptures' }, (response) => {
      if (response.success && response.captures) {
        displayCaptures(response.captures);
      } else {
        recentCaptures.innerHTML = '<div class="no-captures">No recent captures</div>';
      }
    });
  }
  
  // Display the list of recent captures
  function displayCaptures(captures) {
    if (captures.length === 0) {
      recentCaptures.innerHTML = '<div class="no-captures">No recent captures</div>';
      return;
    }
    
    recentCaptures.innerHTML = '';
    captures.slice(0, 10).forEach(capture => {  // Show only the 10 most recent captures
      const captureItem = document.createElement('div');
      captureItem.className = 'capture-item';
      
      const title = document.createElement('div');
      title.className = 'capture-title';
      title.textContent = capture.title || 'Untitled Page';
      title.addEventListener('click', () => {
        chrome.tabs.create({ url: capture.url });
      });
      
      const url = document.createElement('div');
      url.className = 'capture-url';
      url.textContent = capture.url;
      
      const time = document.createElement('div');
      time.className = 'capture-time';
      time.textContent = new Date(capture.timestamp).toLocaleString();
      
      const formats = document.createElement('div');
      formats.className = 'capture-formats';
      
      const htmlFormat = document.createElement('span');
      htmlFormat.className = 'capture-format';
      htmlFormat.textContent = 'HTML';
      htmlFormat.addEventListener('click', () => {
        chrome.downloads.download({
          url: `file:///${SAVE_DIR}/${capture.htmlFilename}`,
          saveAs: true
        });
      });
      
      formats.appendChild(htmlFormat);
      
      if (capture.hasMarkdown) {
        const mdFormat = document.createElement('span');
        mdFormat.className = 'capture-format';
        mdFormat.textContent = 'Markdown';
        mdFormat.addEventListener('click', () => {
          chrome.downloads.download({
            url: `file:///${SAVE_DIR}/${capture.mdFilename}`,
            saveAs: true
          });
        });
        formats.appendChild(mdFormat);
      }
      
      captureItem.appendChild(title);
      captureItem.appendChild(url);
      captureItem.appendChild(time);
      captureItem.appendChild(formats);
      recentCaptures.appendChild(captureItem);
    });
  }
  
  // Handle search
  searchBtn.addEventListener('click', performSearch);
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
  });
  
  function performSearch() {
    const query = searchInput.value.trim();
    if (!query) return;
    
    searchResults.innerHTML = '<div>Searching...</div>';
    
    chrome.runtime.sendMessage({ 
      action: 'search', 
      query: query 
    }, (response) => {
      if (response.success && response.results) {
        displayResults(response.results);
      } else {
        searchResults.innerHTML = `<div class="status error">Error: ${response.error || 'No results found'}</div>`;
      }
    });
  }
  
  function displayResults(results) {
    if (results.length === 0) {
      searchResults.innerHTML = '<div>No results found.</div>';
      return;
    }
    
    searchResults.innerHTML = '';
    results.forEach(result => {
      const resultItem = document.createElement('div');
      resultItem.className = 'result-item';
      
      const title = document.createElement('div');
      title.className = 'result-title';
      title.textContent = result.title;
      title.addEventListener('click', () => {
        chrome.tabs.create({ url: result.url });
      });
      
      const url = document.createElement('div');
      url.className = 'result-url';
      url.textContent = result.url;
      
      const snippet = document.createElement('div');
      snippet.className = 'result-snippet';
      snippet.textContent = result.snippet;
      
      resultItem.appendChild(title);
      resultItem.appendChild(url);
      resultItem.appendChild(snippet);
      searchResults.appendChild(resultItem);
    });
  }
});
