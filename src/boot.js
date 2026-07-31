// ===== BOOT — Service Registration + Init =====
// Store and Alpine.data components are registered by src/store-init.js (runs before this module)

import { loadContent, applyDeepLink } from './services/content.js';
import { loadStorage, loadQuizHistory, loadSettings, loadSavedContent, saveFavorites, recordAnswer, saveFontSize, saveContrast } from './services/storage.js';
import { playAudio, stopAllAudio, stopListenAudio, playListenAudio } from './services/audio.js';
import { copyQA, shareAsImage, shareDeepLink } from './services/share.js';

// Expose service functions to window so store-init.js methods can call them
window.__playAudio = playAudio;
window.__stopAllAudio = stopAllAudio;
window.__stopListenAudio = stopListenAudio;
window.__playListenAudio = playListenAudio;
window.__copyQA = copyQA;
window.__shareAsImage = shareAsImage;
window.__saveFavorites = saveFavorites;
window.__recordAnswer = recordAnswer;
window.__loadContent = loadContent;
window.__loadStorage = loadStorage;
window.__loadQuizHistory = loadQuizHistory;
window.__saveFontSize = saveFontSize;
window.__saveContrast = saveContrast;
window.__shareDeepLink = shareDeepLink;

// Escaping/search helpers (escHtml, normalizeAr, buildHighlight) live on the
// store (store-init.js) — templates use $store.app.*, so no window globals.

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
