const CACHE_NAME = 'muntaqaa-v29'; // quiz setup: vertical step lines + tappable token chips
const AUDIO_CACHE = 'muntaqaa-audio-v1'; // separate cache, never busted on app updates

const SHELL_ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './icon-512.png',
  './fonts/fonts.css',
  './fonts/Tajawal-Regular.ttf',
  './fonts/AmiriQuran-Regular.ttf',
  './fonts/Lateef-Regular.ttf',
  './fonts/Lateef-Light.ttf',
  './fonts/Lateef-ExtraLight.ttf',
  './fonts/Lateef-Medium.ttf',
  './fonts/Lateef-SemiBold.ttf',
  './fonts/Lateef-Bold.ttf',
  './fonts/Lateef-ExtraBold.ttf',
  './fonts/Cinzel-VariableFont_wght.ttf',
  './fonts/Montserrat-VariableFont_wght.ttf',
  './fonts/FiraCode-VariableFont_wght.ttf',
  './fonts/OpenDyslexic-Regular.otf',
  './fonts/OpenDyslexic-Bold.otf',
  './fonts/OpenDyslexic-Italic.otf',
  './fonts/OpenDyslexic-BoldItalic.otf',
  './lib/alpine.min.js',
  './src/store-init.js',
  './src/boot.js',
  './src/services/content.js',
  './src/services/storage.js',
  './src/services/audio.js',
  './src/services/share.js',
  './content.ar.json',
  './content.kanz-ar.json',
  './content.kanz-en.json',
];

// Generate audio asset list dynamically — no more hardcoding 308 paths
const AUDIO_COUNT = 308;
const AUDIO_ASSETS = Array.from({ length: AUDIO_COUNT }, (_, i) => `./audios/${i + 1}.opus`);

const SHELL_SET = new Set(SHELL_ASSETS.map(u => new URL(u, self.location).href));
const INDEX_URL = new URL('./index.html', self.location).href;

// ── Install: cache shell immediately ─────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

// ── Activate: delete old shell caches, keep audio cache ──────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== AUDIO_CACHE)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
  cacheAudioInBackground();
});

// ── Fetch ─────────────────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Audio: cache-first (files never change)
  if (url.pathname.includes('/audios/')) {
    e.respondWith(cacheFirst(e.request, AUDIO_CACHE));
    return;
  }

  // Fonts: cache-first (files never change)
  if (url.pathname.includes('/fonts/')) {
    e.respondWith(cacheFirst(e.request, CACHE_NAME));
    return;
  }

  // App shell: stale-while-revalidate so startup reads cache first, but updates are fetched in the background.
  if (SHELL_SET.has(url.href)) {
    e.respondWith(staleWhileRevalidate(e.request, CACHE_NAME));
    return;
  }

  // Navigation requests should still try the network first so the app can update and detect 404s.
  if (e.request.mode === 'navigate') {
    e.respondWith(networkFirst(e.request));
    return;
  }

  // Everything else: cache-first
  e.respondWith(cacheFirst(e.request, CACHE_NAME));
});

// ── Strategies ────────────────────────────────────────────────────────

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') return cache.match(INDEX_URL);
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchAndCache = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);

  return cached || fetchAndCache;
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('', { status: 408 });
  }
}

// ── Background audio caching ──────────────────────────────────────────
async function cacheAudioInBackground() {
  const cache = await caches.open(AUDIO_CACHE);
  for (let i = 0; i < AUDIO_ASSETS.length; i += 20) {
    const batch = AUDIO_ASSETS.slice(i, i + 20);
    await Promise.allSettled(
      batch.map(url =>
        cache.match(url).then(hit =>
          hit ? null : fetch(url).then(r => r.ok ? cache.put(url, r) : null).catch(() => null)
        )
      )
    );
  }
}
