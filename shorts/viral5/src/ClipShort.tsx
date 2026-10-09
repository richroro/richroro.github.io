// One short = real footage cut to the narration. The source clips are public-domain or CC footage
// (see each short's edit.json); everything here is data-driven from src/data/<id>.json written by prep.py.
import React from "react";
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, getStaticFiles, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { fitText } from "@remotion/layout-utils";
import { Captions, CapPage } from "./lib/Captions";
import { BODY, TITLE, loadFonts } from "./lib/fonts";
import { Sticker, clamp, eOut, prog } from "./lib/fx";

loadFonts();
export const FPS = 30;
const fr = (s: number) => Math.round(s * FPS);

export type Clip = {
  file: string | null; label: string; at: number; dur: number; speed: number;
  frame: "square" | "wide" | "full" | "film"; zoom: [number, number]; focus: string; audio: number;
  /** face-centred crop: (cx, cy) in 0..1 of the source frame, zoom over a plain cover fit, source size */
  crop?: { cx: number; cy: number; zoom: number; w: number; h: number };
};
/** one person of a side-by-side two-shot: (cx, cy) is their face in 0..1 of the whole source frame, [x0, x1] their half */
export type Panel = { name: string; role: string; cx: number; cy: number; zoom: number; x0: number; x1: number };
export type ShortData = {
  id: string; end: number; title: [string, string]; credit: string;
  lines: { id: string; start: number; dur: number }[];
  pages: CapPage[]; env: number[]; clips: Clip[];
  moments: { from: number; to: number; gain: number }[];
  stickers: { text: string; from: number; to: number; x: number; y: number; rot: number; bg: string; fg: string; size?: number }[];
  sfx: { t: number; name: string; gain: number }[];
  music: { file: string; gain: number; start: number } | null;
  flashes: number[]; punches: number[];
  /** the clips' own audio is the speech (political clips): keep it at full level, duck only the music */
  origVoice?: boolean;
  /** a side-by-side two-shot (국회 영상회의록 layout) shown as two stacked panels: panels[0] on top, panels[1] below */
  split?: { w: number; h: number; panels: Panel[] };
  /** who is talking when (index into split.panels), for the speaker highlight */
  speakers?: { from: number; to: number; who: number }[];
  captionY?: number;
};

const FRAME = { square: { top: 400, height: 1080 }, wide: { top: 656, height: 608 }, full: { top: 0, height: 1920 },
  film: { top: 400, height: 810 } /* a whole 4:3 frame (silent films) */ };
const PANELS = [{ top: 400, height: 540 }, { top: 940, height: 540 }];
const have = (file: string | null) => !!file && getStaticFiles().some((f) => f.name === file);

const Placeholder: React.FC<{ label: string }> = ({ label }) => (
  <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 40%, #2b3566, #0b0e1d 75%)", justifyContent: "center", alignItems: "center" }}>
    <div style={{ fontFamily: BODY, fontWeight: 800, fontSize: 42, color: "rgba(255,255,255,.6)", border: "4px dashed rgba(255,255,255,.35)", borderRadius: 24, padding: "18px 30px", textAlign: "center", maxWidth: 900 }}>
      🎬 {label}
    </div>
  </AbsoluteFill>
);

