(() => {
  if (window.__stickyNotesOverlayLoaded) return;
  window.__stickyNotesOverlayLoaded = true;

  const host = document.createElement('div');
  host.id = 'sticky-notes-overlay-host';
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
  const shadow = host.attachShadow({ mode: 'closed' });
  document.documentElement.appendChild(host);

  const style = document.createElement('style');
  style.textContent = `
    .layer { position: absolute; inset: 0; pointer-events: none; }
    .drop-hint { position: absolute; inset: 12px; display: none; align-items: flex-start; justify-content: center; padding-top: 48px; border: 2px dashed rgba(63, 117, 104, .8); border-radius: 10px; background: rgba(131, 199, 176, .08); color: #3f7568; font: 600 14px 'Trebuchet MS', 'Segoe UI', sans-serif; pointer-events: none; }
    .drop-hint.visible { display: flex; }
    .card { position: absolute; width: 280px; box-sizing: border-box; padding: 16px 16px 22px; border: 1px solid #e2d76d; border-radius: 1px; background: #fff994; color: #2d302d; box-shadow: 0 8px 20px rgba(31, 38, 35, .2); font: 14px/1.45 'Trebuchet MS', 'Segoe UI', sans-serif; overflow: hidden; pointer-events: auto; }
    .card::before { content: ''; position: absolute; left: 0; top: 0; width: 30px; height: 30px; background: #d3c44f; clip-path: polygon(0 0, 100% 0, 0 100%); pointer-events: none; }
    .card::after { content: ''; position: absolute; left: 0; top: 0; width: 27px; height: 27px; background: #fff994; clip-path: polygon(0 0, 100% 0, 0 100%); box-shadow: 2px 2px 3px rgba(111, 101, 29, .28); pointer-events: none; }
    .bar { position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; padding-left: 22px; color: #68706a; font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; cursor: grab; user-select: none; }
    .bar.dragging { cursor: grabbing; }
    .controls { display: flex; align-items: center; gap: 6px; }
    .control { border: 0; background: transparent; color: #68706a; cursor: pointer; font-size: 16px; line-height: 1; padding: 2px 4px; }
    .control:hover { color: #2d302d; }
    .text { max-height: 220px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; outline: none; }
    .text[contenteditable="true"] { border: 1px dashed #b9ad68; border-radius: 5px; padding: 7px; margin: -7px; background: rgba(255, 255, 255, .25); }
    .site { color: #80868b; font-size: 11px; margin-top: 12px; text-align: right; }
  `;
  shadow.appendChild(style);
  const layer = document.createElement('div');
  layer.className = 'layer';
  shadow.appendChild(layer);
  const dropHint = document.createElement('div');
  dropHint.className = 'drop-hint';
  dropHint.textContent = 'Release to place note';
  shadow.appendChild(dropHint);

  let editingId = null;
  let saveTimer = null;
  let lastDragPosition = null;
  let dropHintTimer = null;
  const iconLocked = '<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>';
  const iconUnlocked = '<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>';

  function plainText(html) {
    const temporary = document.createElement('div');
    temporary.innerHTML = html || '';
    return temporary.textContent.trim() || 'Empty note';
  }

  function getPageKey() {
    try {
      return window.top.location.href;
    } catch (error) {
      return window.location.href;
    }
  }

  let pageKey = getPageKey();
  const isTopFrame = window.top === window.self;
  if (isTopFrame) {
    document.querySelectorAll('iframe[data-sticky-notes-menu], iframe[src*="popup.html?all-notes=1"]').forEach(frame => frame.remove());
  }
  if (!isTopFrame) {
    chrome.runtime.sendMessage({ type: 'getTopPageUrl' }, response => {
      if (response && response.url) pageKey = response.url;
    });
  }
  function openNotesMenu() {
    chrome.runtime.sendMessage({ type: 'openNativeNotesPopup' });
  }
  function createCard(note, position) {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.left = `${Math.max(0, position.left)}px`;
    card.style.top = `${Math.max(0, position.top)}px`;
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.textContent = 'Sticky note';
    const controls = document.createElement('div');
    controls.className = 'controls';
    const lockButton = document.createElement('button');
    lockButton.className = 'control';
    lockButton.type = 'button';
    lockButton.title = 'Unlock note';
    lockButton.innerHTML = iconLocked;
    const closeButton = document.createElement('button');
    closeButton.className = 'control';
    closeButton.type = 'button';
    closeButton.title = 'Close note';
    closeButton.textContent = '×';
    controls.append(lockButton, closeButton);
    bar.appendChild(controls);
    const text = document.createElement('div');
    text.className = 'text';
    text.textContent = plainText(note.text);
    const site = document.createElement('div');
    site.className = 'site';
    site.textContent = note.url || '';
    card.append(bar, text, site);
    layer.appendChild(card);

    let locked = true;
    let dragState = null;
    lockButton.addEventListener('click', () => {
      locked = !locked;
      text.contentEditable = String(!locked);
      lockButton.innerHTML = locked ? iconLocked : iconUnlocked;
      if (!locked) text.focus();
    });
    closeButton.addEventListener('click', () => {
      chrome.storage.sync.get(['floatingNotes'], data => {
        const floatingNotes = Array.isArray(data.floatingNotes) ? data.floatingNotes : [];
        const item = floatingNotes.find(entry => String(entry.noteId) === String(note.id) && entry.pageKey === pageKey);
        if (item) item.visible = false;
        chrome.storage.sync.set({ floatingNotes });
      });
      openNotesMenu();
    });
    bar.addEventListener('pointerdown', event => {
      if (event.target.closest('button')) return;
      dragState = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, left: position.left, top: position.top };
      bar.classList.add('dragging');
      bar.setPointerCapture(event.pointerId);
    });
    bar.addEventListener('pointermove', event => {
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      position.left = Math.max(0, dragState.left + event.clientX - dragState.startX);
      position.top = Math.max(0, dragState.top + event.clientY - dragState.startY);
      card.style.left = `${position.left}px`;
      card.style.top = `${position.top}px`;
    });
    bar.addEventListener('pointerup', event => {
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      dragState = null;
      bar.classList.remove('dragging');
      savePosition(note.id, position);
    });
    bar.addEventListener('pointercancel', () => {
      dragState = null;
      bar.classList.remove('dragging');
    });
    bar.addEventListener('lostpointercapture', () => {
      if (!dragState) return;
      dragState = null;
      bar.classList.remove('dragging');
      savePosition(note.id, position);
    });
    text.addEventListener('input', () => {
      if (locked) return;
      editingId = note.id;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        chrome.storage.sync.get(['notesArray'], data => {
          const notes = Array.isArray(data.notesArray) ? data.notesArray : [];
          const storedNote = notes.find(item => String(item.id) === String(note.id));
          if (!storedNote) return;
          storedNote.text = `<p>${escapeHtml(text.textContent)}</p>`;
          chrome.storage.sync.set({ notesArray: notes }, () => { editingId = null; });
        });
      }, 450);
    });
  }

  function render(data) {
    if (!isTopFrame) return;
    const notes = Array.isArray(data.notesArray) ? data.notesArray : [];
    const floatingNotes = Array.isArray(data.floatingNotes) ? data.floatingNotes : [];
    const entries = floatingNotes.map(item => ({ item, note: notes.find(note => String(note.id) === String(item.noteId)) }))
      .filter(entry => entry.note && entry.item.pageKey === pageKey && entry.item.visible !== false);
    layer.replaceChildren();
    entries.forEach(entry => createCard(entry.note, { top: entry.item.top ?? 18, left: entry.item.left ?? 18 }));
  }

  function getDraggedNoteId(dataTransfer) {
    if (!dataTransfer) return '';
    const customId = String(dataTransfer.getData('application/x-sticky-note-id') || '');
    if (customId) return customId;
    const plainText = String(dataTransfer.getData('text/plain') || '');
    const noteId = plainText.startsWith('sticky-note:') ? plainText.slice('sticky-note:'.length) : '';
    return noteId && noteId !== 'null' && noteId !== 'undefined' ? noteId : '';
  }

  function isStickyNoteDrag(dataTransfer) {
    return Boolean(dataTransfer && Array.from(dataTransfer.types || [])
      .some(type => type === 'application/x-sticky-note-id' || type === 'text/plain'));
  }

  window.addEventListener('dragenter', event => {
    if (!isStickyNoteDrag(event.dataTransfer)) return;
    event.preventDefault();
    dropHint.classList.add('visible');
    clearTimeout(dropHintTimer);
  }, true);
  window.addEventListener('dragover', event => {
    if (!isStickyNoteDrag(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    lastDragPosition = { left: event.clientX, top: event.clientY };
    chrome.storage.local.set({ lastDragPosition });
    dropHint.classList.add('visible');
    clearTimeout(dropHintTimer);
    dropHintTimer = setTimeout(() => {
      dropHint.classList.remove('visible');
      lastDragPosition = null;
      chrome.storage.local.remove('lastDragPosition');
    }, 1200);
  }, true);
  window.addEventListener('dragleave', event => {
    if (event.clientX <= 0 || event.clientY <= 0 || event.clientX >= window.innerWidth || event.clientY >= window.innerHeight) {
      lastDragPosition = null;
      chrome.storage.local.remove('lastDragPosition');
      clearTimeout(dropHintTimer);
      dropHint.classList.remove('visible');
    }
  }, true);
  window.addEventListener('drop', event => {
    const transferredNoteId = getDraggedNoteId(event.dataTransfer);
    const hasStickyPayload = Boolean(transferredNoteId);
    if (!hasStickyPayload && !isStickyNoteDrag(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    clearTimeout(dropHintTimer);
    dropHint.classList.remove('visible');
    const saveDrop = noteId => {
      if (!noteId || noteId === 'null' || noteId === 'undefined') return;
      chrome.storage.sync.get(['floatingNotes'], data => {
        const floatingNotes = Array.isArray(data.floatingNotes) ? data.floatingNotes : [];
        const existing = floatingNotes.find(item => String(item.noteId) === String(noteId) && item.pageKey === pageKey);
        if (existing) {
          existing.left = event.clientX;
          existing.top = event.clientY;
          existing.visible = true;
        } else {
          floatingNotes.push({ noteId, pageKey, left: event.clientX, top: event.clientY, visible: true });
        }
        chrome.storage.sync.set({ floatingNotes });
      });
    };
    if (transferredNoteId) {
      saveDrop(transferredNoteId);
      lastDragPosition = null;
      chrome.storage.local.remove('lastDragPosition');
      return;
    }
    chrome.storage.local.get(['activeDragNoteId'], data => {
      saveDrop(data.activeDragNoteId);
    });
  }, true);
  chrome.runtime.onMessage.addListener(message => {
    if (message.type !== 'commitDraggedNote') return;
    if (lastDragPosition) {
      saveDroppedNote(message.noteId, lastDragPosition);
      dropHint.classList.remove('visible');
      return;
    }
    chrome.storage.local.get(['lastDragPosition'], data => {
      if (data.lastDragPosition) saveDroppedNote(message.noteId, data.lastDragPosition);
      dropHint.classList.remove('visible');
    });
  });

  function saveDroppedNote(noteId, position) {
    if (!noteId || noteId === 'null' || noteId === 'undefined') return;
    chrome.storage.sync.get(['floatingNotes'], data => {
      const floatingNotes = Array.isArray(data.floatingNotes) ? data.floatingNotes : [];
      const existing = floatingNotes.find(item => String(item.noteId) === String(noteId) && item.pageKey === pageKey);
      if (existing) {
        existing.left = position.left;
        existing.top = position.top;
        existing.visible = true;
      } else {
        floatingNotes.push({ noteId, pageKey, left: position.left, top: position.top, visible: true });
      }
      chrome.storage.sync.set({ floatingNotes });
    });
  }
  if (isTopFrame) {
    chrome.storage.onChanged.addListener(() => {
      if (editingId === null) chrome.storage.sync.get(['notesArray', 'floatingNotes'], render);
    });
    chrome.storage.sync.get(['notesArray', 'floatingNotes'], render);
  }

  function escapeHtml(value) {
    return value.replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  }
})();
