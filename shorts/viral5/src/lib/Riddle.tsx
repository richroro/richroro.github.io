// [괴담] v2 look (research/benchmark-footage.md §1, the 디로록 riddle shorts): full-screen 9:16 footage with no band,
// a small white modifier over one big red word on the picture, and plain white captions at 60-65 % of the height.
// Used when edit.json has "titleStyle": "riddle" and/or "capLook": "plain"; every other short is untouched.
import { fitText } from "@remotion/layout-utils";
import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import type { CapPage } from "./Captions";
import { BODY, TITLE } from "./fonts";

export const RIDDLE_RED = "#E8141B";
const plain = (s: string) => s.replace(/\\\[/g, "[").replace(/[[\]{}]/g, "");

/** title[0] small and white (the modifier), title[1] big and red (the one word), centred on y (default 330, about 17 %) */
export const RiddleTitle: React.FC<{ title: [string, string]; y?: number; color?: string }> = ({ title, y = 330, color = RIDDLE_RED }) => {
  const a = plain(title[0]), b = plain(title[1]);
  const sa = Math.min(64, fitText({ text: a, withinWidth: 900, fontFamily: TITLE }).fontSize);
  const sb = Math.min(168, fitText({ text: b, withinWidth: 980, fontFamily: TITLE }).fontSize);
  return (
    <div style={{ position: "absolute", left: 0, width: 1080, top: y - (sa + sb) * 0.6, display: "flex", flexDirection: "column", alignItems: "center",
      fontFamily: TITLE, lineHeight: 1.08, textAlign: "center", paintOrder: "stroke" }}>
      <div style={{ fontSize: sa, color: "white", WebkitTextStroke: "10px rgba(0,0,0,.85)", paintOrder: "stroke", filter: "drop-shadow(0 4px 8px rgba(0,0,0,.6))" }}>{a}</div>
      <div style={{ fontSize: sb, color, WebkitTextStroke: "14px rgba(0,0,0,.9)", paintOrder: "stroke", filter: "drop-shadow(0 6px 14px rgba(0,0,0,.7))" }}>{b}</div>
    </div>
  );
};

/** one caption page: white only, a thin outline and soft shadow, no word highlight and no entrance animation
 *  (so a page that starts at 0 s is already whole on the first frame, which is the thumbnail) */
const PlainPage: React.FC<{ page: CapPage; centerY: number }> = ({ page, centerY }) => {
  const { width } = useVideoConfig();
  const text = page.tokens.map((t) => t.text).join(" ");
  const size = Math.min(82, fitText({ text, withinWidth: width * 0.84, fontFamily: BODY, fontWeight: "900" }).fontSize);
  return (
    <AbsoluteFill style={{ top: centerY - 110, height: 220, justifyContent: "center", alignItems: "center" }}>
      <div style={{ fontFamily: BODY, fontWeight: 900, fontSize: size, lineHeight: 1.15, maxWidth: width * 0.9, letterSpacing: -1, color: "white",
        WebkitTextStroke: "10px rgba(0,0,0,.9)", paintOrder: "stroke", textAlign: "center", filter: "drop-shadow(0 4px 10px rgba(0,0,0,.75))" }}>
        {text}
      </div>
    </AbsoluteFill>
  );
};

export const PlainCaptions: React.FC<{ pages: CapPage[]; centerY?: number }> = ({ pages, centerY = 1200 }) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {pages.map((p, i) => {
        const from = Math.round((p.startMs / 1000) * fps);
        const dur = Math.round((p.endMs / 1000) * fps) - from;
        return dur > 0 ? (
          <Sequence key={i} from={from} durationInFrames={dur} layout="none">
            <PlainPage page={p} centerY={centerY} />
          </Sequence>
        ) : null;
      })}
    </>
  );
};
