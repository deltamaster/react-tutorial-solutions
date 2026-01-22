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

## Goals

1. **Break Storage Limit**: Store conversation histories in OneDrive to bypass 20MB localStorage limit
2. **Multiple Conversations**: Support saving and managing multiple conversation histories
3. **Conversation Switching**: Allow users to seamlessly switch between different conversation histories
4. **Backward Compatibility**: Maintain existing localStorage fallback for users without OneDrive access
5. **Seamless Integration**: Leverage existing OneDrive infrastructure and authentication

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
- Manage current conversation state (local vs OneDrive)
- Handle conversation switching
- Auto-save immediately on user request and model response
- Handle sync conflicts
- Provide conversation list for UI
- Manage conversation titles (auto-generation and manual editing)

**API**:
```javascript
const {
  conversations,              // List of all conversations
  currentConversationId,      // Currently active conversation ID
  currentConversationTitle,  // Current conversation title
  isSyncing,                 // Sync in progress flag
  syncError,                 // Last sync error
  switchConversation,        // Switch to different conversation
  createConversation,        // Create new conversation
  deleteConversation,        // Delete conversation
  renameConversation,        // Rename conversation (stops auto-title)
  updateConversationTitle,    // Update title (manual edit)
  syncCurrentConversation,   // Manual sync trigger
  isOneDriveAvailable        // Check if OneDrive sync is available
} = useConversationSync(conversation, setConversation);
```

### Phase 3: Enhanced Conversation Hook

#### 3.1 Update `useConversation.js`
**Location**: `src/hooks/useConversation.js`

**Changes**:
- Detect if OneDrive sync is enabled
- If OneDrive available: use `useConversationSync` instead of `useLocalStorage`
- If OneDrive not available: fallback to existing `useLocalStorage` behavior
- Maintain backward compatibility

**Hybrid Approach**:
```javascript
export const useConversation = (storageKey = "conversation") => {
  const [oneDriveAvailable, setOneDriveAvailable] = useState(false);
  
  useEffect(() => {
    // Check OneDrive availability
    checkOneDriveAvailability().then(setOneDriveAvailable);
  }, []);
  
  if (oneDriveAvailable) {
    // Use OneDrive sync
    return useConversationSync();
  } else {
    // Fallback to localStorage
    return useLocalStorage(storageKey, []);
  }
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
- **Immediate Save on User Request**: Save conversation to OneDrive immediately when user sends a new request
- **Immediate Save on Model Response**: Save conversation to OneDrive immediately when model response is received
- **On Conversation Switch**: Always save current conversation before switching
- **On Message Edit/Delete**: Save immediately after edit/delete operations
- **On App Load**: Fetch latest from OneDrive if available
- **Background Sync**: Use async/await for save operations to avoid blocking UI

**Note**: Unlike debounced sync, this ensures conversations are always saved immediately, preventing data loss. OneDrive API calls are asynchronous and won't block the UI.

#### 5.2 Conflict Resolution
- **Last-Write-Wins**: Use `updatedAt` timestamp to determine latest version
- **Merge Strategy**: For simultaneous edits, prefer OneDrive version (more authoritative)
- **User Notification**: Show conflict warning if local changes would be overwritten

#### 5.3 Offline Support
- **Local Cache**: Keep current conversation in localStorage as cache
- **Offline Mode**: Work with local cache when OneDrive unavailable
- **Sync on Reconnect**: Auto-sync when OneDrive becomes available

### Phase 6: Migration Strategy

#### 6.1 Existing Conversation Migration
- **On First OneDrive Enable**: 
  1. Export current localStorage conversation
  2. Create new OneDrive conversation named "Migrated Conversation"
  3. Upload to OneDrive
  4. Clear localStorage conversation (optional, keep as backup)
  5. Switch to OneDrive conversation

- **Migration Prompt**: Show dialog asking user if they want to migrate existing conversation

#### 6.2 Backward Compatibility
- **Dual Mode**: Support both localStorage and OneDrive conversations
- **Fallback**: If OneDrive unavailable, automatically use localStorage
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
   // 1. Save conversation immediately
   await syncCurrentConversation();
   
   // 2. Generate title if autoTitle is enabled
   if (oneDriveAvailable && currentConversation?.autoTitle) {
     generateAndUpdateTitle(conversation); // Async, non-blocking
   }
   ```

