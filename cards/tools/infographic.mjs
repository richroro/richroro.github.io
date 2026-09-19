// Long-form infographic poster: content JSON -> one tall PNG.
//
//   node cards/tools/infographic.mjs cards/tools/content/0007-100m.json
//   -> cards/<slug>/poster.png
//
// Rows take an optional "image" (a local path) for the thumbnail slot; without
// one the slot renders the row's rank instead, so the poster works with or
// without photography.
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const req = createRequire(import.meta.url);
const chromium = (() => {
  try {
    return req('playwright').chromium;
  } catch {
    return req(resolve(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'playwright')).chromium;
  }
})();

const HERE = dirname(fileURLToPath(import.meta.url));
const FONT_DIR = resolve(HERE, '.fonts');
const W = 1080;

const font = (f) => `url(data:font/ttf;base64,${readFileSync(resolve(FONT_DIR, f)).toString('base64')})`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const img = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`;

// Decorative building silhouettes. These stand in for photography we have no
// licence to use; they are not drawings of the actual buildings, which the
// footer says outright. Varying the shape keeps a long list from flattening.
const SLOT_BG = '#2b2622';

// Windows are punched in the slot's background colour - drawn in the body
// colour they simply vanish into it.
const windows = (x, y, w, h, cols, rows, gap = 4) => {
  const cw = (w - gap * (cols - 1)) / cols;
  const ch = (h - gap * (rows - 1)) / rows;
  let out = '';
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < rows; r++)
      out += `<rect x="${(x + c * (cw + gap)).toFixed(1)}" y="${(y + r * (ch + gap)).toFixed(1)}" ` +
             `width="${cw.toFixed(1)}" height="${ch.toFixed(1)}" rx="1" fill="${SLOT_BG}"/>`;
  return out;
};

const BUILDINGS = [
  // slim tower with a crown
  () => `<rect x="42" y="10" width="16" height="9" rx="2"/><rect x="28" y="19" width="44" height="71" rx="3"/>` +
        windows(35, 27, 30, 46, 3, 4),
  // twin towers
  () => `<rect x="16" y="30" width="30" height="60" rx="3"/><rect x="54" y="18" width="30" height="72" rx="3"/>` +
        windows(22, 38, 18, 36, 2, 3) + windows(60, 26, 18, 48, 2, 4),
  // wide block
  () => `<rect x="12" y="28" width="76" height="62" rx="3"/>` + windows(21, 37, 58, 40, 4, 3),
  // stepped terraces
  () => `<rect x="10" y="52" width="32" height="38" rx="3"/><rect x="38" y="34" width="30" height="56" rx="3"/>` +
        `<rect x="64" y="60" width="26" height="30" rx="3"/>` +
        windows(16, 60, 20, 20, 2, 2) + windows(44, 42, 18, 32, 2, 3),
  // tower on a podium
  () => `<rect x="38" y="10" width="26" height="44" rx="3"/><rect x="16" y="50" width="68" height="40" rx="3"/>` +
        windows(43, 17, 16, 30, 2, 3) + windows(24, 58, 52, 22, 4, 2),
];

const buildingSvg = (i) =>
  `<svg viewBox="0 0 100 100" fill="currentColor" aria-hidden="true">${BUILDINGS[i % BUILDINGS.length]()}</svg>`;

const CSS = () => `
@font-face{font-family:'Display';src:${font('BlackHanSans.ttf')}}
@font-face{font-family:'Body';src:${font('GothicA1-Bold.ttf')};font-weight:700}
@font-face{font-family:'Body';src:${font('GothicA1-ExtraBold.ttf')};font-weight:800}
@font-face{font-family:'Hand';src:${font('Gaegu-Bold.ttf')}}
*{margin:0;padding:0;box-sizing:border-box}
body{width:${W}px;font-family:'Body',sans-serif;font-weight:700;
  background:linear-gradient(180deg,#fdf4e2 0%,#f8ead0 55%,#f3e2c4 100%);
  -webkit-font-smoothing:antialiased}
.page{padding:44px 40px 40px}

/* ---- header ---- */
.head{position:relative;padding:34px 30px 30px}
.t1,.t2,.who .n,.res .big,.slot{line-height:1.32}
.badge{position:absolute;top:0;left:6px;transform:rotate(-7deg);
  background:#ffe27a;border-radius:10px;padding:14px 18px;text-align:center;
  font-family:'Hand';font-size:27px;line-height:1.24;color:#4a3a12;
  box-shadow:0 6px 14px rgba(150,110,30,.22)}
.title{margin-left:212px}
.t1{font-family:'Body';font-weight:800;font-size:58px;color:#2b2622;letter-spacing:-.02em}
.t2{font-family:'Display';font-size:82px;color:#e0392b;letter-spacing:-.02em;
  margin-top:2px;display:inline-block;position:relative}
.t2::after{content:'';position:absolute;left:-8px;right:-8px;bottom:18px;height:20px;
  background:#ffd84d;opacity:.55;z-index:-1;border-radius:4px}
.sub{margin:22px 0 0;display:inline-block;background:#2b2622;color:#fdf4e2;
  border-radius:999px;padding:13px 30px;font-size:29px;letter-spacing:-.01em}

/* ---- column key ---- */
.key{display:flex;gap:22px;justify-content:flex-end;padding:22px 26px 12px;font-size:22px;color:#7d7060}
.key i{display:inline-block;width:26px;height:10px;border-radius:5px;margin-right:8px;vertical-align:middle}
.key .g{background:#c9bda8}
.key .r{background:#e0392b}

/* ---- rows ---- */
.row{display:flex;align-items:center;gap:26px;background:#fff;border-radius:22px;
  padding:22px 26px;margin-bottom:14px;box-shadow:0 4px 14px rgba(120,95,50,.10)}
.slot{width:104px;height:104px;border-radius:20px;flex:none;overflow:hidden;
  background:#2b2622;color:#ffd84d;display:flex;align-items:center;justify-content:center;
  font-family:'Display';font-size:44px;position:relative}
.slot img{width:100%;height:100%;object-fit:cover}
.slot svg{width:78px;height:78px}
.rankbadge{position:absolute;left:-9px;top:-9px;width:42px;height:42px;border-radius:50%;
  background:#e0392b;color:#fff;font-family:'Display';font-size:21px;
  display:flex;align-items:center;justify-content:center;
  box-shadow:0 2px 6px rgba(0,0,0,.28)}
.who{width:196px;flex:none}
.who .n{font-family:'Display';font-size:38px;color:#2b2622;letter-spacing:-.01em}
.who .s{font-size:21px;color:#8d8172;margin-top:5px;font-weight:700}
.bars{width:360px;flex:none}
.bar{display:flex;align-items:center;gap:12px;margin:7px 0}
.track{height:16px;border-radius:8px;flex:none;min-width:14px}
.track.g{background:#c9bda8}
.track.r{background:#e0392b}
.bt{font-size:21px;color:#6f6455;white-space:nowrap}
.bt.r{color:#e0392b;font-weight:800;font-size:23px}
.res{width:210px;flex:none;text-align:right}
.res .big{font-family:'Display';font-size:33px;color:#e0392b;white-space:nowrap}
.res .cap{font-size:20px;color:#8d8172;margin-top:5px}

/* ---- rank rows ---- */
.rk .who{width:300px}
.rk .who .n{font-family:'Body';font-weight:800;font-size:35px;letter-spacing:-.03em;white-space:nowrap}
.rk .who .n.sm{font-size:30px}
.rk .who .n.xs{font-size:26px}
.rk .mid{width:150px;flex:none;font-size:23px;color:#8d8172;text-align:right}
.rk .pr{flex:1;text-align:right}
.rk .pr .big{font-family:'Display';font-size:37px;color:#e0392b;white-space:nowrap}
.rk .meter{height:9px;border-radius:5px;background:#e0392b;margin:9px 0 0 auto;opacity:.85}

/* ---- footer ---- */
.note{margin-top:26px;background:rgba(255,255,255,.72);border:2px solid #e3d4b6;
  border-radius:18px;padding:22px 26px}
.note p{font-size:21px;line-height:1.66;color:#6f6455;font-weight:700;
  padding-left:30px;text-indent:-30px}
.note p::before{content:'✓ ';color:#3f9a6a;font-weight:800}
.close{margin-top:26px;text-align:center;font-family:'Hand';font-size:40px;
  color:#a8744a;line-height:1.36}
.brand{margin-top:16px;text-align:center;font-size:21px;color:#a99b85;letter-spacing:.14em}
`;

const rowHtml = (r, i) => {
  const slot = r.image && existsSync(r.image)
    ? `<img src="${img(r.image)}">`
    : String(i + 1).padStart(2, '0');
  const bar = (cls, frac, label) =>
    `<div class="bar"><div class="track ${cls}" style="width:${Math.round(frac * 232)}px"></div>` +
    `<div class="bt ${cls === 'r' ? 'r' : ''}">${esc(label)}</div></div>`;
  return `<div class="row">
    <div class="slot">${slot}</div>
    <div class="who"><div class="n">${esc(r.label)}</div><div class="s">${esc(r.sub)}</div></div>
    <div class="bars">${bar('g', r.plainBar, r.plain)}${bar('r', r.compBar, r.compound)}</div>
    <div class="res"><div class="big">${esc(r.saved)}</div><div class="cap">빨라집니다</div></div>
  </div>`;
};

const rankRow = (r, i) => {
  const slot = r.image && existsSync(r.image) ? `<img src="${img(r.image)}">` : buildingSvg(i);
  return `<div class="row rk">
    <div class="slot">${slot}<div class="rankbadge">${r.rank}</div></div>
    <div class="who"><div class="n ${r.label.length <= 7 ? '' : r.label.length <= 9 ? 'sm' : 'xs'}">${esc(r.label)}</div>
      <div class="s">${esc(r.sub)}</div></div>
    <div class="mid">${esc(r.mid)}</div>
    <div class="pr"><div class="big">${esc(r.price)}</div>
      <div class="meter" style="width:${Math.round(r.bar * 240)}px"></div></div>
  </div>`;
};

const data = JSON.parse(readFileSync(process.argv[2] || '', 'utf8'));
const renderRow = data.rowType === 'rank' ? rankRow : rowHtml;
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${CSS()}</style></head><body>
<div class="page">
  <div class="head">
    <div class="badge">${data.badge.map(esc).join('<br>')}</div>
    <div class="title">
      <div class="t1">${esc(data.title[0])}</div>
      <div class="t2">${esc(data.title[1])}</div>
    </div>
    <div class="sub">${esc(data.subtitle)}</div>
  </div>
  ${data.rowType === 'rank'
      ? `<div class="key"><span>${esc(data.head.left)}</span><span style="width:250px;text-align:right">${esc(data.head.right)}</span></div>`
      : `<div class="key"><span><i class="g"></i>${esc(data.head.left)}</span><span><i class="r"></i>${esc(data.head.right)}</span></div>`}
  ${data.rows.map(renderRow).join('')}
  <div class="note">${data.note.map((n) => `<p>${esc(n)}</p>`).join('')}</div>
  <div class="close">${data.closing.map(esc).join('<br>')}</div>
  <div class="brand">${esc(data.brand)}</div>
</div></body></html>`;

const outDir = resolve(HERE, '..', data.slug);
mkdirSync(outDir, { recursive: true });
const out = resolve(outDir, 'poster.png');

const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: W, height: 1400 }, deviceScaleFactor: 1 });
await p.setContent(html, { waitUntil: 'load' });
await p.evaluate(() => document.fonts.ready);
await p.screenshot({ path: out, fullPage: true });
const h = await p.evaluate(() => document.body.scrollHeight);
await browser.close();

try {
  execSync(`pngquant --quality=70-95 --speed 1 --force --output ${JSON.stringify(out)} ${JSON.stringify(out)}`, { stdio: 'pipe' });
} catch { /* optional */ }
console.log(`${W}x${h} -> ${out}`);
