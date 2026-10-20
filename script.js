if (new URLSearchParams(window.location.search).has('sidepanel')) {
  document.body.classList.add('sidepanel-mode');
}

const menuView = document.getElementById('menuView');
const editView = document.getElementById('editView');
const notesList = document.getElementById('notesList');
const noteArea = document.getElementById('noteArea');
const noteUrlDisplay = document.getElementById('noteUrlDisplay');
const statusText = document.getElementById('status');
const searchInput = document.getElementById('searchInput');
const siteFilterBtn = document.getElementById('siteFilterBtn');
const favoriteFilterBtn = document.getElementById('favoriteFilterBtn');
const recentlyDeletedBtn = document.getElementById('recentlyDeletedBtn');
const clearDeletedBtn = document.getElementById('clearDeletedBtn');
const categoryFilter = document.getElementById('categoryFilter');
const sortSelect = document.getElementById('sortSelect');
const searchContainer = document.getElementById('searchContainer');
const onboardingLegend = document.getElementById('onboardingLegend');

const newNoteBtn = document.getElementById('newNoteBtn');
const backBtn = document.getElementById('backBtn');
const deleteBtn = document.getElementById('deleteBtn');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const importJsonBtn = document.getElementById('importJsonBtn');
const importJsonInput = document.getElementById('importJsonInput');
const settingsBtn = document.getElementById('settingsBtn');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const lockBtn = document.getElementById('lockBtn');
const favoriteBtn = document.getElementById('favoriteBtn');
const noteTagsInput = document.getElementById('noteTagsInput');
const tagChips = document.getElementById('tagChips');
const noteCategoryInput = document.getElementById('noteCategoryInput');
const deleteModal = document.getElementById('deleteModal');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const undoToast = document.getElementById('undoToast');
const undoDeleteBtn = document.getElementById('undoDeleteBtn');

const btnBold = document.getElementById('btnBold');
const btnItalic = document.getElementById('btnItalic');
const btnUnderline = document.getElementById('btnUnderline');
const formatToolbar = document.getElementById('formatToolbar');
const btnOrderedList = document.getElementById('btnOrderedList');
const btnUnorderedList = document.getElementById('btnUnorderedList');

const iconUnlocked = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>`;
const iconLocked = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;

let allNotes = [];
let currentNoteId = null;
let saveTimeout = null;
let isLocked = false;
let isNewNote = false;
let currentSite = '';
let showCurrentSiteOnly = false;
let showFavoritesOnly = false;
let deletedNote = null;
let undoTimeout = null;
let isFavorite = false;
let editingTags = [];
let deletedNotes = [];
let isDarkMode = false;
let currentThemeSetting = 'light';
let currentSortOrder = 'newest';
let showRecentlyDeletedOnly = false;

function dismissOnboarding() {
  if (onboardingLegend.classList.contains('hidden')) return;
  onboardingLegend.classList.add('hidden');
  chrome.storage.sync.set({ ftueArrowGuideCompleted: true });
}

document.addEventListener('click', dismissOnboarding);

settingsBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
});

function applyAccent(accent) {
  const colors = { teal: '#3f7568', amber: '#d08b3e', blue: '#4c83a8', rose: '#b96b72' };
  document.documentElement.style.setProperty('--accent', colors[accent] || colors.teal);
}

function resolveTheme(theme) {
  if (theme === 'system') {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme) {
  currentThemeSetting = theme || 'light';
  const effectiveTheme = resolveTheme(currentThemeSetting);
  isDarkMode = effectiveTheme === 'dark';
  document.body.classList.toggle('dark-mode', isDarkMode);
  themeToggleBtn.title = isDarkMode ? 'Switch to light mode' : 'Switch to dark mode';
  themeToggleBtn.setAttribute('aria-label', themeToggleBtn.title);
  themeToggleBtn.querySelector('.theme-icon-moon').classList.toggle('hidden', isDarkMode);
  themeToggleBtn.querySelector('.theme-icon-sun').classList.toggle('hidden', !isDarkMode);
}

if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (currentThemeSetting === 'system') {
      applyTheme('system');
    }
  });
}

themeToggleBtn.addEventListener('click', () => {
  const nextTheme = isDarkMode ? 'light' : 'dark';
  applyTheme(nextTheme);
  chrome.storage.sync.set({ settingsTheme: nextTheme });
});

function getNoteTags(note) {
  return Array.isArray(note.tags) ? note.tags : [];
}

function renderTagChips() {
  tagChips.innerHTML = '';
  editingTags.forEach(tag => {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.textContent = `#${tag}`;

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.setAttribute('aria-label', `Remove ${tag}`);
    removeButton.textContent = '×';
    removeButton.addEventListener('click', () => {
      editingTags = editingTags.filter(currentTag => currentTag !== tag);
      renderTagChips();
      saveNoteMetadata();
    });

    chip.appendChild(removeButton);
    tagChips.appendChild(chip);
  });
}

