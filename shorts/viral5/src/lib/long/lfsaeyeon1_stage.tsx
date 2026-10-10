// lfsaeyeon1 (사연툰 "반찬통 이름표"): one cut of the story on the 1920×1080 stage: the drawn set, a prop, the cast
// standing on the floor, a speech bubble over whoever speaks, a slam word, a place tag, a time card, a chat phone.
// The long-form kit's 썰 scene calls this for clips whose gfx type is "lfsaeyeon1" (src/lib/long/lfsaeyeon1_*.tsx).
import React from "react";
import { fitText, measureText } from "@remotion/layout-utils";
import type { Mood } from "../Sseol";
import { BODY, TITLE } from "../fonts";
import { clamp, eBack, eInOut, eOut, prog } from "../fx";
import { Marked } from "../Marked";
import { LOOK, Toon, type Flags, type Who } from "./lfsaeyeon1_cast";
import { FLOOR, H, Prop, Set as Backdrop, W } from "./lfsaeyeon1_set";

const INK = "#1b1b1f";
export type SyCast = { who: Who; mood: Mood; to?: Mood; f?: Flags };
export type SyScene = {
  bg: string; place?: string; cast: SyCast[]; prop?: string; card?: string; big?: string; zoom?: number; focus?: number;
  /** the speaker's bubble: who is an index into cast (-1: an off-screen voice, shown as a bubble from the edge) */
  say?: { who: number; text: string; at?: number; name?: string; color?: string };
  /** seconds into the cut: the mood switch (cast[].to) and the slam word */
  swAt?: number; bigAt?: number;
  chat?: { title: string; msgs: { name?: string; text: string; me?: boolean; at?: number }[] };
  /** the same set-up as the cut before: no wipe, nobody re-enters, the camera moves on from zoomFrom */
  hold?: boolean; zoomFrom?: number;
};

const FRIDGE_STOCK = new Set(["label_many", "label_more", "label_one", "ketchup", "boxes_half", "box_empty", "box_mom", "box_ji"]);
const FRIDGE_ONLY = new Set(["label_many", "label_more", "label_one", "ketchup", "boxes_half", "box_empty"]);

/** a phone chat on the right (no real app's look) */
const ChatPhone: React.FC<{ c: NonNullable<SyScene["chat"]>; t: number }> = ({ c, t }) => (
  <div style={{ position: "absolute", left: 1180, top: 60, width: 560, height: 820, background: INK, borderRadius: 60, padding: 16, boxSizing: "border-box", boxShadow: "0 18px 40px rgba(0,0,0,.3)" }}>
    <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 46, overflow: "hidden", background: "#cfe0ee" }}>
      <div style={{ height: 100, background: "#a9c4da", display: "flex", alignItems: "center", padding: "10px 30px 0", boxSizing: "border-box", fontFamily: BODY, fontWeight: 900, fontSize: 40, color: INK }}>‹ {c.title}</div>
      <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 18 }}>
        {c.msgs.map((m, i) => {
          const p = prog(t, m.at ?? 0.3 + i * 0.9, 0.25);
          return p <= 0 ? null : (
            <div key={i} style={{ alignSelf: m.me ? "flex-end" : "flex-start", maxWidth: 400, opacity: clamp(p * 2), transform: `scale(${0.6 + 0.4 * eBack(p, 2)})`, transformOrigin: m.me ? "100% 0" : "0 0" }}>
              {m.me ? null : <div style={{ fontFamily: BODY, fontWeight: 800, fontSize: 30, color: "#33414d", marginBottom: 6 }}>{m.name}</div>}
              <div style={{ background: m.me ? "#c8f5a8" : "white", borderRadius: 26, padding: "16px 22px", fontFamily: BODY, fontWeight: 800, fontSize: 38, lineHeight: 1.3, color: INK, border: `3px solid ${INK}`, wordBreak: "keep-all" }}>
                <Marked text={m.text} color="#e8212e" /></div>
            </div>
          );
        })}
      </div>
    </div>
  </div>
);

