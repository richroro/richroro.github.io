// Shorts from a single poster. A poster taller than the frame scrolls; one
// that already fits is held still, which is every card in the current set.
//
//   node cards/tools/infographic.mjs <content.json> --quiet
//   node cards/tools/scrollshorts.mjs <content.json> [--dur=20] [--style=bright]
//   -> cards/<slug>/shorts-quiet.mp4
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const W = 1080, H = 1920;
const HOLD = 1.6; // beat of stillness at each end, so the header and footer read

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `=${d}`).split('=')[1];
if (!process.argv[2]) {
  console.error('usage: node cards/tools/scrollshorts.mjs <content.json> [--dur=20] [--style=bright]');
  process.exit(1);
}
const data = JSON.parse(readFileSync(resolve(process.argv[2]), 'utf8'));
const dur = Number(arg('dur', 30));
const style = arg('style', 'drive');
const poster = resolve(arg('poster', resolve(HERE, '..', data.slug, 'poster-quiet.png')));
const outFile = resolve(HERE, '..', data.slug, arg('out', 'shorts.mp4'));

// PNG IHDR carries width and height as big-endian uint32s at byte 16.
const header = readFileSync(poster).subarray(16, 24);
const posterH = header.readUInt32BE(4);
// A poster that already fits the frame is held still - nothing to reveal.
const travel = Math.max(0, posterH - H);
const still = travel === 0;

// YouTube normalises to about -14 LUFS. The synth lands at -18.5, which it
// leaves alone, so the video just played quieter than everything around it in
// the feed. One-pass loudnorm is a dynamic processor - it hits the number but
// squeezes the music and overshot the peak ceiling to -0.7 dBFS. Measuring
// first and passing the result back lets `linear=true` apply a single gain:
// same dynamics, correct loudness, peak where it was asked to be.
const loudnormFilter = (wav) => {
  // -1.5 was not enough headroom: AAC is lossy and its inter-sample peaks come
  // out above the PCM's, so two topics landed at -0.3 and -0.6 dBFS. -2.5 in
  // the PCM leaves room for that overshoot.
  const spec = 'I=-14:TP=-2.5:LRA=11';
  // loudnorm prints its JSON on stderr, so spawnSync - execFileSync hands back
  // stdout, which is empty here.
  const probe = spawnSync('ffmpeg', [
    '-hide_banner', '-nostats', '-i', wav,
    '-af', `loudnorm=${spec}:print_format=json`, '-f', 'null', '-',
  ], { encoding: 'utf8' });
  const m = String(probe.stderr || '').match(/\{[^{}]*"input_i"[\s\S]*?\}/);
  if (!m) {
    console.error('  ! could not measure loudness; falling back to one pass');
    return `loudnorm=${spec}`;
  }
  const j = JSON.parse(m[0]);
  console.log(`     measured ${j.input_i} LUFS, peak ${j.input_tp} dBFS -> -14 LUFS`);
  return `loudnorm=${spec}:linear=true:measured_I=${j.input_i}`
       + `:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}`
       + `:measured_thresh=${j.input_thresh}:offset=${j.target_offset}`;
};

const tmp = mkdtempSync(join(tmpdir(), 'scroll-'));
try {
  console.log(`1/2  bgm (${style}, ${dur}s)`);
  const bgm = join(tmp, 'bgm.wav');
  execFileSync('python3', [resolve(HERE, 'bgm.py'), bgm, String(dur), style, data.slug],
    { stdio: 'inherit' });

  console.log(still
    ? `2/2  encoding — still frame, ${dur}s`
    : `2/2  encoding — ${travel}px of travel over ${(dur - HOLD * 2).toFixed(1)}s`);
  // y walks from 0 to travel between the two holds; commas inside the
  // expression are escaped so the filter parser does not split on them.
  const y = `(ih-oh)*clip((t-${HOLD})/${(dur - HOLD * 2).toFixed(3)}\\,0\\,1)`;
  const vf = still
    ? `[0:v]scale=${W}:${H},format=yuv420p,fps=30,setsar=1[v]`
    : `[0:v]crop=${W}:${H}:0:'${y}',format=yuv420p,fps=30,setsar=1[v]`;
  execFileSync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error', '-stats',
    '-loop', '1', '-t', String(dur), '-i', poster,
    '-i', bgm,
    '-filter_complex', vf,
    '-map', '[v]', '-map', '1:a',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '30',
    '-af', loudnormFilter(bgm),
    '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', '-shortest',
    outFile,
  ], { stdio: 'inherit' });
  console.log(`\n${dur}s -> ${outFile}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
