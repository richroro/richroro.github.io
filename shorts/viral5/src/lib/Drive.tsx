// Wordless road cartoons ("2D 운전 애니 무언 해외판", drive1~10): two extra views of the road graphic (lib/Road.tsx,
// gfx type "road"), drawn on a 1920×1080 (16:9) stage that is scaled into the clip's frame box (use "frame": "wide"
// for the 16:9 picture in the middle of the 9:16 short):
//   view "face"  a driver close-up from the passenger seat: the face fills ~70% of the picture height, the side window
//                behind it shows the road going by (and a car or truck beside), the windshield on the left shows the
//                car ahead, the hands on the wheel honk. Moods change on a timeline, so one shot can act a whole beat.
//   view "car"   a small 3D scene: boxes for cars, trucks and police cars on a perspective highway, seen by a camera
//                anywhere (behind, 3/4 rear, side, 3/4 front, high), so the cars read in depth instead of as a road map.
// All times in these views are seconds since the clip started. No brands, logos, plates or words are drawn.
import React from "react";
import { clamp, eInOut, eOut, lerp, prog } from "./fx";
import { DriverFace, HornBurst, Symbol, type Driver } from "./DriveFace";

const INK = "#1b1b1f";
type V3 = [number, number, number];

export type DCar = {
  kind?: "car" | "tiny" | "suv" | "sports" | "truck" | "police" | "work" | "van";
  color?: string;
  /** lane 1 is the leftmost lane (next to the median); lanes + 1 is the shoulder; fractions sit between lanes */
  lane: number;
  /** metres ahead of the camera's reference point (the followed car, or the road origin); vz drifts it (m/s) */
  z: number; vz?: number;
  /** moves: [t, lane, z] or [t, lane, z, dur] — from t, ease to that lane and z in dur s (default 1) */
  path?: number[][];
  /** fixed heading in degrees (0 = along the road); by default the car turns into its lane changes */
  heading?: number;
  driver?: Driver;
  /** brake lights: [[t0, t1], ...] spans, or true for always */
  brake?: number[][] | boolean;
  blink?: "L" | "R"; blinkAt?: number; blinkOff?: number;
  honk?: number[];
  /** police: roof lights flash from this t */
  siren?: number;
  /** headlights (on by default at night); dark: no lights at all at night (the "invisible car") */
  lights?: boolean | number; dark?: boolean | number;
  /** exhaust puffs at these t */
  smoke?: number[];
  /** speed streaks behind the car from t0 to t1 */
  fast?: number[];
  /** symbols over the car: [[t, "!" | "?" | "?!" | "anger" | "sweat" | "note"], ...] */
  marks?: [number, string][];
};
export type Cam = { x: number; y: number; z: number; yaw: number; pitch: number; fov?: number };
export type DriveG = {
  view: "face" | "car";
  /** a slow push-in: a scale, or [from, to] over the clip */
  zoom?: number | [number, number];
  shake?: number[];
  /** "dun-dun": a punch-in and a dark red vignette at these t */
  dun?: number[];
  /** a white flash (a speed camera) at these t */
  flash?: number[];
  time?: "day" | "night" | "dusk";
  /** world speed in m/s (car view) or px/s of the side window (face view); stopAt eases it to rest */
  speed?: number; stopAt?: number;
  // ── face view ──
  driver?: Driver; flip?: boolean; car?: string;
  /** a vehicle seen through the side window, sliding from x0 to x1 (stage px) between at and at + dur */
  peer?: { kind?: DCar["kind"]; color?: string; driver?: Driver; x0: number; x1: number; at?: number; dur?: number; siren?: number; lights?: boolean };
  /** the car ahead through the windshield: size 0..1 (near), brake spans */
  ahead?: { kind?: DCar["kind"]; color?: string; size?: number; brake?: number[][]; to?: number; toAt?: number; siren?: number; dark?: boolean };
  honk?: number[];
  marks?: [number, string][];
  /** police lights flashing through the windows from this t */
  police?: number;
  /** high beams from behind: [[t0, t1], ...] */
  glare?: number[][];
  // ── car view ──
  cars?: DCar[]; lanes?: number;
  /** a camera preset ("rear", "rearL", "rearR", "side", "sideL", "front", "frontL", "high") or a camera; cam2 eases in at camAt over camDur */
  cam?: string | Cam; cam2?: string | Cam; camAt?: number; camDur?: number;
  /** the car the camera follows (its z, and its lane at t = 0) */
  follow?: number;
  /** traffic cones: [lane, z] on the road (they scroll with it) */
  cones?: number[][];
  /** a lane that ends: cones taper across it from z0 to z1 (road metres) */
  laneEnd?: { lane: number; z0: number; z1: number };
  /** an off-ramp to the right starting at z (road metres), its sign 140 m before */
  exit?: { z: number };
  /** roadside plates: kind "exit" (green, arrow), "merge" (yellow, merging arrows), "km" (green, a distance), "speed" (red ring) */
  signs?: { z: number; kind: "exit" | "merge" | "km" | "speed" | "work"; text?: string; side?: "L" | "R" }[];
  /** a speed camera pole at road z that flashes at t */
  speedCam?: { z: number; at: number };
  /** an uphill: the road rises ahead (metres of rise per 100 m) */
  hill?: number;
  /** anime speed lines over the picture from t0 to t1 */
  streaks?: number[];
};

const W = 3.6;  // lane width (m)
const deg = Math.PI / 180;
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const hexRGB = (h: string) => { const x = h.replace("#", ""); const f = x.length === 3 ? x.split("").map((c) => c + c).join("") : x; return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16)); };
/** lighten (k > 0) or darken (k < 0) a hex colour */
export const shade = (h: string, k: number) => {
  const c = hexRGB(h).map((v) => (k >= 0 ? v + (255 - v) * k : v * (1 + k)));
  return "#" + c.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0")).join("");
};
const flash = (t: number, hz = 2.2) => Math.sin(t * Math.PI * 2 * hz) > 0;
const spans = (s: number[][] | boolean | undefined, t: number) => s === true || (Array.isArray(s) && s.some(([a, b]) => t >= a && t < b));

/** how far the world has moved by t, easing to rest at stopAt */
const travel = (v: number, stopAt: number | undefined, t: number) => {
  const ts = stopAt ?? 1e9;
  if (t <= ts) return v * t;
  const d = 1.2, k = clamp((t - ts) / d);
  return v * ts + v * d * (k - k * k / 2);
};

// ───────────────────────────── the face close-up ─────────────────────────────

