// Road cartoons ("2D 운전 참교육"): simple 2D cars and their drivers act out a road villain and the comeuppance.
// A road clip is a graphic clip (lib/Gfx.tsx type "road") drawn in the 1080×1080 box, in one of two views:
//   "top"      the road from above: grey asphalt, lane lines scrolling down for speed, rounded-rectangle cars with a
//              windshield and the driver's mochi face (lib/Sseol.tsx) showing a mood
//   "cockpit"  from the hero's seat: windshield frame, dashboard, steering wheel, the hero's face, the road ahead in
//              perspective and the cars in front seen from behind
// Everything is a pure function of t (seconds since the clip started) and of `steps` (seconds, from narration anchors):
// a car's path point [step, lane, y] starts its move at steps[step] and eases there in `dur` (default 0.7 s).
// No brands, logos or licence plates are ever drawn; nobody crashes. An exaggerated comeuppance sets `imagine`.
import React from "react";
import { fitText, measureText } from "@remotion/layout-utils";
import { BODY, TITLE } from "./fonts";
import { clamp, eBack, eInOut, eOut, lerp, prog } from "./fx";
import { Marked } from "./Marked";
import { Mochi, type Mood } from "./Sseol";
import { Drive, type DriveG } from "./Drive";

export type RoadCar = {
  id?: string; color?: string; kind?: "car" | "truck" | "bus" | "police";
  /** lane 1 is the leftmost lane (next to the centre line, 1차로); fractions sit between lanes, beyond lanes is off the road */
  lane: number;
  /** top view: the car's centre, 0 (top) .. 1080 (bottom) of the box. cockpit view: distance, 0 far .. 1080 right ahead */
  y: number;
  /** moves: [step, lane, y] or [step, lane, y, rot (deg), dur (s)] — from steps[step], ease to that lane and y */
  path?: (number[])[];
  /** blinker side, flashing from steps[blinkAt] (default 0) until steps[blinkOff] */
  blink?: "L" | "R"; blinkAt?: number; blinkOff?: number;
  /** brake lights: true = on from the start, a number = on from steps[n]; brakeOff = off again at steps[n] */
  brake?: boolean | number; brakeOff?: number;
  /** a horn burst ("빵!") next to the car at steps[honkAt] (default 0), for 1.2 s */
  honk?: string; honkAt?: number;
  /** the driver's face colour and mood; `to` replaces the mood at steps[toAt] (default steps[2]) */
  face?: string; mood?: Mood; to?: Mood; toAt?: number;
  /** a name tag under the car ("나", "빌런") */
  tag?: string;
  /** speed streaks behind the car (it is driving faster than the rest) */
  fast?: boolean;
  /** police car: roof lights flash from steps[sirenAt] (default 0) */
  sirenAt?: number;
};
export type Walker = { x: number; y: number; path?: (number[])[]; color?: string; mood?: Mood; to?: Mood; toAt?: number; hat?: string; size?: number };
export type RoadG = {
  /** "face" and "car" are the wordless cartoons' views (lib/Drive.tsx, drawn on a 16:9 stage) */
  view?: "top" | "cockpit" | "face" | "car";
  lanes?: number;
  /** the setting: "highway" (grass, median), "city" (pavements), "school" (city + red school-zone surface), "tunnel" */
  road?: "highway" | "city" | "school" | "tunnel";
  /** how fast the lane lines run, px/s (default 900; 0 = standing still); `stopAt` brings them to rest at steps[n] */
  speed?: number; stopAt?: number;
  /** solid lane lines (no lane change), e.g. in a tunnel */
  solid?: boolean;
  cars: RoadCar[];
  /** people on foot (top view), e.g. on a crosswalk; x, y in box px; path points [step, x, y, dur?] */
  people?: Walker[];
  /** a horizontal crossroad at this y (top view): crosswalks either side and a stop line under it */
  cross?: number;
  /** words painted on the asphalt ({lane, y, text}); they scroll with the road */
  paint?: { lane: number; y: number; text: string; color?: string }[];
  /** roadside signs: "speed" (red ring + number), "info" (blue plate), "warn" (yellow) or "green" (highway plate) */
  signs?: { x: number; y: number; text: string; kind?: "speed" | "info" | "warn" | "green"; size?: number }[];
  /** a traffic light at the top right: a state, or [[step, state], ...] (state "red" | "yellow" | "green" | "arrow") */
  light?: string | [number, string][];
  /** shake the whole view at these steps (a hard brake) */
  shake?: number[];
  /** a slow push-in to this scale over the clip, centred on cars[focus] (top view); [from, to] starts already zoomed (a new framing at the cut) */
  zoom?: number | [number, number]; focus?: number;
  /** an exaggerated or fantasy beat: purple border and a "※ 상상" tag */
  imagine?: boolean;
  /** "📍 고속도로" tag at the top left */
  place?: string;
  /** a speech bubble (steps[sayAt], default at once) over cars[who]'s driver, or the hero ("me") in the cockpit view */
  say?: { who: number | "me"; text: string }; sayAt?: number;
  /** a big outlined word that slams in (steps[bigAt], default 3) */
  big?: string; bigAt?: number;
  /** a ticket card sliding up at steps[ticketAt] (default 3): a notice title and its lines */
  ticket?: { title: string; lines: string[] }; ticketAt?: number;
  /** cockpit view: the hero's face colour and mood (`to` at steps[toAt], default 2), and the lane the hero drives in (default 2, or 1 on a two-lane road) */
  me?: { face?: string; mood?: Mood; to?: Mood; toAt?: number; lane?: number };
  steps?: number[];
};

const INK = "#1b1b1f";
const CAR_COLORS = ["#4DA3FF", "#FF5C5C", "#FFD84D", "#B9F27C", "#C9A7FF", "#FF9F45", "#E8E8E8"];
const FACES = ["#FFD84D", "#FF9EBB", "#8FD3FF", "#B9F27C", "#C9A7FF", "#FFB36B"];
const ROAD_L = 150, ROAD_W = 780;  // the top-view carriageway across the 1080 box

