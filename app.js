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
  return String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
}

// ===== SECTIONS =====
const SECTIONS = [...new Set(QA_DATA.map(q => q.section))];
function getSectionIcon(s) { return ''; }

// ===== LOAD STORAGE =====
function loadStorage() {
  try {
    const favs = JSON.parse(localStorage.getItem('muntaqaa_favs') || '[]');
    state.favorites = new Set(favs);
  } catch(e) {}
}
function saveFavorites() {
  localStorage.setItem('muntaqaa_favs', JSON.stringify([...state.favorites]));
}

// ===== QUIZ HISTORY =====
// quizHistory: { [id]: { correct: n, wrong: n } }
let quizHistory = {};

function loadQuizHistory() {
  try {
    quizHistory = JSON.parse(localStorage.getItem('muntaqaa_history') || '{}');
  } catch(e) { quizHistory = {}; }
  updateWeakOption();
}
function updateWeakOption() {
  const opt = document.getElementById('weakOption');
  if (!opt) return;
  const weakCount = getWeakIds().length;
  if (weakCount > 0) {
    opt.style.display = '';
    opt.textContent = `نقاط الضعف (${toArabic(weakCount)} سؤال) ⚠`;
  } else {
    opt.style.display = 'none';
    // Reset to 'all' if currently selected
    const sel = document.getElementById('quizSection');
    if (sel && sel.value === '__weak__') sel.value = 'all';
  }
}
function saveQuizHistory() {
  localStorage.setItem('muntaqaa_history', JSON.stringify(quizHistory));
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
  // All item
  const allItem = document.createElement('li');
  allItem.className = 'section-item' + (state.section === 'all' ? ' active' : '');
  allItem.innerHTML = `<span>جميع الأسئلة</span><span class="count">${toArabic(QA_DATA.length)}</span>`;
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
  const quizSel = document.getElementById('quizSection');
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

  sectionLabel.textContent = state.section === 'all' ? 'جميع الأسئلة' : state.section;
  counter.textContent = `${toArabic(browseFiltered.length)} سؤال`;
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

  const audio = new Audio(`audios/${id}.opus`);
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
          <span class="qa-num">س ${toArabic(qa.id)}</span>
          <span class="qa-question">${hlQuery ? buildHighlight(qa.q, hlQuery) : escHtml(qa.q)}</span>
          <button class="qa-toggle" aria-label="إظهار الجواب">${CHEST_SVG}</button>
        </div>
        <div class="qa-footer">
          <span class="qa-section-tag">${qa.section}</span>
          <div class="card-actions">
            <button class="play-btn" aria-label="استمع" data-id="${qa.id}">${PLAY_SVG}</button>
            <button class="fav-btn ${isFav ? 'active' : ''}" aria-label="حفظ" data-id="${qa.id}">${favStarSVG(isFav)}</button>
          </div>
        </div>
      </div>
      <div class="qa-face qa-face-back">
        <div class="qa-back-header">
          <span class="qa-num">س ${toArabic(qa.id)}</span>
          <span class="qa-back-label">الجواب</span>
          <button class="qa-toggle qa-toggle-back" aria-label="إغلاق">${CHEST_SVG}</button>
        </div>
        <div class="qa-back-divider"></div>
        <div class="qa-answer-body">
          <p class="qa-answer-text">${hlQuery ? buildHighlight(qa.a, hlQuery) : escHtml(qa.a)}</p>
        </div>
        <div class="qa-footer">
          <span class="qa-section-tag">${qa.section}</span>
          <div class="card-actions">
            <button class="play-btn" aria-label="استمع" data-id="${qa.id}">${PLAY_SVG}</button>
            <button class="fav-btn ${isFav ? 'active' : ''}" aria-label="حفظ" data-id="${qa.id}">${favStarSVG(isFav)}</button>
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
    showToast('تمت الإزالة من المحفوظات');
  } else {
    state.favorites.add(id);
    showToast('تمت الإضافة إلى المحفوظات');
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
    pool = pool.filter(q => q.a.trim().split(/\s+/).length >= 4);
  } else if (quizMode === 'blank') {
    pool = pool.filter(q => q.a.trim().split(/\s+/).length >= 3);
  }

  if (pool.length === 0) {
    showToast('لا توجد أسئلة كافية لهذا النوع في هذا الباب');
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
  document.getElementById('quizScoreBadge').textContent = `النقاط: ${toArabic(quizScore)}`;
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
  document.getElementById('quizQNum').textContent = `س ${toArabic(qa.id)}`;
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
  document.getElementById('quizQNum').textContent = `س ${toArabic(qa.id)}`;
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
  answerEl.innerHTML = '<span class="build-placeholder">اضغط على الكلمات لترتيبها...</span>';
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
    answerEl.innerHTML = '<span class="build-placeholder">اضغط على الكلمات لترتيبها...</span>';
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
    feedback.textContent = 'أحسنت! ترتيب صحيح';
    spawnSparkles(document.getElementById('buildAnswer'), true);
  } else {
    document.getElementById('buildAnswer').classList.add('build-wrong');
    feedback.className = 'quiz-feedback wrong';
    feedback.innerHTML = `الترتيب الصحيح: <strong>${escHtml(qa.a)}</strong>`;
  }
  document.getElementById('quizScoreBadge').textContent = `النقاط: ${toArabic(quizScore)}`;
  document.getElementById('nextQuizBtn').classList.remove('hidden');
}

