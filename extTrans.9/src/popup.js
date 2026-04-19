// popup.js
// JavaScript for popup UI interactions.
// Implemented functionality for tab selection, element retrieval, mapping management, and transfer.

(function () {
  // Ensure script runs after DOM is ready
  document.addEventListener('DOMContentLoaded', function () {
    var mappings = [];
    var sourceTabSelect = document.getElementById('sourceTabSelect');
    var targetTabSelect = document.getElementById('targetTabSelect');
    var setSourceBtn = document.getElementById('setSourceBtn');
    var sourceStatus = document.getElementById('sourceStatus');
    var setTargetBtn = document.getElementById('setTargetBtn');
    var targetStatus = document.getElementById('targetStatus');
    var sourceElementSelect = document.getElementById('sourceElementSelect');
    var targetElementSelect = document.getElementById('targetElementSelect');
    var sourceElementsSection = document.getElementById('sourceElementsSection');
    var targetElementsSection = document.getElementById('targetElementsSection');
    var addMappingBtn = document.getElementById('addMappingBtn');
    var mappingList = document.getElementById('mappingList');
    var startTransferBtn = document.getElementById('startTransferBtn');
    var statusDiv = document.getElementById('status');

    // Populate tab dropdowns
    function populateTabs() {
      console.log('Querying tabs');
      chrome.tabs.query({}, function (tabs) {
        tabs.forEach(function (tab) {
          var optionSrc = document.createElement('option');
          optionSrc.value = tab.id;
          optionSrc.textContent = tab.title || tab.url;
          sourceTabSelect.appendChild(optionSrc);

          var optionTgt = document.createElement('option');
          optionTgt.value = tab.id;
          optionTgt.textContent = tab.title || tab.url;
          targetTabSelect.appendChild(optionTgt);
        });
        console.log('Tabs populated');
      });

        chrome.runtime.sendMessage({ action: 'getState' }, function (response) {
            if (response) {
                sourceStatus.textContent = response.stt;
                targetStatus.textContent = response.ttt;
            }
        });
    }


    // Request element selectors for a given tab and populate the appropriate select
    function requestElementsInfo(tabId, isSource) {
      console.log('Requesting element info for tab', tabId);
      chrome.runtime.sendMessage({ action: 'requestElementsInfo', tabId: tabId }, function (response) {
        if (chrome.runtime.lastError) {
          console.error('Error requesting elements:', chrome.runtime.lastError.message);
          statusDiv.textContent = 'Failed to get elements info.';
          return;
        }
        var selectors = response && response.selectors ? response.selectors : [];
        var selectElem = isSource ? sourceElementSelect : targetElementSelect;
        // Clear previous options
        while (selectElem.firstChild) {
          selectElem.removeChild(selectElem.firstChild);
        }
        selectors.forEach(function (sel) {
          var opt = document.createElement('option');
          opt.value = sel;
          opt.textContent = sel;
          selectElem.appendChild(opt);
        });
        if (isSource) {
          sourceElementsSection.style.display = 'block';
        } else {
          targetElementsSection.style.display = 'block';
        }
        console.log('Elements populated for', isSource ? 'source' : 'target');
      });
    }

    // Add mapping to list and UI
    function addMapping() {
      var srcSel = sourceElementSelect.value;
      var tgtSel = targetElementSelect.value;
      if (!srcSel || !tgtSel) {
        statusDiv.textContent = 'Select both source and target elements.';
        return;
      }
      var mapping = { sourceSelector: srcSel, targetSelector: tgtSel };
      mappings.push(mapping);
      var li = document.createElement('li');
      li.textContent = srcSel + ' → ' + tgtSel;
      mappingList.appendChild(li);
      console.log('Mapping added', mapping);
    }

    // Start transfer by sending mappings to background
    function startTransfer() {
      console.log('Starting transfer with mappings', mappings);
      chrome.runtime.sendMessage({ action: 'startTransfer', mappings: mappings }, function (response) {
        var msg = response && response.status ? response.status : 'Transfer initiated';
        statusDiv.textContent = msg;
        console.log('Transfer response', response);
      });
    }

    // Event listeners
    setSourceBtn.addEventListener('click', function () {
      var tabId = parseInt(sourceTabSelect.value, 10);
      if (isNaN(tabId)) {
        statusDiv.textContent = 'Select a source tab first.';
        return;
      }
      console.log('Setting source tab', tabId);
      sourceTabId = tabId;
        sourceStatus.textContent = sourceTabSelect.options[sourceTabSelect.selectedIndex].text;
        chrome.runtime.sendMessage({ action: 'setSourceTab', tabId: tabId, title: sourceStatus.textContent }, function () {
        //requestElementsInfo(tabId, true);
      });
    });

    setTargetBtn.addEventListener('click', function () {
      var tabId = parseInt(targetTabSelect.value, 10);
      if (isNaN(tabId)) {
        statusDiv.textContent = 'Select a target tab first.';
        return;
      }
      console.log('Setting target tab', tabId);
      targetTabId = tabId;
        targetStatus.textContent = targetTabSelect.options[targetTabSelect.selectedIndex].text;
        chrome.runtime.sendMessage({ action: 'setTargetTab', tabId: tabId, title: targetStatus.textContent }, function () {
        //requestElementsInfo(tabId, false);
      });
    });

    addMappingBtn.addEventListener('click', addMapping);
    startTransferBtn.addEventListener('click', startTransfer);

    // Initial load
    populateTabs();
  });
})();

// End of popup.js implementation
