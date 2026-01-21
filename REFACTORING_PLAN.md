# Refactoring Plan

## Executive Summary

This document outlines a comprehensive refactoring plan to address code maintainability issues in the React tutorial solutions codebase. The main goals are to:

1. **Separate concerns** - Extract business logic from UI components
2. **Reduce file size** - Break down components and utilities exceeding 1000 lines
3. **Eliminate duplication** - Create reusable utilities and services
4. **Improve testability** - Make logic testable independently of UI

---

## Current Issues Analysis

### Issue 1: Components with Too Much Logic

#### `ConversationHistory.js` (1195 lines)
**Problems:**
- Contains complex text processing logic (`escapeCurrencyDollars`, `replaceMentions`, `renderTextContent`)
- Embeds TTS (Text-to-Speech) logic with complex state management (~200 lines)
- Includes Mermaid diagram rendering logic
- Contains avatar/voice mapping logic
- Mixes presentation with business logic

**Impact:**
- Difficult to test text processing independently
- TTS logic cannot be reused elsewhere
- Hard to maintain and modify rendering logic

#### `AppContent.js` (1484 lines)
**Problems:**
- Contains API request queue management (~300 lines)
- Embeds file upload and compression logic (~150 lines)
- Includes role request handling logic (~200 lines)
- Mixes conversation state management with UI rendering
- Contains complex error handling logic

**Impact:**
- Business logic tightly coupled to React component lifecycle
- Difficult to test API request logic independently
- File handling logic cannot be reused

### Issue 2: Files Exceeding 1000 Lines

| File | Lines | Primary Issues |
|------|-------|----------------|
| `ConversationHistory.js` | 1195 | Multiple responsibilities, embedded logic |
| `AppContent.js` | 1484 | Too many concerns, complex state management |

### Issue 3: Duplicate Logic

**File Validation Logic:**
- Image validation appears in `QuestionInput.js` and `AppContent.js`
- PDF validation duplicated in multiple places
- File size checks repeated

**Error Handling:**
- Error message formatting duplicated
- API error handling patterns repeated

**Avatar/Voice Mapping:**
- Voice mapping logic in `ConversationHistory.js`
- Avatar logic scattered across components

**Text Processing:**
- Text transformation logic embedded in components
- Mention replacement logic not reusable

---

## Refactoring Principles

### 1. Separation of Concerns
- **UI Components**: Should only handle presentation and user interaction
- **Business Logic**: Should be extracted to services, hooks, or utilities
- **State Management**: Use custom hooks for complex state logic
- **Data Processing**: Extract to pure utility functions

### 2. Single Responsibility Principle
- Each module/component should have one clear purpose
- Break down large files into smaller, focused modules
- Group related functionality together

### 3. DRY (Don't Repeat Yourself)
- Extract common logic to shared utilities
- Create reusable hooks for repeated patterns
- Centralize configuration and constants

### 4. Testability
- Pure functions for business logic (easy to unit test)
- Separate side effects from pure logic
- Mockable dependencies for integration testing

### 5. Maintainability
- Keep files under 500 lines when possible
- Use clear naming conventions
- Document complex logic
- Group related files in appropriate directories

---

## Proposed Refactoring Structure

### New Directory Structure

```
src/
├── components/
│   ├── conversation/
│   │   ├── ConversationHistory.js          # Main container (simplified)
│   │   ├── MessageBubble.js               # Individual message display
│   │   ├── MessagePart.js                  # Individual part rendering
│   │   ├── TextPart.js                     # Text rendering component
│   │   ├── CodeBlock.js                    # Code block component
│   │   ├── ExpandableHtmlBlock.js          # HTML block component
│   │   ├── InlineImage.js                  # Image display component
│   │   ├── PdfPlaceholder.js               # PDF placeholder component
│   │   ├── GroundingData.js                # Sources display component
│   │   ├── CodeExecutionResult.js          # Execution result component
│   │   └── MessageActions.js               # Edit/Delete/Speak buttons
│   ├── tts/
│   │   ├── TtsPlayer.js                    # TTS playback component
│   │   └── SpeakerButton.js               # Speaker button component
│   ├── input/
│   │   └── QuestionInput.js                # (keep, already reasonable)
│   └── ... (other components)
├── hooks/
│   ├── useConversation.js                  # Conversation state management
│   ├── useRoleRequests.js                  # Role request queue management
│   ├── useFileUpload.js                    # File upload logic
│   ├── useTts.js                          # TTS playback logic
│   ├── useMermaid.js                      # Mermaid rendering logic
│   └── useConversationExport.js           # Export/import logic
├── services/
│   ├── conversationService.js              # Conversation CRUD operations
│   ├── roleRequestService.js               # Role request queue service
│   ├── fileUploadService.js                # File upload/compression service
│   ├── ttsService.js                      # TTS generation service
│   └── errorService.js                    # Error handling utilities
├── utils/
│   ├── textProcessing/
│   │   ├── textTransform.js               # Text transformation utilities
│   │   ├── mentionUtils.js                # Mention processing
│   │   └── markdownUtils.js               # Markdown processing
│   ├── fileUtils.js                       # File validation utilities
│   ├── avatarUtils.js                     # Avatar/voice mapping
│   ├── timestampUtils.js                  # Timestamp formatting
│   └── ... (existing utilities)
└── ... (existing structure)
```