function commitTag() {
  const tag = noteTagsInput.value.trim().toLowerCase();
  if (!tag) return;
  if (!editingTags.includes(tag)) editingTags.push(tag);
  noteTagsInput.value = '';
  renderTagChips();
  saveNoteMetadata();
}

function getNoteCategory(note) {
  const category = typeof note.category === 'string' ? note.category.trim() : '';
  return category.toLowerCase() === 'general' ? '' : category;
}

function getNotePlainText(note) {
  const temp = document.createElement('div');
  temp.innerHTML = note.text || '';
  return (temp.innerText || temp.textContent || '').trim().toLowerCase();
}

function updateCategoryFilterOptions() {
  const selectedCategory = categoryFilter.value;
  const categories = [...new Set(allNotes.map(getNoteCategory).filter(Boolean))].sort((first, second) =>
    first.localeCompare(second));

  categoryFilter.innerHTML = '<option value="all">All categories</option>';
  categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    categoryFilter.appendChild(option);
  });

  categoryFilter.value = categories.includes(selectedCategory) ? selectedCategory : 'all';
}

function updateFavoriteButton() {
  favoriteBtn.textContent = isFavorite ? '★' : '☆';
  favoriteBtn.classList.toggle('favorite-active', isFavorite);
  favoriteBtn.title = isFavorite ? 'Remove from favorites' : 'Add to favorites';
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

function noteMatchesCurrentSite(note) {
  const noteSite = getDomain(note.url);
  return Boolean(currentSite && noteSite &&
    (currentSite === noteSite || currentSite.endsWith(`.${noteSite}`)));
}

function updateSiteFilterButton() {
  siteFilterBtn.textContent = showCurrentSiteOnly && currentSite
    ? `This site: ${currentSite}`
    : 'All notes';
  siteFilterBtn.classList.toggle('active', showCurrentSiteOnly);
}

function updateFavoriteFilterButton() {
  favoriteFilterBtn.textContent = showFavoritesOnly ? 'Favorites only' : 'Favorites';
  favoriteFilterBtn.classList.toggle('active', showFavoritesOnly);
}

function updateRecentlyDeletedButton() {
  recentlyDeletedBtn.classList.toggle('active', showRecentlyDeletedOnly);
  recentlyDeletedBtn.textContent = showRecentlyDeletedOnly ? 'Back to Notes' : 'Recently Deleted';
  searchContainer.classList.toggle('recently-deleted', showRecentlyDeletedOnly);
  if (clearDeletedBtn) {
    clearDeletedBtn.classList.toggle('hidden', !showRecentlyDeletedOnly || deletedNotes.length === 0);
  }
}

chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
  const activeTab = (tabs && tabs[0]) || {};
  currentSite = getDomain(activeTab.url);
  updateSiteFilterButton();
  renderNotesList(searchInput.value);
});

