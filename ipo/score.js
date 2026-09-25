/* 공모주 점수 — 공모주 블로거들이 청약 전에 흔히 보는 기준을 점수로 옮긴 것.
   페이지(app.js)와 테스트(tests/score.test.js)가 같이 씁니다. 화면 코드 없이 순수 함수만 둡니다.

   항목(가중치)             좋게 보는 쪽
   기관경쟁률 (25)          높을수록 — 1,000:1 이상이면 만점
   의무보유확약 (20)        높을수록 — 상장 직후 매도 물량이 적다
   공모가 확정 위치 (15)    희망 밴드 상단 초과 > 상단 > 밴드 안 > 하단 미만
   유통가능물량 (15)        적을수록 — 30% 미만을 좋게 본다
   공모 규모 (10)           작을수록 — 가벼운 종목이 첫날 잘 오른다는 경험칙
   구주매출 비율 (10)       낮을수록 — 기존 주주가 파는 물량
   시장 온도 (5)            최근 90일 상장 종목의 평균 시초가 수익률

   모르는 항목은 빼고 아는 항목의 가중치로 100점 만점을 다시 맞춥니다. 아는 가중치가 40 미만이면
   (보통 수요예측 전) 판정을 미룹니다. 참고용이며 수익을 보장하지 않습니다. */
