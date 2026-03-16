// ===== CONTENT REGISTRY =====
// Add new content files here — they appear automatically in the picker
const CONTENT_FILES = [
  { file: 'content.ar.json',      label: 'منتقى عربي' },
  { file: 'content.kanz-ar.json', label: 'كنز عربي' },
  { file: 'content.kanz-en.json', label: 'Kanz EN' },
];
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
  } catch(e) {}
}
function saveFavorites() {
  localStorage.setItem('favs_' + (CFG.meta && CFG.meta.id || 'default'), JSON.stringify([...state.favorites]));
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

// ===== BUILD SECTION LIST =====
function buildSectionList() {
  const list = document.getElementById('sectionList');
  list.innerHTML = '';
  // Also reset quiz section select
  const quizSel = document.getElementById('quizSection');
  while (quizSel.options.length > 2) quizSel.remove(2);  // keep 'all' and '__weak__'
  // All item
  const allItem = document.createElement('li');
  allItem.className = 'section-item' + (state.section === 'all' ? ' active' : '');
  allItem.innerHTML = `<span>${CFG.ui.allSections}</span><span class="count">${toArabic(QA_DATA.length)}</span>`;
  allItem.addEventListener('click', () => { setSection('all'); closeDrawer(); });
  list.appendChild(allItem);

  SECTIONS.forEach(sec => {
    const count = QA_DATA.filter(q => q.section === sec).length;
    const item = document.createElement('li');
    item.className = 'section-item' + (state.section === sec ? ' active' : '');
    item.dataset.section = sec;
    item.innerHTML = `<span>${sec}</span><span class="count">${toArabic(count)}</span>`;
    item.addEventListener('click', () => { setSection(sec); closeDrawer(); });
    list.appendChild(item);
  });

  // Build quiz section select
  SECTIONS.forEach(sec => {
    const opt = document.createElement('option');
    opt.value = sec;
    opt.textContent = `${getSectionIcon(sec)} ${sec}`;
    quizSel.appendChild(opt);
  });
}

function setSection(sec) {
  state.section = sec;
  state.search = '';
  document.getElementById('searchInput').value = '';
  // Update active in list
  document.querySelectorAll('.section-item').forEach(el => {
    el.classList.toggle('active', (el.dataset.section || 'all') === sec);
    if (!el.dataset.section) el.classList.toggle('active', sec === 'all');
  });
  renderBrowse();
  switchView('browse');
}

// ===== FILTERED DATA =====
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
function getFiltered() {
  let data = QA_DATA;
  const activeSection = state.search.trim() ? state.searchSection : state.section;
  if (activeSection !== 'all') data = data.filter(q => q.section === activeSection);

  if (!state.search.trim()) return data.map(qa => ({ qa, matchIn: 'q' }));

  const scope = state.searchScope;
  const scored = data
    .map(qa => {
      const qScore = (scope === 'both' || scope === 'q') ? fuzzyScore(qa.q, state.search) : 0;
      const aScore = (scope === 'both' || scope === 'a') ? fuzzyScore(qa.a, state.search) : 0;
      const score = Math.max(qScore, aScore);
      // matchIn: where was the best match?
      let matchIn = 'q';
      if (aScore > qScore) matchIn = 'a';
      else if (qScore > 0 && aScore > 0) matchIn = 'both';
      return { qa, score, matchIn };
    })
    .filter(x => x.score >= FUZZY_THRESHOLD)
    .sort((a, b) => b.score - a.score);

  return scored;
}

// ===== RENDER BROWSE (paginated) =====
const PAGE_SIZE = 30;
let browseFiltered = [];
let browsePage = 0;
let browseObserver = null;

function renderBrowse() {
  browseFiltered = getFiltered();
  browsePage = 0;

  const list = document.getElementById('cardList');
  const noResults = document.getElementById('noResults');
  const sectionLabel = document.getElementById('currentSectionLabel');
  const counter = document.getElementById('counterPill');

  // Disconnect old observer
  if (browseObserver) { browseObserver.disconnect(); browseObserver = null; }
  list.innerHTML = '';

  if (browseFiltered.length === 0) {
    noResults.classList.remove('hidden');
    list.classList.add('hidden');
  } else {
    noResults.classList.add('hidden');
    list.classList.remove('hidden');
    renderNextPage();
  }

  sectionLabel.textContent = state.section === 'all' ? CFG.ui.allSections : state.section;
  counter.textContent = `${toArabic(browseFiltered.length)} ${CFG.ui.counterSuffix}`;
  // browseFiltered is now [{qa, matchIn}] — update section label based on search
}

function renderNextPage() {
  const list = document.getElementById('cardList');
  const start = browsePage * PAGE_SIZE;
  const end = Math.min(start + PAGE_SIZE, browseFiltered.length);
  const frag = document.createDocumentFragment();
  for (let i = start; i < end; i++) {
    const { qa, matchIn } = browseFiltered[i];
    // Auto-open to back face if the match was only in the answer
    const autoFlip = state.search.trim() && matchIn === 'a';
    frag.appendChild(makeCard(qa, (i - start) * 20, state.search, autoFlip));
  }
  list.appendChild(frag);
  browsePage++;

  if (end < browseFiltered.length) {
    attachBrowseSentinel(list);
  }
}

function attachBrowseSentinel(list) {
  // Remove old sentinel
  const old = list.querySelector('.browse-sentinel');
  if (old) old.remove();

  const sentinel = document.createElement('div');
  sentinel.className = 'browse-sentinel';
  list.appendChild(sentinel);

  browseObserver = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      browseObserver.disconnect();
      browseObserver = null;
      sentinel.remove();
      renderNextPage();
    }
  }, { rootMargin: '200px' });

  browseObserver.observe(sentinel);
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

