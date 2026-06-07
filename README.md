# Google Flow Auto Generator — Chrome Extension

Automates prompt entry and media download on [Google Labs Flow](https://labs.google/fx/tools/flow/).

## Features
- Auto-type prompts into the Slate.js editor
- Click the send button automatically
- Detect and download generated images/videos
- Batch mode (N generations with configurable delay)
- One-shot mode for single generations

## Project Structure

```
flow-ext-v6/
├── src/                    # Extension source (load this folder in Chrome)
│   ├── manifest.json       # Extension config, permissions
│   ├── content.js          # Injected into labs.google — core automation logic
│   ├── background.js       # Service worker — handles chrome.downloads API
│   ├── popup.html          # Extension popup UI
│   └── popup.js            # Popup logic — talks to content.js via messages
├── icons/
│   └── icon.png
└── README.md
```

## How to Install (Developer Mode)

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `src/` folder
5. Open a Google Flow project tab and refresh it

## How It Works

### Message Flow
```
popup.js  →  chrome.tabs.sendMessage  →  content.js
                                              ↓
                                        types prompt (Slate.js DataTransfer paste)
                                        clicks send button
                                        waits for new img/video in DOM
                                              ↓
content.js  →  chrome.runtime.sendMessage  →  background.js
                                                    ↓
                                             chrome.downloads.download()
                                             saves to Downloads/FlowGen/
```

### Key Selectors (confirmed via DOM inspection)
| Element | Selector | Notes |
|---|---|---|
| Prompt input | `[contenteditable="true"].sc-a8ba1f43-0` | Slate.js editor |
| Send button | `button.sc-26b30722` | "arrow_forwardCreate" |

### Slate.js Text Input
Google Flow uses [Slate.js](https://github.com/ianstormtaylor/slate) rich text editor.
Normal `element.value =` or `execCommand` alone won't update React state.

**Working method (v6):**
1. `ClipboardEvent('paste')` with `DataTransfer` — Slate intercepts and updates state
2. Fallback: `InputEvent('beforeinput', { inputType: 'insertText' })`
3. Nuclear fallback: char-by-char keydown → beforeinput → insertText → keyup

## Development

### Modifying content.js
After edits, go to `chrome://extensions/` → click **↺ Reload** on the extension,
then **refresh the Flow tab** (Ctrl+R). No reinstall needed.

### Debugging
Open DevTools on the Flow tab → Console → filter `[FlowExt`
All steps are logged with `[FlowExt v6]` prefix.

### If Google Updates Their DOM
If selectors break after a Google update, run this in DevTools console on the Flow page:
```javascript
// Find prompt input
document.querySelectorAll('[contenteditable="true"]')

// Find send button area
[...document.querySelectorAll('button')].filter(b => b.offsetParent).map(b => ({text: b.textContent.trim().substring(0,20), class: b.className.substring(0,40), y: b.getBoundingClientRect().top.toFixed(0)}))
```
Update `findPromptInput()` and `findSendButton()` in `content.js` accordingly.

## Known Limitations
- Downloads go to `Downloads/FlowGen/` — Chrome doesn't allow arbitrary folder selection
- "Nano Banana" credits are consumed per generation (Google Flow's own limit)
- If Google updates their Slate.js version or class names, selectors may need updating

## Version History
| Version | Change |
|---|---|
| v1 | Initial — basic textarea injection |
| v2 | Added contenteditable support, auto script inject |
| v3 | Edit page detection, waitFor polling |
| v4 | DOM-confirmed selectors (`sc-a8ba1f43`, `sc-26b30722`) |
| v5 | Slate.js awareness, 3-layer fallback typing |
| v6 | **DataTransfer paste fix** — properly updates React/Slate internal state ✅ |
