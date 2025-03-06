/**
 * Storage manager for the Memento Web Indexer extension
 */
class StorageManager {
  constructor() {
    // Initialize storage
  }

  /**
   * Save data to browser storage
   * @param {object} data - The data to save
   * @returns {Promise} - A promise that resolves when the data is saved
   */
  saveData(data) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Get data from browser storage
   * @param {string|array} keys - The key or keys to get
   * @returns {Promise} - A promise that resolves with the requested data
   */
  getData(keys) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(keys, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result);
        }
      });
    });
  }

  /**
   * Remove data from browser storage
   * @param {string|array} keys - The key or keys to remove
   * @returns {Promise} - A promise that resolves when the data is removed
   */
  removeData(keys) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(keys, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }
}

// No longer exporting a global storageManager instance
// This will allow the background script to create its own instance
