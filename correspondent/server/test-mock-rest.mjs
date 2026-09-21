/* PostgREST + GoTrue 의 "이 앱이 쓰는 부분"만 흉내 내고, 질의는 진짜 Postgres 로 보낸다.
   그래서 policies.sql 의 RLS 가 실제로 걸린다. 토큰은 시험용으로 Bearer test-<uuid>. */
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';

const PSQL = ['-h', '/home/pgtest/run', '-p', '54329', '-U', 'postgres', '-tAq'];
const lit = (s) => "'" + String(s).replace(/'/g, "''") + "'";

function q(sql, uid) {
  const pre = uid ? `set role authenticated; set app.uid = ${lit(uid)};` : `set role anon; set app.uid = '';`;
  const out = execFileSync('psql', [...PSQL, '-v', 'ON_ERROR_STOP=1', '-c',
    `${pre} select coalesce(jsonb_agg(x), '[]'::jsonb)::text from (${sql}) x;`], { encoding: 'utf8' });
  return JSON.parse(out.trim());
}
function exec(sql, uid) {
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
    if (u.pathname === '/auth/v1/user') {
      if (!uid) return send(res, 401, { message: 'no session' });
      return send(res, 200, { id: uid });
    }
    if (u.pathname === '/rest/v1/hoods')
      return send(res, 200, q(`select code, label, sido, sigungu, dong from hoods where active order by label`, uid));

    if (u.pathname === '/rest/v1/correspondents') {
      if (req.method === 'GET')
        return send(res, 200, q(`select id, name, hood_code, banned_until from correspondents where id = ${lit(eq('id'))}`, uid));
      exec(`insert into correspondents (id,name,hood_code) values (${lit(json.id)},${lit(json.name)},${json.hood_code ? lit(json.hood_code) : 'null'})
            on conflict (id) do update set name=excluded.name, hood_code=excluded.hood_code;`, uid);
      return send(res, 201, [json]);
    }

    if (u.pathname === '/rest/v1/reports') {
      if (req.method === 'GET') {
        const since = u.searchParams.get('t');
        const lim = Number(u.searchParams.get('limit')) || 200;
        return send(res, 200, q(`select id, by_name, t, cat, place, area, wait, crowd, park, rate, tags, note, public.mine(reports) as mine
          from reports where hood_code = ${lit(eq('hood_code'))}
          ${since && since.startsWith('gt.') ? `and t > ${lit(since.slice(3))}` : ''}
          order by t desc limit ${lim}`, uid));
      }
      if (req.method === 'DELETE') { exec(`delete from reports where id = ${lit(eq('id'))};`, uid); return send(res, 204); }
      const r = json;
      exec(`insert into reports (id,author,by_name,t,hood_code,cat,place,area,wait,crowd,park,rate,tags,note)
        values (${lit(r.id)}, ${lit(uid || '00000000-0000-0000-0000-000000000000')}, ${lit(r.by_name)}, ${lit(r.t)},
                ${lit(r.hood_code)}, ${lit(r.cat)}, ${lit(r.place)}, ${lit(r.area || '')},
                ${r.wait}, ${r.crowd}, ${r.park}, ${r.rate},
                ${r.tags && r.tags.length ? `array[${r.tags.map(lit).join(',')}]::text[]` : `'{}'::text[]`}, ${lit(r.note || '')});`, uid);
      return send(res, 201, [r]);
    }

    if (u.pathname === '/rest/v1/flags') {
      exec(`insert into flags (report_id, reporter, reason) values (${lit(json.report_id)}, ${lit(uid)}, ${lit(json.reason)});`, uid);
      return send(res, 201, [json]);
    }
    send(res, 404, { message: 'no route ' + u.pathname });
  } catch (e) {
    const m = String(e.stderr || e.message).split('\n').find((l) => /ERROR|오류/.test(l)) || String(e.message);
    send(res, 400, { message: m.replace(/^psql.*?ERROR:\s*/, '').trim() });
  }
}).listen(54330, () => console.log('mock PostgREST on 54330'));
