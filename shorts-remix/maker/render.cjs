#!/usr/bin/env node
/* ============================================================
   render.html 을 프레임 단위로 그려 세로 영상(MP4)으로 묶는다.

     node render.cjs                  전체 한 편
     node render.cjs --clips          장면별로 잘라 clips/ 에도 저장
     node render.cjs --fps 24 --crf 22
     FFMPEG=/path/to/ffmpeg node render.cjs

   헤드리스 크로미움이 화면을 그리고, ffmpeg 이 묶는다.
   실시간 녹화가 아니라 한 프레임씩 찍기 때문에 프레임이 빠지지 않는다.
   ============================================================ */
const { execFileSync, execSync, spawn } = require('child_process');
const fs = require('fs'), path = require('path');

/* ---------- 설정 ---------- */
const argv = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i+1] && !argv[i+1].startsWith('--') ? argv[i+1] : dflt;
};
const FPS   = +opt('fps', 30);
const CRF   = +opt('crf', 19);
const OUTDIR = opt('outdir', path.join(__dirname, 'out'));
const OUT   = opt('out', path.join(OUTDIR, 'short.mp4'));
const CLIPS = argv.includes('--clips');
const PAGE  = 'file://' + path.join(__dirname, 'render.html');

/* ---------- ffmpeg 찾기 ---------- */
function findFfmpeg(){
  const tries = [
    () => process.env.FFMPEG,
    () => execSync('command -v ffmpeg', {encoding:'utf8'}).trim(),
    () => execSync('python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"',
                   {encoding:'utf8', stdio:['ignore','pipe','ignore']}).trim(),
  ];
  for(const t of tries){
    try{ const p = t(); if(p && fs.existsSync(p)) return p; }catch(e){}
  }
  console.error('ffmpeg 을 찾지 못했습니다. 설치하거나 FFMPEG=/경로 로 알려주세요.');
  console.error('  · apt: sudo apt install ffmpeg');
  console.error('  · python: pip install imageio-ffmpeg');
  process.exit(1);
}
const FF = findFfmpeg();
const hasX264 = (() => {
  try{ return execFileSync(FF, ['-hide_banner','-encoders'], {encoding:'utf8'}).includes('libx264'); }
  catch(e){ return false; }
})();
const VIDEO_ARGS = hasX264
  ? ['-c:v','libx264','-preset','medium','-crf',String(CRF),'-pix_fmt','yuv420p','-profile:v','high',
     '-c:a','aac','-b:a','128k','-shortest','-movflags','+faststart']
  : ['-c:v','libvpx','-b:v','4M','-pix_fmt','yuv420p','-an'];

/* ---------- 플레이라이트 찾기 ---------- */
let chromium;
try{
  ({ chromium } = require('playwright'));
}catch(e){
  try{
    const root = execSync('npm root -g', {encoding:'utf8'}).trim();
    ({ chromium } = require(path.join(root, 'playwright')));
  }catch(e2){
    console.error('playwright 가 필요합니다:  npm i -g playwright  (또는 npm i playwright)');
    process.exit(1);
  }
}

/* ---------- 인코더 한 대 띄우기 ---------- */
function encoder(outPath, noAudio){
  fs.mkdirSync(path.dirname(outPath), {recursive:true});
  const args = ['-y','-hide_banner','-loglevel','error',
                '-f','image2pipe','-framerate',String(FPS),'-i','-'];
  if(hasX264 && !noAudio) args.push('-f','lavfi','-i','anullsrc=channel_layout=stereo:sample_rate=44100');
  args.push(...VIDEO_ARGS, outPath);
  const ff = spawn(FF, args);
  let err = '';
  ff.stderr.on('data', d => { err += d; if(err.length > 8000) err = err.slice(-4000); });
  return { ff, done: new Promise(res => ff.on('close', c => res({code:c, err}))) };
}
async function feed(enc, buf){
  if(!enc.ff.stdin.write(buf)) await new Promise(r => enc.ff.stdin.once('drain', r));
}

(async () => {
  const t0 = Date.now();
  const browser = await chromium.launch();
  const page = await (await browser.newContext({
    viewport:{width:1080, height:1920}, deviceScaleFactor:1,
  })).newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(PAGE, {waitUntil:'load'});
  await page.evaluate(() => window.__ready);
  await page.waitForTimeout(700);           /* 웹폰트가 실제로 적용될 때까지 */

  const dur = await page.evaluate(() => window.__dur());
  const scenes = CLIPS ? await page.evaluate(() => window.__scenes()) : [];
  const total = Math.round(dur*FPS);
  console.log(`길이 ${dur.toFixed(1)}초 · ${FPS}fps · ${total}프레임 · ${hasX264 ? 'H.264 MP4' : 'VP8 WebM(=x264 없음)'}`);

  const main = encoder(OUT);
  const clipEnc = scenes.map(s => {
    const ext = hasX264 ? '.mp4' : '.webm';
    const file = path.join(OUTDIR, 'clips', String(scenes.indexOf(s)+1).padStart(2,'0') + '_' + s.id + ext);
    return { s, enc: encoder(file), file };
  });

  for(let i = 0; i < total; i++){
    const t = i/FPS;
    const d = await page.evaluate(tt => {
      window.__draw(tt);
      return document.getElementById('cv').toDataURL('image/jpeg', 0.93);
    }, t);
    const buf = Buffer.from(d.slice(d.indexOf(',')+1), 'base64');
    await feed(main, buf);
    for(const c of clipEnc) if(t >= c.s.t0 && t < c.s.t1) await feed(c.enc, buf);
    if(i % 150 === 0) process.stdout.write(`  ${i}/${total} (${((Date.now()-t0)/1000).toFixed(0)}초)\n`);
  }

  main.ff.stdin.end();
  clipEnc.forEach(c => c.enc.ff.stdin.end());
  await browser.close();

  const results = await Promise.all([main.done, ...clipEnc.map(c => c.enc.done)]);
  const failed = results.filter(r => r.code !== 0);
  if(errs.length) console.log('페이지 오류:', errs.slice(0,3));
  if(failed.length){
    console.error('인코딩 실패:', failed[0].err.slice(-600));
    process.exit(1);
  }
  const mb = f => (fs.statSync(f).size/1048576).toFixed(1) + 'MB';
  console.log(`\n완성  ${OUT}  ${mb(OUT)}`);
  clipEnc.forEach(c => console.log(`      ${c.file}  ${c.s.dur}초  ${mb(c.file)}`));
  console.log(`소요 ${((Date.now()-t0)/1000).toFixed(0)}초`);
})();
