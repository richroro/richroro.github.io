// The wordless road cartoons' drivers (drive1~10): a big, expressive 2D face (head and shoulders) that carries the story
// without a word. One SVG in a 400×480 viewBox: the head spans x 50..350, y 50..400, the shoulders run off the bottom.
// The same face is the close-up (lib/Drive.tsx view "face", ~70% of the picture height) and, small, the head seen
// through a car's windows in the 3D car view. Everything is a pure function of t (seconds since the clip started).
import React from "react";
import { clamp, eOut, prog } from "./fx";

export type DMood = "neutral" | "smug" | "grin" | "angry" | "rage" | "shock" | "scared" | "sad" | "cry" | "happy" | "laugh"
  | "cool" | "side" | "bored" | "yell" | "eek" | "squint";
export type Driver = {
  skin?: string;
  hair?: "short" | "spiky" | "slick" | "bald" | "cap" | "bob" | "curly" | "long";
  hairColor?: string;
  /** the cap's colour (hair "cap"); plain, no logo */
  cap?: string;
  glasses?: "sun" | "round";
  beard?: "mustache" | "stubble" | "full";
  shirt?: string;
  mood?: DMood;
  /** mood changes: [[t, mood], ...] (t in seconds since the clip started) */
  moods?: [number, DMood][];
};

const INK = "#1b1b1f";

/** the mood at t and how long it has been on (for its entrance: a jump, a shake) */
export const moodAt = (d: Driver, t: number): [DMood, number] => {
  let m: DMood = d.mood ?? "neutral", since = t;
  for (const [t0, mm] of d.moods ?? []) if (t >= t0) { m = mm; since = t - t0; }
  return [m, since];
};

const hexMix = (a: string, b: string, k: number) => {
  const p = (h: string) => { const x = h.replace("#", ""); const f = x.length === 3 ? x.split("").map((c) => c + c).join("") : x; return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16)); };
  const A = p(a), B = p(b);
  return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, "0")).join("");
};

