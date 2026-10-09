// Graphic clips: numbers, comparisons and cards drawn here instead of footage, so an explainer short can be made
// from our own graphics. A graphic fills its clip's frame box (default: the 1080×1080 square under the title band).
// Every piece is a pure function of t, the time since the clip started, and of `steps`: moments (seconds since the clip
// started) that prep.py turns from narration anchors in edit.json, so each reveal lands on the word that announces it.
// Without steps the reveals run on a default stagger. In any text, [bracketed] words are set in yellow.
import React from "react";
import { fitText } from "@remotion/layout-utils";
import { BODY, TITLE } from "./fonts";
import { clamp, eBack, eInOut, eOut, lerp, prog } from "./fx";

type Bar = { label: string; value: number; text?: string; color?: string; emoji?: string };
type Side = { label: string; value?: string; emoji?: string; color?: string };
export type Gfx = { steps?: number[] } & (
  /** a number counting up to `to` (kr: Korean units, 140000000 → "1억 4,000만"); steps[0] starts the count */
  | { type: "counter"; to: number; from?: number; dur?: number; unit?: string; prefix?: string; label?: string; sub?: string; emoji?: string; kr?: boolean; decimals?: number; color?: string }
  /** horizontal bars growing to scale; steps[i] brings in bar i; `hi` is the bar to highlight */
  | { type: "bars"; items: Bar[]; title?: string; hi?: number }
  /** a grid that fills with n units (emoji, or dots past 1,500) — "if one grain is 1억"; steps[0] starts the fill */
  | { type: "units"; emoji: string; n: number; dur?: number; per?: string; label?: string; total?: string; zoom?: boolean }
  /** a card of big lines, one per step (news summary, a statement); an optional badge such as "긴급정리" on top */
  | { type: "text"; lines: string[]; badge?: string; emoji?: string; align?: "left" | "center"; size?: number }
  /** a verdict stamp: O (true), X (false) or △ (half true) drawn in at steps[0], with a line under it */
  | { type: "ox"; verdict: "O" | "X" | "△"; text: string; sub?: string }
  /** two sides face off; steps: [left, right, winner] */
  | { type: "vs"; left: Side; right: Side; win?: "left" | "right"; title?: string }
  /** a ranking card: the place slams in, then its name */
  | { type: "rank"; n: number; text: string; emoji?: string; sub?: string; color?: string }
  /** a question with choices, a countdown ring, then the answer lights up; steps: [count starts, answer] */
  | { type: "quiz"; q: string; options: string[]; answer: number; count?: number }
);

const KEY = "#FFE14D", RED = "#FF3B3B", GREEN = "#2BD46B", ORANGE = "#FF9F1C";
const PALETTE = ["#4DA3FF", "#FF5C7A", "#2BD46B", "#FFB020", "#B07CFF"];
const STROKE = (w: number): React.CSSProperties => ({ WebkitTextStroke: `${w}px black`, paintOrder: "stroke" });

/** text with [key] words in yellow (or `color`) */
export const Marked: React.FC<{ text: string; color?: string }> = ({ text, color = KEY }) => (
  <>
    {text.split(/(\[[^\]]*\])/).map((p, i) =>
      p.startsWith("[") ? <span key={i} style={{ color }}>{p.slice(1, -1)}</span> : <React.Fragment key={i}>{p}</React.Fragment>,
    )}
  </>
);
const plain = (s: string) => s.replace(/[[\]]/g, "");
const fit = (text: string, max: number, width = 960, font = TITLE, weight?: string) =>
  Math.min(max, fitText({ text: plain(text) || " ", withinWidth: width, fontFamily: font, fontWeight: weight }).fontSize);

