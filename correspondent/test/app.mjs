/* 앱처럼 — 폰에선 바닥 탭바, 떠 있는 "리포트 보내기", 붙어 따라오는 칩 줄, 끌어 내려 닫는 시트.
   넓은 화면은 머리띠 안의 탭과 큰 단추 둘 그대로다. */
import { BASE, ok, section, launch, context, watch, openWith, report, finish, MIN, settle, shareReady, bundleReady } from './lib.mjs';

const b = await launch();
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const rect = (p, sel) => p.locator(sel).first().evaluate((el) => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height, width: r.width }; });
const css = (p, sel, prop) => p.locator(sel).first().evaluate((el, pr) => getComputedStyle(el)[pr], prop);
const shown = (p, sel) => p.locator(sel).first().evaluate((el) => !!(el.offsetParent || getComputedStyle(el).position === 'fixed') && getComputedStyle(el).display !== 'none');
/* 손가락으로 조금씩 내리는 것처럼 — 스크롤 이벤트가 여러 번 나야 "내려 읽는 중"을 안다 */
async function scrollBy(p, dy, steps = 6) {
  for (let i = 0; i < steps; i++) {
    await p.evaluate((d) => window.scrollBy(0, d), dy / steps);
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  }
}
const tab = (p, v) => p.locator(`.tab[data-view="${v}"]`).click();

section('폰 뼈대 — 바닥 탭바와 떠 있는 단추');
{
  const c = await context(b, PHONE);
  const p = watch(await c.newPage(), '폰');
  await p.goto(BASE, { waitUntil: 'networkidle' });
  const vh = 844;
  ok(await css(p, '.tabs', 'position') === 'fixed', '탭은 화면 바닥에 붙은 탭바');
  const bar = await rect(p, '.tabs');
  ok(Math.abs(bar.bottom - vh) < 1 && bar.width >= 389, '  └ 폭 가득, 맨 아래 (' + Math.round(bar.top) + '~' + Math.round(bar.bottom) + ')');
  const barH = await p.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tabbar-h')));
  ok(Math.abs(bar.height - barH) < 1, '  └ 높이가 --tabbar-h(' + barH + 'px)와 같다 — 떠 있는 단추·알림이 이 값을 딛고 선다 (' + bar.height + ')');
  const tabs = await p.$$eval('.tab', (els) => els.map((e) => {
    const r = e.getBoundingClientRect(), svg = e.querySelector('.ti svg');
    return { h: r.height, icon: !!svg && svg.getBoundingClientRect().width > 16, label: e.querySelector('.tab-l').innerText };
  }));
  ok(tabs.length === 4 && tabs.every((t) => t.icon), '  └ 네 탭 모두 아이콘: ' + tabs.map((t) => t.label).join(' · '));
  ok(tabs.every((t) => t.h >= 44), '  └ 손가락으로 누를 만한 높이 (' + tabs.map((t) => Math.round(t.h)).join(', ') + 'px)');
  ok(await p.locator('#tab-feed .n').evaluate((el) => el.getBoundingClientRect().width <= 1 && el.textContent === '8'),
    '  └ 건수는 탭바에선 안 보이고 읽어 주기만 한다');

  ok(await css(p, '#writeBtn', 'position') === 'fixed', '"리포트 보내기"는 떠 있는 단추');
  const fab = await rect(p, '#writeBtn');
  ok(fab.bottom <= bar.top - 12 && Math.abs(fab.right - (390 - 16)) < 1 && fab.height >= 56,
    '  └ 탭바 위 오른쪽, 56px (오른쪽 ' + Math.round(fab.right) + ', 탭바와 ' + Math.round(bar.top - fab.bottom) + 'px 띄움, 높이 ' + fab.height + ')');
  const snap = await p.accessibility.snapshot({ root: await p.$('#writeBtn') });
  ok(snap && snap.name === '리포트 보내기', '  └ 이름은 "리포트 보내기": ' + (snap && snap.name));
  ok(await p.locator('#recvBtn').count() === 0 && await p.locator('#statline').isHidden(),
    '첫 화면엔 숫자 줄도 "받은 링크" 단추도 없다 — 붙여넣기는 주고받기 맨 위');
  const firstCard = await rect(p, '#feed .card');
  ok(firstCard.top < vh - 120, '  └ 내리지 않아도 첫 소식 카드가 보인다 (위에서 ' + Math.round(firstCard.top) + 'px)');
  ok(await p.locator('footer').isHidden(), '속보 화면엔 사이트 바닥글이 없다');

  const minW = await p.$$eval('.input', (els) => els.map((e) => parseFloat(getComputedStyle(e).fontSize)).reduce((a, x) => Math.min(a, x), 99));
  ok(minW >= 16, '입력칸 글자 16px 이상 — 아이폰이 눌렀을 때 확대하지 않는다 (가장 작은 칸 ' + minW + 'px)');
  ok(await p.locator('meta[name="viewport"]').getAttribute('content').then((v) => /viewport-fit=cover/.test(v)), '화면 끝(노치·홈 막대)까지 깐다: viewport-fit=cover');
  ok(await p.locator('meta[name="apple-mobile-web-app-status-bar-style"]').getAttribute('content') === 'black-translucent',
    '홈 화면 앱에선 상태 표시줄 밑까지 남색 머리띠');
  await c.close();
}

section('내려 읽기 — 단추는 아이콘만, 칩 줄과 시간대 머리는 붙어 따라온다');
{
  const c = await context(b, PHONE);
  const p = watch(await c.newPage(), '스크롤');
  await p.goto(BASE, { waitUntil: 'networkidle' });
  const labelW = () => p.locator('#writeBtn .fab-l').evaluate((el) => el.getBoundingClientRect().width);
  ok(await labelW() > 40, '처음엔 이름까지 펼쳐져 있다');
  await scrollBy(p, 900);
  ok(await p.locator('#writeBtn').evaluate((el) => el.classList.contains('mini')), '내려 읽으면 접힌다');
  await settle(p);
  ok(await labelW() < 1, '  └ 아이콘만 남는다');
  ok(await p.locator('.bar').evaluate((el) => el.classList.contains('lifted')), '  └ 머리띠엔 그림자');
  const head = await rect(p, '.bar');
  const chips = await rect(p, '#view-feed > .chiprow');
  ok(Math.abs(chips.top - head.bottom) < 1, '분야 칩 줄이 머리띠 바로 밑에 붙어 있다 (' + Math.round(chips.top) + ' = ' + Math.round(head.bottom) + ')');
  const stuck = await p.$$eval('#feed .tgroup', (els, top) => els.filter((e) => Math.abs(e.getBoundingClientRect().top - top) < 1.5).length, chips.bottom);
  ok(stuck >= 1, '  └ 시간대 머리는 그 밑에 붙는다');
  await scrollBy(p, -120, 4);
  ok(!(await p.locator('#writeBtn').evaluate((el) => el.classList.contains('mini'))), '조금 올리면 다시 펼친다');
  await c.close();
}

