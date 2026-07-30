import { CFG, toArabic } from './content.js';

let quizHistory = {};

export function loadStorage() {
  try {
    const favs = JSON.parse(localStorage.getItem('favs_' + (CFG.meta && CFG.meta.id || 'default')) || '[]');
    try { Alpine.store('app').favorites = favs; } catch(e) {}
  } catch(e) {}
}

export function saveFavorites() {
  let favs;
  try {
    const store = Alpine.store('app');
    if (store && store.favorites) favs = store.favorites;
  } catch(e) {}
  if (!favs) favs = [];
  localStorage.setItem('favs_' + (CFG.meta && CFG.meta.id || 'default'), JSON.stringify(favs));
}

export function loadQuizHistory() {
  try {
    quizHistory = JSON.parse(localStorage.getItem('hist_' + (CFG.meta && CFG.meta.id || 'default')) || '{}');
  } catch(e) { quizHistory = {}; }
  updateWeakOption();
}

export function updateWeakOption() {
  const opt = document.getElementById('weakOption');
  if (!opt) return;
  const weakCount = getWeakIds().length;
  if (weakCount > 0) {
    opt.style.display = '';
    opt.textContent = CFG.ui.weakSpotsLabel.replace("{n}", toArabic(weakCount));
  } else {
    opt.style.display = 'none';
    const sel = document.getElementById('quizSection');
    if (sel && sel.value === '__weak__') sel.value = 'all';
  }
}

export function saveQuizHistory() {
  localStorage.setItem('hist_' + (CFG.meta && CFG.meta.id || 'default'), JSON.stringify(quizHistory));
  updateWeakOption();
}

export function recordAnswer(id, correct) {
  if (!quizHistory[id]) quizHistory[id] = { correct: 0, wrong: 0 };
  if (correct) quizHistory[id].correct++;
  else quizHistory[id].wrong++;
  saveQuizHistory();
}

export function getWeakIds() {
  return Object.entries(quizHistory)
    .filter(([, v]) => v.wrong > v.correct)
    .map(([id]) => parseInt(id));
}


