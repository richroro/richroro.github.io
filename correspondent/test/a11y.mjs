/* 접근성 — axe-core 로 재고, 키보드로 직접 눌러 본다. (지켜보는 곳·같게 봤다·보통은 표 포함) */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { BASE, ok, section, launch, context, watch, openWith, report, finish, MIN, shareReady, bundleReady, settle } from './lib.mjs';

const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];

async function axe(p, where) {
  /* 앱은 CSP 로 인라인 스크립트를 막는다(script-src 'self'). addScriptTag 는 인라인 <script> 를 꽂아서
     막히고, evaluate 는 개발자 도구 쪽 길이라 CSP 를 거치지 않는다. axe 가 글꼴 CSS 를 읽으려다
     connect-src 에 막히는 건 axe 사정이다 — 앱은 그 CSS 를 <link> 로 받고, 그건 허용돼 있다. */
  await settle(p);
  await p.evaluate(AXE);
  const v = await p.evaluate(async (tags) => (await window.axe.run(document, { runOnly: { type: 'tag', values: tags } }))
    .violations.map((x) => x.id + '(' + x.nodes.length + '): ' + x.nodes[0].target.join(' ')), TAGS);
  ok(v.length === 0, where + (v.length ? ' — ' + v.join(' | ') : ''));
}

const b = await launch();

for (const scheme of ['light', 'dark']) {
  section('axe · ' + (scheme === 'light' ? '밝게' : '어둡게'));
  const c = await context(b, { colorScheme: scheme, viewport: { width: 390, height: 844 } });
  const p = watch(await c.newPage(), scheme);
  await p.goto(BASE, { waitUntil: 'networkidle' });   // 예시 보드 — 흐려진 옛 정보까지 들어 있다
  await axe(p, '속보');
  for (const [v, nm] of [['places', '장소'], ['people', '특파원'], ['sync', '주고받기']]) {
    await p.locator(`.tab[data-view="${v}"]`).click();
    await axe(p, nm);
  }
  await p.locator('.tab[data-view="feed"]').click();
  await p.locator('#writeBtn').click(); await p.waitForSelector('#composeBack.open');
  await axe(p, '쓰기 창');
  await p.keyboard.press('Escape');
  await p.locator('.tab[data-view="places"]').click();
  await p.locator('#places .pl').first().click(); await p.waitForSelector('#placeBack.open');
  await axe(p, '장소 창');
  await p.keyboard.press('Escape');
  await p.goto(new URL('privacy.html', BASE).href, { waitUntil: 'networkidle' });
  await axe(p, '개인정보처리방침');
  await p.goto(new URL('terms.html', BASE).href, { waitUntil: 'networkidle' });
  await axe(p, '이용약관·운영정책');
  await p.goto(new URL('admin.html', BASE).href, { waitUntil: 'networkidle' });
  ok((await p.locator('#gate').innerText()).includes('공용 보드가 꺼져 있습니다'), '운영 화면: 설정이 없으면 그렇다고만 한다');
  await axe(p, '운영 화면(설정 없음)');
  await c.close();

  // 실제 보드 — 공유 창, "나도 여기" 창
  const c2 = await context(b, { colorScheme: scheme, viewport: { width: 390, height: 844 } });
  const p2 = await openWith(c2, [report({ id: 'a11y0001', t: Date.now() - 20 * MIN, by: '민지', cat: 'play',
    place: '별빛 키즈카페', wait: 0, crowd: 2, park: 3, rate: 4, tags: ['실내'], note: '붐벼요' })]);
  await p2.locator('#feed [data-share]').first().click(); await shareReady(p2);
  await axe(p2, '공유 창');
  await p2.keyboard.press('Escape');
  await p2.locator('#feed [data-again]').first().click(); await p2.waitForSelector('#composeBack.open');
  await axe(p2, '"나도 여기" 창');
  await c2.close();

  // 지켜보는 곳 · 같게 봤다 · 보통은 표 — 요일·시간대가 흔들리지 않게 시계를 토요일 점심에 멈춘다
  const c3 = await context(b, { colorScheme: scheme, viewport: { width: 390, height: 844 } });
  const T = new Date('2026-09-26T12:30:00+09:00').getTime();
  await c3.clock.setFixedTime(T);
  const past = (iso, o) => report(Object.assign({ t: new Date(iso + '+09:00').getTime(), cat: 'play',
    place: '별빛 키즈카페', area: '안양 안양동' }, o));
  const p3 = await openWith(c3, [
    report({ t: T - 20 * MIN, by: '민지', place: '만안 손칼국수', wait: 10, crowd: 1 }),
    report({ t: T - 70 * MIN, by: '준호', place: '만안 손칼국수', wait: 10, crowd: 1 }),
    past('2026-09-19T12:10:00', { by: '민지', crowd: 2 }),
    past('2026-09-20T12:40:00', { by: '준호', crowd: 3 }),
    past('2026-09-22T09:00:00', { by: '서연', crowd: 0 }),
    past('2026-09-23T10:00:00', { by: '태오', crowd: 0 })
  ], { watch: [{ k: '별빛키즈카페|안양동', nm: '별빛 키즈카페', ar: '안양 안양동', seen: 0 }] });
  await axe(p3, '속보 · 지켜보는 곳');
  await p3.locator('.tab[data-view="places"]').click();
  await axe(p3, '장소 · 같게 봤다 · 보통은');
  await p3.locator('#places .pl', { hasText: '별빛 키즈카페' }).click(); await p3.waitForSelector('#placeBack.open');
  await axe(p3, '장소 창 · 보통은 표');
  await c3.close();
}

