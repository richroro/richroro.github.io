// 공모주 점수 테스트 — node --test ipo/tests/score.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../score.js");

const hot = { name: "가", inst_comp: 1500, lockup: 35, price: 23000, band_lo: 18000, band_hi: 21000, float_pct: 18, amount: 120, shares: 500000, old_shares: 0 };

test("만점에 가까운 종목은 적극 참여", () => {
  const r = S.score(hot, {}, { temp: () => 120 });
  assert.equal(r.total, 100);
  assert.equal(r.verdict.key, "strong");
  assert.deepEqual(r.flags, []);
});

test("모르는 항목은 빼고 다시 100점 만점으로 맞춘다", () => {
  const r = S.score({ inst_comp: 1500, lockup: 35 }, {});
  assert.equal(r.wKnown, 45);
  assert.equal(r.total, 100);
});

test("수요예측 전에는 판정을 미룬다", () => {
  const r = S.score({ band_lo: 10000, band_hi: 12000, float_pct: 25 }, {});
  assert.equal(r.verdict.key, "wait");
  assert.equal(r.pending, true);
});

test("직접 입력한 값이 데이터보다 먼저", () => {
  const r = S.score({ ...hot, float_pct: undefined }, { float: "50" });
  const row = r.rows.find((x) => x.f.key === "float");
  assert.equal(row.v, 50);
  assert.equal(row.manual, true);
  assert.equal(row.pts, 0);
  // 유통물량 45% 초과면 점수가 높아도 '균등만'을 넘지 못한다
  assert.equal(r.verdict.key, "light");
  assert.ok(r.flags.some((f) => f.includes("45%")));
});

test("기관경쟁률 100:1 미만이면 관망", () => {
  const r = S.score({ ...hot, inst_comp: 60 }, {});
  assert.equal(r.verdict.key, "pass");
});

test("공모가 밴드 하단 미만", () => {
  const r = S.score({ ...hot, price: 17000 }, {});
  const row = r.rows.find((x) => x.f.key === "pos");
  assert.equal(row.pts, 0);
  assert.ok(["light", "pass"].includes(r.verdict.key));
});

test("스팩은 점수를 매기지 않는다", () => {
  assert.equal(S.score({ ...hot, spac: true }, {}).verdict.key, "spac");
});

test("시장 온도는 기준일 전 90일, 3곳 이상일 때만", () => {
  const L = (d, open) => ({ list_date: d, price: 10000, open });
  const items = [L("2026-09-01", 20000), L("2026-08-01", 15000), L("2026-07-10", 10000), L("2026-01-01", 40000), L("2026-09-30", 40000)];
  assert.equal(S.temperature(items, "2026-09-24"), 50);
  assert.equal(S.temperature(items.slice(0, 2), "2026-09-24"), null);
});

test("균등 예상 주수", () => {
  assert.equal(S.equalShares(100000, 50000), 1);
  assert.equal(S.equalShares(null, 10), null);
});
