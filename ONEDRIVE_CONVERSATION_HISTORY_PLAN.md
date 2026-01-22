# OneDrive Conversation History Integration Plan

## Overview

This plan outlines the implementation of OneDrive-based conversation history storage to overcome the 20MB localStorage limit and enable users to manage multiple conversation histories with the ability to switch between them.

## Current State Analysis

### Existing Infrastructure
- ✅ MSAL (Microsoft Authentication Library) already configured
- ✅ OneDrive access token management via `profileSyncService.js`
- ✅ `.chatsphere` folder structure in OneDrive root
- ✅ Existing sync patterns for memories, system prompts, and config
- ✅ Export/import functionality for conversation history (`useConversationExport.js`)
- ✅ Conversation storage via `useConversation` hook using `useLocalStorage`

### Current Limitations
- ❌ Conversation history stored in localStorage/Chrome storage (20MB limit)
- ❌ Single conversation history only
- ❌ No ability to switch between multiple conversations
- ❌ Risk of data loss when storage quota is exceeded
- ❌ No automatic sync to cloud storage

## Goals

1. **Break Storage Limit**: Store conversation histories in OneDrive to bypass 20MB localStorage limit
2. **Multiple Conversations**: Support saving and managing multiple conversation histories
3. **Conversation Switching**: Allow users to seamlessly switch between different conversation histories
4. **Primary Storage**: localStorage is ALWAYS the source of truth for current conversation
5. **OneDrive Sync**: OneDrive syncs in parallel, retries on every conversation change if not ready initially
6. **Backward Compatibility**: App works normally with localStorage only if OneDrive unavailable
7. **Seamless Integration**: Leverage existing OneDrive infrastructure and authentication

## Architecture Design

### File Structure in OneDrive

```
.chatsphere/
├── profile.json                    (existing - memories)
├── systemPrompts.json              (existing - system prompts)
├── config.json                     (existing - user config)
└── conversations/                  (NEW - conversation histories)
    ├── index.json                  (conversation metadata/index)
    ├── conversation-{id-1}.json    (individual conversation files)
    ├── conversation-{id-2}.json
    └── ...
```

### Data Models

#### `conversations/index.json`
```json
{
  "version": "1.0",
  "currentConversationId": "conv-123",
  "conversations": [
    {
      "id": "conv-123",
      "name": "Project Discussion",
      "autoTitle": true,
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-20T14:45:00Z",
      "messageCount": 45,
      "fileId": "onedrive-file-id-123",
      "size": 524288,
      "tags": ["project", "development"]
    },
    {
      "id": "conv-456",
      "name": "General Chat",
      "autoTitle": false,
      "createdAt": "2024-01-10T08:00:00Z",
      "updatedAt": "2024-01-18T16:20:00Z",
      "messageCount": 120,
      "fileId": "onedrive-file-id-456",
      "size": 1048576,
      "tags": []
    }
  ]
}
```

**Field Descriptions**:
- `name`: Conversation title (user-editable or auto-generated)
- `autoTitle`: Boolean flag indicating if title should be auto-updated (false when user manually edits)

#### `conversations/conversation-{id}.json`
```json
{
  "version": "1.2",
  "id": "conv-123",
  "conversation": [...],  // existing conversation array format
  "conversation_summaries": [...],  // existing summaries format
  "uploaded_files": {...},  // existing trackedFiles format
  "metadata": {
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-20T14:45:00Z",
    "lastSyncedAt": "2024-01-20T14:45:00Z"
  }
}
```

## Implementation Plan

### Phase 1: Core OneDrive Conversation Service

#### 1.1 Create `conversationSyncService.js`
**Location**: `src/utils/conversationSyncService.js`

