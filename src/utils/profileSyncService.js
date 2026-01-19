/**
 * Profile Sync Service
 * Handles synchronization of memories with OneDrive
 */

import memoryService from './memoryService';
import { getSystemPrompts, getAllSystemPromptsWithDeleted, setSystemPrompts, getSubscriptionKey, getUserAvatar, getModel, setSyncingFromRemote, setSyncingSystemPrompts } from './settingsService';
import { msalInstance, onedriveScopes, isMsalConfigured } from '../config/msalConfig';

const FOLDER_NAME = '.chatsphere';
const PROFILE_FILENAME = 'profile.json';
const SYSTEM_PROMPTS_FILENAME = 'systemPrompts.json';
const CONFIG_FILENAME = 'config.json';
const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';

// Cache keys for localStorage
const CACHE_KEYS = {
  FOLDER_ID: 'onedrive_folder_id',
  PROFILE_FILE_ID: 'onedrive_profile_file_id',
  SYSTEM_PROMPTS_FILE_ID: 'onedrive_system_prompts_file_id',
  CONFIG_FILE_ID: 'onedrive_config_file_id'
};

/**
 * Get cached folder ID from localStorage
 * @returns {string|null} Cached folder ID or null
 */
function getCachedFolderId() {
  return localStorage.getItem(CACHE_KEYS.FOLDER_ID);
}

/**
 * Cache folder ID in localStorage
 * @param {string} folderId - The folder ID to cache
 */
function setCachedFolderId(folderId) {
  localStorage.setItem(CACHE_KEYS.FOLDER_ID, folderId);
}

/**
 * Get cached file ID from localStorage
 * @param {string} cacheKey - The cache key for the file
 * @returns {string|null} Cached file ID or null
 */
function getCachedFileId(cacheKey) {
  return localStorage.getItem(cacheKey);
}

/**
 * Cache file ID in localStorage
 * @param {string} cacheKey - The cache key for the file
 * @param {string|null} fileId - The file ID to cache (null to clear)
 */
function setCachedFileId(cacheKey, fileId) {
  if (fileId) {
    localStorage.setItem(cacheKey, fileId);
  } else {
    localStorage.removeItem(cacheKey);
  }
}

/**
 * Clear all OneDrive cache
 */
function clearOneDriveCache() {
  Object.values(CACHE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
}

/**
 * Get OneDrive access token from MSAL
 * Tries silent acquisition first, only prompts for consent if needed
 * @returns {Promise<string|null>} Access token or null if not available
 */
async function getOneDriveAccessToken() {
  if (!isMsalConfigured() || !msalInstance) {
    console.log('getOneDriveAccessToken: MSAL not configured');
    return null;
  }
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length === 0) {
    console.log('getOneDriveAccessToken: No accounts found');
    return null;
  }
  const account = accounts[0];
  console.log('getOneDriveAccessToken: Attempting silent token acquisition...');
  
  try {
    const response = await msalInstance.acquireTokenSilent({
      ...onedriveScopes,
      account: account,
    });
    console.log('getOneDriveAccessToken: Silent acquisition successful');
    return response.accessToken;
  } catch (error) {
    console.log('getOneDriveAccessToken: Silent acquisition failed:', error.errorCode, error.message);
    // Check if this is a consent-related error that requires user interaction
    if (error.errorCode === 'interaction_required' || 
        error.errorCode === 'consent_required' ||
        error.errorCode === 'login_required') {
      // Try interactive acquisition only if consent is needed
      try {
        console.log("OneDrive consent required, requesting interactively...");
        const response = await msalInstance.acquireTokenPopup({
          ...onedriveScopes,
          account: account,
        });
        return response.accessToken;
      } catch (popupError) {
        console.error("Error acquiring OneDrive token via popup:", popupError);
        return null;
      }
    }
    console.error("Error acquiring OneDrive token silently:", error);
    return null;
  }
}

/**
 * Request OneDrive consent from user
 * Only prompts if consent is actually needed (not already granted)
 * @returns {Promise<string>} Access token
 */
