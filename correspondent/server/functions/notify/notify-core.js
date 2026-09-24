/* ============================================================================
   리포트 하나가 들어왔을 때 할 일 — 받을 기기를 고르고(push_targets), 알림을 만들고, 보내고, 결과를 적는다.
   Deno(index.ts)와 시험(test-push.mjs)이 같은 코드를 쓴다. 바깥과 닿는 것(서버 함수, fetch)은 받아서 쓴다.
   ========================================================================== */
import { sendPush } from "./webpush.js";

/* 앱(app.js)의 표와 같은 말 */
const WAIT = { 0: "대기 없음", 10: "대기 10분", 30: "대기 30분", 60: "대기 1시간+" };
const CROWD = { 0: "한산", 1: "보통", 2: "붐빔", 3: "터짐" };
const PARK = { 0: "주차 넉넉", 1: "주차 보통", 2: "주차 만석", 3: "주차 불가" };

/** 잠금 화면에 뜰 알림. 제목은 장소, 본문은 현장 정보 한 줄과 누가. 같은 장소 알림은 tag 로 하나로 덮는다. */
export function payloadFor(r){
  const s = [WAIT[r.wait], CROWD[r.crowd], PARK[r.park]].filter(Boolean);
  const what = s.length ? s.join(" · ") : (r.note ? String(r.note).slice(0, 60) : "새 리포트");
  return {
    title: r.place,
    body: what + " — " + r.by_name + " 특파원",
    tag: "tpw-" + r.place_key,
    url: "./?place=" + encodeURIComponent(r.place_key)
  };
}

/** deps: { rpc(name, args), vapid: { publicKey, privateKey, subject }, fetch } */
export async function handleReport(reportId, deps){
  const job = await deps.rpc("push_targets", { p_report: reportId });
  const targets = (job && job.targets) || [];
  const out = { sent: 0, gone: 0, failed: 0 };
  if (!targets.length) return out;
  const payload = payloadFor(job.report);
  for (const t of targets) {
    let r;
    try { r = await sendPush(t, payload, deps.vapid, { fetch: deps.fetch }); }
    catch (e) { r = { ok: false, gone: false }; }                   // 네트워크 오류 — 실패로 세고 넘어간다
    if (r.ok) out.sent++; else if (r.gone) out.gone++; else out.failed++;
    await deps.rpc("push_result", { p_endpoint: t.endpoint, p_ok: !!r.ok, p_gone: !!r.gone });
  }
  return out;
}
