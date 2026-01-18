# ChatSphere

An AI-first chat workspace built with React 18. The app pairs a conversational assistant with multi-role routing, memory tooling, collaborative editing, and a Chrome extension. Recent updates include KaTeX-rendered math, paste-to-upload images, fully parallel role handling, OneDrive sync for memories, file tracking with expiration, consolidated financial APIs, thinking mode, text-to-speech, memory compression, model selection, and Microsoft authentication.

---

## Highlights

- **Real-time assistant** with multi-role conversations, follow-up suggestions, and token-aware history management with automatic memory compression.
- **Parallel role routing** automatically fans out @mentions (e.g. `@Charlie`) and aggregates replies without blocking the chat input. Supports up to 3 concurrent role requests.
- **Math-ready rendering**: Markdown + GFM + KaTeX so inline `$E=mc^2$` and block formulas render cleanly.
- **Rich content rendering**: Mermaid diagrams, syntax-highlighted code blocks (Prism), expandable HTML blocks, and intelligent timestamp formatting.
- **Image & PDF support**: upload from disk or paste straight from clipboard; files flow through resumable upload protocol with automatic expiration tracking (12 hours).
- **Text-to-Speech**: Convert any response to audio with role-specific voices. Supports CJK characters and automatic text chunking for long responses.
- **Thinking mode**: Toggle adaptive thinking mode to see the model's reasoning process (enabled by default).
- **Model selection**: Choose between Gemini models (gemini-3-flash-preview, gemini-2.5-flash).
- **Conversation controls**: reset, download, upload, and in-place editing for any message or thought.
- **Memory management**: store, edit, and sync memories with OneDrive. Auto-sync option keeps memories synchronized across devices.
- **OneDrive sync**: synchronize memories with OneDrive using Microsoft authentication. Profile data is stored in `.chatsphere/profile.json` in your OneDrive. Supports automatic merging based on timestamps and handles deleted memories.
- **Microsoft Authentication**: Optional login with Microsoft account. Anonymous access is still allowed for all features except OneDrive sync.
- **Financial data APIs**: comprehensive financial data retrieval via consolidated AlphaVantage and Finnhub APIs with smart rate limiting, API response caching, and intelligent data fetching strategies.
- **Collaborative Co-Edit tab** tied to the same memory and role system.
- **Chrome extension** modes reuse the same UI and persist API keys/system prompts via extension storage.

---

## Getting Started

### Requirements

- Node.js 18+ (works with 16+, but 18 is recommended)
- npm 8+

### Installation

```bash
git clone https://github.com/deltamaster/react-tutorial-solutions.git
cd react-tutorial-solutions
npm install
```

### Development server

```bash
npm start
```