export async function requestOneDriveConsent() {
  if (!isMsalConfigured() || !msalInstance) {
    throw new Error('MSAL is not configured');
  }
  try {
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length === 0) {
      throw new Error('User must be logged in to request OneDrive access');
    }
    const account = accounts[0];
    
    // First try silent acquisition - if it works, no need to prompt
    try {
      const silentResponse = await msalInstance.acquireTokenSilent({
        ...onedriveScopes,
        account: account,
      });
      return silentResponse.accessToken;
    } catch (silentError) {
      // Only prompt if silent acquisition failed due to consent issues
      if (silentError.errorCode === 'interaction_required' || 
          silentError.errorCode === 'consent_required' ||
          silentError.errorCode === 'login_required') {
        const response = await msalInstance.acquireTokenPopup({
          ...onedriveScopes,
          account: account,
        });
        return response.accessToken;
      }
      // Re-throw if it's a different error
      throw silentError;
    }
  } catch (error) {
    console.error("Error requesting OneDrive consent:", error);
    throw error;
  }
}

/**
 * Get or create the .chatsphere folder in OneDrive
 * Uses cached folder ID if available (trusts cache, only refreshes on error)
 * @param {string} accessToken - OneDrive access token
 * @returns {Promise<string>} Folder ID
 */
async function getOrCreateChatSphereFolder(accessToken) {
  // Check cache first - trust it, don't validate proactively
  const cachedFolderId = getCachedFolderId();
  if (cachedFolderId) {
    return cachedFolderId; // Trust the cache, validate only on error
  }
  
  // Cache miss or invalid, fetch from OneDrive
  // List children in root and filter for the folder
  const listUrl = `${GRAPH_API_BASE}/me/drive/root/children`;
  
  const response = await fetch(listUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to list folder contents: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  
  // Find the folder by name
  if (data.value && data.value.length > 0) {
    const folder = data.value.find(item => item.name === FOLDER_NAME && item.folder);
    if (folder) {
      // Cache the folder ID
      setCachedFolderId(folder.id);
      return folder.id;
    }
  }
  
  // Folder doesn't exist, create it
  const createUrl = `${GRAPH_API_BASE}/me/drive/root/children`;
  const createResponse = await fetch(createUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: FOLDER_NAME,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'fail'
    })
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    throw new Error(`Failed to create folder: ${createResponse.status} ${createResponse.statusText} - ${errorText}`);
  }

  const folderData = await createResponse.json();
  // Cache the newly created folder ID
  setCachedFolderId(folderData.id);
  return folderData.id;
}

/**
 * Get the profile file path in OneDrive
 * Uses cached file ID if available (trusts cache, only refreshes on error)
 * @param {string} accessToken - OneDrive access token
 * @param {string} folderId - The .chatsphere folder ID
 * @returns {Promise<string|null>} File ID or null if file doesn't exist
 */
