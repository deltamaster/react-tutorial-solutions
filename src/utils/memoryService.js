// Memory Service - Encapsulates all memory-related operations with a unified API

// Storage prefix
const MEMORY_PREFIX = 'memory-';

// Lazy import profileSyncService to avoid circular dependencies
let profileSyncService = null;
const getProfileSyncService = async () => {
  if (!profileSyncService) {
    profileSyncService = await import('./profileSyncService');
  }
  return profileSyncService;
};

// Check if Chrome storage is available (for extension environment)
const isChromeExtension = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

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
  // Get all memory items
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
      console.error('Error getting all memories:', error);
      return {};
    }
  },
  
  // Get a single memory item
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
            resolve(result[memoryKey] || null);
          });
        });
      } else {
        // Fallback to localStorage
        return localStorage.getItem(memoryKey);
      }
    } catch (error) {
      console.error(`Error getting memory for key ${key}:`, error);
      return null;
    }
  },
  
  // Set a memory item
  setMemory: async (key, value) => {
    try {
      console.log('set_memory', key, value);
      const memoryKey = MEMORY_PREFIX + key;
      
      if (isChromeExtension) {
        return new Promise(async (resolve, reject) => {
          chrome.storage.local.set({ [memoryKey]: value }, async () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
              return;
            }
            // If memory was previously deleted, remove it from deleted list
            try {
              const syncService = await getProfileSyncService();
              if (syncService.default && syncService.default.getDeletedMemories) {
                const deleted = await syncService.default.getDeletedMemories();
                if (deleted.has(key)) {
                  // Memory is being restored, remove from deleted list
                  const removeDeleted = await import('./profileSyncService');
                  if (removeDeleted.default && removeDeleted.default.removeDeletedMemory) {
                    // We need to call the internal function, but it's not exported
                    // Instead, we'll handle this during sync - if a memory exists locally,
                    // it will be included in the merged set regardless of deleted list
                  }
                }
              }
            } catch (syncError) {
              // Non-critical error, log but don't fail
              console.warn('Failed to check deleted memories:', syncError);
            }
            eventBus.publish(memoryKey, 'setItem');
            resolve({ status: 'OK', memoryKey: key });
          });
        });
      } else {
        // Fallback to localStorage
        localStorage.setItem(memoryKey, value);
        // Note: We don't remove from deleted list here - sync will handle it
        // because local memories take precedence during merge
        eventBus.publish(memoryKey, 'setItem');
        return { status: 'OK', memoryKey: key };
      }
    } catch (error) {
      console.error(`Error setting memory for key ${key}:`, error);
      return { status: 'ERROR', error: error.message };
    }
  },
  
  // Delete a memory item
  deleteMemory: async (key) => {
    try {
      console.log('delete_memory', key);
      const memoryKey = MEMORY_PREFIX + key;
      
      if (isChromeExtension) {
        return new Promise(async (resolve, reject) => {
          chrome.storage.local.remove([memoryKey], async () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
              return;
            }
            // Track deletion for sync purposes
            try {
              const syncService = await getProfileSyncService();
              if (syncService.default && syncService.default.trackMemoryDeletion) {
                await syncService.default.trackMemoryDeletion(key);
              }
            } catch (syncError) {
              // Non-critical error, log but don't fail
              console.warn('Failed to track memory deletion for sync:', syncError);
            }
            eventBus.publish(memoryKey, 'removeItem');
            resolve({ status: 'OK', memoryKey: key });
          });
        });
      } else {
        // Fallback to localStorage
        localStorage.removeItem(memoryKey);
        // Track deletion for sync purposes
        try {
          const syncService = await getProfileSyncService();
          if (syncService.default && syncService.default.trackMemoryDeletion) {
            await syncService.default.trackMemoryDeletion(key);
          }
        } catch (syncError) {
          // Non-critical error, log but don't fail
          console.warn('Failed to track memory deletion for sync:', syncError);
        }
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