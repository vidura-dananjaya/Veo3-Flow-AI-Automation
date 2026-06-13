// ===================================================
// Google Flow Auto Generator — Content Script v6.4
// Fix: Slate.js needs DataTransfer paste to register text in React state
// New: Reference image attachment support
// ===================================================

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'injectPrompt') {
    handleGenerate(msg.prompt, msg.prefix, msg.index, msg.upscale, msg.imageData, msg.imageMimeType, msg.imageName, msg.videoMode)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }
  if (msg.action === 'ping') {
    sendResponse({ ok: true });
    return true;
  }
});

async function handleGenerate(prompt, prefix, index, upscale = false, imageData = null, imageMimeType = null, imageName = null, videoMode = false) {
  log('Finding prompt input...');
  const inputEl = await waitFor(findPromptInput, 8000);
  if (!inputEl) throw new Error('Prompt input not found.');

  const urlBefore = window.location.href;

  // ── STEP 1: Drag-drop image into prompt box FIRST ───────────────────────
  if (imageData) {
    log('📎 STEP 1: Dropping image into prompt box...');
    try {
      const imageFile = base64ToFile(imageData, imageName || 'reference.png', imageMimeType || 'image/png');
      const injected = await injectImageToPromptBox(inputEl, imageFile);

      if (injected) {
        log('✓ Image dropped into prompt box');
      } else {
        log('⚠ Image drop may have failed — continuing with prompt only');
      }

      // ── STEP 2: Wait for image to upload ──────────────────────────────
      log('📎 STEP 2: Waiting for image upload to complete...');
      const uploaded = await waitForImageUpload(15000);
      if (uploaded) {
        log('✓ Image upload detected');
      } else {
        log('⚠ Could not confirm image upload — continuing anyway');
      }

      // Check if Flow redirected (bad — means wrong upload method triggered)
      if (window.location.href !== urlBefore) {
        log('⚠ Flow navigated! URL: ' + window.location.href);
        throw new Error('Flow redirected after image drop. Image might have triggered wrong handler.');
      }

      await sleep(500);
    } catch (e) {
      log('⚠ Image error: ' + e.message + ' — continuing with prompt only');
    }
  }

  // ── STEP 3: Type prompt text AFTER image ────────────────────────────────
  log('STEP 3: Typing prompt text...');
  // Re-find editor in case DOM changed after image upload
  const editorEl = findPromptInput() || inputEl;
  await slateType(editorEl, prompt);
  await sleep(600);

  // Verify text
  const visible = editorEl.textContent?.replace(/\u200B/g, '').trim();
  log('Visible text: "' + visible + '"');

  if (!visible || visible === 'What do you want to create?') {
    log('Text not set — retrying...');
    await slateType(editorEl, prompt);
    await sleep(600);
  }

  // ── STEP 4: Click send ──────────────────────────────────────────────────
  log('STEP 4: Finding send button...');
  const sendBtn = await waitFor(findSendButton, 5000);
  if (!sendBtn) throw new Error('Send button not found.');

  log('Clicking send...');
  const snapshot = captureCurrentMedia();
  sendBtn.click();

  log('Waiting for generated output...');
  const mediaEl = await waitForNewMedia(snapshot, 120000, videoMode);
  if (!mediaEl) throw new Error('No new image/video appeared after 120s.');

  await sleep(1500);
  let url = getMediaUrl(mediaEl);
  if (!url) throw new Error('Media found but URL is empty.');

  // Use Google Flow's native 2K upscale if enabled (skip videos)
  let ext = getExt(url, mediaEl);
  let googleHandled = false;

  if (videoMode) {
    if (upscale) {
      log('Clicking Flow\'s video 1080p Upscaled button...');
      try {
        const upscaledUrl = await clickFlowVideoDownload(mediaEl, '1080p');
        if (upscaledUrl === '__GOOGLE_HANDLED__') {
          log('Video download handled by Google Flow directly (1080p Upscaled).');
          googleHandled = true;
        } else {
          log('1080p Upscaled download failed, downloading original.');
        }
      } catch (e) {
        log('Video upscale failed, downloading original: ' + e.message);
      }
    } else {
      log('Clicking Flow\'s video Original Size button...');
      try {
        const originalUrl = await clickFlowVideoDownload(mediaEl, 'Original Size');
        if (originalUrl === '__GOOGLE_HANDLED__') {
          log('Video download handled by Google Flow directly (Original Size).');
          googleHandled = true;
        } else {
          log('Original Size download failed.');
        }
      } catch (e) {
        log('Original Size download failed: ' + e.message);
      }
    }
  } else if (upscale && mediaEl.tagName === 'IMG') {
    log('Clicking Flow\'s native 2K upscale button...');
    try {
      const upscaledUrl = await clickFlowUpscale2K(mediaEl);
      if (upscaledUrl === '__GOOGLE_HANDLED__') {
        log('2K download handled by Google Flow directly. Skipping our download.');
        googleHandled = true;
      } else if (upscaledUrl) {
        url = upscaledUrl;
        ext = getExt(url, mediaEl);
        log('2K upscale complete ✓ (Google AI upscaled)');
      } else {
        log('2K upscale failed, downloading original.');
      }
    } catch (e) {
      log('Upscale failed, downloading original: ' + e.message);
    }
  } else if (upscale && mediaEl.tagName === 'VIDEO') {
    log('Upscale skipped — video files are not supported.');
  }

  if (!googleHandled) {
    const filename = `${prefix}${String(index + 1).padStart(3, '0')}_${Date.now()}.${ext}`;
    log('Saving: ' + filename);
    await downloadMedia(url, filename);
  }
  return { ok: true };
}

