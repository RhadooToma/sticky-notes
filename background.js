function createContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'save-selection-to-notes',
      title: 'Save selection to Sticky Notes',
      contexts: ['selection']
    });
  });
}

chrome.runtime.onInstalled.addListener(createContextMenu);

chrome.tabs.onActivated.addListener(activeInfo => {
  chrome.scripting.executeScript({
    target: { tabId: activeInfo.tabId },
    files: ['content.js']
  }).catch(() => {});
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== 'complete') return;
  chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js']
  }).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type === 'showPinnedOverlay' && message.tabId !== undefined) {
    chrome.scripting.executeScript({
      target: { tabId: message.tabId },
      files: ['content.js']
    }).catch(() => {});
    return;
  }

  if (message.type !== 'openPinnedSidePanel') return;

  chrome.windows.getAll({ windowTypes: ['normal'] }, windows => {
    const targetWindow = windows.find(window => window.focused) || windows[0];
    if (!targetWindow || targetWindow.id === undefined) return;

    chrome.sidePanel.open({ windowId: targetWindow.id }, () => {
      if (sender.tab && sender.tab.windowId !== targetWindow.id) {
        chrome.windows.remove(sender.tab.windowId);
      }
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'save-selection-to-notes' || !info.selectionText) return;

  let site = 'Unassigned site';
  if (tab && tab.url) {
    try {
      site = new URL(tab.url).hostname.replace(/^www\./, '');
    } catch (error) {
      site = 'Unassigned site';
    }
  }

  chrome.storage.sync.get(['notesArray'], data => {
    const notes = Array.isArray(data.notesArray) ? data.notesArray : [];
    const newNote = {
      id: Date.now(),
      text: `<blockquote>${escapeHtml(info.selectionText.trim())}</blockquote><p></p><p>Source: ${escapeHtml(tab && tab.url ? tab.url : '')}</p>`,
      color: notes.length % 2 === 0 ? 'color-yellow' : 'color-purple',
      url: site,
      tags: ['quote'],
      favorite: false,
      category: ''
    };

    chrome.storage.sync.set({ notesArray: [newNote, ...notes] });
  });
});

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[character]));
}
