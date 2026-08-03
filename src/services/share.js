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
  const isRTL = document.documentElement.dir === 'rtl';
  const FONT = isRTL ? 'Amiri, serif' : 'Georgia, serif';

  ctx.fillStyle = '#0c1a12';
  ctx.fillRect(0, 0, W, H);

  const grd = ctx.createRadialGradient(W/2, H*0.3, 0, W/2, H*0.3, W*0.7);
  grd.addColorStop(0, 'rgba(40,80,30,0.5)');
  grd.addColorStop(1, 'transparent');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#172a1e';
  roundRect(ctx, 60, 60, W-120, H-120, 32);
  ctx.fill();

  ctx.strokeStyle = 'rgba(201,152,42,0.4)';
  ctx.lineWidth = 2;
  roundRect(ctx, 60, 60, W-120, H-120, 32);
  ctx.stroke();

  const grad = ctx.createLinearGradient(60, 0, W-60, 0);
  grad.addColorStop(0, 'transparent');
  grad.addColorStop(0.5, '#c9982a');
  grad.addColorStop(1, 'transparent');
  ctx.strokeStyle = grad;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(60, 92); ctx.lineTo(W-60, 92); ctx.stroke();

  const X = isRTL ? W-100 : 100;
  const ALIGN = isRTL ? 'right' : 'left';

  const numText = CFG.ui.questionNum.replace('{n}', qa.id);
  ctx.font = `bold 26px ${FONT}`;
  const pillTextW = ctx.measureText(numText).width;
  const pillPad = 28, pillH = 46, pillY = 95;
  const pillW = pillTextW + pillPad * 2;
  const pillX = isRTL ? W - 100 - pillW : 100;
  ctx.fillStyle = 'rgba(201,152,42,0.18)';
  ctx.beginPath(); ctx.roundRect(pillX, pillY, pillW, pillH, 23); ctx.fill();
  ctx.strokeStyle = 'rgba(201,152,42,0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(pillX, pillY, pillW, pillH, 23); ctx.stroke();
  ctx.fillStyle = '#e8bf5a';
  ctx.textAlign = 'center';
  ctx.fillText(numText, pillX + pillW / 2, pillY + 31);

  ctx.fillStyle = '#7a6a50';
  ctx.font = `22px ${FONT}`;
  ctx.textAlign = ALIGN;
  ctx.fillText(qa.section, X, 178);

  ctx.strokeStyle = 'rgba(201,152,42,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(100, 198); ctx.lineTo(W-100, 198); ctx.stroke();

  ctx.fillStyle = '#ecdec4';
  wrapText(ctx, qa.q, X, 262, W-220, 54, ALIGN, `40px ${FONT}`);

  // Answer panel — a distinct rounded block
  const aTop = 556, aBottom = 872, aX = 100, aW = W - 200;
  ctx.fillStyle = 'rgba(18,32,25,0.92)';
  roundRect(ctx, aX, aTop, aW, aBottom - aTop, 26); ctx.fill();
  ctx.strokeStyle = 'rgba(201,152,42,0.28)';
  ctx.lineWidth = 2;
  roundRect(ctx, aX, aTop, aW, aBottom - aTop, 26); ctx.stroke();

  ctx.fillStyle = '#c9982a';
  ctx.font = `bold 28px ${FONT}`;
  ctx.textAlign = ALIGN;
  ctx.fillText(CFG.ui.answerLabel, X, aTop + 56);

  ctx.fillStyle = '#f5d98a';
  wrapText(ctx, qa.a, X, aTop + 118, aW - 60, 48, ALIGN, `38px ${FONT}`);

  // Footer — brand + current URL (never hardcoded)
  const fy = 952;
  const grd3 = ctx.createLinearGradient(100, 0, W-100, 0);
  grd3.addColorStop(0, 'transparent');
  grd3.addColorStop(0.5, 'rgba(201,152,42,0.45)');
  grd3.addColorStop(1, 'transparent');
  ctx.strokeStyle = grd3; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(100, fy); ctx.lineTo(W-100, fy); ctx.stroke();

  const brand = CFG.about?.title || CFG.ui?.appTitle || '';
  const appUrl = buildDeepLink().replace(/^https?:\/\//, '').replace(/\/$/, '');
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e8bf5a';
  ctx.font = `bold 28px ${FONT}`;
  if (brand) ctx.fillText(brand, W/2, fy + 46);
  ctx.fillStyle = 'rgba(236,222,196,0.72)';
  ctx.font = `21px ${FONT}`;
  ctx.fillText(appUrl, W/2, fy + (brand ? 88 : 60));

  ctx.fillStyle = 'rgba(201,152,42,0.25)';
  ctx.font = `44px ${FONT}`;
  ctx.textAlign = 'left';  ctx.fillText('✦', 82, 114);
  ctx.textAlign = 'right'; ctx.fillText('✦', W-82, 114);
  ctx.textAlign = 'left';  ctx.fillText('❖', 82, H-82);
  ctx.textAlign = 'right'; ctx.fillText('❖', W-82, H-82);

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

function wrapText(ctx, text, x, y, maxW, lineH, align, font) {
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
      if (cy > 980) { ctx.fillText('…', x, cy); break; }
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cy);
}
