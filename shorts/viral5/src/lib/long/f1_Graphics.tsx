// Drawn graphics for the Odyssey documentary: the 10-year bar, the Cyclops' prayer as a four-line checklist,
// quote cards, the shrinking fleet, the olive-tree bed, and the title and end cards. Each takes the absolute
// time t and its shot, so a frame is a pure function of time.
import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { BODY, TITLE } from "../fonts";
import { clamp, eBack, eInOut, eOut, lerp, prog } from "../fx";
import type { F1Shot } from "./f1_types";

const INK = "#F6EBD2", GOLD = "#F2C66D", DIM = "#6f6a5e";
const SEA = "#5b93b5", CIRCE = "#a479be", CALYPSO = "#d9aa4a";

/** a dark, slightly textured backdrop for cards and diagrams */
export const Backdrop: React.FC<{ img?: string; t: number }> = ({ img = "nuijen_storm", t }) => (
  <AbsoluteFill style={{ background: "#07090b", overflow: "hidden" }}>
    <Img src={staticFile(`odyssey/img/${img}.jpg`)} style={{ position: "absolute", left: -80, top: -80, width: 2080, height: 1240, objectFit: "cover",
      filter: "blur(26px) brightness(.28) saturate(.6)", transform: `scale(${1 + 0.01 * Math.sin(t / 5)})` }} />
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 30%, rgba(0,0,0,.75) 100%)" }} />
  </AbsoluteFill>
);

