/* 가장자리 — 엇갈림, 동네 표기, 지금 갈 만한 곳, 묶음 길이 제한, 정리, 375px, 어두운 테마, 이상한 값, 늦게 만들어지는 공유 글, CSP, 이름 없는 특파원 */
import { BASE, ok, launch, watch, finish, shareReady, bundleReady } from './lib.mjs';

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
  const st = await bundleReady(p);
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
  ok(bg === 'rgb(9, 14, 24)', '어두운 바탕: ' + bg);
  await p.locator('#themeBtn').click();
  ok((await p.evaluate(() => getComputedStyle(document.body).backgroundColor)) === 'rgb(238, 241, 245)', '테마 단추로 밝게');
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

console.log('\n== I. 공유 창 — 압축이 늦게 끝날 때 ==');
{
  const p = await boardPage([
    r({ place: '앞 장소', by: '민지', crowd: 0, t: N - 5 * 60e3 }),
    r({ place: '뒤 장소', by: '준호', crowd: 2, t: N - 10 * 60e3 })
  ]);
  /* 복사한 글을 모으고, 압축을 붙잡아 둘 수 있게 한다 — 느린 폰에서 벌어지는 일을 시간에 기대지 않고 만든다. */
  await p.evaluate(() => {
    window.__copied = [];
    window.copyText = async (t) => { window.__copied.push(t); return true; };
    window.__hold = 0; window.__held = []; window.__done = 0;
    const orig = window.pack;
    window.pack = async (l) => {
      if (window.__hold > 0) { window.__hold--; await new Promise((go) => window.__held.push(go)); }
      const out = await orig(l);
      window.__done++;
      return out;
    };
  });
  const share = (place) => p.locator('#feed .card', { hasText: place }).locator('[data-share]').click();
  const lastCopy = async () => (await p.evaluate(() => window.__copied.slice())).pop() || '';

  await share('앞 장소');
  ok((await shareReady(p)).includes('앞 장소'), '앞 장소 공유글');
  await p.keyboard.press('Escape');

  await p.evaluate(() => { window.__hold = 1; });
  await share('뒤 장소');
  ok(await p.inputValue('#shareBox') === '만드는 중…', '뒤 장소 공유글은 아직 만드는 중');
  await p.locator('#shareCopy').click();
  ok(!(await p.evaluate(() => window.__copied.some((t) => t.includes('앞 장소')))),
    '  └ 그때 누른 복사가 앞서 만든 앞 장소 글을 복사하지 않는다');
  await p.evaluate(() => window.__held.shift()());
  ok((await shareReady(p)).includes('뒤 장소'), '  └ 다 되면 뒤 장소 글');
  await p.locator('#shareCopy').click();
  ok((await lastCopy()).includes('뒤 장소'), '  └ 그때 누르면 뒤 장소 글이 복사된다');
  await p.keyboard.press('Escape');

  /* 먼저 연 창의 압축이 나중에 끝나는 경우 */
  await p.evaluate(() => { window.__hold = 1; });
  await share('앞 장소');
  await p.keyboard.press('Escape');
  await share('뒤 장소');
  ok((await shareReady(p)).includes('뒤 장소'), '앞 장소를 열었다 닫고 뒤 장소를 열면 뒤 장소 글');
  const done = await p.evaluate(() => window.__done);
  await p.evaluate(() => window.__held.shift()());
  await p.waitForFunction((d) => window.__done > d, done);
  const box = await p.inputValue('#shareBox');
  ok(box.includes('뒤 장소') && !box.includes('앞 장소'), '늦게 끝난 앞 장소 글이 지금 열린 창을 덮지 않는다');
  await p.locator('#shareCopy').click();
  ok((await lastCopy()).includes('뒤 장소'), '  └ 복사도 지금 열린 창의 글');
  await p.context().close();
}

