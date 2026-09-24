/* ============================================================================
   공용 보드 끝에서 끝까지 — 브라우저 → fetch → 모의 PostgREST → 진짜 Postgres 의 진짜 RLS.

     PGHOST=… PGUSER=postgres node test-e2e.mjs

   혼자 다 띄우고 혼자 치운다:
     · 임시 DB tpw_e2e_<pid> — schema·policies·seed·retention 설치, 끝나면 지움
     · 모의 PostgREST (test-mock-rest.mjs) — 앱이 보낸 값을 그대로 넣는다
     · 앱 사본 + 모의 서버를 가리키는 config.js 를 정적 서버로
   토큰은 시험용 Bearer test-<uuid>. 로그인 화면은 건너뛰고 세션을 직접 심는다.
   ========================================================================== */
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync, cpSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(HERE, '..');
const DB = 'tpw_e2e_' + process.pid;
const MOCK_PORT = 54000 + (process.pid % 900);
const WEB_PORT = MOCK_PORT + 1000;
const API = 'http://127.0.0.1:' + MOCK_PORT;
const URL = 'http://127.0.0.1:' + WEB_PORT + '/correspondent/';
const HOOD = '4117110100';
const U = {
  민지: '11111111-1111-1111-1111-111111111111',
  준호: '22222222-2222-2222-2222-222222222222',
  서연: '33333333-3333-3333-3333-333333333333',
  태오: '44444444-4444-4444-4444-444444444444',
  하린: '55555555-5555-5555-5555-555555555555'
};
const PSQL = ['-X', '-tA', '-d', DB];
const sql = (q) => execFileSync('psql', [...PSQL, '-c', q], { encoding: 'utf8' }).trim();

/* ─────────────────────────── 띄우기 ─────────────────────────── */
const kids = [];
const web = mkdtempSync(join(tmpdir(), 'tpw-e2e-'));
function teardown() {
  for (const k of kids) { try { k.kill(); } catch (e) {} }
  spawnSync('dropdb', ['--if-exists', DB]);
  rmSync(web, { recursive: true, force: true });
}
process.on('exit', teardown);
process.on('SIGINT', () => process.exit(130));

execFileSync('createdb', [DB]);
const base = ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-d', DB];
for (const f of ['test-auth-stub.sql', 'schema.sql', 'policies.sql', 'admin.sql', 'seed-hoods.sql'])
  execFileSync('psql', [...base, '-f', resolve(HERE, f)], { stdio: ['ignore', 'ignore', 'pipe'] });
const ret = readFileSync(resolve(HERE, 'retention.sql'), 'utf8').split('여기부터는 Supabase 에서만')[0];
execFileSync('psql', base, { input: ret.slice(0, ret.lastIndexOf('\n')) });

cpSync(APP_DIR, join(web, 'correspondent'), { recursive: true,
  filter: (src) => !/node_modules|[\\/]server[\\/]|[\\/]test[\\/]|[\\/]tools[\\/]/.test(src) });
writeFileSync(join(web, 'correspondent', 'config.js'),
  `window.TPW_CONFIG = { url: "${API}", anonKey: "test-anon-key", hood: "" };\n`);
/* 앱의 CSP 는 Supabase(https://*.supabase.co)에만 연결을 허락한다. 사본에만 모의 서버 주소를 더한다 —
   운영에서 다른 주소(자체 도메인)를 쓰면 똑같이 connect-src 에 더해야 한다(SETUP.md). */
for (const f of ['index.html', 'admin.html']) {
  const file = join(web, 'correspondent', f);
  const html = readFileSync(file, 'utf8');
  if (!html.includes('https://*.supabase.co')) { console.error(f + ' 에 CSP connect-src 가 없습니다'); process.exit(1); }
  writeFileSync(file, html.replace('https://*.supabase.co', 'https://*.supabase.co ' + API));
}

kids.push(spawn(process.execPath, [resolve(HERE, 'test-mock-rest.mjs')],
  { env: { ...process.env, PGDATABASE: DB, MOCK_PORT: String(MOCK_PORT) }, stdio: 'ignore' }));
