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
const themeArg = (process.argv.find((a) => a.startsWith('--theme=')) || '').split('=')[1];
const TALL = process.argv.includes('--tall');
// --fit packs the whole thing into one 1080x1920 frame, for a shorts card that
// is read at a glance rather than scrolled.
const FIT = process.argv.includes('--fit');
// --quiet drops the decoration and lets the figures carry the card: no row
// cards, no gradient, no display face on the numbers. The value wears text
// ink and a thin bar beside it carries the comparison.
const QUIET = process.argv.includes('--quiet');
const FIT_H = 1920;

const font = (f) => `url(data:font/ttf;base64,${readFileSync(resolve(FONT_DIR, f)).toString('base64')})`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---- themes -------------------------------------------------------------
// Every colour and face the layout uses, so a topic can pick a look without
// the layout knowing anything about it.
const THEMES = {
  // warm, printed, a little playful
  paper: {
    bg: 'linear-gradient(180deg,#fdf4e2 0%,#f8ead0 55%,#f3e2c4 100%)',
    card: '#fff', cardEdge: 'none', cardShadow: '0 4px 14px rgba(120,95,50,.10)',
    ink: '#2b2622', muted: '#756b5f', faint: '#7f745c',
    accent: '#e0392b', accentSoft: 'rgba(224,57,43,.85)',
    slotBg: '#2b2622', slotInk: '#ffd84d',
    badgeBg: '#ffe27a', badgeInk: '#4a3a12', badgeShadow: '0 6px 14px rgba(150,110,30,.22)',
    rankBg: '#e0392b', rankInk: '#fff',
    pillBg: '#2b2622', pillInk: '#fdf4e2',
    mark: '#ffd84d', markOpacity: '.55',
    noteBg: 'rgba(255,255,255,.72)', noteEdge: '2px solid #e3d4b6', rule: '#d9d3c7',
    check: '#3f9a6a', closing: '#a8744a', brand: '#a99b85',
    display: 'Display', displayCase: 'none', h1: 'Body', h1Weight: '800',
    closingFont: 'Hand', badgeFont: 'Hand',
    glow: 'none', slotGlow: 'none',
  },
  // dark, editorial, gold - for money and property
  noir: {
    bg: 'linear-gradient(180deg,#16181d 0%,#101216 55%,#0b0d10 100%)',
    card: 'rgba(255,255,255,.055)', cardEdge: '1px solid rgba(212,175,95,.16)',
    cardShadow: '0 4px 18px rgba(0,0,0,.30)',
    ink: '#f3efe6', muted: '#8f8b82', faint: '#807b72',
    accent: '#d9b46a', accentSoft: 'rgba(217,180,106,.85)',
    slotBg: '#d9b46a', slotInk: '#14161a',
    badgeBg: 'transparent', badgeInk: '#d9b46a', badgeShadow: 'inset 0 0 0 2px rgba(217,180,106,.5)',
    rankBg: '#14161a', rankInk: '#d9b46a',
    pillBg: 'rgba(217,180,106,.14)', pillInk: '#e6d2a8',
    mark: 'transparent', markOpacity: '0',
    noteBg: 'rgba(255,255,255,.04)', noteEdge: '1px solid rgba(255,255,255,.10)',
    rule: 'rgba(255,255,255,.14)',
    check: '#d9b46a', closing: '#c9a45f', brand: '#6e6a62',
    display: 'Display', displayCase: 'none', h1: 'Body', h1Weight: '800',
    closingFont: 'Serif', badgeFont: 'Body',
    glow: 'none', slotGlow: 'none',
  },
  // light, airy, clean - for rates and calculations
  mint: {
    bg: 'linear-gradient(180deg,#fbfdfc 0%,#f1f7f4 55%,#e8f1ed 100%)',
    card: '#fff', cardEdge: '1px solid #e2ece7', cardShadow: '0 3px 12px rgba(20,80,60,.07)',
    ink: '#15211d', muted: '#61706b', faint: '#6a7974',
    accent: '#0b8161', accentSoft: 'rgba(11,129,97,.85)',
    slotBg: '#0b8161', slotInk: '#eafaf4',
    badgeBg: '#d4f2e6', badgeInk: '#0a6b50', badgeShadow: 'none',
    rankBg: '#0b8161', rankInk: '#fff',
    pillBg: '#15211d', pillInk: '#f1f7f4',
    mark: '#9fe8cd', markOpacity: '.5',
    noteBg: 'rgba(255,255,255,.8)', noteEdge: '1px solid #dcebe5', rule: '#dcebe5',
    check: '#0b8161', closing: '#3f7f6c', brand: '#8f9d98',
    display: 'Body', displayCase: 'none', h1: 'Body', h1Weight: '800',
    closingFont: 'Body', badgeFont: 'Body',
    glow: 'none', slotGlow: 'none',
  },
  // newsprint, serif, restrained - for statistics
  press: {
    bg: 'linear-gradient(180deg,#f7f5f0 0%,#f2efe8 100%)',
    card: '#fff', cardEdge: '1px solid #e4e0d6', cardShadow: 'none',
    ink: '#1b1a17', muted: '#6d6a62', faint: '#79756a',
    accent: '#a82a24', accentSoft: 'rgba(168,42,36,.85)',
    slotBg: '#1b1a17', slotInk: '#f7f5f0',
    badgeBg: '#1b1a17', badgeInk: '#f7f5f0', badgeShadow: 'none',
    rankBg: '#a82a24', rankInk: '#fff',
    pillBg: 'transparent', pillInk: '#1b1a17',
    mark: 'transparent', markOpacity: '0',
    noteBg: 'transparent', noteEdge: '1px solid #ddd8cc', rule: '#ddd8cc',
    check: '#7d7a70', closing: '#4a4740', brand: '#959186',
    display: 'Serif', displayCase: 'none', h1: 'Serif', h1Weight: '800',
    closingFont: 'Serif', badgeFont: 'Serif',
    glow: 'none', slotGlow: 'none',
  },
  // electric, dark, glowing - for tech, crypto, anything loud
  neon: {
    bg: 'linear-gradient(180deg,#0b0620 0%,#0e0a26 52%,#07050f 100%)',
    card: 'rgba(125,105,255,.07)', cardEdge: '1px solid rgba(0,179,199,.22)',
    cardShadow: 'none',
    ink: '#eef2ff', muted: '#989cbd', faint: '#71759d',
    accent: '#00b3c7', accentSoft: 'rgba(0,179,199,.8)',
    slotBg: '#161334', slotInk: '#e8579f',
    badgeBg: 'transparent', badgeInk: '#4fd3e4',
    badgeShadow: 'inset 0 0 0 2px rgba(0,179,199,.5)',
    rankBg: '#e8579f', rankInk: '#0b0620',
    pillBg: 'rgba(0,179,199,.16)', pillInk: '#a7e6ef',
    mark: 'transparent', markOpacity: '0',
    noteBg: 'rgba(255,255,255,.035)', noteEdge: '1px solid rgba(0,179,199,.18)',
    rule: 'rgba(0,179,199,.22)',
    check: '#4fd3e4', closing: '#e878b4', brand: '#71759d',
    display: 'Display', displayCase: 'none', h1: 'Body', h1Weight: '800',
    closingFont: 'Body', badgeFont: 'Body',
    glow: 'none',
    slotGlow: 'none',
  },
};

