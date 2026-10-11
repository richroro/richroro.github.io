// Voiceless "famous person's real words" story cards (quote1~, README "쇼츠: 유명인 감동 메시지"): the white card of
// lib/Card.tsx as it is (channel mark, black two-line title, rounded picture box, one caption line under it, music),
// plus two things the picture box can show instead of a photo:
//   "panel": our own typographic card (a year, an age, a number) on a flat colour, with an optional drawn doodle
//   "quote": the person's verified words: the Korean translation large, the original (English/German) small under it
// Both ride on the card items in edit.json, so ClipShort hands any card short that has them to QuoteShort; every
// other card short (deep, breath, story, how, wild, fact, moment) still goes straight to CardShort.
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { fitText } from "@remotion/layout-utils";
import type { ShortData } from "../ClipShort";
import { CARD_BOX, CardShort, line, type CardItem, type CardOpts } from "./Card";
import { BODY } from "./fonts";
import { eBack, eOut, prog } from "./fx";

const FPS = 30;
const INK = "#111";

export type QuotePanel = {
  /** the big word or number ("30살", "1802년") and an optional smaller line under it */
  big: string; small?: string;
  bg?: string; fg?: string;
  /** our own marker drawings: a basketball, a team list with a missing name, a sheet of music, a star field */
  doodle?: "ball" | "list" | "music" | "stars";
};
export type QuoteText = {
  /** the Korean translation, "/" breaks lines (shown large) */
  ko: string;
  /** the original words, as said or written (shown small) */
  orig: string;
  /** who said it, under the original ("스티브 잡스") */
  who: string;
  bg?: string; accent?: string;
};
type QItem = CardItem & { panel?: QuotePanel; quote?: QuoteText };

export const isQuoteShort = (o?: CardOpts) => !!o && (o.items as QItem[]).some((it) => it.panel || it.quote);

/** a basketball: orange disc and its seams, wobbling like a hand-drawn gif */
const Ball: React.FC<{ s: number; x: number; y: number; r: number }> = ({ s, x, y, r }) => (
  <g>
    <circle cx={x} cy={y} r={r} fill="#F28C28" stroke={INK} strokeWidth={9} />
    <path d={line([[x - r, y], [x, y + 3], [x + r, y]], s, 3)} stroke={INK} strokeWidth={7} fill="none" />
    <path d={line([[x, y - r], [x - 3, y], [x, y + r]], s + 1, 3)} stroke={INK} strokeWidth={7} fill="none" />
    <path d={`M${x - r * 0.7} ${y - r * 0.7} Q${x - r * 0.25} ${y} ${x - r * 0.7} ${y + r * 0.7}`} stroke={INK} strokeWidth={7} fill="none" />
    <path d={`M${x + r * 0.7} ${y - r * 0.7} Q${x + r * 0.25} ${y} ${x + r * 0.7} ${y + r * 0.7}`} stroke={INK} strokeWidth={7} fill="none" />
  </g>
);

const Doodle: React.FC<{ kind: NonNullable<QuotePanel["doodle"]>; f: number; w: number; h: number }> = ({ kind, f, w, h }) => {
  const s = Math.floor(f / (FPS / 8)) % 3 + 1;
  if (kind === "ball") return <svg width={w} height={h} style={{ position: "absolute", left: 0, top: 0 }}><Ball s={s} x={w - 170} y={h - 170} r={110} /></svg>;
  if (kind === "stars") {
    return (
      <svg width={w} height={h} style={{ position: "absolute", left: 0, top: 0 }}>
        {Array.from({ length: 70 }, (_, k) => {
          const x = ((Math.sin(k * 91.7) + 1) / 2) * w, y = ((Math.sin(k * 37.3 + 2) + 1) / 2) * h;
          const tw = 0.5 + 0.5 * Math.sin(f / 9 + k);
          return <circle key={k} cx={x} cy={y} r={2 + (k % 3)} fill="#fff" opacity={0.25 + 0.6 * tw} />;
        })}
      </svg>
    );
  }
  if (kind === "music") {
    // five staff lines over the bottom and a few notes, drawn by hand
    const y0 = h - 250;
    return (
      <svg width={w} height={h} style={{ position: "absolute", left: 0, top: 0 }}>
        {[0, 1, 2, 3, 4].map((k) => <path key={k} d={line([[60, y0 + k * 34], [w / 2, y0 + k * 34 + 2], [w - 60, y0 + k * 34]], s * 5 + k, 2)} stroke="rgba(0,0,0,.55)" strokeWidth={4} fill="none" />)}
        {[[220, 3], [360, 1], [500, 2], [640, 0], [780, 2]].map(([x, k]) => (
          <g key={x}>
            <ellipse cx={x} cy={y0 + k * 34 + 17} rx={24} ry={17} fill={INK} transform={`rotate(-20 ${x} ${y0 + k * 34 + 17})`} />
            <path d={line([[x + 22, y0 + k * 34 + 12], [x + 22, y0 + k * 34 - 110]], s + x, 2)} stroke={INK} strokeWidth={6} />
          </g>
        ))}
      </svg>
    );
  }
  // "list": a sheet with a title bar and six names as grey bars; the seventh row is empty with a red "?"
  const x0 = w - 400, y0 = 90;
  return (
    <svg width={w} height={h} style={{ position: "absolute", left: 0, top: 0 }}>
      <g transform={`rotate(4 ${x0 + 160} ${y0 + 300})`}>
        <path d={line([[x0, y0], [x0 + 320, y0], [x0 + 320, y0 + 600], [x0, y0 + 600], [x0, y0]], s, 3)} fill="#fff" stroke={INK} strokeWidth={8} />
        <rect x={x0 + 40} y={y0 + 40} width={240} height={34} rx={8} fill={INK} />
        {[0, 1, 2, 3, 4, 5].map((k) => <path key={k} d={line([[x0 + 40, y0 + 130 + k * 64], [x0 + 200 + (k % 3) * 30, y0 + 130 + k * 64]], s * 7 + k, 2)} stroke="#999" strokeWidth={16} strokeLinecap="round" />)}
        <text x={x0 + 130} y={y0 + 560} fontFamily={BODY} fontWeight={900} fontSize={70} fill="#E03131">?</text>
      </g>
    </svg>
  );
};

