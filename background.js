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