section('버튼 이름 (좁은 화면)');
{
  const c = await context(b, { viewport: { width: 390, height: 844 } });
  const p = watch(await c.newPage());
  await p.goto(BASE, { waitUntil: 'networkidle' });
  /* 좁은 화면의 머리띠 단추는 아이콘만 보인다 — 읽어 줄 이름은 있어야 한다 */
  for (const id of ['meBtn', 'themeBtn']) {
    const s = await p.accessibility.snapshot({ root: await p.$('#' + id) });
    ok(s && s.name && s.name.length > 1, '아이콘만 보이는 #' + id + ' 에도 이름: ' + (s && s.name));
  }
  const snap = await p.accessibility.snapshot({ root: await p.$('#writeBtn') });
  ok(snap && snap.name === '리포트 보내기', '전파 아이콘은 읽지 않는다: ' + (snap && snap.name));
  await c.close();
}

section('키보드');
{
  const c = await context(b);
  const p = watch(await c.newPage());
  await p.goto(BASE, { waitUntil: 'networkidle' });
  const tabIdx = await p.$$eval('.tab', (els) => els.map((e) => e.tabIndex).join(','));
  ok(tabIdx === '0,-1,-1,-1', '탭 키로 닿는 탭은 고른 것 하나 (' + tabIdx + ')');
  await p.locator('#tab-feed').focus();
  await p.keyboard.press('ArrowRight');
  ok(await p.getAttribute('#tab-places', 'aria-selected') === 'true', '→ 로 다음 탭');
  ok(await p.evaluate(() => document.activeElement.id) === 'tab-places', '  └ 초점도 따라간다');
  await p.keyboard.press('End');
  ok(await p.getAttribute('#tab-sync', 'aria-selected') === 'true', 'End 로 마지막 탭');
  await p.keyboard.press('ArrowRight');
  ok(await p.getAttribute('#tab-feed', 'aria-selected') === 'true', '마지막에서 → 는 처음으로');
  ok(await p.getAttribute('#view-feed', 'aria-labelledby') === 'tab-feed', '패널은 자기 탭 이름으로 불린다');

  await p.locator('#writeBtn').focus();
  await p.keyboard.press('Enter');
  await p.waitForSelector('#composeBack.open');
  ok(await p.evaluate(() => document.querySelector('main').inert && document.querySelector('.bar').inert), '시트가 열리면 뒤(머리·본문)는 inert');
  let outside = 0;
  for (let i = 0; i < 60; i++) {
    await p.keyboard.press('Tab');
    const inSheet = await p.evaluate(() => !!document.activeElement.closest('#composeBack') || document.activeElement === document.body);
    if (!inSheet) outside++;
  }
  ok(outside === 0, '탭을 60번 눌러도 초점이 시트 밖으로 안 나간다');
  await p.keyboard.press('Escape');
  ok(await p.evaluate(() => document.activeElement.id) === 'writeBtn', 'Esc 로 닫으면 초점이 열었던 단추로 돌아간다');
  ok(await p.evaluate(() => !document.querySelector('main').inert), '  └ 뒤도 다시 살아난다');
  await c.close();
}

