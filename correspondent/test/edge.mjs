/* 가장자리 — 엇갈림, 동네 표기, 지금 갈 만한 곳, 묶음 길이 제한, 정리, 375px, 어두운 테마, 이상한 값 */
import { BASE, ok, launch, watch, finish } from './lib.mjs';

const URL = BASE;
const browser = await launch();

// 보드를 직접 심고 여는 도우미
async function boardPage(reports, opts = {}) {
  const ctx = await browser.newContext(Object.assign({ locale: 'ko-KR', timezoneId: 'Asia/Seoul' }, opts));
  const p = await ctx.newPage();
  watch(p);
  await p.goto(URL);
  await p.evaluate(rs => localStorage.setItem('tpw.v1', JSON.stringify({ reports: rs, me: '나', seeded: true })), reports);
  await p.reload({ waitUntil: 'networkidle' });
  return p;
}
const N = Date.now();
const r = (o) => Object.assign({ id: Math.random().toString(36).slice(2, 10), t: N, by: '가', cat: 'food',
  place: '어디', area: '', wait: -1, crowd: -1, park: -1, rate: 0, tags: [], note: '' }, o);

console.log('\n== A. 엇갈림 잡기 ==');
{
  const p = await boardPage([
    r({ place: '만안 손칼국수', area: '안양 안양동', by: '민지', crowd: 0, t: N - 20 * 60e3 }),
    r({ place: '만안 손칼국수', area: '안양 안양동', by: '준호', crowd: 2, t: N - 90 * 60e3 })
  ]);
  await p.locator('.tab[data-view="places"]').click();
  const c = await p.locator('#places .conflict').count();
  ok(c === 1, '최근 3시간 안에 다른 사람이 다르게 보면 엇갈림');
  const txt = await p.locator('#places .conflict').innerText();
  ok(txt.includes('한산') && txt.includes('붐빔') && txt.includes('민지') && txt.includes('준호'), '엇갈림 내용: ' + txt);
  await p.context().close();
}
{
  const p = await boardPage([
    r({ place: 'ㄱ', by: '민지', crowd: 0, t: N - 20 * 60e3 }),
    r({ place: 'ㄱ', by: '민지', crowd: 2, t: N - 90 * 60e3 })
  ]);
  await p.locator('.tab[data-view="places"]').click();
  ok((await p.locator('#places .conflict').count()) === 0, '같은 사람이 시간차로 쓴 건 엇갈림 아님');
  await p.context().close();
}

console.log('\n== B. 동네 표기가 달라도 한 장소 ==');
{
  const p = await boardPage([
    r({ place: '별빛 키즈카페', area: '안양 안양동', by: '가' }),
    r({ place: '별빛키즈카페',  area: '안양동',     by: '나' }),
    r({ place: '별빛 키즈카페', area: '',           by: '다' })
  ]);
  await p.locator('.tab[data-view="places"]').click();
  ok((await p.locator('#places .pl').count()) === 1, '"안양 안양동"·"안양동"·빈칸 → 한 장소');
  ok((await p.locator('#places .pl').innerText()).includes('리포트 3건'), '3건 묶임');
  ok((await p.locator('#places .pl').innerText()).includes('안양 안양동'), '더 자세한 동네 이름을 씀');
  await p.context().close();
}
{
  const p = await boardPage([
    r({ place: '스타벅스', area: '안양 안양동' }),
    r({ place: '스타벅스', area: '평촌 범계동' })
  ]);
  await p.locator('.tab[data-view="places"]').click();
  ok((await p.locator('#places .pl').count()) === 2, '동네가 다르면 같은 이름이어도 다른 장소');
  await p.context().close();
}

console.log('\n== C. 지금 갈 만한 곳 ==');
{
  const p = await boardPage([
    r({ place: '한산한 곳', wait: 0, crowd: 0, park: 0, t: N - 10 * 60e3 }),
    r({ place: '터진 곳',   wait: 60, crowd: 3, park: 3, t: N - 10 * 60e3 }),
    r({ place: '옛날 좋았던 곳', wait: 0, crowd: 0, park: 0, t: N - 10 * 3600e3 })
  ]);
  const items = await p.locator('.pick ol li').allInnerTexts();
  ok(items.length === 1, '여유 있는 곳만 오름 (1곳)');
  ok(items[0].includes('한산한 곳'), '1위: ' + items[0].replace(/\n/g, ' '));
  await p.context().close();
}
{
  const p = await boardPage([r({ place: '터진 곳', wait: 60, crowd: 3, park: 3, t: N - 10 * 60e3 })]);
  ok((await p.locator('.pick.empty h2').innerText()).includes('붐빈다'), '다 붐비면 그렇게 말함');
  await p.context().close();
}
{
  const p = await boardPage([r({ place: '오래된 곳', t: N - 20 * 3600e3 })]);
  ok((await p.locator('.pick.empty h2').innerText()).includes('지금 들어온 소식이 없습니다'), '3시간 안쪽이 없으면 그렇게 말함');
  await p.context().close();
}

