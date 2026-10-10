// The long-form thumbnail (1280×720 still, `<id>-thumb`): 2-3 lines of huge outlined text, white with a yellow or red
// key word, over a picture or beside a drawn character, with an optional red circle or arrow. Driven by edit.json "thumb".
import React from "react";
import { fitText } from "@remotion/layout-utils";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { BODY, TITLE } from "../fonts";
import { Marked } from "../Marked";
import { Mochi, Scene } from "../Sseol";
import type { LongData, Thumb } from "./types";

const W = 1280, H = 720;

const ICON_BG = ["#FFD84D", "#8FD3FF", "#FF9EBB", "#B9F27C", "#C9A7FF", "#FFB36B", "#7FE0D0", "#D9D9D9"];

/** 사연툰 look: the title on a band across the top (key words coloured), a drawn scene below with 2-3 characters and bubbles */
const BandThumb: React.FC<{ th: Thumb }> = ({ th }) => {
  const key = th.key ?? "#FF3B3B", bandH = th.lines.length > 1 ? 250 : 150;
  const size = Math.min(110, ...th.lines.map((l) => fitText({ text: l.replace(/[[\]{}\\]/g, ""), withinWidth: 1200, fontFamily: TITLE }).fontSize));
  const chars = th.chars ?? [], n = chars.length, cs = n >= 3 ? 300 : 360;
  const xs = chars.map((c, i) => c.x ?? (n === 1 ? 0.5 : n === 2 ? [0.3, 0.7][i] : [0.2, 0.5, 0.8][i % 3]));
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: bandH, width: W, height: H - bandH, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: -320, top: -(1080 - (H - bandH)) + 40, width: 1920, height: 1080, transform: `scale(${W / 1920 * 1.3})`, transformOrigin: "50% 100%" }}>
          <Scene g={{ chars: [], bg: th.scene ?? "home" }} t={0} h={1080} />
        </div>
        {chars.map((c, i) => (
          <div key={i} style={{ position: "absolute", left: xs[i] * W - cs * (c.size ?? 1) / 2, top: H - bandH - cs * (c.size ?? 1) + 10, width: cs * (c.size ?? 1), height: cs * (c.size ?? 1) }}>
            <Mochi c={c} i={i} t={0.6} size={cs * (c.size ?? 1)} />
          </div>
        ))}
        {(th.says ?? []).map((sy, i) => (
          <div key={i} style={{ position: "absolute", left: Math.max(16, Math.min(W - 540, xs[sy.who] * W - 260)), top: 18 + 4 * i, maxWidth: 520, background: "white", border: "6px solid #1b1b1f",
            borderRadius: 30, padding: "10px 24px", fontFamily: BODY, fontWeight: 900, fontSize: 46, lineHeight: 1.2, color: "#1b1b1f", boxShadow: "6px 6px 0 #1b1b1f", wordBreak: "keep-all" }}>
            <Marked text={sy.text} color="#e8212e" />
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: bandH, background: th.bandBg ?? "#000", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        {th.lines.map((l, i) => <div key={i} style={{ fontFamily: TITLE, fontSize: size, lineHeight: 1.08, color: "white", whiteSpace: "nowrap" }}><Marked text={l} color={key} /></div>)}
      </div>
    </AbsoluteFill>
  );
};

/** 잡학 리스트 look: a white board, a black title with a red key word, round colour icons in a grid with short names */
const GridThumb: React.FC<{ th: Thumb }> = ({ th }) => {
  const items = th.items ?? [], cols = items.length > 6 ? 4 : 3, rows = Math.ceil(items.length / cols);
  const size = Math.min(96, ...th.lines.map((l) => fitText({ text: l.replace(/[[\]{}\\]/g, ""), withinWidth: 1200, fontFamily: TITLE }).fontSize));
  const top = 40 + th.lines.length * size * 1.08 + 20, cell = Math.min(300, (W - 80) / cols), ch = (H - top - 20) / rows, r = Math.min(cell, ch) * 0.33;
  return (
    <AbsoluteFill style={{ background: "#fbfaf6" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 36, textAlign: "center" }}>
        {th.lines.map((l, i) => <div key={i} style={{ fontFamily: TITLE, fontSize: size, lineHeight: 1.08, color: "#111" }}><Marked text={l} color={th.key ?? "#E3181E"} /></div>)}
      </div>
      {items.map((it, i) => {
        const x = (W - cols * cell) / 2 + (i % cols) * cell + cell / 2, y = top + Math.floor(i / cols) * ch + ch / 2 - 18;
        return (
          <div key={i} style={{ position: "absolute", left: x - cell / 2, top: y - r, width: cell, textAlign: "center" }}>
            <div style={{ margin: "0 auto", width: 2 * r, height: 2 * r, borderRadius: r, background: ICON_BG[i % ICON_BG.length], border: "6px solid #1b1b1f", display: "flex",
              justifyContent: "center", alignItems: "center", fontSize: r * 1.05, lineHeight: 1, boxSizing: "border-box" }}>{it.icon}</div>
            <div style={{ fontFamily: BODY, fontWeight: 900, fontSize: Math.min(34, r * 0.5), color: "#111", marginTop: 6 }}>{it.label}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export const LongThumb: React.FC<{ d: LongData }> = ({ d }) => {
  const th = d.thumb!;
  if (th.style === "band") return <BandThumb th={th} />;
  if (th.style === "grid") return <GridThumb th={th} />;
  const right = th.side === "right", bottom = th.valign === "bottom";
  const key = th.key ?? "#FFE14D";
  const textW = th.char ? 800 : 1180;
  const size = Math.min(150, ...th.lines.map((l) => fitText({ text: l.replace(/[[\]{}\\]/g, ""), withinWidth: textW, fontFamily: TITLE }).fontSize));
  let img: React.ReactNode = null;
  if (th.img) {
    const [cx, cy, z] = th.crop ?? [0.5, 0.5, 1];
    img = <Img src={staticFile(th.img)} style={{ position: "absolute", left: 0, top: 0, width: W, height: H, objectFit: "cover", objectPosition: `${cx * 100}% ${cy * 100}%`,
      transform: `scale(${z})`, transformOrigin: `${cx * 100}% ${cy * 100}%`, filter: "saturate(1.25) contrast(1.08)" }} />;
  }
  const c = th.char, cs = c?.size ?? 520;
  return (
    <AbsoluteFill style={{ background: th.bg ?? "radial-gradient(ellipse at 60% 40%, #24345f, #070a14 75%)", overflow: "hidden" }}>
      {img}
      <AbsoluteFill style={{ background: `linear-gradient(${bottom ? "0deg" : right ? "270deg" : "90deg"}, rgba(0,0,0,.72) 0%, rgba(0,0,0,.35) 45%, rgba(0,0,0,0) 70%)` }} />
      {c ? (
        <div style={{ position: "absolute", left: (c.x ?? (right ? 0.22 : 0.8)) * W - cs / 2, top: (c.y ?? 0.98) * H - cs, width: cs, height: cs }}>
          <Mochi c={c} i={0} t={0.6} size={cs} />
        </div>
      ) : null}
      {th.circle ? <div style={{ position: "absolute", left: th.circle.x - th.circle.r, top: th.circle.y - th.circle.r, width: 2 * th.circle.r, height: 2 * th.circle.r,
        borderRadius: "50%", border: "14px solid #FF2A2A", boxShadow: "0 0 0 5px white, inset 0 0 0 5px white" }} /> : null}
      {th.arrow ? (
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <g transform={`translate(${th.arrow.x} ${th.arrow.y}) rotate(${th.arrow.rot})`}>
            <path d={`M0 0 L-70 -60 L-70 -26 L-${th.arrow.len ?? 220} -26 L-${th.arrow.len ?? 220} 26 L-70 26 L-70 60 Z`} fill="#FF2A2A" stroke="white" strokeWidth={10} strokeLinejoin="round" />
          </g>
        </svg>
      ) : null}
      <div style={{ position: "absolute", top: 0, bottom: bottom ? 26 : 0, [right ? "right" : "left"]: 44, width: textW, display: "flex", flexDirection: "column", justifyContent: bottom ? "flex-end" : "center",
        alignItems: right ? "flex-end" : "flex-start", textAlign: right ? "right" : "left" }}>
        {th.tag ? <div style={{ fontFamily: BODY, fontWeight: 900, fontSize: 40, color: "#111", background: key, border: "5px solid #111", borderRadius: 12, padding: "2px 18px", marginBottom: 14 }}>{th.tag}</div> : null}
        {th.lines.map((l, i) => (
          <div key={i} style={{ fontFamily: TITLE, fontSize: size, lineHeight: 1.08, color: "white", WebkitTextStroke: `${Math.round(size * 0.16)}px black`, paintOrder: "stroke",
            filter: "drop-shadow(0 8px 10px rgba(0,0,0,.6))", whiteSpace: "nowrap" }}><Marked text={l} color={key} /></div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