export const SyStage: React.FC<{ g: SyScene; t: number }> = ({ g, t }) => {
  const n = g.cast.length;
  const alone = n === 0;
  const hasSide = !!g.chat || (!!g.prop && g.bg !== "fridge" && !FRIDGE_ONLY.has(g.prop));
  const size = g.bg === "fridge" ? 400 : n === 1 ? 470 : n === 2 ? 430 : 380;
  const fridgeClose = g.bg === "fridge" && (g.prop === "box_mom" || g.prop === "box_ji");
  const xs = g.cast.map((_, i) => (fridgeClose ? (n === 1 ? 0.18 : [0.16, 0.84, 0.5][i]) : g.bg === "fridge" ? (n === 1 ? 0.14 : n === 2 ? [0.13, 0.87][i] : [0.12, 0.88, 0.5][i]) : hasSide
    ? (n === 1 ? 0.3 : n === 2 ? [0.18, 0.44][i] : [0.13, 0.33, 0.53][i])
    : (n === 1 ? 0.5 : n === 2 ? [0.3, 0.7][i] : [0.22, 0.5, 0.78][i])) * W);
  const foot = FLOOR - 16;
  const swAt = g.swAt ?? 1e9;
  const z0 = g.hold ? (g.zoomFrom ?? g.zoom ?? 1) : 1, z = z0 + ((g.zoom ?? 1) - z0) * eInOut(prog(t, 0, 4));
  const fx = g.focus != null && xs[g.focus] != null ? xs[g.focus] : W / 2;
  const fy = n ? foot - size * 0.6 : H / 2;

  // the bubble over its speaker, kept on screen, its tail pointing down at them
  let bub: null | { left: number; top: number; w: number; fs: number; tail: number; lines: number } = null;
  if (g.say && g.say.text) {
    const text = g.say.text.replace(/[[\]{}]/g, ""), maxW = 1000, pad = 50;
    const one = fitText({ text, withinWidth: maxW - 2 * pad, fontFamily: BODY, fontWeight: "900" }).fontSize;
    const fs = Math.max(56, Math.min(80, one >= 64 ? one : one * 1.8));
    const tw = measureText({ text, fontFamily: BODY, fontSize: fs, fontWeight: "900" }).width;
    const lines = Math.ceil(tw / ((maxW - 2 * pad) * 0.94));
    const w = Math.min(maxW, (lines > 1 ? tw / lines * 1.16 : tw) + 2 * pad + 30);
    const sx = g.say.who >= 0 && xs[g.say.who] != null ? xs[g.say.who] : W - 260;
    const left = clamp(sx - w / 2, 30, W - 30 - w);
    const bh = lines * fs * 1.25 + 56;
    const headTop = g.say.who >= 0 && xs[g.say.who] != null ? foot - size : 420;
    bub = { left, top: Math.max(g.say.who < 0 ? 60 : 20, headTop - bh - 50), w, fs, tail: clamp(sx - left - 30, 40, w - 100), lines };
  }
  const bp = bub ? eBack(prog(t, g.say?.at ?? 0.05, 0.28), 2.2) : 0;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${z})`, transformOrigin: `${fx}px ${fy}px` }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", left: 0, top: 0 }}>
          <defs><linearGradient id="sy-steel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#eef1f5" /><stop offset="0.5" stopColor="#b8c0ca" /><stop offset="1" stopColor="#dfe4ea" /></linearGradient></defs>
          <Backdrop bg={g.bg} stock={g.prop} t={t} crowd={n} />
          {g.prop && !(g.bg === "fridge" && FRIDGE_STOCK.has(g.prop)) ? <Prop kind={g.prop} t={t} alone={alone} /> : null}
        </svg>
        {g.chat ? <ChatPhone c={g.chat} t={t} /> : null}
        {g.cast.map((c, i) => {
          const sw = !!c.to && t >= swAt;
          return (
            <div key={i} style={{ position: "absolute", left: xs[i] - size / 2, top: foot - size, width: size, height: size }}>
              <Toon who={c.who} k={i} mood={sw ? c.to! : c.mood} f={c.f} t={sw ? t - swAt : g.hold ? t + 5 : t} size={size} />
              <div style={{ position: "absolute", left: -100, right: -100, top: size - 6, textAlign: "center" }}>
                <span style={{ fontFamily: BODY, fontWeight: 900, fontSize: 40, color: "white", background: LOOK[c.who].cloth, border: `4px solid ${INK}`, borderRadius: 14, padding: "2px 18px" }}>{LOOK[c.who].name}</span>
              </div>
            </div>
          );
        })}
      </div>
      {g.place ? (
        <div style={{ position: "absolute", left: 40, top: 34, fontFamily: BODY, fontWeight: 900, fontSize: 46, color: INK, background: "white", border: `5px solid ${INK}`, borderRadius: 999, padding: "6px 28px", boxShadow: `5px 5px 0 ${INK}`, opacity: prog(t, 0, 0.2) }}>{g.place}</div>
      ) : null}
      {g.big ? (
        <div style={{ position: "absolute", left: 0, right: 0, top: 120, textAlign: "center", fontFamily: TITLE, fontSize: 190, lineHeight: 1, color: "#FFE14D", WebkitTextStroke: "20px black", paintOrder: "stroke",
          transform: `scale(${eBack(prog(t, g.bigAt ?? 0.25, 0.3), 2.4)}) rotate(-4deg)`, filter: "drop-shadow(0 10px 14px rgba(0,0,0,.35))" }}><Marked text={g.big} color="#ff4d6d" /></div>
      ) : null}
      {bub && g.say ? (
        <div style={{ position: "absolute", left: bub.left, top: bub.top, width: bub.w, transform: `scale(${bp})`, transformOrigin: `${bub.tail + 30}px 100%`, opacity: clamp(bp * 2) }}>
          <div style={{ position: "relative", background: "white", border: `6px solid ${INK}`, borderRadius: 44, padding: "22px 46px", boxShadow: `8px 8px 0 ${INK}`,
            fontFamily: BODY, fontWeight: 900, fontSize: bub.fs, lineHeight: 1.25, color: INK, textAlign: "center", wordBreak: "keep-all" }}>
            {g.say.who < 0 && g.say.name ? <div style={{ position: "absolute", left: 24, top: -34, fontSize: 36, color: "white", background: g.say.color ?? INK, border: `4px solid ${INK}`, borderRadius: 12, padding: "0 14px", lineHeight: 1.3 }}>{g.say.name}</div> : null}
            <Marked text={g.say.text} color="#e8212e" />
            <svg width={60} height={50} style={{ position: "absolute", left: bub.tail - 6, bottom: -46 }} viewBox="0 0 60 50">
              <path d="M6 0 L30 46 L54 0 Z" fill="white" stroke={INK} strokeWidth={6} strokeLinejoin="round" /><rect x={4} y={-6} width={52} height={10} fill="white" />
            </svg>
          </div>
        </div>
      ) : null}
      {g.card ? (
        <div style={{ position: "absolute", inset: 0, display: "flex", justifyContent: "center", alignItems: "center", background: `rgba(0,0,0,${0.55 * prog(t, 0, 0.15)})` }}>
          <div style={{ fontFamily: TITLE, fontSize: 150, color: "white", WebkitTextStroke: "16px black", paintOrder: "stroke", transform: `scale(${eBack(prog(t, 0, 0.3), 2)})`, opacity: 1 - prog(t, 1.6, 0.3) }}>{g.card}</div>
        </div>
      ) : null}
      {/* the cut opens on a short wipe so a new picture always reads as new */}
      {g.hold ? null : <div style={{ position: "absolute", inset: 0, background: "white", opacity: 0.6 * (1 - eOut(prog(t, 0, 0.12))), pointerEvents: "none" }} />}
    </div>
  );
};