chrome.storage.sync.get(['notesArray', 'deletedNotes', 'startupTab', 'settingsTheme', 'settingsAccent', 'notesSortOrder', 'ftueArrowGuideCompleted'], (data) => {
  applyTheme(data.settingsTheme || 'light');
  applyAccent(data.settingsAccent || 'teal');
  if (!data.ftueArrowGuideCompleted) onboardingLegend.classList.remove('hidden');
  if (Array.isArray(data.notesArray)) allNotes = data.notesArray;
  if (Array.isArray(data.deletedNotes)) deletedNotes = data.deletedNotes;
  if (data.notesSortOrder) {
    currentSortOrder = data.notesSortOrder;
    if (sortSelect) sortSelect.value = currentSortOrder;
  }
  renderNotesList();

  if (data.startupTab === 'new') {
    createNewNote();
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'sync') return;
  if (changes.settingsTheme) applyTheme(changes.settingsTheme.newValue || 'light');
  if (changes.settingsAccent) applyAccent(changes.settingsAccent.newValue || 'teal');
  if (changes.notesArray) {
    allNotes = Array.isArray(changes.notesArray.newValue) ? changes.notesArray.newValue : [];
    if (editView.classList.contains('hidden')) {
      renderNotesList(searchInput.value);
    }
  }
  if (changes.deletedNotes) {
    deletedNotes = Array.isArray(changes.deletedNotes.newValue) ? changes.deletedNotes.newValue : [];
    if (showRecentlyDeletedOnly && editView.classList.contains('hidden')) {
      renderNotesList(searchInput.value);
    }
  }
});

function formatDoc(command) {
  noteArea.focus();
  document.execCommand(command, false, null);
  noteArea.dispatchEvent(new Event('input', { bubbles: true }));
}

[btnBold, btnItalic, btnUnderline, btnOrderedList, btnUnorderedList].forEach(btn => {
  if (btn) btn.addEventListener('mousedown', event => event.preventDefault());
});

btnBold.addEventListener('click', () => formatDoc('bold'));
btnItalic.addEventListener('click', () => formatDoc('italic'));
btnUnderline.addEventListener('click', () => formatDoc('underline'));
btnOrderedList.addEventListener('click', () => formatDoc('insertOrderedList'));
btnUnorderedList.addEventListener('click', () => formatDoc('insertUnorderedList'));

