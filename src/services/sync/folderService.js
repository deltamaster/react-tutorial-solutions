/**
 * Folder Service
 * Handles OneDrive folder operations (create, find, ensure)
 */

import { GRAPH_API_BASE, getCachedId, setCachedId, CACHE_KEYS } from './onedriveClient';

const FOLDER_NAME = '.chatsphere';
const CONVERSATIONS_FOLDER_NAME = 'conversations';

/**
 * Get or create the .chatsphere folder in OneDrive
 */
export async function getOrCreateChatSphereFolder(accessToken) {
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
export async function getOrCreateConversationsFolder(accessToken) {
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
