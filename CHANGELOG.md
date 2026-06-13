# Changelog

## v6.14 — Current (Working ✅)
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
