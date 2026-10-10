// lfhorror1 — the whole 16:9 video as one component, driven by longform/lfhorror1/edit.json (built by build_edit.py):
// shots (stock photo/clip or one of the drawn pieces), the narrator 도치 in the corner, chapter cards, the title,
// bottom captions with red key words, a slow flicker and film grain. The soundtrack is one mixed WAV (mix.py).
import React from "react";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame } from "remotion";
import { BODY, TITLE, loadFonts } from "../fonts";
import { clamp, prog } from "../fx";
import type { Mood } from "../Sseol";
import * as D from "./lfhorror1_draw";

export type Shot = { t0: number; t1: number; k: string; a: string[]; nar?: { mood: Mood; flip: boolean } };
export type LfhEdit = {
  fps: number; end: number; audio: string;
  shots: Shot[];
  caps: { t0: number; t1: number; text: string; who: string }[];
  cards: { t: number; n: number; title: string }[];
  title: { t0: number; t1: number; lines: string[] };
  mirrorSrc: string; cctvSrc: string;
};

const pic = (s: Shot, t: number, e: LfhEdit): React.ReactNode => {
  const a = s.a, dur = s.t1 - s.t0;
  switch (s.k) {
    case "ph": return <D.Stock t={t} dur={dur} src={`lfhorror1/ph/${a[0]}.jpg`} pos={(a[1] ?? "50%_50%").replace("_", " ")} />;
    case "v": return <D.Stock t={t} dur={dur} video src={`lfhorror1/v/${a[0]}.mp4`} from={Number(a[1] ?? 0)} pos={(a[2] ?? "50%_50%").replace("_", " ")} zoom={a[2] ? [1.3, 1.36] : [1.02, 1.08]} />;
    case "doc1": return <D.DocPage t={t} page={1} focus={a[0] === "all" || a[0] === "head" ? a[0] : Number(a[0])} />;
    case "doc2": return <D.DocPage t={t} page={2} focus={a[0] as "all" | "note" | "note2"} />;
    case "env": return <D.Envelope t={t} open={a[0] === "open" ? clamp((t - 1.5) / 1.2) : 0} />;
    case "letter": return <D.Letter t={t} upto={Number(a[0])} />;
    case "mirror": return <D.Mirror t={t} src={e.mirrorSrc} v={a[0] as never} zoom={Number(a[1] ?? 1)} />;
    case "hand": return <D.HandShot t={t} side={a[0] as "L" | "R"} ink={a[1] === "ink"} hold={(a[2] ?? "none") as never} bg={e.mirrorSrc} />;
    case "cctv": return <D.Cctv t={t} src={e.cctvSrc} v={a[0] as never} clock={a[0] === "one" ? 3 * 3600 + 13 * 60 + 2 : a[0] === "two" ? 3 * 3600 + 13 * 60 + 9 : 3 * 3600 + 13 * 60 + 58} />;
    case "clock": return <D.Clock t={t} text={a[0]} />;
    case "tclock": return <D.TimeClock t={t} fails={Number(a[0])} />;
    case "phone": return <D.Phone t={t} from="점장님" msgs={["서준아. 지문 안 찍혔지.", "오늘 밤 3시 13분 전에\n매장으로 와.", "그래야 돌아와."]} times={[2.6, 6.0, 9.8]} />;
    case "roster": return <D.Roster t={t} />;
    case "log": return <D.LogBook t={t} mine={a[0] === "mine"} />;
    case "coins": return <D.Coins t={t} bg={e.mirrorSrc} />;
    case "hoodie": return <D.Hoodie t={t} bg={e.mirrorSrc} close={a[0] === "close"} />;
    case "switch": return <D.Switch t={t} />;
    case "static": return <D.Stock t={t} dur={dur} video src="lfhorror1/v/11999581.mp4" from={3} />;
    default: return <AbsoluteFill style={{ background: "#000" }} />;
  }
};

/** caption text with [red] key words */
const Marked: React.FC<{ text: string }> = ({ text }) => (
  <>{text.split(/(\[[^\]]+\])/).filter(Boolean).map((p, i) => p.startsWith("[")
    ? <span key={i} style={{ color: D.RED }}>{p.slice(1, -1)}</span> : <span key={i}>{p}</span>)}</>
);

export const LfhMain: React.FC<{ e: LfhEdit }> = ({ e }) => {
  loadFonts(); D.loadLfhFonts();
  const f = useCurrentFrame(), t = f / e.fps;
  const i = e.shots.findIndex((s) => t >= s.t0 && t < s.t1);
  const s = e.shots[Math.max(0, i)];
  const st = t - s.t0;
  // a quick dip to black between shots (8 frames), never a full black frame
  const cut = Math.min(st, s.t1 - t);
  const dip = cut < 0.12 ? 0.2 * (1 - cut / 0.12) : 0;
  const flick = 0.04 * (Math.sin(t * 47) > 0.96 ? 1 : 0) + 0.02 * Math.sin(t * 3.1);
  const cap = e.caps.find((c) => t >= c.t0 && t < c.t1);
  const card = e.cards.find((c) => t >= c.t && t < c.t + 2.3);
  const ttl = t >= e.title.t0 && t < e.title.t1 ? clamp(Math.min((t - e.title.t0) * 2.5, (e.title.t1 - t) * 3)) : 0;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {pic(s, st, e)}
      {s.nar ? <D.Narrator t={st} mood={s.nar.mood} flip={s.nar.flip} show={clamp(st * 3)} /> : null}
      <AbsoluteFill style={{ background: `rgba(0,0,0,${dip + Math.max(0, flick)})` }} />
      {card ? <D.ChapterCard t={t - card.t} n={card.n} title={card.title} /> : null}
      {ttl > 0 ? <AbsoluteFill style={{ background: `rgba(0,0,0,${0.7 * ttl})`, justifyContent: "center", alignItems: "center", opacity: ttl }}>
        <div style={{ fontFamily: TITLE, fontSize: 104, lineHeight: 1.2, color: "#f4f4f4", textAlign: "center", textShadow: "0 6px 30px #000" }}>
          {e.title.lines.map((l, k) => <div key={k}><Marked text={l} /></div>)}
        </div>
      </AbsoluteFill> : null}
      {cap ? <div style={{ position: "absolute", left: 0, right: 0, bottom: 64, textAlign: "center" }}>
        <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: 56, lineHeight: 1.25, color: cap.who === "nar" ? "#ffffff" : cap.who === "doc" ? "#f1e7c9" : "#cfe3ff",
          padding: "8px 26px", background: "rgba(0,0,0,.55)", borderRadius: 12, WebkitTextStroke: "2px #000", paintOrder: "stroke",
          opacity: clamp(prog(t, cap.t0, 0.08) * 1.0) }}>
          {cap.who === "nar" || cap.who === "doc" ? null : <span style={{ fontSize: 40, color: "#9fb4cc", marginRight: 14 }}>{({ boss: "점장", minho: "민호", daeri: "대리기사", noona: "주간 누나", guest: "손님" } as Record<string, string>)[cap.who]}</span>}
          <Marked text={cap.text} />
        </span>
      </div> : null}
      <Audio src={staticFile(e.audio)} />
    </AbsoluteFill>
  );
};