const stepT = (g: RoadG, i: number | undefined, dflt: number) => (i == null ? dflt : g.steps?.[i] ?? i * 0.8);
const laneX = (g: RoadG, lane: number) => ROAD_L + (lane - 0.5) * (ROAD_W / (g.lanes ?? 3));

/** where a car (or walker) is at t: its start, then each path move eased in turn */
const pos = (g: RoadG, start: number[], path: (number[])[] | undefined, t: number) => {
  let cur = [...start, start[2] ?? 0];
  for (const p of path ?? []) {
    const t0 = stepT(g, p[0], 0), d = p[4] ?? 0.7;
    if (t < t0) break;
    const k = eInOut(clamp((t - t0) / d));
    cur = [lerp(cur[0], p[1], k), lerp(cur[1], p[2], k), lerp(cur[2], p[3] ?? 0, k)];
  }
  return cur;
};
const on = (g: RoadG, from: number | boolean | undefined, off: number | undefined, t: number) =>
  from === true ? t < stepT(g, off, 1e9) : typeof from === "number" ? t >= stepT(g, from, 0) && t < stepT(g, off, 1e9) : false;
const flash = (t: number) => Math.sin(t * Math.PI * 2 * 2.2) > 0;

/** how far the road has scrolled by t (lane lines, paint), slowing to a stop at stopAt */
const travel = (g: RoadG, t: number) => {
  const v = g.speed ?? 900, ts = g.stopAt != null ? stepT(g, g.stopAt, 1e9) : 1e9;
  if (t <= ts) return v * t;
  const d = 0.8, k = clamp((t - ts) / d);
  return v * ts + v * d * (k - k * k / 2);  // decelerate evenly to rest
};

// ── the top view ──
const TopRoad: React.FC<{ g: RoadG; t: number }> = ({ g, t }) => {
  const n = g.lanes ?? 3, lw = ROAD_W / n, s = travel(g, t);
  const kind = g.road ?? "highway";
  const side = kind === "highway" ? "#6DBE5A" : kind === "tunnel" ? "#3a3530" : "#C9C3B8";
  const asphalt = kind === "tunnel" ? "#3f4148" : "#55585f";
  const dashes: React.ReactNode[] = [];
  for (let k = 1; k < n; k++) {
    const x = ROAD_L + k * lw - 7;
    if (g.solid) dashes.push(<div key={k} style={{ position: "absolute", left: x, top: 0, width: 14, height: 1080, background: "#f4f4f4" }} />);
    else for (let j = -1; j < 8; j++) dashes.push(<div key={`${k}-${j}`} style={{ position: "absolute", left: x, top: j * 160 + (s % 160), width: 14, height: 80, background: "#f4f4f4", borderRadius: 3 }} />);
  }
  const off = (y: number, period = 1500) => ((y + s) % period + period) % period - 200;
  return (
    <div style={{ position: "absolute", inset: 0, background: side, overflow: "hidden" }}>
      {/* roadside texture so the scroll reads at the edges too */}
      {Array.from({ length: 9 }, (_, j) => {
        const y = j * 140 + (s % 140) - 140;
        return kind === "highway" ? <React.Fragment key={j}>
          <div style={{ position: "absolute", left: 40, top: y, width: 46, height: 46, borderRadius: 23, background: "#4E9E43" }} />
          <div style={{ position: "absolute", left: 996, top: y + 70, width: 46, height: 46, borderRadius: 23, background: "#4E9E43" }} />
        </React.Fragment> : kind === "tunnel" ? <React.Fragment key={j}>
          <div style={{ position: "absolute", left: 96, top: y, width: 28, height: 70, background: "#FFC861", boxShadow: "0 0 40px 12px rgba(255,190,80,.45)", borderRadius: 6 }} />
          <div style={{ position: "absolute", left: 956, top: y, width: 28, height: 70, background: "#FFC861", boxShadow: "0 0 40px 12px rgba(255,190,80,.45)", borderRadius: 6 }} />
        </React.Fragment> : <React.Fragment key={j}>
          <div style={{ position: "absolute", left: 0, top: y, width: ROAD_L - 14, height: 4, background: "rgba(0,0,0,.12)" }} />
          <div style={{ position: "absolute", left: ROAD_L + ROAD_W + 14, top: y, width: 300, height: 4, background: "rgba(0,0,0,.12)" }} />
        </React.Fragment>;
      })}
      <div style={{ position: "absolute", left: ROAD_L - 14, top: 0, width: ROAD_W + 28, height: 1080, background: kind === "city" || kind === "school" ? "#8d8a85" : "#9a9a9a" }} />
      <div style={{ position: "absolute", left: ROAD_L, top: 0, width: ROAD_W, height: 1080, background: kind === "school" ? "#a5524a" : asphalt }} />
      {/* edge lines: yellow centre line on the left, white edge on the right */}
      <div style={{ position: "absolute", left: ROAD_L + 6, top: 0, width: 10, height: 1080, background: "#FFC21A" }} />
      <div style={{ position: "absolute", left: ROAD_L + 22, top: 0, width: 10, height: 1080, background: "#FFC21A" }} />
      <div style={{ position: "absolute", left: ROAD_L + ROAD_W - 18, top: 0, width: 12, height: 1080, background: "#f4f4f4" }} />
      {dashes}
      {g.cross != null ? <Crossroad y={g.cross} /> : null}
      {(g.paint ?? []).map((p, i) => (
        <div key={i} style={{ position: "absolute", left: laneX(g, p.lane) - lw / 2, width: lw, top: off(p.y), textAlign: "center", fontFamily: TITLE,
          fontSize: Math.min(110, fitText({ text: p.text, withinWidth: lw - 40, fontFamily: TITLE }).fontSize), color: p.color ?? "rgba(255,255,255,.9)", lineHeight: 1 }}>{p.text}</div>
      ))}
    </div>
  );
};

