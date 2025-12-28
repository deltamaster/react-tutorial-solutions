/**
 * Profile Sync Service
 * Handles synchronization of memories with remote profile API
 */

import { getTenantId, getKeypass, getSubscriptionKey } from './settingsService';
import memoryService from './memoryService';

const API_BASE_URL = 'https://jp-gw2.azure-api.net/profile';
const DELETED_MEMORIES_KEY = 'deleted_memories';

/**
 * Get the list of deleted memory keys from local storage
 * @returns {Promise<Set<string>>} Set of deleted memory keys
 */
async function getDeletedMemories() {
  try {
    const isChromeExtension = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
    
    if (isChromeExtension) {
      return new Promise((resolve, reject) => {
        chrome.storage.local.get([DELETED_MEMORIES_KEY], (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          const deleted = result[DELETED_MEMORIES_KEY] || [];
          resolve(new Set(deleted));
        });
      });
    } else {
      const deleted = localStorage.getItem(DELETED_MEMORIES_KEY);
      return new Set(deleted ? JSON.parse(deleted) : []);
    }
  } catch (error) {
    console.error('Error getting deleted memories:', error);
    return new Set();
  }
}

/**
 * Add a memory key to the deleted memories list
 * @param {string} memoryKey - The memory key to mark as deleted
 */
async function addDeletedMemory(memoryKey) {
  try {
    const deleted = await getDeletedMemories();
    deleted.add(memoryKey);
    
    const isChromeExtension = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
    
    if (isChromeExtension) {
      return new Promise((resolve, reject) => {
        chrome.storage.local.set({ [DELETED_MEMORIES_KEY]: Array.from(deleted) }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          resolve();
        });
      });
    } else {
      localStorage.setItem(DELETED_MEMORIES_KEY, JSON.stringify(Array.from(deleted)));
    }
  } catch (error) {
    console.error('Error adding deleted memory:', error);
  }
}

/**
 * Remove a memory key from the deleted memories list (when it's restored)
 * @param {string} memoryKey - The memory key to remove from deleted list
 */
async function removeDeletedMemory(memoryKey) {
  try {
    const deleted = await getDeletedMemories();
    deleted.delete(memoryKey);
    
    const isChromeExtension = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
    
    if (isChromeExtension) {
      return new Promise((resolve, reject) => {
        chrome.storage.local.set({ [DELETED_MEMORIES_KEY]: Array.from(deleted) }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          resolve();
        });
      });
    } else {
      localStorage.setItem(DELETED_MEMORIES_KEY, JSON.stringify(Array.from(deleted)));
    }
  } catch (error) {
    console.error('Error removing deleted memory:', error);
  }
}

/**
 * Clear all deleted memories from the tracking list
 */
async function clearDeletedMemories() {
  try {
    const isChromeExtension = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
    
    if (isChromeExtension) {
      return new Promise((resolve, reject) => {
        chrome.storage.local.remove([DELETED_MEMORIES_KEY], () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          resolve();
        });
      });
    } else {
      localStorage.removeItem(DELETED_MEMORIES_KEY);
    }
  } catch (error) {
    console.error('Error clearing deleted memories:', error);
  }
}

/**
 * Fetch remote profile from API
 * @returns {Promise<Object>} The remote profile data
 */
async function fetchRemoteProfile() {
  const tenantId = getTenantId();
  const keypass = getKeypass();
  const subscriptionKey = getSubscriptionKey();

  if (!tenantId || !keypass) {
    throw new Error('Tenant ID and keypass must be configured');
  }

  if (!subscriptionKey) {
    throw new Error('Subscription key must be configured');
  }

  const url = `${API_BASE_URL}/profiles/${encodeURIComponent(tenantId)}?keypass=${encodeURIComponent(keypass)}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Ocp-Apim-Subscription-Key': subscriptionKey,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    if (response.status === 404) {
      // Profile doesn't exist yet, return null to indicate it needs to be created
      return null;
    }
    const errorText = await response.text();
    throw new Error(`Failed to fetch profile: ${errorText}`);
  }

  const data = await response.json();
  return data;
}

/**
 * Update remote profile via API
 * @param {Object} profileData - The profile data to update
 */
async function updateRemoteProfile(profileData) {
  const tenantId = getTenantId();
  const keypass = getKeypass();
  const subscriptionKey = getSubscriptionKey();

  if (!tenantId || !keypass) {
    throw new Error('Tenant ID and keypass must be configured');
  }

  if (!subscriptionKey) {
    throw new Error('Subscription key must be configured');
  }

  const url = `${API_BASE_URL}/profiles/${encodeURIComponent(tenantId)}`;
  
  const requestBody = {
    tenant_id: tenantId,
    keypass: keypass,
    profile_data: profileData
  };

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Ocp-Apim-Subscription-Key': subscriptionKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update profile: ${errorText}`);
  }
}

/**
 * Create remote profile via API
 * @param {Object} profileData - The profile data to create
 */