section('탭마다 제 것만, 읽던 자리는 기억한다');
{
  const c = await context(b, PHONE);
  const p = watch(await c.newPage(), '탭');
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.evaluate(() => window.scrollTo(0, 700));
  await tab(p, 'places');
  ok(await p.evaluate(() => window.scrollY) === 0, '처음 여는 장소 탭은 맨 위부터');
  ok(await p.locator('#writeBtn').isVisible(), '장소에서도 "리포트 보내기"');
  ok(await p.locator('#intro').isHidden(), '  └ 처음 안내는 속보에만');
  await p.evaluate(() => window.scrollTo(0, 250));
  await tab(p, 'feed');
  ok(await p.evaluate(() => window.scrollY) === 700, '속보로 돌아오면 읽던 자리 그대로 (700)');
  await tab(p, 'places');
  ok(await p.evaluate(() => window.scrollY) === 250, '장소도 제 자리 (250)');
  await tab(p, 'people');
  ok(await p.locator('#writeBtn').isHidden(), '특파원 탭엔 떠 있는 단추가 없다');
  await tab(p, 'sync');
  ok(await p.locator('#writeBtn').isHidden() && await p.locator('footer').isVisible(), '주고받기엔 단추 대신 앱 정보(약관·처리방침)');
  ok(await p.locator('footer a[href="privacy.html"]').isVisible() && await p.locator('footer a[href="terms.html"]').isVisible(), '  └ 처리방침·약관 링크가 보인다');
  await tab(p, 'feed');
  await tab(p, 'feed');   // 보고 있는 탭을 한 번 더
  await p.waitForFunction(() => window.scrollY === 0, null, { timeout: 3000 }).catch(() => {});
  ok(await p.evaluate(() => window.scrollY) === 0, '보고 있는 탭을 다시 누르면 맨 위로');
  for (const w of [360, 390]) {
    await p.setViewportSize({ width: w, height: 800 });
    const over = [];
    for (const v of ['feed', 'places', 'people', 'sync']) {
      await tab(p, v);
      over.push(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth));
    }
    ok(over.every((x) => x <= 0), w + 'px 네 탭 모두 가로 스크롤 없음 (' + over.join(', ') + ')');
  }
  await c.close();
}

section('시트 — 손잡이를 끌어 내리면 닫힌다');
{
  const c = await context(b, { viewport: { width: 390, height: 844 } });
  const p = watch(await c.newPage(), '시트');
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await tab(p, 'places');
  const opener = p.locator('#places .pl').first();
  await opener.click();
  await p.waitForSelector('#placeBack.open');
  await settle(p);
  const grab = await p.locator('#placeBack .sheet-head').evaluate((el) => {
    const s = getComputedStyle(el, '::before');
    return { content: s.content, w: parseFloat(s.width), h: parseFloat(s.height) };
  });
  ok(grab.content !== 'none' && grab.w >= 32 && grab.h >= 4, '머리 위에 손잡이 (' + grab.w + '×' + grab.h + ')');
  const h = await rect(p, '#placeBack .sheet-head');
  const x = 60, y = h.top + 12;
  await p.mouse.move(x, y); await p.mouse.down();
  await p.mouse.move(x, y + 20, { steps: 4 });
  const mid = await p.locator('#placeBack .sheet').evaluate((el) => el.style.transform);
  ok(/translateY\(20px\)/.test(mid), '끄는 동안 손가락을 따라 내려온다: ' + mid);
  await p.mouse.up();
  await p.waitForTimeout(300);
  ok(await p.locator('#placeBack.open').count() === 1, '조금만 끌었다 놓으면 그대로 열려 있다');
  ok(await p.locator('#placeBack .sheet').evaluate((el) => el.style.transform === ''), '  └ 제자리로 돌아간다');
  await p.mouse.move(x, y); await p.mouse.down();
  await p.mouse.move(x, y + 220, { steps: 10 });
  await p.mouse.up();
  await p.waitForSelector('#placeBack.open', { state: 'detached' }).catch(() => {});
  await p.waitForTimeout(300);
  ok(await p.locator('#placeBack.open').count() === 0, '끝까지 끌어 내리면 닫힌다');
  ok(await p.evaluate(() => !document.querySelector('main').inert && document.body.style.overflow === ''), '  └ 뒤가 다시 살아난다');
  ok(await p.evaluate(() => document.activeElement && document.activeElement.matches('#places .pl')), '  └ 초점은 열었던 장소로');
  /* 닫기 단추를 누른 건 끌기가 아니다 */
  await opener.click();
  await p.waitForSelector('#placeBack.open');
  await settle(p);
  await p.locator('#placeBack .sheet-head .x').click();
  ok(await p.locator('#placeBack.open').count() === 0, '닫기 단추는 그대로 닫기');
  await c.close();
}

section('뒤로 가기 — 시트만 닫고 앱은 그대로');
{
  const c = await context(b, PHONE);
  const p = watch(await c.newPage(), '뒤로');
  await p.goto(BASE, { waitUntil: 'networkidle' });
  const url = p.url();
  await p.locator('#writeBtn').click();
  await p.waitForSelector('#composeBack.open');
  await p.fill('#fPlace', '쓰다 만 곳');
  await p.goBack();
  await p.waitForSelector('#composeBack.open', { state: 'detached', timeout: 3000 }).catch(() => {});
  ok(await p.locator('#composeBack.open').count() === 0 && p.url() === url, '쓰는 중에 뒤로 가기(안드로이드 뒤로 단추)는 시트만 닫는다');
  ok(await p.locator('#writeBtn').isVisible(), '  └ 앱은 그대로 — 속보 화면');
  await p.locator('#feed [data-open]').first().click();   // 속보에서 연 시트 — 장소 탭에선 뒤로가 먼저 속보로 간다(아래 "폰의 탭")
  await p.waitForSelector('#placeBack.open');
  await p.keyboard.press('Escape');
  await p.goBack().catch(() => {});
  await p.waitForURL((u) => u.href !== url, { timeout: 3000 }).catch(() => {});
  ok(p.url() !== url, '닫기로 닫은 뒤의 뒤로 가기는 헛돌지 않는다 — 한 번에 앱을 떠난다 (' + p.url() + ')');
  await c.close();
}
{
  /* 시트를 열었다 닫은 뒤 링크(#r=)가 들어와도 뒤로 가기로 오해하지 않는다 */
  const c = await context(b, PHONE);
  const p = watch(await c.newPage(), '뒤로·링크');
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await tab(p, 'places');
  await p.locator('#places .pl').first().click();
  await p.waitForSelector('#placeBack.open');
  await p.keyboard.press('Escape');
  await p.evaluate(() => { location.hash = 'r=zz'; });
  await p.waitForTimeout(400);
  const st = await p.evaluate(() => JSON.stringify(history.state));
  ok(p.url().startsWith(BASE) && !/tpwSheet/.test(st), '시트를 닫은 뒤 링크가 들어와도 뒤로 물러나지 않는다 (지금 기록 ' + st + ')');
  await c.close();
}

