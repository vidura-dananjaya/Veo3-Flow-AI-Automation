let running = false;
let doneCount = 0;

// ── Selected image state ──────────────────────────────────────────────────────
let selectedImageData = null;   // base64 data URL
let selectedImageName = null;
let selectedImageMime = null;

const statusBox    = document.getElementById('statusBox');
const startBtn     = document.getElementById('startBtn');
const stopBtn      = document.getElementById('stopBtn');
const manualBtn    = document.getElementById('manualBtn');
const doneEl       = document.getElementById('doneCount');
const remEl        = document.getElementById('remCount');
const upscaleCheck = document.getElementById('upscale2k');
const upscaleBadge = document.getElementById('upscaleBadge');
const videoModeCheck = document.getElementById('videoMode');

// Image upload elements
const imageFileInput = document.getElementById('imageFileInput');
const imageDropZone  = document.getElementById('imageDropZone');
const imagePreview   = document.getElementById('imagePreview');
const imageThumb     = document.getElementById('imageThumb');
const imageNameEl    = document.getElementById('imageName');
const imageSizeEl    = document.getElementById('imageSize');
const removeImageBtn = document.getElementById('removeImageBtn');
const imageBadge     = document.getElementById('imageBadge');
const imageHint      = document.querySelector('.image-upload-hint');

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB

// Load saved preferences
chrome.storage.local.get(['upscale2k', 'videoMode'], (result) => {
  if (result.upscale2k) {
    upscaleCheck.checked = true;
    upscaleBadge.classList.add('active');
  }
  if (result.videoMode) {
    videoModeCheck.checked = true;
  }
});

// Save upscale preference on change
upscaleCheck.addEventListener('change', () => {
  chrome.storage.local.set({ upscale2k: upscaleCheck.checked });
  upscaleBadge.classList.toggle('active', upscaleCheck.checked);
});

// Save video mode preference on change
videoModeCheck.addEventListener('change', () => {
  chrome.storage.local.set({ videoMode: videoModeCheck.checked });
});

// ── Image upload handlers ─────────────────────────────────────────────────────

// Click on dropzone → open file picker
imageDropZone.addEventListener('click', () => {
  imageFileInput.click();
});

// File input change
imageFileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files[0]) {
    handleImageFile(e.target.files[0]);
  }
});

// Drag-and-drop
imageDropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.stopPropagation();
  imageDropZone.classList.add('drag-over');
});

imageDropZone.addEventListener('dragleave', (e) => {
  e.preventDefault();
  e.stopPropagation();
  imageDropZone.classList.remove('drag-over');
});

imageDropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  e.stopPropagation();
  imageDropZone.classList.remove('drag-over');
  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
    const file = e.dataTransfer.files[0];
    if (file.type.startsWith('image/')) {
      handleImageFile(file);
    } else {
      log('Only image files are supported.', 'err');
    }
  }
});

// Remove image
removeImageBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  clearImage();
});

function handleImageFile(file) {
  // Validate type
  const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    log('Unsupported format. Use PNG, JPG, or WebP.', 'err');
    return;
  }

  // Validate size
  if (file.size > MAX_IMAGE_SIZE) {
    log(`Image too large (${formatFileSize(file.size)}). Max 10 MB.`, 'err');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    selectedImageData = e.target.result;  // base64 data URL
    selectedImageName = file.name;
    selectedImageMime = file.type;

    // Show preview
    imageThumb.src = selectedImageData;
    imageNameEl.textContent = file.name;
    imageSizeEl.textContent = formatFileSize(file.size);
    imagePreview.classList.add('visible');
    imageDropZone.style.display = 'none';
    if (imageHint) imageHint.style.display = 'none';
    imageBadge.classList.add('active');

    log(`📎 Image attached: ${file.name}`, 'ok');
  };
  reader.readAsDataURL(file);
}

function clearImage() {
  selectedImageData = null;
  selectedImageName = null;
  selectedImageMime = null;
  imageFileInput.value = '';
  imageThumb.src = '';
  imagePreview.classList.remove('visible');
  imageDropZone.style.display = '';
  if (imageHint) imageHint.style.display = '';
  imageBadge.classList.remove('active');
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ── Logging ───────────────────────────────────────────────────────────────────

function log(msg, type = 'line') {
  const d = document.createElement('div');
  d.className = `log-${type}`;
  d.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  statusBox.appendChild(d);
  statusBox.scrollTop = statusBox.scrollHeight;
  if (statusBox.children.length > 50) statusBox.removeChild(statusBox.firstChild);
}

// ── Tab & content script helpers ──────────────────────────────────────────────

async function getFlowTab() {
  const tabs = await chrome.tabs.query({ url: 'https://labs.google/*' });
  if (!tabs.length) {
    log('No Google Labs tab found! Open your Flow project first.', 'err');
    return null;
  }
  return tabs[0];
}

async function ensureContentScript(tab) {
  // Try pinging first
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tab.id, { action: 'ping' }, (response) => {
      if (chrome.runtime.lastError || !response?.ok) {
        // Inject content script manually
        chrome.scripting.executeScript(
          { target: { tabId: tab.id }, files: ['content.js'] },
          () => {
            if (chrome.runtime.lastError) {
              log('Could not inject content script: ' + chrome.runtime.lastError.message, 'err');
              resolve(false);
            } else {
              log('Content script injected.', 'info');
              resolve(true);
            }
          }
        );
      } else {
        resolve(true);
      }
    });
  });
}

