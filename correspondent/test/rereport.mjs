/* "나도 여기" — 같은 장소의 지금 상황을 몇 번 눌러 알리기 */
import { ok, section, launch, context, openWith, report, finish, MIN, settle, shareReady } from './lib.mjs';

const b = await launch();
const c = await context(b, { viewport: { width: 390, height: 844 } });
const base = report({ id: 'ref00001', t: Date.now() - 14 * MIN, by: '민지', cat: 'play', place: '별빛 키즈카페',
  area: '안양 안양동', wait: 0, crowd: 0, park: 2, rate: 4, tags: ['아이동반', '실내'], note: '텅 비었어요' });
const bare = report({ id: 'ref00002', t: Date.now() - 50 * MIN, by: '준호', cat: 'food', place: '메모만 남긴 곳',
  note: '소금빵은 오전에만' });
const p = await openWith(c, [base, bare]);
const board = () => p.evaluate(() => JSON.parse(localStorage.getItem('tpw.v1')).reports);
const pressed = (grp) => p.locator(`#${grp} [aria-pressed="true"]`).innerText();
/* 웨이팅·사람·주차는 "모름" 칩이 없다 — 아무것도 안 눌린 게 모름이다 */
const blank = async (grp) => (await p.locator(`#${grp} [aria-pressed="true"]`).count()) === 0;
/* 시트는 30ms 뒤에 초점을 옮긴다 — 올 때까지 기다린다 */
const focusIs = (id) => p.waitForFunction((x) => document.activeElement && document.activeElement.id === x, id, { timeout: 2000 })
  .then(() => true, () => false);

section('단추');
ok(await p.locator('#feed .card', { hasText: '별빛 키즈카페' }).locator('[data-again]').count() === 1, '카드에 "나도 여기"');
{
  const s = await context(b);
  const sp = await openWith(s, null);   // 예시 보드
  ok(await sp.locator('#feed [data-again]').count() === 0, '예시 카드에는 없다 (지어낸 장소에 진짜 리포트가 붙지 않게)');
  await s.close();
}

section('채우는 것과 안 채우는 것');
await p.locator('#feed .card', { hasText: '별빛 키즈카페' }).locator('[data-again]').click();
await p.waitForSelector('#composeBack.open');
ok(await p.locator('#composeTitle').innerText() === '여기 지금 상황', '창 제목이 바뀐다');
ok(await p.inputValue('#fPlace') === '별빛 키즈카페' && await p.inputValue('#fArea') === '안양 안양동', '장소·동네는 채운다');
ok((await pressed('fCat')).replace(/\s+/g, ' ').trim() === '놀이공간', '분야도 채운다');
/* 태그는 "더 적기" 안에 접혀 있다 — 접힌 칸의 글자는 innerText 로 안 읽힌다 */
const tags = await p.locator('#fTags [aria-pressed="true"]').evaluateAll((els) => els.map((e) => e.textContent));
ok(tags.join() === '#아이동반,#실내', '태그도 채운다: ' + tags.join(' '));
ok(await blank('fWait') && await blank('fCrowd') && await blank('fPark'),
  '웨이팅·사람·주차는 채우지 않는다 (아무것도 안 눌림 = 모름)');
ok(await p.locator('#fRate button.on').count() === 0, '별점도 채우지 않는다 (내 평가라서)');
ok((await p.locator('#fRef').innerText()).includes('민지 특파원'), '앞 리포트가 누구 것인지 보인다');
ok((await p.locator('#fRefStats').innerText()).replace(/\s+/g, ' ') === '대기 없음 한산 주차 만석', '앞 리포트 값은 참고로 보인다');
ok(await focusIs('fRefSame'), '첫 초점은 "그대로예요"');

section('안 보고 그냥 보내면');
await p.locator('#composeGo').click();
await p.waitForTimeout(150);
ok(await p.locator('#composeBack.open').count() === 1, '막힌다 — 새 시각만 달린 빈 카드가 올라가지 않는다');
ok((await p.locator('#composeErr').innerText()).includes('그대로예요'), '  └ "그대로예요"를 알려 준다');
ok((await board()).length === 2, '  └ 아무것도 저장되지 않았다');
await p.fill('#fNote', '사람 조금 늘었어요');
await p.locator('#composeGo').click();
await p.waitForSelector('#shareBack.open');
await p.locator('#shareBack [data-close]').last().click();
let rs = await board();
const blind = rs.find((r) => r.id !== base.id && r.id !== bare.id);
ok(blind && blind.place === '별빛 키즈카페', '한 줄을 남기면 같은 장소로 새 리포트가 생긴다');
ok(blind.wait === -1 && blind.crowd === -1 && blind.park === -1, '  └ 고르지 않은 칸은 모름 — 옛 값이 새 시각을 달고 나가지 않는다');

