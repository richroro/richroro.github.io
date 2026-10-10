// 정보 쇼츠 v2 (research/benchmark-footage.md §4): the pieces that make an info short look like the hits.
//   Cover      0–0.5 s thumbnail frame: the strongest picture full screen, a big two-line title (white + yellow), a red arrow
//   InfoCaps   captions in at most two lines, white with yellow as the only highlight (no green active word, {red} also yellow)
//   Tags       a small plain label in the picture's corner ("자료화면") where a truth note must stay on screen
// Each is switched on from edit.json ("cover", "capStyle": "info2", "tags"); shorts without them render as before.
import { fitText } from "@remotion/layout-utils";
import React from "react";
import { AbsoluteFill, Img, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { CapPage } from "./Captions";
import { BODY, TITLE } from "./fonts";

const YELLOW = "#FFE14D";
const RED = "#FF2A2A";

export type Cover = {
  /** a still: a photo, or a frame prep.py grabbed from a video source */
  file: string;
  title: [string, string];
  /** seconds on screen from frame 0 (default 0.5) */
  dur?: number;
  /** CSS object-position of the picture, and a zoom over a plain cover fit */
  focus?: string;
  zoom?: number;
  /** a red arrow pointing at (x, y) in the 1080x1920 frame, coming in from rot degrees (0 = from the left), len px long */
  arrow?: { x: number; y: number; rot?: number; len?: number };
  /** a red ring around (x, y) */
  ring?: { x: number; y: number; r?: number };
  /** where the title block sits: "top" (default, over a dark top fade) or "bottom" */
  at?: "top" | "bottom";
};
export type Tag = { text: string; from: number; to: number; y?: number };

/** the title's [marked] words are yellow; without marks line 2 is the yellow one */
const TitleLine: React.FC<{ text: string; yellow: boolean }> = ({ text, yellow }) => {
  const plain = text.replace(/[[\]]/g, "");
  const size = Math.min(170, fitText({ text: plain, withinWidth: 1010, fontFamily: TITLE }).fontSize);
  return (
    <div style={{ fontSize: size, color: yellow ? YELLOW : "white", whiteSpace: "nowrap" }}>
      {text.split(/(\[[^\]]*\])/).map((p, i) => (p.startsWith("[") ? <span key={i} style={{ color: YELLOW }}>{p.slice(1, -1)}</span> : <React.Fragment key={i}>{p}</React.Fragment>))}
    </div>
  );
};

const Arrow: React.FC<{ x: number; y: number; rot?: number; len?: number }> = ({ x, y, rot = 35, len = 230 }) => (
  <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0, transform: `rotate(${rot}deg)` }}>
    <svg width={len + 20} height={140} viewBox={`0 0 ${len + 20} 140`} style={{ position: "absolute", left: -(len + 10), top: -70, overflow: "visible", filter: "drop-shadow(0 6px 10px rgba(0,0,0,.65))" }}>
      <line x1={10} y1={70} x2={len - 60} y2={70} stroke="white" strokeWidth={46} strokeLinecap="round" />
      <polygon points={`${len + 16},70 ${len - 84},4 ${len - 84},136`} fill="white" strokeLinejoin="round" stroke="white" strokeWidth={10} />
      <line x1={10} y1={70} x2={len - 60} y2={70} stroke={RED} strokeWidth={30} strokeLinecap="round" />
      <polygon points={`${len + 4},70 ${len - 76},16 ${len - 76},124`} fill={RED} />
    </svg>
  </div>
);

