// ===== CONTENT REGISTRY =====
// Add new content files here — they appear automatically in the picker
const CONTENT_FILES = [
  { file: 'content.ar.json',      label: 'منتقى عربي' },
  { file: 'content.kanz-ar.json', label: 'كنز عربي' },
  { file: 'content.kanz-en.json', label: 'Kanz EN' },
];
window.CONTENT_FILES = CONTENT_FILES;
let activeContent = CONTENT_FILES[0].file;

// ===== CONFIG & DATA (set by loadContent) =====
let CFG = {};       // meta + ui strings from content JSON
let QA_DATA = [];   // items array from content JSON
let SECTIONS = [];  // derived from QA_DATA

// ===== STATE =====
let state = {
  view: 'browse',
  section: 'all',
  search: '',
  searchScope: 'both',  // 'both' | 'q' | 'a'
  searchSection: 'all',
  favorites: new Set(),
  openCards: new Set(),
  quiz: {
    questions: [],
    current: 0,
    score: 0,
    answered: false,
    count: 5,
    section: 'all',
  }
};

// ===== ARABIC NUMERALS =====
function toArabic(n) {
  if (CFG.meta && CFG.meta.numerals === 'arabic') {
    return String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  }
  return String(n);
}

function getSectionIcon(s) { return ''; }

// ===== LOAD STORAGE =====
function loadStorage() {
  try {
    const favs = JSON.parse(localStorage.getItem('favs_' + (CFG.meta && CFG.meta.id || 'default')) || '[]');
    state.favorites = new Set(favs);
    // Sync to Alpine store
    try { Alpine.store('app').favorites = favs; } catch(e) {}
  } catch(e) {}
}
function saveFavorites() {
  // Read from Alpine store first (source of truth), fall back to old global
  let favs;
  try {
    const store = Alpine.store('app');
    if (store && store.favorites) favs = store.favorites;
  } catch(e) {}
  if (!favs) favs = [...state.favorites];
  localStorage.setItem('favs_' + (CFG.meta && CFG.meta.id || 'default'), JSON.stringify(favs));
}

function loadSavedContent() {
  try {
    const saved = localStorage.getItem('activeContent');
    if (saved && CONTENT_FILES.some(f => f.file === saved)) {
      activeContent = saved;
    } else {
      // Auto-select content based on browser language
      const userLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
      if (userLang.startsWith('en')) {
        activeContent = 'content.kanz-en.json';
        saveContentChoice();
      } else if (userLang.startsWith('ar')) {
        activeContent = 'content.kanz-ar.json';
        saveContentChoice();
      }
    }
  } catch (e) {}
}
function saveContentChoice() {
  try {
    localStorage.setItem('activeContent', activeContent);
  } catch (e) {}
}

// ===== QUIZ HISTORY =====
// quizHistory: { [id]: { correct: n, wrong: n } }
let quizHistory = {};

function loadQuizHistory() {
  try {
    quizHistory = JSON.parse(localStorage.getItem('hist_' + (CFG.meta && CFG.meta.id || 'default')) || '{}');
  } catch(e) { quizHistory = {}; }
  updateWeakOption();
}
function updateWeakOption() {
  const opt = document.getElementById('weakOption');
  if (!opt) return;
  const weakCount = getWeakIds().length;
  if (weakCount > 0) {
    opt.style.display = '';
    opt.textContent = CFG.ui.weakSpotsLabel.replace("{n}", toArabic(weakCount));
  } else {
    opt.style.display = 'none';
    // Reset to 'all' if currently selected
    const sel = document.getElementById('quizSection');
    if (sel && sel.value === '__weak__') sel.value = 'all';
  }
}
function saveQuizHistory() {
  localStorage.setItem('hist_' + (CFG.meta && CFG.meta.id || 'default'), JSON.stringify(quizHistory));
  updateWeakOption();
}
function recordAnswer(id, correct) {
  if (!quizHistory[id]) quizHistory[id] = { correct: 0, wrong: 0 };
  if (correct) quizHistory[id].correct++;
  else quizHistory[id].wrong++;
  saveQuizHistory();
}
function getWeakIds() {
  // Questions answered at least once with more wrong than correct
  return Object.entries(quizHistory)
    .filter(([, v]) => v.wrong > v.correct)
    .map(([id]) => parseInt(id));
}
function getWeakPool() {
  const ids = new Set(getWeakIds());
  return QA_DATA.filter(q => ids.has(q.id));
}

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

