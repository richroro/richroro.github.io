// lfsaeyeon1 (사연툰 "반찬통 이름표"): the whole 16:9 episode from longform/lfsaeyeon1/video.json (longform/lfsaeyeon1/prep.py):
// the cuts on the stage (lfsaeyeon1_stage.tsx), narration captions at the bottom, the title card after the cold open,
// one voice file per line, the music beds (looped, faded at their ends, dipped under speech) and the sound effects.
import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { fitText } from "@remotion/layout-utils";
import { BODY, TITLE, loadFonts } from "../fonts";
import { clamp, eBack, prog } from "../fx";
import { Marked } from "../Marked";
import { SyStage, type SyScene } from "./lfsaeyeon1_stage";

export type SyData = {
  id: string; end: number;
  cuts: { from: number; dur: number; g: SyScene }[];
  caps: { from: number; to: number; text: string }[];
  title: { from: number; to: number; text: string };
  lines: { id: string; start: number; dur: number; voice: string }[];
  music: { file: string; from: number; to: number; gain: number; offset: number }[];
  sfx: { t: number; name: string; gain: number }[];
};
export const FPS = 30;
const fr = (s: number) => Math.round(s * FPS);
const INK = "#1b1b1f";

const Cut: React.FC<{ g: SyScene }> = ({ g }) => {
  const f = useCurrentFrame();
  return <SyStage g={g} t={f / FPS} />;
};

/** the bottom caption: one line, white on a dark rounded band */
const Caption: React.FC<{ text: string }> = ({ text }) => {
  const f = useCurrentFrame();
  const fs = Math.min(66, fitText({ text: text.replace(/[[\]{}]/g, ""), withinWidth: 1500, fontFamily: BODY, fontWeight: "900" }).fontSize);
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 34 }}>
      <div style={{ background: "rgba(20,20,26,.78)", borderRadius: 22, padding: "10px 34px", fontFamily: BODY, fontWeight: 900, fontSize: fs, color: "white", lineHeight: 1.25,
        opacity: clamp(f / 3), whiteSpace: "nowrap" }}><Marked text={text} /></div>
    </AbsoluteFill>
  );
};

/** the title card in the beat after the cold open */
const TitleCard: React.FC<{ text: string; dur: number }> = ({ text, dur }) => {
  const t = useCurrentFrame() / FPS;
  const p = eBack(prog(t, 0, 0.35), 2), out = prog(t, dur - 0.25, 0.25);
  const [a, b] = (() => { const w = text.split(" "); const k = Math.ceil(w.length / 2); return [w.slice(0, k).join(" "), w.slice(k).join(" ")]; })();
  return (
    <AbsoluteFill style={{ background: `rgba(15,15,20,${0.86 * (1 - out)})`, justifyContent: "center", alignItems: "center" }}>
      <div style={{ transform: `scale(${p * (1 - 0.1 * out)})`, opacity: 1 - out, textAlign: "center" }}>
        <div style={{ fontFamily: BODY, fontWeight: 900, fontSize: 44, color: "#FFD84D", letterSpacing: 4, marginBottom: 18 }}>창작 사연툰</div>
        <div style={{ fontFamily: TITLE, fontSize: 116, lineHeight: 1.12, color: "white" }}>{a}</div>
        <div style={{ fontFamily: TITLE, fontSize: 116, lineHeight: 1.12, color: "#ff4d4d" }}>{b}</div>
      </div>
    </AbsoluteFill>
  );
};

export const SyVideo: React.FC<{ data: SyData }> = ({ data }) => {
  loadFonts();
  const { durationInFrames } = useVideoConfig();
  // speech envelope for the music dip
  const speaking = (t: number) => data.lines.some((l) => t >= l.start - 0.1 && t <= l.start + l.dur + 0.15);
  return (
    <AbsoluteFill style={{ background: "#fff" }}>
      {data.cuts.map((c, i) => (
        <Sequence key={i} from={fr(c.from)} durationInFrames={Math.max(1, (i + 1 < data.cuts.length ? fr(data.cuts[i + 1].from) : durationInFrames) - fr(c.from))}>
          <Cut g={c.g} />
        </Sequence>
      ))}
      {data.caps.map((c, i) => (
        <Sequence key={`c${i}`} from={fr(c.from)} durationInFrames={Math.max(1, fr(Math.min(c.to, data.caps[i + 1]?.from ?? c.to)) - fr(c.from))}>
          <Caption text={c.text} />
        </Sequence>
      ))}
      <Sequence from={fr(data.title.from)} durationInFrames={fr(data.title.to - data.title.from)}>
        <TitleCard text={data.title.text} dur={data.title.to - data.title.from} />
      </Sequence>
      {data.lines.map((l) => (
        <Sequence key={l.id} from={fr(l.start)} layout="none"><Audio src={staticFile(`${data.id}/voice/${l.id}.wav`)} /></Sequence>
      ))}
      {data.music.map((m, i) => {
        const len = fr(m.to - m.from);
        return (
          <Sequence key={`m${i}`} from={fr(m.from)} durationInFrames={len} layout="none">
            <Audio src={staticFile(m.file)} loop trimBefore={fr(m.offset)}
              volume={(f) => {
                const fade = Math.min(clamp(f / fr(1.2)), clamp((len - f) / fr(1.5)));
                return m.gain * fade * (speaking(m.from + f / FPS) ? 0.55 : 1);
              }} />
          </Sequence>
        );
      })}
      {data.sfx.map((s, i) => (
        <Sequence key={`s${i}`} from={fr(s.t)} layout="none"><Audio src={staticFile(`sfx/${s.name}.wav`)} volume={s.gain} /></Sequence>
      ))}
      <div style={{ position: "absolute", right: 30, top: 26, fontFamily: BODY, fontWeight: 800, fontSize: 28, color: "rgba(27,27,31,.45)" }}>창작 사연</div>
    </AbsoluteFill>
  );
};

export const syFrames = (d: SyData) => Math.ceil(d.end * FPS);
export { INK as SY_INK };