/* ── 아래는 붙어 있는 줄·강제 색·좁은 화면·손가락 크기 ──
   시간대 머리(지금·오늘·어제…)가 여럿 붙고, 지켜보는 곳·접힌 옛 정보가 섞인 보드. 별빛 키즈카페엔 다섯 건 — 장소 창이 길다.
   시계는 토요일 점심에 멈춘다 */
const T = new Date('2026-09-26T12:30:00+09:00').getTime();
const PLACES = ['별빛 키즈카페', '만안 손칼국수', '초록 정원 카페', '안양천 물놀이장', '평촌 중앙공원', '구산 돈까스'];
const busy = [5, 25, 70, 150, 240, 420, 600, 900, 1500, 1700, 2900, 3100, 4400, 5000].map((m, i) => report({
  t: T - m * MIN, by: ['민지', '준호', '서연', '태오'][i % 4], cat: ['play', 'food', 'cafe', 'trip', 'etc', 'food'][i % 6],
  place: PLACES[i % 3 ? i % 6 : 0], area: '안양 안양동', wait: [0, 10, 30, 60][i % 4], crowd: i % 4, park: (i + 1) % 4,
  rate: (i % 5) + 1, tags: i % 2 ? ['실내'] : ['아이동반', '넓음'], note: i % 3 ? '메모 ' + i : '' }));
const BUSY = { watch: [{ k: '별빛키즈카페|안양동', nm: '별빛 키즈카페', ar: '안양 안양동', seen: 0 }] };
async function busyPage(opts, rs = busy, extra = BUSY) {
  const c = await context(b, opts);
  await c.clock.setFixedTime(T);
  return { c, p: await openWith(c, rs, extra) };
}
const frames = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
/* 탭·Shift+탭으로 n 번 옮기며, 초점 간 요소의 한가운데를 찍으면 그 요소가 잡히는지 본다 —
   붙어 있는 머리띠·칩 줄·시간대 머리나 바닥 탭바·떠 있는 단추가 덮고 있으면 그것이 잡힌다 */
async function hiddenStops(p, key, n, scope) {
  const bad = [];
  for (let i = 0; i < n; i++) {
    await p.keyboard.press(key);
    const r = await p.evaluate((scope) => {
      const a = document.activeElement;
      if (!a || a === document.body || (scope && !a.closest(scope))) return null;
      const bx = a.getBoundingClientRect();
      const e = document.elementFromPoint(bx.left + bx.width / 2, bx.top + bx.height / 2);
      return e && (e === a || a.contains(e)) ? null
        : (a.textContent || a.getAttribute('aria-label') || a.id || a.tagName).trim().slice(0, 10) + '@' + Math.round(bx.top);
    }, scope);
    if (r) bad.push(r);
  }
  return bad;
}

