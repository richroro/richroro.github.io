// Story ("썰") shorts: a community-post card for the hook and little mochi-shaped characters who act the story out,
// one scene per beat of the narration. Both are graphic clips (lib/Gfx.tsx types "post" and "scene"), so a 썰 is an
// ordinary narrated short (prep.py) whose clips are scenes instead of footage.
import React from "react";
import { fitText, measureText } from "@remotion/layout-utils";
import { BODY, TITLE } from "./fonts";
import { clamp, eBack, eInOut, eOut, prog } from "./fx";
import { Marked } from "./Marked";

export type Mood = "neutral" | "happy" | "laugh" | "shock" | "sad" | "cry" | "angry" | "smug" | "shy" | "think" | "sleep" | "love" | "sick";
/** a character: `mood` until steps[2], then `to` (a reaction mid-scene); x is 0..1 across the frame */
export type Char = { name?: string; color?: string; mood?: Mood; to?: Mood; hat?: string; x?: number; size?: number; flip?: boolean };
export type SceneG = {
  /** "📍 편의점" tag at the top left */
  place?: string;
  /** a backdrop drawn here ("class", "home", "street", "store", "army", "night", "stage", "office", "door") or any CSS background */
  bg?: string;
  chars: Char[];
  /** a speech bubble over chars[who]; steps[0] is when it pops (default at once) */
  say?: { who: number; text: string };
  /** a big emoji (a phone, a gimbap roll, a bill), steps[1] when it pops; propX 0..1 across (default between the
   *  characters, or beside a lone one) */
  prop?: string; propX?: number;
  /** a full-width caption card over the scene, e.g. "3시간 뒤..." */
  card?: string;
  /** a big outlined word that slams in over the top of the scene ("×200", "15cm↑"), steps[3] when it lands */
  big?: string;
  /** words written on the backdrop's board: the chalkboard, the stage banner, the barracks notice, the shop sign */
  sign?: string;
  /** a slow push-in to this scale over the first 3 s, centred on chars[focus] */
  zoom?: number; focus?: number;
};
/** the hook card; `meta` is the grey line under the title (default "익명 · 창작 썰"), likes and comments are shown if given;
 *  `chars` (one or two) stand at the bottom right from frame 0, so the thumbnail shows a face, not just text */
export type PostG = { board?: string; title: string; body?: string[]; meta?: string; likes?: string; comments?: string; hot?: boolean; chars?: Char[] };

const INK = "#1b1b1f";
const PALETTE = ["#FFD84D", "#FF9EBB", "#8FD3FF", "#B9F27C", "#C9A7FF", "#FFB36B", "#D9D9D9"];

