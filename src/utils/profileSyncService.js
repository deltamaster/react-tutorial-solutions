/**
 * Profile Sync Service
 * Handles synchronization of memories with remote profile API
 */

import { getTenantId, getKeypass, getSubscriptionKey } from './settingsService';
import memoryService from './memoryService';

const API_BASE_URL = 'https://jp-gw2.azure-api.net/profile';

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
        lastUpdate: 0, // Use timestamp 0 for old entries (no real timestamp available)
        deleted: false
      },
      data: value // Entire old value becomes data
    };
  } catch (e) {
    // Not JSON, treat as old format plain string
    return {
      metadata: {
        lastUpdate: 0, // Use timestamp 0 for old entries (no real timestamp available)
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
 * Convert local memories object to array format for profile_data
 * @param {Object} localMemories - Object with memory keys and values (full format with metadata)
 * @param {boolean} includeDeleted - Whether to include deleted memories (default: true)
 * @returns {Array} Array of memory objects with key and value
 */
function memoriesToArray(localMemories, includeDeleted = true) {
  return Object.entries(localMemories)
    .filter(([key, value]) => {
      const parsed = parseMemoryValue(value);
      if (!parsed) return false;
      // Include all memories if includeDeleted is true, otherwise only non-deleted
      return includeDeleted || !parsed.metadata.deleted;
    })
    .map(([key, value]) => ({
      key,
      value // Store full JSON format (includes deleted flag in metadata)
    }));
}

/**
 * Convert memory array from profile_data to object format
 * @param {Array} memoryArray - Array of memory objects with key and value
 * @returns {Object} Object with memory keys and values (always in new format with metadata)
 */
function memoriesToObject(memoryArray) {
  const result = {};
  if (Array.isArray(memoryArray)) {
    memoryArray.forEach(memory => {
      if (memory && memory.key && memory.value !== undefined) {
        // Parse the value to ensure it's in new format
        const parsed = parseMemoryValue(memory.value);
        if (parsed) {
          // Convert to new format string
          result[memory.key] = formatMemoryValue(
            parsed.data,
            parsed.metadata.lastUpdate,
            parsed.metadata.deleted
          );
        } else {
          // Fallback: treat as old format and convert
          result[memory.key] = formatMemoryValue(memory.value, 0, false);
        }
      }
    });
  }
  return result;
}

/**
 * Merge two memory values based on lastUpdate timestamp
 * @param {string} localValue - Local memory value
 * @param {string} remoteValue - Remote memory value
 * @returns {string} The value with the later timestamp
 */
function mergeMemoryValues(localValue, remoteValue) {
  const localParsed = parseMemoryValue(localValue);
  const remoteParsed = parseMemoryValue(remoteValue);
  
  if (!localParsed) return remoteValue;
  if (!remoteParsed) return localValue;
  
  // Use the one with the later timestamp
  if (localParsed.metadata.lastUpdate >= remoteParsed.metadata.lastUpdate) {
    return localValue;
  } else {
    return remoteValue;
  }
}

/**
 * Sync memories with remote profile
 * Merges local and remote memories, respecting deleted memories
 * @returns {Promise<Object>} Result object with sync statistics
 */
export async function syncMemories() {
  try {
    // Get local memories with full metadata
    const localMemories = await memoryService.getAllMemoriesWithMetadata();
    
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
    
    // Merge strategy based on timestamps:
    // 1. Start with all remote memories
    // 2. For each local memory:
    //    - If not in remote, add it
    //    - If in remote, use the one with later lastUpdate timestamp
    // 3. Keep deleted memories if they have later timestamps
    const mergedMemories = { ...remoteMemoriesObj };
    
    // Merge local memories
    for (const [key, localValue] of Object.entries(localMemories)) {
      const localParsed = parseMemoryValue(localValue);
      if (!localParsed) continue;
      
      if (mergedMemories[key]) {
        // Both exist, merge based on timestamp
        mergedMemories[key] = mergeMemoryValues(localValue, mergedMemories[key]);
      } else {
        // Only in local, add it
        mergedMemories[key] = localValue;
      }
    }
    
    // Filter out deleted memories for display (but keep them in storage for sync)
    const nonDeletedMerged = {};
    for (const [key, value] of Object.entries(mergedMemories)) {
      const parsed = parseMemoryValue(value);
      if (parsed && !parsed.metadata.deleted) {
        nonDeletedMerged[key] = value;
      }
    }
    
    // Check if there are any differences between merged and remote
    // Include deleted memories in comparison and sync
    const mergedArray = memoriesToArray(mergedMemories, true); // Include deleted memories
    const remoteArray = remoteProfile.profile_data?.memories || [];
    
    // Compare arrays - check if they have the same length and same content
    const hasChanges = JSON.stringify(mergedArray.sort((a, b) => a.key.localeCompare(b.key))) !== 
                       JSON.stringify(remoteArray.sort((a, b) => a.key.localeCompare(b.key)));
    
    // Update local storage with merged memories (including deleted ones)
    // We need to preserve timestamps, so we'll set them directly
    const memoryPrefix = 'memory-';
    const isChromeExtension = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
    
    if (isChromeExtension) {
      // Get all current memory keys to remove ones not in merged set
      const allCurrentMemories = await new Promise((resolve, reject) => {
        chrome.storage.local.get(null, (items) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          const keys = Object.keys(items).filter(key => key.startsWith(memoryPrefix));
          resolve(keys);
        });
      });
      
      // Prepare updates and removals
      const updates = {};
      const keysToRemove = [];
      
      // Add/update merged memories (including deleted ones)
      for (const [key, value] of Object.entries(mergedMemories)) {
        const memoryKey = memoryPrefix + key;
        updates[memoryKey] = value;
      }
      
      // Find keys to remove (in current but not in merged)
      for (const memoryKey of allCurrentMemories) {
        const key = memoryKey.substring(memoryPrefix.length);
        if (!mergedMemories.hasOwnProperty(key)) {
          keysToRemove.push(memoryKey);
        }
      }
      
      // Apply updates
      if (Object.keys(updates).length > 0) {
        await new Promise((resolve, reject) => {
          chrome.storage.local.set(updates, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
              return;
            }
            resolve();
          });
        });
      }
      
      // Remove keys not in merged set
      if (keysToRemove.length > 0) {
        await new Promise((resolve, reject) => {
          chrome.storage.local.remove(keysToRemove, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
              return;
            }
            resolve();
          });
        });
      }
    } else {
      // localStorage fallback
      // Get all current memory keys
      const allCurrentKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(memoryPrefix)) {
          allCurrentKeys.push(key);
        }
      }
      
      // Update/add merged memories (including deleted ones)
      for (const [key, value] of Object.entries(mergedMemories)) {
        const memoryKey = memoryPrefix + key;
        localStorage.setItem(memoryKey, value);
      }
      
      // Remove keys not in merged set
      for (const memoryKey of allCurrentKeys) {
        const key = memoryKey.substring(memoryPrefix.length);
        if (!mergedMemories.hasOwnProperty(key)) {
          localStorage.removeItem(memoryKey);
        }
      }
    }
    
    // Only update remote profile if there are changes
    // Always send deleted memories so other devices know they're deleted
    if (hasChanges) {
      const profileData = {
        memories: mergedArray // Includes deleted memories with deleted: true flag
      };
      
      await updateRemoteProfile(profileData);
    }
    
    return {
      success: true,
      message: hasChanges ? 'Memories synced successfully' : 'Memories are already in sync',
      stats: {
        localCount: Object.keys(localMemories).length,
        remoteCount: Object.keys(remoteMemoriesObj).length,
        mergedCount: Object.keys(nonDeletedMerged).length,
        deletedCount: Object.keys(mergedMemories).length - Object.keys(nonDeletedMerged).length,
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
  isSyncConfigured
};

