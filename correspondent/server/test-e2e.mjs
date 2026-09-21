import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const URL = 'http://127.0.0.1:8197/correspondent/';
const MINJI = '11111111-1111-1111-1111-111111111111';
const JUNHO = '22222222-2222-2222-2222-222222222222';
const SEOYEON = '33333333-3333-3333-3333-333333333333';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  FAIL ' + m); } };

const b = await chromium.launch();
const errs = [];
async function phone(uid, name) {
  const c = await b.newContext({ locale:'ko-KR', timezoneId:'Asia/Seoul', viewport:{width:390,height:844} });
  const p = await c.newPage();
  p.on('pageerror', e => errs.push(name + ': ' + e.message));
  p.on('console', m => { const t = m.text(); if (m.type()==='error' && !/ERR_CERT|fonts.googleapis/.test(t)) errs.push(name + ' console: ' + t); });
  await p.goto(URL, { waitUntil:'networkidle' });
  if (uid) await p.evaluate(u => localStorage.setItem('tpw.session', JSON.stringify(
    { access_token:'test-'+u, refresh_token:'r', expires_at: Math.floor(Date.now()/1000)+9999, uid:u })), uid);
  await p.evaluate(n => { const b = JSON.parse(localStorage.getItem('tpw.v1')||'{}');
    localStorage.setItem('tpw.v1', JSON.stringify(Object.assign({reports:[],seeded:true,hood:'4117110100'}, b, {me:n, seeded:true, hood:'4117110100'}))); }, name);
  await p.reload({ waitUntil:'networkidle' });
  await p.waitForTimeout(700);
  return { c, p };
}

console.log('\n== 1. 동기화 켜짐 ==');
const A = await phone(MINJI, '민지');
ok(await A.p.locator('#boardBtn').isVisible(), '머리에 공용 보드 단추가 뜬다');
ok((await A.p.locator('#boardLbl').innerText()) === '안양동', '동네 이름 표시: ' + await A.p.locator('#boardLbl').innerText());

console.log('\n== 2. 민지가 쓰면 서버로 올라간다 ==');
await A.p.locator('#writeBtn').click();
await A.p.waitForSelector('#composeBack.open');
await A.p.fill('#fPlace', '중앙공원 놀이터');
await A.p.fill('#fArea', '평촌 범계동');
await A.p.locator('#fWait [data-v="0"]').click();
await A.p.locator('#fCrowd [data-v="1"]').click();
await A.p.fill('#fNote', '그늘막 두 자리 남았어요');
await A.p.locator('#composeGo').click();
await A.p.waitForSelector('#shareBack.open');
await A.p.locator('#shareBack [data-close]').last().click();
await A.p.waitForTimeout(900);
const row = JSON.parse(require_psql(`select json_agg(t)::text from (select id, by_name, place, hood_code from reports) t`));
ok(row && row.length === 1, '서버에 1건 들어감');
ok(row && row[0].by_name === '민지' && row[0].place === '중앙공원 놀이터', '내용 일치: ' + JSON.stringify(row && row[0]));
const up = await A.p.evaluate(() => JSON.parse(localStorage.getItem('tpw.v1')).reports[0]);
ok(up.mine === true && up.up === true, '로컬에 mine/up 표시');

console.log('\n== 3. 준호 폰에 그대로 내려온다 ==');
const B = await phone(JUNHO, '준호');
ok((await B.p.locator('#feed .card').count()) === 1, '받아온 카드 1건');
ok((await B.p.locator('#feed .place').first().innerText()).includes('중앙공원 놀이터'), '장소 일치');
ok((await B.p.locator('#feed .by').first().innerText()).includes('민지'), '작성자 민지');
ok((await B.p.locator('#feed [data-flag]').count()) === 1, '남의 글이라 신고 단추가 있다');
ok((await A.p.locator('#feed [data-flag]').count()) === 0, '내 글에는 신고 단추가 없다');

console.log('\n== 4. 받은 남의 글은 다시 안 올라간다 ==');
const mineOnB = await B.p.evaluate(() => JSON.parse(localStorage.getItem('tpw.v1')).reports.map(r => ({id:r.id, mine:r.mine, up:r.up})));
ok(mineOnB.every(r => r.mine === false), '준호 폰에서 mine=false (' + JSON.stringify(mineOnB) + ')');
const cnt1 = Number(require_psql(`select count(*)::text from reports`));
await B.p.evaluate(() => window.boardRefresh ? window.boardRefresh(true) : null);
await B.p.waitForTimeout(600);
ok(Number(require_psql(`select count(*)::text from reports`)) === cnt1, '동기화를 돌려도 서버 건수 그대로: ' + cnt1);