const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
const img = (p) => {
  const ext = p.split('.').pop().toLowerCase();
  const type = MIME[ext];
  if (!type) throw new Error(`unsupported image type: ${p}`);
  return `data:${type};base64,${readFileSync(p).toString('base64')}`;
};

// Decorative building silhouettes. These stand in for photography we have no
// licence to use; they are not drawings of the actual buildings, which the
// footer says outright. Varying the shape keeps a long list from flattening.


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

const MEDALS = [
  // trophy
  () => `<path d="M30 18h40v22a20 20 0 0 1-40 0V18z"/><rect x="44" y="60" width="12" height="14"/>` +
        `<rect x="32" y="74" width="36" height="9" rx="3"/><path d="M30 24h-10v8a14 14 0 0 0 10 12V24z"/>` +
        `<path d="M70 24h10v8a14 14 0 0 1-10 12V24z"/>`,
  // medal on a ribbon
  () => `<path d="M32 10h12l10 24H38z"/><path d="M68 10H56l-10 24h16z"/><circle cx="50" cy="62" r="26"/>` +
        `<circle cx="50" cy="62" r="15" fill="${SLOT_BG}"/>`,
  // rosette
  () => `<circle cx="50" cy="42" r="26"/><circle cx="50" cy="42" r="14" fill="${SLOT_BG}"/>` +
        `<path d="M36 64l-8 26 22-11 22 11-8-26z"/>`,
];