function favStarSVG(isFav) {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="${isFav ? '#c9982a' : 'none'}" stroke="${isFav ? '#c9982a' : '#6e6048'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>`;
}

const PLAY_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
const STOP_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>`;

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

function makeCard(qa, delay = 0, hlQuery = '', autoFlip = false) {
  const isFav = state.favorites.has(qa.id);
  const isOpen = state.openCards.has(qa.id) || autoFlip;
  const wrapper = document.createElement('div');
  wrapper.className = 'qa-card-wrap' + (isOpen ? ' open' : '');
  wrapper.dataset.id = qa.id;
  wrapper.style.animationDelay = `${Math.min(delay, 200)}ms`;

  wrapper.innerHTML = `
    <div class="qa-card-flipper">
      <div class="qa-face qa-face-front">
        <div class="qa-card-header">
          <span class="qa-num">${CFG.ui.questionNum.replace("{n}", toArabic(qa.id))}</span>
          <span class="qa-question">${hlQuery ? buildHighlight(qa.q, hlQuery) : escHtml(qa.q)}</span>
          <button class="qa-toggle" aria-label=CFG.ui.showAnswer>${CHEST_SVG}</button>
        </div>
        <div class="qa-footer">
          <span class="qa-section-tag">${qa.section}</span>
          <div class="card-actions">
            ${CFG.meta.audio ? `<button class="play-btn" aria-label="${CFG.ui.listen}" data-id="${qa.id}">${PLAY_SVG}</button>` : ""}
            <button class="fav-btn ${isFav ? 'active' : ''}" aria-label=CFG.ui.save data-id="${qa.id}">${favStarSVG(isFav)}</button>
          </div>
        </div>
      </div>
      <div class="qa-face qa-face-back">
        <div class="qa-back-header">
          <span class="qa-num">${CFG.ui.questionNum.replace("{n}", toArabic(qa.id))}</span>
          <span class="qa-back-label">${CFG.ui.answerLabel}</span>
          <button class="qa-toggle qa-toggle-back" aria-label=CFG.ui.close>${CHEST_SVG}</button>
        </div>
        <div class="qa-back-divider"></div>
        <div class="qa-answer-body">
          <p class="qa-answer-text">${hlQuery ? buildHighlight(qa.a, hlQuery) : escHtml(qa.a)}</p>
        </div>
        <div class="qa-footer">
          <span class="qa-section-tag">${qa.section}</span>
          <div class="card-actions">
            ${CFG.meta.audio ? `<button class="play-btn" aria-label="${CFG.ui.listen}" data-id="${qa.id}">${PLAY_SVG}</button>` : ""}
            <button class="fav-btn ${isFav ? 'active' : ''}" aria-label="${CFG.ui.save}" data-id="${qa.id}">${favStarSVG(isFav)}</button>
            <button class="copy-btn" aria-label="${CFG.ui.copyText}" data-id="${qa.id}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
            <button class="share-img-btn" aria-label="${CFG.ui.shareImage}" data-id="${qa.id}"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg></button>
          </div>
        </div>
      </div>
    </div>
  `;

  wrapper.querySelector('.qa-card-header').addEventListener('click', () => toggleCard(wrapper, qa.id));
  wrapper.querySelector('.qa-toggle').addEventListener('click', e => { e.stopPropagation(); toggleCard(wrapper, qa.id); });
  wrapper.querySelector('.qa-face-back').addEventListener('click', () => toggleCard(wrapper, qa.id));
  wrapper.querySelector('.qa-toggle-back').addEventListener('click', e => { e.stopPropagation(); toggleCard(wrapper, qa.id); });
  wrapper.querySelectorAll('.fav-btn').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); toggleFav(qa.id, wrapper); });
  });
  wrapper.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); copyQA(qa); });
  });
  wrapper.querySelectorAll('.share-img-btn').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); shareAsImage(qa); });
  });

  // Sync play buttons across both faces — when one updates, mirror to the other
  wrapper.querySelectorAll('.play-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      playAudio(qa.id, btn, wrapper);
    });
  });

  // height is handled entirely by CSS (no JS measurement needed)

  return wrapper;
}

function toggleCard(wrapper, id) {
  const isOpen = wrapper.classList.toggle('open');
  if (isOpen) {
    state.openCards.add(id);
    // sparkle from chest position on front face
    const toggle = wrapper.querySelector('.qa-toggle');
    if (toggle) spawnSparkles(toggle, false);
  } else {
    state.openCards.delete(id);
  }
}

function toggleFav(id, wrapper) {
  const isFav = state.favorites.has(id);
  if (isFav) {
    state.favorites.delete(id);
    showToast(CFG.ui.unsaved);
  } else {
    state.favorites.add(id);
    showToast(CFG.ui.saved);
  }
  // update all fav buttons in this wrapper
  wrapper.querySelectorAll('.fav-btn').forEach(btn => {
    const svg = btn.querySelector('svg');
    const nowFav = state.favorites.has(id);
    btn.classList.toggle('active', nowFav);
    if (svg) {
      svg.setAttribute('fill', nowFav ? '#c9982a' : 'none');
      svg.setAttribute('stroke', nowFav ? '#c9982a' : '#6e6048');
    }
  });
  saveFavorites();
  updateFavCount();
}

function updateFavCount() {
  document.getElementById('favCounterPill').textContent = toArabic(state.favorites.size);
  document.querySelectorAll('.qa-card-wrap').forEach(wrapper => {
    const id = parseInt(wrapper.dataset.id);
    const isFav = state.favorites.has(id);
    wrapper.querySelectorAll('.fav-btn').forEach(btn => {
      btn.classList.toggle('active', isFav);
      const svg = btn.querySelector('svg');
      if (svg) {
        svg.setAttribute('fill', isFav ? '#c9982a' : 'none');
        svg.setAttribute('stroke', isFav ? '#c9982a' : '#6e6048');
      }
    });
  });
}

// ===== FAVORITES =====
function renderFavorites() {
  const favList = document.getElementById('favList');
  const noFavs = document.getElementById('noFavs');
  favList.innerHTML = '';

  const favItems = QA_DATA.filter(q => state.favorites.has(q.id));
  document.getElementById('favCounterPill').textContent = toArabic(favItems.length);

  if (favItems.length === 0) {
    noFavs.style.display = '';
    favList.classList.add('hidden');
  } else {
    noFavs.style.display = 'none';
    favList.classList.remove('hidden');
    favItems.forEach((qa, i) => {
      favList.appendChild(makeCard(qa, i * 30));
    });
  }
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
  const sec = document.getElementById('quizSection').value;
  const count = parseInt(document.querySelector('.count-btn.active').dataset.count);
  let pool;
  if (sec === 'all') pool = QA_DATA;
  else if (sec === '__weak__') pool = getWeakPool();
  else pool = QA_DATA.filter(q => q.section === sec);

  // Filter pool by mode requirements
  if (quizMode === 'build') {
    pool = pool.filter(q => q.a.trim().split(/\s+/).length >= (CFG.meta.buildMinWords || 4));
  } else if (quizMode === 'blank') {
    pool = pool.filter(q => q.a.trim().split(/\s+/).length >= (CFG.meta.blankMinWords || 3));
  }

  if (pool.length === 0) {
    showToast(CFG.ui.notEnoughQuestions);
    return;
  }

  pool = [...pool].sort(() => Math.random() - 0.5).slice(0, Math.min(count, pool.length));
  quizQuestions = pool;
  quizCurrent = 0;
  quizScore = 0;
  quizAnswered = false;

  document.getElementById('quizSetup').classList.add('hidden');
  document.getElementById('quizResult').classList.add('hidden');
  document.getElementById('quizGame').classList.remove('hidden');

  renderQuizQuestion();
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
  document.getElementById('quizScoreBadge').textContent = `النقاط: ${toArabic(quizScore)}`;
  document.getElementById('nextQuizBtn').classList.remove('hidden');
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
  document.getElementById('quizScoreBadge').textContent = `النقاط: ${toArabic(quizScore)}`;
  document.getElementById('nextQuizBtn').classList.remove('hidden');
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
  document.getElementById('quizScoreBadge').textContent = `النقاط: ${toArabic(quizScore)}`;
  document.getElementById('nextQuizBtn').classList.remove('hidden');
}

function answerQuiz(correct, btn, correctText) {
  if (quizAnswered) return;
  quizAnswered = true;

  document.querySelectorAll('.choice-btn').forEach(b => {
    b.disabled = true;
    if (b.textContent === correctText) b.classList.add('correct');
  });

  const feedback = document.getElementById('quizFeedback');
  const currentQA = quizQuestions[quizCurrent];
  recordAnswer(currentQA.id, correct);
  if (correct) {
    quizScore++;
    btn.classList.add('correct');
    feedback.className = 'quiz-feedback correct';
    feedback.textContent = CFG.ui.correctMCQFeedback;
    spawnSparkles(btn, true); // big burst
  } else {
    btn.classList.add('wrong');
    feedback.className = 'quiz-feedback wrong';
    feedback.innerHTML = `${CFG.ui.wrongMCQFeedback} <strong>${correctText}</strong>`;
  }
  document.getElementById('quizScoreBadge').textContent = `النقاط: ${toArabic(quizScore)}`;
  document.getElementById('nextQuizBtn').classList.remove('hidden');
}

function nextQuizQuestion() {
  quizCurrent++;
  if (quizCurrent >= quizQuestions.length) {
    showQuizResult();
  } else {
    renderQuizQuestion();
  }
}

function showQuizResult() {
  document.getElementById('quizGame').classList.add('hidden');
  const result = document.getElementById('quizResult');
  result.classList.remove('hidden');

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

// ===== VIEW SWITCHING =====
function switchView(view) {
  stopAllAudio();
  state.view = view;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.bnav-btn').forEach(b => b.classList.remove('active'));

  const viewMap = { browse: 'viewBrowse', favorites: 'viewFavorites', quiz: 'viewQuiz' };
  document.getElementById(viewMap[view])?.classList.add('active');
  document.querySelector(`.bnav-btn[data-view="${view}"]`)?.classList.add('active');

  if (view === 'browse') renderBrowse();
  if (view === 'favorites') renderFavorites();
  if (view === 'quiz') resetQuizSetup();
}

function resetQuizSetup() {
  stopListenAudio();
  document.getElementById('quizSetup').classList.remove('hidden');
  document.getElementById('quizGame').classList.add('hidden');
  document.getElementById('quizResult').classList.add('hidden');
}

// ===== DRAWER =====
function openDrawer() {
  document.getElementById('drawer').classList.add('open');
  document.getElementById('overlay').classList.remove('hidden');
}
function closeDrawer() {
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('overlay').classList.add('hidden');
}

function closeAbout() {
  document.getElementById('aboutOverlay').classList.add('hidden');
  document.body.style.overflow = '';
  // Re-activate the current view in case the overlay broke it
  const viewMap = { browse: 'viewBrowse', favorites: 'viewFavorites', quiz: 'viewQuiz' };
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(viewMap[state.view])?.classList.add('active');
}

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

// ===== SEARCH =====
function toggleSearch() {
  const bar = document.getElementById('searchBar');
  const filters = document.getElementById('searchFilters');
  const hidden = bar.classList.toggle('hidden');
  if (!hidden) {
    filters.classList.remove('hidden');
    buildSearchFilters();
    document.getElementById('searchInput').focus();
    switchView('browse');
  } else {
    filters.classList.add('hidden');
    state.search = '';
    state.searchSection = 'all';
    renderBrowse();
  }
}

function buildSearchFilters() {
  const bar = document.getElementById('searchFilters');
  bar.innerHTML = '';
  const allBtn = document.createElement('button');
  allBtn.className = 'filter-pill' + (state.searchSection === 'all' ? ' active' : '');
  allBtn.dataset.section = 'all';
  allBtn.textContent = CFG.ui.allSectionsShort;
  allBtn.addEventListener('click', () => setSearchSection('all'));
  bar.appendChild(allBtn);

  SECTIONS.forEach(sec => {
    const btn = document.createElement('button');
    btn.className = 'filter-pill' + (state.searchSection === sec ? ' active' : '');
    btn.dataset.section = sec;
    btn.textContent = sec;
    btn.addEventListener('click', () => setSearchSection(sec));
    bar.appendChild(btn);
  });
}

function setSearchSection(sec) {
  state.searchSection = sec;
  document.querySelectorAll('.filter-pill').forEach(b =>
    b.classList.toggle('active', b.dataset.section === sec)
  );
  renderBrowse();
}

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

// ===== CONTENT SWITCHER =====
function buildContentPicker() {
  const picker = document.getElementById('contentPicker');
  if (!picker) return;
  picker.innerHTML = '';
  CONTENT_FILES.forEach(({ file, label }) => {
    const btn = document.createElement('button');
    btn.className = 'content-btn' + (file === activeContent ? ' active' : '');
    btn.textContent = label;
    btn.addEventListener('click', () => switchContent(file));
    picker.appendChild(btn);
  });
}

async function switchContent(file) {
  if (file === activeContent) { closeDrawer(); return; }
  activeContent = file;

  // Reset all transient state
  state.section = 'all';
  state.search = '';
  state.searchScope = 'both';
  state.searchSection = 'all';
  state.openCards.clear();
  quizQuestions = [];
  quizCurrent = 0;
  quizScore = 0;
  quizAnswered = false;
  buildPlaced = [];
  stopAllAudio();
  stopListenAudio();

  // Close search bar if open
  document.getElementById('searchBar').classList.add('hidden');
  document.getElementById('searchFilters').classList.add('hidden');

  await loadContent(file);
  loadStorage();
  loadQuizHistory();
  buildSectionList();
  switchView('browse');
  closeDrawer();
}

// ===== LOAD CONTENT =====
async function loadContent(jsonPath) {
  const res = await fetch(jsonPath);
  const json = await res.json();
  CFG = { meta: json.meta, ui: json.ui, about: json.about || null };
  QA_DATA = json.items || [];
  SECTIONS = [...new Set(QA_DATA.map(q => q.section))];

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

  // Rebuild content picker to reflect active file
  buildContentPicker();
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

// ===== INIT =====
function init() {
  applyDeepLink();
  loadContent(activeContent).then(() => {
    loadStorage();
    loadQuizHistory();
    applyFontSize(currentFontSize);
    applyContrast(highContrast);
    hideSplash();
    buildSectionList();
    renderBrowse();
  });

  // Event listeners
  document.getElementById('menuToggle').addEventListener('click', openDrawer);
  document.getElementById('settingsToggle').addEventListener('click', openSettings);
  document.getElementById('settingsClose').addEventListener('click', closeSettings);
  document.getElementById('settingsOverlay').addEventListener('click', e => { if (e.target === document.getElementById('settingsOverlay')) closeSettings(); });

  // About modal
  document.getElementById('navAbout').addEventListener('click', () => {
    closeDrawer();
    document.getElementById('aboutOverlay').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  });
  document.getElementById('aboutClose').addEventListener('click', closeAbout);
  document.getElementById('aboutOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('aboutOverlay')) closeAbout();
  });
  document.getElementById('overlay').addEventListener('click', closeDrawer);
  document.getElementById('searchToggle').addEventListener('click', toggleSearch);
  document.getElementById('searchClose').addEventListener('click', () => {
    document.getElementById('searchBar').classList.add('hidden');
    document.getElementById('searchFilters').classList.add('hidden');
    state.search = '';
    state.searchSection = 'all';
    state.searchScope = 'both';
    document.querySelectorAll('.scope-btn').forEach(b => b.classList.toggle('active', b.dataset.scope === 'both'));
    renderBrowse();
  });
  document.getElementById('searchInput').addEventListener('input', (e) => {
    state.search = e.target.value;
    if (state.view !== 'browse') switchView('browse');
    else renderBrowse();
  });
  // Scope buttons
  document.querySelectorAll('.scope-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.scope-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.searchScope = btn.dataset.scope;
      renderBrowse();
    });
  });

  // Bottom nav
  document.querySelectorAll('.bnav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  // Drawer nav
  document.querySelectorAll('.nav-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.view) { switchView(btn.dataset.view); closeDrawer(); }
    });
  });

  // Quiz controls
  document.getElementById('startQuiz').addEventListener('click', initQuiz);
  document.getElementById('nextQuizBtn').addEventListener('click', nextQuizQuestion);
  document.getElementById('buildCheck').addEventListener('click', () => {
    checkBuildAnswer(quizQuestions[quizCurrent]);
  });
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      quizMode = btn.dataset.mode;
    });
  });
  document.getElementById('retryQuiz').addEventListener('click', () => {
    document.getElementById('quizResult').classList.add('hidden');
    document.getElementById('quizSetup').classList.remove('hidden');
  });
  document.querySelectorAll('.count-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.count-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

document.addEventListener('DOMContentLoaded', init);

// ===== PWA SERVICE WORKER =====
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
  url.searchParams.set('content', activeContent);
  if (state.section !== 'all') url.searchParams.set('section', state.section);
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

function openSettings() {
  buildSettingsPanel();
  document.getElementById('settingsOverlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function closeSettings() {
  document.getElementById('settingsOverlay').classList.add('hidden');
  document.body.style.overflow = '';
}