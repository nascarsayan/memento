/**
 * Script for the indexed pages view
 */

// Load the storage manager
document.addEventListener('DOMContentLoaded', async () => {
  const pageListElement = document.getElementById('pageList');
  
  try {
    // Get all stored data
    chrome.storage.local.get(null, (data) => {
      // Filter to only include page data
      const pages = Object.entries(data)
        .filter(([key]) => key.startsWith('page_'))
        .map(([key, value]) => value)
        .sort((a, b) => b.timestamp - a.timestamp); // Sort by newest first
      
      if (pages.length === 0) {
        pageListElement.innerHTML = `
          <div class="empty-message">
            No pages have been indexed yet.
          </div>
        `;
        return;
      }
      
      // Display the pages
      pageListElement.innerHTML = pages.map(page => `
        <div class="page-item">
          <div class="page-title">${escapeHtml(page.title)}</div>
          <div class="page-url">
            <a href="${escapeHtml(page.url)}" target="_blank">${escapeHtml(page.url)}</a>
          </div>
          <div class="page-date">Indexed on: ${new Date(page.timestamp).toLocaleString()}</div>
          <div class="page-content">${escapeHtml(page.content.substring(0, 500))}${page.content.length > 500 ? '...' : ''}</div>
        </div>
      `).join('');
    });
  } catch (error) {
    pageListElement.innerHTML = `
      <div class="empty-message">
        Error loading indexed pages: ${error.message}
      </div>
    `;
  }
});

/**
 * Escape HTML special characters
 * @param {string} text - The text to escape
 * @returns {string} - The escaped text
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