**Key Functions**:
- `getOrCreateConversationsFolder(accessToken)` - Get/create `.chatsphere/conversations/` folder
- `fetchConversationsIndex(accessToken)` - Fetch conversation index/metadata
- `uploadConversationsIndex(accessToken, indexData)` - Upload updated index
- `fetchConversation(accessToken, conversationId)` - Fetch specific conversation
- `uploadConversation(accessToken, conversationId, conversationData)` - Upload conversation (immediate, non-blocking)
- `deleteConversation(accessToken, conversationId)` - Delete conversation from OneDrive
- `createNewConversation(accessToken, name, initialData)` - Create new conversation
- `switchConversation(accessToken, conversationId)` - Switch active conversation
- `isConversationSyncConfigured()` - Check if OneDrive sync is available
- `generateConversationTitle(conversation)` - Generate auto-title using question prediction feature

**Caching Strategy**:
- Cache folder IDs and file IDs in localStorage (similar to `profileSyncService`)
- Cache keys: `onedrive_conversations_folder_id`, `onedrive_conversations_index_file_id`, `onedrive_conversation_{id}_file_id`
- Validate cache on errors (404/403) and refresh

### Phase 2: Conversation Management Hook

#### 2.1 Create `useConversationSync.js`
**Location**: `src/hooks/useConversationSync.js`

**Functionality**:
- **Receives conversation from localStorage** (does not manage its own state)
- **Syncs to OneDrive** whenever conversation changes (retries if not ready)
- Handle conversation switching (loads from OneDrive, saves to localStorage)
- Auto-save to OneDrive on every conversation change (user request, model response, edit, delete)
- Handle sync conflicts
- Provide conversation list for UI
- Manage conversation titles (auto-generation and manual editing)

**API**:
```javascript
const {
  conversations,              // List of all conversations from OneDrive
  currentConversationId,      // Currently active conversation ID
  currentConversationTitle,  // Current conversation title
  isSyncing,                 // Sync in progress flag
  syncError,                 // Last sync error
  switchConversation,        // Switch to different conversation
  createConversation,        // Create new conversation
  deleteConversation,        // Delete conversation
  renameConversation,        // Rename conversation (stops auto-title)
  updateConversationTitle,    // Update title (manual edit)
  syncCurrentConversation,   // Manual sync trigger (called on every conversation change)
  isOneDriveAvailable,       // Check if OneDrive sync is available
  generateAndUpdateTitle     // Generate title after model response
} = useConversationSync(conversation, setConversation);
```

**Key Behavior**:
- Watches `conversation` prop (from localStorage)
- Attempts to sync to OneDrive whenever `conversation` changes
- Retries sync on every change if OneDrive wasn't ready initially
- Does NOT replace localStorage - localStorage remains source of truth

### Phase 3: Enhanced Conversation Hook

#### 3.1 Update `useConversation.js`
**Location**: `src/hooks/useConversation.js`

**Changes**:
- ALWAYS use localStorage as primary storage
- Use `useConversationSync` hook for OneDrive sync (runs in parallel)
- OneDrive sync attempts on every conversation change
- Retry OneDrive sync even if it wasn't available initially

**Architecture**:
```javascript
export const useConversation = (storageKey = "conversation") => {
  // ALWAYS use localStorage as primary storage
  const [conversation, setConversation] = useLocalStorage(storageKey, []);
  
  // OneDrive sync hook (runs in parallel, syncs when available)
  const syncHelpers = useConversationSync(conversation, setConversation);
  
  // Wrapper that updates localStorage AND triggers OneDrive sync
  const setConversationWithSync = (newConversation) => {
    setConversation(newConversation); // Always update localStorage
    // Trigger OneDrive sync attempt (will retry if not ready)
    syncHelpers?.syncCurrentConversation?.();
  };
  
  return [conversation, setConversationWithSync, conversationRef, syncHelpers];
};
```

### Phase 4: UI Components

#### 4.1 Create `ConversationManager.js`
**Location**: `src/components/ConversationManager.js`

**Features**:
- Conversation list sidebar/dropdown
- Create new conversation button
- Rename conversation
- Delete conversation (with confirmation)
- Switch conversation
- Show sync status
- Show conversation metadata (message count, last updated, size)