/** a crossroad across the carriageway at y: zebra crossings above and below it, a stop line before the lower one */
const Crossroad: React.FC<{ y: number }> = ({ y }) => {
  const h = 260, zebra = (top: number, key: string) => (
    <div key={key} style={{ position: "absolute", left: ROAD_L, top, width: ROAD_W, height: 90, display: "flex", justifyContent: "space-around", alignItems: "stretch" }}>
      {Array.from({ length: 11 }, (_, k) => <div key={k} style={{ width: 40, background: "#f4f4f4" }} />)}
    </div>
  );
  return (
    <>
      <div style={{ position: "absolute", left: 0, top: y - h / 2, width: 1080, height: h, background: "#55585f" }} />
      <div style={{ position: "absolute", left: 0, top: y - 5, width: ROAD_L, height: 10, background: "#FFC21A" }} />
      <div style={{ position: "absolute", left: ROAD_L + ROAD_W, top: y - 5, width: 1080, height: 10, background: "#FFC21A" }} />
      {zebra(y - h / 2 - 100, "a")}
      {zebra(y + h / 2 + 10, "b")}
      <div style={{ position: "absolute", left: ROAD_L + ROAD_W * 0.42, top: y + h / 2 + 118, width: ROAD_W * 0.58 - 18, height: 14, background: "#f4f4f4" }} />
    </>
  );
};

const carSize = (g: RoadG, c: RoadCar) => {
  const lw = ROAD_W / (g.lanes ?? 3);
  return c.kind === "truck" ? { w: lw * 0.74, h: 400 } : c.kind === "bus" ? { w: lw * 0.74, h: 430 } : { w: Math.min(160, lw * 0.62), h: 250 };
};

