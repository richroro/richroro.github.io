/* 카톡 카드 · 홈 화면 설치 · 오프라인 · 폰 알림(서비스 워커) · 배포 버전 · 글꼴 · 저장 */
import { BASE, ok, section, launch, context, watch, openWith, report, finish, MIN } from './lib.mjs';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, statSync, mkdtempSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP, PAGES, SCRIPTS, version, stale } from '../tools/stamp.mjs';

/** 워커가 설 때까지(5초까지) 기다려 범위와 주소를 준다. 앱은 버전(?v=)을 모르면 워커를 등록하지 않고,
    그러면 ready 는 영영 안 온다 — 묶음이 멈추지 말고 검사가 떨어지게. 안 서면 빈 값. */
const swReady = (p) => p.evaluate(() => Promise.race([navigator.serviceWorker.ready.then((r) => ({ scope: r.scope, url: r.active.scriptURL })),
  new Promise((ok) => setTimeout(() => ok({ scope: '', url: '' }), 5000))]));

const b = await launch();

section('카톡 카드 (og)');
{
  const c = await context(b);
  const p = watch(await c.newPage());
  await p.goto(BASE, { waitUntil: 'networkidle' });
  const og = await p.evaluate(() => Object.fromEntries(Array.from(document.querySelectorAll('meta[property^="og:"],meta[name^="twitter:"]'))
    .map((m) => [m.getAttribute('property') || m.getAttribute('name'), m.content])));
  ok(/^https:\/\/richroro\.github\.io\/correspondent\/og\.png/.test(og['og:image'] || ''), 'og:image 는 절대 주소 (카톡은 상대 주소를 못 읽는다)');
  ok(og['og:image:width'] === '1200' && og['og:image:height'] === '630', 'og:image 크기 1200×630 명시');
  ok(og['twitter:card'] === 'summary_large_image', '큰 카드');
  const dim = await p.evaluate(async (u) => {
    const img = new Image(); img.src = u; await img.decode(); return [img.naturalWidth, img.naturalHeight];
  }, new URL('og.png', BASE).href);
  ok(dim[0] === 1200 && dim[1] === 630, '실제 og.png 도 1200×630: ' + dim.join('×'));
  await c.close();
}

section('홈 화면 설치');
{
  const c = await context(b);
  const p = watch(await c.newPage());
  await p.goto(BASE, { waitUntil: 'networkidle' });
  const href = await p.getAttribute('link[rel="manifest"]', 'href');
  const res = await p.request.get(new URL(href, BASE).href);
  ok(res.ok(), 'manifest 를 받을 수 있다');
  const m = await res.json();
  ok(m.name === '동네 특파원' && m.short_name === '특파원', '이름: ' + m.name + ' / ' + m.short_name);
  ok(m.display === 'standalone' && m.start_url === './' && m.scope === './', '독립 창, 이 폴더 안에서만');
  const sizes = m.icons.map((i) => i.sizes + (i.purpose === 'maskable' ? '·maskable' : ''));
  ok(sizes.includes('192x192') && sizes.includes('512x512') && sizes.includes('512x512·maskable'), '아이콘: ' + sizes.join(', '));
  for (const ic of m.icons.concat([{ src: 'icons/apple-touch-icon.png' }])) {
    const r = await p.request.get(new URL(ic.src, BASE).href);
    ok(r.ok() && /image\/png/.test(r.headers()['content-type']), '  └ ' + ic.src);
  }
  ok(m.shortcuts && m.shortcuts[0].url === './?write=1', '바로가기: 리포트 보내기');
  await c.close();

  const c2 = await context(b);
  const p2 = watch(await c2.newPage());
  await p2.goto(BASE + '?write=1', { waitUntil: 'networkidle' });
  await p2.waitForTimeout(300);
  ok(await p2.locator('#composeBack.open').count() === 1, '?write=1 로 들어오면 쓰기 창이 열린다');
  ok(!(await p2.evaluate(() => location.search)), '  └ 주소에서 ?write=1 은 지운다 (새로고침해도 또 안 열리게)');
  await c2.close();
}

section('주소창 색은 머리띠와 같은 남색 — 테마를 바꿔도');
{
  const c = await context(b, { colorScheme: 'light' });
  const p = watch(await c.newPage());
  await p.goto(BASE, { waitUntil: 'networkidle' });
  const tc = () => p.evaluate(() => Array.from(document.querySelectorAll('meta[name="theme-color"]')).map((m) => m.content).join(','));
  ok(await tc() === '#0E1E3D,#0E1E3D', '자동: 밝게·어둡게 모두 ' + await tc());
  await p.locator('#themeBtn').click();   // 자동 → 밝게
  await p.locator('#themeBtn').click();   // 밝게 → 어둡게
  ok(await tc() === '#0E1E3D,#0E1E3D', '어둡게를 골라도 머리띠 남색 그대로');
  await c.close();
}

