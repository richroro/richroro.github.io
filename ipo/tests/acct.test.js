// 계좌 준비 순서 테스트 — node --test ipo/tests/acct.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const A = require("../acct.js");

// 날짜 도우미: 주말만 쉰다(공휴일 없음)
const toD = (s) => new Date(s + "T00:00:00Z");
const addDays = (s, n) => { const d = toD(s); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const isBiz = (s) => ![0, 6].includes(toD(s).getUTCDay());
const key = (u) => u.replace(/\s+/g, "").replace(/(금융)?투자증권$|증권$|투자$/, "");
const W = { 가: 3, 나: 2, 다: 1 };
const base = { today: "2026-10-05", isBiz, addDays, key, weight: (it) => W[it.id[0]] ?? 1, lastOpen: null };
const it = (id, start, uw) => ({ id, sub_start: start, sub_end: addDays(start, 1), uw });

test("영업일 세기", () => {
  assert.equal(A.addBiz("2026-10-02", 1, isBiz, addDays), "2026-10-05"); // 금 → 월
  assert.equal(A.addBiz("2026-10-05", 20, isBiz, addDays), "2026-11-02");
});

test("가진 계좌로 되는 청약은 만들 필요 없음", () => {
  const r = A.plan({ ...base, own: ["KB"], items: [it("가1", "2026-10-08", ["KB증권"])] });
  assert.equal(r.steps.length, 0);
  assert.equal(r.rows[0].state, "ok");
});

test("늦어도 날짜는 청약 첫날 전 영업일", () => {
  const r = A.plan({ ...base, own: [], items: [it("가1", "2026-10-12", ["신한투자증권"])] }); // 월요일 청약
  assert.equal(r.steps[0].name, "신한투자증권");
  assert.equal(r.steps[0].date, "2026-10-05");
  assert.equal(r.steps[0].by, "2026-10-09"); // 전 금요일
});

test("20영업일 간격 — 두 번째 계좌가 늦으면 놓침으로 표시", () => {
  const items = [it("가1", "2026-10-08", ["KB증권"]), it("나1", "2026-10-15", ["삼성증권"]), it("다1", "2026-12-01", ["삼성증권"])];
  const r = A.plan({ ...base, own: [], items });
  assert.deepEqual(r.steps.map((s) => s.name), ["KB증권", "삼성증권"]);
  assert.equal(r.steps[1].date, "2026-11-03"); // 10/5 뒤 21번째 영업일
  assert.deepEqual(r.steps[1].gets.map((x) => x.id), ["다1"]);
  assert.deepEqual(r.steps[1].late.map((x) => x.id), ["나1"]);
  assert.equal(r.rows.find((x) => x.it.id === "나1").state, "late");
});

test("한 번에 여러 청약을 여는 증권사, 급한 것을 먼저", () => {
  // 오늘 하나만 만들 수 있다: 미래에셋은 곧 청약 2곳(급함), NH 는 먼 청약 3곳 — 미래에셋이 먼저, NH 는 다음 기회에도 된다
  const items = [it("가1", "2026-10-08", ["미래에셋증권"]), it("나1", "2026-10-09", ["미래에셋증권"]),
    it("가2", "2026-12-10", ["NH투자증권"]), it("가3", "2026-12-14", ["NH투자증권"]), it("가4", "2026-12-16", ["NH투자증권"])];
  const r = A.plan({ ...base, own: [], items });
  assert.deepEqual(r.steps.map((s) => s.name), ["미래에셋증권", "NH투자증권"]);
  assert.equal(r.rows.filter((x) => x.state === "late").length, 0);
});

test("마지막 개설일이 있으면 그 뒤 20영업일이 지나서부터", () => {
  const r = A.plan({ ...base, own: [], lastOpen: "2026-10-01", items: [it("가1", "2026-12-01", ["KB증권"])] });
  assert.equal(r.first, "2026-10-30");
  assert.equal(r.steps[0].date, "2026-10-30");
});

test("같은 증권사를 다르게 적어도 하나로", () => {
  const r = A.plan({ ...base, own: ["유진"], items: [it("가1", "2026-10-08", ["유진투자증권"])] });
  assert.equal(r.rows[0].state, "ok");
});

test("지난 청약은 빼고, 청약 중이면 마감일까지", () => {
  const items = [it("가1", "2026-09-20", ["KB증권"]), { id: "나1", sub_start: "2026-10-05", sub_end: "2026-10-06", uw: ["KB증권"] }];
  const r = A.plan({ ...base, own: [], items });
  assert.deepEqual(r.rows.map((x) => x.it.id), ["나1"]);
  assert.equal(r.rows[0].due, "2026-10-06");
});
