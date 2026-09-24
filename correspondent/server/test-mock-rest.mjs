/* PostgREST + GoTrue 의 "이 앱이 쓰는 부분"만 흉내 내고, 질의는 진짜 Postgres 로 보낸다.
   그래서 policies.sql 의 RLS 가 실제로 걸린다. 토큰은 시험용으로 Bearer test-<uuid>. */
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';

const PSQL = ['-h', process.env.PGHOST || '/home/pgtest/run', '-p', process.env.PGPORT || '54329',
              '-U', 'postgres', '-d', process.env.PGDATABASE || 'tpw', '-tAq'];
const lit = (s) => "'" + String(s).replace(/'/g, "''") + "'";

/* 캐시하지 않는다. 시험이 중간에 auth.users 를 비우면 캐시와 표가 어긋난다.
   탈퇴한 사람의 토큰은 되살리지 않는다 — 진짜 Supabase 에서도 지운 계정은 안 돌아온다. */
const deleted = new Set();
function ensureUser(uid) {
  if (!uid || deleted.has(uid)) return;
  execFileSync('psql', [...PSQL, '-c', `insert into auth.users (id) values (${lit(uid)}) on conflict do nothing;`]);
}
function q(sql, uid) {
  ensureUser(uid);
  const pre = uid ? `set role authenticated; set app.uid = ${lit(uid)};` : `set role anon; set app.uid = '';`;
  const out = execFileSync('psql', [...PSQL, '-v', 'ON_ERROR_STOP=1', '-c',
    `${pre} select coalesce(jsonb_agg(x), '[]'::jsonb)::text from (${sql}) x;`], { encoding: 'utf8' });
  return JSON.parse(out.trim());
}
function exec(sql, uid) {
  ensureUser(uid);
  const pre = uid ? `set role authenticated; set app.uid = ${lit(uid)};` : `set role anon; set app.uid = '';`;
  return execFileSync('psql', [...PSQL, '-v', 'ON_ERROR_STOP=1', '-c', `${pre} ${sql}`], { encoding: 'utf8' });
}

const uidOf = (req) => {
  const a = req.headers.authorization || '';
  const m = a.match(/^Bearer test-([0-9a-f-]{36})$/);
  return m ? m[1] : null;
};
const send = (res, code, body) => {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS' });
  res.end(body === undefined ? '' : JSON.stringify(body));
};

createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204);
  const u = new URL(req.url, 'http://x');
  const uid = uidOf(req);
  let body = '';
  for await (const c of req) body += c;
  const json = body ? JSON.parse(body) : null;
  const eq = (k) => { const v = u.searchParams.get(k); return v && v.startsWith('eq.') ? v.slice(3) : null; };

  try {
    if (u.pathname === '/__reset') {           // 시험 시작 때 DB 와 함께 이쪽 기억도 비운다
      deleted.clear();
      return send(res, 204);
    }
    if (u.pathname === '/auth/v1/user') {
      if (!uid) return send(res, 401, { message: 'no session' });
      return send(res, 200, { id: uid });
    }
    if (u.pathname === '/rest/v1/hoods')
      return send(res, 200, q(`select code, label, sido, sigungu, dong from hoods where active order by label`, uid));

    if (u.pathname === '/rest/v1/correspondents')   // 읽기만. 쓰기는 /rpc/save_profile
      return send(res, 200, q(`select id, name, hood_code, banned_until from correspondents where id = ${lit(eq('id'))}`, uid));

    if (u.pathname === '/rest/v1/rpc/save_profile') {
      exec(`select public.save_profile(${lit(json.p_name)}, ${json.p_hood ? lit(json.p_hood) : 'null'});`, uid);
      return send(res, 204);
    }

    if (u.pathname === '/rest/v1/reports') {
      if (req.method === 'GET') {
        if (eq('id')) return send(res, 200, q(`select id from reports where id = ${lit(eq('id'))}`, uid));
        const since = u.searchParams.get('t');
        const lim = Number(u.searchParams.get('limit')) || 200;
        return send(res, 200, q(`select id, by_name, t, cat, place, area, wait, crowd, park, rate, tags, note,
          public.mine(reports) as mine, hidden
          from reports where hood_code = ${lit(eq('hood_code'))}
          ${since && since.startsWith('gt.') ? `and t > ${lit(since.slice(3))}` : ''}
          order by t desc limit ${lim}`, uid));
      }
      if (req.method === 'DELETE') {
        /* 데이터를 바꾸는 WITH 는 하위 질의에 못 넣는다 — q() 를 거치지 않고 최상위에서 돌린다 */
        const out = exec(`with d as (delete from reports where id = ${lit(eq('id'))} returning id)
          select coalesce(jsonb_agg(d), '[]'::jsonb)::text from d;`, uid);
        return send(res, 200, JSON.parse(out.trim().split('\n').filter(Boolean).pop()));
      }
      const r = json;
      exec(`insert into reports (id,author,by_name,t,hood_code,cat,place,area,wait,crowd,park,rate,tags,note)
        values (${lit(r.id)}, ${r.author == null ? 'null' : lit(r.author)}, ${lit(r.by_name)}, ${lit(r.t)},
                ${lit(r.hood_code)}, ${lit(r.cat)}, ${lit(r.place)}, ${lit(r.area || '')},
                ${r.wait}, ${r.crowd}, ${r.park}, ${r.rate},
                ${r.tags && r.tags.length ? `array[${r.tags.map(lit).join(',')}]::text[]` : `'{}'::text[]`}, ${lit(r.note || '')});`, uid);
      return send(res, 201, [r]);
    }

    if (u.pathname === '/rest/v1/rpc/delete_my_account') {
      exec(`select public.delete_my_account();`, uid);
      deleted.add(uid);
      return send(res, 204);
    }
    /* 그 밖의 서버 함수(운영자 함수 등). PostgREST 처럼 이름 붙은 인자로 부르고 돌려준 값을 그대로 보낸다.
       함수 이름과 인자 이름은 글자만 받는다 — 시험용이라도 SQL 에 그대로 이어 붙이는 자리다. */
    const fn = u.pathname.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/);
    if (fn && req.method === 'POST') {
      const args = Object.entries(json || {}).map(([k, v]) => {
        if (!/^p_[a-z_]+$/.test(k)) throw new Error('bad arg ' + k);
        const val = v === null ? 'null' : typeof v === 'number' ? String(Number(v)) : typeof v === 'boolean' ? String(v) : lit(v);
        return k + ' => ' + val;
      }).join(', ');
      const out = exec(`select coalesce(to_jsonb(public.${fn[1]}(${args}))::text, 'null');`, uid);
      return send(res, 200, JSON.parse(out.trim().split('\n').filter(Boolean).pop()));
    }
    if (u.pathname === '/rest/v1/flags') {
      /* 클라이언트가 보낸 reporter 를 그대로 넣는다(앱은 null). 예전엔 여기서 토큰 주인을 채워 넣어서
         서버에 도장 트리거가 없다는 걸 가렸다 — 진짜 PostgREST 는 보낸 값을 그대로 넣는다. */
      exec(`insert into flags (report_id, reporter, reason) values (${lit(json.report_id)},
        ${json.reporter == null ? 'null' : lit(json.reporter)}, ${lit(json.reason)});`, uid);
      return send(res, 201, [json]);
    }
    send(res, 404, { message: 'no route ' + u.pathname });
  } catch (e) {
    const m = String(e.stderr || e.message).split('\n').find((l) => /ERROR|오류/.test(l)) || String(e.message);
    send(res, 400, { message: m.replace(/^psql.*?ERROR:\s*/, '').trim() });
  }
}).listen(Number(process.env.MOCK_PORT || 54330), '127.0.0.1',
  () => console.log('mock PostgREST on ' + (process.env.MOCK_PORT || 54330)));