section('초점이 붙어 있는 줄 밑에 숨지 않는다 (WCAG 2.4.11)');
for (const [w, h] of [[390, 844], [1280, 800]]) {
  const { c, p } = await busyPage({ viewport: { width: w, height: h } });
  const where = w < 760 ? '폰 ' + w + '×' + h + ' — 머리띠·칩 줄·시간대 머리·탭바·떠 있는 단추' : '넓은 화면 ' + w + '×' + h + ' — 탭이 든 머리띠';
  await p.evaluate(() => { window.scrollTo(0, 0); document.activeElement.blur(); });
  const down = await hiddenStops(p, 'Tab', 60);
  ok(down.length === 0, where + ': 탭 60번, 가려진 곳 없음' + (down.length ? ' — ' + down.slice(0, 4).join(', ') : ''));
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.locator('#feed [data-share]').last().focus();
  const up = await hiddenStops(p, 'Shift+Tab', 60);
  ok(up.length === 0, '  └ Shift+탭 60번(아래에서 위로)도 가려진 곳 없음' + (up.length ? ' — ' + up.slice(0, 4).join(', ') : ''));
  if (w < 760) {
    /* 비켜 설 자리를 두면, 붙어 있는 줄 안의 단추(늘 보인다)를 "가려졌다"고 보고 끌어오려다 화면이 튈 수 있다 */
    await p.evaluate(() => window.scrollTo(0, 1500)); await frames(p);
    const jumps = [];
    for (const sel of ['#meBtn', '#themeBtn', '#catFilter .chip']) {
      const y = await p.evaluate(() => scrollY);
      await p.locator(sel).first().focus(); await frames(p);
      const y2 = await p.evaluate(() => scrollY);
      if (y2 !== y) jumps.push(sel + ' ' + y + '→' + y2);
    }
    ok(jumps.length === 0, '  └ 붙어 있는 머리띠·칩 줄의 단추에 초점이 가도 화면이 튀지 않는다' + (jumps.length ? ' — ' + jumps.join(', ') : ''));
    /* 가로로 넘기는 분야 칩 — 끝에 10px 만 걸친 칩으로 탭하면 그 칩이 화면 안으로 들어온다 */
    const edge = await p.evaluate(() => {
      const bar = document.querySelector('#catFilter'), chips = [...bar.querySelectorAll('.chip')], chip = chips[4];
      const right = Math.min(bar.getBoundingClientRect().right, innerWidth);
      bar.scrollLeft += chip.getBoundingClientRect().left - (right - 10);
      chips[3].focus();
      return Math.round(chip.getBoundingClientRect().left);
    });
    await p.keyboard.press('Tab');
    const chipOk = await p.evaluate(() => {
      const a = document.activeElement, bx = a.getBoundingClientRect();
      const e = document.elementFromPoint(bx.left + bx.width / 2, bx.top + bx.height / 2);
      return a.matches('#catFilter .chip') && !!e && (e === a || a.contains(e));
    });
    ok(chipOk, '  └ 가로로 넘기는 분야 칩 줄에서 끝에 걸친 칩(왼쪽 ' + edge + 'px)으로 탭하면 그 칩이 가운데가 보이게 들어온다');
    // 시트 안 — 붙어 있는 머리(제목·닫기)와 발(단추 줄)
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.locator('.tab[data-view="places"]').click();
    await p.locator('#places .pl', { hasText: '별빛 키즈카페' }).click(); await p.waitForSelector('#placeBack.open');
    await settle(p);
    const inSheet = await hiddenStops(p, 'Tab', 30, '#placeBack');
    ok(inSheet.length === 0, '  └ 장소 창 안에서 탭 30번 — 창의 머리·발 밑에도 안 숨는다' + (inSheet.length ? ' — ' + inSheet.slice(0, 4).join(', ') : ''));
    const sheetJumps = await p.evaluate(async () => {
      const sh = document.querySelector('#placeBack .sheet'), max = sh.scrollHeight - sh.clientHeight, out = [];
      for (const s of ['#placeAgain', '#placeBack .sheet-foot [data-close]', '#placeBack .x']) {
        sh.scrollTop = Math.floor(max / 2);
        await new Promise((r) => requestAnimationFrame(r));
        const a = sh.scrollTop;
        document.querySelector(s).focus();
        await new Promise((r) => requestAnimationFrame(r));
        if (sh.scrollTop !== a) out.push(s + ' ' + a + '→' + sh.scrollTop);
      }
      return { max, out };
    });
    ok(sheetJumps.max > 100 && sheetJumps.out.length === 0, '  └ 창의 머리·발 단추(닫기·여기 지금 상황 알리기)에 초점이 가도 창이 튀지 않는다 (창 안 스크롤 ' +
      sheetJumps.max + 'px)' + (sheetJumps.out.length ? ' — ' + sheetJumps.out.join(', ') : ''));
  }
  await c.close();
}