// ── Convert base64 data URL to File object ────────────────────────────────────
function base64ToFile(dataUrl, filename, mimeType) {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || mimeType;
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new File([u8arr], filename, { type: mime });
}

// ── Inject image into prompt box via Paste & Drop ────────────────────────────
// The file input approach uploads globally. To attach directly to the prompt,
// we must simulate a paste or drop event directly on the contenteditable editor.
async function injectImageToPromptBox(editorEl, imageFile) {
  
  // ── Strategy 1: Clipboard Paste Event ──
  log('  Strategy 1: Simulating paste event on editor...');
  try {
    editorEl.focus();
    await sleep(200);

    const dt = new DataTransfer();
    dt.items.add(imageFile);
    
    const pasteEvent = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: dt
    });
    
    editorEl.dispatchEvent(pasteEvent);
    await sleep(1500);

    // Give it a moment to process the paste and check if UI updated
    const uploaded = await waitForImageUpload(4000);
    if (uploaded) {
      log('  ✓ Paste strategy succeeded');
      return true;
    }
    log('  Paste strategy didn\'t show immediate UI changes.');
  } catch (e) {
    log('  Paste strategy failed: ' + e.message);
  }

  // ── Strategy 2: Drag and Drop Event ──
  log('  Strategy 2: Simulating drop event on prompt container...');
  try {
    const dropTarget = findPromptBoxContainer(editorEl);
    const rect = dropTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const dtDrop = new DataTransfer();
    dtDrop.items.add(imageFile);

    const baseEvent = { bubbles: true, cancelable: true, dataTransfer: dtDrop, clientX: cx, clientY: cy };

    dropTarget.dispatchEvent(new DragEvent('dragenter', baseEvent));
    await sleep(100);
    dropTarget.dispatchEvent(new DragEvent('dragover', baseEvent));
    await sleep(100);
    dropTarget.dispatchEvent(new DragEvent('drop', baseEvent));
    
    await sleep(1500);
    const uploaded = await waitForImageUpload(4000);
    if (uploaded) {
      log('  ✓ Drop strategy succeeded');
      return true;
    }
  } catch (e) {
    log('  Drop strategy failed: ' + e.message);
  }

  // ── Strategy 3: Global Body Paste ──
  log('  Strategy 3: Global body paste...');
  try {
    const dtBody = new DataTransfer();
    dtBody.items.add(imageFile);
    document.body.dispatchEvent(new ClipboardEvent('paste', {
      bubbles: true, cancelable: true, clipboardData: dtBody
    }));
    
    await sleep(1500);
    const uploaded = await waitForImageUpload(4000);
    if (uploaded) {
      log('  ✓ Global paste strategy succeeded');
      return true;
    }
  } catch (e) {
    log('  Global paste failed: ' + e.message);
  }

  log('  ⚠ All image injection strategies executed. Waiting for fallback confirmation.');
  return false;
}

