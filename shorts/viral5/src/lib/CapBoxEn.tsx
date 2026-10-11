// Translated captions in a black box under the speaker (유명인 명장면 star4~, the Korean "clip story" look):
// the Korean line big and white in a dark box, its [key] words yellow, and the English original small under it.
// Picked with "capBoxEn": {...} in edit.json (politics/prep_split.py passes it through); other shorts keep their captions.
import { fitText } from "@remotion/layout-utils";
import React from "react";
import { Sequence, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BODY } from "./fonts";
import type { CapPage } from "./Captions";

export type CapBoxEnOpts = { y?: number; width?: number; accent?: string };

const En: React.FC<{ text: string; accent: string }> = ({ text, accent }) => (
  <>{text.split(/(\[[^\]]*\])/).map((p, i) => p.startsWith("[") ? <span key={i} style={{ color: accent }}>{p.slice(1, -1)}</span> : <React.Fragment key={i}>{p}</React.Fragment>)}</>
);

const Page: React.FC<{ page: CapPage; o: CapBoxEnOpts }> = ({ page, o }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 5 });
  const W = o.width ?? 980, inner = W - 72, accent = o.accent ?? "#FFE14D";
  const toks = page.tokens, text = toks.map((t) => t.text).join(" ");
  const fit = (s: string) => fitText({ text: s, withinWidth: inner, fontFamily: BODY, fontWeight: "900" }).fontSize;
  const one = fit(text);
  // a short line stays on one line; a long one breaks into two of about equal length
  let cut = toks.length;
  if (one < 64 && toks.length > 1) {
    const len = (a: typeof toks) => a.reduce((n, t) => n + t.text.length, 0);
    let best = 1e9;
    for (let k = 1; k < toks.length; k++) { const d = Math.abs(len(toks.slice(0, k)) - len(toks.slice(k))); if (d < best) { best = d; cut = k; } }
  }
  const rows = cut < toks.length ? [toks.slice(0, cut), toks.slice(cut)] : [toks];
  const size = rows.length === 1 ? Math.min(70, one) : Math.max(48, Math.min(64, ...rows.map((r) => fit(r.map((t) => t.text).join(" ")))));
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: (o.y ?? 1560) - 200, height: 400, display: "flex", justifyContent: "center", alignItems: "center" }}>
      <div style={{ maxWidth: W, padding: "16px 36px 18px", borderRadius: 14, background: "rgba(0,0,0,.82)", fontFamily: BODY, textAlign: "center", wordBreak: "keep-all",
        transform: `translateY(${18 * (1 - enter)}px)`, opacity: Math.min(1, enter * 1.5) }}>
        {page.who ? <div style={{ fontWeight: 800, fontSize: 28, color: accent, marginBottom: 4 }}>{page.who}</div> : null}
        {rows.map((row, r) => (
          <div key={r} style={{ whiteSpace: "nowrap", fontWeight: 900, fontSize: size, lineHeight: 1.2, letterSpacing: -1, color: "white" }}>
            {row.map((t, i) => <span key={i} style={{ margin: "0 0.12em", color: t.key ? accent : "white" }}>{t.text}</span>)}
          </div>
        ))}
        {page.en ? <div style={{ marginTop: 8, fontWeight: 600, fontSize: 28, lineHeight: 1.25, color: "rgba(255,255,255,.72)" }}><En text={page.en} accent={accent} /></div> : null}
      </div>
    </div>
  );
};

export const CapBoxEn: React.FC<{ pages: CapPage[]; o: CapBoxEnOpts }> = ({ pages, o }) => {
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