section('알림 — 읽는 프로그램이 듣는다');
{
  const { c, p } = await busyPage({ viewport: { width: 390, height: 844 } });
  const cdp = await c.newCDPSession(p);
  await cdp.send('DOM.enable'); await cdp.send('Accessibility.enable');
  /* 읽는 프로그램이 보는 목록(접근성 트리)에 들어 있나 — display:none 이면 빠진다 */
  const inTree = async (sel) => {
    const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: sel });
    if (!nodeId) return false;
    const { nodes } = await cdp.send('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false });
    return !nodes[0].ignored;
  };
  const heard = (msg) => p.waitForFunction((m) => document.querySelector('#toastSr').textContent === m, msg, { timeout: 2000 }).then(() => true, () => false);

  ok(await inTree('#toastSr') && await p.getAttribute('#toastSr', 'role') === 'status', '읽어 주는 알림 칸(role=status)은 알림이 없을 때도 목록에 있다');
  await p.evaluate(() => toast('지켜보는 곳에 넣었습니다.'));
  ok((await p.locator('#toast').innerText()).includes('지켜보는 곳에 넣었습니다'), '화면 알림(#toast)은 그대로 뜬다');
  ok(await p.getAttribute('#toast', 'aria-hidden') === 'true', '  └ 화면 알림은 읽지 않는다 — 두 번 들리지 않게');
  ok(await heard('지켜보는 곳에 넣었습니다.'), '  └ 같은 말이 읽어 주는 칸에 들어간다');
  // 부른 그 자리에서 읽는다 — 따로 물으면 느린 러너에선 60ms 뒤 다시 채운 것을 읽을 수 있다
  const cleared = await p.evaluate(() => { toast('지켜보는 곳에 넣었습니다.'); const s = document.querySelector('#toastSr'); return s ? s.textContent : null; });
  ok(cleared === '' && await heard('지켜보는 곳에 넣었습니다.'), '  └ 같은 말이 또 오면 비웠다가 다시 채운다 — 다시 읽게');

  await p.locator('.tab[data-view="sync"]').click();
  ok(await inTree('#recvStatus') && await inTree('#bundleStatus'), '주고받기의 빈 상태 칸(#recvStatus·#bundleStatus)도 목록에 있다 — 나중에 든 글을 읽는다');
  /* 빈 칸이 칸 끝에 여백·최소 높이를 남기면 받기 칸이 그만큼 길어진다 — 단추 줄 밑에서 칸 끝까지를 잰다 */
  const room = await p.evaluate(() => {
    const st = document.querySelector('#recvStatus'), panel = st.parentElement, prev = st.previousElementSibling;
    return Math.round(panel.getBoundingClientRect().bottom - prev.getBoundingClientRect().bottom - parseFloat(getComputedStyle(panel).paddingBottom));
  });
  ok(room <= 1, '  └ 빈 칸은 화면에서 자리를 차지하지 않는다 (' + room + 'px)');
  await p.locator('.tab[data-view="feed"]').click();
  await p.locator('#feed [data-share]').first().click(); await shareReady(p);
  ok(await inTree('#shareStatus'), '공유 창의 빈 상태 칸(#shareStatus)도 목록에 있다');
  await p.keyboard.press('Escape');
  await p.locator('#writeBtn').click(); await p.waitForSelector('#composeBack.open');
  ok(await inTree('#composeErr'), '쓰기 창의 빈 오류 칸(#composeErr)도 목록에 있다');
  await p.evaluate(() => toast('태그는 6개까지입니다.'));
  ok(await heard('태그는 6개까지입니다.') && await p.evaluate(() => !!document.querySelector('#toastSr').closest('#composeBack.open')) &&
    await inTree('#toastSr'), '시트가 떠 있으면 읽어 주는 칸은 시트 안으로 — aria-modal 밖은 안 읽어 주는 기기가 있다');
  await c.close();
}

section('좁은 폰(320px) 머리띠');
{
  const c = await context(b, { viewport: { width: 320, height: 700 } });
  const p = await openWith(c, Array.from({ length: 12 }, (_, i) => report({ t: Date.now() - (5 + i) * MIN, place: '가' + i, crowd: 1 })));
  const m = await p.evaluate(() => {
    /* 알약은 단추 자체(#livePill.livepill)다 — 옛 차림은 감싼 칸 안의 span 이었다. 글자가 다 보이는지는 글자 폭으로 잰다
       (단추의 ::after 는 누르는 자리를 넓히려고 밖으로 삐져나와 scrollWidth 에 잡힌다) */
    const pill = document.querySelector('#livePill .livepill') || document.querySelector('#livePill'), pr = pill.getBoundingClientRect();
    const rg = document.createRange(); rg.selectNodeContents(pill); const tr = rg.getBoundingClientRect();
    return { h1: document.querySelector('.brand h1').getBoundingClientRect().right, pill: pr.left, pillR: pr.right,
      whole: tr.left >= pr.left - 0.5 && tr.right <= pr.right + 0.5, sw: document.documentElement.scrollWidth };
  });
  ok(m.h1 <= m.pill + 0.5, '제목이 "지금 12건" 밑으로 파고들지 않는다 (제목 끝 ' + Math.round(m.h1) + ' ≤ 알약 ' + Math.round(m.pill) + ')');
  ok(await p.locator('#livePill').innerText() === '지금 12건' && m.pillR > m.pill && m.whole && m.pillR <= 320 && m.sw <= 320,
    '  └ 알약은 잘리지 않고 다 보이며, 가로로 밀리지 않는다');
  await c.close();
}