section('"그대로예요"');
await p.locator('#feed .card', { hasText: '텅 비었어요' }).locator('[data-again]').click();
await p.waitForSelector('#composeBack.open');
await p.locator('#fRefSame').click();
ok(await p.getAttribute('#fRefSame', 'aria-pressed') === 'true', '누르면 눌린 상태');
ok(await pressed('fWait') === '바로 입장' && await pressed('fCrowd') === '한산' && await pressed('fPark') === '만석', '앞 값이 복사된다');
await p.locator('#fCrowd [data-v="2"]').click();
ok(await p.getAttribute('#fRefSame', 'aria-pressed') === 'false', '칩을 바꾸면 "그대로"가 풀린다');
await p.locator('#fCrowd [data-v="0"]').click();
ok(await p.getAttribute('#fRefSame', 'aria-pressed') === 'true', '다시 맞추면 "그대로"');
/* 이름을 이미 정한 사람은 이름 칸이 "더 적기" 안에 있다 */
ok(await p.locator('#fBy').isHidden(), '이름을 정했으면 이름 칸은 "더 적기" 안에 접혀 있다');
await p.locator('#fMore summary').click();
await p.fill('#fBy', '서연');
await p.locator('#composeGo').click();
await p.waitForSelector('#shareBack.open');
await p.locator('#shareBack [data-close]').last().click();
rs = await board();
const same = rs.find((r) => r.by === '서연');
ok(same && same.wait === 0 && same.crowd === 0 && same.park === 2, '확인한 값으로 올라간다');
ok(same && Date.now() - same.t < MIN, '시각은 지금');

section('장소 창에서');
await p.locator('.tab[data-view="places"]').click();
const pl = p.locator('#places .pl', { hasText: '별빛 키즈카페' });
ok((await pl.innerText()).includes('리포트 3건'), '같은 장소로 묶인다 (3건)');
ok((await pl.innerText()).includes('특파원 3명'), '특파원 3명 — 한 사람이 한 번 본 곳보다 무겁다');
await pl.click();
await p.waitForSelector('#placeBack.open');
await p.locator('#placeAgain').click();
await p.waitForSelector('#composeBack.open');
ok((await p.locator('#fRefWho').innerText()).startsWith('서연'), '장소 창에서 누르면 가장 최근 리포트를 참고로');
await p.keyboard.press('Escape');

section('메모만 있는 리포트에서');
await p.locator('.tab[data-view="feed"]').click();
await p.locator('#feed .card', { hasText: '메모만 남긴 곳' }).locator('[data-again]').click();
await p.waitForSelector('#composeBack.open');
ok(await p.locator('#fRefSame').isHidden(), '옮길 값이 없으면 "그대로예요"도 없다');
ok((await p.locator('#fRefStats').innerText()).includes('메모만'), '  └ 그렇다고 알려 준다');
await p.locator('#composeGo').click();
await p.waitForTimeout(150);
ok(await p.evaluate(() => document.activeElement.id) === 'fNote', '  └ 빈 채로 보내면 한 줄 칸으로 안내');
await p.keyboard.press('Escape');

section('보통 "리포트 보내기" 는 그대로');
await p.locator('#writeBtn').click();
await p.waitForSelector('#composeBack.open');
ok(await p.locator('#fRef').isHidden(), '참고 상자 없음');
ok(await p.inputValue('#fPlace') === '', '장소 비어 있음');
ok(await p.locator('#composeTitle').innerText() === '리포트 보내기', '제목 원래대로');
ok(await focusIs('fPlace'), '첫 초점은 장소 칸');

/* ── 아래부터는 "리포트 보내기"로 열어도 아는 곳이면 같은 장소로 가게 · 쓰던 글 붙잡기 · 빈 리포트 막기 · 칩 초점 ── */
const PHONE = { viewport: { width: 390, height: 844 } };
const livePressed = (q) => q.locator('#fWait [aria-pressed="true"], #fCrowd [aria-pressed="true"], #fPark [aria-pressed="true"]')
  .evaluateAll((els) => els.map((e) => e.textContent).join());
const catPressed = (q) => q.locator('#fCat [aria-pressed="true"]').evaluate((e) => e.textContent.trim());
const openWrite = async (q) => { await q.locator('#writeBtn').click(); await q.waitForSelector('#composeBack.open'); await settle(q); };
const refShown = (q) => q.waitForFunction(() => !document.querySelector('#fRef').hidden, null, { timeout: 2000 }).then(() => true, () => false);