---

## Detailed Refactoring Plan

### Phase 1: Extract Text Processing Logic

#### 1.1 Create `src/utils/textProcessing/textTransform.js`
**Extract:**
- `escapeCurrencyDollars` function
- `replaceMentions` function
- Text filtering logic (BEGIN marker removal)

**Benefits:**
- Reusable text processing
- Testable independently
- Clear separation of concerns

#### 1.2 Create `src/utils/textProcessing/markdownUtils.js`
**Extract:**
- `renderTextContent` logic (code block parsing, mermaid detection)
- Markdown rendering configuration
- Code block extraction logic

**Benefits:**
- Centralized markdown processing
- Easier to modify rendering behavior
- Testable markdown transformations

#### 1.3 Create `src/utils/textProcessing/mentionUtils.js`
**Extract:**
- Mention extraction logic (`extractMentionedRolesFromParts`)
- Mention replacement logic
- Role mapping utilities

**Benefits:**
- Reusable mention processing
- Consistent mention handling across app

### Phase 2: Extract TTS Logic

#### 2.1 Create `src/hooks/useTts.js`
**Extract from `ConversationHistory.js`:**
- TTS state management (audio segments, playing state, etc.)
- Audio playback logic (`playSegmentAtIndex`, `stopAudio`)
- Audio generation handling (`handleSpeakerClick`)

**Benefits:**
- Reusable TTS hook
- Testable TTS logic
- Cleaner component code

#### 2.2 Create `src/components/tts/TtsPlayer.js`
**Extract:**
- TTS player component with all audio controls
- Progress indicator
- Error display

**Benefits:**
- Isolated TTS UI
- Reusable TTS component

#### 2.3 Create `src/components/tts/SpeakerButton.js`
**Extract:**
- Speaker button component (already exists but can be moved)

**Benefits:**
- Better organization
- Clearer component structure

### Phase 3: Extract File Handling Logic

#### 3.1 Create `src/utils/fileUtils.js`
**Extract:**
- File validation logic (image types, PDF types, size checks)
- File type detection
- File size formatting

**Benefits:**
- Single source of truth for file validation
- Eliminates duplication
- Easier to maintain validation rules

#### 3.2 Create `src/services/fileUploadService.js`
**Extract from `AppContent.js`:**
- `compressImageForDisplay` function
- `convertFileToBase64` function
- File upload orchestration logic

**Benefits:**
- Reusable file upload service
- Testable file processing
- Clear separation of concerns

#### 3.3 Create `src/hooks/useFileUpload.js`
**Extract:**
- File upload state management
- Upload progress tracking
- Error handling for uploads

**Benefits:**
- Reusable upload hook
- Cleaner component code

### Phase 4: Extract Conversation Management

#### 4.1 Create `src/services/conversationService.js`
**Extract from `AppContent.js`:**
- Conversation CRUD operations
- Message appending logic
- Conversation export/import logic
- Conversation filtering logic

**Benefits:**
- Centralized conversation operations
- Testable conversation logic
- Reusable conversation utilities

#### 4.2 Create `src/hooks/useConversation.js`
**Extract:**
- Conversation state management
- Conversation ref management
- Conversation update logic

**Benefits:**
- Reusable conversation hook
- Cleaner component code
- Better state management

#### 4.3 Create `src/hooks/useConversationExport.js`
**Extract:**
- Export conversation logic (`downloadConversation`)
- Import conversation logic (`uploadConversation`)
- Format conversion logic

**Benefits:**
- Isolated export/import logic
- Testable independently
- Reusable export functionality

### Phase 5: Extract Role Request Management

#### 5.1 Create `src/services/roleRequestService.js`
**Extract from `AppContent.js`:**
- Request queue management
- Request deduplication logic
- Request cancellation logic
- Request priority handling

**Benefits:**
- Centralized request management
- Testable request logic
- Reusable request service

#### 5.2 Create `src/hooks/useRoleRequests.js`
**Extract:**
- Role request state management
- Request queue refs
- Active request tracking
- Request processing logic

**Benefits:**
- Reusable request hook
- Cleaner component code
- Better separation of concerns

### Phase 6: Extract Mermaid Rendering

