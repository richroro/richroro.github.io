// The wordless shorts' title (drive1~10): one thin white Korean line (or two) in the black bar over a 16:9 picture and
// its English translation in the black bar under it, the way the global wordless road cartoons label themselves.
// Used when edit.json has "titleEn"; the picture is a "frame": "wide" clip (1080×608 at y 656).
import React from "react";
import { fitText } from "@remotion/layout-utils";
import { BODY } from "./fonts";

const TOP = 656, BOTTOM = 656 + 608;

export const BilingualTitle: React.FC<{ title: [string, string]; en: string }> = ({ title, en }) => {
  const ko = title.filter((l) => l.trim());
  const size = (s: string, max: number, w: number, weight: string) => Math.min(max, fitText({ text: s, withinWidth: w, fontFamily: BODY, fontWeight: weight }).fontSize);
  const koSize = Math.min(...ko.map((l) => size(l, 92, 980, "800")));
  return (
    <>
      <div style={{ position: "absolute", left: 0, top: 0, width: 1080, height: TOP - 44, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center",
        fontFamily: BODY, fontWeight: 800, color: "white", fontSize: koSize, lineHeight: 1.18, letterSpacing: -1 }}>
        {ko.map((l, i) => <div key={i}>{l}</div>)}
      </div>
      {en ? <div style={{ position: "absolute", left: 60, top: BOTTOM + 44, width: 960, textAlign: "center", fontFamily: BODY, fontWeight: 700, color: "#e9e9e9",
        fontSize: Math.max(54, size(en, 66, 960, "700")), lineHeight: 1.2 }}>{en}</div> : null}
    </>
  );
};
