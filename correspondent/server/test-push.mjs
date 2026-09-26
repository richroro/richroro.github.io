/* ============================================================================
   폰 알림 — 판정형. 실패가 하나라도 있으면 종료 코드 1.

     PGHOST=… PGUSER=postgres node test-push.mjs

   1. 암호화가 RFC 8291 부록 A 의 예제와 한 바이트까지 같은지 (풀기·싸기 둘 다)
   2. VAPID 서명이 공개 키로 검증되는지
   3. 모의 푸시 서비스로 보내서, 받는 브라우저의 열쇠로 풀리는지
   4. 서버 — 구독 권한, 누구에게 가는지(쓴 사람 빼고·30분에 한 번·가린 글·상한 글), 끝난 구독 지우기, 탈퇴
   5. Edge Function 입구(index.ts) — 가짜 Deno 로 불러서 비밀 머리·웹훅 모양·끝까지

   스스로 임시 DB(tpw_push_<pid>)를 만들고 끝나면 지운다. 푸시 서비스는 흉내 낸다 — 진짜 구글·애플로는 안 보낸다.
   ========================================================================== */
import { createServer } from 'node:http';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { b64d, b64e, ecdhKeys, encrypt, decrypt, vapidAuth, sendPush } from './functions/notify/webpush.js';
import { handleReport, payloadFor } from './functions/notify/notify-core.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const { subtle } = globalThis.crypto;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const section = (t) => console.log('\n== ' + t + ' ==');
const td = new TextDecoder();

/* ─────────────────────────── 1. RFC 8291 부록 A ─────────────────────────── */
section('암호화 — RFC 8291 부록 A');
{
  const V = {
    plain: 'V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24',
    asPub: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
    asPriv: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
    uaPub: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
    uaPriv: 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94',
    auth: 'BTBZMqHH6r4Tts7J_aSIgg',
    salt: 'DGv6ra1nlYgDCS1FRnbzlw',
    final: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN'
  };
  const ua = await ecdhKeys(V.uaPub, V.uaPriv);
  let got = null;
  try { got = await decrypt(b64d(V.final), ua, V.auth); } catch (e) {}
  ok(got && b64e(got) === V.plain, '예제 암호문을 받는 쪽 열쇠로 푼다 → "' + (got ? td.decode(got) : '') + '"');
  const mine = await encrypt(b64d(V.plain), { p256dh: V.uaPub, auth: V.auth }, { salt: b64d(V.salt), asKeys: await ecdhKeys(V.asPub, V.asPriv) });
  ok(b64e(mine) === V.final, '같은 소금·같은 서버 열쇠로 싸면 예제와 한 바이트까지 같다 (' + mine.length + '바이트)');
  const again = await encrypt(b64d(V.plain), { p256dh: V.uaPub, auth: V.auth });
  ok(b64e(again) !== V.final && td.decode(await decrypt(again, ua, V.auth)) === td.decode(b64d(V.plain)), '실제로는 매번 새 소금·새 열쇠 — 겉은 다르고 풀면 같다');
}

/* ─────────────────────────── 2. VAPID ─────────────────────────── */
section('VAPID 서명 — RFC 8292');
const vkp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const VAPID = { publicKey: b64e(new Uint8Array(await subtle.exportKey('raw', vkp.publicKey))),
                privateKey: (await subtle.exportKey('jwk', vkp.privateKey)).d, subject: 'mailto:ops@example.com' };
async function checkVapid(header, endpoint){
  const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(header || '');
  if (!m) return { ok: false };
  const head = JSON.parse(td.decode(b64d(m[1]))), claims = JSON.parse(td.decode(b64d(m[2])));
  const pub = await subtle.importKey('raw', b64d(m[4]), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const good = await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, b64d(m[3]), new TextEncoder().encode(m[1] + '.' + m[2]));
  return { ok: good, head, claims, k: m[4], aud: new URL(endpoint).origin };
}
{
  const now = Date.now();
  const v = await checkVapid(await vapidAuth('https://push.test/abc', VAPID, now), 'https://push.test/abc');
  ok(v.ok, '서명이 공개 키로 검증된다');
  ok(v.head.alg === 'ES256' && v.claims.aud === 'https://push.test' && v.claims.sub === VAPID.subject && v.k === VAPID.publicKey,
     '  └ ES256, aud 는 푸시 서비스의 출처, sub 는 연락처, k 는 공개 키');
  ok(v.claims.exp > now / 1000 && v.claims.exp <= now / 1000 + 24 * 3600, '  └ 만료는 24시간 안 (' + Math.round(v.claims.exp - now / 1000) / 3600 + '시간)');
  const t = (await vapidAuth('https://push.test/abc', VAPID, now)).replace(/t=([^.]+)\.([^.]+)\./, (_, h) =>
    't=' + h + '.' + b64e(new TextEncoder().encode(JSON.stringify({ aud: 'https://evil.test', exp: 1, sub: 'x' }))) + '.');
  ok(!(await checkVapid(t, 'https://push.test/abc')).ok, '  └ 내용을 바꾸면 검증되지 않는다');
}

