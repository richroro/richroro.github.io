// A chibi person (or dog) for the story shorts' scenes (lib/Sseol.tsx), picked with "style": "chibi" on a scene character.
// The mochi characters are one shape in different colours, so a mum, a grandma and a shop owner looked the same; a chibi
// has a skin-tone head, a hairdo, clothes and an age, so who is who reads at a glance. Same 13 moods and the same
// motions as the mochi, in the same 200x200 box (feet at the bottom), so a scene places it like any other character.
import React from "react";
import { TITLE } from "./fonts";
import { eOut, prog } from "./fx";
import type { Char, Mood } from "./Sseol";

const INK = "#1b1b1f";

/** how a chibi looks. hairdo: "short" "spiky" "side" "buzz" "long" "bob" "pony" "pigtails" "bun" "perm" "bald";
 *  top: "tee" "hoodie" "shirt" "suit" "cardigan" "uniform" (school blazer) "apron" "dress" "vest" "gown" (patient);
 *  age: "baby" "kid" "teen" "adult" "old"; kind "dog" draws a puppy (fur = hair colour) */
export type Look = {
  kind?: "person" | "dog";
  skin?: string; hair?: string; hairdo?: string;
  top?: string; topKind?: string; pants?: string;
  age?: "baby" | "kid" | "teen" | "adult" | "old";
  glasses?: boolean; mustache?: boolean; blush?: boolean;
  /** a hair accessory or hat: "ribbon" "pin" "cap" "headband" */
  acc?: string; accColor?: string;
};

const darker = (c: string, k = 0.22) => `color-mix(in srgb, ${c} ${Math.round((1 - k) * 100)}%, #000)`;

