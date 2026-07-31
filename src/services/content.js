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

// In-memory cache so switching content is instant (no repeat fetch/parse)
const contentCache = {};

async function getContent(jsonPath) {
  if (contentCache[jsonPath]) return contentCache[jsonPath];
  const res = await fetch(jsonPath);
  const json = await res.json();
  const data = {
    CFG: { meta: json.meta, ui: json.ui, about: json.about || null },
    QA_DATA: json.items || [],
    SECTIONS: [...new Set((json.items || []).map(q => q.section))],
  };
  contentCache[jsonPath] = data;
  return data;
}

export async function loadContent(jsonPath) {
  const data = await getContent(jsonPath);
  CFG = data.CFG; // keep module CFG in sync for share/audio services

  // Hand data to the store via a named action (the store owns all state)
  const store = Alpine.store('app');
  if (store) store.setContentData(data.CFG, data.QA_DATA, data.SECTIONS, jsonPath);
}

// Preload a content file in the background (cached, not applied to the store)
export function preloadContent(jsonPath) {
  getContent(jsonPath).catch(() => {});
}

export function preloadOthers(activeFile) {
  CONTENT_FILES.forEach(f => {
    if (f.file !== activeFile) preloadContent(f.file);
  });
}

// Settings UI is now fully reactive in index.html (store-driven). Theme state lives
// in the store; persistence lives in storage.js. Nothing left to do here.