// ===== BUILD SECTION LIST (replaced by Alpine x-for, stub kept for quiz section options) =====
// ===== ARABIC NORMALISER =====
function normalizeAr(str) {
  return str
    .replace(/[ً-ٰٟ]/g, '') // strip diacritics/tashkeel
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Search score: requires a meaningful consecutive substring match
// Returns 0 (no match) or 0.5-1.0 (match quality)
function fuzzyScore(text, query) {
  const t = normalizeAr(text);
  const q = normalizeAr(query);
  if (!q || q.length < 2) return 0;

  // Exact substring — best score
  if (t.includes(q)) return 1;

  // Allow minor prefix variation: try all substrings of query >= 70% of length
  // e.g. query "الصلاة" matches "الصلا" — handles trailing letter typos
  const minLen = Math.ceil(q.length * 0.75);
  for (let len = q.length - 1; len >= minLen; len--) {
    for (let start = 0; start <= q.length - len; start++) {
      const sub = q.slice(start, start + len);
      if (sub.length >= 2 && t.includes(sub)) {
        return 0.5 + 0.5 * (len / q.length);
      }
    }
  }

  return 0; // no meaningful consecutive match found
}

// Build highlight HTML: wrap matched chars in <mark>
function buildHighlight(text, query) {
  if (!query.trim()) return escHtml(text);
  const normText  = normalizeAr(text);
  const normQuery = normalizeAr(query);

  // Try exact substring first
  const idx = normText.indexOf(normQuery);
  if (idx !== -1) {
    // Map normalised index back to original string approximately
    // (diacritics stripped, so lengths may differ — use char-by-char walk)
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

  // Fuzzy: mark each matched char individually
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

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

const FUZZY_THRESHOLD = 0.5;

// Returns array of {qa, matchIn: 'q'|'a'|'both'}
// ===== RENDER BROWSE (now Alpine-driven) =====
function renderBrowse() {
  // No-op: browse view rendering is handled by Alpine x-for + store.filteredCards
}

const CHEST_SVG = `<svg class="chest-icon" viewBox="0 0 28 21" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g class="chest-coins">
    <ellipse cx="9"  cy="14" rx="3.5" ry="2"   fill="#c9982a" opacity="0.9"/>
    <ellipse cx="14" cy="13" rx="4"   ry="2.2"  fill="#e8bf5a" opacity="0.95"/>
    <ellipse cx="19" cy="14" rx="3.5" ry="2"   fill="#c9982a" opacity="0.9"/>
  </g>
  <rect x="2" y="11" width="24" height="9" rx="2" fill="#5a3a1a" stroke="#c9982a" stroke-width="1.2"/>
  <rect x="4" y="13" width="20" height="5" rx="1" fill="#3a2208" stroke="#a07820" stroke-width="0.8"/>
  <rect x="11" y="9.5" width="6" height="5" rx="1.5" fill="#c9982a" stroke="#a07820" stroke-width="0.8"/>
  <circle cx="14" cy="12" r="1.2" fill="#172a1e" stroke="#a07820" stroke-width="0.5"/>
  <rect x="2" y="10.5" width="24" height="2" rx="0.5" fill="#c9982a" opacity="0.55"/>
  <rect class="chest-lid" x="2" y="2" width="24" height="10" rx="3" fill="#6a4520" stroke="#c9982a" stroke-width="1.2"/>
  <rect x="4.5" y="4" width="19" height="6" rx="1.5" fill="#4a2e0e" stroke="#a07820" stroke-width="0.7"/>
</svg>`;
window.CHEST_SVG = CHEST_SVG;

function favStarSVG(isFav) {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="${isFav ? '#c9982a' : 'none'}" stroke="${isFav ? '#c9982a' : '#6e6048'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>`;
}

const PLAY_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
const STOP_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>`;
// Expose SVG constants to window so Alpine templates can use them (const doesn't create window properties)
window.PLAY_SVG = PLAY_SVG;
window.STOP_SVG = STOP_SVG;

// ===== AUDIO PLAYER =====
let currentAudio = null;
let currentWrapper = null; // track wrapper so we can reset ALL play btns in it

function playAudio(id, btn, wrapper) {
  // Stop any currently playing audio
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    if (currentWrapper) resetAllPlayBtns(currentWrapper);
    // If tapping the same card, just stop
    if (currentWrapper === wrapper) {
      currentAudio = null;
      currentWrapper = null;
      return;
    }
  }

  const audio = new Audio(CFG.meta.audioPath.replace('{id}', id));
  currentAudio = audio;
  currentWrapper = wrapper;

  // Set all play btns in this card to "playing"
  wrapper.querySelectorAll('.play-btn').forEach(b => {
    b.innerHTML = STOP_SVG;
    b.classList.add('playing');
  });

  function onDone() {
    resetAllPlayBtns(wrapper);
    currentAudio = null;
    currentWrapper = null;
  }

  audio.addEventListener('ended', onDone);
  audio.addEventListener('error', onDone);
  audio.play().catch(onDone);
}

function resetAllPlayBtns(wrapper) {
  wrapper.querySelectorAll('.play-btn').forEach(b => {
    b.innerHTML = PLAY_SVG;
    b.classList.remove('playing');
  });
}

// Stop audio when navigating away
function stopAllAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (currentWrapper) {
    resetAllPlayBtns(currentWrapper);
    currentWrapper = null;
  }
}

function renderFavorites() {
  // No-op: favorites rendering handled by Alpine x-for
}

// ===== QUIZ =====
let quizQuestions = [];
let quizCurrent = 0;
let quizScore = 0;
let quizAnswered = false;
let quizMode = 'mcq'; // 'mcq' | 'build' | 'blank' | 'listen'
let buildPlaced = [];   // for build mode
let listenAudio = null; // for listen mode

function initQuiz() {
  // No-op: handled by store.initQuiz()
}

function hideAllModeZones() {
  ['quizChoices','buildZone','blankZone','listenZone'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
}

function renderQuizQuestion() {
  const qa = quizQuestions[quizCurrent];
  const total = quizQuestions.length;

  document.getElementById('quizProgressFill').style.width = `${(quizCurrent / total) * 100}%`;
  document.getElementById('quizProgressText').textContent = `${toArabic(quizCurrent + 1)} / ${toArabic(total)}`;
  document.getElementById('quizScoreBadge').textContent = `${CFG.ui.score}: ${toArabic(quizScore)}`;
  document.getElementById('quizFeedback').className = 'quiz-feedback hidden';
  document.getElementById('nextQuizBtn').classList.add('hidden');
  quizAnswered = false;
  hideAllModeZones();
  stopListenAudio();

  if (quizMode === 'mcq')    renderMCQ(qa);
  else if (quizMode === 'build')  renderBuild(qa);
  else if (quizMode === 'blank')  renderBlank(qa);
  else if (quizMode === 'listen') renderListen(qa);
}

// ── MCQ mode ──────────────────────────────────────────────
function renderMCQ(qa) {
  document.getElementById('quizQNum').textContent = CFG.ui.questionNum.replace("{n}", toArabic(qa.id));
  document.getElementById('quizQText').textContent = qa.q;
  const choicesEl = document.getElementById('quizChoices');
  choicesEl.classList.remove('hidden');
  choicesEl.innerHTML = '';
  const others = QA_DATA.filter(q => q.id !== qa.id).sort(() => Math.random() - 0.5).slice(0, 3);
  const choices = [qa, ...others].sort(() => Math.random() - 0.5);
  choices.forEach(choice => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.textContent = choice.a;
    btn.addEventListener('click', () => answerQuiz(choice.id === qa.id, btn, qa.a));
    choicesEl.appendChild(btn);
  });
}

// ── BUILD mode ────────────────────────────────────────────
function renderBuild(qa) {
  document.getElementById('quizQNum').textContent = CFG.ui.questionNum.replace("{n}", toArabic(qa.id));
  document.getElementById('quizQText').textContent = qa.q;
  const zone = document.getElementById('buildZone');
  zone.classList.remove('hidden');
  buildPlaced = [];

  const words = qa.a.trim().split(/\s+/);
  // Shuffle pool
  const shuffled = [...words].sort(() => Math.random() - 0.5);

  const answerEl = document.getElementById('buildAnswer');
  const poolEl   = document.getElementById('buildPool');
  const checkBtn = document.getElementById('buildCheck');
  answerEl.innerHTML = '<span class="build-placeholder">' + CFG.ui.placeTilesHint + '</span>';
  answerEl.classList.remove('build-correct', 'build-wrong');
  checkBtn.disabled = false;
  poolEl.innerHTML = '';
  checkBtn.classList.add('hidden');

  shuffled.forEach((word, i) => {
    const tile = document.createElement('button');
    tile.className = 'build-tile';
    tile.textContent = word;
    tile.dataset.word = word;
    tile.dataset.idx = i;
    tile.addEventListener('click', () => buildTileTap(tile, word, words, qa.a));
    poolEl.appendChild(tile);
  });
}

function buildTileTap(tile, word, correctWords, correctAnswer) {
  if (quizAnswered) return;
  if (tile.classList.contains('placed')) {
    // Remove from placed, return to pool
    buildPlaced = buildPlaced.filter(w => w.tileEl !== tile);
    tile.classList.remove('placed');
    updateBuildAnswer(correctWords);
    return;
  }
  // Place it
  buildPlaced.push({ word, tileEl: tile });
  tile.classList.add('placed');
  updateBuildAnswer(correctWords);
}

function updateBuildAnswer(correctWords) {
  const answerEl = document.getElementById('buildAnswer');
  const checkBtn = document.getElementById('buildCheck');
  if (buildPlaced.length === 0) {
    answerEl.innerHTML = '<span class="build-placeholder">' + CFG.ui.placeTilesHint + '</span>';
    checkBtn.classList.add('hidden');
    return;
  }
  answerEl.innerHTML = '';
  buildPlaced.forEach((p, i) => {
    const span = document.createElement('span');
    span.className = 'build-placed-tile removable';
    span.textContent = p.word;
    span.dataset.placedIdx = i;
    span.addEventListener('click', () => {
      if (quizAnswered) return;
      // Re-read current index from DOM attribute to avoid stale closure
      const currentIdx = buildPlaced.indexOf(p);
      if (currentIdx === -1) return;
      p.tileEl.classList.remove('placed');
      buildPlaced.splice(currentIdx, 1);
      updateBuildAnswer(correctWords);
    });
    answerEl.appendChild(span);
  });

  if (buildPlaced.length === correctWords.length) {
    checkBtn.classList.remove('hidden');
  } else {
    checkBtn.classList.add('hidden');
  }
}

function checkBuildAnswer(qa) {
  if (quizAnswered) return;
  const userAnswer = buildPlaced.map(p => p.word).join(' ');
  const correct = normalizeAr(userAnswer) === normalizeAr(qa.a);
  quizAnswered = true;
  // Disable pool tiles
  document.querySelectorAll('.build-tile').forEach(t => t.disabled = true);
  document.getElementById('buildCheck').disabled = true;
  recordAnswer(qa.id, correct);
  const feedback = document.getElementById('quizFeedback');
  if (correct) {
    quizScore++;
    document.getElementById('buildAnswer').classList.add('build-correct');
    feedback.className = 'quiz-feedback correct';
    feedback.textContent = CFG.ui.correctFeedback;
    spawnSparkles(document.getElementById('buildAnswer'), true);
  } else {
    document.getElementById('buildAnswer').classList.add('build-wrong');
    feedback.className = 'quiz-feedback wrong';
    feedback.innerHTML = `${CFG.ui.wrongOrderFeedback} <strong>${escHtml(qa.a)}</strong>`;
  }
  document.getElementById('nextQuizBtn').classList.remove('hidden');
  // Sync to Alpine store
  const __quizStore = Alpine.store('app');
  if (__quizStore) { __quizStore.quizScore = quizScore; __quizStore.quizAnswered = true; }
}

// ── BLANK mode ────────────────────────────────────────────
function renderBlank(qa) {
  document.getElementById('quizQNum').textContent = CFG.ui.questionNum.replace("{n}", toArabic(qa.id));
  document.getElementById('quizQText').textContent = qa.q;
  const zone = document.getElementById('blankZone');
  zone.classList.remove('hidden');

  // Pick the key word: longest word not in a stop-list
  const stopWords = new Set(CFG.meta.stopWords || []);
  const words = qa.a.trim().split(/\s+/);
  let keyIdx = 0, keyLen = 0;
  words.forEach((w, i) => {
    const clean = w.replace(/[^؀-ۿ]/g, '');
    if (clean.length > keyLen && !stopWords.has(clean)) {
      keyLen = clean.length; keyIdx = i;
    }
  });
  const keyWord = words[keyIdx];

  // Build display with blank
  const blankEl = document.getElementById('blankText');
  blankEl.innerHTML = words.map((w, i) =>
    i === keyIdx ? '<span class="blank-slot">_____</span>' : escHtml(w)
  ).join(' ');

  // 4 choices: correct + 3 distractors from other answers (same length words preferred)
  const allWords = QA_DATA
    .filter(q => q.id !== qa.id)
    .flatMap(q => q.a.split(/\s+/))
    .filter(w => w.length >= 3 && !stopWords.has(w.replace(/[^؀-ۿ]/g,'')));
  const distractors = [...new Set(allWords)]
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);
  const choices = [keyWord, ...distractors].sort(() => Math.random() - 0.5);

  const choicesEl = document.getElementById('blankChoices');
  choicesEl.innerHTML = '';
  choices.forEach(word => {
    const btn = document.createElement('button');
    btn.className = 'blank-choice-btn';
    btn.textContent = word;
    btn.addEventListener('click', () => answerBlank(word === keyWord, btn, keyWord, blankEl, keyIdx, words));
    choicesEl.appendChild(btn);
  });
}

function answerBlank(correct, btn, keyWord, blankEl, keyIdx, words) {
  if (quizAnswered) return;
  quizAnswered = true;
  document.querySelectorAll('.blank-choice-btn').forEach(b => {
    b.disabled = true;
    if (b.textContent === keyWord) b.classList.add('correct');
  });
  // Fill in the blank with chosen word
  blankEl.innerHTML = words.map((w, i) =>
    i === keyIdx
      ? `<span class="blank-filled ${correct ? 'correct' : 'wrong'}">${escHtml(btn.textContent)}</span>`
      : escHtml(w)
  ).join(' ');

  const feedback = document.getElementById('quizFeedback');
  recordAnswer(quizQuestions[quizCurrent].id, correct);
  if (correct) {
    quizScore++;
    btn.classList.add('correct');
    feedback.className = 'quiz-feedback correct';
    feedback.textContent = CFG.ui.correctBlankFeedback;
    spawnSparkles(btn, true);
  } else {
    btn.classList.add('wrong');
    feedback.className = 'quiz-feedback wrong';
    feedback.innerHTML = `${CFG.ui.wrongBlankFeedback} <strong>${escHtml(keyWord)}</strong>`;
  }
  document.getElementById('nextQuizBtn').classList.remove('hidden');
  // Sync to Alpine store
  const __quizStore = Alpine.store('app');
  if (__quizStore) { __quizStore.quizScore = quizScore; __quizStore.quizAnswered = true; }
}

// ── LISTEN mode ───────────────────────────────────────────
function renderListen(qa) {
  // Hide question text — they must identify from audio
  document.getElementById('quizQNum').textContent = '';
  document.getElementById('quizQText').textContent = '';
  const zone = document.getElementById('listenZone');
  zone.classList.remove('hidden');

  const playBtn = document.getElementById('listenPlay');
  playBtn.classList.remove('playing');
  playBtn.querySelector('span').textContent = CFG.ui.listen;
  playBtn.onclick = () => playListenAudio(qa.id, playBtn);

  // 4 question choices
  const others = QA_DATA.filter(q => q.id !== qa.id).sort(() => Math.random() - 0.5).slice(0, 3);
  const choices = [qa, ...others].sort(() => Math.random() - 0.5);
  const choicesEl = document.getElementById('listenChoices');
  choicesEl.innerHTML = '';
  choices.forEach(choice => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn listen-q-choice';
    btn.textContent = choice.a;
    btn.addEventListener('click', () => answerListen(choice.id === qa.id, btn, qa.a));
    choicesEl.appendChild(btn);
  });
}

function playListenAudio(id, btn) {
  stopListenAudio();
  listenAudio = new Audio(CFG.meta.audioPath.replace('{id}', id));
  btn.classList.add('playing');
  btn.querySelector('span').textContent = CFG.ui.listen + '...';
  listenAudio.addEventListener('ended', () => {
    btn.classList.remove('playing');
    btn.querySelector('span').textContent = CFG.ui.replay;
  });
  listenAudio.addEventListener('error', () => {
    btn.classList.remove('playing');
    btn.querySelector('span').textContent = CFG.ui.audioError;
    btn.disabled = true;
    btn.style.opacity = '0.5';
  });
  listenAudio.play().catch(() => {
    btn.classList.remove('playing');
    btn.querySelector('span').textContent = CFG.ui.audioError;
    btn.disabled = true;
    btn.style.opacity = '0.5';
  });
}

function stopListenAudio() {
  if (listenAudio) { listenAudio.pause(); listenAudio = null; }
}

function answerListen(correct, btn, correctQ) {
  if (quizAnswered) return;
  quizAnswered = true;
  stopListenAudio();
  document.querySelectorAll('.listen-q-choice').forEach(b => {
    b.disabled = true;
    if (b.textContent === correctQ) b.classList.add('correct');  // correctQ is now an answer
  });
  const feedback = document.getElementById('quizFeedback');
  recordAnswer(quizQuestions[quizCurrent].id, correct);
  if (correct) {
    quizScore++;
    btn.classList.add('correct');
    feedback.className = 'quiz-feedback correct';
    feedback.textContent = CFG.ui.correctListenFeedback;
    spawnSparkles(btn, true);
  } else {
    btn.classList.add('wrong');
    feedback.className = 'quiz-feedback wrong';
    feedback.innerHTML = `${CFG.ui.wrongListenFeedback} <strong>${escHtml(correctQ)}</strong>`;
  }
  document.getElementById('nextQuizBtn').classList.remove('hidden');
  // Sync to Alpine store
  const __quizStore = Alpine.store('app');
  if (__quizStore) { __quizStore.quizScore = quizScore; __quizStore.quizAnswered = true; }
}

function answerQuiz(correct, btn, correctText) {
  if (quizAnswered) return;
  quizAnswered = true;
  // Sync to Alpine store
  const store = Alpine.store('app');
  if (store) { store.quizAnswered = true; }

  document.querySelectorAll('.choice-btn').forEach(b => {
    b.disabled = true;
    if (b.textContent === correctText) b.classList.add('correct');
  });

  const feedback = document.getElementById('quizFeedback');
  const currentQA = quizQuestions[quizCurrent];
  recordAnswer(currentQA.id, correct);
  if (correct) {
    quizScore++;
    if (store) store.quizScore = quizScore;
    btn.classList.add('correct');
    feedback.className = 'quiz-feedback correct';
    feedback.textContent = CFG.ui.correctMCQFeedback;
    spawnSparkles(btn, true);
  } else {
    btn.classList.add('wrong');
    feedback.className = 'quiz-feedback wrong';
    feedback.innerHTML = `${CFG.ui.wrongMCQFeedback} <strong>${correctText}</strong>`;
  }
  document.getElementById('nextQuizBtn').classList.remove('hidden');
}

function nextQuizQuestion() {
  // No-op: handled by store.nextQuizQuestion()
}

function showQuizResult() {
  // Sync to Alpine store
  const store = Alpine.store('app');
  if (store) store.quizPhase = 'result';

  const total = quizQuestions.length;
  const pct = Math.round((quizScore / total) * 100);
  let title = CFG.ui.resultGreat, msg = CFG.ui.resultGreatMsg;

  if (pct < 40) { title = CFG.ui.resultTryAgain; msg = CFG.ui.resultTryAgainMsg; }
  else if (pct < 70) { title = CFG.ui.resultGood; msg = CFG.ui.resultGoodMsg; }
  else if (pct < 100) { title = CFG.ui.resultGreat; msg = CFG.ui.resultGreatMsg; }
  else { title = CFG.ui.resultPerfect; msg = CFG.ui.resultPerfectMsg; }

  document.getElementById('resultEmoji').innerHTML = `
    <svg class="result-chest" viewBox="0 0 80 60" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="22" cy="46" rx="9" ry="5" fill="#c9982a" opacity="0.85"/>
      <ellipse cx="40" cy="43" rx="11" ry="6" fill="#e8bf5a" opacity="0.95"/>
      <ellipse cx="58" cy="46" rx="9" ry="5" fill="#c9982a" opacity="0.85"/>
      <rect x="4" y="28" width="72" height="28" rx="4" fill="#4a2e0e" stroke="#c9982a" stroke-width="2"/>
      <rect x="10" y="33" width="60" height="18" rx="2" fill="#3a2208" stroke="#a07820" stroke-width="1"/>
      <rect x="33" y="24" width="14" height="12" rx="3" fill="#c9982a" stroke="#a07820" stroke-width="1.5"/>
      <circle cx="40" cy="29" r="3" fill="#0c1a12" stroke="#a07820" stroke-width="1"/>
      <rect x="4" y="26" width="72" height="5" rx="1" fill="#c9982a" opacity="0.55"/>
      <rect x="4" y="2" width="72" height="28" rx="6" fill="#6a4520" stroke="#c9982a" stroke-width="2" transform="rotate(-20 40 15)"/>
    </svg>`;
  document.getElementById('resultTitle').textContent = title;
  document.getElementById('resultScore').textContent = `${toArabic(quizScore)} / ${toArabic(total)}`;
  document.getElementById('resultMsg').textContent = msg;
  updateWeakOption();
}

// ===== VIEW SWITCHING (handled by Alpine store) =====
// ===== ABOUT / DRAWER / SEARCH (handled by Alpine) =====

// ===== TOAST =====
let toastTimer;
function showToast(msg) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
}

// ===== SEARCH (Alpine handles UI) =====

// ===== SPARKLE PARTICLE SYSTEM =====
function spawnSparkles(sourceEl, big = false) {
  const rect = sourceEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  const count = big ? 28 : 14;
  const colors = ['#f5d98a','#e8bf5a','#c9982a','#fff8dc','#ffe066','#f0c96a'];
  const shapes = ['●','◆','✦','★','·'];

  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.className = 'sparkle-particle';
    p.textContent = shapes[Math.floor(Math.random() * shapes.length)];

    // random spread angle
    const angle = (Math.PI * 2 * i / count) + (Math.random() - 0.5) * 0.8;
    const dist = big
      ? 60 + Math.random() * 90
      : 30 + Math.random() * 50;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    const size = big
      ? 10 + Math.random() * 10
      : 7 + Math.random() * 7;
    const dur = big
      ? 600 + Math.random() * 500
      : 450 + Math.random() * 350;
    const delay = Math.random() * (big ? 120 : 60);

    p.style.cssText = `
      left: ${cx}px;
      top: ${cy}px;
      font-size: ${size}px;
      color: ${colors[Math.floor(Math.random() * colors.length)]};
      --dx: ${dx}px;
      --dy: ${dy}px;
      animation: sparklefly ${dur}ms ease-out ${delay}ms forwards;
    `;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), dur + delay + 50);
  }

  // On big burst: brief screen shimmer overlay
  if (big) {
    const shimmer = document.createElement('div');
    shimmer.className = 'win-shimmer';
    document.body.appendChild(shimmer);
    setTimeout(() => shimmer.remove(), 600);
  }
}




// ===== LOAD CONTENT =====
async function loadContent(jsonPath) {
  const res = await fetch(jsonPath);
  const json = await res.json();
  CFG = { meta: json.meta, ui: json.ui, about: json.about || null };
  QA_DATA = json.items || [];
  SECTIONS = [...new Set(QA_DATA.map(q => q.section))];
  activeContent = jsonPath;  // Update global so store sync gets the right file

  // Sync to Alpine store so Alpine-bound UI sees the data
  try {
    const store = Alpine.store('app');
    if (store) {
      store.CFG = CFG;
      store.QA_DATA = QA_DATA;
      store.SECTIONS = SECTIONS;
      store.activeContent = activeContent;
      store.contentLoaded = true;
    }
  } catch(e) {}

  // Apply direction and lang to document
  document.documentElement.dir = CFG.meta.dir || 'rtl';
  document.documentElement.lang = CFG.meta.lang || 'ar';

  // Apply font class
  document.body.dataset.fonts = (CFG.meta.fonts || []).join(',').toLowerCase();

  // Update static UI strings that are in the HTML
  const q = id => document.getElementById(id);
  const setTxt = (id, val) => { const el = q(id); if (el && val) el.textContent = val; };
  const setAttr = (id, attr, val) => { const el = q(id); if (el && val) el.setAttribute(attr, val); };

  setTxt('appTitleEl', CFG.ui.appTitle);
  setAttr('searchInput', 'placeholder', CFG.ui.searchPlaceholder);
  setTxt('allSectionsFilter', CFG.ui.scopeAll || CFG.ui.allSectionsShort);
  setTxt('scopeQBtn', CFG.ui.scopeQ);
  setTxt('scopeABtn', CFG.ui.scopeA);
  setTxt('currentSectionLabel', CFG.ui.allSections);
  setTxt('navBrowseLabel', CFG.ui.browseNav);
  setTxt('navFavsLabel', CFG.ui.favsNav);
  setTxt('navQuizLabel', CFG.ui.quizNav);
  setTxt('noFavsTitle', CFG.ui.noFavsTitle);
  setTxt('noFavsHint', CFG.ui.noFavsHint);
  setTxt('startQuiz', CFG.ui.startQuiz);
  setTxt('nextQuizBtn', CFG.ui.next);
  setTxt('retryQuiz', CFG.ui.retry);
  setTxt('quizScoreBadge', `${CFG.ui.score}: ${toArabic(0)}`);
  setTxt('allChaptersOpt', CFG.ui.allChapters);
  setTxt('questionCountLabel', CFG.ui.questionCount);
  setTxt('quizHeaderLabel', CFG.ui.quizHeader);
  setTxt('quizSubHeaderLabel', CFG.ui.quizSubHeader);
  setTxt('quizTypeLabel', CFG.ui.quizType);
  setTxt('modeMCQLabel', CFG.ui.modeMCQ);
  setTxt('modeBuildLabel', CFG.ui.modeBuild);
  setTxt('modeBlankLabel', CFG.ui.modeBlank);
  setTxt('modeListenLabel', CFG.ui.modeListen);
  setTxt('favSectionLabel', CFG.ui.favoritesTitle);
  setTxt('drawerSectionsTitle', CFG.ui.allSectionsShort);
  setTxt('navBrowseDrawerLabel', CFG.ui.browseNav);
  setTxt('navFavsDrawerLabel', CFG.ui.favsNav);
  setTxt('navQuizDrawerLabel', CFG.ui.quizNav);
  setTxt('navAboutLabel', CFG.ui.aboutBtn);
  setTxt('settingsTitleEl', CFG.ui.settingsTitle);

  // Render about modal content from JSON
  const aboutTitleEl = document.getElementById('aboutTitle');
  const aboutBodyEl = document.getElementById('aboutBody');
  if (aboutTitleEl && CFG.about) {
    aboutTitleEl.textContent = CFG.about.title;
    let html = CFG.about.body.map(p => `<p>${p}</p>`).join('');
    if (CFG.about.contactTitle && CFG.about.contacts) {
      html += '<div class="about-divider"></div>'
        + `<h2 class="about-contact-title">${CFG.about.contactTitle}</h2>`
        + '<ul class="about-contact">'
        + CFG.about.contacts.map(c =>
            `<li><span class="about-contact-label">${c.label}</span>`
            + `<a href="${c.href}">${c.value}</a></li>`
          ).join('')
        + '</ul>';
    }
    aboutBodyEl.innerHTML = html;
  }

  // Rebuild content menu to reflect active file
  buildSettingsPanel();

  // Keep listen button label in sync — updated on play/replay/error in playListenAudio
  const listenLbl = document.getElementById('listenBtnLabel');
  if (listenLbl) listenLbl.textContent = CFG.ui.listen;

  // Hide audio-dependent UI if content has no audio
  const listenModeBtn = document.querySelector('.mode-btn[data-mode="listen"]');
  if (listenModeBtn) listenModeBtn.style.display = CFG.meta.audio ? '' : 'none';

  // Hide audio controls if no audio in this content
  document.querySelectorAll('.play-btn').forEach(b => {
    b.style.display = CFG.meta.audio ? '' : 'none';
  });
}

// ===== INIT (minimal — Alpine handles UI, this only loads content) =====
function init() {
  loadSavedContent();
  applyDeepLink();
  loadContent(activeContent).then(() => {
    loadStorage();
    loadQuizHistory();
    applyFontSize(currentFontSize);
    applyContrast(highContrast);
    hideSplash();
  });
}


// ===== INIT (runs immediately — don't gate on SW ready) =====
document.addEventListener('DOMContentLoaded', () => {
  init();
});

// ===== PWA SERVICE WORKER (registered independently, never blocks app) =====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// ═══════════════════════════════════════════════════════════════════
// ===== FEATURE: DEEP LINKS =====
// ═══════════════════════════════════════════════════════════════════
function applyDeepLink() {
  const params = new URLSearchParams(location.search);
  const content = params.get('content');
  const section = params.get('section');
  if (content && CONTENT_FILES.some(f => f.file === content)) {
    activeContent = content;
  }
  if (section) {
    state.section = section;
  }
}

function buildDeepLink() {
  const url = new URL(location.href);
  url.search = '';
  url.hash = '';
  return url.toString();
}

async function shareDeepLink() {
  const url = buildDeepLink();
  if (navigator.share) {
    await navigator.share({ title: CFG.ui.appTitle, url }).catch(() => {});
  } else {
    await navigator.clipboard.writeText(url);
    showToast(CFG.ui.deepLinkCopied);
  }
}

// ═══════════════════════════════════════════════════════════════════
// ===== FEATURE: COPY TEXT =====
// ═══════════════════════════════════════════════════════════════════
async function copyQA(qa) {
  const text = `${qa.q}\n${qa.a}`;
  await navigator.clipboard.writeText(text);
  showToast(CFG.ui.copied);
}

// ═══════════════════════════════════════════════════════════════════
// ===== FEATURE: SHARE AS IMAGE =====
// ═══════════════════════════════════════════════════════════════════
async function shareAsImage(qa) {
  // Ensure page fonts are ready (Amiri/Tajawal already loaded by CSS)
  await document.fonts.ready;

  const canvas = document.createElement('canvas');
  const W = 1080, H = 1080;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const isRTL = document.documentElement.dir === 'rtl';
  const FONT = isRTL ? 'Amiri, serif' : 'Georgia, serif';

  // Background
  ctx.fillStyle = '#0c1a12';
  ctx.fillRect(0, 0, W, H);

  // Subtle radial glow
  const grd = ctx.createRadialGradient(W/2, H*0.3, 0, W/2, H*0.3, W*0.7);
  grd.addColorStop(0, 'rgba(40,80,30,0.5)');
  grd.addColorStop(1, 'transparent');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);

  // Card background
  ctx.fillStyle = '#172a1e';
  roundRect(ctx, 60, 60, W-120, H-120, 32);
  ctx.fill();

  // Gold border
  ctx.strokeStyle = 'rgba(201,152,42,0.4)';
  ctx.lineWidth = 2;
  roundRect(ctx, 60, 60, W-120, H-120, 32);
  ctx.stroke();

  // Top accent line
  const grad = ctx.createLinearGradient(60, 0, W-60, 0);
  grad.addColorStop(0, 'transparent');
  grad.addColorStop(0.5, '#c9982a');
  grad.addColorStop(1, 'transparent');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(60, 92); ctx.lineTo(W-60, 92); ctx.stroke();

  const X      = isRTL ? W-100 : 100;   // text anchor x
  const ALIGN  = isRTL ? 'right' : 'left';

  // ── Q number pill ──
  const numText = CFG.ui.questionNum.replace('{n}', qa.id);
  ctx.font = `bold 26px ${FONT}`;
  const pillTextW = ctx.measureText(numText).width;
  const pillPad = 28, pillH = 46, pillY = 95;
  const pillW = pillTextW + pillPad * 2;
  const pillX = isRTL ? W - 100 - pillW : 100;
  ctx.fillStyle = 'rgba(201,152,42,0.18)';
  ctx.beginPath(); ctx.roundRect(pillX, pillY, pillW, pillH, 23); ctx.fill();
  ctx.strokeStyle = 'rgba(201,152,42,0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(pillX, pillY, pillW, pillH, 23); ctx.stroke();
  ctx.fillStyle = '#e8bf5a';
  ctx.textAlign = 'center';
  ctx.fillText(numText, pillX + pillW / 2, pillY + 31);

  // ── Section tag — clearly below pill with breathing room ──
  ctx.fillStyle = '#7a6a50';
  ctx.font = `22px ${FONT}`;
  ctx.textAlign = ALIGN;
  ctx.fillText(qa.section, X, 178);

  // ── Top divider ──
  ctx.strokeStyle = 'rgba(201,152,42,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(100, 198); ctx.lineTo(W-100, 198); ctx.stroke();

  // ── Question text ──
  ctx.fillStyle = '#ecdec4';
  wrapText(ctx, qa.q, X, 258, W-200, 50, ALIGN, `38px ${FONT}`);

  // ── Answer divider ──
  const midY = 530;
  const grd2 = ctx.createLinearGradient(100, 0, W-100, 0);
  grd2.addColorStop(0, 'transparent');
  grd2.addColorStop(0.5, 'rgba(201,152,42,0.5)');
  grd2.addColorStop(1, 'transparent');
  ctx.strokeStyle = grd2;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(100, midY); ctx.lineTo(W-100, midY); ctx.stroke();

  // ── Answer label ──
  ctx.fillStyle = '#c9982a';
  ctx.font = `bold 26px ${FONT}`;
  ctx.textAlign = ALIGN;
  ctx.fillText(CFG.ui.answerLabel, X, midY + 52);

  // ── Answer text ──
  ctx.fillStyle = '#f5d98a';
  wrapText(ctx, qa.a, X, midY + 108, W-200, 46, ALIGN, `36px ${FONT}`);

  // ── Watermark ──
  ctx.fillStyle = 'rgba(110,96,72,0.6)';
  ctx.font = '20px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('cppuix.github.io/kanzAtfaal', W/2, H-82);

  // ── Corner ornaments ──
  ctx.fillStyle = 'rgba(201,152,42,0.25)';
  ctx.font = `44px ${FONT}`;
  ctx.textAlign = 'left';  ctx.fillText('✦', 82, 114);
  ctx.textAlign = 'right'; ctx.fillText('✦', W-82, 114);
  ctx.textAlign = 'left';  ctx.fillText('❖', 82, H-82);
  ctx.textAlign = 'right'; ctx.fillText('❖', W-82, H-82);

  // Share or download
  canvas.toBlob(async blob => {
    const file = new File([blob], `qa-${qa.id}.png`, { type: 'image/png' });
    if (navigator.share && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: CFG.ui.appTitle }).catch(() => {});
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `qa-${qa.id}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    }
  }, 'image/png');
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxW, lineH, align, font) {
  ctx.font = font;
  ctx.textAlign = align;
  const words = text.split(' ');
  let line = '';
  let cy = y;
  for (let i = 0; i < words.length; i++) {
    const test = line ? line + ' ' + words[i] : words[i];
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, cy);
      line = words[i];
      cy += lineH;
      if (cy > 980) { ctx.fillText('…', x, cy); break; }
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cy);
}

