// Build a topic end to end: tall poster, wide poster, and the scrolling shorts.
//
//   node cards/tools/make.mjs cards/tools/content/0009-foo.json [--dur=30] [--style=drive]
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const content = resolve(process.argv[2] || '');
const pass = process.argv.slice(3).filter((a) => a.startsWith('--'));
const run = (f, args) => execFileSync('node', [resolve(HERE, f), content, ...args], { stdio: 'inherit' });

run('infographic.mjs', ['--tall']);
run('infographic.mjs', []);
execFileSync('node', [resolve(HERE, 'scrollshorts.mjs'), content, ...pass],
  { stdio: ['inherit', 'inherit', 'inherit'] });
