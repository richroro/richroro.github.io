/* 앱처럼 — 폰에선 바닥 탭바, 떠 있는 "리포트 보내기", 붙어 따라오는 칩 줄, 끌어 내려 닫는 시트.
   넓은 화면은 머리띠 안의 탭과 큰 단추 둘 그대로다. */
import { BASE, ok, section, launch, context, watch, openWith, report, finish, MIN, settle } from './lib.mjs';

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
  ok(await p.locator('#recvBtn').isVisible() && (await p.locator('#recvBtn').innerText()).trim() === '받은 링크',
    '"받은 링크"는 속보 머리의 작은 단추 (이름은 받은 링크 붙여넣기)');
  ok(await p.locator('#recvBtn').getAttribute('aria-label') === '받은 링크 붙여넣기', '  └ 보이는 글자가 이름 안에 들어 있다');
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
  ok(await p.locator('#statline').isHidden() && await p.locator('#recvBtn').isHidden() && await p.locator('#intro').isHidden(),
    '  └ 숫자 줄·받은 링크·처음 안내는 속보에만');
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
  await tab(p, 'places');
  await p.locator('#places .pl').first().click();
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

section('넓은 화면은 그대로 — 머리띠 안의 탭, 큰 단추 둘');
{
  const c = await context(b, { viewport: { width: 1000, height: 900 } });
  const p = watch(await c.newPage(), '넓은 화면');
  await p.goto(BASE, { waitUntil: 'networkidle' });
  ok(await css(p, '.tabs', 'position') !== 'fixed' && (await rect(p, '.tabs')).bottom <= (await rect(p, '.bar')).bottom, '탭은 머리띠 안에');
  ok(await p.locator('.tab .ti').first().isHidden(), '  └ 탭 아이콘은 안 쓴다');
  ok(await p.locator('#tab-feed .n').isVisible() && (await p.locator('#tab-feed .n').innerText()) === '8', '  └ 이름 옆에 건수가 보인다');
  ok(await css(p, '#writeBtn', 'position') === 'static', '"리포트 보내기"는 제자리의 큰 단추');
  ok((await p.locator('#recvBtn').innerText()).trim() === '받은 링크 붙여넣기', '"받은 링크 붙여넣기"도 글자까지');
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

await finish(b);
