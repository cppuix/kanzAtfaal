// ===== CONTENT REGISTRY =====
export const CONTENT_FILES = [
  { file: 'content.ar.json',      label: 'منتقى عربي' },
  { file: 'content.kanz-ar.json', label: 'كنز عربي' },
  { file: 'content.kanz-en.json', label: 'Kanz EN' },
];

export let activeContent = CONTENT_FILES[0].file;

// ===== CONFIG & DATA (set by loadContent) =====
export let CFG = {};

// ===== ARABIC NUMERALS =====
export function toArabic(n) {
  if (CFG.meta && CFG.meta.numerals === 'arabic') {
    return String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  }
  return String(n);
}

export function saveContentChoice() {
  try { localStorage.setItem('activeContent', activeContent); } catch (e) {}
}

export function loadSavedContent() {
  try {
    const saved = localStorage.getItem('activeContent');
    if (saved && CONTENT_FILES.some(f => f.file === saved)) {
      activeContent = saved;
    } else {
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

export function applyDeepLink() {
  const params = new URLSearchParams(location.search);
  const content = params.get('content');
  const section = params.get('section');
  if (content && CONTENT_FILES.some(f => f.file === content)) {
    activeContent = content;
  }
  if (section) {
    // section state will be applied by caller
  }
}

export async function loadContent(jsonPath) {
  const res = await fetch(jsonPath);
  const json = await res.json();
  CFG = { meta: json.meta, ui: json.ui, about: json.about || null };

  const QA_DATA = json.items || [];
  const SECTIONS = [...new Set(QA_DATA.map(q => q.section))];
  activeContent = jsonPath;

  // Sync to Alpine store
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

  // Apply direction and lang
  document.documentElement.dir = CFG.meta.dir || 'rtl';
  document.documentElement.lang = CFG.meta.lang || 'ar';
  document.title = CFG.ui.appTitle || 'منتقى كنز الأطفال';
  document.body.dataset.fonts = (CFG.meta.fonts || []).join(',').toLowerCase();

  // Update static UI strings
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

  // Render about modal
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

  buildSettingsPanel();

  const listenLbl = document.getElementById('listenBtnLabel');
  if (listenLbl) listenLbl.textContent = CFG.ui.listen;

  const listenModeBtn = document.querySelector('.mode-btn[data-mode="listen"]');
  if (listenModeBtn) listenModeBtn.style.display = CFG.meta.audio ? '' : 'none';

  document.querySelectorAll('.play-btn').forEach(b => {
    b.style.display = CFG.meta.audio ? '' : 'none';
  });
}

// ===== SETTINGS PANEL =====
export const FONT_SCALES = { sm: '0.82', md: '1', lg: '1.35' };
export let currentFontSize = localStorage.getItem('muntaqaa_font') || 'md';
export let highContrast = localStorage.getItem('muntaqaa_contrast') === 'true';

export function applyFontSize(size) {
  currentFontSize = size;
  document.documentElement.style.setProperty('--font-scale', FONT_SCALES[size]);
  localStorage.setItem('muntaqaa_font', size);
  document.querySelectorAll('.font-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.size === size)
  );
}

export function applyContrast(on) {
  highContrast = on;
  document.documentElement.classList.toggle('high-contrast', on);
  localStorage.setItem('muntaqaa_contrast', on);
  const btn = document.getElementById('contrastToggle');
  if (btn) btn.classList.toggle('active', on);
}

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
  // Share URL handler set in boot.js after import
}
