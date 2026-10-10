// The "그 시절 레트로" picture: an old photo in a rounded 4:3 frame with a thin white border on a black page,
// film grain and a soft vignette over the photo only, and a round yellow year sticker on the frame's top-left corner.
// Used by ClipShort when a clip's frame is "rounded43" (edit.json: "frame": "rounded43", "grain": 0.15, "year": "1983",
// each at the top level or per clip).
import React from "react";
import { AbsoluteFill, random } from "remotion";
import { TITLE } from "./fonts";
import { clamp, eBack, prog } from "./fx";

/** where the rounded 4:3 frame sits on the 1080×1920 page: under the 400 px title band, above the caption */
export const ROUNDED43 = { left: 30, top: 440, width: 1020, height: 765, radius: 36, border: 5 };
/** another box on the page (lib/RetroV2.tsx RETROBOX) can reuse the frame, grain and crop */
type Box = typeof ROUNDED43;

/** film grain: a fresh noise pattern each frame (seeded, so renders are deterministic), plus a vignette */
const Grain: React.FC<{ amount: number; frame: number }> = ({ amount, frame }) => {
  const seed = Math.floor(random(`grain-${frame}`) * 1000);
  const id = `grain-${frame}`;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: clamp(amount * 2.4), mixBlendMode: "overlay" }}>
        <filter id={id}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={seed} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${id})`} />
      </svg>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,${clamp(amount * 3.6, 0, 0.7)}) 100%)` }} />
    </AbsoluteFill>
  );
};

/** the round yellow year sticker; it pops in when the year changes from the previous clip's */
export const YearSticker: React.FC<{ year: string; t: number; popIn: boolean }> = ({ year, t, popIn }) => {
  const s = popIn ? eBack(prog(t, 0, 0.32), 2.2) : 1;
  const d = 168;
  return (
    <div style={{ position: "absolute", left: ROUNDED43.left - 6, top: ROUNDED43.top - 34, width: d, height: d, borderRadius: d / 2,
      background: "#FFE14D", border: "6px solid #111", boxShadow: "6px 6px 0 rgba(0,0,0,.55)", display: "flex", flexDirection: "column",
      justifyContent: "center", alignItems: "center", transform: `rotate(-10deg) scale(${s})`, fontFamily: TITLE, color: "#111", lineHeight: 1 }}>
      <div style={{ fontSize: year.length > 4 ? 40 : 52 }}>{year}</div>
      {/^\d{4}$/.test(year) ? <div style={{ fontSize: 30, marginTop: 4 }}>년</div> : null}
    </div>
  );
};

/** a crop ("crop": [cx, cy, zoom] in edit.json) inside the frame: (cx, cy) of the photo sits in the middle, never showing an edge */
export const rounded43Crop = (c: { cx: number; cy: number; zoom: number; w: number; h: number }, s: number, box: Box = ROUNDED43): React.CSSProperties => {
  const W = box.width - 2 * box.border, H = box.height - 2 * box.border;
  const S = Math.max(W / c.w, H / c.h) * c.zoom * s, dw = c.w * S, dh = c.h * S;
  return { position: "absolute", left: Math.min(0, Math.max(W - dw, W / 2 - c.cx * dw)), top: Math.min(0, Math.max(H - dh, H / 2 - c.cy * dh)), width: dw, height: dh };
};

/** the photo (children, already scaled by the clip's slow zoom) inside the rounded 4:3 frame */
export const Rounded43: React.FC<{ grain?: number; frame: number; children: React.ReactNode; box?: Box }> = ({ grain, frame, children, box }) => {
  const b = box ?? ROUNDED43;
  return (
    <div style={{ position: "absolute", left: b.left, top: b.top, width: b.width, height: b.height, borderRadius: b.radius, overflow: "hidden",
      border: `${b.border}px solid rgba(255,255,255,.92)`, boxSizing: "border-box", background: "#111", boxShadow: "0 10px 40px rgba(0,0,0,.7)" }}>
      {children}
      {grain ? <Grain amount={grain} frame={frame} /> : null}
    </div>
  );
};