section('오프라인');
{
  const c = await context(b, { viewport: { width: 390, height: 844 } });
  const p = watch(await c.newPage(), '오프라인');
  await p.goto(BASE, { waitUntil: 'networkidle' });
  const scope = (await swReady(p)).scope || 'about:blank';
  ok(new URL(scope).pathname === new URL(BASE).pathname, '서비스 워커 범위는 이 앱 폴더뿐: ' + new URL(scope).pathname);
  await p.reload({ waitUntil: 'networkidle' });
  ok(await p.evaluate(() => !!navigator.serviceWorker.controller), '두 번째 방문부터 워커가 페이지를 맡는다');

  await c.setOffline(true);
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(400);
  ok(await p.locator('#writeBtn').isVisible(), '끊긴 상태에서 새로고침해도 앱이 열린다');
  ok((await p.locator('#statline').innerText()).includes('오프라인'), '"오프라인" 이라고 알린다');

  await p.locator('#writeBtn').click();
  await p.waitForSelector('#composeBack.open');
  await p.fill('#fPlace', '지하 주차장 옆 놀이터');
  await p.locator('#fCrowd [data-v="0"]').click();   // 장소 이름만으로는 안 보내진다(빈 카드) — 하나는 고른다
  await p.locator('#composeGo').click();
  await p.waitForSelector('#shareBack.open');
  await p.locator('#shareBack [data-close]').last().click();
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('tpw.v1')).reports.map((r) => r.place));
  ok(saved.includes('지하 주차장 옆 놀이터'), '끊긴 상태에서 쓴 글이 이 기기에 저장된다');

  const priv = await c.newPage();
  await priv.goto(new URL('privacy.html', BASE).href, { waitUntil: 'domcontentloaded' });
  ok((await priv.locator('h1').innerText()) === '개인정보처리방침', '처리방침도 끊긴 상태에서 열린다');

  await c.setOffline(false);
  await p.evaluate(() => window.dispatchEvent(new Event('online')));
  await p.waitForTimeout(200);
  ok(!(await p.locator('#statline').innerText()).includes('오프라인'), '다시 연결되면 알림이 사라진다');
  await c.close();
}

section('폰 알림 — 서비스 워커가 띄우고, 누르면 그 장소로');
{
  /* 진짜 푸시 서비스(FCM)는 여기서 못 쓴다. 개발자 도구 규약(CDP)으로 암호가 풀린 뒤의 알림을 워커에 바로 넣는다 —
     브라우저가 푸시를 받았을 때와 같은 push 이벤트다. 암호화 쪽은 server/test-push.mjs 가 RFC 예제로 본다. */
  /* 가벼운 헤드리스(headless shell)는 알림 권한을 늘 거부한다 — 이 묶음만 온전한 크로미엄(새 헤드리스)으로 띄운다 */
  const full = await launch({ channel: 'chromium' });
  const c = await context(full);
  await c.grantPermissions(['notifications'], { origin: new URL(BASE).origin });
  const p = watch(await c.newPage());
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await swReady(p);
  const cdp = await c.newCDPSession(p);
  const regs = [];
  cdp.on('ServiceWorker.workerRegistrationUpdated', (e) => regs.push(...e.registrations));
  await cdp.send('ServiceWorker.enable');
  for (let i = 0; i < 20 && !regs.some((r) => r.scopeURL === BASE); i++) await p.waitForTimeout(100);
  const reg = regs.find((r) => r.scopeURL === BASE);
  ok(!!reg, '워커가 /correspondent/ 범위로 서 있다');
  const push = async (data) => { if (reg) await cdp.send('ServiceWorker.deliverPushMessage', { origin: new URL(BASE).origin, registrationId: reg.registrationId, data: JSON.stringify(data) }); };
  const shown = () => p.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration();
    return r ? (await r.getNotifications()).map((n) => ({ title: n.title, body: n.body, tag: n.tag, url: n.data && n.data.url })) : []; });
  await push({ title: '별빛 키즈카페', body: '대기 30분 · 붐빔 — 준호 특파원', tag: 'tpw-별빛키즈카페', url: './?place=' + encodeURIComponent('별빛키즈카페') });
  let list = [];
  for (let i = 0; i < 20 && !list.length; i++) { await p.waitForTimeout(100); list = await shown(); }
  ok(list.length === 1 && list[0].title === '별빛 키즈카페' && list[0].body === '대기 30분 · 붐빔 — 준호 특파원', '푸시가 오면 알림을 띄운다: ' + (list[0] ? list[0].title + ' / ' + list[0].body : '없음'));
  await push({ title: '별빛 키즈카페', body: '한산 — 민지 특파원', tag: 'tpw-별빛키즈카페', url: './?place=x' });
  await p.waitForTimeout(400);
  list = await shown();
  ok(list.length === 1 && list[0].body === '한산 — 민지 특파원', '  └ 같은 장소 알림은 하나로 덮는다 (tag) — 알림 창을 채우지 않게');
  await push({ title: '<b>' + 'x'.repeat(100), body: 'y'.repeat(400), url: 'https://evil.test/' });
  await p.waitForTimeout(400);
  list = await shown();
  const odd = list.find((n) => n.tag === 'tpw');
  ok(odd && odd.title.length === 60 && odd.body.length === 160, '  └ 길이를 자른다 (제목 60자, 본문 160자)');
  await c.close();
  await full.close();

  /* 알림을 누르면 ?place=열쇠 로 들어온다 — 그 장소 창이 열리고, 주소에서는 지운다 */
  const c2 = await context(b);
  const p2 = await openWith(c2, [report({ t: Date.now() - 10 * MIN, place: '별빛 키즈카페', by: '준호', crowd: 2 })]);
  await p2.goto(BASE + '?place=' + encodeURIComponent('별빛키즈카페'), { waitUntil: 'networkidle' });
  await p2.waitForSelector('#placeBack.open');
  ok((await p2.locator('#placeTitle').innerText()) === '별빛 키즈카페', '?place= 로 들어오면 그 장소 창이 열린다');
  ok(!(await p2.evaluate(() => location.search)), '  └ 주소에서 ?place= 는 지운다');
  await c2.close();
}

