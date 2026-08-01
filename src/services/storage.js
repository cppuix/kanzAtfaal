// ===== STORAGE SERVICE =====
// Owns ALL persistence (localStorage). Reads/writes app state only via store actions.
import { CONTENT_FILES } from './content.js';

let quizHistory = {};
let modeStats = {};

// Keys are namespaced per content dataset (meta.id), read from the store's CFG
function contentKey(suffix) {
  let id = 'default';
  try {
    const store = Alpine.store('app');
    id = (store && store.CFG && store.CFG.meta && store.CFG.meta.id) || 'default';
  } catch(e) {}
  return suffix + '_' + id;
}

export function loadStorage() {
  try {
    const favs = JSON.parse(localStorage.getItem(contentKey('favs')) || '[]');
    const store = Alpine.store('app');
    if (store) store.setFavorites(favs);
  } catch(e) {}
}

export function saveFavorites() {
  let favs = [];
  try {
    const store = Alpine.store('app');
    if (store && store.favorites) favs = store.favorites;
  } catch(e) {}
  localStorage.setItem(contentKey('favs'), JSON.stringify(favs));
}

export function loadQuizHistory() {
  try {
    quizHistory = JSON.parse(localStorage.getItem(contentKey('hist')) || '{}');
  } catch(e) { quizHistory = {}; }
  syncQuizHistory();
}

function syncQuizHistory() {
  const store = Alpine.store('app');
  if (store) store.setQuizHistory(quizHistory);
}

export function saveQuizHistory() {
  localStorage.setItem(contentKey('hist'), JSON.stringify(quizHistory));
  syncQuizHistory();
}

export function recordAnswer(id, correct, mode) {
  if (!quizHistory[id]) quizHistory[id] = { correct: 0, wrong: 0 };
  if (correct) quizHistory[id].correct++;
  else quizHistory[id].wrong++;
  if (mode) {
    if (!modeStats[mode]) modeStats[mode] = { correct: 0, wrong: 0 };
    if (correct) modeStats[mode].correct++;
    else modeStats[mode].wrong++;
    saveModeStats();
  }
  saveQuizHistory();
}

// ===== PER-ACTIVITY-TYPE STATS =====
export function loadModeStats() {
  try {
    modeStats = JSON.parse(localStorage.getItem(contentKey('modestats')) || '{}');
  } catch(e) { modeStats = {}; }
  syncModeStats();
}
function syncModeStats() {
  const store = Alpine.store('app');
  if (store) store.setModeStats(modeStats);
}
export function saveModeStats() {
  localStorage.setItem(contentKey('modestats'), JSON.stringify(modeStats));
  syncModeStats();
}

// ===== CONTENT CHOICE =====
// Moved here from content.js so ALL localStorage lives in this service.

export function loadSavedContent() {
  try {
    const saved = getSavedContentChoice();
    const store = Alpine.store('app');
    if (!store) return;
    if (saved && CONTENT_FILES.some(f => f.file === saved)) {
      store.setActiveContent(saved);
    } else {
      const userLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
      if (userLang.startsWith('en')) {
        store.setActiveContent('content.kanz-en.json');
        saveContentChoice('content.kanz-en.json');
      } else if (userLang.startsWith('ar')) {
        store.setActiveContent('content.kanz-ar.json');
        saveContentChoice('content.kanz-ar.json');
      }
    }
  } catch(e) {}
}

export function saveContentChoice(file) {
  try { localStorage.setItem('activeContent', file); } catch(e) {}
}

function getSavedContentChoice() {
  try { return localStorage.getItem('activeContent'); } catch(e) { return null; }
}

// ===== APPEARANCE SETTINGS (localStorage only here, per architecture rules) =====

export function loadSettings() {
  try {
    const font = localStorage.getItem('muntaqaa_font') || 'md';
    const contrast = localStorage.getItem('muntaqaa_contrast') === 'true';
    const theme = localStorage.getItem('muntaqaa_theme') || 'dark';
    const preset = localStorage.getItem('muntaqaa_fontpreset') || 'tajawal';
    const store = Alpine.store('app');
    if (store) store.setAppearance(font, contrast, theme, preset);
  } catch(e) {}
}

export function saveFontSize(size) {
  try { localStorage.setItem('muntaqaa_font', size); } catch(e) {}
}

export function saveContrast(on) {
  try { localStorage.setItem('muntaqaa_contrast', on); } catch(e) {}
}

export function saveTheme(theme) {
  try { localStorage.setItem('muntaqaa_theme', theme); } catch(e) {}
}

export function saveFontPreset(preset) {
  try { localStorage.setItem('muntaqaa_fontpreset', preset); } catch(e) {}
}