// ── Find the + button near the prompt area ────────────────────────────────────
function findPlusButton(editorEl) {
  const vh = window.innerHeight;

  // Strategy 1: Look for buttons with "add" material icon text in the bottom area
  const btns = [...document.querySelectorAll('button')]
    .filter(b => b.offsetParent && b.getBoundingClientRect().top > vh * 0.6);

  for (const btn of btns) {
    const text = (btn.textContent || '').trim().toLowerCase();
    // Material icon "add" renders as text "add" or just "+"
    if (text === 'add' || text === '+' || text === 'add_circle' || text === 'add_photo_alternate') {
      return btn;
    }
  }

  // Strategy 2: Look for small buttons near the editor
  const editorRect = editorEl.getBoundingClientRect();
  for (const btn of btns) {
    const r = btn.getBoundingClientRect();
    // Button should be near the bottom-left of the editor, small
    if (Math.abs(r.bottom - editorRect.bottom) < 60 && r.width < 60 && r.height < 60) {
      const text = (btn.textContent || '').trim();
      if (text.length <= 5) { // Short text = likely an icon button
        return btn;
      }
    }
  }

  // Strategy 3: Look for the first small button to the left of the editor
  for (const btn of btns) {
    const r = btn.getBoundingClientRect();
    if (r.right < editorRect.left + 60 && r.width < 50) {
      return btn;
    }
  }

  return null;
}

// ── Find the prompt box container ─────────────────────────────────────────────
function findPromptBoxContainer(editorEl) {
  let el = editorEl;

  // Walk up the DOM to find the prompt area wrapper
  for (let i = 0; i < 8; i++) {
    if (!el.parentElement || el.parentElement === document.body) break;
    el = el.parentElement;

    // Check if this element contains a file input (good sign it's the right container)
    if (el.querySelector('input[type="file"]')) {
      log('  Found container with file input at level ' + (i + 1));
      return el;
    }

    // Also check for known patterns
    const cls = (el.className || '').toLowerCase();
    if (cls.includes('prompt') || cls.includes('composer') || cls.includes('input-area')) {
      return el;
    }
  }

  // Fallback: go 5 levels up (to capture the full prompt bar area)
  let container = editorEl;
  for (let i = 0; i < 5; i++) {
    if (container.parentElement && container.parentElement !== document.body) {
      container = container.parentElement;
    }
  }
  return container;
}

// ── Wait for image upload to complete ─────────────────────────────────────────
async function waitForImageUpload(timeout = 15000) {
  const t0 = Date.now();

  // Snapshot current state
  const initialImgCount = document.querySelectorAll('img').length;
  const initialChipCount = document.querySelectorAll('[class*="chip"], [class*="thumb"], [class*="preview"], [class*="attach"]').length;

  while (Date.now() - t0 < timeout) {
    await sleep(500);

    // Check if URL changed (redirect = bad)
    if (window.location.href.includes('/trash') || window.location.href.includes('/delete')) {
      log('  ⚠ Detected redirect to trash/delete — aborting wait');
      return false;
    }

    // Check 1: New images appeared
    const currentImgCount = document.querySelectorAll('img').length;
    if (currentImgCount > initialImgCount) {
      log('  Upload indicator: new image element appeared');
      await sleep(500); // Let it settle
      return true;
    }

    // Check 2: New chip/thumbnail/preview elements
    const currentChipCount = document.querySelectorAll('[class*="chip"], [class*="thumb"], [class*="preview"], [class*="attach"]').length;
    if (currentChipCount > initialChipCount) {
      log('  Upload indicator: new chip/preview element appeared');
      await sleep(500);
      return true;
    }

    // Check 3: Spinner appeared
    const spinners = document.querySelectorAll('[class*="loading"], [class*="spinner"], [class*="progress"], [role="progressbar"]');
    if (spinners.length > 0) {
      log('  Upload indicator: spinner detected — waiting...');
      await waitUntil(() => {
        return document.querySelectorAll('[class*="loading"], [class*="spinner"], [class*="progress"], [role="progressbar"]').length === 0;
      }, timeout - (Date.now() - t0));
      await sleep(500);
      return true;
    }

    // Check 4: Near-editor thumbnail
    const editorArea = document.querySelector('[contenteditable="true"]');
    if (editorArea) {
      const parent = editorArea.parentElement?.parentElement?.parentElement;
      if (parent) {
        const nearbyImgs = parent.querySelectorAll('img');
        for (const img of nearbyImgs) {
          const r = img.getBoundingClientRect();
          if (r.width > 30 && r.width < 300 && r.height > 30) {
            log('  Upload indicator: image thumbnail near editor');
            return true;
          }
        }
      }
    }
  }

  return false;
}
// ── Check if an image was successfully attached ──────────────────────────────
function checkImageAttached() {
  // Look for signs that an image chip/thumbnail appeared in the editor area
  const vh = window.innerHeight;

  // Check for image thumbnails / chips in the bottom portion of the page
  const chips = document.querySelectorAll('[class*="chip"], [class*="thumbnail"], [class*="preview"], [class*="attachment"]');
  for (const chip of chips) {
    const r = chip.getBoundingClientRect();
    if (r.top > vh * 0.4 && r.width > 20 && r.height > 20 && chip.offsetParent) {
      return true;
    }
  }

  // Check for small images near the editor that appeared recently
  const editorArea = document.querySelector('[contenteditable="true"]');
  if (editorArea) {
    const parent = editorArea.closest('[class*="editor"]') || editorArea.parentElement?.parentElement;
    if (parent) {
      const imgs = parent.querySelectorAll('img');
      for (const img of imgs) {
        const r = img.getBoundingClientRect();
        if (r.width > 20 && r.width < 200 && r.height > 20) return true;
      }
    }
  }

  return false;
}