console.log('\n== D. 묶음 길이 제한 ==');
{
  const many = [];
  for (let i = 0; i < 90; i++) many.push(r({ place: '장소' + i, area: '안양 안양동', by: '특파원' + (i % 5),
    note: '여기는 ' + i + '번째 리포트입니다. 사람이 적당히 있고 주차는 애매합니다.', wait: 10, crowd: 1, park: 1, rate: 4,
    tags: ['아이동반', '실내'], t: N - i * 60e3 }));
  const p = await boardPage(many);
  await p.locator('.tab[data-view="sync"]').click();
  await p.locator('#bundleBtn').click();
  await p.waitForTimeout(600);
  const st = await p.locator('#bundleStatus').innerText();
  const len = Number(st.match(/링크 길이 (\d+)자/)[1]);
  const used = Number(st.match(/최근 (\d+)건/)[1]);
  ok(len <= 1600, '링크 길이 ' + len + '자 ≤ 1600');
  ok(used > 5 && used < 90, '90건 중 ' + used + '건만 담음');
  ok((await p.inputValue('#bundleBox')).includes('외 '), '요약문에 나머지 건수');

  // 잘린 묶음을 다른 브라우저에서 받아 본다
  const code = (await p.inputValue('#bundleBox')).match(/#r=([A-Za-z0-9_-]+)/)[1];
  const p2 = await boardPage([]);
  await p2.evaluate(() => localStorage.removeItem('tpw.v1'));
  await p2.goto(URL + '#r=' + code, { waitUntil: 'networkidle' });
  await p2.waitForSelector('#inboxYes');
  await p2.locator('#inboxYes').click();
  await p2.waitForTimeout(200);
  ok((await p2.locator('#feed .card').count()) === used, '묶음 ' + used + '건 그대로 받아짐');
  await p.context().close(); await p2.context().close();
}

console.log('\n== E. 정리 ==');
{
  const p = await boardPage([r({ place: '옛날', t: N - 40 * 86400e3 }), r({ place: '요즘', t: N - 60e3 })]);
  p.on('dialog', d => d.accept());
  await p.locator('.tab[data-view="sync"]').click();
  await p.locator('#purgeOld').click();
  await p.waitForTimeout(150);
  await p.locator('.tab[data-view="feed"]').click();
  ok((await p.locator('#feed .card').count()) === 1, '30일 넘은 것만 지움');
  await p.locator('.tab[data-view="sync"]').click();
  await p.locator('#wipe').click();
  await p.waitForTimeout(150);
  await p.locator('.tab[data-view="feed"]').click();
  ok((await p.locator('#feed .badge').count()) === 8, '전부 비우면 예시가 돌아옴');
  await p.context().close();
}

console.log('\n== F. 모바일 375px ==');
{
  const p = await boardPage([], { viewport: { width: 375, height: 800 } });
  await p.evaluate(() => localStorage.removeItem('tpw.v1'));
  await p.reload({ waitUntil: 'networkidle' });
  const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(over <= 0, '가로 스크롤 ' + over + 'px');
  await p.locator('#writeBtn').click();
  await p.waitForSelector('#composeBack.open');
  const over2 = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(over2 <= 0, '쓰기 시트에서도 가로 스크롤 ' + over2 + 'px');
  const small = await p.evaluate(() => Array.from(document.querySelectorAll('#composeBack button,#composeBack input,#composeBack textarea'))
    .filter(e => e.offsetParent && e.getBoundingClientRect().height < 30).length);
  ok(small === 0, '손가락으로 누를 만한 크기 (30px 미만 ' + small + '개)');
  await p.context().close();
}

console.log('\n== G. 어두운 테마 ==');
{
  const p = await boardPage([], { colorScheme: 'dark' });
  await p.evaluate(() => localStorage.removeItem('tpw.v1'));
  await p.reload({ waitUntil: 'networkidle' });
  const bg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok(bg === 'rgb(14, 16, 19)', '어두운 바탕: ' + bg);
  await p.locator('#themeBtn').click();
  ok((await p.evaluate(() => getComputedStyle(document.body).backgroundColor)) === 'rgb(245, 243, 238)', '테마 단추로 밝게');
  await p.locator('#themeBtn').click();
  ok((await p.evaluate(() => document.documentElement.dataset.theme)) === 'dark', '테마 단추로 어둡게');
  await p.context().close();
}

console.log('\n== H. 이상한 값 막기 ==');
{
  const p = await boardPage([]);
  const res = await p.evaluate(() => {
    localStorage.setItem('tpw.v1', JSON.stringify({ reports: [
      { id: '../../x', t: Date.now(), place: '장소', by: 'a'.repeat(500), note: 'n'.repeat(999),
        cat: 'evil', wait: 999, crowd: 'x', rate: 99, tags: ['a','b','c','d','e','f','g','h'] },
      { t: Date.now(), place: '' },
      { t: 99999999999999, place: '미래' },
      'nope', null
    ], seeded: true }));
    return true;
  });
  await p.reload({ waitUntil: 'networkidle' });
  const rs = await p.evaluate(() => JSON.parse(localStorage.getItem('tpw.v1')).reports);
  ok((await p.locator('#feed .card').count()) === 1, '쓸 수 없는 것은 버림 (5개 중 1개 남음)');
  const c = await p.evaluate(() => {
    const el = document.querySelector('#feed .card');
    return { by: el.querySelector('.by').textContent, note: el.querySelector('.note-line').textContent,
             cat: el.querySelector('.cat').textContent, stats: el.querySelectorAll('.stat').length,
             stars: (el.querySelector('.stars') || {}).textContent || '', tags: el.querySelector('.tags').textContent };
  });
  ok(c.by.length < 40, '이름 길이 깎임');
  ok(c.note.length <= 202, '메모 200자로 깎임');
  ok(c.cat.includes('그 밖에'), '모르는 분야 → 그 밖에');
  ok(c.stats === 0, '범위 밖 값은 모름 처리');
  ok(c.stars === '★★★★★', '별점 5개로 깎임');
  ok(c.tags.split('#').length - 1 === 6, '태그 6개로 깎임');
  await p.context().close();
}


await finish(browser);
