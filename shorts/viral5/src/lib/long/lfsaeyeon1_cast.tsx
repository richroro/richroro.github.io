// lfsaeyeon1 (사연툰 "반찬통 이름표"): the four characters. They are the 썰 mochi (lib/Sseol.tsx: same body, eyes,
// mouths and moods), redrawn here with a look of their own that never changes, so each reads at a glance in a wide frame:
//   ji  지은 (나)  peach, dark-brown side bangs + low ponytail with a yellow scrunchie, coral top
//   do  도윤 (남편) sky blue, short black hair with a cowlick, navy top, ears that go red when he lies
//   mom 어머님      lavender, grey perm, round glasses, crow's feet, purple cardigan, white cotton gloves
//   sis 형님 도희   mint, dark bob with a pink headband, tired eye bags, grey hoodie, a baby in a pink wrap
import React from "react";
import type { Mood } from "../Sseol";
import { TITLE } from "../fonts";
import { prog, eOut } from "../fx";

export type Who = "ji" | "do" | "mom" | "sis";
export type Flags = { apron?: number; gloves?: number; baby?: number; bandage?: number; redears?: number; phone?: number; sofa?: number; hand?: number };

const INK = "#1b1b1f";
export const LOOK: Record<Who, { body: string; cloth: string; name: string }> = {
  ji: { body: "#FFD9C7", cloth: "#FF8C7A", name: "나" },
  do: { body: "#BFE3FF", cloth: "#2F4B7C", name: "남편" },
  mom: { body: "#E4D3F6", cloth: "#9C7BD0", name: "어머님" },
  sis: { body: "#CDEFC6", cloth: "#9AA3AD", name: "형님" },
};
const BODY_D = "M100 22 C152 22 184 62 184 114 C184 162 148 188 100 188 C52 188 16 162 16 114 C16 62 48 22 100 22 Z";

/** hair and anything that sits behind the body (ponytail, ears) */
const Behind: React.FC<{ who: Who; f: Flags; t: number }> = ({ who, f, t }) => {
  if (who === "ji") return (
    <g>
      <path d={`M150 52 C196 46 ${206 + 3 * Math.sin(t * 3)} 96 ${188 + 4 * Math.sin(t * 3)} 150 C178 120 170 96 150 80 Z`} fill="#4a2c1d" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
      <circle cx={162} cy={58} r={13} fill="#FFD84D" stroke={INK} strokeWidth={4} />
    </g>
  );
  if (who === "do") {
    const red = !!f.redears, c = red ? "#ff3d3d" : LOOK.do.body;
    return (
      <g>
        {[18, 182].map((x) => <circle key={x} cx={x} cy={110} r={17} fill={c} stroke={INK} strokeWidth={5} />)}
        {red ? [8, 192].map((x, k) => <g key={x} stroke="#ff3d3d" strokeWidth={4} strokeLinecap="round" opacity={0.6 + 0.4 * Math.sin(t * 9 + k)}>
          <path d={`M${x} 84 q${k ? 6 : -6} -8 0 -16`} fill="none" /><path d={`M${x + (k ? 8 : -8)} 90 q${k ? 6 : -6} -8 0 -16`} fill="none" /></g>) : null}
      </g>
    );
  }
  if (who === "sis") return <path d="M28 64 C30 22 170 22 172 64 L178 128 C170 136 158 136 152 128 L150 70 L50 70 L48 128 C42 136 30 136 22 128 Z" fill="#3b2a20" stroke={INK} strokeWidth={5} strokeLinejoin="round" />;
  return null;
};

