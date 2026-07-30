// ===== QUIZ RENDERING (temporary bridge — will be replaced by Alpine templates) =====
import { CFG, toArabic } from './content.js';
import { spawnSparkles } from './sparkles.js';
import { recordAnswer } from './storage.js';
import { stopListenAudio, playListenAudio } from './audio.js';

// ===== MODULE-LEVEL QUIZ STATE =====
export let quizQuestions = [];
export let quizCurrent = 0;
export let quizScore = 0;
export let quizAnswered = false;
export let quizMode = 'mcq';
export let buildPlaced = [];

// ===== HELPERS =====
function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function normalizeAr(str) {
  return str
    .replace(/[ً-ٰٟ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// ===== MODE ZONES =====
function hideAllModeZones() {
  ['quizChoices','buildZone','blankZone','listenZone'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
}

// ===== RENDER QUESTION =====
export function renderQuizQuestion() {
  const qa = quizQuestions[quizCurrent];
  const total = quizQuestions.length;

  const store = Alpine.store('app');

  document.getElementById('quizProgressFill').style.width = `${(quizCurrent / total) * 100}%`;
  document.getElementById('quizProgressText').textContent = `${toArabic(quizCurrent + 1)} / ${toArabic(total)}`;
  document.getElementById('quizScoreBadge').textContent = `${CFG.ui.score}: ${toArabic(quizScore)}`;
  document.getElementById('quizFeedback').className = 'quiz-feedback hidden';
  document.getElementById('nextQuizBtn').classList.add('hidden');
  quizAnswered = false;
  if (store) store.quizAnswered = false;
  hideAllModeZones();
  stopListenAudio();

  if (quizMode === 'mcq')    renderMCQ(qa);
  else if (quizMode === 'build')  renderBuild(qa);
  else if (quizMode === 'blank')  renderBlank(qa);
  else if (quizMode === 'listen') renderListen(qa);
}

// ── MCQ ──
function renderMCQ(qa) {
  const store = Alpine.store('app');
  const qaData = store?.QA_DATA || [];

  document.getElementById('quizQNum').textContent = CFG.ui.questionNum.replace("{n}", toArabic(qa.id));
  document.getElementById('quizQText').textContent = qa.q;
  const choicesEl = document.getElementById('quizChoices');
  choicesEl.classList.remove('hidden');
  choicesEl.innerHTML = '';
  const others = qaData.filter(q => q.id !== qa.id).sort(() => Math.random() - 0.5).slice(0, 3);
  const choices = [qa, ...others].sort(() => Math.random() - 0.5);
  choices.forEach(choice => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.textContent = choice.a;
    btn.addEventListener('click', () => answerQuiz(choice.id === qa.id, btn, qa.a));
    choicesEl.appendChild(btn);
  });
}

// ── BUILD ──
function renderBuild(qa) {
  document.getElementById('quizQNum').textContent = CFG.ui.questionNum.replace("{n}", toArabic(qa.id));
  document.getElementById('quizQText').textContent = qa.q;
  const zone = document.getElementById('buildZone');
  zone.classList.remove('hidden');
  buildPlaced = [];

  const words = qa.a.trim().split(/\s+/);
  const shuffled = [...words].sort(() => Math.random() - 0.5);

  const answerEl = document.getElementById('buildAnswer');
  const poolEl = document.getElementById('buildPool');
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
    buildPlaced = buildPlaced.filter(w => w.tileEl !== tile);
    tile.classList.remove('placed');
    updateBuildAnswer(correctWords);
    return;
  }
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

export function checkBuildAnswer() {
  if (quizAnswered) return;
  const qa = quizQuestions[quizCurrent];
  if (!qa) return;
  const userAnswer = buildPlaced.map(p => p.word).join(' ');
  const correct = normalizeAr(userAnswer) === normalizeAr(qa.a);
  quizAnswered = true;
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
  document.getElementById('nextQuizBtn').classList.remove('hidden');
  const store = Alpine.store('app');
  if (store) { store.quizScore = quizScore; store.quizAnswered = true; }
}

// ── BLANK ──
function renderBlank(qa) {
  document.getElementById('quizQNum').textContent = CFG.ui.questionNum.replace("{n}", toArabic(qa.id));
  document.getElementById('quizQText').textContent = qa.q;
  const zone = document.getElementById('blankZone');
  zone.classList.remove('hidden');

  const store = Alpine.store('app');
  const qaData = store?.QA_DATA || [];

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

  const blankEl = document.getElementById('blankText');
  blankEl.innerHTML = words.map((w, i) =>
    i === keyIdx ? '<span class="blank-slot">_____</span>' : escHtml(w)
  ).join(' ');

  const allWords = qaData
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
  const qa = quizQuestions[quizCurrent];
  if (!qa) return;
  quizAnswered = true;
  document.querySelectorAll('.blank-choice-btn').forEach(b => {
    b.disabled = true;
    if (b.textContent === keyWord) b.classList.add('correct');
  });
  blankEl.innerHTML = words.map((w, i) =>
    i === keyIdx
      ? `<span class="blank-filled ${correct ? 'correct' : 'wrong'}">${escHtml(btn.textContent)}</span>`
      : escHtml(w)
  ).join(' ');

  const feedback = document.getElementById('quizFeedback');
  recordAnswer(qa.id, correct);
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
  document.getElementById('nextQuizBtn').classList.remove('hidden');
  const store = Alpine.store('app');
  if (store) { store.quizScore = quizScore; store.quizAnswered = true; }
}

// ── LISTEN ──
function renderListen(qa) {
  document.getElementById('quizQNum').textContent = '';
  document.getElementById('quizQText').textContent = '';
  const zone = document.getElementById('listenZone');
  zone.classList.remove('hidden');

  const store = Alpine.store('app');
  const qaData = store?.QA_DATA || [];

  const playBtn = document.getElementById('listenPlay');
  playBtn.classList.remove('playing');
  const span = playBtn.querySelector('span');
  if (span) span.textContent = CFG.ui.listen;
  playBtn.onclick = () => playListenAudio(qa.id, playBtn);

  const others = qaData.filter(q => q.id !== qa.id).sort(() => Math.random() - 0.5).slice(0, 3);
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

function answerListen(correct, btn, correctQ) {
  if (quizAnswered) return;
  const qa = quizQuestions[quizCurrent];
  if (!qa) return;
  quizAnswered = true;
  stopListenAudio();
  document.querySelectorAll('.listen-q-choice').forEach(b => {
    b.disabled = true;
    if (b.textContent === correctQ) b.classList.add('correct');
  });
  const feedback = document.getElementById('quizFeedback');
  recordAnswer(qa.id, correct);
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
  document.getElementById('nextQuizBtn').classList.remove('hidden');
  const store = Alpine.store('app');
  if (store) { store.quizScore = quizScore; store.quizAnswered = true; }
}

// ── MCQ ANSWER ──
function answerQuiz(correct, btn, correctText) {
  if (quizAnswered) return;
  const qa = quizQuestions[quizCurrent];
  if (!qa) return;
  quizAnswered = true;
  const store = Alpine.store('app');
  if (store) store.quizAnswered = true;

  document.querySelectorAll('.choice-btn').forEach(b => {
    b.disabled = true;
    if (b.textContent === correctText) b.classList.add('correct');
  });

  const feedback = document.getElementById('quizFeedback');
  recordAnswer(qa.id, correct);
  if (correct) {
    quizScore++;
    if (store) store.quizScore = quizScore;
    btn.classList.add('correct');
    feedback.className = 'quiz-feedback correct';
    feedback.textContent = CFG.ui.correctMCQFeedback;
    spawnSparkles(btn, true);
  } else {
    btn.classList.add('wrong');
    feedback.className = 'quiz-feedback wrong';
    feedback.innerHTML = `${CFG.ui.wrongMCQFeedback} <strong>${correctText}</strong>`;
  }
  document.getElementById('nextQuizBtn').classList.remove('hidden');
}

// ===== SHOW RESULT =====
export function showQuizResult() {
  const store = Alpine.store('app');
  if (store) store.quizPhase = 'result';

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

  // Update weak option visibility
  import('./storage.js').then(m => m.updateWeakOption());
}

// ===== SYNC MODULE STATE TO STORE (called by store.initQuiz) =====
export function syncModuleState(questions, current, score, answered, mode) {
  quizQuestions = questions;
  quizCurrent = current ?? 0;
  quizScore = score ?? 0;
  quizAnswered = answered ?? false;
  quizMode = mode || 'mcq';
}