/** one car from above, pointing up; the driver's face shows through the roof (cartoon convention) */
const TopCar: React.FC<{ g: RoadG; c: RoadCar; i: number; t: number }> = ({ g, c, i, t }) => {
  const { w, h } = carSize(g, c);
  const [lane, y, rot] = pos(g, [c.lane, c.y], c.path, t);
  const [lane2] = pos(g, [c.lane, c.y], c.path, t + 0.06), [lane0] = pos(g, [c.lane, c.y], c.path, t - 0.06);
  const tilt = clamp((lane2 - lane0) / 0.12 * 14, -16, 16);  // nose turns into a lane change
  const x = laneX(g, lane);
  const color = c.color ?? (c.kind === "police" ? "#F4F4F4" : CAR_COLORS[i % CAR_COLORS.length]);
  const braking = on(g, c.brake, c.brakeOff, t);
  const blinking = c.blink && t >= stepT(g, c.blinkAt, 0) && t < stepT(g, c.blinkOff, 1e9) && flash(t);
  const siren = c.kind === "police" && t >= stepT(g, c.sirenAt, 0);
  const mood = c.to && t >= stepT(g, c.toAt, g.steps?.[2] ?? 1e9) ? c.to : c.mood ?? "neutral";
  const swT = c.to && t >= stepT(g, c.toAt, g.steps?.[2] ?? 1e9) ? t - stepT(g, c.toAt, g.steps?.[2] ?? 1e9) : t;
  const cab = c.kind === "truck" || c.kind === "bus" ? (c.kind === "truck" ? 0.26 : 1) : 1;
  const face = Math.min(w * 0.8, 130), faceY = c.kind === "truck" ? h * 0.12 : c.kind === "bus" ? h * 0.12 : h * 0.5 - face * 0.55;
  const amber = (cx: number, cy: number) => <circle cx={cx} cy={cy} r={blinking ? 13 : 9} fill={blinking ? "#FFB000" : "#a8741f"} stroke={INK} strokeWidth={3}
    style={blinking ? { filter: "drop-shadow(0 0 14px #FFB000)" } : undefined} />;
  const bx = c.blink === "L" ? 8 : w - 8;
  return (
    <div style={{ position: "absolute", left: x - w / 2, top: y - h / 2, width: w, height: h, transform: `rotate(${rot + tilt}deg)`, transformOrigin: "50% 40%" }}>
      {c.fast ? [0, 1, 2].map((k) => <div key={k} style={{ position: "absolute", left: w * (0.2 + 0.3 * k), top: h + 10 + ((t * 900 + k * 60) % 120), width: 8, height: 70, borderRadius: 4, background: "rgba(255,255,255,.55)" }} />) : null}
      <svg width={w} height={h} style={{ overflow: "visible", position: "absolute", inset: 0 }}>
        {braking ? <ellipse cx={w / 2} cy={h + 4} rx={w * 0.62} ry={44} fill="rgba(255,40,40,.45)" style={{ filter: "blur(10px)" }} /> : null}
        <rect x={10} y={14} width={w} height={h} rx={w * 0.28} fill="rgba(0,0,0,.28)" />
        {c.kind === "truck" ? <>
          <rect x={4} y={h * 0.3} width={w - 8} height={h * 0.7 - 4} rx={14} fill="#e9e4da" stroke={INK} strokeWidth={6} />
          {[0.42, 0.56, 0.7, 0.84].map((k) => <line key={k} x1={14} x2={w - 14} y1={h * k} y2={h * k} stroke="#b9b2a5" strokeWidth={5} />)}
          <rect x={0} y={0} width={w} height={h * cab + 6} rx={w * 0.26} fill={color} stroke={INK} strokeWidth={6} />
          <path d={`M${w * 0.12} ${h * 0.045} Q${w / 2} ${-h * 0.01} ${w * 0.88} ${h * 0.045} L${w * 0.8} ${h * 0.09} L${w * 0.2} ${h * 0.09} Z`} fill="#2b3a55" stroke={INK} strokeWidth={4} />
        </> : c.kind === "bus" ? <>
          <rect x={0} y={0} width={w} height={h} rx={w * 0.22} fill={color} stroke={INK} strokeWidth={6} />
          <path d={`M${w * 0.1} ${h * 0.04} Q${w / 2} ${-h * 0.005} ${w * 0.9} ${h * 0.04} L${w * 0.85} ${h * 0.08} L${w * 0.15} ${h * 0.08} Z`} fill="#2b3a55" stroke={INK} strokeWidth={4} />
          <rect x={w * 0.14} y={h * 0.32} width={w * 0.72} height={h * 0.58} rx={12} fill="rgba(255,255,255,.35)" stroke={INK} strokeWidth={3} />
        </> : <>
          <rect x={0} y={0} width={w} height={h} rx={w * 0.3} fill={color} stroke={INK} strokeWidth={6} />
          {c.kind === "police" ? <>
            <rect x={3} y={3} width={w - 6} height={h * 0.2} rx={w * 0.28} fill="#232a3a" />
            <rect x={3} y={h * 0.8} width={w - 6} height={h * 0.2 - 3} rx={w * 0.28} fill="#232a3a" />
          </> : null}
          <path d={`M${w * 0.14} ${h * 0.24} Q${w / 2} ${h * 0.17} ${w * 0.86} ${h * 0.24} L${w * 0.8} ${h * 0.34} L${w * 0.2} ${h * 0.34} Z`} fill="#2b3a55" stroke={INK} strokeWidth={4} />
          <path d={`M${w * 0.24} ${h * 0.25} L${w * 0.34} ${h * 0.25} L${w * 0.28} ${h * 0.32} L${w * 0.22} ${h * 0.32} Z`} fill="rgba(255,255,255,.45)" />
          <rect x={w * 0.16} y={h * 0.36} width={w * 0.68} height={h * 0.38} rx={w * 0.16} fill="rgba(255,255,255,.22)" />
          <path d={`M${w * 0.2} ${h * 0.76} L${w * 0.8} ${h * 0.76} L${w * 0.86} ${h * 0.84} Q${w / 2} ${h * 0.88} ${w * 0.14} ${h * 0.84} Z`} fill="#2b3a55" stroke={INK} strokeWidth={4} />
        </>}
        {/* headlights, tail lights (bright when braking), blinkers */}
        <ellipse cx={w * 0.2} cy={9} rx={w * 0.1} ry={7} fill="#FFF6C8" stroke={INK} strokeWidth={3} />
        <ellipse cx={w * 0.8} cy={9} rx={w * 0.1} ry={7} fill="#FFF6C8" stroke={INK} strokeWidth={3} />
        <rect x={w * 0.1} y={h - 12} width={w * 0.24} height={12} rx={5} fill={braking ? "#FF2A2A" : "#8f1d1d"} stroke={INK} strokeWidth={3} style={braking ? { filter: "drop-shadow(0 0 12px #ff2a2a)" } : undefined} />
        <rect x={w * 0.66} y={h - 12} width={w * 0.24} height={12} rx={5} fill={braking ? "#FF2A2A" : "#8f1d1d"} stroke={INK} strokeWidth={3} style={braking ? { filter: "drop-shadow(0 0 12px #ff2a2a)" } : undefined} />
        {c.blink ? <>{amber(bx, 22)}{amber(bx, h - 22)}</> : null}
        {c.kind === "police" ? <g>
          <rect x={w * 0.14} y={h * 0.42} width={w * 0.72} height={26} rx={10} fill={INK} />
          <rect x={w * 0.16} y={h * 0.42 + 3} width={w * 0.34} height={20} rx={8} fill={siren && flash(t * 1.6) ? "#FF2A2A" : "#7a1a1a"} style={siren && flash(t * 1.6) ? { filter: "drop-shadow(0 0 18px #ff2a2a)" } : undefined} />
          <rect x={w * 0.5} y={h * 0.42 + 3} width={w * 0.34} height={20} rx={8} fill={siren && !flash(t * 1.6) ? "#2A7BFF" : "#1a2f6a"} style={siren && !flash(t * 1.6) ? { filter: "drop-shadow(0 0 18px #2a7bff)" } : undefined} />
          <text x={w / 2} y={h * 0.68} textAnchor="middle" fontFamily={TITLE} fontSize={w * 0.26} fill={INK}>경찰</text>
        </g> : null}
      </svg>
      {c.kind !== "police" ? (
        <div style={{ position: "absolute", left: (w - face) / 2, top: faceY, width: face, height: face, transform: `rotate(${-(rot + tilt)}deg)` }}>
          <Mochi c={{ color: c.face ?? FACES[i % FACES.length] }} i={i} t={swT} size={face} mood={mood} />
        </div>
      ) : null}
      {c.tag ? (
        <div style={{ position: "absolute", left: -100, right: -100, top: h + 8, textAlign: "center", transform: `rotate(${-(rot + tilt)}deg)` }}>
          <span style={{ fontFamily: BODY, fontWeight: 900, fontSize: 38, color: "white", background: INK, borderRadius: 14, padding: "4px 16px", border: "3px solid white" }}>{c.tag}</span>
        </div>
      ) : null}
    </div>
  );
};

/** a person on foot, seen face-on (a small mochi) */
const Person: React.FC<{ g: RoadG; p: Walker; i: number; t: number }> = ({ g, p, i, t }) => {
  const [x, y] = pos(g, [p.x, p.y], p.path, t);
  const size = p.size ?? 120, sw = p.to && t >= stepT(g, p.toAt, g.steps?.[2] ?? 1e9);
  const walking = (p.path ?? []).some((q) => t >= stepT(g, q[0], 0) && t < stepT(g, q[0], 0) + (q[3] ?? q[4] ?? 0.7));
  return (
    <div style={{ position: "absolute", left: x - size / 2, top: y - size / 2 + (walking ? -8 * Math.abs(Math.sin(t * 12)) : 0), width: size, height: size }}>
      <Mochi c={{ color: p.color ?? FACES[(i + 2) % FACES.length], hat: p.hat }} i={i + 3} t={t} size={size} mood={sw ? p.to : p.mood ?? "neutral"} />
    </div>
  );
};

// ── the cockpit view ──
const HOR = 300, BOT = 780, VX = 540;  // horizon, the bottom of the visible road (the dashboard starts there), vanishing point
const depthRow = (d: number) => HOR + (BOT + 160 - HOR) * Math.pow(clamp(d / 1080, 0.02, 1), 1.7);
const heroLane = (g: RoadG) => g.me?.lane ?? ((g.lanes ?? 3) >= 3 ? 2 : 1);
const laneScreenX = (g: RoadG, lane: number, sy: number) => VX + (lane - heroLane(g)) * 760 * ((sy - HOR) / (BOT - HOR));