/** hair, glasses, clothes and hands drawn over the body */
const Front: React.FC<{ who: Who; f: Flags; t: number; clip: string }> = ({ who, f, t, clip }) => {
  const L = LOOK[who];
  const hand = (x: number, y: number, fill: string, k: number) => <circle key={k} cx={x} cy={y} r={17} fill={fill} stroke={INK} strokeWidth={5} />;
  const handFill = f.gloves ? "#ffffff" : L.body;
  return (
    <g>
      {/* clothes: the bottom of the body in the character's colour */}
      <g clipPath={`url(#${clip})`}>
        <rect x={0} y={156} width={200} height={50} fill={L.cloth} />
        <path d="M0 156 L200 156" stroke={INK} strokeWidth={4} />
        {who === "mom" ? [100].map((x) => <g key={x}><path d="M78 156 L100 186 L122 156" fill="none" stroke={INK} strokeWidth={4} />{[168, 180].map((y) => <circle key={y} cx={100} cy={y} r={3.5} fill="#fff" />)}</g>) : null}
        {who === "sis" ? <g><path d="M80 156 L80 176 M120 156 L120 176" stroke="#ffffff" strokeWidth={4} strokeLinecap="round" /></g> : null}
        {who === "do" ? <path d="M84 156 L100 170 L116 156" fill="#fff" stroke={INK} strokeWidth={4} strokeLinejoin="round" /> : null}
        {f.apron ? <g><path d={`M56 136 L144 136 L150 200 L50 200 Z`} fill={who === "do" ? "#6CC08B" : "#FFE066"} stroke={INK} strokeWidth={4} strokeLinejoin="round" />
          <rect x={82} y={160} width={36} height={22} rx={5} fill="none" stroke={INK} strokeWidth={3} /></g> : null}
      </g>
      {/* hair on top */}
      {who === "ji" ? <path d="M26 96 C20 40 64 16 104 16 C150 16 184 48 178 96 C166 72 140 58 112 56 C96 64 70 70 44 64 C40 74 32 86 26 96 Z" fill="#4a2c1d" stroke={INK} strokeWidth={5} strokeLinejoin="round" /> : null}
      {who === "do" ? <g><path d="M30 76 C30 32 72 14 106 16 C150 18 176 44 170 78 C156 60 132 50 104 50 C76 50 50 60 30 76 Z" fill="#17171c" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
        <path d="M108 17 q6 -18 22 -12" fill="none" stroke="#17171c" strokeWidth={7} strokeLinecap="round" /></g> : null}
      {who === "mom" ? <g>{Array.from({ length: 9 }, (_, k) => { const a = Math.PI * (1.08 + 0.84 * k / 8), r = 74; return <circle key={k} cx={100 + Math.cos(a) * r * 1.08} cy={96 + Math.sin(a) * r} r={k % 2 ? 19 : 21} fill="#c9c9d3" stroke={INK} strokeWidth={4} />; })}
        <circle cx={100} cy={30} r={22} fill="#c9c9d3" stroke={INK} strokeWidth={4} /></g> : null}
      {who === "sis" ? <g><path d="M22 112 C14 40 60 18 100 18 C140 18 186 40 178 112 L160 116 C160 90 150 70 128 62 C110 70 80 72 60 64 C46 74 40 92 40 116 Z" fill="#3b2a20" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
        <path d="M40 50 C66 26 134 26 160 50" fill="none" stroke="#ff6fa3" strokeWidth={11} strokeLinecap="round" /></g> : null}
      {/* age and tiredness marks */}
      {who === "mom" ? <g fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round">
        <circle cx={72} cy={98} r={23} /><circle cx={128} cy={98} r={23} /><path d="M95 96 L105 96" />
        <path d="M42 92 l-8 -4 M42 100 l-9 0 M158 92 l8 -4 M158 100 l9 0" opacity={0.7} /></g> : null}
      {who === "sis" ? <g fill="none" stroke="#8c6bb8" strokeWidth={4} strokeLinecap="round" opacity={0.8}><path d="M60 116 q12 7 24 0" /><path d="M116 116 q12 7 24 0" /></g> : null}
      {/* hands only when they matter */}
      {f.gloves || f.bandage || f.phone ? [hand(26, 166, handFill, 0), hand(174, 166, handFill, 1)] : null}
      {f.gloves ? [26, 174].map((x) => <path key={x} d={`M${x - 8} 160 l16 0 M${x - 8} 168 l16 0`} stroke="#c9c9c9" strokeWidth={2} />) : null}
      {f.bandage ? [[166, 158, -20], [178, 164, 15], [172, 176, -5]].map(([x, y, r], k) => <rect key={k} x={x - 11} y={y - 4} width={22} height={9} rx={4} fill="#f1c896" stroke={INK} strokeWidth={2} transform={`rotate(${r} ${x} ${y})`} />) : null}
      {f.phone ? <g transform="translate(160 118) rotate(-8)"><rect x={0} y={0} width={30} height={50} rx={6} fill="#2b2b33" stroke={INK} strokeWidth={3} /><rect x={4} y={6} width={22} height={34} rx={3} fill="#9fd3ff" /></g> : null}
      {f.hand ? <g><path d="M170 120 L196 34" stroke={INK} strokeWidth={8} strokeLinecap="round" /><circle cx={196} cy={30} r={19} fill={L.body} stroke={INK} strokeWidth={5} />
        {[[186, 26, -20], [200, 34, 10]].map(([x, y, r], k) => <rect key={k} x={x - 10} y={y - 4} width={20} height={8} rx={4} fill="#f1c896" stroke={INK} strokeWidth={2} transform={`rotate(${r} ${x} ${y})`} />)}</g> : null}
      {f.baby ? <g transform={`translate(${118} ${134 + 2 * Math.sin(t * 2.4)})`}>
        <ellipse cx={0} cy={36} rx={44} ry={30} fill="#ffb3cc" stroke={INK} strokeWidth={4} />
        <circle cx={0} cy={6} r={26} fill="#ffe9dc" stroke={INK} strokeWidth={4} />
        <path d="M-3 -19 q4 -10 10 -4" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
        <path d="M-12 6 q4 -4 8 0 M4 6 q4 -4 8 0" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
        <ellipse cx={-14} cy={14} rx={5} ry={3} fill="#ff9bb5" /><ellipse cx={14} cy={14} rx={5} ry={3} fill="#ff9bb5" /></g> : null}
    </g>
  );
};

