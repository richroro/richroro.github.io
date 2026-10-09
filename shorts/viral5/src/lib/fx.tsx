// Overlay pieces drawn on top of the photos. Every one takes the absolute time t (seconds),
// so a frame is a pure function of time and the choreography in Short.tsx reads like a cue sheet.
import React from "react";
import { AbsoluteFill } from "remotion";
import { BODY, TITLE } from "./fonts";

export const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const prog = (t: number, t0: number, d: number) => clamp((t - t0) / d);
export const eOut = (x: number) => 1 - Math.pow(1 - x, 3);
export const eIn = (x: number) => x * x * x;
export const eInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const eBack = (x: number, s = 1.9) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** pop in at t0 (overshoot), wobble a little, pop out at t1 */
export const pop = (t: number, t0: number, t1 = 1e9, rot = 0) => {
  if (t < t0 || t > t1 + 0.18) return null;
  const p = prog(t, t0, 0.3), q = prog(t, t1, 0.16);
  return { s: eBack(p, 2.4) * (1 - eIn(q)), r: rot - 10 * (1 - eOut(p)) + 1.2 * Math.sin((t - t0) * 6), o: clamp(p * 4) * (1 - q) };
};

/** decaying camera shake that starts at each impact time */
export const shake = (t: number, hits: { t: number; amp: number; dur: number }[]) => {
  let x = 0, y = 0;
  for (const h of hits) {
    if (t < h.t || t > h.t + h.dur) continue;
    const k = 1 - (t - h.t) / h.dur, a = h.amp * k * k;
    x += a * Math.sin((t - h.t) * 83); y += a * Math.cos((t - h.t) * 61);
  }
  return [x, y];
};

const STROKE: React.CSSProperties = { WebkitTextStroke: "16px black", paintOrder: "stroke" };

/** neo-brutalist fact sticker */
export const Sticker: React.FC<{ t: number; t0: number; t1: number; x: number; y: number; rot?: number; bg?: string; fg?: string; size?: number; children: React.ReactNode }> = ({ t, t0, t1, x, y, rot = -3, bg = "#FFE14D", fg = "#111", size = 46, children }) => {
  const a = pop(t, t0, t1, rot);
  if (!a) return null;
  const k = size / 46;
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%,-50%) rotate(${a.r}deg) scale(${a.s})`, opacity: a.o,
      fontFamily: BODY, fontWeight: 900, fontSize: size, color: fg, background: bg, border: `${6 * k}px solid #111`, borderRadius: 22 * k,
      padding: `${14 * k}px ${26 * k}px ${12 * k}px`, boxShadow: `${9 * k}px ${9 * k}px 0 #111`, whiteSpace: "nowrap" }}>
      {children}
    </div>
  );
};

/** the big rank stamp that slams in the middle ("3위") */
export const Stamp: React.FC<{ t: number; t0: number; t1: number; text: string; color: string }> = ({ t, t0, t1, text, color }) => {
  if (t < t0 || t > t1 + 0.2) return null;
  const p = prog(t, t0, 0.22), q = prog(t, t1, 0.2);
  const s = lerp(2.6, 1, eOut(p)) * lerp(1, 0.35, eIn(q));
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <div style={{ fontFamily: TITLE, fontSize: 330, lineHeight: 1, color, ...STROKE, WebkitTextStroke: "26px black",
        transform: `translateY(${-140 * eIn(q)}px) rotate(${-8 + 3 * (1 - p)}deg) scale(${s})`, opacity: clamp(p * 3) * (1 - q),
        filter: "drop-shadow(0 18px 30px rgba(0,0,0,.6))" }}>
        {text}
      </div>
    </AbsoluteFill>
  );
};

/** dark gradients that keep the header and the captions readable over any photo */
export const Shades: React.FC = () => (
  <AbsoluteFill>
    <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(0,0,0,.88) 0%, rgba(0,0,0,.6) 17%, rgba(0,0,0,0) 30%)" }} />
    <AbsoluteFill style={{ background: "linear-gradient(to top, rgba(0,0,0,.85) 0%, rgba(0,0,0,.5) 26%, rgba(0,0,0,0) 46%)" }} />
  </AbsoluteFill>
);