const KR_UNITS = [[1e12, "조"], [1e8, "억"], [1e4, "만"], [1, ""]] as const;
/** the two leading Korean units of n, with the place value of each */
const krParts = (n: number) => {
  let rest = Math.round(n);
  const out: { q: number; u: number; name: string }[] = [];
  for (const [u, name] of KR_UNITS) {
    const q = Math.floor(rest / u);
    if (q && out.length < 2) out.push({ q, u, name });
    rest -= q * u;
  }
  return out.length ? out : [{ q: 0, u: 1, name: "" }];
};
/** Korean big-number style, the two leading units: 140000000 → "1억 4,000만", 17_000_000_000_000 → "17조" */
export const krNum = (n: number) => krParts(n).map((p) => p.q.toLocaleString("en-US") + p.name).join(" ");

/** pop-in scale and opacity for something that appears at t0 */
const popIn = (t: number, t0: number, d = 0.32) => ({ s: eBack(prog(t, t0, d), 2.2), o: clamp(prog(t, t0, d) * 3) });
/** slide-up entrance */
const rise = (t: number, t0: number, d = 0.3) => ({ y: 40 * (1 - eOut(prog(t, t0, d))), o: prog(t, t0, d * 0.8) });

const Counter: React.FC<{ g: Extract<Gfx, { type: "counter" }>; t: number }> = ({ g, t }) => {
  const t0 = g.steps?.[0] ?? 0.2, d = g.dur ?? 1.2;
  const v = lerp(g.from ?? 0, g.to, eOut(prog(t, t0, d)));
  const dec = g.decimals ?? 0;
  const parts = krParts(g.to), step = parts[parts.length - 1].u;  // count in the smallest unit the final figure shows
  const num = g.kr ? krNum(Math.round(v / step) * step) : v.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const final = g.kr ? krNum(g.to) : g.to.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const land = prog(t, t0 + d, 0.3), s = 1 + 0.1 * Math.sin(Math.PI * land);
  const size = fit(`${g.prefix ?? ""}${final}${g.unit ?? ""}`, 230, 980);
  const e = popIn(t, 0);
  return (
    <Center>
      {g.emoji ? <div style={{ fontSize: 190, lineHeight: 1, transform: `scale(${e.s})`, marginBottom: 20 }}>{g.emoji}</div> : null}
      {g.label ? <div style={{ fontFamily: BODY, fontWeight: 900, fontSize: fit(g.label, 64, 960, BODY, "900"), color: "white", opacity: e.o, ...STROKE(10) }}><Marked text={g.label} /></div> : null}
      <div style={{ fontFamily: TITLE, fontSize: size, lineHeight: 1.1, color: g.color ?? KEY, transform: `scale(${s})`, whiteSpace: "nowrap", ...STROKE(18),
        filter: "drop-shadow(0 10px 18px rgba(0,0,0,.55))", opacity: prog(t, t0 - 0.05, 0.1) }}>
        {g.prefix}{num}<span style={{ fontSize: size * 0.55 }}>{g.unit}</span>
      </div>
      {g.sub ? <div style={{ fontFamily: BODY, fontWeight: 800, fontSize: fit(g.sub, 48, 940, BODY, "800"), color: "rgba(255,255,255,.85)", marginTop: 18, opacity: prog(t, t0 + d, 0.3), ...STROKE(8) }}><Marked text={g.sub} /></div> : null}
    </Center>
  );
};

