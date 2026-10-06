// "숫자 하나에 터진 사고 TOP 3" — 1080x1920 short. Photos carry each story, overlays carry the numbers,
// captions come from Captions.tsx (TikTok template style). Every cue hangs off the narration timing.
import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Captions } from "./Captions";
import env from "./data/voice_env.json";
import { BODY, TITLE, loadFonts } from "./fonts";
import { Flash, GlitchText, Header, Shades, Stamp, Sticker, clamp, eBack, eIn, eInOut, eOut, fmt, lerp, pop, prog, shake } from "./fx";
import { Photo, PhotoId } from "./Photo";
import { CH, FPS, T, TL, WT, fr } from "./timeline";

loadFonts();

/* ───────── cue sheet ───────── */
export const END = TL.end;
const s3 = T("r3a") - 0.06, s2 = T("r2a") - 0.1, s1 = T("r1a") - 0.1, s4 = T("loop") - 0.12;
const hookBoom = WT("hook", "터진") - 0.03, reveal = WT("hook", "삼");
const park3 = WT("r3a", "터질"), park2 = WT("r2a", "발사"), park1 = WT("r1a", "단위");
const count0 = CH("r3b", 0), flip = WT("r3b", "마이너스") - 0.03, after3 = WT("r3b", "뒤집");
const boom2 = WT("r2a", "터진") - 0.03, box0 = CH("r2b", 0), squeeze = WT("r2b", "작은"), over = WT("r2b", "넘쳐") - 0.02;
const burn = WT("r1a", "사라진"), marsT = WT("r1a", "화성") - 0.05;
const teamA = CH("r1b", 0), teamB = CH("r1b", 1), neq = WT("r1b", "미터법");
const money = CH("r1c", 0), drain = WT("r1c", "그대로");
const bad = T("loop"), good = WT("loop", "단위"), cta = WT("loop", "적으");
const loopOut = END - 0.5;

const RANK = {
  r3: { label: "3위", topic: "강남스타일", color: "#FF9F43", t0: park3 },
  r2: { label: "2위", topic: "아리안 5 로켓", color: "#D9E2EC", t0: park2 },
  r1: { label: "1위", topic: "화성 탐사선", color: "#FFD34D", t0: park1 },
  end: { label: "교훈", topic: "숫자 + 단위", color: "#7CF0FF", t0: s4 + 0.1 },
};

type Shot = { id: PhotoId; a: number; b: number; zoom?: [number, number]; drift?: [number, number] };
const SHOTS: Shot[] = [
  { id: "psy", a: s3, b: count0, zoom: [1.05, 1.16] },
  { id: "youtube", a: count0, b: s2, zoom: [1.02, 1.14] },
  { id: "ariane", a: s2, b: box0, zoom: [1.06, 1.24], drift: [0, 150] },
  { id: "ariane", a: box0, b: s1, zoom: [1.32, 1.38] },
  { id: "mco", a: s1, b: marsT, zoom: [1.0, 1.16] },
  { id: "mars", a: marsT, b: teamA + 0.3, zoom: [1.0, 1.1] },
  { id: "mco", a: money, b: s4 + 0.2, zoom: [1.12, 1.02] },
  { id: "ruler", a: s4, b: END, zoom: [1.0, 1.1] },
];

/** per-shot look that changes with the story (red after the flip, fire after the explosion, …) */
const look = (id: PhotoId, a: number, t: number): { filter?: string; tint?: string; tintO?: number; o?: number; s?: number } => {
  const g = prog(t, flip, 0.2);
  if (id === "youtube") return { filter: `grayscale(${g}) brightness(${1 - 0.3 * g})`, tint: "#ff1e46", tintO: 0.32 * g };
  if (id === "ariane" && a === s2) { const k = prog(t, boom2, 0.15); return { filter: `brightness(${1 - 0.45 * k}) sepia(${0.7 * k}) saturate(${1 + 1.5 * k})`, tint: "#ff6a00", tintO: 0.3 * k }; }
  if (id === "ariane") return { filter: "blur(14px) brightness(.38)" };
  if (id === "mco" && a === s1) { const k = prog(t, burn, 0.5); return { filter: `blur(${10 * k}px) brightness(${1 + 0.9 * k}) sepia(${k}) saturate(${1 + 2 * k})`, tint: "#ff7a1a", tintO: 0.45 * k, o: 1 - prog(t, marsT - 0.15, 0.15) }; }
  if (id === "mco") { const k = eInOut(prog(t, drain, 0.9)); return { filter: `blur(${26 * k}px) brightness(${0.55 - 0.25 * k})`, o: 1 - 0.85 * k, s: 1 + 0.18 * k }; }
  if (id === "ruler") return { filter: "brightness(.62)" };
  return { filter: "brightness(.85)" };
};

