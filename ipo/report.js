/* 공모주 캘린더 — 공모주린이 분석: 블로그 글처럼 '청약할까?'를 쉬운 말로 풀어 쓴 종목 리포트.
   데이터(ipo.json · corp.json)와 점수 규칙(score.js)만으로 자동으로 쓴다. 상세 창의 첫 탭.
   app.js 의 전역(scoreOf, corpNums, perMarket, listedSample, expectOf, uwRecord …)을 쓴다. */
"use strict";

(function () {
  const LV = { good: ["좋아요", "g"], mid: ["보통이에요", "m"], bad: ["아쉬워요", "b"], unk: ["아직 몰라요", "u"] };
  const dot = (lv) => `<span class="rl ${LV[lv][1]}" aria-hidden="true"></span>`;
  const badge = (lv) => `<span class="rbg ${LV[lv][1]}">${LV[lv][0]}</span>`;
  const sign = (v, d = 0) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(d)}%`;

  /** 지난 1년 상장 종목 중 조건에 맞는 곳의 시초가 성적 */
  function bucket(f) {
    const xs = listedSample(365).filter(f);
    if (xs.length < 3) return null;
    const rs = xs.map(openRet);
    return { n: xs.length, med: median(rs), below: Math.round(rs.filter((x) => x < 0).length / rs.length * 100), dbl: Math.round(rs.filter((x) => x >= 100).length / rs.length * 100) };
  }

  /** 꼭 보는 세 가지: 기관경쟁률 · 의무보유확약 · 유통가능물량 */
  function three(it, r) {
    const v = (k) => r.rows.find((x) => x.f.key === k)?.v ?? null;
    const inst = v("inst"), lock = v("lock"), fl = v("float");
    const fc = it.fc_start ? `${md(it.fc_start)}${it.fc_end && it.fc_end !== it.fc_start ? `~${md(it.fc_end)}` : ""}` : "";
    return [
      {
        k: "기관경쟁률", val: inst != null ? comp(inst) : "–",
        lv: inst == null ? "unk" : inst >= 1000 ? "good" : inst >= 300 ? "mid" : "bad",
        say: inst == null ? `기관 수요예측${fc ? `(${fc})` : ""}이 끝나면 나와요. 공모주에서 가장 먼저 보는 숫자예요.`
          : `기관들이 사겠다고 써 낸 양이 배정 물량의 <b>${nf.format(Math.round(inst))}배</b>라는 뜻이에요. ${inst >= 1000 ? "1,000:1을 넘으면 흔히 '흥행'이라고 불러요." : inst >= 300 ? "나쁘지 않지만 흥행이라 부르기엔 조금 모자라요(기준 1,000:1)." : inst >= 100 ? "기관 관심이 적은 편이에요. 첫날 공모가 아래로 시작하는 경우가 많아요." : "100:1이 안 되면 사실상 흥행 실패예요."}`,
      },
      {
        k: "의무보유확약", val: lock != null ? `${lock.toFixed(1)}%` : "–",
        lv: lock == null ? "unk" : lock >= 15 ? "good" : lock >= 5 ? "mid" : "bad",
        say: lock == null ? "기관이 상장 뒤 일정 기간 안 팔겠다고 약속한 비율이에요. 수요예측 결과와 같이 나와요."
          : `기관 물량 중 <b>${lock.toFixed(1)}%</b>가 상장 뒤 15일~6개월 동안 팔지 않기로 약속했어요. ${lock >= 15 ? "높을수록 첫날 쏟아지는 물량이 적어 좋아요." : lock >= 5 ? "보통 수준이에요. 15%를 넘으면 좋게 봐요." : "약속한 기관이 거의 없어서, 상장 첫날 기관 매도가 많을 수 있어요."}`,
      },
      {
        k: "유통가능물량", val: fl != null ? `${fl.toFixed(1)}%` : "–",
        lv: fl == null ? "unk" : fl <= 25 ? "good" : fl <= 40 ? "mid" : "bad",
        say: fl == null ? "상장 첫날 바로 팔 수 있는 주식 비율이에요. 증권신고서에 나오고, 낮을수록 좋아요(30% 아래면 가볍다고 봐요)."
          : `상장 첫날 바로 팔 수 있는 주식이 전체의 <b>${fl.toFixed(1)}%</b>예요. ${fl <= 25 ? "물량이 가벼워 가격이 오르기 쉬운 편이에요." : fl <= 40 ? "보통이에요. 30% 아래면 가볍다고 봐요." : "물량이 많아 첫날 매도 압력이 클 수 있어요."}`,
      },
    ];
  }

  function company(it) {
    const c = it.corp, out = [];
    if (c?.biz) {
      const s = c.biz.replace(/^당사는\s*/, "이 회사는 ").split(/(?<=다\.)\s/)[0];
      out.push(esc(s.length > 150 ? `${s.slice(0, 148)}…` : s));
    } else if (it.sector) out.push(`업종은 <b>${esc(it.sector)}</b>이에요.`);
    const n = c ? corpNums(it) : null;
    if (n) {
      const bits = [];
      if (n.sales != null) bits.push(`매출 <b>${bm(n.sales)}</b>`);
      if (n.op != null) bits.push(`영업이익 <b class="${cls(n.op)}">${n.op < 0 ? "−" : ""}${bm(Math.abs(n.op))}</b>`);
      if (bits.length) out.push(`${esc(n.year && n.year !== "최근" ? `${n.year}년` : "최근")} ${bits.join(", ")}${n.ni != null ? `으로 <b>${n.ni > 0 ? "흑자" : "적자"}</b>예요` : "이에요"}.${n.growth != null ? ` 매출은 한 해 전보다 ${n.growth >= 0 ? `${n.growth.toFixed(0)}% 늘었어요` : `${Math.abs(n.growth).toFixed(0)}% 줄었어요`}.` : ""}`);
      if (n.ni != null && n.ni <= 0 && /기술|특례|성장/.test(c.kind || "")) out.push("아직 적자인 <b>기술특례 상장</b>이에요. 몸값이 앞으로의 실적 추정에 기대고 있어서, 오래 들고 가기엔 위험이 커요.");
    }
    if (c?.own?.group != null && c.own.group < 30) out.push(`최대주주 쪽 지분이 ${c.own.group.toFixed(0)}%로 낮은 편이에요.`);
    return out;
  }

  function price(it, r) {
    const out = [], p = offerPrice(it);
    if (it.price && it.band_hi && it.band_lo) {
      if (it.price > it.band_hi) out.push(["good", `공모가 <b>${won(it.price)}원</b>은 희망 밴드(${won(it.band_lo)}~${won(it.band_hi)}원) <b>위로</b> 정해졌어요. 기관이 더 비싸게라도 사고 싶어 했다는 뜻이에요.`]);
      else if (it.price === it.band_hi) out.push(["good", `공모가는 희망 밴드 <b>맨 위</b>(${won(it.price)}원)로 정해졌어요. 흥행한 종목에서 흔한 모습이에요.`]);
      else if (it.price < it.band_lo) out.push(["bad", `공모가를 희망 밴드 <b>아래로 낮춰</b>(${won(it.price)}원) 정했어요. 수요가 모자랐다는 신호예요.`]);
      else out.push(["mid", `공모가는 희망 밴드 안(${won(it.price)}원)에서 정해졌어요.`]);
    } else if (it.band_lo && it.band_hi) out.push(["unk", `희망 공모가는 <b>${won(it.band_lo)}~${won(it.band_hi)}원</b>이에요. 수요예측 뒤 이 범위 위쪽으로 정해질수록 좋은 신호예요.`]);
    const d = it.corp?.dem;
    if (d && d.top != null) {
      const t = (d.top || 0) + (d.over || 0);
      out.push([t >= 95 ? "good" : t >= 70 ? "mid" : "bad", `수요예측에 들어온 기관 수량의 <b>${t.toFixed(1)}%</b>가 밴드 상단 이상 가격을 써 냈어요.`]);
    }
    const n = it.corp ? corpNums(it) : null, pm = perMarket();
    if (n?.per && pm) {
      const med = median(pm.map((y) => y.n.per));
      out.push([n.per <= med ? "good" : n.per >= med * 1.8 ? "bad" : "mid", `공모가로 계산한 PER은 <b>${n.per.toFixed(1)}배</b>예요. 지난 1년 공모주 중간값(${med.toFixed(1)}배)보다 ${n.per <= med ? "싸게" : "비싸게"} 나왔어요. 다만 공모주 첫날 수익률은 몸값보다 수요(경쟁률·확약)에 더 좌우돼요.`]);
    } else if (n && n.ni != null && n.ni <= 0) out.push(["mid", "적자라서 PER(이익 대비 몸값)로는 비싼지 따질 수 없어요."]);
    const o = it.corp?.otc;
    if (o?.ask && p) {
      const prem = (o.ask / p - 1) * 100;
      if (prem > -40) out.push([prem >= 30 ? "good" : prem >= 0 ? "mid" : "bad", `장외에서 팔겠다는 가격(${won(o.ask)}원)은 공모가보다 <b>${sign(prem)}</b>예요. 몇 건 안 되는 개인 거래라 참고만 하세요.`]);
    }
    return out;
  }

  function supply(it, r) {
    const out = [];
    const sz = r.rows.find((x) => x.f.key === "size")?.v, old = r.rows.find((x) => x.f.key === "old")?.v;
    if (sz != null) out.push([sz <= 300 ? "good" : sz <= 1000 ? "mid" : "bad", `공모 규모는 <b>${eok(sz)}</b>이에요. ${sz <= 300 ? "가벼운 편이라 적은 매수세로도 가격이 잘 움직여요." : sz <= 1000 ? "중간 크기예요." : "덩치가 커서 첫날 크게 오르기는 어려운 편이에요."}`]);
    if (old != null) out.push([old <= 0.5 ? "good" : old <= 30 ? "mid" : "bad", old <= 0.5 ? "모두 <b>새로 찍는 주식(신주)</b>이라 공모 자금이 전부 회사로 들어가요." : `공모 주식의 <b>${old.toFixed(0)}%</b>는 기존 주주가 파는 주식(구주매출)이에요. 많을수록 '이번에 팔고 나가려는' 신호로 봐요.`]);
    const lk = it.corp?.dem?.lock;
    if (lk) {
      const long = (lk["3m"] || 0) + (lk["6m"] || 0);
      out.push([long >= 10 ? "good" : "mid", `확약 기간은 15일 ${(lk["15d"] || 0).toFixed(1)}% · 1개월 ${(lk["1m"] || 0).toFixed(1)}% · 3개월 ${(lk["3m"] || 0).toFixed(1)}% · 6개월 ${(lk["6m"] || 0).toFixed(1)}%예요. 15일·1개월 확약이 풀리는 날 전후로 주가가 흔들리기 쉬워요.`]);
    }
    return out;
  }

  function history(it, r) {
    const out = [];
    const inst = r.rows.find((x) => x.f.key === "inst")?.v, lock = r.rows.find((x) => x.f.key === "lock")?.v;
    if (inst != null) {
      const t = INST_T.find((x) => inT(inst, x));
      const b = t && bucket((x) => inT(x.inst_comp, t));
      const lab = t[1] === Infinity ? `${nf.format(t[0])}:1 이상` : t[0] === 0 ? `${t[1]}:1 미만` : `${nf.format(t[0])}~${nf.format(t[1])}:1`;
      if (b) out.push(`지난 1년 기관경쟁률이 <b>${lab}</b>이던 ${b.n}곳은 시초가 중간값이 <b class="${cls(b.med)}">${sign(b.med)}</b>였고, ${b.below}%는 공모가 아래로 시작했어요.`);
    }
    if (inst != null && lock != null) {
      const ti = INST_T.find((x) => inT(inst, x)), tl = LOCK_T.find((x) => inT(lock, x));
      const b = ti && tl && bucket((x) => inT(x.inst_comp, ti) && inT(x.lockup, tl));
      if (b) out.push(`확약 비율까지 비슷했던 ${b.n}곳만 보면 중간값 <b class="${cls(b.med)}">${sign(b.med)}</b>, 따블(+100%) 이상이 ${b.dbl}%였어요.`);
    }
    const e = expectOf(it);
    if (e) out.push(`판정이 같았던('${esc(e.label)}') ${e.n}곳의 시초가 중간값으로 계산하면 균등 1주에 <b class="${cls(e.won)}">${e.won >= 0 ? "+" : "−"}${won(Math.abs(e.won))}원</b> 정도예요(수수료 뺀 값).`);
    const u = uwRecord(it);
    if (u) out.push(`대표 주관사 <b>${esc(u.name)}</b>가 지난 1년 맡은 ${u.n}곳의 시초가 평균은 <b class="${cls(u.avg)}">${sign(u.avg)}</b>예요${u.n < 3 ? "(표본이 적어요)" : ""}.`);
    const temp = SC.temperature(ITEMS, addDays(TODAY, 1));
    if (temp != null) out.push(`요즘 공모주 시장은 ${temp >= 100 ? "<b>뜨거워요</b>" : temp >= 50 ? "<b>따뜻한 편</b>이에요" : temp >= 0 ? "<b>미지근해요</b>" : "<b>차가워요</b>"} — 최근 90일 상장 종목의 시초가가 평균 ${sign(temp)}였어요.`);
    return out;
  }

  function plan(it, r) {
    const s = stage(it).key, k = r.verdict.key, p = offerPrice(it);
    const minQ = numOf("cMin") || 10, mg = (numOf("cMargin") ?? 50) / 100;
    const dep = p ? won(p * minQ * mg) : null;
    const out = [];
    const how = {
      strong: `균등 최소 ${minQ}주(증거금 ${dep}원)는 꼭 넣고, 여유 자금이 있으면 <b>비례</b>도 생각해 볼 만해요. 가족 계좌가 있으면 계좌마다 균등을 노리세요.`,
      go: `<b>균등 위주</b>로 참여할 만해요. 최소 ${minQ}주(증거금 ${dep}원)로 균등 1주를 노리고, 비례에 큰돈을 넣는 건 신중하게.`,
      light: `<b>최소 주수만</b> 넣어 균등 1~2주를 노리는 정도가 좋아요(증거금 ${dep}원). 비례는 권하지 않아요.`,
      pass: `<b>건너뛰어도</b> 괜찮은 숫자예요. 그래도 넣는다면 최소 주수만, 첫날 공모가 아래로 시작할 수도 있다는 걸 알고 넣으세요.`,
      wait: `아직 판단할 숫자가 없어요. 수요예측 결과가 나오면 다시 보세요. 보통 <b>기관경쟁률 500:1 이상 · 확약 10% 이상</b>이면 참여 쪽, 100:1 아래면 건너뛰는 블로거가 많아요.`,
    };
    if (s === "pre" || s === "fc" || s === "sub") {
      out.push(["청약 방법", how[k] || how.wait]);
      if (it.uw.length) out.push(["어느 증권사로", `${it.uw.map((u) => `<b>${esc(u)}</b>`).join(", ")}에서 청약할 수 있어요.${it.uw.length > 1 ? " 균등은 청약하는 사람이 적은 증권사가 유리해서, 마감날 오전에 증권사별 경쟁률을 보고 고르는 게 요령이에요." : ""} 계좌가 없다면 '도구 → 계좌 준비'를 보세요(계좌를 만들면 20영업일 동안 다른 계좌를 못 만들어요).`]);
      out.push(["일정", `청약 ${it.sub_start ? `${mdw(it.sub_start)}${it.sub_end && it.sub_end !== it.sub_start ? `~${mdw(it.sub_end)}` : ""}` : "미정"} 10~16시 · 환불 ${it.refund ? mdw(it.refund) : "미정"} · 상장 ${it.list_date ? mdw(it.list_date) : "미정"}. 마감날 16시를 넘기면 청약이 안 돼요.`]);
    }
    if (s !== "past" && k !== "spac") {
      const lock = r.rows.find((x) => x.f.key === "lock")?.v, fl = r.rows.find((x) => x.f.key === "float")?.v;
      const both = listedSample(365).filter((x) => x.close1);
      const up = both.length ? Math.round(both.filter((x) => x.close1 > x.open).length / both.length * 100) : null;
      const heavy = (lock != null && lock < 5) || (fl != null && fl > 40);
      out.push(["팔 때는", `${heavy ? "확약이 적거나 풀리는 물량이 많아 <b>시초가 근처에서 나눠 파는</b> 쪽이 안전해요." : "흥행한 종목은 장 초반에 더 오르기도 해서, <b>절반은 시초가 · 절반은 오전 중</b>처럼 나눠 파는 블로거가 많아요."}${up != null ? ` 지난 1년 종가가 시초가보다 높았던 곳은 ${up}%뿐이었어요.` : ""} 상장날 08:30~08:40 장전 주문으로 미리 걸어 둘 수도 있어요.`]);
    }
    return out;
  }

  function conclusion(it, r) {
    const k = r.verdict.key, s = stage(it).key;
    if (k === "spac") return "스팩은 합병 전까지 공모가(보통 2,000원) 근처에서 움직여 큰 수익도 손실도 드물어요.";
    if (r.pending) return `수요예측 결과(${it.fc_start ? `${md(it.fc_start)}~${md(it.fc_end || it.fc_start)}` : "날짜 미정"})를 보고 정해요.`;
    const head = { strong: "적극 참여할 만해요", go: "참여할 만해요", light: "균등만 가볍게", pass: "이번엔 쉬어 가도 돼요" }[k];
    if (s === "listed" || s === "past") return `청약 당시 판정은 '${r.verdict.label}'(${r.total}점)이었어요.`;
    return `${head} — ${r.total}점`;
  }

  function reportCard(it) {
    const r = scoreOf(it);
    const t3 = three(it, r), co = company(it), pr = price(it, r), su = supply(it, r), hi = history(it, r), pl = plan(it, r);
    const goods = [...pr, ...su].filter(([lv]) => lv === "good").length + t3.filter((x) => x.lv === "good").length;
    const bads = [...pr, ...su].filter(([lv]) => lv === "bad").length + t3.filter((x) => x.lv === "bad").length;
    const li = (xs) => xs.map(([lv, t]) => `<li>${dot(lv)}<span>${t}</span></li>`).join("");
    const sec = (n, t, body) => (body ? `<section class="rp-s"><h4><span class="rp-n">${n}</span>${t}</h4>${body}</section>` : "");
    let i = 0;
    const num = () => ["①", "②", "③", "④", "⑤", "⑥", "⑦"][i++];
    const p = it.list_date && it.open && it.price ? (it.open / it.price - 1) * 100 : null;
    return `<article class="card pad rp v-${r.verdict.key}" id="dRep">
      <div class="rp-tag"><span>공모주린이 분석</span><small>숫자로 자동 작성 · ${md(TODAY)} 기준</small></div>
      <h3 class="rp-q">${esc(it.name)}, 청약할까요?</h3>
      <div class="rp-a"><b>${esc(conclusion(it, r))}</b>${!r.pending && r.verdict.key !== "spac" ? `<small>좋은 신호 ${goods}개 · 아쉬운 신호 ${bads}개${r.flags.length ? ` · 주의 ${r.flags.length}개` : ""}</small>` : ""}
        ${p != null ? `<small>실제 결과: 시초가 <b class="${cls(p)}">${sign(p, 1)}</b>${it.close1 ? ` · 첫날 종가 ${sign((it.close1 / it.price - 1) * 100, 1)}` : ""}</small>` : ""}</div>
      ${r.flags.length ? `<ul class="rp-flags">${r.flags.map((f) => `<li>${ico("alert", "sm")}${esc(f)}</li>`).join("")}</ul>` : ""}
      ${sec(num(), "꼭 보는 숫자 세 가지", `<ul class="rp-3">${t3.map((x) => `<li class="${LV[x.lv][1]}"><div class="rp-3h">${dot(x.lv)}<b>${x.k}</b><span class="num">${x.val}</span>${badge(x.lv)}</div><p>${x.say}</p></li>`).join("")}</ul>`)}
      ${sec(num(), "어떤 회사예요?", co.length ? `<p>${co.join(" ")}</p>` : "")}
      ${sec(num(), "공모가, 비싼가요?", pr.length ? `<ul class="rp-l">${li(pr)}</ul>` : "")}
      ${sec(num(), "상장날 풀리는 물량", su.length ? `<ul class="rp-l">${li(su)}</ul>` : "")}
      ${sec(num(), "비슷했던 종목은 어땠나요?", hi.length ? `<ul class="rp-l plain">${hi.map((t) => `<li>${t}</li>`).join("")}</ul>` : "")}
      ${sec(num(), "그래서 어떻게 할까요?", pl.length ? `<dl class="rp-plan">${pl.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>` : "")}
      <p class="hint mt12">블로거들이 흔히 보는 기준으로 데이터를 읽어 자동으로 쓴 글이에요. 수익을 보장하지 않으며 투자 권유가 아니에요. 청약 전 증권사 공지와 투자설명서를 꼭 확인하세요.</p>
    </article>`;
  }

  /** 스토리·검색 등에서 쓰는 한 줄 */
  const oneLine = (it) => conclusion(it, scoreOf(it));
  self.REPORT = { reportCard, oneLine, three: (it) => three(it, scoreOf(it)) };
})();
