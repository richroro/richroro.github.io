// Card-news renderer: content JSON -> 1080x1350 PNG cards.
// Usage: node cards/tools/render.mjs <content.json> [outDir] [--frame=1080x1920]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

// Playwright may live in the project or in the global npm root; ESM only finds the former.
const req = createRequire(import.meta.url);
const loadChromium = () => {
  try {
    return req('playwright').chromium;
  } catch {
    const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
    return req(resolve(globalRoot, 'playwright')).chromium;
  }
};
const chromium = loadChromium();

const HERE = dirname(fileURLToPath(import.meta.url));
const FONT_DIR = resolve(HERE, '.fonts');
const FONTS = {
  'Gaegu-Bold.ttf': 'https://raw.githubusercontent.com/google/fonts/main/ofl/gaegu/Gaegu-Bold.ttf',
  'Gaegu-Regular.ttf': 'https://raw.githubusercontent.com/google/fonts/main/ofl/gaegu/Gaegu-Regular.ttf',
  'NotoSansKR.ttf': 'https://raw.githubusercontent.com/google/fonts/main/ofl/notosanskr/NotoSansKR%5Bwght%5D.ttf',
};

const W = 1080, CARD_H = 1350;
// Shorts want 9:16, but YouTube's UI covers the top and bottom of the frame.
// A taller frame keeps the 1080x1350 card composition centred in the safe area
// and just extends the paper background around it.
const frameArg = process.argv.find((a) => a.startsWith('--frame='));
const FRAME_H = frameArg ? Number(frameArg.split('=')[1].split('x')[1]) : CARD_H;
// Nudge the card above dead centre: the Shorts description and channel row eat
// more of the bottom than the title bar does of the top.
const LIFT = FRAME_H > CARD_H ? 90 : 0;