The dev server runs at [http://localhost:3000](http://localhost:3000) with hot reload.

---

## Daily Workflow

1. **Configure credentials**  
   Open *Settings → Global Settings* and configure:
   - Gemini subscription key
   - System prompt
   - Model selection (gemini-3-flash-preview or gemini-2.5-flash)
   - Thinking mode toggle (enabled by default)
   - User avatar (male/female)
   - **Optional**: Login with Microsoft account to enable OneDrive sync for memories

2. **Enable OneDrive Sync (Optional)**  
   - Click "Login as my personal Microsoft account" button at the top of the app
   - Grant OneDrive access permissions during login (Files.ReadWrite scope)
   - After login, OneDrive sync will be automatically enabled
   - Your profile data will be stored in `.chatsphere/profile.json` in your OneDrive

3. **Chat immediately**  
   Type in the Question box. You can:
   - paste screenshots or drag images/PDFs (max 20 MB, PNG/JPEG/WEBP/HEIC/HEIF/PDF)
   - reference specialist personas using `@Belinda`, `@Charlie`, `@Diana`, etc.
   - edit any sent message or model response via the pencil button
   - click the speaker icon to hear responses via text-to-speech

4. **Stay in context**  
   - Follow-up questions appear below the transcript once all queued requests finish.
   - The Memory tab summarizes and stores key facts. Use it to pin long-lived context.
   - Old conversation segments are automatically compressed into summaries when token count exceeds thresholds.
   - If logged in with OneDrive sync enabled, memories are automatically synchronized across devices.

5. **Co-edit documents**  
   Switch to the *Co-Edit* tab for a shared markdown workspace with live preview.

6. **Export & Restore**  
   Use the Reset / Download / Upload controls (top-right) to manage chat archives. Export includes conversation summaries and file tracking metadata.

---

## Keyboard & Clipboard Tips

- **Paste images (Ctrl/Cmd + V)**: The textarea intercepts clipboard images and loads them immediately.
- **Math entry**: Use `$…$` for inline or `$$ … $$` for display math. All KaTeX commands are supported.
- **Edit shortcuts**: `Esc` cancels in-place edits; `Ctrl/Cmd + Enter` submits the form (browser default).

---

## Chrome Extension Mode

The UI can be loaded inside a Chrome extension popup or sidebar.

1. Build the app:

   ```bash
   npm run build
   ```

2. In Chrome, go to `chrome://extensions`, enable **Developer mode**, then **Load unpacked** and select the `build/` folder.

3. Extension extras:
   - Right-click → “Analyze Page” sends the current tab’s content into the app.
   - `chrome.storage.sync` keeps API keys/system prompts consistent across installs.

---

## Project Tour

```
src/
├── components/
│   ├── AppContent.js        // Core orchestrator: role routing, queues, follow-up pipeline
│   ├── ConversationHistory.js
│   ├── QuestionInput.js     // Clipboard-aware input with file handling
│   ├── FollowUpQuestions.js
│   ├── Memory.js            // Memory management UI with OneDrive sync controls
│   ├── MarkdownEditor.js
│   ├── LoginButton.js       // Microsoft authentication login button
│   └── Settings.js          // Settings configuration
├── contexts/
│   └── AuthContext.js       // MSAL authentication context and OneDrive token management
├── config/
│   └── msalConfig.js        // MSAL configuration for Microsoft authentication
├── utils/
│   ├── apiUtils.js          // Gemini fetch helpers, toolbox bridge, memory compression, financial APIs, API caching
│   ├── roleConfig.js        // Role definitions + mention helpers + consolidated API functions
│   ├── profileSyncService.js // Memory synchronization with OneDrive using Microsoft Graph API
│   ├── fileTrackingService.js // File upload tracking with expiration handling
│   ├── memoryService.js     // Memory storage with metadata support
│   ├── settingsService.js   // Centralized settings management (subscription key, model, thinking mode, etc.)
│   ├── ttsUtils.js          // Text-to-speech utilities with CJK support and text chunking
│   ├── coEditService.js     // Co-edit document management
│   ├── followUpUtils.js     // Follow-up question generation utilities
│   ├── responseUtils.js     // Response processing and normalization utilities
│   └── storageUtils.js      // Chrome extension + localStorage abstraction
└── styles.css               // Bootstrap overrides + KaTeX tweaks
```

Key dependencies:

- **UI**: React 18, React Bootstrap, Bootstrap 5
- **Authentication**: `@azure/msal-browser` for Microsoft authentication and OneDrive access
- **Markdown**: `react-markdown`, `remark-gfm`, `remark-math`, `rehype-katex`, `react-syntax-highlighter`, Mermaid
- **Build**: Create React App (react-scripts 5)

---

## Production Build

```bash
npm run build
```

Outputs to `build/` with optimized assets ready for static hosting or Chrome extension packaging.

---

## Features in Detail

### Memory Management & OneDrive Sync

- **Memory Storage**: Store key facts and context that persist across conversations. Memories include metadata (timestamps, deletion flags) for synchronization.
- **OneDrive Sync**: Synchronize memories with OneDrive using Microsoft authentication. Profile data is stored in `.chatsphere/profile.json` in your OneDrive root folder. Supports:
  - Automatic merging based on timestamps (newer changes take precedence)
  - Handling of deleted memories across devices
  - Auto-sync option (syncs every 5 minutes when enabled)
  - Manual sync button for on-demand synchronization
  - Requires Microsoft account login and OneDrive access consent
- **Memory Operations**: Create, read, update, delete memories. Download/upload memory data as JSON.
- **Memory Compression**: Automatically compresses old conversation segments when token count exceeds thresholds (100K tokens in production, 10K in development). Recent messages (last 10) are always kept uncompressed. Summaries are stored separately and replace original segments in conversation history.

### Microsoft Authentication

- **Optional Login**: Users can optionally login with their Microsoft account. Anonymous access is still allowed for all features except OneDrive sync.
- **OneDrive Integration**: Login grants both `User.Read` and `Files.ReadWrite` permissions, enabling OneDrive sync without additional consent prompts.
- **Token Management**: Access tokens are cached and refreshed automatically. Silent token acquisition is attempted first, only prompting for consent when necessary.
- **Profile Storage**: Profile data is stored in `.chatsphere/profile.json` in the user's OneDrive root folder, keeping it organized and accessible across devices.

### File Management

- **File Tracking**: All uploaded files are tracked with upload timestamps.
- **Automatic Expiration**: Files expire after 12 hours. Expired files are automatically removed from conversations and replaced with placeholder text.
- **Resumable Upload**: Uses 2-step resumable upload protocol for reliable file uploads.
- **Error Handling**: 403 errors from expired files are automatically detected and handled gracefully.
- **Export/Import**: File tracking metadata is included in conversation exports for restoration.

### Text-to-Speech (TTS)

- **Role-Specific Voices**: Each role has a dedicated voice (Adrien: Ethan, Belinda/Charlie/Diana: Cherry, User: Ryan/Katerina).
- **CJK Support**: Automatically detects and handles Chinese, Japanese, and Korean characters.
- **Smart Text Chunking**: Automatically splits long text into byte-sized chunks (600 bytes max) for optimal API calls.
- **Text Sanitization**: Removes markdown, HTML, code blocks, and formatting markers before speech generation.
- **Audio Playback**: Click speaker icon to play/pause audio for any response.

### Thinking Mode

- **Adaptive Thinking**: When enabled, the model uses adaptive thinking budget to show reasoning process.
- **Toggle Control**: Can be enabled/disabled in settings. Disabled for follow-up questions and summarization tasks.
- **Thinking Display**: Shows the model's internal reasoning process when thinking mode is active.

### Model Selection

- **Multiple Models**: Choose between Gemini models:
  - `gemini-3-flash-preview` (default)
  - `gemini-2.5-flash`
- **Model Persistence**: Selected model is saved in localStorage and persists across sessions.

### Content Rendering

- **Mermaid Diagrams**: Automatic rendering of Mermaid diagrams in markdown code blocks.
- **Syntax Highlighting**: Code blocks use Prism syntax highlighter with VS Code Dark+ theme.
- **Expandable HTML Blocks**: HTML code blocks are collapsed by default with expand/collapse controls.
- **Intelligent Timestamps**: Timestamps format intelligently based on age (time only for today, date+time for this year, full date+time for older).

### Financial Data APIs

- **Consolidated Functions**: Streamlined API functions for financial data:
  - **AlphaVantage**: Time series (stock/fx/crypto), fundamental data, financial statements, commodities, economic indicators, exchange rates
  - **Finnhub**: Stock quotes, company profiles, key metrics, news, market data, calendar events
- **Smart Rate Limiting**: Prefers Finnhub over AlphaVantage when both offer similar functionality (Finnhub: 60 calls/min vs AlphaVantage: 5 calls/min). Uses request queues to manage rate limits.
- **API Response Caching**: Caches API responses to reduce redundant calls and improve performance.
- **Intelligent Data Fetching**: Automatically selects appropriate time granularity:
  - Daily data for recent periods (< 3 months)
  - Weekly data for medium-term (3+ months)
  - Monthly data for long-term analysis (multiple years)
- **Time Range Filtering**: All time series functions require time ranges to prevent excessive data retrieval. Automatically filters results to max 1000 elements.

### Role System

- **Adrien** (general): Main assistant with memory management, casual conversational style, meme support, thinking mode
- **Belinda** (searcher): Research specialist with web search, URL context, and Python code execution (matplotlib support)
- **Charlie** (editor): Content editor and document specialist for the Co-Edit tab
- **Diana** (financial advisor): Financial data specialist with access to all financial APIs, prefers Finnhub for better rate limits
- **Xaiver** (hidden): Memory manager for conversation compression and summarization

### Parallel Processing

- **Concurrent Role Requests**: Supports up to 3 concurrent role requests processed in parallel.
- **Request Cancellation**: New @mentions cancel any in-flight requests for that role.
- **Non-Blocking UI**: Chat input remains responsive during parallel request processing.

## Troubleshooting & Notes

- **API errors** display inline with detailed messages (authentication, network, validation).
- **Local storage** retains conversations, summaries, settings, and tracked files; use Reset to clear.
- **Role pipeline**: Only the newest task per role runs—@mentions cancel any in-flight call for that persona. Up to 3 roles can process requests concurrently.
- **Math overlap fix**: KaTeX blocks no longer cover edit buttons thanks to z-index adjustments.
- **File expiration**: Uploaded files expire after 12 hours. The app automatically handles expired files and updates conversations accordingly.
- **OneDrive sync**: Requires Microsoft account login and OneDrive access consent. Consent is requested during login (both User.Read and Files.ReadWrite scopes). Auto-sync runs every 5 minutes when enabled. Profile data is stored in `.chatsphere/profile.json` in your OneDrive.
- **Financial APIs**: Always specify time ranges when requesting historical data. The system prefers Finnhub APIs for better rate limits. Responses are cached to reduce API calls.
- **Memory compression**: Automatically triggers when conversation token count exceeds thresholds. Summaries replace old segments but are stored separately for export.
- **Text-to-Speech**: Requires subscription key. Long responses are automatically chunked. Audio URLs may expire based on API response.
- **Thinking mode**: Disabled by default for follow-up questions and summarization to reduce latency. Can be toggled in settings.
- **Model selection**: Default model is `gemini-3-flash-preview`. Model selection persists across sessions.

---

## Contributing

Issues and PRs are welcome. Please include reproduction steps for bugs and update the README if behavior changes.

---

## License

MIT © contributors. See [LICENSE](LICENSE) for full text.
