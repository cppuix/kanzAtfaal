// ===== AUDIO SERVICE =====
// Owns ALL <audio> playback. Never touches the DOM — playing state is written to
// the Alpine store (playingCardId / listenPlaying / listenError / listenBtnText)
// and rendered by templates via :class / x-text bindings.
// Public signatures: playAudio(id), stopAllAudio(), playListenAudio(id), stopListenAudio()
import { CFG } from './content.js';

let currentAudio = null;
export let listenAudio = null;

// ── Card play button (browse) ──────────────────────────────────────────
export function playAudio(id) {
  const store = Alpine.store('app');
  // Toggle: tapping the already-playing card stops it
  if (store && store.playingCardId === id) {
    stopAllAudio();
    return 'stopped';
  }
  stopAllAudio();

  const audio = new Audio(CFG.meta.audioPath.replace('{id}', id));
  currentAudio = audio;
  if (store) store.playingCardId = id;

  const done = () => {
    currentAudio = null;
    if (store && store.playingCardId === id) store.playingCardId = null;
  };
  audio.addEventListener('ended', done);
  audio.addEventListener('error', done);
  audio.play().catch(done);
  return 'playing';
}

export function stopAllAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  const store = Alpine.store('app');
  if (store) store.playingCardId = null;
}

// ── Listen mode (quiz) ─────────────────────────────────────────────────
export function playListenAudio(id) {
  stopListenAudio();
  const store = Alpine.store('app');

  const audio = new Audio(CFG.meta.audioPath.replace('{id}', id));
  listenAudio = audio;
  if (store) {
    store.listenPlaying = true;
    store.listenError = false;
    store.listenBtnText = (CFG.ui?.listen || 'استمع') + '...';
  }

  audio.addEventListener('ended', () => {
    listenAudio = null;
    if (store) {
      store.listenPlaying = false;
      store.listenBtnText = CFG.ui?.replay || 'إعادة';
    }
  });
  audio.addEventListener('error', () => {
    listenAudio = null;
    if (store) {
      store.listenPlaying = false;
      store.listenError = true;
      store.listenBtnText = CFG.ui?.audioError || 'خطأ';
    }
  });
  audio.play().catch(() => {
    listenAudio = null;
    if (store) {
      store.listenPlaying = false;
      store.listenError = true;
      store.listenBtnText = CFG.ui?.audioError || 'خطأ';
    }
  });
}

export function stopListenAudio() {
  if (listenAudio) {
    listenAudio.pause();
    listenAudio = null;
  }
  const store = Alpine.store('app');
  if (store) store.listenPlaying = false;
}
