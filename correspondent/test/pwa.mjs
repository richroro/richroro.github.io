/* 카톡 카드 · 홈 화면 설치 · 오프라인 · 폰 알림(서비스 워커) */
import { BASE, ok, section, launch, context, watch, openWith, report, finish, MIN } from './lib.mjs';

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
  const scope = await p.evaluate(async () => (await navigator.serviceWorker.ready).scope);
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
  await p.evaluate(async () => { await navigator.serviceWorker.ready; });
  const cdp = await c.newCDPSession(p);
  const regs = [];
  cdp.on('ServiceWorker.workerRegistrationUpdated', (e) => regs.push(...e.registrations));
  await cdp.send('ServiceWorker.enable');
  for (let i = 0; i < 20 && !regs.some((r) => r.scopeURL === BASE); i++) await p.waitForTimeout(100);
  const reg = regs.find((r) => r.scopeURL === BASE);
  ok(!!reg, '워커가 /correspondent/ 범위로 서 있다');
  const push = (data) => cdp.send('ServiceWorker.deliverPushMessage', { origin: new URL(BASE).origin, registrationId: reg.registrationId, data: JSON.stringify(data) });
  const shown = () => p.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications())
    .map((n) => ({ title: n.title, body: n.body, tag: n.tag, url: n.data && n.data.url })));
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

await finish(b);