// ── Type into Slate.js using DataTransfer paste (the only reliable method) ────
async function slateType(el, text) {
  el.click();
  await sleep(150);
  el.focus();
  await sleep(150);

  // Step 1: Select all existing content
  document.execCommand('selectAll', false, null);
  await sleep(100);

  // Step 2: Use DataTransfer to paste — Slate.js intercepts 'paste' events
  // and reads from clipboardData, updating its own internal state correctly
  const dt = new DataTransfer();
  dt.setData('text/plain', text);

  const pasteEvent = new ClipboardEvent('paste', {
    bubbles: true,
    cancelable: true,
    clipboardData: dt
  });

  el.dispatchEvent(pasteEvent);
  await sleep(300);

  // Step 3: If paste didn't work (some browsers block it), fallback to
  // simulating individual key insertions via Input Events with proper inputType
  const after = el.textContent?.replace(/\u200B/g, '').trim();
  if (!after || after === 'What do you want to create?') {
    log('Paste event fallback — using insertText InputEvents...');

    // Clear first
    document.execCommand('selectAll', false, null);
    el.dispatchEvent(new InputEvent('beforeinput', {
      bubbles: true, cancelable: true,
      inputType: 'deleteContentBackward'
    }));
    document.execCommand('delete', false, null);
    await sleep(100);

    // Insert via beforeinput + input events (Slate.js handles these natively)
    el.dispatchEvent(new InputEvent('beforeinput', {
      bubbles: true, cancelable: true,
      inputType: 'insertText',
      data: text
    }));
    document.execCommand('insertText', false, text);
    el.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      inputType: 'insertText',
      data: text
    }));
    await sleep(200);
  }

  // Step 4: Final check — if STILL empty, use the nuclear option
  const final = el.textContent?.replace(/\u200B/g, '').trim();
  if (!final || final === 'What do you want to create?') {
    log('Nuclear fallback — direct Slate state injection...');
    await nuclearFallback(el, text);
  }

  await sleep(200);
  log('Final text in editor: "' + el.textContent?.replace(/\u200B/g, '').substring(0, 60) + '"');
}

// ── Nuclear fallback: simulate real keyboard typing ───────────────────────────
async function nuclearFallback(el, text) {
  // Focus and select all
  el.focus();
  document.execCommand('selectAll', false, null);

  // Fire beforeinput deleteContentBackward to clear
  el.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'deleteContentBackward' }));
  document.execCommand('delete', false, null);
  await sleep(50);

  // Type one character at a time with full event chain
  for (const char of text) {
    const keyOpts = { key: char, code: 'Key' + char.toUpperCase(), bubbles: true, cancelable: true };
    el.dispatchEvent(new KeyboardEvent('keydown', keyOpts));
    el.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: char }));
    document.execCommand('insertText', false, char);
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: char }));
    el.dispatchEvent(new KeyboardEvent('keyup', keyOpts));
    await sleep(8);
  }
}

// ── Find prompt input ─────────────────────────────────────────────────────────
function findPromptInput() {
  for (const el of document.querySelectorAll('[contenteditable="true"]')) {
    if (el.className?.includes('sc-a8ba1f43')) return el;
  }
  for (const el of document.querySelectorAll('div[role="textbox"][contenteditable="true"]')) {
    const r = el.getBoundingClientRect();
    if (r.top > window.innerHeight * 0.5 && r.width > 100) return el;
  }
  return null;
}

