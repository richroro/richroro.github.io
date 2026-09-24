/* 쌓인 리포트를 읽는 눈 — 같게 봤다(교차 확인), 보통은(지난 기록), 지켜보는 곳, 지금 갈 만한 곳 고침.
   시계를 토요일 12:30(서울)에 멈춰 두고 본다 — 요일·시간대 칸이 날마다 달라지면 검사가 흔들린다. */
import { ok, section, launch, context, openWith, report, finish, MIN } from './lib.mjs';

const NOW = new Date('2026-09-26T12:30:00+09:00').getTime();   // 토요일 점심
const at = (iso) => new Date(iso + '+09:00').getTime();
const H = 60 * MIN;
const b = await launch();

async function page(reports, extra, opts) {
  const c = await context(b, Object.assign({ viewport: { width: 420, height: 900 } }, opts || {}));
  await c.clock.setFixedTime(NOW);
  return openWith(c, reports, extra);
}
const flat = (s) => s.replace(/\s+/g, ' ').trim();
const text = async (loc) => flat(await loc.innerText());
const places = async (p) => { await p.locator('.tab[data-view="places"]').click(); };
const row = (p, name) => p.locator('#places .pl', { hasText: name });
const openPlace = async (p, name) => {
  await places(p);
  await row(p, name).click();
  await p.waitForSelector('#placeBack.open');
};
const toastText = (p) => p.locator('#toast').innerText();
/** 남이 보낸 링크를 받는 것처럼 — 앱의 pack() 으로 싣고 해시로 연다. */
async function receive(p, reps) {
  const code = await p.evaluate(async (rs) => pack(rs.map((r) => sane(r))), reps);
  await p.evaluate((c) => { location.hash = '#r=' + c; }, code);
  await p.waitForSelector('#inboxYes');
  await p.locator('#inboxYes').click();
}

/* ─────────────────────────── 같게 봤다 ─────────────────────────── */
section('같게 봤다 — 교차 확인');
{
  const p = await page([
    report({ t: NOW - 20 * MIN, by: '민지', place: '만안 손칼국수', wait: 10, crowd: 1, park: 1 }),
    report({ t: NOW - 70 * MIN, by: '준호', place: '만안 손칼국수', wait: 10, crowd: 1 }),              // 주차는 모름
    report({ t: NOW - 15 * MIN, by: '서연', place: '혼자 두 번', crowd: 0 }),
    report({ t: NOW - 60 * MIN, by: '서연', place: '혼자 두 번', crowd: 0 }),
    report({ t: NOW - 10 * MIN, by: '가', place: '다르게 본 곳', crowd: 0 }),
    report({ t: NOW - 40 * MIN, by: '나', place: '다르게 본 곳', crowd: 2 }),
    report({ t: NOW - 5 * MIN, by: '다', place: '셋이 본 곳', crowd: 1, wait: 0 }),
    report({ t: NOW - 30 * MIN, by: '라', place: '셋이 본 곳', crowd: 1 }),
    report({ t: NOW - 50 * MIN, by: '마', place: '셋이 본 곳', crowd: 3 }),
    report({ t: NOW - 20 * MIN, by: '바', place: '한참 전 확인', crowd: 0 }),
    report({ t: NOW - 5 * H, by: '사', place: '한참 전 확인', crowd: 0 })                             // 3시간 밖
  ]);
  await places(p);
  const r1 = await text(row(p, '만안 손칼국수'));
  ok(r1.includes('2명이 같게 봤습니다') && r1.includes('민지, 준호'), '둘이 같게 보면 확인: ' + r1.slice(0, 90));
  ok(r1.includes('2명이 같게'), '  └ 한쪽이 모름인 칸은 엇갈림도 확인도 아니다 (주차)');
  ok(!(await text(row(p, '혼자 두 번'))).includes('같게 봤습니다'), '같은 사람이 두 번 쓴 건 확인이 아니다');
  const r3 = await text(row(p, '다르게 본 곳'));
  ok(!r3.includes('같게 봤습니다') && r3.includes('엇갈립니다'), '다르게 봤으면 확인이 아니라 엇갈림');
  const r4 = await text(row(p, '셋이 본 곳'));
  ok(r4.includes('2명이 같게 봤습니다') && r4.includes('엇갈립니다'), '셋 중 둘이 같으면 확인과 엇갈림을 같이 보인다');
  ok(!(await text(row(p, '한참 전 확인'))).includes('같게 봤습니다'), '3시간 밖 리포트는 확인에 안 센다');
  await openPlace(p, '만안 손칼국수');
  ok((await text(p.locator('#placeBody .det-head'))).includes('2명이 같게 봤습니다'), '장소 창에도 보인다');
  await p.context().close();
}
{
  const p = await page([
    report({ t: NOW - 20 * MIN, by: '민지', place: '만안 손칼국수', wait: 10, crowd: 1, park: 1 }),
    report({ t: NOW - 70 * MIN, by: '준호', place: '만안 손칼국수', wait: 10, crowd: 1 }),
    report({ t: NOW - 10 * MIN, by: '가', place: '다르게 본 곳', crowd: 0 }),
    report({ t: NOW - 40 * MIN, by: '나', place: '다르게 본 곳', crowd: 2 })
  ]);
  const li = (name) => text(p.locator('#pick li', { hasText: name }));
  const a = await li('만안 손칼국수'), d = await li('다르게 본 곳');
  ok(a.includes('2명 확인') && !a.includes('엇갈림'), '"지금 갈 만한 곳"에 확인 수가 붙는다: ' + a);
  ok(d.includes('엇갈림 있음') && !d.includes('확인'), '  └ 추천하면서 엇갈림이 있다는 것도 감추지 않는다: ' + d);
  await p.context().close();
}