const CockpitRoad: React.FC<{ g: RoadG; t: number }> = ({ g, t }) => {
  const n = g.lanes ?? 3, s = travel(g, t), kind = g.road ?? "highway";
  const edge = (b: number, sy: number) => laneScreenX(g, b + 0.5, sy);  // boundary b sits between lane b and b+1
  const yB = BOT + 160;
  const poly = (b0: number, b1: number) => `${edge(b0, HOR)},${HOR} ${edge(b1, HOR)},${HOR} ${edge(b1, yB)},${yB} ${edge(b0, yB)},${yB}`;
  const marks: React.ReactNode[] = [];
  for (let b = 1; b < n; b++) {
    if (g.solid) { marks.push(<polygon key={b} points={`${edge(b, HOR)},${HOR} ${edge(b, HOR)},${HOR} ${edge(b, yB) + 9},${yB} ${edge(b, yB) - 9},${yB}`} fill="#f4f4f4" />); continue; }
    for (let k = 0; k < 10; k++) {
      const u0 = ((k + s / 260) % 10) / 10, u1 = u0 + 0.045;
      const y0 = HOR + (yB - HOR) * u0 * u0, y1 = HOR + (yB - HOR) * Math.min(1, u1 * u1);
      const w0 = 2 + 9 * u0, w1 = 2 + 9 * u1;
      marks.push(<polygon key={`${b}-${k}`} points={`${edge(b, y0) - w0},${y0} ${edge(b, y0) + w0},${y0} ${edge(b, y1) + w1},${y1} ${edge(b, y1) - w1},${y1}`} fill="#f4f4f4" />);
    }
  }
  const sky = kind === "tunnel" ? "linear-gradient(#2a2622, #4a3f33)" : "linear-gradient(#7cc4ff, #d4ecff)";
  return (
    <div style={{ position: "absolute", inset: 0, background: sky }}>
      <svg width={1080} height={1080} style={{ position: "absolute", inset: 0 }}>
        {kind !== "tunnel" ? <>
          <path d="M0 300 Q120 230 260 280 Q380 210 520 290 Q700 220 860 280 Q980 240 1080 290 L1080 300 L0 300 Z" fill="#8fc98a" />
          <rect x={0} y={HOR} width={1080} height={800} fill={kind === "highway" ? "#6DBE5A" : "#bdb7ab"} />
        </> : <>
          <rect x={0} y={HOR} width={1080} height={800} fill="#3a3530" />
          {[0, 1, 2, 3, 4, 5].map((k) => { const u = ((k + s / 300) % 6) / 6, yy = HOR + (yB - HOR) * u * u; return <g key={k}>
            <circle cx={edge(0.2, yy) - 40 * u - 30} cy={yy - 200 * u} r={4 + 14 * u} fill="#FFC861" opacity={0.9} />
            <circle cx={edge(n - 0.2, yy) + 40 * u + 30} cy={yy - 200 * u} r={4 + 14 * u} fill="#FFC861" opacity={0.9} /></g>; })}
        </>}
        <polygon points={poly(0, n)} fill={kind === "school" ? "#a5524a" : "#55585f"} />
        <polygon points={`${edge(0, HOR) + 1},${HOR} ${edge(0, HOR) + 3},${HOR} ${edge(0, yB) + 20},${yB} ${edge(0, yB) + 4},${yB}`} fill="#FFC21A" />
        <polygon points={`${edge(n, HOR) - 3},${HOR} ${edge(n, HOR) - 1},${HOR} ${edge(n, yB) - 4},${yB} ${edge(n, yB) - 20},${yB}`} fill="#f4f4f4" />
        {marks}
      </svg>
    </div>
  );
};