// ── Find send button ──────────────────────────────────────────────────────────
function findSendButton() {
  // Confirmed class from DOM inspection
  for (const btn of document.querySelectorAll('button')) {
    if (btn.className?.includes('sc-26b30722') && btn.offsetParent && !btn.disabled) return btn;
  }
  // Fallback: rightmost small button in bottom bar
  const vh = window.innerHeight;
  const btns = [...document.querySelectorAll('button')]
    .filter(b => {
      if (!b.offsetParent || b.disabled) return false;
      const r = b.getBoundingClientRect();
      return r.top > vh * 0.8 && r.width < 60;
    })
    .sort((a, b) => b.getBoundingClientRect().left - a.getBoundingClientRect().left);
  return btns[0] || null;
}

// ── Media helpers ─────────────────────────────────────────────────────────────

function getMediaUrl(mediaEl) {
  if (mediaEl.tagName === 'VIDEO') {
    const src = mediaEl.querySelector('source')?.src || mediaEl.src;
    return src;
  }
  return mediaEl.src;
}

function getExt(url, mediaEl) {
  if (mediaEl.tagName === 'VIDEO') return 'mp4';
  if (url.includes('.png')) return 'png';
  if (url.includes('.webp')) return 'webp';
  return 'jpeg';
}

function looksGenerated(src) {
  if (!src) return false;
  if (src.startsWith('blob:')) return true;
  if (src.includes('lh3.googleusercontent')) return true;
  if (src.includes('generativelanguage.googleapis')) return true;
  if (src.includes('aisandbox') || src.includes('labs.google')) return true;
  if (/\/(icon|logo|avatar|favicon|gstatic)/i.test(src)) return false;
  return src.length > 80;
}

function getBaseId(url) {
  if (!url) return '';
  if (url.startsWith('blob:')) return url;
  const eqIdx = url.indexOf('=');
  if (eqIdx !== -1 && (url.includes('googleusercontent') || url.includes('googleapis'))) {
    return url.substring(0, eqIdx);
  }
  return url;
}

function captureCurrentMedia() {
  const imgs = [...document.querySelectorAll('img')].filter(i => looksGenerated(i.src));
  const vids = [...document.querySelectorAll('video')].filter(v => looksGenerated(v.src || v.querySelector('source')?.src));
  const current = new Set();
  imgs.forEach(i => current.add(getBaseId(i.src)));
  vids.forEach(v => current.add(getBaseId(v.src || v.querySelector('source')?.src)));
  return current;
}

function downloadMedia(url, filename) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'download', url, filename }, () => {
      resolve();
    });
  });
}

function waitForNewMedia(snapshot, timeout = 120000, videoMode = false) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const iv = setInterval(() => {
      // Check for videos first
      const vids = [...document.querySelectorAll('video')].filter(v => v.offsetParent && looksGenerated(v.src || v.querySelector('source')?.src));
      for (const v of vids) {
        const src = v.src || v.querySelector('source')?.src;
        if (!snapshot.has(getBaseId(src)) && findMoreButtonForMedia(v)) {
          clearInterval(iv);
          log('New video detected (with ⋮ button)!');
          resolve(v);
          return;
        }
      }

      // Detect the thumbnail image for both videos and images
      const imgs = [...document.querySelectorAll('img')].filter(i => {
        if (!looksGenerated(i.src) || !i.offsetParent) return false;
        // Ignore small thumbnails (e.g. the reference image chip)
        const rect = i.getBoundingClientRect();
        if (rect.width < 150 || rect.height < 150) return false;
        return true;
      });

      for (const i of imgs) {
        if (!snapshot.has(getBaseId(i.src)) && findMoreButtonForMedia(i)) {
          clearInterval(iv);
          log('New media detected (with ⋮ button)!');
          resolve(i);
          return;
        }
      }

      if (Date.now() - t0 > timeout) {
        clearInterval(iv);
        resolve(null);
      }
    }, 1000);
  });
}

function waitFor(fn, ms = 5000, iv = 200) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const tick = () => {
      const r = fn(); if (r) { resolve(r); return; }
      if (Date.now() - t0 > ms) { resolve(null); return; }
      setTimeout(tick, iv);
    };
    tick();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function log(m) { console.log('[FlowExt v6]', m); }

