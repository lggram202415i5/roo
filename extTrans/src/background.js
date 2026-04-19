// background.js
// Service worker for Chrome extension background tasks.
// Implements tab management, state persistence, and messaging between popup and content scripts.

// Utility functions included directly for service worker compatibility (no window object available)
function detectElementType(element) {
  if (!element) {
    return 'unknown';
  }

  if (element.nodeType === Node.TEXT_NODE) {
    return 'text';
  }

  if (element instanceof HTMLInputElement) {
    const type = element.type.toLowerCase();
    switch (type) {
      case 'text':
        return 'input:text';
      case 'password':
        return 'input:password';
      case 'email':
        return 'input:email';
      case 'number':
        return 'input:number';
      case 'checkbox':
        return 'input:checkbox';
      case 'radio':
        return 'input:radio';
      default:
        return `input:${type}`;
    }
  }

  if (element instanceof HTMLSelectElement) {
    return 'select';
  }

  if (element instanceof HTMLTextAreaElement) {
    return 'textarea';
  }

  if (element.tagName === 'INPUT') {
    const type = element.getAttribute('type')?.toLowerCase();
    if (type === 'checkbox') return 'checkbox';
    if (type === 'radio') return 'radio';
  }

  return 'unknown';
}

function convertValue(value, targetType) {
  if (targetType === 'checkbox' || targetType === 'input:checkbox' || targetType === 'radio' || targetType === 'input:radio') {
    if (typeof value === 'string') {
      const lowered = value.trim().toLowerCase();
      return lowered === 'true' || lowered === '1' || lowered === 'yes' || lowered === 'on';
    }
    return Boolean(value);
  }

  if (targetType === 'input:number') {
    const num = Number(value);
    return Number.isNaN(num) ? 0 : num;
  }

  if (typeof value !== 'string') {
    return String(value);
  }

  return value;
}


// In‑memory state
let sourceTabId = null;
let sourceTabTitle = null;
let targetTabId = null;
let targetTabTitle = null;
// elementMappings: { sourceSelector: targetSelector }
let elementMappings = [
  { sourceSelector: "#empty-setup-clone-url", targetSelector: "#domain-url" }
  ,{ sourceSelector: "#empty-setup-clone-url", targetSelector: "#bookmark-path" }
  
];

// Load persisted state from chrome.storage.local
chrome.storage.local.get(['sourceTabId', 'targetTabId', 'elementMappings'], (result) => {
  if (result.sourceTabId !== undefined) sourceTabId = result.sourceTabId;
  if (result.targetTabId !== undefined) targetTabId = result.targetTabId;
  //if (result.elementMappings !== undefined) elementMappings = result.elementMappings;
  console.log('Background: Restored state', { sourceTabId, targetTabId, elementMappings });
});

// Helper to persist current state
function persistState() {
  chrome.storage.local.set({
    sourceTabId,
    targetTabId,
    elementMappings,
  }, () => {
    console.log('Background: State persisted', { sourceTabId, targetTabId, elementMappings });
  });
}

// Async helper to ensure the content script is injected into a tab
async function ensureContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['src/content.js'],
    });
    console.log('Background: content script injected into tab', tabId);
  } catch (e) {
    console.error('Background: failed to inject content script into tab', tabId, e);
    // Swallow error; caller will handle connection failures
  }
}