/** the face SVG. `look` turns the features left (-1) or right (+1) a little (a 3/4 face); `back` draws the back of the head */
export const DriverFace: React.FC<{ d: Driver; t: number; x?: number; y?: number; w?: number; h?: number; look?: number; back?: boolean; still?: boolean; uid?: string }> =
  ({ d, t, x = 0, y = 0, w = 400, h = 480, look = -0.35, back = false, still = false, uid = "f" }) => {
  const [mood, since] = moodAt(d, t);
  const skin0 = d.skin ?? "#FFD9B0", hairC = d.hairColor ?? "#2a2320", shirt = d.shirt ?? "#4DA3FF";
  const red = mood === "rage" ? 0.42 : mood === "angry" || mood === "yell" ? 0.22 : 0;
  const skin = red ? hexMix(skin0, "#ff4040", red) : mood === "scared" ? hexMix(skin0, "#bfe3ff", 0.25) : skin0;
  const fx = 28 * look;  // features shift for a 3/4 face
  // motion: a jump on shock, a tremble when scared, a shake in a rage, a bob when laughing
  let dx = 0, dy = 0, rot = 0;
  if (!still) {
    if (mood === "shock") { const p = prog(since, 0, 0.35); dy = -26 * Math.sin(Math.PI * p); dx = 4 * Math.sin(since * 80) * (1 - prog(since, 0.2, 0.5)); }
    if (mood === "scared" || mood === "eek") dx = 2.5 * Math.sin(t * 70);
    if (mood === "rage") { dx = 5 * Math.sin(t * 61); dy = 3 * Math.cos(t * 47); }
    if (mood === "laugh") { dy = -8 * Math.abs(Math.sin(t * 10)); rot = 2.5 * Math.sin(t * 10); }
    if (mood === "happy") dy = -4 * Math.abs(Math.sin(t * 5));
    if (mood === "yell") dy = 3 * Math.sin(t * 30);
  }
  const breathe = still ? 0 : Math.sin(t * 2.6) * 2;
  // blinking (eyes that are open in this mood)
  const blink = !still && ((t + 0.7) % 3.3) < 0.12;
  const L = 145 + fx, R = 255 + fx, EY = 200;
  const openEyes = ["neutral", "shock", "scared", "rage", "angry", "yell", "eek", "side", "smug", "sad", "bored", "cool", "squint", "grin"].includes(mood);
  // eye size and lid cover (0 open .. 1 closed, from the top) per mood
  const eye = {
    neutral: [38, 44, 0], smug: [38, 42, 0.52], grin: [36, 36, 0.42], angry: [34, 36, 0.3], rage: [34, 38, 0.28], shock: [46, 58, 0],
    scared: [44, 52, 0], sad: [36, 40, 0.42], cry: [36, 40, 0.42], happy: [36, 40, 0], laugh: [36, 40, 0], cool: [38, 42, 0.48],
    side: [38, 42, 0.4], bored: [38, 42, 0.58], yell: [36, 40, 0.18], eek: [44, 50, 0], squint: [38, 40, 0.7],
  }[mood] as [number, number, number];
  const lid = blink && openEyes ? 1 : eye[2];
  const pupil = mood === "shock" ? 7 : mood === "scared" || mood === "eek" ? 9 : mood === "angry" || mood === "rage" ? 10 : 13;
  const px = mood === "side" ? 20 : mood === "scared" ? 4 * Math.sin(t * 40) : 8 * look;
  const py = mood === "sad" || mood === "cry" ? 12 : mood === "smug" || mood === "bored" || mood === "cool" ? 8 : 0;
  // brows: [inner y offset, outer y offset] relative to the brow line, + one-brow raise for smug/side
  const brow = {
    neutral: [0, 0], smug: [6, 2], grin: [16, -10], angry: [26, -14], rage: [30, -18], shock: [-30, -22], scared: [-22, 6], sad: [-18, 10],
    cry: [-22, 10], happy: [-8, -4], laugh: [-6, -6], cool: [4, 0], side: [6, 0], bored: [6, 4], yell: [24, -12], eek: [-18, 4], squint: [10, 0],
  }[mood] as [number, number];
  const BY = EY - eye[1] - 18;
  const browL = `M${L - 40} ${BY + brow[1]} Q${L - 8} ${BY - 10 + (brow[0] + brow[1]) / 2} ${L + 30} ${BY + brow[0]}`;
  const rightRaise = mood === "smug" || mood === "side" || mood === "cool" ? -16 : 0;
  const browR = `M${R - 30} ${BY + brow[0] + rightRaise} Q${R + 8} ${BY - 10 + (brow[0] + brow[1]) / 2 + rightRaise} ${R + 40} ${BY + brow[1] + rightRaise}`;
  const eyeG = (cx: number, k: number) => {
    const [rx, ry] = eye;
    if (mood === "happy") return <path key={k} d={`M${cx - 26} ${EY + 8} Q${cx} ${EY - 26} ${cx + 26} ${EY + 8}`} stroke={INK} strokeWidth={9} fill="none" strokeLinecap="round" />;
    if (mood === "laugh") return <path key={k} d={k ? `M${cx + 24} ${EY - 18} L${cx - 14} ${EY} L${cx + 24} ${EY + 18}` : `M${cx - 24} ${EY - 18} L${cx + 14} ${EY} L${cx - 24} ${EY + 18}`}
      stroke={INK} strokeWidth={9} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
    if (mood === "cry" && lid >= 1) return <path key={k} d={`M${cx - 26} ${EY} Q${cx} ${EY + 16} ${cx + 26} ${EY}`} stroke={INK} strokeWidth={9} fill="none" strokeLinecap="round" />;
    const id = `${uid}e${k}`;
    // the upper lid comes down level, or slanted (angry: inner corner lower; sad: outer corner lower)
    const slant = mood === "angry" || mood === "rage" || mood === "grin" || mood === "yell" ? (k ? 1 : -1) * 16 : mood === "sad" || mood === "cry" ? (k ? -1 : 1) * 12 : 0;
    const top = EY - ry + 2 * ry * lid;
    return (
      <g key={k}>
        <ellipse cx={cx} cy={EY} rx={rx} ry={ry} fill="white" stroke={INK} strokeWidth={6} />
        <clipPath id={id}><ellipse cx={cx} cy={EY} rx={rx - 3} ry={ry - 3} /></clipPath>
        <g clipPath={`url(#${id})`}>
          <circle cx={cx + px} cy={EY + py} r={pupil} fill={INK} />
          <circle cx={cx + px - 4} cy={EY + py - 5} r={pupil * 0.33} fill="white" />
          {lid > 0 ? <path d={`M${cx - rx - 4} ${EY - ry - 10} L${cx + rx + 4} ${EY - ry - 10} L${cx + rx + 4} ${top - slant} L${cx - rx - 4} ${top + slant} Z`} fill={skin} /> : null}
          {lid > 0 && lid < 1 ? <line x1={cx - rx - 4} y1={top + slant} x2={cx + rx + 4} y2={top - slant} stroke={INK} strokeWidth={7} /> : null}
          {lid >= 1 ? <line x1={cx - rx} y1={EY} x2={cx + rx} y2={EY} stroke={INK} strokeWidth={7} /> : null}
        </g>
        <ellipse cx={cx} cy={EY} rx={rx} ry={ry} fill="none" stroke={INK} strokeWidth={6} />
      </g>
    );
  };
  const MX = 200 + fx * 1.15, MY = 300;
  const mouthOpen = mood === "yell" ? 0.55 + 0.45 * Math.abs(Math.sin(t * 13)) : 1;
  const mouth = (() => {
    switch (mood) {
      case "smug": return <path d={`M${MX - 34} ${MY + 4} Q${MX + 4} ${MY + 18} ${MX + 40} ${MY - 14}`} stroke={INK} strokeWidth={8} fill="none" strokeLinecap="round" />;
      case "grin": return <g><path d={`M${MX - 62} ${MY - 10} Q${MX} ${MY + 54} ${MX + 62} ${MY - 10} Z`} fill="white" stroke={INK} strokeWidth={7} strokeLinejoin="round" />
        {[-36, -12, 12, 36].map((k) => <line key={k} x1={MX + k} y1={MY - 6} x2={MX + k} y2={MY + 22 - Math.abs(k) * 0.35} stroke={INK} strokeWidth={4} />)}
        <path d={`M${MX - 58} ${MY + 4} Q${MX} ${MY + 18} ${MX + 58} ${MY + 4}`} stroke={INK} strokeWidth={4} fill="none" /></g>;
      case "angry": return <g><rect x={MX - 48} y={MY - 6} width={96} height={34} rx={10} fill="white" stroke={INK} strokeWidth={7} />
        <line x1={MX - 46} y1={MY + 11} x2={MX + 46} y2={MY + 11} stroke={INK} strokeWidth={4} />
        {[-24, 0, 24].map((k) => <line key={k} x1={MX + k} y1={MY - 4} x2={MX + k} y2={MY + 26} stroke={INK} strokeWidth={4} />)}</g>;
      case "rage": case "yell": {
        const hh = 70 * mouthOpen;
        return <g><path d={`M${MX - 52} ${MY - 12} Q${MX} ${MY - 26} ${MX + 52} ${MY - 12} Q${MX + 46} ${MY - 12 + hh} ${MX} ${MY - 8 + hh} Q${MX - 46} ${MY - 12 + hh} ${MX - 52} ${MY - 12} Z`}
          fill="#7a1e2c" stroke={INK} strokeWidth={7} strokeLinejoin="round" />
          <path d={`M${MX - 44} ${MY - 12} Q${MX} ${MY - 22} ${MX + 44} ${MY - 12} L${MX + 40} ${MY + 2} Q${MX} ${MY - 6} ${MX - 40} ${MY + 2} Z`} fill="white" />
          <ellipse cx={MX} cy={MY - 12 + hh * 0.8} rx={24} ry={8 * mouthOpen} fill="#ff7f93" /></g>;
      }
      case "shock": return <ellipse cx={MX} cy={MY + 14} rx={26} ry={40} fill="#7a1e2c" stroke={INK} strokeWidth={7} />;
      case "scared": return <path d={`M${MX - 40} ${MY + 8} q10 -14 20 0 q10 14 20 0 q10 -14 20 0 q10 14 20 0`} stroke={INK} strokeWidth={7} fill="none" strokeLinecap="round" />;
      case "eek": return <g><rect x={MX - 58} y={MY - 8} width={116} height={40} rx={14} fill="white" stroke={INK} strokeWidth={7} />
        <line x1={MX - 56} y1={MY + 12} x2={MX + 56} y2={MY + 12} stroke={INK} strokeWidth={4} />
        {[-30, -10, 10, 30].map((k) => <line key={k} x1={MX + k} y1={MY - 6} x2={MX + k} y2={MY + 30} stroke={INK} strokeWidth={4} />)}</g>;
      case "sad": return <path d={`M${MX - 32} ${MY + 18} Q${MX} ${MY - 8} ${MX + 32} ${MY + 18}`} stroke={INK} strokeWidth={8} fill="none" strokeLinecap="round" />;
      case "cry": return <path d={`M${MX - 40} ${MY + 26} Q${MX - 20} ${MY - 10} ${MX} ${MY + 4} Q${MX + 20} ${MY - 10} ${MX + 40} ${MY + 26} Q${MX} ${MY + 10} ${MX - 40} ${MY + 26} Z`} fill="#7a1e2c" stroke={INK} strokeWidth={7} strokeLinejoin="round" />;
      case "happy": return <path d={`M${MX - 44} ${MY - 6} Q${MX} ${MY + 50} ${MX + 44} ${MY - 6} Z`} fill="#7a1e2c" stroke={INK} strokeWidth={7} strokeLinejoin="round" />;
      case "laugh": return <g><path d={`M${MX - 54} ${MY - 14} Q${MX} ${MY + 70} ${MX + 54} ${MY - 14} Z`} fill="#7a1e2c" stroke={INK} strokeWidth={7} strokeLinejoin="round" />
        <path d={`M${MX - 48} ${MY - 12} L${MX + 48} ${MY - 12} L${MX + 42} ${MY} L${MX - 42} ${MY} Z`} fill="white" />
        <ellipse cx={MX} cy={MY + 26} rx={22} ry={9} fill="#ff7f93" /></g>;
      case "cool": return <path d={`M${MX - 30} ${MY + 2} Q${MX + 2} ${MY + 22} ${MX + 34} ${MY - 4}`} stroke={INK} strokeWidth={8} fill="none" strokeLinecap="round" />;
      case "side": return <path d={`M${MX - 26} ${MY + 8} L${MX + 26} ${MY + 4}`} stroke={INK} strokeWidth={8} strokeLinecap="round" />;
      case "bored": return <path d={`M${MX - 24} ${MY + 6} L${MX + 24} ${MY + 6}`} stroke={INK} strokeWidth={8} strokeLinecap="round" />;
      case "squint": return <path d={`M${MX - 30} ${MY + 10} Q${MX} ${MY} ${MX + 30} ${MY + 10}`} stroke={INK} strokeWidth={8} fill="none" strokeLinecap="round" />;
      default: return <path d={`M${MX - 26} ${MY} Q${MX} ${MY + 14} ${MX + 26} ${MY}`} stroke={INK} strokeWidth={8} fill="none" strokeLinecap="round" />;
    }
  })();
  const head = "M200 52 C298 52 352 118 352 214 C352 322 290 402 200 402 C110 402 48 322 48 214 C48 118 102 52 200 52 Z";
  const hairD = d.hair ?? "short";
  const hairBack = hairD === "bob" || hairD === "long"
    ? <path d={hairD === "long" ? "M40 220 C30 90 110 34 200 34 C290 34 370 90 360 220 L372 470 L28 470 Z" : "M38 230 C30 90 110 34 200 34 C290 34 370 90 362 230 L366 360 L34 360 Z"} fill={hairC} stroke={INK} strokeWidth={6} />
    : null;
  const hairFront = (() => {
    switch (hairD) {
      case "short": return <path d="M52 196 C44 92 116 40 200 40 C288 40 358 92 348 196 C336 150 300 120 236 116 C190 114 120 118 96 150 C78 168 64 176 52 196 Z" fill={hairC} stroke={INK} strokeWidth={6} strokeLinejoin="round" />;
      case "spiky": return <path d="M50 200 L40 120 L82 128 L76 64 L124 92 L140 30 L176 80 L208 22 L232 82 L270 34 L280 96 L328 72 L318 132 L362 128 L348 200 C330 150 290 126 200 124 C120 124 76 150 50 200 Z" fill={hairC} stroke={INK} strokeWidth={6} strokeLinejoin="round" />;
      case "slick": return <g><path d="M50 200 C40 96 110 36 210 38 C300 40 360 96 350 196 C340 140 310 112 250 104 C210 100 160 116 120 108 C90 120 66 160 50 200 Z" fill={hairC} stroke={INK} strokeWidth={6} strokeLinejoin="round" />
        <path d="M120 70 Q200 46 290 76" stroke="white" strokeOpacity={0.35} strokeWidth={8} fill="none" strokeLinecap="round" /></g>;
      case "bald": return <g><path d="M50 230 C48 200 56 180 66 166 L74 230 Z M350 230 C352 200 344 180 334 166 L326 230 Z" fill={hairC} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
        <ellipse cx={150} cy={92} rx={38} ry={16} fill="white" opacity={0.45} transform="rotate(-20 150 92)" /></g>;
      case "cap": { const cc = d.cap ?? "#E8453C"; return <g>
        <path d="M54 170 C54 80 120 34 200 34 C282 34 348 80 348 170 Z" fill={cc} stroke={INK} strokeWidth={6} strokeLinejoin="round" />
        <path d={look <= 0 ? "M60 166 L-30 186 Q-40 160 20 150 L60 150 Z" : "M340 166 L430 186 Q440 160 380 150 L340 150 Z"} fill={hexMix(cc, "#000000", 0.25)} stroke={INK} strokeWidth={6} strokeLinejoin="round" />
        <path d="M200 36 L200 168" stroke={hexMix(cc, "#000000", 0.2)} strokeWidth={4} />
        <circle cx={200} cy={38} r={9} fill={hexMix(cc, "#000000", 0.2)} stroke={INK} strokeWidth={4} /></g>; }
      case "bob": case "long": return <path d="M48 210 C44 100 112 40 200 40 C290 40 356 100 352 210 C330 170 300 130 250 118 C240 150 200 160 140 150 C110 160 70 180 48 210 Z" fill={hairC} stroke={INK} strokeWidth={6} strokeLinejoin="round" />;
      case "curly": return <g>{[[70, 150], [96, 100], [140, 66], [200, 52], [260, 66], [304, 100], [330, 150], [120, 120], [170, 100], [230, 100], [280, 122]].map(([cx, cy], k) =>
        <circle key={k} cx={cx} cy={cy} r={42} fill={hairC} stroke={INK} strokeWidth={5} />)}
        <path d="M90 150 Q200 112 310 150 L310 170 Q200 136 90 170 Z" fill={hairC} /></g>;
    }
  })();
  const glasses = d.glasses === "sun" ? <g>
      <path d={`M${L - 52} ${EY - 30} L${L + 46} ${EY - 30} L${L + 40} ${EY + 22} Q${L} ${EY + 40} ${L - 46} ${EY + 18} Z`} fill="#15171c" stroke={INK} strokeWidth={6} />
      <path d={`M${R - 46} ${EY - 30} L${R + 52} ${EY - 30} L${R + 46} ${EY + 18} Q${R} ${EY + 40} ${R - 40} ${EY + 22} Z`} fill="#15171c" stroke={INK} strokeWidth={6} />
      <line x1={L + 46} y1={EY - 22} x2={R - 46} y2={EY - 22} stroke={INK} strokeWidth={8} />
      <path d={`M${L - 34} ${EY - 18} L${L - 14} ${EY - 18}`} stroke="white" strokeOpacity={0.5} strokeWidth={6} strokeLinecap="round" />
      <path d={`M${R - 28} ${EY - 18} L${R - 8} ${EY - 18}`} stroke="white" strokeOpacity={0.5} strokeWidth={6} strokeLinecap="round" />
    </g> : d.glasses === "round" ? <g fill="none" stroke={INK} strokeWidth={6}>
      <circle cx={L} cy={EY} r={eye[1] + 8} /><circle cx={R} cy={EY} r={eye[1] + 8} /><line x1={L + eye[1] + 8} y1={EY} x2={R - eye[1] - 8} y2={EY} />
    </g> : null;
  const beard = d.beard === "mustache" ? <path d={`M${MX - 52} ${MY - 22} Q${MX - 26} ${MY - 44} ${MX} ${MY - 30} Q${MX + 26} ${MY - 44} ${MX + 52} ${MY - 22} Q${MX + 30} ${MY - 14} ${MX} ${MY - 22} Q${MX - 30} ${MY - 14} ${MX - 52} ${MY - 22} Z`} fill={hairC} stroke={INK} strokeWidth={5} />
    : d.beard === "full" ? <path d="M70 250 C80 330 120 400 200 404 C280 400 320 330 330 250 C310 300 270 330 200 332 C130 330 90 300 70 250 Z" fill={hairC} stroke={INK} strokeWidth={6} />
    : d.beard === "stubble" ? <path d="M78 270 C96 350 140 396 200 398 C260 396 304 350 322 270 C300 320 260 350 200 352 C140 350 100 320 78 270 Z" fill={hairC} opacity={0.28} /> : null;
  const sweat = mood === "scared" || mood === "eek" || mood === "shock";
  const fall = (k: number) => ((t * 1.1 + k * 0.5) % 1);
  return (
    <svg x={x} y={y} width={w} height={h} viewBox="0 0 400 480" style={{ overflow: "visible" }}>
      <g transform={`translate(${dx} ${dy + breathe}) rotate(${rot} 200 300)`}>
        {/* shoulders and neck */}
        <path d="M-10 480 C0 410 70 380 140 372 L260 372 C330 380 400 410 410 480 Z" fill={shirt} stroke={INK} strokeWidth={6} />
        <path d="M160 360 L240 360 L236 400 Q200 418 164 400 Z" fill={hexMix(skin, "#000000", 0.12)} stroke={INK} strokeWidth={5} />
        <path d="M150 376 L200 430 L250 376" fill="none" stroke={hexMix(shirt, "#000000", 0.3)} strokeWidth={8} strokeLinejoin="round" />
        {hairBack}
        {back ? <>
          <ellipse cx={48} cy={226} rx={22} ry={34} fill={skin} stroke={INK} strokeWidth={6} />
          <ellipse cx={352} cy={226} rx={22} ry={34} fill={skin} stroke={INK} strokeWidth={6} />
          <path d={head} fill={hairD === "bald" ? skin : hairC} stroke={INK} strokeWidth={6} />
          {hairD === "cap" ? hairFront : null}
        </> : <>
          <ellipse cx={50 + fx * 0.5} cy={226} rx={22} ry={34} fill={skin} stroke={INK} strokeWidth={6} />
          <ellipse cx={350 + fx * 0.5} cy={226} rx={22} ry={34} fill={skin} stroke={INK} strokeWidth={6} />
          <path d={head} fill={skin} stroke={INK} strokeWidth={6} />
          {beard && d.beard !== "mustache" ? beard : null}
          <ellipse cx={L - 18} cy={262} rx={24} ry={13} fill="#ff7aa0" opacity={mood === "happy" || mood === "laugh" || mood === "cool" ? 0.7 : 0.3} />
          <ellipse cx={R + 18} cy={262} rx={24} ry={13} fill="#ff7aa0" opacity={mood === "happy" || mood === "laugh" || mood === "cool" ? 0.7 : 0.3} />
          {d.glasses === "sun" ? null : [eyeG(L, 0), eyeG(R, 1)]}
          <path d={`M${200 + fx * 1.3} 222 Q${186 + fx * 1.3} 256 ${204 + fx * 1.3} 262`} stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" />
          {glasses}
          <path d={browL} stroke={hairD === "bald" ? INK : hairC} strokeWidth={13} fill="none" strokeLinecap="round" />
          <path d={browR} stroke={hairD === "bald" ? INK : hairC} strokeWidth={13} fill="none" strokeLinecap="round" />
          {mouth}
          {d.beard === "mustache" ? beard : null}
          {hairFront}
          {mood === "cry" ? [0, 1].map((k) => <g key={k}>{[L, R].map((cx) => <path key={cx} d={`M${cx - 8} ${EY + 30 + 90 * fall(k)} q8 -22 16 0 q0 12 -8 12 q-8 0 -8 -12`} fill="#4fb3ff" opacity={1 - fall(k)} />)}</g>) : null}
          {mood === "cry" ? [L, R].map((cx) => <path key={cx} d={`M${cx - 6} ${EY + 34} L${cx - 10} ${EY + 140} L${cx + 6} ${EY + 140} L${cx + 6} ${EY + 34} Z`} fill="#4fb3ff" opacity={0.6} />) : null}
          {mood === "laugh" ? [L, R].map((cx) => <circle key={cx} cx={cx + (cx < 200 ? -36 : 36)} cy={EY + 4} r={9} fill="#4fb3ff" />) : null}
          {sweat ? [0, 1].map((k) => <path key={k} transform={`translate(${k ? 330 : 64} ${120 + 40 * k + (mood === "scared" ? 60 * fall(k) : 0)})`} d="M0 -26 q20 30 0 40 q-20 -10 0 -40" fill="#7cc8ff" stroke={INK} strokeWidth={4} />) : null}
          {mood === "angry" || mood === "rage" ? <g stroke="#e8212e" strokeWidth={10} strokeLinecap="round" fill="none" transform={`translate(300 96) scale(${1 + 0.15 * Math.abs(Math.sin(t * 6))})`}>
            <path d="M-22 -6 Q-6 -6 -6 -22" /><path d="M22 -6 Q6 -6 6 -22" /><path d="M-22 6 Q-6 6 -6 22" /><path d="M22 6 Q6 6 6 22" /></g> : null}
          {mood === "rage" ? [0, 1].map((k) => { const q = (t * 1.4 + k * 0.5) % 1; return <ellipse key={k} cx={k ? 372 + 30 * q : 28 - 30 * q} cy={200 - 70 * q} rx={18 + 22 * q} ry={14 + 16 * q} fill="white" opacity={0.85 * (1 - q)} />; }) : null}
          {mood === "scared" ? [0, 1, 2].map((k) => <line key={k} x1={120 + k * 50} y1={64} x2={120 + k * 50} y2={120} stroke="#5a6bd6" strokeWidth={6} strokeLinecap="round" opacity={0.6} />) : null}
        </>}
      </g>
    </svg>
  );
};

