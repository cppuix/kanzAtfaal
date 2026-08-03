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
  const W = 1080, H = 1080;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const st = Alpine.store('app');
  const BODY = st?.mainFontStack || 'Tajawal, sans-serif';
  const DISPLAY = st?.displayFontStack || 'Cinzel, serif';
  const MONO = 'Fira Code, monospace';

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
  const divY = pillY + pillH + 88;
  fadeLine(ctx, pad + 50, divY, W - pad - 50, 'rgba(201,152,42,0.5)');

  // Question — centered, generous; returns end Y so the answer follows tightly
  ctx.fillStyle = '#ecdec4';
  const qStart = divY + 68;
  const qEnd = wrapText(ctx, qa.q, W / 2, qStart, W - 300, 66, 'center', `48px ${BODY}`, H - 360);

  // Answer — label with side rules, then text (no big panel, no dead space)
  const aLabelY = qEnd + 82;
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
  wrapText(ctx, qa.a, W / 2, aLabelY + 66, W - 300, 56, 'center', `44px ${BODY}`, H - 250);

  // Footer — pinned inside the card with clear spacing; URL in Fira Code
  const fy = H - 196;
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

function wrapText(ctx, text, x, y, maxW, lineH, align, font, maxY) {
  ctx.font = font;
  ctx.textAlign = align;
  const words = text.split(' ');
  let line = '';
  let cy = y;
  for (let i = 0; i < words.length; i++) {
    const test = line ? line + ' ' + words[i] : words[i];
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, cy);
      line = words[i];
      cy += lineH;
      if (maxY && cy > maxY) { ctx.fillText('…', x, cy); return cy; }
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cy);
  return cy;
}
