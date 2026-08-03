import { CFG } from './content.js';

// Toast is owned by the store (Alpine template renders it)
function toast(msg) {
  try {
    const st = Alpine.store('app');
    if (st && st.showToast) st.showToast(msg);
  } catch(e) {}
}

export async function copyQA(qa) {
  const text = `${qa.q}\n${qa.a}`;
  await navigator.clipboard.writeText(text);
  toast(CFG.ui.copied);
}

export function buildDeepLink() {
  const url = new URL(location.href);
  url.search = '';
  url.hash = '';
  return url.toString();
}

export async function shareDeepLink() {
  const url = buildDeepLink();
  if (navigator.share) {
    await navigator.share({ title: CFG.ui.appTitle, url }).catch(() => {});
  } else {
    await navigator.clipboard.writeText(url);
    toast(CFG.ui.deepLinkCopied);
  }
}

export async function shareAsImage(qa) {
  await document.fonts.ready;

  const canvas = document.createElement('canvas');
  const W = 1080;
  canvas.width = W;
  const ctx = canvas.getContext('2d');
  const st = Alpine.store('app');
  const BODY = st?.mainFontStack || 'Tajawal, sans-serif';
  const DISPLAY = st?.displayFontStack || 'Cinzel, serif';
  const MONO = 'Fira Code, monospace';

  const MAX_W = W - 300;                 // centered text measure
  const qLineH = 66, aLineH = 56;        // question / answer line heights
  const CAP = 2160;                      // max card height (~2× square); beyond it → teaser

  // ---- Pass 1: measure wrapped lines so the card can grow to fit its content ----
  const qLines = wrapLines(ctx, qa.q, MAX_W, `48px ${BODY}`);
  const aLines = wrapLines(ctx, qa.a, MAX_W, `44px ${BODY}`);

  const divY = 264;                                      // divider below pill + section label
  const qStart = divY + 68;                              // first question baseline
  const qBottom = qStart + (qLines.length - 1) * qLineH; // last question baseline
  const aLabelY0 = qBottom + 82;                        // answer-label baseline (pass-1 estimate)
  const aStart = aLabelY0 + 66;                         // first answer baseline
  const aBottom = aStart + (aLines.length - 1) * aLineH; // last answer baseline

  let H = Math.max(1080, aBottom + 44 + 196);            // grow so the footer always clears the answer
  const capped = H > CAP;
  if (capped) H = CAP;
  canvas.height = H;
  const fy = H - 196;                                    // footer pinned to the card's bottom edge

  // Background
  ctx.fillStyle = '#0c1a12';
  ctx.fillRect(0, 0, W, H);
  const grd = ctx.createRadialGradient(W/2, H*0.3, 0, W/2, H*0.3, W*0.7);
  grd.addColorStop(0, 'rgba(40,80,30,0.5)');
  grd.addColorStop(1, 'transparent');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);

  // Card body
  const pad = 70;
  ctx.fillStyle = '#172a1e';
  roundRect(ctx, pad, pad, W - pad*2, H - pad*2, 36); ctx.fill();
  ctx.strokeStyle = 'rgba(201,152,42,0.4)';
  ctx.lineWidth = 2;
  roundRect(ctx, pad, pad, W - pad*2, H - pad*2, 36); ctx.stroke();

  // Corner sparkles — small, tucked in the corners, clear of content
  ctx.fillStyle = 'rgba(201,152,42,0.5)';
  ctx.font = `26px ${BODY}`;
  ctx.textAlign = 'left';  ctx.fillText('✦', 96, 126);
  ctx.textAlign = 'right'; ctx.fillText('✦', W - 96, 126);
  ctx.textAlign = 'left';  ctx.fillText('✦', 96, H - 118);
  ctx.textAlign = 'right'; ctx.fillText('✦', W - 96, H - 118);

  // Q pill — centered so it never touches the corner sparkles
  const numText = CFG.ui.questionNum.replace('{n}', st?.toArabic ? st.toArabic(qa.id) : qa.id);
  ctx.font = `bold 30px ${BODY}`;
  const pillW = ctx.measureText(numText).width + 64;
  const pillH = 56, pillY = 120, pillX = (W - pillW) / 2;
  ctx.fillStyle = 'rgba(201,152,42,0.16)';
  roundRect(ctx, pillX, pillY, pillW, pillH, 28); ctx.fill();
  ctx.strokeStyle = 'rgba(201,152,42,0.4)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, pillX, pillY, pillW, pillH, 28); ctx.stroke();
  ctx.fillStyle = '#e8bf5a';
  ctx.textAlign = 'center';
  ctx.fillText(numText, W / 2, pillY + 38);

  // Section — centered
  ctx.fillStyle = '#b0a07c';
  ctx.font = `27px ${BODY}`;
  ctx.fillText(qa.section, W / 2, pillY + pillH + 48);

  // Divider
  fadeLine(ctx, pad + 50, divY, W - pad - 50, 'rgba(201,152,42,0.5)');

  // Question — centered, generous; always rendered in full
  ctx.fillStyle = '#ecdec4';
  ctx.font = `48px ${BODY}`;
  // In capped mode keep the answer label + ≥1 answer line + teaser clear of the question
  const qMaxY = capped ? (fy - 34 - aLineH * 2 - 148) : 0;
  const qEnd = drawLines(ctx, qLines, W / 2, qStart, qLineH, 'center', MAX_W, qMaxY, true);

  // Answer — label with side rules, then text (no big panel, no dead space)
  const aLabelY = (qEnd == null ? qStart : qEnd) + 82;
  const aLabel = CFG.ui.answerLabel;
  ctx.font = `bold 30px ${BODY}`;
  const aLabelW = ctx.measureText(aLabel).width;
  const ruleGap = 34, ruleW = 120;
  ctx.strokeStyle = 'rgba(201,152,42,0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(W/2 - aLabelW/2 - ruleGap - ruleW, aLabelY - 9); ctx.lineTo(W/2 - aLabelW/2 - ruleGap, aLabelY - 9);
  ctx.moveTo(W/2 + aLabelW/2 + ruleGap, aLabelY - 9); ctx.lineTo(W/2 + aLabelW/2 + ruleGap + ruleW, aLabelY - 9);
  ctx.stroke();
  ctx.fillStyle = '#c9982a';
  ctx.fillText(aLabel, W / 2, aLabelY);

  ctx.fillStyle = '#f5d98a';
  ctx.font = `44px ${BODY}`;
  const aStart2 = aLabelY + 66;
  if (!capped) {
    drawLines(ctx, aLines, W / 2, aStart2, aLineH, 'center', MAX_W, 0, false);
  } else {
    // Very long answer: show what fits, fade the tail into the card, point to the app
    const teaserY = fy - 34;
    const lastBaseline = drawLines(ctx, aLines, W / 2, aStart2, aLineH, 'center', MAX_W, teaserY - aLineH - 10, true);
    if (lastBaseline != null) {
      const fadeTop = lastBaseline - aLineH * 2;
      const fadeBottom = lastBaseline + aLineH;
      const fg = ctx.createLinearGradient(0, fadeTop, 0, fadeBottom);
      fg.addColorStop(0, 'rgba(23,42,30,0)');
      fg.addColorStop(1, 'rgba(23,42,30,1)');
      ctx.fillStyle = fg;
      ctx.fillRect(pad, fadeTop, W - pad * 2, fadeBottom - fadeTop);
    }
    ctx.fillStyle = 'rgba(198,208,193,0.9)';
    ctx.font = `26px ${BODY}`;
    ctx.textAlign = 'center';
    ctx.fillText(st?.shareTeaserHint || '✦ full answer inside — open the link', W / 2, teaserY);
  }

  // Footer — pinned inside the card with clear spacing; URL in Fira Code
  fadeLine(ctx, pad + 50, fy, W - pad - 50, 'rgba(201,152,42,0.4)');
  const brand = CFG.about?.title || CFG.ui?.appTitle || '';
  const appUrl = buildDeepLink().replace(/^https?:\/\//, '').replace(/\/$/, '');
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8bf5a';
  ctx.font = `bold 32px ${DISPLAY}`;
  if (brand) ctx.fillText(brand, W / 2, fy + 48);
  ctx.fillStyle = 'rgba(236,222,196,0.7)';
  ctx.font = `24px ${MONO}`;
  ctx.fillText(appUrl, W / 2, fy + (brand ? 98 : 70));

  canvas.toBlob(async blob => {
    const file = new File([blob], `qa-${qa.id}.png`, { type: 'image/png' });
    if (navigator.share && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: CFG.ui.appTitle }).catch(() => {});
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `qa-${qa.id}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    }
  }, 'image/png');
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function fadeLine(ctx, x1, y, x2, color) {
  const g = ctx.createLinearGradient(x1, 0, x2, 0);
  g.addColorStop(0, 'transparent');
  g.addColorStop(0.5, color);
  g.addColorStop(1, 'transparent');
  ctx.strokeStyle = g;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
}

// Split text into wrapped lines (measurement only — no drawing). Must stay in
// sync with drawLines so pass-1 sizing and pass-2 drawing produce identical layout.
function wrapLines(ctx, text, maxW, font) {
  ctx.font = font;
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const test = line ? line + ' ' + words[i] : words[i];
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = words[i];
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Draw pre-wrapped lines centered on x; stops at maxY (baseline limit) and, when
// ellipsize is set, trims the last visible line with '…'. Returns the last
// baseline drawn (or null if nothing fit).
function drawLines(ctx, lines, x, y, lineH, align, maxW, maxY, ellipsize) {
  ctx.textAlign = align;
  let cy = y;
  let drawn = 0;
  for (let i = 0; i < lines.length; i++) {
    if (maxY && cy > maxY) break;
    ctx.fillText(lines[i], x, cy);
    cy += lineH;
    drawn++;
  }
  if (drawn === 0) return null;
  if (ellipsize && drawn < lines.length) {
    const ell = '…';
    let last = lines[drawn - 1];
    while (last.length > 0 && ctx.measureText(last + ell).width > maxW) last = last.slice(0, -1);
    ctx.fillText(last + ell, x, y + (drawn - 1) * lineH);
  }
  return y + (drawn - 1) * lineH;
}