async function getProfileFilePath(accessToken, folderId) {
  // Check cache first - trust it, don't validate proactively
  const cachedFileId = getCachedFileId(CACHE_KEYS.PROFILE_FILE_ID);
  if (cachedFileId) {
    return cachedFileId; // Trust the cache, validate only on error
  }
  
  // Cache miss or invalid, fetch from OneDrive
  // Try to find the file in the .chatsphere folder
  const searchUrl = `${GRAPH_API_BASE}/me/drive/items/${folderId}/children?$filter=name eq '${PROFILE_FILENAME}'`;
  
  const response = await fetch(searchUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to search for profile file: ${response.statusText}`);
  }

  const data = await response.json();
  if (data.value && data.value.length > 0) {
    const fileId = data.value[0].id;
    // Cache the file ID
    setCachedFileId(CACHE_KEYS.PROFILE_FILE_ID, fileId);
    return fileId;
  }
  
  // File doesn't exist, clear cache
  setCachedFileId(CACHE_KEYS.PROFILE_FILE_ID, null);
  return null;
}

/**
 * Fetch remote profile from OneDrive
 * @returns {Promise<Object|null>} The remote profile data or null if file doesn't exist
 */
async function fetchRemoteProfile() {
  const accessToken = await getOneDriveAccessToken();
  if (!accessToken) {
    throw new Error('OneDrive access token not available. Please grant OneDrive permissions.');
  }

  // Get or create the .chatsphere folder
  const folderId = await getOrCreateChatSphereFolder(accessToken);
  
  const fileId = await getProfileFilePath(accessToken, folderId);
  if (!fileId) {
    return null; // Profile doesn't exist yet
  }

  // Download the file content
  const downloadUrl = `${GRAPH_API_BASE}/me/drive/items/${fileId}/content`;
  const response = await fetch(downloadUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    if (response.status === 404) {
      // File doesn't exist, clear cache and return null
      setCachedFileId(CACHE_KEYS.PROFILE_FILE_ID, null);
      return null;
    }
    // If it's a 403 or other error, might be invalid ID, clear cache
    if (response.status === 403 || response.status === 400) {
      setCachedFileId(CACHE_KEYS.PROFILE_FILE_ID, null);
    }
    throw new Error(`Failed to fetch profile: ${response.statusText}`);
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error('Failed to parse profile file');
  }
}

/**
 * Upload profile to OneDrive
 * @param {Object} profileData - The profile data to upload
 */
async function uploadProfileToOneDrive(profileData) {
  const accessToken = await getOneDriveAccessToken();
  if (!accessToken) {
    throw new Error('OneDrive access token not available. Please grant OneDrive permissions.');
  }

  // Get or create the .chatsphere folder
  const folderId = await getOrCreateChatSphereFolder(accessToken);
  
  const fileContent = JSON.stringify(profileData, null, 2);
  const fileId = await getProfileFilePath(accessToken, folderId);

  if (fileId) {
    // Update existing file (don't use If-Match to avoid 412 errors)
    const uploadUrl = `${GRAPH_API_BASE}/me/drive/items/${fileId}/content`;
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: fileContent
    });

    if (!response.ok) {
      // If update fails with 404, file was deleted, clear cache
      if (response.status === 404) {
        setCachedFileId(CACHE_KEYS.PROFILE_FILE_ID, null);
      }
      // If 409 conflict, file was modified - just retry once without If-Match
      if (response.status === 409) {
        const retryResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: fileContent
        });
        
        if (!retryResponse.ok) {
          throw new Error(`Failed to update profile after retry: ${retryResponse.statusText}`);
        }
        // Success on retry
        return;
      } else {
        throw new Error(`Failed to update profile: ${response.statusText}`);
      }
    }
    // File ID remains the same, cache is already set
  } else {
    // Create new file in the .chatsphere folder
    const createUrl = `${GRAPH_API_BASE}/me/drive/items/${folderId}:/${PROFILE_FILENAME}:/content`;
    const response = await fetch(createUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: fileContent
    });

    if (!response.ok) {
      throw new Error(`Failed to create profile: ${response.statusText}`);
    }
    
    // Get the file ID from the response and cache it
    const fileData = await response.json();
    if (fileData.id) {
      setCachedFileId(CACHE_KEYS.PROFILE_FILE_ID, fileData.id);
    }
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
 * Sync memories with OneDrive profile
 * Merges local and remote memories, respecting deleted memories
 * @returns {Promise<Object>} Result object with sync statistics
 */
export async function syncMemories() {
  try {
    // Get local memories with full metadata
    const localMemories = await memoryService.getAllMemoriesWithMetadata();
    
    // Fetch remote profile from OneDrive
    const remoteProfile = await fetchRemoteProfile();
    
    // If profile doesn't exist, create it with local memories
    if (!remoteProfile) {
      const profileData = {
        memories: memoriesToArray(localMemories)
      };
      await uploadProfileToOneDrive(profileData);
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
    const remoteMemoriesObj = memoriesToObject(remoteProfile.memories || []);
    
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
    const remoteArray = remoteProfile.memories || [];
    
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
      
      await uploadProfileToOneDrive(profileData);
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
 * Check if OneDrive sync is configured (user has granted OneDrive permissions)
 * @returns {Promise<boolean>} True if OneDrive access is available
 */
export async function isSyncConfigured() {
  if (!isMsalConfigured() || !msalInstance) {
    console.log('isSyncConfigured: MSAL not configured');
    return false;
  }
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length === 0) {
    console.log('isSyncConfigured: No accounts found');
    return false;
  }
  console.log('isSyncConfigured: Found', accounts.length, 'account(s), attempting to get token...');
  const token = await getOneDriveAccessToken();
  const configured = token !== null;
  console.log('isSyncConfigured: Token acquired:', configured);
  return configured;
}

/**
 * Get file path for systemPrompts.json in OneDrive
 * Uses cached file ID if available (trusts cache, only refreshes on error)
 * @param {string} accessToken - OneDrive access token
 * @param {string} folderId - The .chatsphere folder ID
 * @returns {Promise<string|null>} File ID if exists, null otherwise
 */
async function getSystemPromptsFilePath(accessToken, folderId) {
  // Check cache first - trust it, don't validate proactively
  const cachedFileId = getCachedFileId(CACHE_KEYS.SYSTEM_PROMPTS_FILE_ID);
  if (cachedFileId) {
    return cachedFileId; // Trust the cache, validate only on error
  }
  
  // Cache miss or invalid, fetch from OneDrive
  const childrenUrl = `${GRAPH_API_BASE}/me/drive/items/${folderId}/children`;
  const response = await fetch(childrenUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to list folder contents: ${response.statusText}`);
  }

  const data = await response.json();
  const file = data.value.find(item => item.name === SYSTEM_PROMPTS_FILENAME);
  
  if (file) {
    // Cache the file ID
    setCachedFileId(CACHE_KEYS.SYSTEM_PROMPTS_FILE_ID, file.id);
    return file.id;
  }
  
  // File doesn't exist, clear cache
  setCachedFileId(CACHE_KEYS.SYSTEM_PROMPTS_FILE_ID, null);
  return null;
}

