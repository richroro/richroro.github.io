// Capture interactive states: composed song in 한 줄 작곡, sample clips in 웹컷, search in 전 종목 탐색기.
const { launch, SITE } = require('./pw');
const [OUT] = process.argv.slice(2);
(async () => {
  const browser = await launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
      ...(process.env.HTTPS_PROXY ? [`--proxy-server=https=${process.env.HTTPS_PROXY.replace(/^https?:\/\//, '')}`] : [])] });
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
  await ctx.route(/cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|unpkg\.com/, r => /pretendard/.test(r.request().url()) ? r.fulfill({ body: '', contentType: 'text/css' }) : r.abort());
  const go = async (url) => { const p = await ctx.newPage(); await p.goto(SITE + url, { waitUntil: 'networkidle', timeout: 40000 }).catch(() => {}); await p.waitForTimeout(1500); return p; };

  let p = await go('/ai-music/');
  await p.fill('#prompt', '중독성 있는 후크송 컴백곡'); await p.click('#go'); await p.waitForTimeout(2500);
  const y = await p.evaluate(() => { const e = document.querySelector('#play'); const r = e.getBoundingClientRect(); return r.top + scrollY - 260; });
  await p.evaluate(y => scrollTo(0, y), y); await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/music_song.png` }); await p.close();

  p = await go('/video-editor/');
  await p.click('#sampleBtn').catch(e => console.log('sample', e.message)); await p.waitForTimeout(2500);
  await p.screenshot({ path: `${OUT}/webcut_sample.png` }); await p.close();

  p = await go('/finder/');
  const box = p.locator('input[type=search], input[type=text]').first();
  await box.click().catch(() => {}); await box.type('엔비디아', { delay: 60 }).catch(() => {}); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${OUT}/finder_search.png` }); await p.close();

  p = await go('/salary-rank/');
  const ry = await p.evaluate(() => { const el = [...document.querySelectorAll('*')].find(e => /상위/.test(e.textContent) && e.children.length < 3 && e.getBoundingClientRect().height > 20); return el ? el.getBoundingClientRect().top + scrollY - 200 : 900; });
  await p.evaluate(y => scrollTo(0, y), ry); await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/salary_result.png` }); await p.close();

  p = await go('/real-estate/');
  await p.evaluate(() => { const h = [...document.querySelectorAll('h2,h3')].find(e => /12개 지역/.test(e.textContent)); if (h) scrollTo(0, h.getBoundingClientRect().top + scrollY - 70); });
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/realestate_regions.png` }); await p.close();

  p = await go('/couple-cards/');
  await p.evaluate(() => { const s = document.querySelector('select'); if (s) { s.selectedIndex = Math.min(5, s.options.length - 1); s.dispatchEvent(new Event('change', { bubbles: true })); } });
  const b = p.locator('button').filter({ hasText: /시작/ }).first(); if (await b.count()) await b.click().catch(() => {});
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${OUT}/couple_card.png` }); await p.close();
  await browser.close();
  console.log('done');
})();