function renderNotesList(filterText = '') {
  updateCategoryFilterOptions();
  updateRecentlyDeletedButton();
  notesList.innerHTML = '';
  const sourceNotes = showRecentlyDeletedOnly ? deletedNotes : allNotes;
  const filteredNotes = sourceNotes.filter(note => {
    if (showRecentlyDeletedOnly) {
      if (!filterText) return true;
      const deletedText = document.createElement('div');
      deletedText.innerHTML = note.text || '';
      return (deletedText.innerText || deletedText.textContent).toLowerCase().includes(filterText.toLowerCase());
    }
    if (showCurrentSiteOnly && !noteMatchesCurrentSite(note)) return false;
    if (showFavoritesOnly && note.favorite !== true) return false;
    if (categoryFilter.value !== 'all' && getNoteCategory(note) !== categoryFilter.value) return false;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = note.text || '';
    const plainText = tempDiv.innerText || tempDiv.textContent;
    const textMatch = plainText.toLowerCase().includes(filterText.toLowerCase());
    const urlMatch = (note.url || '').toLowerCase().includes(filterText.toLowerCase());
    const tagsMatch = getNoteTags(note).join(' ').toLowerCase().includes(filterText.toLowerCase());
    const categoryMatch = getNoteCategory(note).toLowerCase().includes(filterText.toLowerCase());
    return textMatch || urlMatch || tagsMatch || categoryMatch;
  });

  filteredNotes.sort((first, second) => {
    if (showRecentlyDeletedOnly) {
      return Number(second.deletedAt || 0) - Number(first.deletedAt || 0);
    }
    if (currentSortOrder === 'favorites') {
      if (Boolean(second.favorite) !== Boolean(first.favorite)) {
        return Number(second.favorite === true) - Number(first.favorite === true);
      }
      return Number(second.id) - Number(first.id);
    }
    if (currentSortOrder === 'title') {
      return getNotePlainText(first).localeCompare(getNotePlainText(second));
    }
    if (currentSortOrder === 'oldest') {
      return Number(first.id) - Number(second.id);
    }
    // 'newest' default
    return Number(second.id) - Number(first.id);
  });

  if (filteredNotes.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    if (showRecentlyDeletedOnly) {
      emptyState.textContent = 'No deleted notes.';
    } else if (allNotes.length === 0) {
      emptyState.textContent = 'No notes yet. Click "+ New" to create one!';
    } else {
      emptyState.textContent = 'No notes match your filters.';
    }
    notesList.appendChild(emptyState);
    return;
  }

  filteredNotes.forEach(note => {
    const card = document.createElement('div');
    const noteColor = note.color === 'color-purple' ? 'color-purple' : 'color-yellow';
    card.className = `note-card ${noteColor}`;
    card.draggable = !showRecentlyDeletedOnly;
    card.title = showRecentlyDeletedOnly ? '' : 'Drag note onto the page to post it';

    card.addEventListener('dragstart', event => {
      if (!event.dataTransfer || note.id === null || note.id === undefined) return;
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('application/x-sticky-note-id', String(note.id));
      event.dataTransfer.setData('text/plain', `sticky-note:${note.id}`);
      event.dataTransfer.setDragImage(card, 12, 12);
      chrome.storage.local.set({ activeDragNoteId: String(note.id) });
      card.classList.add('dragging');
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      chrome.storage.local.remove('activeDragNoteId');
      const sendCommit = tab => {
        if (tab && tab.id !== undefined) {
          chrome.tabs.sendMessage(tab.id, {
            type: 'commitDraggedNote',
            noteId: String(note.id)
          }).catch(() => {});
        }
      };
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, tabs => {
        if (tabs && tabs[0]) {
          sendCommit(tabs[0]);
        } else {
          chrome.tabs.query({ active: true, currentWindow: true }, fallbackTabs => {
            if (fallbackTabs && fallbackTabs[0]) sendCommit(fallbackTabs[0]);
          });
        }
      });
    });
    
    const textDiv = document.createElement('div');
    textDiv.className = 'note-text-preview';
    if (note.text && note.text.trim() !== '') {
      textDiv.innerHTML = note.text;
    } else {
      textDiv.innerHTML = '<span style="color:#80868b; font-style:italic;">Empty note...</span>';
    }
    card.appendChild(textDiv);

    if (note.favorite) {
      const favorite = document.createElement('span');
      favorite.className = 'favorite-mark';
      favorite.textContent = '★ Favorite';
      card.appendChild(favorite);
    }

    const tags = getNoteTags(note);
    if (tags.length > 0) {
      const tagsDiv = document.createElement('div');
      tagsDiv.className = 'note-tags';
      tags.forEach(tag => {
        const tagElement = document.createElement('span');
        tagElement.textContent = `#${tag}`;
        tagsDiv.appendChild(tagElement);
      });
      card.appendChild(tagsDiv);
    }

    const category = getNoteCategory(note);
    if (category) {
      const categoryBadge = document.createElement('span');
      categoryBadge.className = 'note-category';
      categoryBadge.textContent = category;
      card.appendChild(categoryBadge);
    }
    
    if (showRecentlyDeletedOnly) {
      const actionGroup = document.createElement('div');
      actionGroup.style.display = 'flex';
      actionGroup.style.gap = '8px';
      actionGroup.style.marginTop = '12px';

      const restoreButton = document.createElement('button');
      restoreButton.className = 'restore-note-btn';
      restoreButton.type = 'button';
      restoreButton.textContent = 'Restore';
      restoreButton.addEventListener('click', event => {
        event.stopPropagation();
        restoreDeletedNote(note.id);
      });

      const permDeleteButton = document.createElement('button');
      permDeleteButton.className = 'restore-note-btn';
      permDeleteButton.style.color = '#a34f43';
      permDeleteButton.style.borderColor = '#a34f43';
      permDeleteButton.type = 'button';
      permDeleteButton.textContent = 'Delete forever';
      permDeleteButton.addEventListener('click', event => {
        event.stopPropagation();
        deletedNotes = deletedNotes.filter(n => String(n.id) !== String(note.id));
        saveToStorage();
        renderNotesList(searchInput.value);
      });

      actionGroup.append(restoreButton, permDeleteButton);
      card.appendChild(actionGroup);
    } else {
      if (note.url) {
        const urlSpan = document.createElement('span');
        urlSpan.className = 'note-url';
        urlSpan.textContent = note.url;
        card.appendChild(urlSpan);
      }
      card.addEventListener('click', () => openEditor(note.id));
    }
    notesList.appendChild(card);
  });
}

searchInput.addEventListener('input', (e) => renderNotesList(e.target.value));

categoryFilter.addEventListener('change', () => renderNotesList(searchInput.value));

