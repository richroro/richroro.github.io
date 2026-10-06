// Narration timing from prep.py: line starts, caption chunks and per-syllable ASR times.
import tl from "./data/timeline.json";

export type Line = {
  id: string;
  start: number;
  dur: number;
  chunks: { t0: number; t1: number; text: string }[];
  chars: string;
  ct: number[];
};

export const TL = tl as { end: number; fps: number; lines: Line[] };
export const FPS = 30;
const byId: Record<string, Line> = Object.fromEntries(TL.lines.map((l) => [l.id, l]));

/** line start / end, caption-chunk start, and the moment a word is spoken (all in seconds) */
export const T = (id: string) => byId[id].start;
export const E = (id: string) => byId[id].start + byId[id].dur;
export const CH = (id: string, i: number) => byId[id].start + byId[id].chunks[i].t0;
export const WT = (id: string, word: string) => {
  const L = byId[id];
  const k = L.chars.indexOf(word);
  if (k < 0) throw new Error(`"${word}" is not spoken in ${id}`);
  return L.start + L.ct[k];
};
export const fr = (s: number) => Math.round(s * FPS);
