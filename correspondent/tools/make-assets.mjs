/* ============================================================================
   공유 카드(og.png)와 앱 아이콘(icons/*.png)을 그린다.

     npm install --no-save playwright @fontsource/ibm-plex-sans-kr@5 @fontsource/black-han-sans@5   (저장소 뿌리에서)
     node correspondent/tools/make-assets.mjs

   카톡에 링크를 붙이면 뜨는 카드가 og.png 다. 이 앱은 링크 붙여넣기가 유통 경로의 전부라서
   이 한 장이 첫인상이다. 공유 링크의 #r=… 은 서버로 가지 않으므로 카톡은 리포트 내용을 볼 수
   없다 — 카드는 리포트마다가 아니라 앱 하나에 한 장이다.

   카드에는 이 앱의 생각 하나만 그린다: 같은 장소의 소식이 시간이 지나면 흐려진다.
   앱과 같은 차림 — 남색 방송 머리띠, 빨간 방송 표시, 장소 이름은 뉴스 자막체(Black Han Sans).
   ========================================================================== */
import { chromium } from 'playwright';
import { mkdirSync, existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, '..');
const req = createRequire(import.meta.url);
function pkgDir(name) {
  try { return dirname(req.resolve(name + '/package.json')); } catch (e) { return ''; }
}
const PLEX = process.env.FONT_DIR ? resolve(process.env.FONT_DIR) : resolve(pkgDir('@fontsource/ibm-plex-sans-kr'), 'files');
const BHS = pkgDir('@fontsource/black-han-sans');
if (!existsSync(PLEX) || !BHS) {
  console.error('글꼴이 없습니다.\n  npm install --no-save @fontsource/ibm-plex-sans-kr@5 @fontsource/black-han-sans@5');
  process.exit(1);
}
const face = (w) => ['korean', 'latin'].map((sub) =>
  `@font-face{font-family:"Plex";font-weight:${w};src:url("${pathToFileURL(resolve(PLEX, `ibm-plex-sans-kr-${sub}-${w}-normal.woff2`))}") format("woff2")}`
).join('\n');
/* 뉴스 자막체는 글자 범위별로 잘린 파일들이다 — fontsource 의 CSS 를 그대로 쓰고 경로만 파일 주소로 */
const display = readFileSync(resolve(BHS, '400.css'), 'utf8')
  .replace(/url\(\.\/files\/([^)]+)\)/g, (m, f) => `url("${pathToFileURL(resolve(BHS, 'files', f))}")`);

/* 앱과 같은 값 (index.html 의 :root 밝은 쪽) */
const T = {
  band: '#0E1E3D', onBand: '#FFFFFF', onBand2: '#B8C4DC',
  paper: '#EEF1F5', surface: '#FFFFFF', surface2: '#F4F6F9', surface3: '#E2E7EE',
  ink: '#0D1628', ink2: '#3A4659', ink3: '#5B687C', line: '#D8DEE7',
  tag: '#C8261A', liveDot: '#E8372A', live: '#C4261B',
  s0bg: '#DDF1E4', s0: '#145C38', s1bg: '#FFF0C7', s1: '#6E4B00',
  s2bg: '#FFD2AE', s2: '#7A3200', s3bg: '#B3261E', s3: '#FFFFFF'
};

/* 방송 중 표시 — 빨간 네모 안의 전파. 앱 머리띠의 표시와 같다 */
const GLYPH = `<circle cx="50" cy="66" r="9" fill="#fff"/>
  <path d="M33 50 A24 24 0 0 1 67 50" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round"/>
  <path d="M20 36 A42 42 0 0 1 80 36" fill="none" stroke="#fff" stroke-width="8" stroke-linecap="round"/>`;

const markSvg = (size) => `<svg width="${size}" height="${size}" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="${T.tag}"/>${GLYPH}</svg>`;

/* 전파 세기 — 신선도. 켜진 막대 수 */
const bars = (on, cold) => `<span class="sig">${[0, 1, 2, 3].map((k) =>
  `<i style="height:${6 + k * 5}px;background:${k < on ? (cold ? T.ink3 : T.liveDot) : T.surface3}"></i>`).join('')}</span>`;

/* ─────────────────────────── 공유 카드 1200×630 ─────────────────────────── */
const card = (o) => `
  <div class="card ${o.cls}">
    <div class="top">${o.live ? '<span class="sokbo">속보</span>' : ''}<span class="cat">${o.cat}</span><span class="age">${o.age}</span></div>
    <div class="place">${o.place}<span class="area">${o.area}</span></div>
    <div class="row">${o.chips}${bars(o.bars, o.cls === 'old')}</div>
    <div class="note">${o.note}</div>
    <div class="by">${o.by}</div>
  </div>`;

const OG = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
${face(400)}${face(600)}${face(700)}
${display}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;background:${T.band};font-family:"Plex",sans-serif;color:${T.onBand};
  letter-spacing:-.02em;display:grid;grid-template-columns:500px 1fr;gap:44px;padding:62px 60px 54px 70px;overflow:hidden}
