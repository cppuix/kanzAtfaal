// ===== BOOT — Service Registration + Init =====
// Store and Alpine.data components are registered by src/store-init.js (runs before this module)

import { loadContent, loadSavedContent, applyDeepLink, activeContent, applyFontSize, applyContrast, currentFontSize, highContrast } from './services/content.js';
import { loadStorage, loadQuizHistory } from './services/storage.js';
import { playAudio, stopAllAudio, stopListenAudio, playListenAudio } from './services/audio.js';
import { showToast } from './services/toast.js';
import { spawnSparkles } from './services/sparkles.js';
import { copyQA, shareAsImage, shareDeepLink } from './services/share.js';
import { saveFavorites, recordAnswer } from './services/storage.js';

// Expose service functions to window so store-init.js methods can call them
window.__playAudio = playAudio;
window.__stopAllAudio = stopAllAudio;
window.__stopListenAudio = stopListenAudio;
window.__showToast = showToast;
window.__spawnSparkles = spawnSparkles;
window.__copyQA = copyQA;
window.__shareAsImage = shareAsImage;
window.__saveFavorites = saveFavorites;
window.__recordAnswer = recordAnswer;
window.__normalizeAr = normalizeAr;

// Fuzzy search function used by store getters
function fuzzyScore(text, query) {
  var t = normalizeAr(text);
  var q = normalizeAr(query);
  if (!q || q.length < 2) return 0;
  if (t.includes(q)) return 1;
  var minLen = Math.ceil(q.length * 0.75);
  for (var len = q.length - 1; len >= minLen; len--) {
    for (var start = 0; start <= q.length - len; start++) {
      var sub = q.slice(start, start + len);
      if (sub.length >= 2 && t.includes(sub)) {
        return 0.5 + 0.5 * (len / q.length);
      }
    }
  }
  return 0;
}
window.__fuzzyScore = fuzzyScore;

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
window.renderBrowse = function() {};

// ===== SPLASH =====
function hideSplash() {
  const splash = document.getElementById('splash');
  const app = document.getElementById('app');
  setTimeout(() => {
    splash.classList.add('fade-out');
    setTimeout(() => {
      splash.style.display = 'none';
      app.classList.remove('hidden');
    }, 800);
  }, 1800);
}

// ===== INIT =====
function init() {
  loadSavedContent();
  applyDeepLink();
  loadContent(activeContent).then(() => {
    loadStorage();
    loadQuizHistory();
    applyFontSize(currentFontSize);
    applyContrast(highContrast);
    // Populate browse cards and force Alpine re-evaluation
    var store = Alpine.store('app');
    if (store && store.refreshCards) store.refreshCards();
    Alpine.initTree(document.body);
    hideSplash();
  });
}

document.addEventListener('DOMContentLoaded', init);

// ===== PWA SERVICE WORKER =====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
