/* 기본 흐름 — 예시 보드, 신선도, 거르개, 장소, 쓰기, 링크로 받기·중복·깨진 링크, 묶음, hidden */
import { BASE, ok, launch, context, watch, finish, shareReady, bundleReady, section, openWith, report, MIN } from './lib.mjs';

const URL = BASE;
const browser = await launch();
const ctx = await context(browser);
const page = watch(await ctx.newPage());

await page.goto(URL, { waitUntil: 'networkidle' });

console.log('\n== 1. 첫 화면(예시) ==');
ok((await page.locator('#feed .card').count()) === 8, '예시 리포트 8건');
ok((await page.locator('#feed .badge').first().textContent()).includes('예시'), '예시 배지 표시');
ok(await page.locator('#dropSample').isVisible(), '예시 치우기 버튼');
ok((await page.locator('.pick ol li').count()) > 0, '지금 갈 만한 곳 노출');
const pill = await page.locator('#livePill').innerText();
ok(/지금 4건/.test(pill), '머리 알약 "지금 4건" (14·38·95·170분): ' + pill);
ok(await page.locator('#statline').isHidden(), '첫 화면은 소식부터 — 숫자 줄은 없다(끊겼을 때만 한 줄)');
ok((await page.locator('.tgroup').count()) >= 2, '시간대 머리 ' + (await page.locator('.tgroup').allInnerTexts()).join(' / '));
ok((await page.locator('#feed .meter').count()) === 0, '카드에 신선도 막대가 없다 — 몇 분 전 알약 하나로 읽는다');

console.log('\n== 2. 신선도 계급 ==');
const cls = await page.locator('#feed .card').evaluateAll(els => els.map(e => e.className));
ok(cls[0].includes('age-live'), '14분 전 → age-live');
ok(cls[2].includes('age-soft'), '95분 전 → age-soft');
ok(cls[4].includes('age-dim'), '260분 전 → age-dim');
ok(cls[7].includes('age-old'), '2600분 전 → age-old');
ok((await page.locator('#feed .live-row.faded').count()) > 0, '3시간 지난 현장정보는 흐려짐');
ok((await page.locator('#feed details.expired').count()) >= 1, '하루 지난 현장정보는 접힘');
const ages = await page.locator('#feed .card .age').allInnerTexts();
ok(ages[0] === '14분 전' && ages[4] === '4시간 전', '카드 머리의 시각: ' + ages.slice(0, 5).join(' / '));
ok(await page.locator('#feed .card.age-live').first().locator('.card-head .age').evaluate((el) =>
  getComputedStyle(el).backgroundColor !== 'rgba(0, 0, 0, 0)'), '  └ 막 들어온 소식의 시각은 알약');
ok((await page.locator('#feed .live-label').count()) === 0, '  └ 칩 줄에 시각을 한 번 더 적지 않는다');

console.log('\n== 3. 거르기/검색/정렬 ==');
await page.locator('#catFilter [data-cat="food"]').click();
ok((await page.locator('#feed .card').count()) === 2, '맛집만 2건');
await page.locator('#catFilter [data-cat=""]').click();
await page.locator('#liveOnly').click();
ok((await page.locator('#feed .card').count()) === 4, '3시간 안쪽만 4건');
await page.locator('#liveOnly').click();
/* 검색은 치기를 잠깐 멈춘 뒤(150ms)에 그린다 — 그려질 때까지 기다렸다가 센다 */
const cardsAre = (p, n) => p.waitForFunction((n) => document.querySelectorAll('#feed .card').length === n, n, { timeout: 3000 }).catch(() => {});
await page.fill('#q', '돈까스');
await cardsAre(page, 1);
ok((await page.locator('#feed .card').count()) === 1, '검색 1건');
await page.fill('#q', '');
await cardsAre(page, 8);
ok(await page.locator('#sort').count() === 0, '속보에 정렬 칸이 없다 — 늘 최신순 (정렬은 장소 탭)');
ok((await page.locator('#feed .card .age').first().innerText()) === '14분 전', '  └ 맨 위는 가장 최근 것');

