// A widescreen (1920×1080) compilation in the style of bilingual-subtitle talk videos: prepared shorts
// (src/data/<id>.json from politics/prep_split.py) play one after another at full frame, with the spoken English
// over a Korean translation at the bottom, the speaker's name at the top left, an opening title card and a short
// card before each part. Each part keeps its own audio and music bed. The parts are listed in src/longs.ts.
import React from "react";
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, getStaticFiles, interpolate, staticFile, useCurrentFrame } from "remotion";
import { FPS, type Clip, type ShortData } from "./ClipShort";
import type { CapPage } from "./lib/Captions";
import { BODY, TITLE } from "./lib/fonts";
import { clamp, eOut, prog } from "./lib/fx";

export type LongSpec = { id: string; title: [string, string]; parts: string[]; watermark?: string };
export type LongProps = { long: Omit<LongSpec, "parts"> & { parts: ShortData[] } };

const W = 1920, H = 1080, INTRO = 3.5, CARD = 1.8, KEY = "#FFE14D";
const fr = (s: number) => Math.round(s * FPS);
const have = (file: string | null) => !!file && getStaticFiles().some((f) => f.name === file);

/** where each part starts (seconds): after the opening card, and after its own card */
export const layout = (parts: ShortData[]) => {
  let t = INTRO;
  const starts: number[] = [];
  for (const p of parts) {
    t += CARD;
    starts.push(t);
    t += p.end;
  }
  return { starts, end: t + 0.5 };
};
export const longFrames = (parts: ShortData[]) => Math.max(1, fr(layout(parts).end));

/** a clip at full frame: contained over a blurred fill (4:3 or vertical footage gets soft side bars), a slow push */
const LongClip: React.FC<{ c: Clip; d: ShortData }> = ({ c, d }) => {
  const f = useCurrentFrame();
  const s = 1 + 0.025 * clamp(f / Math.max(1, c.dur * FPS));
  const vol = (rf: number) => (d.origVoice ? c.audio : c.audio * (1 - 0.75 * (d.env[fr(c.at + rf / FPS)] ?? 0)));
  if (!have(c.file)) return <AbsoluteFill style={{ background: "#05060b" }} />;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <OffthreadVideo src={staticFile(c.file!)} muted playbackRate={c.speed}
        style={{ position: "absolute", left: -60, top: -60, width: W + 120, height: H + 120, objectFit: "cover", filter: "blur(40px) brightness(.4)" }} />
      <AbsoluteFill style={{ transform: `scale(${s})` }}>
        <OffthreadVideo src={staticFile(c.file!)} volume={vol} playbackRate={c.speed} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** an English line; [bracketed] words are the key phrase, set in yellow */
const En: React.FC<{ text: string }> = ({ text }) => (
  <>
    {text.split(/(\[[^\]]*\])/).map((part, i) =>
      part.startsWith("[") ? <span key={i} style={{ color: KEY }}>{part.slice(1, -1)}</span> : <React.Fragment key={i}>{part}</React.Fragment>,
    )}
  </>
);

/** the bottom subtitle: spoken English first, the Korean translation under it (Korean alone when there is no English) */
const Sub: React.FC<{ page: CapPage }> = ({ page }) => {
  const o = interpolate(useCurrentFrame(), [0, 4], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 52, opacity: o }}>
      <div style={{ maxWidth: 1640, textAlign: "center", fontFamily: BODY, color: "white", paintOrder: "stroke", filter: "drop-shadow(0 4px 10px rgba(0,0,0,.6))" }}>
        {page.who ? (
          // whose voice this is while the picture shows something else (B-roll, the audience)
          <div style={{ display: "inline-block", fontSize: 28, fontWeight: 800, padding: "2px 14px", marginBottom: 10, borderRadius: 8, background: "rgba(0,0,0,.7)", color: KEY }}>🎙 {page.who}</div>
        ) : null}
        {page.en ? (
          <div style={{ fontSize: 54, fontWeight: 800, lineHeight: 1.2, letterSpacing: -0.3, WebkitTextStroke: "10px black" }}><En text={page.en} /></div>
        ) : null}
        <div style={{ fontSize: page.en ? 44 : 60, fontWeight: 700, lineHeight: 1.28, marginTop: page.en ? 8 : 0, WebkitTextStroke: "9px black" }}>
          {page.tokens.map((tk, i) => <span key={i} style={{ color: tk.key ? KEY : "white" }}>{(i ? " " : "") + tk.text}</span>)}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Corner: React.FC<{ label: string; credit: string; watermark?: string }> = ({ label, credit, watermark }) => (
  <>
    {label ? (
      <div style={{ position: "absolute", left: 48, top: 40, fontFamily: BODY, fontWeight: 800, fontSize: 34, color: "white", background: "rgba(0,0,0,.55)",
        borderLeft: `7px solid ${KEY}`, borderRadius: 10, padding: "8px 20px" }}>{label}</div>
    ) : null}
    <div style={{ position: "absolute", right: 48, top: 40, textAlign: "right", fontFamily: BODY }}>
      {watermark ? <div style={{ fontWeight: 800, fontSize: 28, color: "rgba(255,255,255,.55)", marginBottom: 6 }}>{watermark}</div> : null}
      <div style={{ fontWeight: 700, fontSize: 24, color: "rgba(255,255,255,.8)", background: "rgba(0,0,0,.4)", borderRadius: 10, padding: "5px 14px" }}>{credit}</div>
    </div>
  </>
);

