/* 가장자리 — 엇갈림, 동네 표기, 지금 갈 만한 곳, 묶음 길이 제한, 정리, 375px, 어두운 테마, 이상한 값, 늦게 만들어지는 공유 글, CSP, 이름 없는 특파원,
   링크로 받기(미리 보기, 이미 가진 것, 열린 앱에 들어온 링크, 담으면 장소 창, 잘린 링크, 미래 시각, 똑같아 보이는 이름, 카톡 안 브라우저) */
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

/* ═══════════════ 받는 쪽 — 새 사용자는 모두 카톡 링크로 들어온다. 링크로 연 첫 화면이 첫인상이다 ═══════════════
   시계를 토요일 12:30(서울)에 멈춰 둔다 — "20분 전"·미래 시각을 흔들림 없이 본다.
   고친 것을 되돌렸을 때 FAIL 로 드러나게(멈추지 않게) 기다림은 짧게 끊는다. */
const T = new Date('2026-09-26T12:30:00+09:00').getTime();
const MN = 60e3, HR = 60 * MN;
async function at(opts = {}) {
  const ctx = await browser.newContext(Object.assign({ locale: 'ko-KR', timezoneId: 'Asia/Seoul', viewport: { width: 390, height: 844 } }, opts));
  await ctx.clock.setFixedTime(T);
  ctx.setDefaultTimeout(8000);              // 없는 걸 30초씩 기다리지 않게
  ctx.setDefaultNavigationTimeout(30000);
  return ctx;
}
/* 보내는 사람 — 앱의 pack() 으로 싣는다 */
const sender = watch(await (await at()).newPage());
await sender.goto(URL, { waitUntil: 'networkidle' });
const pk = (rs) => sender.evaluate(async (rs) => pack(rs.map((x) => sane(x))), rs);
const rep = (o) => Object.assign({ by: '가', cat: 'play', area: '', wait: -1, crowd: -1, park: -1, rate: 0, tags: [], note: '' }, o);
/* 날것("1") 형식으로 직접 싣는다 — sane() 을 안 거친 값(미래 시각, 같은 id 두 번)을 그대로 보낸다 */
const rawCode = (rows) => '1' + Buffer.from(JSON.stringify(rows)).toString('base64url');
const row = (o) => [o.id, Math.round(o.t / 1000), o.by, o.cat || 'play', o.place, o.area || '', o.wait ?? -1, o.crowd ?? -1, o.park ?? -1, 0, o.note || '', ''];
/* 받는 사람 — reports 를 주면 그 보드로, 안 주면 처음 여는 폰(예시 보드)으로 hash 를 연다 */
async function receiver(hash, reports, opts = {}, extra = {}) {
  const p = watch(await (await at(opts)).newPage());
  if (reports) {
    await p.goto(URL, { waitUntil: 'networkidle' });
    await p.evaluate(({ rs, ex }) => localStorage.setItem('tpw.v1', JSON.stringify(Object.assign({ reports: rs, me: '나', seeded: true }, ex))),
      { rs: reports, ex: extra });
    await p.goto('about:blank');   // 해시만 바꾸면 새로 읽지 않는다 — 한 번 비우고 연다
  }
  await p.goto(URL + hash, { waitUntil: 'networkidle' });
  return p;
}
const flat = (s) => s.replace(/\s+/g, ' ').trim();
const arrived = (p, sel = '#inbox .inbox') => p.waitForSelector(sel, { timeout: 4000 }).catch(() => null);
const latin = (s) => s.match(/[A-Za-z]{5,}/g) || [];

