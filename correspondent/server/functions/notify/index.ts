// ============================================================================
// Supabase Edge Function "notify" — 데이터베이스 웹훅(reports INSERT)이 부른다.
// 할 일은 notify-core.js 에 있고, 여기는 환경 값과 요청을 이어 줄 뿐이다. 붙이는 법은 SETUP.md 6단계.
//
//   supabase functions deploy notify --no-verify-jwt
//   supabase secrets set VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… VAPID_SUBJECT=mailto:… PUSH_WEBHOOK_SECRET=…
//
// --no-verify-jwt 인 대신 웹훅이 보내는 머리 x-tpw-secret 을 맞춰 본다. 틀리면 아무것도 안 한다.
// 이 함수가 받는 건 리포트 id 하나뿐이고, 내용은 서버에서 다시 읽는다 — 누가 가짜 요청을 보내도
// 있는 리포트를 30분에 한 번 알리는 것 말고는 할 수 있는 게 없다.
// ============================================================================
import { handleReport } from "./notify-core.js";

const BASE = Deno.env.get("SUPABASE_URL") ?? "";
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SECRET = Deno.env.get("PUSH_WEBHOOK_SECRET") ?? "";
const vapid = {
  publicKey: Deno.env.get("VAPID_PUBLIC_KEY") ?? "",
  privateKey: Deno.env.get("VAPID_PRIVATE_KEY") ?? "",
  subject: Deno.env.get("VAPID_SUBJECT") ?? "",
};

async function rpc(name: string, args: unknown) {
  const res = await fetch(BASE + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(name + " " + res.status + " " + (await res.text()));
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("POST only", { status: 405 });
  if (!SECRET || req.headers.get("x-tpw-secret") !== SECRET) return new Response("forbidden", { status: 403 });
  if (!vapid.publicKey || !vapid.privateKey || !vapid.subject) return new Response("VAPID 설정이 비었습니다", { status: 500 });
  let body: { type?: string; table?: string; record?: { id?: unknown } };
  try { body = await req.json(); } catch { return new Response("bad json", { status: 400 }); }
  const id = body?.record?.id;
  if (body?.type !== "INSERT" || body?.table !== "reports" || typeof id !== "string") {
    return new Response("ignored", { status: 202 });
  }
  const out = await handleReport(id, { rpc, vapid, fetch });
  return new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json" } });
});