/* ───────── hook: three blurred cards, the 3rd-place one opens into the first story ───────── */
const CARDS: { id: PhotoId; label: string; color: string }[] = [
  { id: "psy", label: "3위", color: RANK.r3.color },
  { id: "ariane", label: "2위", color: RANK.r2.color },
  { id: "mco", label: "1위", color: RANK.r1.color },
];
const Hook: React.FC<{ t: number }> = ({ t }) => {
  if (t > s3 + 0.1) return null;
  const open = eInOut(prog(t, s3 - 0.5, 0.55));
  return (
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, #1c2350 0%, #07070d 70%)" }}>
      {CARDS.map((c, i) => {
        const a = pop(t, 0.05 + i * 0.12, 1e9, [-4, 0, 4][i]);
        if (!a) return null;
        const pick = i === 0 ? eBack(prog(t, reveal, 0.35), 2) : 0;
        const away = i === 0 ? 0 : eIn(prog(t, reveal + 0.15, 0.4));
        const W = 320, H = 560, x0 = 40 + i * 340, y0 = 640 + (i === 1 ? -20 : 20);
        const x = lerp(x0, 0, i === 0 ? open : 0), y = lerp(y0, 0, i === 0 ? open : 0);
        const w = lerp(W, 1080, i === 0 ? open : 0), h = lerp(H, 1920, i === 0 ? open : 0);
        const blur = i === 0 ? lerp(16, 0, Math.max(pick, open)) : 16;
        return (
          <div key={c.id} style={{ position: "absolute", left: x, top: y + 1100 * away, width: w, height: h, borderRadius: lerp(30, 0, i === 0 ? open : 0), overflow: "hidden",
            border: `${lerp(7, 0, i === 0 ? open : 0)}px solid ${i === 0 && pick > 0 ? c.color : "white"}`, boxShadow: "0 30px 70px rgba(0,0,0,.6)",
            transform: `rotate(${a.r * (1 - open)}deg) scale(${a.s * (1 + 0.08 * pick * (1 - open))})`, opacity: a.o * (1 - away), zIndex: i === 0 ? 2 : 1 }}>
            <AbsoluteFill style={{ filter: `blur(${blur}px) brightness(${lerp(0.55, 0.85, i === 0 ? Math.max(pick, open) : 0)})` }}>
              <Photo id={c.id} zoom={[1.05, 1.05]} />
            </AbsoluteFill>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "center", padding: "26px 0 30px", opacity: 1 - open }}>
              <div style={{ fontFamily: TITLE, fontSize: 150, color: "white", opacity: 1 - pick, WebkitTextStroke: "14px black", paintOrder: "stroke" }}>?</div>
              <div style={{ fontFamily: TITLE, fontSize: 84, color: "#111", background: c.color, border: "6px solid #000", borderRadius: 18, padding: "0 20px", boxShadow: "6px 6px 0 #000" }}>{c.label}</div>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/* ───────── 3위: the view counter fills the 32-bit box and (almost) flips ───────── */
const ViewCounter: React.FC<{ t: number }> = ({ t }) => {
  const a = pop(t, count0 - 0.1, s2 - 0.1);
  if (!a) return null;
  const fill = eOut(prog(t, count0, flip - 0.25 - count0)), flipped = t >= flip;
  const v = flipped ? -2147483648 : Math.round(lerp(2140000000, 2147483647, fill));
  const red = "#FF2A4D";
  return (
    <div style={{ position: "absolute", left: 540, top: 800, transform: `translate(-50%,-50%) scale(${a.s})`, opacity: a.o, width: 940 }}>
      <div style={{ background: "rgba(255,255,255,.95)", borderRadius: 32, padding: "22px 34px 26px", boxShadow: "0 24px 60px rgba(0,0,0,.55)", border: `6px solid ${flipped ? red : "#111"}` }}>
        <div style={{ fontFamily: BODY, fontWeight: 800, fontSize: 40, color: "#666" }}>▶ 조회수</div>
        <GlitchText t={t} at={flip} dur={0.5} style={{ fontFamily: BODY, fontWeight: 900, fontSize: 94, letterSpacing: -2, color: flipped ? red : "#111", fontVariantNumeric: "tabular-nums", lineHeight: 1.1, whiteSpace: "nowrap" }}>
          {flipped ? "−" + fmt(2147483648) : fmt(v)}<span style={{ fontSize: 54, marginLeft: 8 }}>회</span>
        </GlitchText>
      </div>
      <div style={{ marginTop: 22, height: 40, borderRadius: 20, background: "rgba(0,0,0,.6)", border: "4px solid #fff", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${flipped ? 100 : lerp(55, 100, fill)}%`, background: flipped ? red : "linear-gradient(90deg,#39E508,#FFE14D 70%,#FF9F43)" }} />
      </div>
      <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", fontFamily: BODY, fontWeight: 900, fontSize: 40, color: "white", WebkitTextStroke: "9px black", paintOrder: "stroke" }}>
        <span>32비트 숫자 칸</span>
        <span style={{ color: fill > 0.995 || flipped ? red : "white" }}>{flipped ? "넘침!" : fill > 0.995 ? "꽉 참!" : `${Math.round(lerp(55, 100, fill))}%`}</span>
      </div>
    </div>
  );
};

/* ───────── 2위: mission clock, explosion, then the overflow sketch ───────── */
const Clock: React.FC<{ t: number }> = ({ t }) => {
  const a = pop(t, park2 + 0.1, box0 - 0.15);
  if (!a) return null;
  const secs = 37 * eIn(prog(t, park2 + 0.1, boom2 - park2 - 0.1));
  const dead = t >= boom2;
  return (
    <div style={{ position: "absolute", left: 540, top: 1070, transform: `translate(-50%,-50%) scale(${a.s})`, opacity: a.o, fontFamily: TITLE, fontSize: 120,
      color: dead ? "#FF2A4D" : "white", WebkitTextStroke: "18px black", paintOrder: "stroke", whiteSpace: "nowrap" }}>
      T+00:{String(Math.floor(secs)).padStart(2, "0")}{dead ? " 💥" : ""}
    </div>
  );
};
const Blast: React.FC<{ t: number }> = ({ t }) => {
  const p = prog(t, boom2, 1.1);
  if (p <= 0 || p >= 1) return null;
  const r = lerp(0.1, 1.7, eOut(prog(t, boom2, 0.45))), o = 1 - eIn(prog(t, boom2 + 0.35, 0.75));
  return (
    <AbsoluteFill style={{ opacity: o, mixBlendMode: "screen",
      background: `radial-gradient(circle at 50% 45%, #fff ${r * 8}%, #ffe14d ${r * 18}%, #ff7a1a ${r * 34}%, rgba(255,60,0,.55) ${r * 52}%, rgba(0,0,0,0) ${r * 70}%)` }} />
  );
};
const Overflow: React.FC<{ t: number }> = ({ t }) => {
  if (t < box0 - 0.05 || t > s1 + 0.2) return null;
  const inn = eOut(prog(t, box0, 0.45)), sq = eInOut(prog(t, squeeze, 0.6)), boom = t >= over, out = prog(t, s1 - 0.15, 0.2);
  const lab: React.CSSProperties = { fontFamily: BODY, fontWeight: 900, fontSize: 40, color: "white", WebkitTextStroke: "9px black", paintOrder: "stroke", whiteSpace: "nowrap", textAlign: "center" };
  const box = (w: number, bg: string, border: string): React.CSSProperties => ({ width: w, height: 170, borderRadius: 26, background: bg, border: `8px solid ${border}`,
    display: "flex", alignItems: "center", justifyContent: "center", fontFamily: TITLE, fontSize: 96, color: "white", boxShadow: "0 20px 50px rgba(0,0,0,.5)" });
  const [jx, jy] = boom && t < over + 0.5 ? [9 * Math.sin(t * 90), 7 * Math.cos(t * 70)] : [0, 0];
  return (
    <AbsoluteFill style={{ opacity: 1 - out }}>
      {/* the 64-bit value */}
      <div style={{ position: "absolute", left: lerp(-560, 70, inn) + lerp(0, 420, sq), top: 640 + lerp(0, 330, sq), transform: `scale(${lerp(1, 0.5, sq)})`, transformOrigin: "0 50%", opacity: boom ? 0 : 1 }}>
        <div style={lab}>64비트 숫자 (예시)</div>
        <div style={box(560, "#1d3a8a", "#7CF0FF")}>40000.0</div>
      </div>
      {/* the 16-bit slot */}
      <div style={{ position: "absolute", left: 610, top: 960, transform: `translate(${jx}px,${jy}px) scale(${boom ? 1 + 0.12 * Math.sin(Math.PI * prog(t, over, 0.3)) : 1})` }}>
        <div style={lab}>16비트 칸 (최대 32,767)</div>
        <div style={box(400, boom ? "#7a0f22" : "#2a2d3a", boom ? "#FF2A4D" : "white")}>
          <GlitchText t={t} at={over} dur={0.6} style={{ fontFamily: TITLE, fontSize: 96, color: boom ? "#FF2A4D" : "white" }}>{boom ? "넘침!" : sq > 0.7 ? "…?" : ""}</GlitchText>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ───────── 1위: two teams, two units ───────── */
const Split: React.FC<{ t: number }> = ({ t }) => {
  if (t < teamA - 0.05 || t > money + 0.3) return null;
  const out = eIn(prog(t, money - 0.1, 0.3));
  const card = (id: PhotoId, t0: number, top: number, small: string, big: string, color: string) => {
    const a = pop(t, t0, 1e9, 0);
    if (!a) return null;
    return (
      <div style={{ position: "absolute", left: 40, top, width: 1000, height: 310, borderRadius: 32, overflow: "hidden", border: `7px solid ${color}`,
        transform: `translateX(${(top < 800 ? -1 : 1) * 1200 * out}px) scale(${a.s})`, opacity: a.o, boxShadow: "0 24px 60px rgba(0,0,0,.6)" }}>
        <AbsoluteFill style={{ filter: "brightness(.55)" }}><Photo id={id} zoom={[1.05, 1.12]} /></AbsoluteFill>
        <div style={{ position: "absolute", left: 36, bottom: 26, fontFamily: BODY, fontWeight: 800, fontSize: 40, color: "white", WebkitTextStroke: "9px black", paintOrder: "stroke" }}>{small}</div>
        <div style={{ position: "absolute", left: 36, top: 22, fontFamily: TITLE, fontSize: 104, color, WebkitTextStroke: "16px black", paintOrder: "stroke" }}>{big}</div>
      </div>
    );
  };
  const n = pop(t, neq, money - 0.1);
  return (
    <AbsoluteFill>
      {card("lockheed", teamA, 455, "A팀 · 록히드 마틴 (탐사선 제작)", "파운드 lbf·s", "#FFB547")}
      {card("jpl", teamB, 790, "B팀 · NASA JPL (항법)", "미터법 N·s", "#39E508")}
      {n && (
        <div style={{ position: "absolute", left: 540, top: 777, transform: `translate(-50%,-50%) scale(${n.s}) rotate(${n.r}deg)`, opacity: n.o, width: 150, height: 150, borderRadius: 75,
          background: "#FF2A4D", border: "8px solid #000", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: TITLE, fontSize: 110, color: "white" }}>≠</div>
      )}
    </AbsoluteFill>
  );
};
const Money: React.FC<{ t: number }> = ({ t }) => {
  const a = pop(t, money, s4 - 0.1);
  if (!a) return null;
  const d = eInOut(prog(t, drain, 1.0));
  return (
    <div style={{ position: "absolute", left: 540, top: 800, transform: `translate(-50%,-50%) scale(${a.s})`, opacity: a.o, textAlign: "center" }}>
      <div style={{ fontFamily: BODY, fontWeight: 900, fontSize: 48, color: "white", WebkitTextStroke: "10px black", paintOrder: "stroke" }}>탐사선 값</div>
      <GlitchText t={t} at={drain + 0.95} dur={0.35} style={{ fontFamily: TITLE, fontSize: 128, color: d > 0.98 ? "#FF2A4D" : "#7CF0FF", WebkitTextStroke: "18px black", paintOrder: "stroke", whiteSpace: "nowrap" }}>
        ${fmt(125000000 * (1 - d))}
      </GlitchText>
    </div>
  );
};

/* ───────── ending: same number, with and without a unit ───────── */
const Units: React.FC<{ t: number }> = ({ t }) => {
  const a = pop(t, bad + 0.05, loopOut);
  if (!a) return null;
  const ok = t >= good, g = eBack(prog(t, good, 0.3), 2.2);
  return (
    <div style={{ position: "absolute", left: 540, top: 800, transform: `translate(-50%,-50%) scale(${a.s})`, opacity: a.o, textAlign: "center", whiteSpace: "nowrap" }}>
      <div style={{ fontFamily: TITLE, fontSize: 230, lineHeight: 1, color: ok ? "#39E508" : "white", WebkitTextStroke: "22px black", paintOrder: "stroke" }}>
        100{ok && <span style={{ display: "inline-block", transform: `scale(${g})`, marginLeft: 24 }}>N·s</span>}
      </div>
      <div style={{ marginTop: 18, fontFamily: BODY, fontWeight: 900, fontSize: 64, color: ok ? "#39E508" : "#FF2A4D", WebkitTextStroke: "12px black", paintOrder: "stroke" }}>
        {ok ? "✅ 단위까지 한 세트" : "❌ 뭐가 100?"}
      </div>
    </div>
  );
};
const Cta: React.FC<{ t: number }> = ({ t }) => {
  const a = pop(t, cta, loopOut);
  if (!a) return null;
  return (
    <div style={{ position: "absolute", left: 540, top: 1085, transform: `translate(-50%,-50%) scale(${a.s * (1 + 0.03 * Math.sin(t * 7))})`, opacity: a.o,
      fontFamily: BODY, fontWeight: 900, fontSize: 50, color: "#111", background: "white", borderRadius: 999, padding: "22px 42px", whiteSpace: "nowrap", boxShadow: "0 18px 40px rgba(0,0,0,.5)" }}>
      📤 단위 안 쓰는 동료한테 보내기
    </div>
  );
};
const Rays: React.FC<{ t: number }> = ({ t }) => {
  const o = clamp(prog(t, T("r1a"), 0.3) * 2) * (1 - prog(t, park1, 0.4));
  if (o <= 0) return null;
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: o * 0.9 }}>
      <div style={{ width: 1500, height: 1500, borderRadius: "50%", transform: `rotate(${t * 20}deg)`,
        background: "repeating-conic-gradient(rgba(255,211,77,.45) 0 9deg, rgba(0,0,0,0) 9deg 18deg)", WebkitMaskImage: "radial-gradient(circle, #000 15%, transparent 65%)" }} />
    </AbsoluteFill>
  );
};

/* ───────── sound ───────── */
const SFX: [number, string, number][] = [
  [0.0, "whoosh", 0.5], [0.05, "k_drop_002", 0.45], [0.17, "k_drop_002", 0.45], [0.29, "k_drop_002", 0.45],
  [hookBoom, "boom", 0.9], [reveal, "k_maximize_003", 0.5],
  [T("r3a"), "pop", 0.8], [park3, "whoosh", 0.35], [count0, "tickroll", 0.35], [flip, "scratch", 0.8], [flip, "glitch", 0.6],
  [T("r2a"), "pop", 0.8], [park2 + 0.1, "riser", 0.55], [boom2, "boom", 1.0], [box0 - 0.2, "whoosh", 0.25], [over, "glitch", 0.65], [over + 0.05, "k_error_003", 0.4],
  [T("r1a") - 0.08, "ding", 0.45], [burn, "whoosh_dn", 0.5], [teamA, "k_drop_002", 0.55], [teamB, "k_drop_002", 0.55],
  [money - 0.05, "coin", 0.7], [WT("r1c", "발") + 0.12, "whoosh_dn", 0.45],
  [bad + 0.05, "k_error_003", 0.45], [good, "k_confirmation_002", 0.55], [cta, "pop_hi", 0.55], [loopOut, "whoosh", 0.4],
];
const gate = (t: number, a: number, b: number) => (t < a || t > b + 0.25 ? 1 : t < a + 0.05 ? 1 - (t - a) / 0.05 : t < b ? 0 : (t - b) / 0.25);
const musicVolume = (f: number) => {
  const t = f / FPS, e = (env as number[])[f] ?? 0;
  return 0.5 * (1 - 0.62 * e) * gate(t, flip, after3 + 0.35) * gate(t, boom2, box0 + 0.05) * (1 - prog(t, END - 1.3, 1.3)) * prog(t, 0, 0.12);
};

/* ───────── frame ───────── */
export const Short: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  const [sx, sy] = shake(t, [{ t: hookBoom, amp: 22, dur: 0.45 }, { t: flip, amp: 24, dur: 0.45 }, { t: boom2, amp: 36, dur: 0.75 }, { t: over, amp: 16, dur: 0.4 }]);
  const big = t < s3 ? 1 - prog(t, s3 - 0.35, 0.3) : prog(t, loopOut + 0.05, 0.4);
  const rank = t >= s4 ? RANK.end : t >= s1 ? RANK.r1 : t >= s2 ? RANK.r2 : t >= s3 ? RANK.r3 : undefined;
  const fadeToLoop = prog(t, loopOut, 0.45);
  return (
    <AbsoluteFill style={{ background: "#07070d" }}>
      <AbsoluteFill style={{ transform: `translate(${sx}px,${sy}px) scale(${1 + (sx || sy ? 0.04 : 0)})` }}>
        {SHOTS.map((s, i) => {
          if (t < s.a - 0.01 || t >= s.b + 0.01) return null;
          const L = look(s.id, s.a, t), inn = prog(t, s.a, 0.2);
          return (
            <Sequence key={i} from={fr(s.a)} durationInFrames={fr(s.b) - fr(s.a)}>
              <AbsoluteFill style={{ opacity: L.o ?? 1, transform: `scale(${(L.s ?? 1) * lerp(1.12, 1, eOut(inn))})`, filter: inn < 1 ? `blur(${10 * (1 - inn)}px)` : undefined }}>
                <Photo id={s.id} zoom={s.zoom} drift={s.drift} filter={L.filter} />
                {L.tint && <AbsoluteFill style={{ background: L.tint, opacity: L.tintO, mixBlendMode: "multiply" }} />}
              </AbsoluteFill>
            </Sequence>
          );
        })}
        <Hook t={t} />
        <Rays t={t} />
        <Blast t={t} />
        <Shades />
        <Sticker t={t} t0={park3 + 0.25} t1={count0 - 0.12} x={540} y={720}>2012년 · 유튜브 최초 10억 뷰</Sticker>
        <ViewCounter t={t} />
        <Sticker t={t} t0={after3 + 0.45} t1={s2 - 0.08} x={540} y={1110} rot={3} bg="#7CF0FF">그래서 칸을 키웠죠 (64비트)</Sticker>
        <Sticker t={t} t0={park2 + 0.2} t1={boom2 - 0.08} x={540} y={720}>1996년 · 첫 발사</Sticker>
        <Clock t={t} />
        <Overflow t={t} />
        <Sticker t={t} t0={over + 0.5} t1={s1 - 0.08} x={540} y={1210} rot={-2} bg="#FF2A4D" fg="white">넘침 → 시스템 오류 → 자폭</Sticker>
        <Sticker t={t} t0={park1 + 0.2} t1={burn - 0.05} x={540} y={720}>1999년 · NASA</Sticker>
        <Sticker t={t} t0={marsT + 0.2} t1={teamA - 0.08} x={340} y={700} rot={-4} bg="#39E508">계획 고도 150km</Sticker>
        <Sticker t={t} t0={marsT + 0.55} t1={teamA - 0.08} x={700} y={1010} rot={3} bg="#FF2A4D" fg="white">실제 57km 🔥</Sticker>
        <Split t={t} />
        <Sticker t={t} t0={neq + 0.7} t1={money - 0.1} x={540} y={1160} rot={-2}>같은 숫자, 4.45배 차이</Sticker>
        <Money t={t} />
        <Units t={t} />
        <Cta t={t} />
      </AbsoluteFill>
      <Stamp t={t} t0={T("r3a")} t1={park3} text="3위" color={RANK.r3.color} />
      <Stamp t={t} t0={T("r2a")} t1={park2} text="2위" color={RANK.r2.color} />
      <Stamp t={t} t0={T("r1a")} t1={park1} text="1위" color={RANK.r1.color} />
      {fadeToLoop > 0 && <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, #1c2350 0%, #07070d 70%)", opacity: fadeToLoop }} />}
      <Header t={t} big={big} rank={rank} />
      <Captions />
      <Flash t={t} at={[hookBoom, boom2]} />
      <Flash t={t} at={[flip, over]} color="#FF2A4D" peak={0.5} dur={0.35} />

      {TL.lines.map((l) => (
        <Sequence key={l.id} from={fr(l.start)} layout="none"><Audio src={staticFile(`voice/${l.id}.wav`)} /></Sequence>
      ))}
      <Audio src={staticFile("music/sneaky_snitch.mp3")} volume={musicVolume} />
      {SFX.map(([at, name, gain], i) => (
        <Sequence key={i} from={fr(at)} layout="none"><Audio src={staticFile(`sfx/${name}.wav`)} volume={gain * 0.7} /></Sequence>
      ))}
    </AbsoluteFill>
  );
};