section('아는 장소 이름을 치면 — 분야·동네가 따라오고 "나도 여기"가 된다');
{
  const c2 = await context(b, PHONE);
  const q = await openWith(c2, [
    report({ id: 'kn000001', t: Date.now() - 38 * MIN, by: '준호', cat: 'food', place: '만안 손칼국수', area: '안양 안양동',
      wait: 10, crowd: 2, park: 1, tags: ['포장가능', '유아의자'] }),
    report({ id: 'kn000002', t: Date.now() - 2 * 60 * MIN, by: '나', cat: 'cafe', place: '온기 로스터리', area: '평촌 범계동', crowd: 1 })
  ]);
  await openWrite(q);
  ok(await catPressed(q) === '카페' && await q.inputValue('#fArea') === '평촌 범계동',
    '새 리포트의 분야·동네는 내가 마지막으로 쓴 것 (늘 놀이공간이 아니라 카페 · 평촌 범계동)');
  await q.fill('#fPlace', '만안 손칼국수');
  await q.locator('#fPlace').dispatchEvent('change');   // 자동완성 목록에서 고른 것처럼
  ok(await catPressed(q) === '맛집', '아는 장소면 분야가 그 장소 것으로 (맛집)');
  ok(await q.inputValue('#fArea') === '안양 안양동', '  └ 동네도 그 장소 것으로 (접힌 "더 적기" 안의 지난 동네가 아니라)');
  ok(await q.locator('#fRefSame').isVisible() && await q.locator('#composeTitle').innerText() === '여기 지금 상황',
    '  └ "나도 여기" 차림 — 앞 리포트와 "그대로예요"');
  ok((await q.locator('#fRefWho').innerText()).includes('안양 안양동'), '  └ 어느 동네의 그곳인지 참고 상자에 보인다');
  const tg = await q.locator('#fTags [aria-pressed="true"]').evaluateAll((els) => els.map((e) => e.textContent).sort());
  ok(tg.join() === '#유아의자,#포장가능', '  └ 태그도 채운다: ' + tg.join(' '));
  ok(await livePressed(q) === '', '  └ 웨이팅·사람·주차는 채우지 않는다');
  await q.locator('#fRefSame').click();
  ok(await livePressed(q) === '10분,붐빔,보통', '"그대로예요"를 눌러야 옮겨진다');
  /* 이름을 고쳐 다른 곳이 되면 원래대로 */
  await q.fill('#fPlace', '만안 손칼국수 2호점');
  await q.locator('#fPlace').dispatchEvent('change');
  ok(await q.locator('#fRef').isHidden() && await q.locator('#composeTitle').innerText() === '리포트 보내기',
    '이름을 고쳐 다른 곳이 되면 "나도 여기"가 풀린다');
  ok(await catPressed(q) === '카페' && await q.inputValue('#fArea') === '평촌 범계동' &&
     await q.locator('#fTags [aria-pressed="true"]').count() === 0, '  └ 분야·동네·태그도 원래대로');
  ok(await livePressed(q) === '', '  └ "그대로예요"로 옮긴 값도 비운다 — 그 장소 이야기였다');
  /* 치기만 해도 잠깐 뒤에 알아본다 — 띄어쓰기는 안 본다 */
  await q.fill('#fPlace', '만안손칼국수');
  ok(await refShown(q) && await catPressed(q) === '맛집', '치기만 해도 잠깐 뒤에 알아본다 (띄어쓰기는 안 본다)');
  await q.locator('#fRefSame').click();
  await q.locator('#composeGo').click();
  await q.waitForSelector('#shareBack.open');
  await q.keyboard.press('Escape');
  const gs = await q.evaluate(() => groups().filter((g) => norm(g.place) === '만안손칼국수').map((g) => g.n));
  ok(gs.length === 1 && gs[0] === 2, '보내면 같은 장소 한 묶음에 더해진다 (묶음 ' + gs.length + '개, ' + gs[0] + '건)');
  const sent = (await q.evaluate(() => JSON.parse(localStorage.getItem('tpw.v1')).reports))[0];
  ok(sent.cat === 'food' && sent.area === '안양 안양동' && sent.wait === 10 && sent.crowd === 2,
    '  └ 맛집 · 안양 안양동 · 확인한 값으로: ' + [sent.cat, sent.area, sent.wait, sent.crowd].join(' · '));
  await c2.close();
}

section('같은 이름이 여러 동네에 — "어느 동네예요?"');
{
  const c3 = await context(b, PHONE);
  const q = await openWith(c3, [
    report({ id: 'sb000001', t: Date.now() - 20 * MIN, by: '민지', cat: 'cafe', place: '스타벅스', area: '안양 안양동', crowd: 1 }),
    report({ id: 'sb000002', t: Date.now() - 40 * MIN, by: '준호', cat: 'cafe', place: '스타벅스', area: '평촌 범계동', crowd: 2 })
  ]);
  const opts = await q.evaluate(() => Array.from(document.querySelectorAll('#placeList option')).map((o) => o.value + ' / ' + o.label));
  ok(opts.length === 2 && opts.includes('스타벅스 / 안양 안양동 · 카페') && opts.includes('스타벅스 / 평촌 범계동 · 카페'),
    '자동완성 목록은 장소마다 하나, "동네 · 분야"를 붙여 가려 보인다: ' + opts.join(' | '));
  await openWrite(q);
  ok(await catPressed(q) === '놀이공간', '내가 쓴 리포트가 없으면 분야는 놀이공간');
  await q.fill('#fPlace', '스타벅스');
  await q.locator('#fPlace').dispatchEvent('change');
  const chips = await q.locator('#fPick [data-pick]').allInnerTexts();
  ok(await q.locator('#fPick').isVisible() && (await q.locator('#fPick').innerText()).includes('어느 동네예요?') &&
     chips.join() === '안양 안양동,평촌 범계동,다른 곳', '두 동네에 있으면 묻는다: ' + chips.join(' · '));
  ok(await q.locator('#fRef').isHidden(), '  └ 고르기 전엔 어느 곳도 참고하지 않는다');
  const pick = q.locator('#fPick [data-pick]', { hasText: '평촌 범계동' });
  await pick.click();
  ok(await pick.getAttribute('aria-pressed') === 'true' && await q.inputValue('#fArea') === '평촌 범계동' &&
     await catPressed(q) === '카페' && (await q.locator('#fRefWho').innerText()).startsWith('준호'),
    '고르면 그 동네의 그곳으로 — 동네·분야가 채워지고 그곳의 앞 리포트가 보인다');
  ok(await pick.evaluate((el) => el === document.activeElement), '  └ 누른 칩에 초점이 남는다');
  await q.locator('#fPick [data-pick]', { hasText: '다른 곳' }).click();
  ok(await q.locator('#fRef').isHidden() && await q.evaluate(() => document.querySelector('#fMore').open) &&
     await q.evaluate(() => document.activeElement.id) === 'fArea', '"다른 곳"이면 참고를 풀고 동네 칸으로');
  await q.fill('#fArea', '안양동');
  ok(await refShown(q) && (await q.locator('#fRefWho').innerText()).startsWith('민지') && await q.locator('#fPick').isHidden(),
    '  └ 동네를 손으로 적으면 그 동네의 그곳 — 더 묻지 않는다');
  await c3.close();
}