// ── Google Flow Native 2K Upscale ─────────────────────────────────────────────
// Problem: The global "Download" button in the header downloads a ZIP.
// Solution: Find the ⋮ button that belongs EXACTLY to the newly generated media.
// Flow: Find card's ⋮ → click → focus "Download" → ArrowRight → focus "2K" → Enter

async function clickFlowUpscale2K(mediaEl) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    log(`=== 2K Upscale Attempt ${attempt}/2 ===`);
    
    // Method 1: Try Right-Click
    let result = await attempt2KViaContextMenu(mediaEl);
    if (result) return result;
    
    // Cleanup
    pressEscape(3);
    await sleep(1000);

    // Method 2: Try ⋮ (More) button
    result = await attempt2KViaMoreButton(mediaEl);
    if (result) return result;

    if (attempt < 2) {
      log('Retrying in 3s...');
      pressEscape(5);
      await sleep(3000);
    }
  }
  log('All 2K upscale attempts failed.');
  return null;
}

async function attempt2KViaContextMenu(mediaEl) {
  log('--- Attempting via Right-Click ---');
  const popupsBefore = document.querySelectorAll('[data-radix-menu-content], [data-radix-popper-content-wrapper]').length;
  
  const rect = mediaEl.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  
  mediaEl.dispatchEvent(new MouseEvent('contextmenu', {
    bubbles: true, cancelable: true, view: window, button: 2, buttons: 2, clientX: x, clientY: y
  }));
  
  const menuAppeared = await waitUntil(() => {
    return document.querySelectorAll('[data-radix-menu-content], [data-radix-popper-content-wrapper]').length > popupsBefore;
  }, 3000);

  if (!menuAppeared) {
    log('Right-click menu failed to open.');
    return null;
  }
  
  log('Right-click menu opened ✓');
  await sleep(500);
  return await openDownloadAndClick2K();
}

async function attempt2KViaMoreButton(mediaEl) {
  log('--- Attempting via ⋮ (More) button ---');
  const moreBtn = findMoreButtonForMedia(mediaEl);
  if (!moreBtn) {
    log('⋮ button not found for this image.');
    return null;
  }

  const popupsBefore = document.querySelectorAll('[data-radix-menu-content], [data-radix-popper-content-wrapper]').length;
  moreBtn.click();
  
  const menuAppeared = await waitUntil(() => {
    return document.querySelectorAll('[data-radix-menu-content], [data-radix-popper-content-wrapper]').length > popupsBefore;
  }, 3000);

  if (!menuAppeared) {
    log('Popup failed to open after clicking ⋮');
    return null;
  }
  
  log('⋮ menu opened ✓');
  await sleep(500);
  return await openDownloadAndClick2K();
}

async function openDownloadAndClick2K() {
  // ── STEP 2: Focus "Download" item ──
  log('Finding "Download" item in popup...');
  
  // First check if 2K is directly visible
  const quick2k = searchAllPopups('2K');
  if (quick2k) {
    log('Found 2K directly in popup!');
    quick2k.click();
    await sleep(5000);
    pressEscape(3);
    return '__GOOGLE_HANDLED__';
  }

  const downloadItem = searchAllPopups('download');
  if (!downloadItem) {
    log('FAIL: "Download" not found in popup.');
    dumpPopups();
    pressEscape(3);
    return null;
  }
  
  log('Found "Download". Trying to open its submenu...');
  downloadItem.focus();
  await sleep(100);

  // ── STEP 3: Aggressively try to open the submenu ──
  const menusBefore = document.querySelectorAll('[data-radix-menu-content]').length;
  
  // Method 1: ArrowRight (Radix UI native)
  sendKey(downloadItem, 'ArrowRight');
  await sleep(1000);

  // Method 2: Hover Events
  if (document.querySelectorAll('[data-radix-menu-content]').length <= menusBefore) {
    log('  ArrowRight didn\'t open submenu. Trying hover events...');
    downloadItem.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    downloadItem.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }));
    downloadItem.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    await sleep(1000);
  }

  // Method 3: Direct Click
  if (document.querySelectorAll('[data-radix-menu-content]').length <= menusBefore) {
    log('  Hover didn\'t open submenu. Trying direct click()...');
    downloadItem.click();
    await sleep(1000);
  }

  // ── STEP 4: Focus and Click "2K" ──
  log('Finding "2K" in submenu...');
  const btn2k = searchAllPopups('2K');
  if (!btn2k) {
    log('FAIL: Could not find "2K" in submenu.');
    dumpPopups();
    pressEscape(3);
    return null;
  }

  log('Found "2K". Clicking it...');
  btn2k.focus();
  await sleep(100);
  
  // Try both keyboard and direct click
  sendKey(btn2k, 'Enter');
  await sleep(200);
  btn2k.click();

  log('2K upscale button clicked successfully ✓ Waiting for Google Flow to process...');
  
  // Wait extra time for the 2K download/upscale to register
  await sleep(5000);
  pressEscape(3);

  return '__GOOGLE_HANDLED__';
}

