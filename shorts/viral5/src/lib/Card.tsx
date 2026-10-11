// The white "post card" photo list (research/research-500k-footage.md §3): the look small channels hit 500k+ with in
// 2026 (겔라다 "세상에 그렇게 생긴 동물이 어디 있어?", 오레오쿠키 "보는 것만으로 숨 멎는 바다생물"). A plain white page,
// one bold black title over the top, one rounded picture in the middle whose clip changes every 2-3 s, and a two-line
// label under it: a short Korean line, then the English name in brackets. No narration, no word captions.
// Picked by "layout": "card" in edit.json; ClipShort hands the whole short to CardShort, every other short is untouched.
// An item may open with a hand-drawn doodle in the picture box ("doodle" on the item) before the real clip cuts in.
import React from "react";
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { fitText } from "@remotion/layout-utils";
import type { Clip, ShortData } from "../ClipShort";
import { BODY } from "./fonts";
import { eOut, prog } from "./fx";

const FPS = 30;
const fr = (s: number) => Math.round(s * FPS);
const INK = "#111";
/** the picture: 1000 x 750 (4:3), rounded; qa_review's picture crop (y 400..1480) holds it and the label */
export const CARD_BOX = { left: 40, top: 430, width: 1000, height: 750, radius: 34 };

export type CardItem = { at: number; ko: string; en?: string; doodle?: "seapig" | "chicken" };
export type CardOpts = {
  /** the page title, one or two lines (from the script's title) is drawn here; `badge` is a small channel mark over it */
  badge?: string;
  items: CardItem[];
  /** the small grey credit at the bottom of the page */
  credit?: string;
};

const isImg = (f: string | null) => !!f && /\.(jpe?g|png|webp)$/i.test(f);