section('뒤로 가기 — 폰의 탭은 먼저 속보로, 그다음에 앱을 떠난다');
{
  /* 뒤로 한 번 = 안드로이드 뒤로 단추 한 번. 앱이 빈 칸을 건너며 몇 걸음 더 물러날 수 있어서, 정해 둔 시간만 자지 않고
     닿을 곳에 닿기를 기다린 뒤 조금 더 지켜본다 — 느린 CI 러너에서도 같게. */
  const back = (p) => p.goBack().catch(() => {});
  const left = (p) => !p.url().startsWith(BASE);
  const at = async (p) => left(p) ? '떠남' : p.evaluate(() =>
    document.body.dataset.view + (document.querySelector('.backdrop.open') ? '+시트' : '')).catch(() => '떠남');
  /** 이 화면에 머무는가 — 닿기를 기다리고, 그 뒤로 더 물러나 앱을 떠나지 않는지 잠깐 본다 */
  const stays = async (p, want) => {
    await p.waitForFunction((w) => document.body.dataset.view + (document.querySelector('.backdrop.open') ? '+시트' : '') === w,
      want, { timeout: 3000 }).catch(() => {});
    await p.waitForTimeout(300);
    return await at(p) === want;
  };
  const leaves = async (p) => { await p.waitForURL((u) => !u.href.startsWith(BASE), { timeout: 3000 }).catch(() => {}); return left(p); };
  const scrollY = (p) => p.evaluate(() => window.scrollY).catch(() => -1);
  const fresh = async (opts, name) => {
    const c = await context(b, opts || PHONE);
    const p = watch(await c.newPage(), name);
    await p.goto(BASE, { waitUntil: 'networkidle' });
    return p;
  };
  {
    const p = await fresh(null, '탭 뒤로');
    await p.evaluate(() => window.scrollTo(0, 700));
    await tab(p, 'places');
    await back(p);
    ok(await stays(p, 'feed'), '장소에서 뒤로 — 앱을 떠나지 않고 속보로 (' + await at(p) + ')');
    ok(await scrollY(p) === 700, '  └ 속보는 읽던 자리 그대로 (700) — 브라우저가 옛 자리로 덮어쓰지 않는다');
    await back(p);
    ok(await leaves(p), '  └ 한 번 더 뒤로 — 그때 앱을 떠난다 (' + p.url() + ')');
    await p.context().close();
  }
  {
    const p = await fresh(null, '탭 여럿');
    const len0 = await p.evaluate(() => history.length);
    await tab(p, 'places'); await tab(p, 'people'); await tab(p, 'sync');
    const len1 = await p.evaluate(() => history.length);
    ok(len1 === len0 + 1, '탭을 여러 번 옮겨도 쌓이는 기록은 한 칸 (' + len0 + ' → ' + len1 + ')');
    await back(p);
    ok(await stays(p, 'feed'), '  └ 주고받기에서 뒤로 한 번 — 속보');
    await back(p);
    ok(await leaves(p), '  └ 그다음 뒤로 — 앱을 떠난다');
    await p.context().close();
  }
  {
    const p = await fresh(null, '속보 탭');
    await tab(p, 'places');
    await tab(p, 'feed');
    await p.waitForFunction(() => !history.state, null, { timeout: 3000 }).catch(() => {});
    ok(await p.evaluate(() => !history.state), '속보 탭을 누르면 쌓아 둔 칸을 걷는다 (지금 기록 ' + await p.evaluate(() => JSON.stringify(history.state)) + ')');
    await back(p);
    ok(await leaves(p), '  └ 그래서 속보에서 뒤로 한 번이면 앱을 떠난다 — 헛돌지 않는다');
    await p.context().close();
  }
  {
    const p = await fresh(null, '장소 창 뒤로');
    await tab(p, 'places');
    await p.locator('#places .pl').first().click();
    await p.waitForSelector('#placeBack.open');
    await back(p);
    ok(await stays(p, 'places'), '장소 탭에서 창을 연 채 뒤로 — 창만 닫히고 장소 그대로 (' + await at(p) + ')');
    await back(p);
    ok(await stays(p, 'feed'), '  └ 뒤로 — 속보');
    await back(p);
    ok(await leaves(p), '  └ 뒤로 — 앱을 떠난다');
    await p.context().close();
  }
  {
    const p = await fresh(null, '장소 창 닫기 뒤로');
    await tab(p, 'places');
    await p.locator('#places .pl').first().click();
    await p.waitForSelector('#placeBack.open');
    await p.keyboard.press('Escape');
    await back(p);
    ok(await stays(p, 'feed'), '장소 탭에서 창을 닫기로 닫은 뒤의 뒤로 — 헛돌지 않고 속보로 (' + await at(p) + ')');
    await back(p);
    ok(await leaves(p), '  └ 뒤로 — 앱을 떠난다');
    await p.context().close();
  }
  {
    const p = await fresh(null, '탭·링크');
    await tab(p, 'places');
    await p.evaluate(() => { location.hash = 'r=zz'; });
    await p.waitForTimeout(400);
    /* 링크가 들어오면 받은 것을 보여 주러 속보로 간다(받기 칸이 속보 맨 위에 있다) — 뒤로 가기로 오해해 물러나지는 않는다 */
    ok(await at(p) === 'feed' && p.url() === BASE + '#r=zz', '장소에서 링크(#r=)가 들어와도 뒤로 가기로 오해하지 않는다 — 주소 그대로, 받은 것을 보여 주러 속보로 (' + await at(p) + ')');
    await p.context().close();
  }
  {
    /* 카톡에서 링크로 새로 열고, 받기 전에 장소로 옮겨 가서 받은 뒤 속보로 — 받은 링크가 다시 뜨거나 뒤로가 헛돌지 않는다 */
    const p0 = await fresh(null, '링크 만들기');
    const code = await p0.evaluate(async () => pack([sane({ id: 'lk000001', t: Date.now() - 60e3, by: '하늘', cat: 'play', place: '받은 곳', crowd: 0 })]));
    await p0.context().close();
    const c = await context(b, PHONE);
    const p = watch(await c.newPage(), '링크 받고 뒤로');
    await p.goto(BASE + '#r=' + code, { waitUntil: 'networkidle' });
    await p.waitForSelector('#inboxYes');
    await tab(p, 'places');
    await p.locator('#inboxYes').click();
    /* 한 곳 소식을 받으면 그 장소 창이 열린다 — 닫기로 닫고 간다 */
    if (await p.locator('#placeBack.open').count()) await p.keyboard.press('Escape');
    await tab(p, 'feed');
    await back(p);
    ok(await leaves(p), '링크로 열어 받기 전에 장소로 옮겼다가 받고 속보로 — 뒤로 한 번이면 앱을 떠난다 (' +
      (left(p) ? p.url() : '남은 칸: ' + await p.locator('#inbox').innerText()) + ')');
    await c.close();
  }
  {
    /* 앞으로 가기로 빈 칸(닫힌 시트·걷힌 탭)에 다시 올라서도 그다음 뒤로가 헛돌지 않는다 */
    const p = await fresh(null, '앞으로');
    await p.locator('#feed [data-open]').first().click();
    await p.waitForSelector('#placeBack.open');
    await back(p);
    await stays(p, 'feed');
    await p.goForward().catch(() => {});
    ok(await stays(p, 'feed'), '시트를 뒤로로 닫고 앞으로 가기 — 시트는 다시 안 열린다 (' + await at(p) + ')');
    await back(p);
    ok(await leaves(p), '  └ 그다음 뒤로 — 헛돌지 않고 앱을 떠난다');
    await p.goto(BASE, { waitUntil: 'networkidle' });
    await tab(p, 'places');
    await back(p);
    await stays(p, 'feed');
    await p.goForward().catch(() => {});
    ok(await stays(p, 'feed'), '장소에서 뒤로(속보) 뒤 앞으로 가기 — 속보 그대로 (' + await at(p) + ')');
    await back(p);
    ok(await leaves(p), '  └ 그다음 뒤로 — 헛돌지 않고 앱을 떠난다');
    await p.context().close();
  }
  {
    const p = await fresh({ viewport: { width: 1000, height: 900 } }, '넓은 화면 뒤로');
    const len0 = await p.evaluate(() => history.length);
    await tab(p, 'places');
    ok(await p.evaluate(() => history.length) === len0 && await p.evaluate(() => !history.state), '넓은 화면의 머리띠 탭은 기록을 쌓지 않는다 — 예전 그대로');
    await back(p);
    ok(await leaves(p), '  └ 뒤로 — 앱을 떠난다 (예전 그대로)');
    await p.context().close();
  }
  {
    /* 쓰고 나면 속보 맨 위(방금 쓴 리포트). 공유 창을 뒤로로 닫아도 거기 그대로, 다른 탭에서 썼어도 뒤로가 헛돌지 않는다 */
    const board = Array.from({ length: 12 }, (_, i) =>
      report({ t: Date.now() - (i + 1) * 20 * MIN, by: '민지', place: '장소 ' + (i + 1), note: '메모 '.repeat(20) }));
    const write = async (p) => {
      await p.locator('#writeBtn').click();
      await p.waitForSelector('#composeBack.open');
      await p.fill('#fPlace', '방금 쓴 곳');
      await p.locator('#fCrowd [data-v="0"]').click();   // 장소 이름만으로는 안 나간다 — 하나는 고른다
      await p.locator('#composeGo').click();
      await p.waitForSelector('#shareBack.open');
    };
    let p = await openWith(await context(b, PHONE), board);
    await p.evaluate(() => window.scrollTo(0, 900));
    await write(p);
    await back(p);
    ok(await stays(p, 'feed') && await scrollY(p) === 0,
      '속보에서 쓰고 공유 창을 뒤로로 닫아도 맨 위 그대로 — 방금 쓴 리포트가 보인다 (' + await scrollY(p) + ')');
    await p.context().close();
    for (const how of ['뒤로', '닫기']) {
      p = await openWith(await context(b, PHONE), board);
      await tab(p, 'places');
      await write(p);
      if (how === '뒤로') {
        await back(p);
        ok(await stays(p, 'feed'), '장소에서 쓰고 공유 창을 뒤로로 닫으면 — 속보');
      } else await p.keyboard.press('Escape');
      await back(p);
      ok(await leaves(p), '  └ (' + how + '로 닫음) 속보에서 뒤로 — 남은 탭 칸이 헛돌지 않고 앱을 떠난다');
      await p.context().close();
    }
  }
  {
    /* 시트를 연 채 새로 고치면 시트는 닫혀 있다 — 그 뒤의 첫 뒤로가 헛돌면 안 된다 */
    for (const where of ['feed', 'places']) {
      const p = await fresh(null, '새로 고침 ' + where);
      if (where === 'feed') await p.locator('#feed [data-open]').first().click();
      else { await tab(p, 'places'); await p.locator('#places .pl').first().click(); }
      await p.waitForSelector('#placeBack.open');
      await p.reload({ waitUntil: 'networkidle' });
      const shut = await p.locator('.backdrop.open').count() === 0;
      await back(p);
      ok(shut && await leaves(p), (where === 'feed' ? '속보' : '장소') +
        '에서 시트를 연 채 새로 고친 뒤 — 뒤로 한 번에 앱을 떠난다, 헛돌지 않는다 (' + p.url() + ')');
      await p.context().close();
    }
  }
}