(function (root) {
  "use strict";

  const step = (v, rules) => { for (const [ok, pts, note] of rules) if (ok(v)) return [pts, note]; return [0, ""]; };

  const FACTORS = [
    { key: "inst", label: "기관경쟁률", w: 25, unit: ":1", input: true,
      crit: "1,000:1↑ 만점 · 500↑ · 200↑ · 100↑",
      get: (it) => it.inst_comp,
      score: (v) => step(v, [[(x) => x >= 1000, 25, "기관 수요가 매우 강함"], [(x) => x >= 500, 19, "기관 수요가 강한 편"],
        [(x) => x >= 200, 12, "보통"], [(x) => x >= 100, 6, "약한 편"], [() => true, 0, "기관 수요 부족"]]) },
    { key: "lock", label: "의무보유확약", w: 20, unit: "%", input: true,
      crit: "30%↑ 만점 · 15%↑ · 5%↑",
      get: (it) => it.lockup,
      score: (v) => step(v, [[(x) => x >= 30, 20, "상장 직후 팔 수 없는 물량이 많음"], [(x) => x >= 15, 14, "괜찮은 편"],
        [(x) => x >= 5, 7, "낮은 편"], [() => true, 0, "거의 없음 — 첫날 매도 물량 주의"]]) },
    { key: "pos", label: "공모가 확정 위치", w: 15, unit: "", input: false,
      crit: "밴드 상단 초과 만점 · 상단 · 밴드 안 · 하단 미만",
      get: (it) => (it.price && it.band_hi && it.band_lo ? (it.price - it.band_hi) / it.band_hi * 100 : null),
      fmt: (v, it) => (v > 0.5 ? `상단 +${v.toFixed(0)}%` : v >= -0.5 ? "밴드 상단" : it.price < it.band_lo ? "하단 미만" : "밴드 안"),
      score: (v, it) => (v > 0.5 ? [15, "기관이 더 비싸게라도 사겠다고 함"] : v >= -0.5 ? [12, "상단 확정"]
        : it.price < it.band_lo ? [0, "하단 아래로 낮춤 — 수요 부족 신호"] : [6, "밴드 안에서 확정"]) },
    { key: "float", label: "유통가능물량", w: 15, unit: "%", input: true,
      crit: "20%↓ 만점 · 30%↓ · 40%↓",
      get: (it) => it.float_pct,
      score: (v) => step(v, [[(x) => x <= 20, 15, "상장일 풀리는 물량이 적음"], [(x) => x <= 30, 11, "무난"],
        [(x) => x <= 40, 5, "많은 편"], [() => true, 0, "많음 — 첫날 매도 압력"]]) },
    { key: "size", label: "공모 규모", w: 10, unit: "억", input: true,
      crit: "150억↓ 만점 · 300억↓ · 700억↓ · 2,000억↓",
      get: (it) => it.amount ?? (it.price && it.shares ? it.price * it.shares / 1e8 : null),
      score: (v) => step(v, [[(x) => x <= 150, 10, "가벼움"], [(x) => x <= 300, 8, "가벼운 편"], [(x) => x <= 700, 5, "중간"],
        [(x) => x <= 2000, 3, "무거운 편"], [() => true, 1, "대형 공모"]]) },
    { key: "old", label: "구주매출 비율", w: 10, unit: "%", input: true,
      crit: "0% 만점 · 20%↓ · 40%↓",
      get: (it) => (it.old_pct != null ? it.old_pct : it.old_shares != null && it.shares ? it.old_shares / it.shares * 100 : null),
      score: (v) => step(v, [[(x) => x <= 0.5, 10, "신주만 — 회사로 돈이 들어감"], [(x) => x <= 20, 7, "적음"],
        [(x) => x <= 40, 3, "많은 편"], [() => true, 0, "기존 주주 매도 비중이 큼"]]) },
    { key: "temp", label: "시장 온도", w: 5, unit: "%", input: false,
      crit: "최근 90일 평균 시초가 +100%↑ 만점 · +50%↑ · +20%↑ · 0%↑",
      get: (it, ctx) => (ctx && ctx.temp ? ctx.temp(it) : null),
      fmt: (v) => `${v > 0 ? "+" : ""}${v.toFixed(0)}%`,
      score: (v) => step(v, [[(x) => x >= 100, 5, "공모주 시장이 뜨거움"], [(x) => x >= 50, 4, "좋음"], [(x) => x >= 20, 2, "보통"],
        [(x) => x >= 0, 1, "미지근"], [() => true, 0, "차가움"]]) },
  ];

  const VERDICTS = [
    { key: "strong", min: 75, label: "적극 참여", tip: "균등에 더해 여유 자금으로 비례까지 생각해 볼 만한 숫자" },
    { key: "go", min: 58, label: "참여", tip: "균등 배정 위주로 참여할 만한 숫자" },
    { key: "light", min: 42, label: "균등만", tip: "최소 주수만 넣어 균등 1~2주를 노리는 정도" },
    { key: "pass", min: -1, label: "관망", tip: "숫자가 약함 — 건너뛰는 블로거가 많은 유형" },
  ];
  const ORDER = ["strong", "go", "light", "pass"];

  /** it: 종목, over: 직접 입력한 값 {inst, lock, float, size, old}, ctx: {temp(it)} */
  function score(it, over, ctx) {
    over = over || {};
    const rows = FACTORS.map((f) => {
      const manual = f.input && over[f.key] != null && over[f.key] !== "" && isFinite(+over[f.key]);
      const v = manual ? +over[f.key] : f.get(it, ctx);
      if (v == null || !isFinite(v)) return { f, v: null, pts: null, note: "", manual: false };
      const [pts, note] = f.score(v, it);
      return { f, v, pts, note, manual };
    });
    const known = rows.filter((r) => r.pts != null);
    const wKnown = known.reduce((a, r) => a + r.f.w, 0);
    const raw = known.reduce((a, r) => a + r.pts, 0);
    const total = wKnown ? Math.round(raw / wKnown * 100) : null;
    const flags = [];
    const val = (k) => rows.find((r) => r.f.key === k).v;
    let cap = null; // 넘을 수 없는 판정
    const capAt = (k) => { if (cap == null || ORDER.indexOf(k) > ORDER.indexOf(cap)) cap = k; };
    if (val("inst") != null && val("inst") < 100) { flags.push("기관경쟁률이 100:1 미만 — 흥행 실패에 가까움"); capAt("pass"); }
    if (it.price && it.band_lo && it.price < it.band_lo) { flags.push("공모가를 희망 밴드 아래로 낮춰 확정"); capAt("light"); }
    if (val("float") != null && val("float") > 45) { flags.push("상장일 유통가능물량 45% 초과 — 첫날 매도 물량 많음"); capAt("light"); }
    if (val("lock") != null && val("lock") < 3 && val("inst") != null && val("inst") < 500) { flags.push("확약도 기관 수요도 약함"); capAt("light"); }
    if (it.spac) {
      return { rows, total: null, wKnown, verdict: { key: "spac", label: "스팩", tip: "합병 전까지 원금 보존형에 가까움 — 점수를 매기지 않음" }, flags: [], pending: false };
    }
    // 기관경쟁률·확약을 둘 다 모르면(= 수요예측 전) 나머지 값이 채워져도 판정하지 않는다
    if (wKnown < 40 || (val("inst") == null && val("lock") == null)) {
      return { rows, total, wKnown, verdict: { key: "wait", label: "판단 보류", tip: "수요예측 결과(기관경쟁률·확약)가 나오면 판정합니다" }, flags, pending: true };
    }
    let v = VERDICTS.find((x) => total >= x.min);
    if (cap && ORDER.indexOf(v.key) < ORDER.indexOf(cap)) v = VERDICTS.find((x) => x.key === cap);
    return { rows, total, wKnown, verdict: v, flags, pending: false };
  }

  /** 기준일(asOf) 전 90일 안에 상장한 스팩 아닌 종목의 평균 시초가 수익률. 3곳 미만이면 null. */
  function temperature(items, asOf, days = 90) {
    if (!asOf) return null;
    const from = new Date(new Date(asOf + "T00:00:00Z") - days * 864e5).toISOString().slice(0, 10);
    const xs = items.filter((x) => !x.spac && x.list_date && x.list_date < asOf && x.list_date >= from && x.price && x.open);
    if (xs.length < 3) return null;
    return xs.reduce((a, x) => a + (x.open / x.price - 1) * 100, 0) / xs.length;
  }

  /** 균등 1인당 예상 주수 = 균등 물량 ÷ 청약 건수. 일반 청약 물량의 절반을 균등으로 본다. */
  function equalShares(generalShares, applicants) {
    if (!generalShares || !applicants) return null;
    return (generalShares * 0.5) / applicants;
  }

  const api = { FACTORS, VERDICTS, score, temperature, equalShares };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.IPOScore = api;
})(typeof self !== "undefined" ? self : this);