console.log('\n== L. 받기 전에 무엇이 왔는지 먼저 — 예시 보드 위에서도 친구 소식이 첫 화면 ==');
{
  const code = await pk([rep({ id: 'recv0001', t: T - 20 * MN, by: '민지', place: '구름 놀이터', area: '안양 비산동',
    wait: 30, crowd: 2, park: 2, rate: 4, tags: ['아이동반', '실내'], note: '입장 대기 줄 있어요 <img src=x onerror="window.__pwn=1">' })]);
  const p = await receiver('#r=' + code);
  await arrived(p);
  ok(await p.evaluate(() => isSample()), '처음 여는 폰 — 예시 보드에서 링크를 연다');
  ok(flat(await p.locator('#inbox h2').innerText()) === '민지 특파원이 보낸 현장 소식', '제목: 누가 보낸 소식인지');
  const card = p.locator('#inbox .card');
  ok(await card.count() === 1, '받기 전에 받을 리포트가 카드로 보인다');
  const stats = await card.locator('.stat').allInnerTexts();
  ok(stats.join('/') === '대기 30분/붐빔/주차 만석', '  └ 지금 상황 칩: ' + stats.join(' · '));
  ok(await card.count() && await card.locator('.age').innerText() === '20분 전', '  └ 몇 분 전');
  ok(await card.count() && (await card.locator('.note-line').innerText()).startsWith('입장 대기 줄 있어요'), '  └ 한 줄 메모');
  ok(await card.count() && (await card.locator('.by').innerText()) === '민지 특파원' && (await card.locator('.tags').innerText()).includes('#아이동반'),
    '  └ 누가 · 태그');
  ok(await p.locator('#inbox img').count() === 0 && await p.evaluate(() => window.__pwn === undefined), '  └ 링크에 실린 태그는 글자로만 (이스케이프)');
  ok(await card.count() && await card.locator('button').count() === 0 && !(await card.innerText()).includes('예시'),
    '  └ 읽기만 — 지우기·나도 여기·공유 단추도, 예시 딱지도 없다');
  ok(await p.locator('#inboxYes').innerText().catch(() => '') === '내 보드에 담기' && await p.locator('#inboxNo').innerText().catch(() => '') === '안 담기',
    '단추: "내 보드에 담기" / "안 담기"');
  const shown = [];
  for (const s of ['#intro', '#pick', '#feed', '#q', '#catFilter', '#writeBtn', '#livePill']) if (await p.locator(s).isVisible()) shown.push(s);
  ok(shown.length === 0, '담을지 정할 때까지 예시(안내·지금 가기 좋은 곳·속보·거르개·쓰기 단추·지금 N건)를 가린다' + (shown.length ? ': ' + shown.join(' ') : ''));
  const bg = await p.locator('#inbox .inbox').evaluate((el) => getComputedStyle(el).backgroundColor).catch(() => '');
  ok(bg === 'rgb(231, 237, 250)', '도착은 파란 칠 — 오류처럼 읽히는 빨강이 아니다 (' + bg + ')');
  await p.locator('#inboxNo').click({ timeout: 3000 }).catch(() => {});
  ok(await p.locator('#inbox .inbox').count() === 0 && await p.locator('#pick').isVisible() && await p.locator('#intro').isVisible(),
    '"안 담기" — 알림이 닫히고 예시가 돌아온다');
  ok(await p.evaluate(() => location.hash) === '' && await p.evaluate(() => isSample()), '  └ 주소(#r=)를 치우고 보드는 그대로');
  await p.context().close();
}
{
  const p = await receiver('#r=' + await pk([rep({ id: 'recv0002', t: T - 5 * MN, by: '민지', place: '구름 놀이터', crowd: 0 })]), null, { colorScheme: 'dark' });
  await arrived(p);
  const bg = await p.locator('#inbox .inbox').evaluate((el) => getComputedStyle(el).backgroundColor).catch(() => '');
  ok(bg === 'rgb(21, 37, 80)', '어두운 테마에서도 도착은 파란 칠 — 밤색(오류)이 아니다 (' + bg + ')');
  await p.context().close();
}
{
  /* 여럿이 보낸 묶음 — 새것 셋까지 카드로(최근 것부터), 나머지는 "외 N건" */
  const code = await pk([
    rep({ id: 'mix00001', t: T - 3 * HR, by: '서연', cat: 'cafe', place: '온기 로스터리', area: '평촌 범계동', crowd: 1 }),
    rep({ id: 'mix00002', t: T - 5 * MN, by: '민지', place: '구름 놀이터', area: '안양 비산동', crowd: 0 }),
    rep({ id: 'mix00003', t: T - 50 * MN, by: '준호', cat: 'food', place: '만안 손칼국수', area: '안양 안양동', wait: 10 }),
    rep({ id: 'mix00004', t: T - 26 * HR, by: '태오', cat: 'food', place: '구산 돈까스', area: '안양 비산동', crowd: 3 }),
    rep({ id: 'mix00005', t: T - 40 * HR, by: '민지', cat: 'trip', place: '수리산 임도길', area: '안양 안양동', crowd: 0 })]);
  const p = await receiver('#r=' + code);
  await arrived(p);
  ok(flat(await p.locator('#inbox h2').innerText()) === '현장 소식 5건', '여럿이 보냈으면 제목은 "현장 소식 5건"');
  const cards = await p.locator('#inbox .card .place').allInnerTexts();
  ok(cards.join('/') === '구름 놀이터/만안 손칼국수/온기 로스터리', '  └ 카드는 셋까지, 최근 것부터: ' + cards.join(' / '));
  const txt = flat(await p.locator('#inbox').innerText());
  ok(txt.includes('외 2건') && txt.includes('외 2곳'), '  └ 나머지는 "외 2건", 곳 이름은 "외 2곳"');
  await p.locator('#inboxYes').click({ timeout: 3000 }).catch(() => {});
  await p.waitForTimeout(150);
  ok(await p.locator('.backdrop.open').count() === 0 && (await p.locator('#toast').innerText()) === '5건을 받았습니다.',
    '여러 곳을 담으면 장소 창 대신 알림 한 줄 (그대로)');
  ok(await p.locator('#pick').isVisible() && await p.locator('#feed .card').count() === 5 && !(await p.evaluate(() => isSample())),
    '  └ 담으면 가렸던 속보가 돌아오고 예시는 사라진다');
  await p.context().close();
}

