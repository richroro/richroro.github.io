// lfsaeyeon1 (사연툰 "반찬통 이름표"): the 1920×1080 thumbnail. A black top band with the hook in two lines (the prop
// word in green, the result word in red), and under it the fight at the fridge: 나 (angry), 남편 (ears red) holding up
// the steel box labelled 엄마, and his bubble. Nothing in it gives away why.
import React from "react";
import { BODY, TITLE } from "../fonts";
import { Toon } from "./lfsaeyeon1_cast";
import { Box, H, W } from "./lfsaeyeon1_set";
import { SyStage } from "./lfsaeyeon1_stage";

const INK = "#1b1b1f";

export const SyThumb: React.FC = () => (
  <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, overflow: "hidden", background: "#d8e9f5" }}>
    <div style={{ position: "absolute", left: 0, top: 120, width: W, height: H }}>
      <SyStage g={{ bg: "fridge", prop: "label_many", cast: [] }} t={3} />
    </div>
    <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,.25)" }} />
    {/* the steel box, big, held up between them */}
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", left: 0, top: 0 }}>
      <defs><linearGradient id="sy-steel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#eef1f5" /><stop offset="0.5" stopColor="#b8c0ca" /><stop offset="1" stopColor="#dfe4ea" /></linearGradient></defs>
      <g transform="translate(1040 900) rotate(-6) scale(1.6)"><Box x={0} y={0} kind="steel" w={300} h={190} label="엄마" ls={86} hi /></g>
    </svg>
    <div style={{ position: "absolute", left: 120, top: 520, width: 560, height: 560 }}><Toon who="ji" mood="angry" k={0} t={0.6} size={560} /></div>
    <div style={{ position: "absolute", left: 1330, top: 520, width: 560, height: 560 }}><Toon who="do" mood="shy" f={{ redears: 1 }} k={1} t={0.6} size={560} /></div>
    {/* his bubble */}
    <div style={{ position: "absolute", left: 1190, top: 300, width: 690, background: "white", border: `8px solid ${INK}`, borderRadius: 44, boxShadow: `10px 10px 0 ${INK}`, padding: "20px 30px",
      fontFamily: BODY, fontWeight: 900, fontSize: 76, lineHeight: 1.15, color: INK, textAlign: "center" }}>
      엄마 거야.<br /><span style={{ color: "#e8212e" }}>손대지 마.</span>
      <svg width={70} height={60} style={{ position: "absolute", left: 420, bottom: -56 }} viewBox="0 0 60 50"><path d="M6 0 L30 46 L54 0 Z" fill="white" stroke={INK} strokeWidth={6} strokeLinejoin="round" /><rect x={4} y={-6} width={52} height={10} fill="white" /></svg>
    </div>
    {/* her bubble */}
    <div style={{ position: "absolute", left: 60, top: 330, background: "white", border: `8px solid ${INK}`, borderRadius: 44, boxShadow: `10px 10px 0 ${INK}`, padding: "14px 34px",
      fontFamily: BODY, fontWeight: 900, fontSize: 80, color: INK }}>
      내 냉장고에?!
      <svg width={70} height={60} style={{ position: "absolute", left: 300, bottom: -56 }} viewBox="0 0 60 50"><path d="M6 0 L30 46 L54 0 Z" fill="white" stroke={INK} strokeWidth={6} strokeLinejoin="round" /><rect x={4} y={-6} width={52} height={10} fill="white" /></svg>
    </div>
    {/* the top band */}
    <div style={{ position: "absolute", left: 0, top: 0, width: W, height: 270, background: INK, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 4 }}>
      <div style={{ fontFamily: TITLE, fontSize: 112, lineHeight: 1.05, color: "white" }}>반찬통마다 <span style={{ color: "#3ddc6a" }}>이름표</span> 붙인 남편</div>
      <div style={{ fontFamily: TITLE, fontSize: 112, lineHeight: 1.05, color: "white" }}>결국 <span style={{ color: "#ff3b3b" }}>각방</span> 썼습니다</div>
    </div>
  </div>
);
