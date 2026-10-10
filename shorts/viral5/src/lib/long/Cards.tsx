// Full-screen cards for long-forms: the title card, chapter cards, fact / text / "TOP n" rank cards, a map card and the
// outro's end-screen space. Each sits over a blurred, darkened picture (or a plain dark gradient).
import React from "react";
import { fitText } from "@remotion/layout-utils";
import { AbsoluteFill, Img, OffthreadVideo, staticFile } from "remotion";
import { BODY, TITLE } from "../fonts";
import { clamp, eBack, eInOut, eOut, prog } from "../fx";
import { Marked } from "../Marked";
import { LAND } from "./worldmap";
import { KEY } from "./LongCaptions";

const W = 1920, H = 1080;
const STROKE = (px: number): React.CSSProperties => ({ WebkitTextStroke: `${px}px black`, paintOrder: "stroke" });

/** a blurred, darkened picture behind a card */
export const BlurBg: React.FC<{ file?: string | null; isImg?: boolean; dim?: number; blur?: string | null; trim?: number; rate?: number }> = ({ file, isImg, dim = 0.35, blur, trim = 0, rate = 1 }) => {
  if (blur) {  // prep's small pre-blurred copy, scaled up: no CSS filter for the renderer to run
    const st: React.CSSProperties = { position: "absolute", inset: 0, width: W, height: H, objectFit: "cover" };
    return (
      <AbsoluteFill style={{ background: "#000" }}>
        {/\.(jpe?g|png|webp)$/i.test(blur) ? <Img src={staticFile(blur)} style={st} /> : <OffthreadVideo src={staticFile(blur)} muted trimBefore={trim} playbackRate={rate} style={st} />}
        <AbsoluteFill style={{ background: `rgba(0,0,0,${1 - dim})` }} />
      </AbsoluteFill>
    );
  }
  if (!file) return <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 40%, #1d2747, #05060b 75%)" }} />;
  const st: React.CSSProperties = { position: "absolute", left: -80, top: -80, width: W + 160, height: H + 160, objectFit: "cover", filter: `blur(30px) brightness(${dim}) saturate(1.1)` };
  return <AbsoluteFill style={{ background: "#000" }}>{isImg ? <Img src={staticFile(file)} style={st} /> : <OffthreadVideo src={staticFile(file)} muted style={st} />}</AbsoluteFill>;
};

const fit = (text: string, max: number, within: number, font = TITLE) => Math.min(max, fitText({ text: text.replace(/[[\]{}]/g, ""), withinWidth: within, fontFamily: font }).fontSize);

