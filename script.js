const menuView = document.getElementById('menuView');
const editView = document.getElementById('editView');
const notesList = document.getElementById('notesList');
const noteArea = document.getElementById('noteArea');
const noteUrlDisplay = document.getElementById('noteUrlDisplay');
const statusText = document.getElementById('status');
const searchInput = document.getElementById('searchInput');
const siteFilterBtn = document.getElementById('siteFilterBtn');
const favoriteFilterBtn = document.getElementById('favoriteFilterBtn');
const categoryFilter = document.getElementById('categoryFilter');

const newNoteBtn = document.getElementById('newNoteBtn');
const backBtn = document.getElementById('backBtn');
const deleteBtn = document.getElementById('deleteBtn');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const importJsonBtn = document.getElementById('importJsonBtn');
const importJsonInput = document.getElementById('importJsonInput');
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

const changeAvatarBtn = document.getElementById('changeAvatarBtn');
const userAvatar = document.getElementById('userAvatar');
const profileInitial = document.getElementById('profileInitial');

const btnBold = document.getElementById('btnBold');
const btnItalic = document.getElementById('btnItalic');
const btnUnderline = document.getElementById('btnUnderline');
const formatToolbar = document.getElementById('formatToolbar');

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

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  currentSite = getDomain(tabs[0] && tabs[0].url);
  updateSiteFilterButton();
  renderNotesList(searchInput.value);
});

chrome.storage.sync.get(['notesArray', 'userAvatarUrl'], (data) => {
  if (data.notesArray) allNotes = data.notesArray;
  renderNotesList();

  if (data.userAvatarUrl) {
    userAvatar.src = data.userAvatarUrl;
    userAvatar.classList.remove('hidden');
    profileInitial.classList.add('hidden');
  }
});

changeAvatarBtn.addEventListener('click', () => {
  const url = prompt("Enter the direct link to your profile picture (URL):");
  if (url !== null) {
    if (url.trim() === "") {
      userAvatar.src = "";
      userAvatar.classList.add('hidden');
      profileInitial.classList.remove('hidden');
      chrome.storage.sync.remove('userAvatarUrl');
    } else {
      userAvatar.src = url;
      userAvatar.classList.remove('hidden');
      profileInitial.classList.add('hidden');
      chrome.storage.sync.set({ 'userAvatarUrl': url });
    }
  }
});

btnBold.addEventListener('click', () => document.execCommand('bold', false, null));
btnItalic.addEventListener('click', () => document.execCommand('italic', false, null));
btnUnderline.addEventListener('click', () => document.execCommand('underline', false, null));

function renderNotesList(filterText = '') {
  updateCategoryFilterOptions();
  notesList.innerHTML = '';
  const filteredNotes = allNotes.filter(note => {
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
  }).sort((first, second) => Number(second.favorite === true) - Number(first.favorite === true));

  filteredNotes.forEach(note => {
    const card = document.createElement('div');
    card.className = `note-card ${note.color}`;
    
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

    if (note.url) {
      const urlSpan = document.createElement('span');
      urlSpan.className = 'note-url';
      urlSpan.textContent = note.url;
      card.appendChild(urlSpan);
    }
    
    card.addEventListener('click', () => openEditor(note.id));
    notesList.appendChild(card);
  });
}

searchInput.addEventListener('input', (e) => renderNotesList(e.target.value));

categoryFilter.addEventListener('change', () => renderNotesList(searchInput.value));

siteFilterBtn.addEventListener('click', () => {
  if (!currentSite) return;
  showCurrentSiteOnly = !showCurrentSiteOnly;
  updateSiteFilterButton();
  renderNotesList(searchInput.value);
});

favoriteFilterBtn.addEventListener('click', () => {
  showFavoritesOnly = !showFavoritesOnly;
  updateFavoriteFilterButton();
  renderNotesList(searchInput.value);
});

function openEditor(id, newlyCreated = false) {
  currentNoteId = id;
  isNewNote = newlyCreated;
  const noteObj = allNotes.find(n => n.id === id);
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

backBtn.addEventListener('click', () => {
  clearTimeout(saveTimeout);
  const noteIndex = allNotes.findIndex(n => n.id === currentNoteId);
  const noteText = noteArea.innerText.trim();

  if (isNewNote && noteIndex !== -1 && noteText === '') {
    allNotes.splice(noteIndex, 1);
    saveToStorage();
  } else if (noteIndex !== -1) {
    allNotes[noteIndex].text = noteArea.innerHTML;
    allNotes[noteIndex].tags = getTagsFromInput();
    allNotes[noteIndex].favorite = isFavorite;
    allNotes[noteIndex].category = noteCategoryInput.value.trim();
    saveToStorage();
  }

  editView.classList.add('hidden');
  menuView.classList.remove('hidden');
  renderNotesList(searchInput.value); 
});

newNoteBtn.addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    let domainName = "Unknown site";
    if (tabs[0] && tabs[0].url) {
      try { domainName = new URL(tabs[0].url).hostname.replace('www.', ''); } 
      catch (e) { domainName = "Local/internal domain"; }
    }

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
});

noteArea.addEventListener('input', () => {
  clearTimeout(saveTimeout);
  statusText.textContent = 'Saving...';
  
  saveTimeout = setTimeout(() => {
    const noteIndex = allNotes.findIndex(n => n.id === currentNoteId);
    if (noteIndex !== -1) {
      allNotes[noteIndex].text = noteArea.innerHTML;
      saveToStorage();
      isNewNote = false;
    }
    statusText.textContent = 'Saved ✓';
    setTimeout(() => { if(!isLocked) statusText.textContent = ''; }, 2000);
  }, 500);
});

function getTagsFromInput() {
  return [...new Set(editingTags)];
}

function saveNoteMetadata() {
  if (isNewNote && noteArea.innerText.trim() === '') return;
  clearTimeout(saveTimeout);
  statusText.textContent = 'Saving...';
  saveTimeout = setTimeout(() => {
    const noteIndex = allNotes.findIndex(n => n.id === currentNoteId);
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
  isLocked = !isLocked;
  noteArea.setAttribute('contenteditable', !isLocked);
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

confirmDeleteBtn.addEventListener('click', () => {
  const deletedIndex = allNotes.findIndex(note => note.id === currentNoteId);
  deletedNote = deletedIndex === -1 ? null : { note: allNotes[deletedIndex], index: deletedIndex };
  allNotes = allNotes.filter(n => n.id !== currentNoteId);
  saveToStorage();
  closeDeleteModal();
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
  saveToStorage();
  renderNotesList(searchInput.value);
  deletedNote = null;
  clearTimeout(undoTimeout);
  undoToast.classList.add('hidden');
});

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
  chrome.storage.sync.set({ 'notesArray': allNotes }, () => {
    if (chrome.runtime.lastError) {
      statusText.textContent = 'Sync issue';
      return;
    }
    if (editView && !editView.classList.contains('hidden')) {
      statusText.textContent = 'Saved';
    }
  });
}