console.log('\n== 4. 장소 묶기 ==');
await page.locator('.tab[data-view="places"]').click();
ok((await page.locator('#places .pl').count()) === 7, '8건 → 7장소 (키즈카페 2건 묶임)');
const kids = page.locator('#places .pl', { hasText: '별빛 키즈카페' });
ok((await kids.innerText()).includes('리포트 2건'), '별빛 키즈카페 리포트 2건');
ok((await kids.innerText()).includes('특파원 2명'), '특파원 2명');
ok((await page.locator('#places .conflict').count()) === 0, '3시간 밖이면 엇갈림 표시 안 함');

console.log('\n== 5. 장소 상세 ==');
await kids.click();
await page.waitForSelector('#placeBack.open');
ok((await page.locator('#placeTitle').textContent()) === '별빛 키즈카페', '상세 제목');
ok((await page.locator('#placeBody .tl .card').count()) === 2, '타임라인 2건');
await page.keyboard.press('Escape');
ok(!(await page.locator('#placeBack').evaluate(e => e.classList.contains('open'))), 'Escape 로 닫힘');

console.log('\n== 6. 특파원 ==');
await page.locator('.tab[data-view="people"]').click();
ok((await page.locator('#people .pr').count()) === 4, '특파원 4명');
const top = await page.locator('#people .pr').first().innerText();
ok(/민지|준호|서연|태오/.test(top), '이름 노출');