// Message handling from popup (and potentially other parts of the extension)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background: Received message', request);

  // Flag to indicate async response
  let asyncHandled = false;

  switch (request.action) {
    case 'setSourceTab':
      sourceTabId = request.tabId;
      sourceTabTitle = request.title || null;
      console.log('Background: Set sourceTabId', sourceTabId);
      persistState();
      sendResponse({ success: true });
      break;

    case 'setTargetTab':
      targetTabId = request.tabId;
      targetTabTitle = request.title || null;
      console.log('Background: Set targetTabId', targetTabId);
      persistState();
      sendResponse({ success: true });
      break;

    case 'getState':
      sendResponse({ sid:sourceTabId, stt:sourceTabTitle, tid:targetTabId, ttt:targetTabTitle, elm:elementMappings });
      break;

    case 'requestElementsInfo': {
      const tabId = request.tabId;
      // Validate tabId and URL scheme before any injection
      const allowedSchemes = ['http:', 'https:'];
      if (typeof tabId !== 'number') {
        console.warn('Background: requestElementsInfo skipped – missing or invalid tabId');
        sendResponse({ elements: [] });
        break;
      }
      chrome.tabs.get(tabId, (tab) => {
        if (!tab || typeof tab.url !== 'string') {
          console.warn('Background: requestElementsInfo skipped – tab URL unavailable');
          sendResponse({ elements: [] });
          return;
        }
        const urlScheme = new URL(tab.url).protocol;
        if (!allowedSchemes.includes(urlScheme)) {
          console.warn('Background: requestElementsInfo skipped – unsupported URL scheme', urlScheme, tab.url);
          sendResponse({ elements: [] });
          return;
        }
        // Helper: fetch elements info with retry logic
        const fetchElementsInfo = async (targetTabId) => {
          console.log(`Background: Initiating elements info request for tab ${targetTabId}`);
          // Ensure script is injected before first attempt
          await ensureContentScript(targetTabId);
          const sendMessage = () => new Promise((resolve) => {
            try {
              chrome.tabs.sendMessage(targetTabId, { type: 'getElementsInfo' }, (resp) => {
                if (chrome.runtime.lastError) {
                  console.error(`Background: chrome.tabs.sendMessage error on tab ${targetTabId}`, chrome.runtime.lastError);
                  const errMsg = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                  resolve({ error: errMsg });
                } else {
                  resolve({ response: resp });
                }
              });
            } catch (error) {
              // Resolve with standardized error object as per updated spec
              const errMsg = (error && error.message) || String(error);
              console.error(`Background: Exception during sendMessage for tab ${targetTabId}`, error);
              resolve({ error: errMsg });
            }
          });
          // First attempt
          let result = await sendMessage();
          if (result.error) {
            console.warn(`Background: First attempt to get elements info failed – ${result.error}`);
            await ensureContentScript(targetTabId);
            result = await sendMessage();
            if (result.error) {
              console.error(`Background: Second attempt also failed – returning empty elements list`);
              return { elements: [] };
            }
          }
          console.log(`Background: Elements info successfully retrieved for tab ${targetTabId}`);
          console.log(`Background: Raw response from content.js:`, result.response);
          const elements = result.response?.result || result.response?.elements || [];
          console.log(`Background: Extracted elements:`, elements);
          return { elements: elements };
        };

        // Execute the async flow and send response when ready
        (async () => {
          try {
            const data = await fetchElementsInfo(tabId);
            sendResponse(data);
          } catch (error) {
            console.error(`Background: fetchElementsInfo threw exception – ${error}`);
            sendResponse({ elements: [] });
          }
        })();
      });
      asyncHandled = true;
      break;
    }

    case 'startTransfer': {
      console.log('startTransfer', elementMappings);
      const mappings = elementMappings || [];
      console.log('mappings', mappings);
      if (!Array.isArray(mappings) || !sourceTabId || !targetTabId) {
        console.log('Missing data or tab selection');
        sendResponse({ success: false, error: 'Missing data or tab selection' });
        break;
      }

      const results = [];
      const processMapping = (mapping) => new Promise((resolve) => {
        const { sourceSelector, targetSelector } = mapping;
        // Read from source tab
        chrome.tabs.sendMessage(sourceTabId, { type: 'readElement', selector: sourceSelector }, (readResp) => {
          if (chrome.runtime.lastError) {
            console.error('Background: readElement error', chrome.runtime.lastError);
            return resolve({ mapping, success: false, error: chrome.runtime.lastError.message });
          }
          console.log('readElement response', readResp);
          console.log('readElement - raw response structure:', JSON.stringify(readResp));
          const rawValue = readResp?.result?.value || readResp?.response?.result?.value;
          console.log('readElement - extracted rawValue:', rawValue);
          // Write to target tab
          chrome.tabs.sendMessage(targetTabId, { type: 'writeElement', selector: targetSelector, value: rawValue }, (writeResp) => {
            if (chrome.runtime.lastError) {
              console.error('Background: writeElement error', chrome.runtime.lastError);
              return resolve({ mapping, success: false, error: chrome.runtime.lastError.message });
            }
            console.log('writeElement response', writeResp);
            const ack = writeResp?.result;
            resolve({ mapping, success: !!ack, error: ack ? null : 'No acknowledgement' });
          });
        });
      });

      (async () => {
        for (const mapping of mappings) {
          const result = await processMapping(mapping);
          results.push(result);
        }
        console.log('Background: Transfer results', results);
        const allSuccess = results.every(r => r.success);
        sendResponse({ success: allSuccess, details: results });
      })();
      asyncHandled = true;
      break;
    }

    default:
      console.warn('Background: Unknown message type', request.type);
      sendResponse({ error: 'Unknown message type' });
  }

  return asyncHandled;
});