/** a vehicle from the side (2D), front facing `dir` (-1 left, +1 right), its wheels on y; scale 1 ≈ a 700 px long car */
const SideVehicle: React.FC<{ kind?: DCar["kind"]; color?: string; driver?: Driver; x: number; y: number; s: number; dir: number; t: number; siren?: number; uid: string }> =
  ({ kind = "car", color = "#FF5C5C", driver, x, y, s, dir, t, siren, uid }) => {
  const wheel = (cx: number, r: number) => <g key={cx}><circle cx={cx} cy={-r} r={r} fill="#222" stroke={INK} strokeWidth={6} /><circle cx={cx} cy={-r} r={r * 0.45} fill="#9aa0a8" />
    <line x1={cx - r * 0.4 * Math.cos(t * 30)} y1={-r - r * 0.4 * Math.sin(t * 30)} x2={cx + r * 0.4 * Math.cos(t * 30)} y2={-r + r * 0.4 * Math.sin(t * 30)} stroke="#555" strokeWidth={6} /></g>;
  if (kind === "truck") return (
    <g transform={`translate(${x} ${y}) scale(${s * dir} ${s})`}>
      <rect x={-560} y={-560} width={900} height={440} rx={10} fill={color ?? "#e9e4da"} stroke={INK} strokeWidth={8} />
      {[-430, -250, -70, 110].map((k) => <line key={k} x1={k} x2={k} y1={-550} y2={-130} stroke={shade(color ?? "#e9e4da", -0.15)} strokeWidth={6} />)}
      <rect x={-560} y={-130} width={900} height={30} fill="#33363d" />
      <path d="M350 -110 L350 -470 L520 -470 Q590 -460 600 -380 L610 -110 Z" fill="#4DA3FF" stroke={INK} strokeWidth={8} strokeLinejoin="round" />
      <path d="M420 -450 L520 -450 Q570 -440 578 -370 L420 -370 Z" fill="#2b3a55" stroke={INK} strokeWidth={6} />
      {[-470, -360, 470].map((k) => wheel(k, 70))}
    </g>
  );
  const big = kind === "suv" || kind === "van", tiny = kind === "tiny", low = kind === "sports";
  const L = tiny ? 520 : big ? 760 : 700, H = tiny ? 330 : big ? 360 : low ? 230 : 290;
  const body = color ?? "#FF5C5C";
  const roofL = tiny ? -220 : big ? -330 : -230, roofR = tiny ? 150 : big ? 170 : 120, roofY = -H;
  const beltY = -H * (low ? 0.62 : 0.55);
  return (
    <g transform={`translate(${x} ${y}) scale(${s * dir} ${s})`}>
      <path d={`M${-L / 2} ${-60} L${-L / 2} ${beltY + 10} Q${-L / 2 + 10} ${beltY - 10} ${roofL - 50} ${beltY} L${roofL} ${roofY} L${roofR} ${roofY} L${roofR + (tiny ? 90 : 130)} ${beltY}
        L${L / 2 - 40} ${beltY + 16} Q${L / 2} ${beltY + 30} ${L / 2} ${-60} Z`} fill={kind === "police" ? "#F4F4F4" : body} stroke={INK} strokeWidth={8} strokeLinejoin="round" />
      <path d={`M${roofL + 14} ${roofY + 14} L${roofR - 6} ${roofY + 14} L${roofR + (tiny ? 70 : 104)} ${beltY - 6} L${roofL - 30} ${beltY - 6} Z`} fill="#2b3a55" stroke={INK} strokeWidth={6} />
      {driver ? <svg x={0} y={0} overflow="visible"><g><DriverFace d={driver} t={t} x={roofR - 150} y={roofY - 10} w={150} h={180} look={0.6} uid={uid} /></g></svg> : null}
      <path d={`M${roofL + 14} ${roofY + 14} L${roofR - 6} ${roofY + 14} L${roofR + (tiny ? 70 : 104)} ${beltY - 6} L${roofL - 30} ${beltY - 6} Z`} fill="#9cc8ff" opacity={0.18} />
      <line x1={(roofL + roofR) / 2 - 10} y1={roofY + 14} x2={(roofL + roofR) / 2 - 20} y2={beltY - 6} stroke={INK} strokeWidth={8} />
      {kind === "police" ? <><rect x={-L / 2 + 20} y={beltY + 40} width={L - 40} height={36} fill="#2A5BFF" />
        <rect x={(roofL + roofR) / 2 - 80} y={roofY - 34} width={160} height={30} rx={8} fill={siren != null && t >= siren && flash(t, 3) ? "#FF2A2A" : "#2A7BFF"} stroke={INK} strokeWidth={5}
          style={siren != null && t >= siren ? { filter: `drop-shadow(0 0 30px ${flash(t, 3) ? "#FF2A2A" : "#2A7BFF"})` } : undefined} /></> : null}
      <rect x={L / 2 - 46} y={beltY + 26} width={40} height={26} rx={8} fill="#FFF3B0" stroke={INK} strokeWidth={5} />
      <rect x={-L / 2 + 4} y={beltY + 26} width={30} height={30} rx={6} fill="#c22" stroke={INK} strokeWidth={5} />
      {wheel(-L / 2 + 130, 62)}{wheel(L / 2 - 130, 62)}
    </g>
  );
};

/** a car ahead seen from behind (2D), centred on x, its bottom on y, w wide */
const RearVehicle: React.FC<{ kind?: DCar["kind"]; color?: string; x: number; y: number; w: number; brake: boolean; t: number; siren?: number; dark?: boolean }> =
  ({ kind = "car", color = "#FF5C5C", x, y, w, brake, t, siren, dark }) => {
  const big = kind === "truck", h = big ? w * 1.05 : w * 0.72;
  const body = dark ? shade(color, -0.6) : kind === "police" ? "#F4F4F4" : color;
  const lit = brake ? "#FF2A2A" : dark ? "#3a1010" : "#a01f1f";
  return (
    <g transform={`translate(${x - w / 2} ${y - h})`}>
      <ellipse cx={w / 2} cy={h} rx={w * 0.56} ry={w * 0.05} fill="rgba(0,0,0,.35)" />
      {big ? <rect x={0} y={0} width={w} height={h * 0.9} rx={8} fill="#e9e4da" stroke={INK} strokeWidth={5} /> : <>
        <path d={`M${w * 0.14} ${h * 0.42} Q${w * 0.2} ${h * 0.02} ${w / 2} ${h * 0.02} Q${w * 0.8} ${h * 0.02} ${w * 0.86} ${h * 0.42} Z`} fill="#2b3a55" stroke={INK} strokeWidth={5} />
        <rect x={0} y={h * 0.4} width={w} height={h * 0.48} rx={w * 0.1} fill={body} stroke={INK} strokeWidth={5} />
        {kind === "police" ? <rect x={w * 0.28} y={-h * 0.04} width={w * 0.44} height={h * 0.08} rx={4} fill={siren != null && t >= siren && flash(t, 3) ? "#FF2A2A" : "#2A7BFF"}
          style={siren != null && t >= siren ? { filter: "drop-shadow(0 0 18px #ff2a2a)" } : undefined} /> : null}
      </>}
      {[w * 0.04, w * 0.76].map((lx) => <rect key={lx} x={lx} y={h * (big ? 0.72 : 0.5)} width={w * 0.2} height={h * 0.12} rx={4} fill={lit} stroke={INK} strokeWidth={4}
        style={brake ? { filter: `drop-shadow(0 0 ${w * 0.08}px #ff2a2a)` } : undefined} />)}
      <rect x={w * 0.06} y={h * 0.86} width={w * 0.16} height={h * 0.14} rx={4} fill={INK} />
      <rect x={w * 0.78} y={h * 0.86} width={w * 0.16} height={h * 0.14} rx={4} fill={INK} />
    </g>
  );
};