console.log('\n== 7. 리포트 쓰기 ==');
await page.locator('#writeBtn').click();
await page.waitForSelector('#composeBack.open');
await page.fill('#fPlace', '테스트 놀이터');
ok(!(await page.locator('#fMore').evaluate((d) => d.open)), '동네·별점·태그는 "더 적기" 안에 접혀 있다');
ok(await page.locator('#fBy').isVisible(), '  └ 이름을 아직 안 정했으면 이름 칸은 위에 보인다');
await page.locator('#fMore summary').click();
await page.fill('#fArea', '안양 <b>안양동</b>');
await page.locator('#fCat [data-v="play"]').click();
await page.locator('#fWait [data-v="0"]').click();
await page.locator('#fCrowd [data-v="0"]').click();
await page.locator('#fPark [data-v="2"]').click();
await page.locator('#fRate [data-star="4"]').click();
await page.locator('#fTags [data-tag="아이동반"]').click();
await page.locator('#fTags [data-tag="그늘"]').click();
await page.fill('#fNote', '<script>alert(1)<\/script> 지금 텅 비었어요');
await page.fill('#fBy', '리처드');
await page.locator('#composeGo').click();
const shareText = await shareReady(page);
ok(shareText.includes('테스트 놀이터'), '공유글에 장소');
ok(/눌러서 보기 → http.*#r=/.test(shareText), '공유글에 링크');
ok(shareText.includes('대기 없음 · 한산 · 주차 만석'), '공유글에 현장 정보');
ok(shareText.includes('— 리처드 특파원'), '공유글에 특파원');
const code = shareText.match(/#r=([A-Za-z0-9_-]+)/)[1];
ok(code[0] === '2', '압축 형식(2) 사용');
ok(code.length < 300, '링크 payload 짧음: ' + code.length + '자');
await page.locator('#shareBack [data-close]').last().click();

console.log('\n== 8. 저장/예시 사라짐 ==');
ok((await page.locator('#feed .card').count()) === 1, '내 리포트 1건만 (예시 사라짐)');
ok((await page.locator('#feed .badge', { hasText: '예시' }).count()) === 0, '예시 배지 없음');
const noteHtml = await page.locator('#feed .note-line').first().innerHTML();
ok(noteHtml.includes('&lt;script&gt;'), 'XSS 이스케이프: ' + noteHtml.slice(0, 40));
ok((await page.locator('#meBtn').textContent()).includes('리처드'), '머리 버튼에 이름');
const stored = await page.evaluate(() => localStorage.getItem('tpw.v1'));
ok(JSON.parse(stored).reports.length === 1 && JSON.parse(stored).seeded === true, 'localStorage 저장');

console.log('\n== 9. 링크로 받기 (다른 브라우저 흉내) ==');
const ctx2 = await browser.newContext({ locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
const page2 = await ctx2.newPage();
watch(page2, 'p2');
await page2.goto(URL + '#r=' + code, { waitUntil: 'networkidle' });
await page2.waitForSelector('#inbox .inbox');
ok((await page2.locator('#inbox h2').textContent()).includes('리처드 특파원이 보낸 현장 소식'), '도착 알림');
await page2.locator('#inboxYes').click();
await page2.keyboard.press('Escape');   // 한 곳 소식이면 받자마자 그 장소 창이 열린다
await page2.waitForTimeout(150);
ok((await page2.locator('#feed .card').count()) === 1, '받은 리포트 1건');
ok((await page2.locator('#feed .place').first().innerText()).includes('테스트 놀이터'), '장소 일치');
ok((await page2.locator('#feed .note-line').first().innerHTML()).includes('&lt;script&gt;'), '받은 내용도 이스케이프');
ok((await page2.evaluate(() => location.hash)) === '', '받은 뒤 해시 정리');

console.log('\n== 10. 두 번 받으면 중복 ==');
await page2.locator('.tab[data-view="sync"]').click();
await page2.fill('#recvBox', '아무 말\n받기 → ' + URL + '#r=' + code + '\n뒷말');
await page2.locator('#recvGo').click();
await page2.waitForTimeout(200);
const st = await page2.locator('#recvStatus').textContent();
ok(/0건을 받았습니다.*1건은 이미/.test(st), '중복 건너뜀: ' + st);
ok((await page2.locator('#feed .card').count()) === 1, '중복 안 쌓임');

console.log('\n== 11. 망가진 링크 ==');
await page2.fill('#recvBox', '받기 → ' + URL + '#r=2AAAAnonsense__');
await page2.locator('#recvGo').click();
await page2.waitForTimeout(300);
ok((await page2.locator('#recvStatus').textContent()).includes('받지 못했습니다'), '깨진 링크는 오류로');
await page2.fill('#recvBox', '링크 없는 그냥 글');
await page2.locator('#recvGo').click();
ok((await page2.locator('#recvStatus').textContent()).includes('찾지 못했습니다'), '링크 없으면 안내');

console.log('\n== 12. 묶음 ==');
await page.locator('.tab[data-view="sync"]').click();
await page.locator('#bundleBtn').click();
const bst = await bundleReady(page);
ok(bst.includes('최근 1건'), '묶음 생성: ' + bst);
ok((await page.inputValue('#bundleBox')).includes('#r='), '묶음 링크');

console.log('\n== 13. hidden 속성이 실제로 감추는가 ==');
{
  const q = await ctx.newPage();
  await q.goto(URL, { waitUntil:'networkidle' });
  await q.locator('.tab[data-view="sync"]').click();
  ok(!(await q.locator('#bundleRow').isVisible()), '묶음 만들기 전 복사 단추 줄 숨김 (.row 는 display:flex)');
  await q.locator('.tab[data-view="people"]').click();
  ok(await q.locator('#meSet').isVisible(), '이름 있으면 한 줄로 접힘 (.me-set 은 display:flex)');
  ok(!(await q.locator('#meForm').isVisible()), '이름 있으면 입력칸 감춤');
  await q.close();
}

/* ── 긴 보드 · 1분마다 새로 그리기 · 검색 · 초점 ── */
const NOW = new Date('2026-09-26T12:30:00+09:00').getTime();   // 토요일 점심
const H = 3600e3;
const at = (s) => new Date(s + '+09:00').getTime();
/* 2천 건 · 800곳. 앞에서부터 지금 10 · 오늘 20 · 어제 20 · 그 전 1950 — 첫 60장에 네 묶음이 다 나온다 */
function bigBoard() {
  const rs = [], cats = ['play', 'food', 'cafe', 'trip', 'etc'];
  for (let i = 0; i < 2000; i++) {
    const t = i < 10 ? NOW - (5 + i * 5) * MIN : i < 30 ? NOW - 2 * H - (i - 10) * 20 * MIN
      : i < 50 ? at('2026-09-25T23:00:00') - (i - 30) * 40 * MIN : at('2026-09-24T22:00:00') - (i - 50) * 40 * MIN;
    rs.push(report({ id: 'b' + String(i).padStart(4, '0'), t, by: '특파원' + (i % 37), cat: cats[i % 5], place: '장소 ' + (i % 800),
      area: '안양동', wait: i % 3 ? 10 : -1, crowd: i % 4, rate: (i % 5) + 1, note: i % 2 ? '메모 ' + i : '' }));
  }
  return rs;
}
/* 앱의 함수를 감싸 불린 횟수를 센다(전역 함수라 바꿔 끼우면 앱 안의 호출도 이리로 온다) */
const spy = (p, names) => p.evaluate((names) => {
  window.__calls = {};
  names.forEach((k) => {
    window.__calls[k] = 0;
    const orig = window[k].__orig || window[k];
    const f = function () { window.__calls[k]++; return orig.apply(this, arguments); };
    f.__orig = orig;
    window[k] = f;
  });
}, names);
const calls = (p) => p.evaluate(() => Object.assign({}, window.__calls));

section('14. 긴 보드 — 60건씩 그리고 나머지는 "더 보기"');
{
  const c = await context(browser);
  await c.clock.setFixedTime(NOW);
  const p = await openWith(c, bigBoard());
  const cards = () => p.locator('#feed .card').count();
  ok(await cards() === 60, '2천 건이어도 카드는 60장만 그린다');
  ok((await p.locator('#feedMore').innerText()) === '1940건 더 보기', '  └ 그 아래 "1940건 더 보기"');
  ok((await p.locator('#nFeed').textContent()) === '2000', '  └ 탭의 숫자는 전체 2000');
  const bands = (await p.locator('#feed .tgroup').allInnerTexts()).map((s) => s.replace(/\s+/g, ' '));
  const nums = bands.map((s) => Number((s.match(/(\d+)건/) || [])[1]));
  ok(nums.join() === '10,20,20,1950', '시간대 머리의 건수는 거른 목록 전체로 센다: ' + bands.join(' / '));
  ok(nums.reduce((a, b) => a + b, 0) === 2000, '  └ 더하면 2000');
  const els = await p.evaluate(() => document.querySelectorAll('#feed *').length);
  ok(els < 2000, '속보의 요소 수가 예산(2천) 안: ' + els + ' (다 그리면 4만 8천)');
  await p.locator('#feedMore').click();
  ok(await cards() === 120 && (await p.locator('#feedMore').innerText()) === '1880건 더 보기', '더 보기 → 120장, "1880건 더 보기"');
  ok(await p.evaluate(() => document.activeElement.matches('#feed [data-open="b0060"]')), '  └ 초점은 새로 나온 첫 카드로');
  await p.evaluate(() => minuteRefresh());
  ok(await cards() === 120, '1분마다 새로 그려도 펼친 만큼 그대로');
  await p.locator('#catFilter [data-cat="food"]').click();
  ok(await cards() === 60 && (await p.locator('#feedMore').innerText()) === '340건 더 보기', '분야를 바꾸면 다시 60장부터 (맛집 400건)');
  await p.locator('#catFilter [data-cat=""]').click();
  await p.locator('#feedMore').click();
  await p.locator('#liveOnly').click();
  ok(await cards() === 13 && await p.locator('#feedMore').count() === 0, '"최근 3시간" — 13건이면 더 보기 없음');
  await p.locator('#liveOnly').click();
  ok(await cards() === 60, '  └ 풀면 다시 60장부터');
  await p.locator('#feedMore').click();
  await p.fill('#q', '메모');
  await p.press('#q', 'Enter');
  ok(await cards() === 60 && (await p.locator('#feedMore').innerText()) === '940건 더 보기', '검색해도 60장부터 (메모 1000건)');
  await p.fill('#q', '');
  await p.press('#q', 'Enter');

  section('15. 장소도 60곳씩');
  await p.locator('.tab[data-view="places"]').click();
  ok(await p.locator('#places .pl').count() === 60 && (await p.locator('#placesMore').innerText()) === '740곳 더 보기',
    '800곳이어도 60곳 + "740곳 더 보기"');
  ok((await p.locator('#nPlaces').textContent()) === '800', '  └ 탭의 숫자는 전체 800');
  await p.locator('#placesMore').click();
  ok(await p.locator('#places .pl').count() === 120, '더 보기 → 120곳');
  ok(await p.evaluate(() => document.activeElement === document.querySelectorAll('#places .pl')[60]), '  └ 초점은 새로 나온 첫 장소로');
  await p.selectOption('#psort', 'rate');
  ok(await p.locator('#places .pl').count() === 60, '정렬을 바꾸면 다시 60곳부터');
  ok(await p.evaluate(() => inPass(() => {
    const before = groups().map((g) => g.key).join('|');
    renderPlaces();                                        // 별점순 — 만든 순서와 다르다
    return before === groups().map((g) => g.key).join('|');
  })), '장소 목록은 함께 쓰는 장소 묶음을 제자리에서 정렬하지 않는다(사본을 정렬)');

  section('16. 장소 묶음은 한 번 그리기에 한 번만');
  const builds = await p.evaluate(() => {
    const orig = window.buildGroups; let n = 0;
    window.buildGroups = function () { n++; return orig.apply(this, arguments); };
    try {
      renderAll(); const all = n; n = 0;
      minuteRefresh(); const tick = n; n = 0;
      document.querySelector('#tab-feed').click(); const tab = n;
      return { all, tick, tab };
    } finally { window.buildGroups = orig; }
  });
  ok(builds.all === 1, 'renderAll 한 번에 장소 묶음은 한 번 (' + builds.all + '번)');
  ok(builds.tick === 1 && builds.tab === 1, '  └ 1분마다 새로 그리기·미뤄 둔 속보 그리기도 한 번씩 (' + builds.tick + ', ' + builds.tab + ')');
  await c.close();
}

section('17. 1분마다 새로 그리기 — 초점·펼침은 그대로, 안 보이면 쉰다');
{
  const c = await context(browser);
  await c.clock.install({ time: NOW });
  const p = await openWith(c, [
    report({ id: 'fresh001', t: NOW - 5 * MIN, by: '민지', place: '만안 손칼국수', area: '안양동', wait: 10, crowd: 1 }),
    report({ id: 'old00001', t: NOW - 30 * H, by: '준호', cat: 'play', place: '별빛 키즈카페', area: '안양동', wait: 30, crowd: 2, note: '어제 오후' })
  ]);
  await p.locator('#feed details.expired summary').click();
  ok(await p.locator('#feed details.expired').evaluate((d) => d.open), '어제 현장 정보를 펼쳤다');
  await p.locator('#feed [data-share="fresh001"]').focus();
  const age0 = await p.evaluate(() => { window.__card = document.querySelector('#feed .card'); return document.querySelector('#feed .card .age').textContent; });
  await c.clock.runFor(61e3);
  const re = await p.evaluate(() => ({ again: document.querySelector('#feed .card') !== window.__card, age: document.querySelector('#feed .card .age').textContent }));
  ok(re.again && re.age !== age0, '1분 뒤 다시 그렸다 (' + age0 + ' → ' + re.age + ')');
  ok(await p.locator('#feed details.expired').evaluate((d) => d.open), '  └ 펼쳐 둔 "현장 정보"는 펼친 채로');
  ok(await p.evaluate(() => document.activeElement.matches('#feed [data-share="fresh001"]')), '  └ 카드 단추의 초점도 그대로');
  await p.locator('#feed details.expired summary').focus();
  await c.clock.runFor(61e3);
  ok(await p.evaluate(() => document.activeElement.matches('#feed details[data-exp="old00001"] > summary')), '  └ 펼치기 줄에 둔 초점도 그대로');
  await p.locator('#feed [data-again="fresh001"]').focus();
  const redrawn = await p.evaluate(() => { const b = document.activeElement; renderAll(); return !b.isConnected; });
  ok(redrawn && await p.evaluate(() => document.activeElement.matches('#feed [data-again="fresh001"]')) &&
     await p.locator('#feed details.expired').evaluate((d) => d.open), '전부 다시 그려도(renderAll — 받아오기·링크 받기 뒤) 초점과 펼침은 그대로');

  const RENDER = ['renderFeed', 'renderPlaces', 'renderTicker'];
  await spy(p, RENDER);
  await p.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await c.clock.runFor(3 * 61e3);
  let n = await calls(p);
  ok(n.renderFeed + n.renderPlaces + n.renderTicker === 0, '안 보이는 탭에서는 몇 분이 지나도 다시 그리지 않는다 ' + JSON.stringify(n));
  await spy(p, RENDER);
  await p.evaluate(() => {
    delete document.hidden; delete document.visibilityState;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  n = await calls(p);
  ok(n.renderFeed > 0 && n.renderTicker > 0 && n.renderPlaces === 0, '돌아오면 보고 있는 속보만 그린다 ' + JSON.stringify(n));
  await p.locator('.tab[data-view="places"]').click();
  ok((await calls(p)).renderPlaces > 0, '  └ 장소는 장소 탭을 열 때 그린다');
  await p.locator('.tab[data-view="feed"]').click();

  await p.locator('#writeBtn').focus();
  await p.keyboard.press('Enter');
  await p.waitForSelector('#composeBack.open');
  await c.clock.runFor(100);
  await spy(p, RENDER);
  await c.clock.runFor(61e3);
  ok((await calls(p)).renderFeed === 0, '시트가 열려 있으면 그 뒤의 속보는 그리지 않는다');
  await p.keyboard.press('Escape');
  ok((await calls(p)).renderFeed > 0, '  └ 닫으면 그때 그린다');
  ok(await p.evaluate(() => document.activeElement.id) === 'writeBtn', '  └ 초점은 연 단추로');
  /* 카드 제목으로 연 장소 창 — 연 채로 1분이 지나면 닫을 때 속보를 다시 그리고, 초점은 다시 그려진 그 제목으로 */
  await p.locator('#feed [data-open="fresh001"]').focus();
  await p.keyboard.press('Enter');
  await p.waitForSelector('#placeBack.open');
  await c.clock.runFor(100);
  await p.evaluate(() => { window.__title = document.querySelector('#feed [data-open="fresh001"]'); });
  await c.clock.runFor(61e3);
  await p.keyboard.press('Escape');
  ok(await p.evaluate(() => document.activeElement.matches('#feed [data-open="fresh001"]') && document.activeElement !== window.__title),
    '장소 창을 연 채로 1분 — 닫으면 다시 그려진 그 카드 제목으로 초점이 돌아온다');
  await c.close();
}

section('18. 검색 — 자모마다 다시 그리지 않는다');
{
  const c = await context(browser);
  const p = watch(await c.newPage());
  await p.goto(BASE, { waitUntil: 'networkidle' });          // 예시 보드
  await spy(p, ['renderFeed', 'renderPick', 'renderWatch']);
  const typed = await p.evaluate(() => {
    const q = document.querySelector('#q');
    for (const v of ['ㅋ', '키', '킞', '키즈', '키즈ㅋ', '키즈카', '키즈캎', '키즈카페']) {
      q.value = v; q.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return Object.assign({ cards: document.querySelectorAll('#feed .card').length }, window.__calls);
  });
  ok(typed.renderFeed === 0 && typed.cards === 8, '한글 자모 input 8번 — 치는 동안은 다시 그리지 않는다 ' + JSON.stringify(typed));
  await p.evaluate(() => document.querySelector('#q').dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '페' })));
  let n = await calls(p);
  const hits = await p.locator('#feed .card .place').allInnerTexts();
  ok(n.renderFeed > 0 && hits.length === 2 && hits.every((x) => x.includes('키즈카페')), '글자가 완성되면(compositionend) 바로 그린다: ' + hits.join(', '));
  ok(n.renderPick === 0 && n.renderWatch === 0, '  └ 검색은 목록만 — "지금 가기 좋은 곳"·지켜보는 곳은 다시 그리지 않는다');
  const still = await p.evaluate(() => {        // 넣은 그 자리에서 센다 — 기다림(150ms)이 끝나기 전
    const q = document.querySelector('#q'); q.value = '돈까스'; q.dispatchEvent(new Event('input', { bubbles: true }));
    return document.querySelectorAll('#feed .card').length;
  });
  await cardsAre(p, 1);
  ok(still === 2 && (await p.locator('#feed .card').count()) === 1, '멈추면 잠시(150ms) 뒤에 그린다: 2건 → 1건');
  await p.fill('#q', '칼국수');
  await p.press('#q', 'Enter');
  ok((await p.locator('#feed .card .place').allInnerTexts()).join() === '만안 손칼국수', 'Enter 면 바로 그린다');
  n = await calls(p);
  ok(n.renderPick === 0 && n.renderWatch === 0, '  └ 여전히 목록만 ' + JSON.stringify(n));
  await p.locator('#catFilter [data-cat="food"]').click();
  ok((await calls(p)).renderPick > 0, '분야 거르개는 "지금 가기 좋은 곳"도 다시 그린다');

  await p.locator('.tab[data-view="places"]').click();
  await spy(p, ['renderPlaces']);
  const pn = await p.evaluate(() => {
    const q = document.querySelector('#pq');
    for (const v of ['ㅂ', '벼', '별', '별ㅂ', '별비', '별빛']) { q.value = v; q.dispatchEvent(new Event('input', { bubbles: true })); }
    return window.__calls.renderPlaces;
  });
  await p.waitForFunction(() => document.querySelectorAll('#places .pl').length === 1, null, { timeout: 3000 }).catch(() => {});
  ok(pn === 0 && (await p.locator('#places .pl').allInnerTexts()).length === 1, '장소 검색도 멈춘 뒤에 한 번 (치는 동안 ' + pn + '번)');
  await c.close();
}

section('19. "어제"는 달력으로 — 시간대 머리와 같은 말');
{
  const c = await context(browser);
  await c.clock.setFixedTime(NOW);
  const p = await openWith(c, [
    report({ id: 'y1', t: at('2026-09-25T20:00:00'), place: '어제 저녁' }),
    report({ id: 'y2', t: at('2026-09-25T08:00:00'), place: '어제 아침' }),
    report({ id: 'd2', t: at('2026-09-24T20:00:00'), place: '그저께 저녁' }),   // 40시간 반 전 — 지난 시간으로 세면 "어제"
    report({ id: 'd3', t: at('2026-09-23T13:00:00'), place: '사흘 전 점심' })
  ]);
  const rows = await p.evaluate(() => {
    let band = '';
    return Array.from(document.querySelectorAll('#feed > *')).map((el) => {
      if (el.classList.contains('tgroup')) { band = el.querySelector('b').textContent; return null; }
      return { id: el.querySelector('[data-open]').dataset.open, band, age: el.querySelector('.age').textContent };
    }).filter(Boolean);
  });
  const row = (id) => rows.find((r) => r.id === id) || {};
  ok(rows.filter((r) => r.band === '그 전').every((r) => r.age !== '어제'), '"그 전" 밑의 카드는 "어제"라고 하지 않는다: ' +
    rows.map((r) => r.band + ':' + r.age).join(' / '));
  ok(row('d2').band === '그 전' && row('d2').age === '2일 전', '  └ 그저께 저녁(40시간 전)은 "2일 전"');
  ok(row('d3').age === '3일 전', '  └ 사흘 전 점심(71시간 전)은 "3일 전"');
  ok(row('y2').band === '어제' && row('y2').age === '어제', '어제 아침(28시간 전)은 "어제" 묶음에 "어제"');
  ok(row('y1').age === '16시간 전', '하루 안쪽은 그대로 "16시간 전"');
  const fmt = await p.evaluate(() => {
    const ts = [Date.now() - 40 * 86400e3, Date.UTC(2026, 0, 3, 0, 5), Date.UTC(2025, 11, 31, 15, 0), Date.UTC(2026, 7, 16, 13, 28)];
    return ts.every((t) => fmtTime(t) === new Date(t).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })) &&
      ago(ts[0]) === new Date(ts[0]).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
  });
  ok(fmt, '날짜 글자(fmtTime · 30일 넘은 ago)는 예전과 똑같다');
  await c.close();
}

section('20. 시트를 닫으면 초점은 보이는 곳으로 — 연 단추가 그사이 다시 그려졌어도');
{
  const c = await context(browser);
  await c.clock.setFixedTime(NOW);
  const p = await openWith(c, [
    report({ id: 'k1', t: NOW - 20 * MIN, by: '준호', cat: 'play', place: '별빛 키즈카페', area: '안양동', crowd: 1 }),
    report({ id: 'f1', t: NOW - 50 * MIN, by: '민지', cat: 'food', place: '만안 손칼국수', area: '안양동', wait: 10 }),
    report({ id: 'k2', t: NOW - 2 * H, by: '서연', cat: 'play', place: '별빛 키즈카페', area: '안양동', crowd: 2 }),
    report({ id: 'f2', t: NOW - 3 * H, by: '태오', cat: 'food', place: '구산 돈까스', area: '비산동', wait: 30 })
  ], { watch: [{ k: '별빛키즈카페|안양동', nm: '별빛 키즈카페', ar: '안양동', seen: 0 }] });
  p.on('dialog', (d) => d.accept());
  const where = () => p.evaluate(() => {
    const a = document.activeElement;
    return { body: a === document.body, inSheet: !!a.closest('.backdrop'), shown: a.getClientRects().length > 0,
      what: a.tagName + (a.id ? '#' + a.id : '') + ' ' + Array.from(a.attributes).filter((x) => /^data-/.test(x.name)).map((x) => x.name + '=' + x.value).join(' ') };
  });
  const fine = (w) => !w.body && !w.inSheet && w.shown;

  ok((await p.locator('#watchBox .w-new').count()) === 1, '지켜보는 곳에 "새 소식"');
  await p.locator('#watchBox [data-openkey]').focus();
  await p.keyboard.press('Enter');
  await p.waitForSelector('#placeBack.open');
  await p.waitForTimeout(80);
  ok((await p.locator('#watchBox .w-new').count()) === 0, '  └ 장소 창을 열면 본 것 — 지켜보는 곳을 다시 그렸다');
  await p.keyboard.press('Escape');
  let w = await where();
  ok(fine(w), '지켜보는 곳 → 장소 창 → Esc: 초점이 보이는 곳에 (' + w.what + ')');
  ok(await p.evaluate(() => document.activeElement.matches('#watchBox .w-row[data-openkey="별빛키즈카페|안양동"]')), '  └ 다시 그려진 그 줄로 돌아온다');

  await p.evaluate(() => { board.watch.forEach((x) => { x.seen = 0; }); save(); renderAll(); });
  await p.locator('.tab[data-view="places"]').click();
  await p.locator('#places .pl', { hasText: '별빛 키즈카페' }).focus();
  await p.keyboard.press('Enter');
  await p.waitForSelector('#placeBack.open');
  await p.waitForTimeout(80);
  await p.keyboard.press('Escape');
  w = await where();
  ok(fine(w) && await p.evaluate(() => document.activeElement.matches('#places .pl[data-openkey="별빛키즈카페|안양동"]')),
    '장소 목록(새 소식) → Esc: 다시 그려진 그 장소로 (' + w.what + ')');

  await p.locator('.tab[data-view="feed"]').click();
  await p.locator('#feed [data-again="f1"]').focus();
  await p.keyboard.press('Enter');
  await p.waitForSelector('#composeBack.open');
  await p.locator('#fCrowd [data-v="0"]').click();
  await p.locator('#composeGo').click();
  await shareReady(p);
  await p.keyboard.press('Escape');
  w = await where();
  ok(fine(w), '나도 여기 → 보내기 → 공유 창 → Esc: 초점이 보이는 곳에 (' + w.what + ')');
  ok(await p.evaluate(() => document.activeElement.matches('#feed [data-again="f1"]')), '  └ 다시 그려진 그 "나도 여기"로');

  const order = await p.locator('#feed .card [data-del]').evaluateAll((els) => els.map((e) => e.dataset.del));
  await p.locator('#feed [data-del="' + order[1] + '"]').focus();
  await p.keyboard.press('Enter');
  await p.waitForFunction((id) => !document.querySelector('#feed [data-del="' + id + '"]'), order[1]);
  w = await where();
  ok(fine(w) && await p.evaluate((id) => document.activeElement.matches('#feed [data-del="' + id + '"]'), order[2]),
    '카드를 지우면 초점은 다음 카드의 지우기 단추로 (' + w.what + ')');

  /* 연 단추가 없을 때 — 홈 화면 바로가기(?write=1)나 알림(?place=)으로 곧장 연 시트 */
  await p.evaluate(() => { document.activeElement.blur(); openCompose(); });
  await p.waitForSelector('#composeBack.open');
  await p.waitForTimeout(80);
  await p.keyboard.press('Escape');
  w = await where();
  ok(fine(w) && await p.evaluate(() => document.activeElement.matches('.tab[aria-selected="true"]')),
    '연 단추 없이 열린 시트를 닫으면 초점은 고른 탭으로 (' + w.what + ')');
  await c.close();
}

await finish(browser);
