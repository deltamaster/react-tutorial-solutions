/**
 * Conversation Sync Service
 * Handles synchronization of conversations with OneDrive
 */

import { msalInstance, onedriveScopes, isMsalConfigured, msalConfig } from '../config/msalConfig';
import { generateFollowUpQuestions, generateConversationMetadata } from './apiUtils';
import { createExportData, generatePartUUID } from '../services/conversationService';
import { getAllTrackedFiles } from './fileTrackingService';

const FOLDER_NAME = '.chatsphere';
const CONVERSATIONS_FOLDER_NAME = 'conversations';
const INDEX_FILENAME = 'index.json';
const CONVERSATION_FILENAME_PREFIX = 'conversation-';
const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';

// Cache keys for localStorage
const CACHE_KEYS = {
  CONVERSATIONS_FOLDER_ID: 'onedrive_conversations_folder_id',
  INDEX_FILE_ID: 'onedrive_conversations_index_file_id',
  LATEST_CONVERSATION_ID: 'onedrive_latest_conversation_id', // Per-device current conversation ID
};

/**
 * Get cached folder/file ID from localStorage
 */
function getCachedId(cacheKey) {
  return localStorage.getItem(cacheKey);
}

/**
 * Cache folder/file ID in localStorage
 */
function setCachedId(cacheKey, id) {
  if (id) {
    localStorage.setItem(cacheKey, id);
  } else {
    localStorage.removeItem(cacheKey);
  }
}

/**
 * Clear conversation cache
 */
function clearConversationCache() {
  Object.values(CACHE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
  // Clear all conversation file IDs
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('onedrive_conversation_') && key.endsWith('_file_id')) {
      localStorage.removeItem(key);
    }
  });
}

/**
 * Get OneDrive access token from MSAL
 */