/** deterministic noise in -1..1, so the doodle's line "boils" the same way on every render */
const rnd = (a: number, b: number) => {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
};
/** a closed wobbly outline through an ellipse-ish set of points */
const blob = (cx: number, cy: number, rx: number, ry: number, seed: number, n = 18, amp = 0.05) => {
  const p = Array.from({ length: n }, (_, k) => {
    const a = (k / n) * Math.PI * 2, r = 1 + amp * rnd(seed, k);
    return [cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r] as [number, number];
  });
  const at = (k: number) => p[(k + n) % n];
  let d = `M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`;
  for (let k = 0; k < n; k++) {
    const [x0, y0] = at(k - 1), [x1, y1] = at(k), [x2, y2] = at(k + 1), [x3, y3] = at(k + 2);
    d += ` C${(x1 + (x2 - x0) / 6).toFixed(1)} ${(y1 + (y2 - y0) / 6).toFixed(1)} ${(x2 - (x3 - x1) / 6).toFixed(1)} ${(y2 - (y3 - y1) / 6).toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }
  return d + " Z";
};
const line = (pts: [number, number][], seed: number, j = 3) =>
  pts.map(([x, y], k) => `${k ? "L" : "M"}${(x + j * rnd(seed, k)).toFixed(1)} ${(y + j * rnd(seed + 7, k)).toFixed(1)}`).join(" ");

/** a marker doodle of a sea pig (our own drawing): a pink sausage body, stubby tube feet underneath, two pairs of
 *  floppy "antennae" on the back and dot eyes; the outline redraws 8 times a second like a hand-drawn gif */
const SeaPigDoodle: React.FC<{ f: number }> = ({ f }) => {
  const s = Math.floor(f / (FPS / 8)) % 3 + 1;
  const W = CARD_BOX.width, H = CARD_BOX.height;
  const legs = [-210, -125, -40, 45, 130, 215];
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <rect width={W} height={H} fill="#FFF7EC" />
      {/* the sea floor scribble */}
      <path d={line([[60, 600], [300, 592], [520, 604], [760, 590], [940, 600]], s * 3, 4)} stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" />
      {legs.map((x, k) => (
        <path key={k} d={blob(500 + x, 540, 26, 46, s * 11 + k, 10, 0.12)} fill="#F7B9C8" stroke={INK} strokeWidth={8} />
      ))}
      <path d={blob(500, 420, 300, 140, s, 22, 0.035)} fill="#F7B9C8" stroke={INK} strokeWidth={10} strokeLinejoin="round" />
      {/* the floppy "antennae" (in the real animal: enlarged tube feet) */}
      {[[-170, 0], [-110, 1], [120, 2], [180, 3]].map(([x, k]) => (
        <path key={k} d={line([[500 + x, 300], [500 + x + 12, 220], [500 + x + 40, 170]], s * 5 + k, 4)} stroke={INK} strokeWidth={14} fill="none" strokeLinecap="round" />
      ))}
      <circle cx={260 + rnd(s, 1) * 2} cy={400} r={13} fill={INK} />
      <circle cx={318 + rnd(s, 2) * 2} cy={396} r={13} fill={INK} />
      <path d={line([[270, 452], [290, 462], [312, 452]], s * 9, 2)} stroke={INK} strokeWidth={7} fill="none" strokeLinecap="round" />
    </svg>
  );
};

/** a marker doodle of a chicken with no head (our own drawing, the hook for the "headless chicken monster" sea
 *  cucumber): a round white body, a tail tuft, a wing, two stick legs and a neck that just stops, plus "?" marks */
const ChickenDoodle: React.FC<{ f: number }> = ({ f }) => {
  const s = Math.floor(f / (FPS / 8)) % 3 + 1;
  const W = CARD_BOX.width, H = CARD_BOX.height;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <rect width={W} height={H} fill="#FFF7EC" />
      <path d={line([[60, 640], [300, 632], [520, 644], [760, 630], [940, 640]], s * 3, 4)} stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" />
      {[[440, 0], [560, 1]].map(([x, k]) => (
        <path key={k} d={line([[x, 520], [x - 6, 600], [x - 30, 630], [x, 630], [x + 30, 630]], s * 7 + k, 3)} stroke="#E8A13A" strokeWidth={12} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {/* tail feathers, behind the body */}
      {[[-35, 0], [0, 1], [35, 2]].map(([r, k]) => (
        <path key={k} d={blob(690, 300, 38, 95, s * 13 + k, 12, 0.1)} fill="#fff" stroke={INK} strokeWidth={8} transform={`rotate(${r + 20} 690 380)`} />
      ))}
      {/* the neck: a plain stump that just stops where the head should be */}
      <path d={blob(330, 280, 52, 105, s * 17, 14, 0.06)} fill="#fff" stroke={INK} strokeWidth={10} transform="rotate(-18 330 280)" />
      <path d={blob(500, 420, 220, 150, s, 22, 0.04)} fill="#fff" stroke={INK} strokeWidth={10} strokeLinejoin="round" />
      {/* cover the stump's lower outline so neck and body read as one shape */}
      <ellipse cx={372} cy={352} rx={58} ry={46} fill="#fff" />
      {/* the wing: two curved strokes */}
      <path d={line([[500, 360], [530, 440], [600, 480], [660, 440], [640, 380]], s * 5, 3)} stroke={INK} strokeWidth={9} fill="none" strokeLinecap="round" />
      <path d={line([[560, 420], [600, 445], [630, 420]], s * 6, 3)} stroke={INK} strokeWidth={7} fill="none" strokeLinecap="round" />
      <text x={230 + rnd(s, 3) * 3} y={150} fontFamily={BODY} fontWeight={800} fontSize={90} fill={INK}>?</text>
      <text x={390 + rnd(s, 4) * 3} y={120} fontFamily={BODY} fontWeight={800} fontSize={70} fill={INK}>?</text>
    </svg>
  );
};

/** one item's clip in the rounded box: a cover fit with a slow push-in, popping in a little on the cut */
const CardClip: React.FC<{ c: Clip }> = ({ c }) => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = Math.min(1, f / Math.max(1, durationInFrames - 1));
  const s = (c.zoom[0] + (c.zoom[1] - c.zoom[0]) * p) * (1 + 0.05 * (1 - eOut(prog(f, 0, 5))));
  const style: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover", objectPosition: c.focus, transform: `scale(${s})`, transformOrigin: c.focus };
  if (!c.file) return <AbsoluteFill style={{ background: "#ddd" }} />;
  return isImg(c.file) ? <Img src={staticFile(c.file)} style={style} />
    : <OffthreadVideo src={staticFile(c.file)} playbackRate={c.speed} muted style={style} />;
};

export const CardShort: React.FC<{ d: ShortData & { card?: CardOpts } }> = ({ d }) => {
  const f = useCurrentFrame();
  const { durationInFrames: total } = useVideoConfig();
  const t = f / FPS;
  const o = d.card ?? { items: [] };
  const item = [...o.items].reverse().find((it) => t >= it.at) ?? o.items[0];
  const until = (c: Clip) => (fr(c.at + c.dur) >= total - 1 ? total : fr(c.at + c.dur));
  const title = d.title.filter(Boolean);
  const tSize = Math.min(64, ...title.map((l) => fitText({ text: l, withinWidth: 960, fontFamily: BODY, fontWeight: 800 }).fontSize));
  const pop = item ? 1 + 0.04 * (1 - eOut(prog(t, item.at, 0.18))) : 1;
  const musicVol = (mf: number) => (d.music ? d.music.gain * prog(mf / FPS, 0, 0.05) * (1 - prog(mf / FPS, d.end - 0.6, 0.6)) : 0);
  const B = CARD_BOX;
  return (
    <AbsoluteFill style={{ background: "#fff" }}>
      {o.badge ? (
        <div style={{ position: "absolute", left: 60, top: 130, display: "flex", alignItems: "center", gap: 16, fontFamily: BODY, fontWeight: 800, fontSize: 30, color: "#333" }}>
          <div style={{ width: 54, height: 54, borderRadius: 27, background: "#1d4e89", color: "#fff", fontSize: 30, display: "flex", alignItems: "center", justifyContent: "center" }}>🐙</div>
          {o.badge}
        </div>
      ) : null}
      <div style={{ position: "absolute", left: 0, right: 0, top: 220, height: 190, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center" }}>
        {title.map((l, i) => (
          <div key={i} style={{ fontFamily: BODY, fontWeight: 800, fontSize: tSize, lineHeight: 1.22, color: INK, letterSpacing: -1, whiteSpace: "pre" }}>{l}</div>
        ))}
      </div>
      <div style={{ position: "absolute", left: B.left, top: B.top, width: B.width, height: B.height, borderRadius: B.radius, overflow: "hidden", background: "#000" }}>
        {d.clips.map((c, i) => (
          <Sequence key={i} from={fr(c.at)} durationInFrames={Math.max(1, until(c) - fr(c.at))}>
            <CardClip c={c} />
          </Sequence>
        ))}
        {o.items.map((it, i) => {
          if (!it.doodle) return null;
          const next = o.items[i + 1]?.at ?? d.end;
          return t >= it.at && t < next ? <AbsoluteFill key={i}>{it.doodle === "chicken" ? <ChickenDoodle f={f} /> : <SeaPigDoodle f={f} />}</AbsoluteFill> : null;
        })}
      </div>
      {item ? (
        <div style={{ position: "absolute", left: 40, right: 40, top: B.top + B.height + 44, textAlign: "center", transform: `scale(${pop})` }}>
          <div style={{ fontFamily: BODY, fontWeight: 800, fontSize: 54, color: INK, lineHeight: 1.25, letterSpacing: -0.5 }}>{item.ko}</div>
          {item.en ? <div style={{ fontFamily: BODY, fontWeight: 700, fontSize: 40, color: "#444", marginTop: 6 }}>({item.en})</div> : null}
        </div>
      ) : null}
      {o.credit ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: B.top + B.height + 230, textAlign: "center", fontFamily: BODY, fontWeight: 700, fontSize: 26, color: "#9a9a9a" }}>{o.credit}</div>
      ) : null}
      {d.music && <Audio src={staticFile(d.music.file)} volume={musicVol} trimBefore={fr(d.music.start)} />}
      {d.sfx.map((s, i) => (
        <Sequence key={i} from={fr(s.t)} layout="none"><Audio src={staticFile(`sfx/${s.name}.wav`)} volume={s.gain * 0.7} /></Sequence>
      ))}
    </AbsoluteFill>
  );
};