for (const scheme of ['light', 'dark']) {
  section('주고받기 — 묶음 링크를 만든 뒤 · ' + (scheme === 'light' ? '밝게' : '어둡게'));
  const c = await context(b, { colorScheme: scheme, viewport: { width: 390, height: 844 } });
  const p = await openWith(c, [report({ id: 'a11y0002', t: Date.now() - 20 * MIN, by: '민지', cat: 'play', place: '별빛 키즈카페', crowd: 1 })]);
  await p.locator('.tab[data-view="sync"]').click();
  await p.locator('#bundleBtn').click(); await bundleReady(p);
  await axe(p, '묶음 글 칸이 열린 주고받기');
  if (scheme === 'light') {
    const hs = await p.$$eval('#view-sync h2', (els) => els.filter((e) => e.getClientRects().length).map((e) => e.textContent.trim()));
    ok(hs.length >= 3, '칸 제목은 제목(h2)이다 — 제목으로 건너뛸 수 있다: ' + hs.join(' · '));
    ok(await p.evaluate(() => { const e = document.querySelector('#view-sync h2.panel-t'); return e && getComputedStyle(e).fontSize; }) === '14px', '  └ 모양은 그대로 (14px)');
    const recv = await p.accessibility.snapshot({ root: await p.$('#recvBox') });
    ok(recv && recv.name === '받기', '붙여 넣는 칸의 이름은 칸 제목: ' + (recv && recv.name));
    const bundle = await p.accessibility.snapshot({ root: await p.$('#bundleBox') });
    ok(bundle && /묶/.test(bundle.name || ''), '묶음 글 칸에도 이름: ' + (bundle && bundle.name));
  }
  await c.close();
}

section('접힌 옛 정보 — 세모는 읽지 않는다');
{
  const { c, p } = await busyPage({ viewport: { width: 390, height: 844 } });
  const s = await p.accessibility.snapshot({ root: await p.$('#feed .expired summary') });
  ok(s && /펼치기/.test(s.name) && !/[▸▾]/.test(s.name), '"… 현장 정보 — 펼치기"만 읽는다: ' + (s && s.name));
  await c.close();
}

section('윈도 고대비(강제 색) — 고른 것이 보인다');
{
  const { c, p } = await busyPage({ viewport: { width: 390, height: 844 }, forcedColors: 'active' });
  const css = (sel, prop) => p.locator(sel).first().evaluate((e, pr) => getComputedStyle(e)[pr], prop);
  await p.locator('#catFilter [data-cat="play"]').click(); await settle(p);   // 칩 색이 바뀌는 0.15초가 끝난 뒤에 잰다
  const on = await css('#catFilter [aria-pressed="true"]', 'backgroundColor'), off = await css('#catFilter [aria-pressed="false"]', 'backgroundColor');
  ok(on !== off, '고른 분야 칩과 안 고른 칩의 바탕이 다르다 (' + on + ' / ' + off + ')');
  ok(await css('#catFilter [aria-pressed="true"]', 'forcedColorAdjust') === 'none', '  └ 고른 칩 글자 뒤에 바탕색 판을 깔지 않는다 — 판 위의 글자가 안 보이게 된다');
  const pill = await css('.tab[aria-selected="true"] .ti', 'backgroundColor'), bar = await css('.tabs', 'backgroundColor');
  ok(pill !== bar, '폰 탭바: 고른 탭의 알약이 탭바 바탕과 다르다 (' + pill + ' / ' + bar + ')');
  await p.locator('#writeBtn').click(); await p.waitForSelector('#composeBack.open');
  await p.locator('#fWait [data-v="10"]').click(); await settle(p);
  ok(await css('#fWait [aria-pressed="true"]', 'backgroundColor') !== await css('#fWait [aria-pressed="false"]', 'backgroundColor'), '쓰기 창: 고른 웨이팅 칩이 보인다');
  await p.locator('#fMore summary').click(); await p.locator('#fRate [data-star="3"]').click(); await settle(p);
  ok(await css('#fRate button.on', 'color') !== await css('#fRate button:not(.on)', 'color'), '  └ 고른 별과 안 고른 별의 색이 다르다');
  await c.close();
  const w = await busyPage({ viewport: { width: 1280, height: 800 }, forcedColors: 'active' });
  const line = (sel) => w.p.locator(sel).first().evaluate((e) => getComputedStyle(e).borderBottomColor);
  const sel = await line('.tab[aria-selected="true"]'), uns = await line('.tab[aria-selected="false"]');
  ok(sel !== uns, '넓은 화면: 고른 탭만 밑줄이 있다 (' + sel + ' / ' + uns + ')');
  await w.c.close();
}

