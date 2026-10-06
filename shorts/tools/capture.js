// Capture phone-size screenshots of the site's apps for the short.
// usage: node capture.js <outDir> <npmDir> [name ...]
const { launch, SITE } = require('./pw');
const fs = require('fs');
const [OUT, NPM, ...only] = process.argv.slice(2);
const BASE = SITE;

const local = [
  [/three@0\.170\.0\/build\/three\.module\.min\.js/, `${NPM}/three-0.170.0/package/build/three.module.min.js`, 'application/javascript'],
  [/three@0\.128\.0\/build\/three\.min\.js/, `${NPM}/three-0.128.0/package/build/three.min.js`, 'application/javascript'],
  [/three\.js\/r128\/three\.min\.js/, `${NPM}/three-0.128.0/package/build/three.min.js`, 'application/javascript'],
];

const startWords = /^(시작|게임 시작|시작하기|START|PLAY|플레이|도전|바로 시작|탭해서 시작)/i;

const PAGES = [
  { name: 'home', url: '/' },
  { name: 'ipo', url: '/ipo/', wait: 2500 },
  { name: 'finder', url: '/finder/', wait: 2500 },
  { name: 'finder_nvda', url: '/finder/s/nvda/', wait: 2500 },
  { name: 'realestate', url: '/real-estate/', wait: 3500 },
  { name: 'salary', url: '/salary-rank/', wait: 1500 },
  { name: 'assembly', url: '/national-assembly/', wait: 9000 },
  { name: 'bball3d', url: '/games/basketball-3d/', wait: 4000, play: true },
  { name: 'bball', url: '/games/basketball/', wait: 2500, play: true },
  { name: 'fishing', url: '/games/ice-fishing/', wait: 4000, play: true },
  { name: 'foldline', url: '/games/foldline/', wait: 4000, play: true },
  { name: 'ppung', url: '/games/ppung-numbers/', wait: 2000, play: true },
  { name: 'tikkeul', url: '/games/tikkeul-moa/', wait: 2000, play: true },
  { name: 'music', url: '/ai-music/', wait: 2500 },
  { name: 'webcut', url: '/video-editor/', wait: 2500 },
  { name: 'couple', url: '/couple-cards/', wait: 2000 },
  { name: 'm7', url: '/m7/', wait: 2500 },
  { name: 'tesla', url: '/tesla/', wait: 2500 },
  { name: 'teslam', url: '/tesla-metrics/', wait: 2500 },
  { name: 'chinaev', url: '/china-ev/', wait: 2500 },
  { name: 'stocks', url: '/stocks/', wait: 2500 },
];

(async () => {
  const browser = await launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required',
      // only https goes through the egress proxy; the local http server stays direct
      ...(process.env.HTTPS_PROXY ? [`--proxy-server=https=${process.env.HTTPS_PROXY.replace(/^https?:\/\//, '')}`] : [])],
  });
  const ctx = await browser.newContext({
    viewport: { width: 393, height: 852 }, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true,
    locale: 'ko-KR', timezoneId: 'Asia/Seoul', colorScheme: 'light', ignoreHTTPSErrors: false,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  });
  await ctx.route(/cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|unpkg\.com/, async (route) => {
    const u = route.request().url();
    for (const [re, file, type] of local) if (re.test(u)) return route.fulfill({ path: file, contentType: type });
    if (/pretendard/.test(u)) return route.fulfill({ body: '', contentType: 'text/css' });
    console.log('  blocked', u.slice(0, 120));
    return route.abort();
  });
  for (const p of PAGES) {
    if (only.length && !only.includes(p.name)) continue;
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
    try {
      await page.goto(BASE + p.url, { waitUntil: 'networkidle', timeout: 40000 }).catch(() => {});
      await page.waitForTimeout(p.wait || 1500);
      await page.screenshot({ path: `${OUT}/${p.name}.png` });
      const h = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.screenshot({ path: `${OUT}/${p.name}_full.png`, fullPage: true, clip: { x: 0, y: 0, width: 393, height: Math.min(h, 852 * 4) } }).catch(() => {});
      if (p.play) {
        const btn = page.locator('button, a, [role=button], .btn').filter({ hasText: startWords }).first();
        if (await btn.count()) await btn.click({ timeout: 3000 }).catch(() => {});
        else await page.mouse.click(196, 600);
        await page.waitForTimeout(2500);
        await page.screenshot({ path: `${OUT}/${p.name}_play.png` });
      }
      console.log('ok', p.name, 'h=', h, errs.length ? 'errors: ' + errs.join(' | ') : '');
    } catch (e) {
      console.log('FAIL', p.name, String(e).slice(0, 200));
    }
    await page.close();
  }
  await browser.close();
})();