/* ─────────────────────────── 지금 갈 만한 곳 ─────────────────────────── */
section('지금 갈 만한 곳 — 장소마다 가장 최근 소식으로');
{
  const p = await page([
    report({ t: NOW - 2 * H, by: '가', cat: 'food', place: '방금 붐빈 곳', crowd: 0, wait: 0 }),
    report({ t: NOW - 10 * MIN, by: '나', cat: 'food', place: '방금 붐빈 곳', crowd: 2, wait: 30 })
  ]);
  const pick = await text(p.locator('#pick'));
  ok(!pick.includes('방금 붐빈 곳') && pick.includes('붐빈다'), '두 시간 전 "한산"이 방금 들어온 "붐빔"을 이기지 않는다: ' + pick.slice(0, 40));
  await p.context().close();
}
{
  const p = await page([report({ t: NOW - 5 * MIN, by: '가', place: '메모만', note: '소금빵 나왔어요' })]);
  const pick = await text(p.locator('#pick'));
  ok(!pick.includes('메모만') && pick.includes('지금 들어온 소식이 없습니다'), '메모만 남긴 리포트는 "지금"을 말하지 못한다');
  await p.context().close();
}
{
  const p = await page([
    report({ t: NOW - 10 * MIN, by: '가', place: '새 메모', note: '사장님 오늘 친절' }),
    report({ t: NOW - 40 * MIN, by: '나', place: '새 메모', wait: 0, crowd: 0 })
  ]);
  await places(p);
  const r = await text(row(p, '새 메모'));
  ok(r.includes('대기 없음') && (await row(p, '새 메모').locator('.live-row.faded').count()) === 0,
    '더 새 리포트가 메모뿐이어도 상황판은 가장 최근 현장 정보로 그린다');
  await p.context().close();
}
{
  const p = await page([
    report({ t: NOW - 10 * MIN, by: '가', cat: 'food', place: '국숫집', crowd: 0 }),
    report({ t: NOW - 12 * MIN, by: '나', cat: 'cafe', place: '빵집', crowd: 0 })
  ]);
  await p.locator('#catFilter [data-cat="cafe"]').click();
  let pick = await text(p.locator('#pick'));
  ok(pick.includes('카페만') && pick.includes('빵집') && !pick.includes('국숫집'), '분야를 고르면 그 분야만: ' + pick.slice(0, 40));
  await p.locator('#catFilter [data-cat="trip"]').click();
  pick = await text(p.locator('#pick'));
  ok(pick.includes('나들이만') && pick.includes('지금 들어온 소식이 없습니다'), '  └ 그 분야에 지금 소식이 없으면 그렇게 말한다');
  await p.locator('#catFilter [data-cat=""]').click();
  pick = await text(p.locator('#pick'));
  ok(!pick.includes('만 ') && pick.includes('국숫집') && pick.includes('빵집'), '  └ 전체로 돌리면 다시 모두');
  await p.context().close();
}