const FaceView: React.FC<{ g: DriveG; t: number; uid: string }> = ({ g, t, uid }) => {
  const d = g.driver ?? {};
  const night = g.time === "night";
  const s = travel(g.speed ?? 1500, g.stopAt, t);
  const flip = !!g.flip;
  const car = g.car ?? "#4DA3FF";
  const honking = (g.honk ?? []).find((h) => t >= h && t < h + 0.55);
  const win = "700,118 1790,74 1900,610 700,626";
  const sky = night ? ["#081028", "#1a2850"] : g.time === "dusk" ? ["#ff9a5a", "#ffd6a0"] : ["#78c3ff", "#d8efff"];
  const trees = Array.from({ length: 7 }, (_, k) => { const xx = ((k * 330 + s) % 2310) + 500; return xx; });
  const posts = Array.from({ length: 12 }, (_, k) => ((k * 180 + s * 1.25) % 2160) + 560);
  const peer = g.peer;
  const peerX = peer ? lerp(peer.x0, peer.x1, eInOut(prog(t, peer.at ?? 0, peer.dur ?? 2))) : 0;
  const ah = g.ahead;
  const aheadSize = ah ? lerp(ah.size ?? 0.5, ah.to ?? ah.size ?? 0.5, eInOut(prog(t, ah.toAt ?? 0, 0.6))) : 0;
  const police = g.police != null && t >= g.police;
  const glare = (g.glare ?? []).some(([a, b]) => t >= a && t < b);
  // hands: left on the wheel rim, right on the rim or pressing the horn
  const hub: [number, number] = [330, 900];
  const rh: [number, number] = honking != null ? [hub[0] + 20, hub[1] - 30 + 16 * Math.sin((t - honking) * 40)] : [490, 700];
  const skin = d.skin ?? "#FFD9B0", shirt = d.shirt ?? "#4DA3FF";
  const stage = (
    <g>
      {/* outside, through the side window */}
      <clipPath id={`${uid}w`}><polygon points={win} /></clipPath>
      <g clipPath={`url(#${uid}w)`}>
        <defs><linearGradient id={`${uid}sky`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={sky[0]} /><stop offset="1" stopColor={sky[1]} /></linearGradient></defs>
        <rect x={680} y={60} width={1260} height={600} fill={`url(#${uid}sky)`} />
        {night ? [[900, 160], [1200, 120], [1500, 210], [1700, 140], [1050, 260]].map(([sx, sy], k) => <circle key={k} cx={sx} cy={sy} r={3} fill="white" opacity={0.8} />) : null}
        <path d={`M680 ${night ? 470 : 440} Q${900 - (s * 0.05) % 300} 360 1100 430 T1500 420 T1950 430 L1950 640 L680 640 Z`} fill={night ? "#121a30" : "#8fc98a"} />
        <rect x={680} y={480} width={1260} height={160} fill={night ? "#0f1424" : "#6DBE5A"} />
        {trees.map((xx, k) => night
          ? <g key={k}><rect x={xx} y={250} width={10} height={250} fill="#30364a" /><circle cx={xx + 5} cy={250} r={16} fill="#ffe7a0" style={{ filter: "drop-shadow(0 0 26px #ffd060)" }} /></g>
          : <g key={k}><rect x={xx - 8} y={380} width={16} height={110} fill="#7a5530" /><circle cx={xx} cy={360} r={62} fill="#4E9E43" stroke={INK} strokeWidth={5} /></g>)}
        <rect x={680} y={520} width={1260} height={22} fill={night ? "#5a5f6a" : "#d9dde3"} stroke={INK} strokeWidth={4} />
        {posts.map((xx, k) => <rect key={k} x={xx} y={520} width={12} height={80} fill={night ? "#444955" : "#9aa0a8"} />)}
        {peer ? <SideVehicle kind={peer.kind} color={peer.color} driver={peer.driver} x={peerX} y={peer.kind === "truck" ? 760 : 640} s={peer.kind === "truck" ? 1.25 : 1.05} dir={-1} t={t}
          siren={peer.siren} uid={`${uid}p`} /> : null}
        {night ? <rect x={680} y={60} width={1260} height={600} fill="#000814" opacity={0.25} /> : null}
      </g>
      {/* the cabin */}
      <path d="M0 0 L1920 0 L1920 92 Q1300 50 700 110 L0 140 Z" fill="#23262d" />
      <path d={`M1790 74 L1920 70 L1920 1080 L1880 1080 L1900 610 Z`} fill="#23262d" />
      <path d="M700 626 L1900 610 L1920 1080 L700 1080 Z" fill="#383c45" />
      <path d="M700 626 L1900 610 L1902 650 L700 668 Z" fill={night ? shade(car, -0.5) : car} stroke={INK} strokeWidth={6} />
      {/* windshield on the left: the road ahead and the car in front */}
      <clipPath id={`${uid}f`}><polygon points="0,140 600,112 520,760 0,780" /></clipPath>
      <g clipPath={`url(#${uid}f)`}>
        <rect x={0} y={100} width={620} height={700} fill={night ? "#0b1430" : sky[1]} />
        <rect x={0} y={420} width={620} height={380} fill={night ? "#0f1424" : "#6DBE5A"} />
        <polygon points="300,410 340,410 640,800 -60,800" fill={night ? "#25272d" : "#55585f"} />
        {[0, 1, 2, 3].map((k) => { const u = ((k + s / 500) % 4) / 4, yy = 410 + 390 * u * u; return <rect key={k} x={318 - 2 - 10 * u} y={yy} width={4 + 20 * u} height={10 + 60 * u} fill="#f4f4f4" opacity={night ? 0.5 : 1} />; })}
        {night ? <polygon points="210,800 420,800 340,430 300,430" fill="#fff3b0" opacity={0.18} /> : null}
        {ah ? <RearVehicle kind={ah.kind} color={ah.color} x={330} y={430 + 330 * aheadSize} w={80 + 420 * aheadSize} brake={spans(ah.brake, t)} t={t} siren={ah.siren} dark={ah.dark} /> : null}
      </g>
      <polygon points="600,112 712,108 652,770 520,760" fill="#23262d" />
      <path d="M0 760 Q300 700 640 760 L620 1080 L0 1080 Z" fill="#2c3038" />
      {/* seat, the driver, the belt */}
      <rect x={1150} y={250} width={330} height={360} rx={90} fill="#3b3f48" stroke="#15171b" strokeWidth={8} />
      <rect x={980} y={560} width={600} height={560} rx={110} fill="#3b3f48" stroke="#15171b" strokeWidth={8} />
      <g style={night ? { filter: "brightness(.82) saturate(.9)" } : undefined}>
        <DriverFace d={d} t={t} x={600} y={40} w={860} h={1032} look={-0.45} uid={`${uid}d`} />
      </g>
      <polygon points="1300,650 1376,690 930,1080 850,1080" fill="#2a2a2e" stroke="#15171b" strokeWidth={5} />
      {/* arms, the wheel, the hands */}

      {[`M420 1130 Q260 940 ${200 + 10} ${690 + 30}`, `M600 1130 Q520 940 ${rh[0] + 10} ${rh[1] + 30}`].map((p, i) => <g key={i}>
        <path d={p} stroke={INK} strokeWidth={86} fill="none" strokeLinecap="round" /><path d={p} stroke={shade(shirt, i ? 0 : -0.12)} strokeWidth={72} fill="none" strokeLinecap="round" /></g>)}
      <g transform={`rotate(-10 ${hub[0]} ${hub[1]})`}>
        <ellipse cx={hub[0]} cy={hub[1]} rx={230} ry={300} fill="none" stroke="#15171b" strokeWidth={56} />
        <ellipse cx={hub[0]} cy={hub[1]} rx={230} ry={300} fill="none" stroke="#3a3e47" strokeWidth={32} />
        <rect x={hub[0] - 40} y={hub[1] - 60} width={80} height={240} rx={26} fill="#3a3e47" stroke="#15171b" strokeWidth={8} />
        <rect x={hub[0] - 220} y={hub[1] - 22} width={440} height={44} rx={16} fill="#3a3e47" stroke="#15171b" strokeWidth={8} />
        <ellipse cx={hub[0]} cy={hub[1]} rx={78} ry={92} fill="#2c3038" stroke="#15171b" strokeWidth={8} />
      </g>
      <ellipse cx={200} cy={690} rx={58} ry={48} fill={skin} stroke={INK} strokeWidth={7} />
      <ellipse cx={rh[0]} cy={rh[1]} rx={58} ry={48} fill={skin} stroke={INK} strokeWidth={7} />
      {honking != null ? <HornBurst x={hub[0] + 60} y={hub[1] + 20} t={t} t0={honking} size={1.5} /> : null}
      {night ? <rect x={0} y={0} width={1920} height={1080} fill="#06102a" opacity={0.18} /> : null}
      {police ? <rect x={0} y={0} width={1920} height={1080} fill={flash(t, 3) ? "#ff2a2a" : "#2a6bff"} opacity={0.2} /> : null}
      {glare ? <><defs><radialGradient id={`${uid}gl`} cx="0.92" cy="0.18" r="0.9"><stop offset="0" stopColor="white" stopOpacity={0.95} /><stop offset="0.5" stopColor="white" stopOpacity={0.35} /><stop offset="1" stopColor="white" stopOpacity={0} /></radialGradient></defs>
        <rect x={0} y={0} width={1920} height={1080} fill={`url(#${uid}gl)`} opacity={0.75 + 0.25 * Math.sin(t * 20)} /></> : null}
    </g>
  );
  return (
    <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0 }}>
      <rect width={1920} height={1080} fill="#23262d" />
      {flip ? <g transform="translate(1920 0) scale(-1 1)">{stage}</g> : stage}
      {(g.marks ?? []).map(([t0, k], i) => <Symbol key={i} kind={k} x={flip ? 1920 - 1330 : 1330} y={190} t={t} t0={t0} size={170} />)}
    </svg>
  );
};

// ───────────────────────────── the 3D car view ─────────────────────────────

