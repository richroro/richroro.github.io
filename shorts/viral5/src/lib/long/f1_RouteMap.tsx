// The Odyssey maps: the Mediterranean with the route drawn as a dotted line that grows leg by leg, and the
// world / Korea maps for the "이 무렵 한반도는" line. Base images come from make_maps.py (Natural Earth, public
// domain); every point is in 1920×1080 frame pixels of the unzoomed map.
import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { BODY, TITLE } from "../fonts";
import { clamp, eInOut, eOut, lerp, prog } from "../fx";
import type { F1Route, F1Shot, Pt } from "./f1_types";

const W = 1920, H = 1080, GOLD = "#F2C66D", INK = "#F6EBD2";

export const PLACE: Record<string, { name: string; guess?: string; dx?: number; dy?: number }> = {
  troy: { name: "트로이", dy: -1 },
  ismaros: { name: "" },
  malea: { name: "말레아 곶", dy: 1 },
  djerba: { name: "연꽃을 먹는 사람들", guess: "튀니지 제르바 섬?", dy: 1 },
  cyclops: { name: "키클롭스의 섬", guess: "시칠리아?", dx: 1 },
  aeolus: { name: "아이올로스의 섬", guess: "리파리 제도?", dx: -1, dy: -1 },
  ithaca: { name: "이타카", dx: 1 },
  laestry: { name: "거인의 항구", guess: "코르시카 보니파시오?", dy: -1 },
  circe: { name: "키르케의 섬", guess: "치르체오 곶?", dy: -1 },
  avernus: { name: "" },
  sirens: { name: "세이렌", guess: "소렌토 앞바다?", dx: 1 },
  messina: { name: "스킬라와 카리브디스", guess: "메시나 해협?", dx: 1 },
  thrinacia: { name: "태양신의 섬", guess: "시칠리아?", dx: 1 },
  ogygia: { name: "칼립소의 섬", guess: "몰타 고조 섬?", dy: 1 },
  scheria: { name: "파이아케스", guess: "코르푸 섬?", dx: 1 },
};

const segLen = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);
/** the first `k` (0..1) of a polyline */
const partial = (pts: Pt[], k: number): Pt[] => {
  const L = pts.slice(1).reduce((s, p, i) => s + segLen(pts[i], p), 0);
  let left = L * clamp(k);
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const d = segLen(pts[i - 1], pts[i]);
    if (left >= d) { out.push(pts[i]); left -= d; continue; }
    const r = d ? left / d : 0;
    out.push([lerp(pts[i - 1][0], pts[i][0], r), lerp(pts[i - 1][1], pts[i][1], r)]);
    break;
  }
  return out;
};
const pathD = (pts: Pt[]) => pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");

/** pan and zoom over a full-frame layer: zoom z centred on focus (fx, fy), kept inside the frame */
const camera = (z: number, fx: number, fy: number) => {
  const tx = clamp(W / 2 - fx * W * z, W - W * z, 0), ty = clamp(H / 2 - fy * H * z, H - H * z, 0);
  return { transform: `translate(${tx}px, ${ty}px) scale(${z})`, transformOrigin: "0 0" };
};

const Label: React.FC<{ p: Pt; z: number; name: string; guess?: string; dx?: number; dy?: number; o: number; hot?: boolean }> = ({ p, z, name, guess, dx = 0, dy = 0, o, hot }) => {
  if (!name) return null;
  const s = 1 / z;
  const ax = dx > 0 ? 0 : dx < 0 ? -100 : -50;
  const oy = dy < 0 ? -62 : dy > 0 ? 18 : -20;
  const ox = dx > 0 ? 22 : dx < 0 ? -22 : 0;
  return (
    <div style={{ position: "absolute", left: p[0], top: p[1], transform: `scale(${s})`, transformOrigin: "0 0", opacity: o }}>
      <div style={{ position: "absolute", left: ox, top: oy, transform: `translateX(${ax}%)`, whiteSpace: "nowrap", textAlign: dx > 0 ? "left" : dx < 0 ? "right" : "center" }}>
        <div style={{ fontFamily: BODY, fontWeight: 800, fontSize: 34, color: hot ? GOLD : INK, textShadow: "0 2px 8px #000, 0 0 3px #000" }}>{name}</div>
        {guess ? <div style={{ fontFamily: BODY, fontWeight: 700, fontSize: 24, color: "#cbbf9f", textShadow: "0 2px 6px #000" }}>추정: {guess}</div> : null}
      </div>
    </div>
  );
};

