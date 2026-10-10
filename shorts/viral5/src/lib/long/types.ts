// The data a long-form composition reads (src/longdata/<id>.json, written by longform/prep_long.py). Times are seconds.
import type { Char, Chat, PostG } from "../Sseol";

export type Word = { text: string; key: boolean; red?: boolean };
/** a caption page: one or two lines of words; top = shown at the top (the outro, where the bottom is end-screen space) */
export type LongPage = { startMs: number; endMs: number; lines: Word[][]; top?: boolean };

type ShotBase = {
  start: number; end: number;
  /** seconds of crossfade in, ending at `start + fade` (the outgoing shot stays under it) */
  fade: number;
  /** seconds into the shot's own time this piece begins (a shot split around a reused short, or replayed in the cold open) */
  t0?: number;
  credit?: string;
  /** a small label at the lower left, above the captions ("5위 · 이름 없는 심해 해파리") */
  lower?: string | null;
  /** a big rank or number badge at the top left, under the chapter label ("15위") */
  badge?: string;
};
export type FootageShot = ShotBase & {
  type: "footage"; file: string | null; w?: number; h?: number; speed?: number; label?: string;
  /** cover (fill 16:9, cropped) or contain (whole frame over a blurred fill) */
  fit?: "cover" | "contain";
  /** prep's pre-blurred copy for the fill */
  blur?: string | null;
  /** [cx, cy, zoom]: the point of the source that sits in the middle of the frame, and how far in */
  crop?: [number, number, number] | null;
  /** slow push: scale at the start and at the end */
  push?: [number, number];
};
export type PhotoShot = ShotBase & {
  type: "photo"; file: string; w: number; h: number; fit?: "cover" | "contain"; blur?: string | null;
  /** Ken Burns: [cx, cy, zoom] at the start and at the end */
  kb: { from: [number, number, number]; to: [number, number, number] };
};
export type SceneSpec = {
  bg?: string; sign?: string; place?: string; photo?: string | null;
  chars: (Char & { x?: number })[];
  /** speech bubbles, each from `at` (seconds into the shot) until the next one or `to` */
  says: { who: number; text: string; at: number; to?: number | null }[];
  /** when chars switch to their `to` mood */
  turn?: number | null;
  prop?: string; propX?: number; propAt?: number | null;
  big?: string; bigAt?: number | null;
  card?: string;
  chat?: Omit<Chat, "msgs"> & { msgs: (Chat["msgs"][number] & { at?: number | null })[] };
  zoom?: number; focus?: number;
  /** character size in px (default by count) and where their feet stand */
  size?: number; floor?: number;
};
export type SceneShot = ShotBase & { type: "scene"; g: SceneSpec };
export type PostShot = ShotBase & { type: "post"; g: PostG & { steps?: number[] } };
export type CardShot = ShotBase & {
  type: "card"; kind: "fact" | "text" | "rank" | "map" | "grid" | "doc";
  bg?: string | null; bgIsImg?: boolean; bgBlur?: string | null;
  /** fact: a big number or word, its label above and a line under it */
  big?: string; label?: string; sub?: string;
  /** text: a sentence or two ([key] yellow, {key} red) */
  text?: string;
  /** rank: "TOP n" place, its name, and the list size */
  n?: number; total?: number; title?: string;
  /** map: the window (lon/lat centre and width in degrees), dots and arrows */
  center?: [number, number]; span?: number;
  dots?: { lon: number; lat: number; label?: string; at?: number }[];
  arrows?: { from: [number, number]; to: [number, number]; at?: number; dashed?: boolean }[];
  revealAt?: number | null;
  /** grid (the list explainer's "contents" screen): icons with names; `focus` is lit and zoomed into at zoomAt,
   *  `done` are greyed and ticked, `circle` gets a red circle at circleAt; `cols` per row (default 4) */
  items?: { icon: string; label: string }[]; cols?: number; focus?: number; done?: number[]; circle?: number; zoomAt?: number | null; circleAt?: number | null;
  /** doc (a notice, a handover sheet, a rule list): `title`, `lines` revealed at `steps`, `page` ("3쪽"), `paper` colour */
  lines?: string[]; steps?: number[]; page?: string; paper?: string;
};
export type ShortShot = ShotBase & { type: "short"; file: string; blur?: string | null };
export type ChapterShot = ShotBase & { type: "chapter"; n: number; title: string; bg: string | null; bgIsImg?: boolean; bgBlur?: string | null;
  /** "CHAPTER 01", "괴담 03 / 12"; style "card" (full-screen card) or "dip" (a short dip to black, the title only in the corner label) */
  kicker?: string; style?: "card" | "dip" };
export type TitleShot = ShotBase & { type: "title"; kicker: string; title: [string, string]; sub: string; bg: string | null; bgIsImg?: boolean; bgBlur?: string | null };
export type OutroShot = ShotBase & { type: "outro"; bg: FootageShot | PhotoShot | null; label: string; boxes: boolean };
export type Shot = FootageShot | PhotoShot | SceneShot | PostShot | CardShot | ShortShot | ChapterShot | TitleShot | OutroShot;

export type Thumb = {
  /** 2-3 lines; [key] words in the key colour, {key} in red */
  lines: string[]; key?: string;
  img?: string; crop?: [number, number, number];
  char?: Char & { x?: number; y?: number; size?: number };
  circle?: { x: number; y: number; r: number };
  arrow?: { x: number; y: number; rot: number; len?: number };
  /** where the text sits: "left" (default) or "right", and "center" (default) or "bottom" */
  side?: "left" | "right"; valign?: "center" | "bottom";
  /** a small tag at the top ("다큐", "몰아보기") */
  tag?: string;
  bg?: string;
  /** "band": the 사연툰 look — the lines on a band across the top, a drawn scene under it (chars, says, `scene` backdrop);
   *  "grid": the list-explainer look — a white board, a black title with a red key word, round icons in a grid */
  style?: "band" | "grid";
  chars?: (Char & { x?: number; size?: number })[];
  says?: { who: number; text: string }[];
  scene?: string;
  items?: { icon: string; label: string }[];
  /** band: the band's background colour (default black) */
  bandBg?: string;
};

export type LongData = {
  id: string; end: number; fps: number; captions: boolean; credit: string; captionSize: number; watermark?: string;
  chapters: { n: number; id: string; title: string; card: number; body: number; end: number }[];
  coldOpen: { end: number }; outro: { start: number };
  shots: Shot[];
  voice: { file: string; start: number; dur: number }[];
  /** a reused short's own sound (gain, and how hard the bed ducks under it) */
  media: { file: string; start: number; dur: number; from: number; gain: number; duck: number }[];
  music: { file: string; start: number; end: number; from: number; gain: number; xfade: number }[];
  musicDuck: number;
  amb: { file: string; start: number; end: number; gain: number }[];
  /** voice level, 10 per second, 0..90 (60 = full voice, 90 = a short with its own music) */
  env: number[];
  pages: LongPage[];
  thumb: Thumb | null;
  sfx?: { t: number; file: string; gain: number }[];
  /** silences on purpose ("정답은?"), which QA does not count as gaps */
  pauses?: { start: number; dur: number }[];
  /** darken the whole picture (0..1; sleep mode 0.3) */
  dim?: number;
};