const PanelView: React.FC<{ p: QuotePanel; t: number; at: number; f: number; w: number; h: number }> = ({ p, t, at, f, w, h }) => {
  const k = eBack(prog(t, at, 0.4), 1.4);
  const side = p.doodle === "list" || p.doodle === "ball";
  const big = Math.min(220, ...p.big.split("\n").map((l) => fitText({ text: l, withinWidth: w - (side ? 480 : 140), fontFamily: BODY, fontWeight: 900 }).fontSize));
  return (
    <AbsoluteFill style={{ background: p.bg ?? "#FFE8A3" }}>
      {p.doodle ? <Doodle kind={p.doodle} f={f} w={w} h={h} /> : null}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: side ? "flex-start" : "center", flexDirection: "column", padding: 60, paddingRight: side ? 420 : 60, paddingBottom: p.doodle === "music" ? 330 : 60 }}>
        <div style={{ fontFamily: BODY, fontWeight: 900, fontSize: big, lineHeight: 1.05, color: p.fg ?? INK, letterSpacing: -4, textAlign: side ? "left" : "center", transformOrigin: side ? "0% 50%" : "50% 50%", transform: `scale(${0.6 + 0.4 * k})`, opacity: Math.min(1, k * 1.5), whiteSpace: "pre" }}>{p.big}</div>
        {p.small ? <div style={{ fontFamily: BODY, fontWeight: 800, fontSize: 52, color: p.fg ?? INK, opacity: 0.75 * eOut(prog(t, at + 0.25, 0.3)), marginTop: 22, textAlign: side ? "left" : "center", lineHeight: 1.3, whiteSpace: "pre-line", wordBreak: "keep-all" }}>{p.small}</div> : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** the quote: a big opening mark, the Korean lines rising in one after another, then the original and who said it */
const QuoteView: React.FC<{ q: QuoteText; t: number; at: number; w: number }> = ({ q, t, at, w }) => {
  const rows = q.ko.split("/").map((r) => r.trim()).filter(Boolean);
  const size = Math.min(76, ...rows.map((r) => fitText({ text: r, withinWidth: w - 130, fontFamily: BODY, fontWeight: 900 }).fontSize));
  const acc = q.accent ?? "#FFD43B";
  return (
    <AbsoluteFill style={{ background: q.bg ?? "#1c1f2b", padding: "0 64px", justifyContent: "center" }}>
      <svg width={170} height={130} viewBox="0 0 170 130" style={{ position: "absolute", left: 56, top: 56, opacity: 0.9 * eOut(prog(t, at, 0.3)) }}>
        {/* an opening quotation mark drawn as two filled commas (Pretendard's own glyph is straight) */}
        {[0, 88].map((x) => <path key={x} d={`M${x + 70} 8 C${x + 30} 18 ${x + 6} 48 ${x + 6} 88 a34 34 0 1 0 34 -34 C${x + 40} 40 ${x + 52} 26 ${x + 72} 20 Z`} fill={acc} />)}
      </svg>
      <div style={{ marginTop: 40 }}>
        {rows.map((r, i) => {
          const k = eOut(prog(t, at + 0.15 + i * 0.3, 0.35));
          return <div key={i} style={{ fontFamily: BODY, fontWeight: 900, fontSize: size, lineHeight: 1.32, color: "#fff", letterSpacing: -1, opacity: k, transform: `translateY(${(1 - k) * 30}px)`, whiteSpace: "pre" }}>{r}</div>;
        })}
        <div style={{ fontFamily: BODY, fontWeight: 700, fontSize: 34, lineHeight: 1.35, color: "rgba(255,255,255,.62)", marginTop: 34, fontStyle: "italic", opacity: eOut(prog(t, at + 0.3 + rows.length * 0.3, 0.4)) }}>{q.orig}</div>
        <div style={{ fontFamily: BODY, fontWeight: 800, fontSize: 40, color: acc, marginTop: 26, opacity: eOut(prog(t, at + 0.45 + rows.length * 0.3, 0.4)) }}>— {q.who}</div>
      </div>
    </AbsoluteFill>
  );
};

export const QuoteShort: React.FC<{ d: ShortData & { card?: CardOpts } }> = ({ d }) => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const o = d.card ?? { items: [] };
  const items = o.items as QItem[];
  const B = { ...CARD_BOX, ...(o.box ?? {}) };
  const i = items.length - 1 - [...items].reverse().findIndex((it) => t >= it.at);
  const it = items[Math.min(Math.max(i, 0), items.length - 1)];
  return (
    <AbsoluteFill>
      <CardShort d={d} />
      {it && (it.panel || it.quote) ? (
        <div style={{ position: "absolute", left: B.left, top: B.top, width: B.width, height: B.height, borderRadius: B.radius, overflow: "hidden" }}>
          {it.quote ? <QuoteView q={it.quote} t={t} at={it.at} w={B.width} /> : <PanelView p={it.panel!} t={t} at={it.at} f={f} w={B.width} h={B.height} />}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
