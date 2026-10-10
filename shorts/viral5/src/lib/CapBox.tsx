// Captions in a box over the bottom of the picture (낙서 짤툰 v2, research/benchmark-drawn.md §1): white bold type on a
// dark navy box, a sentence on one or two lines, the [key] and {red} words both in one accent colour, the spoken word
// popping without changing colour. Picked with "capBox": {...} in edit.json; shorts without it keep lib/Captions.tsx.
// Also the "tall" frame: the picture box runs from under the title band to the bottom edge, so no empty strip is left.
import { fitText } from "@remotion/layout-utils";
import React from "react";
import { Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BODY } from "./fonts";
import type { CapPage } from "./Captions";

export type CapBoxOpts = { y?: number; accent?: string; bg?: string; width?: number };
export const TALL = { top: 400, height: 1520 };

const Page: React.FC<{ page: CapPage; o: CapBoxOpts }> = ({ page, o }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const timeMs = page.startMs + (frame / fps) * 1000;
  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 5 });
  const W = o.width ?? 940, inner = W - 80;
  const text = page.tokens.map((t) => t.text).join(" ");
  const fit = (s: string) => fitText({ text: s, withinWidth: inner, fontFamily: BODY, fontWeight: "900" }).fontSize;
  const one = fit(text);
  // a short line stays on one big line; a longer one breaks into two lines of about equal length (no lone word below)
  const toks = page.tokens, len = (a: typeof toks) => a.reduce((n, t) => n + t.text.length, 0);
  let cut = toks.length;
  if (one < 78 && toks.length > 1) {
    let best = 1e9;
    for (let k = 1; k < toks.length; k++) { const d = Math.abs(len(toks.slice(0, k)) - len(toks.slice(k))); if (d < best) { best = d; cut = k; } }
  }
  const rows = cut < toks.length ? [toks.slice(0, cut), toks.slice(cut)] : [toks];
  const size = rows.length === 1 ? Math.min(92, one) : Math.max(58, Math.min(84, ...rows.map((r) => fit(r.map((t) => t.text).join(" ")))));
  const accent = o.accent ?? "#FFE14D";
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: (o.y ?? 1580) - 150, height: 300, display: "flex", justifyContent: "center", alignItems: "center" }}>
      <div style={{ maxWidth: W, padding: "14px 40px 18px", borderRadius: 26, background: o.bg ?? "rgba(16,20,52,.9)", boxShadow: "0 10px 26px rgba(0,0,0,.35)",
        fontFamily: BODY, fontWeight: 900, fontSize: size, lineHeight: 1.18, letterSpacing: -1, color: "white", textAlign: "center", wordBreak: "keep-all",
        transform: `translateY(${24 * (1 - enter)}px) scale(${0.92 + 0.08 * enter})`, opacity: Math.min(1, enter * 1.5) }}>
        {rows.map((row, r) => (
          <div key={r} style={{ whiteSpace: "nowrap" }}>
            {row.map((t, i) => {
              const active = t.fromMs <= timeMs && t.toMs > timeMs;
              const pop = active ? Math.sin(Math.PI * Math.min(1, (timeMs - t.fromMs) / 180)) : 0;
              return (
                <span key={i} style={{ display: "inline-block", whiteSpace: "pre", margin: "0 0.13em", color: t.key || t.red ? accent : "white",
                  transform: `scale(${1 + 0.08 * pop}) translateY(${-6 * pop}px)` }}>{t.text}</span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export const CapBox: React.FC<{ pages: CapPage[]; o: CapBoxOpts }> = ({ pages, o }) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {pages.map((p, i) => {
        const from = Math.round((p.startMs / 1000) * fps), dur = Math.round((p.endMs / 1000) * fps) - from;
        return dur > 0 ? <Sequence key={i} from={from} durationInFrames={dur} layout="none"><Page page={p} o={o} /></Sequence> : null;
      })}
    </>
  );
};
