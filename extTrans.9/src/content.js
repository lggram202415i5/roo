(function() {
  // Content script injected into web pages.
  // Handles messages from background/popup for element inspection and manipulation.

  // Helper to generate a unique CSS selector for an element.
  function getUniqueSelector(el) {
    if (!el) return null;
    if (el.id) {
      return `#${el.id}`;
    }
    // Build a path using tag names and nth-of-type indices.
    const parts = [];
    let current = el;
    while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
      const tag = current.tagName.toLowerCase();
      let siblingIndex = 1;
      let sibling = current;
      // Count preceding siblings of same tag to determine nth-of-type.
      while ((sibling = sibling.previousElementSibling) != null) {
        if (sibling.tagName.toLowerCase() === tag) siblingIndex++;
      }
      parts.unshift(`${tag}:nth-of-type(${siblingIndex})`);
      current = current.parentElement;
    }
    return parts.length ? parts.join(' > ') : null;
  }

  // Helper to collect info about a given element.
  function collectElementInfo(el) {
    const type = detectElementType(el);
    if (!type) return null;
    const selector = getUniqueSelector(el);
    const info = { selector, type };
    switch (type) {
      case 'text':
        info.textContent = el.textContent.trim();
        break;
      case 'input':
      case 'textarea':
      case 'select':
        info.value = el.value;
        break;
      case 'checkbox':
        info.checked = el.checked;
        break;
      default:
        // For any other types, expose raw value if exists.
        if ('value' in el) info.value = el.value;
    }
    return info;
  }

  // Handler to retrieve element information from the page.
  function handleGetElementsInfo() {
    const allElements = Array.from(document.body.querySelectorAll('*'));
    const elementsInfo = [];
    for (const el of allElements) {
      const info = collectElementInfo(el);
      if (info) elementsInfo.push(info);
    }
    console.log('content.js – getElementsInfo – collected', elementsInfo.length, 'elements');
    return elementsInfo;
  }

  // Handler to read a single element based on selector.
  function handleReadElement(selector) {
    const el = document.querySelector(selector);
    if (!el) {
      console.warn('content.js – readElement – element not found for selector', selector);
      return null;
    }
    const info = collectElementInfo(el);
    console.log('content.js – readElement –', info);
    return info;
  }

  // Handler to write a value into a targeted element.
  function handleWriteElement(payload) {
    const { selector, value } = payload;
    const el = document.querySelector(selector);
    if (!el) {
      console.warn('content.js – writeElement – element not found for selector', selector);
      return false;
    }
    const targetType = detectElementType(el);
    const converted = convertValue(value, targetType);
    switch (targetType) {
      case 'checkbox':
        el.checked = Boolean(converted);
        break;
      case 'input':
      case 'textarea':
      case 'select':
        el.value = converted;
        break;
      case 'text':
        el.textContent = String(converted);
        break;
      default:
        // Fallback: attempt to set value property if it exists.
        if ('value' in el) el.value = converted;
        else el.textContent = String(converted);
    }
    console.log('content.js – writeElement – updated', selector, 'to', converted);
    return true;
  }

  // Listen for messages from background/popup scripts.
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('content.js – received message', request);
    const { type, selector, value } = request;
    let response;
    switch (type) {
      case 'getElementsInfo':
        response = handleGetElementsInfo();
        break;
      case 'readElement':
        response = handleReadElement(selector);
        break;
      case 'writeElement':
        response = handleWriteElement({ selector, value });
        break;
      default:
        console.warn('content.js – unknown action', action);
        response = null;
    }
    // Respond asynchronously if needed.
    sendResponse({ result: response });
    // Return true to indicate asynchronous response (even though we responded synchronously).
    return true;
  });
})();
