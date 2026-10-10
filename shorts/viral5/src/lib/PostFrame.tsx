// "Post frame" story shorts (캐릭터 썰 v2): the whole video is one bright community-app screen, like the 썰 hits
// (research/benchmark-drawn.md §4): an app header, the post's title bar with meta and a like button, the sentence being
// spoken now as the post's body (bold black, 1-4 lines), and a square illustration slot (~83% of the width) where the
// short's drawn scenes (lib/Sseol.tsx "scene" clips) play. No real service's name, logo or look; no counts.
// Picked per short with "postFrame" in edit.json (prep.py writes the body timeline); every other short is untouched.
import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { fitText } from "@remotion/layout-utils";
import { BODY, loadFonts } from "./fonts";
import { clamp, eOut, prog } from "./fx";
import { GfxView } from "./Gfx";
import { Marked } from "./Marked";
import { Mochi } from "./Sseol";
import type { Clip, ShortData } from "../ClipShort";

loadFonts();
const FPS = 30;
const fr = (s: number) => Math.round(s * FPS);

/** edit.json "postFrame": app name and colour, the post's meta line; `body` (from prep.py) is the sentence on screen when */
export type PostFrameData = {
  app?: string; color?: string; meta?: string;
  body: { from: number; text: string }[];
};

const INK = "#16171b";
const L = { head: 150, titleTop: 150, bodyTop: 384, bodyH: 340, slot: 900, slotTop: 742 };

const Header: React.FC<{ p: PostFrameData }> = ({ p }) => (
  <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: L.head, background: p.color ?? "#FF8A4C", display: "flex", alignItems: "center",
    justifyContent: "center", fontFamily: BODY, fontWeight: 900, color: "white" }}>
    <div style={{ position: "absolute", left: 40, top: 34, fontSize: 76, lineHeight: 1 }}>‹</div>
    <div style={{ fontSize: 56, letterSpacing: 1, marginTop: 6 }}>{p.app ?? "썰방"}</div>
    <div style={{ position: "absolute", right: 34, top: 28, width: 96, height: 96, borderRadius: 48, background: "rgba(255,255,255,.95)", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 10, top: 14 }}><Mochi c={{ color: "#FFD84D" }} i={0} t={0.5} size={76} mood="happy" /></div>
    </div>
  </div>
);

const TitleBar: React.FC<{ title: string; meta: string }> = ({ title, meta }) => {
  const size = Math.max(52, Math.min(70, fitText({ text: title.replace(/[[\]{}]/g, ""), withinWidth: 820, fontFamily: BODY, fontWeight: "900" }).fontSize));
  return (
    <div style={{ position: "absolute", left: 0, top: L.titleTop, width: 1080, height: L.bodyTop - L.titleTop - 18, background: "white", borderBottom: "3px solid #e6e8ee",
      boxSizing: "border-box", padding: "30px 44px 0" }}>
      <div style={{ fontFamily: BODY, fontWeight: 900, fontSize: size, lineHeight: 1.2, color: INK, width: 830, wordBreak: "keep-all" }}><Marked text={title} color="#E8212E" /></div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 18, fontFamily: BODY, fontWeight: 700, fontSize: 32, color: "#9aa0aa" }}>
        <div style={{ width: 46, height: 46, borderRadius: 23, background: "#e3e6ec", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>👤</div>
        <span>{meta}</span>
      </div>
      {/* the like button: an outline heart, no count */}
      <div style={{ position: "absolute", right: 40, top: 34, width: 120, height: 120, borderRadius: 26, border: "4px solid #ffd0d6", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", fontFamily: BODY, fontWeight: 800, fontSize: 26, color: "#ff5a6e" }}>
        <svg width={54} height={50} viewBox="-30 -28 60 52"><path d="M0 20 C-34 -2 -20 -32 0 -14 C20 -32 34 -2 0 20 Z" fill="none" stroke="#ff5a6e" strokeWidth={6} strokeLinejoin="round" /></svg>
        <span style={{ marginTop: 2 }}>공감</span>
      </div>
    </div>
  );
};

/** the sentence on screen: bold black, centred, one line per "/" page of the line's caption */
const Body: React.FC<{ p: PostFrameData; t: number }> = ({ p, t }) => {
  let k = -1;
  for (let i = 0; i < p.body.length; i++) if (t >= p.body[i].from) k = i;
  if (k < 0) k = 0;
  const b = p.body[k];
  if (!b) return null;
  const lines = b.text.split("\n").filter((x) => x.trim());
  const fs = Math.min(76, ...lines.map((x) => fitText({ text: x.replace(/[[\]{}]/g, ""), withinWidth: 960, fontFamily: BODY, fontWeight: "900" }).fontSize),
    lines.length > 3 ? 64 : 76);
  const a = k === 0 && b.from <= 0.05 ? 1 : eOut(prog(t, b.from, 0.14));
  return (
    <div style={{ position: "absolute", left: 40, top: L.bodyTop, width: 1000, height: L.bodyH, display: "flex", flexDirection: "column", justifyContent: "center",
      alignItems: "center", textAlign: "center", fontFamily: BODY, fontWeight: 900, fontSize: fs, lineHeight: 1.28, color: INK,
      opacity: clamp(0.2 + a), transform: `translateY(${10 * (1 - a)}px) scale(${0.97 + 0.03 * a})` }}>
      {lines.map((x, i) => <div key={i} style={{ whiteSpace: "nowrap" }}><Marked text={x} color="#E8212E" /></div>)}
    </div>
  );
};

/** a scene inside the square slot: drawn at 1080x1080 like any scene clip, scaled into the slot */
const SlotClip: React.FC<{ c: Clip }> = ({ c }) => {
  const f = useCurrentFrame();
  return c.gfx ? (
    <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: 1080, transform: `scale(${L.slot / 1080})`, transformOrigin: "0 0" }}>
      <GfxView g={c.gfx} t={f / FPS} h={1080} />
    </div>
  ) : null;
};