async function getOneDriveAccessToken() {
  if (!isMsalConfigured() || !msalInstance) {
    console.log('getOneDriveAccessToken: MSAL not configured');
    return null;
  }
  // Check both getAllAccounts() and getActiveAccount()
  // For Chrome extensions with manually stored accounts, getActiveAccount() might work
  // even if getAllAccounts() doesn't return anything
  // Wrap in try-catch because MSAL might fail if our manually stored account format doesn't match exactly
  let accounts = [];
  let activeAccount = null;
  try {
    accounts = msalInstance.getAllAccounts();
    activeAccount = msalInstance.getActiveAccount();
  } catch (error) {
    console.warn('isConversationSyncConfigured: Error calling MSAL methods, will check cache:', error);
  }
  
  // If MSAL doesn't find accounts, check cache directly for manually stored accounts
  let account = activeAccount || (accounts.length > 0 ? accounts[0] : null);
  
  if (!account) {
    // Check cache directly for manually stored account
    const cacheLocation = msalConfig?.cache?.cacheLocation || 'sessionStorage';
    const storage = cacheLocation === 'localStorage' ? localStorage : sessionStorage;
    const clientId = msalConfig?.auth?.clientId;
    
    if (clientId) {
      // Check for account list in cache
      const accountListKey = `msal.account.${clientId}`;
      const accountListStr = storage.getItem(accountListKey);
      
      if (accountListStr) {
        try {
          const accountList = JSON.parse(accountListStr);
          if (accountList.length > 0) {
            // Get the first account from cache
            const accountKey = `msal.account.${clientId}.${accountList[0]}`;
            const accountStr = storage.getItem(accountKey);
            if (accountStr) {
              account = JSON.parse(accountStr);
              console.log('getOneDriveAccessToken: Found account in cache:', account);
            }
          }
        } catch (e) {
          console.warn('getOneDriveAccessToken: Failed to parse account from cache:', e);
        }
      }
    }
  }
  
  if (!account) {
    console.log('getOneDriveAccessToken: No account available');
    return null;
  }
  
  // For Chrome extensions, MSAL's acquireTokenSilent uses iframe which is blocked by CSP
  // So we'll use cached tokens directly first
  const cacheLocation = msalConfig?.cache?.cacheLocation || 'sessionStorage';
  const storage = cacheLocation === 'localStorage' ? localStorage : sessionStorage;
  const clientId = msalConfig?.auth?.clientId;
  
  // Try to get access token from cache first
  // The token might be stored with broader scopes (e.g., User.Read Files.ReadWrite)
  // but it will work for OneDrive operations if it includes Files.ReadWrite
  if (clientId && account.homeAccountId) {
    const realm = account.realm || account.tenantId || 'consumers';
    const requiredScopes = onedriveScopes.scopes;
    
    // Try exact scope match first
    let accessTokenKey = `msal.accesstoken.${clientId}.${account.homeAccountId}.${realm}.${requiredScopes.join(' ')}`;
    let cachedTokenStr = storage.getItem(accessTokenKey);
    
    // If not found, search for tokens with broader scopes that include our required scopes
    if (!cachedTokenStr) {
      // Get all MSAL cache keys
      const allKeys = Object.keys(storage);
      const tokenKeys = allKeys.filter(key => 
        key.startsWith(`msal.accesstoken.${clientId}.${account.homeAccountId}.${realm}.`)
      );
      
      // Check each token to see if its scopes include our required scopes
      for (const key of tokenKeys) {
        try {
          const tokenStr = storage.getItem(key);
          if (tokenStr) {
            const token = JSON.parse(tokenStr);
            const tokenScopes = token.target ? token.target.split(' ') : [];
            // Check if token scopes include all required scopes
            const hasRequiredScopes = requiredScopes.every(scope => tokenScopes.includes(scope));
            
            if (hasRequiredScopes) {
              cachedTokenStr = tokenStr;
              accessTokenKey = key;
              console.log('getOneDriveAccessToken: Found token with broader scopes:', tokenScopes);
              break;
            }
          }
        } catch (e) {
          // Skip invalid tokens
        }
      }
    }
    
    if (cachedTokenStr) {
      try {
        const cachedToken = JSON.parse(cachedTokenStr);
        const expiresOn = parseInt(cachedToken.expiresOn, 10);
        const now = Date.now();
        
        // Check if token is still valid (with 5 minute buffer)
        if (expiresOn > now + 300000) {
          console.log('getOneDriveAccessToken: Using cached access token');
          return cachedToken.secret;
        } else if (cachedToken.extendedExpiresOn) {
          // Check extended expiry
          const extendedExpiresOn = parseInt(cachedToken.extendedExpiresOn, 10);
          if (extendedExpiresOn > now + 300000) {
            console.log('getOneDriveAccessToken: Using cached access token (extended expiry)');
            return cachedToken.secret;
          }
        }
        
        console.log('getOneDriveAccessToken: Cached token expired');
      } catch (e) {
        console.warn('getOneDriveAccessToken: Failed to parse cached token:', e);
      }
    } else {
      console.log('getOneDriveAccessToken: No cached token found for scopes:', requiredScopes);
    }
  }
  
  // If cached token not available or expired, try MSAL's acquireTokenSilent
  // This will fail for Chrome extensions due to CSP, but we'll catch the error
  try {
    const response = await msalInstance.acquireTokenSilent({
      ...onedriveScopes,
      account: account,
    });
    return response.accessToken;
  } catch (error) {
    // For Chrome extensions, iframe-based silent token acquisition is blocked by CSP
    if (error.message && (error.message.includes('frame-src') || error.message.includes('CSP'))) {
      console.log('getOneDriveAccessToken: Silent token acquisition blocked by CSP (expected for Chrome extensions)');
      // Token refresh would require manual implementation using refresh token
      // For now, user needs to log in again when token expires
      return null;
    }
    
    if (error.errorCode === 'interaction_required' || 
        error.errorCode === 'consent_required' ||
        error.errorCode === 'login_required') {
      try {
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
 * Get or create the .chatsphere folder in OneDrive
 */
async function getOrCreateChatSphereFolder(accessToken) {
  const cachedFolderId = getCachedId('onedrive_folder_id');
  if (cachedFolderId) {
    return cachedFolderId;
  }
  
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
  
  if (data.value && data.value.length > 0) {
    const folder = data.value.find(item => item.name === FOLDER_NAME && item.folder);
    if (folder) {
      localStorage.setItem('onedrive_folder_id', folder.id);
      return folder.id;
    }
  }
  
  // Create folder
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
  localStorage.setItem('onedrive_folder_id', folderData.id);
  return folderData.id;
}

/**
 * Get or create the conversations folder in OneDrive
 */
async function getOrCreateConversationsFolder(accessToken) {
  const cachedFolderId = getCachedId(CACHE_KEYS.CONVERSATIONS_FOLDER_ID);
  if (cachedFolderId) {
    return cachedFolderId;
  }
  
  const chatSphereFolderId = await getOrCreateChatSphereFolder(accessToken);
  const listUrl = `${GRAPH_API_BASE}/me/drive/items/${chatSphereFolderId}/children`;
  
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
  
  if (data.value && data.value.length > 0) {
    const folder = data.value.find(item => item.name === CONVERSATIONS_FOLDER_NAME && item.folder);
    if (folder) {
      setCachedId(CACHE_KEYS.CONVERSATIONS_FOLDER_ID, folder.id);
      return folder.id;
    }
  }
  
  // Create conversations folder
  const createUrl = `${GRAPH_API_BASE}/me/drive/items/${chatSphereFolderId}/children`;
  const createResponse = await fetch(createUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: CONVERSATIONS_FOLDER_NAME,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'fail'
    })
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    throw new Error(`Failed to create conversations folder: ${createResponse.status} ${createResponse.statusText} - ${errorText}`);
  }

  const folderData = await createResponse.json();
  setCachedId(CACHE_KEYS.CONVERSATIONS_FOLDER_ID, folderData.id);
  return folderData.id;
}

/**
 * Fetch conversations index from OneDrive
 */
export async function fetchConversationsIndex(accessToken) {
  const folderId = await getOrCreateConversationsFolder(accessToken);
  const cachedFileId = getCachedId(CACHE_KEYS.INDEX_FILE_ID);
  
  if (cachedFileId) {
    // Try to fetch using cached ID
    try {
      const downloadUrl = `${GRAPH_API_BASE}/me/drive/items/${cachedFileId}/content`;
      const response = await fetch(downloadUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (response.ok) {
        const text = await response.text();
        return JSON.parse(text);
      }
    } catch (error) {
      console.log('Failed to fetch using cached ID, refreshing...', error);
      setCachedId(CACHE_KEYS.INDEX_FILE_ID, null);
    }
  }
  
  // Search for index.json file
  const searchUrl = `${GRAPH_API_BASE}/me/drive/items/${folderId}/children?$filter=name eq '${INDEX_FILENAME}'`;
  const response = await fetch(searchUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to search for index file: ${response.statusText}`);
  }

  const data = await response.json();
  if (data.value && data.value.length > 0) {
    const fileId = data.value[0].id;
    setCachedId(CACHE_KEYS.INDEX_FILE_ID, fileId);
    
    const downloadUrl = `${GRAPH_API_BASE}/me/drive/items/${fileId}/content`;
    const downloadResponse = await fetch(downloadUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!downloadResponse.ok) {
      throw new Error(`Failed to download index file: ${downloadResponse.statusText}`);
    }
    
    const text = await downloadResponse.text();
    return JSON.parse(text);
  }
  
  // Index doesn't exist, return default structure (no currentConversationId - stored per-device in localStorage)
  return {
    version: "1.0",
    conversations: []
  };
}

/**
 * Upload conversations index to OneDrive
 */
export async function uploadConversationsIndex(accessToken, indexData) {
  const folderId = await getOrCreateConversationsFolder(accessToken);
  const fileContent = JSON.stringify(indexData, null, 2);
  const cachedFileId = getCachedId(CACHE_KEYS.INDEX_FILE_ID);
  
  if (cachedFileId) {
    // Update existing file
    const uploadUrl = `${GRAPH_API_BASE}/me/drive/items/${cachedFileId}/content`;
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: fileContent
    });

    if (!response.ok) {
      if (response.status === 404) {
        setCachedId(CACHE_KEYS.INDEX_FILE_ID, null);
        // Retry by creating new file
        return uploadConversationsIndex(accessToken, indexData);
      }
      if (response.status === 409) {
        // Conflict, retry once
        const retryResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: fileContent
        });
        
        if (!retryResponse.ok) {
          throw new Error(`Failed to update index after retry: ${retryResponse.statusText}`);
        }
        return;
      }
      throw new Error(`Failed to update index: ${response.statusText}`);
    }
  } else {
    // Create new file
    const createUrl = `${GRAPH_API_BASE}/me/drive/items/${folderId}:/${INDEX_FILENAME}:/content`;
    const response = await fetch(createUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: fileContent
    });

    if (!response.ok) {
      throw new Error(`Failed to create index: ${response.statusText}`);
    }
    
    const fileData = await response.json();
    if (fileData.id) {
      setCachedId(CACHE_KEYS.INDEX_FILE_ID, fileData.id);
    }
  }
}

/**
 * Fetch a specific conversation from OneDrive
 */
export async function fetchConversation(accessToken, conversationId) {
  const folderId = await getOrCreateConversationsFolder(accessToken);
  const fileName = `${CONVERSATION_FILENAME_PREFIX}${conversationId}.json`;
  const cacheKey = `onedrive_conversation_${conversationId}_file_id`;
  const cachedFileId = getCachedId(cacheKey);
  
  if (cachedFileId) {
    try {
      const downloadUrl = `${GRAPH_API_BASE}/me/drive/items/${cachedFileId}/content`;
      const response = await fetch(downloadUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (response.ok) {
        const text = await response.text();
        return JSON.parse(text);
      }
    } catch (error) {
      console.log('Failed to fetch using cached ID, refreshing...', error);
      setCachedId(cacheKey, null);
    }
  }
  
  // Search for conversation file
  const searchUrl = `${GRAPH_API_BASE}/me/drive/items/${folderId}/children?$filter=name eq '${fileName}'`;
  const response = await fetch(searchUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to search for conversation file: ${response.statusText}`);
  }

  const data = await response.json();
  if (data.value && data.value.length > 0) {
    const fileId = data.value[0].id;
    setCachedId(cacheKey, fileId);
    
    const downloadUrl = `${GRAPH_API_BASE}/me/drive/items/${fileId}/content`;
    const downloadResponse = await fetch(downloadUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });
    
    if (!downloadResponse.ok) {
      throw new Error(`Failed to download conversation file: ${downloadResponse.statusText}`);
    }
    
    const text = await downloadResponse.text();
    return JSON.parse(text);
  }
  
  return null;
}

/**
 * Upload a conversation to OneDrive
 */
export async function uploadConversation(accessToken, conversationId, conversationData) {
  const folderId = await getOrCreateConversationsFolder(accessToken);
  const fileName = `${CONVERSATION_FILENAME_PREFIX}${conversationId}.json`;
  const cacheKey = `onedrive_conversation_${conversationId}_file_id`;
  const cachedFileId = getCachedId(cacheKey);
  
  // Get summaries and tracked files
  const summaries = JSON.parse(localStorage.getItem("conversation_summaries") || "[]");
  const trackedFiles = getAllTrackedFiles();
  
  // Create export data structure
  const exportData = createExportData(conversationData.conversation || [], summaries, trackedFiles);
  
  // Determine updatedAt: use provided value, or preserve existing if file exists, or use current time for new files
  let updatedAt = conversationData.updatedAt;
  if (!updatedAt && cachedFileId) {
    // Try to fetch existing file to preserve its updatedAt
    try {
      const downloadUrl = `${GRAPH_API_BASE}/me/drive/items/${cachedFileId}/content`;
      const response = await fetch(downloadUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      if (response.ok) {
        const existingData = await response.json();
        if (existingData.metadata && existingData.metadata.updatedAt) {
          updatedAt = existingData.metadata.updatedAt;
        }
      }
    } catch (error) {
      // If we can't fetch existing file, use current time
      console.log('[uploadConversation] Could not fetch existing file to preserve updatedAt, using current time');
    }
  }
  
  // If still no updatedAt, use current time (for new files or if fetch failed)
  if (!updatedAt) {
    updatedAt = new Date().toISOString();
  }
  
  // Add metadata
  exportData.id = conversationId;
  exportData.metadata = {
    createdAt: conversationData.createdAt || new Date().toISOString(),
    updatedAt: updatedAt,
    lastSyncedAt: new Date().toISOString()
  };
  
  const fileContent = JSON.stringify(exportData, null, 2);
  
  if (cachedFileId) {
    // Update existing file
    const uploadUrl = `${GRAPH_API_BASE}/me/drive/items/${cachedFileId}/content`;
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: fileContent
    });

    if (!response.ok) {
      if (response.status === 404) {
        setCachedId(cacheKey, null);
        // Retry by creating new file
        return uploadConversation(accessToken, conversationId, conversationData);
      }
      if (response.status === 409) {
        // Conflict, retry once
        const retryResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: fileContent
        });
        
        if (!retryResponse.ok) {
          throw new Error(`Failed to update conversation after retry: ${retryResponse.statusText}`);
        }
        return;
      }
      throw new Error(`Failed to update conversation: ${response.statusText}`);
    }
  } else {
    // Create new file
    const createUrl = `${GRAPH_API_BASE}/me/drive/items/${folderId}:/${fileName}:/content`;
    const response = await fetch(createUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: fileContent
    });

    if (!response.ok) {
      throw new Error(`Failed to create conversation file: ${response.statusText}`);
    }
    
    const fileData = await response.json();
    if (fileData.id) {
      setCachedId(cacheKey, fileData.id);
    }
  }
}