const COINS = [
  // coin stack
  () => `<ellipse cx="50" cy="26" rx="30" ry="11"/><rect x="20" y="26" width="60" height="16"/>` +
        `<ellipse cx="50" cy="42" rx="30" ry="11"/><rect x="20" y="42" width="60" height="16"/>` +
        `<ellipse cx="50" cy="58" rx="30" ry="11"/><rect x="20" y="58" width="60" height="16"/>` +
        `<ellipse cx="50" cy="74" rx="30" ry="11"/>`,
  // banknote
  () => `<rect x="12" y="28" width="76" height="44" rx="5"/><circle cx="50" cy="50" r="13" fill="${SLOT_BG}"/>` +
        `<circle cx="24" cy="38" r="4" fill="${SLOT_BG}"/><circle cx="76" cy="62" r="4" fill="${SLOT_BG}"/>`,
  // coin with a rising arrow
  () => `<circle cx="38" cy="58" r="28"/><circle cx="38" cy="58" r="15" fill="${SLOT_BG}"/>` +
        `<path d="M58 40l26-14-6 22-7-7-13 13-6-6 13-13z"/>`,
];

const CARS = [
  // car, three-quarter block
  () => `<path d="M14 62c0-4 3-7 7-7h58c4 0 7 3 7 7v12H14V62z"/>` +
        `<path d="M26 34h48l10 21H16z"/><rect x="30" y="38" width="17" height="13" rx="2" fill="${SLOT_BG}"/>` +
        `<rect x="53" y="38" width="17" height="13" rx="2" fill="${SLOT_BG}"/>` +
        `<circle cx="30" cy="76" r="8"/><circle cx="70" cy="76" r="8"/>`,
  // charging plug
  () => `<rect x="34" y="14" width="32" height="40" rx="8"/><rect x="40" y="6" width="6" height="12" rx="3"/>` +
        `<rect x="54" y="6" width="6" height="12" rx="3"/><rect x="45" y="54" width="10" height="14"/>` +
        `<path d="M50 66c-14 0-22 8-22 18h44c0-10-8-18-22-18z"/>`,
  // battery with a bolt
  () => `<rect x="14" y="30" width="66" height="40" rx="7"/><rect x="80" y="42" width="8" height="16" rx="3"/>` +
        `<path d="M50 34l-14 20h11l-4 14 16-21H48z" fill="${SLOT_BG}"/>`,
];

const ICONS = { building: BUILDINGS, medal: MEDALS, coin: COINS, car: CARS };

const buildingSvg = (i, set = 'building') => {
  const family = ICONS[set] || BUILDINGS;
  return `<svg viewBox="0 0 100 100" fill="currentColor" aria-hidden="true">${family[i % family.length]()}</svg>`;
};

