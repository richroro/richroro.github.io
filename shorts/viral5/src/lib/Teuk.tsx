// "○○ 특" v2 (the 자체공감 look, research/benchmark-drawn.md §3): a dark solid background, the one-line title
// "○○ 특" at the top with a small mascot logo in the top right corner, one picture box in the middle whose picture
// changes on every item, and white two-line observational captions under it (no colour keywords, no word highlight).
// Picked by "layout": "teuk" in edit.json; ClipShort hands the whole short to TeukShort, every other short is untouched.
// An item clip is a big mascot reaction close-up ("face"), a photo ("photo", the clip's still from edit.json sources)
// or one of the drawn story scenes ("scene", lib/Sseol.tsx), so neighbouring items never look alike.
import React from "react";
import { AbsoluteFill, Audio, Img, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { fitText, measureText } from "@remotion/layout-utils";
import type { Clip, ShortData } from "../ClipShort";
import { BODY, TITLE } from "./fonts";
import { clamp, eBack, eOut, prog } from "./fx";
import { Marked } from "./Marked";
import { Mochi, Scene, type Mood, type SceneG } from "./Sseol";

const FPS = 30;
const fr = (s: number) => Math.round(s * FPS);
const INK = "#1b1b1f";
/** the picture box: full width, between the title and the captions; qa_review's picture crop (y 400..1480) sits inside it */
export const TEUK_BOX = { top: 340, height: 1160 };
const BURSTS = ["#FFD84D", "#8FD3FF", "#FF9EBB", "#B9F27C", "#C9A7FF", "#FFB36B"];

export type TeukOpts = {
  /** the solid background (default a dark warm grey) */
  bg?: string;
  /** the mascot's colour, for the corner logo and the default of every face (default the series' orange) */
  mascot?: string;
};
type Say = { text: string; x?: number; y?: number };
/** a big reaction close-up of the mascot: `mood`, then `to` at steps[0]; `pos` places it so items differ
 *  ("close": the face fills the box, cut at the chin; "left" / "right": big, off-centre; "low": rising from the bottom edge;
 *  "tilt": close and leaning); `fx` adds manga effects; `say` a speech bubble (at steps[1]); `big` slams in at steps[2] */
export type FaceG = {
  type: "face"; mood?: Mood; to?: Mood; color?: string; pos?: "close" | "left" | "right" | "low" | "tilt";
  burst?: string; fx?: "lines" | "sweat" | "steam" | "gloom" | "sparkle" | "fire" | "hearts"; prop?: string; propX?: number; propY?: number;
  say?: Say; big?: string; hat?: string; steps?: number[];
};
/** the clip's photo filling the box with a slow push-in (`zoom` [from, to], `pos` CSS object-position); `react` is the
 *  mascot's face in a round inset on one corner (pops at steps[0]); `tag` a short sticker; `say` / `big` as for faces */
export type PhotoG = {
  type: "photo"; zoom?: [number, number]; pos?: string; react?: { mood: Mood; to?: Mood; side?: "left" | "right"; size?: number; color?: string };
  tag?: string; say?: Say; big?: string; steps?: number[];
};
type TeukG = FaceG | PhotoG | (SceneG & { type: "scene"; steps?: number[] });

const Burst: React.FC<{ color: string; t: number }> = ({ color, t }) => (
  <AbsoluteFill style={{ background: color, overflow: "hidden" }}>
    <div style={{ position: "absolute", left: -700, top: -700, width: 2480, height: 2560, transform: `rotate(${t * 9}deg)`,
      background: `repeating-conic-gradient(from 0deg at 50% 50%, rgba(255,255,255,.28) 0deg 9deg, rgba(255,255,255,0) 9deg 22.5deg)` }} />
    <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 48%, rgba(255,255,255,.35) 0%, rgba(255,255,255,0) 55%)" }} />
  </AbsoluteFill>
);

