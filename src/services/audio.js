import { CFG } from './content.js';

const PLAY_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
const STOP_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>`;

export { PLAY_SVG, STOP_SVG };

let currentAudio = null;
let currentWrapper = null;
export let listenAudio = null;

function resetAllPlayBtns(wrapper) {
  wrapper.querySelectorAll('.play-btn').forEach(b => {
    b.innerHTML = PLAY_SVG;
    b.classList.remove('playing');
  });
}

export function playAudio(id, btn, wrapper) {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    if (currentWrapper) resetAllPlayBtns(currentWrapper);
    if (currentWrapper === wrapper) {
      currentAudio = null;
      currentWrapper = null;
      return;
    }
  }

  const audio = new Audio(CFG.meta.audioPath.replace('{id}', id));
  currentAudio = audio;
  currentWrapper = wrapper;

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

export function stopAllAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  if (currentWrapper) {
    resetAllPlayBtns(currentWrapper);
    currentWrapper = null;
  }
}

export function playListenAudio(id, btn) {
  stopListenAudio();
  const audio = new Audio(CFG.meta.audioPath.replace('{id}', id));
  listenAudio = audio;
  btn.classList.add('playing');
  const span = btn.querySelector('span');
  if (span) span.textContent = CFG.ui.listen + '...';
  audio.addEventListener('ended', () => {
    btn.classList.remove('playing');
    if (span) span.textContent = CFG.ui.replay;
  });
  audio.addEventListener('error', () => {
    btn.classList.remove('playing');
    if (span) span.textContent = CFG.ui.audioError;
    btn.disabled = true;
    btn.style.opacity = '0.5';
  });
  audio.play().catch(() => {
    btn.classList.remove('playing');
    if (span) span.textContent = CFG.ui.audioError;
    btn.disabled = true;
    btn.style.opacity = '0.5';
  });
}

export function stopListenAudio() {
  if (listenAudio) { listenAudio.pause(); listenAudio = null; }
}