/* ─────────────────────────── 3. 모의 푸시 서비스 ─────────────────────────── */
section('보내기 — 모의 푸시 서비스에서 받는 열쇠로 푼다');
const got = [];                              // 푸시 서비스가 받은 것
const status = new Map();                    // 경로 → 돌려줄 상태
const svc = createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  got.push({ path: req.url, headers: req.headers, body: new Uint8Array(Buffer.concat(chunks)) });
  res.writeHead(status.get(req.url) || 201); res.end();
});
await new Promise((r) => svc.listen(0, '127.0.0.1', r));
const SVC = 'http://127.0.0.1:' + svc.address().port;
const viaMock = (url, opts) => fetch(String(url).replace('https://push.test', SVC), opts);
async function newSub(name){
  const kp = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const raw = new Uint8Array(await subtle.exportKey('raw', kp.publicKey));
  return { endpoint: 'https://push.test/' + name, p256dh: b64e(raw), auth: b64e(globalThis.crypto.getRandomValues(new Uint8Array(16))),
           ua: { privateKey: kp.privateKey, rawPublic: raw } };
}
const opened = async (g, sub) => JSON.parse(td.decode(await decrypt(g.body, sub.ua, sub.auth)));
{
  const s = await newSub('one');
  const r = await sendPush(s, { title: '별빛 키즈카페', body: '붐빔' }, VAPID, { fetch: viaMock });
  const g = got.pop();
  ok(r.ok && r.status === 201 && g.path === '/one', '보냈다 (201)');
  ok(g.headers['content-encoding'] === 'aes128gcm' && g.headers.ttl === '10800' && g.headers['content-type'] === 'application/octet-stream',
     '  └ aes128gcm, TTL 3시간 — 그보다 늦게 닿는 현장 소식은 상한 정보다');
  ok((await checkVapid(g.headers.authorization, s.endpoint)).ok, '  └ 푸시 서비스가 VAPID 서명을 검증할 수 있다');
  ok((await opened(g, s)).title === '별빛 키즈카페', '  └ 받는 브라우저의 열쇠로 풀린다');
  let bad = null; try { await decrypt(g.body, (await newSub('x')).ua, s.auth); } catch (e) { bad = e; }
  ok(bad, '  └ 다른 브라우저의 열쇠로는 안 풀린다 (푸시 서비스도 못 읽는다)');
  status.set('/gone', 410);
  const r2 = await sendPush(await newSub('gone'), { title: 'x' }, VAPID, { fetch: viaMock });
  ok(r2.gone && !r2.ok, '410 이면 끝난 구독 (지워야 한다)');
}

section('알림 문구');
{
  const base = { place: '별빛 키즈카페', place_key: '별빛키즈카페', wait: -1, crowd: 0, park: -1, note: '' };
  ok(payloadFor({ ...base, by_name: '준호' }).body === '한산 — 준호 특파원', '"한산 — 준호 특파원"');
  ok(payloadFor({ ...base, by_name: '이름 없는 특파원' }).body === '한산 — 이름 없는 특파원',
     '이름을 안 정한 사람은 "— 이름 없는 특파원" ("특파원 특파원"이 아니라)');
}

/* ─────────────────────────── 4. 서버 ─────────────────────────── */
const DB = 'tpw_push_' + process.pid;
const base = ['-X', '-q', '-tA', '-v', 'ON_ERROR_STOP=1'];
const U = { 민지: '11111111-1111-1111-1111-111111111111', 준호: '22222222-2222-2222-2222-222222222222',
            서연: '33333333-3333-3333-3333-333333333333', 태오: '44444444-4444-4444-4444-444444444444' };