/* ============================================================================
   배포 · 글꼴 · 저장
   ========================================================================== */
const PH = { viewport: { width: 390, height: 844 } };
const V = version();
/** 캐시 이름 → 담긴 주소(앱 폴더 기준, 다른 출처는 통째로). */
const cacheList = (p) => p.evaluate(async () => {
  const base = new URL('./', location.href).href, out = {};
  for (const k of await caches.keys())
    out[k] = (await (await caches.open(k)).keys()).map((r) => r.url.startsWith(base) ? r.url.slice(base.length) : r.url);
  return out;
});
/** 쓰기 창으로 리포트 하나. */
async function write(p, place) {
  await p.locator('#writeBtn').click();
  await p.waitForSelector('#composeBack.open');
  await p.fill('#fPlace', place);
  await p.locator('#fCrowd [data-v="0"]').click();   // 장소 이름만으로는 안 나간다 — 하나는 고른다
  await p.locator('#composeGo').click();
  await p.waitForSelector('#shareBack.open');
  await p.keyboard.press('Escape');
}

/* 깃허브 페이지스를 흉내 내는 작은 서버 — 파일마다 10분 캐시(max-age=600)를 붙여 준다.
   배포는 판을 바꿔 흉내 낸다: 문서의 ?v= 가 새 판을 부르고, app.js 끝에 판 표시(window.__build)가 붙는다.
   slow 에 적은 파일은 그만큼 늦게('hang' 이면 영영 안) 준다 — 약한 신호. 워커가 받으러 오는 것도 여기로 온다. */
async function pages() {
  const TYPE = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', webmanifest: 'application/manifest+json', png: 'image/png' };
  const s = { v: V, tag: 'A', slow: {}, cc: 'max-age=600' };
  const srv = http.createServer(async (req, res) => {
    const f = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/correspondent\//, '') || 'index.html';
    const file = join(APP, f);
    if (f.includes('..') || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    if (s.slow[f] === 'hang') return;
    if (s.slow[f]) await new Promise((ok) => setTimeout(ok, s.slow[f]));
    let body = readFileSync(file);
    if (f.endsWith('.html')) body = String(body).replace(/(<script src="[^"]*\?v=)[^"]*"/g, '$1' + s.v + '"');   // 있는 버전만 바꾼다
    if (f === 'app.js') body = body + '\n;window.__build = "' + s.tag + '";\n';
    res.writeHead(200, { 'Content-Type': TYPE[f.split('.').pop()] || 'application/octet-stream', 'Cache-Control': s.cc });
    res.end(body);
  });
  await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
  s.url = 'http://127.0.0.1:' + srv.address().port + '/correspondent/';
  s.close = () => { srv.closeAllConnections(); srv.close(); };
  return s;
}
const NEXT = V === 'b0b0b0b0b0' ? 'c0c0c0c0c0' : 'b0b0b0b0b0';   // 배포된 다음 판의 H

section('배포 — 스크립트 주소에 내용 버전(?v=)');
{
  const bad = stale();
  ok(!bad.length, '?v= 가 스크립트 내용과 맞다 (v=' + V + ')' +
    (bad.length ? ' — ' + bad.join(', ') + ' 가 낡았습니다. node correspondent/tools/stamp.mjs 를 돌리고 같이 커밋하세요' : ''));
  const srcs = async (page) => Array.from((await (await fetch(new URL(page, BASE))).text()).matchAll(/<script src="([^"]+)"/g), (m) => m[1]).join(' ');
  ok(await srcs('./') === 'config.js sync.js?v=' + V + ' app.js?v=' + V, '앱: sync.js·app.js 에 ?v=H, config.js 는 버전 없이 (운영자가 손으로 고친다)');
  ok(await srcs('admin.html') === 'config.js sync.js?v=' + V + ' admin.js?v=' + V, '운영 화면: sync.js·admin.js 에 ?v=H');
  /* 도구 — 스크립트를 고치고 안 돌리면 --check 가 떨어지고, 돌리면 두 문서를 고친다 (사본에서) */
  const tool = (...a) => spawnSync(process.execPath, [fileURLToPath(new URL('../tools/stamp.mjs', import.meta.url)), ...a], { encoding: 'utf8' });
  ok(tool('--check').status === 0, 'stamp.mjs --check: 지금 저장소는 맞다');
  const tmp = mkdtempSync(join(tmpdir(), 'tpw-stamp-'));
  for (const f of SCRIPTS.concat(PAGES)) cpSync(join(APP, f), join(tmp, f));
  writeFileSync(join(tmp, 'sync.js'), readFileSync(join(tmp, 'sync.js'), 'utf8') + '\n// 고침\n');
  const r1 = tool('--check', tmp);
  ok(r1.status === 1 && r1.stderr.includes('node correspondent/tools/stamp.mjs'), '  └ 스크립트를 고치고 안 돌리면 --check 가 종료 코드 1 로 할 일을 알려 준다');
  const r2 = tool(tmp), v2 = version(tmp);
  ok(r2.status === 0 && tool('--check', tmp).status === 0 && v2 !== V &&
    readFileSync(join(tmp, 'index.html'), 'utf8').includes('<script src="app.js?v=' + v2 + '">') &&
    readFileSync(join(tmp, 'admin.html'), 'utf8').includes('<script src="admin.js?v=' + v2 + '">'), '  └ 돌리면 두 문서의 ?v= 를 새 H 로 고친다');
  rmSync(tmp, { recursive: true, force: true });
}

section('배포 — 워커는 버전이 붙은 스크립트를 캐시에서 먼저 준다');
{
  const srv = await pages();
  srv.cc = 'no-store';   // 워커가 네트워크를 보면 이 서버까지 오게 — 브라우저 캐시가 대신 답하지 않게
  const c = await context(b, PH);
  const p = watch(await c.newPage(), '버전 워커');
  await p.goto(srv.url, { waitUntil: 'networkidle' });
  ok((await swReady(p)).url === srv.url + 'sw.js?v=' + V, '워커는 sw.js?v=H 로 선다 — app.js 가 제 주소(app.js?v=H)의 H 를 넘긴다');
  await p.reload({ waitUntil: 'networkidle' });
  const own = (await cacheList(p))['tpw-' + V] || [];
  ok(['', 'app.js?v=' + V, 'sync.js?v=' + V, 'config.js'].every((u) => own.includes(u)), '캐시 이름은 tpw-H — 문서와 그 판의 스크립트가 들어 있다');
  srv.slow = { 'app.js': 'hang', 'sync.js': 'hang' };
  const t0 = Date.now();
  await p.reload({ waitUntil: 'commit' });
  const ms = await p.locator('#feed .card').first().waitFor({ timeout: 1500 }).then(() => Date.now() - t0, () => 0);
  ok(ms > 0, 'app.js·sync.js 가 네트워크에서 안 와도 캐시에서 바로 뜬다 (' + (ms || '1500+') + 'ms — 네트워크를 먼저 보면 3초)');
  /* 배포 전의 app.js 는 버전 없이 sw.js 를 등록한다. 그 워커가 서면 버전 캐시를 지우므로 서지 않아야 한다 */
  await p.evaluate(() => navigator.serviceWorker.register('sw.js').catch(() => {}));
  for (let i = 0; i < 25 && await p.evaluate(async () => !!((await navigator.serviceWorker.getRegistration()) || {}).installing); i++) await p.waitForTimeout(200);
  ok(await p.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return r && r.active && r.active.scriptURL; }) === srv.url + 'sw.js?v=' + V &&
    !!(await cacheList(p))['tpw-' + V], '버전 없이 불린 sw.js(배포 전의 app.js 가 부른다)는 서지 않는다 — 버전 워커와 캐시가 그대로');
  srv.close();   // 서버가 아예 안 닿는다 — 지하 주차장
  await p.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});   // 워커가 없으면 여기서 연결 오류
  ok(await p.locator('#feed .card').first().waitFor({ timeout: 5000 }).then(() => true, () => false), '서버가 아예 안 닿아도 캐시의 문서와 스크립트로 뜬다');
  await c.close();
}