console.log('\n== M. 이미 가진 것은 빼고, 한 링크에 두 번 실린 것은 한 번만 센다 ==');
{
  const held = ['가 식당', '나 카페', '다 공원'].map((place, i) => rep({ id: 'held000' + i, t: T - (i + 2) * 10 * MN, by: '서연', place, area: '안양동', crowd: 1 }));
  const code = await pk(held.concat(rep({ id: 'new00001', t: T - 5 * MN, by: '준호', cat: 'food', place: '라 분식', area: '안양동', crowd: 0 })));
  const p = await receiver('#r=' + code, held);
  await arrived(p);
  ok(flat(await p.locator('#inbox h2').innerText()) === '준호 특파원이 보낸 현장 소식', '제목은 새로 온 것의 특파원');
  const sub = flat(await p.locator('#inbox .inbox > p').first().innerText().catch(() => ''));
  ok(sub === '1건 · 라 분식 · 이미 있는 3건은 뺐습니다', '이미 가진 3건 + 새 1건 → 새 곳 이름만, 1건: ' + sub);
  ok((await p.locator('#inbox .card .place').allInnerTexts()).join() === '라 분식', '  └ 미리 보기도 새것만');
  await p.context().close();
}
{
  const one = { id: 'dupe0001', t: T - 10 * MN, by: '민지', place: '만안 손칼국수', area: '안양동', wait: 10, crowd: 2 };
  const p = await receiver('#r=' + rawCode([row(one), row(one)]));
  await arrived(p);
  const sub = flat(await p.locator('#inbox .inbox > p').first().innerText().catch(() => ''));
  ok(sub === '1건 · 만안 손칼국수' && await p.locator('#inbox .card').count() === 1, '같은 리포트가 두 번 실린 링크 → 1건: ' + sub);
  await p.locator('#inboxYes').click({ timeout: 3000 }).catch(() => {});
  ok((await p.locator('#toast').innerText()) === '1건을 받았습니다.', '  └ 담아도 "1건을 받았습니다." ("이미 있었음" 없이)');
  await p.context().close();
}

