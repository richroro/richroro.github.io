// Step the renderer frame by frame in headless Chromium and write JPEG frames.
// usage: node render.js <baseUrl> <framesDir> [fps=30] [workers=3] [planOut]
const { launch } = require('./pw');
const fs = require('fs');
const [base, dir, fpsArg, wArg, planOut] = process.argv.slice(2);
const fps = +fpsArg || 30, workers = +wArg || 3;
(async () => {
  fs.mkdirSync(dir, { recursive: true });
  const browser = await launch();
  const open = async () => {
    const ctx = await browser.newContext({ viewport: { width: 1080, height: 1920 } });
    const p = await ctx.newPage();
    p.on('pageerror', e => console.log('pageerror:', e.message));
    await p.goto(base + '/render/index.html', { waitUntil: 'load' });
    const info = await p.evaluate(() => window.ready);
    return { p, info };
  };
  const first = await open();
  const { end } = first.info;
  if (planOut) fs.writeFileSync(planOut, JSON.stringify(await first.p.evaluate(() => window.PLAN), null, 1));
  const n = Math.round(end * fps);
  console.log(`frames ${n} @ ${fps}fps, ${workers} workers`);
  const pages = [first.p];
  for (let k = 1; k < workers; k++) pages.push((await open()).p);
  const t0 = Date.now(); let done = 0;
  await Promise.all(pages.map(async (p, k) => {
    for (let i = k; i < n; i += workers) {
      await p.evaluate(t => window.renderFrame(t), i / fps);
      await p.screenshot({ path: `${dir}/f_${String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 93 });
      if (++done % 150 === 0) console.log(`${done}/${n}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
  }));
  console.log('done', n, 'frames in', ((Date.now() - t0) / 1000).toFixed(0), 's');
  await browser.close();
})();