section('배포 — 버전 없는 옛 index.html 사본에 새 app.js 가 붙어도');
{
  /* 옛 사본 = 스크립트에 ?v= 가 없고, 글꼴 스타일시트가 머리에 있고, 저장 경고 칸이 없는 문서. 지금 것을 되돌려 만든다 */
  const FONT = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans+KR:wght@400;500;600;700&display=swap">';
  const old = (await (await fetch(BASE)).text()).replace(/(<script src="[^"]+)\?v=[^"]*"/g, '$1"')
    .replace('<style>', FONT + '\n<style>').replace(/<div class="store-warn" id="storeWarn"[\s\S]*?<\/div>\s*/, '');
  ok(!/<script src="[^"]*\?v=/.test(old) && !old.includes('id="storeWarn"') && old.includes(FONT), '옛 사본: 버전 없음, 글꼴은 머리에, 저장 경고 칸 없음');
  const c = await context(b, PH);
  await c.route((u) => u.pathname.endsWith('/correspondent/'), (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: old }));
  const p = watch(await c.newPage(), '옛 사본');
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE, { waitUntil: 'networkidle' });
  ok(!errs.length && await p.locator('#feed .card').count() === 8, '새 app.js 가 옛 사본에서도 뜬다' + (errs.length ? ': ' + errs[0] : ''));
  ok(await p.evaluate(() => document.querySelectorAll('link[rel="stylesheet"][href^="https://fonts.googleapis.com/"]').length) === 1, '  └ 글꼴 스타일시트를 두 번 붙이지 않는다');
  ok(await p.evaluate(async () => !(await navigator.serviceWorker.getRegistration())), '  └ 버전을 모르면 워커를 등록하지 않는다');
  await write(p, '옛 사본에서 쓴 곳');
  ok(!errs.length && (await p.evaluate(() => localStorage.getItem('tpw.v1'))).includes('옛 사본에서 쓴 곳'), '  └ 쓰면 저장된다 (경고 칸이 없어도 멈추지 않는다)');
  await c.close();
}