section('쓰고 나면 속보 맨 위 — 방금 쓴 리포트가 보이게');
{
  const c = await context(b, PHONE);
  const p = await openWith(c, Array.from({ length: 12 }, (_, i) =>
    report({ t: Date.now() - (i + 1) * 20 * MIN, by: '민지', place: '장소 ' + (i + 1), note: '메모 '.repeat(20) })));
  await p.evaluate(() => window.scrollTo(0, 900));
  await tab(p, 'places');
  await p.locator('#writeBtn').click();
  await p.waitForSelector('#composeBack.open');
  await p.fill('#fPlace', '방금 쓴 곳');
  await p.locator('#fCrowd [data-v="0"]').click();   // 장소 이름만으로는 안 보내진다(빈 카드) — 하나는 고른다
  await p.locator('#composeGo').click();
  await p.waitForSelector('#shareBack.open');
  await p.keyboard.press('Escape');
  ok(await p.evaluate(() => document.body.dataset.view) === 'feed' && await p.evaluate(() => window.scrollY) === 0,
    '장소 탭에서 써도 속보 맨 위로 (읽던 자리 900 이 아니라)');
  ok(await p.locator('#feed .card').first().innerText().then((t) => t.includes('방금 쓴 곳')), '  └ 맨 위 카드가 방금 쓴 것');
  await c.close();
}

section('배포 직후 옛 index.html 사본과 새 app.js 가 섞여도 멈추지 않는다');
{
  /* 옛 사본 = 이번에 새로 생긴 칸(예시 치우기 단추, 홈 화면에 추가, 속보 탭 숫자)이 없는 머리. 지금 것에서 떼어 만든다
     — git 기록에 기대면 CI 의 얕은 클론에서 조용히 건너뛴다. */
  const cur = await (await fetch(BASE)).text();
  const old = cur.replace(/<p class="tip-foot">[\s\S]*?<\/p>/, '')
    .replace(/<div class="panel" id="installPanel"[\s\S]*?id="installRow"[\s\S]*?<\/button>\s*<\/div>\s*<\/div>/, '')
    .replace(/<span class="tb" id="tbFeed" hidden><\/span>/, '');
  ok(!/id="dropSample"|id="installBtn"|id="installPanel"|id="tbFeed"/.test(old) && cur.length - old.length < 1200 &&
    /id="composeBack"/.test(old) && /<footer>/.test(old) && /id="bundleBtn"/.test(old),
    '옛 사본에는 새 칸 셋만 없다 (' + (cur.length - old.length) + '자 차이)');
  const c = await context(b, PHONE);
  await c.route((u) => u.pathname.endsWith('/correspondent/'), (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: old }));
  const p = watch(await c.newPage(), '옛 사본');
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(BASE, { waitUntil: 'networkidle' });
  ok(errs.length === 0 && await p.locator('#feed .card').count() === 8, '옛 머리 + 새 스크립트로도 예시 보드가 뜬다' + (errs.length ? ': ' + errs[0] : ''));
  await p.locator('.tab[data-view="places"]').click();
  ok(await p.locator('#places .pl').count() > 0 && await p.locator('#view-places').isVisible(), '  └ 탭도 바뀐다');
  await c.close();
}

section('넓은 화면은 그대로 — 머리띠 안의 탭, 큰 단추');
{
  const c = await context(b, { viewport: { width: 1000, height: 900 } });
  const p = watch(await c.newPage(), '넓은 화면');
  await p.goto(BASE, { waitUntil: 'networkidle' });
  ok(await css(p, '.tabs', 'position') !== 'fixed' && (await rect(p, '.tabs')).bottom <= (await rect(p, '.bar')).bottom, '탭은 머리띠 안에');
  ok(await p.locator('.tab .ti').first().isHidden(), '  └ 탭 아이콘은 안 쓴다');
  ok(await p.locator('#tab-feed .n').isVisible() && (await p.locator('#tab-feed .n').innerText()) === '8', '  └ 이름 옆에 건수가 보인다');
  ok(await css(p, '#writeBtn', 'position') === 'static', '"리포트 보내기"는 제자리의 큰 단추');
  ok(await p.locator('.actions .btn').count() === 1, '  └ 큰 단추는 하나 — 받은 링크 붙여넣기는 주고받기에');
  ok(await p.locator('footer').isVisible(), '바닥글이 보인다');
  await c.close();
}

