/**
 * Viewport and Interaction Tracker
 * This script tracks how long elements are visible in the viewport and user interactions
 */

// Configuration
const REPORTING_INTERVAL = 5000; // Report data every 5 seconds
const MIN_TRACKING_TIME = 100; // Minimum time in ms to track an element

// Track metrics
const viewportData = {}; // Map of selectors to their visibility data
let scrollEvents = 0;
let cursorMovement = 0;
let lastMouseX = 0;
let lastMouseY = 0;
let lastScrollTop = window.scrollY;

// Elements to track with their selectors
const elementsToTrack = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'ul', 'ol', 'blockquote', 'pre',
  'article', 'section', '.content', '.main',
  'img', 'figure', 'table'
];

// Create a string path for an element (for uniqueness)
function getElementPath(element, maxDepth = 3) {
  let path = [];
  let currentElement = element;
  let depth = 0;
  
  while (currentElement && currentElement !== document.body && depth < maxDepth) {
    let identifier = currentElement.id ? `#${currentElement.id}` : 
                    currentElement.className ? `.${currentElement.className.split(' ')[0]}` : 
                    currentElement.tagName.toLowerCase();
                    
    // Add nth-child for better uniqueness
    const parent = currentElement.parentNode;
    if (parent) {
      const siblings = Array.from(parent.children);
      const index = siblings.indexOf(currentElement);
      identifier += `:nth-child(${index + 1})`;
    }
    
    path.unshift(identifier);
    currentElement = currentElement.parentNode;
    depth++;
  }
  
  return path.join(' > ');
}

// Check if an element is visible in viewport
function isElementInViewport(element) {
  const rect = element.getBoundingClientRect();
  const windowHeight = window.innerHeight || document.documentElement.clientHeight;
  const windowWidth = window.innerWidth || document.documentElement.clientWidth;
  
  // Calculate how much of the element is visible
  const visibleHeight = Math.min(rect.bottom, windowHeight) - Math.max(rect.top, 0);
  const visibleWidth = Math.min(rect.right, windowWidth) - Math.max(rect.left, 0);
  
  if (visibleHeight <= 0 || visibleWidth <= 0) return { visible: false, percentage: 0 };
  
  // Calculate percentage of element visible
  const elementArea = rect.width * rect.height;
  const visibleArea = visibleWidth * visibleHeight;
  const visibilityPercentage = (visibleArea / elementArea) * 100;
  
  return { visible: true, percentage: visibilityPercentage };
}

// Track viewport visibility for all target elements
function trackViewportVisibility() {
  const elements = [];
  
  // Find all tracked elements
  elementsToTrack.forEach(selector => {
    const found = document.querySelectorAll(selector);
    found.forEach(element => elements.push(element));
  });
  
  // Track each element's visibility
  elements.forEach(element => {
    const visibility = isElementInViewport(element);
    const path = getElementPath(element);
    
    if (visibility.visible) {
      if (!viewportData[path]) {
        viewportData[path] = {
          timeVisible: 0,
          visibilityPercentage: visibility.percentage,
          element: path
        };
      }
      
      viewportData[path].timeVisible += MIN_TRACKING_TIME;
      viewportData[path].visibilityPercentage = Math.max(
        viewportData[path].visibilityPercentage, 
        visibility.percentage
      );
    }
  });
}

// Track mouse movement
function trackMouseMovement(e) {
  if (lastMouseX && lastMouseY) {
    // Calculate distance moved
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    cursorMovement += distance;
  }
  
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
}

// Track scroll events
function trackScroll() {
  const currentScrollTop = window.scrollY;
  if (Math.abs(currentScrollTop - lastScrollTop) > 10) { // Only count significant scrolls
    scrollEvents++;
    lastScrollTop = currentScrollTop;
  }
}

// Report data back to background script
function reportData() {
  // Filter out elements with minimal visibility time
  const filteredViewportData = {};
  Object.entries(viewportData).forEach(([selector, data]) => {
    if (data.timeVisible >= 500) { // At least 500ms to be significant
      filteredViewportData[selector] = data;
    }
  });
  
  chrome.runtime.sendMessage({
    action: 'updateInteractionData',
    viewportData: filteredViewportData,
    cursorMovement,
    scrollEvents
  });
  
  // Reset counters after reporting
  cursorMovement = 0;
  scrollEvents = 0;
}

// Initialize tracking
function initTracking() {
  // Start tracking viewport visibility
  setInterval(trackViewportVisibility, MIN_TRACKING_TIME);
  
  // Track mouse movement
  document.addEventListener('mousemove', trackMouseMovement, { passive: true });
  
  // Track scroll events
  document.addEventListener('scroll', trackScroll, { passive: true });
  
  // Report data periodically
  setInterval(reportData, REPORTING_INTERVAL);
  
  // Report data on page unload
  window.addEventListener('beforeunload', reportData);
}

// Start tracking
initTracking();
