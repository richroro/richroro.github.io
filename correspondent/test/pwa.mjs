/* 카톡 카드 · 홈 화면 설치 · 오프라인 */
import { BASE, ok, section, launch, context, watch, finish } from './lib.mjs';

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

section('주소창 색이 테마를 따라간다');
{
  const c = await context(b, { colorScheme: 'light' });
  const p = watch(await c.newPage());
  await p.goto(BASE, { waitUntil: 'networkidle' });
  const tc = () => p.evaluate(() => Array.from(document.querySelectorAll('meta[name="theme-color"]')).map((m) => m.content).join(','));
  ok(await tc() === '#FFFFFF,#181B1E', '자동: 밝게·어둡게 각각 ' + await tc());
  await p.locator('#themeBtn').click();   // 자동 → 밝게
  await p.locator('#themeBtn').click();   // 밝게 → 어둡게
  ok(await tc() === '#181B1E,#181B1E', '어둡게를 고르면 둘 다 어두운 색');
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

await finish(b);
