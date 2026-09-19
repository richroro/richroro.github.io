// Shorts cut from a single tall poster: one image, scrolled, no cuts.
//
//   node cards/tools/infographic.mjs <content.json> --tall
//   node cards/tools/scrollshorts.mjs <content.json> [--dur=30] [--style=drive]
//   -> cards/<slug>/shorts.mp4
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const W = 1080, H = 1920;
const HOLD = 1.6; // beat of stillness at each end, so the header and footer read

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `=${d}`).split('=')[1];
if (!process.argv[2]) {
  console.error('usage: node cards/tools/scrollshorts.mjs <content.json> [--dur=30] [--style=drive]');
  process.exit(1);
}
const data = JSON.parse(readFileSync(resolve(process.argv[2]), 'utf8'));
const dur = Number(arg('dur', 30));
const style = arg('style', 'drive');
const poster = resolve(arg('poster', resolve(HERE, '..', data.slug, 'poster-tall.png')));
const outFile = resolve(HERE, '..', data.slug, arg('out', 'shorts.mp4'));

// PNG IHDR carries width and height as big-endian uint32s at byte 16.
const header = readFileSync(poster).subarray(16, 24);
const posterH = header.readUInt32BE(4);
const travel = posterH - H;
if (travel <= 0) throw new Error(`poster is ${posterH}px tall; needs to exceed ${H} to scroll`);

const tmp = mkdtempSync(join(tmpdir(), 'scroll-'));
try {
  console.log(`1/2  bgm (${style}, ${dur}s)`);
  const bgm = join(tmp, 'bgm.wav');
  execFileSync('python3', [resolve(HERE, 'bgm.py'), bgm, String(dur), style], { stdio: 'inherit' });

  console.log(`2/2  encoding — ${travel}px of travel over ${(dur - HOLD * 2).toFixed(1)}s`);
  // y walks from 0 to travel between the two holds; commas inside the
  // expression are escaped so the filter parser does not split on them.
  const y = `(ih-oh)*clip((t-${HOLD})/${(dur - HOLD * 2).toFixed(3)}\\,0\\,1)`;
  execFileSync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error', '-stats',
    '-loop', '1', '-t', String(dur), '-i', poster,
    '-i', bgm,
    '-filter_complex', `[0:v]crop=${W}:${H}:0:'${y}',format=yuv420p,fps=30,setsar=1[v]`,
    '-map', '[v]', '-map', '1:a',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '30',
    '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', '-shortest',
    outFile,
  ], { stdio: 'inherit' });
  console.log(`\n${dur}s -> ${outFile}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