section('배포 — 새 판이 나와도 옛 스크립트와 섞이지 않고, 새 캐시가 옛 캐시를 비운다');
{
  const srv = await pages();
  const c = await context(b, PH);
  const p = watch(await c.newPage(), '새 판');
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(srv.url, { waitUntil: 'networkidle' });
  await swReady(p);
  await p.reload({ waitUntil: 'networkidle' });
  ok(await p.evaluate(() => window.__build === 'A' && !!navigator.serviceWorker.controller), '판 A 를 워커가 맡고 있다');
  await p.evaluate(() => caches.open('tpw-fonts').then((k) => k.put('https://fonts.gstatic.com/s/probe.woff2', new Response('x'))));
  /* 배포: 문서는 다음 판(?v=NEXT)을 부르고, 새 app.js 는 약한 신호로 워커가 기다리는 3초보다 늦게 온다 */
  Object.assign(srv, { v: NEXT, tag: 'B', slow: { 'app.js': 3500 } });
  await p.reload({ waitUntil: 'commit' });
  await p.waitForFunction(() => window.__build, null, { timeout: 10000 }).catch(() => {});
  ok(await p.evaluate(() => window.__build) === 'B' && !errs.length && await p.locator('#feed .card').count() > 0,
    '새 문서는 새 app.js 로만 뜬다 — 워커 캐시의 옛 app.js 와 섞이지 않는다 (섞이면 빈 화면)' + (errs.length ? ': ' + errs[0] : ''));
  srv.slow = {};
  /* 새 판의 워커가 다 설 때까지(activated — 옛 캐시 지우기가 끝난 뒤) 기다린다. 페이지는 activating 때 이미 넘어간다 */
  const settled = () => p.evaluate(async (u) => { const r = await navigator.serviceWorker.getRegistration();
    return !!(r && r.active && r.active.scriptURL === u && r.active.state === 'activated'); }, srv.url + 'sw.js?v=' + NEXT);
  for (let i = 0; i < 75 && !(await settled()); i++) await p.waitForTimeout(200);
  const cached = await cacheList(p);
  ok(Object.keys(cached).sort().join(' ') === ['tpw-' + NEXT, 'tpw-fonts'].sort().join(' '),
    '새 판의 워커가 서면 옛 캐시(tpw-H)를 지운다: ' + Object.keys(cached).join(', '));
  ok((cached['tpw-' + NEXT] || []).includes('app.js?v=' + NEXT), '  └ 새 캐시에 새 판의 app.js');
  ok((cached['tpw-fonts'] || []).includes('https://fonts.gstatic.com/s/probe.woff2'), '  └ 글꼴 캐시(tpw-fonts)는 판이 바뀌어도 남는다');
  await c.close();
  srv.close();
}

section('배포 — 신호가 약해 옛 판으로 뜬 뒤 아예 끊겨도');
{
  /* 새 문서가 워커의 3초보다 늦게 오면 워커는 캐시의 옛 문서를 준다. 늦게 온 새 문서를 캐시에 담으면
     캐시에는 새 문서와 옛 스크립트만 남아, 다음에 끊긴 채 열 때 빈 화면이 된다 */
  const srv = await pages();
  const c = await context(b, PH);
  const p = watch(await c.newPage(), '늦은 문서');
  await p.goto(srv.url, { waitUntil: 'networkidle' });
  await swReady(p);
  await p.reload({ waitUntil: 'networkidle' });
  Object.assign(srv, { v: NEXT, tag: 'B', slow: { 'index.html': 3500 } });
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1500);   // 늦은 새 문서가 워커에 다 닿을 때까지
  ok(await p.evaluate(() => window.__build) === 'A', '3초 안에 안 온 새 문서 대신 캐시의 옛 판이 뜬다 (옛 문서 + 옛 스크립트)');
  srv.close();
  await p.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  const up = await p.locator('#feed .card').first().waitFor({ timeout: 5000 }).then(() => true, () => false);
  ok(up && await p.evaluate(() => window.__build) === 'A', '  └ 그 뒤 아예 끊겨도 뜬다 — 늦게 온 새 문서를 옛 판의 캐시에 담지 않는다');
  await c.close();
}

section('배포 — 워커가 서는 사이에 또 배포되면 서지 않는다');
{
  /* 새 워커(판 B)는 설 때 문서를 받아 담는다. 그새 판 C 가 나와 문서가 C 를 부르면, B 의 캐시에는 C 문서와
     B 스크립트가 섞인다 — 그런 워커는 서지 않고 있던 워커가 남는다. C 의 app.js 가 열리며 제 워커를 세운다 */
  const srv = await pages();
  const c = await context(b, PH);
  const p = watch(await c.newPage(), '연달아 배포');
  await p.goto(srv.url, { waitUntil: 'networkidle' });
  await swReady(p);
  await p.reload({ waitUntil: 'networkidle' });
  Object.assign(srv, { v: NEXT, tag: 'B', slow: { 'sw.js': 1500 } });   // 새 워커 스크립트가 늦게 온다
  await p.reload({ waitUntil: 'commit' });
  await p.waitForFunction(() => window.__build === 'B', null, { timeout: 5000 }).catch(() => {});
  Object.assign(srv, { v: 'c1c1c1c1c1', tag: 'C', slow: {} });
  const reg = () => p.evaluate(async () => { const r = (await navigator.serviceWorker.getRegistration()) || {};
    return { active: r.active && r.active.scriptURL, busy: !!(r.installing || r.waiting) }; });
  /* 판 B 의 워커가 서려다 그만둘 때까지 (스크립트가 1.5초 늦게 오고, 설 때 문서를 받는다) */
  for (let i = 0, seen = false; i < 60; i++) {
    const busy = (await reg()).busy;
    if (busy) seen = true; else if (seen) break;
    await p.waitForTimeout(100);
  }
  const r = await reg();
  ok(r.active === srv.url + 'sw.js?v=' + V && !r.busy && !!(await cacheList(p))['tpw-' + V],
    '문서가 다른 판을 부르면 새 워커는 서지 않는다 — 있던 워커와 캐시가 남는다 (' + (r.active || '').split('?')[1] + ')');
  await c.close();
  srv.close();
}