// ═══════════════════════════════════════════════════════════════════
// ===== FEATURE: FONT SIZE =====
// ═══════════════════════════════════════════════════════════════════
const FONT_SCALES = { sm: '0.82', md: '1', lg: '1.35' };
let currentFontSize = localStorage.getItem('muntaqaa_font') || 'md';

function applyFontSize(size) {
  currentFontSize = size;
  document.documentElement.style.setProperty('--font-scale', FONT_SCALES[size]);
  localStorage.setItem('muntaqaa_font', size);
  document.querySelectorAll('.font-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.size === size)
  );
}

// ═══════════════════════════════════════════════════════════════════
// ===== FEATURE: HIGH CONTRAST =====
// ═══════════════════════════════════════════════════════════════════
let highContrast = localStorage.getItem('muntaqaa_contrast') === 'true';

function applyContrast(on) {
  highContrast = on;
  document.documentElement.classList.toggle('high-contrast', on);
  localStorage.setItem('muntaqaa_contrast', on);
  const btn = document.getElementById('contrastToggle');
  if (btn) btn.classList.toggle('active', on);
}

// ═══════════════════════════════════════════════════════════════════
// ===== SETTINGS PANEL =====
// ═══════════════════════════════════════════════════════════════════
function buildSettingsPanel() {
  const panel = document.getElementById('settingsPanel');
  if (!panel) return;
  panel.innerHTML = `
    <div class="settings-row">
      <span class="settings-label">${CFG.ui.fontSizeLabel}</span>
      <div class="settings-btns">
        <button class="font-btn${currentFontSize==='sm'?' active':''}" data-size="sm">A</button>
        <button class="font-btn${currentFontSize==='md'?' active':''}" data-size="md">A</button>
        <button class="font-btn${currentFontSize==='lg'?' active':''}" data-size="lg">A</button>
      </div>
    </div>
    <div class="settings-row">
      <span class="settings-label">${CFG.ui.contrastLabel}</span>
      <button class="settings-toggle${highContrast?' active':''}" id="contrastToggle">
        <span class="toggle-knob"></span>
      </button>
    </div>
    <div class="settings-row">
      <span class="settings-label">${CFG.ui.shareAppUrl}</span>
      <button class="settings-action-btn" id="shareUrlBtn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
      </button>
    </div>
  `;
  panel.querySelectorAll('.font-btn').forEach(btn =>
    btn.addEventListener('click', () => applyFontSize(btn.dataset.size))
  );
  document.getElementById('contrastToggle').addEventListener('click', () => applyContrast(!highContrast));
  document.getElementById('shareUrlBtn').addEventListener('click', shareDeepLink);
}


