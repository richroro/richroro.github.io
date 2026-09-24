/* 접근성 — axe-core 로 재고, 키보드로 직접 눌러 본다. (지켜보는 곳·같게 봤다·보통은 표 포함) */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { BASE, ok, section, launch, context, watch, openWith, report, finish, MIN, shareReady } from './lib.mjs';

const require = createRequire(import.meta.url);
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];

async function axe(p, where) {
  await p.addScriptTag({ content: AXE });
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
  const name = await p.locator('#recvBtn').evaluate((el) => el.getAttribute('aria-label') || el.innerText);
  ok(name === '받은 링크 붙여넣기', '아이콘만 보이는 "받기" 단추에도 이름이 있다');
  const snap = await p.accessibility.snapshot({ root: await p.$('#writeBtn') });
  ok(snap && snap.name === '리포트 보내기', '"📡" 은 읽지 않는다: ' + (snap && snap.name));
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

await finish(b);