kids.push(spawn('python3', ['-m', 'http.server', String(WEB_PORT), '--bind', '127.0.0.1'], { cwd: web, stdio: 'ignore' }));
for (const u of [API + '/rest/v1/hoods', URL]) {
  let up = false;
  for (let i = 0; i < 50 && !up; i++) {
    try { up = (await fetch(u)).ok; } catch (e) {}
    if (!up) await new Promise((r) => setTimeout(r, 200));
  }
  if (!up) { console.error('못 띄웠습니다: ' + u); process.exit(1); }
}

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const errs = [];
/* 서버가 일부러 거부한 요청(400)은 브라우저가 콘솔 오류로 찍는다 — 재신고, 정지 중 쓰기·신고.
   오류로 치지 않고 어느 주소였는지 모아서, 그 셋 말고는 없었는지 마지막에 본다. */
const rejected = [];

// 새로 만든 DB 라 비어 있다. 모의 서버의 기억도 새것이다.

const b = await chromium.launch();

async function phone(name, opts = {}) {
  const c = await b.newContext({ locale: 'ko-KR', timezoneId: 'Asia/Seoul', viewport: { width: 390, height: 844 } });
  const p = await c.newPage();
  p.on('dialog', (d) => d.accept());          // 지우기 확인창은 "예"
  p.on('pageerror', (e) => errs.push(name + ': ' + e.message));
  p.on('console', (m) => { const t = m.text();
    if (m.type() !== 'error' || /ERR_CERT|fonts\.g/.test(t)) return;
    if (/status of 400/.test(t)) rejected.push(name + ' ' + m.location().url.replace(/^https?:\/\/[^/]+/, '').split('?')[0]);
    else errs.push(name + ' console: ' + t); });
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.evaluate(({ uid, me, hood, login }) => {
    if (login) localStorage.setItem('tpw.session', JSON.stringify(
      { access_token: 'test-' + uid, refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 9999, uid }));
    localStorage.setItem('tpw.v1', JSON.stringify({ reports: [], me, seeded: true, hood }));
  }, { uid: U[name], me: opts.noName ? '' : name, hood: HOOD, login: opts.login !== false });
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(700);
  return { c, p };
}
async function write(p, place, opts = {}) {
  await p.locator('#writeBtn').click();
  await p.waitForSelector('#composeBack.open');
  await p.fill('#fPlace', place);
  if (opts.crowd != null) await p.locator(`#fCrowd [data-v="${opts.crowd}"]`).click();
  if (opts.priv) await p.locator('#fPub').uncheck();
  await p.locator('#composeGo').click();
  await p.waitForSelector('#shareBack.open');
  await p.locator('#shareBack [data-close]').last().click();
  await p.waitForTimeout(900);
}
const refresh = async (p) => { await p.evaluate(() => boardRefresh(true)); await p.waitForTimeout(500); };
const card = (p, place) => p.locator('#feed .card', { hasText: place });
const local = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('tpw.v1')).reports);

console.log('\n== 1. 로그인 전 ==');
{
  const { c, p } = await phone('민지', { login: false });
  await p.locator('#boardBtn').click();
  await p.waitForSelector('#boardBack.open');
  ok(await p.locator('#inKakao').isDisabled(), '만 14세 확인 전에는 카카오 로그인 단추가 꺼져 있다');
  ok(await p.locator('#inEmailGo').isDisabled(), '메일 로그인 단추도 꺼져 있다');
  await p.locator('#ageOk').check();
  ok(await p.locator('#inKakao').isEnabled(), '확인하면 켜진다');
  ok(await p.locator('#authBox a[href="privacy.html"]').count() === 1, '처리방침 링크가 옆에 있다');
  await c.close();
}

console.log('\n== 2. 이름을 한 번도 저장 안 한 사람의 첫 글 ==');
const A = await phone('민지', { noName: true });
await write(A.p, '중앙공원 놀이터', { crowd: 1 });
ok(sql(`select count(*) from reports where place='중앙공원 놀이터'`) === '1', '프로필을 먼저 만들고 올라간다 (예전엔 여기서 실패)');
ok(sql(`select by_name from reports where place='중앙공원 놀이터'`) === '이름 없는 특파원', '이름 없이 쓰면 그 이름으로');