/**
 * Delete a conversation from OneDrive
 */
export async function deleteConversation(accessToken, conversationId) {
  const folderId = await getOrCreateConversationsFolder(accessToken);
  const fileName = `${CONVERSATION_FILENAME_PREFIX}${conversationId}.json`;
  const cacheKey = `onedrive_conversation_${conversationId}_file_id`;
  
  // Try to find file ID
  let fileId = getCachedId(cacheKey);
  
  if (!fileId) {
    const searchUrl = `${GRAPH_API_BASE}/me/drive/items/${folderId}/children?$filter=name eq '${fileName}'`;
    const response = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (data.value && data.value.length > 0) {
        fileId = data.value[0].id;
      }
    }
  }
  
  if (fileId) {
    const deleteUrl = `${GRAPH_API_BASE}/me/drive/items/${fileId}`;
    const response = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to delete conversation: ${response.statusText}`);
    }
    
    setCachedId(cacheKey, null);
  }
}

/**
 * Create a new conversation
 */
export async function createNewConversation(accessToken, name = "New Conversation", initialData = { conversation: [] }) {
  const conversationId = `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();
  
  const conversationData = {
    conversation: initialData.conversation || [],
    createdAt: now,
    updatedAt: now
  };
  
  // Upload conversation file
  await uploadConversation(accessToken, conversationId, conversationData);
  
  // Update index
  const index = await fetchConversationsIndex(accessToken);
  const conversationEntry = {
    id: conversationId,
    name: name,
    autoTitle: true,
    createdAt: now,
    updatedAt: now,
    fileId: getCachedId(`onedrive_conversation_${conversationId}_file_id`),
    size: 0,
    tags: []
  };
  
  index.conversations.push(conversationEntry);
  // Don't update currentConversationId in index - it's stored per-device in localStorage
  // Just upload the updated index
  await uploadConversationsIndex(accessToken, index);
  
  return conversationId;
}

