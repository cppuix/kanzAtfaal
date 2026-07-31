// ===== CONTENT SERVICE =====
// Pure logic: fetch + parse JSON and hand data to the store via actions.
// No DOM access (dir/lang/fonts/title are applied reactively via <html> bindings
// and the store's setContentData action). All persistence lives in storage.js.

export const CONTENT_FILES = [
  { file: 'content.ar.json',      label: 'منتقى عربي' },
  { file: 'content.kanz-ar.json', label: 'كنز عربي' },
  { file: 'content.kanz-en.json', label: 'Kanz EN' },
];

// ===== CONFIG & DATA (set by loadContent; read by other services) =====
export let CFG = {};

// ===== ARABIC NUMERALS (kept for share.js formatting) =====
export function toArabic(n) {
  if (CFG.meta && CFG.meta.numerals === 'arabic') {
    return String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  }
  return String(n);
}

export function applyDeepLink() {
  const params = new URLSearchParams(location.search);
  const content = params.get('content');
  const section = params.get('section');
  let store;
  try { store = Alpine.store('app'); } catch(e) {}
  if (!store) return;
  if (content && CONTENT_FILES.some(f => f.file === content)) {
    store.setActiveContent(content);
  }
  if (section) {
    store.setSection(section);
  }
}

export async function loadContent(jsonPath) {
  const res = await fetch(jsonPath);
  const json = await res.json();
  CFG = { meta: json.meta, ui: json.ui, about: json.about || null };

  const QA_DATA = json.items || [];
  const SECTIONS = [...new Set(QA_DATA.map(q => q.section))];

  // Hand data to the store via a named action (the store owns all state)
  const store = Alpine.store('app');
  if (store) store.setContentData(CFG, QA_DATA, SECTIONS, jsonPath);
}

// Settings UI is now fully reactive in index.html (store-driven). Theme state lives
// in the store; persistence lives in storage.js. Nothing left to do here.