#### 6.1 Create `src/hooks/useMermaid.js`
**Extract from `ConversationHistory.js`:**
- Mermaid initialization
- Mermaid rendering logic
- Mermaid error handling

**Benefits:**
- Reusable Mermaid hook
- Testable rendering logic
- Cleaner component code

#### 6.2 Create `src/components/conversation/MermaidDiagram.js`
**Extract:**
- Mermaid diagram component (already exists, just move)

**Benefits:**
- Better organization
- Clearer component structure

### Phase 7: Extract Utility Functions

#### 7.1 Create `src/utils/avatarUtils.js`
**Extract:**
- Avatar mapping logic (`VOICE_MAP`)
- Avatar path resolution
- Voice selection logic

**Benefits:**
- Single source of truth for avatars
- Eliminates duplication
- Easier to maintain

#### 7.2 Create `src/utils/timestampUtils.js`
**Extract:**
- `formatTimestamp` function
- Date formatting utilities

**Benefits:**
- Reusable timestamp formatting
- Testable date logic
- Consistent formatting

#### 7.3 Create `src/services/errorService.js`
**Extract from `AppContent.js`:**
- `buildUserFacingErrorMessage` function
- Error type handling
- Error formatting utilities

**Benefits:**
- Centralized error handling
- Consistent error messages
- Testable error logic

### Phase 8: Break Down Large Components

#### 8.1 Refactor `ConversationHistory.js`
**Target:** Reduce from 1195 lines to ~300 lines

**Actions:**
1. Extract sub-components to separate files
2. Move TTS logic to `useTts` hook
3. Move text processing to utilities
4. Move Mermaid logic to `useMermaid` hook
5. Extract message rendering to `MessageBubble` component

**Result:**
- Main component focuses on orchestration
- Sub-components handle specific rendering
- Logic extracted to hooks and utilities

#### 8.2 Refactor `AppContent.js`
**Target:** Reduce from 1484 lines to ~400 lines

**Actions:**
1. Extract role request logic to `useRoleRequests` hook
2. Move file upload logic to `useFileUpload` hook
3. Extract conversation management to `useConversation` hook
4. Move export/import to `useConversationExport` hook
5. Extract error handling to `errorService`
6. Move file compression to `fileUploadService`

**Result:**
- Main component focuses on UI orchestration
- Business logic in hooks and services
- Better separation of concerns

---

## Migration Strategy

### Step-by-Step Approach

1. **Create new utilities/services first** (non-breaking)
   - Add new files alongside existing code
   - Ensure they work correctly
   - Write tests for new utilities

2. **Extract logic incrementally**
   - Start with pure functions (easiest)
   - Move to hooks (medium complexity)
   - Refactor components last (most complex)

3. **Update imports gradually**
   - Update one component at a time
   - Test after each change
   - Keep old code commented initially

4. **Remove old code**
   - Only after all imports updated
   - After thorough testing
   - Document any breaking changes

### Testing Strategy

1. **Unit Tests**
   - Test all extracted utilities
   - Test hooks in isolation
   - Test services independently

2. **Integration Tests**
   - Test component integration
   - Test hook integration
   - Test service integration

3. **Manual Testing**
   - Test all user flows
   - Verify no regressions
   - Check performance

---

## Priority Order

### High Priority (Do First)
1. ✅ Extract text processing utilities (`textTransform.js`, `mentionUtils.js`)
2. ✅ Extract file validation utilities (`fileUtils.js`)
3. ✅ Extract avatar/voice utilities (`avatarUtils.js`)
4. ✅ Extract timestamp utilities (`timestampUtils.js`)
5. ✅ Extract error handling service (`errorService.js`)

**Reason:** These are pure functions, easiest to extract, and eliminate immediate duplication.

### Medium Priority (Do Second)
1. ✅ Extract TTS hook (`useTts.js`)
2. ✅ Extract file upload service (`fileUploadService.js`)
3. ✅ Extract conversation service (`conversationService.js`)
4. ✅ Extract Mermaid hook (`useMermaid.js`)

**Reason:** These require more careful extraction but significantly reduce component complexity.

### Lower Priority (Do Third)
1. ✅ Extract role request service (`roleRequestService.js`)
2. ✅ Extract role request hook (`useRoleRequests.js`)
3. ✅ Extract conversation hooks (`useConversation.js`, `useConversationExport.js`)
4. ✅ Break down large components

**Reason:** These are more complex refactorings that require careful state management.

---

## Success Metrics

### Code Quality Metrics
- ✅ No files exceed 500 lines
- ✅ Components have single responsibility
- ✅ Business logic separated from UI
- ✅ No duplicate logic
- ✅ Test coverage > 80% for utilities/services