/** manga effects over a face; h is the box height */
const Fx: React.FC<{ kind: NonNullable<FaceG["fx"]>; t: number; h: number }> = ({ kind, t, h }) => {
  if (kind === "lines") return (
    <svg width={1080} height={h} style={{ position: "absolute", inset: 0 }}>
      {Array.from({ length: 34 }, (_, k) => {
        const a = (k / 34) * Math.PI * 2 + 0.07 * Math.sin(t * 20 + k), r0 = 430 + 60 * ((k * 37) % 5), r1 = 1300;
        return <path key={k} d={`M${540 + r0 * Math.cos(a)} ${h / 2 + r0 * Math.sin(a)} L${540 + r1 * Math.cos(a - 0.025)} ${h / 2 + r1 * Math.sin(a - 0.025)} L${540 + r1 * Math.cos(a + 0.025)} ${h / 2 + r1 * Math.sin(a + 0.025)} Z`} fill={INK} opacity={0.75} />;
      })}
    </svg>
  );
  if (kind === "gloom") return (
    <>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(40,50,110,.55), rgba(40,50,110,0) 60%)" }} />
      <svg width={1080} height={h} style={{ position: "absolute", inset: 0 }}>
        {Array.from({ length: 16 }, (_, k) => <path key={k} d={`M${120 + k * 56} 0 L${120 + k * 56} ${260 + 120 * ((k * 7) % 3)}`} stroke="#3b3f7a" strokeWidth={8} opacity={0.6} />)}
      </svg>
    </>
  );
  if (kind === "fire") return (
    <AbsoluteFill style={{ background: "linear-gradient(0deg, rgba(255,60,20,.55), rgba(255,60,20,0) 55%)" }}>
      {[0.1, 0.3, 0.7, 0.9].map((x, k) => (
        <div key={k} style={{ position: "absolute", left: x * 1080 - 90, bottom: -20 + 18 * Math.sin(t * 9 + k), fontSize: 180, lineHeight: 1 }}>🔥</div>
      ))}
    </AbsoluteFill>
  );
  const glyph = { sweat: "💦", steam: "💨", sparkle: "✨", hearts: "💕" }[kind];
  const spots = kind === "sweat" ? [[0.82, 0.16], [0.14, 0.22], [0.88, 0.42]] : kind === "steam" ? [[0.2, 0.1], [0.8, 0.1], [0.5, 0.04]] : [[0.12, 0.14], [0.86, 0.2], [0.18, 0.6], [0.84, 0.66]];
  return (
    <>
      {spots.map(([x, y], k) => {
        const q = (t * 1.2 + k * 0.33) % 1;
        const dy = kind === "sweat" ? 60 * q : kind === "steam" ? -50 * q : 0;
        const s = kind === "sparkle" || kind === "hearts" ? 0.8 + 0.3 * Math.abs(Math.sin(t * 5 + k)) : 1;
        return <div key={k} style={{ position: "absolute", left: x * 1080 - 75, top: y * h + dy, fontSize: 150, lineHeight: 1, opacity: kind === "sparkle" || kind === "hearts" ? 1 : 1 - 0.6 * q, transform: `scale(${s})` }}>{glyph}</div>;
      })}
    </>
  );
};

/** a white speech bubble with an ink outline, its tail pointing down; x, y the bubble's centre in the box */
const Bubble: React.FC<{ say: Say; at: number; t: number; h: number; x: number; y: number }> = ({ say, at, t, h, x, y }) => {
  const p = eBack(prog(t, at, 0.28), 2.2);
  if (p <= 0) return null;
  const text = say.text.replace(/[[\]{}]/g, "");
  const fs = Math.max(56, Math.min(84, fitText({ text, withinWidth: 760, fontFamily: BODY, fontWeight: "900" }).fontSize));
  const w = Math.min(900, measureText({ text, fontFamily: BODY, fontSize: fs, fontWeight: "900" }).width + 110);
  const cx = clamp((say.x ?? x) * 1080, w / 2 + 24, 1080 - w / 2 - 24), cy = (say.y ?? y) * h;
  return (
    <div style={{ position: "absolute", left: cx - w / 2, top: cy - 80, width: w, transform: `scale(${p})`, transformOrigin: "50% 100%", opacity: clamp(p * 2) }}>
      <div style={{ position: "relative", background: "white", border: `7px solid ${INK}`, borderRadius: 44, padding: "22px 40px", boxShadow: `9px 9px 0 ${INK}`,
        fontFamily: BODY, fontWeight: 900, fontSize: fs, lineHeight: 1.22, color: INK, textAlign: "center", wordBreak: "keep-all" }}>
        <Marked text={say.text} color="#e8212e" />
        <svg width={64} height={52} style={{ position: "absolute", left: w / 2 - 40, bottom: -48 }} viewBox="0 0 64 52">
          <path d="M6 0 L26 48 L58 0 Z" fill="white" stroke={INK} strokeWidth={7} strokeLinejoin="round" />
          <rect x={3} y={-8} width={58} height={12} fill="white" />
        </svg>
      </div>
    </div>
  );
};