console.log('\n== 5. 로그아웃 상태에서 쓰면 로컬에만 ==');
const C = await phone(null, '서연');
await C.p.locator('#writeBtn').click();
await C.p.waitForSelector('#composeBack.open');
await C.p.fill('#fPlace', '로그아웃 테스트');
await C.p.locator('#composeGo').click();
await C.p.waitForSelector('#shareBack.open');
await C.p.locator('#shareBack [data-close]').last().click();
await C.p.waitForTimeout(700);
ok(Number(require_psql(`select count(*)::text from reports where place='로그아웃 테스트'`)) === 0, '서버에 안 올라감');
const pend = await C.p.evaluate(() => JSON.parse(localStorage.getItem('tpw.v1')).reports.filter(r => r.mine && !r.up).length);
ok(pend === 1, '올리지 못한 채 1건 남아 대기: ' + pend);

console.log('\n== 6. 로그인하면 밀린 것이 올라간다 ==');
await C.p.evaluate(u => localStorage.setItem('tpw.session', JSON.stringify(
  { access_token:'test-'+u, refresh_token:'r', expires_at: Math.floor(Date.now()/1000)+9999, uid:u })), SEOYEON);
await C.p.reload({ waitUntil:'networkidle' });
await C.p.waitForTimeout(1200);
ok(Number(require_psql(`select count(*)::text from reports where place='로그아웃 테스트'`)) === 1, '다음 접속에 밀린 리포트가 올라감');
ok((require_psql(`select by_name from reports where place='로그아웃 테스트'`) || '').trim() === '서연', '서버가 이름을 프로필에서 채움');

console.log('\n== 7. 신고 세 번이면 가려진다 ==');
const rid = (require_psql(`select id from reports where place='중앙공원 놀이터'`) || '').trim();
const flagOn = (page) => page.locator('#feed .card', { hasText: '중앙공원 놀이터' }).locator('[data-flag]');
await flagOn(B.p).click();
await B.p.waitForSelector('#flagBack.open');
await B.p.locator('#flagReasons [data-reason="광고"]').click();
await B.p.waitForTimeout(600);
ok((await B.p.locator('#flagStatus').innerText()).includes('신고했습니다'), '준호 신고 접수');
for (const [uid, nm] of [[SEOYEON,'서연'], ['44444444-4444-4444-4444-444444444444','태오']]) {
  const D = await phone(uid, nm);
  const fb = flagOn(D.p);
  ok(await fb.count() === 1, nm + ' 폰에서 중앙공원 리포트에 신고 단추 있음');
  await fb.click(); await D.p.waitForSelector('#flagBack.open');
  await D.p.locator('#flagReasons [data-reason="거짓"]').click(); await D.p.waitForTimeout(600);
  ok((await D.p.locator('#flagStatus').innerText()).includes('신고했습니다'), nm + ' 신고 접수');
  await D.c.close();
}
console.log('   신고 기록:', require_psql(`select count(*)::text||'건 / flag_count='||max(r.flag_count)::text from flags f join reports r on r.id=f.report_id where f.report_id='${rid}'`));
const hid = require_psql(`select hidden::text from reports where id='${rid}'`).trim();
ok(hid === 'true', '서버에서 가려짐 (rid=' + rid + ' hidden=' + JSON.stringify(hid) + ')');
const E = await phone(null, '새사람');
const seen = await E.p.locator('#feed .place').allInnerTexts();
ok(!seen.join(' ').includes('중앙공원'), '새로 온 사람에게 가려진 글은 안 보인다');
ok(seen.join(' ').includes('로그아웃 테스트'), '가려지지 않은 글은 그대로 보인다 (' + seen.length + '건)');
await E.c.close();

console.log('\n== 8. 오류 ==');
ok(errs.length === 0, '콘솔 오류 없음' + (errs.length ? ': ' + errs.slice(0,3).join(' | ') : ''));

await b.close();
console.log('\n==== ' + pass + ' 통과 / ' + fail + ' 실패 ====');
process.exit(fail ? 1 : 0);

function require_psql(sql) {
  const { execFileSync } = require('node:child_process');
  return execFileSync('psql', ['-h','/home/pgtest/run','-p','54329','-U','postgres','-tAc', sql], { encoding:'utf8' }).trim();
}
