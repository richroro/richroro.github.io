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
 *
 * 목소리 (VOICE 환경변수)
 *   edge    (기본) Microsoft Edge 신경망 음성. pip install edge-tts, 인터넷 필요.
 *           나레이터는 선희, 인물마다 인준/현수 목소리에 높낮이·빠르기를 달리 줍니다.
 *   espeak  오프라인 기계음. pip install espeakng-loader
 *   none    목소리 없이 배경음·효과음만
 * 대사 길이에 맞춰 컷 길이가 늘어나고, 목소리가 나올 때 배경음이 자동으로 줄어듭니다.
 */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const FF = process.env.FFMPEG || 'ffmpeg';
const BASE = process.env.BASE || 'http://localhost:8765';
const VOICE = process.env.VOICE || 'edge';
const PY = process.env.PYTHON || 'python3';
const FONT_CACHE = process.env.FONT_CACHE; // optional offline copy of the Google Fonts css + files (fonts.css, files/<md5>.woff2)
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
    if (FONT_CACHE) {
      await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ path: path.join(FONT_CACHE, 'fonts.css'), contentType: 'text/css' }));
      await ctx.route('https://fonts.gstatic.com/**', r => r.fulfill({ path: path.join(FONT_CACHE, 'files', require('crypto').createHash('md5').update(r.request().url() + '\n').digest('hex').slice(0, 16) + '.woff2'), contentType: 'font/woff2', headers: { 'access-control-allow-origin': '*' } }));
    }
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(`${BASE}/success-anime/shorts.html?ep=${ep}&k=${k}&rec=1`, { waitUntil: 'networkidle' });
    await p.evaluate(async () => { await window.__fonts; await document.fonts.ready; }); await p.waitForTimeout(1200);
    await p.evaluate(() => document.fonts.ready);
    // voice: synthesize every line first, then rebuild the plan so shots stretch to fit
    let clips = {};
    if (VOICE !== 'none') {
      const vjobs = await p.evaluate(([e, k]) => Shorts.voiceJobs(EPISODES.find(x => x.id === e), k), [ep, k]);
      const jf = path.join(tmp, 'voice.json'), vdir = path.join(tmp, 'voice');
      fs.writeFileSync(jf, JSON.stringify(vjobs.map(j => ({ id: 's' + j.i, text: j.text, voice: j.voice, rate: j.rate, pitch: j.pitch }))));
      let out;
      try { out = execFileSync(PY, [path.join(__dirname, 'voice.py'), VOICE, jf, vdir], { env: { ...process.env, FFMPEG: FF }, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim().split('\n').pop(); }
      catch (e) {
        const msg = String(e.stderr || e.message).trim().split('\n').pop();
        console.error(`\n목소리 합성 실패 (VOICE=${VOICE}): ${msg}\n` + (VOICE === 'edge'
          ? '  · pip install edge-tts 했는지, speech.platform.bing.com 에 접속되는지 확인하세요.\n  · 오프라인이면 VOICE=espeak (기계음) 또는 VOICE=none (목소리 없이).'
          : '  · pip install espeakng-loader 했는지 확인하세요.'));
        process.exit(1);
      }
      const lens = JSON.parse(out), vd = {};
      for (const j of vjobs) { vd[j.i] = lens['s' + j.i]; clips[j.i] = path.join(vdir, `s${j.i}.wav`); }
      await p.evaluate(([e, k, vd]) => { window.__voiceDur = vd; Shorts.load(EPISODES.find(x => x.id === e), k); return window.__fonts; }, [ep, k, vd]);
      await p.waitForTimeout(500);
    }
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
    let audio = path.join(tmp, 'a.wav');
    if (Object.keys(clips).length) {
      // each line starts where its shot actually started (+0.12s), BGM ducks under the voice
      const starts = {}; for (const e of await p.evaluate(() => AnimeEngine.Snd.log.filter(x => x.k === 'shot'))) starts[e.a[0]] = e.t;
      const ids = Object.keys(clips).filter(i => starts[i] != null);
      const args = ['-y', '-loglevel', 'error', '-i', audio]; let fl = '';
      ids.forEach((i, n) => { args.push('-i', clips[i]); const ms = Math.round((starts[i] + .12) * 1000); fl += `[${n + 1}:a]adelay=${ms}|${ms}[v${n}];`; });
      fl += ids.map((_, n) => `[v${n}]`).join('') + `amix=inputs=${ids.length}:normalize=0:duration=longest,volume=1.15[vo];` +
        `[0:a]volume=0.6[bg];[vo]asplit=2[vs][vm];[bg][vs]sidechaincompress=threshold=0.02:ratio=8:attack=15:release=350[duck];` +
        `[duck][vm]amix=inputs=2:normalize=0:duration=first,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=44100[out]`;
      audio = path.join(tmp, 'mix.wav');
      execFileSync(FF, [...args, '-filter_complex', fl, '-map', '[out]', '-ar', '44100', audio]);
    }
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
    execFileSync(FF, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'), '-i', audio,
      '-vf', 'fps=30,scale=1080:1920:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-c:a', 'aac', '-b:a', '160k',
      '-t', dur.toFixed(2), '-movflags', '+faststart', mp4]);
    fs.rmSync(tmp, { recursive: true, force: true });
    const sz = (fs.statSync(mp4).size / 1e6).toFixed(1);
    console.log(`${name}${Object.keys(clips).length ? ` [voice:${VOICE} ×${Object.keys(clips).length}]` : ''}: ${dur.toFixed(1)}s, ${n} frames (${(n / dur).toFixed(1)} fps captured), ${sz}MB ${errs.length ? 'ERR ' + errs.join('|') : ''}`);
    await ctx.close();
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