// ── Find the closest ⋮ button relative to the media element ───────────────────
function findMoreButtonForMedia(mediaEl) {
  if (!mediaEl) return null;
  let el = mediaEl.parentElement;
  
  // Traverse up to find the card container
  while (el && el !== document.body) {
    const btns = el.querySelectorAll('button');
    let found = null;
    
    for (const btn of btns) {
      if (!btn.offsetParent) continue;
      const text = btn.textContent?.replace(/\s+/g, ' ').trim() || '';
      
      // Look for the "more_vert" icon text
      if (text.includes('more_vert')) {
        found = btn;
        break;
      }
    }
    
    if (found) {
      log(`  Found ⋮ button in card container <${el.tagName}>`);
      return found;
    }
    el = el.parentElement;
  }
  return null;
}

// ── Send a keyboard event to a specific target ────────────────────────────────
function sendKey(target, key) {
  const opts = { key, code: key, bubbles: true, cancelable: true, composed: true };
  target.dispatchEvent(new KeyboardEvent('keydown', opts));
  target.dispatchEvent(new KeyboardEvent('keypress', opts));
  target.dispatchEvent(new KeyboardEvent('keyup', opts));
}

// ── Wait until a condition is true ────────────────────────────────────────────
function waitUntil(fn, timeout = 5000) {
  return new Promise(resolve => {
    if (fn()) { resolve(true); return; }
    const t0 = Date.now();
    const check = () => {
      if (fn()) { resolve(true); return; }
      if (Date.now() - t0 > timeout) { resolve(false); return; }
      setTimeout(check, 200);
    };
    setTimeout(check, 200);
  });
}

// ── Press Escape to close popups ──────────────────────────────────────────────
function pressEscape(times = 3) {
  for (let i = 0; i < times; i++) {
    sendKey(document.activeElement || document.body, 'Escape');
  }
  document.body.click();
}

// ── Search all Radix popups for an element with matching text ─────────────────
function searchAllPopups(keyword) {
  const is2K = keyword === '2K';
  const containers = document.querySelectorAll('[data-radix-popper-content-wrapper], [data-radix-menu-content]');

  for (const container of containers) {
    const els = container.querySelectorAll('*');
    for (const el of els) {
      if (el.children.length > 4) continue;
      const text = el.textContent?.replace(/\s+/g, ' ').trim();
      if (!text || text.length > 40) continue;

      if (is2K && /2K/i.test(text) && !/4K/i.test(text) && text.length < 25) {
        const target = el.closest('button') || el.closest('[role="menuitem"]') || el.closest('[data-radix-collection-item]') || el;
        log(`  Found "2K" in popup: <${target.tagName}> "${text}"`);
        return target;
      } else if (!is2K && new RegExp(keyword, 'i').test(text)) {
        const target = el.closest('button') || el.closest('[role="menuitem"]') || el.closest('[data-radix-collection-item]') || el;
        if (target !== container && (target.offsetParent || target.getBoundingClientRect().width > 0)) {
          log(`  Found "${keyword}" in popup: <${target.tagName}> "${text}"`);
          return target;
        }
      }
    }
  }
  return null;
}

// ── Debug helpers ─────────────────────────────────────────────────────────────

function dumpPopups() {
  const popups = document.querySelectorAll('[data-radix-popper-content-wrapper], [data-radix-menu-content]');
  log(`DEBUG: ${popups.length} popups`);
  popups.forEach((p, pi) => {
    const els = [...p.querySelectorAll('*')].filter(e => e.children.length <= 3);
    log(`  Popup[${pi}]: ${els.length} leaf elements`);
    els.forEach((el, i) => {
      const text = el.textContent?.replace(/\s+/g, ' ').trim();
      if (text && text.length > 0 && text.length < 40) log(`    [${i}] <${el.tagName}> "${text}"`);
    });
  });
}