/**
 * Generate conversation metadata (title, summary, and next questions) using combined API call
 * @param {Array} conversation - The conversation array
 * @returns {Promise<Object>} - Object with { title, summary, nextQuestions }
 */
export async function generateConversationMetadataFromConversation(conversation) {
  try {
    // Prepare contents - filter out thoughts and hidden parts, keep only text
    const finalContents = conversation
      .filter(content => content.parts && content.parts.length > 0)
      .map(content => ({
        role: content.role,
        parts: content.parts
          .filter(part => !part.thought && part.hide !== true && part.text)
          .map(part => ({ text: part.text }))
      }))
      .filter(content => content.parts.length > 0);
    
    if (finalContents.length === 0) {
      return {
        title: "New Conversation",
        summary: "",
        nextQuestions: []
      };
    }
    
    // Use the combined metadata generation function from apiUtils
    const metadata = await generateConversationMetadata(finalContents);
    return metadata;
  } catch (error) {
    console.error("Error generating conversation metadata:", error);
    return {
      title: "New Conversation",
      summary: "",
      nextQuestions: []
    };
  }
}

/**
 * Generate conversation title using question prediction feature
 * @deprecated Use generateConversationMetadataFromConversation instead for better efficiency
 */
export async function generateConversationTitle(conversation) {
  try {
    const metadata = await generateConversationMetadataFromConversation(conversation);
    return metadata.title || "New Conversation";
  } catch (error) {
    console.error("Error generating conversation title:", error);
    return "New Conversation";
  }
}