/**
 * Fetch remote system prompts from OneDrive
 * @returns {Promise<Object|null>} The remote system prompts data or null if file doesn't exist
 */
async function fetchRemoteSystemPrompts() {
  const accessToken = await getOneDriveAccessToken();
  if (!accessToken) {
    throw new Error('OneDrive access token not available. Please grant OneDrive permissions.');
  }

  // Get or create the .chatsphere folder
  const folderId = await getOrCreateChatSphereFolder(accessToken);
  
  const fileId = await getSystemPromptsFilePath(accessToken, folderId);
  if (!fileId) {
    return null; // File doesn't exist yet
  }

  // Download the file content (ETag not needed for read operations)
  const downloadUrl = `${GRAPH_API_BASE}/me/drive/items/${fileId}/content`;
  const response = await fetch(downloadUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    if (response.status === 404) {
      // File doesn't exist, clear cache and return null
      setCachedFileId(CACHE_KEYS.SYSTEM_PROMPTS_FILE_ID, null);
      return null;
    }
    // If it's a 403 or other error, might be invalid ID, clear cache
    if (response.status === 403 || response.status === 400) {
      setCachedFileId(CACHE_KEYS.SYSTEM_PROMPTS_FILE_ID, null);
    }
    throw new Error(`Failed to fetch system prompts: ${response.statusText}`);
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error('Failed to parse system prompts file');
  }
}

/**
 * Upload system prompts to OneDrive
 * @param {Object} systemPromptsData - The system prompts data to upload
 */
async function uploadSystemPromptsToOneDrive(systemPromptsData) {
  const accessToken = await getOneDriveAccessToken();
  if (!accessToken) {
    throw new Error('OneDrive access token not available. Please grant OneDrive permissions.');
  }

  // Get or create the .chatsphere folder
  const folderId = await getOrCreateChatSphereFolder(accessToken);
  
  const fileContent = JSON.stringify(systemPromptsData, null, 2);
  const fileId = await getSystemPromptsFilePath(accessToken, folderId);

  if (fileId) {
    // Update existing file (don't use If-Match to avoid 412 errors)
    const uploadUrl = `${GRAPH_API_BASE}/me/drive/items/${fileId}/content`;
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: fileContent
    });

    if (!response.ok) {
      // If update fails with 404, file was deleted, clear cache
      if (response.status === 404) {
        setCachedFileId(CACHE_KEYS.SYSTEM_PROMPTS_FILE_ID, null);
      }
      // If 409 conflict, file was modified - just retry once without If-Match
      if (response.status === 409) {
        const retryResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: fileContent
        });
        
        if (!retryResponse.ok) {
          throw new Error(`Failed to update system prompts after retry: ${retryResponse.statusText}`);
        }
        // Success on retry
        return;
      } else {
        throw new Error(`Failed to update system prompts: ${response.statusText}`);
      }
    }
    // File ID remains the same, cache is already set
  } else {
    // Create new file in the .chatsphere folder
    const createUrl = `${GRAPH_API_BASE}/me/drive/items/${folderId}:/${SYSTEM_PROMPTS_FILENAME}:/content`;
    const response = await fetch(createUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: fileContent
    });

    if (!response.ok) {
      throw new Error(`Failed to create system prompts file: ${response.statusText}`);
    }
    
    // Get the file ID from the response and cache it
    const fileData = await response.json();
    if (fileData.id) {
      setCachedFileId(CACHE_KEYS.SYSTEM_PROMPTS_FILE_ID, fileData.id);
    }
  }
}