/* ─────────────────────────── 보통은 ─────────────────────────── */
section('보통은 — 지난 기록');
const HIST = [
  report({ t: at('2026-09-19T12:10:00'), by: '민지', place: '별빛 키즈카페', area: '안양 안양동', crowd: 2, wait: 30 }),
  report({ t: at('2026-09-20T12:40:00'), by: '준호', place: '별빛 키즈카페', area: '안양 안양동', crowd: 3, wait: 60 }),
  report({ t: at('2026-09-13T13:00:00'), by: '서연', place: '별빛 키즈카페', area: '안양 안양동', crowd: 2 }),
  report({ t: at('2026-09-22T09:00:00'), by: '민지', place: '별빛 키즈카페', area: '안양 안양동', crowd: 0, wait: 0 }),
  report({ t: at('2026-09-23T10:00:00'), by: '태오', place: '별빛 키즈카페', area: '안양 안양동', crowd: 0 }),
  report({ t: at('2026-09-24T19:00:00'), by: '태오', place: '별빛 키즈카페', area: '안양 안양동', crowd: 2 }),
  report({ t: at('2026-09-24T19:40:00'), by: '서연', place: '별빛 키즈카페', area: '안양 안양동', crowd: 2 }),  // 같은 날 두 건
  report({ t: at('2026-09-19T12:30:00'), by: '서연', cat: 'trip', place: '안양천 물놀이터', area: '안양 석수동', crowd: 0, park: 0 }),
  report({ t: at('2026-09-20T13:10:00'), by: '준호', cat: 'trip', place: '안양천 물놀이터', area: '안양 석수동', crowd: 0 }),
  report({ t: at('2026-09-19T01:00:00'), by: '가', cat: 'food', place: '새벽 포차', crowd: 2 }),   // 토 새벽 1시 = 금요일 밤
  report({ t: at('2026-09-12T01:30:00'), by: '나', cat: 'food', place: '새벽 포차', crowd: 2 }),
  report({ t: at('2026-09-20T15:00:00'), by: '다', cat: 'cafe', place: '한 번 간 곳', crowd: 0 })
];
{
  const p = await page(HIST);
  await places(p);
  const r = await text(row(p, '별빛 키즈카페'));
  ok(r.includes('주말 점심엔 보통 붐빔') && r.includes('지난 기록 3일'), '지금 소식이 없으면 이 시간대에 보통 어땠는지: ' + r.slice(0, 80));
  ok((await row(p, '별빛 키즈카페').locator('.usual-hint .sw.bad').count()) === 1, '  └ 색도 같은 척도 (붐빔)');
  ok((await text(row(p, '안양천 물놀이터'))).includes('주말 점심엔 보통 여유'), '다른 장소는 그곳 기록대로 (여유)');

  await openPlace(p, '별빛 키즈카페');
  const cell = (d, s) => p.locator('#placeBody table.usual tbody tr').nth(d).locator('td').nth(s);
  ok((await p.locator('#placeBody table.usual caption').count()) === 1, '표에 제목(caption)이 있다');
  ok(flat(await cell(1, 1).innerText()) === '지금 붐빔 3일' && (await cell(1, 1).getAttribute('class')).includes('bad'),
    '주말·점심 칸: 붐빔, 서로 다른 날 3일');
  ok(await cell(1, 1).getAttribute('aria-current') === 'time' && (await cell(1, 1).getAttribute('class')).includes('now'),
    '  └ 지금 칸에 테를 두르고 읽는 프로그램에도 알린다');
  ok(flat(await cell(0, 0).innerText()) === '여유 2일' && (await cell(0, 0).getAttribute('class')).includes('good'), '평일·아침 칸: 여유 2일');
  ok((await cell(0, 3).getAttribute('class')).includes('none') && (await cell(0, 3).innerText()).includes('기록 모자람'),
    '같은 날 두 건뿐인 평일·저녁은 비워 둔다 — 하루 사정은 "보통"이 아니다');
  ok((await text(p.locator('#placeBody'))).includes('지금 소식이 아닙니다'), '지난 기록이라고 붙여 말한다');
  await p.keyboard.press('Escape');

  await openPlace(p, '새벽 포차');
  const night = (d) => p.locator('#placeBody table.usual tbody tr').nth(d).locator('td').nth(4);
  ok(flat(await night(0).innerText()) === '붐빔 2일' && (await night(1).getAttribute('class')).includes('none'),
    '토요일 새벽 1시는 금요일 밤 — 평일·밤 칸으로 간다');
  await p.keyboard.press('Escape');

  await openPlace(p, '한 번 간 곳');
  ok((await p.locator('#placeBody table.usual').count()) === 0 &&
     (await text(p.locator('#placeBody'))).includes('서로 다른 날 두 번 이상'), '기록이 모자라면 표 대신 언제 보이는지 알려 준다');
  await p.keyboard.press('Escape');

  await p.locator('.tab[data-view="feed"]').click();
  const pick = await text(p.locator('#pick'));
  ok(pick.includes('지금 들어온 소식이 없습니다') && pick.includes('주말 점심엔 보통 여유로운 곳') &&
     pick.includes('안양천 물놀이터') && !pick.includes('별빛 키즈카페'), '지금 소식이 없으면 이 시간대에 보통 여유로운 곳을 보인다');
  ok(pick.includes('지금 소식이 아닙니다'), '  └ 지금 소식이 아니라고 붙인다');
  await p.locator('#pick [data-openkey]').first().click();
  ok(await p.locator('#placeTitle').innerText() === '안양천 물놀이터', '  └ 누르면 그 장소 창');
  await p.context().close();
}
{
  /* 지금 소식이 있으면 "보통은"보다 지금을 보인다. 지난 기록 칸에도 3시간 안쪽은 섞지 않는다. */
  const p = await page(HIST.concat([
    report({ t: NOW - 10 * MIN, by: '라', cat: 'trip', place: '안양천 물놀이터', area: '안양 석수동', crowd: 3 }),
    report({ t: NOW - 40 * MIN, by: '마', cat: 'trip', place: '안양천 물놀이터', area: '안양 석수동', crowd: 3 })
  ]));
  await places(p);
  const r = await text(row(p, '안양천 물놀이터'));
  ok(r.includes('터짐') && !r.includes('보통 여유'), '지금 소식이 있으면 지난 기록 대신 지금을: ' + r.slice(0, 60));
  await openPlace(p, '안양천 물놀이터');
  ok(flat(await p.locator('#placeBody table.usual tbody tr').nth(1).locator('td').nth(1).innerText()) === '지금 여유 2일',
    '  └ 표의 지금 칸은 지난 기록 그대로 (방금 들어온 터짐 두 건은 안 섞는다)');
  await p.context().close();
}