const CSS = () => `
@font-face{font-family:'Display';src:${font('BlackHanSans.ttf')}}
@font-face{font-family:'Body';src:${font('GothicA1-Bold.ttf')};font-weight:700}
@font-face{font-family:'Body';src:${font('GothicA1-ExtraBold.ttf')};font-weight:800}
@font-face{font-family:'Body';src:${font('GothicA1-Medium.ttf')};font-weight:500}
@font-face{font-family:'Serif';src:${font('NanumMyeongjo-ExtraBold.ttf')};font-weight:800}
@font-face{font-family:'Serif';src:${font('NanumMyeongjo-Bold.ttf')};font-weight:700}
@font-face{font-family:'Hand';src:${font('Gaegu-Bold.ttf')}}
*{margin:0;padding:0;box-sizing:border-box}
body{width:${W}px;font-family:'Body',sans-serif;font-weight:700;
  background:${T.bg};
  -webkit-font-smoothing:antialiased}
.page{padding:44px 40px 40px}

/* ---- header ---- */
.head{position:relative;padding:34px 30px 30px}
.t1,.t2,.who .n,.res .big,.slot{line-height:1.32}
.badge{position:absolute;top:0;left:6px;transform:rotate(-7deg);
  background:${T.badgeBg};border-radius:10px;padding:14px 18px;text-align:center;
  font-family:'${T.badgeFont}';font-weight:800;font-size:27px;line-height:1.24;color:${T.badgeInk};
  box-shadow:${T.badgeShadow}}
.title{margin-left:212px}
.t1{font-family:'${T.h1}';font-weight:${T.h1Weight};font-size:58px;color:${T.ink};letter-spacing:-.02em}
.t2{font-family:'${T.display}';font-weight:800;font-size:82px;color:${T.accent};letter-spacing:-.02em;text-shadow:${T.glow};
  margin-top:2px;display:inline-block;position:relative}
.t2::after{content:'';position:absolute;left:-8px;right:-8px;bottom:18px;height:20px;
  background:${T.mark};opacity:${T.markOpacity};z-index:-1;border-radius:4px}
.sub{margin:22px 0 0;display:inline-block;background:${T.pillBg};color:${T.pillInk};
  border-radius:999px;padding:13px 30px;font-size:29px;letter-spacing:-.01em}

/* ---- column key ---- */
.key{display:flex;gap:22px;justify-content:flex-end;padding:22px 26px 12px;font-size:22px;color:${T.muted}}
.key i{display:inline-block;width:26px;height:10px;border-radius:5px;margin-right:8px;vertical-align:middle}
.key .g{background:${T.faint}}
.key .r{background:${T.accent}}

/* ---- rows ---- */
.row{display:flex;align-items:center;gap:26px;background:${T.card};border:${T.cardEdge};border-radius:22px;
  padding:22px 26px;margin-bottom:14px;box-shadow:${T.cardShadow}}
.slot{width:104px;height:104px;border-radius:20px;flex:none;overflow:hidden;
  background:${T.slotBg};color:${T.slotInk};display:flex;align-items:center;justify-content:center;
  font-family:'${T.display}';font-size:44px;position:relative;box-shadow:${T.slotGlow}}
.slot img{width:100%;height:100%;object-fit:cover}
/* fit:"contain" shows the photo whole. Cropping counts as an adaptation under
   CC, which drags ShareAlike onto the finished poster; left uncropped the
   poster stays a collection. */
.slot img.contain{object-fit:contain;background:${T.slotBg}}
.slot svg{width:78px;height:78px}
.rankbadge{position:absolute;left:-9px;top:-9px;width:42px;height:42px;border-radius:50%;
  background:${T.rankBg};color:${T.rankInk};font-family:'${T.display}';font-weight:800;font-size:21px;
  display:flex;align-items:center;justify-content:center;
  box-shadow:${T.badgeShadow === 'none' ? '0 2px 6px rgba(0,0,0,.28)' : T.badgeShadow}}
.who{width:196px;flex:none}
.who .n{font-family:'${T.display}';font-weight:800;font-size:38px;color:${T.ink};letter-spacing:-.01em}
.who .s{font-size:21px;color:${T.muted};margin-top:5px;font-weight:700}
.bars{width:360px;flex:none}
.bar{display:flex;align-items:center;gap:12px;margin:7px 0}
.track{height:16px;border-radius:8px;flex:none;min-width:14px}
.track.g{background:${T.faint}}
.track.r{background:${T.accent}}
.bt{font-size:21px;color:${T.muted};white-space:nowrap}
.bt.r{color:${T.accent};font-weight:800;font-size:23px}
.res{width:210px;flex:none;text-align:right}
.res .big{font-family:'${T.display}';font-weight:800;font-size:33px;color:${T.accent};white-space:nowrap}
.res .cap{font-size:20px;color:${T.muted};margin-top:5px}

/* ---- rank rows ---- */
.rk .who{width:300px}
.rk .who .n{font-family:'${T.h1}';font-weight:800;font-size:35px;letter-spacing:-.03em;white-space:nowrap}

/* ---- stacked rows, for the scrolling shorts cut ---- */
.tall .head{padding:60px 30px 44px}
.tall .t1{font-size:76px}
.tall .t2{font-size:104px}
.tall .t2::after{bottom:24px;height:26px}
.tall .sub{font-size:38px;padding:17px 38px}
.tall .key{font-size:28px;padding:30px 26px 16px}
.tall .row{padding:34px 36px;gap:34px;border-radius:28px;margin-bottom:22px}
.tall .slot{width:168px;height:168px;border-radius:30px}
.tall .slot svg{width:124px;height:124px}
.tall .rankbadge{width:62px;height:62px;font-size:31px;left:-13px;top:-13px}
.tall .st{flex:1;min-width:0}
.tall .st .n{font-family:'${T.h1}';font-weight:800;font-size:60px;color:${T.ink};
  letter-spacing:-.035em;white-space:nowrap;line-height:1.3}
.tall .st .n.sm{font-size:52px}
.tall .st .n.xs{font-size:45px}
.tall .st .s{font-size:31px;color:${T.muted};margin-top:6px}
.tall .st .a{font-size:29px;color:${T.faint};margin-top:4px}
.tall .st .p{font-family:'${T.display}';font-weight:800;font-size:62px;color:${T.accent};margin-top:12px;line-height:1.24;text-shadow:${T.glow}}
.tall .note{padding:32px 36px;border-radius:24px;margin-top:36px}
.tall .note p{font-size:29px;line-height:1.7;padding-left:40px;text-indent:-40px}
.tall .close{font-size:56px;margin-top:40px}
.tall .brand{font-size:29px;margin-top:22px}

/* ---- one-frame layout ---- */
.fit{height:${FIT_H}px;padding:52px 40px 44px;display:flex;flex-direction:column}
.fit .head{padding:0 26px 22px}
.fit .badge{top:-6px;left:2px;font-size:23px;padding:11px 14px}
.fit .title{margin-left:196px}
.fit .t1{font-size:50px}
.fit .t2{font-size:68px}
.fit .t2::after{bottom:14px;height:18px}
.fit .sub{margin-top:16px;font-size:26px;padding:11px 26px}
.fit .key{padding:0 30px 10px;font-size:22px}
.fit .rows{flex:1;display:flex;flex-direction:column;justify-content:space-between}
.fit .row{padding:0 26px;margin:0;border-radius:18px;gap:20px;min-height:0;flex:1;
  margin-bottom:9px;align-items:center}
.fit .slot{width:74px;height:74px;border-radius:16px}
.fit .slot svg{width:54px;height:54px}
.fit .rankbadge{width:34px;height:34px;font-size:18px;left:-7px;top:-7px}
.fit .st{flex:1;min-width:0}
.fit .st .n{font-family:'${T.h1}';font-weight:800;font-size:40px;color:${T.ink};
  letter-spacing:-.035em;white-space:nowrap;line-height:1.24}
.fit .st .n.sm{font-size:35px}
.fit .st .n.xs{font-size:30px}
.fit .st .s{font-size:22px;color:${T.muted};margin-top:2px;white-space:nowrap;overflow:hidden}
.fit .st .a{display:none}
.fit .st .p{display:none}
.fit .val{flex:none;text-align:right}
.fit .val .p{display:block;font-family:'${T.display}';font-weight:800;font-size:42px;color:${T.accent};line-height:1.2;text-shadow:${T.glow}}
.fit .val .a{display:block;font-size:21px;color:${T.faint};margin-top:1px}
.fit .note{margin-top:14px;padding:16px 22px;border-radius:16px}
.fit .note p{font-size:20px;line-height:1.5;padding-left:26px;text-indent:-26px}
.fit .credit{font-size:18px;margin-top:10px;padding-top:10px}
.fit .close{font-size:38px;margin-top:16px}
.fit .brand{font-size:22px;margin-top:10px}

/* ---- quiet: information, no ornament ---- */
.quiet{height:${FIT_H}px;padding:52px 56px 44px;display:flex;flex-direction:column;
  background:${T.card === '#fff' ? '#faf9f6' : T.bg}}
.quiet .head{padding:0 0 18px}
.quiet .badge{position:static;transform:none;display:block;background:none;
  box-shadow:none;padding:0;text-align:left;font-family:'Body';font-weight:700;
  font-size:24px;letter-spacing:.14em;color:${T.accent}}
.quiet .badge br{display:none}
.quiet .badge span+span::before{content:' '}
.quiet .title{margin:14px 0 0}
.quiet .t1{font-family:'Body';font-weight:500;font-size:43px;color:${T.muted};letter-spacing:-.02em;line-height:1.2}
.quiet .t2{font-family:'Body';font-weight:800;font-size:60px;color:${T.ink};
  letter-spacing:-.03em;text-shadow:none;display:block;line-height:1.22}
.quiet .t2::after{display:none}
.quiet .sub{margin-top:13px;background:none;padding:0;color:${T.muted};
  font-family:'Body';font-weight:500;font-size:25px;letter-spacing:0}
.quiet .rows{flex:1;display:flex;flex-direction:column;justify-content:space-between;
  border-top:1px solid ${T.rule};padding-top:6px}
.quiet .row{display:block;background:none;border:0;box-shadow:none;border-radius:0;
  padding:0 0 9px;margin:0;border-bottom:1px solid ${T.rule};flex:0 0 auto}
.quiet .row:last-child{border-bottom:0}
.quiet .slot{display:none}
.quiet .line{display:flex;align-items:baseline;gap:20px;line-height:1.14}
.quiet .rk{font-family:'Body';font-weight:700;font-size:26px;color:${T.faint};
  width:42px;flex:none;font-variant-numeric:tabular-nums}
.quiet .nm{font-family:'Body';font-weight:800;font-size:40px;color:${T.ink};line-height:1.14;
  letter-spacing:-.03em;white-space:nowrap;flex:1;min-width:0}
.quiet .nm.sm{font-size:35px}
.quiet .nm.xs{font-size:30px}
.quiet .vl{font-family:'Body';font-weight:800;font-size:39px;color:${T.ink};line-height:1.14;
  letter-spacing:-.02em;white-space:nowrap;font-variant-numeric:tabular-nums}
.quiet .meta{margin:5px 0 0 62px;font-size:22px;color:${T.muted};font-weight:500;line-height:1.3}
/* one series, one colour; thin, rounded end, anchored left */
.quiet .barwrap{margin:8px 0 0 62px;height:7px;border-radius:4px;background:${T.rule}}
.quiet .bar{height:7px;border-radius:4px;background:${T.accent};min-width:9px}
.quiet .note{margin-top:16px;background:none;border:0;border-top:1px solid ${T.rule};
  border-radius:0;padding:18px 0 0}
.quiet .note p{font-size:19px;line-height:1.45;color:${T.muted};font-weight:500;
  padding-left:0;text-indent:0;margin-bottom:3px}
.quiet .note p::before{content:'';margin:0}
.quiet .close{margin-top:16px;text-align:left;font-family:'Body';font-weight:800;
  font-size:30px;color:${T.ink};line-height:1.42;letter-spacing:-.02em}
.quiet .brand{margin-top:10px;text-align:left;font-size:20px;color:${T.faint};letter-spacing:.14em}
.rk .who .n.sm{font-size:30px}
.rk .who .n.xs{font-size:26px}
.rk .mid{width:150px;flex:none;font-size:23px;color:${T.muted};text-align:right}
.rk .pr{flex:1;text-align:right}
.rk .pr .big{font-family:'${T.display}';font-weight:800;font-size:37px;color:${T.accent};white-space:nowrap;text-shadow:${T.glow}}
.rk .meter{height:9px;border-radius:5px;background:${T.accentSoft};margin:9px 0 0 auto}

/* ---- footer ---- */
.note{margin-top:26px;background:${T.noteBg};border:${T.noteEdge};
  border-radius:18px;padding:22px 26px}
.note p{font-size:21px;line-height:1.66;color:${T.muted};font-weight:500;
  padding-left:30px;text-indent:-30px}
.note p::before{content:'✓ ';color:${T.check};font-weight:800}
.credit{margin-top:18px;padding-top:16px;border-top:1px dashed ${T.rule};
  font-size:19px;line-height:1.62;color:${T.muted};font-weight:500}
.credit b{display:block;color:${T.ink};margin-bottom:4px}
.credit span{display:block}
.tall .credit{font-size:26px;margin-top:24px;padding-top:22px}
.close{margin-top:26px;text-align:center;font-family:'${T.closingFont}';font-weight:800;font-size:40px;
  color:${T.closing};line-height:1.36}
.brand{margin-top:16px;text-align:center;font-size:21px;color:${T.brand};letter-spacing:.14em}
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

const nameClass = (t) => (t.length <= 7 ? '' : t.length <= 9 ? 'sm' : 'xs');

const slotFor = (r, i) => (r.image && existsSync(r.image)
  ? `<img class="${r.fit === 'contain' ? 'contain' : ''}" src="${img(r.image)}">`
  : buildingSvg(i, data.icons));

const fitRow = (r, i) => {
  const slot = slotFor(r, i);
  return `<div class="row">
    <div class="slot">${slot}${data.showRank === false ? '' : `<div class="rankbadge">${r.rank}</div>`}</div>
    <div class="st">
      <div class="n ${nameClass(r.label)}">${esc(r.label)}</div>
      ${r.sub ? `<div class="s">${esc(r.sub)}</div>` : ''}
    </div>
    <div class="val"><div class="p">${esc(r.price)}</div>
      ${r.mid ? `<div class="a">${esc(r.mid)}</div>` : ''}</div>
  </div>`;
};

const quietRow = (r, i) => `<div class="row">
  <div class="line">
    ${data.showRank === false ? '' : `<span class="rk">${r.rank}</span>`}
    <span class="nm ${nameClass(r.label)}">${esc(r.label)}</span>
    <span class="vl">${esc(r.price)}</span>
  </div>
  ${r.sub || r.mid ? `<div class="meta">${[r.sub, r.mid].filter(Boolean).map(esc).join(' · ')}</div>` : ''}
  ${data.showBar === false ? ''
    : `<div class="barwrap"><div class="bar" style="width:${(r.bar * 100).toFixed(1)}%"></div></div>`}