/**
 * Check if OneDrive sync is configured
 */
export async function isConversationSyncConfigured() {
  console.log('[isConversationSyncConfigured] Checking configuration...');
  
  if (!isMsalConfigured() || !msalInstance) {
    console.log('[isConversationSyncConfigured] MSAL not configured or instance missing');
    return false;
  }
  
  // Check both getAllAccounts() and getActiveAccount()
  // For Chrome extensions with manually stored accounts, getActiveAccount() might work
  // even if getAllAccounts() doesn't return anything
  // Wrap in try-catch because MSAL might fail if our manually stored account format doesn't match exactly
  let accounts = [];
  let activeAccount = null;
  try {
    accounts = msalInstance.getAllAccounts();
    activeAccount = msalInstance.getActiveAccount();
  } catch (error) {
    console.warn('isConversationSyncConfigured: Error calling MSAL methods, will check cache:', error);
  }
  console.log('[isConversationSyncConfigured] Accounts found:', accounts.length, 'Active account:', !!activeAccount);
  
  // If MSAL doesn't find accounts, check cache directly for manually stored accounts
  // This handles the case where we manually stored an account for Chrome extensions
  let accountToUse = activeAccount || (accounts.length > 0 ? accounts[0] : null);
  
  if (!accountToUse) {
    // Check cache directly for manually stored account
    const cacheLocation = msalConfig?.cache?.cacheLocation || 'sessionStorage';
    const storage = cacheLocation === 'localStorage' ? localStorage : sessionStorage;
    const clientId = msalConfig?.auth?.clientId;
    
    if (clientId) {
      // Check for account list in cache
      const accountListKey = `msal.account.${clientId}`;
      const accountListStr = storage.getItem(accountListKey);
      
      if (accountListStr) {
        try {
          const accountList = JSON.parse(accountListStr);
          if (accountList.length > 0) {
            // Get the first account from cache
            const accountKey = `msal.account.${clientId}.${accountList[0]}`;
            const accountStr = storage.getItem(accountKey);
            if (accountStr) {
              accountToUse = JSON.parse(accountStr);
              console.log('[isConversationSyncConfigured] Found account in cache:', accountToUse);
            }
          }
        } catch (e) {
          console.warn('[isConversationSyncConfigured] Failed to parse account from cache:', e);
        }
      }
    }
  }
  
  if (!accountToUse) {
    console.log('[isConversationSyncConfigured] No accounts found - user not logged in');
    return false;
  }
  
  try {
    const token = await getOneDriveAccessToken();
    const isAvailable = token !== null;
    console.log('[isConversationSyncConfigured] Token acquired:', isAvailable);
    return isAvailable;
  } catch (error) {
    console.error('[isConversationSyncConfigured] Error checking token:', error);
    return false;
  }
}