if (sortSelect) {
  sortSelect.addEventListener('change', () => {
    currentSortOrder = sortSelect.value;
    chrome.storage.sync.set({ notesSortOrder: currentSortOrder });
    renderNotesList(searchInput.value);
  });
}

siteFilterBtn.addEventListener('click', () => {
  if (!currentSite) return;
  if (showRecentlyDeletedOnly) {
    showRecentlyDeletedOnly = false;
    updateRecentlyDeletedButton();
  }
  showCurrentSiteOnly = !showCurrentSiteOnly;
  updateSiteFilterButton();
  renderNotesList(searchInput.value);
});

favoriteFilterBtn.addEventListener('click', () => {
  if (showRecentlyDeletedOnly) {
    showRecentlyDeletedOnly = false;
    updateRecentlyDeletedButton();
  }
  showFavoritesOnly = !showFavoritesOnly;
  updateFavoriteFilterButton();
  renderNotesList(searchInput.value);
});

recentlyDeletedBtn.addEventListener('click', () => {
  showRecentlyDeletedOnly = !showRecentlyDeletedOnly;
  showCurrentSiteOnly = false;
  showFavoritesOnly = false;
  updateSiteFilterButton();
  updateFavoriteFilterButton();
  updateRecentlyDeletedButton();
  renderNotesList(searchInput.value);
});

if (clearDeletedBtn) {
  clearDeletedBtn.addEventListener('click', () => {
    if (deletedNotes.length === 0) return;
    deletedNotes = [];
    saveToStorage();
    renderNotesList(searchInput.value);
  });
}

function openEditor(id, newlyCreated = false) {
  currentNoteId = id;
  isNewNote = newlyCreated;
  const noteObj = allNotes.find(n => String(n.id) === String(id));
  noteArea.innerHTML = noteObj ? noteObj.text : '';
  noteUrlDisplay.textContent = noteObj ? (noteObj.url || 'Unassigned site') : 'Unassigned site';
  editingTags = noteObj ? [...getNoteTags(noteObj)] : [];
  noteTagsInput.value = '';
  renderTagChips();
  noteCategoryInput.value = noteObj ? getNoteCategory(noteObj) : '';
  isFavorite = noteObj ? noteObj.favorite === true : false;
  updateFavoriteButton();
  
  isLocked = false;
  noteArea.setAttribute('contenteditable', 'true');
  formatToolbar.style.display = 'flex';
  
  lockBtn.innerHTML = iconUnlocked;
  statusText.textContent = '';
  
  menuView.classList.add('hidden');
  editView.classList.remove('hidden');
}

function flushCurrentNoteSave() {
  if (currentNoteId === null || editView.classList.contains('hidden')) return;
  clearTimeout(saveTimeout);
  const noteIndex = allNotes.findIndex(n => String(n.id) === String(currentNoteId));
  const noteText = noteArea.innerText.trim();

  if (isNewNote && noteIndex !== -1 && noteText === '' && editingTags.length === 0 && !noteCategoryInput.value.trim() && !isFavorite) {
    allNotes.splice(noteIndex, 1);
    saveToStorage();
  } else if (noteIndex !== -1) {
    allNotes[noteIndex].text = noteArea.innerHTML;
    allNotes[noteIndex].tags = getTagsFromInput();
    allNotes[noteIndex].favorite = isFavorite;
    allNotes[noteIndex].category = noteCategoryInput.value.trim();
    saveToStorage();
    isNewNote = false;
  }
}

noteArea.addEventListener('blur', flushCurrentNoteSave);
window.addEventListener('beforeunload', flushCurrentNoteSave);
window.addEventListener('pagehide', flushCurrentNoteSave);

backBtn.addEventListener('click', event => {
  event.preventDefault();
  event.stopPropagation();
  flushCurrentNoteSave();
  currentNoteId = null;
  editView.classList.add('hidden');
  menuView.classList.remove('hidden');
  renderNotesList(searchInput.value);
});