section('가로로 눕힌 폰(740×360) — 붙는 건 머리띠와 탭바만');
{
  const { c, p } = await busyPage({ viewport: { width: 740, height: 360 } });
  ok(await p.locator('#writeBtn .fab-l').evaluate((e) => e.getBoundingClientRect().width) < 1, '떠 있는 단추는 처음부터 아이콘만 — 낮은 화면을 덜 가린다');
  const snap = await p.accessibility.snapshot({ root: await p.$('#writeBtn') });
  ok(snap && snap.name === '리포트 보내기', '  └ 이름은 그대로 "리포트 보내기": ' + (snap && snap.name));
  const tops = () => p.evaluate(() => [document.querySelector('#view-feed > .chiprow'), ...document.querySelectorAll('#feed .tgroup')]
    .map((e) => Math.round(e.getBoundingClientRect().top)));
  await p.evaluate(() => window.scrollTo(0, 500)); await frames(p);
  const a = await tops();
  await p.evaluate(() => window.scrollTo(0, 540)); await frames(p);
  const z = await tops();
  ok(a[0] !== z[0], '내려 읽으면 분야 칩 줄은 따라오지 않고 함께 올라간다 (' + a[0] + ' → ' + z[0] + ')');
  const stuck = a.slice(1).filter((t, i) => t === z[i + 1] && t > -40 && t < 360).length;
  ok(stuck === 0, '  └ 시간대 머리도 붙지 않는다');
  await c.close();
}

section('두 배로 키운 폰(195px 폭)');
{
  const { c, p } = await busyPage({ viewport: { width: 195, height: 422 } });
  const over = [];
  for (const v of ['feed', 'places', 'people', 'sync']) {
    await p.locator(`.tab[data-view="${v}"]`).click();
    const d = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (d > 0) over.push(v + ' +' + d + 'px');
  }
  ok(over.length === 0, '어느 화면도 가로로 밀리지 않는다' + (over.length ? ' — ' + over.join(', ') : ''));
  const labels = await p.$$eval('.tab .tab-l', (els) => els.map((e) => { const r = e.getBoundingClientRect(); return r.left >= -0.5 && r.right <= innerWidth + 0.5; }));
  ok(labels.length === 4 && labels.every(Boolean), '  └ 탭바 이름 넷(주고받기까지)이 다 화면 안에 있다');
  await c.close();
}

section('밖에서 한 손으로 — 누르는 자리 44px');
{
  const { c, p } = await busyPage({ viewport: { width: 390, height: 844 } });
  const acts = await p.$$eval('#feed .card-bot', (rows) => rows.map((row) => {
    const bs = [...row.querySelectorAll('.link-btn')].map((x) => x.getBoundingClientRect());
    let gap = 99;
    for (let i = 1; i < bs.length; i++) if (Math.abs(bs[i].top - bs[i - 1].top) < 1) gap = Math.min(gap, bs[i].left - bs[i - 1].right);
    return { h: Math.min(...bs.map((r) => r.height)), gap };
  }).filter((x) => x.h < 99));
  ok(acts.length > 0 && acts.every((x) => x.h >= 44), '카드의 나도 여기·공유는 44px 높이 (' + Math.min(...acts.map((x) => x.h)) + 'px)');
  ok(acts.every((x) => x.gap >= 8), '  └ 서로 8px 넘게 떨어져 있다 (가장 가까운 ' + Math.min(...acts.map((x) => x.gap)) + 'px)');
  const del = await p.locator('#feed .card .del').first().boundingBox();
  ok(del.width >= 44 && del.height >= 44, '카드의 × 지우기 44×44 (' + del.width + '×' + del.height + ')');
  const icons = await p.$$eval('#meBtn, #themeBtn', (els) => els.map((e) => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height); }));
  ok(icons.every((x) => x >= 44), '머리띠 아이콘 단추 44×44 (' + icons.join(', ') + ')');
  await p.locator('#writeBtn').click(); await p.waitForSelector('#composeBack.open');
  const x = await p.locator('#composeBack .sheet-head .x').boundingBox();
  ok(x.width >= 44 && x.height >= 44, '시트의 × 닫기 44×44 (' + x.width + '×' + x.height + ')');
  await p.locator('#fMore summary').click();
  const stars = await p.$$eval('#fRate button', (els) => els.map((e) => e.getBoundingClientRect()).map((r, i, a) => ({ w: r.width, gap: i ? r.left - a[i - 1].right : 99 })));
  ok(stars.every((s) => s.w >= 44), '별 하나가 44px 폭 (' + stars.map((s) => Math.round(s.w)).join(', ') + ')');
  ok(stars.every((s) => s.gap >= 6), '  └ 별 사이 6px 이상');
  await c.close();
}

