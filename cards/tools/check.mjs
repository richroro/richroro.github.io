// Every gate the set has to pass, in one command.
//
//   node cards/tools/check.mjs            # everything
//   node cards/tools/check.mjs 0031       # one topic, by slug or prefix
//
// Each of these caught a real mistake during the build, and each was being run
// by hand and therefore sometimes not at all:
//
//   - a video built from a poster that was corrected afterwards. Nothing about
//     the file looked wrong; only its pixels disagreed with the PNG beside it.
//   - renditions left behind (poster-fit.png, shorts.mp4) after the set moved
//     to one rendition per topic.
//   - audio quieter than the platform target, or peaking too close to 0 dBFS.
//   - figures that disagree between a row, the prose and the YouTube title
//     (factcheck.py), and text below the contrast floor (contrast.mjs).
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const only = process.argv[2];

const KEEP = ['poster-quiet.png', 'shorts-quiet.mp4', 'upload.md'];
const GONE = ['poster.png', 'poster-fit.png', 'poster-tall.png', 'shorts.mp4', 'shorts-fit.mp4'];
// The handwritten card-news sets are shaped differently and keep their own files.
const CARDNEWS = /^000[1-6]-/;

const problems = [];
const fail = (slug, msg) => problems.push(`${slug}: ${msg}`);

const frame = (src, seek) => {
  const a = ['-v', 'error'];
  if (seek) a.push('-ss', seek);
  a.push('-i', src, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-');
  return spawnSync('ffmpeg', a, { maxBuffer: 1 << 28 }).stdout;
};

const slugs = readdirSync(ROOT)
  .filter((d) => /^\d{4}-/.test(d) && statSync(join(ROOT, d)).isDirectory())
  .filter((d) => !CARDNEWS.test(d))
  .filter((d) => !only || d.startsWith(only))
  .sort();

if (!slugs.length) {
  console.error(only ? `no topic matches "${only}"` : 'no topics found');
  process.exit(1);
}

for (const slug of slugs) {
  const dir = join(ROOT, slug);
  const poster = join(dir, 'poster-quiet.png');
  const video = join(dir, 'shorts-quiet.mp4');

  for (const f of KEEP) if (!existsSync(join(dir, f))) fail(slug, `missing ${f}`);
  for (const f of GONE) if (existsSync(join(dir, f))) fail(slug, `${f} is a rendition we no longer keep`);
  if (!existsSync(poster) || !existsSync(video)) continue;

  // --- the video must show the poster as it stands now ---
  const a = frame(video, '1');
  const b = frame(poster);
  if (!a?.length || a.length !== b?.length) {
    fail(slug, `frame size ${a?.length} does not match the poster's ${b?.length}`);
  } else {
    let sum = 0, n = 0;
    for (let i = 0; i < a.length; i += 997, n++) sum += Math.abs(a[i] - b[i]);
    const diff = sum / n;
    // h264 of an identical image lands near 1; a different poster is far higher
    if (diff > 4) fail(slug, `video does not match the poster (mean pixel diff ${diff.toFixed(1)}) - rebuild it`);
  }

  // --- shape and sound ---
  const probe = JSON.parse(execFileSync('ffprobe', [
    '-v', 'error', '-print_format', 'json',
    '-show_entries', 'stream=codec_type,width,height:format=duration', video,
  ], { encoding: 'utf8' }));
  const v = probe.streams.find((s) => s.codec_type === 'video');
  if (v && (v.width !== 1080 || v.height !== 1920)) fail(slug, `${v.width}x${v.height}, expected 1080x1920`);
  if (!probe.streams.some((s) => s.codec_type === 'audio')) fail(slug, 'no audio track');

  const eb = String(spawnSync('ffmpeg', ['-nostats', '-i', video, '-af', 'ebur128=peak=true', '-f', 'null', '-'],
    { encoding: 'utf8' }).stderr).split('Summary:')[1] || '';
  const lufs = Number((eb.match(/I:\s*(-?[\d.]+) LUFS/) || [])[1]);
  const peak = Number((eb.match(/Peak:\s*(-?[\d.]+) dBFS/) || [])[1]);
  if (Number.isFinite(lufs) && Math.abs(lufs + 14) > 1) fail(slug, `${lufs} LUFS, target -14`);
  if (Number.isFinite(peak) && peak > -1) fail(slug, `true peak ${peak} dBFS - too close to clipping`);

  process.stdout.write(`  ${slug} ok\n`);
}

console.log('\n--- factcheck ---');
const fc = spawnSync('python3', [resolve(HERE, 'factcheck.py')], { encoding: 'utf8', cwd: resolve(ROOT, '..') });
process.stdout.write(fc.stdout || '');
if (fc.status !== 0) problems.push('factcheck.py reported inconsistencies');

console.log('--- contrast ---');
const ct = spawnSync('node', [resolve(HERE, 'contrast.mjs')], { encoding: 'utf8' });
const low = (ct.stdout || '').split('\n').filter((l) => l.includes('low') || l.includes('FAIL'));
console.log(low.length ? low.join('\n') : '  every token at or above the floor');
if (low.length) problems.push('contrast below the floor');

console.log();
if (!problems.length) {
  console.log(`${slugs.length} topics, all checks pass`);
  process.exit(0);
}
for (const p of problems) console.log(`  ! ${p}`);
process.exit(1);
