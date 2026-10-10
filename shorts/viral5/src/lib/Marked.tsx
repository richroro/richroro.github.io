import React from "react";

export const RED = "#FF3B3B";

/** text with [key] words in yellow (or `color`) and {key} words in red */
export const Marked: React.FC<{ text: string; color?: string }> = ({ text, color = "#FFE14D" }) => (
  <>
    {text.split(/(\[[^\]]*\]|\{[^}]*\})/).map((p, i) =>
      p.startsWith("[") ? <span key={i} style={{ color }}>{p.slice(1, -1)}</span>
        : p.startsWith("{") && p.endsWith("}") ? <span key={i} style={{ color: RED }}>{p.slice(1, -1)}</span>
        : <React.Fragment key={i}>{p}</React.Fragment>,
    )}
  </>
);
