// The doodle-cartoon ("낙서 짤툰") parts of a story scene (lib/Sseol.tsx):
//  - Doodle: a hand-drawn character skin, picked with "style": "doodle" on a scene character. A white potato-shaped body,
//    stick arms, one hair colour, and an uneven thick black outline that redraws itself 8 times a second ("line boil"),
//    so it reads as drawn with a marker. It plays the same 13 moods as the mochi characters.
//  - PhotoBackdrop: a real photo filling the scene box with a slow zoom ("photo" on a scene), the characters stand on it.
import React from "react";
import { Img, staticFile } from "remotion";
import { TITLE } from "./fonts";
import { eOut, prog } from "./fx";
import type { Char, Mood } from "./Sseol";

const INK = "#141414";

/** deterministic noise in -1..1 */
const rnd = (a: number, b: number) => {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
};

/** a smooth closed path through points (Catmull-Rom as cubic Béziers) */
const closed = (p: [number, number][]) => {
  const n = p.length, at = (k: number) => p[(k + n) % n];
  let d = `M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`;
  for (let k = 0; k < n; k++) {
    const [x0, y0] = at(k - 1), [x1, y1] = at(k), [x2, y2] = at(k + 1), [x3, y3] = at(k + 2);
    d += ` C${(x1 + (x2 - x0) / 6).toFixed(1)} ${(y1 + (y2 - y0) / 6).toFixed(1)} ${(x2 - (x3 - x1) / 6).toFixed(1)} ${(y2 - (y3 - y1) / 6).toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }
  return d + " Z";
};

/** an open wobbly stroke through points (each point nudged by up to j px) */
const wob = (pts: [number, number][], seed: number, j = 2.2) => {
  const q = pts.map(([x, y], k) => [x + j * rnd(seed, k), y + j * rnd(seed + 9, k)] as [number, number]);
  if (q.length === 2) return `M${q[0][0]} ${q[0][1]} L${q[1][0]} ${q[1][1]}`;
  let d = `M${q[0][0]} ${q[0][1]}`;
  for (let k = 1; k < q.length - 1; k++) {
    const mx = (q[k][0] + q[k + 1][0]) / 2, my = (q[k][1] + q[k + 1][1]) / 2;
    d += ` Q${q[k][0]} ${q[k][1]} ${k === q.length - 2 ? q[k + 1][0] : mx} ${k === q.length - 2 ? q[k + 1][1] : my}`;
  }
  return d;
};

/** a marker line: drawn twice with different wobble and width, so its thickness is uneven like a real pen */
const Ink: React.FC<{ d1: string; d2: string; w?: number; color?: string; fill?: string }> = ({ d1, d2, w = 7, color = INK, fill = "none" }) => (
  <>
    <path d={d1} stroke={color} strokeWidth={w} fill={fill} strokeLinecap="round" strokeLinejoin="round" />
    <path d={d2} stroke={color} strokeWidth={w * 0.62} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </>
);

/** the body outline: a potato shape, centre (100, 110) */
const bodyPts = (seed: number, amp: number): [number, number][] =>
  Array.from({ length: 22 }, (_, k) => {
    const a = (k / 22) * Math.PI * 2 - Math.PI / 2, s = Math.sin(a), c = Math.cos(a);
    const rx = 66 + (s > 0 ? 6 * s : 0), ry = s < 0 ? 84 : 76;  // a bit wider at the bottom, taller at the top
    const r = 1 + amp * rnd(seed, k) * 0.03;
    return [100 + c * rx * r, 110 + s * ry * r];
  });

/** hair on top of the head: "spiky" (the lead), "perm" (round curls), "bob" */
const hairPts = (kind: string, seed: number): [number, number][] => {
  if (kind === "perm") return Array.from({ length: 30 }, (_, k): [number, number] => {
    const a = Math.PI + (k / 29) * Math.PI, bump = k % 2 ? 0 : 13;
    return [100 + Math.cos(a) * (78 + bump), 82 + Math.sin(a) * (66 + bump) + rnd(seed, k) * 2];
  }).concat([[172, 96], [150, 70], [100, 62], [50, 70], [28, 96]] as [number, number][]);
  if (kind === "bob") return ([[26, 128], [24, 70], [50, 30], [100, 18], [150, 30], [176, 70], [174, 128], [156, 120], [150, 74], [100, 58], [50, 74], [44, 120]] as [number, number][]);
  // spiky: five uneven spikes over the crown
  const tips: [number, number][] = [[40, 46], [58, 8], [86, 30], [104, -6], [124, 28], [150, 4], [160, 44]];
  return [[34, 74], ...tips.map(([x, y], k) => [x + rnd(seed, k) * 2.5, y + rnd(seed + 3, k) * 2.5] as [number, number]), [166, 76], [134, 62], [100, 58], [66, 62]];
};

/** arm polylines (shoulder → elbow → hand) for a mood; the hand gets a small mitten */
const arms = (mood: Mood, t: number): [number, number][][] => {
  const wave = Math.sin(t * 9) * 8;
  switch (mood) {
    case "shock": return [[[38, 118], [18, 86], [10 + wave * 0.4, 48]], [[162, 118], [182, 86], [190 - wave * 0.4, 48]]];
    case "happy": case "laugh": return [[[38, 120], [14, 104], [4, 70 + wave]], [[162, 120], [186, 104], [196, 70 - wave]]];
    case "think": return [[[38, 124], [24, 150], [26, 176]], [[162, 124], [166, 160], [128, 150]]];
    case "smug": return [[[38, 124], [70, 160], [120, 150]], [[162, 124], [130, 160], [80, 152]]];
    case "angry": return [[[38, 120], [8, 140], [30, 166]], [[162, 120], [192, 140], [170, 166]]];
    case "shy": case "love": return [[[38, 124], [60, 162], [92, 168]], [[162, 124], [140, 162], [108, 168]]];
    case "sad": case "cry": case "sick": return [[[38, 126], [30, 156], [32, 186]], [[162, 126], [170, 156], [168, 186]]];
    case "sleep": return [[[38, 124], [26, 154], [36, 180]], [[162, 124], [174, 154], [164, 180]]];
    default: return [[[38, 122], [24, 150], [20, 176]], [[162, 122], [176, 150], [180, 176]]];
  }
};

/** a doodle character in a mood; same props as the mochi (t: seconds since the scene started) */
export const Doodle: React.FC<{ c: Char; i: number; t: number; size: number; mood?: Mood }> = ({ c, i, t, size, mood = c.mood ?? "neutral" }) => {
  const hair = c.hair ?? c.color ?? "#FF7A1A";
  const boil = Math.floor(t * 8) + i * 17;  // the outline redraws 8 times a second
  const enter = eOut(prog(t, 0, 0.22));
  let sx = 1, sy = 1, dx = 0, dy = 0, rot = 0;
  const breathe = Math.sin((t + i * 0.7) * 3.2);
  sy = 1 + 0.02 * breathe; sx = 1 - 0.015 * breathe;
  if (mood === "laugh") { const b = Math.abs(Math.sin(t * 11)); dy = -14 * b; rot = 4 * Math.sin(t * 11); }
  if (mood === "shock") { const p = prog(t, 0, 0.35); dy = -60 * Math.sin(Math.PI * p); dx = 7 * Math.sin(t * 70) * (1 - prog(t, 0.2, 0.6)); }
  if (mood === "angry") { dx = 5 * Math.sin(t * 55); }
  if (mood === "happy") { dy = -10 * Math.abs(Math.sin(t * 5)); }
  if (mood === "sad" || mood === "cry") { sy *= 0.96; dy = 6; }
  if (mood === "sleep") { rot = -6 + 2 * Math.sin(t * 1.6); }
  if (mood === "love") { dy = -8 * Math.abs(Math.sin(t * 4)); }
  if (mood === "sick") { rot = 3 * Math.sin(t * 2.4); dy = 4; }
  if (mood === "smug") { rot = -3; }
  const squash = 1 - 0.1 * (1 - enter);

  const L = 78, R = 122, Y = 100, M = 136;
  const line = (pts: [number, number][], k: number, w = 7, color = INK) => <Ink key={k} d1={wob(pts, boil + k * 5)} d2={wob(pts, boil + k * 5 + 50, 1.6)} w={w} color={color} />;
  const dot = (x: number, y: number, r = 7, k = 0) => <ellipse key={`d${k}`} cx={x + rnd(boil, k)} cy={y + rnd(boil, k + 4)} rx={r} ry={r * 1.15} fill={INK} />;
  const face = (() => {
    switch (mood) {
      case "happy": return [line([[L - 11, Y + 4], [L, Y - 7], [L + 11, Y + 4]], 1), line([[R - 11, Y + 4], [R, Y - 7], [R + 11, Y + 4]], 2),
        <path key="m" d={`M${86} ${M - 4} Q100 ${M + 22} ${114} ${M - 4} Z`} fill={INK} />];
      case "laugh": return [line([[L - 12, Y - 8], [L + 8, Y], [L - 12, Y + 8]], 1), line([[R + 12, Y - 8], [R - 8, Y], [R + 12, Y + 8]], 2),
        <path key="m" d={`M80 ${M - 8} Q100 ${M + 32} 120 ${M - 8} Z`} fill={INK} />, <path key="t" d={`M90 ${M + 8} Q100 ${M + 2} 110 ${M + 8} Q100 ${M + 16} 90 ${M + 8}`} fill="#ff6b81" />];
      case "shock": return [<circle key="l" cx={L} cy={Y} r={17} fill="white" stroke={INK} strokeWidth={5} />, <circle key="r" cx={R} cy={Y} r={17} fill="white" stroke={INK} strokeWidth={5} />,
        dot(L, Y, 4, 1), dot(R, Y, 4, 2), <ellipse key="m" cx={100} cy={M + 6} rx={10} ry={17} fill={INK} />];
      case "sad": return [dot(L, Y + 2, 6, 1), dot(R, Y + 2, 6, 2), line([[L - 12, Y - 10], [L + 8, Y - 18]], 3, 5), line([[R + 12, Y - 10], [R - 8, Y - 18]], 4, 5),
        line([[86, M + 6], [100, M - 4], [114, M + 6]], 5, 6)];
      case "cry": return [line([[L - 11, Y - 2], [L, Y + 6], [L + 11, Y - 2]], 1), line([[R - 11, Y - 2], [R, Y + 6], [R + 11, Y - 2]], 2),
        line([[84, M + 8], [100, M - 4], [116, M + 8]], 3, 6),
        ...[L, R].map((x, k) => <path key={`t${k}`} d={`M${x - 6} ${Y + 10} L${x - 8} ${Y + 52} L${x + 6} ${Y + 52} L${x + 6} ${Y + 10} Z`} fill="#56b6ff" opacity={0.85 + 0.15 * Math.sin(t * 9 + k)} />)];
      case "angry": return [dot(L, Y + 4, 6, 1), dot(R, Y + 4, 6, 2), line([[L - 14, Y - 16], [L + 10, Y - 6]], 3, 7), line([[R + 14, Y - 16], [R - 10, Y - 6]], 4, 7),
        line([[84, M + 4], [92, M - 2], [100, M + 4], [108, M - 2], [116, M + 4]], 5, 5)];
      case "smug": return [line([[L - 12, Y - 2], [L + 12, Y - 2]], 1, 6), line([[R - 12, Y - 2], [R + 12, Y - 2]], 2, 6), dot(L + 2, Y + 4, 5, 3), dot(R + 2, Y + 4, 5, 4),
        line([[86, M + 2], [104, M + 6], [118, M - 8]], 5, 6)];
      case "shy": return [dot(L, Y + 2, 6, 1), dot(R, Y + 2, 6, 2), line([[86, M], [93, M - 5], [100, M], [107, M - 5], [114, M]], 3, 5),
        ...[50, 150].map((x, k) => <g key={`b${k}`}>{[-8, 0, 8].map((o) => <path key={o} d={`M${x + o + 3} ${Y + 18} L${x + o - 3} ${Y + 30}`} stroke="#ff5f87" strokeWidth={4} strokeLinecap="round" />)}</g>)];
      case "think": return [dot(L + 5, Y - 6, 6, 1), dot(R + 5, Y - 6, 6, 2), line([[90, M + 2], [112, M - 2]], 3, 6)];
      case "sleep": return [line([[L - 11, Y], [L + 11, Y]], 1, 6), line([[R - 11, Y], [R + 11, Y]], 2, 6), <ellipse key="m" cx={100} cy={M + 2} rx={6} ry={5} fill={INK} />];
      case "love": return [...[L, R].map((x, k) => <path key={`h${k}`} transform={`translate(${x} ${Y}) scale(${0.9 + 0.12 * Math.abs(Math.sin(t * 8))})`}
        d="M0 10 C-24 -6 -13 -24 0 -12 C13 -24 24 -6 0 10 Z" fill="#ff3b5c" stroke={INK} strokeWidth={3} />), line([[86, M - 2], [100, M + 10], [114, M - 2]], 3, 6)];
      case "sick": return [...[L, R].map((x, k) => <path key={`s${k}`} d={`M${x} ${Y} m-2 0 a2 2 0 1 1 4 0 a5 5 0 1 1 -9 0 a9 9 0 1 1 16 0`} stroke={INK} strokeWidth={4} fill="none" />),
        line([[82, M + 4], [90, M - 2], [98, M + 4], [106, M - 2], [114, M + 4]], 3, 5)];
      default: return [dot(L, Y, 7, 1), dot(R, Y, 7, 2), line([[90, M], [100, M + 4], [110, M]], 3, 6)];
    }
  })();
  const amp = mood === "angry" || mood === "shock" ? 1.6 : 1;
  const body1 = closed(bodyPts(boil, amp)), body2 = closed(bodyPts(boil + 101, amp));
  const hk = c.hairdo ?? "spiky";
  const fill = mood === "angry" ? "#ffe1e1" : mood === "sick" ? "#e3f5df" : "white";
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: size, height: size, transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${(c.flip ? -1 : 1) * sx * squash}, ${sy * squash})`, transformOrigin: "50% 92%" }}>
      <svg width={size} height={size} viewBox="0 0 200 200" style={{ overflow: "visible" }}>
        <ellipse cx={100} cy={196} rx={62} ry={7} fill="rgba(0,0,0,.25)" />
        {/* legs, then arms behind the body edge */}
        {line([[80, 180], [78, 196], [68, 197]], 20, 7)}
        {line([[120, 180], [122, 196], [132, 197]], 21, 7)}
        {arms(mood, t).map((a, k) => <g key={k}>{line(a, 30 + k, 7)}<circle cx={a[a.length - 1][0]} cy={a[a.length - 1][1]} r={7} fill="white" stroke={INK} strokeWidth={4.5} /></g>)}
        <path d={body1} fill={fill} />
        <Ink d1={body1} d2={body2} w={8} />
        {hk === "bald" ? null : <Ink d1={closed(hairPts(hk, boil))} d2={closed(hairPts(hk, boil + 7))} w={6} fill={hair} />}
        <g transform={c.flip ? "translate(200 0) scale(-1 1)" : undefined}>{face}</g>
        {mood === "shock" || mood === "shy" ? <path d="M170 40 q10 16 0 24 q-10 -8 0 -24" fill="#7cc8ff" stroke={INK} strokeWidth={3} /> : null}
        {mood === "angry" ? <g stroke="#e8212e" strokeWidth={6} strokeLinecap="round" transform="translate(166 42)"><path d="M-12 -4 Q-4 -4 -4 -12" fill="none" /><path d="M12 -4 Q4 -4 4 -12" fill="none" /><path d="M-12 4 Q-4 4 -4 12" fill="none" /><path d="M12 4 Q4 4 4 12" fill="none" /></g> : null}
        {mood === "shock" ? [[22, 30, -30], [178, 30, 30], [100, -22, 0]].map(([x, y, r], k) => <path key={k} transform={`translate(${x} ${y}) rotate(${r})`} d="M0 -14 L0 10" stroke={INK} strokeWidth={6} strokeLinecap="round" />) : null}
        {mood === "sleep" ? <text x={152} y={34 - 10 * ((t * 0.8) % 1)} fontFamily={TITLE} fontSize={34} fill={INK} opacity={1 - ((t * 0.8) % 1)}>Z</text> : null}
        {mood === "think" ? [0, 1, 2].map((k) => <circle key={k} cx={156 + k * 14} cy={26 - k * 12} r={4 + k * 2} fill="white" stroke={INK} strokeWidth={3} opacity={prog(t, 0.15 * k, 0.15)} />) : null}
        {mood === "love" ? [0, 1].map((k) => { const q = (t * 0.7 + k * 0.5) % 1; return <path key={k} transform={`translate(${160 + 14 * k} ${46 - 40 * q}) scale(${0.7 + 0.3 * k})`}
          d="M0 10 C-26 -6 -14 -26 0 -13 C14 -26 26 -6 0 10 Z" fill="#ff3d6e" opacity={1 - q} />; }) : null}
        {mood === "sick" ? [70, 90, 110, 130].map((x, k) => <path key={x} d={`M${x} ${40 + (k % 2) * 6} L${x} ${64 + (k % 2) * 6}`} stroke="#6b5bd6" strokeWidth={5} strokeLinecap="round" opacity={0.7} />) : null}
      </svg>
      {c.hat ? <div style={{ position: "absolute", left: 0, width: size, top: -size * 0.2, textAlign: "center", fontSize: size * 0.36, lineHeight: 1 }}>{c.hat}</div> : null}
    </div>
  );
};

/** a real photo filling the scene box (a path under public/), slowly zooming in; "contain" letterboxes it on black */
export const PhotoBackdrop: React.FC<{ src: string; fit?: "cover" | "contain"; pos?: string; t: number }> = ({ src, fit = "cover", pos = "50% 50%", t }) => (
  <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#000" }}>
    <Img src={staticFile(src)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: fit, objectPosition: pos,
      transform: `scale(${1.03 + 0.025 * t})`, transformOrigin: pos }} />
  </div>
);