async function ensureFonts() {
  mkdirSync(FONT_DIR, { recursive: true });
  for (const [name, url] of Object.entries(FONTS)) {
    const p = resolve(FONT_DIR, name);
    if (existsSync(p)) continue;
    process.stdout.write(`  fetching ${name}...\n`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`font download failed: ${name} ${res.status}`);
    writeFileSync(p, Buffer.from(await res.arrayBuffer()));
  }
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const lines = (a) => (Array.isArray(a) ? a : [a]).map((l) => `<span>${esc(l)}</span>`).join('');

const dataFont = (file) =>
  `url(data:font/ttf;base64,${readFileSync(resolve(FONT_DIR, file)).toString('base64')})`;

const CSS = () => `
@font-face{font-family:'Hand';src:${dataFont('Gaegu-Bold.ttf')};font-weight:700}
@font-face{font-family:'Hand';src:${dataFont('Gaegu-Regular.ttf')};font-weight:400}
@font-face{font-family:'Sans';src:${dataFont('NotoSansKR.ttf')}}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${FRAME_H}px}
body{font-family:'Hand',sans-serif;-webkit-font-smoothing:antialiased}
.frame{position:relative;width:${W}px;height:${FRAME_H}px;overflow:hidden;
  display:flex;align-items:center;justify-content:center;
  background:radial-gradient(120% 95% at 50% 0%,#fbfaf7 0%,#f2efe9 55%,#eae6de 100%)}
.card{position:relative;width:${W}px;height:${CARD_H}px;transform:translateY(-${LIFT}px);
  display:flex;flex-direction:column;padding:96px 92px 78px}
.vig{position:absolute;inset:0;pointer-events:none;
  box-shadow:inset 0 0 180px rgba(120,110,95,.13)}
.ink{color:#17181a}

/* ---- head rule: index + hairline ---- */
.head{position:relative;z-index:2;display:flex;align-items:center;gap:26px}
.idx{font-family:'Sans';font-weight:700;font-size:27px;letter-spacing:.14em;color:#2f6f9e}
.rule{flex:1;height:1px;background:linear-gradient(90deg,#c9c3b6,rgba(201,195,182,0))}

/* ---- list card ---- */
.body{position:relative;z-index:2;flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center}
.body.evenly{justify-content:space-evenly}
.title{font-weight:700;font-size:88px;line-height:1.24;letter-spacing:-.01em}
.title.sm{font-size:74px}
.title.xs{font-size:64px}
.uline{width:148px;height:7px;margin:34px auto 0;border-radius:6px;
  background:linear-gradient(90deg,rgba(47,111,158,.15),rgba(47,111,158,.75),rgba(47,111,158,.15))}
.items{display:flex;flex-direction:column;gap:48px;text-align:left}
.item{display:flex;align-items:baseline;gap:26px;font-weight:700;font-size:74px;line-height:1.2}
.item .n{font-size:62px;color:#2f6f9e;min-width:70px}
.note{position:relative;z-index:2;font-family:'Sans';font-size:29px;line-height:1.66;color:#7d796f;
  padding-top:26px;border-top:1px solid #d9d3c7;max-width:760px}
.pg{position:absolute;right:92px;bottom:74px;z-index:2;font-family:'Sans';font-size:26px;color:#a49e91;
  ${LIFT ? 'display:none' : ''}}

/* ---- cover ---- */
.eyebrow{font-weight:700;font-size:34px;letter-spacing:.3em;color:#2f6f9e}
.cover-t{font-weight:700;font-size:104px;line-height:1.22;margin-top:36px;letter-spacing:-.015em}
.cover-s{font-weight:400;font-size:46px;line-height:1.56;margin-top:40px;color:#6d6a63}
.cover-foot{position:relative;z-index:2;display:flex;justify-content:space-between;align-items:flex-end;
  font-family:'Sans';font-size:27px;color:#8d887c}
.cover-bar{width:132px;height:8px;border-radius:6px;background:#2f6f9e;margin-bottom:30px}
.col{display:flex;flex-direction:column}
.col span{display:block}

/* ---- outro ---- */
.btn{display:inline-block;margin-top:86px;padding:30px 66px;border-radius:999px;
  background:#17181a;color:#f6f4ef;font-weight:700;font-size:46px;letter-spacing:.01em}
.brand{position:relative;z-index:2;text-align:center;font-family:'Sans';font-size:28px;color:#9a9488;letter-spacing:.16em}
`;

const shell = () =>
  `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${CSS()}</style></head>` +
  `<body><div class="frame"><div class="card" id="card"></div><div class="vig"></div></div></body></html>`;

const page = (inner) => inner;

// Title size steps down as the headline gets longer, so nothing wraps into 3 lines.
const titleClass = (t) => (t.length <= 12 ? '' : t.length <= 16 ? 'sm' : 'xs');

const coverHtml = (c, brand) => page(`
  <div class="body" style="align-items:flex-start;text-align:left;justify-content:center">
    <div class="eyebrow">${esc(c.eyebrow)}</div>
    <div class="cover-t ink col">${lines(c.title)}</div>
    <div class="cover-s col">${lines(c.sub)}</div>
  </div>
  <div class="cover-foot">
    <div><div class="cover-bar"></div>${esc(c.footL)}</div>
    <div>${esc(c.footR || brand)}</div>
  </div>`);

const listHtml = (card, i, total) => page(`
  <div class="head"><div class="idx">${String(i + 1).padStart(2, '0')}</div><div class="rule"></div></div>
  <div class="body evenly">
    <div>
      <div class="title ink ${titleClass(card.title)}">${esc(card.title)}</div>
      <div class="uline"></div>
    </div>
    <div class="items ink">
      ${card.items.map((it, n) => `<div class="item"><span class="n">${n + 1}.</span><span>${esc(it)}</span></div>`).join('')}
    </div>
  </div>
  ${card.note ? `<div class="note">${esc(card.note)}</div>` : ''}
  <div class="pg">${i + 1}/${total}</div>`);

const outroHtml = (o, brand) => page(`
  <div class="body">
    <div class="title ink col" style="font-size:92px">${lines(o.title)}</div>
    <div class="cover-s col" style="text-align:center">${lines(o.sub)}</div>
    <div class="btn">${esc(o.button)}</div>
  </div>
  <div class="brand">${esc(brand)}</div>`);

if (!process.argv[2]) {
  console.error('usage: node cards/tools/render.mjs <content.json> [outDir]');
  process.exit(1);
}
const data = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const outArg = process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : null;
const outDir = resolve(outArg || resolve(HERE, '..', data.slug));

await ensureFonts();
mkdirSync(outDir, { recursive: true });

const total = data.lists.length;
const jobs = [
  ['01_cover.png', coverHtml(data.cover, data.brand)],
  ...data.lists.map((c, i) => [`${String(i + 2).padStart(2, '0')}_list${String(i + 1).padStart(2, '0')}.png`, listHtml(c, i, total)]),
  [`${String(total + 2).padStart(2, '0')}_outro.png`, outroHtml(data.outro, data.brand)],
];

const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: W, height: FRAME_H }, deviceScaleFactor: 1 });
await p.setContent(shell(), { waitUntil: 'load' });
await p.evaluate(() => document.fonts.load('700 88px Hand').then(() => document.fonts.ready));

for (const [name, html] of jobs) {
  await p.evaluate((h) => { document.getElementById('card').innerHTML = h; }, html);
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: resolve(outDir, name) });
  console.log('  ✓', name);
}
await browser.close();

let optimized = 0;
for (const [name] of jobs) {
  const file = resolve(outDir, name);
  try {
    execSync(`pngquant --quality=70-95 --speed 1 --force --output ${JSON.stringify(file)} ${JSON.stringify(file)}`, { stdio: 'pipe' });
    optimized++;
  } catch {
    /* pngquant missing or it declined the quality target - keep the original PNG */
  }
}
if (optimized < jobs.length) console.log(`  (pngquant unavailable or skipped for ${jobs.length - optimized} file(s))`);
console.log(`\n${jobs.length} cards -> ${outDir}`);
