// One sheet with every card on it, so the set can be looked at as a set.
//
//   node cards/tools/contact.mjs            # -> cards/CONTACT.png
//
// Reviewing 34 posters one file at a time hides the thing you most want to
// see: whether they look like one channel. Side by side, a theme that repeats
// three times in a row, or a title that reads differently from its neighbours,
// is obvious.
import { readdirSync, readFileSync, existsSync, writeFileSync, statSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(join(execSync('npm root -g').toString().trim(), 'playwright'))); }

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const COLS = 6;
const CELL = 300;            // poster width in the sheet; 9:16 keeps the height

const cards = readdirSync(ROOT)
  .filter((d) => /^\d{4}-/.test(d) && statSync(join(ROOT, d)).isDirectory())
  .sort()
  .map((slug) => {
    const png = join(ROOT, slug, 'poster-quiet.png');
    const json = join(HERE, 'content', `${slug}.json`);
    if (!existsSync(png) || !existsSync(json)) return null;
    const d = JSON.parse(readFileSync(json, 'utf8'));
    return { slug, png, theme: d.theme || '-', title: (d.youtube || {}).title || d.title.join(' ') };
  })
  .filter(Boolean);

if (!cards.length) { console.error('no rendered posters found'); process.exit(1); }

const b64 = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;
const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

const html = `<!doctype html><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#f4f2ee;font-family:system-ui,'Noto Sans KR',sans-serif;padding:40px}
  h1{font-size:30px;letter-spacing:-.02em;color:#23201c}
  .n{font-size:16px;color:#6d6a62;margin:6px 0 28px}
  .grid{display:grid;grid-template-columns:repeat(${COLS},${CELL}px);gap:30px 26px}
  figure{width:${CELL}px}
  img{width:${CELL}px;display:block;border:1px solid #ddd8cc;border-radius:8px;background:#fff}
  figcaption{margin-top:8px;font-size:14px;line-height:1.35;color:#23201c}
  .m{font-size:12px;color:#8a857a;margin-top:2px;font-variant-numeric:tabular-nums}
</style>
<h1>삶의 문장 노트 — 카드 ${cards.length}장</h1>
<div class="n">${new Date().toISOString().slice(0, 10)} · poster-quiet.png</div>
<div class="grid">${cards.map((c) => `<figure>
  <img src="${b64(c.png)}">
  <figcaption>${esc(c.title)}<div class="m">${esc(c.slug)} · ${esc(c.theme)}</div></figcaption>
</figure>`).join('')}</div>`;

const out = resolve(ROOT, 'CONTACT.png');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: COLS * CELL + (COLS - 1) * 26 + 80, height: 1200 } });
await page.setContent(html, { waitUntil: 'load' });
await page.screenshot({ path: out, fullPage: true });
await browser.close();
try { execSync(`pngquant --quality=60-88 --speed 1 --force --output ${JSON.stringify(out)} ${JSON.stringify(out)}`, { stdio: 'pipe' }); } catch { /* optional */ }
console.log(`${cards.length} cards -> ${out}`);