/** a big outlined word slamming in near the top of the box */
const Big: React.FC<{ text: string; at: number; t: number; top?: number }> = ({ text, at, t, top = 70 }) => {
  const p = eBack(prog(t, at, 0.3), 2.4);
  return p > 0 ? (
    <div style={{ position: "absolute", left: 0, right: 0, top, textAlign: "center", fontFamily: TITLE, fontSize: 170, lineHeight: 1, color: "#FFE14D",
      WebkitTextStroke: "20px black", paintOrder: "stroke", transform: `scale(${p}) rotate(-5deg)`, filter: "drop-shadow(0 10px 14px rgba(0,0,0,.35))" }}>
      <Marked text={text} color="#ff4d6d" />
    </div>
  ) : null;
};

const Face: React.FC<{ g: FaceG; t: number; h: number; i: number; mascot: string }> = ({ g, t, h, i, mascot }) => {
  const st = g.steps ?? [];
  const sw = !!g.to && t >= (st[0] ?? 1e9);
  const pos = g.pos ?? "close";
  // size, centre x (0..1) and top of the mochi (its 200-unit drawing: face at 0.45..0.75 of its height)
  const P = { close: [1240, 0.5, 120, 0], tilt: [1180, 0.52, 150, -10], left: [880, 0.36, h - 820, 0], right: [880, 0.64, h - 820, 0], low: [1000, 0.5, h - 700, 0] }[pos];
  const [size, cx, top, rot] = P;
  const punch = 1 + 0.16 * (1 - eOut(prog(t, 0, 0.25))) + 0.012 * t;  // slams in, then a slow push
  const mood = sw ? g.to! : g.mood ?? "neutral";
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Burst color={g.burst ?? BURSTS[i % BURSTS.length]} t={t} />
      {g.fx === "lines" || g.fx === "gloom" || g.fx === "fire" ? <Fx kind={g.fx} t={t} h={h} /> : null}
      <div style={{ position: "absolute", left: cx * 1080 - size / 2, top, width: size, height: size, transform: `scale(${punch}) rotate(${rot}deg)`, transformOrigin: "50% 60%" }}>
        <Mochi c={{ color: g.color ?? mascot, mood, hat: g.hat }} i={0} t={sw ? t - (st[0] ?? 0) : t} size={size} mood={mood} />
      </div>
      {g.prop ? (
        <div style={{ position: "absolute", left: (g.propX ?? (pos === "left" ? 0.8 : pos === "right" ? 0.2 : 0.8)) * 1080 - 130, top: (g.propY ?? 0.62) * h - 130, fontSize: 260, lineHeight: 1,
          transform: `scale(${eBack(prog(t, 0.1, 0.3), 2.4)}) rotate(${8 * Math.sin(t * 4)}deg)`, filter: "drop-shadow(0 12px 12px rgba(0,0,0,.3))" }}>{g.prop}</div>
      ) : null}
      {g.fx && !["lines", "gloom", "fire"].includes(g.fx) ? <Fx kind={g.fx} t={t} h={h} /> : null}
      {g.big ? <Big text={g.big} at={st[2] ?? 0.1} t={t} /> : null}
      {g.say ? <Bubble say={g.say} at={st[1] ?? 0.05} t={t} h={h} x={pos === "left" ? 0.62 : pos === "right" ? 0.38 : 0.5} y={pos === "close" || pos === "tilt" ? 0.1 : 0.14} /> : null}
    </AbsoluteFill>
  );
};

