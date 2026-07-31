// ===== BOOT — Service Registration + Init =====
// Store and Alpine.data components are registered by src/store-init.js (runs before this module)

import { loadContent, applyDeepLink } from './services/content.js';
import { loadStorage, loadQuizHistory, loadSettings, loadSavedContent, saveFavorites, recordAnswer, saveFontSize, saveContrast } from './services/storage.js';
import { playAudio, stopAllAudio, stopListenAudio, playListenAudio } from './services/audio.js';
import { showToast } from './services/toast.js';
import { spawnSparkles } from './services/sparkles.js';
import { copyQA, shareAsImage, shareDeepLink } from './services/share.js';

// Expose service functions to window so store-init.js methods can call them
window.__playAudio = playAudio;
window.__stopAllAudio = stopAllAudio;
window.__stopListenAudio = stopListenAudio;
window.__playListenAudio = playListenAudio;
window.__showToast = showToast;
window.__spawnSparkles = spawnSparkles;
window.__copyQA = copyQA;
window.__shareAsImage = shareAsImage;
window.__saveFavorites = saveFavorites;
window.__recordAnswer = recordAnswer;
window.__normalizeAr = normalizeAr;
window.__loadContent = loadContent;
window.__loadStorage = loadStorage;
window.__loadQuizHistory = loadQuizHistory;
window.__saveFontSize = saveFontSize;
window.__saveContrast = saveContrast;
window.__shareDeepLink = shareDeepLink;

// Utilities exposed to Alpine templates
function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function normalizeAr(str) {
  return str
    .replace(/[ً-ٰٟ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function buildHighlight(text, query) {
  if (!query.trim()) return escHtml(text);
  const normText  = normalizeAr(text);
  const normQuery = normalizeAr(query);
  const idx = normText.indexOf(normQuery);
  if (idx !== -1) {
    let origStart = -1, origEnd = -1;
    let ni = 0;
    for (let i = 0; i < text.length; i++) {
      const nc = normalizeAr(text[i]);
      if (ni === idx && origStart === -1) origStart = i;
      ni += nc.length;
      if (ni === idx + normQuery.length) { origEnd = i + 1; break; }
    }
    if (origStart !== -1 && origEnd !== -1) {
      return escHtml(text.slice(0, origStart))
        + '<mark>' + escHtml(text.slice(origStart, origEnd)) + '</mark>'
        + escHtml(text.slice(origEnd));
    }
  }
  let result = '';
  let qi = 0;
  const normQ = normalizeAr(query);
  for (let i = 0; i < text.length; i++) {
    const nc = normalizeAr(text[i]);
    if (qi < normQ.length && nc === normQ[qi]) {
      result += '<mark>' + escHtml(text[i]) + '</mark>';
      qi++;
    } else {
      result += escHtml(text[i]);
    }
  }
  return result;
}

window.buildHighlight = buildHighlight;
window.escHtml = escHtml;
window.normalizeAr = normalizeAr;

// ===== INIT =====
function init() {
  loadSavedContent();
  applyDeepLink();
  const store = Alpine.store('app');
  loadContent(store && store.activeContent ? store.activeContent : 'content.ar.json').then(() => {
    loadStorage();
    loadQuizHistory();
    loadSettings();
    if (store && store.renderCards) store.renderCards();
    // Splash is Alpine-driven: flipping appReady fades the splash out
    if (store && store.setAppReady) store.setAppReady(true);
  });
}

document.addEventListener('DOMContentLoaded', init);

// ===== PWA SERVICE WORKER =====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
