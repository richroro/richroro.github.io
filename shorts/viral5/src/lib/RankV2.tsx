// "역대급 ○○ 랭킹 TOP5" v2, the layout of the hit ranking shorts (research/benchmark-footage.md §3):
// - a 3-line band: a coloured "역대급 ○○" line, a big white "랭킹 TOP5", and a small comment-bait line "(1번 제목 추천좀)"
// - the picture fills everything under the band (frame "tall"), with no empty bottom
// - the rank list sits over the picture's left edge: numbers in steps of colour (1 red, 2 orange, 3 yellow, 4–5 white),
//   a place's name appears when its clip starts, the place playing now is lit, and the hidden places (1위 by default)
//   read "???" to the very end, so the comments fill in the name
// - captions are white type in a black box low over the picture; the first one is already up at 0 s (no entrance)
// Used by ClipShort when the short's data has "rank2" (edit.json: "rank2": {"sub": "(1번 제목 추천좀)", "color": "#FF5FA2"}).
import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { fitText } from "@remotion/layout-utils";
import type { CapPage } from "./Captions";
import { BODY, TITLE } from "./fonts";
import { eBack, eOut, prog } from "./fx";

export type Rank2 = {
  /** the band's third line, small (e.g. "(1번 제목 추천좀)") */
  sub: string;
  /** the band's first line colour (default pink, like the hit) */
  color?: string;
  /** places whose names stay "???" to the end (default [1]) */
  hide?: number[];
  /** the list's top edge (default 452) */
  y?: number;
};
type Rows = { rows: { n: number; label: string; from: number }[] };

/** where the picture goes: everything under the 420 px band */
export const TALL = { top: 420, height: 1500 };
export const RANK_COLORS: Record<number, string> = { 1: "#FF3B3B", 2: "#FF9A1F", 3: "#FFE14D" };
const STROKE = (w: number): React.CSSProperties => ({ WebkitTextStroke: `${w}px black`, paintOrder: "stroke" });

export const RankBand: React.FC<{ title: [string, string]; r: Rank2 }> = ({ title, r }) => {
  const fit = (text: string, max: number) => Math.min(max, fitText({ text, withinWidth: 1000, fontFamily: TITLE }).fontSize);
  return (
    <div style={{ position: "absolute", top: 0, left: 0, width: 1080, height: TALL.top, background: "#000", display: "flex", flexDirection: "column",
      justifyContent: "flex-end", alignItems: "center", paddingBottom: 22, fontFamily: TITLE, lineHeight: 1.08 }}>
      <div style={{ fontSize: fit(title[0], 86), color: r.color ?? "#FF5FA2" }}>{title[0]}</div>
      <div style={{ fontSize: fit(title[1], 150), color: "white", marginTop: 2 }}>{title[1]}</div>
      <div style={{ fontFamily: BODY, fontWeight: 800, fontSize: Math.min(46, fitText({ text: r.sub, withinWidth: 980, fontFamily: BODY, fontWeight: "800" }).fontSize),
        color: "rgba(255,255,255,.92)", marginTop: 8 }}>{r.sub}</div>
    </div>
  );
};

/** the list over the picture's left edge, 1 at the top */
export const RankList: React.FC<{ ranks: Rows; r: Rank2; t: number }> = ({ ranks, r, t }) => {
  const hide = r.hide ?? [1];
  const rows = [...ranks.rows].sort((a, b) => a.n - b.n);
  const cur = ranks.rows.filter((x) => t >= x.from).sort((a, b) => b.from - a.from)[0];
  const top = r.y ?? 452, h = 82;
  return (
    <div style={{ position: "absolute", left: 22, top, fontFamily: TITLE }}>
      {rows.map((x, i) => {
        const on = cur?.n === x.n, shown = t >= x.from && !hide.includes(x.n);
        const p = t >= x.from ? prog(t, x.from, 0.35) : 0;
        const k = on && x.from > 0 ? 1 + 0.18 * (1 - eOut(p)) : 1;  // the row pops when its place starts (not on the 0 s thumbnail)
        const color = RANK_COLORS[x.n] ?? "white";
        return (
          <div key={x.n} style={{ position: "absolute", top: i * h, left: 0, height: h - 8, display: "flex", alignItems: "center", whiteSpace: "nowrap",
            padding: "0 16px 0 8px", borderRadius: 14, background: on ? "rgba(0,0,0,.66)" : "rgba(0,0,0,0)", border: `5px solid ${on ? color : "rgba(0,0,0,0)"}`,
            transform: `scale(${k})`, transformOrigin: "left center" }}>
            <span style={{ fontSize: 62, color, ...STROKE(9), minWidth: 64, textAlign: "center" }}>{x.n}.</span>
            <span style={{ fontSize: 56, marginLeft: 8, color: shown ? "white" : "rgba(255,255,255,.88)", ...STROKE(9) }}>
              {shown ? x.label : "???"}
            </span>
          </div>
        );
      })}
    </div>
  );
};

const BoxPage: React.FC<{ page: CapPage; centerY: number }> = ({ page, centerY }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const text = page.tokens.map((t) => t.text).join(" ");
  const size = Math.min(76, fitText({ text, withinWidth: 900, fontFamily: BODY, fontWeight: "900" }).fontSize);
  // a quick pop for every page but the one that is already up at 0 s (that frame is the thumbnail)
  const p = page.startMs === 0 ? 1 : eBack(Math.min(1, frame / (0.18 * fps)), 1.6);
  return (
    <AbsoluteFill style={{ top: centerY - 80, height: 160, justifyContent: "center", alignItems: "center" }}>
      <div style={{ fontFamily: BODY, fontWeight: 900, fontSize: size, color: "white", background: "rgba(0,0,0,.86)", borderRadius: 14,
        padding: "12px 30px 14px", lineHeight: 1.2, letterSpacing: -1, textAlign: "center", maxWidth: 980, transform: `scale(${0.85 + 0.15 * p})` }}>
        {page.tokens.map((t, i) => (
          <span key={i} style={{ color: t.key ? "#FFE14D" : "white" }}>{(i ? " " : "") + t.text}</span>
        ))}
      </div>
    </AbsoluteFill>
  );
};

export const BoxCaptions: React.FC<{ pages: CapPage[]; centerY: number }> = ({ pages, centerY }) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {pages.map((p, i) => {
        const from = Math.round((p.startMs / 1000) * fps), dur = Math.round((p.endMs / 1000) * fps) - from;
        return dur > 0 ? (
          <Sequence key={i} from={from} durationInFrames={dur} layout="none">
            <BoxPage page={p} centerY={centerY} />
          </Sequence>
        ) : null;
      })}
    </>
  );
};