console.log('\n== N. 앱을 연 채로 링크가 들어오면 — 속보 맨 위, 알림 제목에 초점 ==');
{
  const many = [];
  for (let i = 0; i < 30; i++) many.push(rep({ id: 'pl' + String(i).padStart(6, '0'), t: T - (i + 1) * 20 * MN, cat: 'food', place: '가게 ' + i, area: '안양동', crowd: i % 4 }));
  const p = await receiver('', many);
  await p.locator('.tab[data-view="places"]').click();
  await p.evaluate(() => window.scrollTo(0, 1000));
  ok(await p.evaluate(() => scrollY) >= 999, '(장소 탭에서 1000px 내려 읽는 중)');
  await p.evaluate((c) => { location.hash = '#r=' + c; }, await pk([rep({ id: 'live0001', t: T - 3 * MN, by: '민지', place: '가게 3', area: '안양동', crowd: 0 })]));
  await arrived(p);
  const st = await p.evaluate(() => {
    const box = document.querySelector('#inbox .inbox'), r = box ? box.getBoundingClientRect() : { top: -1 };
    return { view, tab: document.querySelector('#tab-feed').getAttribute('aria-selected'), top: r.top, vh: innerHeight,
      focus: !!box && document.activeElement === box.querySelector('h2') };
  });
  ok(st.view === 'feed' && st.tab === 'true', '링크가 들어오면 속보 탭으로 온다');
  ok(st.top >= 0 && st.top < st.vh, '  └ 알림이 화면 안에 (위에서 ' + Math.round(st.top) + 'px)');
  ok(st.focus, '  └ 초점은 알림 제목 — 읽는 프로그램이 곧바로 읽는다');
  ok(await p.locator('#inbox h2').getAttribute('tabindex').catch(() => null) === '-1', '  └ 제목은 초점만 받고 탭 순서엔 없다 (tabindex=-1)');
  /* 장소 창을 보던 중이면 — 뒤가 막혀(inert) 있으니 창을 닫고 알림으로 */
  await p.locator('#inboxNo').click({ timeout: 3000 }).catch(() => {});
  await p.locator('.tab[data-view="places"]').click();
  await p.locator('#places .pl').first().click();
  await p.waitForSelector('#placeBack.open');
  await p.evaluate((c) => { location.hash = '#r=' + c; }, await pk([rep({ id: 'live0002', t: T - 2 * MN, by: '준호', place: '가게 5', area: '안양동', crowd: 1 })]));
  await arrived(p);
  ok(await p.locator('.backdrop.open').count() === 0 && await p.evaluate(() => view === 'feed' &&
    document.activeElement === document.querySelector('#inbox h2')), '장소 창을 보던 중에 들어와도 창을 닫고 알림 제목으로');
  await p.context().close();
}

console.log('\n== O. 한 곳 소식을 담으면 그 장소 창이 열린다 ==');
{
  const code = await pk([
    rep({ id: 'one00001', t: T - 5 * MN, by: '민지', place: '별빛 키즈카페', area: '안양 안양동', crowd: 0 }),
    rep({ id: 'one00002', t: T - 40 * MN, by: '준호', place: '별빛키즈카페', area: '안양동', crowd: 1 })]);
  const p = await receiver('#r=' + code);
  await arrived(p);
  ok(flat(await p.locator('#inbox .inbox > p').first().innerText().catch(() => '')) === '별빛 키즈카페', '띄어쓰기만 다른 이름은 한 번만 적는다');
  await p.locator('#inboxYes').click({ timeout: 3000 }).catch(() => {});
  await p.waitForTimeout(150);
  ok(await p.locator('#placeBack.open').count() === 1 && await p.locator('#placeTitle').innerText() === '별빛 키즈카페',
    '담으면 그 장소 창 — 띄어쓰기·동네 표기가 달라도 한 곳');
  ok(await p.locator('#placeBody [data-watch]').count() === 1 && await p.locator('#placeBody .tl .card').count() === 2,
    '  └ 받은 두 건이 앞뒤로, 거기서 바로 "지켜보기"');
  ok((await p.locator('#toast').innerText()) === '2건을 받았습니다.', '  └ 받았다는 알림은 그대로');
  await p.keyboard.press('Escape');
  ok(await p.evaluate(() => ['one00001', 'one00002'].includes(document.activeElement && document.activeElement.dataset.open)),
    '  └ 창을 닫으면 속보의 그 카드로 (초점)');
  await p.context().close();
}

