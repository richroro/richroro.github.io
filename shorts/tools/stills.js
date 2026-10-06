// Render chosen timestamps of the renderer to PNG stills for review.
// usage: node stills.js <baseUrl> <outDir> t1 t2 ...
const { launch } = require('./pw');
const [base, out, ...ts] = process.argv.slice(2);
(async () => {
  const b = await launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('console:', m.text()); });
  p.on('pageerror', e => console.log('pageerror:', e.message));
  await p.goto(base + '/render/index.html', { waitUntil: 'load' });
  const info = await p.evaluate(() => window.ready);
  console.log('ready', JSON.stringify(info));
  for (const t of ts) {
    await p.evaluate(t => window.renderFrame(t), +t);
    await p.screenshot({ path: `${out}/still_${(+t).toFixed(2).padStart(6, '0')}.png` });
  }
  await b.close();
})();