section('빈 장소 칸 — 아는 곳을 한 번에');
{
  const c4 = await context(b, PHONE);
  const q = await openWith(c4, [
    report({ t: Date.now() - 5 * 60 * MIN, by: '민지', cat: 'play', place: '별빛 키즈카페', area: '안양 안양동', crowd: 1 }),
    report({ t: Date.now() - 20 * MIN, by: '준호', cat: 'food', place: '만안 손칼국수', area: '안양 안양동', wait: 10, crowd: 2 }),
    report({ t: Date.now() - 50 * MIN, by: '태오', cat: 'food', place: '구산 돈까스', area: '안양 비산동', wait: 60, crowd: 3 }),
    report({ t: Date.now() - 26 * 60 * MIN, by: '나', cat: 'cafe', place: '온기 로스터리', area: '평촌 범계동', crowd: 1 }),
    report({ t: Date.now() - 27 * 60 * MIN, by: '나', cat: 'cafe', place: '들판 베이커리', area: '평촌 범계동', crowd: 0 }),
    report({ t: Date.now() - 30 * 60 * MIN, by: '서연', cat: 'trip', place: '수리산 임도길', area: '안양 안양동', note: '메모만' })
  ], { watch: [{ k: '별빛키즈카페|안양동', nm: '별빛 키즈카페', ar: '안양 안양동', seen: 0 }] });
  await openWrite(q);
  const sug = await q.locator('#fSug [data-sug]').allInnerTexts();
  ok(await q.locator('#fSug').isVisible() && sug.join() === '별빛 키즈카페,만안 손칼국수,구산 돈까스,온기 로스터리',
    '빈 칸 밑에 넷까지 — 지켜보는 곳, 지금 소식 있는 곳, 내가 최근에 쓴 곳 순: ' + sug.join(' · '));
  await q.fill('#fPlace', '별');
  ok(await q.locator('#fSug').isHidden(), '  └ 치기 시작하면 숨는다');
  await q.fill('#fPlace', '');
  ok(await q.locator('#fSug').isVisible(), '  └ 다 지우면 다시 보인다');
  await q.locator('#fSug [data-sug]', { hasText: '만안 손칼국수' }).click();
  ok(await q.inputValue('#fPlace') === '만안 손칼국수' && await catPressed(q) === '맛집' &&
     await q.inputValue('#fArea') === '안양 안양동' && await q.locator('#fRefSame').isVisible(),
    '누르면 그 이름을 친 것과 같다 — 분야·동네가 따라오고 "나도 여기"');
  ok(await q.evaluate(() => document.activeElement.id) === 'fRefSame' && await q.locator('#fSug').isHidden(),
    '  └ 칩 줄은 숨고 초점은 "그대로예요"로');
  await c4.close();
  const c5 = await context(b, PHONE);
  const sp = await openWith(c5, null);   // 예시 보드
  await openWrite(sp);
  ok(await sp.locator('#fSug').isHidden() && await sp.locator('#placeList option').count() === 0,
    '예시 보드에선 권하지 않는다 — 지어낸 곳에 진짜 리포트가 붙지 않게');
  await sp.fill('#fPlace', '별빛 키즈카페');
  await sp.locator('#fPlace').dispatchEvent('change');
  ok(await sp.locator('#fRef').isHidden(), '  └ 예시 장소 이름을 쳐도 "나도 여기"가 되지 않는다');
  await c5.close();
  /* 링크로 온 긴 이름·동네(40자·30자, 띄어쓰기 없이)도 320px 시트 밖으로 삐져나가지 않는다 */
  const cL = await context(b, { viewport: { width: 320, height: 640 } });
  const nm = 'ㅎ'.repeat(40), ar = (d) => 'ㅋ'.repeat(26) + ' ' + d + '동';
  const lp = await openWith(cL, [report({ t: Date.now() - 10 * MIN, by: '가', place: nm, area: ar(1), crowd: 1 }),
    report({ t: Date.now() - 20 * MIN, by: '나', place: nm, area: ar(2), crowd: 2 })]);
  const over = () => lp.evaluate(() => { const s = document.querySelector('#composeBack .sheet'); return s.scrollWidth - s.clientWidth; });
  await openWrite(lp);
  const o1 = await over(), sugN = await lp.locator('#fSug [data-sug]:visible').count();
  await lp.fill('#fPlace', nm);
  await lp.locator('#fPlace').dispatchEvent('change');
  const o2 = await over();
  ok(sugN === 2 && await lp.locator('#fPick [data-pick]:visible').count() === 3 && o1 <= 0 && o2 <= 0,
    '긴 이름·동네도 칩 안에서 줄을 바꾼다 — 가로로 넘치지 않는다 (아는 곳 ' + o1 + 'px · 어느 동네 ' + o2 + 'px)');
  await cL.close();
}

