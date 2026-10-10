// Drawn story scenes on a 16:9 stage, for 썰 and 괴담 long-forms. The pieces are the shorts' own (lib/Sseol.tsx):
// the backdrop, the time-skip card, the big slam word and the group-chat phone come from Scene with no characters, the
// characters are Mochi (or the doodle skin), and Post is the community-post hook card. Only the placement is new:
// characters stand left and right across 1920 px, speech bubbles sit over the speaker, all above the caption band.
import React from "react";
import { fitText, measureText } from "@remotion/layout-utils";
import { AbsoluteFill } from "remotion";
import { BODY } from "../fonts";
import { clamp, eBack, eInOut, prog } from "../fx";
import { Marked } from "../Marked";
import { Mochi, Post, Scene } from "../Sseol";
import type { SceneSpec } from "./types";
import type { PostG } from "../Sseol";

const INK = "#1b1b1f";
const W = 1920;
const XS: Record<number, number[]> = { 1: [0.5], 2: [0.3, 0.7], 3: [0.2, 0.5, 0.8], 4: [0.14, 0.38, 0.62, 0.86] };
const XS_CHAT: Record<number, number[]> = { 1: [0.32], 2: [0.17, 0.44], 3: [0.12, 0.3, 0.48], 4: [0.1, 0.24, 0.38, 0.52] };
const SIZE: Record<number, number> = { 1: 440, 2: 400, 3: 340, 4: 290 };

/** the speech bubble over the speaker, its tail pointing down at them; it pops in at `at` */
const Bubble: React.FC<{ text: string; sx: number; head: number; t: number; at: number }> = ({ text, sx, head, t, at }) => {
  const plain = text.replace(/[[\]{}]/g, ""), maxW = 860, pad = 40;
  const fs = Math.max(44, Math.min(62, fitText({ text: plain, withinWidth: (maxW - 2 * pad) * 1.8, fontFamily: BODY, fontWeight: "900" }).fontSize));
  const tw = measureText({ text: plain, fontFamily: BODY, fontSize: fs, fontWeight: "900" }).width;
  const w = Math.min(maxW, tw + 2 * pad + 16), rows = Math.ceil(tw / (maxW - 2 * pad - 10));
  const bh = rows * fs * 1.25 + 52;
  const left = clamp(sx - w / 2, 40, W - 40 - w), top = Math.max(70, head - bh - 56);
  const tail = clamp(sx - left - 30, 34, w - 94);
  const s = eBack(prog(t, at, 0.26), 2.2);
  return (
    <div style={{ position: "absolute", left, top, width: w, transform: `scale(${s})`, transformOrigin: `${tail + 30}px 100%`, opacity: clamp(s * 2) }}>
      <div style={{ position: "relative", background: "white", border: `6px solid ${INK}`, borderRadius: 38, padding: `20px ${pad}px`, boxShadow: `8px 8px 0 ${INK}`,
        fontFamily: BODY, fontWeight: 900, fontSize: fs, lineHeight: 1.25, color: INK, textAlign: "center", wordBreak: "keep-all" }}>
        <Marked text={text} color="#e8212e" />
        <svg width={60} height={50} style={{ position: "absolute", left: tail - 6, bottom: -46 }} viewBox="0 0 60 50">
          <path d="M6 0 L30 46 L54 0 Z" fill="white" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
          <rect x={4} y={-6} width={52} height={10} fill="white" />
        </svg>
      </div>
    </div>
  );
};