section('한글 줄바꿈 — 낱말 가운데서 끊지 않는다');
{
  const URL200 = 'https://example.com/' + 'a'.repeat(180);
  const c = await context(b, { viewport: { width: 320, height: 700 } });
  const p = await openWith(c, [
    report({ t: Date.now() - 5 * MIN, cat: 'play', place: '서울 강남구 대치동 아이러브 키즈카페 앤 패밀리 레스토랑 본점', area: '경기도 성남시 분당구 정자동 느티마을',
      crowd: 1, note: '점심 지나니 자리 조금 남았어요. 주차장은 지하 2층까지 꽉 찼고 1층 입구 쪽 대기줄이 길어서 번호표 받고 한 40분쯤 기다렸습니다.' }),
    report({ t: Date.now() - 6 * MIN, place: '링크만 남긴 곳', crowd: 1, note: URL200 })
  ]);
  /* 낱말(띄어쓰기로 나뉜 것)마다 글자 상자가 몇 줄에 걸쳤는지 센다 */
  const split = await p.evaluate(() => {
    const out = [];
    document.querySelectorAll('#feed .place button, #feed .note-line, #feed .area').forEach((el) => {
      const tn = [...el.childNodes].find((n) => n.nodeType === 3);
      if (!tn || /^https?:/.test(tn.textContent)) return;
      let i = 0;
      for (const w of tn.textContent.split(' ')) {
        const r = document.createRange(); r.setStart(tn, i); r.setEnd(tn, i + w.length);
        if (new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size > 1) out.push(w);
        i += w.length + 1;
      }
    });
    return out;
  });
  ok(split.length === 0, '320px: 장소 이름·동네·메모의 낱말이 두 줄로 쪼개지지 않는다' + (split.length ? ' — ' + split.join(', ') : ''));
  ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '  └ 띄어쓰기 없는 200자 주소는 화면 안에서 줄을 바꾼다 (가로로 안 밀린다)');
  await p.locator('#writeBtn').click(); await p.waitForSelector('#composeBack.open');
  const left = await p.$$eval('#fWait, #fCrowd, #fPark', (els) => els.map((e) => Math.round(e.getBoundingClientRect().left)));
  ok(new Set(left).size === 1, '쓰기 창 "지금 어때요?" 세 줄의 칩이 한 줄로 맞춰 선다 (' + left.join(', ') + ')');
  const lines = await p.$$eval('.now-l', (els) => els.map((e) => {
    e.style.fontSize = '28px';   // 글자를 두 배로 키운 폰처럼
    const r = document.createRange(); r.selectNodeContents(e);
    return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size;
  }));
  ok(lines.every((n) => n === 1), '  └ 글자를 두 배로 키워도 이름표("웨이팅")가 쪼개지지 않는다 (' + lines.join(', ') + '줄)');
  await p.keyboard.press('Escape');
  await p.locator('.tab[data-view="places"]').click();
  await p.locator('#places .pl').first().click(); await p.waitForSelector('#placeBack.open');
  const foot = await p.$$eval('#placeBack .sheet-foot .btn', (els) => els.filter((e) => !e.hidden).map((e) => {
    const r = document.createRange(); r.selectNodeContents(e);
    return e.textContent.trim() + ':' + new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size;
  }));
  ok(foot.every((s) => s.endsWith(':1')), '장소 창 아래 단추 글자가 단추 안에서 쪼개지지 않는다 — 모자라면 단추째 다음 줄로 (' + foot.join(', ') + ')');
  await c.close();
}

await finish(b);