const HOOD = '4117110100';
const psql = (sql) => { const r = spawnSync('psql', [...base, '-d', DB, '-c', sql], { encoding: 'utf8' });
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() }; };
const as = (who, sql) => psql(`set role authenticated; set app.uid = '${U[who]}'; ${sql}`);
const anon = (sql) => psql(`set role anon; set app.uid = ''; ${sql}`);
const asSvc = (sql) => psql(`set role service_role; set app.uid = ''; ${sql}`);
const val = (sql) => psql(sql).out;
const lit = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const arr = (a) => 'array[' + a.map(lit).join(',') + ']::text[]';
const savePush = (who, s, places, hood = HOOD) => as(who, `select public.save_push(${lit(s.endpoint)}, ${lit(s.p256dh)}, ${lit(s.auth)}, ${lit(hood)}, ${arr(places)});`);
let n = 0;
const write = (who, place, extra = {}) => {
  const id = 'pu' + String(++n).padStart(6, '0');
  const r = as(who, `insert into reports (id, author, by_name, t, hood_code, cat, place, wait, crowd)
    values ('${id}', null, '', ${extra.t || 'now()'}, '${HOOD}', 'play', ${lit(place)}, ${extra.wait ?? -1}, ${extra.crowd ?? -1});`);
  if (!r.ok) throw new Error(r.err);
  return id;
};
/* Edge Function 이 service_role 로 부르는 것과 같게 */
const rpc = async (name, args) => {
  const a = Object.entries(args).map(([k, v]) => k + ' => ' + (typeof v === 'boolean' ? v : lit(v))).join(', ');
  const r = asSvc(`select coalesce(to_jsonb(public.${name}(${a}))::text, 'null');`);
  if (!r.ok) throw new Error(r.err);
  return JSON.parse(r.out);
};
const deliver = async (id) => { got.length = 0; const out = await handleReport(id, { rpc, vapid: VAPID, fetch: viaMock }); return { out, paths: got.map((g) => g.path).sort() }; };

