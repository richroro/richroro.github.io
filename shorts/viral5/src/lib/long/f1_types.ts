// Data shapes of longform/odyssey/edit.json (built by longform/odyssey/build_edit.py) and route.json (make_maps.py).
export type F1Shot = {
  kind: "img" | "map" | "world" | "korea" | "years" | "curse" | "card" | "fleet" | "bedtree" | "title" | "end";
  t0: number;
  t1: number;
  // img
  img?: string; tone?: "colour" | "print"; cx?: number; cy?: number; z?: number; move?: string; credit?: string;
  // map
  mode?: "direct" | "route"; upto?: number; draw?: number[]; show?: string[] | number; guess?: string[]; zoom?: [number, number]; focus?: [number, number];
  // years
  hl?: string | null;
  // curse
  done?: number[]; half?: number[]; echo?: boolean; loophole?: boolean; remember?: boolean;
  // card
  text?: string; sub?: string;
  // fleet
  from?: number; to?: number;
  // bedtree
  still?: boolean;
};
export type F1Chapter = { id: string; label: string; sub: string; music: string; start: number; voice: number; end: number; group: number; groupLabel: string; card?: boolean };
export type F1Edit = {
  id: string; title: string; fps: number; width: number; height: number; duration: number;
  chapters: F1Chapter[];
  lines: { t: number; dur: number; file: string; text: string; chapter: string }[];
  captions: { t0: number; t1: number; text: string }[];
  shots: F1Shot[];
};
export type Pt = [number, number];
export type F1Route = {
  med: { image: string; points: Record<string, Pt>; legs: Pt[][]; direct: Pt[] };
  world: { image: string; greece: Pt; korea: Pt };
  korea: { image: string; ganghwa: Pt; gochang: Pt; hwasun: Pt };
};
