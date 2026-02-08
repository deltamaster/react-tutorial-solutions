/**
 * File Service
 * Handles OneDrive file operations (upload, download, delete, update)
 */

import { GRAPH_API_BASE, getCachedId, setCachedId, CACHE_KEYS } from './onedriveClient';
import { getOrCreateConversationsFolder } from './folderService';
import { createExportData, generatePartUUID } from '../conversationService';
import { getAllTrackedFiles } from '../../utils/fileTrackingService';

const INDEX_FILENAME = 'index.json';
const CONVERSATION_FILENAME_PREFIX = 'conversation-';

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