execFileSync('createdb', [DB]);
try {
  for (const f of ['test-auth-stub.sql', 'schema.sql', 'policies.sql', 'admin.sql', 'push.sql', 'seed-hoods.sql'])
    execFileSync('psql', [...base, '-d', DB, '-f', resolve(HERE, f)], { stdio: ['ignore', 'ignore', 'pipe'] });
  const ret = readFileSync(resolve(HERE, 'retention.sql'), 'utf8').split('여기부터는 Supabase 에서만')[0];   // pg_cron 은 Supabase 에만
  execFileSync('psql', [...base, '-d', DB], { input: ret.slice(0, ret.lastIndexOf('\n')) });
  psql(`insert into auth.users (id) values ${Object.values(U).map((u) => `('${u}')`).join(',')};`);
  for (const who of Object.keys(U)) as(who, `select public.save_profile('${who}', '${HOOD}');`);

  section('서버 — 구독 저장과 권한');
  const S = { 민지: await newSub('mj'), 준호: await newSub('jh'), 서연: await newSub('sy') };
  let r = savePush('민지', S.민지, ['별빛 키즈카페', '별빛키즈카페', ' 만안  손칼국수 ']);
  ok(r.ok && JSON.parse(r.out).places.slice().sort().join(',') === '만안손칼국수,별빛키즈카페', '저장 — 장소 이름은 서버의 place_key 규칙으로(띄어쓰기 빼고), 겹친 것은 하나로');
  r = anon(`select public.save_push('https://push.test/a', ${lit(S.민지.p256dh)}, ${lit(S.민지.auth)}, '${HOOD}', '{}');`);
  ok(!r.ok && /permission denied/.test(r.err), '로그인 없이 → 실행 권한 없음');
  r = as('민지', `select count(*) from push_subs;`);
  ok(!r.ok && /permission denied/.test(r.err), '구독 표는 누구도 직접 못 본다 (자기 것도) — 알림 주소는 기기 열쇠다');
  r = savePush('준호', { ...S.준호, endpoint: 'http://push.test/plain' }, []);
  ok(!r.ok && /push_subs_endpoint_check/.test(r.err), 'https 가 아닌 알림 주소 → 거부');
  r = savePush('준호', S.준호, Array.from({ length: 31 }, (_, i) => '장소' + i));
  ok(!r.ok && /30곳/.test(r.err), '31곳 → 거부 (앱과 같은 30곳)');
  as('준호', `select public.drop_push(${lit(S.민지.endpoint)});`);
  ok(val(`select count(*) from push_subs where endpoint=${lit(S.민지.endpoint)}`) === '1', '남의 구독을 끄기 → 0건 (민지 것 그대로)');
  r = as('민지', `select public.push_targets('x');`);
  ok(!r.ok && /permission denied/.test(r.err), '받을 사람 고르기는 보내는 함수(service_role)만');
  r = as('민지', `select public.push_result(${lit(S.민지.endpoint)}, false, true);`);
  ok(!r.ok && /permission denied/.test(r.err), '  └ 결과 적기도');
  for (let i = 0; i < 11; i++) savePush('태오', await newSub('to' + i), ['어디']);
  ok(val(`select count(*) from push_subs where owner='${U.태오}'`) === '10', '한 사람 기기는 최근 10대까지');

  section('누구에게 가나');
  savePush('서연', S.서연, ['별빛 키즈카페', '온기 로스터리']);
  savePush('준호', S.준호, ['별빛 키즈카페']);
  let d = await deliver(write('준호', '별빛 키즈카페', { wait: 30, crowd: 2 }));
  ok(d.paths.join(',') === '/mj,/sy', '준호가 별빛에 쓰면 → 민지·서연 (쓴 준호는 빼고)');
  const msg = await opened(got.find((g) => g.path === '/mj'), S.민지);
  ok(msg.title === '별빛 키즈카페' && msg.body === '대기 30분 · 붐빔 — 준호 특파원' && msg.tag === 'tpw-별빛키즈카페',
     '  └ 풀어 보면: ' + msg.title + ' / ' + msg.body);
  ok(msg.url === './?place=' + encodeURIComponent('별빛키즈카페'), '  └ 누르면 그 장소로 (' + msg.url + ')');
  d = await deliver(write('준호', '별빛 키즈카페', { crowd: 3 }));
  ok(d.paths.length === 0, '30분 안에 같은 곳 → 안 보낸다 (폰이 울려 대지 않게)');
  d = await deliver(write('서연', '만안 손칼국수', { crowd: 1 }));
  ok(d.paths.join(',') === '/mj', '만안 손칼국수 → 지켜보는 민지만');
  const hid = write('태오', '온기 로스터리', { crowd: 0 });
  psql(`update reports set hidden = true where id = '${hid}';`);
  d = await deliver(hid);
  ok(d.paths.length === 0, '가려진 글 → 안 보낸다');
  d = await deliver(write('태오', '온기 로스터리', { crowd: 0, t: "now() - interval '4 hours'" }));
  ok(d.paths.length === 0, '쓴 지 세 시간 넘은 글(늦게 올라온 것) → 안 보낸다');
  status.set('/sy', 410);
  d = await deliver(write('태오', '온기 로스터리', { crowd: 1 }));
  ok(d.out.gone === 1 && val(`select count(*) from push_subs where endpoint=${lit(S.서연.endpoint)}`) === '0',
     '푸시 서비스가 410(없는 구독)이면 → 서버에서 지운다');
  for (let i = 0; i < 4; i++) await rpc('push_result', { p_endpoint: S.민지.endpoint, p_ok: false, p_gone: false });
  ok(val(`select fails from push_subs where endpoint=${lit(S.민지.endpoint)}`) === '4', '실패 넷 — 아직 둔다');
  await rpc('push_result', { p_endpoint: S.민지.endpoint, p_ok: true, p_gone: false });
  ok(val(`select fails from push_subs where endpoint=${lit(S.민지.endpoint)}`) === '0', '  └ 한 번 되면 다시 0');
  for (let i = 0; i < 5; i++) await rpc('push_result', { p_endpoint: S.민지.endpoint, p_ok: false, p_gone: false });
  ok(val(`select count(*) from push_subs where endpoint=${lit(S.민지.endpoint)}`) === '0', '  └ 연달아 다섯 번 실패하면 지운다');
  as('준호', `select public.delete_my_account();`);
  ok(val(`select count(*) from push_subs where endpoint=${lit(S.준호.endpoint)}`) === '0', '탈퇴하면 구독도 함께 지워진다');
  status.delete('/sy');
  savePush('서연', S.서연, ['온기 로스터리']);
  await deliver(write('태오', '온기 로스터리', { crowd: 2 }));                   // 방금 보낸 기록 하나
  psql(`insert into push_sent (endpoint, place_key, at)
        select endpoint, '어디', now() - interval '2 days' from push_subs where owner = '${U.태오}' limit 1;`);   // 이틀 지난 것 하나
  ok(val(`select count(*) from push_sent`) === '2', '30분 묶음 기록 — 방금 것 하나, 이틀 지난 것 하나');
  ok(psql(`select public.purge_expired();`).ok && val(`select count(*) from push_sent`) === '1' &&
     val(`select count(*) from push_sent where at > now() - interval '1 hour'`) === '1', '  └ 하루 지난 것만 지운다 (retention.sql)');

  section('Edge Function 입구 — index.ts 를 가짜 Deno 로');
  savePush('서연', S.서연, ['별빛 키즈카페']);
  status.delete('/sy');
  const KEY = 'service-key-for-test', SECRET = 'hook-secret';
  const rest = createServer(async (req, res) => {                // PostgREST 의 rpc 흉내 — 관리 키만 받는다
    let body = ''; for await (const c of req) body += c;
    const m = req.url.match(/^\/rest\/v1\/rpc\/(push_targets|push_result)$/);
    if (!m || req.headers.apikey !== KEY || req.headers.authorization !== 'Bearer ' + KEY) { res.writeHead(401); return res.end('{}'); }
    try { const out = await rpc(m[1], JSON.parse(body)); res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(out)); }
    catch (e) { res.writeHead(400); res.end(JSON.stringify({ message: e.message })); }
  });
  await new Promise((r) => rest.listen(0, '127.0.0.1', r));
  const ENV = { SUPABASE_URL: 'http://127.0.0.1:' + rest.address().port, SUPABASE_SERVICE_ROLE_KEY: KEY, PUSH_WEBHOOK_SECRET: SECRET,
                VAPID_PUBLIC_KEY: VAPID.publicKey, VAPID_PRIVATE_KEY: VAPID.privateKey, VAPID_SUBJECT: VAPID.subject };
  let handler = null;
  globalThis.Deno = { env: { get: (k) => ENV[k] }, serve: (h) => { handler = h; } };
  const realFetch = globalThis.fetch;
  globalThis.fetch = (url, opts) => realFetch(String(url).replace('https://push.test', SVC), opts);
  try {
    /* 타입 지우기(type stripping)로 .ts 를 그대로 부른다 — Node 22.18 이상 */
    try { await import('./functions/notify/index.ts'); }
    catch (e) { ok(false, 'index.ts 를 불러오지 못했습니다 (Node 22.18 이상이 필요합니다): ' + e.message); }
    ok(typeof handler === 'function', 'index.ts 가 Deno.serve 로 처리기를 건다');
    if (typeof handler !== 'function') throw new Error('처리기가 없어 입구 검사를 건너뜁니다');
    const call = (body, headers = {}, method = 'POST') => handler(new Request('http://fn/notify', { method,
      headers: { 'Content-Type': 'application/json', ...headers }, body: method === 'POST' ? JSON.stringify(body) : undefined }));
    const id = write('태오', '별빛 키즈카페', { crowd: 0 });
    ok((await call({}, {}, 'GET')).status === 405, 'GET → 405');
    ok((await call({ type: 'INSERT', table: 'reports', record: { id } })).status === 403, '비밀 머리 없이 → 403 (아무것도 안 한다)');
    ok((await call({ type: 'INSERT', table: 'reports', record: { id } }, { 'x-tpw-secret': 'wrong' })).status === 403, '틀린 비밀 → 403');
    ok((await call({ type: 'UPDATE', table: 'reports', record: { id } }, { 'x-tpw-secret': SECRET })).status === 202, 'INSERT 가 아닌 웹훅 → 202 로 넘긴다');
    got.length = 0;
    const res = await call({ type: 'INSERT', table: 'reports', record: { id, note: '웹훅이 실어 온 내용은 믿지 않는다' } }, { 'x-tpw-secret': SECRET });
    const out = await res.json();
    ok(res.status === 200 && out.sent === 1 && got.length === 1 && got[0].path === '/sy', '웹훅 → 서연에게 한 통 (200 ' + JSON.stringify(out) + ')');
    ok((await opened(got[0], S.서연)).body === '한산 — 태오 특파원', '  └ 내용은 웹훅이 아니라 서버에서 다시 읽은 것');
  } finally {
    globalThis.fetch = realFetch;
    rest.close();
  }
} finally {
  svc.close();
  spawnSync('dropdb', [DB]);
}

console.log('\n==== ' + pass + ' 통과 / ' + fail + ' 실패 ====');
process.exit(fail ? 1 : 0);