/** faint app-name pattern on the page background */
const Watermark: React.FC<{ text: string }> = ({ text }) => (
  <AbsoluteFill style={{ overflow: "hidden" }}>
    {Array.from({ length: 13 }, (_, r) => (
      <div key={r} style={{ position: "absolute", left: r % 2 ? -120 : -40, top: 140 + r * 140, whiteSpace: "nowrap", fontFamily: BODY, fontWeight: 900, fontSize: 44,
        color: "rgba(30,40,60,.045)", transform: "rotate(-12deg)", letterSpacing: 6 }}>
        {Array.from({ length: 8 }, () => text).join("     ")}
      </div>
    ))}
  </AbsoluteFill>
);

export const PostFrameShort: React.FC<{ data: ShortData }> = ({ data }) => {
  const d = data as ShortData & { postFrame: PostFrameData };
  const p = d.postFrame;
  const t = useCurrentFrame() / FPS;
  const { durationInFrames: total } = useVideoConfig();
  const until = (c: Clip) => (fr(c.at + c.dur) >= total - 1 ? total : fr(c.at + c.dur));
  const musicVol = (f: number) => {
    if (!d.music) return 0;
    const tt = f / FPS;
    return d.music.gain * (1 - 0.6 * (d.env[f] ?? 0)) * prog(tt, 0, 0.1) * (1 - prog(tt, d.end - 1.0, 1.0));
  };
  const title = d.title.filter(Boolean).join(" ");
  return (
    <AbsoluteFill style={{ background: "#f3f4f7" }}>
      <Watermark text={p.app ?? "썰방"} />
      <Header p={p} />
      <TitleBar title={title} meta={p.meta ?? "익명 | 창작 사연게시판"} />
      <Body p={p} t={t} />
      <div style={{ position: "absolute", left: (1080 - L.slot) / 2, top: L.slotTop, width: L.slot, height: L.slot, borderRadius: 34, overflow: "hidden",
        background: "#fff", boxShadow: "0 10px 30px rgba(20,30,50,.16)", border: "5px solid white" }}>
        {d.clips.map((c, i) => (
          <Sequence key={i} from={fr(c.at)} durationInFrames={Math.max(1, until(c) - fr(c.at))}>
            <SlotClip c={c} />
          </Sequence>
        ))}
      </div>
      <div style={{ position: "absolute", left: 90, top: L.slotTop + L.slot + 26, width: 900, display: "flex", justifyContent: "space-around", fontFamily: BODY, fontWeight: 800,
        fontSize: 34, color: "#8c929c" }}>
        <span>♡ 공감</span><span>💬 댓글</span><span>↗ 공유</span>
      </div>

      {d.lines.map((l) => (
        <Sequence key={l.id} from={fr(l.start)} layout="none"><Audio src={staticFile(`${d.id}/voice/${l.id}.wav`)} /></Sequence>
      ))}
      {d.music && <Audio src={staticFile(d.music.file)} volume={musicVol} trimBefore={fr(d.music.start)} />}
      {d.sfx.map((s, i) => (
        <Sequence key={i} from={fr(s.t)} layout="none"><Audio src={staticFile(`sfx/${s.name}.wav`)} volume={s.gain * 0.7} /></Sequence>
      ))}
    </AbsoluteFill>
  );
};