console.log('\n== 3. 준호 폰으로 내려오고, 남의 글은 다시 안 올라간다 ==');
const B = await phone('준호');
ok(await card(B.p, '중앙공원 놀이터').count() === 1, '받아옴');
ok(await card(B.p, '중앙공원 놀이터').locator('[data-flag]').count() === 1, '남의 글엔 신고 단추');
ok(await card(A.p, '중앙공원 놀이터').locator('[data-flag]').count() === 0, '내 글엔 신고 단추 없음');
await refresh(B.p);
ok(sql(`select count(*) from reports`) === '1', '받아오기를 돌려도 서버 건수 그대로');

console.log('\n== 4. 비공개로 쓴 글 ==');
await write(B.p, '준호 혼자 보는 메모', { priv: true });
ok(sql(`select count(*) from reports where place='준호 혼자 보는 메모'`) === '0', '공용 보드에 안 올라간다');
ok(await card(B.p, '준호 혼자 보는 메모').locator('.badge', { hasText: '이 기기에만' }).count() === 1, '"이 기기에만" 딱지');
await refresh(B.p);
ok(sql(`select count(*) from reports where place='준호 혼자 보는 메모'`) === '0', '받아오기를 돌려도 안 올라간다');

console.log('\n== 5. 로그아웃 상태로 쓴 글은 로그인하면 올라간다 ==');
const C = await phone('서연', { login: false });
await write(C.p, '서연의 카페');
ok(sql(`select count(*) from reports where place='서연의 카페'`) === '0', '로그인 전엔 안 올라감');
await C.p.evaluate((uid) => localStorage.setItem('tpw.session', JSON.stringify(
  { access_token: 'test-' + uid, refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 9999, uid })), U.서연);
await C.p.reload({ waitUntil: 'networkidle' });
await C.p.waitForTimeout(1200);
ok(sql(`select count(*) from reports where place='서연의 카페'`) === '1', '로그인하고 다시 열면 올라감');

console.log('\n== 6. 내 글 지우기 → 서버에서도 ==');
await write(A.p, '민지가 지울 글');
ok(sql(`select count(*) from reports where place='민지가 지울 글'`) === '1', '올라감');
await card(A.p, '민지가 지울 글').locator('[data-del]').click();
await A.p.waitForTimeout(800);
ok(sql(`select count(*) from reports where place='민지가 지울 글'`) === '0', '서버에서 지워짐');
ok(await card(A.p, '민지가 지울 글').count() === 0, '화면에서도 사라짐');

console.log('\n== 7. 남의 글 치우기 → 이 기기에서만, 다시 안 들어온다 ==');
await refresh(B.p);
ok(await card(B.p, '서연의 카페').count() === 1, '준호 폰에 서연 글이 있다');
await card(B.p, '서연의 카페').locator('[data-del]').click();
await B.p.waitForTimeout(500);
ok(sql(`select count(*) from reports where place='서연의 카페'`) === '1', '서버엔 그대로 (남의 글이라)');
await refresh(B.p);
ok(await card(B.p, '서연의 카페').count() === 0, '다시 받아와도 안 돌아온다');