/** the thumbnail frame that opens the short; it covers everything (title band, captions) until it cuts to the episode */
export const CoverView: React.FC<{ c: Cover; t: number }> = ({ c, t }) => {
  if (t >= (c.dur ?? 0.5)) return null;
  const top = (c.at ?? "top") === "top";
  const marked = c.title.some((l) => l.includes("["));
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ transform: `scale(${(c.zoom ?? 1) * (1 + 0.02 * t)})` }}>
        <Img src={staticFile(c.file)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: c.focus ?? "50% 50%" }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: top ? "linear-gradient(to bottom, rgba(0,0,0,.82) 0%, rgba(0,0,0,.55) 30%, rgba(0,0,0,0) 48%)"
        : "linear-gradient(to top, rgba(0,0,0,.85) 0%, rgba(0,0,0,.55) 30%, rgba(0,0,0,0) 48%)" }} />
      {c.ring ? (
        <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0, filter: "drop-shadow(0 5px 10px rgba(0,0,0,.6))" }}>
          <ellipse cx={c.ring.x} cy={c.ring.y} rx={(c.ring.r ?? 140) * 1.15} ry={c.ring.r ?? 140} fill="none" stroke={RED} strokeWidth={16} />
        </svg>
      ) : null}
      {c.arrow ? <Arrow {...c.arrow} /> : null}
      <div style={{ position: "absolute", left: 0, width: 1080, ...(top ? { top: 150 } : { bottom: 170 }), display: "flex", flexDirection: "column", alignItems: "center",
        fontFamily: TITLE, lineHeight: 1.08, WebkitTextStroke: "22px black", paintOrder: "stroke", filter: "drop-shadow(0 8px 14px rgba(0,0,0,.7))" }}>
        {c.title.map((l, i) => <TitleLine key={i} text={l} yellow={!marked && i === 1} />)}
      </div>
    </AbsoluteFill>
  );
};

/** split a page's words into one line, or two lines of about equal length */
const lines = (tokens: CapPage["tokens"], one: boolean) => {
  if (one || tokens.length < 2) return [tokens];
  const len = (ts: CapPage["tokens"]) => ts.reduce((n, t) => n + t.text.length, 0) + ts.length - 1;
  let best = 1, bestD = 1e9;
  for (let k = 1; k < tokens.length; k++) {
    const d = Math.abs(len(tokens.slice(0, k)) - len(tokens.slice(k)));
    if (d < bestD) { best = k; bestD = d; }
  }
  return [tokens.slice(0, best), tokens.slice(best)];
};

const InfoPage: React.FC<{ page: CapPage; centerY: number }> = ({ page, centerY }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 4 });
  const text = page.tokens.map((t) => t.text).join(" ");
  const fitOne = fitText({ text, withinWidth: 960, fontFamily: BODY, fontWeight: "900" }).fontSize;
  const one = fitOne >= 84 || page.tokens.length < 2;
  const rows = lines(page.tokens, one);
  const size = Math.min(98, one ? fitOne : Math.min(...rows.map((r) => fitText({ text: r.map((t) => t.text).join(" "), withinWidth: 960, fontFamily: BODY, fontWeight: "900" }).fontSize)));
  return (
    <AbsoluteFill style={{ top: centerY - 150, height: 300, justifyContent: "center", alignItems: "center" }}>
      <div style={{ fontFamily: BODY, fontWeight: 900, fontSize: size, lineHeight: 1.16, letterSpacing: -1, color: "white", textAlign: "center",
        WebkitTextStroke: "16px black", paintOrder: "stroke", filter: "drop-shadow(0 6px 12px rgba(0,0,0,.6))",
        transform: `scale(${0.88 + 0.12 * enter}) translateY(${(1 - enter) * 24}px)` }}>
        {rows.map((r, i) => (
          <div key={i} style={{ whiteSpace: "nowrap" }}>
            {r.map((t, j) => <span key={j} style={{ color: t.key || t.red ? YELLOW : "white" }}>{(j ? " " : "") + t.text}</span>)}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const InfoCaps: React.FC<{ pages: CapPage[]; centerY: number }> = ({ pages, centerY }) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {pages.map((p, i) => {
        const from = Math.round((p.startMs / 1000) * fps), dur = Math.round((p.endMs / 1000) * fps) - from;
        return dur > 0 ? <Sequence key={i} from={from} durationInFrames={dur} layout="none"><InfoPage page={p} centerY={centerY} /></Sequence> : null;
      })}
    </>
  );
};

export const Tags: React.FC<{ tags: Tag[]; t: number }> = ({ tags, t }) => (
  <>
    {tags.filter((g) => t >= g.from && t < g.to).map((g, i) => (
      <div key={i} style={{ position: "absolute", left: 28, top: g.y ?? 424, fontFamily: BODY, fontWeight: 800, fontSize: 30, color: "rgba(255,255,255,.92)",
        background: "rgba(0,0,0,.42)", borderRadius: 10, padding: "4px 12px", textShadow: "0 2px 4px rgba(0,0,0,.6)" }}>{g.text}</div>
    ))}
  </>
);