/** a mochi character in a mood; t is seconds since the scene started (every scene opens with a small squash) */
export const Mochi: React.FC<{ c: Char; i: number; t: number; size: number; mood?: Mood }> = ({ c, i, t, size, mood = c.mood ?? "neutral" }) => {
  const color = c.color ?? PALETTE[i % PALETTE.length];
  const enter = eOut(prog(t, 0, 0.22));
  let sx = 1, sy = 1, dx = 0, dy = 0, rot = 0;
  const breathe = Math.sin((t + i * 0.7) * 3.2);
  sy = 1 + 0.025 * breathe; sx = 1 - 0.018 * breathe;
  if (mood === "laugh") { const b = Math.abs(Math.sin(t * 11)); dy = -16 * b; sy *= 1 + 0.05 * b; rot = 4 * Math.sin(t * 11); }
  if (mood === "shock") { const p = prog(t, 0, 0.35); dy = -70 * Math.sin(Math.PI * p); dx = 7 * Math.sin(t * 70) * (1 - prog(t, 0.2, 0.6)); sy *= 1 + 0.08 * Math.sin(Math.PI * p); }
  if (mood === "angry") { dx = 5 * Math.sin(t * 55); }
  if (mood === "happy") { dy = -10 * Math.abs(Math.sin(t * 5)); }
  if (mood === "sad" || mood === "cry") { sy *= 0.96; dy = 6; }
  if (mood === "sleep") { rot = -6 + 2 * Math.sin(t * 1.6); }
  if (mood === "love") { const b = Math.abs(Math.sin(t * 4)); dy = -8 * b; sy *= 1 + 0.03 * b; }
  if (mood === "sick") { rot = 3 * Math.sin(t * 2.4); sy *= 0.97; dy = 4; }
  const squash = 1 - 0.1 * (1 - enter);
  const eyes = (() => {
    const L = 72, R = 128, Y = 98;
    const dot = (x: number, ox = 0, oy = 0, r = 11) => (<g key={x}><circle cx={x + ox} cy={Y + oy} r={r} fill={INK} /><circle cx={x + ox - 3} cy={Y + oy - 4} r={r * 0.36} fill="white" /></g>);
    const arc = (x: number, up: boolean) => <path key={x} d={up ? `M${x - 13} ${Y + 5} Q${x} ${Y - 12} ${x + 13} ${Y + 5}` : `M${x - 13} ${Y - 4} Q${x} ${Y + 10} ${x + 13} ${Y - 4}`} stroke={INK} strokeWidth={7} fill="none" strokeLinecap="round" />;
    switch (mood) {
      case "happy": return [arc(L, true), arc(R, true)];
      case "laugh": return [<path key="l" d={`M${L - 12} ${Y - 9} L${L + 8} ${Y} L${L - 12} ${Y + 9}`} stroke={INK} strokeWidth={7} fill="none" strokeLinecap="round" strokeLinejoin="round" />,
        <path key="r" d={`M${R + 12} ${Y - 9} L${R - 8} ${Y} L${R + 12} ${Y + 9}`} stroke={INK} strokeWidth={7} fill="none" strokeLinecap="round" strokeLinejoin="round" />];
      case "shock": return [L, R].map((x) => <g key={x}><circle cx={x} cy={Y} r={21} fill="white" stroke={INK} strokeWidth={5} /><circle cx={x} cy={Y} r={6} fill={INK} /></g>);
      case "sad": case "cry": return [arc(L, false), arc(R, false)];
      case "angry": return [dot(L, 0, 4, 9), dot(R, 0, 4, 9),
        <path key="bl" d={`M${L - 16} ${Y - 22} L${L + 12} ${Y - 10}`} stroke={INK} strokeWidth={7} strokeLinecap="round" />,
        <path key="br" d={`M${R + 16} ${Y - 22} L${R - 12} ${Y - 10}`} stroke={INK} strokeWidth={7} strokeLinecap="round" />];
      case "smug": return [L, R].map((x) => <g key={x}><path d={`M${x - 13} ${Y} L${x + 13} ${Y}`} stroke={INK} strokeWidth={7} strokeLinecap="round" /><path d={`M${x - 11} ${Y + 1} Q${x} ${Y + 13} ${x + 11} ${Y + 1}`} fill={INK} /></g>);
      case "shy": return [dot(L, 7, 4, 9), dot(R, 7, 4, 9)];
      case "think": return [dot(L, 5, -6, 10), dot(R, 5, -6, 10)];
      case "sleep": return [arc(L, false), arc(R, false)];
      case "love": return [L, R].map((x) => <path key={x} transform={`translate(${x} ${Y}) scale(${1 + 0.12 * Math.abs(Math.sin(t * 8))})`}
        d="M0 10 C-26 -6 -14 -26 0 -13 C14 -26 26 -6 0 10 Z" fill="#ff3d6e" stroke={INK} strokeWidth={3} />);
      case "sick": return [L, R].map((x) => <path key={x} d={`M${x - 13} ${Y - 2} Q${x - 6} ${Y - 9} ${x} ${Y - 2} Q${x + 6} ${Y + 5} ${x + 13} ${Y - 2}`} stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" />);
      default: return [dot(L), dot(R)];
    }
  })();
  const mouth = (() => {
    switch (mood) {
      case "happy": return <path d="M84 128 Q100 152 116 128 Z" fill="#7a1e2c" stroke={INK} strokeWidth={4} strokeLinejoin="round" />;
      case "laugh": return <g><path d="M78 124 Q100 166 122 124 Z" fill="#7a1e2c" stroke={INK} strokeWidth={4} strokeLinejoin="round" /><path d="M90 146 Q100 138 110 146 Q100 156 90 146" fill="#ff7f93" /></g>;
      case "shock": return <ellipse cx={100} cy={140} rx={12} ry={16} fill="#7a1e2c" stroke={INK} strokeWidth={4} />;
      case "sad": case "cry": return <path d="M86 146 Q100 132 114 146" stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" />;
      case "angry": return <path d="M86 144 L100 136 L114 144" stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
      case "smug": return <path d="M88 138 Q104 146 116 130" stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" />;
      case "shy": return <path d="M84 140 q5 -7 10 0 q5 7 10 0 q5 -7 10 0" stroke={INK} strokeWidth={5} fill="none" strokeLinecap="round" />;
      case "think": return <path d="M92 140 L110 138" stroke={INK} strokeWidth={6} strokeLinecap="round" />;
      case "sleep": return <ellipse cx={100} cy={138} rx={6} ry={5} fill={INK} />;
      case "love": return <path d="M86 132 Q100 150 114 132" stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" />;
      case "sick": return <path d="M82 142 q6 -8 12 0 q6 8 12 0 q6 -8 12 0" stroke={INK} strokeWidth={5} fill="none" strokeLinecap="round" />;
      default: return <path d="M88 132 Q100 144 112 132" stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" />;
    }
  })();
  const fall = (k: number) => ((t * 1.3 + k * 0.5) % 1);
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: size, height: size, transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${(c.flip ? -1 : 1) * sx * squash}, ${sy * squash})`, transformOrigin: "50% 92%" }}>
      <svg width={size} height={size} viewBox="0 0 200 200" style={{ overflow: "visible" }}>
        <ellipse cx={100} cy={192} rx={70} ry={9} fill="rgba(0,0,0,.18)" />
        <path d="M100 22 C152 22 184 62 184 114 C184 162 148 188 100 188 C52 188 16 162 16 114 C16 62 48 22 100 22 Z" fill={mood === "angry" ? `color-mix(in srgb, ${color} 70%, #ff4d4d)` : mood === "sick" ? `color-mix(in srgb, ${color} 55%, #8fd18a)` : color} stroke={INK} strokeWidth={6} />
        <ellipse cx={66} cy={54} rx={22} ry={12} fill="white" opacity={0.45} transform="rotate(-25 66 54)" />
        <ellipse cx={58} cy={124} rx={13} ry={8} fill="#ff7aa0" opacity={mood === "shy" || mood === "love" ? 0.95 : 0.55} />
        <ellipse cx={142} cy={124} rx={13} ry={8} fill="#ff7aa0" opacity={mood === "shy" || mood === "love" ? 0.95 : 0.55} />
        {mood === "shy" ? [52, 60, 68, 134, 142, 150].map((x) => <path key={x} d={`M${x} 116 L${x - 4} 132`} stroke="#e0456f" strokeWidth={3} strokeLinecap="round" />) : null}
        <g transform={c.flip ? "translate(200 0) scale(-1 1)" : undefined}>{eyes}{mouth}</g>
        {mood === "cry" ? [0, 1].map((k) => <g key={k}>{[72, 128].map((x) => <path key={x} d={`M${x - 5} ${110 + 60 * fall(k)} q5 -14 10 0 q0 8 -5 8 q-5 0 -5 -8`} fill="#4fb3ff" opacity={1 - fall(k)} />)}</g>) : null}
        {mood === "shock" || mood === "shy" ? <path d="M168 40 q10 16 0 24 q-10 -8 0 -24" fill="#7cc8ff" stroke={INK} strokeWidth={3} /> : null}
        {mood === "angry" ? <g stroke="#e8212e" strokeWidth={6} strokeLinecap="round" transform="translate(160 36)"><path d="M-12 -4 Q-4 -4 -4 -12" fill="none" /><path d="M12 -4 Q4 -4 4 -12" fill="none" /><path d="M-12 4 Q-4 4 -4 12" fill="none" /><path d="M12 4 Q4 4 4 12" fill="none" /></g> : null}
        {mood === "happy" || mood === "laugh" ? [[24, 40], [176, 52]].map(([x, y], k) => <path key={k} d={`M${x} ${y - 10} L${x + 3} ${y - 3} L${x + 10} ${y} L${x + 3} ${y + 3} L${x} ${y + 10} L${x - 3} ${y + 3} L${x - 10} ${y} L${x - 3} ${y - 3} Z`} fill="#FFD84D" stroke={INK} strokeWidth={2} opacity={0.5 + 0.5 * Math.abs(Math.sin(t * 6 + k))} />) : null}
        {mood === "sick" ? [70, 90, 110, 130].map((x, k) => <path key={x} d={`M${x} ${36 + (k % 2) * 6} L${x} ${70 + (k % 2) * 6}`} stroke="#6b5bd6" strokeWidth={5} strokeLinecap="round" opacity={0.7} />) : null}
        {mood === "love" ? [0, 1].map((k) => { const q = (t * 0.7 + k * 0.5) % 1; return <path key={k} transform={`translate(${160 + 14 * k} ${46 - 40 * q}) scale(${0.7 + 0.3 * k})`}
          d="M0 10 C-26 -6 -14 -26 0 -13 C14 -26 26 -6 0 10 Z" fill="#ff3d6e" opacity={1 - q} />; }) : null}
        {mood === "sleep" ? <text x={150} y={40 - 10 * ((t * 0.8) % 1)} fontFamily={TITLE} fontSize={34} fill={INK} opacity={1 - ((t * 0.8) % 1)}>Z</text> : null}
        {mood === "think" ? [0, 1, 2].map((k) => <circle key={k} cx={150 + k * 14} cy={30 - k * 12} r={4 + k * 2} fill="white" stroke={INK} strokeWidth={3} opacity={prog(t, 0.15 * k, 0.15)} />) : null}
      </svg>
      {c.hat ? <div style={{ position: "absolute", left: 0, width: size, top: -size * 0.2, textAlign: "center", fontSize: size * 0.36, lineHeight: 1 }}>{c.hat}</div> : null}
    </div>
  );
};

