/* "나도 여기" — 같은 장소의 지금 상황을 몇 번 눌러 알리기 */
import { ok, section, launch, context, openWith, report, finish, MIN } from './lib.mjs';

const b = await launch();
const c = await context(b, { viewport: { width: 390, height: 844 } });
const base = report({ id: 'ref00001', t: Date.now() - 14 * MIN, by: '민지', cat: 'play', place: '별빛 키즈카페',
  area: '안양 안양동', wait: 0, crowd: 0, park: 2, rate: 4, tags: ['아이동반', '실내'], note: '텅 비었어요' });
const bare = report({ id: 'ref00002', t: Date.now() - 50 * MIN, by: '준호', cat: 'food', place: '메모만 남긴 곳',
  note: '소금빵은 오전에만' });
const p = await openWith(c, [base, bare]);
const board = () => p.evaluate(() => JSON.parse(localStorage.getItem('tpw.v1')).reports);
const pressed = (grp) => p.locator(`#${grp} [aria-pressed="true"]`).innerText();
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
const tags = await p.locator('#fTags [aria-pressed="true"]').allInnerTexts();
ok(tags.join() === '#아이동반,#실내', '태그도 채운다: ' + tags.join(' '));
ok(await pressed('fWait') === '모름' && await pressed('fCrowd') === '모름' && await pressed('fPark') === '모름',
  '웨이팅·사람·주차는 채우지 않는다 (모름)');
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

await finish(b);