const CAMS: Record<string, Cam> = {
  rear: { x: 0, y: 3.4, z: -12, yaw: 0, pitch: -10 },
  rearL: { x: -5, y: 2.6, z: -10, yaw: 22, pitch: -8 },
  rearR: { x: 5, y: 2.6, z: -10, yaw: -22, pitch: -8 },
  side: { x: 13, y: 1.8, z: 0, yaw: -90, pitch: -4 },
  sideL: { x: -13, y: 1.8, z: 0, yaw: 90, pitch: -4 },
  front: { x: 4, y: 1.9, z: 10, yaw: 200, pitch: -5 },
  frontL: { x: -4, y: 1.9, z: 10, yaw: 160, pitch: -5 },
  high: { x: 2, y: 10, z: -17, yaw: 0, pitch: -24 },
};
const camOf = (c: string | Cam | undefined): Cam => (typeof c === "string" ? CAMS[c] ?? CAMS.rear : c ?? CAMS.rear);

type Proj = { cam: (p: V3) => V3; scr: (q: V3) => [number, number]; F: number; eye: V3; pitch: number; yaw: number };
const mkProj = (c: Cam): Proj => {
  const yw = c.yaw * deg, pt = c.pitch * deg;
  const f: V3 = [Math.sin(yw) * Math.cos(pt), Math.sin(pt), Math.cos(yw) * Math.cos(pt)];
  const r: V3 = [Math.cos(yw), 0, -Math.sin(yw)];
  const u: V3 = [-Math.sin(yw) * Math.sin(pt), Math.cos(pt), -Math.cos(yw) * Math.sin(pt)];
  const F = 960 / Math.tan(((c.fov ?? 55) * deg) / 2);
  return {
    cam: (p) => { const d: V3 = [p[0] - c.x, p[1] - c.y, p[2] - c.z]; return [dot(d, r), dot(d, u), dot(d, f)]; },
    scr: (q) => [960 + (F * q[0]) / q[2], 540 - (F * q[1]) / q[2]],
    F, eye: [c.x, c.y, c.z], pitch: pt, yaw: yw,
  };
};
const ZN = 0.3;
const clipNear = (pts: V3[]) => {
  const out: V3[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], ain = a[2] >= ZN, bin = b[2] >= ZN;
    if (ain) out.push(a);
    if (ain !== bin) { const k = (ZN - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, ZN]); }
  }
  return out;
};
const polyPts = (P: Proj, pts: V3[]) => {
  const c = clipNear(pts.map(P.cam));
  if (c.length < 3) return null;
  return c.map((q) => P.scr(q).map((v) => v.toFixed(1)).join(",")).join(" ");
};
const Poly: React.FC<{ P: Proj; pts: V3[]; fill: string; stroke?: string; sw?: number; op?: number; style?: React.CSSProperties }> = ({ P, pts, fill, stroke = INK, sw = 3, op, style }) => {
  const p = polyPts(P, pts);
  return p ? <polygon points={p} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" opacity={op} style={style} /> : null;
};

/** the eight corners and six faces of a box: centre (x, z) on the ground at height y0, size w × h × l, turned by hd (radians) */
type Face = { pts: V3[]; n: V3; name: "top" | "left" | "right" | "front" | "rear" };
const boxFaces = (x: number, y0: number, z: number, w: number, h: number, l: number, hd: number, tw = 1, tl = 1): Face[] => {
  const cs = Math.cos(hd), sn = Math.sin(hd);
  const P = (lx: number, ly: number, lz: number): V3 => [x + lx * cs + lz * sn, y0 + ly, z - lx * sn + lz * cs];
  const R: V3 = [cs, 0, -sn], Fw: V3 = [sn, 0, cs];
  const a = w / 2, b = l / 2, at = a * tw, bt = b * tl;  // tw, tl < 1 narrow the top (a cabin with sloping glass)
  return [
    { name: "top", n: [0, 1, 0], pts: [P(-at, h, -bt), P(at, h, -bt), P(at, h, bt), P(-at, h, bt)] },
    { name: "left", n: [-R[0], 0, -R[2]], pts: [P(-a, 0, -b), P(-at, h, -bt), P(-at, h, bt), P(-a, 0, b)] },
    { name: "right", n: R, pts: [P(a, 0, -b), P(a, 0, b), P(at, h, bt), P(at, h, -bt)] },
    { name: "front", n: Fw, pts: [P(-a, 0, b), P(-at, h, bt), P(at, h, bt), P(a, 0, b)] },
    { name: "rear", n: [-Fw[0], 0, -Fw[2]], pts: [P(-a, 0, -b), P(a, 0, -b), P(at, h, -bt), P(-at, h, -bt)] },
  ];
};
const visibleFaces = (P: Proj, faces: Face[]) => faces.filter((f) => {
  const c = f.pts.reduce((s, p) => [s[0] + p[0] / 4, s[1] + p[1] / 4, s[2] + p[2] / 4] as V3, [0, 0, 0] as V3);
  return dot(f.n, [P.eye[0] - c[0], P.eye[1] - c[1], P.eye[2] - c[2]]) > 0;
});
const faceShade = (name: Face["name"]) => (name === "top" ? 0.2 : name === "right" ? -0.14 : name === "left" ? -0.05 : name === "front" ? 0.04 : 0);