const Photo: React.FC<{ g: PhotoG; c: Clip; t: number; h: number; mascot: string }> = ({ g, c, t, h, mascot }) => {
  const st = g.steps ?? [];
  const [z0, z1] = g.zoom ?? [1.02, 1.12];
  const z = z0 + (z1 - z0) * clamp(t / Math.max(1, c.dur)) + 0.08 * (1 - eOut(prog(t, 0, 0.25)));
  const r = g.react, rs = r?.size ?? 420, rp = r ? eBack(prog(t, st[0] ?? 0.15, 0.3), 2.2) : 0;
  const rsw = !!r?.to && t >= (st[3] ?? 1e9);
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#111" }}>
      {c.file ? <Img src={staticFile(c.file)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: g.pos ?? "50% 50%",
        transform: `scale(${z})`, transformOrigin: g.pos ?? "50% 50%" }} /> : null}
      {r && rp > 0 ? (
        <div style={{ position: "absolute", [r.side === "left" ? "left" : "right"]: 30, bottom: 30, width: rs, height: rs, borderRadius: "50%", overflow: "hidden",
          border: `10px solid white`, boxShadow: "0 12px 30px rgba(0,0,0,.45)", background: r.color ?? "#FFE14D", transform: `scale(${rp})`, transformOrigin: "50% 100%" }}>
          <div style={{ position: "absolute", left: -rs * 0.2, top: -rs * 0.2, width: rs * 1.4, height: rs * 1.4 }}>
            <Mochi c={{ color: mascot, mood: rsw ? r.to : r.mood }} i={0} t={t} size={rs * 1.4} mood={rsw ? r.to! : r.mood} />
          </div>
        </div>
      ) : null}
      {g.tag ? (
        <div style={{ position: "absolute", left: 34, top: 34, fontFamily: BODY, fontWeight: 900, fontSize: 64, color: INK, background: "#FFE14D", border: `6px solid ${INK}`,
          borderRadius: 18, padding: "6px 26px", boxShadow: `7px 7px 0 ${INK}`, transform: `rotate(-4deg) scale(${eBack(prog(t, st[1] ?? 0.1, 0.25), 2.2)})`, transformOrigin: "0 0" }}>
          <Marked text={g.tag} color="#e8212e" />
        </div>
      ) : null}
      {g.big ? <Big text={g.big} at={st[2] ?? 0.1} t={t} top={h * 0.36} /> : null}
      {g.say ? <Bubble say={g.say} at={st[1] ?? 0.05} t={t} h={h} x={0.5} y={0.12} /> : null}
    </AbsoluteFill>
  );
};

const Item: React.FC<{ c: Clip; i: number; mascot: string }> = ({ c, i, mascot }) => {
  const t = useCurrentFrame() / FPS, h = TEUK_BOX.height;
  const g = c.gfx as unknown as TeukG;
  return (
    <div style={{ position: "absolute", left: 0, top: TEUK_BOX.top, width: 1080, height: h, overflow: "hidden" }}>
      {g?.type === "face" ? <Face g={g} t={t} h={h} i={i} mascot={mascot} />
        : g?.type === "scene" ? <Scene g={g} t={t} h={h} />
        : <Photo g={(g ?? { type: "photo" }) as PhotoG} c={c} t={t} h={h} mascot={mascot} />}
    </div>
  );
};

/** the corner logo: the mascot's happy face in a white disc */
const Logo: React.FC<{ color: string; t: number }> = ({ color, t }) => (
  <div style={{ position: "absolute", right: 34, top: 64, width: 170, height: 170, borderRadius: "50%", background: "white", overflow: "hidden", border: `6px solid ${color}`,
    boxShadow: "0 6px 16px rgba(0,0,0,.35)" }}>
    <div style={{ position: "absolute", left: -10, top: 6, width: 190, height: 190 }}>
      <Mochi c={{ color, mood: "happy" }} i={0} t={t} size={190} mood="happy" />
    </div>
  </div>
);