/** simple drawn backdrops, so each place reads at a glance; h is the box height, the floor is the bottom 260 px.
 *  `sign` is written on the place's board (chalkboard, stage banner, barracks notice, shop sign) */
const Backdrop: React.FC<{ kind: string; h: number; sign?: string; tagged?: boolean }> = ({ kind, h, sign, tagged }) => {
  const F = h - 260, box = (st: React.CSSProperties, k?: number) => <div key={k} style={{ position: "absolute", ...st }} />;
  const wall = (c1: string, c2: string, floor: string) => (
    <>{box({ inset: 0, background: `linear-gradient(180deg, ${c1}, ${c2})` })}{box({ left: 0, right: 0, top: F, bottom: 0, background: floor })}
      {box({ left: 0, right: 0, top: F - 10, height: 14, background: "rgba(0,0,0,.12)" })}</>
  );
  const write = (left: number, top: number, width: number, height: number, color: string, size = 64) => sign ? (
    <div style={{ position: "absolute", left, top, width, height, display: "flex", justifyContent: "center", alignItems: "center", textAlign: "center",
      fontFamily: BODY, fontWeight: 900, fontSize: Math.min(size, fitText({ text: sign, withinWidth: width - 60, fontFamily: BODY, fontWeight: "900" }).fontSize), color, lineHeight: 1.2, wordBreak: "keep-all" }}>{sign}</div>
  ) : null;
  switch (kind) {
    case "class": return (<>{wall("#f6efdc", "#efe3c4", "#c99a64")}
      {box({ left: 150, top: 150, width: 780, height: 330, background: "#2f5d46", border: "18px solid #9b6a3c", borderRadius: 10 })}
      {sign ? write(168, 168, 744, 294, "rgba(255,255,240,.92)") : <>{box({ left: 210, top: 230, width: 300, height: 8, background: "rgba(255,255,255,.35)", borderRadius: 4 })}
        {box({ left: 210, top: 280, width: 420, height: 8, background: "rgba(255,255,255,.28)", borderRadius: 4 })}</>}
      {box({ right: 60, top: 60, width: 90, height: 90, borderRadius: 45, background: "white", border: "8px solid #333" })}
      {box({ right: 108, top: 82, width: 6, height: 30, background: "#333", borderRadius: 3 })}{box({ right: 108, top: 106, width: 26, height: 6, background: "#333", borderRadius: 3 })}</>);
    case "home": return (<>{wall("#ffe7dc", "#ffd9c7", "#d9a978")}
      {box({ left: 90, top: 140, width: 300, height: 330, background: "linear-gradient(180deg,#bfe6ff,#e9f7ff)", border: "16px solid #fff", boxShadow: "0 0 0 6px #c9a58a" })}
      {box({ left: 232, top: 140, width: 14, height: 330, background: "#fff" })}{box({ left: 90, top: 298, width: 300, height: 14, background: "#fff" })}
      {box({ right: 80, top: F - 210, width: 380, height: 150, background: "#e2725b", borderRadius: "40px 40px 16px 16px" })}</>);
    case "street": return (<>{box({ inset: 0, background: "linear-gradient(180deg,#8fd0ff,#e6f6ff)" })}
      {[[40, 300, 170], [230, 180, 150], [400, 340, 190], [610, 230, 160], [790, 380, 210]].map(([x, top, w], k) =>
        box({ left: x, top, width: w, height: F - top, background: k % 2 ? "#b9c8dc" : "#cdd8e6", borderRadius: "10px 10px 0 0" }, k))}
      {box({ left: 0, right: 0, top: F, bottom: 0, background: "#9aa3ad" })}{box({ left: 0, right: 0, top: F, height: 26, background: "#d8dde2" })}</>);
    case "store": return (<>{wall("#fbfbf6", "#f1f1ea", "#dcdfe3")}
      {box({ left: 0, right: 0, top: 0, height: 120, background: "linear-gradient(90deg,#2bb3a0,#3d7bd9)" })}{tagged ? write(400, 0, 680, 120, "white", 62) : write(0, 0, 1080, 120, "white", 62)}
      {[200, 350, 500].map((y, k) => <div key={k} style={{ position: "absolute", left: 60, right: 60, top: y, height: 110, display: "flex", gap: 14, alignItems: "flex-end", borderBottom: "14px solid #b8bec7" }}>
        {Array.from({ length: 12 }, (_, j) => <div key={j} style={{ flex: 1, height: 60 + ((j * 37 + k * 11) % 40), borderRadius: 8, background: PALETTE[(j + k) % PALETTE.length] }} />)}
      </div>)}</>);
    case "army": return (<>{wall("#e3e6cf", "#d6dabb", "#8f8a66")}
      {[60, 220, 380].map((x, k) => box({ left: x, top: 170, width: 140, height: F - 170, background: "#9aa38a", border: "6px solid #6f7760", borderRadius: 6 }, k))}
      {box({ right: 70, top: 150, width: 340, height: 210, background: "#f6f3e6", border: "10px solid #6f7760" })}{write(1080 - 70 - 340 + 10, 160, 320, 190, "#3c4a2c", 54)}</>);
    case "night": return (<>{box({ inset: 0, background: "linear-gradient(180deg,#141a3a,#2b3170)" })}
      {Array.from({ length: 26 }, (_, k) => box({ left: (k * 397) % 1040 + 20, top: (k * 211) % (F - 80) + 30, width: 6 + (k % 3) * 3, height: 6 + (k % 3) * 3, borderRadius: 9, background: "#fff7c2" }, k))}
      {box({ right: 110, top: 90, width: 130, height: 130, borderRadius: 65, background: "#fff1a8", boxShadow: "0 0 60px #fff1a8" })}
      {box({ left: 0, right: 0, top: F, bottom: 0, background: "#1b1f3d" })}</>);
    case "stage": return (<>{box({ inset: 0, background: "linear-gradient(180deg,#3a1f2a,#5b2a3a)" })}
      {box({ left: 0, top: 0, width: 150, height: F, background: "repeating-linear-gradient(90deg,#b3123a 0 30px,#8e0e2e 30px 60px)" })}
      {box({ right: 0, top: 0, width: 150, height: F, background: "repeating-linear-gradient(90deg,#b3123a 0 30px,#8e0e2e 30px 60px)" })}
      {box({ left: 200, top: 120, width: 680, height: 130, background: "#fff4d6", border: "8px solid #d8a93a", borderRadius: 12 })}{write(208, 128, 664, 114, "#8e0e2e", 66)}
      {box({ left: 0, right: 0, top: F, bottom: 0, background: "#a8743f" })}</>);
    case "office": return (<>{wall("#eef2f7", "#e3e9f1", "#b7c0cc")}
      {[0, 1, 2].map((k) => box({ left: 110 + k * 300, top: 140, width: 240, height: 300, background: "linear-gradient(180deg,#cfe8ff,#f2f9ff)", border: "12px solid #fff", boxShadow: "0 0 0 5px #b9c3cf" }, k))}
      {box({ left: 60, right: 60, top: F - 40, height: 40, background: "#c9a37a", borderRadius: 8 })}</>);
    case "door": return (<>{wall("#efe6d8", "#e6dac8", "#b9a58c")}
      {box({ left: 560, top: 110, width: 330, height: F - 100, background: "linear-gradient(90deg,#8a5a3c,#7a4e33)", border: "12px solid #5e3b26", borderBottom: "none", borderRadius: "8px 8px 0 0" })}
      {box({ left: 655, top: 140, width: 140, height: 56, background: "#f3e7c9", border: "4px solid #5e3b26", borderRadius: 8 })}{write(655, 140, 140, 56, "#5e3b26", 34)}
      {box({ left: 712, top: 240, width: 26, height: 26, borderRadius: 13, background: "#2b2b2b", border: "5px solid #d9c27a" })}
      {box({ left: 598, top: F / 2 + 60, width: 60, height: 18, background: "#d9c27a", borderRadius: 9, boxShadow: "0 3px 0 #9c8540" })}
      {box({ left: 930, top: 400, width: 74, height: 116, background: "#f7f7f7", border: "5px solid #8a8a8a", borderRadius: 12 })}
      {box({ left: 953, top: 452, width: 28, height: 28, borderRadius: 14, background: "#ff5a5a" })}
      {box({ left: 590, top: F + 18, width: 270, height: 34, background: "#7d6b5a", borderRadius: 8 })}</>);
    default: return box({ inset: 0, background: kind });
  }
};

