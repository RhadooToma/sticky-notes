(() => {
  if (window.__stickyNotesOverlayLoaded) return;
  window.__stickyNotesOverlayLoaded = true;

  const host = document.createElement('div');
  host.id = 'sticky-notes-overlay-host';
  host.style.cssText = 'position:fixed;top:18px;left:18px;z-index:2147483647;display:none;';
  const shadow = host.attachShadow({ mode: 'closed' });
  document.documentElement.appendChild(host);

  let currentNoteId = null;
  let isLocked = true;
  let isEditing = false;
  let saveTimer = null;
  let notePosition = { top: 18, left: 18 };
  let dragState = null;

  const style = document.createElement('style');
  style.textContent = `
    .card { position: relative; width: 280px; box-sizing: border-box; padding: 16px 16px 22px; border: 1px solid #e2d76d; border-radius: 1px; background: #fff994; color: #2d302d; box-shadow: 0 8px 20px rgba(31, 38, 35, .2); font: 14px/1.45 'Trebuchet MS', 'Segoe UI', sans-serif; overflow: hidden; }
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

  const card = document.createElement('div');
  card.className = 'card';
  const bar = document.createElement('div');
  bar.className = 'bar';
  bar.textContent = 'Pinned note';
  const controls = document.createElement('div');
  controls.className = 'controls';
  const lockButton = document.createElement('button');
  lockButton.className = 'control';
  lockButton.type = 'button';
  lockButton.title = 'Unlock note';
  lockButton.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>';
  const closeButton = document.createElement('button');
  closeButton.className = 'control';
  closeButton.type = 'button';
  closeButton.title = 'Unpin note';
  closeButton.textContent = '×';
  controls.append(lockButton, closeButton);
  bar.appendChild(controls);
  const text = document.createElement('div');
  text.className = 'text';
  const site = document.createElement('div');
  site.className = 'site';
  card.append(bar, text, site);
  shadow.appendChild(card);

  function plainText(html) {
    const parser = new DOMParser();
    const temporary = parser.parseFromString(html || '', 'text/html');
    return temporary.body.textContent.trim() || 'Empty note';
  }

  function updateLockButton() {
    lockButton.title = isLocked ? 'Unlock note' : 'Lock note';
    lockButton.innerHTML = isLocked
      ? '<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>'
      : '<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>';
    text.contentEditable = String(!isLocked);
    bar.classList.toggle('dragging', false);
    bar.style.cursor = isLocked ? 'default' : 'grab';
  }

  function applyPosition(position) {
    if (!position || !Number.isFinite(position.top) || !Number.isFinite(position.left)) return;
    notePosition = { top: Math.max(0, position.top), left: Math.max(0, position.left) };
    host.style.top = `${notePosition.top}px`;
    host.style.left = `${notePosition.left}px`;
  }

  function render(data) {
    const notes = Array.isArray(data.notesArray) ? data.notesArray : [];
    const note = notes.find(item => String(item.id) === String(data.pinnedNoteId));
    if (!note) {
      host.style.display = 'none';
      return;
    }
    currentNoteId = note.id;
    applyPosition(data.pinnedNotePosition);
    text.textContent = plainText(note.text);
    site.textContent = note.url || '';
    updateLockButton();
    host.style.display = 'block';
  }

  function refresh() {
    chrome.storage.sync.get(['notesArray', 'pinnedNoteId', 'pinnedNotePosition'], render);
  }

  lockButton.addEventListener('click', () => {
    isLocked = !isLocked;
    updateLockButton();
    if (!isLocked) text.focus();
  });

  bar.addEventListener('pointerdown', event => {
    if (isLocked || event.target.closest('button')) return;
    dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: notePosition.left,
      startTop: notePosition.top
    };
    bar.classList.add('dragging');
    bar.setPointerCapture(event.pointerId);
  });

  bar.addEventListener('pointermove', event => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    applyPosition({
      left: dragState.startLeft + event.clientX - dragState.startX,
      top: dragState.startTop + event.clientY - dragState.startY
    });
  });

  bar.addEventListener('pointerup', event => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    dragState = null;
    bar.classList.remove('dragging');
    chrome.storage.sync.set({ pinnedNotePosition: notePosition });
  });

  bar.addEventListener('pointercancel', () => {
    dragState = null;
    bar.classList.remove('dragging');
  });

  text.addEventListener('input', () => {
    if (isLocked || currentNoteId === null) return;
    isEditing = true;
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      chrome.storage.sync.get(['notesArray'], data => {
        const notes = Array.isArray(data.notesArray) ? data.notesArray : [];
        const note = notes.find(item => String(item.id) === String(currentNoteId));
        if (!note) return;
        note.text = `<p>${escapeHtml(text.textContent)}</p>`;
        chrome.storage.sync.set({ notesArray: notes }, () => { isEditing = false; });
      });
    }, 450);
  });

  closeButton.addEventListener('click', () => chrome.storage.sync.remove('pinnedNoteId'));
  chrome.storage.onChanged.addListener(changes => {
    if (changes.pinnedNoteId || !isEditing) refresh();
  });
  refresh();

  function escapeHtml(value) {
    return value.replace(/[&<>'"]/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[character]));
  }
})();
