// "그 시절 레트로" v2, after the benchmark (research/benchmark-footage.md §2): a two-line title over the top quarter
// (yellow provocative line, white era line), the picture in a big rounded box at 27–73% of the height, and the captions
// inside that box on a translucent strip, white with one yellow key colour. No source badges or footnotes on screen.
// Turned on per short in edit.json: "frame": "retrobox" (the picture box) and "look": "retro2" (title, captions, no shade
// or credit badge). Shorts without these keys render exactly as before.
import { fitText } from "@remotion/layout-utils";
import React from "react";
import { Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { CapPage } from "./Captions";
import { BODY, TITLE } from "./fonts";
import { eBack, prog } from "./fx";

/** the picture box: full width less a 27 px margin, 27%–73% of the 1920 px height, rounded corners */
export const RETROBOX = { left: 27, top: 518, width: 1026, height: 884, radius: 44, border: 0 };
const YELLOW = "#FFE14D";

/** line 1 (yellow, the provocative contrast) and line 2 (white, "80년대 ○○ 모습") over 10–25% of the height */
export const RetroTitle: React.FC<{ title: [string, string] }> = ({ title }) => {
  const size = (l: string, max: number) => Math.min(max, fitText({ text: l, withinWidth: 1000, fontFamily: TITLE }).fontSize);
  return (
    <div style={{ position: "absolute", top: 172, left: 0, width: 1080, height: 318, display: "flex", flexDirection: "column", justifyContent: "center",
      alignItems: "center", fontFamily: TITLE, lineHeight: 1.14, textAlign: "center", WebkitTextStroke: "10px #000", paintOrder: "stroke" }}>
      <div style={{ fontSize: size(title[0], 112), color: YELLOW }}>{title[0]}</div>
      <div style={{ fontSize: size(title[1], 100), color: "white" }}>{title[1]}</div>
    </div>
  );
};

/** a small yellow year tag in the box's top-left corner; it pops when the year changes */
export const RetroYear: React.FC<{ year: string; t: number; popIn: boolean }> = ({ year, t, popIn }) => {
  const s = popIn ? eBack(prog(t, 0, 0.3), 2) : 1;
  return (
    <div style={{ position: "absolute", left: RETROBOX.left + 26, top: RETROBOX.top + 24, padding: "6px 18px 8px", borderRadius: 14, background: YELLOW,
      color: "#111", fontFamily: TITLE, fontSize: 46, lineHeight: 1, transform: `scale(${s})`, transformOrigin: "left top", boxShadow: "0 4px 14px rgba(0,0,0,.45)" }}>
      {/^\d{4}$/.test(year) ? `${year}년` : year}
    </div>
  );
};

const StripPage: React.FC<{ page: CapPage; still: boolean }> = ({ page, still }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = still ? 1 : spring({ frame, fps, config: { damping: 200 }, durationInFrames: 5 });
  const text = page.tokens.map((t) => t.text).join(" ");
  const size = Math.min(70, fitText({ text, withinWidth: RETROBOX.width - 150, fontFamily: BODY, fontWeight: "900" }).fontSize);
  return (
    <div style={{ position: "absolute", left: RETROBOX.left, width: RETROBOX.width, top: RETROBOX.top + RETROBOX.height - 60 - size * 1.3,
      display: "flex", justifyContent: "center", opacity: enter, transform: `translateY(${interpolate(enter, [0, 1], [16, 0])}px)` }}>
      <div style={{ background: "rgba(0,0,0,.62)", borderRadius: 18, padding: `${size * 0.14}px ${size * 0.42}px ${size * 0.18}px`, fontFamily: BODY,
        fontWeight: 900, fontSize: size, lineHeight: 1.15, letterSpacing: -1, color: "white", whiteSpace: "nowrap" }}>
        {page.tokens.map((t, i) => (
          <span key={i} style={{ color: t.key || t.red ? YELLOW : "white" }}>{i ? " " : ""}{t.text}</span>
        ))}
      </div>
    </div>
  );
};

/** captions on a translucent strip at the bottom of the picture box; the first page is up from frame 0 (the thumbnail) */
export const StripCaptions: React.FC<{ pages: CapPage[] }> = ({ pages }) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {pages.map((p, i) => {
        const from = i === 0 ? 0 : Math.round((p.startMs / 1000) * fps);
        const dur = Math.round((p.endMs / 1000) * fps) - from;
        return dur > 0 ? (
          <Sequence key={i} from={from} durationInFrames={dur} layout="none">
            <StripPage page={p} still={i === 0} />
          </Sequence>
        ) : null;
      })}
    </>
  );
};
