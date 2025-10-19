// Memory Service - 封装所有内存相关的操作，提供统一的API

// 存储前缀
const MEMORY_PREFIX = 'memory-';

// 事件总线 - 用于通知内存变化
const eventBus = {
  subscribers: [],
  
  // 订阅内存变化事件
  subscribe(callback) {
    if (typeof callback === 'function') {
      this.subscribers.push(callback);
      return () => {
        this.subscribers = this.subscribers.filter(sub => sub !== callback);
      };
    }
  },
  
  // 发布内存变化事件
  publish(key, action) {
    console.log(`Memory service publishing: ${action} for key ${key}`);
    this.subscribers.forEach(subscriber => {
      subscriber(key, action);
    });
  }
};

// 内存服务API
const memoryService = {
  // 获取所有内存项
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
  
  // 获取单个内存项
  getMemory(key) {
    const memoryKey = MEMORY_PREFIX + key;
    return localStorage.getItem(memoryKey);
  },
  
  // 设置内存项
  setMemory(key, value) {
    console.log('set_memory', key, value);
    const memoryKey = MEMORY_PREFIX + key;
    localStorage.setItem(memoryKey, value);
    eventBus.publish(memoryKey, 'setItem');
    return { status: 'OK', memoryKey: key, memoryValue: value };
  },
  
  // 删除内存项
  deleteMemory(key) {
    console.log('delete_memory', key);
    const memoryKey = MEMORY_PREFIX + key;
    localStorage.removeItem(memoryKey);
    eventBus.publish(memoryKey, 'removeItem');
    return { status: 'OK', memoryKey: key };
  },
  
  // 清除所有内存项
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
  
  // 检查内存项是否存在
  hasMemory(key) {
    const memoryKey = MEMORY_PREFIX + key;
    return localStorage.getItem(memoryKey) !== null;
  },
  
  // 订阅内存变化事件
  subscribe(callback) {
    return eventBus.subscribe(callback);
  }
};

export default memoryService;