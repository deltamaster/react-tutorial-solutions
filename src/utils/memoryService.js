// Memory Service - Encapsulates all memory-related operations with a unified API

// Storage prefix
const MEMORY_PREFIX = 'memory-';

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
  getAllMemories() {
    const memories = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(MEMORY_PREFIX)) {
        const actualKey = key.substring(MEMORY_PREFIX.length);
        memories[actualKey] = localStorage.getItem(key);
      }
    }
    return memories;
  },
  
  // Get a single memory item
  getMemory(key) {
    const memoryKey = MEMORY_PREFIX + key;
    return localStorage.getItem(memoryKey);
  },
  
  // Set a memory item
  setMemory(key, value) {
    console.log('set_memory', key, value);
    const memoryKey = MEMORY_PREFIX + key;
    localStorage.setItem(memoryKey, value);
    eventBus.publish(memoryKey, 'setItem');
    return { status: 'OK', memoryKey: key, memoryValue: value };
  },
  
  // Delete a memory item
  deleteMemory(key) {
    console.log('delete_memory', key);
    const memoryKey = MEMORY_PREFIX + key;
    localStorage.removeItem(memoryKey);
    eventBus.publish(memoryKey, 'removeItem');
    return { status: 'OK', memoryKey: key };
  },
  
  // Clear all memory items
  clearAllMemories() {
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
  },
  
  // Check if a memory item exists
  hasMemory(key) {
    const memoryKey = MEMORY_PREFIX + key;
    return localStorage.getItem(memoryKey) !== null;
  },
  
  // Subscribe to memory change events
  subscribe(callback) {
    return eventBus.subscribe(callback);
  }
};

export default memoryService;