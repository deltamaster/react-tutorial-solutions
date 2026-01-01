// Memory Service - Encapsulates all memory-related operations with a unified API

// Storage prefix
const MEMORY_PREFIX = 'memory-';

// Check if Chrome storage is available (for extension environment)
const isChromeExtension = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

/**
 * Parse memory value - handles both old format (plain string) and new format (JSON with metadata)
 * @param {string} value - The stored memory value
 * @returns {Object|null} Parsed memory object with metadata and data, or null if invalid
 */
function parseMemoryValue(value) {
  if (!value) return null;
  
  try {
    const parsed = JSON.parse(value);
    // New format: { metadata: { lastUpdate, deleted }, data: ... }
    if (parsed.metadata && parsed.data !== undefined) {
      return parsed;
    }
    // Old format: plain string, treat entire value as data
    return {
      metadata: {
        lastUpdate: Date.now(), // Assign current timestamp for old entries
        deleted: false
      },
      data: value // Entire old value becomes data
    };
  } catch (e) {
    // Not JSON, treat as old format plain string
    return {
      metadata: {
        lastUpdate: Date.now(),
        deleted: false
      },
      data: value
    };
  }
}

/**
 * Format memory value to JSON string with metadata
 * @param {any} data - The memory data
 * @param {number} lastUpdate - Timestamp (defaults to current time)
 * @param {boolean} deleted - Whether memory is deleted (defaults to false)
 * @returns {string} JSON string representation
 */
function formatMemoryValue(data, lastUpdate = null, deleted = false) {
  return JSON.stringify({
    metadata: {
      lastUpdate: lastUpdate || Date.now(),
      deleted: deleted
    },
    data: data
  });
}

/**
 * Get the data portion from a memory value (handles both formats)
 * @param {string} value - The stored memory value
 * @returns {string} The memory data
 */
function getMemoryData(value) {
  const parsed = parseMemoryValue(value);
  return parsed ? parsed.data : value;
}

/**
 * Check if a memory is deleted
 * @param {string} value - The stored memory value
 * @returns {boolean} True if memory is marked as deleted
 */
function isMemoryDeleted(value) {
  const parsed = parseMemoryValue(value);
  return parsed ? parsed.metadata.deleted : false;
}

/**
 * Get the lastUpdate timestamp from a memory value
 * @param {string} value - The stored memory value
 * @returns {number} Timestamp, or 0 if not available
 */
function getMemoryLastUpdate(value) {
  const parsed = parseMemoryValue(value);
  return parsed ? parsed.metadata.lastUpdate : 0;
}

// Event bus - Used to notify about memory changes
const eventBus = {
  subscribers: [],
  
  // Subscribe to memory change events
  subscribe(callback) {
    if (typeof callback === 'function') {
      this.subscribers.push(callback);
      return () => {
        this.subscribers = this.subscribers.filter(sub => sub !== callback);
      };
    }
  },
  
  // Publish memory change events
  publish(key, action) {
    console.log(`Memory service publishing: ${action} for key ${key}`);
    this.subscribers.forEach(subscriber => {
      subscriber(key, action);
    });
  }
};