export const TitleCard: React.FC<{ t: number; dur: number; kicker: string; title: [string, string]; sub: string; bg: string | null; bgIsImg?: boolean; bgBlur?: string | null }> = ({ t, dur, kicker, title, sub, bg, bgIsImg, bgBlur }) => {
  const o = prog(t, 0, 0.3) * (1 - prog(t, dur - 0.3, 0.3));
  const s = 1.06 - 0.06 * eOut(prog(t, 0, 0.8));
  return (
    <AbsoluteFill>
      <BlurBg file={bg} isImg={bgIsImg} blur={bgBlur} dim={0.32} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: o, transform: `scale(${s})` }}>
        {kicker ? <div style={{ fontFamily: BODY, fontWeight: 800, fontSize: 40, letterSpacing: 6, color: KEY, marginBottom: 22 }}>{kicker}</div> : null}
        <div style={{ fontFamily: TITLE, lineHeight: 1.12, textAlign: "center", color: "white", ...STROKE(16), filter: "drop-shadow(0 8px 18px rgba(0,0,0,.6))" }}>
          <div style={{ fontSize: fit(title[0], 140, 1700) }}><Marked text={title[0]} /></div>
          <div style={{ fontSize: fit(title[1], 140, 1700), color: KEY }}><Marked text={title[1]} color="white" /></div>
        </div>
        {sub ? <div style={{ fontFamily: BODY, fontWeight: 700, fontSize: 40, color: "rgba(255,255,255,.85)", marginTop: 30 }}>{sub}</div> : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const ChapterCard: React.FC<{ t: number; dur: number; n: number; title: string; bg: string | null; bgIsImg?: boolean; bgBlur?: string | null;
  kicker?: string; style?: "card" | "dip" }> = ({ t, dur, n, title, bg, bgIsImg, bgBlur, kicker, style }) => {
  const o = prog(t, 0, 0.25) * (1 - prog(t, dur - 0.25, 0.25));
  const line = eOut(prog(t, 0.1, 0.5));
  if (style === "dip") {  // a quiet dip to black with the title small in the middle (sleep and story long-forms)
    return (
      <AbsoluteFill style={{ background: "#000", justifyContent: "center", alignItems: "center" }}>
        <div style={{ fontFamily: BODY, fontWeight: 800, fontSize: 40, color: "rgba(255,255,255,.75)", opacity: prog(t, 0.15, 0.3) * (1 - prog(t, dur - 0.3, 0.3)) }}>
          {kicker ? <span style={{ color: KEY, marginRight: 18 }}>{kicker}</span> : null}<Marked text={title} />
        </div>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill>
      <BlurBg file={bg} isImg={bgIsImg} blur={bgBlur} dim={0.3} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: o }}>
        <div style={{ fontFamily: BODY, fontWeight: 900, fontSize: 44, letterSpacing: 10, color: KEY, transform: `translateY(${18 * (1 - eOut(prog(t, 0, 0.5)))}px)` }}>
          {kicker ?? `CHAPTER ${String(n).padStart(2, "0")}`}
        </div>
        <div style={{ width: 760 * line, height: 6, background: KEY, borderRadius: 3, margin: "22px 0 30px" }} />
        <div style={{ fontFamily: TITLE, fontSize: fit(title, 130, 1700), color: "white", ...STROKE(14), textAlign: "center", lineHeight: 1.12,
          transform: `translateY(${24 * (1 - eOut(prog(t, 0.05, 0.5)))}px)` }}><Marked text={title} /></div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const FactCard: React.FC<{ t: number; big: string; label?: string; sub?: string; revealAt?: number | null }> = ({ t, big, label, sub, revealAt }) => {
  const r = revealAt ?? 0.15, s = eBack(prog(t, r, 0.35), 1.8);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingBottom: 90 }}>
      {label ? <div style={{ fontFamily: BODY, fontWeight: 900, fontSize: 54, color: KEY, ...STROKE(10), opacity: prog(t, 0, 0.3), marginBottom: 10 }}><Marked text={label} color="white" /></div> : null}
      <div style={{ fontFamily: TITLE, fontSize: fit(big, 260, 1700), lineHeight: 1.05, color: "white", ...STROKE(22), transform: `scale(${s})`, opacity: clamp(s * 2),
        filter: "drop-shadow(0 12px 24px rgba(0,0,0,.6))" }}><Marked text={big} /></div>
      {sub ? <div style={{ fontFamily: BODY, fontWeight: 800, fontSize: 50, color: "white", ...STROKE(10), marginTop: 18, opacity: prog(t, r + 0.3, 0.3) }}><Marked text={sub} /></div> : null}
    </AbsoluteFill>
  );
};

export const TextCard: React.FC<{ t: number; text: string }> = ({ t, text }) => (
  <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 180px 90px" }}>
    <div style={{ fontFamily: BODY, fontWeight: 900, fontSize: 76, lineHeight: 1.35, textAlign: "center", color: "white", wordBreak: "keep-all", ...STROKE(14),
      opacity: prog(t, 0, 0.35), transform: `translateY(${20 * (1 - eOut(prog(t, 0, 0.5)))}px)` }}>
      {text.split("\n").map((l, i) => <div key={i}><Marked text={l} /></div>)}
    </div>
  </AbsoluteFill>
);

export const RankCard: React.FC<{ t: number; n: number; total?: number; title?: string; label?: string }> = ({ t, n, total, title, label }) => {
  const p = prog(t, 0.05, 0.3), s = 2.2 - 1.2 * eOut(p);
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingBottom: 90 }}>
      {total ? (
        <div style={{ fontFamily: TITLE, fontSize: 64, color: "#111", background: KEY, border: "6px solid #111", borderRadius: 18, padding: "4px 28px 0", boxShadow: "8px 8px 0 #111",
          marginBottom: 26, opacity: prog(t, 0, 0.2) }}>{title ?? `TOP ${total}`}</div>
      ) : null}
      <div style={{ fontFamily: TITLE, fontSize: 300, lineHeight: 1, color: KEY, ...STROKE(26), transform: `rotate(-6deg) scale(${s})`, opacity: clamp(p * 3),
        filter: "drop-shadow(0 18px 30px rgba(0,0,0,.6))" }}>{n}위</div>
      {label ? <div style={{ fontFamily: TITLE, fontSize: fit(label, 110, 1600), color: "white", ...STROKE(16), marginTop: 30, opacity: prog(t, 0.35, 0.3),
        transform: `translateY(${20 * (1 - eOut(prog(t, 0.35, 0.4)))}px)` }}><Marked text={label} /></div> : null}
    </AbsoluteFill>
  );
};