/** top header: the series title, plus the current rank and topic */
export const Header: React.FC<{ t: number; big: number; rank?: { label: string; topic: string; t0: number; color: string } }> = ({ t, big, rank }) => {
  // the two header styles hand over one after the other, never on top of each other
  const small = clamp(1 - 2 * big), bigO = clamp(2 * big - 1);
  const rp = rank ? eBack(prog(t, rank.t0, 0.3), 2) : 0;
  return (
    <AbsoluteFill>
      {/* hook: the full title, big */}
      <div style={{ position: "absolute", top: 170, width: "100%", textAlign: "center", fontFamily: TITLE, fontSize: 118, lineHeight: 1.08, color: "white",
        ...STROKE, WebkitTextStroke: "20px black", opacity: bigO, transform: `scale(${lerp(0.85, 1, bigO)})` }}>
        숫자 하나에<br />
        <span style={{ color: "#FFE14D" }}>터진 사고</span>{" "}
        <span style={{ display: "inline-block", WebkitTextStroke: 0, color: "white", background: "#FF3B5C", borderRadius: 18, padding: "0 18px", fontSize: 104, transform: "rotate(-3deg)", border: "6px solid #000" }}>TOP 3</span>
      </div>
      {/* segments: series title small, rank pill + topic */}
      <div style={{ position: "absolute", top: 150, width: "100%", textAlign: "center", opacity: small }}>
        <div style={{ fontFamily: BODY, fontWeight: 800, fontSize: 42, color: "rgba(255,255,255,.88)", letterSpacing: -0.5, ...STROKE, WebkitTextStroke: "10px black" }}>
          숫자 하나에 터진 사고 TOP 3
        </div>
        {rank && (
          <div style={{ marginTop: 18, display: "flex", justifyContent: "center", alignItems: "center", gap: 22, transform: `scale(${rp})`, opacity: clamp(rp * 2) }}>
            <span style={{ fontFamily: TITLE, fontSize: 86, color: "#111", background: rank.color, border: "6px solid #000", borderRadius: 20, padding: "2px 22px 0", boxShadow: "7px 7px 0 #000" }}>{rank.label}</span>
            <span style={{ fontFamily: TITLE, fontSize: 96, color: "white", ...STROKE, WebkitTextStroke: "18px black", whiteSpace: "nowrap" }}>{rank.topic}</span>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

/** quick full-frame flash */
export const Flash: React.FC<{ t: number; at: number[]; color?: string; peak?: number; dur?: number }> = ({ t, at, color = "white", peak = 0.9, dur = 0.25 }) => {
  let o = 0;
  for (const a of at) if (t >= a) o = Math.max(o, peak * (1 - eOut(prog(t, a, dur))));
  return o > 0.002 ? <AbsoluteFill style={{ background: color, opacity: o }} /> : null;
};

/** text with an RGB-split glitch for `dur` seconds after `at` */
export const GlitchText: React.FC<{ t: number; at: number; dur?: number; style: React.CSSProperties; children: React.ReactNode }> = ({ t, at, dur = 0.45, style, children }) => {
  const on = t >= at && t < at + dur;
  const j = on ? 10 * Math.sin(t * 97) : 0, k = on ? 8 * Math.cos(t * 71) : 0;
  return (
    <div style={{ position: "relative", ...style }}>
      {on && <div style={{ position: "absolute", inset: 0, color: "#00F0FF", transform: `translate(${j}px,${-k}px)`, mixBlendMode: "screen", WebkitTextStroke: 0 }}>{children}</div>}
      {on && <div style={{ position: "absolute", inset: 0, color: "#FF2A6D", transform: `translate(${-j}px,${k}px)`, mixBlendMode: "screen", WebkitTextStroke: 0 }}>{children}</div>}
      <div style={{ position: "relative", transform: on ? `translateX(${j * 0.4}px) skewX(${k * 0.8}deg)` : undefined }}>{children}</div>
    </div>
  );
};

export const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