/**
 * Merge two system prompt values based on lastUpdate timestamp
 * Respects deleted flag: if local is deleted with later timestamp, keep it deleted
 * @param {Object} localPrompt - Local system prompt object
 * @param {Object} remotePrompt - Remote system prompt object
 * @returns {Object} The prompt with the later timestamp
 */
function mergeSystemPromptValues(localPrompt, remotePrompt) {
  const localLastUpdate = localPrompt.lastUpdate || 0;
  const remoteLastUpdate = remotePrompt.lastUpdate || 0;
  
  // If local is deleted and has later timestamp, keep it deleted (don't restore from remote)
  if (localPrompt.deleted && localLastUpdate >= remoteLastUpdate) {
    return localPrompt;
  }
  
  // If remote is deleted and has later timestamp, use remote (deletion wins)
  if (remotePrompt.deleted && remoteLastUpdate > localLastUpdate) {
    return remotePrompt;
  }
  
  // Use the one with the later timestamp
  return localLastUpdate >= remoteLastUpdate ? localPrompt : remotePrompt;
}

/**
 * Sync system prompts with OneDrive
 * Merges local and remote system prompts based on lastUpdate timestamps
 * @returns {Promise<Object>} Result object with success status and stats
 */
export async function syncSystemPrompts() {
  try {
    // Set flag to prevent sync loops
    setSyncingSystemPrompts(true);
    
    // Get local system prompts including deleted ones (for sync)
    const localPrompts = getAllSystemPromptsWithDeleted();
    
    // Fetch remote system prompts from OneDrive
    const remotePrompts = await fetchRemoteSystemPrompts();
    
    // If remote doesn't exist, create it with local prompts (including deleted)
    if (!remotePrompts || Object.keys(remotePrompts).length === 0) {
      await uploadSystemPromptsToOneDrive(localPrompts);
      setSyncingSystemPrompts(false);
      const nonDeletedLocal = Object.keys(localPrompts).filter(key => !localPrompts[key].deleted).length;
      return {
        success: true,
        message: 'System prompts created and synced successfully',
        stats: {
          localCount: nonDeletedLocal,
          remoteCount: 0,
          mergedCount: nonDeletedLocal,
          deletedCount: Object.keys(localPrompts).length - nonDeletedLocal
        }
      };
    }

    // Ensure remote prompts have deleted field (default to false for backward compatibility)
    Object.keys(remotePrompts).forEach(key => {
      if (remotePrompts[key].deleted === undefined) {
        remotePrompts[key].deleted = false;
      }
    });
    
    // Merge strategy based on timestamps:
    // 1. Start with all remote prompts
    // 2. For each local prompt:
    //    - If not in remote, add it (including deleted ones)
    //    - If in remote, use the one with later lastUpdate timestamp
    //    - If local is deleted with later timestamp, keep it deleted (don't restore from remote)
    const mergedPrompts = { ...remotePrompts };
    
    // Merge local prompts (including deleted ones)
    for (const [key, localPrompt] of Object.entries(localPrompts)) {
      if (mergedPrompts[key]) {
        // Both exist, merge based on timestamp (respects deleted flag)
        mergedPrompts[key] = mergeSystemPromptValues(localPrompt, mergedPrompts[key]);
      } else {
        // Only in local, add it (including deleted ones for sync)
        mergedPrompts[key] = localPrompt;
      }
    }
    
    // Check if there are any differences between merged and remote
    const hasChanges = JSON.stringify(mergedPrompts) !== JSON.stringify(remotePrompts);
    
    // Update local storage with merged prompts (skip sync to prevent loop)
    // Include deleted prompts in storage for sync purposes
    setSystemPrompts(mergedPrompts, true);
    
    // Only update remote if there are changes
    if (hasChanges) {
      await uploadSystemPromptsToOneDrive(mergedPrompts);
    }
    
    setSyncingSystemPrompts(false);
    const nonDeletedMerged = Object.keys(mergedPrompts).filter(key => !mergedPrompts[key].deleted).length;
    const nonDeletedLocal = Object.keys(localPrompts).filter(key => !localPrompts[key].deleted).length;
    const nonDeletedRemote = Object.keys(remotePrompts).filter(key => !remotePrompts[key]?.deleted).length;
    const deletedCount = Object.keys(mergedPrompts).length - nonDeletedMerged;
    
    return {
      success: true,
      message: hasChanges ? 'System prompts synced successfully' : 'System prompts are already in sync',
      stats: {
        localCount: nonDeletedLocal,
        remoteCount: nonDeletedRemote,
        mergedCount: nonDeletedMerged,
        deletedCount: deletedCount,
        hasChanges: hasChanges
      }
    };
  } catch (error) {
    setSyncingSystemPrompts(false);
    console.error('Error syncing system prompts:', error);
    return {
      success: false,
      message: error.message || 'Failed to sync system prompts',
      error: error
    };
  }
}