section('배포 — 깃허브가 10분 묵혀 둔 옛 app.js 와도 섞이지 않는다 (워커 없이)');
{
  const srv = await pages();
  const c = await context(b, Object.assign({ serviceWorkers: 'block' }, PH));
  const p = watch(await c.newPage(), '10분 캐시');
  await p.goto(srv.url, { waitUntil: 'networkidle' });
  const first = await p.evaluate(() => window.__build);
  Object.assign(srv, { v: NEXT, tag: 'B' });
  await p.reload({ waitUntil: 'networkidle' });   // 새로 고침은 문서만 새로 묻고, 10분이 안 된 스크립트는 브라우저 캐시에서 꺼낸다
  ok(first === 'A' && await p.evaluate(() => window.__build) === 'B' && await p.locator('#feed .card').count() > 0,
    '배포 직후 새로 고침 — 새 문서가 새 주소를 불러 새 app.js 로 뜬다 (옛 주소였다면 캐시의 옛 app.js 와 섞였다)');
  await c.close();
  srv.close();
}

section('글꼴이 첫 화면을 막지 않는다');
{
  const html = await (await fetch(BASE)).text();
  const head = html.slice(0, html.indexOf('</head>'));
  ok(!Array.from(head.matchAll(/<link\b[^>]*>/g)).some((m) => /stylesheet/.test(m[0]) && /fonts\.googleapis\.com/.test(m[0])),
    '문서 머리에 글꼴 스타일시트가 없다 — 있으면 받을 때까지 화면이 하얗다');
  ok((head.match(/<link rel="preconnect" href="https:\/\/fonts\.(googleapis|gstatic)\.com" crossorigin>/g) || []).length === 2, '  └ 연결 미리 열기(preconnect)는 그대로');
  const c = await context(b, Object.assign({ serviceWorkers: 'block' }, PH));
  await c.route(/fonts\.googleapis\.com/, () => new Promise(() => {}));   // 글꼴 CSS 가 영영 안 온다 — 약한 신호
  await c.route(/fonts\.gstatic\.com/, (r) => r.abort());
  const p = watch(await c.newPage(), '글꼴');
  await p.addInitScript(() => {
    window.__fcp = 0;
    new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (e.name === 'first-contentful-paint') window.__fcp = e.startTime; }))
      .observe({ type: 'paint', buffered: true });
  });
  const t0 = Date.now();
  await p.goto(BASE, { waitUntil: 'commit' });
  const shown = await p.locator('#feed .card').first().waitFor({ timeout: 3000 }).then(() => Date.now() - t0, () => 0);
  const fcp = await p.evaluate(() => window.__fcp);
  ok(shown > 0 && fcp > 0 && fcp < 1500, '글꼴 CSS 가 안 와도 첫 카드가 바로 보인다 (첫 그리기 ' + Math.round(fcp) + 'ms, 카드 ' + (shown || '3000+') + 'ms)');
  const links = await p.evaluate(() => Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .filter((l) => l.href.startsWith('https://fonts.googleapis.com/')).map((l) => l.crossOrigin + ' ' + (l.parentNode === document.head)));
  ok(links.join() === 'anonymous true', '  └ 글꼴 스타일시트는 app.js 가 머리에 하나 붙인다 (crossorigin — 워커가 확인하고 담을 수 있게)');
  await c.close();

  /* 두 번째부터는 워커가 받아 둔 글꼴 CSS 를 바로 준다(tpw-fonts) — 끊겨도, 느려도 같은 글꼴 */
  const c2 = await context(b, PH);
  const p2 = watch(await c2.newPage(), '글꼴 캐시');
  await p2.goto(BASE, { waitUntil: 'networkidle' });
  await swReady(p2);
  const href = await p2.evaluate(() => (document.querySelector('link[rel="stylesheet"][href^="https://fonts.googleapis.com/"]') || {}).href || '');
  if (href) await p2.evaluate((u) => caches.open('tpw-fonts').then((k) => k.put(u, new Response(':root{--tpw-font-css:cached}',
    { headers: { 'Content-Type': 'text/css' } }))), href);
  await p2.reload({ waitUntil: 'networkidle' });
  ok(await p2.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--tpw-font-css').trim()) === 'cached',
    '두 번째부터는 워커가 받아 둔 글꼴 CSS 를 바로 준다 (뒤에서 새로 받아 둔다)');
  await c2.close();
}

