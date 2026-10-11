// Richer drawn places for the story scenes (lib/Sseol.tsx `bg`): a Korean barbecue restaurant hall and its staff back room,
// drawn here so the same room reads the same in every scene (the senior twist drama "senior1"). No real shop's name or look.
// Hooked from Sseol.tsx's Backdrop: a `bg` listed in PLACES is drawn by <Place>; every other `bg` is drawn as before.
import React from "react";
import { BODY } from "./fonts";

const INK = "#1b1b1f";

export const PLACES = new Set(["gogi", "gogiNight", "gogiBack"]);

/** h is the scene's layout height; the floor line is h - 260, as in Sseol.tsx's own backdrops */
export const Place: React.FC<{ kind: string; h: number; t?: number }> = ({ kind, h, t = 0 }) => {
  const F = h - 260;
  const box = (st: React.CSSProperties, k?: number | string) => <div key={k} style={{ position: "absolute", ...st }} />;
  if (kind === "gogiBack") return (
    <>
      {box({ inset: 0, background: "linear-gradient(180deg,#e9e4d6,#d9d2bf)" })}
      {/* fluorescent tube */}
      {box({ left: 300, top: 40, width: 480, height: 26, borderRadius: 13, background: "#fbfff4", boxShadow: "0 0 60px 20px rgba(240,255,220,.55)" })}
      {/* shelves with boxes */}
      {[230, 430, 630].map((y, k) => (
        <React.Fragment key={k}>
          {box({ left: 40, top: y, width: 420, height: 18, background: "#8a8f96", borderRadius: 4 })}
          {[0, 1, 2, 3].map((j) => box({ left: 56 + j * 100, top: y - 90 + ((j + k) % 2) * 20, width: 86, height: 90 - ((j + k) % 2) * 20, background: ["#c9a46a", "#b8905a", "#d8b77c"][(j + k) % 3], border: `4px solid ${INK}`, borderRadius: 6 }, `b${k}${j}`))}
        </React.Fragment>
      ))}
      {box({ left: 40, top: 230, width: 14, height: F - 230, background: "#8a8f96" })}{box({ left: 446, top: 230, width: 14, height: F - 230, background: "#8a8f96" })}
      {/* steel door with a round window */}
      {box({ right: 70, top: 200, width: 300, height: F - 200, background: "linear-gradient(90deg,#b9c0c8,#d6dce2)", border: `6px solid ${INK}`, borderRadius: "10px 10px 0 0" })}
      {box({ right: 160, top: 280, width: 120, height: 120, borderRadius: 60, background: "radial-gradient(circle at 40% 40%,#ffe9b8,#f2a85a)", border: `6px solid ${INK}` })}
      {/* floor */}
      {box({ left: 0, right: 0, top: F, bottom: 0, background: "repeating-linear-gradient(90deg,#9ea3a6 0 118px,#8f9497 118px 120px)" })}
      {box({ left: 0, right: 0, top: F - 10, height: 14, background: "rgba(0,0,0,.14)" })}
    </>
  );
  const night = kind === "gogiNight";
  return (
    <>
      {/* upper wall cream, wainscot wood */}
      {box({ inset: 0, background: night ? "linear-gradient(180deg,#5a4636,#4a382b)" : "linear-gradient(180deg,#f5e6c8,#ecd6ae)" })}
      {box({ left: 0, right: 0, top: F - 300, height: 300, background: night ? "#3a2618" : "repeating-linear-gradient(90deg,#8a5a36 0 88px,#7a4e2e 88px 92px)" })}
      {box({ left: 0, right: 0, top: F - 312, height: 16, background: "#5c3a22" })}
      {/* window onto the night street, a string of warm bulbs */}
      {box({ left: 40, top: 170, width: 380, height: F - 520, minHeight: 260, background: "linear-gradient(180deg,#1d2552,#3b3f7a)", border: "16px solid #6b4426", borderRadius: 8 })}
      {Array.from({ length: 7 }, (_, k) => box({ left: 70 + k * 50, top: 210 + 24 * Math.sin(k * 0.9), width: 20, height: 20, borderRadius: 10,
        background: "#ffd27a", boxShadow: `0 0 ${18 + 6 * Math.sin(t * 3 + k)}px 6px rgba(255,200,110,.7)` }, `l${k}`))}
      {/* exhaust hoods hanging over the tables */}
      {[220, 540, 860].map((x, k) => (
        <React.Fragment key={`h${k}`}>
          {box({ left: x - 28, top: 0, width: 56, height: F - 460, background: "linear-gradient(90deg,#9aa3ad,#e6ebf0,#9aa3ad)", borderLeft: `4px solid ${INK}`, borderRight: `4px solid ${INK}` })}
          {box({ left: x - 90, top: F - 470, width: 180, height: 90, background: "linear-gradient(90deg,#9aa3ad,#eef2f6,#9aa3ad)", border: `5px solid ${INK}`, clipPath: "polygon(30% 0,70% 0,100% 100%,0 100%)" })}
        </React.Fragment>
      ))}
      {/* menu board (generic dishes, no prices that read as a real shop) */}
      <div style={{ position: "absolute", right: 40, top: 150, width: 440, boxSizing: "border-box", padding: "22px 20px", background: night ? "#22160e" : "#3b2a1c", border: "14px solid #9b6a3c", borderRadius: 10,
        fontFamily: BODY, fontWeight: 900, fontSize: 50, lineHeight: 1.38, color: "#ffe2a1", textAlign: "center", boxShadow: "0 12px 0 rgba(0,0,0,.18)" }}>
        <div style={{ fontSize: 40, color: "#ff9a5c", letterSpacing: 6 }}>차림표</div>
        <div>양념갈비</div><div>생삼겹살</div><div>된장찌개</div>
      </div>
      {/* round steel tables with a charcoal grill each */}
      {[220, 540, 860].map((x, k) => (
        <React.Fragment key={`t${k}`}>
          {box({ left: x - 150, top: F - 70, width: 300, height: 60, borderRadius: "50%", background: "#c7ced6", border: `5px solid ${INK}` })}
          {box({ left: x - 70, top: F - 64, width: 140, height: 40, borderRadius: "50%", background: "radial-gradient(circle,#ff9a3c 0,#c2410c 45%,#2b2b2b 70%)", border: `4px solid ${INK}`,
            boxShadow: `0 0 ${20 + 8 * Math.sin(t * 5 + k)}px 6px rgba(255,120,40,.45)` })}
          {box({ left: x - 12, top: F - 12, width: 24, height: 150, background: "#6d747c" })}
        </React.Fragment>
      ))}
      {/* floor */}
      {box({ left: 0, right: 0, top: F + 120, bottom: 0, background: night ? "#4a4440" : "repeating-linear-gradient(90deg,#b9b2a6 0 118px,#a9a296 118px 120px)" })}
      {box({ left: 0, right: 0, top: F + 110, height: 14, background: "rgba(0,0,0,.14)" })}
    </>
  );
};
