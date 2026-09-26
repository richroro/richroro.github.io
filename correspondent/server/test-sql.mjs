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
  하린: '55555555-5555-5555-5555-555555555555', 도윤: '66666666-6666-6666-6666-666666666666',
  지우: '77777777-7777-7777-7777-777777777777'
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
  for (const f of ['test-auth-stub.sql', 'schema.sql', 'policies.sql', 'admin.sql', 'seed-hoods.sql'])
    execFileSync('psql', [...base, '-d', DB, '-f', resolve(HERE, f)], { stdio: ['ignore', 'ignore', 'pipe'] });
  // retention.sql 의 pg_cron 부분은 Supabase 에만 있다 — 함수까지만
  const ret = readFileSync(resolve(HERE, 'retention.sql'), 'utf8').split('여기부터는 Supabase 에서만')[0];
  execFileSync('psql', [...base, '-d', DB], { input: ret.slice(0, ret.lastIndexOf('\n')) });

  admin(`insert into auth.users (id) values ${Object.values(U).map((u) => `('${u}')`).join(',')};`);
  for (const [who] of Object.entries(U)) as(who, `select public.save_profile('${who}', '${HOOD}');`);
  ok(val(`select count(*) from correspondents`) === '7', '설치: 특파원 일곱 (프로필은 save_profile 로만 만든다)');

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
  r = as('하린', `insert into flags (report_id, reporter, reason) values ('sy000001', null, '거짓');`);
  ok(!r.ok && /지금은 신고할 수 없습니다/.test(r.err), '정지된 사람의 신고 → 거부 (쓰기만 막으면 신고로 옮겨 간다)');
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
  ok(val(`select count(*) from auth.users`) === '6', '다른 사람들은 그대로');

  section('가려진 내 글 지우기');
  ok(as('민지', `delete from reports where id='mj000001' returning id;`).out === 'mj000001', '쓴 사람이 지운다 (읽기 정책이 막으면 0건으로 조용히 끝났다)');
  ok(val(`select count(*) from reports where id='mj000001'`) === '0', '  └ 서버에서 사라짐');

  section('운영자');
  const J = (who, sql) => { const x = as(who, sql); return x.ok ? JSON.parse(x.out) : { error: x.err }; };
  r = as('민지', `select public.admin_queue(10);`);
  ok(!r.ok && /운영자만 할 수 있습니다/.test(r.err), '운영자가 아니면 대기열을 못 본다');
  r = anon(`select public.admin_queue(10);`);
  ok(!r.ok && /permission denied/.test(r.err), '  └ 로그인 없이는 실행 권한부터 없다');
  r = as('민지', `insert into admins (id) values (auth.uid());`);
  ok(!r.ok && /permission denied/.test(r.err), '스스로 운영자 되기 → 권한 없음');
  r = as('민지', `select count(*) from mod_log;`);
  ok(!r.ok && /permission denied/.test(r.err), '처리 기록 표는 사용자에게 안 보인다');
  ok(as('민지', `select public.is_admin();`).out === 'f', 'is_admin() — 아직 아니다');
  admin(`insert into admins (id, note) values ('${U.민지}', '시험 운영자');`);
  ok(as('민지', `select public.is_admin();`).out === 't', 'SQL 편집기에서 admins 에 넣으면 운영자');

  ok(J('민지', `select public.admin_ban('${U.하린}', 0, '기간 채움');`).banned_until === null, '정지 풀기 (0일)');
  ok(report('하린', 'hr000009').ok, '  └ 풀린 사람은 다시 쓴다');

  ok(report('서연', 'sy000010').ok, '서연이 쓴 글에');
  for (const w of ['태오', '하린', '도윤']) as(w, `insert into flags (report_id, reporter, reason) values ('sy000010', null, '거짓');`);
  let it = J('민지', `select public.admin_queue(50);`).find((x) => x.id === 'sy000010');
  ok(it && it.why === 'hidden' && it.flag_count === 3 && it.hidden === true, '  신고 셋 → 가려져서 대기열에 (why=hidden)');
  ok(it && it.flags.length === 3 && it.flags.every((f) => f.reason === '거짓' && f.reporter), '  └ 사유와 신고한 사람이 보인다 (떼 신고를 가려내려면)');
  ok(it && it.author === U.서연 && it.author_reports >= 1, '  └ 쓴 사람 번호와 그 사람의 글 수');
  ok(as('민지', `select public.admin_act('sy000010', 'restore', '현장 확인 — 거짓 아님');`).ok, '문제없음 → 되살리기');
  ok(val(`select hidden || '/' || flag_count || '/' || (reviewed_at is not null) from reports where id='sy000010'`) === 'false/0/true', '  └ 다시 보이고 신고 수 0');
  ok(val(`select count(*) from flags where report_id='sy000010' and dismissed`) === '3', '  └ 신고 셋은 기각으로 남는다');
  ok(anon(`select count(*) from reports where id='sy000010';`).out === '1', '  └ 모두에게 다시 보인다');
  ok(!J('민지', `select public.admin_queue(50);`).some((x) => x.id === 'sy000010'), '  └ 대기열에서 빠진다');
  r = as('태오', `insert into flags (report_id, reporter, reason) values ('sy000010', null, '거짓');`);
  ok(!r.ok && /duplicate key/.test(r.err), '기각된 신고자는 같은 글을 다시 신고하지 못한다');
  as('지우', `insert into flags (report_id, reporter, reason) values ('sy000010', null, '광고');`);
  it = J('민지', `select public.admin_queue(50);`).find((x) => x.id === 'sy000010');
  ok(it && it.why === 'new_flags' && it.flag_count === 1 && it.hidden === false, '처리한 뒤 다른 사람이 신고하면 다시 대기열로 (why=new_flags)');

  ok(as('민지', `select public.admin_act('sy000010', 'hide', '광고 맞음');`).ok, '가린 채 두기');
  ok(anon(`select count(*) from reports where id='sy000010';`).out === '0', '  └ 가려졌다');
  as('민지', `insert into flags (report_id, reporter, reason) values ('sy000010', null, '광고');`);
  ok(val(`select hidden || '/' || flag_count from reports where id='sy000010'`) === 'true/2',
     '  └ 새 신고로 수가 2 가 되어도 풀리지 않는다 (옛 규칙 hidden = n >= 3 이면 되살아났다)');

  ok(report('도윤', 'dy000001').ok, '도윤이 쓴 글에 권리침해 신고가 왔다');
  r = as('민지', `select public.admin_act('dy000001', 'hold', '  ');`);
  ok(!r.ok && /메모로 남겨야/.test(r.err), '임시조치는 누가·왜를 메모하지 않으면 안 된다');
  ok(as('민지', `select public.admin_act('dy000001', 'hold', '가게 주인 요청(메일) — 허위 사실로 명예훼손 주장');`).ok, '임시조치');
  ok(val(`select hidden || '/' || round(extract(epoch from held_until - now()) / 86400) from reports where id='dy000001'`) === 'true/30', '  └ 가리고, 30일 뒤에 끝난다');
  ok(!J('민지', `select public.admin_queue(50);`).some((x) => x.id === 'dy000001'), '  └ 30일 동안은 대기열에 없다');
  ok(as('도윤', `select count(*) from reports where id='dy000001';`).out === '1', '  └ 쓴 사람에게는 보인다 (스스로 지울 수 있게)');
  admin(`update reports set held_until = now() - interval '1 minute' where id='dy000001';`);
  it = J('민지', `select public.admin_queue(50);`)[0];
  ok(it && it.id === 'dy000001' && it.why === 'hold_over', '30일이 지나면 대기열 맨 위로 — 결정 필요');
  ok(anon(`select count(*) from reports where id='dy000001';`).out === '0', '  └ 정할 때까지 가려진 채');
  r = as('민지', `select public.admin_act('dy000001', 'delete', '');`);
  ok(!r.ok && /사유를 남겨야/.test(r.err), '지우기도 사유 없이는 안 된다');
  ok(J('민지', `select public.admin_act('dy000001', 'delete', '재게시 요청 없음');`).deleted === true, '지우기');
  ok(val(`select count(*) from reports where id='dy000001'`) === '0', '  └ 서버에서 사라짐');
  const snap = JSON.parse(val(`select snapshot::text from mod_log where report_id='dy000001' and action='delete'`) || 'null');
  ok(snap && snap.place === 'dy000001 장소' && snap.author === U.도윤, '  └ 처리 기록에 글 사본이 남는다 (분쟁 대응 · 1년)');
  r = as('민지', `select public.admin_act('sy000010', 'erase', '');`);
  ok(!r.ok && /모르는 처리/.test(r.err), '모르는 처리 → 거부');

  r = as('민지', `select public.admin_ban('${U.도윤}', 7, '');`);
  ok(!r.ok && /사유를 남겨야/.test(r.err), '정지는 사유 없이 안 된다 (풀 때는 된다)');
  ok(J('민지', `select public.admin_ban('${U.도윤}', 7, '허위 리포트 반복');`).banned_until, '정지 7일');
  r = report('도윤', 'dy000002');
  ok(!r.ok && /지금은 리포트를 보낼 수 없습니다/.test(r.err), '  └ 못 쓴다');
  r = as('도윤', `insert into flags (report_id, reporter, reason) values ('hr000009', null, '거짓');`);
  ok(!r.ok && /지금은 신고할 수 없습니다/.test(r.err), '  └ 신고도 못 한다');
  r = as('민지', `select public.admin_ban('${U.민지}', 7, '');`);
  ok(!r.ok && /운영자는 정지할 수 없습니다/.test(r.err), '운영자는 정지할 수 없다 (서로 잠그지 않게)');
  r = as('민지', `select public.admin_ban('${U.도윤}', 99999, '');`);
  ok(!r.ok && /36500/.test(r.err), '정지 기간이 범위 밖 → 거부');

  const who = J('민지', `select public.admin_user('${U.도윤}');`);
  ok(who.name === '도윤' && who.banned_until && who.log.some((l) => l.action === 'ban') && who.flags_made_dismissed === 1,
     '작성자 보기: 정지, 처리 기록, 기각된 신고 수');
  ok(J('민지', `select public.admin_find('sy000010');`).length === 1, '찾기: 리포트 id');
  ok(J('민지', `select public.admin_find('장소');`).length >= 3, '찾기: 장소 글자');
  ok(J('민지', `select public.admin_find('%');`).length === 0, '찾기: % 는 글자 그대로 (전부 쏟아지지 않는다)');
  const log = J('민지', `select public.admin_log(50);`);
  ok(['restore', 'hide', 'hold', 'delete', 'ban', 'unban'].every((a) => log.some((l) => l.action === a)), '처리 기록: 여섯 가지가 모두 남았다');
  ok(log.every((l) => l.admin === U.민지 && !('snapshot' in l)), '  └ 누가 했는지 남고, 목록에는 사본을 싣지 않는다');
  const st = J('민지', `select public.admin_stats(7);`);
  ok(st.days && st.days.length === 7 && st.days[0].reports >= 1 && st.totals.people === Number(val(`select count(*) from correspondents`)),
     '숫자: 7일치, 오늘 리포트, 특파원 수');
  ok(/운영자만/.test(J('서연', `select public.admin_stats(7);`).error || ''), '  └ 숫자도 운영자만');

  section('보관 기한');
  r = as('민지', `select public.purge_expired();`);
  ok(!r.ok && /permission denied/.test(r.err), '사용자가 부르기 → 권한 없음 (스케줄러만)');
  admin(`update reports set t = now() - interval '400 days' where id='mj000002';`);
  ok(val(`select public.purge_expired()`) === '1', '1년 넘은 것 하나만 지운다');
  ok(val(`select count(*) from reports where id='mj000002'`) === '0', '  └ 그 글이 사라짐');
  ok(Number(val(`select count(*) from reports`)) > 0, '  └ 나머지는 그대로');
  admin(`update mod_log set at = now() - interval '400 days' where action = 'restore';`);
  val(`select public.purge_expired()`);
  ok(val(`select count(*) from mod_log where action = 'restore'`) === '0' && Number(val(`select count(*) from mod_log`)) > 0,
     '운영자 처리 기록도 1년 지난 것만 지운다');
} finally {
  spawnSync('dropdb', [DB]);
}

console.log('\n==== ' + pass + ' 통과 / ' + fail + ' 실패 ====');
process.exit(fail ? 1 : 0);