console.log('\n== 8. 신고로 가려진 내 글 ==');
await write(C.p, '가려질 서연 글');
const rid = sql(`select id from reports where place='가려질 서연 글'`);
for (const who of ['민지', '준호', '태오']) {
  const D = who === '민지' ? A : who === '준호' ? B : await phone('태오');
  await refresh(D.p);
  await card(D.p, '가려질 서연 글').locator('[data-flag]').click();
  await D.p.waitForSelector('#flagBack.open');
  await D.p.locator('#flagReasons [data-reason="거짓"]').click();
  await D.p.waitForTimeout(700);
  if (who === '태오') await D.c.close();
  else { await D.p.keyboard.press('Escape'); }
}
ok(sql(`select hidden from reports where id='${rid}'`) === 't', '서버에서 가려짐');
await refresh(A.p);
ok(await card(A.p, '가려질 서연 글').count() === 0, '받아 둔 이웃 폰(민지)에서도 빠진다');
await refresh(C.p);
ok(await card(C.p, '가려질 서연 글').locator('.badge', { hasText: '신고로 가려짐' }).count() === 1, '쓴 사람에게는 "신고로 가려짐" 딱지와 함께 보인다');
// 로그아웃하고 받아오면 가려진 내 글은 응답에 없다 — 그래도 이 기기에서 지우면 안 된다
const sess = await C.p.evaluate(() => localStorage.getItem('tpw.session'));
await C.p.evaluate(() => localStorage.removeItem('tpw.session'));
await C.p.reload({ waitUntil: 'networkidle' }); await C.p.waitForTimeout(600);
await refresh(C.p);
ok(await card(C.p, '가려질 서연 글').count() === 1, '로그아웃하고 받아와도 가려진 내 글은 이 기기에 남는다');
await C.p.evaluate((v) => localStorage.setItem('tpw.session', v), sess);
await C.p.reload({ waitUntil: 'networkidle' }); await C.p.waitForTimeout(600);
await refresh(C.p);
await card(C.p, '가려질 서연 글').locator('[data-del]').click();
await C.p.waitForTimeout(800);
ok(sql(`select count(*) from reports where id='${rid}'`) === '0', '가려진 내 글도 내가 지울 수 있다 (예전엔 0건 삭제로 남았다)');

console.log('\n== 9. 계정 삭제 ==');
// 서연도 남의 글을 하나 신고해 둔다 — 탈퇴하면 이 신고도 지워지고 수가 다시 세어져야 한다
await refresh(C.p);
await card(C.p, '중앙공원 놀이터').locator('[data-flag]').click();
await C.p.waitForSelector('#flagBack.open');
await C.p.locator('#flagReasons [data-reason="기타"]').click();
await C.p.waitForTimeout(700);
await C.p.keyboard.press('Escape');
const cpId = sql(`select id from reports where place='중앙공원 놀이터'`);
ok(sql(`select flag_count from reports where id='${cpId}'`) === '1', '서연이 중앙공원 글을 신고해 둠 (신고 1)');
await refresh(B.p);
ok(await card(B.p, '서연').count() + await card(B.p, '중앙공원').count() >= 1, '준호 폰에 받아 둔 글이 있다');
await write(C.p, '서연 마지막 글');
await refresh(B.p);
ok(await card(B.p, '서연 마지막 글').count() === 1, '준호 폰에 서연 마지막 글');
await C.p.locator('#boardBtn').click();
await C.p.waitForSelector('#boardBack.open');
await C.p.locator('#delOpen').click();
await C.p.waitForSelector('#delBack.open');
ok(await C.p.locator('#delGo').isDisabled(), '처음엔 삭제 단추가 꺼져 있다');
await C.p.fill('#delConfirm', '탈퇴함');
ok(await C.p.locator('#delGo').isDisabled(), '"탈퇴" 가 아니면 안 켜진다');
await C.p.fill('#delConfirm', '탈퇴');
ok(await C.p.locator('#delGo').isEnabled(), '"탈퇴" 라고 적으면 켜진다');
await C.p.locator('#delGo').click();
await C.p.waitForTimeout(1000);
ok(sql(`select count(*) from auth.users where id='${U.서연}'`) === '0', '서버: 로그인 계정 삭제');
ok(sql(`select count(*) from correspondents where id='${U.서연}'`) === '0', '서버: 프로필 삭제');
ok(sql(`select count(*) from reports where place like '서연%'`) === '0', '서버: 서연이 쓴 글 전부 삭제');
ok(sql(`select count(*) from flags where reporter='${U.서연}'`) === '0', '서버: 서연이 한 신고 삭제');
const cl = await local(C.p);
ok(cl.filter((r) => r.mine).length === 0, '이 기기: 내 글 지움');
ok(!(await C.p.evaluate(() => localStorage.getItem('tpw.session'))), '이 기기: 로그아웃');
ok((await C.p.evaluate(() => JSON.parse(localStorage.getItem('tpw.v1')).me)) === '', '이 기기: 이름 지움');
ok(await card(C.p, '중앙공원 놀이터').count() === 1, '이 기기: 남에게 받은 글은 남는다');
await refresh(B.p);
ok(await card(B.p, '서연 마지막 글').count() === 0, '준호 폰에서도 다음 받아오기 때 서연 글이 빠진다');
ok(sql(`select flag_count from reports where id='${cpId}'`) === '0', '서연이 한 신고가 빠지고 수가 다시 세어짐 (1 → 0)');
ok(sql(`select count(*) from correspondents`) === '3', '다른 사람들은 그대로 (민지·준호·태오)');