console.log('\n== J. CSP — 새어 들어온 스크립트는 안 돈다 ==');
{
  /* 여기서는 일부러 CSP 위반을 일으킨다 — 콘솔 오류를 모으는 watch() 없이 연다 */
  const ctx = await browser.newContext({ locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  const p = await ctx.newPage();
  const refused = [];
  p.on('console', (m) => { if (m.type() === 'error' && /Content Security Policy/.test(m.text())) refused.push(m.text()); });
  await p.goto(URL, { waitUntil: 'networkidle' });
  const csp = await p.evaluate(() => (document.querySelector('meta[http-equiv="Content-Security-Policy"]') || {}).content || '');
  ok(/(^|;)\s*script-src 'self'\s*(;|$)/.test(csp), "앱: script-src 'self' 하나뿐 (인라인·eval 없음)");
  ok(/object-src 'none'/.test(csp) && /base-uri 'none'/.test(csp), '  └ object·base 막음');
  /* 이스케이프가 한 번 새도 — 속성 처리기와 인라인 스크립트는 돌지 않는다 */
  await p.evaluate(() => {
    const d = document.createElement('div');
    d.innerHTML = '<img src="data:," onerror="window.__pwn = 1">';
    document.body.appendChild(d);
    const s = document.createElement('script');
    s.textContent = 'window.__pwn2 = 1';
    document.body.appendChild(s);
  });
  await p.waitForTimeout(200);
  ok(await p.evaluate(() => window.__pwn === undefined), '끼워 넣은 onerror 처리기가 안 돈다');
  ok(await p.evaluate(() => window.__pwn2 === undefined), '끼워 넣은 <script> 가 안 돈다');
  ok(await p.evaluate(() => typeof renderAll === 'function'), '  └ 앱 자체(app.js)는 돈다');
  ok(refused.length === 2, '  └ 브라우저가 둘 다 CSP 위반으로 막았다고 알린다 (' + refused.length + '건)');
  await p.goto(URL + 'privacy.html', { waitUntil: 'networkidle' });
  const pcsp = await p.evaluate(() => (document.querySelector('meta[http-equiv="Content-Security-Policy"]') || {}).content || '');
  ok(/script-src 'none'/.test(pcsp), "처리방침: 스크립트가 없는 문서라 script-src 'none'");
  await p.goto(URL + 'admin.html', { waitUntil: 'networkidle' });
  const acsp = await p.evaluate(() => [(document.querySelector('meta[http-equiv="Content-Security-Policy"]') || {}).content || '',
    (document.querySelector('meta[name="robots"]') || {}).content || '']);
  ok(/(^|;)\s*script-src 'self'\s*(;|$)/.test(acsp[0]) && /noindex/.test(acsp[1]), "운영 화면: script-src 'self', 검색엔진에 안 올림(noindex)");
  await p.context().close();
}

console.log('\n== K. 이름 없는 특파원 — "특파원"을 두 번 붙이지 않는다 ==');
{
  /* 이름을 안 정하고 쓰면 이름이 "이름 없는 특파원"이 된다. 이름 뒤에 " 특파원"을 붙이는 자리마다
     "이름 없는 특파원 특파원"이 되던 것 — 공유 글, 카드, 지금 갈 만한 곳, 장소 창, 나도 여기, 신고 창, 내 이름 칸. */
  const ctx = await browser.newContext({ locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  const p = watch(await ctx.newPage());
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.locator('#writeBtn').click();
  await p.waitForSelector('#composeBack.open');
  await p.fill('#fPlace', '이름 없이 쓴 곳');
  await p.locator('#fCrowd [data-v="0"]').click();
  await p.locator('#composeGo').click();
  const share = await shareReady(p);
  ok(share.split('\n').includes('— 이름 없는 특파원'), '공유 글: "— 이름 없는 특파원"');
  await p.keyboard.press('Escape');
  ok((await p.locator('#feed .card .by').first().innerText()) === '이름 없는 특파원', '카드 자막: "이름 없는 특파원"');
  const why = await p.locator('#pick .why').first().innerText();
  ok(!/특파원/.test(why) && await p.locator('#pick .why .stat').count() > 0, '지금 가기 좋은 곳은 색 칩으로 — 누가 썼는지는 장소 창에서: ' + why.replace(/\s+/g, ' '));
  /* 이름 있는 사람이 같은 곳에 뒤이어 쓴 걸 받는다 — 이름 있는 쪽에는 그대로 붙는다.
     민지가 더 새것이라 장소 창의 이름 줄에서 "이름 없는 특파원"이 맨 뒤(= "특파원이" 앞)에 온다. */
  await p.evaluate(() => { merge([sane({ t: Date.now(), by: '민지', cat: 'food', place: '이름 없이 쓴 곳', crowd: 0 })]); renderAll(); });
  ok((await p.locator('#feed .card .by').allInnerTexts()).join(' / ') === '민지 특파원 / 이름 없는 특파원', '  └ 이름 있는 사람은 "민지 특파원"');
  await p.locator('.tab[data-view="places"]').click();
  await p.locator('#places .pl', { hasText: '이름 없이 쓴 곳' }).click();
  await p.waitForSelector('#placeBack.open');
  ok((await p.locator('#placeBody .det-head').innerText()).includes('민지, 이름 없는 특파원이 다녀갔습니다.'), '장소 창: "민지, 이름 없는 특파원이 다녀갔습니다."');
  let seen = await p.evaluate(() => document.body.innerText);
  await p.evaluate(() => { closeSheets(true); openCompose(board.reports.find((r) => r.mine)); });   // 내 카드의 "나도 여기"
  await p.waitForSelector('#composeBack.open');
  ok((await p.locator('#fRefWho').innerText()).startsWith('이름 없는 특파원 · '), '나도 여기: "이름 없는 특파원 · 방금"');
  seen += await p.evaluate(() => document.body.innerText);
  await p.evaluate(() => openFlagSheet(board.reports.find((r) => r.mine)));
  ok((await p.locator('#flagWhat').innerText()).includes('” · 이름 없는 특파원 · '), '신고 창: "… · 이름 없는 특파원 · …"');
  seen += await p.evaluate(() => document.body.innerText);
  await p.keyboard.press('Escape');
  await p.locator('.tab[data-view="people"]').click();
  ok((await p.locator('.me-txt').innerText()) === '이름 없는 특파원으로 씁니다', '내 이름 칸: "이름 없는 특파원으로 씁니다"');
  seen += await p.evaluate(() => document.body.innerText);
  ok(!/특파원\s+특파원/.test(seen), '  └ 어느 화면에도 "특파원 특파원"이 없다');
  /* 운영 화면도 같은 규칙 */
  await p.goto(URL + 'admin.html', { waitUntil: 'networkidle' });
  const author = await p.evaluate(() => {
    const row = { id: 'x1', t: new Date().toISOString(), cat: 'food', hood_code: 'anyang', place: '어디', by_name: '', author: 'u1', flags: [] };
    const txt = (name) => { const d = document.createElement('div'); d.innerHTML = itemHtml(Object.assign({}, row, { by_name: name }));
      const b = d.querySelector('.author b');   // "— " + <b>이름</b> + " 특파원" 까지만 (뒤는 작성자 보기 단추)
      return (b.previousSibling.textContent + b.textContent + b.nextSibling.textContent).trim(); };
    return [txt('이름 없는 특파원'), txt('준호')];
  });
  ok(author[0] === '— 이름 없는 특파원' && author[1] === '— 준호 특파원', '운영 화면 작성자 줄: ' + author.join(' / '));
  await ctx.close();
}


await finish(browser);
