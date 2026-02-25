/**
 * Conversation Sync Service - Re-exports from refactored sync services
 * 
 * This file maintains backward compatibility by re-exporting functions
 * from the new sync service modules. All functionality has been moved to:
 * - src/services/sync/onedriveClient.js - OneDrive authentication and base client
 * - src/services/sync/folderService.js - Folder operations
 * - src/services/sync/fileService.js - File operations
 * - src/services/sync/metadataService.js - Metadata generation
 * - src/services/sync/syncOrchestrator.js - Sync coordination and merging
 * 
 * @deprecated Import directly from the service modules instead
 */

// Re-export from onedriveClient
export {
  getOneDriveAccessToken,
  isConversationSyncConfigured,
  clearConversationCache,
  getCachedId,
  setCachedId,
  CACHE_KEYS,
  GRAPH_API_BASE,
} from '../services/sync/onedriveClient';

// Re-export from folderService
export { getOrCreateConversationsFolder } from '../services/sync/folderService';

// Re-export from fileService
export {
  fetchConversationsIndex,
  uploadConversationsIndex,
  fetchConversation,
  uploadConversation,
  deleteConversation,
  createNewConversation,
} from '../services/sync/fileService';

// Re-export from metadataService
export {
  generateConversationMetadataFromConversation,
} from '../services/sync/metadataService';

// Re-export from syncOrchestrator
export { mergeConversations } from '../services/sync/syncOrchestrator';

// Import functions for default export
import {
  fetchConversationsIndex,
  uploadConversationsIndex,
  fetchConversation,
  uploadConversation,
  deleteConversation,
  createNewConversation,
} from '../services/sync/fileService';

import {
  generateConversationMetadataFromConversation,
} from '../services/sync/metadataService';

import {
  isConversationSyncConfigured,
  clearConversationCache,
  getOneDriveAccessToken,
} from '../services/sync/onedriveClient';

import { getOrCreateConversationsFolder } from '../services/sync/folderService';

import { mergeConversations } from '../services/sync/syncOrchestrator';

// Default export for backward compatibility
export default {
  fetchConversationsIndex,
  uploadConversationsIndex,
  fetchConversation,
  uploadConversation,
  deleteConversation,
  createNewConversation,
  generateConversationMetadataFromConversation,
  isConversationSyncConfigured,
  getOrCreateConversationsFolder,
  clearConversationCache,
  getOneDriveAccessToken,
  mergeConversations,
};