const Bars: React.FC<{ g: Extract<Gfx, { type: "bars" }>; t: number }> = ({ g, t }) => {
  const max = Math.max(...g.items.map((b) => b.value)) || 1;
  const n = g.items.length, rowH = Math.min(220, (g.title ? 860 : 960) / n);
  return (
    <div style={{ position: "absolute", inset: "60px 60px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 0 }}>
      {g.title ? <div style={{ fontFamily: TITLE, fontSize: fit(g.title, 76), color: "white", textAlign: "center", marginBottom: 30, ...STROKE(12) }}><Marked text={g.title} /></div> : null}
      {g.items.map((b, i) => {
        const t0 = g.steps?.[i] ?? 0.25 + 0.45 * i;
        const k = eOut(prog(t, t0, 0.7)), r = rise(t, t0, 0.25);
        const color = b.color ?? (g.hi === i ? RED : PALETTE[i % PALETTE.length]);
        const hi = g.hi === i && prog(t, t0 + 0.7, 0.2) > 0;
        const w = Math.max(16, 960 * 0.74 * (b.value / max) * k);
        return (
          <div key={i} style={{ height: rowH, display: "flex", flexDirection: "column", justifyContent: "center", opacity: r.o, transform: `translateY(${r.y}px)` }}>
            <div style={{ fontFamily: BODY, fontWeight: 900, fontSize: Math.min(54, rowH * 0.3), color: "white", marginBottom: 10, ...STROKE(8) }}>
              {b.emoji ? <span style={{ WebkitTextStroke: 0, marginRight: 12 }}>{b.emoji}</span> : null}<Marked text={b.label} />
            </div>
            <div style={{ display: "flex", alignItems: "center" }}>
              <div style={{ width: w, height: Math.min(92, rowH * 0.42), borderRadius: 18, background: `linear-gradient(90deg, ${color}, ${color}cc)`,
                border: "5px solid #111", boxShadow: hi ? `0 0 0 6px ${KEY}, 0 0 40px ${KEY}` : "6px 6px 0 #111" }} />
              <div style={{ fontFamily: TITLE, fontSize: Math.min(70, rowH * 0.36), color: hi ? KEY : "white", marginLeft: 22, opacity: prog(t, t0 + 0.35, 0.3), whiteSpace: "nowrap", ...STROKE(10) }}>
                {b.text ?? b.value.toLocaleString("en-US")}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const Units: React.FC<{ g: Extract<Gfx, { type: "units" }>; t: number; h: number }> = ({ g, t, h }) => {
  const t0 = g.steps?.[0] ?? 0.4, d = g.dur ?? 1.8;
  const W = 960, H = h - 380;
  const cols = Math.max(1, Math.ceil(Math.sqrt((g.n * W) / H))), rows = Math.ceil(g.n / cols);
  const cell = Math.min(W / cols, H / rows), gw = cols * cell, gh = rows * cell;
  const k = eInOut(prog(t, t0, d)), shown = Math.round(g.n * k);
  // zoom: start on the first unit, big in the middle of the area, and pull back to the whole grid as it fills; drawn at the
  // zoomed size (not scaled up afterwards) so the units stay sharp
  const zk = g.zoom ? eInOut(prog(t, t0, d * 1.1)) : 1, z0 = Math.max(1, Math.min(H, W) / 2.2 / cell);
  const z = lerp(z0, 1, zk), cz = cell * z;
  const ox = lerp(W / 2 - cz / 2, (W - gw) / 2, zk), oy = lerp(H / 2 - cz / 2, (H - gh) / 2, zk);
  const dots = g.n > 1500;
  const e = popIn(t, 0);
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ height: 160, display: "flex", alignItems: "center", fontFamily: BODY, fontWeight: 900, fontSize: fit(`${g.emoji} ${g.per ?? ""}`, 66, 960, BODY, "900"),
        color: "white", transform: `scale(${e.s})`, ...STROKE(10) }}>
        <span><span style={{ WebkitTextStroke: 0, marginRight: 14 }}>{g.emoji}</span><Marked text={g.per ?? ""} /></span>
      </div>
      <div style={{ width: W, height: H, position: "relative", overflow: "hidden", borderRadius: 20, background: "rgba(255,255,255,.06)", border: "3px solid rgba(255,255,255,.18)" }}>
        <div style={{ position: "absolute", left: ox, top: oy, width: gw * z, height: gh * z }}>
          {!dots ? (
            Array.from({ length: shown }, (_, i) => (
              <span key={i} style={{ position: "absolute", left: (i % cols) * cz, top: Math.floor(i / cols) * cz, width: cz, height: cz, fontSize: cz * 0.82,
                lineHeight: `${cz}px`, textAlign: "center" }}>{g.emoji}</span>
            ))
          ) : (
            <>
              {/* past 1,500, units become dots: full rows as one patterned block, the part row on its own */}
              <div style={{ position: "absolute", left: 0, top: 0, width: gw * z, height: Math.floor(shown / cols) * cz,
                backgroundImage: `radial-gradient(circle, ${KEY} 38%, transparent 42%)`, backgroundSize: `${cz}px ${cz}px` }} />
              <div style={{ position: "absolute", left: 0, top: Math.floor(shown / cols) * cz, width: (shown % cols) * cz, height: cz,
                backgroundImage: `radial-gradient(circle, ${KEY} 38%, transparent 42%)`, backgroundSize: `${cz}px ${cz}px` }} />
            </>
          )}
        </div>
      </div>
      <div style={{ height: 220, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <div style={{ fontFamily: TITLE, fontSize: 110, lineHeight: 1, color: KEY, ...STROKE(16) }}>× {shown.toLocaleString("en-US")}</div>
        {g.label || g.total ? (
          <div style={{ fontFamily: BODY, fontWeight: 900, fontSize: 50, color: "white", marginTop: 10, opacity: prog(t, t0 + d, 0.3), ...STROKE(9) }}>
            <Marked text={[g.label, g.total].filter(Boolean).join(" ")} />
          </div>
        ) : null}
      </div>
    </div>
  );
};

const TextCard: React.FC<{ g: Extract<Gfx, { type: "text" }>; t: number }> = ({ g, t }) => {
  const left = g.align === "left";
  const b = popIn(t, 0);
  return (
    <div style={{ position: "absolute", inset: "50px 60px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: left ? "flex-start" : "center" }}>
      {g.badge ? (
        <div style={{ fontFamily: BODY, fontWeight: 900, fontSize: 52, color: "#111", background: KEY, border: "5px solid #111", borderRadius: 16, padding: "8px 26px",
          boxShadow: "7px 7px 0 #111", transform: `scale(${b.s}) rotate(-2deg)`, opacity: b.o, marginBottom: 40 }}>{g.badge}</div>
      ) : null}
      {g.emoji ? <div style={{ fontSize: 170, lineHeight: 1, transform: `scale(${b.s})`, marginBottom: 26 }}>{g.emoji}</div> : null}
      {g.lines.map((line, i) => {
        const r = rise(t, g.steps?.[i] ?? 0.15 + 0.55 * i);
        const size = g.size ?? Math.max(66, fit(line, 104, 960, BODY, "900"));
        return (
          <div key={i} style={{ fontFamily: BODY, fontWeight: 900, fontSize: size, lineHeight: 1.22, color: "white", textAlign: left ? "left" : "center", letterSpacing: -1,
            margin: "10px 0", opacity: r.o, transform: `translateY(${r.y}px)`, ...STROKE(12) }}>
            <Marked text={line} />
          </div>
        );
      })}
    </div>
  );
};

const OX: React.FC<{ g: Extract<Gfx, { type: "ox" }>; t: number }> = ({ g, t }) => {
  const t0 = g.steps?.[0] ?? 0.25;
  const draw = eOut(prog(t, t0, 0.4)), slam = lerp(1.5, 1, eOut(prog(t, t0, 0.25)));
  const color = g.verdict === "O" ? GREEN : g.verdict === "X" ? RED : ORANGE;
  const sw = 64, L = 1300;
  const dash = { strokeDasharray: L, strokeDashoffset: L * (1 - draw) };
  return (
    <Center>
      <svg width={460} height={460} viewBox="0 0 460 460" style={{ transform: `scale(${slam}) rotate(${-6 * (1 - draw)}deg)`, opacity: prog(t, t0, 0.08),
        filter: `drop-shadow(0 0 30px ${color}88) drop-shadow(0 12px 18px rgba(0,0,0,.6))` }}>
        {g.verdict === "O" ? (
          <circle cx={230} cy={230} r={180} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" {...dash} transform="rotate(-90 230 230)" />
        ) : g.verdict === "X" ? (
          <>
            <line x1={80} y1={80} x2={380} y2={380} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeDasharray={430} strokeDashoffset={430 * (1 - clamp(draw * 2))} />
            <line x1={380} y1={80} x2={80} y2={380} stroke={color} strokeWidth={sw} strokeLinecap="round" strokeDasharray={430} strokeDashoffset={430 * (1 - clamp(draw * 2 - 1))} />
          </>
        ) : (
          <polygon points="230,50 410,380 50,380" fill="none" stroke={color} strokeWidth={sw} strokeLinejoin="round" {...dash} />
        )}
      </svg>
      <div style={{ fontFamily: TITLE, fontSize: fit(g.text, 96), color: "white", marginTop: 36, opacity: prog(t, t0 + 0.25, 0.25), ...STROKE(16) }}><Marked text={g.text} /></div>
      {g.sub ? <div style={{ fontFamily: BODY, fontWeight: 800, fontSize: fit(g.sub, 50, 940, BODY, "800"), color: "rgba(255,255,255,.88)", marginTop: 14, opacity: prog(t, t0 + 0.45, 0.25), ...STROKE(8) }}><Marked text={g.sub} /></div> : null}
    </Center>
  );
};

const VS: React.FC<{ g: Extract<Gfx, { type: "vs" }>; t: number }> = ({ g, t }) => {
  const st = g.steps ?? [];
  const side = (s: Side, i: number) => {
    const t0 = st[i] ?? 0.2 + 0.5 * i, p = popIn(t, t0), win = g.win === (i ? "right" : "left") && t >= (st[2] ?? 1.6);
    const lose = g.win && !win && t >= (st[2] ?? 1.6);
    const color = s.color ?? (i ? "#FF5C7A" : "#4DA3FF");
    return (
      <div style={{ width: 450, height: 640, borderRadius: 32, background: `linear-gradient(180deg, ${color}44, rgba(0,0,0,.35))`, border: `6px solid ${win ? KEY : color}`,
        boxShadow: win ? `0 0 50px ${KEY}` : "none", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: 20,
        transform: `scale(${p.s * (win ? 1.04 : 1)})`, opacity: p.o * (lose ? 0.45 : 1), position: "relative" }}>
        {win ? <div style={{ position: "absolute", top: -96, fontSize: 120 }}>👑</div> : null}
        {s.emoji ? <div style={{ fontSize: 170, lineHeight: 1.1 }}>{s.emoji}</div> : null}
        <div style={{ fontFamily: TITLE, fontSize: fit(s.label, 76, 400), color: "white", textAlign: "center", marginTop: 14, ...STROKE(12) }}><Marked text={s.label} /></div>
        {s.value ? <div style={{ fontFamily: TITLE, fontSize: fit(s.value, 84, 400), color: KEY, marginTop: 16, ...STROKE(12) }}>{s.value}</div> : null}
      </div>
    );
  };
  const v = popIn(t, (st[1] ?? 0.7) - 0.15);
  return (
    <Center>
      {g.title ? <div style={{ fontFamily: TITLE, fontSize: fit(g.title, 76), color: "white", marginBottom: 50, ...STROKE(12) }}><Marked text={g.title} /></div> : null}
      <div style={{ display: "flex", gap: 60, alignItems: "center", position: "relative" }}>
        {side(g.left, 0)}
        {side(g.right, 1)}
        <div style={{ position: "absolute", left: 540 - 60 - 95, top: 320 - 95, width: 190, height: 190, borderRadius: 95, background: RED, border: "7px solid #111",
          display: "flex", justifyContent: "center", alignItems: "center", fontFamily: TITLE, fontSize: 92, color: "white", transform: `scale(${v.s}) rotate(-8deg)`,
          boxShadow: "6px 6px 0 #111", ...STROKE(10) }}>VS</div>
      </div>
    </Center>
  );
};

const Rank: React.FC<{ g: Extract<Gfx, { type: "rank" }>; t: number }> = ({ g, t }) => {
  const t0 = g.steps?.[0] ?? 0.1, p = prog(t, t0, 0.22);
  const s = lerp(2.4, 1, eOut(p));
  const r = rise(t, (g.steps?.[1] ?? t0 + 0.35));
  return (
    <Center>
      <div style={{ fontFamily: TITLE, fontSize: 300, lineHeight: 1, color: g.color ?? KEY, transform: `rotate(-6deg) scale(${s})`, opacity: clamp(p * 3), ...STROKE(24),
        filter: "drop-shadow(0 16px 26px rgba(0,0,0,.6))" }}>{g.n}위</div>
      {g.emoji ? <div style={{ fontSize: 150, lineHeight: 1.2, opacity: r.o, transform: `translateY(${r.y}px)` }}>{g.emoji}</div> : null}
      <div style={{ fontFamily: TITLE, fontSize: fit(g.text, 100), color: "white", marginTop: 10, opacity: r.o, transform: `translateY(${r.y}px)`, ...STROKE(16) }}><Marked text={g.text} /></div>
      {g.sub ? <div style={{ fontFamily: BODY, fontWeight: 800, fontSize: fit(g.sub, 50, 940, BODY, "800"), color: "rgba(255,255,255,.88)", marginTop: 14, opacity: r.o, ...STROKE(8) }}><Marked text={g.sub} /></div> : null}
    </Center>
  );
};

const Quiz: React.FC<{ g: Extract<Gfx, { type: "quiz" }>; t: number }> = ({ g, t }) => {
  const n = g.options.length, count = g.count ?? 3;
  const c0 = g.steps?.[0] ?? 0.4 + 0.3 * n, reveal = g.steps?.[1] ?? c0 + count;
  const left = Math.max(0, reveal - t), on = t >= c0 && t < reveal, shown = t >= reveal;
  const q = rise(t, 0);
  return (
    <div style={{ position: "absolute", inset: "40px 60px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontFamily: TITLE, fontSize: Math.max(64, fit(g.q, 92)), lineHeight: 1.2, color: "white", textAlign: "center", opacity: q.o, transform: `translateY(${q.y}px)`, ...STROKE(14) }}>
        <Marked text={g.q} />
      </div>
      <div style={{ width: 960, display: "flex", flexDirection: "column", gap: 22, marginTop: 44 }}>
        {g.options.map((o, i) => {
          const r = rise(t, 0.3 + 0.3 * i), right = shown && i === g.answer, wrong = shown && i !== g.answer;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", height: Math.min(130, 560 / n), borderRadius: 24, border: `6px solid ${right ? GREEN : "#111"}`,
              background: right ? GREEN : "rgba(255,255,255,.95)", boxShadow: right ? `0 0 40px ${GREEN}` : "7px 7px 0 #111", opacity: r.o * (wrong ? 0.4 : 1),
              transform: `translateY(${r.y}px) scale(${right ? 1 + 0.05 * Math.sin(Math.PI * prog(t, reveal, 0.3)) : 1})`, padding: "0 30px" }}>
              <div style={{ fontFamily: TITLE, fontSize: 64, color: right ? "white" : "#111", width: 80 }}>{"ABCDE"[i]}</div>
              <div style={{ fontFamily: BODY, fontWeight: 900, fontSize: fit(o, 60, 760, BODY, "900"), color: right ? "white" : "#111" }}>{plain(o)}</div>
              {right ? <div style={{ marginLeft: "auto", fontSize: 70 }}>✅</div> : null}
            </div>
          );
        })}
      </div>
      <div style={{ height: 230, marginTop: 30, display: "flex", justifyContent: "center", alignItems: "center", opacity: on ? 1 : 0 }}>
        <svg width={200} height={200} viewBox="0 0 200 200">
          <circle cx={100} cy={100} r={84} fill="rgba(0,0,0,.6)" stroke="rgba(255,255,255,.2)" strokeWidth={18} />
          <circle cx={100} cy={100} r={84} fill="none" stroke={left < 1 ? RED : KEY} strokeWidth={18} strokeLinecap="round"
            strokeDasharray={528} strokeDashoffset={528 * (1 - left / count)} transform="rotate(-90 100 100)" />
          <text x={100} y={128} textAnchor="middle" fontFamily={TITLE} fontSize={90} fill="white">{Math.ceil(left)}</text>
        </svg>
      </div>
    </div>
  );
};

const Center: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", padding: "0 50px" }}>
    {children}
  </div>
);

/** the graphic for a clip, drawn in a box of the given height (1080 wide) */
export const GfxView: React.FC<{ g: Gfx; t: number; h: number }> = ({ g, t, h }) => {
  switch (g.type) {
    case "counter": return <Counter g={g} t={t} />;
    case "bars": return <Bars g={g} t={t} />;
    case "units": return <Units g={g} t={t} h={h} />;
    case "text": return <TextCard g={g} t={t} />;
    case "ox": return <OX g={g} t={t} />;
    case "vs": return <VS g={g} t={t} />;
    case "rank": return <Rank g={g} t={t} />;
    case "quiz": return <Quiz g={g} t={t} />;
  }
};

/** a dark studio background for graphic clips that have no footage behind them */
export const GFX_BG = "radial-gradient(ellipse at 50% 35%, #26305e 0%, #121632 45%, #07080f 100%)";

export type Mark = { kind: "circle" | "arrow"; x: number; y: number; r?: number; rot?: number; from: number; to: number; color?: string };

/** red circles and arrows drawn over the picture to point at something ("여기 보세요") */
export const Marks: React.FC<{ marks: Mark[]; t: number }> = ({ marks, t }) => (
  <>
    {marks.map((m, i) => {
      if (t < m.from || t > m.to + 0.2) return null;
      const p = eOut(prog(t, m.from, 0.35)), q = prog(t, m.to, 0.2), color = m.color ?? RED;
      if (m.kind === "circle") {
        const r = m.r ?? 120, L = 2 * Math.PI * r * 1.15;
        return (
          <svg key={i} width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0, opacity: 1 - q, filter: "drop-shadow(0 4px 8px rgba(0,0,0,.6))" }}>
            <ellipse cx={m.x} cy={m.y} rx={r * 1.15} ry={r} fill="none" stroke={color} strokeWidth={14} strokeLinecap="round"
              strokeDasharray={L} strokeDashoffset={L * (1 - p)} transform={`rotate(${(m.rot ?? -8) - 90} ${m.x} ${m.y})`} />
          </svg>
        );
      }
      // arrow: points at (x, y), coming in from the direction rot (degrees, 0 = from the left)
      const rot = m.rot ?? 30, len = m.r ?? 200, k = 1 - p, bob = 10 * Math.sin((t - m.from) * 9);
      return (
        <div key={i} style={{ position: "absolute", left: m.x, top: m.y, width: 0, height: 0, opacity: (1 - q) * clamp(p * 3),
          transform: `rotate(${rot}deg) translateX(${-(60 * k + bob)}px)` }}>
          <svg width={len + 20} height={120} viewBox={`0 0 ${len + 20} 120`} style={{ position: "absolute", left: -(len + 10), top: -60, overflow: "visible",
            filter: "drop-shadow(0 4px 8px rgba(0,0,0,.6))" }}>
            <line x1={10} y1={60} x2={len - 50} y2={60} stroke={color} strokeWidth={26} strokeLinecap="round" />
            <polygon points={`${len + 10},60 ${len - 70},10 ${len - 70},110`} fill={color} stroke="#111" strokeWidth={0} />
          </svg>
        </div>
      );
    })}
  </>
);