/** a car ahead seen from behind, at its lane and distance; its driver peeks out of the rear window */
const RearCar: React.FC<{ g: RoadG; c: RoadCar; i: number; t: number }> = ({ g, c, i, t }) => {
  const [lane, d] = pos(g, [c.lane, c.y], c.path, t);
  const sy = depthRow(d), sc = 0.12 + 1.15 * Math.pow(clamp(d / 1080, 0, 1), 1.7);
  const big = c.kind === "truck" || c.kind === "bus";
  const w = (big ? 420 : 380) * sc, h = (big ? 400 : 250) * sc, x = laneScreenX(g, lane, sy);
  const color = c.color ?? (c.kind === "police" ? "#F4F4F4" : CAR_COLORS[i % CAR_COLORS.length]);
  const braking = on(g, c.brake, c.brakeOff, t);
  const blinking = c.blink && t >= stepT(g, c.blinkAt, 0) && t < stepT(g, c.blinkOff, 1e9) && flash(t);
  const mood = c.to && t >= stepT(g, c.toAt, g.steps?.[2] ?? 1e9) ? c.to : c.mood ?? "neutral";
  const face = big ? 0 : w * 0.38;
  const lamp = (lx: number, side: "L" | "R") => {
    const amberOn = blinking && c.blink === side;
    return <g key={side}>
      <rect x={lx} y={h * 0.5} width={w * 0.2} height={h * 0.13} rx={6 * sc} fill={braking ? "#FF2A2A" : "#a01f1f"} stroke={INK} strokeWidth={4 * sc} style={braking ? { filter: `drop-shadow(0 0 ${20 * sc}px #ff2a2a)` } : undefined} />
      <rect x={side === "L" ? lx : lx + w * 0.12} y={h * 0.65} width={w * 0.08} height={h * 0.08} rx={4 * sc} fill={amberOn ? "#FFB000" : "#8a6420"} stroke={INK} strokeWidth={3 * sc} style={amberOn ? { filter: `drop-shadow(0 0 ${22 * sc}px #FFB000)` } : undefined} />
    </g>;
  };
  return (
    <div style={{ position: "absolute", left: x - w / 2, top: sy - h, width: w, height: h }}>
      {face ? <div style={{ position: "absolute", left: (w - face) / 2, top: h * 0.02 - face * 0.18, width: face, height: face }}>
        <Mochi c={{ color: c.face ?? FACES[i % FACES.length] }} i={i} t={t} size={face} mood={mood} />
      </div> : null}
      <svg width={w} height={h} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <ellipse cx={w / 2} cy={h} rx={w * 0.55} ry={h * 0.06} fill="rgba(0,0,0,.3)" />
        {big ? <>
          <rect x={0} y={0} width={w} height={h * 0.92} rx={10 * sc} fill={c.kind === "bus" ? color : "#e9e4da"} stroke={INK} strokeWidth={6 * sc} />
          <line x1={w / 2} x2={w / 2} y1={h * 0.06} y2={h * 0.86} stroke="#9c958a" strokeWidth={5 * sc} />
          <rect x={w * 0.06} y={h * 0.86} width={w * 0.88} height={h * 0.1} rx={6 * sc} fill="#33363d" />
        </> : <>
          <path d={`M${w * 0.16} ${h * 0.36} Q${w * 0.2} ${h * 0.04} ${w / 2} ${h * 0.04} Q${w * 0.8} ${h * 0.04} ${w * 0.84} ${h * 0.36} Z`} fill="#2b3a55" fillOpacity={0.55} stroke={INK} strokeWidth={5 * sc} />
          <rect x={0} y={h * 0.34} width={w} height={h * 0.52} rx={w * 0.12} fill={color} stroke={INK} strokeWidth={6 * sc} />
          {c.kind === "police" ? <rect x={w * 0.25} y={h * 0.0} width={w * 0.5} height={h * 0.08} rx={6 * sc} fill={flash(t * 1.6) ? "#FF2A2A" : "#2A7BFF"} /> : null}
          <rect x={w * 0.08} y={h * 0.84} width={w * 0.84} height={h * 0.12} rx={8 * sc} fill="#33363d" />
          <rect x={w * 0.04} y={h * 0.88} width={w * 0.14} height={h * 0.12} rx={6 * sc} fill={INK} />
          <rect x={w * 0.82} y={h * 0.88} width={w * 0.14} height={h * 0.12} rx={6 * sc} fill={INK} />
        </>}
        {lamp(w * 0.04, "L")}{lamp(w * 0.76, "R")}
      </svg>
    </div>
  );
};

/** the inside of the hero's car over the road: roof, pillars, mirror, dashboard, steering wheel and the hero */
const Interior: React.FC<{ g: RoadG; t: number }> = ({ g, t }) => {
  const me = g.me ?? {};
  const sw = me.to && t >= stepT(g, me.toAt, g.steps?.[2] ?? 1e9);
  const mood = sw ? me.to! : me.mood ?? "neutral";
  return (
    <>
      <svg width={1080} height={1080} style={{ position: "absolute", inset: 0 }}>
        <path d="M0 0 L1080 0 L1080 70 Q540 30 0 70 Z" fill="#23262d" />
        <path d="M0 0 L120 0 L40 760 L0 760 Z" fill="#23262d" />
        <path d="M1080 0 L960 0 L1040 760 L1080 760 Z" fill="#23262d" />
        <rect x={470} y={48} width={140} height={46} rx={14} fill="#3a3e47" stroke="#15171b" strokeWidth={5} />
        <rect x={536} y={20} width={8} height={32} fill="#15171b" />
        <path d="M0 760 Q540 700 1080 760 L1080 1080 L0 1080 Z" fill="#2c3038" />
        <path d="M0 760 Q540 700 1080 760" stroke="#15171b" strokeWidth={8} fill="none" />
        <rect x={640} y={800} width={260} height={90} rx={18} fill="#1a1d22" />
        <text x={770} y={862} textAnchor="middle" fontFamily={TITLE} fontSize={52} fill="#7CF0A0">{g.speed === 0 ? "0" : g.road === "school" ? "30" : g.road === "city" ? "50" : "100"}</text>
      </svg>
      <div style={{ position: "absolute", left: 90, top: 560, width: 380, height: 380 }}>
        <Mochi c={{ color: me.face ?? "#FFD84D" }} i={0} t={sw ? t - stepT(g, me.toAt, g.steps?.[2] ?? 0) : t} size={380} mood={mood} />
      </div>
      <svg width={1080} height={1080} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <g transform={`rotate(${4 * Math.sin(t * 1.3)} 280 1000)`}>
          <ellipse cx={280} cy={1000} rx={230} ry={200} fill="none" stroke="#15171b" strokeWidth={46} />
          <ellipse cx={280} cy={1000} rx={230} ry={200} fill="none" stroke="#3a3e47" strokeWidth={26} />
          <rect x={250} y={940} width={60} height={140} rx={20} fill="#3a3e47" stroke="#15171b" strokeWidth={6} />
          <rect x={60} y={985} width={440} height={30} rx={12} fill="#3a3e47" stroke="#15171b" strokeWidth={6} />
        </g>
      </svg>
    </>
  );
};

/** a traffic light head, top right */
const Light: React.FC<{ g: RoadG; t: number }> = ({ g, t }) => {
  if (!g.light) return null;
  let state = typeof g.light === "string" ? g.light : g.light[0][1];
  if (typeof g.light !== "string") for (const [i, st] of g.light) if (i < 0 || t >= stepT(g, i, 0)) state = st;
  const lamp = (c: string, lit: boolean, arrow = false) => (
    <div style={{ width: 74, height: 74, borderRadius: 37, background: lit ? c : "#2a2c31", boxShadow: lit ? `0 0 30px 8px ${c}` : "none", border: "4px solid #111",
      display: "flex", justifyContent: "center", alignItems: "center", fontSize: 54, color: "#111", fontWeight: 900 }}>{arrow && lit ? "→" : null}</div>
  );
  return (
    <div style={{ position: "absolute", right: 40, top: 30, display: "flex", gap: 10, padding: 12, background: "#151619", borderRadius: 22, border: "5px solid #000" }}>
      {lamp("#FF3030", state === "red")}{lamp("#FFC21A", state === "yellow")}{lamp("#2BD46B", state === "green" || state === "arrow", state === "arrow")}
    </div>
  );
};