/** a pop-in symbol over a head or a car: "!", "?", "?!", "anger", "sweat", "note" (no words, so the short reads in any language) */
export const Symbol: React.FC<{ kind: string; x: number; y: number; t: number; t0: number; size?: number }> = ({ kind, x, y, t, t0, size = 120 }) => {
  if (t < t0 || t > t0 + 2.2) return null;
  const p = eOut(prog(t, t0, 0.25)), q = prog(t, t0 + 1.9, 0.3), s = (0.4 + 0.6 * p) * size / 120;
  const wob = 4 * Math.sin((t - t0) * 9);
  const body = (() => {
    if (kind === "anger") return <g stroke="#e8212e" strokeWidth={14} strokeLinecap="round" fill="none">
      <path d="M-34 -10 Q-10 -10 -10 -34" /><path d="M34 -10 Q10 -10 10 -34" /><path d="M-34 10 Q-10 10 -10 34" /><path d="M34 10 Q10 10 10 34" /></g>;
    if (kind === "sweat") return <path d="M0 -50 q36 54 0 70 q-36 -16 0 -70" fill="#7cc8ff" stroke={INK} strokeWidth={6} />;
    if (kind === "note") return <g fill={INK}><ellipse cx={-14} cy={30} rx={18} ry={13} /><rect x={0} y={-46} width={8} height={76} /><path d="M8 -46 Q40 -36 34 -6 Q30 -26 8 -26 Z" /></g>;
    const txt = kind;
    return <text x={0} y={36} textAnchor="middle" fontFamily="BlackHanSans" fontSize={110} fill="#FFE14D" stroke={INK} strokeWidth={12} paintOrder="stroke">{txt}</text>;
  })();
  return <g transform={`translate(${x} ${y}) scale(${s}) rotate(${wob})`} opacity={1 - q}>{body}</g>;
};