/** a clip inside its Sequence: blurred fill behind, the framed footage in front, Ken Burns + punch-ins */
const ClipView: React.FC<{ c: Clip; d: ShortData }> = ({ c, d }) => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = c.at + f / FPS;
  const p = interpolate(f, [0, Math.max(1, durationInFrames - 1)], [0, 1], { extrapolateRight: "clamp" });
  let punch = 0;
  for (const pt of d.punches) if (t >= pt && t < pt + 0.35) punch = Math.max(punch, Math.sin(Math.PI * (t - pt) / 0.35));
  const s = (c.zoom[0] + (c.zoom[1] - c.zoom[0]) * p) * (1 + 0.07 * punch) * (1 + 0.1 * (1 - eOut(prog(f, 0, 6))));
  const box = FRAME[c.frame];
  const ok = have(c.file);
  const vol = (rf: number) => {
    const tt = c.at + rf / FPS;
    const m = d.moments.find((m) => tt >= m.from - 0.15 && tt <= m.to + 0.3);
    if (m) return m.gain * clamp(Math.min((tt - m.from + 0.15) / 0.15, (m.to + 0.3 - tt) / 0.3));
    return d.origVoice ? c.audio : c.audio * (1 - 0.75 * (d.env[fr(tt)] ?? 0));
  };
  // crop mode: place the frame so the face sits in the middle of the box, never showing an edge
  let cropStyle: React.CSSProperties | null = null;
  if (c.crop) {
    const { cx, cy, zoom, w, h } = c.crop;
    const S = Math.max(1080 / w, box.height / h) * zoom * s;
    const dw = w * S, dh = h * S;
    const left = Math.min(0, Math.max(1080 - dw, 540 - cx * dw)), top = Math.min(0, Math.max(box.height - dh, box.height / 2 - cy * dh));
    cropStyle = { position: "absolute", left, top, width: dw, height: dh };
  }
  if (d.split && ok && !c.crop) {
    const { w, h, panels } = d.split;
    const who = d.speakers?.find((sp) => t >= sp.from && t < sp.to)?.who;
    return (
      <AbsoluteFill>
        <OffthreadVideo src={staticFile(c.file!)} muted playbackRate={c.speed}
          style={{ position: "absolute", inset: -60, width: "calc(100% + 120px)", height: "calc(100% + 120px)", objectFit: "cover", filter: "blur(36px) brightness(.42) saturate(1.2)" }} />
        {panels.map((pn, k) => {
          const box = PANELS[k];
          const S = (1080 / ((pn.x1 - pn.x0) * w)) * pn.zoom * s, dw = w * S, dh = h * S;
          const left = Math.min(-pn.x0 * dw, Math.max(1080 - pn.x1 * dw, 540 - pn.cx * dw));
          const top = Math.min(0, Math.max(box.height - dh, box.height / 2 - pn.cy * dh));
          const on = who === k;
          return (
            <div key={k} style={{ position: "absolute", left: 0, top: box.top, width: 1080, height: box.height, overflow: "hidden" }}>
              <OffthreadVideo src={staticFile(c.file!)} playbackRate={c.speed} {...(k === 0 ? { volume: vol } : { muted: true })}
                style={{ position: "absolute", left, top, width: dw, height: dh }} />
              <div style={{ position: "absolute", left: 24, top: 22, fontFamily: BODY, fontWeight: 800, fontSize: 34, color: "#111",
                background: on ? "#FFE14D" : "rgba(255,255,255,.92)", borderRadius: 14, padding: "8px 18px", boxShadow: "0 4px 14px rgba(0,0,0,.35)" }}>
                {pn.name}{pn.role ? <span style={{ fontWeight: 600, fontSize: 26, marginLeft: 10, color: "#444" }}>{pn.role}</span> : null}
              </div>
              <div style={{ position: "absolute", inset: 0, border: `7px solid ${on ? "#FFE14D" : "rgba(0,0,0,0)"}`, boxSizing: "border-box" }} />
            </div>
          );
        })}
        <div style={{ position: "absolute", left: 0, top: PANELS[1].top - 3, width: 1080, height: 6, background: "#000" }} />
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill>
      {ok ? (
        <OffthreadVideo src={staticFile(c.file!)} muted playbackRate={c.speed}
          style={{ position: "absolute", inset: -60, width: "calc(100% + 120px)", height: "calc(100% + 120px)", objectFit: "cover", filter: "blur(36px) brightness(.42) saturate(1.2)" }} />
      ) : <AbsoluteFill style={{ background: "#05060b" }} />}
      <div style={{ position: "absolute", left: 0, top: box.top, width: 1080, height: box.height, overflow: "hidden", boxShadow: "0 0 80px rgba(0,0,0,.6)" }}>
        {d.split && c.label ? (
          <div style={{ position: "absolute", left: 24, top: 22, zIndex: 2, fontFamily: BODY, fontWeight: 800, fontSize: 34, color: "#111",
            background: "#FFE14D", borderRadius: 14, padding: "8px 18px", boxShadow: "0 4px 14px rgba(0,0,0,.35)" }}>{c.label}</div>
        ) : null}
        {cropStyle && ok ? (
          <OffthreadVideo src={staticFile(c.file!)} volume={vol} playbackRate={c.speed} style={cropStyle} />
        ) : (
          <AbsoluteFill style={{ transform: `scale(${s})` }}>
            {ok ? (
              <OffthreadVideo src={staticFile(c.file!)} volume={vol} playbackRate={c.speed}
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: c.focus }} />
            ) : <Placeholder label={c.label} />}
          </AbsoluteFill>
        )}
      </div>
    </AbsoluteFill>
  );
};