**UI Elements**:
- Conversation switcher dropdown/select
- "New Conversation" button
- Conversation list with actions (rename, delete, switch)
- Sync indicator (syncing/synced/error)
- Conversation size indicator

#### 4.1.1 Create `ConversationTitle.js`
**Location**: `src/components/ConversationTitle.js`

**Features**:
- Display conversation title (editable)
- Auto-generate title using question prediction feature
- Stop auto-update when user manually edits
- Show title on left side of download/upload/reset buttons

**UI Elements**:
- Editable title input/display (inline editing)
- Auto-title indicator (subtle badge showing "Auto" when enabled)
- Title generation loading state
- Position: Left side of download/upload/reset button row

**UI Layout**:
```
[Conversation Title (editable)] [Download] [Upload] [Reset]
     ↑                              ↑
  Left side                    Right side (existing buttons)
```

**Title Component Behavior**:
- **Display Mode**: Shows title as text with edit icon on hover
- **Edit Mode**: Clicking title switches to inline input field
- **Auto Badge**: Small "Auto" badge appears when `autoTitle: true`
- **Loading State**: Shows spinner when generating title
- **Empty State**: Shows "New Conversation" placeholder when no title

#### 4.2 Update `AppContent.js`
**Location**: `src/components/AppContent.js`

**Changes**:
- Integrate `ConversationManager` component
- Integrate `ConversationTitle` component (left side of download/upload/reset buttons)
- Add conversation switcher to top bar or settings
- Handle conversation switching state
- Update conversation export/import to work with OneDrive conversations
- Trigger auto-save immediately after:
  - User sends a new request (in `handleSubmit`)
  - Model response is received (in response handler)
- Trigger auto-title generation after model response (if autoTitle is true)

#### 4.3 Update `Settings.js`
**Location**: `src/components/Settings.js`

**Changes**:
- Add "Conversation Management" section
- Show OneDrive sync status for conversations
- Option to enable/disable OneDrive sync for conversations
- Manual sync button
- Show storage usage (localStorage vs OneDrive)

### Phase 5: Sync Strategy

#### 5.1 Auto-Save Behavior
- **Primary Storage**: localStorage is ALWAYS updated immediately (source of truth)
- **OneDrive Sync**: Attempt to sync to OneDrive on every conversation change:
  - User sends a new request → sync to OneDrive
  - Model response is received → sync to OneDrive
  - User edits conversation → sync to OneDrive
  - User deletes part of conversation → sync to OneDrive
- **Retry Strategy**: If OneDrive is not ready initially, retry sync on every conversation change
- **On Conversation Switch**: Load from OneDrive (if available), save to localStorage
- **On App Load**: Try to load from OneDrive if available, otherwise use localStorage
- **Background Sync**: Use async/await for save operations to avoid blocking UI

**Note**: localStorage is always updated first. OneDrive sync happens asynchronously and won't block the UI. If OneDrive sync fails, localStorage still has the conversation. OneDrive sync retries on every conversation change, so if it becomes available later, sync happens automatically without user intervention.

#### 5.2 Conflict Resolution
- **Primary Source**: localStorage is always the source of truth
- **Last-Write-Wins**: When switching conversations, use `updatedAt` timestamp to determine latest version
- **Merge Strategy**: When loading from OneDrive, prefer OneDrive version if newer, but always save to localStorage
- **User Notification**: Show conflict warning if OneDrive version is newer when switching conversations

#### 5.3 Storage Architecture
- **Primary Storage**: localStorage is **ALWAYS** used to keep the local copy of the current conversation (source of truth)
- **Secondary Storage**: OneDrive is used as backup/sync mechanism (when available)
- **Retry Strategy**: OneDrive might not be ready initially, but retry syncing on every conversation change:
  - User sends a request → retry OneDrive sync
  - Model receives a response → retry OneDrive sync
  - User edits conversation → retry OneDrive sync
  - User deletes part of conversation → retry OneDrive sync