</div>`;

const tallRow = (r, i) => {
  const slot = slotFor(r, i);
  return `<div class="row">
    <div class="slot">${slot}${data.showRank === false ? '' : `<div class="rankbadge">${r.rank}</div>`}</div>
    <div class="st">
      <div class="n ${nameClass(r.label)}">${esc(r.label)}</div>
      <div class="s">${esc(r.sub)}</div>
      ${r.mid ? `<div class="a">${esc(data.midLabel || '')}${data.midLabel ? ' ' : ''}${esc(r.mid)}</div>` : ''}
      <div class="p">${esc(r.price)}</div>
    </div>
  </div>`;
};

const rankRow = (r, i) => {
  const slot = slotFor(r, i);
  return `<div class="row rk">
    <div class="slot">${slot}${data.showRank === false ? '' : `<div class="rankbadge">${r.rank}</div>`}</div>
    <div class="who"><div class="n ${r.label.length <= 7 ? '' : r.label.length <= 9 ? 'sm' : 'xs'}">${esc(r.label)}</div>
      <div class="s">${esc(r.sub)}</div></div>
    <div class="mid">${esc(r.mid || '')}</div>
    <div class="pr"><div class="big">${esc(r.price)}</div>
      <div class="meter" style="width:${Math.round(r.bar * 240)}px"></div></div>
  </div>`;
};

const data = JSON.parse(readFileSync(process.argv[2] || '', 'utf8'));
const T = THEMES[themeArg || data.theme] || THEMES.paper;
const SLOT_BG = T.slotBg;

// Most open licences (CC BY, CC BY-SA) require the credit to travel with the
// image, so it is rendered from the data rather than left to whoever posts it.
const credits = () => {
  const lines = data.rows.filter((r) => r.image && r.credit)
    .map((r) => `${r.label} — ${r.credit}`);
  if (!lines.length) return '';
  return `<div class="credit"><b>사진 출처</b>${lines.map((l) => `<span>${esc(l)}</span>`).join('')}</div>`;
};
const renderRow = data.rowType !== 'rank' ? rowHtml
  : QUIET ? quietRow : FIT ? fitRow : TALL ? tallRow : rankRow;
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${CSS()}</style></head><body>
<div class="page${TALL ? ' tall' : ''}${FIT ? ' fit' : ''}${QUIET ? ' quiet' : ''}">
  <div class="head">
    <div class="badge">${QUIET ? `<span>${data.badge.map(esc).join('</span><span>')}</span>`
      : data.badge.map(esc).join('<br>')}</div>
    <div class="title">
      <div class="t1">${esc(data.title[0])}</div>
      <div class="t2">${esc(data.title[1])}</div>
    </div>
    <div class="sub">${esc(data.subtitle)}</div>
  </div>
  ${TALL || FIT || QUIET ? ''
      : data.rowType === 'rank'
      ? `<div class="key"><span>${esc(data.head.left)}</span><span style="width:250px;text-align:right">${esc(data.head.right)}</span></div>`
      : `<div class="key"><span><i class="g"></i>${esc(data.head.left)}</span><span><i class="r"></i>${esc(data.head.right)}</span></div>`}
  ${FIT || QUIET ? `<div class="rows">${data.rows.map(renderRow).join('')}</div>` : data.rows.map(renderRow).join('')}
  <div class="note">${(QUIET ? data.note.slice(0, 3) : data.note).map((n) => `<p>${esc(n)}</p>`).join('')}${credits()}</div>
  <div class="close">${data.closing.map(esc).join('<br>')}</div>
  <div class="brand">${esc(data.brand)}</div>
</div></body></html>`;