console.log('\n== P. 잘린 링크 — 브라우저의 영어 대신 우리말로, 할 일까지 ==');
{
  const rs = [];
  for (let i = 0; i < 30; i++) rs.push(rep({ id: 'tr' + String(i).padStart(6, '0'), t: T - i * 37 * MN, by: ['민지', '준호', '서연'][i % 3],
    cat: 'food', place: '가게' + i, area: '안양 안양동', wait: 10, crowd: i % 4, note: '메모 ' + i + ' 줄이 조금 깁니다' }));
  const codes = await sender.evaluate(async (rs) => {
    const l = rs.map((x) => sane(x));
    return { one: await pack(l.slice(0, 1)), many: (await packCapped(l, BUNDLE_CAP)).code };
  }, rs);
  const cuts = [];
  for (const [k, c] of Object.entries(codes)) for (const f of [.3, .5, .7, .9, .97]) cuts.push([k + '@' + f, c.slice(0, Math.floor(c.length * f))]);
  const bad = [];
  for (const [k, cut] of cuts) {
    const e = await sender.evaluate(async (cut) => { try { await unpack(cut); return { msg: '(풀렸다)' }; } catch (e) { return { msg: e.message, cut: !!e.cut }; } }, cut);
    if (!e.cut || !/잘린/.test(e.msg) || latin(e.msg).length) bad.push(k + ' ' + e.msg);
  }
  ok(bad.length === 0, 'unpack: 잘린 링크 10가지(한 건·묶음 × 30~97%) 모두 우리말 "잘린 것 같습니다"' + (bad.length ? ' — ' + bad.join(' | ') : ''));
  const p = watch(await (await at()).newPage());
  const seen = [];
  for (const [k, cut] of cuts) {
    await p.goto('about:blank');
    await p.goto(URL + '#r=' + cut, { waitUntil: 'networkidle' });
    await arrived(p);
    const t = flat(await p.locator('#inbox').innerText());
    if (!/잘렸/.test(t) || latin(t).length || await p.locator('#inboxPaste').count() !== 1) seen.push(k + ' ' + t);
  }
  ok(seen.length === 0, '받는 화면도 10가지 모두 "잘렸습니다" + "붙여 넣으러 가기", 영어 없음' + (seen.length ? ' — ' + seen.slice(0, 2).join(' | ') : ''));
  ok(flat(await p.locator('#inbox p').innerText().catch(() => '')) ===
    '링크가 중간에 잘렸습니다. 카톡 글을 길게 눌러 통째로 복사한 뒤, 주고받기 탭의 ‘받기’ 칸에 붙여 넣어 보세요.', '  └ 할 일: 카톡 글을 통째로 복사해 받기 칸에');
  await p.locator('#inboxPaste').click({ timeout: 3000 }).catch(() => {});
  ok(await p.evaluate(() => view === 'sync' && document.activeElement && document.activeElement.id === 'recvBox'),
    '"붙여 넣으러 가기" → 주고받기 탭, 받기 칸에 초점');
  ok(await p.locator('#inbox .inbox').count() === 0 && await p.evaluate(() => location.hash) === '', '  └ 알림은 닫고 주소를 치운다');
  /* 붙여 넣기 칸에서도 — 끝이 잘린 공유 글 */
  const text = await sender.evaluate(async (rs) => { const l = rs.map((x) => sane(x)).slice(0, 1); return shareText(l, await pack(l)); }, rs);
  if (await p.evaluate(() => view) !== 'sync') await p.locator('.tab[data-view="sync"]').click();
  await p.fill('#recvBox', text.slice(0, text.length - 40));
  await p.locator('#recvGo').click();
  await p.waitForSelector('#recvStatus.err, #recvStatus.ok');
  const st = await p.locator('#recvStatus').innerText();
  ok(/^받지 못했습니다: 링크가 중간에 잘린 것 같습니다\./.test(st) && !latin(st).length, '붙여 넣기 칸도 우리말로: ' + st);
  await p.context().close();
}
{
  /* 카톡 글에서 링크를 긁다 보면 뒤의 ")" 가 딸려 온다 — 붙여 넣기 칸(findCode)처럼 받는다 */
  const code = await pk([rep({ id: 'paren001', t: T - 5 * MN, by: '민지', place: '구름 놀이터', crowd: 0 })]);
  const p = await receiver('#r=' + code + ')');
  await arrived(p);
  ok(await p.locator('#inbox .inbox.arrive').count() === 1, '링크 끝에 ")"가 붙어 와도 알림이 뜬다');
  await p.locator('#inboxYes').click({ timeout: 3000 }).catch(() => {});
  ok(await p.evaluate(() => board.reports.map((r) => r.id).join()) === 'paren001', '  └ 담긴다');
  await p.context().close();
}