// Memory service API
const memoryService = {
  // Get all memory items (returns only non-deleted memories, with data extracted)
  getAllMemories: async () => {
    try {
      if (isChromeExtension) {
        return new Promise((resolve, reject) => {
          chrome.storage.local.get(null, (items) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
              return;
            }
            const memories = {};
            for (const key in items) {
              if (key.startsWith(MEMORY_PREFIX)) {
                const actualKey = key.substring(MEMORY_PREFIX.length);
                const value = items[key];
                // Filter out deleted memories
                if (!isMemoryDeleted(value)) {
                  memories[actualKey] = getMemoryData(value);
                }
              }
            }
            resolve(memories);
          });
        });
      } else {
        // Fallback to localStorage
        const memories = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(MEMORY_PREFIX)) {
            const actualKey = key.substring(MEMORY_PREFIX.length);
            const value = localStorage.getItem(key);
            // Filter out deleted memories
            if (!isMemoryDeleted(value)) {
              memories[actualKey] = getMemoryData(value);
            }
          }
        }
        return memories;
      }
    } catch (error) {
      console.error('Error getting all memories:', error);
      return {};
    }
  },
  
  // Get all memory items with full metadata (for sync purposes)
  getAllMemoriesWithMetadata: async () => {
    try {
      if (isChromeExtension) {
        return new Promise((resolve, reject) => {
          chrome.storage.local.get(null, (items) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
              return;
            }
            const memories = {};
            for (const key in items) {
              if (key.startsWith(MEMORY_PREFIX)) {
                const actualKey = key.substring(MEMORY_PREFIX.length);
                memories[actualKey] = items[key];
              }
            }
            resolve(memories);
          });
        });
      } else {
        // Fallback to localStorage
        const memories = {};
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(MEMORY_PREFIX)) {
            const actualKey = key.substring(MEMORY_PREFIX.length);
            memories[actualKey] = localStorage.getItem(key);
          }
        }
        return memories;
      }
    } catch (error) {
      console.error('Error getting all memories with metadata:', error);
      return {};
    }
  },
  
  // Get a single memory item (returns data only, null if deleted)
  getMemory: async (key) => {
    try {
      const memoryKey = MEMORY_PREFIX + key;
      
      if (isChromeExtension) {
        return new Promise((resolve, reject) => {
          chrome.storage.local.get([memoryKey], (result) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
              return;
            }
            const value = result[memoryKey];
            if (!value) {
              resolve(null);
              return;
            }
            // Return null if deleted, otherwise return data
            if (isMemoryDeleted(value)) {
              resolve(null);
            } else {
              resolve(getMemoryData(value));
            }
          });
        });
      } else {
        // Fallback to localStorage
        const value = localStorage.getItem(memoryKey);
        if (!value) return null;
        if (isMemoryDeleted(value)) return null;
        return getMemoryData(value);
      }
    } catch (error) {
      console.error(`Error getting memory for key ${key}:`, error);
      return null;
    }
  },
  
  // Get a single memory item with full metadata (for sync purposes)
  getMemoryWithMetadata: async (key) => {
    try {
      const memoryKey = MEMORY_PREFIX + key;
      
      if (isChromeExtension) {
        return new Promise((resolve, reject) => {
          chrome.storage.local.get([memoryKey], (result) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
              return;
            }
            resolve(result[memoryKey] || null);
          });
        });
      } else {
        // Fallback to localStorage
        return localStorage.getItem(memoryKey);
      }
    } catch (error) {
      console.error(`Error getting memory with metadata for key ${key}:`, error);
      return null;
    }
  },
  
  // Set a memory item (value can be plain data or full JSON format)
  setMemory: async (key, value) => {
    try {
      console.log('set_memory', key, value);
      const memoryKey = MEMORY_PREFIX + key;
      
      // Check if value is already in new format
      let formattedValue;
      try {
        const parsed = JSON.parse(value);
        if (parsed.metadata && parsed.data !== undefined) {
          // Already in new format, just update timestamp if not deleted
          formattedValue = formatMemoryValue(
            parsed.data,
            Date.now(), // Update timestamp
            parsed.metadata.deleted
          );
        } else {
          // Not in expected format, treat as data
          formattedValue = formatMemoryValue(value);
        }
      } catch (e) {
        // Not JSON, treat as plain data
        formattedValue = formatMemoryValue(value);
      }
      
      if (isChromeExtension) {
        return new Promise(async (resolve, reject) => {
          chrome.storage.local.set({ [memoryKey]: formattedValue }, async () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
              return;
            }
            eventBus.publish(memoryKey, 'setItem');
            resolve({ status: 'OK', memoryKey: key });
          });
        });
      } else {
        // Fallback to localStorage
        localStorage.setItem(memoryKey, formattedValue);
        eventBus.publish(memoryKey, 'setItem');
        return { status: 'OK', memoryKey: key };
      }
    } catch (error) {
      console.error(`Error setting memory for key ${key}:`, error);
      return { status: 'ERROR', error: error.message };
    }
  },
  
  // Delete a memory item (marks as deleted instead of removing)
  deleteMemory: async (key) => {
    try {
      console.log('delete_memory', key);
      const memoryKey = MEMORY_PREFIX + key;
      
      // Get current value to preserve data
      let currentValue = null;
      if (isChromeExtension) {
        currentValue = await new Promise((resolve, reject) => {
          chrome.storage.local.get([memoryKey], (result) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
              return;
            }
            resolve(result[memoryKey] || null);
          });
        });
      } else {
        currentValue = localStorage.getItem(memoryKey);
      }
      
      // Parse current value to get data
      const parsed = parseMemoryValue(currentValue);
      const data = parsed ? parsed.data : currentValue || '';
      
      // Mark as deleted with current timestamp
      const deletedValue = formatMemoryValue(data, Date.now(), true);
      
      if (isChromeExtension) {
        return new Promise(async (resolve, reject) => {
          chrome.storage.local.set({ [memoryKey]: deletedValue }, async () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
              return;
            }
            eventBus.publish(memoryKey, 'removeItem');
            resolve({ status: 'OK', memoryKey: key });
          });
        });
      } else {
        // Fallback to localStorage
        localStorage.setItem(memoryKey, deletedValue);
        eventBus.publish(memoryKey, 'removeItem');
        return { status: 'OK', memoryKey: key };
      }
    } catch (error) {
      console.error(`Error deleting memory for key ${key}:`, error);
      return { status: 'ERROR', error: error.message };
    }
  },
  
  // Clear all memory items
  clearAllMemories: async () => {
    try {
      if (isChromeExtension) {
        return new Promise((resolve, reject) => {
          chrome.storage.local.get(null, (items) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
              return;
            }
            const keysToDelete = Object.keys(items).filter(key => key.startsWith(MEMORY_PREFIX));
            
            if (keysToDelete.length > 0) {
              chrome.storage.local.remove(keysToDelete, () => {
                if (chrome.runtime.lastError) {
                  reject(chrome.runtime.lastError);
                  return;
                }
                eventBus.publish(null, 'clear');
                resolve({ status: 'OK' });
              });
            } else {
              eventBus.publish(null, 'clear');
              resolve({ status: 'OK' });
            }
          });
        });
      } else {
        // Fallback to localStorage
        const keysToDelete = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(MEMORY_PREFIX)) {
            keysToDelete.push(key);
          }
        }
        keysToDelete.forEach(key => localStorage.removeItem(key));
        eventBus.publish(null, 'clear');
        return { status: 'OK' };
      }
    } catch (error) {
      console.error('Error clearing all memories:', error);
      return { status: 'ERROR', error: error.message };
    }
  },
  
  // Check if a memory item exists
  hasMemory: async (key) => {
    try {
      const memory = await memoryService.getMemory(key);
      return memory !== null;
    } catch (error) {
      console.error(`Error checking memory for key ${key}:`, error);
      return false;
    }
  },
  
  // Subscribe to memory change events
  subscribe: (callback) => {
    return eventBus.subscribe(callback);
  }
};

export default memoryService;