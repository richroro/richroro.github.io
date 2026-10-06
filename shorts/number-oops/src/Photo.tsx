// A photo shot: fills the frame (cover) or shows the whole picture over a blurred copy of itself (fit),
// with a slow Ken Burns move. Until the real file is in public/img, a labeled placeholder stands in.
import React from "react";
import { AbsoluteFill, Img, getStaticFiles, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BODY } from "./fonts";

export type PhotoId = keyof typeof PHOTOS;
export const PHOTOS = {
  psy: { file: "img/psy.jpg", label: "싸이 공연 사진", focus: "50% 30%" },
  youtube: { file: "img/youtube.jpg", label: "유튜브 본사 사진", focus: "50% 50%" },
  ariane: { file: "img/ariane5.jpg", label: "아리안 5 로켓 발사 사진", focus: "50% 40%" },
  mco: { file: "img/mco.jpg", label: "화성 기후 궤도선 (NASA)", focus: "50% 50%" },
  mars: { file: "img/mars.jpg", label: "화성 사진 (NASA)", focus: "50% 50%" },
  lockheed: { file: "img/lockheed.jpg", label: "탐사선 조립 (록히드 마틴)", focus: "50% 50%" },
  jpl: { file: "img/jpl.jpg", label: "NASA JPL 관제실", focus: "50% 50%" },
  ruler: { file: "img/ruler.jpg", label: "줄자 사진", focus: "50% 50%" },
} as const;

const have = (file: string) => getStaticFiles().some((f) => f.name === file);

const Placeholder: React.FC<{ label: string; hue: number }> = ({ label, hue }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse at 50% 40%, hsl(${hue} 45% 32%), hsl(${hue} 50% 10%) 75%)`,
      justifyContent: "center",
      alignItems: "center",
    }}
  >
    <div style={{ fontFamily: BODY, fontWeight: 800, fontSize: 44, color: "rgba(255,255,255,.55)", border: "4px dashed rgba(255,255,255,.35)", borderRadius: 24, padding: "18px 30px" }}>
      📷 {label}
    </div>
  </AbsoluteFill>
);

export const Photo: React.FC<{
  id: PhotoId;
  mode?: "cover" | "fit";
  zoom?: [number, number]; // scale at the start and end of the shot
  drift?: [number, number]; // px moved over the shot (x, y)
  focus?: string; // object-position override
  filter?: string;
}> = ({ id, mode = "cover", zoom = [1.04, 1.14], drift = [0, 0], focus, filter }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = interpolate(frame, [0, Math.max(1, durationInFrames - 1)], [0, 1], { extrapolateRight: "clamp" });
  const s = zoom[0] + (zoom[1] - zoom[0]) * p;
  const move = `translate(${drift[0] * p}px, ${drift[1] * p}px) scale(${s})`;
  const ph = PHOTOS[id];
  const hue = [...id].reduce((a, c) => a + c.charCodeAt(0) * 37, 0) % 360;
  if (!have(ph.file)) return <AbsoluteFill style={{ transform: move, filter }}><Placeholder label={ph.label} hue={hue} /></AbsoluteFill>;
  const src = staticFile(ph.file);
  return (
    <AbsoluteFill style={{ filter, overflow: "hidden" }}>
      {mode === "fit" ? (
        <>
          <Img src={src} style={{ position: "absolute", inset: -80, width: "calc(100% + 160px)", height: "calc(100% + 160px)", objectFit: "cover", filter: "blur(38px) brightness(.45)" }} />
          <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", transform: move }}>
            <Img src={src} style={{ width: "100%", objectFit: "contain" }} />
          </AbsoluteFill>
        </>
      ) : (
        <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: focus ?? ph.focus, transform: move }} />
      )}
    </AbsoluteFill>
  );
};
