// Build one topic end to end, the way the set is actually published:
// the quiet poster, the shorts cut from it, and the upload sheet.
//
//   node cards/tools/make.mjs cards/tools/content/0031-lotto-tax.json
//   node cards/tools/make.mjs cards/tools/content/0031-lotto-tax.json --dur=20
//
// It used to build --tall and the default poster too. Those renditions are no
// longer committed, so it was re-creating files the repo had just dropped.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
if (!process.argv[2]) {
  console.error('usage: node cards/tools/make.mjs <content.json> [--dur=20] [--style=bright]');
  process.exit(1);
}
const content = resolve(process.argv[2]);
const { slug } = JSON.parse(readFileSync(content, 'utf8'));
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || `=${d}`).split('=')[1];

const run = (f, args) =>
  execFileSync('node', [resolve(HERE, f), content, ...args], { stdio: 'inherit' });

run('infographic.mjs', ['--quiet']);
run('scrollshorts.mjs', [
  `--poster=${resolve(HERE, '..', slug, 'poster-quiet.png')}`,
  `--dur=${arg('dur', 20)}`,
  `--style=${arg('style', 'bright')}`,
  '--out=shorts-quiet.mp4',
]);
run('upload.mjs', []);
