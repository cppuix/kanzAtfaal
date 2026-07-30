import { CFG, toArabic } from './content.js';
import { showToast } from './toast.js';

export async function copyQA(qa) {
  const text = `${qa.q}\n${qa.a}`;
  await navigator.clipboard.writeText(text);
  showToast(CFG.ui.copied);
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
    showToast(CFG.ui.deepLinkCopied);
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
  wrapText(ctx, qa.q, X, 258, W-200, 50, ALIGN, `38px ${FONT}`);

  const midY = 530;
  const grd2 = ctx.createLinearGradient(100, 0, W-100, 0);
  grd2.addColorStop(0, 'transparent');
  grd2.addColorStop(0.5, 'rgba(201,152,42,0.5)');
  grd2.addColorStop(1, 'transparent');
  ctx.strokeStyle = grd2;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(100, midY); ctx.lineTo(W-100, midY); ctx.stroke();

  ctx.fillStyle = '#c9982a';
  ctx.font = `bold 26px ${FONT}`;
  ctx.textAlign = ALIGN;
  ctx.fillText(CFG.ui.answerLabel, X, midY + 52);

  ctx.fillStyle = '#f5d98a';
  wrapText(ctx, qa.a, X, midY + 108, W-200, 46, ALIGN, `36px ${FONT}`);

  ctx.fillStyle = 'rgba(110,96,72,0.6)';
  ctx.font = '20px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('cppuix.github.io/kanzAtfaal', W/2, H-82);

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