// ═══════════════════════════════════════════════════════════════════
// ===== ALPINE.JS STORE & COMPONENTS =====
// ═══════════════════════════════════════════════════════════════════
document.addEventListener('alpine:init', () => {
  Alpine.store('app', {
    // ── Content data ──
    CFG: {},
    QA_DATA: [],
    SECTIONS: [],
    activeContent: 'content.kanz-ar.json',
    contentLoaded: false,

    // ── UI state ──
    view: 'browse',           // 'browse' | 'favorites' | 'quiz'
    section: 'all',
    drawerOpen: false,
    searchOpen: false,
    search: '',
    searchScope: 'both',      // 'both' | 'q' | 'a'
    searchSection: 'all',
    aboutOpen: false,
    settingsOpen: false,

    // ── Favorites & open cards ──
    favorites: [],
    openCards: [],

    // ── Quiz state ──
    quizMode: 'mcq',          // 'mcq' | 'build' | 'blank' | 'listen'
    quizCount: 5,
    quizSection: 'all',
    quizQuestions: [],
    quizCurrent: 0,
    quizScore: 0,
    quizAnswered: false,
    quizPhase: 'setup',       // 'setup' | 'game' | 'result'
    quizHistory: {},

    // ── Settings ──
    fontSize: localStorage.getItem('muntaqaa_font') || 'md',
    highContrast: localStorage.getItem('muntaqaa_contrast') === 'true',

    // ── Pagination ──
    visibleCount: 30,
    PAGE_SIZE: 30,
    browseSentinel: null,
    browseObserver: null,

    // ── Computed / derived ──
    get filteredCards() {
      let data = this.QA_DATA;
      const activeSection = this.search.trim() ? this.searchSection : this.section;
      if (activeSection !== 'all') data = data.filter(q => q.section === activeSection);
      if (!this.search.trim()) return data.map(qa => ({ qa, matchIn: 'q' }));
      // Use the existing fuzzyScore function from vanilla code
      const scope = this.searchScope;
      return data
        .map(qa => {
          const qScore = (scope === 'both' || scope === 'q') ? fuzzyScore(qa.q, this.search) : 0;
          const aScore = (scope === 'both' || scope === 'a') ? fuzzyScore(qa.a, this.search) : 0;
          const score = Math.max(qScore, aScore);
          let matchIn = 'q';
          if (aScore > qScore) matchIn = 'a';
          else if (qScore > 0 && aScore > 0) matchIn = 'both';
          return { qa, score, matchIn };
        })
        .filter(x => x.score >= FUZZY_THRESHOLD)
        .sort((a, b) => b.score - a.score);
    },

    get visibleCards() {
      return this.filteredCards.slice(0, this.visibleCount);
    },

    get hasMore() {
      return this.visibleCount < this.filteredCards.length;
    },

    get weakIds() {
      return Object.entries(this.quizHistory)
        .filter(([, v]) => v.wrong > v.correct)
        .map(([id]) => parseInt(id));
    },

    get weakPool() {
      const ids = new Set(this.weakIds);
      return this.QA_DATA.filter(q => ids.has(q.id));
    },

    get currentQuestion() {
      return this.quizQuestions[this.quizCurrent] || null;
    },

    get quizProgress() {
      if (!this.quizQuestions.length) return 0;
      return (this.quizCurrent / this.quizQuestions.length) * 100;
    },

    // ── Methods ──
    async loadContent(file) {
      this.activeContent = file;
      saveContentChoice();

      const res = await fetch(file);
      const json = await res.json();
      this.CFG = { meta: json.meta, ui: json.ui, about: json.about || null };
      this.QA_DATA = json.items || [];
      this.SECTIONS = [...new Set(this.QA_DATA.map(q => q.section))];

      document.documentElement.dir = this.CFG.meta.dir || 'rtl';
      document.documentElement.lang = this.CFG.meta.lang || 'ar';
      document.body.dataset.fonts = (this.CFG.meta.fonts || []).join(',').toLowerCase();

      // Apply font size and contrast
      this.applyFontSize(this.fontSize);
      this.applyContrast(this.highContrast);

      this.contentLoaded = true;
    },

    toggleDrawer() {
      this.drawerOpen = !this.drawerOpen;
      // Sync with old JS DOM state
      if (this.drawerOpen) {
        document.getElementById('drawer')?.classList.add('open');
        document.getElementById('overlay')?.classList.remove('hidden');
      } else {
        document.getElementById('drawer')?.classList.remove('open');
        document.getElementById('overlay')?.classList.add('hidden');
      }
    },
    closeDrawer() {
      this.drawerOpen = false;
      document.getElementById('drawer')?.classList.remove('open');
      document.getElementById('overlay')?.classList.add('hidden');
    },

    switchView(view) {
      stopAllAudio();
      this.view = view;
      this.drawerOpen = false;
      document.getElementById('drawer')?.classList.remove('open');
      document.getElementById('overlay')?.classList.add('hidden');
      if (view === 'quiz') {
        this.quizPhase = 'setup';
      }
    },

    setSection(sec) {
      this.section = sec;
      this.search = '';
      this.drawerOpen = false;
      this.resetPagination();
      document.getElementById('searchInput') && (document.getElementById('searchInput').value = '');
      document.getElementById('drawer')?.classList.remove('open');
      document.getElementById('overlay')?.classList.add('hidden');
    },

    toggleSearch() {
      this.searchOpen = !this.searchOpen;
      if (!this.searchOpen) {
        this.search = '';
        this.searchSection = 'all';
        this.searchScope = 'both';
        this.resetPagination();
      }
    },

    setSearchScope(scope) {
      this.searchScope = scope;
      this.resetPagination();
    },
    setSearchSection(sec) {
      this.searchSection = sec;
      this.resetPagination();
    },

    toggleFav(id) {
      const idx = this.favorites.indexOf(id);
      if (idx !== -1) {
        this.favorites.splice(idx, 1);
        showToast(this.CFG.ui?.unsaved || 'تمت الإزالة');
      } else {
        this.favorites.push(id);
        showToast(this.CFG.ui?.saved || 'تمت الحفظ');
      }
      saveFavorites();
    },
    isFav(id) {
      return this.favorites.includes(id);
    },
    isOpen(id) {
      return this.openCards.includes(id);
    },
    toggleCard(id) {
      const idx = this.openCards.indexOf(id);
      if (idx !== -1) {
        this.openCards.splice(idx, 1);
      } else {
        this.openCards.push(id);
      }
    },

    toArabic(n) {
      if (this.CFG.meta?.numerals === 'arabic') {
        return String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
      }
      return String(n);
    },

    // ── Pagination ──
    resetPagination() {
      this.visibleCount = this.PAGE_SIZE;
      if (this.browseObserver) {
        this.browseObserver.disconnect();
        this.browseObserver = null;
      }
      this.browseSentinel = null;
    },

    loadMore() {
      if (!this.hasMore) return;
      this.visibleCount += this.PAGE_SIZE;
    },

    initSentinel(el) {
      if (this.browseObserver) this.browseObserver.disconnect();
      this.browseSentinel = el;
      this.browseObserver = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) {
          this.loadMore();
        }
      }, { rootMargin: '200px' });
      this.browseObserver.observe(el);
    },

    // ── Content switching ──
    async switchContent(file) {
      if (file === this.activeContent) return;
      // Reset all transient state
      this.section = 'all';
      this.search = '';
      this.searchScope = 'both';
      this.searchSection = 'all';
      this.openCards = [];
      this.quizQuestions = [];
      this.quizCurrent = 0;
      this.quizScore = 0;
      this.quizAnswered = false;
      this.resetPagination();
      stopAllAudio();
      stopListenAudio();
      this.searchOpen = false;

      // Load new content (old loadContent syncs to store)
      await loadContent(file);
      loadStorage();
      loadQuizHistory();

      // Rebuild quiz section select options
      const quizSel = document.getElementById('quizSection');
      if (quizSel) {
        while (quizSel.options.length > 2) quizSel.remove(2);
        SECTIONS.forEach(sec => {
          const opt = document.createElement('option');
          opt.value = sec;
          opt.textContent = sec;
          quizSel.appendChild(opt);
        });
      }

      this.view = 'browse';
    },

    // ── Settings ──
    applyFontSize(size) {
      this.fontSize = size;
      document.documentElement.style.setProperty('--font-scale',
        ({ sm: '0.82', md: '1', lg: '1.35' })[size] || '1');
      localStorage.setItem('muntaqaa_font', size);
    },
    applyContrast(on) {
      this.highContrast = on;
      document.documentElement.classList.toggle('high-contrast', on);
      localStorage.setItem('muntaqaa_contrast', on);
    },
    toggleContrast() {
      this.applyContrast(!this.highContrast);
    },

    // ── Quiz methods ──
    initQuiz() {
      const sec = this.quizSection;
      const count = this.quizCount;
      let pool;
      if (sec === 'all') pool = this.QA_DATA;
      else if (sec === '__weak__') pool = this.weakPool;
      else pool = this.QA_DATA.filter(q => q.section === sec);

      if (this.quizMode === 'build') {
        pool = pool.filter(q => q.a.trim().split(/\s+/).length >= (this.CFG.meta?.buildMinWords || 4));
      } else if (this.quizMode === 'blank') {
        pool = pool.filter(q => q.a.trim().split(/\s+/).length >= (this.CFG.meta?.blankMinWords || 3));
      }

      if (pool.length === 0) {
        showToast(this.CFG.ui?.notEnoughQuestions || 'لا توجد أسئلة كافية');
        return;
      }

      pool = [...pool].sort(() => Math.random() - 0.5).slice(0, Math.min(count, pool.length));
      this.quizQuestions = pool;
      this.quizCurrent = 0;
      this.quizScore = 0;
      this.quizAnswered = false;
      this.quizPhase = 'game';

      // Sync to old globals so old quiz rendering functions can find the data
      window.quizQuestions = pool;
      window.quizCurrent = 0;
      window.quizScore = 0;
      window.quizAnswered = false;
      window.quizMode = this.quizMode;

      // Call old render function to draw the question UI
      renderQuizQuestion();
    },

    answerQuiz(correct, correctText) {
      if (window.quizAnswered) return;
      window.quizAnswered = true;
      this.quizAnswered = true;
      const currentQA = this.quizQuestions[this.quizCurrent];
      recordAnswer(currentQA.id, correct);
      if (correct) {
        this.quizScore++;
        window.quizScore++;
      }
    },

    nextQuizQuestion() {
      window.quizCurrent++;
      this.quizCurrent++;
      this.quizAnswered = false;
      window.quizAnswered = false;
      if (this.quizCurrent >= this.quizQuestions.length) {
        this.quizPhase = 'result';
        showQuizResult();
      } else {
        renderQuizQuestion();
      }
    },

    retryQuiz() {
      this.quizPhase = 'setup';
    },
  });

  // ── Alpine Data: QA Card component ──
  Alpine.data('qaCard', (qa, matchIn = 'q') => ({
    qa,
    matchIn,
    get hlQuery() {
      const store = Alpine.store('app');
      return store.search || '';
    },
    toggle() {
      Alpine.store('app').toggleCard(qa.id);
      // Sparkle effect on open
      if (Alpine.store('app').openCards.includes(qa.id)) {
        const el = this.$el.querySelector('.qa-toggle');
        if (el) spawnSparkles(el, false);
      }
    },
    toggleFav(e) {
      e.stopPropagation();
      Alpine.store('app').toggleFav(qa.id);
    },
    playAudio(e) {
      e.stopPropagation();
      const btn = e.currentTarget;
      playAudio(qa.id, btn, this.$el);
    },
    copyQA(e) {
      e.stopPropagation();
      copyQA(qa);
    },
    shareImage(e) {
      e.stopPropagation();
      shareAsImage(qa);
    },
  }));
});