console.log('\n== 10. 운영 화면 ==');
const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
async function axe(p, where) {
  await p.evaluate(AXE);
  const v = await p.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag',
    values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } })).violations
    .map((x) => x.id + '(' + x.nodes.length + '): ' + x.nodes[0].target.join(' ')));
  ok(v.length === 0, 'axe 위반 0 — ' + where + (v.length ? ' — ' + v.join(' | ') : ''));
}
async function console_(name, scheme = 'light') {
  const c = await b.newContext({ locale: 'ko-KR', timezoneId: 'Asia/Seoul', viewport: { width: 390, height: 844 }, colorScheme: scheme });
  if (name) await c.addInitScript((uid) => localStorage.setItem('tpw.session', JSON.stringify(
    { access_token: 'test-' + uid, refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 9999, uid })), U[name]);
  const p = await c.newPage();
  p.on('pageerror', (e) => errs.push('운영 ' + (name || '') + ': ' + e.message));
  p.on('console', (m) => { const t = m.text();
    if (m.type() === 'error' && !/ERR_CERT|fonts\.g|status of 400/.test(t)) errs.push('운영 console: ' + t); });
  await p.goto(URL + 'admin.html', { waitUntil: 'networkidle' });
  return { c, p };
}
const item = (p, place) => p.locator('.item', { hasText: place });
{
  const { c, p } = await console_(null);
  ok((await p.locator('#gate').innerText()).includes('로그인이 필요합니다'), '로그인 안 했으면 로그인하라고만 한다');
  ok(await p.locator('#tabs').isHidden(), '  └ 탭도 안 보인다');
  await c.close();
}
{
  const { c, p } = await console_('준호');
  const g = await p.locator('#gate').innerText();
  ok(g.includes('운영자가 아닙니다') && g.includes(U.준호), '운영자가 아니면 막고, 운영자로 넣는 SQL 에 자기 계정 번호를 채워 보인다');
  await c.close();
}
sql(`insert into admins (id, note) values ('${U.민지}', '시험 운영자');`);
await write(B.p, '준호 신고될 글', { crowd: 3 });
const qid = sql(`select id from reports where place='준호 신고될 글'`);
const T = await phone('태오'), H = await phone('하린');
for (const X of [A, T, H]) {
  await refresh(X.p);
  await card(X.p, '준호 신고될 글').locator('[data-flag]').click();
  await X.p.waitForSelector('#flagBack.open');
  await X.p.locator('#flagReasons [data-reason="거짓"]').click();
  await X.p.waitForTimeout(700);
  await X.p.keyboard.press('Escape');
}
ok(sql(`select hidden from reports where id='${qid}'`) === 't', '신고 셋 — 가려짐');
const M = await console_('민지');
await M.p.waitForSelector('#queue .item');
let it = item(M.p, '준호 신고될 글');
ok(await it.count() === 1, '운영자 대기열에 올라온다');
ok((await it.locator('.why').innerText()) === '신고로 가려짐' && (await it.locator('.flags').innerText()).includes('신고 3건 — 거짓 3'),
   '  └ 왜 올라왔는지, 무슨 신고인지');
