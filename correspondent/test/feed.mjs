/* 기본 흐름 — 예시 보드, 신선도, 거르개, 장소, 쓰기, 링크로 받기·중복·깨진 링크, 묶음, hidden */
import { BASE, ok, launch, context, watch, finish, shareReady, bundleReady } from './lib.mjs';

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
await page.fill('#q', '돈까스');
ok((await page.locator('#feed .card').count()) === 1, '검색 1건');
await page.fill('#q', '');
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
ok(/받기 → http.*#r=/.test(shareText), '공유글에 링크');
ok(shareText.includes('대기 없음 · 한산 · 주차 만석'), '공유글에 현장 정보');
ok(shareText.includes('— 리처드 특파원'), '공유글에 특파원');
const code = shareText.match(/#r=([A-Za-z0-9_-]+)/)[1];
ok(code[0] === '2', '압축 형식(2) 사용');
ok(code.length < 300, '링크 payload 짧음: ' + code.length + '자');
await page.locator('#shareBack [data-close]').last().click();

console.log('\n== 8. 저장/예시 사라짐 ==');
ok((await page.locator('#feed .card').count()) === 1, '내 리포트 1건만 (예시 사라짐)');
ok((await page.locator('#feed .badge').count()) === 0, '예시 배지 없음');
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
ok((await page2.locator('#inbox h2').textContent()).includes('1건이 도착'), '도착 알림');
await page2.locator('#inboxYes').click();
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


await finish(browser);