/**
 * Merge local and remote conversation versions
 * Uses timestamps and lastUpdate to determine the latest version of each message and part
 * 
 * @param {Array} localConversation - Local conversation array
 * @param {Array} remoteConversation - Remote conversation array
 * @returns {Array} Merged conversation array
 */
export function mergeConversations(localConversation = [], remoteConversation = []) {
  // Import generatePartUUID for backward compatibility
  // Note: This is a synchronous function, so we'll handle UUID generation in mergeMessageParts instead
  // Create maps for quick lookup by message timestamp
  const localMessages = new Map();
  const remoteMessages = new Map();
  
  // Index local messages by timestamp
  (localConversation || []).forEach(msg => {
    if (msg.timestamp) {
      localMessages.set(msg.timestamp, msg);
    }
  });
  
  // Index remote messages by timestamp
  (remoteConversation || []).forEach(msg => {
    if (msg.timestamp) {
      remoteMessages.set(msg.timestamp, msg);
    }
  });
  
  // Get all unique timestamps
  const allTimestamps = new Set([
    ...localMessages.keys(),
    ...remoteMessages.keys()
  ]);
  
  const merged = [];
  
  // Debug: Log the timestamps array
  const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);
  console.log('[mergeConversations] Debug info:', {
    localMessagesCount: localMessages.size,
    remoteMessagesCount: remoteMessages.size,
    allTimestampsSize: allTimestamps.size,
    sortedTimestampsLength: sortedTimestamps.length,
    sortedTimestamps: sortedTimestamps.slice(0, 5) // First 5 for debugging
  });
  
  // Process each message timestamp
  let iterationCount = 0;
  for (const timestamp of sortedTimestamps) {
    iterationCount++;
    console.log(`[mergeConversations] Iteration ${iterationCount}/${sortedTimestamps.length}, timestamp: ${timestamp}`);
    
    const localMsg = localMessages.get(timestamp);
    const remoteMsg = remoteMessages.get(timestamp);
    
    // If only one exists, use it (unless deleted)
    if (!localMsg && remoteMsg) {
      // Use remote if not deleted, or if deleted but local doesn't have it
      merged.push(remoteMsg);
    } else if (localMsg && !remoteMsg) {
      // Use local if not deleted
      if (!localMsg.deleted) {
        merged.push(localMsg);
      }
    } else if (localMsg && remoteMsg) {
      // Both exist - merge them
      const localLastUpdate = localMsg.lastUpdate || localMsg.timestamp || 0;
      const remoteLastUpdate = remoteMsg.lastUpdate || remoteMsg.timestamp || 0;
      
      // If local is deleted, mark remote as deleted too (local deletion takes precedence)
      if (localMsg.deleted && !remoteMsg.deleted) {
        // Local deletion should propagate to remote - mark remote as deleted
        const deletedRemoteMsg = {
          ...remoteMsg,
          deleted: true,
          lastUpdate: localLastUpdate // Use local deletion timestamp
        };
        merged.push(deletedRemoteMsg);
      } else if (!localMsg.deleted && remoteMsg.deleted) {
        // Remote is deleted but local is not - use local (non-deleted takes precedence)
        merged.push(localMsg);
      } else if (localMsg.deleted && remoteMsg.deleted) {
        // Both deleted - use the one with later lastUpdate
        if (localLastUpdate >= remoteLastUpdate) {
          merged.push(localMsg);
        } else {
          merged.push(remoteMsg);
        }
      } else {
        // Neither deleted - merge parts
        try {
          const mergedMsg = mergeMessageParts(localMsg, remoteMsg);
          merged.push(mergedMsg);
        } catch (error) {
          console.error(`[mergeConversations] Error merging message parts at timestamp ${timestamp}:`, error);
          // Fallback: use the one with later lastUpdate
          const localLastUpdate = localMsg.lastUpdate || localMsg.timestamp || 0;
          const remoteLastUpdate = remoteMsg.lastUpdate || remoteMsg.timestamp || 0;
          if (localLastUpdate >= remoteLastUpdate) {
            merged.push(localMsg);
          } else {
            merged.push(remoteMsg);
          }
        }
      }
    }
  }
  
  console.log(`[mergeConversations] Loop completed. Total iterations: ${iterationCount}, merged count: ${merged.length}`);
  
  return merged;
}

/**
 * Merge parts of a message
 * Uses part timestamps and lastUpdate to determine the latest version
 * 
 * @param {Object} localMsg - Local message
 * @param {Object} remoteMsg - Remote message
 * @returns {Object} Merged message
 */