type Part = { b: [number, number, number, number, number, number]; color: string; glass?: boolean; taper?: [number, number]; lamp?: "brake" | "tail" | "head" | "blinkL" | "blinkR" | "siren" };
/** a vehicle as boxes in its own frame (x right, y up, z forward): [x, y0, z, w, h, l] */
const model = (kind: DCar["kind"], color: string): { parts: Part[]; head: V3; len: number; height: number } => {
  const wheels = (wb: number, tw: number, r: number): Part[] => [[-tw, wb], [tw, wb], [-tw, -wb], [tw, -wb]].map(([x, z]) => ({ b: [x, 0, z, 0.3, r * 2, r * 2], color: "#26282d" }));
  const lamps = (w: number, y: number, l: number): Part[] => [
    { b: [-w / 2 + 0.22, y, -l / 2 - 0.02, 0.36, 0.17, 0.06], color: "#7a1414", lamp: "brake" },
    { b: [w / 2 - 0.22, y, -l / 2 - 0.02, 0.36, 0.17, 0.06], color: "#7a1414", lamp: "brake" },
    { b: [-w / 2 + 0.08, y - 0.17, -l / 2 - 0.02, 0.14, 0.12, 0.06], color: "#7a5a14", lamp: "blinkL" },
    { b: [w / 2 - 0.08, y - 0.17, -l / 2 - 0.02, 0.14, 0.12, 0.06], color: "#7a5a14", lamp: "blinkR" },
    { b: [-w / 2 + 0.25, y, l / 2 + 0.02, 0.4, 0.16, 0.06], color: "#e8e2c0", lamp: "head" },
    { b: [w / 2 - 0.25, y, l / 2 + 0.02, 0.4, 0.16, 0.06], color: "#e8e2c0", lamp: "head" },
    { b: [-w / 2 + 0.06, y - 0.17, l / 2 + 0.02, 0.12, 0.1, 0.06], color: "#7a5a14", lamp: "blinkL" },
    { b: [w / 2 - 0.06, y - 0.17, l / 2 + 0.02, 0.12, 0.1, 0.06], color: "#7a5a14", lamp: "blinkR" },
  ];
  switch (kind) {
    case "truck": {
      const tr = "#e9e4da";
      return { len: 14, height: 4.2, head: [-0.55, 2.55, 5.6], parts: [
        ...[[-1.05, -4.6], [1.05, -4.6], [-1.05, -3.4], [1.05, -3.4], [-1.05, 5.4], [1.05, 5.4], [-1.05, 3.4], [1.05, 3.4]].map(([x, z]) => ({ b: [x, 0, z, 0.45, 1.05, 1.05], color: "#26282d" } as Part)),
        { b: [0, 0.75, -1.4, 2.55, 3.4, 10.4], color: tr },
        { b: [0, 0.55, 5.4, 2.45, 1.45, 2.4], color },
        { b: [0, 2.0, 5.5, 2.4, 1.15, 2.2], color: "#2b3a55", glass: true },
        { b: [0, 3.15, 5.4, 2.45, 0.25, 2.4], color },
        { b: [-0.85, 0.95, -6.62, 0.4, 0.22, 0.05], color: "#7a1414", lamp: "brake" },
        { b: [0.85, 0.95, -6.62, 0.4, 0.22, 0.05], color: "#7a1414", lamp: "brake" },
        { b: [-1.15, 0.75, -6.62, 0.16, 0.14, 0.05], color: "#7a5a14", lamp: "blinkL" },
        { b: [1.15, 0.75, -6.62, 0.16, 0.14, 0.05], color: "#7a5a14", lamp: "blinkR" },
        { b: [-0.85, 0.9, 6.62, 0.45, 0.2, 0.05], color: "#e8e2c0", lamp: "head" },
        { b: [0.85, 0.9, 6.62, 0.45, 0.2, 0.05], color: "#e8e2c0", lamp: "head" },
      ] };
    }
    case "work": return { len: 5.6, height: 3.2, head: [-0.45, 1.75, 1.6], parts: [
      ...wheels(1.8, 0.82, 0.38),
      { b: [0, 0.4, 1.6, 2.0, 1.0, 2.0], color }, { b: [0, 1.4, 1.6, 1.9, 0.75, 1.8], color: "#2b3a55", glass: true }, { b: [0, 2.15, 1.6, 2.0, 0.12, 2.0], color },
      { b: [0, 0.4, -1.1, 2.0, 0.7, 3.4], color: shade(color, -0.15) },
      { b: [0, 1.3, -2.6, 1.9, 1.6, 0.2], color: "#222" },
      { b: [0, 1.4, -2.73, 1.6, 1.3, 0.05], color: "#FFB000", lamp: "siren" },
      ...lamps(2.0, 0.75, 5.6).filter((p) => p.lamp !== "brake"),
    ] };
    default: {
      const S = kind === "tiny" ? { w: 1.6, l: 3.5, y0: 0.3, bh: 0.78, ch: 0.72, cl: 2.1, cz: -0.05, cw: 1.5 }
        : kind === "suv" ? { w: 1.95, l: 4.8, y0: 0.4, bh: 0.95, ch: 0.68, cl: 3.0, cz: -0.45, cw: 1.82 }
        : kind === "van" ? { w: 1.95, l: 5.0, y0: 0.4, bh: 0.95, ch: 0.95, cl: 3.8, cz: -0.4, cw: 1.9 }
        : kind === "sports" ? { w: 1.9, l: 4.5, y0: 0.25, bh: 0.58, ch: 0.48, cl: 1.9, cz: -0.35, cw: 1.5 }
        : { w: 1.8, l: 4.5, y0: 0.32, bh: 0.72, ch: 0.58, cl: 2.4, cz: -0.25, cw: 1.6 };
      const body = kind === "police" ? "#F2F2F2" : color;
      const r = S.y0 + 0.02;
      const parts: Part[] = [
        ...wheels(S.l / 2 - 0.85, S.w / 2 - 0.12, Math.max(0.3, r)),
        { b: [0, S.y0, 0, S.w, S.bh, S.l], color: body },
        { b: [0, S.y0 + S.bh, S.cz, S.cw, S.ch * 0.92, S.cl], color: "#2b3a55", glass: true, taper: [0.86, kind === "van" ? 0.9 : 0.66] },
        { b: [0, S.y0 + S.bh + S.ch * 0.92, S.cz, S.cw * 0.86, S.ch * 0.08, S.cl * (kind === "van" ? 0.9 : 0.66)], color: body },
        ...lamps(S.w, S.y0 + S.bh * 0.62, S.l),
      ];
      if (kind === "police") {
        parts.push({ b: [0, S.y0 + S.bh * 0.25, 0, S.w + 0.02, S.bh * 0.3, S.l * 0.6], color: "#2A5BFF" });
        parts.push({ b: [-0.32, S.y0 + S.bh + S.ch, S.cz, 0.62, 0.14, 0.32], color: "#FF2A2A", lamp: "siren" });
        parts.push({ b: [0.32, S.y0 + S.bh + S.ch, S.cz, 0.62, 0.14, 0.32], color: "#2A7BFF", lamp: "siren" });
      }
      return { len: S.l, height: S.y0 + S.bh + S.ch, head: [-0.38, S.y0 + S.bh + S.ch * 0.42, S.cz + 0.25], parts };
    }
  }
};

const carState = (c: DCar, t: number) => {
  const at = (tt: number) => {
    let lane = c.lane, z = c.z;
    for (const p of c.path ?? []) {
      if (tt < p[0]) break;
      const k = eInOut(clamp((tt - p[0]) / (p[3] ?? 1)));
      lane = lerp(lane, p[1], k); z = lerp(z, p[2], k);
    }
    return [lane, z + (c.vz ?? 0) * tt];
  };
  const [lane, z] = at(t), [l2, z2] = at(t + 0.06), [l0, z0] = at(t - 0.06);
  const hd = c.heading != null ? c.heading * deg : Math.atan2(((l2 - l0) * W) / 0.12, 22 + ((z2 - z0) / 0.12)) * 0.9;
  return { X: (lane - 0.5) * W, z, hd };
};