const Sign: React.FC<{ s: NonNullable<RoadG["signs"]>[number] }> = ({ s }) => {
  const size = s.size ?? 150;
  if (s.kind === "speed" || !s.kind) return (
    <div style={{ position: "absolute", left: s.x - size / 2, top: s.y - size / 2, width: size, height: size, borderRadius: size / 2, background: "white",
      border: `${size * 0.12}px solid #E3181E`, boxSizing: "border-box", display: "flex", justifyContent: "center", alignItems: "center",
      fontFamily: TITLE, fontSize: size * 0.42, color: INK, boxShadow: "0 8px 0 rgba(0,0,0,.3)" }}>{s.text}</div>
  );
  const bg = s.kind === "info" ? "#1E5BD8" : s.kind === "green" ? "#1D8A4A" : "#FFD21A", fg = s.kind === "warn" ? INK : "white";
  const fs = Math.min(size * 0.36, fitText({ text: s.text, withinWidth: 940, fontFamily: TITLE }).fontSize);
  return (
    <div style={{ position: "absolute", left: s.x, top: s.y, transform: "translate(-50%, -50%)", background: bg, color: fg, fontFamily: TITLE, fontSize: fs,
      padding: "12px 26px", borderRadius: 16, border: `5px solid ${s.kind === "warn" ? INK : "white"}`, boxShadow: "0 8px 0 rgba(0,0,0,.3)", whiteSpace: "nowrap" }}>{s.text}</div>
  );
};

/** the honk burst next to a car (top view: beside it; cockpit: over it) */
const Honk: React.FC<{ text: string; x: number; y: number; t: number; t0: number }> = ({ text, x, y, t, t0 }) => {
  if (t < t0 || t > t0 + 1.2) return null;
  const k = eBack(prog(t, t0, 0.2), 2.6), j = 6 * Math.sin(t * 60) * (1 - prog(t, t0, 0.5));
  const pts = Array.from({ length: 24 }, (_, i) => { const a = (i / 24) * Math.PI * 2, r = i % 2 ? 100 : 140; return `${150 + r * 1.35 * Math.cos(a)},${110 + r * 0.8 * Math.sin(a)}`; }).join(" ");
  return (
    <div style={{ position: "absolute", left: x - 150 + j, top: y - 110, width: 300, height: 220, transform: `scale(${k})`, opacity: 1 - prog(t, t0 + 0.9, 0.3) }}>
      <svg width={300} height={220} style={{ position: "absolute", inset: 0, overflow: "visible" }}><polygon points={pts} fill="#FFE14D" stroke={INK} strokeWidth={6} strokeLinejoin="round" /></svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "center", alignItems: "center", fontFamily: TITLE, fontSize: 70, color: "#E3181E", WebkitTextStroke: "3px #111" }}>{text}</div>
    </div>
  );
};

/** the comeuppance notice: a paper card that slides up and stamps */
const Ticket: React.FC<{ g: RoadG; t: number }> = ({ g, t }) => {
  if (!g.ticket) return null;
  const t0 = stepT(g, g.ticketAt, g.steps?.[3] ?? 0.3), p = eOut(prog(t, t0, 0.4));
  if (t < t0) return null;
  return (
    <div style={{ position: "absolute", left: 170, width: 740, top: 1080 - 640 * p, transform: `rotate(${-3 + 3 * (1 - p)}deg)`, background: "#FFFDF4", border: `6px solid ${INK}`,
      borderRadius: 22, boxShadow: `12px 12px 0 ${INK}`, padding: "28px 36px", fontFamily: BODY, color: INK }}>
      <div style={{ fontWeight: 900, fontSize: 52, borderBottom: `4px dashed ${INK}`, paddingBottom: 14, marginBottom: 14, textAlign: "center" }}>{g.ticket.title}</div>
      {g.ticket.lines.map((l, i) => (
        <div key={i} style={{ fontWeight: 800, fontSize: i === g.ticket!.lines.length - 1 ? 64 : 44, lineHeight: 1.3, textAlign: "center", opacity: prog(t, t0 + 0.25 + 0.2 * i, 0.15) }}>
          <Marked text={l} color="#E3181E" />
        </div>
      ))}
    </div>
  );
};

/** a speech bubble in the 썰 style (white, thick ink outline, offset shadow), its tail pointing at (px, py) */
const Bubble: React.FC<{ text: string; px: number; py: number; t: number; t0: number }> = ({ text, px, py, t, t0 }) => {
  const plain = text.replace(/[[\]]/g, ""), maxW = 900, pad = 40, inner = maxW - 2 * pad - 12;
  const one = fitText({ text: plain, withinWidth: inner, fontFamily: BODY, fontWeight: "900" }).fontSize;
  const fs = Math.max(50, Math.min(74, one >= 58 ? one : fitText({ text: plain, withinWidth: inner * 2 * 0.88, fontFamily: BODY, fontWeight: "900" }).fontSize));
  const tw = measureText({ text: plain, fontFamily: BODY, fontSize: fs, fontWeight: "900" }).width, w = Math.min(maxW, tw + 2 * pad + 12);
  const bh = Math.ceil(tw / (inner * 0.9)) * fs * 1.25 + 48;
  const left = clamp(px - w / 2, 24, 1080 - 24 - w), top = clamp(py - bh - 56, 20, 1080 - bh - 60), tail = clamp(px - left - 30, 34, w - 94);
  const k = eBack(prog(t, t0, 0.28), 2.2);
  if (t < t0) return null;
  return (
    <div style={{ position: "absolute", left, top, width: w, transform: `scale(${k})`, transformOrigin: `${tail + 30}px 100%`, opacity: clamp(k * 2) }}>
      <div style={{ position: "relative", background: "white", border: `6px solid ${INK}`, borderRadius: 40, padding: "20px 36px", boxShadow: `8px 8px 0 ${INK}`,
        fontFamily: BODY, fontWeight: 900, fontSize: fs, lineHeight: 1.25, color: INK, textAlign: "center", wordBreak: "keep-all" }}>
        <Marked text={text} color="#e8212e" />
        <svg width={60} height={50} style={{ position: "absolute", left: tail - 6, bottom: -46 }} viewBox="0 0 60 50">
          <path d="M6 0 L30 46 L54 0 Z" fill="white" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
          <rect x={4} y={-6} width={52} height={10} fill="white" />
        </svg>
      </div>
    </div>
  );
};

