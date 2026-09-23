/* ============================================================================
   서버 규칙을 공격해 본다 — 판정형. 실패가 하나라도 있으면 종료 코드 1.

     PGHOST=… PGUSER=postgres node test-sql.mjs

   기존 DB 는 건드리지 않는다. 스스로 임시 DB(tpw_sql_<pid>)를 만들어 schema·policies·
   seed·retention 을 설치하고, 끝나면(실패해도) 지운다. 그래서 운영 DB 에 대고 돌려도
   거기 있는 데이터는 안전하다 — 그래도 운영 DB 에 대고 돌리지는 말 것.

   Supabase 에만 있는 것(auth.users, auth.uid(), anon·authenticated 역할)은
   test-auth-stub.sql 이 흉내 낸다. auth.uid() 는 세션 변수 app.uid 를 읽는다.
   ========================================================================== */
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DB = 'tpw_sql_' + process.pid;
const base = ['-X', '-q', '-tA', '-v', 'ON_ERROR_STOP=1'];

const U = {
  민지: '11111111-1111-1111-1111-111111111111', 준호: '22222222-2222-2222-2222-222222222222',
  서연: '33333333-3333-3333-3333-333333333333', 태오: '44444444-4444-4444-4444-444444444444',
  하린: '55555555-5555-5555-5555-555555555555'
};
const HOOD = '4117110100';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const section = (t) => console.log('\n== ' + t + ' ==');

function psql(sql, db = DB) {
  const r = spawnSync('psql', [...base, '-d', db, '-c', sql], { encoding: 'utf8' });
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
}
const admin = (sql) => psql(sql);
const as = (who, sql) => psql(`set role authenticated; set app.uid = '${U[who]}'; ${sql}`);
const anon = (sql) => psql(`set role anon; set app.uid = ''; ${sql}`);
const val = (sql) => admin(sql).out;
const report = (who, id, extra = '') =>
  as(who, `insert into reports (id, author, by_name, t, hood_code, cat, place${extra ? ', ' + extra.split('=')[0] : ''})
           values ('${id}', null, '', now(), '${HOOD}', 'etc', '${id} 장소'${extra ? ', ' + extra.split('=')[1] : ''});`);