- **Offline Mode**: Work with localStorage when OneDrive unavailable (app functions normally)
- **Sync on Reconnect**: Auto-sync to OneDrive when it becomes available (retry on every change, no user action needed)
- **No Data Loss**: Even if OneDrive sync never succeeds, localStorage always has the conversation

### Phase 6: Migration Strategy

#### 6.1 Conversation Sync Strategy
- **No Migration Needed**: localStorage conversation is always maintained
- **On First OneDrive Enable**: 
  1. Check if localStorage has existing conversation
  2. If yes, create OneDrive conversation and upload localStorage content
  3. Set as current conversation in OneDrive
  4. Keep localStorage conversation (it remains the source of truth)
  5. Future changes sync to OneDrive automatically

- **Retry on Every Change**: Every conversation change triggers OneDrive sync attempt
  - If OneDrive becomes available later, sync happens automatically
  - No user action required

#### 6.2 Storage Strategy
- **Primary Storage**: localStorage is ALWAYS the primary storage for current conversation
- **OneDrive Sync**: OneDrive acts as backup/sync layer (synced when available)
- **Retry on Change**: Every conversation change (send, receive, edit, delete) triggers OneDrive sync attempt
- **No Migration Needed**: localStorage conversation is always maintained, OneDrive syncs when ready
- **Export Format**: Maintain existing export format for compatibility

## Technical Details

### Auto-Title Generation Implementation

#### Title Generation Function
**Location**: `src/utils/conversationSyncService.js`

```javascript
/**
 * Generate conversation title using question prediction feature
 * Returns a one-sentence summary based on conversation content
 * @param {Array} conversation - Current conversation array
 * @returns {Promise<string>} Generated title
 */
async function generateConversationTitle(conversation) {
  // Use existing generateFollowUpQuestions infrastructure
  // Modify prompt to request: "Generate a one-sentence summary of this conversation, 
  // followed by 3 follow-up questions. Return as JSON: { summary: '...', questions: [...] }"
  
  // Extract summary from response
  // Return summary as title
}
```

#### Integration Points
1. **After Model Response**: In `AppContent.js`, after receiving model response:
   ```javascript
   // After model response is added to conversation
   // 1. localStorage is already updated (happens synchronously)
   // 2. Trigger OneDrive sync attempt (async, non-blocking, retries if not ready)
   syncHelpers?.syncCurrentConversation?.();
   
   // 3. Generate title if autoTitle is enabled (only if OneDrive sync successful)
   if (syncHelpers?.isOneDriveAvailable && currentConversation?.autoTitle) {
     generateAndUpdateTitle(conversation); // Async, non-blocking
   }
   ```

2. **After User Request**: In `AppContent.js`, after user sends request:
   ```javascript
   // After user request is added to conversation
   // localStorage is already updated (happens synchronously)
   // Trigger OneDrive sync attempt (async, non-blocking, retries if not ready)
   syncHelpers?.syncCurrentConversation?.();
   ```

3. **On Conversation Change**: In `useConversationSync.js`, watch for conversation changes:
   ```javascript
   // Watch conversation prop (from localStorage)
   useEffect(() => {
     if (conversation && conversation.length > 0) {
       // Attempt to sync to OneDrive (retries if not ready)
       syncCurrentConversation();
     }
   }, [conversation]);
   ```

2. **Title Update**: Update index.json with new title:
   ```javascript
   // Update conversation name in index
   const index = await fetchConversationsIndex(accessToken);
   const conversation = index.conversations.find(c => c.id === currentConversationId);
   if (conversation && conversation.autoTitle) {
     conversation.name = generatedTitle;
     conversation.updatedAt = new Date().toISOString();
     await uploadConversationsIndex(accessToken, index);
   }
   ```

