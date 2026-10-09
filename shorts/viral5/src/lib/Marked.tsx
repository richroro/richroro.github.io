import React from "react";

/** text with [key] words in yellow (or `color`) */
export const Marked: React.FC<{ text: string; color?: string }> = ({ text, color = "#FFE14D" }) => (
  <>
    {text.split(/(\[[^\]]*\])/).map((p, i) =>
      p.startsWith("[") ? <span key={i} style={{ color }}>{p.slice(1, -1)}</span> : <React.Fragment key={i}>{p}</React.Fragment>,
    )}
  </>
);
