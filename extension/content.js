// This script runs in the context of web pages

// Function to check if this is a meaningful page to capture
function shouldCapturePage() {
  // Skip very short pages or login pages
  const hasContent = document.body && document.body.innerText.length > 100;
  const isLoginPage = document.querySelectorAll('input[type="password"]').length > 0;
  const hasArticle = document.querySelector('article') || document.querySelector('main');
  
  return hasContent && !isLoginPage && (document.title.length > 0 || hasArticle);
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getDOM') {
    sendResponse({
      content: document.documentElement.outerHTML,
      url: window.location.href,
      title: document.title,
      shouldCapture: shouldCapturePage()
    });
  }
});