section('쓰던 리포트 — 창이 닫혀도 날아가지 않는다');
{
  const c6 = await context(b, PHONE);
  const q = await openWith(c6, [
    report({ id: 'dr000001', t: Date.now() - 30 * MIN, by: '민지', cat: 'play', place: '별빛 키즈카페', area: '안양 안양동', wait: 0, crowd: 1 }),
    report({ id: 'dr000002', t: Date.now() - 50 * MIN, by: '준호', cat: 'food', place: '구산 돈까스', area: '안양 비산동', wait: 60, crowd: 3 })
  ]);
  const form = () => q.evaluate(() => ({ place: document.querySelector('#fPlace').value, area: document.querySelector('#fArea').value,
    note: document.querySelector('#fNote').value, by: document.querySelector('#fBy').value,
    cat: document.querySelector('#fCat [aria-pressed="true"]').textContent.trim(),
    live: Array.from(document.querySelectorAll('#fWait [aria-pressed="true"],#fCrowd [aria-pressed="true"],#fPark [aria-pressed="true"]')).map((x) => x.textContent).join(),
    rate: document.querySelectorAll('#fRate .on').length,
    tags: Array.from(document.querySelectorAll('#fTags [aria-pressed="true"]')).map((x) => x.textContent).join(),
    ref: document.querySelector('#fRef').hidden ? '' : document.querySelector('#fRefWho').textContent }));
  await openWrite(q);
  await q.fill('#fPlace', '쓰다 만 곳');
  await q.locator('#fCat [data-v="cafe"]').click();
  await q.locator('#fCrowd [data-v="2"]').click();
  await q.fill('#fNote', '줄이 길어요');
  await q.locator('#fMore summary').click();
  await q.fill('#fArea', '평촌 범계동');
  await q.locator('#fRate [data-star="3"]').click();
  await q.locator('#fTags [data-tag="실내"]').click();
  const before = await form();
  await q.goBack();
  await q.waitForFunction(() => !document.querySelector('#composeBack.open'), null, { timeout: 3000 }).catch(() => {});
  ok(await q.locator('#composeBack.open').count() === 0, '쓰다가 뒤로 가기 — 창은 닫힌다');
  await openWrite(q);
  ok(JSON.stringify(await form()) === JSON.stringify(before),
    '  └ 다시 열면 쓰던 그대로 (장소·동네·분야·칩·한 줄·별점·태그·이름): ' + JSON.stringify(before));
  await q.fill('#fNote', '줄이 길어요 20명쯤');
  await q.mouse.click(195, 20);   // 시트 위 어두운 곳
  await q.waitForFunction(() => !document.querySelector('#composeBack.open'), null, { timeout: 3000 }).catch(() => {});
  await openWrite(q);
  ok(await q.inputValue('#fNote') === '줄이 길어요 20명쯤', '바깥을 눌러 닫아도 남는다');
  await q.keyboard.press('Escape');
  await q.reload({ waitUntil: 'networkidle' });
  await openWrite(q);
  let now = await form();
  ok(now.place === '쓰다 만 곳' && now.note === '줄이 길어요 20명쯤' && now.live === '붐빔' && now.rate === 3,
    '새로 고침해도 남는다 (이 탭 안에서)');
  await q.locator('#composeGo').click();
  await q.waitForSelector('#shareBack.open');
  await q.keyboard.press('Escape');
  await openWrite(q);
  now = await form();
  ok(now.place === '' && now.note === '' && now.live === '' && !now.ref, '보내면 지운다 — 다음엔 빈 창');
  await q.keyboard.press('Escape');
  /* "나도 여기"로 쓰던 글은 그 장소에만 */
  const again = async (name) => { await q.locator('#feed .card', { hasText: name }).locator('[data-again]').click();
    await q.waitForSelector('#composeBack.open'); await settle(q); };
  await again('별빛 키즈카페');
  await q.fill('#fNote', '별빛에서 쓰던 말');
  await q.keyboard.press('Escape');
  await again('구산 돈까스');
  ok(await q.inputValue('#fPlace') === '구산 돈까스' && await q.inputValue('#fNote') === '',
    '"나도 여기"로 쓰던 글은 다른 장소에 옮겨 붙지 않는다');
  await q.keyboard.press('Escape');
  await again('별빛 키즈카페');
  ok(await q.inputValue('#fNote') === '별빛에서 쓰던 말', '  └ 같은 장소로 다시 열면 되살린다');
  await q.keyboard.press('Escape');
  await openWrite(q);
  ok(await q.inputValue('#fPlace') === '별빛 키즈카페' && await q.inputValue('#fNote') === '별빛에서 쓰던 말' &&
     (await q.locator('#fRefWho').innerText()).startsWith('민지'), '  └ "리포트 보내기"로 열어도 그 장소를 참고하던 그대로 이어 쓴다');
  /* 오래 묵은 글의 웨이팅·사람·주차는 되살리지 않는다 — 옛 정보가 새 시각을 달고 나가지 않게 */
  await q.locator('#fCrowd [data-v="0"]').click();
  await q.keyboard.press('Escape');
  await q.evaluate(() => { const d = JSON.parse(sessionStorage.getItem('tpw.draft')); d.at -= 31 * 60e3;
    sessionStorage.setItem('tpw.draft', JSON.stringify(d)); });
  await q.reload({ waitUntil: 'networkidle' });
  await openWrite(q);
  now = await form();
  ok(now.note === '별빛에서 쓰던 말' && now.live === '', '30분 넘게 묵은 글은 웨이팅·사람·주차만 빼고 되살린다: ' + JSON.stringify(now));
  /* 이름은 이 창에서 손으로 적었을 때만 되살린다 — 그사이 특파원 탭에서 바꾼 이름을 옛 이름으로 덮지 않게 */
  await q.keyboard.press('Escape');
  await q.locator('.tab[data-view="people"]').click();
  await q.locator('#meEdit').click();
  await q.fill('#meInput', '새이름');
  await q.locator('#meSave').click();
  await q.locator('.tab[data-view="feed"]').click();
  await openWrite(q);
  ok(await q.inputValue('#fBy') === '새이름' && await q.inputValue('#fNote') === '별빛에서 쓰던 말',
    '  └ 그사이 바꾼 내 이름은 그대로 — 쓰던 글만 되살린다');
  await c6.close();
}