// ── BLANK mode ────────────────────────────────────────────
function renderBlank(qa) {
  document.getElementById('quizQNum').textContent = `س ${toArabic(qa.id)}`;
  document.getElementById('quizQText').textContent = qa.q;
  const zone = document.getElementById('blankZone');
  zone.classList.remove('hidden');

  // Pick the key word: longest word not in a stop-list
  const stopWords = new Set(['من','في','على','إلى','عن','مع','هو','هي','هم','أن','إن','كان','كانت','وهو','وهي','التي','الذي','ما','لا','أو','و','ال']);
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
    feedback.textContent = 'أحسنت! الكلمة صحيحة';
    spawnSparkles(btn, true);
  } else {
    btn.classList.add('wrong');
    feedback.className = 'quiz-feedback wrong';
    feedback.innerHTML = `الكلمة الصحيحة: <strong>${escHtml(keyWord)}</strong>`;
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
  playBtn.querySelector('span').textContent = 'استمع';
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
  listenAudio = new Audio(`audios/${id}.opus`);
  btn.classList.add('playing');
  btn.querySelector('span').textContent = 'يُشغَّل...';
  listenAudio.addEventListener('ended', () => {
    btn.classList.remove('playing');
    btn.querySelector('span').textContent = 'إعادة ↺';
  });
  listenAudio.addEventListener('error', () => {
    btn.classList.remove('playing');
    btn.querySelector('span').textContent = 'تعذّر التشغيل';
    btn.disabled = true;
    btn.style.opacity = '0.5';
  });
  listenAudio.play().catch(() => {
    btn.classList.remove('playing');
    btn.querySelector('span').textContent = 'تعذّر التشغيل';
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
    feedback.textContent = 'أحسنت! الجواب الصحيح';
    spawnSparkles(btn, true);
  } else {
    btn.classList.add('wrong');
    feedback.className = 'quiz-feedback wrong';
    feedback.innerHTML = `الجواب الصحيح: <strong>${escHtml(correctQ)}</strong>`;
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
    feedback.textContent = 'أحسنت! إجابة صحيحة';
    spawnSparkles(btn, true); // big burst
  } else {
    btn.classList.add('wrong');
    feedback.className = 'quiz-feedback wrong';
    feedback.innerHTML = `الإجابة الصحيحة: <strong>${correctText}</strong>`;
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
  let title = 'ممتاز!', msg = 'أداء رائع جداً! استمر هكذا.';

  if (pct < 40) { title = 'حاول مجدداً!'; msg = 'لا بأس، المثابرة طريق النجاح.'; }
  else if (pct < 70) { title = 'جيد!'; msg = 'تقدم جيد، واصل المذاكرة.'; }
  else if (pct < 100) { title = 'ممتاز!'; msg = 'أداء رائع جداً! استمر هكذا.'; }
  else { title = 'مثالي!'; msg = '١٠٠٪ صحيح! أنت نجم!'; }

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
  allBtn.textContent = 'الكل';
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

// ===== INIT =====
function init() {
  loadStorage();
  loadQuizHistory();
  hideSplash();
  buildSectionList();
  renderBrowse();

  // Event listeners
  document.getElementById('menuToggle').addEventListener('click', openDrawer);

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