section('두 탭 — 한쪽에서 쓴 리포트를 다른 쪽이 지우지 않는다');
{
  /* 홈 화면 앱과, 카톡 링크를 크롬으로 연 창은 같은 저장소를 쓴다. 탭마다 보드를 통째로 쥐고 있다가 통째로 쓴다. */
  const c = await context(b, PH);
  const A = await openWith(c, [report({ t: Date.now() - 30 * MIN, by: '민지', place: '만안 손칼국수', wait: 10 })]);
  const B = watch(await c.newPage(), '탭 B');
  await B.goto(BASE, { waitUntil: 'networkidle' });
  const feedHas = (p, s, yes = true) => p.waitForFunction(([s, yes]) => document.querySelector('#feed').innerText.includes(s) === yes,
    [s, yes], { timeout: 3000 }).then(() => true, () => false);
  await write(A, 'A에서 쓴 곳');
  ok(await feedHas(B, 'A에서 쓴 곳'), 'A 에서 쓰면 B 의 속보에도 뜬다 — 저장소가 바뀌면 다시 읽는다');
  await write(B, 'B에서 쓴 곳');
  await A.reload({ waitUntil: 'networkidle' });
  const a = await A.locator('#feed').innerText();
  ok(a.includes('A에서 쓴 곳') && a.includes('B에서 쓴 곳') && a.includes('만안 손칼국수'),
    'B 에서 쓰고 A 를 새로 고쳐도 셋 다 있다 — 예전엔 B 가 저장하며 A 의 리포트를 지웠다');
  /* 합치지 않고 다시 읽기만 한다 — 한쪽에서 지운 것을 다른 쪽의 저장이 되살리지 않는다 */
  A.on('dialog', (d) => d.accept());
  const id = await A.evaluate(() => (JSON.parse(localStorage.getItem('tpw.v1')).reports.find((r) => r.place === 'A에서 쓴 곳') || {}).id);
  if (id) await A.locator('#feed [data-del="' + id + '"]').click();
  await feedHas(B, 'A에서 쓴 곳', false);
  await write(B, 'B에서 또 쓴 곳');
  const left = await A.evaluate(() => JSON.parse(localStorage.getItem('tpw.v1')).reports.map((r) => r.place));
  ok(!left.includes('A에서 쓴 곳') && left.includes('B에서 또 쓴 곳') && left.includes('B에서 쓴 곳'),
    '  └ A 에서 지운 리포트는 B 가 저장해도 되살아나지 않는다');
  await c.close();
}