/* ─────────────────────────── 지켜보는 곳 ─────────────────────────── */
section('지켜보는 곳');
{
  const base = [
    report({ id: 'w0000001', t: NOW - 3 * H, by: '민지', cat: 'play', place: '별빛 키즈카페', area: '안양 안양동', crowd: 1 }),
    report({ id: 'w0000002', t: NOW - 50 * MIN, by: '준호', cat: 'food', place: '만안 손칼국수', area: '안양 안양동', crowd: 1 })
  ];
  const p = await page(base);
  const stored = () => p.evaluate(() => JSON.parse(localStorage.getItem('tpw.v1')).watch || []);
  ok(await p.locator('#watchBox .watch').count() === 0, '처음엔 지켜보는 곳이 없다');
  await openPlace(p, '별빛 키즈카페');
  const tg = p.locator('#placeBody [data-watch]');
  ok(await tg.getAttribute('aria-pressed') === 'false', '장소 창에 "지켜보기" (안 눌림)');
  await tg.click();
  ok(await p.locator('#placeBody [data-watch]').getAttribute('aria-pressed') === 'true', '누르면 눌림');
  ok((await toastText(p)).includes('지켜보는 곳에 넣었습니다'), '  └ 알림');
  ok(await p.evaluate(() => document.activeElement && document.activeElement.hasAttribute('data-watch')), '  └ 다시 그려도 초점은 그 단추에');
  let w = await stored();
  ok(w.length === 1 && w[0].k === '별빛키즈카페|안양동' && w[0].nm === '별빛 키즈카페' && w[0].seen === base[0].t,
    '저장: 열쇠·이름·마지막으로 본 시각 ' + JSON.stringify(w[0]));
  await p.keyboard.press('Escape');
  await p.locator('.tab[data-view="feed"]').click();
  let wb = await text(p.locator('#watchBox'));
  ok(wb.includes('지켜보는 곳') && wb.includes('별빛 키즈카페') && !wb.includes('새 소식'), '속보 맨 위에 붙는다 (새 소식 없음)');
  await places(p);
  ok((await row(p, '별빛 키즈카페').locator('.wmark').count()) === 1 &&
     (await row(p, '별빛 키즈카페').locator('.wmark .sr').innerText()) === '지켜보는 곳', '장소 목록에 ★ (읽는 프로그램에는 "지켜보는 곳")');

  await p.reload();
  ok((await text(p.locator('#watchBox'))).includes('별빛 키즈카페'), '새로고침해도 남는다');

  /* 남이 보낸 새 소식 */
  await receive(p, [report({ id: 'w0000003', t: NOW - 10 * MIN, by: '서연', cat: 'play', place: '별빛 키즈카페', area: '안양 안양동', crowd: 0 })]);
  ok((await toastText(p)).includes('지켜보는 곳에 새 소식 — 별빛 키즈카페'), '링크로 새 소식이 오면 알린다: ' + await toastText(p));
  wb = await text(p.locator('#watchBox'));
  ok(wb.includes('새 소식 1') && wb.includes('한산'), '  └ 속보 맨 위에 "새 소식 1"과 지금 상황');
  await places(p);
  ok((await text(row(p, '별빛 키즈카페'))).includes('새 소식 1'), '  └ 장소 목록에도');

  /* 이미 본 것보다 옛 소식은 새 소식이 아니다 */
  await p.locator('.tab[data-view="feed"]').click();
  await receive(p, [report({ id: 'w0000004', t: NOW - 5 * H, by: '태오', cat: 'play', place: '별빛 키즈카페', area: '안양 안양동', crowd: 2 })]);
  ok(!(await toastText(p)).includes('지켜보는 곳'), '마지막으로 본 것보다 옛 리포트는 새 소식으로 안 친다');
  ok((await text(p.locator('#watchBox'))).includes('새 소식 1'), '  └ 여전히 1');

  /* 내가 쓴 건 새 소식이 아니다 */
  await p.locator('#watchBox [data-openkey]').first().click();
  await p.waitForSelector('#placeBack.open');
  await p.keyboard.press('Escape');
  ok(!(await text(p.locator('#watchBox'))).includes('새 소식'), '장소 창을 열어 보면 새 소식 표시가 사라진다');
  ok((await stored())[0].seen === NOW - 10 * MIN, '  └ 본 시각이 가장 최근 리포트로');
  await p.locator('#writeBtn').click();
  await p.waitForSelector('#composeBack.open');
  await p.fill('#fPlace', '별빛 키즈카페');
  await p.fill('#fArea', '안양 안양동');
  await p.locator('#fCrowd [data-v="1"]').click();
  await p.locator('#composeGo').click();
  await p.waitForSelector('#shareBack.open');
  await p.keyboard.press('Escape');
  ok(!(await text(p.locator('#watchBox'))).includes('새 소식'), '내가 쓴 리포트는 새 소식으로 안 센다');

  /* 그만 보기 */
  await openPlace(p, '별빛 키즈카페');
  await p.locator('#placeBody [data-watch]').click();
  ok(await p.locator('#placeBody [data-watch]').getAttribute('aria-pressed') === 'false', '다시 누르면 그만 본다');
  await p.keyboard.press('Escape');
  await p.locator('.tab[data-view="feed"]').click();
  ok(await p.locator('#watchBox .watch').count() === 0 && (await stored()).length === 0, '  └ 속보에서도 저장소에서도 빠진다');
  await p.context().close();
}
{
  /* 동네 없이 담았다가 나중에 동네가 붙으면 따라간다 · 예시 보드 · 비운 뒤 · 이상한 저장값 */
  const p = await page([report({ t: NOW - 2 * H, by: '가', place: '골목 떡볶이', crowd: 1 })],
    { watch: [{ k: '골목떡볶이|', nm: '골목 떡볶이', ar: '', seen: NOW - 2 * H }] });
  await receive(p, [report({ t: NOW - 5 * MIN, by: '나', place: '골목 떡볶이', area: '안양 비산동', crowd: 0 })]);
  ok((await toastText(p)).includes('골목 떡볶이'), '동네 없이 담은 곳에 동네가 붙어도 새 소식을 알린다');
  const w = await p.evaluate(() => JSON.parse(localStorage.getItem('tpw.v1')).watch);
  ok(w.length === 1 && w[0].k === '골목떡볶이|비산동', '  └ 열쇠가 동네 붙은 쪽으로 옮겨 간다: ' + w[0].k);

  p.once('dialog', (d) => d.accept());
  await p.locator('.tab[data-view="sync"]').click();
  await p.locator('#wipe').click();
  await p.locator('.tab[data-view="feed"]').click();
  const wb = await text(p.locator('#watchBox'));
  ok(wb.includes('골목 떡볶이') && wb.includes('아직 소식이 없습니다'), '보드를 비워도 지켜보는 목록은 남는다 (소식 없음)');
  ok((await p.locator('#feed .badge', { hasText: '예시' }).count()) > 0, '  └ 예시 보드로 돌아가도 예시 장소와 섞이지 않는다');
  await p.locator('#watchBox [data-unwatch]').click();
  ok(await p.locator('#watchBox .watch').count() === 0, '  └ "그만 보기"로 뺄 수 있다');
  await places(p);
  await row(p, '별빛 키즈카페').click();
  await p.waitForSelector('#placeBack.open');
  ok(await p.locator('#placeBody [data-watch]').count() === 0, '예시 장소에는 "지켜보기"가 없다');
  await p.context().close();
}
{
  const junk = [{ k: 123 }, { k: '막대없음' }, { k: '|동네만' }, 'str', null,
    { k: '가게|동', nm: '가게', seen: 'x' }, { k: '가게|동', nm: '중복' }];
  for (let i = 0; i < 40; i++) junk.push({ k: '곳' + i + '|동', nm: '곳' + i });
  const p = await page([report({ t: NOW - H, place: '가게', area: '동', crowd: 1 })], { watch: junk });
  const w = await p.evaluate(() => { const b = JSON.parse(localStorage.getItem('tpw.v1')); return b.watch; });
  const live = await p.evaluate(() => board.watch.map((x) => x.k + ':' + x.seen));
  ok(live.length === 30 && live[0] === '가게|동:0' && !live.some((x) => x.indexOf('막대없음') === 0),
    '저장소에 이상한 값이 있어도 걸러서 읽는다 (30곳까지, 중복·깨진 항목 버림)');
  ok(Array.isArray(w), '  └ 앱이 깨지지 않는다');
  await p.context().close();
}