/**
 * Get file path for config.json in OneDrive
 * Uses cached file ID if available (trusts cache, only refreshes on error)
 * @param {string} accessToken - OneDrive access token
 * @param {string} folderId - The .chatsphere folder ID
 * @returns {Promise<string|null>} File ID if exists, null otherwise
 */
async function getConfigFilePath(accessToken, folderId) {
  // Check cache first - trust it, don't validate proactively
  const cachedFileId = getCachedFileId(CACHE_KEYS.CONFIG_FILE_ID);
  if (cachedFileId) {
    return cachedFileId; // Trust the cache, validate only on error
  }
  
  // Cache miss or invalid, fetch from OneDrive
  const childrenUrl = `${GRAPH_API_BASE}/me/drive/items/${folderId}/children`;
  const response = await fetch(childrenUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to list folder contents: ${response.statusText}`);
  }

  const data = await response.json();
  const file = data.value.find(item => item.name === CONFIG_FILENAME);
  
  if (file) {
    // Cache the file ID
    setCachedFileId(CACHE_KEYS.CONFIG_FILE_ID, file.id);
    return file.id;
  }
  
  // File doesn't exist, clear cache
  setCachedFileId(CACHE_KEYS.CONFIG_FILE_ID, null);
  return null;
}

/**
 * Fetch remote config from OneDrive
 * @returns {Promise<Object|null>} The remote config data or null if file doesn't exist
 */
async function fetchRemoteConfig() {
  const accessToken = await getOneDriveAccessToken();
  if (!accessToken) {
    throw new Error('OneDrive access token not available. Please grant OneDrive permissions.');
  }

  // Get or create the .chatsphere folder
  const folderId = await getOrCreateChatSphereFolder(accessToken);
  
  const fileId = await getConfigFilePath(accessToken, folderId);
  if (!fileId) {
    return null; // File doesn't exist yet
  }

  // Download the file content (ETag not needed for read operations)
  const downloadUrl = `${GRAPH_API_BASE}/me/drive/items/${fileId}/content`;
  const response = await fetch(downloadUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    if (response.status === 404) {
      // File doesn't exist, clear cache and return null
      setCachedFileId(CACHE_KEYS.CONFIG_FILE_ID, null);
      return null;
    }
    // If it's a 403 or other error, might be invalid ID, clear cache
    if (response.status === 403 || response.status === 400) {
      setCachedFileId(CACHE_KEYS.CONFIG_FILE_ID, null);
    }
    throw new Error(`Failed to fetch config: ${response.statusText}`);
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error('Failed to parse config file');
  }
}

/**
 * Upload config to OneDrive
 * @param {Object} configData - The config data to upload
 */
async function uploadConfigToOneDrive(configData) {
  const accessToken = await getOneDriveAccessToken();
  if (!accessToken) {
    throw new Error('OneDrive access token not available. Please grant OneDrive permissions.');
  }

  // Get or create the .chatsphere folder
  const folderId = await getOrCreateChatSphereFolder(accessToken);
  
  const fileContent = JSON.stringify(configData, null, 2);
  const fileId = await getConfigFilePath(accessToken, folderId);

  if (fileId) {
    // Update existing file (don't use If-Match to avoid 412 errors)
    const uploadUrl = `${GRAPH_API_BASE}/me/drive/items/${fileId}/content`;
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: fileContent
    });

    if (!response.ok) {
      // If update fails with 404, file was deleted, clear cache
      if (response.status === 404) {
        setCachedFileId(CACHE_KEYS.CONFIG_FILE_ID, null);
      }
      // If 409 conflict, file was modified - just retry once without If-Match
      if (response.status === 409) {
        const retryResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: fileContent
        });
        
        if (!retryResponse.ok) {
          throw new Error(`Failed to update config after retry: ${retryResponse.statusText}`);
        }
        // Success on retry
        return;
      } else {
        throw new Error(`Failed to update config: ${response.statusText}`);
      }
    }
    // File ID remains the same, cache is already set
  } else {
    // Create new file in the .chatsphere folder
    const createUrl = `${GRAPH_API_BASE}/me/drive/items/${folderId}:/${CONFIG_FILENAME}:/content`;
    const response = await fetch(createUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: fileContent
    });

    if (!response.ok) {
      throw new Error(`Failed to create config file: ${response.statusText}`);
    }
    
    // Get the file ID from the response and cache it
    const fileData = await response.json();
    if (fileData.id) {
      setCachedFileId(CACHE_KEYS.CONFIG_FILE_ID, fileData.id);
    }
  }
}

/**
 * Sync config with OneDrive
 * Merges local and remote config, preferring local changes when they differ
 * @returns {Promise<Object>} Result object with success status
 */
export async function syncConfig() {
  try {
    // Set flag to prevent sync loops
    setSyncingFromRemote(true);
    
    // Get local config
    const localConfig = {
      subscriptionKey: getSubscriptionKey(),
      userAvatar: getUserAvatar(),
      model: getModel()
    };
    console.log('syncConfig: Local config:', localConfig);
    
    // Fetch remote config from OneDrive
    console.log('syncConfig: Fetching remote config...');
    const remoteConfig = await fetchRemoteConfig();
    console.log('syncConfig: Remote config:', remoteConfig);
    
    // If remote doesn't exist, create it with local config
    if (!remoteConfig) {
      console.log('syncConfig: Remote config does not exist, creating with local config...');
      await uploadConfigToOneDrive(localConfig);
      console.log('syncConfig: Config created and uploaded successfully');
      setSyncingFromRemote(false);
      return {
        success: true,
        message: 'Config created and synced successfully'
      };
    }

    // Check if local config differs from remote
    const hasLocalChanges = JSON.stringify(localConfig) !== JSON.stringify(remoteConfig);
    console.log('syncConfig: Has local changes:', hasLocalChanges);
    
    // If local has changes, upload local (local changes win)
    // Otherwise, update local with remote values (in case remote was updated elsewhere)
    if (hasLocalChanges) {
      // Local has changes, upload local to OneDrive
      console.log('syncConfig: Local has changes, uploading local config...');
      await uploadConfigToOneDrive(localConfig);
      console.log('syncConfig: Local config uploaded successfully');
      setSyncingFromRemote(false);
      return {
        success: true,
        message: 'Config synced successfully (local changes uploaded)'
      };
    } else {
      // No local changes, ensure local storage matches remote (in case of partial updates)
      // Set flag before updating to prevent triggers
      console.log('syncConfig: No local changes, updating local storage to match remote...');
      if (remoteConfig.subscriptionKey !== undefined) {
        localStorage.setItem('subscriptionKey', remoteConfig.subscriptionKey || '');
      }
      if (remoteConfig.userAvatar !== undefined) {
        localStorage.setItem('userAvatar', remoteConfig.userAvatar || '');
      }
      if (remoteConfig.model !== undefined) {
        localStorage.setItem('model', remoteConfig.model || 'gemini-3-flash-preview');
      }
      
      setSyncingFromRemote(false);
      return {
        success: true,
        message: 'Config is already in sync'
      };
    }
  } catch (error) {
    setSyncingFromRemote(false);
    console.error('Error syncing config:', error);
    return {
      success: false,
      message: error.message || 'Failed to sync config',
      error: error
    };
  }
}

export default {
  syncMemories,
  syncSystemPrompts,
  syncConfig,
  isSyncConfigured,
  requestOneDriveConsent,
  clearOneDriveCache,
};