export const RouteMap: React.FC<{ s: F1Shot; t: number; route: F1Route }> = ({ s, t, route }) => {
  const R = route.med;
  const lt = t - s.t0, dur = s.t1 - s.t0;
  const [z0, z1] = s.zoom ?? [1, 1.05];
  const z = lerp(z0, z1, eInOut(clamp(lt / Math.max(1, dur))));
  const [fx, fy] = s.focus ?? [0.5, 0.5];
  const draw = eInOut(prog(lt, 0.5, 2.6));
  const shown = (s.show as string[]) ?? [];
  let past: Pt[][] = [], cur: Pt[] | null = null;
  if (s.mode === "direct") {
    const [a, b] = s.draw ?? [0, 0];
    cur = b > a ? partial(R.direct, draw) : null;
  } else {
    const n = s.upto ?? 0;
    past = R.legs.slice(0, Math.max(0, n - 1));
    cur = n > 0 ? partial(R.legs[n - 1], draw) : null;
  }
  const head = cur ? cur[cur.length - 1] : null;
  return (
    <AbsoluteFill style={{ background: "#0b141b", overflow: "hidden" }}>
      <AbsoluteFill style={camera(z, fx, fy)}>
        <Img src={staticFile(`odyssey/${R.image}`)} style={{ width: W, height: H }} />
        <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
          {past.map((leg, i) => (
            <path key={i} d={pathD(leg)} fill="none" stroke={GOLD} strokeOpacity={0.45} strokeWidth={3.2 / z} strokeDasharray={`${9 / z} ${9 / z}`} strokeLinecap="round" />
          ))}
          {cur ? <path d={pathD(cur)} fill="none" stroke={GOLD} strokeWidth={4.5 / z} strokeDasharray={`${11 / z} ${9 / z}`} strokeLinecap="round" /> : null}
          {head ? <circle cx={head[0]} cy={head[1]} r={9 / z} fill={GOLD} stroke="#000" strokeWidth={2 / z} /> : null}
          {shown.map((k) => {
            const p = R.points[k];
            return p ? <circle key={k} cx={p[0]} cy={p[1]} r={7 / z} fill={INK} stroke="#000" strokeWidth={2 / z} /> : null;
          })}
        </svg>
        {shown.map((k, i) => {
          const pl = PLACE[k];
          const p = R.points[k];
          if (!pl || !p) return null;
          const o = clamp(prog(lt, 0.3 + i * 0.5, 0.5));
          return <Label key={k} p={p} z={z} name={pl.name} guess={(s.guess ?? []).includes(k) ? pl.guess : undefined} dx={pl.dx} dy={pl.dy} o={o} hot={i === shown.length - 1} />;
        })}
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 48, bottom: 150, fontFamily: BODY, fontWeight: 700, fontSize: 22, color: "#bfb497", opacity: 0.85, textShadow: "0 1px 4px #000" }}>
        지명 옆 &lsquo;추정&rsquo;은 고대와 근대 학자들의 짐작입니다
      </div>
    </AbsoluteFill>
  );
};