function createNewNote() {
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    const activeTab = (tabs && tabs[0]) || {};
    const domainName = getDomain(activeTab.url) || "Unassigned site";

    const newNote = {
      id: Date.now(),
      text: '',
      color: allNotes.length % 2 === 0 ? 'color-yellow' : 'color-purple',
      url: domainName,
      tags: [],
      favorite: false,
      category: ''
    };
    
    allNotes.unshift(newNote);
    openEditor(newNote.id, true);
  });
}

newNoteBtn.addEventListener('click', createNewNote);

noteArea.addEventListener('input', () => {
  if (noteArea.innerHTML === '<br>' || noteArea.innerHTML === '<p><br></p>') {
    noteArea.innerHTML = '';
  }
  clearTimeout(saveTimeout);
  statusText.textContent = 'Saving...';
  
  saveTimeout = setTimeout(() => {
    const noteIndex = allNotes.findIndex(n => String(n.id) === String(currentNoteId));
    if (noteIndex !== -1) {
      allNotes[noteIndex].text = noteArea.innerHTML;
      saveToStorage();
      isNewNote = false;
    }
    statusText.textContent = 'Saved ✓';
    setTimeout(() => { if (!isLocked) statusText.textContent = ''; }, 2000);
  }, 500);
});

noteArea.addEventListener('change', event => {
  if (!event.target.matches('.checklist-line input, input[type="checkbox"]')) return;
  if (event.target.checked) {
    event.target.setAttribute('checked', 'checked');
  } else {
    event.target.removeAttribute('checked');
  }
  flushCurrentNoteSave();
});

function getTagsFromInput() {
  return [...new Set(editingTags)];
}

function saveNoteMetadata() {
  if (isNewNote && noteArea.innerText.trim() === '') return;
  clearTimeout(saveTimeout);
  statusText.textContent = 'Saving...';
  saveTimeout = setTimeout(() => {
    const noteIndex = allNotes.findIndex(n => String(n.id) === String(currentNoteId));
    if (noteIndex !== -1) {
      allNotes[noteIndex].tags = getTagsFromInput();
      allNotes[noteIndex].favorite = isFavorite;
      allNotes[noteIndex].category = noteCategoryInput.value.trim();
      saveToStorage();
      isNewNote = false;
      renderNotesList(searchInput.value);
    }
    statusText.textContent = 'Saved';
    setTimeout(() => { if (!isLocked) statusText.textContent = ''; }, 2000);
  }, 500);
}

noteTagsInput.addEventListener('keydown', event => {
  if (event.key === ' ' || event.key === 'Enter' || event.key === ',') {
    event.preventDefault();
    commitTag();
  } else if (event.key === 'Backspace' && noteTagsInput.value === '' && editingTags.length > 0) {
    editingTags.pop();
    renderTagChips();
    saveNoteMetadata();
  }
});
noteCategoryInput.addEventListener('change', saveNoteMetadata);

favoriteBtn.addEventListener('click', () => {
  isFavorite = !isFavorite;
  updateFavoriteButton();
  saveNoteMetadata();
});

lockBtn.addEventListener('click', () => {
  if (!isLocked) flushCurrentNoteSave();
  isLocked = !isLocked;
  noteArea.setAttribute('contenteditable', String(!isLocked));
  formatToolbar.style.display = isLocked ? 'none' : 'flex';
  
  lockBtn.innerHTML = isLocked ? iconLocked : iconUnlocked;
  statusText.textContent = isLocked ? 'Read-Only.' : '';
});

deleteBtn.addEventListener('click', () => {
  if (isLocked) {
    alert("Unlock the note first to delete it!");
    return;
  }

  deleteModal.classList.remove('hidden');
  confirmDeleteBtn.focus();
});

function closeDeleteModal() {
  deleteModal.classList.add('hidden');
  deleteBtn.focus();
}

cancelDeleteBtn.addEventListener('click', closeDeleteModal);

function addToDeletedNotes(note) {
  deletedNotes = [{ ...note, deletedAt: Date.now() }, ...deletedNotes.filter(n => String(n.id) !== String(note.id))].slice(0, 30);
}