const Title: React.FC<{ d: ShortData }> = ({ d }) => {
  // long quote titles shrink to fit the width instead of running off the edge
  const size = (line: string) => Math.min(96, fitText({ text: line, withinWidth: 1010, fontFamily: TITLE }).fontSize);
  return (
    <div style={{ position: "absolute", top: 120, width: "100%", textAlign: "center", fontFamily: TITLE, lineHeight: 1.12, color: "white",
      WebkitTextStroke: "16px black", paintOrder: "stroke", filter: "drop-shadow(0 6px 10px rgba(0,0,0,.5))" }}>
      <div style={{ fontSize: size(d.title[0]) }}>{d.title[0]}</div>
      <div style={{ fontSize: size(d.title[1]), color: "#FFE14D" }}>{d.title[1]}</div>
    </div>
  );
};

const Credit: React.FC<{ d: ShortData }> = ({ d }) => (
  <div style={{ position: "absolute", right: 24, top: 414, fontFamily: BODY, fontWeight: 700, fontSize: 26, color: "rgba(255,255,255,.85)",
    background: "rgba(0,0,0,.45)", borderRadius: 12, padding: "6px 14px" }}>{d.credit}</div>
);

export const ClipShort: React.FC<{ data: ShortData }> = ({ data: d }) => {
  const t = useCurrentFrame() / FPS;
  let flash = 0;
  for (const a of d.flashes) if (t >= a) flash = Math.max(flash, 0.85 * (1 - eOut(prog(t, a, 0.25))));
  const musicVol = (f: number) => {
    if (!d.music) return 0;
    const tt = f / FPS, inMoment = d.moments.some((m) => tt >= m.from - 0.2 && tt <= m.to + 0.2);
    return d.music.gain * (1 - 0.6 * (d.env[f] ?? 0)) * (inMoment ? 0.35 : 1) * prog(tt, 0, 0.1) * (1 - prog(tt, d.end - 1.0, 1.0));
  };
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {d.clips.map((c, i) => (
        <Sequence key={i} from={fr(c.at)} durationInFrames={Math.max(1, fr(c.at + c.dur) - fr(c.at))}>
          <ClipView c={c} d={d} />
        </Sequence>
      ))}
      <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(0,0,0,.75) 0%, rgba(0,0,0,0) 22%, rgba(0,0,0,0) 62%, rgba(0,0,0,.65) 80%, rgba(0,0,0,.2) 100%)" }} />
      <Title d={d} />
      <Credit d={d} />
      {d.stickers.map((s, i) => (
        <Sticker key={i} t={t} t0={s.from} t1={s.to} x={s.x} y={s.y} rot={s.rot} bg={s.bg} fg={s.fg} size={s.size}>{s.text}</Sticker>
      ))}
      <Captions pages={d.pages} centerY={d.captionY ?? 1370} />
      {flash > 0.002 && <AbsoluteFill style={{ background: "white", opacity: flash }} />}

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