const CarView: React.FC<{ g: DriveG; t: number; uid: string }> = ({ g, t, uid }) => {
  const n = g.lanes ?? 3, night = g.time === "night";
  const cars = g.cars ?? [];
  const s = travel(g.speed ?? 25, g.stopAt, t);
  // the camera: a preset or values, relative to the followed car; cam2 eases in
  const fol = g.follow != null && cars[g.follow] ? cars[g.follow] : null;
  const ref = fol ? { X: (fol.lane - 0.5) * W, z: carState(fol, t).z } : { X: 1.5 * W, z: 0 };
  const c1 = camOf(g.cam), c2 = g.cam2 ? camOf(g.cam2) : c1, k = g.cam2 ? eInOut(prog(t, g.camAt ?? 0, g.camDur ?? 1.5)) : 0;
  const cam: Cam = { x: ref.X + lerp(c1.x, c2.x, k), y: lerp(c1.y, c2.y, k), z: ref.z + lerp(c1.z, c2.z, k), yaw: lerp(c1.yaw, c2.yaw, k), pitch: lerp(c1.pitch, c2.pitch, k), fov: lerp(c1.fov ?? 55, c2.fov ?? 55, k) };
  const P = mkProj(cam);
  const hill = (g.hill ?? 0) / 100;
  const Y = (z: number) => (hill && z > 0 ? hill * z * z / 120 : 0);  // the road curving up ahead
  const v = (x: number, y: number, z: number): V3 => [x, y + Y(z), z];
  const roadZ = (z: number) => z - s + ref.z;  // a road mark at road metre z sits here, relative to the camera's frame
  const horizon = 540 + P.F * Math.tan(P.pitch);
  const sky = night ? ["#050b1e", "#16224a"] : g.time === "dusk" ? ["#ff8a50", "#ffd2a0"] : ["#5fb4ff", "#d4ecff"];
  const grass = night ? "#0c1220" : "#6DBE5A", asphalt = night ? "#24262c" : "#5a5d64", line = night ? "#b8bcc4" : "#f4f4f4";
  const zNear = ref.z - 60, zFar = ref.z + 700;
  const right = n * W, shoulderR = right + 3.2;
  const ground: React.ReactNode[] = [];
  const quad = (key: string, x0: number, x1: number, za: number, zb: number, fill: string, op?: number) => {
    const steps = hill ? 16 : 1, out: React.ReactNode[] = [];
    for (let i = 0; i < steps; i++) {
      const a = za + ((zb - za) * i) / steps, b = za + ((zb - za) * (i + 1)) / steps;
      out.push(<Poly key={`${key}${i}`} P={P} pts={[v(x0, 0, a), v(x1, 0, a), v(x1, 0, b), v(x0, 0, b)]} fill={fill} stroke="none" sw={0} op={op} />);
    }
    return out;
  };
  ground.push(...quad("g", -400, 400, zNear, zFar, grass));
  ground.push(...quad("m", -3.2, -0.4, zNear, zFar, night ? "#2a2d34" : "#9a9a9a"));
  ground.push(...quad("r", -0.4, shoulderR, zNear, zFar, asphalt));
  ground.push(...quad("cy", -0.3, -0.12, zNear, zFar, "#FFC21A"), ...quad("cy2", -0.06, 0.1, zNear, zFar, "#FFC21A"));
  ground.push(...quad("e", right - 0.08, right + 0.08, zNear, zFar, line));
  // lane dashes (8 m every 20 m), scrolling
  const end = g.laneEnd;
  for (let b = 1; b < n; b++) {
    const x = b * W;
    for (let j = -4; j < 34; j++) {
      const z0 = ref.z + j * 20 - (s % 20);
      const rz = z0 - ref.z + s;  // road metre
      if (end && (b === end.lane - 1 || b === end.lane) && rz > end.z1) continue;
      ground.push(<Poly key={`d${b}_${j}`} P={P} pts={[v(x - 0.08, 0.01, z0), v(x + 0.08, 0.01, z0), v(x + 0.08, 0.01, z0 + 8), v(x - 0.08, 0.01, z0 + 8)]} fill={line} stroke="none" sw={0} />);
    }
  }
  // a lane that ends: hatching over the closed part
  if (end) {
    const xa = (end.lane - 1) * W, xb = end.lane * W, za = roadZ(end.z0), zb = roadZ(end.z1);
    const leftSide = end.lane === 1;
    const taper: V3[] = leftSide ? [v(xa, 0.01, za), v(xa, 0.01, zb), v(xb, 0.01, zb)] : [v(xb, 0.01, za), v(xb, 0.01, zb), v(xa, 0.01, zb)];
    ground.push(<Poly key="taper" P={P} pts={taper} fill={night ? "#5b5e66" : "#c9cbd0"} stroke="none" sw={0} />);
    ground.push(...quad("closed", xa, xb, zb, zb + 400, night ? "#3a3d44" : "#8d9097"));
    for (let j = 0; j < 30; j++) { const zz = zb + j * 6; ground.push(<Poly key={`h${j}`} P={P} pts={[v(xa, 0.02, zz), v(xb, 0.02, zz + 2.5), v(xb, 0.02, zz + 3.3), v(xa, 0.02, zz + 0.8)]} fill="#f4f4f4" stroke="none" sw={0} op={0.8} />); }
  }
  // an off-ramp to the right
  if (g.exit) {
    const z0 = roadZ(g.exit.z);
    const ramp: V3[] = [v(right, 0, z0), v(right + 3.2, 0, z0), v(right + 3.2 + 40, 0, z0 + 160), v(right + 40 - 3.6, 0, z0 + 160)];
    ground.push(<Poly key="ramp" P={P} pts={[v(right, 0, z0 - 40), v(shoulderR + 0.5, 0, z0 - 40), v(right + 3.2 + 46, 0, z0 + 170), v(right + 3.2 + 40 - 3.6, 0, z0 + 170)]} fill={asphalt} stroke="none" sw={0} />);
    ground.push(<Poly key="gore" P={P} pts={[v(right + 0.1, 0.01, z0 + 10), v(right + 14, 0.01, z0 + 70), v(right + 4, 0.01, z0 + 80)]} fill="#f4f4f4" stroke="none" sw={0} op={0.85} />);
    void ramp;
  }
  // objects drawn far to near: roadside trees or street lamps, signs, cones, cars
  type Obj = { d: number; el: React.ReactNode };
  const objs: Obj[] = [];
  const depth = (p: V3) => P.cam(p)[2];
  const billboard = (key: string, p: V3, hM: number, draw: (x: number, y: number, sc: number) => React.ReactNode) => {
    const q = P.cam(p);
    if (q[2] < ZN + 0.5) return;
    const [x, y] = P.scr(q), sc = P.F / q[2];
    if (x < -600 || x > 2520) return;
    objs.push({ d: q[2], el: <g key={key}>{draw(x, y, sc * hM)}</g> });
  };
  for (let j = -3; j < 40; j++) {
    const z = ref.z + j * 22 - (s % 22);
    for (const side of [-1, 1]) {
      if (Math.abs(Math.sin(P.yaw)) > 0.7 && side === -Math.sign(Math.sin(P.yaw))) continue;  // a side camera: no trees between it and the road
      const x = side < 0 ? -8 - (j % 3) * 3 : shoulderR + 5 + (j % 3) * 3;
      if (g.exit && side > 0) { const rz = z - ref.z + s; if (rz > g.exit.z - 50 && rz < g.exit.z + 200) continue; }
      if (night) billboard(`l${j}${side}`, v(x, 0, z), 1, (sx, sy, sc) => (j % 2 ? null : <g>
        <rect x={sx - 0.12 * sc} y={sy - 9 * sc} width={0.24 * sc} height={9 * sc} fill="#30364a" />
        <circle cx={sx} cy={sy - 9 * sc} r={0.5 * sc} fill="#ffe7a0" style={{ filter: `drop-shadow(0 0 ${Math.min(40, 2 * sc)}px #ffd060)` }} /></g>));
      else billboard(`t${j}${side}`, v(x, 0, z), 1, (sx, sy, sc) => <g>
        <rect x={sx - 0.25 * sc} y={sy - 3 * sc} width={0.5 * sc} height={3 * sc} fill="#7a5530" />
        <ellipse cx={sx} cy={sy - 4.6 * sc} rx={2.4 * sc} ry={2.8 * sc} fill={j % 2 ? "#4E9E43" : "#5aa84c"} stroke={INK} strokeWidth={Math.max(1, 0.12 * sc)} /></g>);
    }
  }
  // the median barrier, in segments so it sorts with the cars
  for (let j = -3; j < 40; j++) {
    const z0 = ref.z + j * 20 - (s % 20) - 30;
    const faces = visibleFaces(P, boxFaces(-1.3, Y(z0), z0 + 10, 0.6, 0.85, 20, 0));
    const c = depth(v(-1.3, 0.4, z0 + 10));
    if (c < ZN) continue;
    objs.push({ d: c + 30, el: <g key={`mb${j}`}>{faces.map((f, i) => <Poly key={i} P={P} pts={f.pts} fill={shade(night ? "#5b5e66" : "#c9cbd0", faceShade(f.name))} stroke="none" sw={0} />)}</g> });
  }
  const cone = (key: string, x: number, z: number) => billboard(key, v(x, 0, z), 1, (sx, sy, sc) => <g>
    <polygon points={`${sx - 0.22 * sc},${sy} ${sx + 0.22 * sc},${sy} ${sx + 0.05 * sc},${sy - 0.75 * sc} ${sx - 0.05 * sc},${sy - 0.75 * sc}`} fill="#FF7A1A" stroke={INK} strokeWidth={Math.max(1, 0.04 * sc)} />
    <rect x={sx - 0.16 * sc} y={sy - 0.45 * sc} width={0.32 * sc} height={0.12 * sc} fill="white" /></g>);
  for (const [i, [lane, z]] of (g.cones ?? []).entries()) cone(`c${i}`, (lane - 0.5) * W, roadZ(z));
  if (end) {
    const xa = (end.lane - 1) * W, xb = end.lane * W, leftSide = end.lane === 1;
    for (let j = 0; j <= 8; j++) { const k = j / 8; cone(`tc${j}`, leftSide ? lerp(xa + 0.3, xb - 0.2, k) : lerp(xb - 0.3, xa + 0.2, k), roadZ(lerp(end.z0, end.z1, k))); }
    for (let j = 1; j < 30; j++) cone(`lc${j}`, leftSide ? xb - 0.3 : xa + 0.3, roadZ(end.z1 + j * 8));
  }
  // roadside signs (plates facing the drivers); the exit gets its own sign 140 m before
  const signs = [...(g.signs ?? []), ...(g.exit ? [{ z: g.exit.z - 140, kind: "exit" as const }] : [])];
  for (const [i, sg] of signs.entries()) {
    const x = sg.side === "L" ? -4 : shoulderR + 1.6, z = roadZ(sg.z);
    const big = sg.kind === "exit" || sg.kind === "km";
    const pw = big ? 4.2 : 2.0, ph = big ? 2.4 : 2.0, py = big ? 4.2 : 2.4;
    const q = P.cam(v(x, py, z));
    if (q[2] < 1) continue;
    const corners = [v(x - pw / 2, py, z), v(x + pw / 2, py, z), v(x + pw / 2, py + ph, z), v(x - pw / 2, py + ph, z)].map((p) => P.cam(p));
    if (corners.some((c) => c[2] < ZN)) continue;
    const sc = corners.map(P.scr);
    const cx = (sc[0][0] + sc[2][0]) / 2, cy = (sc[0][1] + sc[2][1]) / 2, sw = Math.abs(sc[1][0] - sc[0][0]), shh = Math.abs(sc[2][1] - sc[1][1]);
    const fill = sg.kind === "merge" || sg.kind === "work" ? "#FFC21A" : sg.kind === "speed" ? "white" : "#1f8f4e";
    const post = P.scr(P.cam(v(x, 0, z)));
    objs.push({ d: q[2], el: <g key={`s${i}`}>
      <line x1={post[0]} y1={post[1]} x2={cx} y2={cy} stroke="#7d828c" strokeWidth={Math.max(2, sw * 0.05)} />
      <polygon points={sc.map((p) => p.join(",")).join(" ")} fill={fill} stroke={sg.kind === "speed" ? "#e8212e" : "white"} strokeWidth={Math.max(2, sw * 0.04)} />
      {sw > 14 ? <g transform={`translate(${cx} ${cy}) scale(${sw / 200} ${shh / (big ? 114 : 200)})`}>
        {sg.kind === "exit" ? <><path d="M-40 40 L-40 -10 L10 -48" stroke="white" strokeWidth={14} fill="none" strokeLinecap="round" strokeLinejoin="round" /><path d="M-6 -56 L22 -60 L18 -32 Z" fill="white" />
          {sg.text ? <text x={30} y={34} fontFamily="BlackHanSans" fontSize={44} fill="white">{sg.text}</text> : null}</>
        : sg.kind === "km" ? <text x={0} y={18} textAnchor="middle" fontFamily="BlackHanSans" fontSize={56} fill="white">{sg.text ?? ""}</text>
        : sg.kind === "speed" ? <><circle r={84} fill="none" stroke="#e8212e" strokeWidth={26} /><text y={34} textAnchor="middle" fontFamily="BlackHanSans" fontSize={96} fill={INK}>{sg.text ?? "100"}</text></>
        : sg.kind === "work" ? <><path d="M-60 60 L0 -60 L60 60 Z" fill="none" stroke={INK} strokeWidth={12} strokeLinejoin="round" /><rect x={-6} y={-20} width={12} height={46} fill={INK} /><circle cy={44} r={8} fill={INK} /></>
        : <><path d="M-50 70 L-50 10 L-4 -40" stroke={INK} strokeWidth={18} fill="none" strokeLinecap="round" /><path d="M50 70 L50 -70" stroke={INK} strokeWidth={18} fill="none" strokeLinecap="round" /><path d="M-22 -50 L4 -62 L2 -34 Z" fill={INK} /><path d="M38 -60 L50 -84 L62 -60 Z" fill={INK} /></>}
      </g> : null}
    </g> });
  }
  // a speed camera
  if (g.speedCam) {
    const x = shoulderR + 1.2, z = roadZ(g.speedCam.z), on = t >= g.speedCam.at && t < g.speedCam.at + 0.35;
    billboard("cam", v(x, 0, z), 1, (sx, sy, sc) => <g>
      <rect x={sx - 0.1 * sc} y={sy - 6 * sc} width={0.2 * sc} height={6 * sc} fill="#7d828c" />
      <rect x={sx - 0.8 * sc} y={sy - 6.9 * sc} width={1.0 * sc} height={0.9 * sc} rx={0.1 * sc} fill="#e9e9e9" stroke={INK} strokeWidth={Math.max(1, 0.05 * sc)} />
      <circle cx={sx - 0.65 * sc} cy={sy - 6.45 * sc} r={0.25 * sc} fill={on ? "white" : "#222"} style={on ? { filter: `drop-shadow(0 0 ${Math.min(80, 6 * sc)}px white)` } : undefined} /></g>);
  }
  // cars
  const glows: React.ReactNode[] = [];
  cars.forEach((c, ci) => {
    const st = carState(c, t);
    const zc = st.z + (fol ? 0 : 0);
    const base = c.color ?? (c.kind === "police" ? "#F2F2F2" : c.kind === "truck" ? "#4DA3FF" : c.kind === "work" ? "#FFB000" : "#FF5C5C");
    const M = model(c.kind, base);
    const y0 = Y(zc);
    const ctr = P.cam(v(st.X, 1, zc));
    if (ctr[2] < -M.len) return;
    const isDark = c.dark === true || (typeof c.dark === "number" && t < c.dark);
    const braking = spans(c.brake, t), lightsOn = !isDark && (night ? true : c.lights === true || (typeof c.lights === "number" && t >= c.lights));
    const blinking = c.blink && t >= (c.blinkAt ?? 0) && t < (c.blinkOff ?? 1e9) && flash(t);
    const sirenOn = c.siren != null && t >= c.siren;
    const dim = night ? (isDark ? -0.72 : -0.45) : 0;
    const els: React.ReactNode[] = [];
    // the shadow on the road
    const sh = boxFaces(st.X, y0 + 0.01, zc, (c.kind === "truck" ? 2.7 : 2.0), 0, M.len + 0.4, st.hd)[0];
    els.push(<Poly key="sh" P={P} pts={sh.pts} fill="rgba(0,0,0,.28)" stroke="none" sw={0} />);
    const glassFaces: string[] = [];
    for (const [pi, part] of M.parts.entries()) {
      const [lx, ly, lz, w, h, l] = part.b;
      const X = st.X + lx * Math.cos(st.hd) + lz * Math.sin(st.hd), Z = zc - lx * Math.sin(st.hd) + lz * Math.cos(st.hd);
      const faces = visibleFaces(P, boxFaces(X, y0 + ly, Z, w, h, l, st.hd, part.taper?.[0], part.taper?.[1]));
      let col = part.color, glow: string | null = null;
      if (part.lamp === "brake") { if (braking) { col = "#FF2A2A"; glow = "#ff2a2a"; } else if (lightsOn) { col = "#d02020"; glow = night ? "#ff3030" : null; } }
      if (part.lamp === "head" && lightsOn) { col = "#fff7d0"; glow = night ? "#fff3b0" : null; }
      if ((part.lamp === "blinkL" && blinking && c.blink === "L") || (part.lamp === "blinkR" && blinking && c.blink === "R")) { col = "#FFB000"; glow = "#FFB000"; }
      if (part.lamp === "siren") { const red = part.color === "#FF2A2A"; const lit = sirenOn && (red ? flash(t, 3) : !flash(t, 3)); col = lit ? part.color : shade(part.color, -0.5); if (lit) glow = part.color; if (c.kind === "work") { col = flash(t, 1.5) ? "#FFB000" : "#6a4a10"; glow = flash(t, 1.5) ? "#FFB000" : null; } }
      for (const [fi, f] of faces.entries()) {
        const fill = part.glass ? (f.name === "top" ? shade(base, dim) : shade("#2b3a55", (f.name === "front" || f.name === "rear" ? 0.08 : 0) + dim * 0.5))
          : part.lamp ? col : shade(col, faceShade(f.name) + (part.color === "#26282d" ? 0 : dim));
        const pts = polyPts(P, f.pts);
        if (!pts) continue;
        if (part.glass && f.name !== "top") glassFaces.push(pts);
        els.push(<polygon key={`${pi}_${fi}`} points={pts} fill={fill} stroke={INK} strokeWidth={part.lamp ? 1.5 : 2.5} strokeLinejoin="round"
          style={glow ? { filter: `drop-shadow(0 0 ${Math.max(6, Math.min(40, P.F / Math.max(1, ctr[2]) * 0.25))}px ${glow})` } : undefined} />);
      }
    }
    // the driver, seen through the glass only
    if (c.driver && glassFaces.length) {
      const hp: V3 = [st.X + M.head[0] * Math.cos(st.hd) + M.head[2] * Math.sin(st.hd), y0 + M.head[1], zc - M.head[0] * Math.sin(st.hd) + M.head[2] * Math.cos(st.hd)];
      const q = P.cam(hp);
      if (q[2] > ZN) {
        const fwd: V3 = [Math.sin(st.hd), 0, Math.cos(st.hd)];
        const back = dot(fwd, [P.eye[0] - hp[0], P.eye[1] - hp[1], P.eye[2] - hp[2]]) < -0.3 * Math.hypot(P.eye[0] - hp[0], P.eye[2] - hp[2]);
        const [hx, hy] = P.scr(q), size = (P.F * (back ? 0.72 : 0.9)) / q[2];
        const id = `${uid}c${ci}`;
        els.push(<g key="drv"><clipPath id={id}>{glassFaces.map((p, i) => <polygon key={i} points={p} />)}</clipPath>
          <g clipPath={`url(#${id})`}>
            <DriverFace d={c.driver} t={t} x={hx - size * 0.5} y={hy - size * 0.47} w={size} h={size * 1.2} look={back ? 0 : 0.2} back={back} uid={`${id}f`} />
            <polygon points={glassFaces[0]} fill="#9cc8ff" opacity={0} />
          </g>
          {glassFaces.map((p, i) => <polygon key={i} points={p} fill="#bfe0ff" opacity={night ? 0.06 : 0.14} />)}
        </g>);
      }
    }
    // headlight beams at night, exhaust puffs, streaks, horn bursts, symbols
    if (night && lightsOn) {
      const fwd = [Math.sin(st.hd), Math.cos(st.hd)];
      const fx = st.X + fwd[0] * M.len / 2, fz = zc + fwd[1] * M.len / 2;
      ground.push(<Poly key={`beam${ci}`} P={P} pts={[v(fx - 0.8, 0.02, fz), v(fx + 0.8, 0.02, fz), v(fx + 4 + fwd[0] * 30, 0.02, fz + 30), v(fx - 4 + fwd[0] * 30, 0.02, fz + 30)]} fill="#fff3b0" stroke="none" sw={0} op={0.22} />);
    }
    for (const t0 of c.smoke ?? []) {
      const p = (t - t0) / 1.6;
      if (p < 0 || p > 1) continue;
      for (let k = 0; k < 3; k++) {
        const pp = clamp(p * 1.2 - k * 0.12);
        const q = P.cam(v(st.X + 0.6 + k * 0.3, 0.5 + pp * 1.6, zc - M.len / 2 - 0.5 - pp * 4));
        if (q[2] < ZN) continue;
        const [x, y] = P.scr(q), r = (P.F / q[2]) * (0.4 + 1.2 * pp);
        glows.push(<circle key={`sm${ci}${t0}${k}`} cx={x} cy={y} r={r} fill={night ? "#6b6f7a" : "#a9adb5"} opacity={0.85 * (1 - pp)} stroke={INK} strokeWidth={2} />);
      }
    }
    const [fa, fb] = c.fast ?? [1e9, 0];
    if (t >= fa && t < fb) {
      for (let k = 0; k < 4; k++) {
        const a = P.cam(v(st.X - 0.8 + k * 0.55, 0.4 + (k % 2) * 0.6, zc - M.len / 2 - 0.4)), b = P.cam(v(st.X - 0.8 + k * 0.55, 0.4 + (k % 2) * 0.6, zc - M.len / 2 - 6 - 3 * ((t * 3 + k * 0.3) % 1)));
        if (a[2] < ZN || b[2] < ZN) continue;
        const [x1, y1] = P.scr(a), [x2, y2] = P.scr(b);
        glows.push(<line key={`f${ci}${k}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeWidth={6} strokeLinecap="round" opacity={0.7} />);
      }
    }
    const top = P.cam(v(st.X, M.height + 1.2, zc));
    if (top[2] > ZN) {
      const [tx, ty] = P.scr(top), sz = clamp((P.F / top[2]) * 1.4, 70, 220);
      for (const h of c.honk ?? []) glows.push(<HornBurst key={`h${ci}${h}`} x={tx} y={ty} t={t} t0={h} size={sz / 120} />);
      for (const [t0, kk] of c.marks ?? []) glows.push(<Symbol key={`m${ci}${t0}`} kind={kk} x={tx} y={ty - sz * 0.3} t={t} t0={t0} size={sz} />);
    }
    objs.push({ d: ctr[2], el: <g key={`car${ci}`}>{els}</g> });
  });
  objs.sort((a, b) => b.d - a.d);
  const hillsX = (-P.yaw / deg) * 30;
  return (
    <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0 }}>
      <defs><linearGradient id={`${uid}sk`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={sky[0]} /><stop offset="1" stopColor={sky[1]} /></linearGradient></defs>
      <rect width={1920} height={1080} fill={`url(#${uid}sk)`} />
      {night ? [[200, 120], [540, 80], [880, 160], [1300, 100], [1700, 150], [1500, 60], [700, 220]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={3} fill="white" opacity={0.8} />) : null}
      <g transform={`translate(${((hillsX % 1920) + 1920) % 1920 - 1920} ${horizon})`}>
        {[0, 1920].map((ox) => <path key={ox} transform={`translate(${ox} 0)`} d="M0 2 Q160 -70 330 -20 Q480 -110 700 -14 Q900 -80 1080 -10 Q1260 -90 1460 -24 Q1660 -76 1920 2 L1920 30 L0 30 Z" fill={night ? "#0f1830" : "#8fc98a"} />)}
      </g>
      {ground}
      {objs.map((o) => o.el)}
      {glows}
    </svg>
  );
};

// ───────────────────────────── shared frame effects ─────────────────────────────

let uidN = 0;
export const Drive: React.FC<{ g: DriveG; t: number; h: number }> = ({ g, t, h }) => {
  const uid = React.useMemo(() => `dv${++uidN}`, []);
  const sc = h / 1080;
  const [z0, z1] = Array.isArray(g.zoom) ? g.zoom : [1, g.zoom ?? 1];
  let z = z0 + (z1 - z0) * eInOut(prog(t, 0, 3));
  let sx = 0, sy = 0, dark = 0;
  for (const t0 of g.shake ?? []) if (t >= t0 && t < t0 + 0.5) { const a = 22 * (1 - (t - t0) / 0.5); sx += a * Math.sin(t * 90); sy += a * Math.cos(t * 77); }
  for (const t0 of g.honk ?? []) if (t >= t0 && t < t0 + 0.25) sx += 8 * Math.sin(t * 120);
  for (const t0 of g.dun ?? []) {
    if (t >= t0 && t < t0 + 0.25) z *= 1 + 0.1 * eOut(prog(t, t0, 0.12));
    else if (t >= t0 + 0.25) z *= 1.1;
    dark = Math.max(dark, t >= t0 ? 0.55 * (1 - prog(t, t0 + 1.2, 0.6)) : 0);
  }
  let white = 0;
  for (const t0 of g.flash ?? []) if (t >= t0) white = Math.max(white, 0.95 * (1 - eOut(prog(t, t0, 0.35))));
  const [fa, fb] = g.streaks ?? [1e9, 0];
  const streaks = t >= fa && t < fb;
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#000" }}>
      <div style={{ position: "absolute", left: (1080 - 1920 * sc) / 2, top: 0, width: 1920, height: 1080, transformOrigin: "0 0", transform: `scale(${sc})` }}>
        <div style={{ position: "absolute", inset: 0, transform: `translate(${sx}px, ${sy}px) scale(${z})`, transformOrigin: g.view === "face" ? `${g.flip ? 1920 - 1040 : 1040}px 470px` : "960px 540px" }}>
          {g.view === "face" ? <FaceView g={g} t={t} uid={uid} /> : <CarView g={g} t={t} uid={uid} />}
        </div>
        {streaks ? <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
          {Array.from({ length: 28 }, (_, i) => { const a = (i / 28) * Math.PI * 2 + i * 0.37, j = (t * 7 + i * 0.61) % 1, r0 = 520 + 260 * j;
            return <line key={i} x1={960 + Math.cos(a) * r0} y1={540 + Math.sin(a) * r0 * 0.62} x2={960 + Math.cos(a) * (r0 + 500)} y2={540 + Math.sin(a) * (r0 + 500) * 0.62} stroke="white" strokeWidth={5 + (i % 3) * 3} opacity={0.6} />; })}
        </svg> : null}
        {dark > 0 ? <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 50%, rgba(80,0,0,0) 30%, rgba(60,0,0,.95) 100%)", opacity: dark / 0.55 }} /> : null}
        {white > 0.002 ? <div style={{ position: "absolute", inset: 0, background: "white", opacity: white }} /> : null}
      </div>
    </div>
  );
};
