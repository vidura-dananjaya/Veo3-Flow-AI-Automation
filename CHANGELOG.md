# Changelog

## v8.0 — Current (Working ✅)
- **New Architecture:** Completely migrated to a pure WebSocket Server implementation using Python `asyncio` and `websockets`.
- **Real-Time Delivery:** Generation commands are pushed instantly to the extension without HTTP polling delays.
- **Robust Persistence:** Extension automatically reconnects to the WebSocket server if the connection drops.
- **No More Sleep:** The Manifest V3 service worker uses a 20s heartbeat loop via the `content.js` script to permanently bypass the 30-second idle termination, preventing stuck/ghost processes.

## v6.17
- **Fix:** With the prompt finally reaching Flow's state (v6.16), the send still did nothing — including when React's `onClick` was called directly, which returned without throwing. Flow's minified handler reads two properties off the event before acting, and a real mouse click was confirmed to work, so the handler is gated on `isTrusted`. Dispatched events can never satisfy that: `isTrusted` is `[LegacyUnforgeable]`, a non-configurable own property, so `defineProperty` throws on any real `Event`. The bridge now hands the handler a plain object shaped like a React SyntheticEvent — no real `Event` involved, so `isTrusted: true` is simply a property. This became the first send strategy; the DOM-level attempts remain as fallbacks.
- **New:** `probeClick` — when every send strategy fails, the bridge replays the handler behind a logging `Proxy` and reports the exact property path it read. The next fix gets aimed instead of guessed.

## v6.16
- **Fix (real root cause):** The send button was never the problem. Flow's composer is a Slate.js editor that keeps the prompt in React state; the synthetic `ClipboardEvent` / `execCommand` writes only reached the DOM, so `editor.children` stayed empty. The button's `onClick` fired normally and then returned silently because the app saw no prompt — which looked exactly like a dead click. Confirmed on the live page: DOM text read `"Generate a image: ffff"` while Slate's state read `""`.
- **New:** `page-bridge.js`, a `world: "MAIN"` content script. React's `__reactFiber$` / `__reactProps$` expandos are invisible from a content script's isolated world, so the bridge runs in the page world, walks the fiber tree to Flow's Slate editor instance, and calls its own `insertText()`. Content script and bridge talk over `window.postMessage`.
- **New:** The prompt is now verified against Flow's actual editor state before sending. If the text never reached that state the run fails loudly instead of clicking a button that would do nothing.
- **New:** Added a "React onClick via page bridge" step to the send chain, which invokes the handler directly with no DOM event involved.

## v6.15
- **Fix:** The send button stopped responding after Google shipped a new Flow build (visible once the browser cache was cleared). `sendBtn.click()` only fires an untrusted `click` event, and the new composer button acts on the pointer sequence instead — the element was found correctly, but nothing happened. Sending now dispatches the full `pointerover → pointermove → pointerdown → mousedown → pointerup → mouseup → click` chain with real coordinates, then falls back to `click()`, form submit, and finally Enter in the editor. Each attempt is verified (prompt box cleared, or the send button gone/disabled) before the next one runs, so a prompt that did go through is never sent twice.
- **Fix:** `findSendButton` no longer relies on the styled-components hash `sc-26b30722`, which disappears on every Flow deploy. It now matches the stable `arrow_forward` icon ligature and the button's hidden "Create" label, scoped to the composer around the prompt editor, and honours `aria-disabled` alongside the native `disabled` attribute.
- **Fix:** If React re-renders and swaps out the send button node mid-send, the extension re-acquires the fresh button instead of clicking a detached element.

## v6.14
- **Fix:** Implemented an aggressive continuous polling mechanism for media detection. Instead of permanently ignoring elements that fail to download (which accidentally ignored final videos if they shared the same base ID as the placeholder), the script now repeatedly right-clicks the newly added media element every 3 seconds until the native download menu options ("1080p Upscaled" or "Download") appear. This accurately mirrors a human waiting for the exact moment the video finishes generating, providing bulletproof reliability against DOM virtualization and intermediate UI states.

## v6.13
- **Fix:** Re-architected the media generation detection loop to gracefully handle intermediate placeholder states during Text-to-Video and Image-to-Video generations. If the extension prematurely detects a generated placeholder (which lacks a download menu) instead of the final video, it now automatically adds the placeholder to the snapshot and seamlessly resumes waiting for the final video. This ensures 100% reliable downloads even when Google Flow's UI transitions through multiple loading states.