.left{display:flex;flex-direction:column}
.brand{display:flex;align-items:center;gap:14px}
.brand b{font-size:21px;font-weight:600;color:${T.onBand2};letter-spacing:0}
h1{font-family:"Black Han Sans",sans-serif;font-weight:400;font-size:104px;line-height:1.02;letter-spacing:-.01em;margin-top:30px}
h1 span{display:block;color:#fff}
.tag{font-size:31px;font-weight:600;line-height:1.4;color:#fff;margin-top:24px;letter-spacing:-.03em}
.sub{font-size:21px;line-height:1.6;color:${T.onBand2};margin-top:14px}
.url{margin-top:auto;font-size:19px;color:${T.onBand2};font-weight:600;letter-spacing:0}
.right{display:flex;flex-direction:column;gap:20px;padding-top:6px}
.card{background:${T.surface};color:${T.ink};border-radius:18px;padding:20px 24px 18px;box-shadow:0 18px 40px -22px rgba(0,0,0,.6)}
.card.old{background:${T.surface2}}
.top{display:flex;gap:10px;align-items:center;font-size:17px;color:${T.ink2};font-weight:600}
.sokbo{background:${T.tag};color:#fff;font-size:15px;font-weight:700;border-radius:5px;padding:2px 9px;letter-spacing:.04em}
.age{color:${T.live};font-weight:600}
.old .age{color:${T.ink3};font-weight:400}
.place{font-family:"Black Han Sans",sans-serif;font-weight:400;font-size:34px;letter-spacing:0;margin-top:6px;line-height:1.25}
.area{font-family:"Plex",sans-serif;font-size:18px;font-weight:400;color:${T.ink3};margin-left:10px;letter-spacing:-.01em}
.row{display:flex;gap:8px;align-items:center;margin-top:12px}
.stat{font-size:18px;font-weight:700;padding:6px 12px;border-radius:9px;white-space:nowrap}
.g{background:${T.s0bg};color:${T.s0}} .m{background:${T.s1bg};color:${T.s1}}
.b{background:${T.s2bg};color:${T.s2}} .w{background:${T.s3bg};color:${T.s3}}
.old .stat{background:${T.surface2};color:${T.ink3};font-weight:500;box-shadow:inset 0 0 0 1.5px ${T.line}}
.sig{display:flex;align-items:flex-end;gap:4px;height:21px;margin-left:8px}
.sig i{display:block;width:6px;border-radius:2px}
.note{font-size:19px;color:${T.ink};margin-top:12px;line-height:1.5}
.old .note{color:${T.ink2}}
.by{display:inline-block;margin-top:12px;background:${T.band};color:#fff;font-size:16px;font-weight:700;border-radius:4px;
  padding:3px 11px 3px 14px;box-shadow:inset 4px 0 0 ${T.liveDot}}
</style></head><body>
<div class="left">
  <div class="brand">${markSvg(54)}<b>나가 있는 사람이 전하는 현장</b></div>
  <h1>동네<span>특파원</span></h1>
  <p class="tag">놀이공간·맛집·카페,<br>지금 거기가 어떤지</p>
  <p class="sub">웨이팅·혼잡·주차처럼 금방 상하는 소식은<br>시간과 함께 흐려집니다.</p>
  <p class="url">richroro.github.io/correspondent</p>
</div>
<div class="right">
  ${card({ cls: '', live: true, cat: '놀이공간', age: '14분 전', place: '별빛 키즈카페', area: '안양 안양동',
    chips: '<span class="stat g">대기 없음</span><span class="stat g">한산</span><span class="stat b">주차 만석</span>',
    bars: 4, note: '평일 낮이라 텅 비었어요. 주차는 골목에.', by: '민지 특파원' })}
  ${card({ cls: 'old', live: false, cat: '놀이공간', age: '4시간 전', place: '별빛 키즈카페', area: '안양 안양동',
    chips: '<span class="stat m">대기 30분</span><span class="stat b">붐빔</span><span class="stat w">주차 불가</span>',
    bars: 0, note: '주말 오후 들어오니 대기 걸립니다.', by: '준호 특파원' })}
</div>
</body></html>`;

/* ─────────────────────────── 아이콘 ─────────────────────────── */
// 일반: 둥근 네모에 투명 바탕. 가장자리 둥글기는 파비콘과 같다.
const icon = (px) => `<!doctype html><html><body style="margin:0;background:transparent">${markSvg(px)}</body></html>`;
// 마스커블·애플: 바탕을 끝까지 칠하고 무늬를 안쪽 80% 원 안에 둔다(런처가 모양을 잘라 낸다).
const fullBleed = (px, scale) => `<!doctype html><html><body style="margin:0">
  <svg width="${px}" height="${px}" viewBox="0 0 100 100"><rect width="100" height="100" fill="${T.tag}"/>
  <g transform="translate(50 50) scale(${scale}) translate(-50 -51)">${GLYPH}</g></svg></body></html>`;

const b = await chromium.launch();
/* 빈 페이지(setContent)는 file:// 글꼴을 못 읽는다 — 임시 파일로 써서 파일 주소로 연다 */
const TMP = mkdtempSync(resolve(tmpdir(), 'tpw-assets-'));
let nth = 0;
async function shot(html, w, h, file, transparent) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = resolve(TMP, (nth++) + '.html');
  writeFileSync(page, html);
  await p.goto(pathToFileURL(page).href, { waitUntil: 'load' });
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
rmSync(TMP, { recursive: true, force: true });