3. **Manual Edit**: When user edits title:
   ```javascript
   // User edits title manually
   const index = await fetchConversationsIndex(accessToken);
   const conversation = index.conversations.find(c => c.id === currentConversationId);
   if (conversation) {
     conversation.autoTitle = false; // Stop auto-updates
     conversation.name = userEditedTitle;
     conversation.updatedAt = new Date().toISOString();
     await uploadConversationsIndex(accessToken, index);
   }
   ```

4. **Title Generation Prompt**: Modify question prediction to generate summary:
   ```javascript
   // Use existing generateFollowUpQuestions but with modified prompt
   const prompt = `Based on this conversation, generate:
   1. A one-sentence summary (concise, descriptive)
   2. Three follow-up questions
   
   Return as JSON: { summary: "...", questions: ["...", "...", "..."] }`;
   
   // Extract summary from response and use as title
   ```

### Microsoft Graph API Endpoints

#### Get/Create Conversations Folder
```
GET /me/drive/root:/.chatsphere/conversations
PUT /me/drive/root:/.chatsphere/conversations:/content (if doesn't exist)
```

#### Get/Update Conversations Index
```
GET /me/drive/items/{folderId}/children?$filter=name eq 'index.json'
PUT /me/drive/items/{fileId}/content
```

#### Get/Update Conversation File
```
GET /me/drive/items/{folderId}/children?$filter=name eq 'conversation-{id}.json'
PUT /me/drive/items/{fileId}/content
DELETE /me/drive/items/{fileId}
```

### Error Handling

#### Common Scenarios
1. **OneDrive Not Available**: Continue with localStorage only, retry sync on next conversation change
2. **Network Error**: Continue with localStorage, retry sync on next conversation change
3. **Token Expired**: Refresh token automatically via MSAL, retry sync
4. **File Not Found**: Create new file, retry sync
5. **Conflict (409)**: Retry with latest version
6. **Permission Denied**: Request consent, show error message, retry sync after consent granted
7. **OneDrive Becomes Available Later**: Automatically sync on next conversation change (no user action needed)

### Performance Considerations

#### Optimization Strategies
1. **Lazy Loading**: Only load current conversation, fetch others on demand
2. **Pagination**: For large conversation lists, implement pagination
3. **Compression**: Consider compressing large conversations before upload
4. **Chunking**: For very large conversations (>10MB), consider splitting into chunks
5. **Caching**: Cache conversation metadata, only fetch content when needed

#### Size Limits
- **OneDrive File Limit**: 250GB per file (practically unlimited for conversations)
- **Index File**: Keep under 1MB (supports ~10,000 conversations)
- **Individual Conversations**: No hard limit, but consider UX for very large conversations

## User Experience Flow

### First-Time OneDrive Setup
1. User logs in with Microsoft account
2. System detects OneDrive sync available
3. OneDrive sync hook attempts to sync existing localStorage conversation
4. If localStorage has conversation: Create OneDrive conversation and upload
5. If no conversation: Wait for first conversation change to create OneDrive conversation
6. Show success message with conversation management UI
7. Future changes automatically sync to OneDrive

### Creating New Conversation
1. User clicks "New Conversation" button
2. Create new conversation in OneDrive with default name: "New Conversation"
3. Set `autoTitle: true` (enables auto-title generation)
4. Switch to new conversation
5. Clear current conversation UI
6. Title will be auto-generated after first model response

### Switching Conversations
1. User selects conversation from dropdown/list
2. Show loading indicator
3. Fetch conversation from OneDrive (or cache)
4. **Save to localStorage** (localStorage becomes source of truth)
5. Update UI with conversation history
6. Update current conversation indicator
7. Future changes sync back to OneDrive automatically

### Auto-Save Flow
1. User sends message
2. **Immediately**: Update localStorage (always, synchronous)
3. **In parallel**: Attempt to sync to OneDrive (async, non-blocking, retries if not ready)
4. Show subtle sync indicator (syncing → synced) if OneDrive available
5. Model response received
6. **Immediately**: Update localStorage (always, synchronous)
7. **In parallel**: Attempt to sync to OneDrive again (async, non-blocking, retries if not ready)
8. Update conversation metadata in OneDrive (updatedAt, messageCount) if sync successful
9. If autoTitle enabled: Generate conversation title using question prediction feature
10. Update conversation title in OneDrive index (if autoTitle is true and sync successful)