ok((await M.p.locator('#nQueue').innerText()) === '1', '  └ 탭에 건수');
await axe(M.p, '대기열');
await it.locator('[data-act="restore"]').click();
await M.p.waitForFunction(() => !document.querySelector('#queue .item'));
ok(sql(`select hidden || '/' || flag_count from reports where id='${qid}'`) === 'false/0', '되살리기 → 서버에서 다시 보이고 신고 수 0');
ok(sql(`select count(*) from flags where report_id='${qid}' and dismissed`) === '3', '  └ 신고는 기각으로 남는다');
ok((await M.p.locator('#queue').innerText()).includes('대기열이 비었습니다'), '  └ 대기열이 빈다');
ok(await M.p.evaluate(() => document.activeElement && document.activeElement.classList.contains('done')), '  └ 초점이 빈 목록 안내로 옮겨 간다');
await refresh(T.p);
ok(await card(T.p, '준호 신고될 글').count() === 1, '신고했던 이웃 폰에도 다시 나타난다');
await card(T.p, '준호 신고될 글').locator('[data-flag]').click();
await T.p.waitForSelector('#flagBack.open');
await T.p.locator('#flagReasons [data-reason="거짓"]').click();
await T.p.waitForTimeout(700);
ok((await T.p.locator('#flagStatus').innerText()).includes('이미 신고한'), '기각된 신고자가 다시 신고하면 "이미 신고한 리포트"');
await T.p.keyboard.press('Escape');

await M.p.locator('#tab-find').click();
await M.p.fill('#q', '준호 신고될');
await M.p.locator('#findForm button').click();
await M.p.waitForSelector('#found .item');
it = item(M.p, '준호 신고될 글');
ok(await it.count() === 1, '찾기: 장소 글자로 찾는다');
await it.locator('[data-user]').click();
await M.p.waitForSelector('#userBack.open');
ok((await M.p.locator('#userTitle').innerText()) === '준호 특파원', '작성자 보기');
ok(await M.p.evaluate(() => document.querySelector('main').inert), '  └ 창이 열리면 뒤는 inert');
await axe(M.p, '작성자 창');
await M.p.locator('[data-ban="7"]').click();
ok((await M.p.locator('#banStatus').innerText()).includes('사유를 남겨야'), '정지는 사유 없이 안 눌린다');
await M.p.fill('#banNote', '시험 — 허위 혼잡 정보');
await M.p.locator('[data-ban="7"]').click();
await M.p.waitForFunction(() => /정지 —/.test(document.querySelector('#userBody').innerText));
ok(sql(`select round(extract(epoch from banned_until - now()) / 86400) from correspondents where id='${U.준호}'`) === '7', '정지 7일 → 서버');
await M.p.keyboard.press('Escape');
ok(await M.p.evaluate(() => document.activeElement && document.activeElement.matches('[data-user]')), '  └ 닫으면 초점이 "작성자 보기" 로');

await write(B.p, '정지 중에 쓴 글');
ok((await B.p.locator('#toast').innerText()).includes('글쓰기가 정지된 상태'), '정지된 사람이 쓰면 앱이 정지라고 알린다 (예전엔 "다음에 다시 올립니다")');
ok(sql(`select count(*) from reports where place='정지 중에 쓴 글'`) === '0', '  └ 서버에는 안 올라간다');
ok(await card(B.p, '정지 중에 쓴 글').count() === 1, '  └ 이 기기에는 남는다');
await refresh(B.p);
await card(B.p, '중앙공원 놀이터').locator('[data-flag]').click();
await B.p.waitForSelector('#flagBack.open');
await B.p.locator('#flagReasons [data-reason="광고"]').click();
await B.p.waitForTimeout(700);
ok((await B.p.locator('#flagStatus').innerText()).includes('신고할 수 없습니다'), '  └ 신고도 막힌다');
await B.p.keyboard.press('Escape');