/** a plain outline map (Natural Earth land, public domain) zoomed to a lon/lat window, with pulsing dots and drawn arrows */
export const MapCard: React.FC<{ t: number; dur: number; center: [number, number]; span: number; label?: string;
  dots?: { lon: number; lat: number; label?: string; at?: number }[]; arrows?: { from: [number, number]; to: [number, number]; at?: number; dashed?: boolean }[] }> = ({ t, dur, center, span, label, dots = [], arrows = [] }) => {
  const k = 1.18 - 0.18 * eInOut(prog(t, 0, Math.min(dur, 4)));
  const vw = span * 10 * k, vh = vw * H / W, vx = (center[0] + 180) * 10 - vw / 2, vy = (90 - center[1]) * 10 - vh / 2;
  const P = (lon: number, lat: number) => [((lon + 180) * 10 - vx) / vw * W, ((90 - lat) * 10 - vy) / vh * H];
  return (
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, #13254a, #070d1c 80%)" }}>
      <svg width={W} height={H} viewBox={`${vx} ${vy} ${vw} ${vh}`} style={{ position: "absolute", inset: 0 }}>
        {Array.from({ length: 37 }, (_, i) => <line key={`x${i}`} x1={i * 100} y1={0} x2={i * 100} y2={1800} stroke="rgba(140,170,230,.12)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />)}
        {Array.from({ length: 19 }, (_, i) => <line key={`y${i}`} x1={0} y1={i * 100} x2={3600} y2={i * 100} stroke="rgba(140,170,230,.12)" strokeWidth={1.2} vectorEffect="non-scaling-stroke" />)}
        <path d={LAND} fill="#2b3a5c" stroke="#9fb7ea" strokeWidth={2.2} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <defs><marker id="ah" viewBox="0 0 10 10" refX={6} refY={5} markerWidth={5} markerHeight={5} orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="#FF3B3B" /></marker></defs>
        {arrows.map((a, i) => {
          const [x1, y1] = P(...a.from), [x2, y2] = P(...a.to), len = Math.hypot(x2 - x1, y2 - y1), q = eInOut(prog(t, a.at ?? 0.6, 1.0));
          const mx = (x1 + x2) / 2 - (y2 - y1) * 0.18, my = (y1 + y2) / 2 + (x2 - x1) * 0.18;
          const d = `M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`;
          if (a.dashed) {  // a dotted route: the dashes are revealed along the path by a growing mask
            return (
              <g key={i}>
                <mask id={`m${i}`} maskUnits="userSpaceOnUse"><path d={d} fill="none" stroke="white" strokeWidth={24} strokeDasharray={len * 1.2} strokeDashoffset={len * 1.2 * (1 - q)} /></mask>
                <path d={d} fill="none" stroke="#FF3B3B" strokeWidth={9} strokeLinecap="round" strokeDasharray="4 22" mask={`url(#m${i})`} markerEnd={q > 0.97 ? "url(#ah)" : undefined} />
              </g>
            );
          }
          return <path key={i} d={d} fill="none" stroke="#FF3B3B" strokeWidth={10} strokeLinecap="round" markerEnd={q > 0.97 ? "url(#ah)" : undefined}
            strokeDasharray={len * 1.2} strokeDashoffset={len * 1.2 * (1 - q)} style={{ filter: "drop-shadow(0 0 6px rgba(0,0,0,.6))" }} />;
        })}
        {dots.map((d, i) => {
          const [x, y] = P(d.lon, d.lat), a = d.at ?? 0.3, s = eBack(prog(t, a, 0.3), 2.2), pulse = ((t - a) * 0.9) % 1;
          return t < a ? null : (
            <g key={i}>
              <circle cx={x} cy={y} r={18 + 50 * pulse} fill="none" stroke="#FF3B3B" strokeWidth={5} opacity={1 - pulse} />
              <circle cx={x} cy={y} r={16 * s} fill="#FF3B3B" stroke="white" strokeWidth={5} />
            </g>
          );
        })}
      </svg>
      {dots.map((d, i) => {
        const [x, y] = P(d.lon, d.lat), a = d.at ?? 0.3;
        return d.label && t >= a ? (
          <div key={i} style={{ position: "absolute", left: x + 34, top: y - 34, fontFamily: BODY, fontWeight: 900, fontSize: 44, color: "#111", background: "white",
            border: "5px solid #111", borderRadius: 14, padding: "2px 18px", boxShadow: "6px 6px 0 #111", whiteSpace: "nowrap", opacity: prog(t, a + 0.15, 0.2) }}>{d.label}</div>
        ) : null;
      })}
      {label ? <div style={{ position: "absolute", left: 40, top: 92, fontFamily: TITLE, fontSize: 64, color: "white", background: "rgba(0,0,0,.55)", borderRadius: 16,
        padding: "8px 26px 2px", opacity: prog(t, 0, 0.3) }}><Marked text={label} /></div> : null}
      <div style={{ position: "absolute", right: 40, bottom: 18, fontFamily: BODY, fontWeight: 700, fontSize: 20, color: "rgba(255,255,255,.4)" }}>지도: Natural Earth</div>
    </AbsoluteFill>
  );
};

/** the outro: the picture blurred, clean space for two end-screen video boxes and a subscribe button */
export const OutroSpace: React.FC<{ t: number; label: string; boxes: boolean }> = ({ t, label, boxes }) => {
  const o = prog(t, 0.3, 0.6);
  const box = (x: number) => (
    <div style={{ position: "absolute", left: x, top: 330, width: 720, height: 405, borderRadius: 18, background: "rgba(0,0,0,.35)", border: "3px solid rgba(255,255,255,.18)", opacity: o }} />
  );
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: "rgba(0,0,0,.35)", opacity: o }} />
      {boxes ? <>{box(170)}{box(1030)}
        <div style={{ position: "absolute", left: 960 - 75, top: 800, width: 150, height: 150, borderRadius: 75, background: "rgba(0,0,0,.35)", border: "3px solid rgba(255,255,255,.18)", opacity: o }} /></> : null}
      {label ? <div style={{ position: "absolute", left: 0, right: 0, top: 258, textAlign: "center", fontFamily: BODY, fontWeight: 900, fontSize: 50, color: "white", ...STROKE(10), opacity: o }}>{label}</div> : null}
    </AbsoluteFill>
  );
};

