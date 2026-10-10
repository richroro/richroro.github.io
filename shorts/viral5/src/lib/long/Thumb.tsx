// The long-form thumbnail (1280×720 still, `<id>-thumb`): 2-3 lines of huge outlined text, white with a yellow or red
// key word, over a picture or beside a drawn character, with an optional red circle or arrow. Driven by edit.json "thumb".
import React from "react";
import { fitText } from "@remotion/layout-utils";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { BODY, TITLE } from "../fonts";
import { Marked } from "../Marked";
import { Mochi } from "../Sseol";
import type { LongData } from "./types";

const W = 1280, H = 720;

export const LongThumb: React.FC<{ d: LongData }> = ({ d }) => {
  const th = d.thumb!;
  const right = th.side === "right";
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
      <AbsoluteFill style={{ background: `linear-gradient(${right ? "270deg" : "90deg"}, rgba(0,0,0,.72) 0%, rgba(0,0,0,.35) 45%, rgba(0,0,0,0) 70%)` }} />
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
      <div style={{ position: "absolute", top: 0, bottom: 0, [right ? "right" : "left"]: 44, width: textW, display: "flex", flexDirection: "column", justifyContent: "center",
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
