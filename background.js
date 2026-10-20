function createContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'save-selection-to-notes',
      title: 'Save selection to Sticky Notes',
      contexts: ['selection']
    });
  });
}

function updateDisplayMode(mode) {
  const isSidepanel = mode === 'sidepanel';
  if (chrome.sidePanel && typeof chrome.sidePanel.setPanelBehavior === 'function') {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: isSidepanel }).catch(() => {});
  }
  if (chrome.action && typeof chrome.action.setPopup === 'function') {
    chrome.action.setPopup({ popup: isSidepanel ? '' : 'popup.html' });
  }
}

function getDomain(value) {
  if (!value) return '';
  const candidate = value.includes('://') ? value : `https://${value}`;
  try {
    return new URL(candidate).hostname.replace(/^www\./, '').toLowerCase();
  } catch (error) {
    return value.trim().replace(/^www\./, '').split('/')[0].toLowerCase();
  }
}

function noteMatchesSite(site, noteUrl) {
  const noteSite = getDomain(noteUrl);
  return Boolean(site && noteSite && (site === noteSite || site.endsWith('.' + noteSite)));
}

function updateBadgeForTab(tabId, url) {
  if (!tabId || !chrome.action || typeof chrome.action.setBadgeText !== 'function') return;
  if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('edge://')) {
    chrome.action.setBadgeText({ text: '', tabId }).catch(() => {});
    return;
  }

  const currentSite = getDomain(url);
  if (!currentSite) {
    chrome.action.setBadgeText({ text: '', tabId }).catch(() => {});
    return;
  }

  chrome.storage.sync.get(['notesArray'], data => {
    const notes = Array.isArray(data.notesArray) ? data.notesArray : [];
    const siteNotes = notes.filter(n => noteMatchesSite(currentSite, n.url));
    const count = siteNotes.length;

    chrome.action.setBadgeText({
      text: count > 0 ? String(count) : '',
      tabId: tabId
    }).catch(() => {});

    if (count > 0 && typeof chrome.action.setBadgeBackgroundColor === 'function') {
      chrome.action.setBadgeBackgroundColor({
        color: '#3f7568',
        tabId: tabId
      }).catch(() => {});
    }
  });
}

function updateAllActiveBadges() {
  chrome.tabs.query({}, tabs => {
    for (const tab of tabs) {
      if (tab.id && tab.url) {
        updateBadgeForTab(tab.id, tab.url);
      }
    }
  });
}

// Initialize display mode & badges on worker startup
chrome.storage.sync.get(['displayMode'], data => {
  updateDisplayMode(data.displayMode || 'popup');
});
updateAllActiveBadges();

chrome.runtime.onInstalled.addListener(details => {
  createContextMenu();
  if (details.reason === 'install') {
    chrome.storage.sync.remove(['floatingNotes', 'pinnedNoteId', 'pinnedNotePosition']);
  }
  chrome.storage.sync.get(['displayMode'], data => {
    updateDisplayMode(data.displayMode || 'popup');
  });

  // Inject content script into active tabs on install/update
  chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] }, tabs => {
    for (const tab of tabs) {
      if (tab.id !== undefined) {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        }).catch(() => {});
      }
    }
  });
  updateAllActiveBadges();
});

chrome.runtime.onStartup.addListener(() => {
  createContextMenu();
  chrome.storage.sync.get(['displayMode'], data => {
    updateDisplayMode(data.displayMode || 'popup');
  });
  updateAllActiveBadges();
});

// Update badges on tab events
chrome.tabs.onActivated.addListener(activeInfo => {
  chrome.tabs.get(activeInfo.tabId, tab => {
    if (chrome.runtime.lastError || !tab) return;
    updateBadgeForTab(tab.id, tab.url);
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' || changeInfo.url) {
    updateBadgeForTab(tabId, tab ? tab.url : changeInfo.url);
  }
});

// Sync display mode & badges when storage changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'sync') return;
  if (changes.displayMode) {
    updateDisplayMode(changes.displayMode.newValue || 'popup');
  }
  if (changes.notesArray) {
    updateAllActiveBadges();
  }
});

// Fallback action click handler when popup is unset (sidepanel mode)
if (chrome.action && chrome.action.onClicked) {
  chrome.action.onClicked.addListener(tab => {
    chrome.storage.sync.get(['displayMode'], data => {
      if (data.displayMode === 'sidepanel') {
        if (chrome.sidePanel && typeof chrome.sidePanel.open === 'function' && tab && tab.windowId) {
          chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
        }
      } else {
        chrome.action.setPopup({ popup: 'popup.html' });
      }
    });
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'openNativeNotesPopup') {
    if (chrome.action && typeof chrome.action.openPopup === 'function') {
      chrome.action.openPopup().catch(() => {});
    }
    return;
  }
  if (message.type === 'getTopPageUrl') {
    sendResponse({ url: sender.tab && sender.tab.url ? sender.tab.url : '' });
    return;
  }
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
  return String(value || '').replace(/[&<>'"]/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[character]));
}
