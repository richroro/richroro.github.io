/* 성공 애니 쇼츠 → MP4 (1080×1920, 30fps, H.264 + AAC)
 *
 *   python3 -m http.server 8765          # 저장소 루트에서
 *   npm i playwright                     # 한 번만
 *   node success-anime/tools/render-shorts.js out/ all
 *   node success-anime/tools/render-shorts.js out/ chung/story toss/2
 *
 * 화면은 크롬 DevTools 스크린캐스트로 프레임마다 떠서 실제 시간대로 붙이고,
 * 소리는 재생 중에 남긴 효과음 기록을 OfflineAudioContext 로 다시 합성합니다.
 * ffmpeg 가 PATH 에 있어야 합니다 (또는 FFMPEG=/경로/ffmpeg).
 */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const FF = process.env.FFMPEG || 'ffmpeg';
const BASE = process.env.BASE || 'http://localhost:8765';
const [, , OUT = 'shorts-out', ...args] = process.argv;
const win = {}; new Function('window', fs.readFileSync(path.join(__dirname, '..', 'episodes.js'), 'utf8'))(win);
const jobs = !args.length || args[0] === 'all' ? win.EPISODES.flatMap(e => ['story', ...e.lessons.map((_, i) => String(i + 1))].map(k => `${e.id}/${k}`)) : args;
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  for (const job of jobs) {
    const [ep, k] = job.split('/');
    const name = `${ep}_${k === 'story' ? 'story' : 'lesson' + k}`;
    const tmp = path.join(OUT, 'tmp_' + name); fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
    const ctx = await b.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2, ignoreHTTPSErrors: true });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(`${BASE}/success-anime/shorts.html?ep=${ep}&k=${k}&rec=1`, { waitUntil: 'networkidle' });
    await p.evaluate(async () => { await window.__fonts; await document.fonts.ready; }); await p.waitForTimeout(1200);
    await p.evaluate(() => document.fonts.ready);
    const cdp = await ctx.newCDPSession(p);
    const frames = [];
    cdp.on('Page.screencastFrame', async f => {
      frames.push({ ts: f.metadata.timestamp, data: f.data });
      cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
    });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: 1080, maxHeight: 1920, everyNthFrame: 1 });
    await p.waitForTimeout(300);
    const t0 = await p.evaluate(() => { Shorts.play(); return window.__t0; });
    await p.waitForFunction(() => window.__done === true, null, { timeout: 120000, polling: 200 });
    await p.waitForTimeout(250);
    await cdp.send('Page.stopScreencast');
    const dur = await p.evaluate(() => Shorts.dur);
    const wav = await p.evaluate(d => AnimeEngine.Snd.renderWav(AnimeEngine.Snd.log, d), dur);
    fs.writeFileSync(path.join(tmp, 'a.wav'), Buffer.from(wav, 'base64'));
    // frames → concat list on the page clock
    let list = '', last = null, n = 0;
    const use = frames.filter(f => f.ts >= t0 - 0.05);
    const before = frames.filter(f => f.ts < t0 - 0.05).pop();
    if (before) use.unshift({ ...before, ts: t0 });
    use.forEach((f, i) => {
      const fn = `f${String(i).padStart(5, '0')}.jpg`; fs.writeFileSync(path.join(tmp, fn), Buffer.from(f.data, 'base64'));
      const next = i + 1 < use.length ? use[i + 1].ts : t0 + dur;
      const d = Math.max(0.001, Math.min(next, t0 + dur) - Math.max(f.ts, t0));
      list += `file '${fn}'\nduration ${d.toFixed(4)}\n`; last = fn; n++;
    });
    list += `file '${last}'\n`;
    fs.writeFileSync(path.join(tmp, 'list.txt'), list);
    const mp4 = path.join(OUT, name + '.mp4');
    execFileSync(FF, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'), '-i', path.join(tmp, 'a.wav'),
      '-vf', 'fps=30,scale=1080:1920:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-c:a', 'aac', '-b:a', '160k',
      '-t', dur.toFixed(2), '-movflags', '+faststart', mp4]);
    fs.rmSync(tmp, { recursive: true, force: true });
    const sz = (fs.statSync(mp4).size / 1e6).toFixed(1);
    console.log(`${name}: ${dur.toFixed(1)}s, ${n} frames (${(n / dur).toFixed(1)} fps captured), ${sz}MB ${errs.length ? 'ERR ' + errs.join('|') : ''}`);
    await ctx.close();
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
