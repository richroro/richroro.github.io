// anim.js 를 헤드리스 크롬에서 한 프레임씩 그려 ffmpeg 로 MP4 를 만든다.
//   node render.mjs --fonts <폰트 css 경로> --out out.mp4 [--audio music.wav] [--stills 1,5.5,18.6]
// --fonts 는 Google Fonts CSS 를 woff2 까지 내려받아 로컬 경로로 바꾼 파일 (render 환경이 오프라인이어도 되게).
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith('--') && a.push([v.slice(2), all[i + 1]]), a), []));
const fontsCss = resolve(args.fonts);
const out = resolve(args.out || 'opus-short.mp4');
const ffmpeg = args.ffmpeg || 'ffmpeg';

const html = `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="${pathToFileURL(fontsCss)}">
<style>body{margin:0;background:#000}</style>
<canvas id="c" width="1080" height="1920"></canvas>
<script src="${pathToFileURL(resolve(here, '../anim.js'))}"></script>`;
const page_ = resolve(dirname(fontsCss), '_render.html');
writeFileSync(page_, html);

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto(pathToFileURL(page_).href);
await page.evaluate(async () => {
  const S = window.OpusShort, text = S.TEXTS.join('');
  await Promise.all(S.FONTS.map(([fam, w]) => document.fonts.load(`${w} 60px ${fam.split(',')[0]}`, text)));
  await document.fonts.ready;
  window.ctx = document.getElementById('c').getContext('2d');
});
const missing = await page.evaluate(() => window.OpusShort.FONTS.map(([f, w]) => [f.split(',')[0], document.fonts.check(`${w} 60px ${f.split(',')[0]}`, '한글Aa')]));
console.log('fonts', missing);

const { DUR, FPS } = await page.evaluate(() => ({ DUR: window.OpusShort.DUR, FPS: window.OpusShort.FPS }));

if (args.stills) {
  const dir = resolve(args.out || 'stills'); mkdirSync(dir, { recursive: true });
  for (const s of args.stills.split(',').map(Number)) {
    const url = await page.evaluate(t => { window.OpusShort.draw(window.ctx, t); return document.getElementById('c').toDataURL('image/jpeg', .85); }, s);
    writeFileSync(`${dir}/still-${String(s).padStart(5, '0')}.jpg`, Buffer.from(url.split(',')[1], 'base64'));
  }
  await browser.close();
  process.exit(0);
}

const total = Math.round(DUR * FPS);
const ff = spawn(ffmpeg, [
  '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
  ...(args.audio ? ['-i', resolve(args.audio), '-c:a', 'aac', '-b:a', '192k', '-shortest'] : []),
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out
], { stdio: ['pipe', 'inherit', 'inherit'] });

const BATCH = 10;
for (let f = 0; f < total; f += BATCH) {
  const urls = await page.evaluate(([f0, n, fps]) => {
    const res = [], cv = document.getElementById('c');
    for (let i = 0; i < n; i++) { window.OpusShort.draw(window.ctx, (f0 + i) / fps); res.push(cv.toDataURL('image/png')); }
    return res;
  }, [f, Math.min(BATCH, total - f), FPS]);
  for (const u of urls) {
    if (!ff.stdin.write(Buffer.from(u.slice(u.indexOf(',') + 1), 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
  }
  if (f % 150 === 0) console.log(`frame ${f}/${total}`);
}
ff.stdin.end();
await new Promise(r => ff.on('close', r));
await browser.close();
console.log('done', out);