section('속보 탭의 빨간 숫자 — 지켜보는 곳에 남이 올린 새 소식');
{
  const c = await context(b, PHONE);
  const T = Date.now();
  const p = await openWith(c, [
    report({ t: T - 10 * MIN, by: '민지', cat: 'play', place: '별빛 키즈카페', area: '안양 안양동', crowd: 1 }),
    report({ t: T - 40 * MIN, by: '준호', cat: 'play', place: '별빛 키즈카페', area: '안양 안양동', crowd: 2 }),
    report({ t: T - 30 * MIN, by: '서연', cat: 'food', place: '만안 손칼국수', wait: 10 })
  ], { watch: [{ k: '별빛키즈카페|안양동', nm: '별빛 키즈카페', ar: '안양 안양동', seen: T - 60 * MIN }] });
  ok(await p.locator('#tbFeed').isHidden(), '속보를 보는 동안엔 숨는다(맨 위 지켜보는 곳에 이미 보인다)');
  await tab(p, 'places');
  ok(await p.locator('#tbFeed').isVisible(), '다른 탭에 가면 속보 탭에 빨간 숫자');
  const seen = await p.locator('#tbFeed').evaluate((el) => el.lastChild.textContent);
  ok(seen === '2', '  └ 보이는 숫자는 안 본 새 소식 2건: ' + seen);
  const name = await p.locator('#tab-feed').evaluate((el) => el.textContent.replace(/\s+/g, ' ').trim());
  ok(/지켜보는 곳 새 소식 2/.test(name), '  └ 읽어 주는 이름에도: ' + name);
  await p.locator('#places .pl', { hasText: '별빛 키즈카페' }).click();
  await p.waitForSelector('#placeBack.open');
  await p.keyboard.press('Escape');
  ok(await p.locator('#tbFeed').isHidden(), '장소 창을 열어 보면 사라진다');
  await c.close();
}

section('쓰기 창 — 꼭 필요한 것만 위에');
{
  const c = await context(b, PHONE);
  const p = watch(await c.newPage(), '쓰기');
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.locator('#writeBtn').click();
  await p.waitForSelector('#composeBack.open');
  await settle(p);
  const labels = await p.$$eval('#composeForm .now-l', (els) => els.map((e) => e.textContent));
  ok(labels.join() === '웨이팅,사람,주차', '"지금 어때요?" 한 곳에 세 줄: ' + labels.join(' · '));
  const chips = await p.$$eval('#fWait [data-v], #fCrowd [data-v], #fPark [data-v]', (els) => els.map((e) => e.textContent));
  ok(!chips.includes('모름') && chips.length === 12, '"모름" 칩이 없다 — 안 고른 게 모름 (' + chips.length + '개)');
  ok(await p.locator('#fWait [aria-pressed="true"]').count() === 0, '  └ 처음엔 아무것도 안 눌려 있다');
  await p.locator('#fCrowd [data-v="2"]').click();
  ok(await p.getAttribute('#fCrowd [data-v="2"]', 'aria-pressed') === 'true', '누르면 고른다');
  await p.locator('#fCrowd [data-v="2"]').click();
  ok(await p.locator('#fCrowd [aria-pressed="true"]').count() === 0, '  └ 한 번 더 누르면 비운다(= 모름)');
  await p.locator('#fCat [data-v="food"]').click();
  await p.locator('#fCat [data-v="food"]').click();
  ok(await p.getAttribute('#fCat [data-v="food"]', 'aria-pressed') === 'true', '  └ 분야는 다시 눌러도 그대로 하나');
  ok(!(await p.locator('#fMore').evaluate((d) => d.open)) && await p.locator('#fArea').isHidden() && await p.locator('#fTags').isHidden(),
    '동네·별점·태그는 "더 적기" 안에 접혀 있다');
  ok(await p.locator('#fBy').isVisible(), '이름을 아직 안 정했으면 이름 칸이 위에 보인다');
  ok(await p.locator('#composeBack .sheet-foot .btn').count() === 1 &&
     (await p.locator('#composeGo').innerText()).trim() === '보내기', '아래 단추는 "보내기" 하나');
  ok(await p.evaluate(() => document.querySelector('#composeForm').scrollHeight) < 1000,
    '  └ 창 길이가 짧아졌다 (' + await p.evaluate(() => document.querySelector('#composeForm').scrollHeight) + 'px)');
  await p.fill('#fPlace', '비워 둔 칸 확인');
  await p.fill('#fBy', '하늘');
  await p.locator('#fWait [data-v="10"]').click();
  await p.locator('#composeGo').click();
  await p.waitForSelector('#shareBack.open');
  await p.keyboard.press('Escape');
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('tpw.v1')).reports[0]);
  ok(saved.wait === 10 && saved.crowd === -1 && saved.park === -1 && saved.cat === 'food', '비운 칸은 모름으로 저장된다');
  /* 이름을 정한 뒤로는 이름 칸이 "더 적기" 안으로 들어간다 */
  await p.locator('#writeBtn').click();
  await p.waitForSelector('#composeBack.open');
  ok(await p.locator('#fBy').isHidden() && await p.inputValue('#fBy') === '하늘', '이름을 정했으면 이름 칸은 "더 적기" 안에 (값은 그대로)');
  ok((await p.locator('#fMoreHint').innerText()).includes('이름'), '  └ "더 적기" 옆에 이름도 있다고 적힌다');
  await p.locator('#fMore summary').click();
  ok(await p.locator('#fBy').isVisible() && await p.locator('#fArea').isVisible(), '  └ 펼치면 동네·이름이 보인다');
  await c.close();
}

section('공유 창 — 폰에선 "공유하기"가 먼저');
{
  const c = await context(b, PHONE);
  await c.addInitScript(() => { navigator.share = (d) => { window.__shared = d; return Promise.resolve(); }; });
  const p = await openWith(c, [report({ t: Date.now() - 5 * MIN, by: '민지', cat: 'play', place: '별빛 키즈카페', crowd: 0 })]);
  await p.locator('#feed [data-share]').first().click();
  await p.waitForSelector('#shareBack.open');
  await p.waitForFunction(() => !document.querySelector('#shareBox').value.includes('만드는 중'));
  const order = await p.$$eval('#shareBack .sheet-foot .btn:not([hidden])', (els) => els.map((e) => e.textContent.trim() + (e.classList.contains('primary') ? '*' : '')));
  ok(order[0] === '공유하기*' && order[1] === '복사', '폰에선 "공유하기"(카톡 고르기)가 앞, 복사는 뒤: ' + order.join(' · '));
  await p.locator('#shareNative').click();
  ok(await p.evaluate(() => window.__shared && /눌러서 보기 → http/.test(window.__shared.text)), '  └ 누르면 폰의 공유 창에 글이 간다');
  await c.close();
}