section('메모뿐인 최근 리포트 — 참고는 그 앞의 현장 정보로');
{
  const c7 = await context(b, PHONE);
  const q = await openWith(c7, [
    report({ id: 'mo000001', t: Date.now() - 20 * MIN, by: '민지', cat: 'play', place: '구름 놀이터', area: '안양 비산동', wait: 0, crowd: 0, park: 1, tags: ['야외'] }),
    report({ id: 'mo000002', t: Date.now() - 5 * MIN, by: '준호', cat: 'play', place: '구름 놀이터', area: '안양 비산동', note: '사장님 오늘 친절하세요' }),
    report({ id: 'mo000003', t: Date.now() - 9 * MIN, by: '서연', cat: 'food', place: '메모뿐인 곳', note: '소금빵은 오전에만' })
  ]);
  await q.locator('.tab[data-view="places"]').click();
  await q.locator('#places .pl', { hasText: '구름 놀이터' }).click();
  await q.waitForSelector('#placeBack.open');
  const sheetChips = (await q.locator('#placeBody .det-head .stat').allInnerTexts()).join(' ');
  await q.locator('#placeAgain').click();
  await q.waitForSelector('#composeBack.open');
  const refChips = (await q.locator('#fRefStats .stat').allInnerTexts()).join(' ');
  ok(refChips === '대기 없음 한산 주차 보통' && refChips === sheetChips,
    '장소 창의 "여기 지금 상황 알리기" — 장소 창에 보이던 그 칩을 참고로: ' + refChips);
  ok(await q.locator('#fRefSame').isVisible() && (await q.locator('#fRefWho').innerText()).startsWith('민지') &&
     (await q.locator('#fTags [aria-pressed="true"]').evaluateAll((els) => els.map((e) => e.textContent))).join() === '#야외',
    '  └ "그대로예요"도 있고 태그도 채운다 (메모뿐인 준호 것이 아니라 민지 것)');
  await q.fill('#fPlace', '구름 놀이터 2호점');
  await q.locator('#fPlace').dispatchEvent('change');
  ok(await q.locator('#fRef').isHidden() && await q.locator('#fTags [aria-pressed="true"]').count() === 0 &&
     await catPressed(q) === '놀이공간' && await q.inputValue('#fArea') === '안양 비산동',
    '  └ 이름을 고쳐 다른 곳이 되면 참고를 풀고, 채워 준 태그는 뺀다 (그곳 이야기라서 — 분야·동네는 둔다)');
  await q.keyboard.press('Escape');
  await q.locator('.tab[data-view="feed"]').click();
  await q.locator('#feed [data-again="mo000002"]').click();
  await q.waitForSelector('#composeBack.open');
  ok((await q.locator('#fRefWho').innerText()).startsWith('민지') && await q.locator('#fRefSame').isVisible(),
    '메모뿐인 카드의 "나도 여기"도 그 장소의 현장 정보를 참고로');
  await q.keyboard.press('Escape');
  await q.locator('#feed [data-again="mo000003"]').click();
  await q.waitForSelector('#composeBack.open');
  ok(await q.locator('#fRefSame').isHidden() && (await q.locator('#fRef .ref-n').innerText()).trim() === '지금 보이는 대로 골라 주세요.',
    '현장 정보가 아예 없는 곳 — "그대로예요" 이야기는 빼고 "지금 보이는 대로 골라 주세요."만');
  await c7.close();
}