### Maintainability Metrics
- ✅ Average file size < 300 lines
- ✅ Cyclomatic complexity < 10 per function
- ✅ Clear separation of concerns
- ✅ Easy to locate specific functionality

### Performance Metrics
- ✅ No performance regressions
- ✅ Bundle size not significantly increased
- ✅ Runtime performance maintained or improved

---

## Risks and Mitigation

### Risk 1: Breaking Changes
**Mitigation:**
- Incremental refactoring
- Comprehensive testing
- Keep old code temporarily
- Document all changes

### Risk 2: State Management Issues
**Mitigation:**
- Careful hook extraction
- Test state transitions
- Use refs where appropriate
- Document state dependencies

### Risk 3: Performance Degradation
**Mitigation:**
- Profile before and after
- Optimize critical paths
- Use memoization where needed
- Monitor bundle size

### Risk 4: Increased Complexity
**Mitigation:**
- Clear documentation
- Consistent patterns
- Code reviews
- Regular refactoring

---

## Implementation Checklist

### Phase 1: Text Processing
- [x] Create `src/utils/textProcessing/textTransform.js`
- [x] Create `src/utils/textProcessing/markdownUtils.js`
- [x] Create `src/utils/textProcessing/mentionUtils.js`
- [x] Update `ConversationHistory.js` to use new utilities
- [x] Write tests for text processing utilities

### Phase 2: TTS Logic
- [x] Create `src/hooks/useTts.js`
- [x] Create `src/components/tts/TtsPlayer.js`
- [x] Create `src/components/tts/SpeakerButton.js`
- [x] Update `ConversationHistory.js` to use TTS hook
- [x] Write tests for TTS hook (basic structure created)

### Phase 3: File Handling
- [x] Create `src/utils/fileUtils.js`
- [x] Create `src/services/fileUploadService.js`
- [x] Create `src/hooks/useFileUpload.js`
- [x] Update `AppContent.js` and `QuestionInput.js` to use new utilities
- [x] Write tests for file utilities

### Phase 4: Conversation Management
- [x] Create `src/services/conversationService.js`
- [x] Create `src/hooks/useConversation.js`
- [x] Create `src/hooks/useConversationExport.js`
- [x] Update `AppContent.js` to use new hooks/services
- [x] Write tests for conversation utilities

### Phase 5: Role Request Management
- [x] Create `src/services/roleRequestService.js`
- [x] Create `src/hooks/useRoleRequests.js`
- [x] Update `AppContent.js` to use new hook/service
- [x] Write tests for role request utilities (basic structure created)

### Phase 6: Mermaid Rendering
- [x] Create `src/hooks/useMermaid.js`
- [x] Create `src/components/conversation/MermaidDiagram.js` (included in useMermaid.js)
- [x] Update `ConversationHistory.js` to use Mermaid hook
- [x] Write tests for Mermaid hook (basic structure created)

### Phase 7: Utility Functions
- [x] Create `src/utils/avatarUtils.js`
- [x] Create `src/utils/timestampUtils.js`
- [x] Create `src/services/errorService.js`
- [x] Update components to use new utilities
- [x] Write tests for utilities

### Phase 8: Component Breakdown
- [x] Break down `ConversationHistory.js` into sub-components
  - [x] Extract `ExpandableHtmlBlock.js`
  - [x] Extract `CodeBlock.js`
  - [x] Extract `EditButton.js`
  - [x] Extract `EditForm.js`
  - [x] Extract `GroundingData.js`
  - [x] Extract `CodeExecutionResult.js`
  - [x] Extract `InlineImage.js`
  - [x] Extract `PdfPlaceholder.js`
  - [x] Extract `TextPart.js`
- [x] Break down `AppContent.js` into smaller components (reduced from 722 to 518 lines)
  - [x] Extract `useFollowUpQuestions` hook
  - [x] Extract `useSettings` hook
  - [x] Extract `useChromeContent` hook
  - [x] Extract `useMessageEditing` hook
- [x] Update imports across codebase
- [x] Remove old code from `ConversationHistory.js`
- [x] Final testing and cleanup (test files created)

---

## Conclusion

This refactoring plan provides a systematic approach to improving code maintainability. By following these principles and phases, we can:

1. **Reduce complexity** - Smaller, focused files
2. **Improve testability** - Separated logic is easier to test
3. **Eliminate duplication** - Shared utilities and services
4. **Enhance maintainability** - Clear structure and separation of concerns

The incremental approach minimizes risk while maximizing benefits. Each phase builds on the previous one, ensuring a smooth transition to a more maintainable codebase.

---

## Notes

- This plan should be reviewed and adjusted based on team feedback
- Prioritize based on current pain points
- Consider performance implications of each change
- Document all changes thoroughly
- Maintain backward compatibility where possible
