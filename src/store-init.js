// ===== STORE INIT — registers store BEFORE Alpine processes the DOM =====
// Runs before Alpine.js loads. Registers alpine:init listener that fires when
// Alpine dispatches the event during its own script execution.
// This ensures the store and components exist when Alpine processes the DOM.

document.addEventListener('alpine:init', function() {

Alpine.store('app', (function() {
  // ── FUZZY SEARCH ──
  function normalizeAr(str) {
    return str.replace(/[ً-ٰٟ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function fuzzyScore(text, query) {
    const t = normalizeAr(text), q = normalizeAr(query);
    if (!q || q.length < 2) return 0;
    if (t.includes(q)) return 1;
    const minLen = Math.ceil(q.length * 0.75);
    for (let len = q.length - 1; len >= minLen; len--)
      for (let start = 0; start <= q.length - len; start++) {
        const sub = q.slice(start, start + len);
        if (sub.length >= 2 && t.includes(sub)) return 0.5 + 0.5 * (len / q.length);
      }
    return 0;
  }
  const FUZZY_THRESHOLD = 0.5;

  // ── SVG CONSTANTS (exposed to Alpine templates) ──
  window.CHEST_SVG = '<svg class="chest-icon" viewBox="0 0 28 21" fill="none" xmlns="http://www.w3.org/2000/svg"><g class="chest-coins"><ellipse cx="9" cy="14" rx="3.5" ry="2" fill="#c9982a" opacity="0.9"/><ellipse cx="14" cy="13" rx="4" ry="2.2" fill="#e8bf5a" opacity="0.95"/><ellipse cx="19" cy="14" rx="3.5" ry="2" fill="#c9982a" opacity="0.9"/></g><rect x="2" y="11" width="24" height="9" rx="2" fill="#5a3a1a" stroke="#c9982a" stroke-width="1.2"/><rect x="4" y="13" width="20" height="5" rx="1" fill="#3a2208" stroke="#a07820" stroke-width="0.8"/><rect x="11" y="9.5" width="6" height="5" rx="1.5" fill="#c9982a" stroke="#a07820" stroke-width="0.8"/><circle cx="14" cy="12" r="1.2" fill="#172a1e" stroke="#a07820" stroke-width="0.5"/><rect x="2" y="10.5" width="24" height="2" rx="0.5" fill="#c9982a" opacity="0.55"/><rect class="chest-lid" x="2" y="2" width="24" height="10" rx="3" fill="#6a4520" stroke="#c9982a" stroke-width="1.2"/><rect x="4.5" y="4" width="19" height="6" rx="1.5" fill="#4a2e0e" stroke="#a07820" stroke-width="0.7"/></svg>';
  window.PLAY_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
  window.STOP_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>';
  window.favStarSVG = function(isFav) {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="' + (isFav ? '#c9982a' : 'none') + '" stroke="' + (isFav ? '#c9982a' : '#6e6048') + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
  };

  return {
    // ── Content data ──
    CFG: {},
    QA_DATA: [],
    SECTIONS: [],
    activeContent: 'content.kanz-ar.json',
    contentLoaded: false,
    contentFiles: [
      { file: 'content.ar.json',      label: 'منتقى عربي' },
      { file: 'content.kanz-ar.json', label: 'كنز عربي' },
      { file: 'content.kanz-en.json', label: 'Kanz EN' },
    ],

    // ── UI state ──
    view: 'browse',
    section: 'all',
    drawerOpen: false,
    searchOpen: false,
    search: '',
    searchScope: 'both',
    searchSection: 'all',
    aboutOpen: false,
    settingsOpen: false,

    // ── Favorites & open cards ──
    favorites: [],
    openCards: [],

    // ── Quiz state ──
    quizMode: 'mcq',
    quizCount: 5,
    quizSection: 'all',
    quizQuestions: [],
    quizCurrent: 0,
    quizScore: 0,
    quizAnswered: false,
    quizPhase: 'setup',
    quizHistory: {},
    // Quiz data (populated by initQuiz for each mode)
    quizChoices: [],       // MCQ: [{text, isCorrect}]
    buildPool: [],         // Build: [{word, id}]
    buildPlaced: [],       // Build: [{word, id}] — in user order
    blankSegments: [],     // Blank: [{text, isBlank}]
    blankOptions: [],      // Blank: [word, word, ...]
    blankCorrect: '',      // Blank: the correct word
    blankKeyIdx: 0,        // Blank: index of blank in segments
    listenChoices: [],     // Listen: [{text, isCorrect}]
    quizFeedbackText: '',
    quizFeedbackType: '',  // 'correct' | 'wrong' | ''

    // ── Settings ──
    fontSize: localStorage.getItem('muntaqaa_font') || 'md',
    highContrast: localStorage.getItem('muntaqaa_contrast') === 'true',

    // ── Pagination ──
    visibleCount: 30,
    PAGE_SIZE: 30,
    browseSentinel: null,
    browseObserver: null,

    // ── Computed ──
    get filteredCards() {
      var data = this.QA_DATA;
      var activeSection = this.search.trim() ? this.searchSection : this.section;
      if (activeSection !== 'all') data = data.filter(function(q) { return q.section === activeSection; });
      if (!this.search.trim()) return data.map(function(qa) { return { qa: qa, matchIn: 'q' }; });
      var scope = this.searchScope;
      return data
        .map(function(qa) {
          var qScore = (scope === 'both' || scope === 'q') ? fuzzyScore(qa.q, this.search) : 0;
          var aScore = (scope === 'both' || scope === 'a') ? fuzzyScore(qa.a, this.search) : 0;
          var score = Math.max(qScore, aScore);
          var matchIn = 'q';
          if (aScore > qScore) matchIn = 'a';
          else if (qScore > 0 && aScore > 0) matchIn = 'both';
          return { qa: qa, score: score, matchIn: matchIn };
        }.bind(this))
        .filter(function(x) { return x.score >= FUZZY_THRESHOLD; })
        .sort(function(a, b) { return b.score - a.score; });
    },

    get visibleCards() { return this.filteredCards.slice(0, this.visibleCount); },
    get hasMore() { return this.visibleCount < this.filteredCards.length; },

    get weakIds() {
      return Object.entries(this.quizHistory)
        .filter(function(kv) { return kv[1].wrong > kv[1].correct; })
        .map(function(kv) { return parseInt(kv[0]); });
    },

    get weakPool() {
      var ids = new Set(this.weakIds);
      return this.QA_DATA.filter(function(q) { return ids.has(q.id); });
    },

    get currentQuestion() { return this.quizQuestions[this.quizCurrent] || null; },
    get quizProgress() {
      if (!this.quizQuestions.length) return 0;
      return (this.quizCurrent / this.quizQuestions.length) * 100;
    },

    // ── Pre-computed section counts (avoids 24x filter() calls per render) ──
    get sectionCounts() {
      var counts = {};
      this.QA_DATA.forEach(function(q) {
        counts[q.section] = (counts[q.section] || 0) + 1;
      });
      return counts;
    },

    // ── Quiz mode helpers ──
    get blankHtml() {
      if (!this.blankSegments.length) return '';
      var qa = this.currentQuestion;
      if (!qa) return '';
      var words = qa.a.trim().split(/\s+/);
      return words.map(function(w, i) {
        if (i === this.blankKeyIdx && this.blankFilled) {
          return '<span class="blank-filled ' + (this.blankFilled === this.blankCorrect ? 'correct' : 'wrong') + '">' + escHtml(this.blankFilled) + '</span>';
        }
        if (i === this.blankKeyIdx) return '<span class="blank-slot">_____</span>';
        return escHtml(w);
      }.bind(this)).join(' ');
    },
    get blankFilled() { return ''; },  // overridden when user picks

    // ── Methods (service dependencies set via window.__ by boot.js) ──
    toggleDrawer: function() {
      this.drawerOpen = !this.drawerOpen;
      var d = document.getElementById('drawer'), o = document.getElementById('overlay');
      if (d) d.classList.toggle('open', this.drawerOpen);
      if (o) o.classList.toggle('hidden', !this.drawerOpen);
    },
    closeDrawer: function() {
      this.drawerOpen = false;
      var d = document.getElementById('drawer'), o = document.getElementById('overlay');
      if (d) d.classList.remove('open');
      if (o) o.classList.add('hidden');
    },
    switchView: function(view) {
      if (window.__stopAllAudio) window.__stopAllAudio();
      this.view = view;
      this.closeDrawer();
      if (view === 'quiz') this.quizPhase = 'setup';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    setSection: function(sec) {
      this.section = sec;
      this.search = '';
      this.drawerOpen = false;
      this.resetPagination();
      var si = document.getElementById('searchInput');
      if (si) si.value = '';
      this.closeDrawer();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    toggleSearch: function() {
      this.searchOpen = !this.searchOpen;
      if (!this.searchOpen) { this.search = ''; this.searchSection = 'all'; this.searchScope = 'both'; this.resetPagination(); }
    },
    setSearchScope: function(scope) { this.searchScope = scope; this.resetPagination(); },
    setSearchSection: function(sec) { this.searchSection = sec; this.resetPagination(); },
    toggleFav: function(id) {
      var idx = this.favorites.indexOf(id);
      if (idx !== -1) { this.favorites.splice(idx, 1); if (window.__showToast) window.__showToast(this.CFG.ui?.unsaved || 'تمت الإزالة'); }
      else { this.favorites.push(id); if (window.__showToast) window.__showToast(this.CFG.ui?.saved || 'تمت الحفظ'); }
      if (window.__saveFavorites) window.__saveFavorites();
    },
    isFav: function(id) { return this.favorites.includes(id); },
    isOpen: function(id) { return this.openCards.includes(id); },
    toggleCard: function(id) {
      var idx = this.openCards.indexOf(id);
      if (idx !== -1) this.openCards.splice(idx, 1);
      else this.openCards.push(id);
    },
    toArabic: function(n) { return this.CFG.meta?.numerals === 'arabic' ? String(n).replace(/[0-9]/g, function(d) { return '٠١٢٣٤٥٦٧٨٩'[d]; }) : String(n); },
    resetPagination: function() {
      this.visibleCount = this.PAGE_SIZE;
      if (this.browseObserver) { this.browseObserver.disconnect(); this.browseObserver = null; }
      this.browseSentinel = null;
    },
    loadMore: function() { if (!this.hasMore) return; this.visibleCount += this.PAGE_SIZE; },
    initSentinel: function(el) {
      var self = this;
      if (this.browseObserver) this.browseObserver.disconnect();
      this.browseSentinel = el;
      this.browseObserver = new IntersectionObserver(function(entries) {
        if (entries[0].isIntersecting) self.loadMore();
      }, { rootMargin: '200px' });
      this.browseObserver.observe(el);
    },
    switchContent: async function(file) {
      var self = this;
      if (file === this.activeContent) return;
      this.section = 'all'; this.search = ''; this.searchScope = 'both'; this.searchSection = 'all';
      this.openCards = []; this.quizQuestions = []; this.quizCurrent = 0; this.quizScore = 0; this.quizAnswered = false;
      this.resetPagination();
      if (window.__stopAllAudio) window.__stopAllAudio();
      if (window.__stopListenAudio) window.__stopListenAudio();
      this.searchOpen = false;
      // Dynamic import since this runs before module scripts
      var mod = await import('./services/content.js');
      var storage = await import('./services/storage.js');
      await mod.loadContent(file);
      storage.loadStorage();
      storage.loadQuizHistory();
      var quizSel = document.getElementById('quizSection');
      if (quizSel) {
        while (quizSel.options.length > 2) quizSel.remove(2);
        this.SECTIONS.forEach(function(sec) {
          var opt = document.createElement('option');
          opt.value = sec; opt.textContent = sec;
          quizSel.appendChild(opt);
        });
      }
      this.view = 'browse';
    },
    applyFontSize: function(size) {
      this.fontSize = size;
      document.documentElement.style.setProperty('--font-scale', ({ sm: '0.82', md: '1', lg: '1.35' })[size] || '1');
      localStorage.setItem('muntaqaa_font', size);
    },
    applyContrast: function(on) {
      this.highContrast = on;
      document.documentElement.classList.toggle('high-contrast', on);
      localStorage.setItem('muntaqaa_contrast', on);
    },
    toggleContrast: function() { this.applyContrast(!this.highContrast); },

    // ── QUIZ ──
    initQuiz: function() {
      var sec = this.quizSection, count = this.quizCount, pool;
      if (sec === 'all') pool = this.QA_DATA;
      else if (sec === '__weak__') pool = this.weakPool;
      else pool = this.QA_DATA.filter(function(q) { return q.section === sec; });
      if (this.quizMode === 'build') pool = pool.filter(function(q) { return q.a.trim().split(/\s+/).length >= (this.CFG.meta?.buildMinWords || 4); }.bind(this));
      else if (this.quizMode === 'blank') pool = pool.filter(function(q) { return q.a.trim().split(/\s+/).length >= (this.CFG.meta?.blankMinWords || 3); }.bind(this));
      if (pool.length === 0) { if (window.__showToast) window.__showToast(this.CFG.ui?.notEnoughQuestions || 'لا توجد أسئلة كافية'); return; }
      pool = [...pool].sort(function() { return Math.random() - 0.5; }).slice(0, Math.min(count, pool.length));
      this.quizQuestions = pool; this.quizCurrent = 0; this.quizScore = 0; this.quizAnswered = false; this.quizPhase = 'game';
      this.quizFeedbackType = ''; this.quizFeedbackText = '';
      this.blankFilled = '';
      this._generateQuestion();
    },

    _generateQuestion: function() {
      var qa = this.currentQuestion;
      if (!qa) return;
      this.quizAnswered = false;
      this.quizFeedbackType = ''; this.quizFeedbackText = '';
      if (window.__stopListenAudio) window.__stopListenAudio();
      var mode = this.quizMode;

      if (mode === 'mcq') this._generateMCQ(qa);
      else if (mode === 'build') this._generateBuild(qa);
      else if (mode === 'blank') { this._generateBlank(qa); this.blankFilled = ''; }
      else if (mode === 'listen') this._generateListen(qa);
    },

    // ── MCQ ──
    _generateMCQ: function(qa) {
      var others = this.QA_DATA.filter(function(q) { return q.id !== qa.id; }).sort(function() { return Math.random() - 0.5; }).slice(0, 3);
      var choices = [qa, ...others].sort(function() { return Math.random() - 0.5; });
      this.quizChoices = choices.map(function(c) { return { text: c.a, isCorrect: c.id === qa.id, selected: false }; });
    },
    selectMCQChoice: function(choice) {
      if (this.quizAnswered) return;
      this.quizAnswered = true;
      choice.selected = true;
      var correct = choice.isCorrect;
      if (window.__recordAnswer) window.__recordAnswer(this.currentQuestion.id, correct);
      if (correct) {
        this.quizScore++;
        this.quizFeedbackType = 'correct';
        this.quizFeedbackText = this.CFG.ui?.correctMCQFeedback || 'أحسنت! إجابة صحيحة';
        if (window.__spawnSparkles) window.__spawnSparkles(document.querySelector('.quiz-card'), true);
      } else {
        this.quizFeedbackType = 'wrong';
        var correctText = this.quizChoices.filter(function(c) { return c.isCorrect; })[0]?.text || '';
        this.quizFeedbackText = (this.CFG.ui?.wrongMCQFeedback || 'الإجابة الصحيحة:') + ' <strong>' + window.escHtml(correctText) + '</strong>';
      }
    },

    // ── BUILD ──
    _generateBuild: function(qa) {
      var words = qa.a.trim().split(/\s+/);
      var shuffled = words.map(function(w, i) { return { word: w, id: i, placed: false }; }).sort(function() { return Math.random() - 0.5; });
      this.buildPool = shuffled;
      this.buildPlaced = [];
    },
    placeBuildTile: function(idx) {
      if (this.quizAnswered) return;
      var tile = this.buildPool[idx];
      if (!tile || tile.placed) return;
      tile.placed = true;
      this.buildPlaced.push({ word: tile.word, id: tile.id });
      // Trigger reactivity
      this.buildPool = this.buildPool.slice();
      this.buildPlaced = this.buildPlaced.slice();
    },
    removeBuildTile: function(idx) {
      if (this.quizAnswered) return;
      var pw = this.buildPlaced[idx];
      if (!pw) return;
      this.buildPlaced.splice(idx, 1);
      var poolIdx = this.buildPool.findIndex(function(t) { return t.id === pw.id; });
      if (poolIdx !== -1) this.buildPool[poolIdx].placed = false;
      this.buildPool = this.buildPool.slice();
      this.buildPlaced = this.buildPlaced.slice();
    },
    checkBuildAnswer: function() {
      if (this.quizAnswered) return;
      var qa = this.currentQuestion;
      if (!qa) return;
      var userAnswer = this.buildPlaced.map(function(p) { return p.word; }).join(' ');
      var correct = window.__normalizeAr ? window.__normalizeAr(userAnswer) === window.__normalizeAr(qa.a) : (userAnswer === qa.a);
      this.quizAnswered = true;
      if (window.__recordAnswer) window.__recordAnswer(qa.id, correct);
      if (correct) {
        this.quizScore++;
        this.quizFeedbackType = 'correct';
        this.quizFeedbackText = this.CFG.ui?.correctFeedback || 'أحسنت!';
        if (window.__spawnSparkles) window.__spawnSparkles(document.getElementById('buildAnswer'), true);
      } else {
        this.quizFeedbackType = 'wrong';
        this.quizFeedbackText = (this.CFG.ui?.wrongOrderFeedback || 'الإجابة الصحيحة:') + ' <strong>' + window.escHtml(qa.a) + '</strong>';
      }
    },

    // ── BLANK ──
    _generateBlank: function(qa) {
      var stopWords = new Set(this.CFG.meta?.stopWords || []);
      var words = qa.a.trim().split(/\s+/);
      var keyIdx = 0, keyLen = 0;
      words.forEach(function(w, i) {
        var clean = w.replace(/[^؀-ۿ]/g, '');
        if (clean.length > keyLen && !stopWords.has(clean)) { keyLen = clean.length; keyIdx = i; }
      });
      var keyWord = words[keyIdx];
      this.blankCorrect = keyWord;
      this.blankKeyIdx = keyIdx;
      this.blankFilled = '';

      var allWords = this.QA_DATA
        .filter(function(q) { return q.id !== qa.id; })
        .flatMap(function(q) { return q.a.split(/\s+/); })
        .filter(function(w) { return w.length >= 3 && !stopWords.has(w.replace(/[^؀-ۿ]/g, '')); });
      var distractors = [...new Set(allWords)].sort(function() { return Math.random() - 0.5; }).slice(0, 3);
      this.blankOptions = [keyWord, ...distractors].sort(function() { return Math.random() - 0.5; });
    },
    selectBlankChoice: function(word) {
      if (this.quizAnswered) return;
      var qa = this.currentQuestion;
      if (!qa) return;
      this.quizAnswered = true;
      this.blankFilled = word;
      var correct = word === this.blankCorrect;
      if (window.__recordAnswer) window.__recordAnswer(qa.id, correct);
      if (correct) {
        this.quizScore++;
        this.quizFeedbackType = 'correct';
        this.quizFeedbackText = this.CFG.ui?.correctBlankFeedback || 'أحسنت!';
        if (window.__spawnSparkles) window.__spawnSparkles(document.querySelector('.blank-choice-btn.correct'), true);
      } else {
        this.quizFeedbackType = 'wrong';
        this.quizFeedbackText = (this.CFG.ui?.wrongBlankFeedback || 'الإجابة الصحيحة:') + ' <strong>' + window.escHtml(this.blankCorrect) + '</strong>';
      }
    },

    // ── LISTEN ──
    _generateListen: function(qa) {
      var others = this.QA_DATA.filter(function(q) { return q.id !== qa.id; }).sort(function() { return Math.random() - 0.5; }).slice(0, 3);
      var choices = [qa, ...others].sort(function() { return Math.random() - 0.5; });
      this.listenChoices = choices.map(function(c) { return { text: c.a, isCorrect: c.id === qa.id, selected: false }; });
      this.listenBtnText = this.CFG.ui?.listen || 'استمع';
    },
    playListenAudio: function() {
      var qa = this.currentQuestion;
      if (!qa || !window.__playListenAudio) return;
      this.listenBtnText = (this.CFG.ui?.listen || 'استمع') + '...';
      window.__playListenAudio(qa.id, { 
        classList: { add: function() {}, remove: function() {} },
        querySelector: function() { return null; },
        disabled: false, style: {}
      });
      // Use a proper approach: play via audio service directly
      var audio = new Audio((this.CFG.meta?.audioPath || 'audios/{id}.opus').replace('{id}', qa.id));
      this._currentListenAudio = audio;
      var self = this;
      audio.play().then(function() {
        self.listenBtnText = self.CFG.ui?.listen + '...';
      }).catch(function() {});
      audio.addEventListener('ended', function() {
        self.listenBtnText = self.CFG.ui?.replay || 'إعادة';
      });
    },
    selectListenChoice: function(choice) {
      if (this.quizAnswered) return;
      var qa = this.currentQuestion;
      if (!qa) return;
      this.quizAnswered = true;
      choice.selected = true;
      if (this._currentListenAudio) { this._currentListenAudio.pause(); this._currentListenAudio = null; }
      var correct = choice.isCorrect;
      if (window.__recordAnswer) window.__recordAnswer(qa.id, correct);
      if (correct) {
        this.quizScore++;
        this.quizFeedbackType = 'correct';
        this.quizFeedbackText = this.CFG.ui?.correctListenFeedback || 'أحسنت!';
        if (window.__spawnSparkles) window.__spawnSparkles(document.querySelector('.quiz-card'), true);
      } else {
        this.quizFeedbackType = 'wrong';
        var correctText = this.listenChoices.filter(function(c) { return c.isCorrect; })[0]?.text || '';
        this.quizFeedbackText = (this.CFG.ui?.wrongListenFeedback || 'الإجابة الصحيحة:') + ' <strong>' + window.escHtml(correctText) + '</strong>';
      }
    },

    blankHtml: function() {
      var qa = this.currentQuestion;
      if (!qa) return '';
      var words = qa.a.trim().split(/\s+/);
      var self = this;
      return words.map(function(w, i) {
        if (i === self.blankKeyIdx && self.blankFilled) {
          return '<span class="blank-filled ' + (self.blankFilled === self.blankCorrect ? 'correct' : 'wrong') + '">' + window.escHtml(self.blankFilled) + '</span>';
        }
        if (i === self.blankKeyIdx) return '<span class="blank-slot">_____</span>';
        return window.escHtml(w);
      }).join(' ');
    },

    nextQuizQuestion: function() {
      this.quizCurrent++;
      this.quizAnswered = false;
      this.quizFeedbackType = ''; this.quizFeedbackText = '';
      if (this.quizCurrent >= this.quizQuestions.length) {
        this.quizPhase = 'result';
        this._showResult();
      } else {
        this._generateQuestion();
      }
    },

    _showResult: function() {
      var total = this.quizQuestions.length;
      var pct = Math.round((this.quizScore / total) * 100);
      var title, msg;
      if (pct < 40) { title = this.CFG.ui?.resultTryAgain; msg = this.CFG.ui?.resultTryAgainMsg; }
      else if (pct < 70) { title = this.CFG.ui?.resultGood; msg = this.CFG.ui?.resultGoodMsg; }
      else if (pct < 100) { title = this.CFG.ui?.resultGreat; msg = this.CFG.ui?.resultGreatMsg; }
      else { title = this.CFG.ui?.resultPerfect; msg = this.CFG.ui?.resultPerfectMsg; }
      this.quizResultTitle = title;
      this.quizResultMsg = msg;
      this.quizResultScore = this.toArabic(this.quizScore) + ' / ' + this.toArabic(total);
    },
    retryQuiz: function() {
      this.quizPhase = 'setup';
    }
  };
})());

// ── QA Card component ──
Alpine.data('qaCard', function(qa, matchIn) {
  if (matchIn === undefined) matchIn = 'q';
  return {
    qa: qa,
    matchIn: matchIn,
    get hlQuery() { return Alpine.store('app').search || ''; },
    toggle: function() {
      Alpine.store('app').toggleCard(qa.id);
      if (Alpine.store('app').openCards.includes(qa.id)) {
        var el = this.$el.querySelector('.qa-toggle');
        if (el && window.__spawnSparkles) window.__spawnSparkles(el, false);
      }
    },
    toggleFav: function(e) { e.stopPropagation(); Alpine.store('app').toggleFav(qa.id); },
    playAudio: function(e) {
      e.stopPropagation();
      if (window.__playAudio) window.__playAudio(qa.id, e.currentTarget, this.$el);
    },
    copyQA: function(e) { e.stopPropagation(); if (window.__copyQA) window.__copyQA(qa); },
    shareImage: function(e) { e.stopPropagation(); if (window.__shareAsImage) window.__shareAsImage(qa); }
  };
});
});