const outDir = resolve(HERE, '..', data.slug);
mkdirSync(outDir, { recursive: true });
const out = resolve(outDir, QUIET ? 'poster-quiet.png' : FIT ? 'poster-fit.png' : TALL ? 'poster-tall.png' : 'poster.png');

const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: W, height: FIT || QUIET ? FIT_H : 1400 }, deviceScaleFactor: 1 });
await p.setContent(html, { waitUntil: 'load' });
await p.evaluate(() => document.fonts.ready);
await p.screenshot({ path: out, fullPage: !(FIT || QUIET) });
if (process.env.MEASURE) {
  console.error(await p.evaluate(() => {
    const h = (sel) => { const e = document.querySelector(sel); return e ? Math.round(e.getBoundingClientRect().height) : 0; };
    const rows = [...document.querySelectorAll('.rows .row')].map(e => Math.round(e.getBoundingClientRect().height));
    const avg = rows.length ? Math.round(rows.reduce((a, b) => a + b, 0) / rows.length) : 0;
    let detail = '';
    const r0 = document.querySelector('.rows .row');
    if (r0) {
      const part = (sel) => { const e = r0.querySelector(sel); return e ? Math.round(e.getBoundingClientRect().height) : 0; };
      const cs = getComputedStyle(r0);
      detail = `\n    row1 = line ${part('.line')} + meta ${part('.meta')} + bar ${part('.barwrap')}` +
               ` | pad ${cs.paddingTop}/${cs.paddingBottom} | nm ${part('.nm')} vl ${part('.vl')}`;
    }
    const page = document.querySelector('.page');
    const pcs = getComputedStyle(page);
    const kids = [...page.children].map(e => `${e.className.split(' ')[0]}:${Math.round(e.getBoundingClientRect().height)}`).join(' ');
    detail += `\n    page h=${Math.round(page.getBoundingClientRect().height)} display=${pcs.display} dir=${pcs.flexDirection} pad=${pcs.paddingTop}/${pcs.paddingBottom}` +
              `\n    children: ${kids}`;
    return `  head ${h('.head')}  rows ${h('.rows')} (${rows.length} x ~${avg})  note ${h('.note')}` +
           `  close ${h('.close')}  brand ${h('.brand')}  body ${document.body.scrollHeight}` + detail;
  }));
}
const docH = await p.evaluate(() => document.body.scrollHeight);
const h = FIT || QUIET ? FIT_H : docH;
if ((FIT || QUIET) && docH > FIT_H + 2) {
  console.error(`  ! content is ${docH - FIT_H}px taller than the frame and will be cut`);
}
await browser.close();

try {
  execSync(`pngquant --quality=70-95 --speed 1 --force --output ${JSON.stringify(out)} ${JSON.stringify(out)}`, { stdio: 'pipe' });
} catch { /* optional */ }
console.log(`${W}x${h} -> ${out}`);
