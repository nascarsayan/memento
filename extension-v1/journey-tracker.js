/**
 * Tracks user's browsing journey
 */
class JourneyTracker {
  constructor() {
    this.nodes = {}; // url -> node data
    this.edges = {}; // sourceUrl_targetUrl -> edge data
    this.root = null; // first visited url
    this.current = null; // current url
  }

  /**
   * Track a page visit
   * @param {Object} pageData - Data about the visited page
   * @param {string} pageData.url - The URL of the visited page
   * @param {string} pageData.title - The title of the visited page
   * @param {string} pageData.timestamp - The timestamp of the visit
   */
  trackVisit(pageData) {
    const { url, title, timestamp } = pageData;
    
    // Create or update the node for this URL
    this.nodes[url] = {
      url,
      title,
      lastVisited: timestamp || new Date().toISOString(),
      visitCount: (this.nodes[url]?.visitCount || 0) + 1
    };
    
    // Set as root if this is the first node
    if (!this.root) {
      this.root = url;
    }
    
    // Create an edge between the previous page and this one if applicable
    if (this.current && this.current !== url) {
      const edgeKey = `${this.current}_${url}`;
      
      if (!this.edges[edgeKey]) {
        this.edges[edgeKey] = {
          source: this.current,
          target: url,
          traversals: 0
        };
      }
      
      this.edges[edgeKey].traversals += 1;
      this.edges[edgeKey].lastTraversed = timestamp || new Date().toISOString();
    }
    
    // Update current page
    this.current = url;
  }

  /**
   * Get journey data
   * @returns {Object} - The journey data
   */
  getJourney() {
    return {
      nodes: this.nodes,
      edges: this.edges,
      root: this.root,
      current: this.current
    };
  }

  /**
   * Load journey data from storage
   * @param {Object} data - The journey data
   */
  loadJourney(data) {
    if (data.nodes) this.nodes = data.nodes;
    if (data.edges) this.edges = data.edges;
    this.root = data.root || null;
    this.current = data.current || null;
  }

  /**
   * Get recent visits (most recent first)
   * @param {number} limit - Maximum number of visits to return
   * @returns {Array<{url: string, title: string, lastVisited: string}>}
   */
  getRecentVisits(limit = 10) {
    return Object.values(this.nodes)
      .sort((a, b) => new Date(b.lastVisited) - new Date(a.lastVisited))
      .slice(0, limit);
  }

  /**
   * Get most visited pages
   * @param {number} limit - Maximum number of pages to return
   * @returns {Array<{url: string, title: string, visitCount: number}>}
   */
  getMostVisited(limit = 10) {
    return Object.values(this.nodes)
      .sort((a, b) => b.visitCount - a.visitCount)
      .slice(0, limit);
  }
}