/** one prepared short, played at full frame */
const Part: React.FC<{ d: ShortData; watermark?: string }> = ({ d, watermark }) => {
  const t = useCurrentFrame() / FPS;
  const clip = d.clips.find((c) => t >= c.at && t < c.at + c.dur);
  let flash = 0;
  for (const a of d.flashes) if (t >= a) flash = Math.max(flash, 0.6 * (1 - eOut(prog(t, a, 0.25))));
  const musicVol = (f: number) => {
    if (!d.music) return 0;
    const tt = f / FPS;
    return d.music.gain * (1 - 0.6 * (d.env[f] ?? 0)) * prog(tt, 0, 0.3) * (1 - prog(tt, d.end - 1.0, 1.0));
  };
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {d.clips.map((c, i) => (
        <Sequence key={i} from={fr(c.at)} durationInFrames={Math.max(1, fr(c.at + c.dur) - fr(c.at))}>
          <LongClip c={c} d={d} />
        </Sequence>
      ))}
      <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(0,0,0,.45) 0%, rgba(0,0,0,0) 16%, rgba(0,0,0,0) 66%, rgba(0,0,0,.55) 100%)" }} />
      <Corner label={clip?.label ?? ""} credit={clip?.credit ?? d.credit} watermark={watermark} />
      {d.pages.map((p, i) => {
        const from = fr(p.startMs / 1000), dur = fr(p.endMs / 1000) - from;
        return dur > 0 ? <Sequence key={i} from={from} durationInFrames={dur} layout="none"><Sub page={p} /></Sequence> : null;
      })}
      {flash > 0.002 && <AbsoluteFill style={{ background: "white", opacity: flash }} />}
      {d.lines.map((l) => (
        <Sequence key={l.id} from={fr(l.start)} layout="none"><Audio src={staticFile(`${d.id}/voice/${l.id}.wav`)} /></Sequence>
      ))}
      {d.music && <Audio src={staticFile(d.music.file)} volume={musicVol} trimBefore={fr(d.music.start)} />}
    </AbsoluteFill>
  );
};

/** a title card over the blurred, darkened first shot of what follows */
const Card: React.FC<{ d?: ShortData; dur: number; kicker?: string; title: [string, string]; sub?: string; big?: boolean }> = ({ d, dur, kicker, title, sub, big }) => {
  const t = useCurrentFrame() / FPS;
  const o = prog(t, 0, 0.35) * (1 - prog(t, dur - 0.3, 0.3));
  const c = d?.clips.find((x) => have(x.file));
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {c ? <OffthreadVideo src={staticFile(c.file!)} muted style={{ position: "absolute", left: -60, top: -60, width: W + 120, height: H + 120, objectFit: "cover", filter: "blur(28px) brightness(.35)" }} /> : null}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", opacity: o, transform: `translateY(${16 * (1 - eOut(prog(t, 0, 0.5)))}px)` }}>
        {kicker ? <div style={{ fontFamily: BODY, fontWeight: 800, fontSize: 34, letterSpacing: 4, color: KEY, marginBottom: 18 }}>{kicker}</div> : null}
        <div style={{ fontFamily: TITLE, fontSize: big ? 112 : 84, lineHeight: 1.15, textAlign: "center", color: "white", WebkitTextStroke: "14px black", paintOrder: "stroke" }}>
          <div>{title[0]}</div>
          <div style={{ color: KEY }}>{title[1]}</div>
        </div>
        {sub ? <div style={{ fontFamily: BODY, fontWeight: 700, fontSize: 36, color: "rgba(255,255,255,.85)", marginTop: 26 }}>{sub}</div> : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const LongForm: React.FC<LongProps> = ({ long }) => {
  const { starts } = layout(long.parts);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Sequence from={0} durationInFrames={fr(INTRO)}>
        <Card d={long.parts[0]} dur={INTRO} title={long.title} sub="한영자막" big />
      </Sequence>
      {long.parts.map((d, i) => (
        <React.Fragment key={d.id}>
          <Sequence from={fr(starts[i] - CARD)} durationInFrames={fr(CARD)}>
            <Card d={d} dur={CARD} kicker={`PART ${i + 1}`} title={d.title} sub={d.clips.find((c) => c.label)?.label} />
          </Sequence>
          <Sequence from={fr(starts[i])} durationInFrames={Math.max(1, fr(d.end))}>
            <Part d={d} watermark={long.watermark} />
          </Sequence>
        </React.Fragment>
      ))}
    </AbsoluteFill>
  );
};