console.log('\n== Q. 미래 시각 — 한 시간 넘게 앞서면 버리고, 그 안쪽은 지금으로 ==');
{
  const base = [rep({ id: 'old00001', t: T - 2 * HR, by: '민지', place: '별빛 키즈카페', area: '안양동', wait: 30, crowd: 2, park: 2 })];
  const code = rawCode([
    row({ id: 'futr0001', t: T + 20 * HR, by: '장난', place: '별빛 키즈카페', area: '안양동', wait: 0, crowd: 0, park: 0, note: '텅 비었어요' }),
    row({ id: 'soon0001', t: T + 30 * MN, by: '준호', place: '별빛 키즈카페', area: '안양동', wait: 60, crowd: 3, park: 3, note: '시계가 조금 빠른 폰' })]);
  const p = await receiver('#r=' + code, base, {}, { watch: [{ k: '별빛키즈카페|안양동', nm: '별빛 키즈카페', ar: '안양동', seen: T - 2 * HR }] });
  await arrived(p);
  const by = await p.locator('#inbox .card .by').allInnerTexts();
  ok(by.join() === '준호 특파원', '20시간 뒤 시각의 리포트는 버린다 — 미리 보기엔 준호만: ' + by.join(', '));
  ok(await p.locator('#inbox .card .age').first().innerText().catch(() => '') === '방금', '  └ 30분 앞선 것은 받되 지금 시각으로 ("방금")');
  await p.locator('#inboxYes').click({ timeout: 3000 }).catch(() => {});
  await p.waitForTimeout(150);
  const b = await p.evaluate(() => ({ ids: board.reports.map((r) => r.id), soon: (board.reports.find((r) => r.id === 'soon0001') || {}).t,
    now: Date.now(), seen: board.watch[0].seen, stored: JSON.parse(localStorage.getItem('tpw.v1')).watch[0].seen }));
  ok(!b.ids.includes('futr0001') && b.soon === b.now, '  └ 보드에도 20시간 뒤 것은 없고, 30분 뒤 것은 지금 시각');
  ok(b.seen <= b.now && b.stored <= b.now, '지켜보는 곳을 열어 본 시각이 미래로 밀리지 않는다');
  await p.keyboard.press('Escape');
  /* 고치기 전에 받아서 미래로 밀려 저장된 "본 시각"도 읽을 때 지금으로 당긴다 */
  await p.evaluate((T) => { const s = JSON.parse(localStorage.getItem('tpw.v1')); s.watch[0].seen = T + 5 * 3600e3;
    localStorage.setItem('tpw.v1', JSON.stringify(s)); }, T);
  await p.reload({ waitUntil: 'networkidle' });
  ok(await p.evaluate(() => board.watch[0].seen <= Date.now()), '  └ 저장소에 미래로 밀린 본 시각은 읽을 때 지금으로 (saneWatch)');
  /* 어떤 길로 미래 시각이 끼어 있어도 — 지켜보기를 켤 때·창을 열 때 본 시각은 지금을 넘지 않는다 */
  const cl = await p.evaluate(() => {
    const g = { key: '미래|동', place: '미래', area: '동', last: { t: Date.now() + 5 * 3600e3 } };
    toggleWatch(g);
    const w = board.watch.find((x) => x.k === '미래|동'), onWatch = w.seen;
    w.seen = 0;
    markSeen(g);
    return { onWatch, onOpen: w.seen, now: Date.now() };
  });
  ok(cl.onWatch <= cl.now && cl.onOpen <= cl.now, '  └ 지켜보기를 켤 때(toggleWatch)·창을 열 때(markSeen)도');
  const s = await p.evaluate(() => [sane({ t: Date.now() + 20 * 3600e3, place: 'x' }), sane({ t: Date.now() + 2 * 3600e3, place: 'x' }),
    (sane({ t: Date.now() + 30 * 60e3, place: 'x' }) || {}).t - Date.now(), (sane({ t: Date.now() + 2 * 3600e3, place: 'x' }, true) || {}).t - Date.now()]);
  ok(s[0] === null && s[1] === null && s[2] === 0, 'sane(): 밖에서 온 +20시간·+2시간은 버리고, +30분은 지금으로');
  ok(s[3] === 0, '  └ 내 저장소의 +2시간(폰 시계가 틀렸던 내 글)은 버리지 않고 지금으로');
  await p.context().close();
}

