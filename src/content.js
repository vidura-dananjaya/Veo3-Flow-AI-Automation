// ===================================================
// Google Flow Auto Generator — Content Script v6
// Fix: Slate.js needs DataTransfer paste to register text in React state
// ===================================================

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'injectPrompt') {
    handleGenerate(msg.prompt, msg.prefix, msg.index, msg.upscale)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }
  if (msg.action === 'ping') {
    sendResponse({ ok: true });
    return true;
  }
});

async function handleGenerate(prompt, prefix, index, upscale = false) {
  log('Finding prompt input...');
  const inputEl = await waitFor(findPromptInput, 8000);
  if (!inputEl) throw new Error('Prompt input not found.');

  log('Clearing and pasting text via DataTransfer...');
  await slateType(inputEl, prompt);
  await sleep(600);

  // Verify Slate internal state has text
  const visible = inputEl.textContent?.replace(/\u200B/g, '').trim();
  log('Visible text: "' + visible + '"');

  log('Finding send button...');
  const sendBtn = await waitFor(findSendButton, 5000);
  if (!sendBtn) throw new Error('Send button not found.');

  log('Clicking send...');
  const snapshot = captureCurrentMedia();
  sendBtn.click();

  log('Waiting for generated output...');
  const mediaEl = await waitForNewMedia(snapshot, 120000);
  if (!mediaEl) throw new Error('No new image/video appeared after 120s.');

  await sleep(1500);
  let url = getMediaUrl(mediaEl);
  if (!url) throw new Error('Media found but URL is empty.');

  // Use Google Flow's native 2K upscale if enabled (skip videos)
  let ext = getExt(url, mediaEl);
  let googleHandled = false;
  if (upscale && mediaEl.tagName === 'IMG') {
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

function captureCurrentMedia() {
  const imgs = [...document.querySelectorAll('img')].filter(i => looksGenerated(i.src));
  const vids = [...document.querySelectorAll('video')].filter(v => looksGenerated(v.src || v.querySelector('source')?.src));
  const current = new Set();
  imgs.forEach(i => current.add(i.src));
  vids.forEach(v => current.add(v.src || v.querySelector('source')?.src));
  return current;
}

function downloadMedia(url, filename) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'download', url, filename }, () => {
      resolve();
    });
  });
}

function waitForNewMedia(snapshot, timeout = 120000) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const iv = setInterval(() => {
      const imgs = [...document.querySelectorAll('img')].filter(i => looksGenerated(i.src) && i.offsetParent);
      for (const i of imgs) {
        if (!snapshot.has(i.src)) {
          clearInterval(iv);
          log('New media detected!');
          resolve(i);
          return;
        }
      }

      const vids = [...document.querySelectorAll('video')].filter(v => v.offsetParent && looksGenerated(v.src || v.querySelector('source')?.src));
      for (const v of vids) {
        const src = v.src || v.querySelector('source')?.src;
        if (!snapshot.has(src)) {
          clearInterval(iv);
          log('New video detected!');
          resolve(v);
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

log('v6 ready — Slate.js DataTransfer paste. 2K upscale via keyboard navigation.');