// ── Core generation logic ─────────────────────────────────────────────────────

async function injectAndRun(tab, prompt, prefix, index) {
  const ready = await ensureContentScript(tab);
  if (!ready) return false;

  let finalPrompt = prompt;
  if (videoModeCheck && videoModeCheck.checked) {
    if (!finalPrompt.toLowerCase().startsWith('generate a video:')) {
      finalPrompt = 'Generate a video: ' + finalPrompt;
    }
  } else {
    if (!finalPrompt.toLowerCase().startsWith('generate a image:')) {
      finalPrompt = 'Generate a image: ' + finalPrompt;
    }
  }

  return new Promise((resolve) => {
    const message = {
      action: 'injectPrompt',
      prompt: finalPrompt,
      prefix,
      index,
      upscale: upscaleCheck.checked,
      videoMode: videoModeCheck ? videoModeCheck.checked : false,
      imageData: selectedImageData || null,
      imageMimeType: selectedImageMime || null,
      imageName: selectedImageName || null
    };

    chrome.tabs.sendMessage(tab.id, message, (response) => {
      if (chrome.runtime.lastError) {
        log('Message error: ' + chrome.runtime.lastError.message, 'err');
        resolve(false);
      } else if (response && response.ok) {
        log(`✓ Generated #${index + 1} — saved to Downloads/FlowGen/`, 'ok');
        resolve(true);
      } else {
        log(`✗ Failed: ${response?.error || 'unknown error'}`, 'err');
        resolve(false);
      }
    });
  });
}

// ── Button handlers ───────────────────────────────────────────────────────────

startBtn.addEventListener('click', async () => {
  const prompt = document.getElementById('prompt').value.trim();
  const count  = parseInt(document.getElementById('count').value) || 1;
  const delay  = parseInt(document.getElementById('delay').value) || 30;
  const prefix = document.getElementById('prefix').value.trim() || 'flow_';

  if (!prompt) { log('Enter a prompt first!', 'err'); return; }

  const tab = await getFlowTab();
  if (!tab) return;

  running = true;
  doneCount = 0;
  doneEl.textContent = 0;
  startBtn.disabled = true;
  const imgInfo = selectedImageData ? ' + 📎 image' : '';
  log(`Starting ${count} generation(s) · ${delay}s apart${imgInfo}`, 'info');

  for (let i = 0; i < count; i++) {
    if (!running) { log('Stopped.', 'line'); break; }

    remEl.textContent = count - i;
    log(`Generation ${i + 1} of ${count}…`, 'info');

    const ok = await injectAndRun(tab, prompt, prefix, i);
    if (ok) { doneCount++; doneEl.textContent = doneCount; }

    if (i < count - 1 && running) {
      log(`Waiting ${delay}s…`, 'line');
      await sleep(delay * 1000);
    }
  }

  running = false;
  startBtn.disabled = false;
  remEl.textContent = '—';
  log('All done!', 'ok');
});

stopBtn.addEventListener('click', () => {
  running = false;
  startBtn.disabled = false;
  log('Stopped by user.', 'line');
});

manualBtn.addEventListener('click', async () => {
  const prompt = document.getElementById('prompt').value.trim();
  const prefix = document.getElementById('prefix').value.trim() || 'flow_';
  if (!prompt) { log('Enter a prompt first!', 'err'); return; }

  const tab = await getFlowTab();
  if (!tab) return;

  const imgInfo = selectedImageData ? ' + 📎 image' : '';
  log('Running once…' + imgInfo, 'info');
  const ok = await injectAndRun(tab, prompt, prefix, doneCount);
  if (ok) { doneCount++; doneEl.textContent = doneCount; }
});

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Debug inspect button (add dynamically)
const inspectBtn = document.createElement('button');
inspectBtn.textContent = '🔍 Inspect Page';
inspectBtn.style.cssText = 'width:100%;margin-top:6px;padding:8px;background:#1e1e2e;border:1px solid #2a2a3e;border-radius:6px;color:#888;font-family:monospace;font-size:10px;cursor:pointer;letter-spacing:1px;';
inspectBtn.addEventListener('click', async () => {
  const tab = await getFlowTab();
  if (!tab) return;
  await ensureContentScript(tab);
  chrome.tabs.sendMessage(tab.id, { action: 'inspect' }, (res) => {
    if (!res) { log('No response — reload the Flow tab.', 'err'); return; }
    log(`URL: ${res.url.substring(0, 60)}`, 'info');
    log(`Edit page: ${res.isEditPage} | Input: ${res.inputFound} (${res.inputTag})`, res.isEditPage && res.inputFound ? 'ok' : 'err');
    log(`Button: ${res.buttonFound} → "${res.buttonText}"`, res.buttonFound ? 'ok' : 'err');
  });
});
document.querySelector('.btn-group').after(inspectBtn);