confirmDeleteBtn.addEventListener('click', () => {
  const deletedIndex = allNotes.findIndex(note => String(note.id) === String(currentNoteId));
  deletedNote = deletedIndex === -1 ? null : { note: allNotes[deletedIndex], index: deletedIndex };
  if (deletedNote) {
    addToDeletedNotes(deletedNote.note);
  }
  allNotes = allNotes.filter(n => String(n.id) !== String(currentNoteId));
  chrome.storage.sync.get(['floatingNotes'], data => {
    const floatingNotes = (Array.isArray(data.floatingNotes) ? data.floatingNotes : [])
      .filter(item => String(item.noteId) !== String(currentNoteId));
    chrome.storage.sync.set({ floatingNotes });
  });
  saveToStorage();
  closeDeleteModal();
  currentNoteId = null;
  editView.classList.add('hidden');
  menuView.classList.remove('hidden');
  renderNotesList(searchInput.value);
  showUndoToast();
});

function showUndoToast() {
  clearTimeout(undoTimeout);
  undoToast.classList.remove('hidden');
  undoTimeout = setTimeout(() => {
    deletedNote = null;
    undoToast.classList.add('hidden');
  }, 5000);
}

undoDeleteBtn.addEventListener('click', () => {
  if (!deletedNote) return;
  allNotes.splice(Math.min(deletedNote.index, allNotes.length), 0, deletedNote.note);
  deletedNotes = deletedNotes.filter(note => String(note.id) !== String(deletedNote.note.id));
  saveToStorage();
  renderNotesList(searchInput.value);
  deletedNote = null;
  clearTimeout(undoTimeout);
  undoToast.classList.add('hidden');
});

function restoreDeletedNote(noteId) {
  const deletedIndex = deletedNotes.findIndex(note => String(note.id) === String(noteId));
  if (deletedIndex === -1) return;
  const restoredNote = { ...deletedNotes[deletedIndex] };
  delete restoredNote.deletedAt;
  allNotes.unshift(restoredNote);
  deletedNotes.splice(deletedIndex, 1);
  saveToStorage();
  renderNotesList(searchInput.value);
}

deleteModal.addEventListener('click', (event) => {
  if (event.target === deleteModal) closeDeleteModal();
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !deleteModal.classList.contains('hidden')) {
    closeDeleteModal();
  }
});

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

exportJsonBtn.addEventListener('click', () => {
  if (allNotes.length === 0) {
    alert('No notes to export.');
    return;
  }

  downloadJson('StickyNotes_Backup.json', {
    version: 1,
    exportedAt: new Date().toISOString(),
    notes: allNotes
  });
});

importJsonBtn.addEventListener('click', () => importJsonInput.click());

importJsonInput.addEventListener('change', () => {
  const file = importJsonInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const backup = JSON.parse(reader.result);
      if (!backup || !Array.isArray(backup.notes)) throw new Error('Invalid backup');

      const importedNotes = backup.notes.filter(note =>
        note && (typeof note.id === 'number' || typeof note.id === 'string') &&
        typeof note.text === 'string'
      ).map(note => ({
        id: note.id,
        text: note.text,
        color: note.color === 'color-purple' ? 'color-purple' : 'color-yellow',
        url: typeof note.url === 'string' ? note.url : 'Unassigned site',
        tags: Array.isArray(note.tags) ? note.tags.filter(tag => typeof tag === 'string') : [],
        favorite: note.favorite === true,
        category: typeof note.category === 'string' && note.category.trim().toLowerCase() !== 'general'
          ? note.category.trim()
          : ''
      }));

      const existingIds = new Set(allNotes.map(note => String(note.id)));
      const uniqueImported = importedNotes.filter(note => !existingIds.has(String(note.id)));
      allNotes = [...uniqueImported, ...allNotes];
      saveToStorage();
      renderNotesList(searchInput.value);
      statusText.textContent = `${uniqueImported.length} notes imported`;
      setTimeout(() => { statusText.textContent = ''; }, 2500);
    } catch (error) {
      alert('This file is not a valid Sticky Notes backup.');
    } finally {
      importJsonInput.value = '';
    }
  };
  reader.readAsText(file);
});

function saveToStorage() {
  chrome.storage.sync.set({ 'notesArray': allNotes, 'deletedNotes': deletedNotes }, () => {
    if (chrome.runtime.lastError) {
      statusText.textContent = 'Sync issue';
      return;
    }
    if (editView && !editView.classList.contains('hidden')) {
      statusText.textContent = 'Saved';
    }
  });
}
