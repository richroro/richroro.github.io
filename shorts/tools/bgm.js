// Compose candidate BGMs with the site's own "한 줄 작곡" app and save the WAVs.
// usage: node bgm.js <outDir> "<prompt>" ["<prompt>" ...]
const { launch, SITE } = require('./pw');
const [OUT, ...prompts] = process.argv.slice(2);
(async () => {
  const browser = await launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true, locale: 'ko-KR' });
  for (const [i, p] of prompts.entries()) {
    const page = await ctx.newPage();
    await page.goto(SITE + '/ai-music/', { waitUntil: 'load' });
    await page.fill('#prompt', p);
    await page.click('#go');
    await page.waitForTimeout(1500);
    await page.evaluate(() => { const l = document.querySelector('#len'); if (l.value !== 'medium') { l.value = 'medium'; l.dispatchEvent(new Event('change', { bubbles: true })); } });
    await page.waitForTimeout(1500);
    const info = await page.evaluate(() => { const t = document.body.innerText; const i = t.indexOf('들어보기'); return t.slice(Math.max(0, i - 400), i).replace(/\s+/g, ' ').trim(); });
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), page.click('#wav')]);
    const file = `${OUT}/bgm${i + 1}.wav`;
    await dl.saveAs(file);
    console.log(file, '|', p, '|', JSON.stringify(info));
    await page.close();
  }
  await browser.close();
})();
