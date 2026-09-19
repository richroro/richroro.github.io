// Build a YouTube Shorts cut (1080x1920) from a card content JSON:
// renders 9:16 frames, synthesises the bgm, and slides between the cards.
//
//   node cards/tools/shorts.mjs cards/tools/content/0006-younger-me.json
//   -> cards/<slug>/shorts.mp4
//
// With --frames=<dir>, it uses frames another renderer already produced (and
// that dir's manifest.json for the hold times) instead of rendering cards:
//   node cards/tools/rankcards.mjs <content.json> /tmp/f
//   node cards/tools/shorts.mjs <content.json> --frames=/tmp/f --out=shorts.mp4
//
// Needs ffmpeg (libx264 + aac) and python3 with numpy for the bgm.
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));

// Hold times, in seconds. The cover is a hook so it goes by quickly; the list
// cards need long enough to read a title plus three items.
const COVER = 3.6;
const LIST = 4.6;
const OUTRO = 4.0;
const SLIDE = 0.7; // cards slide the way you'd swipe through the carousel

if (!process.argv[2]) {
  console.error('usage: node cards/tools/shorts.mjs <content.json>');
  process.exit(1);
}
const arg = (k) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1];
const contentPath = resolve(process.argv[2]);
const data = JSON.parse(readFileSync(contentPath, 'utf8'));
const framesDir = arg('frames') ? resolve(arg('frames')) : null;
const outFile = resolve(HERE, '..', data.slug, arg('out') || 'shorts.mp4');
const slide = Number(arg('slide') || SLIDE);

const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit' });
const tmp = mkdtempSync(join(tmpdir(), 'shorts-'));

try {
  let dir, names, durations;
  if (framesDir) {
    console.log('1/3  using prepared frames');
    dir = framesDir;
    const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
    names = manifest.map((m) => m.file);
    durations = manifest.map((m) => m.seconds);
  } else {
    console.log('1/3  rendering 9:16 frames');
    run('node', [resolve(HERE, 'render.mjs'), contentPath, join(tmp, 'frames'), '--frame=1080x1920']);
    dir = join(tmp, 'frames');
    durations = [COVER, ...data.lists.map(() => LIST), OUTRO];
    names = [
      '01_cover.png',
      ...data.lists.map((_, i) => `${String(i + 2).padStart(2, '0')}_list${String(i + 1).padStart(2, '0')}.png`),
      `${String(data.lists.length + 2).padStart(2, '0')}_outro.png`,
    ];
  }
  const total = durations.reduce((a, d) => a + d, 0) - (durations.length - 1) * slide;

  console.log(`2/3  writing bgm (${total.toFixed(1)}s)`);
  const bgm = join(tmp, 'bgm.wav');
  run('python3', [resolve(HERE, 'bgm.py'), bgm, total.toFixed(2)]);

  console.log('3/3  encoding');
  const inputs = names.flatMap((n, i) => ['-loop', '1', '-t', String(durations[i]), '-i', join(dir, n)]);

  // Normalise every still, then slide each one over the last. xfade's offset is
  // measured on the chain built so far, which is why it tracks the running total.
  const steps = names.map((_, i) => `[${i}:v]format=yuv420p,fps=30,settb=AVTB[v${i}]`);
  let acc = durations[0];
  let last = '[v0]';
  for (let i = 1; i < names.length; i++) {
    const tag = `[x${i}]`;
    steps.push(`${last}[v${i}]xfade=transition=slideleft:duration=${slide}:offset=${(acc - slide).toFixed(3)}${tag}`);
    acc += durations[i] - slide;
    last = tag;
  }

  run('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error', '-stats',
    ...inputs, '-i', bgm,
    '-filter_complex', steps.join(';'),
    '-map', last, '-map', `${names.length}:a`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '30',
    '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', '-shortest',
    outFile,
  ]);
  console.log(`\n${total.toFixed(1)}s -> ${outFile}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