/** Greece and Korea on one map, an arc between them; then the three dolmen sites */
export const WorldKorea: React.FC<{ s: F1Shot; t: number; route: F1Route }> = ({ s, t, route }) => {
  const lt = t - s.t0, dur = s.t1 - s.t0;
  if (s.kind === "world") {
    const R = route.world;
    const z = lerp(1.0, 1.06, clamp(lt / dur));
    const k = eInOut(prog(lt, 0.6, 2.2));
    const [a, b] = [R.greece, R.korea];
    const mid: Pt = [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 260];
    const q = (u: number): Pt => [(1 - u) * (1 - u) * a[0] + 2 * (1 - u) * u * mid[0] + u * u * b[0], (1 - u) * (1 - u) * a[1] + 2 * (1 - u) * u * mid[1] + u * u * b[1]];
    const arc = Array.from({ length: 61 }, (_, i) => q((i / 60) * k));
    return (
      <AbsoluteFill style={{ background: "#0b141b", overflow: "hidden" }}>
        <AbsoluteFill style={camera(z, 0.5, 0.45)}>
          <Img src={staticFile(`odyssey/${R.image}`)} style={{ width: W, height: H }} />
          <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
            <path d={pathD(arc)} fill="none" stroke={GOLD} strokeWidth={4} strokeDasharray="12 10" />
            <circle cx={a[0]} cy={a[1]} r={10} fill={INK} stroke="#000" strokeWidth={2} />
            <circle cx={b[0]} cy={b[1]} r={10 * clamp(k * 3 - 2)} fill={GOLD} stroke="#000" strokeWidth={2} />
          </svg>
          <Label p={a} z={z} name="그리스" guess={undefined} dy={1} o={clamp(prog(lt, 0.2, 0.5))} />
          <Label p={b} z={z} name="한반도" dy={1} o={clamp(prog(lt, 2.4, 0.5))} hot />
        </AbsoluteFill>
        <div style={{ position: "absolute", top: 110, width: "100%", textAlign: "center", fontFamily: TITLE, fontSize: 64, color: INK, textShadow: "0 3px 12px #000", opacity: clamp(prog(lt, 0.3, 0.6)) }}>
          기원전 8세기 무렵
        </div>
      </AbsoluteFill>
    );
  }
  const R = route.korea;
  const z = lerp(1.0, 1.08, clamp(lt / dur));
  const sites: [Pt, string, number][] = [[R.ganghwa, "강화", -1], [R.gochang, "고창", -1], [R.hwasun, "화순", 1]];
  return (
    <AbsoluteFill style={{ background: "#0b141b", overflow: "hidden" }}>
      <AbsoluteFill style={camera(z, 0.45, 0.5)}>
        <Img src={staticFile(`odyssey/${R.image}`)} style={{ width: W, height: H }} />
        <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }}>
          {sites.map(([p], i) => {
            const k = eOut(prog(lt, 0.5 + i * 0.5, 0.5));
            return (
              <g key={i}>
                <circle cx={p[0]} cy={p[1]} r={30 * k} fill="none" stroke={GOLD} strokeOpacity={0.5} strokeWidth={3} />
                <circle cx={p[0]} cy={p[1]} r={11 * k} fill={GOLD} stroke="#000" strokeWidth={2} />
              </g>
            );
          })}
        </svg>
        {sites.map(([p, n, dx], i) => (
          <Label key={n} p={p} z={z} name={n} dx={dx} o={clamp(prog(lt, 0.7 + i * 0.5, 0.5))} />
        ))}
      </AbsoluteFill>
      <div style={{ position: "absolute", top: 100, right: 120, textAlign: "right", opacity: clamp(prog(lt, 0.4, 0.6)) }}>
        <div style={{ fontFamily: TITLE, fontSize: 64, color: INK, textShadow: "0 3px 12px #000" }}>한반도 · 청동기 시대</div>
        <div style={{ fontFamily: BODY, fontWeight: 700, fontSize: 32, color: "#d8cba8", textShadow: "0 2px 8px #000", marginTop: 8 }}>고창·화순·강화 고인돌 유적 (유네스코 세계유산)</div>
      </div>
    </AbsoluteFill>
  );
};
