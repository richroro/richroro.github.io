const { launch, SITE } = require('./pw');
const [prompt] = process.argv.slice(2);
(async () => {
  const browser = await launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await page.goto(SITE + '/ai-music/', { waitUntil: 'load' });
  await page.fill('#prompt', prompt); await page.click('#go'); await page.waitForTimeout(1200);
  await page.evaluate(() => { const l = document.querySelector('#len'); if (l.value !== 'medium') { l.value = 'medium'; l.dispatchEvent(new Event('change', { bubbles: true })); } });
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => { const s = state.song; const P = s.P; const spb = 60 / P.bpm; const bpb = P.beats || 4;
    return { bpm: P.bpm, beats: bpb, genre: P.genre, sections: s.sections.map(x => ({ type: x.type, bar: x.bar, bars: x.bars, t0: +(x.bar * bpb * spb).toFixed(3), t1: +((x.bar + x.bars) * bpb * spb).toFixed(3) })) }; });
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})();
