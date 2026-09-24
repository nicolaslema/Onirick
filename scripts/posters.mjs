// Renders one still per 3D section into public/posters/<id>.webp (1600px
// wide) — what an offstage section, or a browser without WebGL2, shows in
// place of its live scene (PLAN.md 3.2, 6).
//
//   pnpm dev            (in another terminal)
//   pnpm posters [url]  (default http://localhost:5173/)
//
// Drives the installed Chrome through playwright-core (no browser download):
// walks the night one section at a time with the arrow key, waits for each
// scene to render and settle, and saves its canvas — the scene only; the
// section's copy is real DOM drawn over the poster.
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';

const url = process.argv[2] ?? 'http://localhost:5173/';
const OUT = new URL('../public/posters/', import.meta.url);
const WIDTH = 1600;
const SETTLE_MS = 1500;

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: WIDTH, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', err => console.error('page error:', err.message));

await page.goto(url);
await page.waitForSelector('.onk-loader', { state: 'detached', timeout: 30000 });
await mkdir(OUT, { recursive: true });

const ids = await page.$$eval('.scroll-sections-host', hosts => hosts.map(h => h.dataset.section));

for (let i = 0; i < ids.length; i++) {
  const id = ids[i];
  const host = `.scroll-sections-host[data-section="${id}"]`;
  // current, done transitioning, and (if it has a scene) rendered
  await page.waitForFunction(
    sel => {
      const h = document.querySelector(sel);
      const melt = document.querySelector('.scroll-sections-canvas');
      const settled = h && !h.dataset.offscreen && !h.dataset.plainEnter && melt?.style.opacity !== '1';
      return settled && !h.querySelector('[data-scene-ready="false"]');
    },
    host,
    { timeout: 30000 }
  );

  if (await page.$(`${host} canvas`)) {
    await page.waitForTimeout(SETTLE_MS);
    const dataUrl = await page.$eval(
      `${host} canvas`,
      (canvas, width) => {
        const out = document.createElement('canvas');
        out.width = width;
        out.height = Math.round((width * canvas.height) / canvas.width);
        out.getContext('2d').drawImage(canvas, 0, 0, out.width, out.height);
        return out.toDataURL('image/webp', 0.82);
      },
      WIDTH
    );
    const file = new URL(`${id}.webp`, OUT);
    await writeFile(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
    console.log(`poster: ${id}.webp`);
  } else {
    console.log(`skip:   ${id} (no scene)`);
  }

  if (i === ids.length - 1) break;
  // A 'scroll' section (the manual) has to reach its bottom before the arrow
  // key leaves it.
  await page.$eval(`${host} .scroll-sections-capture`, el => {
    el.scrollTop = el.scrollHeight;
  });
  // ScrollSections deliberately drops a gesture whose melt textures aren't
  // captured yet, so press again until the next section starts entering.
  const next = `.scroll-sections-host[data-section="${ids[i + 1]}"]`;
  for (let attempt = 0; ; attempt++) {
    await page.$eval('.scroll-sections', el =>
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))
    );
    const moved = await page
      .waitForFunction(sel => !document.querySelector(sel).dataset.offscreen, next, { timeout: 4000 })
      .then(() => true, () => false);
    if (moved) break;
    if (attempt === 5) throw new Error(`stuck leaving ${id}`);
  }
}

await browser.close();
