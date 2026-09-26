import { DREAMS, DREAM_IDS } from '../dreams';
import { isKept, lucidity, nightLabel } from '../recording';

// Save the tape (PLAN-2.md 7.1): your recording as a 1200×630 PNG — a
// cassette label on paper — shared through the system sheet where the
// browser can share files (phones, mostly), downloaded everywhere else.
// Plain canvas 2D, no dependencies; works without WebGL.

const W = 1200;
const H = 630;
const PAD = 64;

// The paper theme's tokens, read off an element that carries it.
function paperTokens() {
  const probe = document.createElement('div');
  probe.dataset.theme = 'paper';
  probe.style.display = 'none';
  document.body.appendChild(probe);
  const style = getComputedStyle(probe);
  const read = name => style.getPropertyValue(name).trim();
  const tokens = { surface: read('--surface'), ink: read('--ink'), muted: read('--ink-muted'), faint: read('--ink-faint'), line: read('--line'), rec: read('--rec') };
  probe.remove();
  return tokens;
}

async function loadFonts() {
  await Promise.all([
    document.fonts.load('500 20px "JetBrains Mono"'),
    document.fonts.load('600 20px "JetBrains Mono"'),
    document.fonts.load('italic 30px "Instrument Serif"')
  ]);
  await document.fonts.ready;
}

export async function drawTape(recording, tierLine) {
  await loadFonts();
  const c = paperTokens();
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = c.surface;
  ctx.fillRect(0, 0, W, H);
  // The label's frame: square corners, a thin rule (PLAN.md 4.3).
  ctx.strokeStyle = c.line;
  ctx.lineWidth = 2;
  ctx.strokeRect(PAD / 2, PAD / 2, W - PAD, H - PAD);

  // Header: the rec dot, the machine and the night; what was kept, right.
  ctx.fillStyle = c.rec;
  ctx.beginPath();
  ctx.arc(PAD + 6, PAD + 22, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '0.14em';
  ctx.font = '600 20px "JetBrains Mono"';
  ctx.fillStyle = c.ink;
  ctx.fillText(`ONIRICK DR-1 · NIGHT OF ${nightLabel(recording).toUpperCase()}`, PAD + 26, PAD + 22);
  const kept = `${lucidity(recording)}/5 KEPT`;
  ctx.fillText(kept, W - PAD - ctx.measureText(kept).width, PAD + 22);
  ctx.fillStyle = c.line;
  ctx.fillRect(PAD, PAD + 50, W - PAD * 2, 2);

  // The five tapes.
  const rowH = 74;
  DREAM_IDS.forEach((id, i) => {
    const y = PAD + 104 + i * rowH;
    ctx.letterSpacing = '0.12em';
    ctx.font = '500 16px "JetBrains Mono"';
    ctx.fillStyle = c.muted;
    ctx.fillText(`TAPE 0${i + 1}`, PAD, y);
    ctx.fillText(DREAMS[id].title.toUpperCase(), PAD + 120, y);
    ctx.letterSpacing = '0px';
    if (isKept(id, recording)) {
      ctx.font = 'italic 30px "Instrument Serif"';
      ctx.fillStyle = c.ink;
      const label = DREAMS[id].fragment.label;
      ctx.fillText(label, W - PAD - ctx.measureText(label).width, y);
    } else {
      ctx.letterSpacing = '0.12em';
      ctx.font = '500 16px "JetBrains Mono"';
      ctx.fillStyle = c.faint;
      const none = '— NO SIGNAL —';
      ctx.fillText(none, W - PAD - ctx.measureText(none).width, y);
    }
    if (i < DREAM_IDS.length - 1) {
      ctx.fillStyle = c.line;
      ctx.fillRect(PAD, y + rowH / 2, W - PAD * 2, 1);
    }
  });

  // Footer: the night's line, and where it came from.
  ctx.letterSpacing = '0px';
  ctx.font = 'italic 26px "Instrument Serif"';
  ctx.fillStyle = c.muted;
  ctx.fillText(tierLine, PAD, H - PAD - 8);
  ctx.letterSpacing = '0.12em';
  ctx.font = '500 14px "JetBrains Mono"';
  ctx.fillStyle = c.faint;
  const where = window.location.host.toUpperCase();
  ctx.fillText(where, W - PAD - ctx.measureText(where).width, H - PAD - 8);

  return canvas;
}

// Draws the tape and hands it over: the share sheet if the browser can
// share files, a download otherwise. Resolves 'shared', 'saved' or
// 'cancelled' (the visitor closed the sheet — not an error).
export async function saveTape(recording, tierLine) {
  const canvas = await drawTape(recording, tierLine);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  const name = `onirick-night-${recording.nightOf}.png`;
  const file = new File([blob], name, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Onirick — my night' });
      return 'shared';
    } catch (error) {
      if (error?.name === 'AbortError') return 'cancelled';
      // Sharing failed for another reason: fall back to saving.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'saved';
}
