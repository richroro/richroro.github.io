// Start the basketball games for real and grab in-play frames.
const { launch, SITE } = require('./pw');
const [OUT, NPM] = process.argv.slice(2);
(async () => {
  const browser = await launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true, locale: 'ko-KR' });
  await ctx.route(/cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com/, r => /three/.test(r.request().url())
    ? r.fulfill({ path: /0\.170/.test(r.request().url()) ? `${NPM}/three-0.170.0/package/build/three.module.min.js` : `${NPM}/three-0.128.0/package/build/three.min.js`, contentType: 'application/javascript' })
    : r.fulfill({ body: '', contentType: 'text/css' }));
  for (const [name, url, label] of [['bball3d_game', '/games/basketball-3d/', '1스테이지 시작'], ['bball_game', '/games/basketball/', '스테이지 시작']]) {
    const p = await ctx.newPage();
    await p.goto(SITE + url, { waitUntil: 'networkidle', timeout: 40000 }).catch(() => {});
    await p.waitForTimeout(3000);
    const ok = await p.evaluate((label) => { const b = [...document.querySelectorAll('button')].find(b => b.textContent.trim().startsWith(label)); if (b) { b.click(); return true; } return false; }, label);
    await p.waitForTimeout(3500);
    await p.screenshot({ path: `${OUT}/${name}.png` }); console.log(name, ok);
    await p.close();
  }
  await browser.close();
})();