section('링크로 온 모르는 태그 — 쓰기 창에 옮기지 않는다');
{
  const c8 = await context(b, PHONE);
  const q = await openWith(c8, [report({ id: 'ft000001', t: Date.now() - 20 * MIN, by: '광고', cat: 'play', place: '별빛 키즈카페',
    area: '안양동', crowd: 1, tags: ['010-1234-567', '대출상담', '실내', '홍보문의', '카톡ID abc', '무료쿠폰'] })]);
  await q.locator('#feed [data-again="ft000001"]').click();
  await q.waitForSelector('#composeBack.open');
  const pt = await q.locator('#fTags [aria-pressed="true"]').evaluateAll((els) => els.map((e) => e.textContent));
  ok(pt.join() === '#실내', '쓰기 창에 있는 태그만 채운다: ' + pt.join(' '));
  await q.locator('#fMore summary').click();
  await q.locator('#fTags [data-tag="아이동반"]').click();
  ok(await q.getAttribute('#fTags [data-tag="아이동반"]', 'aria-pressed') === 'true',
    '  └ 안 보이는 태그가 여섯 칸을 차지하지 않는다 (더 고를 수 있다)');
  await q.locator('#fRefSame').click();
  await q.locator('#composeGo').click();
  const share = await shareReady(q);
  const mineR = (await q.evaluate(() => JSON.parse(localStorage.getItem('tpw.v1')).reports)).find((r) => r.mine);
  ok(mineR.tags.join() === '실내,아이동반' && !/010|대출|홍보|카톡ID|쿠폰/.test(share),
    '  └ 내 리포트와 공유 글에 모르는 태그가 실리지 않는다: ' + mineR.tags.join(','));
  await c8.close();
}

section('빈 리포트는 안 나간다 — 까닭은 보내기 바로 위, 화면 안에');
for (const [w, h] of [[390, 844], [320, 568]]) {
  const c9 = await context(b, { viewport: { width: w, height: h } });
  const q = await openWith(c9, [report({ t: Date.now() - 20 * MIN, by: '민지', place: '아무 데', crowd: 1 })]);
  const errSeen = () => q.evaluate(() => { const e = document.querySelector('#composeErr'), r = e.getBoundingClientRect();
    return r.height > 0 && r.top >= 0 && r.bottom <= innerHeight && e.closest('.sheet-foot') !== null; });
  const saved = () => q.evaluate(() => JSON.parse(localStorage.getItem('tpw.v1')).reports.length);
  await openWrite(q);
  await q.locator('#composeGo').click();
  ok(await q.locator('#composeErr').innerText() === '어디에 계신지 적어 주세요.' && await errSeen(),
    w + 'px: 장소가 비었으면 막고, 까닭이 보내기 바로 위에 보인다');
  ok(await q.getAttribute('#fPlace', 'aria-invalid') === 'true' && await q.getAttribute('#fPlace', 'aria-describedby') === 'composeErr' &&
     await q.evaluate(() => document.activeElement.id) === 'fPlace', '  └ 장소 칸에 aria-invalid·aria-describedby, 초점도 거기');
  await q.fill('#fPlace', '이름만 적은 곳');
  ok(await q.getAttribute('#fPlace', 'aria-invalid') === null && await q.locator('#composeErr').innerText() === '', '  └ 고치면 걷힌다');
  await q.locator('#composeGo').click();
  ok(await q.locator('#composeErr').innerText() === '지금 어떤지 하나라도 고르거나 한 줄 남겨 주세요.' && await errSeen() &&
     await saved() === 1 && await q.locator('#composeBack.open').count() === 1,
    '  └ 장소 이름만 있으면 막는다 — 단톡방에 빈 카드가 가지 않게');
  ok(await q.getAttribute('#fNow', 'aria-invalid') === 'true' && await q.getAttribute('#fNow', 'aria-describedby') === 'composeErr' &&
     await q.evaluate(() => !!document.activeElement.closest('#fWait') && document.activeElement.dataset.v === '0'),
    '  └ "지금 어때요?"에 aria-invalid, 초점은 첫 웨이팅 칩');
  await q.keyboard.press('Space');
  ok(await q.getAttribute('#fNow', 'aria-invalid') === null && await q.locator('#composeErr').innerText() === '',
    '  └ 하나 고르면 걷힌다');
  await c9.close();
}
{
  /* 태그 하나도 남길 말이다 */
  const c10 = await context(b, PHONE);
  const q = await openWith(c10, [report({ t: Date.now() - 20 * MIN, by: '민지', place: '아무 데', crowd: 1 })]);
  await openWrite(q);
  await q.fill('#fPlace', '태그만 남긴 곳');
  await q.locator('#fMore summary').click();
  await q.locator('#fTags [data-tag="주차무료"]').click();
  await q.locator('#composeGo').click();
  ok(await q.waitForSelector('#shareBack.open', { timeout: 3000 }).then(() => true, () => false), '태그·별점·한 줄 가운데 하나만 있어도 보내진다');
  await c10.close();
}