2. **After User Request**: In `AppContent.js`, after user sends request:
   ```javascript
   // After user request is added to conversation
   await syncCurrentConversation(); // Save immediately
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
1. **OneDrive Not Available**: Fallback to localStorage, show notification
2. **Network Error**: Queue sync, retry on next action
3. **Token Expired**: Refresh token automatically via MSAL
4. **File Not Found**: Create new file
5. **Conflict (409)**: Retry with latest version
6. **Permission Denied**: Request consent, show error message

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
3. Show prompt: "Enable OneDrive sync for conversations?"
4. If yes: Migrate existing conversation, create index
5. Show success message with conversation management UI

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
4. Update UI with conversation history
5. Update current conversation indicator

### Auto-Save Flow
1. User sends message
2. **Immediately**: Save conversation to OneDrive (async, non-blocking)
3. Show subtle sync indicator (syncing → synced)
4. Model response received
5. **Immediately**: Save conversation to OneDrive again (async, non-blocking)
6. Update conversation metadata (updatedAt, messageCount)
7. If autoTitle enabled: Generate conversation title using question prediction feature
8. Update conversation title in index (if autoTitle is true)

### Auto-Title Generation Flow
1. After model response is received and saved
2. Check if current conversation has `autoTitle: true`
3. Use question prediction feature with modified prompt:
   - Request: "Generate a one-sentence summary of this conversation, followed by 3 follow-up questions"
   - Response format: `{ summary: "...", questions: ["...", "...", "..."] }`
4. Extract summary sentence as conversation title
5. Update conversation name in index.json
6. If user manually edits title: Set `autoTitle: false` and stop auto-updates

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
8. **Auto-save**: Verify conversation saves immediately after user request
9. **Auto-save**: Verify conversation saves immediately after model response
10. **Auto-title**: Verify title generates after first model response
11. **Auto-title**: Verify title updates after subsequent responses (if autoTitle is true)
12. **Manual title edit**: Verify auto-title stops after manual edit
13. **Title display**: Verify title appears on left side of download/upload/reset buttons
14. **Title editing**: Verify inline title editing works correctly

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
- Implement `useConversationSync.js`
- Update `useConversation.js`
- Basic conversation switching
- Implement auto-save triggers (immediate save on request/response)
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
3. **Sync Reliability**: 99%+ successful sync rate
4. **User Adoption**: 80%+ of logged-in users enable OneDrive sync
5. **Performance**: Conversation switch <500ms
6. **Error Rate**: <1% sync errors
7. **Auto-Save Performance**: Save completes within 500ms (non-blocking)
8. **Title Generation**: Title generates within 2 seconds (async, non-blocking)
9. **Title Accuracy**: 80%+ of auto-generated titles are meaningful/useful

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
8. **Title Generation Latency**: Title generation adds delay after response
   - **Mitigation**: Run title generation asynchronously, don't block UI
   - **Mitigation**: Show loading indicator for title generation
9. **Title Generation Failures**: API call may fail for title generation
   - **Mitigation**: Gracefully handle failures, keep existing title or use default

### Mitigation Strategies
- Comprehensive error handling
- User-friendly error messages
- Fallback to localStorage when OneDrive unavailable
- Clear documentation and tooltips
- Gradual rollout with feature flags

## Conclusion

This plan provides a comprehensive approach to implementing OneDrive-based conversation history storage, enabling users to overcome storage limitations and manage multiple conversations seamlessly. The implementation leverages existing infrastructure and maintains backward compatibility while providing a superior user experience.