function mergeMessageParts(localMsg, remoteMsg) {
  // Calculate message-level lastUpdate values
  const localMsgLastUpdate = localMsg.lastUpdate || localMsg.timestamp || 0;
  const remoteMsgLastUpdate = remoteMsg.lastUpdate || remoteMsg.timestamp || 0;
  
  // Determine which message to use as base (the one with later lastUpdate)
  const baseMsg = localMsgLastUpdate >= remoteMsgLastUpdate ? localMsg : remoteMsg;
  
  // Helper function to create a content-based key for matching parts without UUIDs
  const getContentKey = (part) => {
    const timestamp = part.timestamp || 0;
    const partType = part.thought ? 'thought' : 
                     part.executableCode ? 'code' :
                     part.codeExecutionResult ? 'execution' :
                     part.inlineData ? 'image' :
                     part.functionResponse ? 'function' :
                     'text';
    // Create a hash based on content to match identical parts
    let contentHash = '';
    if (part.text) {
      contentHash = part.text.substring(0, 100).replace(/\s+/g, ' ').trim();
    } else if (part.executableCode) {
      contentHash = part.executableCode.code?.substring(0, 100) || '';
    } else if (part.functionResponse) {
      contentHash = JSON.stringify(part.functionResponse).substring(0, 100);
    }
    return `${timestamp}-${partType}-${contentHash}`;
  };
  
  // Step 1: Create maps for parts with UUIDs (primary matching)
  const localPartsByUUID = new Map();
  const remotePartsByUUID = new Map();
  const localPartsWithoutUUID = [];
  const remotePartsWithoutUUID = [];
  
  (localMsg.parts || []).forEach(part => {
    if (part.uuid) {
      localPartsByUUID.set(part.uuid, part);
    } else {
      localPartsWithoutUUID.push(part);
    }
  });
  
  (remoteMsg.parts || []).forEach(part => {
    if (part.uuid) {
      remotePartsByUUID.set(part.uuid, part);
    } else {
      remotePartsWithoutUUID.push(part);
    }
  });
  
  // Step 2: Match all parts by content first (to prevent duplicates), then by UUID
  // This handles cases where same content has different UUIDs
  const mergedParts = [];
  const matchedRemoteUUIDs = new Set();
  const matchedLocalUUIDs = new Set();
  const matchedRemoteIndices = new Set();
  const matchedLocalIndices = new Set();
  const contentKeysSeen = new Set(); // Track content keys to prevent duplicates
  
  // Helper to check if two parts have the same content
  const partsHaveSameContent = (part1, part2) => {
    return getContentKey(part1) === getContentKey(part2);
  };
  
  // Step 2a: Match parts with UUIDs by UUID first
  for (const [uuid, localPart] of localPartsByUUID.entries()) {
    const remotePart = remotePartsByUUID.get(uuid);
    
    if (remotePart) {
      // Both exist with same UUID - use the one with later lastUpdate
      matchedRemoteUUIDs.add(uuid);
      matchedLocalUUIDs.add(uuid);
      const localPartLastUpdate = localPart.lastUpdate || localPart.timestamp || 0;
      const remotePartLastUpdate = remotePart.lastUpdate || remotePart.timestamp || 0;
      
      const contentKey = getContentKey(localPart);
      if (!contentKeysSeen.has(contentKey)) {
        contentKeysSeen.add(contentKey);
        if (localPartLastUpdate >= remotePartLastUpdate) {
          if (!localPart.deleted) {
            mergedParts.push(localPart);
          }
        } else {
          if (!remotePart.deleted) {
            mergedParts.push(remotePart);
          }
        }
      }
    }
  }
  
  // Step 2b: Match parts with UUIDs that weren't matched by UUID, but might match by content
  // Check local parts with UUIDs against remote parts (both with and without UUIDs)
  for (const [uuid, localPart] of localPartsByUUID.entries()) {
    if (matchedLocalUUIDs.has(uuid)) continue; // Already matched
    
    const localContentKey = getContentKey(localPart);
    if (contentKeysSeen.has(localContentKey)) continue; // Content already added
    
    let matched = false;
    
    // Check against remote parts with UUIDs that weren't matched
    for (const [remoteUUID, remotePart] of remotePartsByUUID.entries()) {
      if (matchedRemoteUUIDs.has(remoteUUID)) continue; // Already matched
      if (partsHaveSameContent(localPart, remotePart)) {
        matchedRemoteUUIDs.add(remoteUUID);
        matchedLocalUUIDs.add(uuid);
        matched = true;
        contentKeysSeen.add(localContentKey);
        
        const localPartLastUpdate = localPart.lastUpdate || localPart.timestamp || 0;
        const remotePartLastUpdate = remotePart.lastUpdate || remotePart.timestamp || 0;
        
        // Use the one with later lastUpdate, but preserve both UUIDs by using the newer one's UUID
        if (localPartLastUpdate >= remotePartLastUpdate) {
          if (!localPart.deleted) {
            mergedParts.push(localPart);
          }
        } else {
          if (!remotePart.deleted) {
            // Use remote part but keep its UUID
            mergedParts.push(remotePart);
          }
        }
        break;
      }
    }
    
    // Check against remote parts without UUIDs
    if (!matched) {
      for (let j = 0; j < remotePartsWithoutUUID.length; j++) {
        if (matchedRemoteIndices.has(j)) continue;
        const remotePart = remotePartsWithoutUUID[j];
        if (partsHaveSameContent(localPart, remotePart)) {
          matchedRemoteIndices.add(j);
          matchedLocalUUIDs.add(uuid);
          matched = true;
          contentKeysSeen.add(localContentKey);
          
          const localPartLastUpdate = localPart.lastUpdate || localPart.timestamp || 0;
          const remotePartLastUpdate = remotePart.lastUpdate || remotePart.timestamp || 0;
          
          // Use local part (it has UUID), but update remote part's UUID to match
          if (localPartLastUpdate >= remotePartLastUpdate) {
            if (!localPart.deleted) {
              mergedParts.push(localPart);
            }
          } else {
            if (!remotePart.deleted) {
              // Use remote part but assign local UUID for consistency
              mergedParts.push({ ...remotePart, uuid: localPart.uuid });
            }
          }
          break;
        }
      }
    }
    
    // If still not matched, add local part
    if (!matched && !localPart.deleted) {
      contentKeysSeen.add(localContentKey);
      mergedParts.push(localPart);
    }
  }
  
  // Step 2c: Add remote parts with UUIDs that weren't matched
  for (const [uuid, remotePart] of remotePartsByUUID.entries()) {
    if (matchedRemoteUUIDs.has(uuid)) continue;
    
    const contentKey = getContentKey(remotePart);
    if (contentKeysSeen.has(contentKey)) continue; // Content already added
    
    contentKeysSeen.add(contentKey);
    if (!remotePart.deleted) {
      mergedParts.push(remotePart);
    }
  }
  
  // Step 2d: Match parts without UUIDs by content
  for (let i = 0; i < localPartsWithoutUUID.length; i++) {
    if (matchedLocalIndices.has(i)) continue;
    
    const localPart = localPartsWithoutUUID[i];
    const localContentKey = getContentKey(localPart);
    if (contentKeysSeen.has(localContentKey)) continue; // Content already added
    
    let matched = false;
    
    // Try to find a matching remote part without UUID
    for (let j = 0; j < remotePartsWithoutUUID.length; j++) {
      if (matchedRemoteIndices.has(j)) continue;
      
      const remotePart = remotePartsWithoutUUID[j];
      if (partsHaveSameContent(localPart, remotePart)) {
        matchedRemoteIndices.add(j);
        matchedLocalIndices.add(i);
        matched = true;
        contentKeysSeen.add(localContentKey);
        
        const localPartLastUpdate = localPart.lastUpdate || localPart.timestamp || 0;
        const remotePartLastUpdate = remotePart.lastUpdate || remotePart.timestamp || 0;
        
        // Generate UUID and assign to both for consistency
        const uuid = generatePartUUID();
        if (localPartLastUpdate >= remotePartLastUpdate) {
          if (!localPart.deleted) {
            mergedParts.push({ ...localPart, uuid });
          }
        } else {
          if (!remotePart.deleted) {
            mergedParts.push({ ...remotePart, uuid });
          }
        }
        break;
      }
    }
    
    // If no match found, add local part with generated UUID
    if (!matched && !localPart.deleted) {
      contentKeysSeen.add(localContentKey);
      mergedParts.push({ ...localPart, uuid: generatePartUUID() });
    }
  }
  
  // Step 2e: Add remote parts without UUIDs that weren't matched
  for (let j = 0; j < remotePartsWithoutUUID.length; j++) {
    if (matchedRemoteIndices.has(j)) continue;
    
    const remotePart = remotePartsWithoutUUID[j];
    const contentKey = getContentKey(remotePart);
    if (contentKeysSeen.has(contentKey)) continue; // Content already added
    
    contentKeysSeen.add(contentKey);
    if (!remotePart.deleted) {
      mergedParts.push({ ...remotePart, uuid: generatePartUUID() });
    }
  }
  
  // Sort merged parts by timestamp to maintain chronological order
  mergedParts.sort((a, b) => {
    const timestampA = a.timestamp || 0;
    const timestampB = b.timestamp || 0;
    return timestampA - timestampB;
  });
  
  // Return merged message with merged parts
  return {
    ...baseMsg,
    parts: mergedParts,
    // Update lastUpdate to the latest of both messages
    lastUpdate: Math.max(localMsgLastUpdate, remoteMsgLastUpdate)
  };
}

export default {
  fetchConversationsIndex,
  uploadConversationsIndex,
  fetchConversation,
  uploadConversation,
  deleteConversation,
  createNewConversation,
  generateConversationTitle,
  generateConversationMetadataFromConversation,
  isConversationSyncConfigured,
  getOrCreateConversationsFolder,
  clearConversationCache,
  getOneDriveAccessToken,
  mergeConversations,
};
