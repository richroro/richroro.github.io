# server — 공용 보드

`config.js` 를 비워 두면 앱은 이 폴더를 전혀 안 쓴다. 붙이는 법은 [../SETUP.md](../SETUP.md).

| 파일 | |
| --- | --- |
| `schema.sql` | 표 네 개 — hoods / correspondents / reports / flags |
| `policies.sql` | RLS·트리거·한도. **이걸 빼면 아무나 아무 글이나 지운다** |
| `seed-hoods.sql` | 동네. 한 번에 전국을 열지 않는다 |
| `test-attack.sql` | 공격 시나리오 12가지 |
| `test-mock-rest.mjs` | PostgREST 흉내. 질의는 진짜 Postgres 로 보낸다 |
| `test-e2e.mjs` | 브라우저 → fetch → 모의 서버 → 진짜 RLS |

## 돌려 보기

로컬 Postgres 16 이 있으면 정책을 실제로 공격해 볼 수 있다. Supabase 에는 있고
로컬에는 없는 것(`auth.uid()`, `anon`/`authenticated` 역할)만 먼저 심는다.

```bash
createdb tpw && psql -d tpw -c "
  create schema auth;
  create function auth.uid() returns uuid language sql stable as \$\$
    select nullif(current_setting('app.uid', true), '')::uuid \$\$;
  create role anon nologin; create role authenticated nologin;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;"

psql -d tpw -f schema.sql -f policies.sql -f seed-hoods.sql
psql -d tpw -f test-attack.sql          # 12가지가 전부 막히는지
```

`test-e2e.mjs` 는 모의 서버(54330)와 앱을 띄운 정적 서버가 함께 떠 있어야 돈다.
