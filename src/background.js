// Background service worker — handles chrome.downloads API
// (content scripts cannot call chrome.downloads directly)

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
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
