# React QnA Assistant

An AI-first chat workspace built with React 18. The app pairs a conversational assistant with multi-role routing, memory tooling, collaborative editing, and a Chrome extension. Recent updates include KaTeX-rendered math, paste-to-upload images, and fully parallel role handling.

---

## Highlights

- **Real-time assistant** with multi-role conversations, follow-up suggestions, and token-aware history management.
- **Parallel role routing** automatically fans out @mentions (e.g. `@Charlie`) and aggregates replies without blocking the chat input.
- **Math-ready rendering**: Markdown + GFM + KaTeX so inline `$E=mc^2$` and block formulas render cleanly.
- **Image & PDF support**: upload from disk or paste straight from clipboard; files flow through the same validation pipeline.
- **Conversation controls**: reset, download, upload, and in-place editing for any message or thought.
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
   Open *Settings → Global Settings* and paste your Gemini subscription key, system prompt, and avatar.

2. **Chat immediately**  
   Type in the Question box. You can:
   - paste screenshots or drag images/PDFs (max 20 MB, PNG/JPEG/WEBP/HEIC/HEIF/PDF)
   - reference specialist personas using `@Belinda`, `@Charlie`, etc.
   - edit any sent message or model response via the pencil button.

3. **Stay in context**  
   - Follow-up questions appear below the transcript once all queued requests finish.
   - The Memory tab summarizes and stores key facts. Use it to pin long-lived context.

4. **Co-edit documents**  
   Switch to the *Co-Edit* tab for a shared markdown workspace with live preview.

5. **Export & Restore**  
   Use the Reset / Download / Upload controls (top-right) to manage chat archives. Export includes conversation summaries.

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
│   ├── Memory.js
│   ├── MarkdownEditor.js
│   └── Settings/…
├── utils/
│   ├── apiUtils.js          // Gemini fetch helpers, toolbox bridge, memory compression
│   ├── roleConfig.js        // Role definitions + mention helpers
│   └── storageUtils.js
└── styles.css               // Bootstrap overrides + KaTeX tweaks
```

Key dependencies:

- **UI**: React 18, React Bootstrap, Bootstrap 5
- **Markdown**: `react-markdown`, `remark-gfm`, `remark-math`, `rehype-katex`, `react-syntax-highlighter`, Mermaid
- **Build**: Create React App (react-scripts 5)

---

## Production Build

```bash
npm run build
```

Outputs to `build/` with optimized assets ready for static hosting or Chrome extension packaging.

---

## Troubleshooting & Notes

- **API errors** display inline with detailed messages (authentication, network, validation).
- **Local storage** retains conversations, summaries, and settings; use Reset to clear.
- **Role pipeline**: Only the newest task per role runs—@mentions cancel any in-flight call for that persona.
- **Math overlap fix**: KaTeX blocks no longer cover edit buttons thanks to z-index adjustments.

---

## Contributing

Issues and PRs are welcome. Please include reproduction steps for bugs and update the README if behavior changes.

---

## License

MIT © contributors. See [LICENSE](LICENSE) for full text.