/** a horn burst (jagged star and sound waves, no word) */
export const HornBurst: React.FC<{ x: number; y: number; t: number; t0: number; size?: number }> = ({ x, y, t, t0, size = 1 }) => {
  if (t < t0 || t > t0 + 0.9) return null;
  const p = eOut(prog(t, t0, 0.12)), q = prog(t, t0 + 0.6, 0.3);
  const pts = Array.from({ length: 20 }, (_, i) => { const a = (i / 20) * Math.PI * 2, r = i % 2 ? 50 : 82; return `${r * Math.cos(a)},${r * 0.75 * Math.sin(a)}`; }).join(" ");
  return (
    <g transform={`translate(${x} ${y}) scale(${size * (0.6 + 0.4 * p) * (1 + 0.06 * Math.sin(t * 60))})`} opacity={1 - q}>
      <polygon points={pts} fill="#FFE14D" stroke={INK} strokeWidth={7} strokeLinejoin="round" />
      {[0, 1, 2].map((k) => <path key={k} d={`M${96 + k * 26} ${-34 - k * 10} Q${116 + k * 30} 0 ${96 + k * 26} ${34 + k * 10}`} stroke="#FFE14D" strokeWidth={9} fill="none" strokeLinecap="round" opacity={clamp(p * 3 - k * 0.4)} />)}
      {[0, 1, 2].map((k) => <path key={`l${k}`} d={`M${-96 - k * 26} ${-34 - k * 10} Q${-116 - k * 30} 0 ${-96 - k * 26} ${34 + k * 10}`} stroke="#FFE14D" strokeWidth={9} fill="none" strokeLinecap="round" opacity={clamp(p * 3 - k * 0.4)} />)}
      <path d="M-30 -12 L-6 -12 L18 -30 L18 30 L-6 12 L-30 12 Z" fill={INK} />
    </g>
  );
};
