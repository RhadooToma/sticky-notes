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

function clearAllBadges() {
  if (chrome.action && typeof chrome.action.setBadgeText === 'function') {
    chrome.action.setBadgeText({ text: '' }).catch(() => {});
    chrome.tabs.query({}, tabs => {
      if (Array.isArray(tabs)) {
        for (const tab of tabs) {
          if (tab.id) {
            chrome.action.setBadgeText({ text: '', tabId: tab.id }).catch(() => {});
          }
        }
      }
    });
  }
}

function updateBadgeForTab(tabId, url) {
  if (!tabId || !chrome.action || typeof chrome.action.setBadgeText !== 'function') return;
  chrome.storage.sync.get(['showBadgeCounter'], cfg => {
    if (!cfg.showBadgeCounter) {
      chrome.action.setBadgeText({ text: '', tabId }).catch(() => {});
      return;
    }

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
  });
}

function updateAllActiveBadges() {
  chrome.storage.sync.get(['showBadgeCounter'], cfg => {
    if (!cfg.showBadgeCounter) {
      clearAllBadges();
      return;
    }
    chrome.tabs.query({}, tabs => {
      for (const tab of tabs) {
        if (tab.id && tab.url) {
          updateBadgeForTab(tab.id, tab.url);
        }
      }
    });
  });
}

// Initialize display mode & clear default badges on worker startup
chrome.storage.sync.get(['displayMode', 'showBadgeCounter'], data => {
  updateDisplayMode(data.displayMode || 'popup');
  if (data.showBadgeCounter) {
    updateAllActiveBadges();
  } else {
    clearAllBadges();
  }
});

chrome.runtime.onInstalled.addListener(details => {
  createContextMenu();
  if (details.reason === 'install') {
    chrome.storage.sync.remove(['floatingNotes', 'pinnedNoteId', 'pinnedNotePosition']);
  }
  chrome.storage.sync.get(['displayMode', 'showBadgeCounter'], data => {
    updateDisplayMode(data.displayMode || 'popup');
    if (data.showBadgeCounter) {
      updateAllActiveBadges();
    } else {
      clearAllBadges();
    }
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
});

chrome.runtime.onStartup.addListener(() => {
  createContextMenu();
  chrome.storage.sync.get(['displayMode', 'showBadgeCounter'], data => {
    updateDisplayMode(data.displayMode || 'popup');
    if (data.showBadgeCounter) {
      updateAllActiveBadges();
    } else {
      clearAllBadges();
    }
  });
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
  if (changes.showBadgeCounter) {
    if (!changes.showBadgeCounter.newValue) {
      clearAllBadges();
    } else {
      updateAllActiveBadges();
    }
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

function generateTextFragmentUrl(pageUrl, selectedText) {
  if (!pageUrl || !selectedText) return pageUrl || '';
  const cleanUrl = pageUrl.split('#')[0];
  const cleanText = selectedText.trim().replace(/\s+/g, ' ');
  if (!cleanText) return cleanUrl;

  try {
    const words = cleanText.split(' ').filter(Boolean);
    let fragment = '';
    if (words.length <= 8) {
      fragment = `#:~:text=${encodeURIComponent(cleanText)}`;
    } else {
      const start = words.slice(0, 4).join(' ');
      const end = words.slice(-4).join(' ');
      fragment = `#:~:text=${encodeURIComponent(start)},${encodeURIComponent(end)}`;
    }
    return `${cleanUrl}${fragment}`;
  } catch (e) {
    return cleanUrl;
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'save-selection-to-notes' || !info.selectionText) return;

  let site = 'Unassigned site';
  let targetUrl = (tab && tab.url) ? tab.url : '';
  if (tab && tab.url) {
    try {
      site = new URL(tab.url).hostname.replace(/^www\./, '');
      targetUrl = generateTextFragmentUrl(tab.url, info.selectionText);
    } catch (error) {
      site = 'Unassigned site';
    }
  }

  chrome.storage.sync.get(['notesArray'], data => {
    const notes = Array.isArray(data.notesArray) ? data.notesArray : [];
    const sourceLink = targetUrl 
      ? `<a href="${escapeHtml(targetUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(site)}</a>`
      : escapeHtml(site);

    const now = Date.now();
    const newNote = {
      id: now,
      createdAt: now,
      updatedAt: now,
      text: `<blockquote>${escapeHtml(info.selectionText.trim())}</blockquote><p></p><p>Source: ${sourceLink}</p>`,
      color: notes.length % 2 === 0 ? 'color-yellow' : 'color-purple',
      url: site,
      sourceUrl: targetUrl,
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
