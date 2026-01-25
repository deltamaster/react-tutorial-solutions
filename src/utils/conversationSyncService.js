/**
 * Conversation Sync Service
 * Handles synchronization of conversations with OneDrive
 */

import { msalInstance, onedriveScopes, isMsalConfigured } from '../config/msalConfig';
import { generateFollowUpQuestions } from './apiUtils';
import { createExportData } from '../services/conversationService';
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
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length === 0) {
    console.log('getOneDriveAccessToken: No accounts found');
    return null;
  }
  const account = accounts[0];
  
  try {
    const response = await msalInstance.acquireTokenSilent({
      ...onedriveScopes,
      account: account,
    });
    return response.accessToken;
  } catch (error) {
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
 * Generate conversation title using question prediction feature
 */
export async function generateConversationTitle(conversation) {
  try {
    // Import necessary modules
    const { fetchFromApiCore } = await import('./apiUtils');
    const { getModel } = await import('./settingsService');
    const { getGenerationConfig } = await import('./apiUtils');
    
    const safetySettings = [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
    ];
    
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
      return "New Conversation";
    }
    
    // Create request for title generation
    const response = await fetchFromApiCore(
      getModel(),
      {
        systemInstruction: {
          role: "system", 
          parts: [{
            text: "You are a helpful assistant that generates conversation summaries. Return your response as a JSON object with 'summary' (one sentence)."
          }]
        },
        contents: [...finalContents, {
          role: "user",
          parts: [{
            text: "Based on this conversation, generate a summary (concise, descriptive) in less than 7 words"
          }]
        }],
        safety_settings: safetySettings,
        generationConfig: {
          ...getGenerationConfig("followUpQuestions"),
          responseJsonSchema: {
            type: "object",
            properties: {
              summary: { type: "string" }
            },
            required: ["summary"]
          }
        },
      }
    );
    
    // Handle response
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    const responseData = await response.json();
    const candidate = responseData.candidates?.[0];
    
    if (candidate?.content?.parts?.[0]?.text) {
      try {
        const jsonText = candidate.content.parts[0].text;
        const parsed = JSON.parse(jsonText);
        if (parsed.summary && typeof parsed.summary === 'string') {
          return parsed.summary.trim();
        }
      } catch (error) {
        console.error("Error parsing title generation response:", error);
        // Try to extract summary from text if JSON parsing fails
        const text = candidate.content.parts[0].text;
        const summaryMatch = text.match(/summary["\s:]+["']([^"']+)["']/i);
        if (summaryMatch) {
          return summaryMatch[1].trim();
        }
      }
    }
    
    // Fallback
    return "New Conversation";
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
  
  const accounts = msalInstance.getAllAccounts();
  console.log('[isConversationSyncConfigured] Accounts found:', accounts.length);
  if (accounts.length === 0) {
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
  
  // Process each message timestamp
  for (const timestamp of Array.from(allTimestamps).sort((a, b) => a - b)) {
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
      
      // If one is deleted and the other isn't, use the non-deleted one
      if (localMsg.deleted && !remoteMsg.deleted) {
        merged.push(remoteMsg);
      } else if (!localMsg.deleted && remoteMsg.deleted) {
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
        const mergedMsg = mergeMessageParts(localMsg, remoteMsg);
        merged.push(mergedMsg);
      }
    }
  }
  
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
  // Use the message with the latest lastUpdate as base
  const localLastUpdate = localMsg.lastUpdate || localMsg.timestamp || 0;
  const remoteLastUpdate = remoteMsg.lastUpdate || remoteMsg.timestamp || 0;
  const baseMsg = localLastUpdate >= remoteLastUpdate ? localMsg : remoteMsg;
  const otherMsg = baseMsg === localMsg ? remoteMsg : localMsg;
  
  // Create maps for parts by timestamp
  const baseParts = new Map();
  const otherParts = new Map();
  
  (baseMsg.parts || []).forEach(part => {
    const partTimestamp = part.timestamp || baseMsg.timestamp;
    if (partTimestamp) {
      baseParts.set(partTimestamp, part);
    }
  });
  
  (otherMsg.parts || []).forEach(part => {
    const partTimestamp = part.timestamp || otherMsg.timestamp;
    if (partTimestamp) {
      otherParts.set(partTimestamp, part);
    }
  });
  
  // Get all unique part timestamps
  const allPartTimestamps = new Set([
    ...baseParts.keys(),
    ...otherParts.keys()
  ]);
  
  const mergedParts = [];
  
  // Process each part timestamp
  for (const partTimestamp of Array.from(allPartTimestamps).sort((a, b) => a - b)) {
    const basePart = baseParts.get(partTimestamp);
    const otherPart = otherParts.get(partTimestamp);
    
    if (!basePart && otherPart) {
      mergedParts.push(otherPart);
    } else if (basePart && !otherPart) {
      mergedParts.push(basePart);
    } else if (basePart && otherPart) {
      // Both exist - use the one with later lastUpdate
      const basePartLastUpdate = basePart.lastUpdate || basePart.timestamp || 0;
      const otherPartLastUpdate = otherPart.lastUpdate || otherPart.timestamp || 0;
      
      if (basePartLastUpdate >= otherPartLastUpdate) {
        mergedParts.push(basePart);
      } else {
        mergedParts.push(otherPart);
      }
    }
  }
  
  // Return merged message with merged parts
  return {
    ...baseMsg,
    parts: mergedParts,
    // Update lastUpdate to the latest of both messages
    lastUpdate: Math.max(localLastUpdate, remoteLastUpdate)
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
  isConversationSyncConfigured,
  getOrCreateConversationsFolder,
  clearConversationCache,
  getOneDriveAccessToken,
  mergeConversations,
};
