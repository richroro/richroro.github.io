// F1 story documentary, 1920×1080: "오디세우스는 왜 집까지 10년이나 걸렸을까?". Pictures only — the narration and
// music are mixed by longform/odyssey/mix.py and muxed after the render. Reads public/odyssey/edit.json and
// route.json (copied there by longform/odyssey/prep.sh), so the composition's length follows the edit.
//   stills: slow Ken Burns (3–5 %), 0.6 s crossfades, a dip to black at each scene, a warm grade on prints
//   on top: one caption line at the bottom, the chapter in small type top left, the picture's credit top right
import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, type CalculateMetadataFunction } from "remotion";
import { BODY, TITLE, loadFonts } from "../fonts";
import { clamp, eInOut, eOut, prog } from "../fx";
import { BedTree, Card, Curse, EndCard, Fleet, TitleCard, Years } from "./f1_Graphics";
import { RouteMap, WorldKorea } from "./f1_RouteMap";
import type { F1Edit, F1Route, F1Shot } from "./f1_types";

export const F1_FPS = 30;
const W = 1920, H = 1080, XF = 0.6, INK = "#F6EBD2";

export type F1Props = { edit: F1Edit | null; route: F1Route | null };

export const f1Metadata: CalculateMetadataFunction<F1Props> = async () => {
  const [edit, route] = await Promise.all([
    fetch(staticFile("odyssey/edit.json")).then((r) => r.json() as Promise<F1Edit>),
    fetch(staticFile("odyssey/route.json")).then((r) => r.json() as Promise<F1Route>),
  ]);
  return { durationInFrames: Math.ceil(edit.duration * F1_FPS), props: { edit, route } };
};

const GRADE = {
  print: "sepia(.55) saturate(.85) brightness(.7) contrast(1.2)",
  colour: "brightness(.86) contrast(1.06) saturate(.95)",
};

const Still: React.FC<{ s: F1Shot; t: number }> = ({ s, t }) => {
  const k = eInOut(clamp((t - s.t0) / Math.max(1, s.t1 - s.t0 + XF)));
  const z0 = s.z ?? 1.1;
  const mv = s.move ?? "in";
  const z = mv === "out" ? z0 * (1.045 - 0.045 * k) : mv === "in" ? z0 * (1 + 0.045 * k) : z0 * (1 + 0.02 * k);
  const pan = 0.022 * (2 * k - 1);
  const dx = mv === "l" ? -pan : mv === "r" ? pan : 0, dy = mv === "u" ? -pan : mv === "d" ? pan : 0;
  const cx = (s.cx ?? 0.5) * 100, cy = (s.cy ?? 0.5) * 100;
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#000" }}>
      <Img src={staticFile(`odyssey/img/${s.img}.jpg`)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${cx}% ${cy}%`,
        transformOrigin: `${cx}% ${cy}%`, transform: `translate(${dx * W}px, ${dy * H}px) scale(${z})`, filter: GRADE[s.tone ?? "print"] }} />
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 46%, rgba(0,0,0,0) 45%, rgba(0,0,0,.62) 100%)" }} />
    </AbsoluteFill>
  );
};

const Shot: React.FC<{ s: F1Shot; t: number; e: F1Edit; route: F1Route }> = ({ s, t, e, route }) => {
  switch (s.kind) {
    case "img": return <Still s={s} t={t} />;
    case "map": return <RouteMap s={s} t={t} route={route} />;
    case "world": case "korea": return <WorldKorea s={s} t={t} route={route} />;
    case "years": return <Years s={s} t={t} />;
    case "curse": return <Curse s={s} t={t} />;
    case "card": return <Card s={s} t={t} />;
    case "fleet": return <Fleet s={s} t={t} />;
    case "bedtree": return <BedTree s={s} t={t} />;
    case "title": return <TitleCard s={s} t={t} title={e.title} />;
    case "end": return <EndCard s={s} t={t} title={e.title} />;
    default: return null;
  }
};

export const F1Odyssey: React.FC<F1Props> = ({ edit, route }) => {
  loadFonts();
  const t = useCurrentFrame() / F1_FPS;
  if (!edit || !route) return <AbsoluteFill style={{ background: "#000" }} />;
  const shots = edit.shots;
  let i = shots.findIndex((s) => t >= s.t0 && t < s.t1);
  if (i < 0) i = shots.length - 1;
  const cur = shots[i], prev = i > 0 ? shots[i - 1] : null;
  const chapters = edit.chapters;
  const ch = [...chapters].reverse().find((c) => t >= c.start) ?? chapters[0];
  const sceneCut = chapters.some((c) => c.start > 0 && Math.abs(c.start - cur.t0) < 0.01);
  const fadeIn = sceneCut ? 1 : eOut(prog(t, cur.t0, XF));
  // a dip towards black around every scene change (only a third of the way: the long-form QA treats near-black frames as a fault)
  let dip = 0;
  for (const c of chapters) if (c.start > 0) dip = Math.max(dip, 1 - Math.abs(t - c.start) / 0.45);
  dip = 0.35 * clamp(dip);
  const cap = edit.captions.find((c) => t >= c.t0 && t < c.t1);
  const card = ch.card && ch.start > 0 ? ch : null;
  const cardA = card ? clamp(prog(t, card.start + 0.25, 0.5)) * (1 - prog(t, card.start + 2.9, 0.5)) : 0;
  const special = cur.kind === "title" || cur.kind === "end";
  const credit = cur.kind === "img" ? cur.credit : null;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {prev && fadeIn < 1 ? <Shot s={prev} t={t} e={edit} route={route} /> : null}
      <AbsoluteFill style={{ opacity: fadeIn }}><Shot s={cur} t={t} e={edit} route={route} /></AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(to top, rgba(0,0,0,.66) 0%, rgba(0,0,0,0) 22%)" }} />
      {!special ? (
        <div style={{ position: "absolute", left: 46, top: 36, fontFamily: BODY, fontWeight: 800, fontSize: 25, color: INK, opacity: 0.82, textShadow: "0 2px 6px #000", letterSpacing: 1 }}>
          <span style={{ color: "#F2C66D" }}>{String(ch.group).padStart(2, "0")}</span>&nbsp;&nbsp;{ch.groupLabel}
        </div>
      ) : null}
      {credit ? (
        <div style={{ position: "absolute", right: 46, top: 40, fontFamily: BODY, fontWeight: 700, fontSize: 19, color: "#d9d0bb", opacity: 0.7, textShadow: "0 1px 4px #000" }}>{credit}</div>
      ) : null}
      {cardA > 0 && card ? (
        <AbsoluteFill style={{ justifyContent: "center", paddingLeft: 140, opacity: cardA }}>
          <div style={{ fontFamily: BODY, fontWeight: 800, fontSize: 40, color: "#F2C66D", textShadow: "0 3px 10px #000" }}>{String(card.group).padStart(2, "0")}</div>
          <div style={{ fontFamily: TITLE, fontSize: 88, color: INK, textShadow: "0 4px 18px #000", transform: `translateX(${-20 * (1 - cardA)}px)` }}>{card.groupLabel}</div>
        </AbsoluteFill>
      ) : null}
      {cap && !special ? (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 64, textAlign: "center" }}>
          <span style={{ fontFamily: BODY, fontWeight: 800, fontSize: 48, color: "#fff", padding: "6px 22px", borderRadius: 10, background: "rgba(0,0,0,.38)",
            textShadow: "0 2px 6px #000, 0 0 2px #000" }}>{cap.text}</span>
        </div>
      ) : null}
      <AbsoluteFill style={{ background: "#000", opacity: dip }} />
    </AbsoluteFill>
  );
};