## v6.12
- **Fix:** Removed the `findMoreButtonForMedia` check entirely. This resolves the issue where continuous video generation would get stuck in a loop. When many videos are generated and the user scrolls down, Google Flow's DOM virtualizes or hides the group heading that contains the `⋮` (More) button. This caused the script to loop infinitely waiting for a visible button that would never appear. Since `getBaseId` already perfectly ignores placeholders, the button check was redundant and safely removed.

## v6.10
- **Fix:** Fixed a bug where generating a video from a reference image caused the extension to falsely identify the uploaded reference image in the gallery as the newly generated video. The snapshot logic now compares image base IDs (stripping dynamic resizing parameters) to properly ignore reference images and accurately target the final video.

## v6.9
- **Fix:** Resolved an issue where Image-to-Video generation would fail to download because the extension mistakenly identified the generated placeholder thumbnail as the final video. The extension now intelligently waits for the `⋮` (More) button to appear on the media before triggering the download sequence, ensuring the video is fully processed.

## v6.8
- **New:** Video Mode support! Added a toggle in the popup to handle video prompt generations.
- **New:** Video Downloading & Upscaling logic: 
  - If Upscale is enabled, automatically right-clicks the generated video and downloads the **1080p Upscaled** version.
  - If Upscale is disabled, automatically right-clicks and downloads the **Original Size** video.
- **Fix:** Fixed a bug where `waitForNewMedia` was mistakenly detecting and downloading the video's placeholder thumbnail `<img>` instead of the actual video. The extension now reliably clicks the thumbnail to trigger the video context menu.
- **UI:** Simplified the upscale label from "Upscale images to 2K" to "Upscale" since it now applies to both images (2K) and videos (1080p).

## v6.4
- **New:** Support for attaching a reference image to the prompt. Includes an interactive drag-and-drop preview zone in the extension popup.
- **Fix:** Redesigned the image injection logic to follow the exact Google Flow user sequence: inject image first, wait for upload confirmation, then type the prompt.
- **Fix:** Switched image injection to use direct `ClipboardEvent` ('paste') and synthetic `DragEvent` ('drop') on the `contenteditable` editor, resolving the issue where file inputs were triggering a global project upload instead of attaching to the specific prompt box.
- **Fix:** Fixed a bug where small reference image thumbnails were mistakenly detected as "newly generated media", which caused premature downloads and failed 2K upscales. `waitForNewMedia` now strictly filters out images under 150x150 pixels.
- **New:** Added intelligent upload polling that watches for visual indicators (spinners, chips, thumbnails) to wait precisely until the reference image finishes processing before typing the text prompt.

## v6.3
- **Fix:** Substituted the fragile UI button targeting with direct right-click (contextmenu) interaction on generated images to reliably trigger the native upscale menus.
- **Fix:** Added multiple fallback layers (Arrow keys, Hover, Direct Click) to ensure the Radix UI "Download" submenu opens correctly.
- **Fix:** Fixed an issue where `looksGenerated` check failed for newer API endpoints (e.g. `generativelanguage.googleapis`), causing time-outs.

## v6.2
- **Fix:** Fixed an issue where the extension would mistakenly click the global "Download" button (which downloads all images as a ZIP) instead of the newly generated image's menu. 
- **Fix:** Upscale process now accurately targets the specific `⋮` (More) button of the newly generated media.
- **Fix:** Improved keyboard navigation to directly focus Radix popup elements for 2K upscale selection without relying on fragile hover events.

## v6.1
- **New:** 2K upscale option — uses Google Flow's **native AI upscale** (clicks the built-in 2K button)
- **New:** Auto-detects and clicks Flow's "2K Upscaled" button, waits for AI-processed image, then downloads
- **New:** Animated toggle switch UI with resolution badge indicator in popup
- **New:** Upscale preference saved via `chrome.storage.local` (persists across sessions)
- **Note:** Videos are not upscaled (images only), graceful fallback on failure

## v6.0
- **Fix:** Slate.js DataTransfer paste properly updates React internal state
- **Fix:** Nuclear fallback char-by-char keyboard simulation
- **Fix:** beforeinput + InputEvent chain for Slate compatibility

## v5.0
- DOM-confirmed selectors from live page inspection
- 3-layer text input fallback system
- waitFor() polling helper

## v4.0
- Exact class selectors: `sc-a8ba1f43-0` (input), `sc-26b30722` (button)
- Inspect debug message action

## v3.0
- Edit page URL detection
- Async waitForInput polling

## v2.0
- Auto content script injection on tab reload
- ensureContentScript() helper
- ping/pong health check

## v1.0
- Initial release
- Basic textarea/contenteditable injection
- chrome.downloads integration
