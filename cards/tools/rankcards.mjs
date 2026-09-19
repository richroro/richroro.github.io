// 9:16 countdown frames for a ranking infographic, for the shorts cut.
// Counts down (10th -> 1st) so the top entry lands last.
//
//   node cards/tools/rankcards.mjs cards/tools/content/0008-apt.json <outDir>
//
// Writes the frames plus a manifest of hold times for shorts.mjs.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const req = createRequire(import.meta.url);
const chromium = (() => {
  try { return req('playwright').chromium; }
  catch { return req(resolve(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')).chromium; }
})();

const HERE = dirname(fileURLToPath(import.meta.url));
const FONT_DIR = resolve(HERE, '.fonts');
const W = 1080, H = 1920;
const COVER = 3.0, CARD = 3.6, OUTRO = 4.0;

const font = (f) => `url(data:font/ttf;base64,${readFileSync(resolve(FONT_DIR, f)).toString('base64')})`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const SLOT_BG = '#2b2622';

const win = (x, y, w, h, cols, rows, gap = 4) => {
  const cw = (w - gap * (cols - 1)) / cols, ch = (h - gap * (rows - 1)) / rows;
  let o = '';
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++)
    o += `<rect x="${(x + c * (cw + gap)).toFixed(1)}" y="${(y + r * (ch + gap)).toFixed(1)}" width="${cw.toFixed(1)}" height="${ch.toFixed(1)}" rx="1" fill="${SLOT_BG}"/>`;
  return o;
};
const BUILDINGS = [
  () => `<rect x="42" y="10" width="16" height="9" rx="2"/><rect x="28" y="19" width="44" height="71" rx="3"/>` + win(35, 27, 30, 46, 3, 4),
  () => `<rect x="16" y="30" width="30" height="60" rx="3"/><rect x="54" y="18" width="30" height="72" rx="3"/>` + win(22, 38, 18, 36, 2, 3) + win(60, 26, 18, 48, 2, 4),
  () => `<rect x="12" y="28" width="76" height="62" rx="3"/>` + win(21, 37, 58, 40, 4, 3),
  () => `<rect x="10" y="52" width="32" height="38" rx="3"/><rect x="38" y="34" width="30" height="56" rx="3"/><rect x="64" y="60" width="26" height="30" rx="3"/>` + win(16, 60, 20, 20, 2, 2) + win(44, 42, 18, 32, 2, 3),
  () => `<rect x="38" y="10" width="26" height="44" rx="3"/><rect x="16" y="50" width="68" height="40" rx="3"/>` + win(43, 17, 16, 30, 2, 3) + win(24, 58, 52, 22, 4, 2),
];
const building = (i) => `<svg viewBox="0 0 100 100" fill="currentColor">${BUILDINGS[i % BUILDINGS.length]()}</svg>`;

const CSS = `
@font-face{font-family:'Display';src:${font('BlackHanSans.ttf')}}
@font-face{font-family:'Body';src:${font('GothicA1-Bold.ttf')};font-weight:700}
@font-face{font-family:'Body';src:${font('GothicA1-ExtraBold.ttf')};font-weight:800}
@font-face{font-family:'Hand';src:${font('Gaegu-Bold.ttf')}}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px}
body{font-family:'Body',sans-serif;font-weight:700;-webkit-font-smoothing:antialiased;
  background:linear-gradient(180deg,#fdf4e2 0%,#f8ead0 55%,#f3e2c4 100%)}
/* Content stays clear of the Shorts chrome at the top and bottom. */
.f{position:relative;width:${W}px;height:${H}px;display:flex;flex-direction:column;
  align-items:center;justify-content:center;padding:300px 80px 380px;text-align:center}
.kicker{font-size:34px;color:#8d8172;letter-spacing:.04em}
.rank{font-family:'Display';font-size:132px;color:#e0392b;line-height:1.16;margin-top:6px}
.slot{width:270px;height:270px;border-radius:44px;background:${SLOT_BG};color:#ffd84d;
  display:flex;align-items:center;justify-content:center;margin:26px 0 34px}
.slot svg{width:196px;height:196px}
.name{font-family:'Body';font-weight:800;font-size:76px;color:#2b2622;letter-spacing:-.03em;line-height:1.24}
.name.sm{font-size:64px}
.loc{font-size:36px;color:#8d8172;margin-top:14px}
.area{font-size:32px;color:#a2977f;margin-top:8px}
.price{font-family:'Display';font-size:84px;color:#e0392b;margin-top:34px;line-height:1.24}
.tag{position:absolute;top:210px;left:0;right:0;text-align:center;font-size:30px;color:#a2977f;letter-spacing:.14em}

.c-badge{background:#ffe27a;border-radius:14px;padding:18px 26px;font-family:'Hand';
  font-size:38px;color:#4a3a12;transform:rotate(-5deg);line-height:1.24}
.c-t1{font-family:'Body';font-weight:800;font-size:72px;color:#2b2622;margin-top:40px;letter-spacing:-.03em}
.c-t2{font-family:'Display';font-size:112px;color:#e0392b;position:relative;margin-top:8px;line-height:1.26}
.c-t2::after{content:'';position:absolute;left:-10px;right:-10px;bottom:22px;height:26px;
  background:#ffd84d;opacity:.55;z-index:-1;border-radius:5px}
.c-sub{margin-top:34px;background:#2b2622;color:#fdf4e2;border-radius:999px;
  padding:18px 40px;font-size:36px}
.o-t{font-family:'Hand';font-size:74px;color:#a8744a;line-height:1.4}
.o-n{font-size:30px;color:#8d8172;line-height:1.66;margin-top:40px;max-width:820px}
.brand{position:absolute;bottom:300px;left:0;right:0;text-align:center;font-size:28px;
  color:#a99b85;letter-spacing:.16em}
`;

const shell = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${CSS}</style></head><body><div id="f"></div></body></html>`;

const cover = (d) => `<div class="f">
  <div class="c-badge">${d.badge.map(esc).join('<br>')}</div>
  <div class="c-t1">${esc(d.title[0])}</div>
  <div class="c-t2">${esc(d.title[1])}</div>
  <div class="c-sub">${esc(d.subtitle)}</div>
  <div class="brand">${esc(d.brand)}</div></div>`;

const card = (r, i, d) => `<div class="f">
  <div class="tag">${esc(d.title[0])} ${esc(d.title[1])}</div>
  <div class="kicker">공시가격</div>
  <div class="rank">${r.rank}위</div>
  <div class="slot">${building(i)}</div>
  <div class="name ${r.label.length > 7 ? 'sm' : ''}">${esc(r.label)}</div>
  <div class="loc">${esc(r.sub)}</div>
  <div class="area">전용 ${esc(r.mid)}</div>
  <div class="price">${esc(r.price)}</div></div>`;

const outro = (d) => `<div class="f">
  <div class="o-t">${d.closing.map(esc).join('<br>')}</div>
  <div class="o-n">${esc(d.note[0])}<br>${esc(d.note[1])}</div>
  <div class="brand">${esc(d.brand)}</div></div>`;

const data = JSON.parse(readFileSync(process.argv[2] || '', 'utf8'));
const outDir = resolve(process.argv[3] || resolve(HERE, '..', data.slug, 'frames'));
mkdirSync(outDir, { recursive: true });

const countdown = [...data.rows].sort((a, b) => b.rank - a.rank);
const jobs = [
  ['000_cover.png', cover(data), COVER],
  ...countdown.map((r, i) => [`${String(i + 1).padStart(3, '0')}_rank${r.rank}.png`, card(r, r.rank - 1, data), CARD]),
  [`${String(countdown.length + 1).padStart(3, '0')}_outro.png`, outro(data), OUTRO],
];

const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await p.setContent(shell, { waitUntil: 'load' });
await p.evaluate(() => document.fonts.load('400 132px Display').then(() => document.fonts.ready));
for (const [name, html] of jobs) {
  await p.evaluate((h) => { document.getElementById('f').innerHTML = h; }, html);
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: resolve(outDir, name) });
}
await browser.close();

writeFileSync(resolve(outDir, 'manifest.json'),
  JSON.stringify(jobs.map(([file, , seconds]) => ({ file, seconds })), null, 2));
console.log(`${jobs.length} frames -> ${outDir}`);