section('저장 공간이 가득 차도 리포트를 조용히 잃지 않는다');
{
  /* localStorage(5백만 자)는 이 사이트의 다른 앱들과 나눠 쓴다. 남은 자리를 흉내 낸다 —
     tpw.v1 이 window.__room 자보다 길어지면 브라우저처럼 QuotaExceededError 를 던진다. */
  const T = Date.now();
  const others = Array.from({ length: 40 }, (_, i) => report({ id: 'oth' + String(i).padStart(5, '0'), t: T - (i + 1) * 3 * 3600e3,
    by: '남', place: '남의 곳 ' + i, note: '받은 소식 '.repeat(8) }));
  const mineOld = report({ id: 'mine0old', t: T - 300 * 3600e3, by: '나', place: '내가 예전에 쓴 곳', mine: true });   // 가장 오래된 것은 내 글
  const c = await context(b, Object.assign({ acceptDownloads: true }, PH));
  await c.addInitScript(() => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === 'tpw.v1' && window.__room && String(v).length > window.__room) throw new DOMException('가득 참', 'QuotaExceededError');
      return set.call(this, k, v);
    };
  });
  const p = await openWith(c, others.concat([mineOld]));
  await p.evaluate(() => { window.__room = JSON.stringify(board).length + 60; });   // 새 리포트 하나가 안 들어갈 만큼
  await write(p, '꽉 찬 날 쓴 곳');
  ok(await p.locator('#storeWarn').isHidden(), '자리를 만들어 저장했으면 경고는 없다');
  await p.reload({ waitUntil: 'networkidle' });
  const kept = await p.evaluate(() => JSON.parse(localStorage.getItem('tpw.v1')).reports.map((r) => r.id + ' ' + r.place));
  ok(kept.some((x) => x.endsWith(' 꽉 찬 날 쓴 곳')), '새로 쓴 리포트가 새로 고쳐도 남아 있다');
  ok(kept.includes('mine0old 내가 예전에 쓴 곳'), '  └ 내 글은 가장 오래됐어도 덜어 내지 않는다');
  ok(!kept.some((x) => x.startsWith('oth00039')) && kept.includes('oth00000 남의 곳 0') && kept.length >= 30,
    '  └ 대신 남의 리포트를 오래된 것부터 조금 덜어 냈다 (' + (42 - kept.length) + '건)');

  await p.evaluate(() => { window.__room = 1; });   // 이제 무엇도 안 들어간다
  const n = await p.evaluate(() => board.reports.length);
  await write(p, '저장 못 한 곳');
  ok(await p.locator('#storeWarn').isVisible() && (await p.locator('#storeWarn').innerText()).includes('저장 공간이 가득 찼습니다'),
    '끝내 못 하면 속보 맨 위에 경고가 남는다 (토스트처럼 사라지지 않는다)');
  ok((await p.locator('#feed').innerText()).includes('저장 못 한 곳') && await p.evaluate(() => board.reports.length) === n + 1,
    '  └ 쓴 리포트는 화면에 그대로 — 저장이 안 되면 남의 리포트도 덜어 내지 않는다');
  const rescued = await p.locator('#storeWarnSave').isVisible() && await Promise.all([p.waitForEvent('download', { timeout: 5000 }),
    p.locator('#storeWarnSave').click()]).then(async ([dl]) => JSON.parse(readFileSync(await dl.path(), 'utf8')).reports.some((r) => r.place === '저장 못 한 곳'), () => false);
  ok(rescued, '  └ 경고의 "파일로 저장"으로 못 담은 리포트까지 파일로 건진다');
  /* 받은 것(파일)도 마찬가지 — 주고받기에 그 자리에서 말하고, 속보에 경고가 남는다 */
  await p.locator('.tab[data-view="sync"]').click();
  await p.setInputFiles('#fileInput', { name: 'b.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ reports: [report({ place: '파일로 받은 곳' })] })) });
  await p.waitForSelector('#bundleStatus.ok, #bundleStatus.err');
  ok(/저장하지 못했습니다/.test(await p.locator('#bundleStatus.err').innerText().catch(() => '')), '  └ 파일에서 불러와도 못 담았으면 그 자리에서 말한다');
  await p.locator('.tab[data-view="feed"]').click();
  ok(await p.locator('#storeWarn').isVisible(), '  └ 속보로 돌아와도 경고가 그대로');
  /* 그사이 다른 탭이 저장하면 이 탭은 보드를 다시 읽는다 — 그래도 못 담은 리포트는 들고 간다 */
  const q = watch(await c.newPage(), '다른 탭');
  await q.goto(BASE, { waitUntil: 'networkidle' });
  await write(q, '다른 탭에서 쓴 곳');
  await p.waitForFunction(() => document.querySelector('#feed').innerText.includes('다른 탭에서 쓴 곳'), null, { timeout: 3000 }).catch(() => {});
  const f = await p.locator('#feed').innerText();
  ok(f.includes('다른 탭에서 쓴 곳') && f.includes('저장 못 한 곳') && f.includes('파일로 받은 곳') && await p.locator('#storeWarn').isVisible(),
    '  └ 그사이 다른 탭이 저장해 다시 읽어도 못 담은 리포트는 이 탭에 남고, 경고도 그대로');
  await q.close();
  /* 자리가 나면(다른 앱이 비우면) 다음 저장에 다 담기고 경고가 걷힌다 */
  await p.evaluate(() => { window.__room = 0; });
  await write(p, '자리가 난 뒤 쓴 곳');
  ok(await p.locator('#storeWarn').isHidden(), '자리가 나서 저장되면 경고가 걷힌다');
  await p.reload({ waitUntil: 'networkidle' });
  const after = await p.evaluate(() => JSON.parse(localStorage.getItem('tpw.v1')).reports.map((r) => r.place));
  ok(['저장 못 한 곳', '파일로 받은 곳', '다른 탭에서 쓴 곳', '자리가 난 뒤 쓴 곳'].every((x) => after.includes(x)), '  └ 그때 못 담았던 것도 같이 담긴다');
  await c.close();
}

section('백업 파일은 통째로 돌아온다');
{
  const T = Date.now();
  const N = 650;   // 바쁜 동네 두 달치
  const rs = Array.from({ length: N }, (_, i) => report({ id: 'bk' + String(i).padStart(6, '0'), t: T - i * 2 * 3600e3,
    by: i % 3 ? '민지' : '나', place: '장소 ' + (i % 40), crowd: i % 4 }));
  const c = await context(b, PH);
  const p = await openWith(c, []);
  await p.locator('.tab[data-view="sync"]').click();
  const load = async (data) => {
    await p.evaluate(() => { const s = document.querySelector('#bundleStatus'); s.textContent = ''; s.className = 'status'; });
    await p.setInputFiles('#fileInput', { name: 'teukpawon.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
    await p.waitForSelector('#bundleStatus.ok, #bundleStatus.err');
    return p.locator('#bundleStatus').innerText();
  };
  const st = await load({ app: '동네 특파원', v: 1, reports: rs, watch: [] });
  const n = await p.evaluate(() => JSON.parse(localStorage.getItem('tpw.v1')).reports.length);
  ok(n === N && st.startsWith(N + '건을 불러왔습니다.') && !st.includes('건너뛰'), N + '건 백업이 ' + n + '건으로 돌아온다 — 링크 상한(400건)에서 잘리지 않는다: ' + st);
  /* 파일 상한을 넘으면 몇 건을 건너뛰었는지 말한다. 상한 안쪽 끝의 둘만 들어오고, 넘친 셋과 읽을 수 없는 줄은 건너뛴다 */
  const cap = await p.evaluate(() => MAX_FILE);
  const tail = Array.from({ length: 5 }, (_, i) => report({ id: 'cap' + i, t: T - i * MIN, place: '상한 ' + i }));
  const st2 = await load({ reports: Array.from({ length: cap - 2 }, () => ({})).concat(tail) });
  ok(cap > 400 && st2.startsWith('2건을 불러왔습니다.') && st2.includes((cap + 1) + '건은 건너뛰었습니다(한 번에 ' + cap + '건까지)'),
    '파일 상한(' + cap + '건)을 넘으면 건너뛴 수를 말한다: ' + st2);
  await c.close();
}

await finish(b);
