/* ============================================================================
   공유 카드(og.png)와 앱 아이콘(icons/*.png)을 그린다.

     npm install --no-save playwright @fontsource/ibm-plex-sans-kr@5     (저장소 뿌리에서)
     node correspondent/tools/make-assets.mjs

   카톡에 링크를 붙이면 뜨는 카드가 og.png 다. 이 앱은 링크 붙여넣기가 유통 경로의 전부라서
   이 한 장이 첫인상이다. 공유 링크의 #r=… 은 서버로 가지 않으므로 카톡은 리포트 내용을 볼 수
   없다 — 카드는 리포트마다가 아니라 앱 하나에 한 장이다.

   카드에는 이 앱의 생각 하나만 그린다: 같은 장소의 소식이 시간이 지나면 흐려진다.
   ========================================================================== */
import { chromium } from 'playwright';
import { mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '..');
function fontDir() {
  if (process.env.FONT_DIR) return resolve(process.env.FONT_DIR);
  try { return resolve(dirname(createRequire(import.meta.url).resolve('@fontsource/ibm-plex-sans-kr/package.json')), 'files'); }
  catch (e) { return ''; }
}
const FONTS = fontDir();
if (!FONTS || !existsSync(FONTS)) {
  console.error('글꼴이 없습니다: ' + FONTS + '\n  npm install --no-save @fontsource/ibm-plex-sans-kr@5');
  process.exit(1);
}
const face = (w) => ['korean', 'latin'].map((sub) =>
  `@font-face{font-family:"Plex";font-weight:${w};src:url("${pathToFileURL(resolve(FONTS, `ibm-plex-sans-kr-${sub}-${w}-normal.woff2`))}") format("woff2")}`
).join('\n');

/* 앱과 같은 값 (index.html 의 :root 밝은 쪽) */
const T = {
  paper: '#F5F3EE', surface: '#FFFFFF', surface2: '#F1EEE8', surface3: '#E4E0D8',
  ink: '#15171A', ink2: '#474B50', ink3: '#676C73', line: '#DFDAD1',
  accent: '#0F6E63', live: '#B8430C', liveDot: '#E2600F', liveWash: '#FCEADD',
  s0bg: '#DCEFE4', s0: '#185F3E', s1bg: '#FBEAD1', s1: '#7A4600',
  s2bg: '#F3BE8A', s2: '#6B3300', s3bg: '#A83812', s3: '#FFFFFF'
};

const GLYPH = `<circle cx="50" cy="62" r="9" fill="#fff"/>
  <path d="M34 47 A22 22 0 0 1 66 47" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/>
  <path d="M23 34 A38 38 0 0 1 77 34" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/>`;

const markSvg = (size) => `<svg width="${size}" height="${size}" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="${T.accent}"/>${GLYPH}</svg>`;

/* ─────────────────────────── 공유 카드 1200×630 ─────────────────────────── */
const card = (o) => `
  <div class="card ${o.cls}">
    <i class="rail"></i>
    <div class="top"><span class="cat">${o.cat}</span><span class="age">${o.age}</span></div>
    <div class="place">${o.place}<span class="area">${o.area}</span></div>
    <div class="row">${o.label ? `<span class="lbl">${o.label}</span>` : ''}${o.chips}
      <span class="meter"><i style="width:${o.meter}%"></i></span></div>
    <div class="note">${o.note}</div>
  </div>`;

const OG = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
${face(400)}${face(600)}${face(700)}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;background:${T.paper};font-family:"Plex",sans-serif;color:${T.ink};
  letter-spacing:-.02em;display:grid;grid-template-columns:540px 1fr;gap:36px;padding:64px 64px 56px 72px;overflow:hidden}
.left{display:flex;flex-direction:column}
.brand{display:flex;align-items:center;gap:16px}
.brand b{font-size:22px;font-weight:600;color:${T.accent};letter-spacing:.02em}
h1{font-size:84px;font-weight:700;line-height:1.08;letter-spacing:-.045em;margin-top:34px}
h1 span{color:${T.accent}}
.tag{font-size:31px;font-weight:600;line-height:1.4;color:${T.ink2};margin-top:22px;letter-spacing:-.03em}
.sub{font-size:22px;line-height:1.6;color:${T.ink3};margin-top:16px}
.url{margin-top:auto;font-size:20px;color:${T.ink3};font-weight:600;letter-spacing:0}
.right{position:relative;padding-top:18px;padding-left:34px}
.right::before{content:"";position:absolute;left:9px;top:40px;bottom:30px;width:2px;background:${T.line}}
.card{position:relative;background:${T.surface};border:1.5px solid ${T.line};border-radius:18px;padding:20px 24px;margin-bottom:22px}
.card .rail{position:absolute;left:-33px;top:28px;width:18px;height:18px;border-radius:50%;
  background:${T.liveDot};box-shadow:0 0 0 5px ${T.paper}}