/** the ten years as ten cells: sea, Circe's year, sea, Calypso's seven */
export const Years: React.FC<{ s: F1Shot; t: number }> = ({ s, t }) => {
  const lt = t - s.t0;
  const kind = (i: number) => (i === 1 ? "circe" : i >= 3 ? "calypso" : "sea");
  const col = { sea: SEA, circe: CIRCE, calypso: CALYPSO };
  const hl = s.hl ?? null;
  const lit = (k: string) =>
    hl === null || hl === k || (hl === "islands" && k !== "sea");
  const cw = 132, gap = 14, x0 = (1920 - (10 * cw + 9 * gap)) / 2, y0 = 470;
  const big =
    hl === "islands" ? "8년" : hl === "sea" ? "2년 남짓" : hl === "circe" ? "1년" : hl === "calypso" ? "7년" : hl === "poem" ? "6주" : "10년";
  const bigCol = hl === "islands" || hl === "calypso" ? CALYPSO : hl === "circe" ? CIRCE : hl === "sea" ? SEA : INK;
  const sub =
    hl === "islands" ? "두 섬에서 보낸 시간" : hl === "sea" ? "괴물과 폭풍을 다 합친 시간" : hl === "circe" ? "키르케의 집" : hl === "calypso" ? "칼립소의 섬" : hl === "poem" ? "시가 직접 보여 주는 시간" : "트로이에서 이타카까지";
  return (
    <AbsoluteFill>
      <Backdrop t={t} />
      <div style={{ position: "absolute", top: 170, width: "100%", textAlign: "center", opacity: clamp(prog(lt, 0.1, 0.4)) }}>
        <div style={{ fontFamily: TITLE, fontSize: 132, color: bigCol, textShadow: "0 4px 18px #000", transform: `scale(${0.9 + 0.1 * eBack(prog(lt, 0.1, 0.5))})` }}>{big}</div>
        <div style={{ fontFamily: BODY, fontWeight: 800, fontSize: 38, color: "#e6dcc3", marginTop: 4 }}>{sub}</div>
      </div>
      {Array.from({ length: 10 }, (_, i) => {
        const k = kind(i);
        const a = eOut(prog(lt, 0.15 + i * 0.07, 0.35));
        const on = hl === "poem" ? false : lit(k);
        return (
          <div key={i} style={{ position: "absolute", left: x0 + i * (cw + gap), top: y0 + 30 * (1 - a), width: cw, height: 150, borderRadius: 14, opacity: a,
            background: on ? col[k] : "#2a2925", boxShadow: on ? `0 0 28px ${col[k]}66` : "none", border: `2px solid ${on ? "#0008" : "#4a463d"}` }}>
            <div style={{ position: "absolute", bottom: 10, width: "100%", textAlign: "center", fontFamily: BODY, fontWeight: 800, fontSize: 26, color: on ? "#111" : DIM }}>{i + 1}년</div>
          </div>
        );
      })}
      {hl === "poem" ? (
        <div style={{ position: "absolute", left: x0 + 9 * (cw + gap) + cw - 16, top: y0 - 14, width: 16, height: 178, background: GOLD, borderRadius: 4, opacity: clamp(prog(lt, 0.9, 0.4)), boxShadow: `0 0 24px ${GOLD}` }} />
      ) : null}
      <div style={{ position: "absolute", top: y0 + 180, width: "100%", display: "flex", justifyContent: "center", gap: 48, fontFamily: BODY, fontWeight: 700, fontSize: 30, opacity: clamp(prog(lt, 0.9, 0.5)) }}>
        {([["바다 위", SEA], ["키르케의 집 (1년)", CIRCE], ["칼립소의 섬 (7년)", CALYPSO]] as const).map(([n, c]) => (
          <div key={n} style={{ display: "flex", alignItems: "center", gap: 12, color: "#e6dcc3" }}>
            <span style={{ width: 26, height: 26, borderRadius: 6, background: c, display: "inline-block" }} />{n}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

const CURSE = ["늦게", "동료를 모두 잃고", "남의 배를 타고", "집에서 재앙을 만나게"];

/** the Cyclops' prayer to Poseidon: a header line and four conditions that get ticked off as they come true */
export const Curse: React.FC<{ s: F1Shot; t: number }> = ({ s, t }) => {
  const lt = t - s.t0;
  const n = typeof s.show === "number" ? s.show : 4;
  const fresh = !s.done && !s.half && !s.echo && !s.loophole && !s.remember;
  return (
    <AbsoluteFill>
      <Backdrop img="tvt_rock_throw" t={t} />
      <div style={{ position: "absolute", left: 300, top: 120, right: 300 }}>
        <div style={{ fontFamily: BODY, fontWeight: 800, fontSize: 30, color: "#bfae86", letterSpacing: 2 }}>
          {s.echo ? "테이레시아스의 예언 — 거인의 기도와 같다" : "폴리페모스가 포세이돈에게 한 기도"}
        </div>
        <div style={{ fontFamily: TITLE, fontSize: 56, color: INK, marginTop: 14, lineHeight: 1.25 }}>
          그가 끝내 집에 가지 못하게.{" "}
          <span style={{ color: s.loophole ? GOLD : INK, background: s.loophole ? `rgba(242,198,109,${0.18 * eOut(prog(lt, 0.4, 0.6))})` : "none", borderRadius: 8, padding: "0 6px" }}>
            그래도 꼭 돌아가야 한다면,
          </span>
        </div>
        <div style={{ marginTop: 34 }}>
          {CURSE.map((c, i) => {
            if (i >= n) return null;
            const appear = fresh && i === n - 1 ? eOut(prog(lt, 0.05, 0.4)) : 1;
            const done = (s.done ?? []).includes(i + 1), half = (s.half ?? []).includes(i + 1);
            const newDone = done && (s.done ?? [])[(s.done ?? []).length - 1] === i + 1;
            const tick = done ? (newDone ? eBack(prog(lt, 0.5, 0.45)) : 1) : half ? eBack(prog(lt, 0.5, 0.45)) : 0;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 28, marginBottom: 22, opacity: appear, transform: `translateX(${-40 * (1 - appear)}px)` }}>
                <div style={{ width: 78, height: 78, borderRadius: 14, border: `4px solid ${done ? GOLD : "#8d8470"}`, position: "relative", flex: "none" }}>
                  {tick > 0 ? (
                    <svg width={78} height={78} style={{ position: "absolute", left: -4, top: -4, transform: `scale(${tick})` }}>
                      {half ? <path d="M18 40 L34 56" stroke={GOLD} strokeWidth={9} strokeLinecap="round" fill="none" />
                        : <path d="M18 40 L34 56 L62 22" stroke={GOLD} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" fill="none" />}
                    </svg>
                  ) : null}
                </div>
                <div style={{ fontFamily: BODY, fontWeight: 800, fontSize: 64, color: done ? GOLD : INK, textShadow: "0 3px 10px #000" }}>
                  <span style={{ color: "#a99d80", marginRight: 18 }}>{["첫째", "둘째", "셋째", "넷째"][i]}</span>{c}
                  {half ? <span style={{ fontSize: 34, color: "#cdbb8e", marginLeft: 20 }}>12척 → 1척</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** a quote or a one-line title on the dark backdrop */
export const Card: React.FC<{ s: F1Shot; t: number }> = ({ s, t }) => {
  const lt = t - s.t0;
  const a = eOut(prog(lt, 0.1, 0.6));
  const len = (s.text ?? "").length;
  return (
    <AbsoluteFill>
      <Backdrop t={t} img="zeeman_storm" />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", opacity: a, transform: `translateY(${16 * (1 - a)}px)` }}>
        <div style={{ fontFamily: TITLE, fontSize: len > 18 ? 76 : 112, color: INK, textAlign: "center", padding: "0 160px", lineHeight: 1.3, textShadow: "0 4px 18px #000" }}>{s.text}</div>
        {s.sub ? <div style={{ fontFamily: BODY, fontWeight: 800, fontSize: 40, color: GOLD, marginTop: 26 }}>{s.sub}</div> : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Ship: React.FC<{ x: number; y: number; o: number; sink: number }> = ({ x, y, o, sink }) => (
  <g transform={`translate(${x} ${y + 60 * sink}) rotate(${-24 * sink})`} opacity={o}>
    <path d="M-62 0 L62 0 L44 26 L-44 26 Z" fill="#c9a76a" stroke="#000" strokeWidth={3} />
    <path d="M0 -4 L0 -96" stroke="#e8dcc0" strokeWidth={5} />
    <path d="M6 -90 L52 -24 L6 -24 Z" fill="#efe4c8" stroke="#000" strokeWidth={2} />
    <path d="M-6 -80 L-42 -24 L-6 -24 Z" fill="#d8cba8" stroke="#000" strokeWidth={2} />
  </g>
);

/** twelve ships; eleven go under, one sails on */
export const Fleet: React.FC<{ s: F1Shot; t: number }> = ({ s, t }) => {
  const lt = t - s.t0;
  const from = s.from ?? 12;
  const sunk = (i: number) => (i === 7 ? 0 : eInOut(prog(lt, 1.0 + (i % 11) * 0.12, 0.9)));
  const count = Math.round(lerp(from, s.to ?? 1, clamp((lt - 1.0) / 2.2)));
  return (
    <AbsoluteFill>
      <Backdrop t={t} img="baur_storm" />
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        {Array.from({ length: from }, (_, i) => {
          const x = 330 + (i % 6) * 252, y = 420 + Math.floor(i / 6) * 230;
          const k = sunk(i);
          return <Ship key={i} x={x} y={y} o={1 - k} sink={k} />;
        })}
      </svg>
      <div style={{ position: "absolute", top: 120, width: "100%", textAlign: "center", fontFamily: TITLE, fontSize: 120, color: count === 1 ? GOLD : INK, textShadow: "0 4px 16px #000" }}>
        {count}척
      </div>
    </AbsoluteFill>
  );
};

/** the bed built round a living olive tree: the tree grows, the room is built round it, the trunk becomes the bedpost */
export const BedTree: React.FC<{ s: F1Shot; t: number }> = ({ s, t }) => {
  const lt = s.still ? 99 : t - s.t0;
  const grow = eInOut(prog(lt, 0.2, 1.8)), walls = eInOut(prog(lt, 1.8, 1.4)), cut = eInOut(prog(lt, 3.0, 1.2)), bed = eOut(prog(lt, 3.8, 1.2));
  const crown = 1 - cut;
  const len = (k: number, L: number) => ({ strokeDasharray: L, strokeDashoffset: L * (1 - k) });
  return (
    <AbsoluteFill>
      <Backdrop t={t} img="schelfhout_olive" />
      <svg width={1920} height={1080} style={{ position: "absolute" }}>
        {/* ground and roots */}
        <path d="M360 820 L1560 820" stroke="#8a7a5a" strokeWidth={4} />
        <g stroke="#b08d5a" strokeWidth={10} fill="none" strokeLinecap="round" style={len(grow, 420)}>
          <path d="M960 820 C 940 870, 880 900, 820 930" /><path d="M960 820 C 990 880, 1060 905, 1120 925" /><path d="M960 820 C 960 880, 965 930, 955 980" />
        </g>
        {/* trunk */}
        <path d="M940 820 C 930 700, 960 640, 945 560 L 975 560 C 990 640, 985 700, 980 820 Z" fill="#9b7748" stroke="#2a1d10" strokeWidth={4}
          transform={`translate(0 ${260 * (1 - grow)}) scale(1 ${grow})`} style={{ transformOrigin: "960px 820px" }} />
        {/* crown */}
        <g opacity={grow * crown}>
          {[[880, 470, 120], [1040, 460, 130], [960, 400, 140], [820, 540, 80], [1100, 540, 90]].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y + 40 * cut} r={r * grow} fill="#5d7247" stroke="#2c3a1f" strokeWidth={4} opacity={0.92} />
          ))}
        </g>
        {/* room walls built round the tree */}
        <g stroke={INK} strokeWidth={6} fill="none" style={len(walls, 1900)}>
          <path d="M560 820 L560 360 L1360 360 L1360 820" />
        </g>
        {/* bed frame on the cut trunk */}
        <g opacity={bed}>
          <rect x={640} y={640} width={420} height={70} rx={10} fill="#7a5530" stroke="#1d130a" strokeWidth={4} />
          <rect x={650} y={606} width={400} height={40} rx={12} fill="#c8b48a" stroke="#1d130a" strokeWidth={3} />
          <path d="M650 710 L650 820" stroke="#6a4626" strokeWidth={16} />
        </g>
      </svg>
      <div style={{ position: "absolute", left: 0, right: 0, top: 120, textAlign: "center", fontFamily: TITLE, fontSize: 64, color: INK, textShadow: "0 3px 12px #000", opacity: clamp(prog(lt, 0.3, 0.5)) }}>
        {lt < 3.0 ? "살아 있는 올리브나무" : "뿌리째 땅에 박힌 침대 기둥"}
      </div>
    </AbsoluteFill>
  );
};

export const TitleCard: React.FC<{ s: F1Shot; t: number; title: string }> = ({ s, t, title }) => {
  const lt = t - s.t0, dur = s.t1 - s.t0;
  const a = eOut(prog(lt, 0.2, 0.8)) * (1 - prog(lt, dur - 0.5, 0.5));
  const [q, rest] = title.includes("10년") ? [title.split("10년")[0], title.split("10년")[1]] : [title, ""];
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ overflow: "hidden", background: "#000" }}>
        <Img src={staticFile("odyssey/img/willaerts_wreck.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(.42)", transform: `scale(${1.08 + 0.02 * lt / dur})` }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: a }}>
        <div style={{ fontFamily: TITLE, fontSize: 92, color: INK, textAlign: "center", lineHeight: 1.25, textShadow: "0 5px 22px #000", padding: "0 140px" }}>
          {q}{rest ? <span style={{ color: GOLD }}>10년</span> : null}{rest}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const EndCard: React.FC<{ s: F1Shot; t: number; title: string }> = ({ s, t, title }) => {
  const lt = t - s.t0, dur = s.t1 - s.t0;
  const a = eOut(prog(lt, 0.3, 1.0)) * (1 - prog(lt, dur - 0.8, 0.8));
  return (
    <AbsoluteFill style={{ background: "#000", alignItems: "center", justifyContent: "center", flexDirection: "column", opacity: a }}>
      <div style={{ fontFamily: TITLE, fontSize: 64, color: INK }}>{title}</div>
      <div style={{ fontFamily: BODY, fontWeight: 700, fontSize: 28, color: "#a39a85", marginTop: 26 }}>그림 출처와 인용 문헌은 설명란에 있습니다</div>
    </AbsoluteFill>
  );
};

export { lerp };