/** one beat of the story: the characters on a backdrop, a speech bubble, a prop, a place tag, a time-skip card */
export const Scene: React.FC<{ g: SceneG & { steps?: number[] }; t: number; h: number }> = ({ g, t, h }) => {
  const n = g.chars.length;
  const size = n === 1 ? 430 : n === 2 ? 380 : 300, sz = g.chars.map((c) => size * (c.size ?? 1));  // c.size: taller or shorter than the rest
  const xs = g.chars.map((c, i) => c.x ?? (n === 1 ? (g.prop ? 0.4 : 0.5) : n === 2 ? [0.28, 0.72][i] : [0.2, 0.5, 0.8][i]));
  const foot = h - 76, baseY = foot - size;  // feet on the floor, with room for the name tags under them
  const sayAt = g.steps?.[0] ?? 0.05, propAt = g.steps?.[1] ?? 0.1, swAt = g.steps?.[2] ?? 1e9, bigAt = g.steps?.[3] ?? 0.1;
  // the bubble sits over its speaker (kept on screen), its tail pointing down at them
  let bubble: { left: number; top: number; w: number; size: number; tail: number } | null = null;
  if (g.say) {
    const text = g.say.text.replace(/[[\]]/g, ""), maxW = 940, pad = 46, inner = maxW - 2 * pad - 12;
    const fit1 = (width: number) => fitText({ text, withinWidth: width, fontFamily: BODY, fontWeight: "900" }).fontSize;
    // too long for a big single line: two lines at a bigger size (fitted to a bit under twice the width, as words break unevenly)
    const one = fit1(inner), fs = Math.max(50, Math.min(76, one >= 60 ? one : fit1(inner * 2 * 0.88)));
    const tw = measureText({ text, fontFamily: BODY, fontSize: fs, fontWeight: "900" }).width, w = Math.min(maxW, tw + 2 * pad + 12);
    const bh = Math.ceil(tw / (inner * 0.9)) * fs * 1.25 + 60;  // just above the speaker's head, tail included
    const sx = (xs[g.say.who] ?? 0.5) * 1080, left = clamp(sx - w / 2, 24, 1080 - 24 - w);
    bubble = { left, top: Math.max(120, foot - (sz[g.say.who] ?? size) - bh - 64), w, size: fs, tail: clamp(sx - left - 30, 34, w - 94) };
  }
  const bub = bubble ? eBack(prog(t, sayAt, 0.28), 2.2) : 0;
  const px = g.propX ?? (n === 1 ? Math.min(0.84, xs[0] + 0.36) : 0.5), py = n === 1 ? baseY + 40 : n === 2 ? baseY - 70 : baseY - 200;
  const z = 1 + ((g.zoom ?? 1) - 1) * eInOut(prog(t, 0, 3));
  const fx = g.focus != null ? xs[g.focus] * 1080 : 540;
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${z})`, transformOrigin: `${fx}px ${baseY + size / 2}px` }}>
        <Backdrop kind={g.bg ?? "linear-gradient(180deg, #fff6e8 0%, #ffe9cf 100%)"} h={h} sign={g.sign} tagged={!!g.place} />
        {g.prop ? (
          <div style={{ position: "absolute", left: px * 1080, top: py, fontSize: 190, lineHeight: 1, whiteSpace: "nowrap",
            transform: `translateX(-50%) scale(${eBack(prog(t, propAt, 0.3), 2.4)}) rotate(${6 * Math.sin(t * 4)}deg)`, filter: "drop-shadow(0 10px 10px rgba(0,0,0,.25))" }}>{g.prop}</div>
        ) : null}
        {g.chars.map((c, i) => {
          const sw = !!c.to && t >= swAt;
          return (
            <div key={i} style={{ position: "absolute", left: xs[i] * 1080 - sz[i] / 2, top: foot - sz[i], width: sz[i], height: sz[i] }}>
              <Mochi c={c} i={i} t={sw ? t - swAt : t} size={sz[i]} mood={sw ? c.to : c.mood} />
              {c.name ? (
                <div style={{ position: "absolute", left: -100, right: -100, top: sz[i] + 2, textAlign: "center" }}>
                  <span style={{ fontFamily: BODY, fontWeight: 900, fontSize: 40, color: "white", background: INK, borderRadius: 14, padding: "4px 18px" }}>{c.name}</span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {g.place ? (
        <div style={{ position: "absolute", left: 36, top: 30, fontFamily: BODY, fontWeight: 900, fontSize: 42, color: INK, background: "white", border: `5px solid ${INK}`,
          borderRadius: 999, padding: "6px 26px", boxShadow: `5px 5px 0 ${INK}` }}>{g.place}</div>
      ) : null}
      {g.big ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: 150, textAlign: "center", fontFamily: TITLE, fontSize: 160, lineHeight: 1, color: "#FFE14D",
          WebkitTextStroke: "18px black", paintOrder: "stroke", transform: `scale(${eBack(prog(t, bigAt, 0.3), 2.4)}) rotate(-4deg)`, filter: "drop-shadow(0 10px 14px rgba(0,0,0,.35))" }}>
          <Marked text={g.big} color="#ff4d6d" />
        </div>
      ) : null}
      {bubble && g.say ? (
        <div style={{ position: "absolute", left: bubble.left, top: bubble.top, width: bubble.w, transform: `scale(${bub})`, transformOrigin: `${bubble.tail + 30}px 100%`, opacity: clamp(bub * 2) }}>
          <div style={{ position: "relative", background: "white", border: `6px solid ${INK}`, borderRadius: 40, padding: "24px 40px", boxShadow: `8px 8px 0 ${INK}`,
            fontFamily: BODY, fontWeight: 900, fontSize: bubble.size, lineHeight: 1.25, color: INK, textAlign: "center", wordBreak: "keep-all" }}>
            <Marked text={g.say.text} color="#e8212e" />
            <svg width={60} height={50} style={{ position: "absolute", left: bubble.tail - 6, bottom: -46 }} viewBox="0 0 60 50">
              <path d="M6 0 L30 46 L54 0 Z" fill="white" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
              <rect x={4} y={-6} width={52} height={10} fill="white" />
            </svg>
          </div>
        </div>
      ) : null}
      {g.card ? (
        <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "center", alignItems: "center", background: "rgba(0,0,0,.55)", opacity: prog(t, 0, 0.15) }}>
          <div style={{ fontFamily: TITLE, fontSize: 120, color: "white", WebkitTextStroke: "14px black", paintOrder: "stroke", transform: `scale(${eBack(prog(t, 0, 0.3), 2)})` }}>
            <Marked text={g.card} />
          </div>
        </div>
      ) : null}
    </div>
  );
};

/** the hook: a community-app post (no real service's branding) filling the frame, its body lines revealed by steps */
export const Post: React.FC<{ g: PostG & { steps?: number[] }; t: number }> = ({ g, t }) => {
  const titleSize = Math.max(62, Math.min(84, fitText({ text: g.title.replace(/[[\]]/g, ""), withinWidth: 2 * 880, fontFamily: BODY, fontWeight: "900" }).fontSize));
  return (
    <div style={{ position: "absolute", inset: 0, background: "#eef0f4", display: "flex", alignItems: g.chars?.length ? "flex-start" : "center", justifyContent: "center", paddingTop: g.chars?.length ? 40 : 0 }}>
      <div style={{ width: 1000, background: "white", borderRadius: 40, boxShadow: "0 18px 40px rgba(0,0,0,.16)", padding: "44px 50px 40px", transform: `translateY(${30 * (1 - eOut(prog(t, 0, 0.3)))}px)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontFamily: BODY, fontWeight: 800, fontSize: 38, color: "#6b7280" }}>
          <span>{g.board ?? "썰 게시판"}</span>
          {g.hot ? <span style={{ fontSize: 32, color: "white", background: "#ff4d4f", borderRadius: 12, padding: "2px 14px" }}>🔥 인기글</span> : null}
        </div>
        <div style={{ fontFamily: BODY, fontWeight: 900, fontSize: titleSize, lineHeight: 1.25, color: INK, marginTop: 22, wordBreak: "keep-all" }}><Marked text={g.title} color="#e8212e" /></div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 22, fontFamily: BODY, fontWeight: 700, fontSize: 34, color: "#9aa0aa" }}>
          <div style={{ width: 54, height: 54, borderRadius: 27, background: "#d9dde4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>👤</div>
          <span>{g.meta ?? "익명 · 창작 썰"}</span>
        </div>
        <div style={{ height: 4, background: "#eef0f4", margin: "30px 0" }} />
        {(g.body ?? []).map((line, i) => {
          const at = g.steps?.[i] ?? 0.4 + 0.6 * i, o = prog(t, at, 0.2);
          return (
            <div key={i} style={{ fontFamily: BODY, fontWeight: 700, fontSize: 54, lineHeight: 1.45, color: "#2b2f36", opacity: o, transform: `translateY(${12 * (1 - o)}px)` }}>
              <Marked text={line} color="#e8212e" />
            </div>
          );
        })}
        {g.likes || g.comments ? (
          <div style={{ display: "flex", gap: 34, marginTop: 30, fontFamily: BODY, fontWeight: 800, fontSize: 38, color: "#ff4d4f" }}>
            {g.likes ? <span>👍 {g.likes}</span> : null}{g.comments ? <span style={{ color: "#4a90e2" }}>💬 {g.comments}</span> : null}
          </div>
        ) : null}
      </div>
      {(g.chars ?? []).slice(0, 2).map((c, i, all) => {
        const size = all.length === 1 ? 330 : 280, x = all.length === 1 ? 0.8 : [0.62, 0.86][i];
        return (
          <div key={i} style={{ position: "absolute", left: x * 1080 - size / 2, bottom: 26, width: size, height: size }}>
            <Mochi c={c} i={i} t={t} size={size} />
          </div>
        );
      })}
    </div>
  );
};