async function createRemoteProfile(profileData) {
  const tenantId = getTenantId();
  const keypass = getKeypass();
  const subscriptionKey = getSubscriptionKey();

  if (!tenantId || !keypass) {
    throw new Error('Tenant ID and keypass must be configured');
  }

  if (!subscriptionKey) {
    throw new Error('Subscription key must be configured');
  }

  const url = `${API_BASE_URL}/profiles`;
  
  const requestBody = {
    tenant_id: tenantId,
    keypass: keypass,
    profile_data: profileData
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': subscriptionKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create profile: ${errorText}`);
  }
}

/**
 * Convert local memories object to array format for profile_data
 * @param {Object} localMemories - Object with memory keys and values
 * @returns {Array} Array of memory objects with key and value
 */
function memoriesToArray(localMemories) {
  return Object.entries(localMemories).map(([key, value]) => ({
    key,
    value
  }));
}

/**
 * Convert memory array from profile_data to object format
 * @param {Array} memoryArray - Array of memory objects with key and value
 * @returns {Object} Object with memory keys and values
 */
function memoriesToObject(memoryArray) {
  const result = {};
  if (Array.isArray(memoryArray)) {
    memoryArray.forEach(memory => {
      if (memory && memory.key && memory.value !== undefined) {
        result[memory.key] = memory.value;
      }
    });
  }
  return result;
}

/**
 * Sync memories with remote profile
 * Merges local and remote memories, respecting deleted memories
 * @returns {Promise<Object>} Result object with sync statistics
 */
export async function syncMemories() {
  try {
    // Get local memories
    const localMemories = await memoryService.getAllMemories();
    
    // Get deleted memories list
    const deletedMemories = await getDeletedMemories();
    
    // Fetch remote profile
    const remoteProfile = await fetchRemoteProfile();
    
    // If profile doesn't exist, create it with local memories
    if (!remoteProfile) {
      const profileData = {
        memories: memoriesToArray(localMemories)
      };
      await createRemoteProfile(profileData);
      return {
        success: true,
        message: 'Profile created and synced successfully',
        stats: {
          localCount: Object.keys(localMemories).length,
          remoteCount: 0,
          mergedCount: Object.keys(localMemories).length,
          deletedCount: 0
        }
      };
    }

    // Extract remote memories
    const remoteMemoriesObj = memoriesToObject(remoteProfile.profile_data?.memories || []);
    
    // Merge strategy:
    // 1. Start with remote memories
    // 2. Remove any memories that are in the deleted list
    // 3. Add/update with local memories (local takes precedence)
    const mergedMemories = { ...remoteMemoriesObj };
    
    // Remove deleted memories from merged set
    deletedMemories.forEach(key => {
      delete mergedMemories[key];
    });
    
    // Add/update with local memories
    Object.assign(mergedMemories, localMemories);
    
    // Check if there are any differences between merged and remote
    const mergedArray = memoriesToArray(mergedMemories);
    const remoteArray = remoteProfile.profile_data?.memories || [];
    
    // Compare arrays - check if they have the same length and same content
    const hasChanges = JSON.stringify(mergedArray.sort((a, b) => a.key.localeCompare(b.key))) !== 
                       JSON.stringify(remoteArray.sort((a, b) => a.key.localeCompare(b.key)));
    
    // Update local storage with merged memories
    // First, clear all local memories
    await memoryService.clearAllMemories();
    
    // Then add merged memories
    for (const [key, value] of Object.entries(mergedMemories)) {
      await memoryService.setMemory(key, value);
    }
    
    // Only update remote profile if there are changes
    if (hasChanges) {
      const profileData = {
        memories: mergedArray
      };
      
      await updateRemoteProfile(profileData);
    }
    
    // Clear deleted memories list after successful sync
    await clearDeletedMemories();
    
    return {
      success: true,
      message: hasChanges ? 'Memories synced successfully' : 'Memories are already in sync',
      stats: {
        localCount: Object.keys(localMemories).length,
        remoteCount: Object.keys(remoteMemoriesObj).length,
        mergedCount: Object.keys(mergedMemories).length,
        deletedCount: deletedMemories.size,
        hasChanges: hasChanges
      }
    };
  } catch (error) {
    console.error('Error syncing memories:', error);
    return {
      success: false,
      message: error.message || 'Failed to sync memories',
      error: error
    };
  }
}

/**
 * Track a memory deletion for sync purposes
 * This should be called when a memory is deleted locally
 * @param {string} memoryKey - The memory key that was deleted
 */
export async function trackMemoryDeletion(memoryKey) {
  await addDeletedMemory(memoryKey);
}

/**
 * Check if profile sync is configured
 * @returns {boolean} True if tenant_id and keypass are configured
 */
export function isSyncConfigured() {
  const tenantId = getTenantId();
  const keypass = getKeypass();
  return !!(tenantId && keypass);
}

export default {
  syncMemories,
  trackMemoryDeletion,
  isSyncConfigured,
  getDeletedMemories
};