await M.p.locator('#found [data-act="hold"]').click();
ok((await M.p.locator('#found .status').first().innerText()).includes('메모로 남겨야'), '임시조치는 메모 없이 안 된다');
await M.p.fill('#found .item input', '가게 주인 메일 — 사생활 침해 주장');
await M.p.locator('#found [data-act="hold"]').click();
await M.p.waitForFunction(() => /임시조치 ~/.test(document.querySelector('#found').innerText));   // 걸려 있는 임시조치 딱지
ok(sql(`select hidden || '/' || round(extract(epoch from held_until - now()) / 86400) from reports where id='${qid}'`) === 'true/30', '임시조치 → 서버에서 가려지고 30일');
await M.p.locator('#found [data-act="delete"]').click();
ok((await M.p.locator('#found .status').first().innerText()).includes('사유를 남겨야'), '지우기는 사유 없이 안 된다');
await M.p.fill('#found .item input', '30일 동안 재게시 요청 없음');
await M.p.locator('#found [data-act="delete"]').click();
ok(await M.p.locator('#found .confirm').isVisible(), '지우기는 한 번 더 묻는다');
ok(sql(`select count(*) from reports where id='${qid}'`) === '1', '  └ 묻는 동안은 그대로');
await M.p.locator('#found [data-act="delete-yes"]').click();
await M.p.waitForFunction(() => !/준호 신고될 글/.test(document.querySelector('#found').innerText));
ok(sql(`select count(*) from reports where id='${qid}'`) === '0', '  └ 확인하면 서버에서 지워진다');

await M.p.locator('#tab-log').click();
await M.p.waitForSelector('#log .loglist');
const logText = await M.p.locator('#log').innerText();
ok(['되살림', '정지', '임시조치', '지움'].every((w) => logText.includes(w)) && logText.includes('30일 동안 재게시 요청 없음'), '처리 기록 탭: 네 가지 처리와 사유');
await axe(M.p, '처리 기록');
await M.p.locator('#tab-stats').click();
await M.p.waitForSelector('#stats .tile');
ok((await M.p.locator('#stats tbody tr').count()) >= 14, '숫자 탭: 14일 표와 동네 표');
await axe(M.p, '숫자');
await M.p.locator('#tab-stats').focus();
await M.p.keyboard.press('ArrowRight');
ok((await M.p.getAttribute('#tab-log', 'aria-selected')) === 'true', '탭은 화살표로 옮긴다');
await M.c.close();

const Md = await console_('민지', 'dark');
await Md.p.waitForSelector('#queue .done, #queue .item');
await axe(Md.p, '대기열(어둡게)');
await Md.p.locator('#tab-find').click();
await Md.p.fill('#q', U.준호);           // 서버에 남은 글이 없어도 계정 번호로 찾는다 (정지 이의 신청)
await Md.p.locator('#findForm button').click();
await Md.p.waitForSelector('#found .item');
ok((await Md.p.locator('#found .item').first().innerText()).includes('준호') && (await Md.p.locator('#found .warn').count()) === 1,
   '계정 번호로 찾으면 글이 없어도 그 사람이 나온다 (정지 표시와 함께)');
await Md.p.locator('#found [data-user]').first().click();
await Md.p.waitForSelector('#userBack.open');
await axe(Md.p, '작성자 창(어둡게)');
await Md.p.locator('[data-ban="0"]').click();
await Md.p.waitForFunction(() => !/정지 —/.test(document.querySelector('#userBody').innerText));
ok(sql(`select banned_until is null from correspondents where id='${U.준호}'`) === 't', '정지 풀기 → 서버');
await Md.c.close();
await refresh(B.p);
await B.p.waitForTimeout(600);
ok(sql(`select count(*) from reports where place='정지 중에 쓴 글'`) === '1', '풀리면 정지 중에 쓴 글이 올라간다');
await T.c.close(); await H.c.close();

console.log('\n== 11. 오류 ==');
ok(errs.length === 0, '콘솔 오류 없음' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
ok(rejected.length >= 3 && rejected.every((x) => /^(태오 \/rest\/v1\/flags|준호 \/rest\/v1\/(flags|reports))$/.test(x)),
   '서버가 거부한 요청은 예상한 것뿐 — 재신고·정지 중 쓰기·정지 중 신고 (' + rejected.length + '건: ' + [...new Set(rejected)].join(', ') + ')');

await b.close();
console.log('\n==== ' + pass + ' 통과 / ' + fail + ' 실패 ====');
process.exit(fail ? 1 : 0);