### Auto-Title Generation Flow
1. After model response is received
2. localStorage is already updated (happens synchronously)
3. OneDrive sync is attempted (async, retries if not ready)
4. If OneDrive sync successful, check if current conversation has `autoTitle: true`
5. Use question prediction feature with modified prompt:
   - Request: "Generate a one-sentence summary of this conversation, followed by 3 follow-up questions"
   - Response format: `{ summary: "...", questions: ["...", "...", "..."] }`
6. Extract summary sentence as conversation title
7. Update conversation name in OneDrive index.json
8. If user manually edits title: Set `autoTitle: false` and stop auto-updates

## Testing Strategy

### Unit Tests
- `conversationSyncService.test.js`: Test all service functions
- `useConversationSync.test.js`: Test hook behavior
- Mock MSAL and Graph API responses

### Integration Tests
- Test conversation switching
- Test sync on message add/edit/delete
- Test conflict resolution
- Test offline/online transitions

### Manual Testing Scenarios
1. Create multiple conversations
2. Switch between conversations
3. Edit conversation while offline
4. Sync after coming online
5. Delete conversation
6. Rename conversation
7. Migrate from localStorage to OneDrive
8. **Auto-save**: Verify localStorage updates immediately after user request
9. **Auto-save**: Verify OneDrive sync attempts after user request (even if not ready)
10. **Auto-save**: Verify localStorage updates immediately after model response
11. **Auto-save**: Verify OneDrive sync attempts after model response (even if not ready)
12. **Retry behavior**: Verify OneDrive sync retries on every conversation change if not ready initially
13. **Auto-title**: Verify title generates after first model response (only if OneDrive sync successful)
14. **Auto-title**: Verify title updates after subsequent responses (if autoTitle is true and OneDrive available)
15. **Manual title edit**: Verify auto-title stops after manual edit
16. **Title display**: Verify title appears on left side of download/upload/reset buttons
17. **Title editing**: Verify inline title editing works correctly
18. **OneDrive becomes available**: Verify sync happens automatically on next conversation change
19. **localStorage primary**: Verify app works normally even if OneDrive never becomes available

## Security Considerations

### Data Privacy
- Conversations stored in user's own OneDrive (private)
- No server-side storage or processing
- All data encrypted in transit (HTTPS)
- OneDrive encryption at rest

### Access Control
- Requires user authentication (MSAL)
- Requires explicit OneDrive consent
- User can revoke access anytime via Microsoft account settings

### Data Validation
- Validate conversation data structure before upload
- Sanitize conversation names (prevent path traversal)
- Limit conversation name length
- Validate file IDs before operations

## Rollout Plan

### Phase 1: Core Service (Week 1)
- Implement `conversationSyncService.js`
- Basic CRUD operations
- Index management

### Phase 2: Hook Integration (Week 2)
- Implement `useConversationSync.js` (receives conversation from localStorage, syncs to OneDrive)
- Update `useConversation.js` (always uses localStorage, triggers OneDrive sync)
- Basic conversation switching (loads from OneDrive, saves to localStorage)
- Implement auto-save triggers (sync to OneDrive on every conversation change, retry if not ready)
- Implement auto-title generation using question prediction feature

### Phase 3: UI Components (Week 3)
- Create `ConversationManager.js`
- Create `ConversationTitle.js` component
- Update `AppContent.js` and `Settings.js`
- Conversation list and switcher
- Title display and editing UI (left side of download/upload/reset buttons)

### Phase 4: Sync Logic (Week 4)
- Immediate auto-save implementation (on request/response)
- Auto-title generation integration
- Title editing and auto-title disable logic
- Conflict resolution
- Error handling

