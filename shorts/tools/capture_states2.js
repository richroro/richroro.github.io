const { launch, SITE } = require('./pw');
const [OUT] = process.argv.slice(2);
(async () => {
  const browser = await launch({
    args: [...(process.env.HTTPS_PROXY ? [`--proxy-server=https=${process.env.HTTPS_PROXY.replace(/^https?:\/\//, '')}`] : [])] });
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true, locale: 'ko-KR', timezoneId: 'Asia/Seoul',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
  await ctx.route(/cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|unpkg\.com/, r => /pretendard/.test(r.request().url()) ? r.fulfill({ body: '', contentType: 'text/css' }) : r.abort());
  const go = async (url) => { const p = await ctx.newPage(); await p.goto(SITE + url, { waitUntil: 'networkidle', timeout: 40000 }).catch(() => {}); await p.waitForTimeout(1500); return p; };
  let p = await go('/salary-rank/');
  const info = await p.evaluate(() => {
    const els = [...document.querySelectorAll('body *')].filter(e => /상위\s*[\d.]+/.test(e.textContent) && e.getBoundingClientRect().height > 10);
    els.sort((a, b) => a.textContent.length - b.textContent.length);
    const el = els[0]; if (!el) return null;
    const r = el.getBoundingClientRect(); scrollTo(0, r.top + scrollY - 330);
    const r2 = el.getBoundingClientRect();
    return { text: el.textContent.trim().slice(0, 40), x: r2.left, y: r2.top, w: r2.width, h: r2.height };
  });
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${OUT}/salary_result.png` }); console.log('salary', JSON.stringify(info)); await p.close();
  p = await go('/video-editor/');
  await p.evaluate(() => document.querySelector('#sampleBtn').click()); await p.waitForTimeout(3000);
  await p.screenshot({ path: `${OUT}/webcut_sample.png` }); await p.close();
  p = await go('/ipo/');
  const ring = await p.evaluate(() => { const e = [...document.querySelectorAll('body *')].find(e => e.textContent.trim() === '62'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  console.log('ipo62', JSON.stringify(ring)); await p.close();
  p = await go('/finder/');
  const line = await p.evaluate(() => { const e = [...document.querySelectorAll('p')].find(e => /5,887/.test(e.textContent)); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  console.log('finderline', JSON.stringify(line)); await p.close();
  p = await go('/');
  const cta = await p.evaluate(() => { const e = [...document.querySelectorAll('a,button')].find(e => /무료로 진단받기/.test(e.textContent)); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  console.log('homecta', JSON.stringify(cta)); await p.close();
  await browser.close();
})();
