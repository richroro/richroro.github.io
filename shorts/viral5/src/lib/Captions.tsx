// TikTok-style word captions, adapted from remotion-dev/template-tiktok (CaptionedVideo/Page.tsx):
// same spring entrance and active-word highlight, set in a Korean font, with script keywords in yellow.
import { makeTransform, scale, translateY } from "@remotion/animation-utils";
import { fitText } from "@remotion/layout-utils";
import React from "react";
import { AbsoluteFill, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BODY } from "./fonts";

export type Token = { text: string; key: boolean; fromMs: number; toMs: number };
export type CapPage = { startMs: number; endMs: number; tokens: Token[] };

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

const Page: React.FC<{ page: CapPage; centerY: number }> = ({ page, centerY }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const timeMs = page.startMs + (frame / fps) * 1000;
  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 5 });
  const text = page.tokens.map((t) => t.text).join("  ");
  const { fontSize } = fitText({ text, withinWidth: width * 0.86, fontFamily: BODY, fontWeight: "900" });

  return (
    <AbsoluteFill style={{ top: centerY - 110, height: 220, justifyContent: "center", alignItems: "center" }}>
      <div
        style={{
          fontFamily: BODY,
          fontWeight: 900,
          fontSize: Math.min(DESIRED_FONT_SIZE, fontSize),
          lineHeight: 1.15,
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
        {page.tokens.map((t, i) => {
          const active = t.fromMs <= timeMs && t.toMs > timeMs;
          const pop = active ? Math.sin(Math.PI * Math.min(1, (timeMs - t.fromMs) / 180)) : 0;
          return <Word key={i} token={t} active={active} pop={pop} />;
        })}
      </div>
    </AbsoluteFill>
  );
};

export const Captions: React.FC<{ pages: CapPage[]; centerY?: number }> = ({ pages, centerY = 1370 }) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {pages.map((p, i) => {
        const from = Math.round((p.startMs / 1000) * fps);
        const dur = Math.round((p.endMs / 1000) * fps) - from;
        return dur > 0 ? (
          <Sequence key={i} from={from} durationInFrames={dur} layout="none">
            <Page page={p} centerY={centerY} />
          </Sequence>
        ) : null;
      })}
    </>
  );
};