/* ─────────────────────────── 파일 ─────────────────────────── */
section('파일로 저장·불러오기');
{
  const p = await page([report({ t: NOW - H, by: '나', place: '우리 가게', crowd: 1, mine: true })],
    { watch: [{ k: '우리가게|', nm: '우리 가게', ar: '', seen: 0 }] });
  await p.locator('.tab[data-view="sync"]').click();
  const [dl] = await Promise.all([p.waitForEvent('download'), p.locator('#fileSave').click()]);
  const fs = await import('node:fs');
  const saved = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  ok(Array.isArray(saved.watch) && saved.watch[0].k === '우리가게|', '저장 파일에 지켜보는 곳도 담긴다');

  const file = {
    app: '동네 특파원', v: 1,
    reports: [
      { id: 'f0000001', t: NOW - 2 * H, by: '남', place: '남의 가게 1', crowd: 1, mine: true, up: true, sv: true },
      { id: 'f0000002', t: NOW - 2 * H, by: '남', place: '남의 가게 2', crowd: 1, mine: true, up: true, priv: true },
      { id: 'f0000003', t: NOW - 2 * H, by: '남', place: '남의 가게 3', crowd: 1, mine: true, up: true }
    ],
    watch: [{ k: '남의가게1|', nm: '남의 가게 1', seen: 0 }, { k: '우리가게|', nm: '중복' }]
  };
  await p.locator('#fileInput').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(file)) });
  await p.waitForFunction(() => /불러왔습니다/.test(document.querySelector('#bundleStatus').textContent));
  const rs = await p.evaluate(() => JSON.parse(localStorage.getItem('tpw.v1')).reports.filter((r) => r.id.indexOf('f000') === 0));
  ok(rs.length === 3 && rs.every((r) => !r.mine && !r.up && !r.priv && !r.sv),
    '파일로 받은 리포트는 "내 글" 표시를 믿지 않는다 — 셋 다 (예전엔 첫 줄만 걸렀다)');
  const w = await p.evaluate(() => JSON.parse(localStorage.getItem('tpw.v1')).watch.map((x) => x.k + '/' + x.nm));
  ok(w.join() === '우리가게|/우리 가게,남의가게1|/남의 가게 1', '지켜보는 곳은 합친다 (있던 건 그대로): ' + w.join());
  ok((await p.locator('#bundleStatus').innerText()).includes('지켜보는 곳 1곳도 더했습니다'), '  └ 몇 곳 더했는지 알린다');
  await p.context().close();
}

await finish(b);
