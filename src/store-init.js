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

  // Longest contiguous substring of the query that actually appears in the text,
  // mirroring fuzzyScore's partial-match rules so highlighting is consistent
  // with what the filter actually matched.
  function bestContiguousMatch(t, q) {
    if (!q || q.length < 2) return '';
    if (t.includes(q)) return q;
    const minLen = Math.ceil(q.length * 0.75);
    for (let len = q.length - 1; len >= minLen; len--)
      for (let start = 0; start <= q.length - len; start++) {
        const sub = q.slice(start, start + len);
        if (sub.length >= 2 && t.includes(sub)) return sub;
      }
    return '';
  }

  // Walk the original text and produce one unit per normalized character, each
  // tagged with the original char index it came from. Whitespace runs collapse
  // into a single space unit (matching normalizeAr's \s+ -> ' '), diacritics are
  // dropped. This keeps a precise normalized-index -> original-index mapping.
  function normUnits(text) {
    const units = [];
    let prevWs = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (/\s/.test(ch)) {
        if (!prevWs) units.push({ norm: ' ', origIndex: i });
        prevWs = true;
      } else {
        const nc = normalizeAr(ch);
        if (nc) for (let k = 0; k < nc.length; k++) units.push({ norm: nc[k], origIndex: i });
        prevWs = false;
      }
    }
    return units;
  }

  // ── SVG CONSTANTS (local consts; exposed to templates via store getters) ──
  const CHEST_SVG = '<svg class="chest-icon" viewBox="0 0 28 21" fill="none" xmlns="http://www.w3.org/2000/svg"><g class="chest-coins"><ellipse cx="9" cy="14" rx="3.5" ry="2" fill="#c9982a" opacity="0.9"/><ellipse cx="14" cy="13" rx="4" ry="2.2" fill="#e8bf5a" opacity="0.95"/><ellipse cx="19" cy="14" rx="3.5" ry="2" fill="#c9982a" opacity="0.9"/></g><rect x="2" y="11" width="24" height="9" rx="2" fill="#5a3a1a" stroke="#c9982a" stroke-width="1.2"/><rect x="4" y="13" width="20" height="5" rx="1" fill="#3a2208" stroke="#a07820" stroke-width="0.8"/><rect x="11" y="9.5" width="6" height="5" rx="1.5" fill="#c9982a" stroke="#a07820" stroke-width="0.8"/><circle cx="14" cy="12" r="1.2" fill="#172a1e" stroke="#a07820" stroke-width="0.5"/><rect x="2" y="10.5" width="24" height="2" rx="0.5" fill="#c9982a" opacity="0.55"/><rect class="chest-lid" x="2" y="2" width="24" height="10" rx="3" fill="#6a4520" stroke="#c9982a" stroke-width="1.2"/><rect x="4.5" y="4" width="19" height="6" rx="1.5" fill="#4a2e0e" stroke="#a07820" stroke-width="0.7"/></svg>';
  const PLAY_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
  const STOP_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>';
  function favStarSVG(isFav) {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="' + (isFav ? '#c9982a' : 'none') + '" stroke="' + (isFav ? '#c9982a' : '#6e6048') + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
  }
  // SVG constants are exposed to templates via store getters (chestSVG/playSVG/stopSVG/favStarSVG)

  // ── FONT PRESETS (resolved per active content language in mainFontStack/displayFontStack) ──
  const FONT_PRESETS = [
    { id: 'tajawal',      labelAr: 'تجوال',         labelEn: 'Tajawal' },
    { id: 'amiri',        labelAr: 'أميري',         labelEn: 'Amiri' },
    { id: 'lateef',       labelAr: 'لطيف',          labelEn: 'Lateef' },
    { id: 'montserrat',   labelAr: 'مونتسيرات',     labelEn: 'Montserrat' },
    { id: 'firacode',     labelAr: 'فيرا كود',      labelEn: 'Fira Code' },
    { id: 'opendyslexic', labelAr: 'أوبن ديسلكسيك', labelEn: 'OpenDyslexic' }
  ];

  return {
    // ── Content data ──
    CFG: {},
    QA_DATA: [],
    SECTIONS: [],
    activeContent: 'content.ar.json',
    contentLoading: false,
    contentLoaded: false,
    // Version counter: bump whenever the dataset identity changes (content switch)
    // and include it in x-for keys so Alpine re-creates items with fresh data.
    cardVersion: 0,
    // Internal: dataset version for memoized getters (bumped in setContentData)
    _qaVersion: 0,
    contentFiles: [
      { file: 'content.ar.json',      label: 'منتقى عربي' },
      { file: 'content.kanz-ar.json', label: 'كنز عربي' },
      { file: 'content.kanz-en.json', label: 'Kanz EN' },
    ],

    // ── UI state ──
    view: 'browse',
    section: 'all',
    drawerOpen: false,
    search: '',
    searchScope: 'both',
    searchSection: 'all',
    // Full-page chrome views (About/Settings) use view === 'about' / 'settings';
    // _prevView is remembered so goBack() returns to the last real screen.
    _prevView: 'browse',
    // Boot state: set to true once content + storage are ready (hides splash)
    appReady: false,

    // ── Toast (reactive — rendered by template) ──
    toastMessage: '',
    toastVisible: false,
    _toastTimer: null,

    // ── Sparkles (trigger only — sparkleLayer component renders particles) ──
    sparkleTrigger: 0,
    sparkleTarget: null,
    sparkleBig: false,

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
    // Per-activity-type tally (mcq/build/blank/listen) — updated by recordAnswer
    modeStats: {},
    // Quiz data (populated by initQuiz for each mode)
    quizChoices: [],       // MCQ: [{text, isCorrect}]
    buildPool: [],         // Build: [{word, id}]
    buildPlaced: [],       // Build: [{word, id}] — in user order
    blankOptions: [],      // Blank: [word, word, ...]
    blankCorrect: '',      // Blank: the correct word
    blankKeyIdx: 0,        // Blank: index of blank in segments
    blankFilled: '',       // Blank: what user selected
    listenChoices: [],     // Listen: [{text, isCorrect}]
    quizFeedbackText: '',
    quizFeedbackType: '',  // 'correct' | 'wrong' | ''
    quizResultTitle: '',
    quizResultMsg: '',
    quizResultScore: '',

    // ── Audio state (written by audio.js; rendered by templates) ──
    playingCardId: null,
    listenPlaying: false,
    listenError: false,

    // ── Settings ──
    // Defaults only — persisted values are applied at boot via storage.loadSettings()
    fontSize: 'md',
    highContrast: false,
    theme: 'dark',
    fontPreset: 'tajawal',

    // ── Pagination (browse view) ──
    pageSize: 30,
    currentPage: 1,

    // ── Computed ──
    // Memoized: the 1536-item map is expensive; recompute only when inputs change
    get filteredCards() {
      var sig = this._qaVersion + '|' + this.search + '|' + this.searchScope + '|' + this.searchSection + '|' + this.section;
      if (this._fcSig === sig && this._fcQA === this.QA_DATA) return this._fcValue;
      var data = this.QA_DATA;
      var activeSection = this.search.trim() ? this.searchSection : this.section;
      if (activeSection !== 'all') data = data.filter(function(q) { return q.section === activeSection; });
      var result;
      if (!this.search.trim()) {
        result = data.map(function(qa) { return { qa: qa, matchIn: 'q' }; });
      } else {
        var scope = this.searchScope;
        result = data
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
      }
      this._fcSig = sig;
      this._fcQA = this.QA_DATA;
      this._fcValue = result;
      return result;
    },

    // ── Pagination: browseCards exposes only the current page slice ──
    get pageCount() {
      return Math.max(1, Math.ceil(this.filteredCards.length / this.pageSize));
    },
    get browseCards() {
      var start = (this.currentPage - 1) * this.pageSize;
      return this.filteredCards.slice(start, start + this.pageSize);
    },
    // Pre-computed page strip for the pager (first / prev / pages / next / last)
    get pagerItems() {
      var total = this.pageCount;
      var cur = this.currentPage;
      if (total <= 1) return [];
      var items = [];
      items.push({ type: 'first', label: '«', page: 1, disabled: cur === 1 });
      items.push({ type: 'prev', label: '‹', page: cur - 1, disabled: cur === 1 });
      var start = Math.max(1, cur - 1);
      var end = Math.min(total, start + 2);
      start = Math.max(1, end - 2);
      if (start > 1) items.push({ type: 'ellipsis', label: '…', page: null, disabled: true });
      for (var p = start; p <= end; p++) items.push({ type: 'page', label: this.toArabic(p), page: p, disabled: false });
      if (end < total) items.push({ type: 'ellipsis', label: '…', page: null, disabled: true });
      items.push({ type: 'next', label: '›', page: cur + 1, disabled: cur === total });
      items.push({ type: 'last', label: '»', page: total, disabled: cur === total });
      return items;
    },
    renderCards: function() { /* no-op — Alpine reactivity handles rendering */ },
    resetPagination: function() { this.currentPage = 1; },
    goToPage: function(p) {
      if (typeof p !== 'number' || p < 1) return;
      var max = this.pageCount;
      if (p > max) p = max;
      if (p === this.currentPage) return;
      this.currentPage = p;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    nextPage: function() { this.goToPage(this.currentPage + 1); },
    prevPage: function() { this.goToPage(this.currentPage - 1); },
    firstPage: function() { this.goToPage(1); },
    lastPage: function() { this.goToPage(this.pageCount); },

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

    // ── Pre-computed section counts (memoized by QA_DATA identity) ──
    get sectionCounts() {
      if (this._scQA === this.QA_DATA) return this._scValue;
      var counts = {};
      this.QA_DATA.forEach(function(q) {
        counts[q.section] = (counts[q.section] || 0) + 1;
      });
      this._scQA = this.QA_DATA;
      this._scValue = counts;
      return counts;
    },

    // ── Theme helpers (CSS consumes these via <html> bindings) ──
    get fontScale() { return ({ sm: '0.82', md: '1', lg: '1.35', xl: '1.7' })[this.fontSize] || '1'; },
    // Document metadata (applied reactively on <html> via :dir / :lang)
    get dir() { return this.CFG.meta?.dir || 'rtl'; },
    get lang() { return this.CFG.meta?.lang || 'ar'; },
    get fonts() { return (this.CFG.meta?.fonts || []).join(',').toLowerCase(); },
    get appTitle() { return this.CFG.ui?.appTitle || 'منتقى كنز الأطفال'; },
    get weakOptionLabel() {
      return (this.CFG.ui?.weakSpotsLabel || 'نقاط الضعف {n}').replace('{n}', this.toArabic(this.weakIds.length));
    },
    get aboutBodyHtml() {
      var about = this.CFG.about;
      if (!about) return '';
      // about.body is trusted content: escape everything, then restore a small
      // allow-list of inline tags so emphasis (<strong>/<em>/<br>) can be used.
      var esc = this.escHtml.bind(this);
      var inline = function(p) {
        return esc(p)
          .replace(/&lt;strong&gt;/g, '<strong>')
          .replace(/&lt;\/strong&gt;/g, '</strong>')
          .replace(/&lt;em&gt;/g, '<em>')
          .replace(/&lt;\/em&gt;/g, '</em>')
          .replace(/&lt;br\s*\/?&gt;/g, '<br>');
      };
      var parts = (about.body || []).map(function(p) { return '<p>' + inline(p) + '</p>'; });
      return parts.join('');
    },
    // Bare email for the About footer — only the mailto contact, nothing else
    get aboutEmail() {
      var c = (this.CFG.about?.contacts || []).find(function(x) { return (x.href || '').indexOf('mailto:') === 0; });
      return c ? c.value : '';
    },
    get aboutEmailHref() {
      var c = (this.CFG.about?.contacts || []).find(function(x) { return (x.href || '').indexOf('mailto:') === 0; });
      return c ? c.href : '';
    },
    // Contextual topbar title (About/Settings get their own title)
    get topbarTitle() {
      if (this.view === 'about') return this.CFG.about?.title || this.appTitle;
      if (this.view === 'settings') return this.CFG.ui?.settingsTitle || '';
      return this.appTitle;
    },
    // Settings theme label (kept store-side for now — no ui.themeLabel key yet)
    get themeLabel() { return this.lang === 'en' ? 'Theme' : 'المظهر'; },
    get contentSwitchLabel() { return this.lang === 'en' ? 'Language' : 'اللغة'; },
    get searchNavLabel() { return this.lang === 'en' ? 'Search' : 'بحث'; },
    get searchEmptyHint() { return this.lang === 'en' ? 'Type to search questions & answers' : 'اكتب كلمة للبحث في الأسئلة والأجوبة'; },
    get searchInputLabel() { return this.lang === 'en' ? 'Search questions and answers' : 'ابحث في الأسئلة والأجوبة'; },
    fontSizeLabel: function(size) {
      var m = { sm: ['Small', 'صغير'], md: ['Medium', 'متوسط'], lg: ['Large', 'كبير'], xl: ['Extra large', 'كبير جدًا'] };
      var v = m[size] || ['A', 'A'];
      return this.lang === 'en' ? v[0] : v[1];
    },
    // ── Localized chrome labels (app UI, not content) — used for title tooltips + aria-labels ──
    get closeLabel() { return this.lang === 'en' ? 'Close' : 'إغلاق'; },
    get menuLabel() { return this.lang === 'en' ? 'Menu' : 'القائمة'; },
    get settingsLabel() { return this.lang === 'en' ? 'Settings' : 'الإعدادات'; },
    get aboutLabel() { return this.lang === 'en' ? 'About' : 'عن التطبيق'; },
    get contentSwitchTitle() { return this.lang === 'en' ? 'Switch content / language' : 'تغيير اللغة / المحتوى'; },
    get chooseContentLabel() { return this.lang === 'en' ? 'Choose content' : 'اختيار المحتوى'; },
    get paginationLabel() { return this.lang === 'en' ? 'Pagination' : 'تنقّل الصفحات'; },
    get chooseChapterLabel() { return this.lang === 'en' ? 'Choose a chapter' : 'اختيار الباب'; },
    get themeDarkLabel() { return this.lang === 'en' ? 'Dark theme' : 'الوضع الداكن'; },
    get themeLightLabel() { return this.lang === 'en' ? 'Light theme' : 'الوضع الفاتح'; },
    get contactLabel() { return this.lang === 'en' ? 'Contact' : 'للتواصل'; },
    get modeMCQTitle() { return this.lang === 'en' ? 'Choose the correct answer' : 'اختر الجواب الصحيح'; },
    get modeBuildTitle() { return this.lang === 'en' ? 'Arrange the answer words' : 'رتّب كلمات الجواب'; },
    get modeBlankTitle() { return this.lang === 'en' ? 'Complete the missing word' : 'أكمل الكلمة الناقصة'; },
    get modeListenTitle() { return this.lang === 'en' ? 'Listen and choose the question' : 'استمع واختر السؤال'; },
    // ── Quiz setup sentence (Direction 1: the quiz is a sentence) ──
    // Clear, descriptive quiz-mode labels (content ui.mode* are terse acronyms
    // like 'اختيار' which reads vaguely — these are the display labels).
    get quizModeOptions() {
      var en = this.lang === 'en';
      return [
        { id: 'mcq',    label: en ? 'Multiple Choice' : 'اختيار من متعدد' },
        { id: 'build',  label: en ? 'Order Words'     : 'ترتيب الكلمات' },
        { id: 'blank',  label: en ? 'Fill the Blank'  : 'أكمل الفراغ' },
        { id: 'listen', label: en ? 'Listen'          : 'استماع' }
      ];
    },
    get quizModeLabel() {
      var opt = this.quizModeOptions.filter(function(m) { return m.id === this.quizMode; }.bind(this))[0];
      return opt ? opt.label : '';
    },
    get quizSectionLabel() {
      if (this.quizSection === 'all') return this.CFG.ui?.allChapters || (this.lang === 'en' ? 'All Chapters' : 'جميع الأبواب');
      if (this.quizSection === '__weak__') return this.weakOptionLabel;
      return this.quizSection;
    },
    get quizCountLabel() { return this.lang === 'en' ? 'Number of questions:' : 'عدد الأسئلة:'; },
    get quizTypeLabel() { return this.lang === 'en' ? 'Type:' : 'النمط:'; },
    get quizChapterLabel() { return this.lang === 'en' ? 'Chapter:' : 'الباب:'; },
    get quizStartLabel() { return this.lang === 'en' ? 'Start' : 'ابدأ'; },
    // ── Quiz tabs (normal / weak / stats) ──
    get quizTabsLabel() { return this.lang === 'en' ? 'Quiz options' : 'خيارات الاختبار'; },
    get quizTabNormalLabel() { return this.lang === 'en' ? 'Quiz' : 'الاختبار'; },
    get quizTabWeakLabel() { return this.lang === 'en' ? 'Weak' : 'نقاط الضعف'; },
    get quizTabStatsLabel() { return this.lang === 'en' ? 'Stats' : 'الإحصائيات'; },
    get weakStartLabel() { return this.lang === 'en' ? 'Start Weak Quiz' : 'ابدأ اختبار نقاط الضعف'; },
    get weakEmptyTitle() { return this.lang === 'en' ? 'No weak questions yet' : 'لا توجد أسئلة ضعيفة بعد'; },
    get weakEmptyHint() { return this.lang === 'en' ? 'Take a quiz — questions you miss will appear here.' : 'اخضِع لاختبار — الأسئلة التي تخطئ فيها ستظهر هنا.'; },
    get statsAnsweredLabel() { return this.lang === 'en' ? 'Answered' : 'تمت الإجابة'; },
    get statsCorrectLabel() { return this.lang === 'en' ? 'Correct' : 'صحيح'; },
    get statsWrongLabel() { return this.lang === 'en' ? 'Wrong' : 'خطأ'; },
    get statsAccuracyLabel() { return this.lang === 'en' ? 'Accuracy' : 'الدقة'; },
    get statsEmptyLabel() { return this.lang === 'en' ? 'No quiz data yet' : 'لا توجد بيانات اختبار بعد'; },
    get statsSummary() {
      var correct = 0, wrong = 0, answered = 0;
      Object.values(this.quizHistory || {}).forEach(function(h) {
        correct += h.correct || 0;
        wrong += h.wrong || 0;
        answered++;
      });
      var attempts = correct + wrong;
      return {
        answered: answered, attempts: attempts, correct: correct, wrong: wrong,
        accuracy: attempts ? Math.round((correct / attempts) * 100) : 0
      };
    },
    // Per-activity-type breakdown (mcq/build/blank/listen) with labels
    get statsByMode() {
      var self = this;
      return this.quizModeOptions
        .filter(function(m) { return !(m.id === 'listen' && !(self.CFG.meta && self.CFG.meta.audio)); })
        .map(function(m) {
          var s = self.modeStats[m.id] || {};
          var correct = s.correct || 0, wrong = s.wrong || 0, attempts = correct + wrong;
          return {
            id: m.id, label: m.label, correct: correct, wrong: wrong, attempts: attempts,
            accuracy: attempts ? Math.round((correct / attempts) * 100) : null
          };
        });
    },
    get fontLabel() { return this.lang === 'en' ? 'Font' : 'الخط'; },
    get fontPreviewLabel() { return this.lang === 'en' ? 'Preview' : 'معاينة الخط'; },
    get fontPresets() {
      var en = this.lang === 'en';
      // Only offer fonts that actually cover the active script (OpenDyslexic and
      // the Latin fonts don't have Arabic glyphs, Arabic fonts don't fit English)
      var ids = en ? ['tajawal', 'montserrat', 'firacode', 'opendyslexic'] : ['tajawal', 'amiri', 'lateef'];
      return ids.map(function(id) {
        var p = FONT_PRESETS.filter(function(x) { return x.id === id; })[0];
        return { id: p.id, label: en ? p.labelEn : p.labelAr };
      });
    },
    // Preview sample matches the active content language
    get fontPreviewSample() { return this.lang === 'en' ? 'Hello 123' : 'أهلاً ١٢٣'; },
    // Resolve the body + display font stacks per preset + active language
    get mainFontStack() {
      var p = this.fontPreset;
      if (p === 'opendyslexic') return "'OpenDyslexic', 'Tajawal', sans-serif";
      if (this.lang === 'en') {
        if (p === 'montserrat') return "'Montserrat', sans-serif";
        if (p === 'firacode') return "'Fira Code', 'Tajawal', monospace";
        return "'Tajawal', sans-serif";
      }
      if (p === 'lateef') return "'Lateef', serif";
      if (p === 'amiri') return "'AmiriQuran', serif";
      return "'Tajawal', sans-serif";
    },
    get displayFontStack() {
      var p = this.fontPreset;
      if (p === 'opendyslexic') return "'OpenDyslexic', 'Tajawal', sans-serif";
      if (this.lang === 'en') return "'Cinzel', 'Montserrat', serif";
      if (p === 'lateef') return "'Lateef', serif";
      return "'AmiriQuran', 'Lateef', serif";
    },

    // ── SVG constants exposed to templates (replaces window.* globals) ──
    get chestSVG() { return CHEST_SVG; },
    get playSVG() { return PLAY_SVG; },
    get stopSVG() { return STOP_SVG; },
    favStarSVG: function(isFav) { return favStarSVG(isFav); },

    // ── Escaping / search helpers (moved off window; templates use $store.app.*) ──
    escHtml: function(s) {
      return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    },
    normalizeAr: function(str) { return normalizeAr(str); },
    buildHighlight: function(text, query) {
      const q = normalizeAr(query);
      if (!q) return this.escHtml(text);
      const units = normUnits(text);
      const t = units.map(u => u.norm).join('');
      const sub = bestContiguousMatch(t, q);
      if (!sub) return this.escHtml(text);
      // All occurrences of the matched substring, mapped back to original chars
      const ranges = [];
      let pos = t.indexOf(sub);
      while (pos !== -1) {
        ranges.push([units[pos].origIndex, units[pos + sub.length - 1].origIndex + 1]);
        pos = t.indexOf(sub, pos + sub.length);
      }
      let out = '';
      let cursor = 0;
      for (const [s, e] of ranges) {
        out += this.escHtml(text.slice(cursor, s)) + '<mark>' + this.escHtml(text.slice(s, e)) + '</mark>';
        cursor = e;
      }
      return out + this.escHtml(text.slice(cursor));
    },

    // ── Methods (service dependencies set via window.__ by boot.js) ──
    toggleDrawer: function() {
      this.drawerOpen = !this.drawerOpen;
    },
    closeDrawer: function() {
      this.drawerOpen = false;
    },
    switchView: function(view) {
      if (window.__stopAllAudio) window.__stopAllAudio();
      var wasSearch = this.view === 'search';
      // Remember the last real screen so goBack() can return to it.
      if (view !== 'about' && view !== 'settings') this._prevView = view;
      else if (this.view !== 'about' && this.view !== 'settings') this._prevView = this.view;
      this.view = view;
      this.closeDrawer();
      if (view === 'quiz') this.quizPhase = 'setup';
      // Fresh, empty search tab each time it's opened
      if (view === 'search') {
        this.search = '';
        this.searchScope = 'both';
        this.searchSection = 'all';
        this.resetPagination();
      } else if (wasSearch) {
        // Leaving search: clear the query so other views are never highlighted
        this.search = '';
        this.resetPagination();
      }
    },
    setSection: function(sec) {
      this.section = sec;
      this.search = '';
      this.drawerOpen = false;
      this.resetPagination();
      this.closeDrawer();
    },
    setSearchScope: function(scope) { this.searchScope = scope; this.resetPagination(); this.renderCards(); },
    setSearchSection: function(sec) { this.searchSection = sec; this.resetPagination(); this.renderCards(); },
    toggleFav: function(id) {
      var idx = this.favorites.indexOf(id);
      if (idx !== -1) { this.favorites.splice(idx, 1); this.showToast(this.CFG.ui?.unsaved || 'تمت الإزالة'); }
      else { this.favorites.push(id); this.showToast(this.CFG.ui?.saved || 'تمت الحفظ'); }
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
    // O(1) card lookup (Map rebuilt only when QA_DATA identity changes)
    _ensureCardMap: function() {
      if (this._cardMap && this._cardMapSource === this.QA_DATA) return this._cardMap;
      var map = new Map();
      this.QA_DATA.forEach(function(q) { map.set(q.id, q); });
      this._cardMap = map;
      this._cardMapSource = this.QA_DATA;
      return map;
    },
    getCard: function(id) {
      return this._ensureCardMap().get(id) || null;
    },

    initSentinel: function() { /* no-op — infinite scroll removed */ },
    switchContent: async function(file) {
      if (file === this.activeContent) return;
      this.contentLoading = true;
      if (window.__stopAllAudio) window.__stopAllAudio();
      if (window.__stopListenAudio) window.__stopListenAudio();
      // Resets are deferred until after the data swap so Alpine performs a single
      // flush — no intermediate stale/filtered state, no flicker.
      try {
        await window.__loadContent(file);
        window.__loadStorage();
        window.__loadQuizHistory();
      } catch(e) {
        this.contentLoading = false;
        this.showToast('فشل تحميل المحتوى');
        return;
      }
      this.section = 'all'; this.search = ''; this.searchScope = 'both'; this.searchSection = 'all';
      this.openCards = []; this.quizQuestions = []; this.quizCurrent = 0; this.quizScore = 0; this.quizAnswered = false;
      this.resetPagination();
      // Dataset identity changed — setContentData bumps cardVersion so x-for
      // keys change and cards re-render fresh
      this.contentLoading = false;
      // Persist the chosen content so it survives reload (storage.js owns the key)
      if (window.__saveContentChoice) window.__saveContentChoice(file);
      this.view = 'browse';
    },
    applyFontSize: function(size) {
      this.fontSize = size;
      if (window.__saveFontSize) window.__saveFontSize(size);
    },
    applyContrast: function(on) {
      this.highContrast = on;
      if (window.__saveContrast) window.__saveContrast(on);
    },
    toggleContrast: function() { this.applyContrast(!this.highContrast); },
    applyTheme: function(theme) {
      if (theme !== 'dark' && theme !== 'light') theme = 'dark';
      this.theme = theme;
      if (window.__saveTheme) window.__saveTheme(theme);
    },
    setFontPreset: function(preset) {
      if (!FONT_PRESETS.some(function(p) { return p.id === preset; })) preset = 'tajawal';
      this.fontPreset = preset;
      if (window.__saveFontPreset) window.__saveFontPreset(preset);
    },
    // Sets appearance from persisted storage at boot (no re-save)
    setAppearance: function(font, contrast, theme, preset) {
      if (font) this.fontSize = font;
      if (contrast !== undefined && contrast !== null) this.highContrast = !!contrast;
      if (theme) this.theme = (theme === 'light') ? 'light' : 'dark';
      if (preset && FONT_PRESETS.some(function(p) { return p.id === preset; })) this.fontPreset = preset;
    },

    // ── Toast (reactive — rendered by template, CSS owns the animation) ──
    showToast: function(msg) {
      this.toastMessage = msg;
      this.toastVisible = true;
      clearTimeout(this._toastTimer);
      var self = this;
      this._toastTimer = setTimeout(function() { self.toastVisible = false; }, 2000);
    },

    // ── Sparkles (trigger only — sparkleLayer component renders particles) ──
    triggerSparkles: function(el, big) {
      this.sparkleTarget = el || null;
      this.sparkleBig = !!big;
      this.sparkleTrigger++;
    },

    // ── Full-page chrome views (About/Settings) ──
    goBack: function() {
      var prev = (this._prevView !== 'about' && this._prevView !== 'settings') ? this._prevView : 'browse';
      this.switchView(prev || 'browse');
    },

    // ── Quiz setup actions ──
    setQuizCount: function(n) { this.quizCount = n; },
    setQuizMode: function(mode) { this.quizMode = mode; },
    setQuizSection: function(sec) { this.quizSection = sec; },
    // Card audio toggle — audio.js owns playback and updates playingCardId
    playCardAudio: function(id) { if (window.__playAudio) window.__playAudio(id); },

    // ── Data actions (services hand data to the store through these) ──
    setContentData: function(cfg, qaData, sections, file) {
      this.CFG = cfg;
      this.QA_DATA = qaData;
      this.SECTIONS = sections;
      this.activeContent = file;
      this.contentLoaded = true;
      // Dataset identity changed — bump so memoized getters recompute
      this._qaVersion++;
      this.cardVersion++;
      // Keep the font preset valid for the active language (OpenDyslexic and the
      // Latin fonts don't cover Arabic; Amiri/Lateef don't cover English)
      var validPresets = (this.lang === 'en')
        ? ['tajawal', 'montserrat', 'firacode', 'opendyslexic']
        : ['tajawal', 'amiri', 'lateef'];
      if (validPresets.indexOf(this.fontPreset) === -1) this.fontPreset = 'tajawal';
      // Isolated page-metadata write — <title> cannot be Alpine-bound
      document.title = cfg?.ui?.appTitle || this.appTitle;
    },
    setFavorites: function(favs) { this.favorites = favs || []; },
    setActiveContent: function(file) { this.activeContent = file; },
    setQuizHistory: function(hist) {
      // Copy so reactivity fires even when the same source object is mutated in place
      this.quizHistory = hist ? { ...hist } : {};
      // If the weak section is selected but no weak items remain, fall back to 'all'
      if (this.quizSection === '__weak__' && this.weakPool.length === 0) this.quizSection = 'all';
    },
    setModeStats: function(ms) { this.modeStats = ms ? { ...ms } : {}; },
    setAppReady: function(ready) { this.appReady = !!ready; },
    shareAppUrl: function() { if (window.__shareDeepLink) window.__shareDeepLink(); },

    // ── QUIZ ──
    initQuiz: function() {
      var sec = this.quizSection, count = this.quizCount, pool;
      if (sec === 'all') pool = this.QA_DATA;
      else if (sec === '__weak__') pool = this.weakPool;
      else pool = this.QA_DATA.filter(function(q) { return q.section === sec; });
      if (this.quizMode === 'build') pool = pool.filter(function(q) { return q.a.trim().split(/\s+/).length >= (this.CFG.meta?.buildMinWords || 4); }.bind(this));
      else if (this.quizMode === 'blank') pool = pool.filter(function(q) { return q.a.trim().split(/\s+/).length >= (this.CFG.meta?.blankMinWords || 3); }.bind(this));
      if (pool.length === 0) { this.showToast(this.CFG.ui?.notEnoughQuestions || 'لا توجد أسئلة كافية'); return; }
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
    selectMCQChoice: function(choice, el) {
      if (this.quizAnswered) return;
      this.quizAnswered = true;
      choice.selected = true;
      var correct = choice.isCorrect;
      if (window.__recordAnswer) window.__recordAnswer(this.currentQuestion.id, correct, 'mcq');
      if (correct) {
        this.quizScore++;
        this.quizFeedbackType = 'correct';
        this.quizFeedbackText = this.CFG.ui?.correctMCQFeedback || 'أحسنت! إجابة صحيحة';
        this.triggerSparkles(el, true);
      } else {
        this.quizFeedbackType = 'wrong';
        var correctText = this.quizChoices.filter(function(c) { return c.isCorrect; })[0]?.text || '';
        this.quizFeedbackText = (this.CFG.ui?.wrongMCQFeedback || 'الإجابة الصحيحة:') + ' <strong>' + this.escHtml(correctText) + '</strong>';
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
    checkBuildAnswer: function(el) {
      if (this.quizAnswered) return;
      var qa = this.currentQuestion;
      if (!qa) return;
      var userAnswer = this.buildPlaced.map(function(p) { return p.word; }).join(' ');
      var correct = this.normalizeAr(userAnswer) === this.normalizeAr(qa.a);
      this.quizAnswered = true;
      if (window.__recordAnswer) window.__recordAnswer(qa.id, correct, 'build');
      if (correct) {
        this.quizScore++;
        this.quizFeedbackType = 'correct';
        this.quizFeedbackText = this.CFG.ui?.correctFeedback || 'أحسنت!';
        this.triggerSparkles(el, true);
      } else {
        this.quizFeedbackType = 'wrong';
        this.quizFeedbackText = (this.CFG.ui?.wrongOrderFeedback || 'الإجابة الصحيحة:') + ' <strong>' + this.escHtml(qa.a) + '</strong>';
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
    selectBlankChoice: function(word, el) {
      if (this.quizAnswered) return;
      var qa = this.currentQuestion;
      if (!qa) return;
      this.quizAnswered = true;
      this.blankFilled = word;
      var correct = word === this.blankCorrect;
      if (window.__recordAnswer) window.__recordAnswer(qa.id, correct, 'blank');
      if (correct) {
        this.quizScore++;
        this.quizFeedbackType = 'correct';
        this.quizFeedbackText = this.CFG.ui?.correctBlankFeedback || 'أحسنت!';
        this.triggerSparkles(el, true);
      } else {
        this.quizFeedbackType = 'wrong';
        this.quizFeedbackText = (this.CFG.ui?.wrongBlankFeedback || 'الإجابة الصحيحة:') + ' <strong>' + this.escHtml(this.blankCorrect) + '</strong>';
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
      if (!qa) return;
      // Audio is owned by audio.js — never spawn new Audio() in the store
      if (window.__playListenAudio) window.__playListenAudio(qa.id);
    },
    selectListenChoice: function(choice, el) {
      if (this.quizAnswered) return;
      var qa = this.currentQuestion;
      if (!qa) return;
      this.quizAnswered = true;
      choice.selected = true;
      if (window.__stopListenAudio) window.__stopListenAudio();
      var correct = choice.isCorrect;
      if (window.__recordAnswer) window.__recordAnswer(qa.id, correct, 'listen');
      if (correct) {
        this.quizScore++;
        this.quizFeedbackType = 'correct';
        this.quizFeedbackText = this.CFG.ui?.correctListenFeedback || 'أحسنت!';
        this.triggerSparkles(el, true);
      } else {
        this.quizFeedbackType = 'wrong';
        var correctText = this.listenChoices.filter(function(c) { return c.isCorrect; })[0]?.text || '';
        this.quizFeedbackText = (this.CFG.ui?.wrongListenFeedback || 'الإجابة الصحيحة:') + ' <strong>' + this.escHtml(correctText) + '</strong>';
      }
    },

    blankHtml: function() {
      var qa = this.currentQuestion;
      if (!qa) return '';
      var words = qa.a.trim().split(/\s+/);
      var self = this;
      return words.map(function(w, i) {
        if (i === self.blankKeyIdx && self.blankFilled) {
          return '<span class="blank-filled ' + (self.blankFilled === self.blankCorrect ? 'correct' : 'wrong') + '">' + self.escHtml(self.blankFilled) + '</span>';
        }
        if (i === self.blankKeyIdx) return '<span class="blank-slot">_____</span>';
        return self.escHtml(w);
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
Alpine.data('qaCard', function(id) {
  return {
    id: id,
    // Read the card reactively from the store (single source of truth) so cards
    // update in place on content switch instead of being re-created.
    get qa() { return Alpine.store('app').getCard(this.id) || {}; },
    get hlQuery() { return Alpine.store('app').search || ''; },
    get isFav() { return Alpine.store('app').favorites.includes(this.id); },
    get isOpen() { return Alpine.store('app').openCards.includes(this.id); },
    toggle: function() {
      Alpine.store('app').toggleCard(this.id);
      if (Alpine.store('app').openCards.includes(this.id)) {
        // Source element is passed via $refs (no DOM queries in components)
        Alpine.store('app').triggerSparkles(this.$refs.toggleBtn, false);
      }
    },
    toggleFav: function(e) { e.stopPropagation(); Alpine.store('app').toggleFav(this.id); },
    playAudio: function(e) {
      e.stopPropagation();
      if (window.__playAudio) window.__playAudio(this.id);
    },
    copyQA: function(e) { e.stopPropagation(); if (window.__copyQA) window.__copyQA(this.qa); },
    shareImage: function(e) { e.stopPropagation(); if (window.__shareAsImage) window.__shareAsImage(this.qa); }
  };
});

// ── Sparkle Layer component — owns sparkle particle DOM (CSS-animation owner) ──
Alpine.data('sparkleLayer', function() {
  return {
    init() {
      var self = this;
      this.$watch('$store.app.sparkleTrigger', function() { self.spawn(); });
    },
    spawn() {
      var store = Alpine.store('app');
      var sourceEl = store.sparkleTarget;
      if (!sourceEl || !this.$el) return;
      var rect = sourceEl.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      var big = store.sparkleBig;
      var count = big ? 28 : 14;
      var colors = ['#f5d98a','#e8bf5a','#c9982a','#fff8dc','#ffe066','#f0c96a'];
      var shapes = ['●','◆','✦','★','·'];
      for (var i = 0; i < count; i++) {
        var p = document.createElement('span');
        p.className = 'sparkle-particle';
        p.textContent = shapes[Math.floor(Math.random() * shapes.length)];
        var angle = (Math.PI * 2 * i / count) + (Math.random() - 0.5) * 0.8;
        var dist = big ? 60 + Math.random() * 90 : 30 + Math.random() * 50;
        var dx = Math.cos(angle) * dist;
        var dy = Math.sin(angle) * dist;
        var size = big ? 10 + Math.random() * 10 : 7 + Math.random() * 7;
        var dur = big ? 600 + Math.random() * 500 : 450 + Math.random() * 350;
        var delay = Math.random() * (big ? 120 : 60);
        p.style.cssText =
          'left: ' + cx + 'px; top: ' + cy + 'px;' +
          'font-size: ' + size + 'px; color: ' + colors[Math.floor(Math.random() * colors.length)] + ';' +
          '--dx: ' + dx + 'px; --dy: ' + dy + 'px;' +
          'animation: sparklefly ' + dur + 'ms ease-out ' + delay + 'ms forwards;';
        this.$el.appendChild(p);
        setTimeout(function() { if (p.parentNode) p.parentNode.removeChild(p); }, dur + delay + 50);
      }
      if (big) {
        var shimmer = document.createElement('div');
        shimmer.className = 'win-shimmer';
        this.$el.appendChild(shimmer);
        setTimeout(function() { if (shimmer.parentNode) shimmer.parentNode.removeChild(shimmer); }, 600);
      }
    }
  };
});
});