const ICON_BG = ["#FFD84D", "#8FD3FF", "#FF9EBB", "#B9F27C", "#C9A7FF", "#FFB36B", "#7FE0D0", "#D9D9D9"];

/** the list explainer's contents screen (잡학 리스트): round icons with names on a white board. The `focus` item is lit
 *  and, from zoomAt, the camera moves into it; `done` items are greyed with a tick; `circle` gets a red circle at circleAt */
export const GridCard: React.FC<{ t: number; items: { icon: string; label: string }[]; cols?: number; title?: string; focus?: number; done?: number[];
  circle?: number; zoomAt?: number | null; circleAt?: number | null }> = ({ t, items, cols = 4, title, focus, done = [], circle, zoomAt, circleAt }) => {
  const rows = Math.ceil(items.length / cols), cell = Math.min(400, 1700 / cols), ch = Math.min(360, (title ? 820 : 900) / rows);
  const gx = (W - cols * cell) / 2, gy = (title ? 210 : 120) + ((title ? 820 : 900) - rows * ch) / 2;
  const pos = (i: number) => [gx + (i % cols) * cell + cell / 2, gy + Math.floor(i / cols) * ch + ch / 2 - 20];
  const z = focus != null && zoomAt != null ? eInOut(prog(t, zoomAt, 0.6)) : 0;
  const [fx, fy] = focus != null ? pos(focus) : [W / 2, H / 2];
  const r = Math.min(cell, ch) * 0.3;
  return (
    <AbsoluteFill style={{ background: "#fbfaf6", overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translate(${(W / 2 - fx) * z}px, ${(H / 2 - 60 - fy) * z}px) scale(${1 + 1.4 * z})`, transformOrigin: `${fx}px ${fy}px` }}>
        {title ? <div style={{ position: "absolute", left: 0, right: 0, top: 70, textAlign: "center", fontFamily: TITLE, fontSize: 92, color: "#111" }}><Marked text={title} color="#E3181E" /></div> : null}
        {items.map((it, i) => {
          const [x, y] = pos(i), on = focus === i, off = done.includes(i), p = eBack(prog(t, 0.04 * i, 0.25), 2);
          return (
            <div key={i} style={{ position: "absolute", left: x - cell / 2, top: y - r, width: cell, textAlign: "center", opacity: (off ? 0.35 : 1) * clamp(p * 2), transform: `scale(${(on ? 1.08 : 1) * p})` }}>
              <div style={{ margin: "0 auto", width: 2 * r, height: 2 * r, borderRadius: r, background: ICON_BG[i % ICON_BG.length], border: `${on ? 10 : 6}px solid ${on ? "#111" : "#1b1b1f"}`,
                boxShadow: on ? `0 0 0 8px ${KEY}` : "none", display: "flex", justifyContent: "center", alignItems: "center", fontSize: r * 1.05, lineHeight: 1, boxSizing: "border-box" }}>{it.icon}</div>
              <div style={{ marginTop: 14, fontFamily: BODY, fontWeight: 900, fontSize: Math.min(44, r * 0.42), color: "#111", whiteSpace: "nowrap" }}><Marked text={it.label} color="#E3181E" /></div>
              {off ? <div style={{ position: "absolute", left: cell / 2 + r * 0.45, top: -r * 0.1, fontSize: r * 0.8, color: "#1fa34a", fontWeight: 900, fontFamily: BODY }}>✓</div> : null}
            </div>
          );
        })}
        {circle != null ? (() => {
          // around the icon and its name together
          const [x, y] = pos(circle), q = eOut(prog(t, circleAt ?? 0.3, 0.5)), rx = cell * 0.5, ry = r + 62, L = Math.PI * (rx + ry) * 1.05;
          return (
            <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
              <ellipse cx={x} cy={y + 40} rx={rx} ry={ry} fill="none" stroke="#FF2A2A" strokeWidth={14} strokeLinecap="round" strokeDasharray={L} strokeDashoffset={L * (1 - q)} transform={`rotate(-6 ${x} ${y + 40})`} />
            </svg>
          );
        })() : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** a document on a dark background (a notice, a handover sheet, a rule list): the title, then each line at its step;
 *  {word} marks red, [word] yellow highlighter */
export const DocCard: React.FC<{ t: number; title?: string; lines: string[]; steps?: number[]; page?: string; paper?: string }> = ({ t, title, lines, steps = [], page, paper = "#f3eedf" }) => (
  <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 70 }}>
    <div style={{ position: "relative", width: 1180, minHeight: 640, maxHeight: 820, overflow: "hidden", background: paper, borderRadius: 6, boxShadow: "0 30px 80px rgba(0,0,0,.6)",
      padding: "56px 80px 70px", boxSizing: "border-box", transform: `rotate(-1.2deg) translateY(${20 * (1 - eOut(prog(t, 0, 0.5)))}px)`, opacity: prog(t, 0, 0.3),
      backgroundImage: "repeating-linear-gradient(180deg, transparent 0 63px, rgba(60,80,120,.13) 63px 65px)" }}>
      {title ? <div style={{ fontFamily: BODY, fontWeight: 900, fontSize: 58, color: "#1b1b1f", marginBottom: 26, borderBottom: "4px solid #1b1b1f", paddingBottom: 14 }}><Marked text={title} color="#FFE14D" /></div> : null}
      {lines.map((l, i) => {
        const o = prog(t, steps[i] ?? 0.5 + 0.9 * i, 0.3);
        return (
          <div key={i} style={{ fontFamily: BODY, fontWeight: 700, fontSize: 44, lineHeight: 1.45, color: "#26262b", opacity: o, transform: `translateX(${-14 * (1 - o)}px)`, wordBreak: "keep-all" }}>
            <Marked text={l} color="#c79a00" />
          </div>
        );
      })}
      {page ? <div style={{ position: "absolute", right: 40, bottom: 22, fontFamily: BODY, fontWeight: 700, fontSize: 30, color: "#77736a" }}>{page}</div> : null}
    </div>
  </AbsoluteFill>
);
