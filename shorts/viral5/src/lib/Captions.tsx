// TikTok-style word captions, adapted from remotion-dev/template-tiktok (CaptionedVideo/Page.tsx):
// same spring entrance and active-word highlight, set in a Korean font, with script keywords in yellow.
import { makeTransform, scale, translateY } from "@remotion/animation-utils";
import { fitText } from "@remotion/layout-utils";
import React from "react";
import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BODY } from "./fonts";

export type Token = { text: string; key: boolean; fromMs: number; toMs: number };
export type CapPage = { startMs: number; endMs: number; tokens: Token[]; en?: string; who?: string };

const DESIRED_FONT_SIZE = 100;
const HIGHLIGHT_COLOR = "#39E508"; // the template's highlight
const KEY_COLOR = "#FFE14D";
const EMOJI = /(\p{Extended_Pictographic}(?:\u{FE0F}|\u{200D}\p{Extended_Pictographic})*)/u;

const Word: React.FC<{ token: Token; active: boolean; pop: number }> = ({ token, active, pop }) => (
  <span
    style={{
      display: "inline-block",
      whiteSpace: "pre",
      color: active ? HIGHLIGHT_COLOR : token.key ? KEY_COLOR : "white",
      transform: `scale(${1 + 0.12 * pop}) translateY(${-10 * pop}px)`,
      margin: "0 0.12em",
    }}
  >
    {token.text.split(EMOJI).map((part, i) =>
      EMOJI.test(part) ? (
        <span key={i} style={{ WebkitTextStroke: 0, display: "inline-block", transform: "translateY(-4px)" }}>{part}</span>
      ) : (
        <React.Fragment key={i}>{part}</React.Fragment>
      ),
    )}
  </span>
);

/** an English line; [bracketed] words are the key phrase, set in yellow */
const En: React.FC<{ text: string }> = ({ text }) => (
  <>
    {text.split(/(\[[^\]]*\])/).map((part, i) =>
      part.startsWith("[") ? <span key={i} style={{ color: KEY_COLOR }}>{part.slice(1, -1)}</span> : <React.Fragment key={i}>{part}</React.Fragment>,
    )}
  </>
);

const Page: React.FC<{ page: CapPage; centerY: number; enFirst: boolean }> = ({ page, centerY, enFirst }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const timeMs = page.startMs + (frame / fps) * 1000;
  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 5 });
  const text = page.tokens.map((t) => t.text).join("  ");
  const { fontSize } = fitText({ text, withinWidth: width * 0.86, fontFamily: BODY, fontWeight: "900" });
  // line pages (translations, written captions): a long line wraps onto two lines at a readable size instead of
  // shrinking to fit one; without an English line under it the text can be bigger
  const tr = page.en !== undefined;
  // subtitle-study layout (enFirst): the spoken English leads, the Korean translation sits under it, smaller and calm
  const enTop = enFirst && !!page.en;
  const enText = (page.en ?? "").replace(/[[\]]/g, "");
  const size = enTop ? (fontSize >= 46 ? Math.min(58, fontSize) : 46)
    : !tr ? Math.min(DESIRED_FONT_SIZE, fontSize) : page.en ? (fontSize >= 60 ? Math.min(84, fontSize) : 64) : fontSize >= 72 ? Math.min(96, fontSize) : 72;
  const enFit = page.en ? fitText({ text: enText, withinWidth: width * 0.9, fontFamily: BODY, fontWeight: enTop ? "800" : "700" }).fontSize : 0;
  const enSize = enTop ? (enFit >= 56 ? Math.min(72, enFit) : 56) : enFit >= 30 ? Math.min(38, enFit) : 30;
  const enLine = (
    <div style={enTop ? { fontSize: enSize, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1.18, marginBottom: 14, color: "white", WebkitTextStroke: "12px black" }
      : { fontSize: enSize, fontWeight: 700, letterSpacing: 0, lineHeight: 1.2, marginTop: 10, color: "rgba(255,255,255,.88)", WebkitTextStroke: "7px black" }}>
      <En text={page.en ?? ""} />
    </div>
  );

  return (
    <AbsoluteFill style={{ top: centerY - 110, height: 220, justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          fontFamily: BODY,
          fontWeight: 900,
          fontSize: size,
          lineHeight: 1.15,
          maxWidth: width * 0.92,
          letterSpacing: -1,
          color: "white",
          WebkitTextStroke: "18px black",
          paintOrder: "stroke",
          textAlign: "center",
          filter: "drop-shadow(0 8px 14px rgba(0,0,0,.55))",
          transform: makeTransform([
            scale(interpolate(enter, [0, 1], [0.8, 1])),
            translateY(interpolate(enter, [0, 1], [50, 0])),
          ]),
        }}
      >
        {page.who ? (
          // whose voice this is, when the camera is on the other person
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: 0, lineHeight: 1.25, padding: "3px 16px", borderRadius: 10, background: "rgba(0,0,0,.78)", color: KEY_COLOR, WebkitTextStroke: 0 }}>
              🎙 {page.who}
            </div>
          </div>
        ) : null}
        {enTop ? enLine : null}
        <div style={enTop ? { WebkitTextStroke: "12px black" } : undefined}>
          {page.tokens.map((t, i) => {
            const active = !enTop && t.fromMs <= timeMs && t.toMs > timeMs;
            const pop = active ? Math.sin(Math.PI * Math.min(1, (timeMs - t.fromMs) / 180)) : 0;
            return <Word key={i} token={t} active={active} pop={pop} />;
          })}
        </div>
        {page.en && !enTop ? enLine : null}
      </div>
    </AbsoluteFill>
  );
};

export const Captions: React.FC<{ pages: CapPage[]; centerY?: number; order?: "ko-en" | "en-ko" }> = ({ pages, centerY = 1370, order = "ko-en" }) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {pages.map((p, i) => {
        const from = Math.round((p.startMs / 1000) * fps);
        const dur = Math.round((p.endMs / 1000) * fps) - from;
        return dur > 0 ? (
          <Sequence key={i} from={from} durationInFrames={dur} layout="none">
            <Page page={p} centerY={centerY} enFirst={order === "en-ko"} />
          </Sequence>
        ) : null;
      })}
    </>
  );
};