export const Stage: React.FC<{ g: SceneSpec; t: number }> = ({ g, t }) => {
  const n = g.chars.length, chat = !!g.chat;
  const size = g.size ?? SIZE[Math.min(4, Math.max(1, n))], floor = g.floor ?? 880;
  const xs = g.chars.map((c, i) => c.x ?? (chat ? XS_CHAT : XS)[Math.min(4, Math.max(1, n))][Math.min(i, 3)]);
  const sz = g.chars.map((c) => size * (c.size ?? 1));
  const turned = g.turn != null && t >= g.turn;
  const z = 1 + ((g.zoom ?? 1) - 1) * eInOut(prog(t, 0, 3));
  const fx = g.focus != null ? xs[g.focus] * W : W / 2;
  const say = [...g.says].reverse().find((s) => t >= s.at && (s.to == null || t < s.to));
  const px = (g.propX ?? (n === 1 ? Math.min(0.85, xs[0] + 0.24) : 0.5)) * W;
  const msgAt = (g.chat?.msgs ?? []).map((m, i) => m.at ?? 0.2 + 0.6 * i);
  const ps = g.prop ? eBack(prog(t, g.propAt ?? 0.1, 0.3), 2.4) : 0;
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#000" }}>
      <AbsoluteFill style={{ transform: `scale(${z})`, transformOrigin: `${fx}px ${floor - size / 2}px` }}>
        {/* the shorts' backdrop, drawn across the whole 1920 px box (walls and floors stretch, furniture keeps its place) */}
        <Scene g={{ chars: [], bg: g.bg, sign: g.sign, photo: g.photo ?? undefined, photoFit: "cover" }} t={t} h={1080} />
        {g.prop ? (
          <div style={{ position: "absolute", left: px, top: floor - size * 0.75, fontSize: 200, lineHeight: 1, whiteSpace: "nowrap",
            transform: `translateX(-50%) scale(${ps}) rotate(${6 * Math.sin(t * 4)}deg)`, filter: "drop-shadow(0 10px 10px rgba(0,0,0,.25))" }}>{g.prop}</div>
        ) : null}
        {g.chars.map((c, i) => (
          <div key={i} style={{ position: "absolute", left: xs[i] * W - sz[i] / 2, top: floor - sz[i], width: sz[i], height: sz[i] }}>
            <Mochi c={c} i={i} t={turned && c.to ? t - (g.turn ?? 0) : t} size={sz[i]} mood={turned && c.to ? c.to : c.mood} />
            {c.name ? (
              <div style={{ position: "absolute", left: -120, right: -120, top: sz[i] + 2, textAlign: "center" }}>
                <span style={{ fontFamily: BODY, fontWeight: 900, fontSize: 32, color: "white", background: INK, borderRadius: 12, padding: "3px 16px" }}>{c.name}</span>
              </div>
            ) : null}
          </div>
        ))}
      </AbsoluteFill>
      {chat ? (
        // the shorts' phone, in a 1080 px box at the right, a bit smaller so it clears the captions
        <div style={{ position: "absolute", left: W - 1080, top: 0, width: 1080, height: 1080, transform: "scale(.82)", transformOrigin: "100% 0" }}>
          <Scene g={{ chars: [], bg: "transparent", chat: g.chat, steps: [1e9, 1e9, 1e9, 1e9, ...msgAt] }} t={t} h={1080} />
        </div>
      ) : null}
      {say && g.chars[say.who] ? (
        <Bubble key={say.at} text={say.text} sx={xs[say.who] * W} head={floor - sz[say.who] * z} t={t} at={say.at} />
      ) : null}
      {g.place ? (
        <div style={{ position: "absolute", left: 40, top: 112, fontFamily: BODY, fontWeight: 900, fontSize: 36, color: INK, background: "white", border: `5px solid ${INK}`,
          borderRadius: 999, padding: "4px 22px", boxShadow: `5px 5px 0 ${INK}` }}>{g.place}</div>
      ) : null}
      {g.big || g.card ? (
        <AbsoluteFill>
          <Scene g={{ chars: [], bg: "transparent", big: g.big, card: g.card, steps: [1e9, 1e9, 1e9, g.bigAt ?? 0.1] }} t={t} h={1080} />
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};

/** the community-post hook card, centred on a 16:9 stage */
export const PostStage: React.FC<{ g: PostG & { steps?: number[] }; t: number }> = ({ g, t }) => (
  <AbsoluteFill style={{ background: "#eef0f4" }}>
    <div style={{ position: "absolute", left: (W - 1080) / 2, top: 0, width: 1080, height: 1080, transform: "scale(.9)", transformOrigin: "50% 0" }}>
      <Post g={g} t={t} />
    </div>
  </AbsoluteFill>
);
