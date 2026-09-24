/* ============================================================================
   전부 돌린다.   node correspondent/test/run-all.mjs

   준비물: 저장소 뿌리에서  npm install --no-save playwright axe-core  와
           npx playwright install chromium.
   Postgres(psql·createdb)가 있으면 서버 쪽 세 묶음도 돈다. 없으면 건너뛰고 그렇다고 적는다 —
   조용히 통과한 척하지 않는다. CI 에서는 TPW_REQUIRE_DB=1 로 건너뛰기를 실패로 친다.
   ========================================================================== */
import { spawn, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const PORT = Number(process.env.PORT || 8199);
const APP_URL = `http://127.0.0.1:${PORT}/correspondent/`;

const BROWSER = ['feed', 'edge', 'rereport', 'insight', 'pwa', 'privacy', 'terms', 'a11y'];
const SERVER = ['test-sql', 'test-push', 'test-e2e'];

function run(file, env) {
  return new Promise((done) => {
    const t0 = Date.now();
    const ch = spawn(process.execPath, [file], { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    ch.stdout.on('data', (d) => { out += d; });
    ch.stderr.on('data', (d) => { out += d; });
    ch.on('close', (code) => {
      const m = out.match(/==== (\d+) 통과 \/ (\d+) 실패 ====/);
      done({ code, pass: m ? +m[1] : 0, fail: m ? +m[2] : (code ? 1 : 0), out, sec: ((Date.now() - t0) / 1000).toFixed(0) });
    });
  });
}

const web = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
process.on('exit', () => web.kill());
for (let i = 0; i < 50; i++) {
  try { if ((await fetch(APP_URL)).ok) break; } catch (e) {}
  await new Promise((r) => setTimeout(r, 200));
}

const rows = [];
let bad = false;
for (const name of BROWSER) {
  const r = await run(resolve(HERE, name + '.mjs'), { APP_URL });
  rows.push([name, r]);
  if (r.code || r.fail) { bad = true; console.log(r.out); }
}
const hasPg = spawnSync('psql', ['-X', '-tAc', 'select 1', '-d', 'postgres'], { encoding: 'utf8' }).stdout?.trim() === '1';
for (const name of SERVER) {
  if (!hasPg) { rows.push([name, null]); if (process.env.TPW_REQUIRE_DB) bad = true; continue; }
  const r = await run(resolve(HERE, '..', 'server', name + '.mjs'), {});
  rows.push([name, r]);
  if (r.code || r.fail) { bad = true; console.log(r.out); }
}

console.log('\n묶음          통과  실패   시간');
let P = 0, F = 0;
for (const [n, r] of rows) {
  if (!r) { console.log(n.padEnd(12) + '   건너뜀 — Postgres 없음'); continue; }
  P += r.pass; F += r.fail;
  console.log(n.padEnd(12) + String(r.pass).padStart(6) + String(r.fail).padStart(6) + (r.sec + 's').padStart(7) + (r.code && !r.fail ? '  (비정상 종료)' : ''));
}
console.log('─'.repeat(34) + '\n합계        ' + String(P).padStart(6) + String(F).padStart(6));
process.exit(bad ? 1 : 0);