export const Road: React.FC<{ g: RoadG; t: number; h: number }> = ({ g, t, h }) => {
  if (g.view === "face" || g.view === "car") return <Drive g={g as unknown as DriveG} t={t} h={h} />;
  const cockpit = g.view === "cockpit";
  // a hard brake: a short decaying shake
  let sx = 0, sy = 0;
  for (const i of g.shake ?? []) {
    const t0 = stepT(g, i, 0);
    if (t >= t0 && t < t0 + 0.5) { const a = 18 * (1 - (t - t0) / 0.5); sx += a * Math.sin(t * 90); sy += a * Math.cos(t * 77); }
  }
  for (const c of g.cars) if (c.honk) { const t0 = stepT(g, c.honkAt, 0); if (t >= t0 && t < t0 + 0.25) sx += 5 * Math.sin(t * 120); }
  // speaker point for the bubble, and the horn bursts
  const at = (c: RoadCar, i: number) => {
    if (cockpit) {
      const [lane, d] = pos(g, [c.lane, c.y], c.path, t), row = depthRow(d), sc = 0.12 + 1.15 * Math.pow(clamp(d / 1080, 0, 1), 1.7);
      return { x: laneScreenX(g, lane, row), y: row - (c.kind === "truck" || c.kind === "bus" ? 400 : 290) * sc };
    }
    const [lane, y] = pos(g, [c.lane, c.y], c.path, t), { h } = carSize(g, c);
    return { x: laneX(g, lane), y: y - h / 2 + (c.kind === "truck" || c.kind === "bus" ? 10 : h * 0.2) + i * 0 };
  };
  const [z0, z1] = Array.isArray(g.zoom) ? g.zoom : [1, g.zoom ?? 1], z = z0 + (z1 - z0) * eInOut(prog(t, 0, 3.5));
  const fc = g.focus != null && g.cars[g.focus] ? at(g.cars[g.focus], g.focus) : { x: 540, y: 540 };
  const sayP = g.say ? (g.say.who === "me" ? { x: 280, y: 600 } : g.cars[g.say.who] ? at(g.cars[g.say.who], g.say.who) : null) : null;
  // nearer cars over farther ones (cockpit), lower cars over higher ones (top view keeps the given order)
  const order = g.cars.map((c, i) => ({ c, i, d: pos(g, [c.lane, c.y], c.path, t)[1] }));
  if (cockpit) order.sort((a, b) => a.d - b.d);
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", background: "#000" }}>
      <div style={{ position: "absolute", inset: 0, transform: `translate(${sx}px, ${sy}px) scale(${z})`, transformOrigin: `${fc.x}px ${fc.y}px` }}>
        {cockpit ? <CockpitRoad g={g} t={t} /> : <TopRoad g={g} t={t} />}
        {!cockpit ? (g.people ?? []).map((p, i) => <Person key={`p${i}`} g={g} p={p} i={i} t={t} />) : null}
        {order.map(({ c, i }) => cockpit ? <RearCar key={i} g={g} c={c} i={i} t={t} /> : <TopCar key={i} g={g} c={c} i={i} t={t} />)}
        {(g.signs ?? []).map((s, i) => <Sign key={i} s={s} />)}
        {cockpit ? <Interior g={g} t={t} /> : null}
        {g.cars.map((c, i) => c.honk ? <Honk key={`h${i}`} text={c.honk} x={clamp(at(c, i).x + (cockpit ? 0 : at(c, i).x > 540 ? -200 : 200), 170, 910)} y={Math.max(130, at(c, i).y - (cockpit ? 40 : -60))} t={t} t0={stepT(g, c.honkAt, 0)} /> : null)}
      </div>
      <Light g={g} t={t} />
      {g.place ? (
        <div style={{ position: "absolute", left: 30, top: 28, fontFamily: BODY, fontWeight: 900, fontSize: 42, color: INK, background: "white", border: `5px solid ${INK}`,
          borderRadius: 999, padding: "6px 26px", boxShadow: `5px 5px 0 ${INK}` }}>{g.place}</div>
      ) : null}
      {g.big ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: 170, textAlign: "center", fontFamily: TITLE, fontSize: Math.min(160, fitText({ text: g.big.replace(/[[\]]/g, ""), withinWidth: 880, fontFamily: TITLE }).fontSize), lineHeight: 1,
          color: "#FFE14D", wordBreak: "keep-all", WebkitTextStroke: "18px black", paintOrder: "stroke", transform: `scale(${eBack(prog(t, stepT(g, g.bigAt, g.steps?.[3] ?? 0.1), 0.3), 2.4)}) rotate(-4deg)`,
          filter: "drop-shadow(0 10px 14px rgba(0,0,0,.35))" }}>
          <Marked text={g.big} color="#ff4d6d" />
        </div>
      ) : null}
      <Ticket g={g} t={t} />
      {g.say && sayP ? <Bubble text={g.say.text} px={sayP.x} py={sayP.y} t={t} t0={stepT(g, g.sayAt, 0.05)} /> : null}
      {g.imagine ? <>
        <div style={{ position: "absolute", inset: 0, border: "16px solid #9B5CFF", boxShadow: "inset 0 0 60px rgba(155,92,255,.6)", background: "rgba(155,92,255,.08)" }} />
        <div style={{ position: "absolute", right: 30, bottom: 30, fontFamily: BODY, fontWeight: 900, fontSize: 46, color: "white", background: "#9B5CFF", border: `5px solid ${INK}`,
          borderRadius: 16, padding: "6px 22px", boxShadow: `5px 5px 0 ${INK}` }}>※ 상상</div>
      </> : null}
    </div>
  );
};
