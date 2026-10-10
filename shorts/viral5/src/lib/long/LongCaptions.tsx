// Long-form captions: bottom centre, one or two lines (prep_long.py splits pages at about 22 characters a line),
// white with a black stroke, [key] words in yellow. Timed to the voice from Edge TTS word boundaries.
import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { BODY } from "../fonts";
import type { LongPage } from "./types";

export const KEY = "#FFE14D";
export const RED = "#FF3B3B";
const fr = (s: number) => Math.round(s * 30);

const Page: React.FC<{ p: LongPage; size: number }> = ({ p, size }) => {
  const o = interpolate(useCurrentFrame(), [0, 3], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ justifyContent: p.top ? "flex-start" : "flex-end", alignItems: "center", paddingBottom: 46, paddingTop: 96, opacity: o }}>
      <div style={{ maxWidth: 1640, textAlign: "center", fontFamily: BODY, fontWeight: 800, fontSize: size, lineHeight: 1.3, letterSpacing: -0.5, color: "white",
        WebkitTextStroke: `${Math.round(size * 0.17)}px black`, paintOrder: "stroke", textShadow: "0 3px 8px rgba(0,0,0,.55)" }}>
        {p.lines.map((line, i) => (
          <div key={i} style={{ whiteSpace: "nowrap" }}>
            {line.map((w, k) => <span key={k} style={{ color: w.red ? RED : w.key ? KEY : "white" }}>{(k ? " " : "") + w.text}</span>)}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const LongCaptions: React.FC<{ pages: LongPage[]; size: number }> = ({ pages, size }) => (
  <>
    {pages.map((p, i) => {
      const from = fr(p.startMs / 1000), dur = fr(p.endMs / 1000) - from;
      return dur > 0 ? <Sequence key={i} from={Math.max(0, from)} durationInFrames={dur} layout="none"><Page p={p} size={size} /></Sequence> : null;
    })}
  </>
);