### Phase 5: Migration & Polish (Week 5)
- Migration from localStorage
- Testing and bug fixes
- Documentation
- User feedback and refinements

## Future Enhancements

### Potential Features
1. **Conversation Tags**: Organize conversations with tags
2. **Search**: Search across all conversations
3. **Export All**: Export all conversations as archive
4. **Conversation Templates**: Save conversation templates
5. **Sharing**: Share conversations with other users (if needed)
6. **Version History**: Track conversation history versions
7. **Conversation Archiving**: Archive old conversations
8. **Conversation Merging**: Merge two conversations
9. **Conversation Duplication**: Duplicate existing conversation
10. **Conversation Statistics**: Show conversation analytics

## Dependencies

### Existing Dependencies (Already Installed)
- `@azure/msal-browser` - Microsoft authentication
- React hooks - State management
- Bootstrap - UI components

### No New Dependencies Required
- Uses existing Microsoft Graph API via fetch
- Leverages existing MSAL configuration
- Uses existing storage utilities

## Success Metrics

### Key Performance Indicators
1. **Storage Limit Overcome**: Users can store conversations >20MB
2. **Multiple Conversations**: Average user creates 3+ conversations
3. **Sync Reliability**: 99%+ successful sync rate (when OneDrive available)
4. **User Adoption**: 80%+ of logged-in users enable OneDrive sync
5. **Performance**: Conversation switch <500ms
6. **Error Rate**: <1% sync errors (when OneDrive available)
7. **localStorage Performance**: localStorage updates are always immediate (<10ms)
8. **OneDrive Sync Performance**: OneDrive sync completes within 500ms (non-blocking, async)
9. **Retry Success Rate**: 95%+ of conversations sync successfully after OneDrive becomes available
10. **Title Generation**: Title generates within 2 seconds (async, non-blocking, only if OneDrive available)
11. **Title Accuracy**: 80%+ of auto-generated titles are meaningful/useful
12. **No Data Loss**: 100% of conversations preserved in localStorage even if OneDrive sync fails

## Risk Mitigation

### Identified Risks
1. **OneDrive API Rate Limits**: Implement retry logic with exponential backoff
2. **Large Conversation Files**: Implement compression and chunking
3. **Sync Conflicts**: Clear conflict resolution strategy
4. **Token Expiration**: Automatic token refresh via MSAL
5. **Network Failures**: Queue sync operations, retry on reconnect
6. **User Confusion**: Clear UI indicators and help text
7. **Frequent Auto-Saves**: Multiple saves per conversation turn may hit rate limits
   - **Mitigation**: Use async/await properly, implement request queuing if needed
   - **Mitigation**: OneDrive API is robust and handles concurrent requests well
   - **Mitigation**: localStorage is always updated first, so no data loss even if OneDrive sync fails
8. **OneDrive Not Ready Initially**: OneDrive might not be available when app starts
   - **Mitigation**: Retry sync on every conversation change
   - **Mitigation**: localStorage always has the conversation, app works normally
   - **Mitigation**: No user action needed - sync happens automatically when OneDrive becomes available
9. **Title Generation Latency**: Title generation adds delay after response
   - **Mitigation**: Run title generation asynchronously, don't block UI
   - **Mitigation**: Show loading indicator for title generation
   - **Mitigation**: Only generate title if OneDrive sync is successful
10. **Title Generation Failures**: API call may fail for title generation
   - **Mitigation**: Gracefully handle failures, keep existing title or use default
   - **Mitigation**: Title generation is optional - conversation still works without it

### Mitigation Strategies
- Comprehensive error handling
- User-friendly error messages
- Fallback to localStorage when OneDrive unavailable
- Clear documentation and tooltips
- Gradual rollout with feature flags

## Conclusion

This plan provides a comprehensive approach to implementing OneDrive-based conversation history storage, enabling users to overcome storage limitations and manage multiple conversations seamlessly. The implementation leverages existing infrastructure and maintains backward compatibility while providing a superior user experience.