/** eyes and mouth (the 썰 mochi's 13 moods) */
const Face: React.FC<{ mood: Mood; t: number }> = ({ mood, t }) => {
  const L = 72, R = 128, Y = 98;
  const dot = (x: number, ox = 0, oy = 0, r = 11) => (<g key={x}><circle cx={x + ox} cy={Y + oy} r={r} fill={INK} /><circle cx={x + ox - 3} cy={Y + oy - 4} r={r * 0.36} fill="white" /></g>);
  const arc = (x: number, up: boolean) => <path key={x} d={up ? `M${x - 13} ${Y + 5} Q${x} ${Y - 12} ${x + 13} ${Y + 5}` : `M${x - 13} ${Y - 4} Q${x} ${Y + 10} ${x + 13} ${Y - 4}`} stroke={INK} strokeWidth={7} fill="none" strokeLinecap="round" />;
  let eyes: React.ReactNode, mouth: React.ReactNode;
  switch (mood) {
    case "happy": eyes = [arc(L, true), arc(R, true)]; mouth = <path d="M84 128 Q100 152 116 128 Z" fill="#7a1e2c" stroke={INK} strokeWidth={4} strokeLinejoin="round" />; break;
    case "laugh": eyes = [<path key="l" d={`M${L - 12} ${Y - 9} L${L + 8} ${Y} L${L - 12} ${Y + 9}`} stroke={INK} strokeWidth={7} fill="none" strokeLinecap="round" strokeLinejoin="round" />,
      <path key="r" d={`M${R + 12} ${Y - 9} L${R - 8} ${Y} L${R + 12} ${Y + 9}`} stroke={INK} strokeWidth={7} fill="none" strokeLinecap="round" strokeLinejoin="round" />];
      mouth = <g><path d="M78 124 Q100 166 122 124 Z" fill="#7a1e2c" stroke={INK} strokeWidth={4} strokeLinejoin="round" /><path d="M90 146 Q100 138 110 146 Q100 156 90 146" fill="#ff7f93" /></g>; break;
    case "shock": eyes = [L, R].map((x) => <g key={x}><circle cx={x} cy={Y} r={21} fill="white" stroke={INK} strokeWidth={5} /><circle cx={x} cy={Y} r={6} fill={INK} /></g>);
      mouth = <ellipse cx={100} cy={140} rx={12} ry={16} fill="#7a1e2c" stroke={INK} strokeWidth={4} />; break;
    case "sad": case "cry": eyes = [arc(L, false), arc(R, false)]; mouth = <path d="M86 146 Q100 132 114 146" stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" />; break;
    case "angry": eyes = [dot(L, 0, 4, 9), dot(R, 0, 4, 9), <path key="bl" d={`M${L - 16} ${Y - 22} L${L + 12} ${Y - 10}`} stroke={INK} strokeWidth={7} strokeLinecap="round" />,
      <path key="br" d={`M${R + 16} ${Y - 22} L${R - 12} ${Y - 10}`} stroke={INK} strokeWidth={7} strokeLinecap="round" />];
      mouth = <path d="M86 144 L100 136 L114 144" stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" />; break;
    case "smug": eyes = [L, R].map((x) => <g key={x}><path d={`M${x - 13} ${Y} L${x + 13} ${Y}`} stroke={INK} strokeWidth={7} strokeLinecap="round" /><path d={`M${x - 11} ${Y + 1} Q${x} ${Y + 13} ${x + 11} ${Y + 1}`} fill={INK} /></g>);
      mouth = <path d="M88 138 Q104 146 116 130" stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" />; break;
    case "shy": eyes = [dot(L, 7, 4, 9), dot(R, 7, 4, 9)]; mouth = <path d="M84 140 q5 -7 10 0 q5 7 10 0 q5 -7 10 0" stroke={INK} strokeWidth={5} fill="none" strokeLinecap="round" />; break;
    case "think": eyes = [dot(L, 5, -6, 10), dot(R, 5, -6, 10)]; mouth = <path d="M92 140 L110 138" stroke={INK} strokeWidth={6} strokeLinecap="round" />; break;
    case "sleep": eyes = [arc(L, false), arc(R, false)]; mouth = <ellipse cx={100} cy={138} rx={6} ry={5} fill={INK} />; break;
    case "love": eyes = [L, R].map((x) => <path key={x} transform={`translate(${x} ${Y}) scale(${1 + 0.12 * Math.abs(Math.sin(t * 8))})`} d="M0 10 C-26 -6 -14 -26 0 -13 C14 -26 26 -6 0 10 Z" fill="#ff3d6e" stroke={INK} strokeWidth={3} />);
      mouth = <path d="M86 132 Q100 150 114 132" stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" />; break;
    case "sick": eyes = [L, R].map((x) => <path key={x} d={`M${x - 13} ${Y - 2} Q${x - 6} ${Y - 9} ${x} ${Y - 2} Q${x + 6} ${Y + 5} ${x + 13} ${Y - 2}`} stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" />);
      mouth = <path d="M82 142 q6 -8 12 0 q6 8 12 0 q6 -8 12 0" stroke={INK} strokeWidth={5} fill="none" strokeLinecap="round" />; break;
    default: eyes = [dot(L), dot(R)]; mouth = <path d="M88 132 Q100 144 112 132" stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" />;
  }
  const fall = (k: number) => ((t * 1.3 + k * 0.5) % 1);
  return (
    <g>
      {eyes}{mouth}
      {mood === "cry" ? [0, 1].map((k) => <g key={k}>{[72, 128].map((x) => <path key={x} d={`M${x - 5} ${110 + 60 * fall(k)} q5 -14 10 0 q0 8 -5 8 q-5 0 -5 -8`} fill="#4fb3ff" opacity={1 - fall(k)} />)}</g>) : null}
      {mood === "shock" || mood === "shy" ? <path d="M168 40 q10 16 0 24 q-10 -8 0 -24" fill="#7cc8ff" stroke={INK} strokeWidth={3} /> : null}
      {mood === "angry" ? <g stroke="#e8212e" strokeWidth={6} strokeLinecap="round" transform="translate(160 36)"><path d="M-12 -4 Q-4 -4 -4 -12" fill="none" /><path d="M12 -4 Q4 -4 4 -12" fill="none" /><path d="M-12 4 Q-4 4 -4 12" fill="none" /><path d="M12 4 Q4 4 4 12" fill="none" /></g> : null}
      {mood === "sleep" ? <text x={150} y={40 - 10 * ((t * 0.8) % 1)} fontFamily={TITLE} fontSize={34} fill={INK} opacity={1 - ((t * 0.8) % 1)}>Z</text> : null}
      {mood === "think" ? [0, 1, 2].map((k) => <circle key={k} cx={150 + k * 14} cy={30 - k * 12} r={4 + k * 2} fill="white" stroke={INK} strokeWidth={3} opacity={prog(t, 0.15 * k, 0.15)} />) : null}
      {mood === "love" ? [0, 1].map((k) => { const q = (t * 0.7 + k * 0.5) % 1; return <path key={k} transform={`translate(${160 + 14 * k} ${46 - 40 * q}) scale(${0.7 + 0.3 * k})`} d="M0 10 C-26 -6 -14 -26 0 -13 C14 -26 26 -6 0 10 Z" fill="#ff3d6e" opacity={1 - q} />; }) : null}
    </g>
  );
};

/** one character in a mood; t is seconds since the cut (each cut opens with a small squash) */
export const Toon: React.FC<{ who: Who; mood: Mood; f?: Flags; t: number; size: number; k: number; flip?: boolean }> = ({ who, mood, f = {}, t, size, k, flip }) => {
  const L = LOOK[who];
  const enter = eOut(prog(t, 0, 0.22));
  let sx = 1, sy = 1, dx = 0, dy = 0, rot = 0;
  const breathe = Math.sin((t + k * 0.7) * 3.2);
  sy = 1 + 0.025 * breathe; sx = 1 - 0.018 * breathe;
  if (mood === "laugh") { const b = Math.abs(Math.sin(t * 11)); dy = -16 * b; sy *= 1 + 0.05 * b; rot = 4 * Math.sin(t * 11); }
  if (mood === "shock") { const p = prog(t, 0, 0.35); dy = -70 * Math.sin(Math.PI * p); dx = 7 * Math.sin(t * 70) * (1 - prog(t, 0.2, 0.6)); sy *= 1 + 0.08 * Math.sin(Math.PI * p); }
  if (mood === "angry") dx = 5 * Math.sin(t * 55);
  if (mood === "happy") dy = -10 * Math.abs(Math.sin(t * 5));
  if (mood === "sad" || mood === "cry") { sy *= 0.96; dy = 6; }
  if (mood === "sleep") rot = -6 + 2 * Math.sin(t * 1.6);
  if (mood === "love") { const b = Math.abs(Math.sin(t * 4)); dy = -8 * b; sy *= 1 + 0.03 * b; }
  if (mood === "sick") { rot = 3 * Math.sin(t * 2.4); sy *= 0.97; dy = 4; }
  const squash = 1 - 0.1 * (1 - enter);
  const fill = mood === "angry" ? `color-mix(in srgb, ${L.body} 70%, #ff4d4d)` : mood === "sick" ? `color-mix(in srgb, ${L.body} 55%, #8fd18a)` : L.body;
  const clip = `sy-body-${who}-${k}`;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: size, height: size, transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${(flip ? -1 : 1) * sx * squash}, ${sy * squash})`, transformOrigin: "50% 92%" }}>
      <svg width={size} height={size} viewBox="0 0 200 200" style={{ overflow: "visible" }}>
        <defs><clipPath id={clip}><path d={BODY_D} /></clipPath></defs>
        {f.sofa ? <rect x={-40} y={120} width={280} height={84} rx={30} fill="#7f9cc4" stroke={INK} strokeWidth={5} /> : null}
        <ellipse cx={100} cy={192} rx={70} ry={9} fill="rgba(0,0,0,.18)" />
        <Behind who={who} f={f} t={t} />
        <path d={BODY_D} fill={fill} stroke={INK} strokeWidth={6} />
        <ellipse cx={66} cy={54} rx={22} ry={12} fill="white" opacity={0.35} transform="rotate(-25 66 54)" />
        <ellipse cx={56} cy={126} rx={13} ry={8} fill="#ff7aa0" opacity={mood === "shy" || mood === "love" ? 0.95 : 0.5} />
        <ellipse cx={144} cy={126} rx={13} ry={8} fill="#ff7aa0" opacity={mood === "shy" || mood === "love" ? 0.95 : 0.5} />
        <Front who={who} f={f} t={t} clip={clip} />
        <g transform={flip ? "translate(200 0) scale(-1 1)" : undefined}><Face mood={mood} t={t} /></g>
      </svg>
    </div>
  );
};