// ── Video Download Handlers ──────────────────────────────────────────────────
async function clickFlowVideoDownload(mediaEl, targetText) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    log(`=== Video ${targetText} Attempt ${attempt}/2 ===`);
    
    let result = await attemptVideoDownloadViaContextMenu(mediaEl, targetText);
    if (result) return result;
    
    pressEscape(3);
    await sleep(1000);

    result = await attemptVideoDownloadViaMoreButton(mediaEl, targetText);
    if (result) return result;

    if (attempt < 2) {
      log('Retrying in 3s...');
      pressEscape(5);
      await sleep(3000);
    }
  }
  log(`All video ${targetText} attempts failed.`);
  return null;
}

async function attemptVideoDownloadViaContextMenu(mediaEl, targetText) {
  log('--- Attempting via Right-Click ---');
  const popupsBefore = document.querySelectorAll('[data-radix-menu-content], [data-radix-popper-content-wrapper]').length;
  
  const rect = mediaEl.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  
  mediaEl.dispatchEvent(new MouseEvent('contextmenu', {
    bubbles: true, cancelable: true, view: window, button: 2, buttons: 2, clientX: x, clientY: y
  }));
  
  const menuAppeared = await waitUntil(() => {
    return document.querySelectorAll('[data-radix-menu-content], [data-radix-popper-content-wrapper]').length > popupsBefore;
  }, 3000);

  if (!menuAppeared) {
    log('Right-click menu failed to open.');
    return null;
  }
  
  log('Right-click menu opened ✓');
  await sleep(500);
  return await openDownloadAndClickTarget(targetText);
}

async function attemptVideoDownloadViaMoreButton(mediaEl, targetText) {
  log('--- Attempting via ⋮ (More) button ---');
  const moreBtn = findMoreButtonForMedia(mediaEl);
  if (!moreBtn) {
    log('⋮ button not found for this video.');
    return null;
  }

  const popupsBefore = document.querySelectorAll('[data-radix-menu-content], [data-radix-popper-content-wrapper]').length;
  moreBtn.click();
  
  const menuAppeared = await waitUntil(() => {
    return document.querySelectorAll('[data-radix-menu-content], [data-radix-popper-content-wrapper]').length > popupsBefore;
  }, 3000);

  if (!menuAppeared) {
    log('Popup failed to open after clicking ⋮');
    return null;
  }
  
  log('⋮ menu opened ✓');
  await sleep(500);
  return await openDownloadAndClickTarget(targetText);
}

async function openDownloadAndClickTarget(targetText) {
  log('Finding "Download" item in popup...');
  
  const quickTarget = searchAllPopups(targetText);
  if (quickTarget) {
    log(`Found ${targetText} directly in popup!`);
    quickTarget.click();
    await sleep(5000);
    pressEscape(3);
    return '__GOOGLE_HANDLED__';
  }

  const downloadItem = searchAllPopups('download');
  if (!downloadItem) {
    log('FAIL: "Download" not found in popup.');
    dumpPopups();
    pressEscape(3);
    return null;
  }
  
  log('Found "Download". Trying to open its submenu...');
  downloadItem.focus();
  await sleep(100);

  const menusBefore = document.querySelectorAll('[data-radix-menu-content]').length;
  
  sendKey(downloadItem, 'ArrowRight');
  await sleep(1000);

  if (document.querySelectorAll('[data-radix-menu-content]').length <= menusBefore) {
    log('  ArrowRight didn\'t open submenu. Trying hover events...');
    downloadItem.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
    downloadItem.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }));
    downloadItem.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    await sleep(1000);
  }

  if (document.querySelectorAll('[data-radix-menu-content]').length <= menusBefore) {
    log('  Hover didn\'t open submenu. Trying direct click()...');
    downloadItem.click();
    await sleep(1000);
  }

  log(`Finding "${targetText}" in submenu...`);
  const btnTarget = searchAllPopups(targetText);
  if (!btnTarget) {
    log(`FAIL: Could not find "${targetText}" in submenu.`);
    dumpPopups();
    pressEscape(3);
    return null;
  }

  log(`Found "${targetText}". Clicking it...`);
  btnTarget.focus();
  await sleep(100);
  
  sendKey(btnTarget, 'Enter');
  await sleep(200);
  btnTarget.click();

  log(`${targetText} button clicked successfully ✓ Waiting for Google Flow to process...`);
  
  await sleep(5000);
  pressEscape(3);

  return '__GOOGLE_HANDLED__';
}

log('v6.5 ready — Video Download support added.');