section('좁은 창에 마우스 — 탭 글자가 사라지지 않는다');
{
  const c = await context(b, { viewport: { width: 390, height: 844 } });
  const p = watch(await c.newPage(), '마우스');
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await p.locator('#tab-people').hover();
  const col = await p.locator('#tab-people').evaluate((el) => [getComputedStyle(el).color, getComputedStyle(el.parentElement).backgroundColor]);
  ok(col[0] !== col[1] && col[0] !== 'rgb(255, 255, 255)', '마우스를 올려도 탭 글자색이 탭바 바탕과 다르다 (' + col.join(' on ') + ')');
  await c.close();
}

section('홈 화면에 추가');
{
  const c = await context(b, PHONE);
  const p = watch(await c.newPage(), '설치');
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await tab(p, 'sync');
  ok(await p.locator('#installPanel').isHidden(), '브라우저가 설치를 못 하면 숨어 있다');
  await p.evaluate(() => {
    const e = new Event('beforeinstallprompt');
    e.prompt = () => { window.__prompted = (window.__prompted || 0) + 1; return Promise.resolve(); };
    window.dispatchEvent(e);
  });
  ok(await p.locator('#installPanel').isVisible() && await p.locator('#installBtn').isVisible(), '크롬이 설치할 수 있다고 하면 "홈 화면에 추가" 단추');
  await p.locator('#installBtn').click();
  ok(await p.evaluate(() => window.__prompted) === 1, '  └ 누르면 크롬의 설치 창을 띄운다');
  ok(await p.locator('#installBtn').isHidden(), '  └ 한 번 쓴 안내는 다시 못 띄우니 단추를 거둔다');
  await p.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
  ok((await p.locator('#toast').innerText()).includes('홈 화면에 추가했습니다'), '설치되면 알린다');
  await c.close();

  for (const [nm, ua, re] of [
    ['아이폰 사파리', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1', /공유 단추.*홈 화면에 추가/],
    ['카톡 안의 브라우저', 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36 KAKAOTALK 10.8.0', /다른 브라우저로 열기/]
  ]) {
    const ci = await context(b, Object.assign({}, PHONE, { userAgent: ua }));
    const pi = watch(await ci.newPage(), nm);
    await pi.goto(BASE, { waitUntil: 'networkidle' });
    await tab(pi, 'sync');
    const note = await pi.locator('#installNote').innerText();
    ok(await pi.locator('#installPanel').isVisible() && re.test(note) && await pi.locator('#installBtn').isHidden(), nm + ': ' + note);
    await ci.close();
  }
}

section('움직임을 줄이라고 한 기기');
{
  const c = await context(b, Object.assign({}, PHONE, { reducedMotion: 'reduce' }));
  const p = watch(await c.newPage(), '움직임');
  await p.goto(BASE, { waitUntil: 'networkidle' });
  await tab(p, 'places');
  ok(await css(p, '#view-places', 'animationName') === 'none', '화면이 떠오르지 않는다');
  await p.locator('#places .pl').first().click();
  await p.waitForSelector('#placeBack.open');
  ok(await css(p, '#placeBack .sheet', 'animationName') === 'none', '시트도 그 자리에 바로 뜬다');
  await c.close();
}

/* ─────────── 보내기 — 저장된 것은 보낸 것이 아니다 ───────────
   공용 보드가 없으면 리포트는 링크를 건네야 남에게 간다. 쓰고 나서 창을 닫으면 아무에게도 안 간 채로 끝나는데,
   예전엔 그걸 알 길이 없었다. 쓴 사람이 알게 하고, 보냈는지는 이 기기에만 기억한다(링크에는 안 싣는다). */
const ORIGIN = new URL(BASE).origin;
/* 알림(#toast)에 뜬 글을 차례로 모은다 — 앞 알림이 아직 떠 있어도 새로 뜬 것만 가려 볼 수 있게 */
const toastLog = (p) => p.evaluate(() => {
  window.__toasts = [];
  const t = document.querySelector('#toast');
  new MutationObserver(() => { if (!t.hidden && t.textContent) window.__toasts.push(t.textContent); })
    .observe(t, { childList: true, characterData: true, subtree: true, attributes: true });
});
const toasts = (p) => p.evaluate(() => window.__toasts.slice());
/* 링크(#r=)에 실린 줄을 앱의 코드를 빌리지 않고 푼다 — 무엇이 실려 나가는지 그대로 본다 */
const rowsOf = (p, text) => p.evaluate(async (code) => {
  const s = atob(code.slice(1).replace(/-/g, '+').replace(/_/g, '/'));
  let bytes = Uint8Array.from(s, (ch) => ch.charCodeAt(0));
  if (code[0] === '2') bytes = new Uint8Array(await new Response(new Blob([bytes]).stream()
    .pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
  return JSON.parse(new TextDecoder().decode(bytes));
}, text.match(/#r=([A-Za-z0-9_-]+)/)[1]);
const unsent = (p) => p.locator('#feed .card').first().locator('.badge', { hasText: '안 보냄' });
const stored = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('tpw.v1')).reports);
async function write(p, place) {
  await p.locator('#writeBtn').click();
  await p.waitForSelector('#composeBack.open');
  await p.fill('#fPlace', place);
  await p.locator('#fCrowd [data-v="1"]').click();
  await p.locator('#composeGo').click();
  return shareReady(p);
}
async function copyAndClose(p) {
  await p.locator('#shareCopy').click();
  await p.waitForSelector('#shareStatus.ok, #shareStatus.err');
  const st = await p.locator('#shareStatus').innerText();
  await p.keyboard.press('Escape');
  return st;
}

section('쓰고 나서 — 저장은 보낸 게 아니다');
{
  const c = await context(b, PHONE);
  await c.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN });
  const p = watch(await c.newPage(), '보내기');
  await p.goto(BASE, { waitUntil: 'networkidle' });   // 예시 보드 — 이게 첫 리포트다
  await toastLog(p);
  await p.locator('#writeBtn').click();
  await p.waitForSelector('#composeBack.open');
  await p.fill('#fPlace', '해피 키즈룸');
  await p.locator('#fCrowd [data-v="1"]').click();
  ok((await p.locator('#fCrowd [data-v="1"]').innerText()).trim() === '보통', '쓰기 창의 "사람" 줄 단추는 그대로 "보통"');
  await p.locator('#composeGo').click();
  const text = await shareReady(p);
  const title = await p.locator('#shareTitle').innerText(), note = await p.locator('#shareNote').innerText();
  ok(title === '아직 이 폰에만 있어요', '방금 쓴 글의 공유 창: "' + title + '"');
  ok(note.startsWith('아래 글을 단톡방에 보내면'), '  └ 단톡방에 보내는 게 마지막 단계: ' + note);
  ok(await unsent(p).count() === 1, '  └ 뒤에 깔린 내 카드엔 "안 보냄"');
  await p.waitForFunction(() => window.__toasts.some((t) => t.includes('예시')), null, { timeout: 3000 }).catch(() => {});
  const first = (await toasts(p)).find((t) => t.includes('예시')) || '';
  ok(first === '예시를 치웠습니다. 이제 내 리포트와 받은 리포트만 보입니다.', '첫 리포트 알림은 "올라갔다"처럼 들리지 않는다: ' + first);
  ok(/^사람 보통 {2}\(/m.test(text), '공유글: 사람만 고르면 "사람 보통" — "보통"만으로는 무엇이 보통인지 모른다');
  ok(/\n눌러서 보기 → http\S+#r=[\w-]+$/.test(text) && !text.includes('받기'),
    '  └ 끝줄은 "눌러서 보기 → 링크": ' + text.split('\n').pop().slice(0, 30) + '…');
  const rows1 = await rowsOf(p, text);

  await p.keyboard.press('Escape');
  const closed = await p.locator('#toast').innerText();
  ok(closed.includes('안 보냈') && closed.includes('공유'), '안 보내고 닫으면 짚어 준다: ' + closed);
  ok(await unsent(p).isVisible(), '  └ 카드에 "안 보냄"이 남는다');
  ok((await stored(p))[0].sh === false, '  └ 이 기기에는 안 보낸 글로 저장된다 (sh:false)');

  await p.locator('#feed .card').first().locator('[data-share]').click();
  await shareReady(p);
  ok(await p.locator('#shareTitle').innerText() === '보낼 준비가 됐습니다' &&
     (await p.locator('#shareNote').innerText()).startsWith('카톡 단톡방에 보내면'), '카드에서 나중에 연 공유 창은 원래 문구 그대로');
  const n0 = (await toasts(p)).length;
  await p.keyboard.press('Escape');
  ok(!(await toasts(p)).slice(n0).some((t) => t.includes('안 보냈')), '  └ 거기서 그냥 닫으면 짚지 않는다 (카드의 "안 보냄"으로 충분하다)');

  await p.locator('#feed .card').first().locator('[data-share]').click();
  const again = await shareReady(p);
  const st = await copyAndClose(p);
  ok(st.startsWith('복사했습니다') && await p.evaluate(() => navigator.clipboard.readText()) === again, '복사하면 글이 그대로 클립보드에');
  ok(await unsent(p).count() === 0 && (await stored(p))[0].sh === true, '  └ "안 보냄"이 사라지고, 보낸 것을 이 기기에 기억한다');
  await p.reload({ waitUntil: 'networkidle' });
  ok(await p.locator('#feed .card').count() === 1 && await unsent(p).count() === 0, '다시 열어도 "안 보냄"은 없다');
  await p.locator('#feed .card').first().locator('[data-share]').click();
  const rows2 = await rowsOf(p, await shareReady(p));
  ok(rows1.length === 1 && rows1[0].length === 12 && JSON.stringify(rows2) === JSON.stringify(rows1),
    '링크에 실리는 건 보낸 뒤에도 같은 12칸 — "보냈다"는 표시는 링크에 안 실린다');
  await p.keyboard.press('Escape');

  await write(p, '묶어 보낼 곳');
  await p.keyboard.press('Escape');
  ok(await unsent(p).count() === 1, '새로 쓰고 안 보낸 글엔 다시 "안 보냄"');
  await tab(p, 'sync');
  await p.locator('#bundleBtn').click();
  await bundleReady(p);
  const bundle = await p.inputValue('#bundleBox');
  ok(/^📡 특파원 리포트 2건/.test(bundle) && /\n눌러서 보기 → http\S+#r=[\w-]+$/.test(bundle) && bundle.includes('— 사람 보통'),
    '묶음 글도 "사람 보통", 끝줄 "눌러서 보기 →"');
  await p.locator('#bundleCopy').click();
  await p.waitForFunction(() => /복사/.test(document.querySelector('#bundleStatus').textContent), null, { timeout: 3000 }).catch(() => {});
  await tab(p, 'feed');
  ok(await p.locator('#feed .badge', { hasText: '안 보냄' }).count() === 0, '  └ 묶음으로 복사해도 보낸 것 — "안 보냄"이 사라진다');
  await c.close();

  /* 예전에 퍼진 글은 끝줄이 "받기 →" 다. 받는 쪽은 #r= 만 찾으니 그대로 받아져야 한다 */
  const c2 = await context(b, PHONE);
  const q = watch(await c2.newPage(), '예전 글');
  await q.goto(BASE, { waitUntil: 'networkidle' });
  await tab(q, 'sync');
  await q.fill('#recvBox', text.replace('눌러서 보기 →', '받기 →'));
  await q.locator('#recvGo').click();
  await q.waitForFunction(() => /받았습니다|못했습니다/.test(document.querySelector('#recvStatus').textContent), null, { timeout: 3000 }).catch(() => {});
  const got = await q.evaluate(() => (JSON.parse(localStorage.getItem('tpw.v1') || '{}').reports || []).map((r) => r.id));
  ok(got.length === 1 && got[0] === rows1[0][0], '예전 글("받기 → 링크")도 주고받기 칸에 붙여 넣으면 받아진다');
  await tab(q, 'feed');
  ok(await q.locator('#feed .card').count() === 1 && await q.locator('#feed .badge', { hasText: '안 보냄' }).count() === 0,
    '  └ 받은 글은 내 글이 아니라 "안 보냄"이 없다');
  await c2.close();

  /* 이 표시가 생기기 전에 쓴 내 글(sh 가 없다)은 보낸 것으로 친다 — 업데이트했다고 옛 카드마다 "안 보냄"이 붙지 않게 */
  const c3 = await context(b, PHONE);
  const o = await openWith(c3, [report({ t: Date.now() - 2 * 60 * MIN, by: '나', place: '예전에 쓴 곳', crowd: 0, mine: true })]);
  ok(await o.locator('#feed .card').count() === 1 && await o.locator('#feed .badge', { hasText: '안 보냄' }).count() === 0,
    '이 표시가 생기기 전에 쓴 내 글엔 "안 보냄"을 달지 않는다');
  await c3.close();
}

section('폰의 공유 창으로 넘기면 — 창을 닫고, 보냈다고는 하지 않는다');
{
  const c = await context(b, PHONE);
  await c.addInitScript(() => {
    window.__shares = 0;
    navigator.share = () => { window.__shares++; return window.__cancel ? Promise.reject(new DOMException('취소', 'AbortError')) : Promise.resolve(); };
  });
  const p = await openWith(c, [report({ t: Date.now() - 30 * MIN, by: '민지', place: '앞서 받은 곳', crowd: 0 })]);
  await toastLog(p);
  await write(p, '구름 놀이터');
  await p.evaluate(() => { window.__cancel = true; });
  await p.locator('#shareNative').click();
  await p.waitForFunction(() => window.__shares === 1);
  await p.waitForTimeout(150);
  ok(await p.locator('#shareBack.open').count() === 1 && await unsent(p).count() === 1, '공유 창에서 취소하면 그대로 — 보낸 것으로 치지 않는다');
  await p.evaluate(() => { window.__cancel = false; });
  await p.locator('#shareNative').click();
  await p.waitForSelector('#shareBack.open', { state: 'detached', timeout: 3000 }).catch(() => {});
  const ts = await toasts(p);
  ok(await p.locator('#shareBack.open').count() === 0 && ts[ts.length - 1] === '공유 창으로 넘겼습니다.',
    '넘기고 나면 공유 창을 닫고 알린다: ' + ts[ts.length - 1]);
  ok(!ts.some((t) => /안 보냈|보냈습니다/.test(t)), '  └ "보냈다"고도 "안 보냈다"고도 하지 않는다 (카톡에서 취소했을 수도 있다)');
  ok(await unsent(p).count() === 0 && (await stored(p))[0].sh === true, '  └ 카드의 "안 보냄"은 사라지고 이 기기에 기억한다');
  await c.close();
}

section('공용 보드를 켜면 — 쓴 글은 보드로 가니 원래 문구 그대로');
{
  /* 가짜 보드: 설정만 채우고 요청은 빈 목록으로 답한다. 서비스 워커가 설정 파일을 가로채지 않게 막는다 */
  const c = await context(b, Object.assign({}, PHONE, { serviceWorkers: 'block' }));
  await c.route(/\/correspondent\/config\.js/, (r) => r.fulfill({ contentType: 'application/javascript',
    body: 'window.TPW_CONFIG = { url: "' + ORIGIN + '/fakeboard", anonKey: "test" };' }));
  await c.route(/\/fakeboard\//, (r) => r.fulfill({ contentType: 'application/json', body: '[]' }));
  const p = await openWith(c, [report({ t: Date.now() - 30 * MIN, by: '민지', place: '앞서 받은 곳', crowd: 0 })]);
  ok(await p.evaluate(() => !!(window.TPW_SYNC && window.TPW_SYNC.enabled)), '(공용 보드를 켠 채로 연다)');
  await toastLog(p);
  await write(p, '보드에 쓴 곳');
  ok(await p.locator('#shareTitle').innerText() === '보낼 준비가 됐습니다', '방금 쓴 글이어도 공유 창 제목은 원래대로');
  ok(await unsent(p).count() === 0, '  └ 카드에 "안 보냄"을 달지 않는다');
  await p.keyboard.press('Escape');
  ok(!(await toasts(p)).some((t) => t.includes('안 보냈')), '  └ 닫아도 "안 보냈어요"라고 하지 않는다');
  await c.close();
}

section('장소 창 바닥 — 카드와 같은 이름, 360px 에서도 한 줄');
{
  const c = await context(b, Object.assign({}, PHONE, { viewport: { width: 360, height: 780 } }));
  const p = await openWith(c, [report({ t: Date.now() - 10 * MIN, by: '민지', cat: 'play', place: '별빛 키즈카페', crowd: 1 })]);
  const cardAgain = (await p.locator('#feed .card [data-again]').first().innerText()).trim();
  await tab(p, 'places');
  await p.locator('#places .pl').first().click();
  await p.waitForSelector('#placeBack.open');
  await settle(p);
  const btns = await p.$$eval('#placeBack .sheet-foot .btn', (els) => els.filter((e) => !e.hidden)
    .map((e) => ({ t: e.textContent.trim(), h: Math.round(e.getBoundingClientRect().height), wb: getComputedStyle(e).wordBreak })));
  ok(btns.map((x) => x.t).join(' · ') === cardAgain + ' · 공유 · 닫기', '카드와 같은 이름: ' + btns.map((x) => x.t).join(' · '));
  ok(btns.every((x) => x.h <= 56), '  └ 셋 다 한 줄 (' + btns.map((x) => x.h).join(', ') + 'px)');
  ok(btns.every((x) => x.wb === 'keep-all'), '  └ 넘치더라도 낱말 가운데서 꺾지 않는다 (keep-all)');
  await c.close();

  const c2 = await context(b, PHONE);
  const q = watch(await c2.newPage(), '예시 장소 창');
  await q.goto(BASE, { waitUntil: 'networkidle' });
  await tab(q, 'places');
  await q.locator('#places .pl').first().click();
  await q.waitForSelector('#placeBack.open');
  const shownBtns = await q.$$eval('#placeBack .sheet-foot .btn', (els) => els.filter((e) => e.offsetParent).map((e) => e.textContent.trim()));
  ok(shownBtns.join() === '닫기', '예시 장소 창엔 "공유"도 없다 — 눌러 봐야 안 되는 단추는 두지 않는다 (' + shownBtns.join() + ')');
  await c2.close();
}

section('처음 보낸 뒤 한 번 — 홈 화면에 추가 권하기');
{
  const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const KAKAO = 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36 KAKAOTALK 10.8.0';
  const open = async (ua, init) => {
    const c = await context(b, Object.assign({}, PHONE, { userAgent: ua }));
    await c.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN });
    if (init) await c.addInitScript(init);
    return openWith(c, [report({ t: Date.now() - 30 * MIN, by: '민지', place: '앞서 받은 곳', crowd: 0 })]);
  };
  const cardShare = async (p) => { await p.locator('#feed .card').first().locator('[data-share]').click(); await shareReady(p); return copyAndClose(p); };

  const p = await open(IOS);
  await toastLog(p);
  ok(await p.locator('#homeTip').isHidden(), '보내기 전엔 없다');
  await write(p, '처음 보내는 곳');
  ok(await p.locator('#homeTip').isHidden(), '  └ 써 놓기만 해서는 안 뜬다');
  await copyAndClose(p);
  const tip = (await p.locator('#homeTip').innerText()).replace(/\s+/g, ' ');
  ok(await p.locator('#homeTip').isVisible() && tip.includes('다음에도 바로 열리게 홈 화면에 추가하세요'), '처음 보내고 나면 한 번 권한다: ' + tip);
  ok(!(await toasts(p)).some((t) => t.includes('안 보냈')) && await unsent(p).count() === 0,
    '  └ 방금 쓴 글을 복사하고 닫으면 "안 보냈어요"도 "안 보냄"도 없다');
  await p.locator('#homeTipX').click({ timeout: 3000 }).catch(() => {});   // 안 떴으면 위에서 이미 떨어졌다
  ok(await p.locator('#homeTip').isHidden(), '"닫기"로 치운다');
  await cardShare(p);
  ok(await p.locator('#homeTip').isHidden(), '  └ 다음에 보낼 땐 다시 안 뜬다');
  await p.reload({ waitUntil: 'networkidle' });
  await cardShare(p);
  ok(await p.locator('#homeTip').isHidden(), '  └ 다시 열어도 안 뜬다 (이 기기에 기억한다)');
  await p.context().close();

  const q = await open(IOS);
  await write(q, '방법 보러 갈 곳');
  await copyAndClose(q);
  await q.locator('#homeTipGo').click({ timeout: 3000 }).catch(() => {});
  const where = await q.evaluate(() => {
    const r = document.querySelector('#installPanel').getBoundingClientRect();
    return { view: document.body.dataset.view, inView: r.top >= 0 && r.bottom <= innerHeight, focus: document.activeElement.id };
  });
  ok(where.view === 'sync' && where.inView && where.focus === 'installPanel' && await q.locator('#installPanel').isVisible() &&
     await q.locator('#homeTip').isHidden(), '"방법 보기"는 주고받기의 "홈 화면에 추가" 안내로 데려간다 (' + JSON.stringify(where) + ')');
  await q.context().close();

  for (const [nm, ua, init] of [['카톡 안의 브라우저', KAKAO, null],
    ['이미 홈 화면 앱', IOS, () => Object.defineProperty(navigator, 'standalone', { get: () => true })]]) {
    const r = await open(ua, init);
    await write(r, '보내 볼 곳');
    await copyAndClose(r);
    ok(await r.locator('#homeTip').isHidden() && await unsent(r).count() === 0, nm + '에선 권하지 않는다 (보내기는 된다)');
    await r.context().close();
  }
}

await finish(b);