/* ─────────────────────────── 설치 ─────────────────────────── */
execFileSync('createdb', [DB]);
try {
  for (const f of ['test-auth-stub.sql', 'schema.sql', 'policies.sql', 'seed-hoods.sql'])
    execFileSync('psql', [...base, '-d', DB, '-f', resolve(HERE, f)], { stdio: ['ignore', 'ignore', 'pipe'] });
  // retention.sql 의 pg_cron 부분은 Supabase 에만 있다 — 함수까지만
  const ret = readFileSync(resolve(HERE, 'retention.sql'), 'utf8').split('여기부터는 Supabase 에서만')[0];
  execFileSync('psql', [...base, '-d', DB], { input: ret.slice(0, ret.lastIndexOf('\n')) });

  admin(`insert into auth.users (id) values ${Object.values(U).map((u) => `('${u}')`).join(',')};`);
  for (const [who] of Object.entries(U)) as(who, `select public.save_profile('${who}', '${HOOD}');`);
  ok(val(`select count(*) from correspondents`) === '5', '설치: 특파원 다섯 (프로필은 save_profile 로만 만든다)');

  section('쓰기와 사칭');
  ok(report('민지', 'mj000001').ok, '민지가 쓴다');
  ok(val(`select by_name from reports where id='mj000001'`) === '민지', '  └ 이름은 서버가 프로필에서 채운다');
  as('민지', `insert into reports (id, author, by_name, t, hood_code, cat, place)
              values ('mj000002', '${U.준호}', '준호', now(), '${HOOD}', 'etc', '사칭');`);
  ok(val(`select author || '/' || by_name from reports where id='mj000002'`) === U.민지 + '/민지', '남의 author·이름을 적어 보내도 토큰 주인으로 덮어쓴다');
  let r = as('준호', `insert into reports (id, author, by_name, t, hood_code, cat, place)
                      values ('mj000001', null, '', now(), '${HOOD}', 'etc', '덮어쓰기');`);
  ok(!r.ok && /duplicate key/.test(r.err), '남의 id 로 덮어쓰기 → 기본키 충돌');
  ok(val(`select place from reports where id='mj000001'`) === 'mj000001 장소', '  └ 내용 그대로');
  ok(as('준호', `delete from reports where id='mj000001';`).ok && val(`select count(*) from reports where id='mj000001'`) === '1',
     '남의 글 지우기 → 0건');
  r = as('준호', `update reports set note='조작' where id='mj000001';`);
  ok(!r.ok && /permission denied/.test(r.err), '남의 글 고치기 → 권한 없음 (고치기 자체가 없다)');
  r = anon(`insert into reports (id, author, by_name, t, hood_code, cat, place) values ('an000001', null, '', now(), '${HOOD}', 'etc', 'x');`);
  ok(!r.ok && /permission denied/.test(r.err), '로그인 없이 쓰기 → 권한 없음');
  ok(anon(`select count(*) from reports;`).out === '2', '로그인 없이 읽기는 된다');
  as('서연', `insert into reports (id, author, by_name, t, hood_code, cat, place)
              values ('sy000001', null, '', now() + interval '10 years', '${HOOD}', 'etc', '미래');`);
  ok(Number(val(`select abs(extract(epoch from t - now())) from reports where id='sy000001'`)) < 60, '미래 시각으로 맨 위 차지 → 지금으로 당긴다');
  r = report('서연', 'sy000002', 'wait=999');
  ok(!r.ok && /reports_wait_check/.test(r.err), '범위 밖 값(wait=999) → 거부');

  section('mine — 내 글인가');
  ok(as('민지', `select public.mine(reports) from reports where id='mj000001';`).out === 't', '쓴 사람에게 참');
  ok(as('준호', `select public.mine(reports) from reports where id='mj000001';`).out === 'f', '남에게 거짓');
  ok(anon(`select coalesce(public.mine(reports), false) from reports where id='mj000001';`).out === 'f', '로그인 안 한 사람에게 거짓');

  section('신고');
  r = as('민지', `insert into flags (report_id, reporter, reason) values ('mj000001', null, '광고');`);
  ok(!r.ok && /row-level security/.test(r.err), '자기 글 신고 → 거부');
  ok(as('준호', `insert into flags (report_id, reporter, reason) values ('mj000001', null, '거짓');`).ok,
     'reporter 를 비워 보내면(앱이 실제로 이렇게 보낸다) 서버가 채운다');
  as('서연', `insert into flags (report_id, reporter, reason) values ('mj000001', '${U.태오}', '거짓');`);
  ok(val(`select count(*) from flags where report_id='mj000001' and reporter='${U.서연}'`) === '1', '남의 이름으로 신고해도 내 이름으로 찍힌다');
  r = as('준호', `insert into flags (report_id, reporter, reason) values ('mj000001', null, '욕설');`);
  ok(!r.ok && /duplicate key/.test(r.err), '같은 글 두 번 신고 → 한 번만');
  ok(anon(`select count(*) from reports where id='mj000001';`).out === '1', '신고 둘 — 아직 보인다');
  as('태오', `insert into flags (report_id, reporter, reason) values ('mj000001', null, '거짓');`);
  ok(anon(`select count(*) from reports where id='mj000001';`).out === '0', '신고 셋 — 가려진다');
  ok(val(`select flag_count || '/' || hidden from reports where id='mj000001'`) === '3/true', '  └ 서버 기록 3건, 가림');
  ok(as('민지', `select count(*) from reports where id='mj000001';`).out === '1', '가려진 글도 쓴 사람에게는 보인다');

  section('정지');
  admin(`update correspondents set banned_until = now() + interval '7 days' where id='${U.하린}';`);
  r = as('하린', `update correspondents set banned_until = null where id = auth.uid();`);
  ok(!r.ok && /permission denied/.test(r.err), '프로필 표를 직접 고쳐 정지 풀기 → 권한 없음');
  as('하린', `select public.save_profile('하린', '${HOOD}');`);
  ok(val(`select banned_until > now() from correspondents where id='${U.하린}'`) === 't', 'save_profile 로도 정지는 안 풀린다');
  r = report('하린', 'hr000001');
  ok(!r.ok && /지금은 리포트를 보낼 수 없습니다/.test(r.err), '정지된 사람의 쓰기 → 거부');
  r = as('하린', `insert into correspondents (id, name) values (auth.uid(), '직접');`);
  ok(!r.ok && /permission denied/.test(r.err), '프로필 표에 직접 쓰기 → 권한 없음');
  as('준호', `select public.save_profile('준호2', '${HOOD}');`);
  ok(val(`select name from correspondents where id='${U.준호}'`) === '준호2', '이름 바꾸기는 save_profile 로 된다');
  ok(as('민지', `select count(*) from correspondents;`).out === '1', '남의 프로필은 안 보인다 (자기 것 하나)');

  section('도배');
  const before = Number(val(`select count(*) from reports where author='${U.태오}'`));
  let got = 0;
  for (let i = 1; i <= 25; i++) if (report('태오', 'sp' + String(i).padStart(6, '0')).ok) got++;
  ok(before + got === 20, `한 시간에 20건에서 끊긴다 (25번 시도 → ${got}건 들어감, 합계 ${before + got})`);

  section('계정 삭제');
  as('준호', `insert into reports (id, author, by_name, t, hood_code, cat, place) values ('jh000001', null, '', now(), '${HOOD}', 'cafe', '준호 카페');`);
  as('민지', `insert into flags (report_id, reporter, reason) values ('jh000001', null, '광고');`);
  r = anon(`select public.delete_my_account();`);
  ok(!r.ok && /permission denied/.test(r.err), '로그인 없이 부르기 → 권한 없음');
  ok(as('준호', `select public.delete_my_account();`).ok, '준호가 탈퇴한다');
  ok(val(`select count(*) from auth.users where id='${U.준호}'`) === '0', '  └ 로그인 계정');
  ok(val(`select count(*) from correspondents where id='${U.준호}'`) === '0', '  └ 프로필');
  ok(val(`select count(*) from reports where author='${U.준호}'`) === '0', '  └ 쓴 글');
  ok(val(`select count(*) from flags where reporter='${U.준호}'`) === '0', '  └ 한 신고');
  ok(val(`select count(*) from flags where report_id='jh000001'`) === '0', '  └ 그 글에 달린 남의 신고');
  ok(val(`select flag_count || '/' || hidden from reports where id='mj000001'`) === '2/true', '준호가 한 신고가 빠지면 수는 다시 센다(3→2), 가림은 그대로');
  r = report('준호', 'jh000002');
  ok(!r.ok && /특파원 등록이 먼저입니다/.test(r.err), '탈퇴한 사람의 살아 있는 토큰으로 쓰기 → 거부');
  r = as('준호', `select public.save_profile('귀환', null);`);
  ok(!r.ok && /foreign key/.test(r.err), '  └ 프로필을 다시 만들기 → 외래키로 거부');
  r = as('서연', `delete from auth.users where id='${U.민지}';`);
  ok(!r.ok && /permission denied/.test(r.err), '남의 계정 지우기 → 권한 없음');
  ok(val(`select count(*) from auth.users`) === '4', '다른 사람들은 그대로');

  section('가려진 내 글 지우기');
  ok(as('민지', `delete from reports where id='mj000001' returning id;`).out === 'mj000001', '쓴 사람이 지운다 (읽기 정책이 막으면 0건으로 조용히 끝났다)');
  ok(val(`select count(*) from reports where id='mj000001'`) === '0', '  └ 서버에서 사라짐');

  section('보관 기한');
  r = as('민지', `select public.purge_expired();`);
  ok(!r.ok && /permission denied/.test(r.err), '사용자가 부르기 → 권한 없음 (스케줄러만)');
  admin(`update reports set t = now() - interval '400 days' where id='mj000002';`);
  ok(val(`select public.purge_expired()`) === '1', '1년 넘은 것 하나만 지운다');
  ok(val(`select count(*) from reports where id='mj000002'`) === '0', '  └ 그 글이 사라짐');
  ok(Number(val(`select count(*) from reports`)) > 0, '  └ 나머지는 그대로');
} finally {
  spawnSync('dropdb', [DB]);
}

console.log('\n==== ' + pass + ' 통과 / ' + fail + ' 실패 ====');
process.exit(fail ? 1 : 0);
