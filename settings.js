const savedState = document.getElementById('savedState');
const notesKey = 'notesArray';

function showSaved() {
  savedState.textContent = 'Changes saved';
  window.clearTimeout(showSaved.timeout);
  showSaved.timeout = window.setTimeout(() => { savedState.textContent = 'All changes saved'; }, 1600);
}

function saveSetting(key, value) {
  chrome.storage.sync.set({ [key]: value }, showSaved);
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
}

function applyAccent(accent) {
  const colors = { teal: '#3f7568', amber: '#d08b3e', blue: '#4c83a8', rose: '#b96b72' };
  document.documentElement.style.setProperty('--accent', colors[accent] || colors.teal);
}

function renderStats(notes) {
  const tags = new Set(notes.flatMap(note => Array.isArray(note.tags) ? note.tags : []));
  const domains = new Set(notes.map(note => note.url).filter(Boolean));
  document.getElementById('noteCount').textContent = notes.length;
  document.getElementById('tagCount').textContent = tags.size;
  document.getElementById('domainCount').textContent = domains.size;
}

function downloadJson(data) {
  const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), notes: data }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'StickyNotes_Backup.json';
  link.click();
  URL.revokeObjectURL(url);
}

chrome.storage.sync.get([notesKey, 'displayMode', 'startupTab', 'settingsTheme', 'settingsAccent'], data => {
  const notes = Array.isArray(data[notesKey]) ? data[notesKey] : [];
  renderStats(notes);
  if (data.displayMode) {
    const selectedMode = document.querySelector(`input[name="displayMode"][value="${data.displayMode}"]`);
    if (selectedMode) selectedMode.checked = true;
  }
  if (data.startupTab) document.getElementById('startupTab').value = data.startupTab;
  applyTheme(data.settingsTheme || 'light');
  applyAccent(data.settingsAccent || 'teal');
  document.querySelectorAll('.theme-option').forEach(button => button.classList.toggle('active', button.dataset.theme === (data.settingsTheme || 'light')));
  document.querySelectorAll('.accent-option').forEach(button => button.classList.toggle('active', button.dataset.accent === (data.settingsAccent || 'teal')));
});

document.querySelectorAll('input[name="displayMode"]').forEach(input => input.addEventListener('change', event => saveSetting('displayMode', event.target.value)));
document.getElementById('startupTab').addEventListener('change', event => saveSetting('startupTab', event.target.value));
document.getElementById('shortcutBtn').addEventListener('click', () => {
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});
document.querySelectorAll('.theme-option').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.theme-option').forEach(item => item.classList.remove('active'));
  button.classList.add('active');
  applyTheme(button.dataset.theme);
  saveSetting('settingsTheme', button.dataset.theme);
}));
document.querySelectorAll('.accent-option').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.accent-option').forEach(item => item.classList.remove('active'));
  button.classList.add('active');
  applyAccent(button.dataset.accent);
  saveSetting('settingsAccent', button.dataset.accent);
}));

document.getElementById('exportBtn').addEventListener('click', () => chrome.storage.sync.get([notesKey], data => downloadJson(Array.isArray(data[notesKey]) ? data[notesKey] : [])));
document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importInput').click());
document.getElementById('importInput').addEventListener('change', event => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const backup = JSON.parse(reader.result);
      if (!backup || !Array.isArray(backup.notes)) throw new Error('Invalid backup');
      chrome.storage.sync.set({ [notesKey]: backup.notes }, () => { renderStats(backup.notes); showSaved(); });
    } catch (error) {
      alert('This file is not a valid Sticky Notes backup.');
    }
    event.target.value = '';
  };
  reader.readAsText(file);
});