/** the one-line title, left of the logo, fitted to its room */
const Title: React.FC<{ text: string }> = ({ text }) => {
  const fs = Math.min(150, fitText({ text, withinWidth: 800, fontFamily: TITLE }).fontSize);
  return (
    <div style={{ position: "absolute", left: 50, top: 70, height: 200, width: 820, display: "flex", alignItems: "center", fontFamily: TITLE, fontSize: fs, color: "white",
      lineHeight: 1, whiteSpace: "nowrap" }}>{text}</div>
  );
};

/** the caption pages of one script caption ("line 1 / line 2") shown together as a calm two-line subtitle */
type Group = { from: number; to: number; lines: string[] };
const groups = (d: ShortData): Group[] => {
  const out: Group[] = [];
  for (const p of d.pages) {
    const g = (p as { g?: string }).g, text = p.tokens.map((k) => k.text).join(" ");
    const last = out[out.length - 1];
    if (last && g !== undefined && (last as Group & { g?: string }).g === g) { last.lines.push(text); last.to = p.endMs / 1000; continue; }
    out.push(Object.assign({ from: p.startMs / 1000, to: p.endMs / 1000, lines: [text] }, { g }));
  }
  if (out[0]) out[0].from = 0;  // a caption from the very first frame
  if (out.length) out[out.length - 1].to = d.end;  // and the last one holds to the end, so the bottom is never empty
  return out;
};
const Subtitle: React.FC<{ g: Group }> = ({ g }) => {
  const t = useCurrentFrame() / FPS, p = eOut(prog(t, 0, 0.12));
  const fs = Math.min(84, ...g.lines.map((l) => fitText({ text: l, withinWidth: 980, fontFamily: BODY, fontWeight: "800" }).fontSize));
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: TEUK_BOX.top + TEUK_BOX.height + 40, height: 1920 - TEUK_BOX.top - TEUK_BOX.height - 90, display: "flex",
      flexDirection: "column", justifyContent: "center", alignItems: "center", fontFamily: BODY, fontWeight: 800, fontSize: fs, lineHeight: 1.3, color: "white",
      letterSpacing: -1, textShadow: "0 4px 10px rgba(0,0,0,.5)", opacity: p, transform: `translateY(${10 * (1 - p)}px)` }}>
      {g.lines.map((l, k) => <div key={k} style={{ whiteSpace: "nowrap" }}>{l}</div>)}
    </div>
  );
};

export const TeukShort: React.FC<{ d: ShortData & { teuk?: TeukOpts } }> = ({ d }) => {
  const t = useCurrentFrame() / FPS;
  const { durationInFrames: total } = useVideoConfig();
  const o = d.teuk ?? {}, mascot = o.mascot ?? "#FFB36B";
  const until = (c: Clip) => (fr(c.at + c.dur) >= total - 1 ? total : fr(c.at + c.dur));
  const musicVol = (f: number) => {
    if (!d.music) return 0;
    const tt = f / FPS;
    return d.music.gain * (1 - 0.6 * (d.env[f] ?? 0)) * prog(tt, 0, 0.1) * (1 - prog(tt, d.end - 1.0, 1.0));
  };
  return (
    <AbsoluteFill style={{ background: o.bg ?? "#2a2522" }}>
      {d.clips.map((c, i) => (
        <Sequence key={i} from={fr(c.at)} durationInFrames={Math.max(1, until(c) - fr(c.at))} layout="none">
          <Item c={c} i={i} mascot={mascot} />
        </Sequence>
      ))}
      <Title text={d.title.join(" ")} />
      <Logo color={mascot} t={t} />
      {groups(d).map((g, i) => {
        const from = fr(g.from), dur = fr(g.to) - from;
        return dur > 0 ? <Sequence key={i} from={from} durationInFrames={dur} layout="none"><Subtitle g={g} /></Sequence> : null;
      })}
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
