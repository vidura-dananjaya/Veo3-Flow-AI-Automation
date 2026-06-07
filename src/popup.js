let running = false;
let doneCount = 0;

const statusBox    = document.getElementById('statusBox');
const startBtn     = document.getElementById('startBtn');
const stopBtn      = document.getElementById('stopBtn');
const manualBtn    = document.getElementById('manualBtn');
const doneEl       = document.getElementById('doneCount');
const remEl        = document.getElementById('remCount');
const upscaleCheck = document.getElementById('upscale2k');
const upscaleBadge = document.getElementById('upscaleBadge');

// Load saved upscale preference
chrome.storage.local.get(['upscale2k'], (result) => {
  if (result.upscale2k) {
    upscaleCheck.checked = true;
    upscaleBadge.classList.add('active');
  }
});

// Save upscale preference on change
upscaleCheck.addEventListener('change', () => {
  chrome.storage.local.set({ upscale2k: upscaleCheck.checked });
  upscaleBadge.classList.toggle('active', upscaleCheck.checked);
});

function log(msg, type = 'line') {
  const d = document.createElement('div');
  d.className = `log-${type}`;
  d.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  statusBox.appendChild(d);
  statusBox.scrollTop = statusBox.scrollHeight;
  if (statusBox.children.length > 50) statusBox.removeChild(statusBox.firstChild);
}

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

async function injectAndRun(tab, prompt, prefix, index) {
  const ready = await ensureContentScript(tab);
  if (!ready) return false;

  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tab.id, {
      action: 'injectPrompt',
      prompt,
      prefix,
      index,
      upscale: upscaleCheck.checked
    }, (response) => {
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
  log(`Starting ${count} generation(s) · ${delay}s apart`, 'info');

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

  log('Running once…', 'info');
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