section('칩을 눌러도 초점은 그 칩에 — 읽는 프로그램이 "눌림"을 듣는다');
for (const scheme of ['light', 'dark']) {
  const c11 = await context(b, { colorScheme: scheme, viewport: { width: 390, height: 844 } });
  const q = await openWith(c11, [report({ t: Date.now() - 20 * MIN, by: '민지', place: '아무 데', crowd: 1 })]);
  await openWrite(q);
  /* 안 고른 별(☆)도 시트 바탕과 3:1 넘게 */
  const cr = await q.evaluate(() => {
    const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number).slice(0, 3).map((v) => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
      return .2126 * m[0] + .7152 * m[1] + .0722 * m[2]; };
    const a = lum(getComputedStyle(document.querySelector('#fRate [data-star="5"]')).color);
    const z = lum(getComputedStyle(document.querySelector('#composeBack .sheet')).backgroundColor);
    return (Math.max(a, z) + .05) / (Math.min(a, z) + .05);
  });
  ok(cr >= 3, (scheme === 'light' ? '밝게' : '어둡게') + ': 안 고른 별도 또렷하다 — 바탕과 ' + cr.toFixed(2) + ':1');
  if (scheme === 'dark') { await c11.close(); continue; }
  const chip = q.locator('#fWait [data-v="10"]');
  await chip.focus();
  await q.keyboard.press('Space');
  ok(await chip.getAttribute('aria-pressed') === 'true' && await chip.evaluate((el) => el === document.activeElement),
    'Space 로 누르면 눌림 — 초점은 그 칩에 그대로 (<body> 로 떨어지지 않는다)');
  await q.keyboard.press('Tab');
  ok(await q.evaluate(() => document.activeElement.dataset.v) === '30', '  └ 다음 Tab 은 옆 칩으로');
  const cat = q.locator('#fCat [data-v="trip"]');
  await cat.focus();
  await q.keyboard.press('Enter');
  ok(await cat.getAttribute('aria-pressed') === 'true' && await cat.evaluate((el) => el === document.activeElement), '분야 칩도');
  await q.locator('#fMore summary').click();
  const tag = q.locator('#fTags [data-tag="그늘"]');
  await tag.focus();
  await q.keyboard.press('Space');
  ok(await tag.getAttribute('aria-pressed') === 'true' && await tag.evaluate((el) => el === document.activeElement), '태그 칩도');
  const star = q.locator('#fRate [data-star="3"]');
  await star.focus();
  await q.keyboard.press('Space');
  const stars = (await q.locator('#fRate [data-star]').allTextContents()).join('');
  ok(stars === '★★★☆☆' && await star.getAttribute('aria-pressed') === 'true' && await star.evaluate((el) => el === document.activeElement),
    '별: 고른 데까지 ★, 나머지는 ☆ — 초점도 그대로 (' + stars + ')');
  await c11.close();
}

section('이름 없이 보냈어도 — 이름 칸은 위에서 계속 묻는다');
{
  const c12 = await context(b, PHONE);
  const q = await openWith(c12, [report({ t: Date.now() - 20 * MIN, by: '이름 없는 특파원', place: '아무 데', crowd: 1, mine: true })],
    { me: '이름 없는 특파원' });
  const row = () => q.evaluate(() => { const r = document.querySelector('#fByRow'), m = document.querySelector('#fMore');
    return !m.contains(r) && !!(r.compareDocumentPosition(m) & Node.DOCUMENT_POSITION_FOLLOWING); });
  await openWrite(q);
  ok(await q.locator('#fBy').isVisible() && await row(), '"이름 없는 특파원"은 정한 이름이 아니다 — 이름 칸이 "더 적기" 위에');
  ok(await q.inputValue('#fBy') === '' && await q.getAttribute('#fBy', 'placeholder') === '예: 리처드' &&
     !(await q.locator('#fMoreHint').innerText()).includes('이름'), '  └ 칸은 비어 있고(예시 글자만) "더 적기"에도 이름은 없다');
  await q.fill('#fPlace', '또 이름 없이');
  await q.locator('#fCrowd [data-v="0"]').click();
  await q.locator('#composeGo').click();
  await q.waitForSelector('#shareBack.open');
  await q.keyboard.press('Escape');
  const st = await q.evaluate(() => { const x = JSON.parse(localStorage.getItem('tpw.v1')); return { me: x.me, by: x.reports[0].by }; });
  ok(st.by === '이름 없는 특파원' && st.me === '이름 없는 특파원', '  └ 이름 없이 보내면 전처럼 "이름 없는 특파원"으로 남는다');
  await openWrite(q);
  ok(await q.locator('#fBy').isVisible() && await row() && await q.inputValue('#fBy') === '', '  └ 그 뒤에도 계속 위에서 묻는다');
  await q.fill('#fBy', '하늘');
  await q.fill('#fPlace', '이름 정한 곳');
  await q.locator('#fCrowd [data-v="1"]').click();
  await q.locator('#composeGo').click();
  await q.waitForSelector('#shareBack.open');
  await q.keyboard.press('Escape');
  await openWrite(q);
  ok(await q.locator('#fBy').isHidden() && await q.inputValue('#fBy') === '하늘', '이름을 정하면 그때부터 "더 적기" 안으로');
  await c12.close();
}

await finish(b);
