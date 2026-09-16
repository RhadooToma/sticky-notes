function createContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'save-selection-to-notes',
      title: 'Save selection to Sticky Notes',
      contexts: ['selection']
    });
  });
}

chrome.runtime.onInstalled.addListener(details => {
  createContextMenu();
  if (details.reason === 'install') {
    chrome.storage.sync.remove(['floatingNotes', 'pinnedNoteId', 'pinnedNotePosition']);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'openNativeNotesPopup') {
    if (chrome.action && typeof chrome.action.openPopup === 'function') {
      chrome.action.openPopup().catch(() => {});
    }
    return;
  }
  if (message.type !== 'getTopPageUrl') return;
  sendResponse({ url: sender.tab && sender.tab.url ? sender.tab.url : '' });
});

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