.card.old{background:${T.surface2}}
.card.old .rail{background:${T.paper};border:3px solid ${T.ink3}}
.top{display:flex;gap:12px;align-items:center;font-size:17px;color:${T.ink3};font-weight:600}
.age{color:${T.live}}
.old .age{color:${T.ink3};font-weight:400}
.place{font-size:31px;font-weight:700;letter-spacing:-.04em;margin-top:6px}
.area{font-size:18px;font-weight:400;color:${T.ink3};margin-left:10px;letter-spacing:-.01em}
.row{display:flex;gap:8px;align-items:center;margin-top:14px}
.old .stat{background:${T.surface2};color:${T.ink3};font-weight:500;box-shadow:inset 0 0 0 1.5px ${T.line}}
.lbl{font-size:15px;color:${T.ink3};margin-right:2px;white-space:nowrap}
.stat{font-size:18px;font-weight:600;padding:6px 12px;border-radius:9px;white-space:nowrap}
.g{background:${T.s0bg};color:${T.s0}} .m{background:${T.s1bg};color:${T.s1}}
.b{background:${T.s2bg};color:${T.s2}} .w{background:${T.s3bg};color:${T.s3}}
.meter{flex:none;width:58px;height:5px;border-radius:5px;background:${T.surface3};overflow:hidden;margin-left:6px}
.meter i{display:block;height:100%;background:${T.liveDot};border-radius:5px}
.old .meter i{background:${T.ink3}}
.note{font-size:19px;color:${T.ink2};margin-top:14px;border-left:3px solid ${T.line};padding-left:12px;line-height:1.5}
</style></head><body>
<div class="left">
  <div class="brand">${markSvg(56)}<b>나가 있는 사람이 전하는 현장</b></div>
  <h1>동네<br><span>특파원</span></h1>
  <p class="tag">놀이공간·맛집·카페,<br>지금 거기가 어떤지</p>
  <p class="sub">웨이팅·혼잡·주차처럼 금방 상하는 소식은<br>시간과 함께 흐려집니다.</p>
  <p class="url">richroro.github.io/correspondent</p>
</div>
<div class="right">
  ${card({ cls: '', cat: '놀이공간', age: '14분 전', place: '별빛 키즈카페', area: '안양 안양동',
    chips: '<span class="stat g">대기 없음</span><span class="stat g">한산</span><span class="stat b">주차 만석</span>',
    meter: 92, note: '평일 낮이라 텅 비었어요. 주차는 골목에.' })}
  ${card({ cls: 'old', cat: '놀이공간', age: '4시간 전', place: '별빛 키즈카페', area: '안양 안양동',
    chips: '<span class="stat m">대기 30분</span><span class="stat b">붐빔</span><span class="stat w">주차 불가</span>',
    meter: 4, note: '주말 오후 들어오니 대기 걸립니다.' })}
</div>
</body></html>`;

/* ─────────────────────────── 아이콘 ─────────────────────────── */
// 일반: 둥근 네모에 투명 바탕. 가장자리 둥글기는 파비콘과 같다.
const icon = (px) => `<!doctype html><html><body style="margin:0;background:transparent">${markSvg(px)}</body></html>`;
// 마스커블·애플: 바탕을 끝까지 칠하고 무늬를 안쪽 80% 원 안에 둔다(런처가 모양을 잘라 낸다).
const fullBleed = (px, scale) => `<!doctype html><html><body style="margin:0">
  <svg width="${px}" height="${px}" viewBox="0 0 100 100"><rect width="100" height="100" fill="${T.accent}"/>
  <g transform="translate(50 50) scale(${scale}) translate(-50 -47)">${GLYPH}</g></svg></body></html>`;

const b = await chromium.launch();
async function shot(html, w, h, file, transparent) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await p.setContent(html, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: file, omitBackground: !!transparent, clip: { x: 0, y: 0, width: w, height: h } });
  await p.close();
  console.log('  ' + file.replace(OUT + '/', ''));
}
mkdirSync(resolve(OUT, 'icons'), { recursive: true });
await shot(OG, 1200, 630, resolve(OUT, 'og.png'));
await shot(icon(192), 192, 192, resolve(OUT, 'icons/icon-192.png'), true);
await shot(icon(512), 512, 512, resolve(OUT, 'icons/icon-512.png'), true);
await shot(fullBleed(512, 0.74), 512, 512, resolve(OUT, 'icons/icon-maskable-512.png'));
await shot(fullBleed(180, 0.86), 180, 180, resolve(OUT, 'icons/apple-touch-icon.png'));
await b.close();