console.log('\n== R. 똑같아 보이는 이름 — 풀어 쓴 한글(NFD)·폭 없는 공백·방향 표시 ==');
{
  const nm = '별빛 키즈카페';
  const variants = [nm, nm.normalize('NFD'), '별빛\u200B 키즈카페', '\u202E별빛 키즈\uFEFF카페', '별빛 키즈카페\u2066'];
  const p = await receiver('', variants.map((place, i) => rep({ id: 'look000' + i, t: T - (i + 1) * 10 * MN, by: '가나다라마'[i],
    place, area: '안양동', crowd: 0 })));
  await p.locator('.tab[data-view="places"]').click();
  const pls = await p.locator('#places .pl').count();
  ok(pls === 1 && (await p.locator('#places .pl').first().innerText()).includes('리포트 5건'), '다섯 가지로 적힌 같은 이름이 한 장소 5건 (' + pls + '곳)');
  ok(await p.evaluate(() => board.reports.every((r) => r.place === '별빛 키즈카페' && r.by.length === 1)), '  └ 저장되는 이름도 하나로 — 모아 쓰고, 안 보이는 글자는 뺀다');
  const n = await p.evaluate(() => [norm('별빛 키즈카페'.normalize('NFD')), norm('별\u200B빛\u2060 키즈\u200D카페'), norm(' 별빛키즈카페\u200F ')]);
  ok(n.every((x) => x === '별빛키즈카페'), 'norm(): 한글 적는 방식·안 보이는 글자·공백을 무시 — ' + n.map((x) => x.length).join('/') + '자');
  /* 링크로 풀어 쓴 이름이 와도 원래 그 장소로 — 담으면 그 장소 창에 여섯 건 */
  await p.evaluate((c) => { location.hash = '#r=' + c; },
    rawCode([row({ id: 'look0009', t: T - 2 * MN, by: '바', place: '별빛\u200B 키즈카페'.normalize('NFD'), area: '안양동', crowd: 1 })]));
  await arrived(p, '#inboxYes');
  await p.locator('#inboxYes').click({ timeout: 3000 }).catch(() => {});
  await p.waitForTimeout(150);
  ok(await p.locator('#placeBack.open').count() === 1 && await p.locator('#placeBody .tl .card').count() === 6, '  └ 링크로 온 NFD+폭 없는 공백 이름도 그 장소로 (6건)');
  await p.context().close();
}

console.log('\n== S. 카톡 안 브라우저 — 담아도 주소(#r=)를 남긴다. 다른 브라우저로 나가도 거기서 받게 ==');
{
  const KAKAO = 'Mozilla/5.0 (Linux; Android 14; SM-S918N Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.0.0 Mobile Safari/537.36;KAKAOTALK 2410370';
  const code = await pk([rep({ id: 'kakao001', t: T - 5 * MN, by: '민지', place: '구름 놀이터', crowd: 0 })]);
  const p = await receiver('#r=' + code, null, { userAgent: KAKAO });
  await arrived(p);
  await p.locator('#inboxYes').click({ timeout: 3000 }).catch(() => {});
  await p.keyboard.press('Escape');
  ok(await p.evaluate(() => location.hash) === '#r=' + code && await p.evaluate(() => board.reports.length) === 1,
    '담은 뒤에도 주소에 링크가 남는다 ("다른 브라우저로 열기"가 링크를 들고 나간다)');
  await p.reload({ waitUntil: 'networkidle' });
  await arrived(p);
  ok((await p.locator('#inbox h2').innerText().catch(() => '')).includes('이미 갖고 있는'), '  └ 다시 열면 "이미 갖고 있는 리포트입니다"');
  await p.locator('#inboxNo').click({ timeout: 3000 }).catch(() => {});
  ok(await p.evaluate(() => location.hash) === '#r=' + code, '  └ 그걸 닫아도 주소는 남긴다');
  await p.evaluate((c) => { location.hash = '#r=' + c; }, await pk([rep({ id: 'kakao002', t: T - 3 * MN, by: '준호', place: '다른 곳', crowd: 1 })]));
  await arrived(p, '#inboxNo');
  await p.locator('#inboxNo').click({ timeout: 3000 }).catch(() => {});
  ok(await p.evaluate(() => location.hash) === '', '"안 담기"는 카톡 안에서도 주소를 치운다');
  await p.context().close();
}
{
  const code = await pk([rep({ id: 'chrome01', t: T - 5 * MN, by: '민지', place: '구름 놀이터', crowd: 0 })]);
  const p = await receiver('#r=' + code);
  await arrived(p);
  await p.locator('#inboxYes').click({ timeout: 3000 }).catch(() => {});
  ok(await p.evaluate(() => location.hash) === '' && await p.evaluate(() => board.reports.length) === 1, '보통 브라우저는 담으면 주소를 치운다 (그대로)');
  await p.context().close();
}
await sender.context().close();

await finish(browser);
