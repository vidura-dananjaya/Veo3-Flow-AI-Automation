let ws = null;
let reconnectInterval = 2000;
let apiRunning = false;
let apiStopRequested = false;

// Connect to the Python WebSocket Server
function connectWebSocket() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  console.log('[FlowExt] Connecting to WebSocket server...');
  ws = new WebSocket('ws://localhost:3200');

  ws.onopen = () => {
    console.log('[FlowExt] Connected to WebSocket server');
    ws.send(JSON.stringify({ role: 'extension' }));
    reconnectInterval = 2000; // Reset backoff
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'generate') {
        handleApiGenerate(data);
      } else if (data.type === 'stop') {
        apiStopRequested = true;
      }
    } catch (e) {
      console.error('[FlowExt] Message parse error:', e);
    }
  };

  ws.onclose = () => {
    console.log('[FlowExt] WebSocket closed. Reconnecting in ' + reconnectInterval + 'ms...');
    setTimeout(connectWebSocket, reconnectInterval);
    reconnectInterval = Math.min(reconnectInterval * 1.5, 10000);
  };

  ws.onerror = (err) => {
    // Error will trigger onclose
  };
}

// Initial connection
connectWebSocket();

// Keep service worker alive when ping received from content script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'keepAlive') {
    // Receiving a message resets the 30s timer.
    // Also ensure WebSocket is connected.
    if (!ws || ws.readyState === WebSocket.CLOSED) {
      connectWebSocket();
    }
    return;
  }
  
  if (msg.action === 'download') {
    chrome.downloads.download({
      url: msg.url,
      filename: `FlowGen/${msg.filename}`,
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('[FlowExt] Download error:', chrome.runtime.lastError);
      } else {
        console.log('[FlowExt] Download started, id:', downloadId, 'file:', msg.filename);
      }
    });
  }
});

// ── WebSocket Reporting ───────────────────────────────────────────────────────

function reportStatus(status) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'report', ...status }));
  }
}

function reportLog(message) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'report', log: message }));
  }
}

// ── Generation Loop ───────────────────────────────────────────────────────────

async function handleApiGenerate(cmd) {
  const {
    prompt,
    count = 1,
    delay = 30,
    prefix = 'flow_',
    upscale = false,
    videoMode = false,
    imageData = null,
    imageMimeType = null,
    imageName = null
  } = cmd;

  if (apiRunning) {
    reportLog('Generation already running. Ignoring new request.');
    return;
  }

  apiRunning = true;
  apiStopRequested = false;
  let doneCount = 0;

  try {
    reportLog(`Starting ${count} generation(s) with ${delay}s delay`);
    reportStatus({
      running: true,
      done: 0,
      remaining: count,
      total: count,
      currentPrompt: prompt
    });

    const tab = await findFlowTab();
    if (!tab) {
      reportLog('ERROR: No Google Labs tab found!');
      return;
    }

    const injected = await ensureContentScript(tab);
    if (!injected) {
      reportLog('ERROR: Could not inject content script.');
      return;
    }

    for (let i = 0; i < count; i++) {
      if (apiStopRequested) { reportLog('Stopped by user.'); break; }

      reportStatus({ running: true, done: doneCount, remaining: count - i, total: count, currentPrompt: prompt });
      reportLog(`Generation ${i + 1} of ${count}...`);

      let finalPrompt = prompt;
      if (videoMode && !finalPrompt.toLowerCase().startsWith('generate a video:')) {
        finalPrompt = 'Generate a video: ' + finalPrompt;
      } else if (!videoMode && !finalPrompt.toLowerCase().startsWith('generate a image:')) {
        finalPrompt = 'Generate a image: ' + finalPrompt;
      }

      const result = await sendToContentScript(tab.id, {
        action: 'injectPrompt',
        prompt: finalPrompt,
        prefix,
        index: i,
        upscale,
        videoMode,
        imageData: imageData || null,
        imageMimeType: imageMimeType || null,
        imageName: imageName || null
      });

      if (result && result.ok) {
        doneCount++;
        reportLog(`Done #${i + 1} — saved to Downloads/FlowGen/`);
      } else {
        reportLog(`Failed #${i + 1}: ${result?.error || 'unknown error'}`);
      }

      reportStatus({ running: true, done: doneCount, remaining: count - i - 1, total: count, currentPrompt: prompt });

      if (i < count - 1 && !apiStopRequested) {
        reportLog(`Waiting ${delay}s...`);
        await sleepWithStopCheck(delay * 1000);
      }
    }

    reportLog(`All done! ${doneCount}/${count} succeeded.`);
  } catch (err) {
    console.error('[FlowExt] Generation loop error:', err);
    reportLog(`ERROR: Unexpected failure — ${err.message}`);
  } finally {
    apiRunning = false;
    reportStatus({ running: false, done: doneCount, remaining: 0, total: count, currentPrompt: null });
  }
}

// ── Helper Functions ──────────────────────────────────────────────────────────

async function findFlowTab() {
  const tabs = await chrome.tabs.query({ url: 'https://labs.google/*' });
  return tabs.length ? tabs[0] : null;
}

async function ensureContentScript(tab) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tab.id, { action: 'ping' }, (response) => {
      if (chrome.runtime.lastError || !response?.ok) {
        chrome.scripting.executeScript(
          { target: { tabId: tab.id }, files: ['content.js'] },
          () => {
            if (chrome.runtime.lastError) {
              console.error('[FlowExt] Inject failed:', chrome.runtime.lastError.message);
              resolve(false);
            } else {
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

function sendToContentScript(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
      } else {
        resolve(response || { ok: false, error: 'No response' });
      }
    });
  });
}

async function sleepWithStopCheck(ms) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (apiStopRequested) return;
    await new Promise(r => setTimeout(r, 500));
  }
}