/** the mochi's eyes and mouth for a mood, in the mochi's own coordinates (eyes at y 98, x 72 and 128) */
const face = (mood: Mood, t: number) => {
  const L = 72, R = 128, Y = 98;
  const dot = (x: number, ox = 0, oy = 0, r = 11) => (<g key={x}><circle cx={x + ox} cy={Y + oy} r={r} fill={INK} /><circle cx={x + ox - 3} cy={Y + oy - 4} r={r * 0.36} fill="white" /></g>);
  const arc = (x: number, up: boolean) => <path key={x} d={up ? `M${x - 13} ${Y + 5} Q${x} ${Y - 12} ${x + 13} ${Y + 5}` : `M${x - 13} ${Y - 4} Q${x} ${Y + 10} ${x + 13} ${Y - 4}`} stroke={INK} strokeWidth={7} fill="none" strokeLinecap="round" />;
  const eyes = (() => {
    switch (mood) {
      case "happy": return [arc(L, true), arc(R, true)];
      case "laugh": return [<path key="l" d={`M${L - 12} ${Y - 9} L${L + 8} ${Y} L${L - 12} ${Y + 9}`} stroke={INK} strokeWidth={7} fill="none" strokeLinecap="round" strokeLinejoin="round" />,
        <path key="r" d={`M${R + 12} ${Y - 9} L${R - 8} ${Y} L${R + 12} ${Y + 9}`} stroke={INK} strokeWidth={7} fill="none" strokeLinecap="round" strokeLinejoin="round" />];
      case "shock": return [L, R].map((x) => <g key={x}><circle cx={x} cy={Y} r={19} fill="white" stroke={INK} strokeWidth={5} /><circle cx={x} cy={Y} r={6} fill={INK} /></g>);
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
  return <>{eyes}{mouth}</>;
};

/** hair behind the head (long hair, bob, ponytail, pigtails, bun), drawn before the head */
const backHair = (k: string, c: string, cy: number, r: number) => {
  const s = { fill: c, stroke: INK, strokeWidth: 5, strokeLinejoin: "round" as const };
  switch (k) {
    case "long": return <path {...s} d={`M${100 - r - 6} ${cy} C${100 - r - 8} ${cy - r - 10} ${100 + r + 8} ${cy - r - 10} ${100 + r + 6} ${cy} L${100 + r + 12} ${cy + r + 44} Q100 ${cy + r + 58} ${100 - r - 12} ${cy + r + 44} Z`} />;
    case "bob": return <path {...s} d={`M${100 - r - 8} ${cy} C${100 - r - 8} ${cy - r - 12} ${100 + r + 8} ${cy - r - 12} ${100 + r + 8} ${cy} L${100 + r + 10} ${cy + r * 0.62} Q100 ${cy + r * 0.8} ${100 - r - 10} ${cy + r * 0.62} Z`} />;
    case "pony": return <path {...s} d={`M${100 + r - 6} ${cy - r * 0.55} C${100 + r + 40} ${cy - r * 0.7} ${100 + r + 36} ${cy + r * 0.6} ${100 + r + 14} ${cy + r * 0.9} C${100 + r + 18} ${cy + r * 0.3} ${100 + r + 6} ${cy - r * 0.1} ${100 + r - 10} ${cy - r * 0.2} Z`} />;
    case "pigtails": return <>{[-1, 1].map((d) => <ellipse key={d} {...s} cx={100 + d * (r + 14)} cy={cy - r * 0.15} rx={20} ry={30} />)}</>;
    case "bun": return <circle {...s} cx={100} cy={cy - r - 8} r={22} />;
    default: return null;
  }
};

/** hair over the head (bangs, crown); `old` greys nothing here, the colour is the look's */
const frontHair = (k: string, c: string, cy: number, r: number) => {
  const s = { fill: c, stroke: INK, strokeWidth: 5, strokeLinejoin: "round" as const };
  const L = 100 - r, R = 100 + r, T = cy - r;
  switch (k) {
    case "bald": return <>{[-1, 1].map((d) => <path key={d} {...s} d={`M${100 + d * (r - 2)} ${cy - 18} q${d * 14} 14 ${d * 2} 34 q${-d * 10} -8 ${-d * 12} -30 Z`} />)}</>;
    case "buzz": return <path {...s} d={`M${L + 2} ${cy - 6} C${L} ${T - 4} ${R} ${T - 4} ${R - 2} ${cy - 6} C${R - 18} ${T + 18} ${L + 18} ${T + 18} ${L + 2} ${cy - 6} Z`} />;
    case "spiky": return <path {...s} d={`M${L - 4} ${cy + 4} L${L - 6} ${T + 22} L${L + 10} ${T + 16} L${L + 14} ${T - 10} L${L + 36} ${T + 6} L${100} ${T - 20} L${R - 34} ${T + 4} L${R - 12} ${T - 12} L${R - 8} ${T + 16} L${R + 6} ${T + 20} L${R + 4} ${cy + 4} C${R - 10} ${T + 30} ${L + 10} ${T + 30} ${L - 4} ${cy + 4} Z`} />;
    case "side": return <path {...s} d={`M${L - 4} ${cy + 6} C${L - 8} ${T - 8} ${R + 8} ${T - 8} ${R + 4} ${cy + 6} C${R - 4} ${T + 26} ${100 + 6} ${T + 28} ${L + 30} ${T + 18} C${L + 18} ${T + 30} ${L + 4} ${cy - 10} ${L - 4} ${cy + 6} Z`} />;
    case "perm": return <g {...s}>{Array.from({ length: 11 }, (_, k) => { const a = Math.PI * (1.02 + 0.96 * k / 10); return <circle key={k} cx={100 + Math.cos(a) * (r + 2)} cy={cy - 6 + Math.sin(a) * (r + 2)} r={k % 2 ? 17 : 20} />; })}
      <path stroke="none" fill={c} d={`M${L + 6} ${cy - 8} C${L + 6} ${T + 4} ${R - 6} ${T + 4} ${R - 6} ${cy - 8} Z`} /></g>;
    case "long": case "bob": case "pony": case "pigtails": case "bun": case "short": default:
      // bangs: a cap over the crown with a fringe across the forehead
      return <path {...s} d={`M${L - 4} ${cy + (k === "short" ? 0 : 14)} C${L - 8} ${T - 10} ${R + 8} ${T - 10} ${R + 4} ${cy + (k === "short" ? 0 : 14)} C${R - 6} ${T + 34} ${R - 22} ${T + 30} ${R - 30} ${T + 24} Q${100 + 6} ${T + 40} ${100 - 6} ${T + 26} Q${L + 22} ${T + 40} ${L + 10} ${T + 26} C${L + 4} ${T + 34} ${L} ${cy - 4} ${L - 4} ${cy + (k === "short" ? 0 : 14)} Z`} />;
  }
};

/** the body: clothes over a torso, little arms with hands, legs and shoes; y0 is the neck, y1 the soles */
const Body: React.FC<{ l: Look; y0: number; y1: number; w: number; skin: string; mood: Mood; t: number }> = ({ l, y0, y1, w, skin, mood, t }) => {
  const top = l.top ?? "#6FA8FF", kind = l.topKind ?? "tee", pants = l.pants ?? "#3d4a66";
  const legTop = kind === "dress" || kind === "gown" ? y1 - 10 : y1 - (y1 - y0) * 0.3, half = w / 2;
  const torso = `M${100 - half * 0.78} ${y0 + 4} Q100 ${y0 - 6} ${100 + half * 0.78} ${y0 + 4} L${100 + half} ${legTop + 4} Q100 ${legTop + 12} ${100 - half} ${legTop + 4} Z`;
  const skirt = `M${100 - half * 0.78} ${y0 + 4} Q100 ${y0 - 6} ${100 + half * 0.78} ${y0 + 4} L${100 + half * 1.25} ${y1 - 8} Q100 ${y1} ${100 - half * 1.25} ${y1 - 8} Z`;
  const s = { stroke: INK, strokeWidth: 5, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  // arms by mood: up for shock/happy, on the hips when angry, hanging otherwise
  const wave = Math.sin(t * 9) * 6;
  const sh = y0 + 12, ax = half * 0.82;
  const arm = (d: number): [number, number] => {
    switch (mood) {
      case "shock": return [100 + d * (half + 26), y0 - 26 + (d > 0 ? wave : -wave) * 0.4];
      case "happy": case "laugh": return [100 + d * (half + 30), y0 - 10 + (d > 0 ? wave : -wave)];
      case "angry": return [100 + d * (half - 6), y0 + 40];
      case "shy": case "love": return [100 + d * 10, y0 + 40];
      case "think": return d > 0 ? [100 + 18, y0 - 4] : [100 - half - 10, y0 + 44];
      default: return [100 + d * (half + 12), y0 + 46];
    }
  };
  const sleeve = kind === "dress" || kind === "vest" ? skin : kind === "apron" ? (l.top ?? "#fff") : top;
  return (
    <g>
      {kind !== "dress" && kind !== "gown" ? [-1, 1].map((d) => <path key={d} {...s} fill={pants} d={`M${100 + d * 4} ${legTop} L${100 + d * (half * 0.78)} ${legTop} L${100 + d * (half * 0.7)} ${y1 - 8} L${100 + d * 6} ${y1 - 8} Z`} />) : null}
      {[-1, 1].map((d) => <ellipse key={`s${d}`} {...s} cx={100 + d * half * 0.42} cy={y1 - 6} rx={half * 0.36} ry={7} fill={l.age === "baby" ? skin : "#2b2b2f"} />)}
      {[-1, 1].map((d) => { const [hx, hy] = arm(d); return <g key={`a${d}`}><path d={`M${100 + d * ax} ${sh} Q${100 + d * (ax + 14)} ${(sh + hy) / 2 + 6} ${hx} ${hy}`} stroke={INK} strokeWidth={20} fill="none" strokeLinecap="round" />
        <path d={`M${100 + d * ax} ${sh} Q${100 + d * (ax + 14)} ${(sh + hy) / 2 + 6} ${hx} ${hy}`} stroke={sleeve} strokeWidth={11} fill="none" strokeLinecap="round" />
        <circle cx={hx} cy={hy} r={8} fill={skin} stroke={INK} strokeWidth={4} /></g>; })}
      <path {...s} fill={top} d={kind === "dress" || kind === "gown" ? skirt : torso} />
      {kind === "gown" ? [0, 1, 2].map((k) => <path key={k} d={`M${100 - half * 0.5 + k * half * 0.5} ${y0 + 8} L${100 - half * 0.6 + k * half * 0.6} ${y1 - 12}`} stroke="rgba(0,0,0,.18)" strokeWidth={6} />) : null}
      {kind === "tee" || kind === "dress" ? <path d={`M${100 - 12} ${y0 + 1} Q100 ${y0 + 14} ${100 + 12} ${y0 + 1}`} stroke={INK} strokeWidth={4} fill={skin} /> : null}
      {kind === "hoodie" ? <><path {...s} fill={darker(top, 0.12)} d={`M${100 - 22} ${y0 - 2} Q100 ${y0 + 20} ${100 + 22} ${y0 - 2}`} />
        <rect x={100 - half * 0.45} y={legTop - 26} width={half * 0.9} height={18} rx={8} fill={darker(top, 0.15)} stroke={INK} strokeWidth={3} /></> : null}
      {kind === "shirt" || kind === "suit" || kind === "uniform" || kind === "cardigan" ? (
        <path d={`M${100 - 16} ${y0 + 2} L100 ${y0 + 30} L${100 + 16} ${y0 + 2} Z`} fill="white" stroke={INK} strokeWidth={4} strokeLinejoin="round" />) : null}
      {kind === "suit" ? <path d={`M100 ${y0 + 8} l-6 8 l6 26 l6 -26 Z`} fill={l.accColor ?? "#d33b3b"} stroke={INK} strokeWidth={3} strokeLinejoin="round" /> : null}
      {kind === "uniform" ? <path d={`M${100 - 12} ${y0 + 14} L100 ${y0 + 22} L${100 + 12} ${y0 + 14} L${100 + 12} ${y0 + 28} L100 ${y0 + 22} L${100 - 12} ${y0 + 28} Z`} fill={l.accColor ?? "#e0464f"} stroke={INK} strokeWidth={3} /> : null}
      {kind === "cardigan" ? <><path d={`M100 ${y0 + 28} L100 ${legTop + 6}`} stroke={INK} strokeWidth={4} />{[0, 1, 2].map((k) => <circle key={k} cx={100 + 7} cy={y0 + 38 + k * ((legTop - y0 - 40) / 3)} r={3.5} fill={INK} />)}</> : null}
      {kind === "suit" || kind === "uniform" ? <path d={`M100 ${y0 + 30} L100 ${legTop + 6}`} stroke={INK} strokeWidth={3} opacity={0.6} /> : null}
      {kind === "apron" ? <path {...s} fill={l.accColor ?? "#fff3c4"} d={`M${100 - half * 0.5} ${y0 + 14} L${100 + half * 0.5} ${y0 + 14} L${100 + half * 0.66} ${legTop + 6} Q100 ${legTop + 12} ${100 - half * 0.66} ${legTop + 6} Z`} /> : null}
      {kind === "vest" ? <><path d={`M${100 - 14} ${y0 + 2} L100 ${y0 + 22} L${100 + 14} ${y0 + 2}`} fill={skin} stroke={INK} strokeWidth={4} />
        <rect x={100 + half * 0.25} y={y0 + 26} width={half * 0.4} height={12} rx={3} fill="rgba(255,255,255,.75)" stroke={INK} strokeWidth={3} /></> : null}
    </g>
  );
};

/** a chibi in a mood; same props as the mochi (t: seconds since the scene started) */
export const Chibi: React.FC<{ c: Char; i: number; t: number; size: number; mood?: Mood }> = ({ c, i, t, size, mood = c.mood ?? "neutral" }) => {
  const l: Look = c.look ?? {};
  const enter = eOut(prog(t, 0, 0.22));
  let sx = 1, sy = 1, dx = 0, dy = 0, rot = 0;
  const breathe = Math.sin((t + i * 0.7) * 3.2);
  sy = 1 + 0.02 * breathe; sx = 1 - 0.014 * breathe;
  if (mood === "laugh") { const b = Math.abs(Math.sin(t * 11)); dy = -14 * b; rot = 4 * Math.sin(t * 11); }
  if (mood === "shock") { const p = prog(t, 0, 0.35); dy = -60 * Math.sin(Math.PI * p); dx = 7 * Math.sin(t * 70) * (1 - prog(t, 0.2, 0.6)); }
  if (mood === "angry") { dx = 5 * Math.sin(t * 55); }
  if (mood === "happy") { dy = -10 * Math.abs(Math.sin(t * 5)); }
  if (mood === "sad" || mood === "cry") { sy *= 0.97; dy = 5; }
  if (mood === "sleep") { rot = -6 + 2 * Math.sin(t * 1.6); }
  if (mood === "love") { dy = -8 * Math.abs(Math.sin(t * 4)); }
  if (mood === "sick") { rot = 3 * Math.sin(t * 2.4); dy = 4; }
  const squash = 1 - 0.1 * (1 - enter);
  const age = l.age ?? "adult", old = age === "old", dog = l.kind === "dog";
  const skin = l.skin ?? "#FFDCC4";
  const hair = l.hair ?? (old ? "#e9e9ee" : "#3a2a22");
  // head size and where the neck starts: babies and kids are mostly head
  const r = age === "baby" ? 64 : age === "kid" ? 60 : 56, cy = age === "baby" ? 92 : age === "kid" ? 76 : 70;
  const y0 = cy + r - 6, y1 = 196, w = age === "baby" ? 74 : age === "kid" ? 76 : 86;
  const fsc = r / 76;  // the mochi face (eyes 56 apart) scaled onto this head
  const faceT = `translate(100 ${cy + r * 0.12}) scale(${fsc}) translate(-100 -98)`;
  const fall = (k: number) => ((t * 1.3 + k * 0.5) % 1);
  const fx = (
    <>
      {mood === "cry" ? [0, 1].map((k) => <g key={k}>{[100 - 28 * fsc / 0.74, 100 + 28 * fsc / 0.74].map((x) => <path key={x} d={`M${x - 5} ${cy + 16 + 50 * fall(k)} q5 -14 10 0 q0 8 -5 8 q-5 0 -5 -8`} fill="#4fb3ff" opacity={1 - fall(k)} />)}</g>) : null}
      {mood === "shock" || mood === "shy" ? <path d={`M${100 + r + 8} ${cy - r + 8} q10 16 0 24 q-10 -8 0 -24`} fill="#7cc8ff" stroke={INK} strokeWidth={3} /> : null}
      {mood === "angry" ? <g stroke="#e8212e" strokeWidth={6} strokeLinecap="round" transform={`translate(${100 + r - 2} ${cy - r + 6})`}><path d="M-12 -4 Q-4 -4 -4 -12" fill="none" /><path d="M12 -4 Q4 -4 4 -12" fill="none" /><path d="M-12 4 Q-4 4 -4 12" fill="none" /><path d="M12 4 Q4 4 4 12" fill="none" /></g> : null}
      {mood === "happy" || mood === "laugh" ? [[100 - r - 18, cy - r + 6], [100 + r + 18, cy - r + 18]].map(([x, y], k) => <path key={k} d={`M${x} ${y - 10} L${x + 3} ${y - 3} L${x + 10} ${y} L${x + 3} ${y + 3} L${x} ${y + 10} L${x - 3} ${y + 3} L${x - 10} ${y} L${x - 3} ${y - 3} Z`} fill="#FFD84D" stroke={INK} strokeWidth={2} opacity={0.5 + 0.5 * Math.abs(Math.sin(t * 6 + k))} />) : null}
      {mood === "sick" ? [-24, -8, 8, 24].map((x, k) => <path key={x} d={`M${100 + x} ${cy - r * 0.5 + (k % 2) * 6} L${100 + x} ${cy - r * 0.1 + (k % 2) * 6}`} stroke="#6b5bd6" strokeWidth={5} strokeLinecap="round" opacity={0.6} />) : null}
      {mood === "love" ? [0, 1].map((k) => { const q = (t * 0.7 + k * 0.5) % 1; return <path key={k} transform={`translate(${100 + r + 6 + 14 * k} ${cy - r + 10 - 40 * q}) scale(${0.7 + 0.3 * k})`}
        d="M0 10 C-26 -6 -14 -26 0 -13 C14 -26 26 -6 0 10 Z" fill="#ff3d6e" opacity={1 - q} />; }) : null}
      {mood === "sleep" ? <text x={100 + r} y={cy - r + 10 - 10 * ((t * 0.8) % 1)} fontFamily={TITLE} fontSize={34} fill={INK} opacity={1 - ((t * 0.8) % 1)}>Z</text> : null}
      {mood === "think" ? [0, 1, 2].map((k) => <circle key={k} cx={100 + r + 4 + k * 14} cy={cy - r + 8 - k * 12} r={4 + k * 2} fill="white" stroke={INK} strokeWidth={3} opacity={prog(t, 0.15 * k, 0.15)} />) : null}
    </>
  );
  const s = { stroke: INK, strokeWidth: 5, strokeLinejoin: "round" as const };
  let art: React.ReactNode;
  if (dog) {
    const fur = l.hair ?? "#c98a4b", dcy = 96, dr = 62;
    art = (
      <>
        <ellipse cx={100} cy={170} rx={58} ry={28} fill={fur} {...s} />
        {[-1, 1].map((d) => <ellipse key={d} cx={100 + d * 30} cy={190} rx={16} ry={9} fill={fur} {...s} />)}
        <path d={`M${100 + 52} 160 q30 -20 22 -44`} stroke={INK} strokeWidth={14} fill="none" strokeLinecap="round" transform={`rotate(${12 * Math.sin(t * 14)} 152 160)`} />
        <path d={`M${100 + 52} 160 q30 -20 22 -44`} stroke={fur} strokeWidth={6} fill="none" strokeLinecap="round" transform={`rotate(${12 * Math.sin(t * 14)} 152 160)`} />
        <circle cx={100} cy={dcy} r={dr} fill={fur} {...s} />
        {[-1, 1].map((d) => <path key={`e${d}`} {...s} fill={darker(fur, 0.3)} d={`M${100 + d * 40} ${dcy - 50} C${100 + d * 82} ${dcy - 50} ${100 + d * 84} ${dcy + 10} ${100 + d * 66} ${dcy + 24} C${100 + d * 52} ${dcy + 8} ${100 + d * 44} ${dcy - 20} ${100 + d * 40} ${dcy - 50} Z`} />)}
        <ellipse cx={100} cy={dcy + 26} rx={30} ry={22} fill="#fbeedd" {...s} />
        <g transform={`translate(100 ${dcy - 4}) scale(0.8) translate(-100 -98)`}>{face(mood, t)}</g>
        <ellipse cx={100} cy={dcy + 14} rx={11} ry={8} fill={INK} />
        {l.acc ? <rect x={66} y={dcy + 50} width={68} height={12} rx={6} fill={l.accColor ?? "#e8212e"} stroke={INK} strokeWidth={4} /> : null}
      </>
    );
  } else {
    art = (
      <>
        {backHair(l.hairdo ?? "short", hair, cy, r)}
        <Body l={l} y0={y0} y1={y1} w={w} skin={skin} mood={mood} t={t} />
        {[-1, 1].map((d) => <circle key={d} cx={100 + d * (r - 2)} cy={cy + 8} r={11} fill={skin} {...s} />)}
        <circle cx={100} cy={cy} r={r} fill={mood === "angry" ? `color-mix(in srgb, ${skin} 75%, #ff5a5a)` : mood === "sick" ? `color-mix(in srgb, ${skin} 70%, #9fd39a)` : skin} {...s} />
        {[-1, 1].map((d) => <ellipse key={`c${d}`} cx={100 + d * r * 0.52} cy={cy + r * 0.38} rx={10} ry={6} fill="#ff8aa8" opacity={mood === "shy" || mood === "love" || l.blush ? 0.9 : 0.45} />)}
        {old ? [-1, 1].map((d) => <path key={`w${d}`} d={`M${100 + d * r * 0.62} ${cy + 2} l${d * 9} -5 M${100 + d * r * 0.62} ${cy + 9} l${d * 10} 1`} stroke={INK} strokeWidth={2.5} opacity={0.55} strokeLinecap="round" />) : null}
        <g transform={faceT}>{face(mood, t)}</g>
        {l.mustache ? <path d={`M${100 - 22} ${cy + r * 0.36} Q100 ${cy + r * 0.2} ${100 + 22} ${cy + r * 0.36} Q100 ${cy + r * 0.32} ${100 - 22} ${cy + r * 0.36} Z`} fill={hair} stroke={INK} strokeWidth={3} /> : null}
        {frontHair(l.hairdo ?? "short", hair, cy, r)}
        {l.glasses ? <g fill="rgba(255,255,255,.25)" stroke={INK} strokeWidth={4}><circle cx={100 - 21 * fsc / 0.74} cy={cy + r * 0.12} r={15} /><circle cx={100 + 21 * fsc / 0.74} cy={cy + r * 0.12} r={15} /><path d={`M${100 - 6} ${cy + r * 0.1} L${100 + 6} ${cy + r * 0.1}`} /></g> : null}
        {l.acc === "ribbon" ? <g transform={`translate(${100 + r * 0.55} ${cy - r * 0.8})`} fill={l.accColor ?? "#ff5c8a"} stroke={INK} strokeWidth={4} strokeLinejoin="round"><path d="M0 0 L-22 -12 L-20 14 Z" /><path d="M0 0 L22 -12 L20 14 Z" /><circle r={6} /></g> : null}
        {l.acc === "pin" ? <rect x={100 + r * 0.3} y={cy - r * 0.62} width={24} height={8} rx={4} fill={l.accColor ?? "#FFD84D"} stroke={INK} strokeWidth={3} transform={`rotate(-20 ${100 + r * 0.3} ${cy - r * 0.62})`} /> : null}
        {l.acc === "headband" ? <path d={`M${100 - r + 6} ${cy - r * 0.35} Q100 ${cy - r - 20} ${100 + r - 6} ${cy - r * 0.35}`} stroke={l.accColor ?? "#ff5c8a"} strokeWidth={10} fill="none" strokeLinecap="round" /> : null}
        {l.acc === "cap" ? <path {...s} fill={l.accColor ?? "#3d6fd9"} d={`M${100 - r - 2} ${cy - 10} C${100 - r} ${cy - r - 18} ${100 + r} ${cy - r - 18} ${100 + r + 2} ${cy - 10} L${100 + r + 34} ${cy - 6} Q${100 + r + 30} ${cy + 4} ${100 + r - 4} ${cy} Z`} /> : null}
      </>
    );
  }
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: size, height: size, transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${(c.flip ? -1 : 1) * sx * squash}, ${sy * squash})`, transformOrigin: "50% 92%" }}>
      <svg width={size} height={size} viewBox="0 0 200 200" style={{ overflow: "visible" }}>
        <ellipse cx={100} cy={197} rx={64} ry={8} fill="rgba(0,0,0,.16)" />
        {art}
        {fx}
      </svg>
      {c.hat ? <div style={{ position: "absolute", left: 0, width: size, top: -size * 0.2, textAlign: "center", fontSize: size * 0.36, lineHeight: 1 }}>{c.hat}</div> : null}
    </div>
  );
};
