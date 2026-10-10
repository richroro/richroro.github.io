// lfhorror1 (「인수인계서 3쪽은 집에서 읽으래요.」) — the drawn pieces of the 16:9 horror long-form.
// Everything here is our own drawing: the handover pages, the convex mirror, the hands with the ink-smudged edge,
// the CCTV monitor, the fingerprint time clock, the phone, the shift roster and the work log.
// Every component takes t (seconds since its scene started) so a frame is a pure function of time.
import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, continueRender, delayRender, staticFile } from "remotion";
import { Doodle } from "../Doodle";
import { BODY, TITLE } from "../fonts";
import { clamp, eOut, prog } from "../fx";
import type { Mood } from "../Sseol";

export const W = 1920, H = 1080;
export const RED = "#ff2a2a";
export const PEN = "LfhPen", CODE = "LfhCode";
const INK = "#141414", BLUE = "#2f5fd8", VEST = "#2f7d4a", PAPER = "#e9e3d3";

let fontsStarted = false;
export const loadLfhFonts = () => {
  if (fontsStarted) return;
  fontsStarted = true;
  const h = delayRender("lfh fonts");
  const faces = [
    new FontFace(PEN, `url('${staticFile("lfhorror1/fonts/NanumPenScript-Regular.ttf")}')`),
    new FontFace(CODE, `url('${staticFile("lfhorror1/fonts/NanumGothicCoding-Regular.ttf")}')`),
    new FontFace(CODE, `url('${staticFile("lfhorror1/fonts/NanumGothicCoding-Bold.ttf")}')`, { weight: "700" }),
  ];
  Promise.all(faces.map((f) => f.load().then(() => document.fonts.add(f)))).then(() => continueRender(h));
};

/** deterministic noise in -1..1 */
export const rnd = (a: number, b: number) => {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
};
/** an open wobbly marker stroke (redrawn 8x a second) */
const wob = (pts: [number, number][], seed: number, j = 2.4) => {
  const q = pts.map(([x, y], k) => [x + j * rnd(seed, k), y + j * rnd(seed + 9, k)] as [number, number]);
  let d = `M${q[0][0].toFixed(1)} ${q[0][1].toFixed(1)}`;
  for (let k = 1; k < q.length - 1; k++) {
    const mx = (q[k][0] + q[k + 1][0]) / 2, my = (q[k][1] + q[k + 1][1]) / 2;
    d += ` Q${q[k][0].toFixed(1)} ${q[k][1].toFixed(1)} ${k === q.length - 2 ? q[k + 1][0].toFixed(1) : mx.toFixed(1)} ${k === q.length - 2 ? q[k + 1][1].toFixed(1) : my.toFixed(1)}`;
  }
  if (q.length === 2) d += ` L${q[1][0].toFixed(1)} ${q[1][1].toFixed(1)}`;
  return d;
};
const boil = (t: number) => Math.floor(t * 8);
const Mark: React.FC<{ pts: [number, number][]; t: number; k?: number; w?: number; color?: string; fill?: string }> = ({ pts, t, k = 0, w = 8, color = INK, fill = "none" }) => (
  <>
    <path d={wob(pts, boil(t) + k * 7)} stroke={color} strokeWidth={w} fill={fill} strokeLinecap="round" strokeLinejoin="round" />
    <path d={wob(pts, boil(t) + k * 7 + 50, 1.6)} stroke={color} strokeWidth={w * 0.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </>
);

/** dark room with a torch-like pool of light; children are the lit object */
export const Dark: React.FC<{ t: number; children?: React.ReactNode; light?: [number, number]; bg?: string }> = ({ t, children, light = [50, 46], bg = "#07090c" }) => (
  <AbsoluteFill style={{ background: bg, overflow: "hidden" }}>
    {children}
    <AbsoluteFill style={{ background: `radial-gradient(ellipse 62% 70% at ${light[0] + 1.5 * Math.sin(t * 0.7)}% ${light[1] + 1.2 * Math.cos(t * 0.5)}%, rgba(0,0,0,0) 30%, rgba(0,0,0,.55) 70%, rgba(0,0,0,.92) 100%)` }} />
  </AbsoluteFill>
);

/** a sheet of paper, slowly drifting; the camera can zoom on a point of it */
const Sheet: React.FC<{ t: number; w?: number; h?: number; rot?: number; focus?: [number, number, number]; children: React.ReactNode; tone?: string }> = ({ t, w = 1000, h = 1300, rot = -2, focus, children, tone = PAPER }) => {
  const [fx, fy, z] = focus ?? [w / 2, h * 0.38, 1];
  const zz = z * (1 + 0.012 * t);
  return (
    <div style={{ position: "absolute", left: W / 2, top: H / 2, width: w, height: h, background: tone,
      transform: `translate(${-fx * zz}px, ${-fy * zz}px) scale(${zz}) rotate(${rot + 0.3 * Math.sin(t * 0.4)}deg)`, transformOrigin: "0 0",
      boxShadow: "0 30px 80px rgba(0,0,0,.8)", backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,.025) 0 2px, transparent 2px 5px)" }}>
      {children}
    </div>
  );
};

/** red marker underline that draws itself in */
const Underline: React.FC<{ t: number; x: number; y: number; w: number }> = ({ t, x, y, w }) => {
  const p = eOut(prog(t, 0.25, 0.7));
  return <svg style={{ position: "absolute", left: x, top: y, overflow: "visible" }} width={w} height={20}>
    <path d={wob([[0, 8], [w * 0.5, 4], [w * p, 9]], 3, 1.5)} stroke={RED} strokeWidth={6} fill="none" strokeLinecap="round" opacity={p > 0 ? 0.9 : 0} />
  </svg>;
};

export const RULES = [
  "규칙 1. 출근하면 볼록거울부터 닦을 것.\n손자국이 보이면 바깥에서 닦을 것.\n바깥에서 닦아도 안 지워지면 바로 점장에게 연락할 것.",
  "규칙 2. 새벽 2시~4시에는 2번 계산대를 쓰지 말 것.\n손님이 2번에 서면 1번으로 오시라고 할 것.",
  "규칙 3. 새벽 3시 13분에 들어오는 손님은 생수 한 병만 산다.\n1번 계산대에서, 얼굴을 보지 말고 계산할 것.",
  "규칙 4. 그 손님이 이름을 불러도 절대 대답하지 말 것.",
  "규칙 5. 퇴근 지문은 반드시 왼손 검지로 찍을 것.\n지문이 안 찍히면 퇴근하지 말고 점장에게 전화할 것.",
];
const RULE_Y = [250, 450, 610, 770, 870];

/** page 1 (typed rules) or page 2 (typed misc + Minho's left-slanted note); focus = rule index, "head", "note" */
export const DocPage: React.FC<{ t: number; page: 1 | 2; focus?: number | "head" | "note" | "note2" | "all" }> = ({ t, page, focus = "all" }) => {
  const f: [number, number, number] = focus === "head" ? [500, 120, 1.25] : focus === "note" ? [500, 1080, 1.35] : focus === "note2" ? [430, 1060, 1.9]
    : focus === "all" ? [500, 560, 0.72] : [500, RULE_Y[focus] + 50, 1.3];
  return (
    <Dark t={t}>
      <Sheet t={t} focus={f} rot={page === 1 ? -2 : 1.5}>
        <div style={{ position: "absolute", left: 70, top: 60, right: 70, fontFamily: CODE, color: "#1b1b1b" }}>
          <div style={{ fontSize: 46, fontWeight: 700, letterSpacing: 2 }}>야간 근무자 인수인계서</div>
          <div style={{ fontSize: 30, marginTop: 8, color: "#444" }}>{page} / 3 · 근무 22:00 ~ 08:00</div>
          <div style={{ height: 3, background: "#222", margin: "18px 0 26px" }} />
          {page === 1 ? <>
            <div style={{ fontSize: 34, marginBottom: 30 }}>1쪽부터 순서대로 읽을 것.</div>
            {RULES.map((r, i) => (
              <div key={i} style={{ position: "absolute", top: RULE_Y[i] - 60 + 120, left: 0, right: 0, fontSize: 31, lineHeight: 1.45, whiteSpace: "pre-wrap",
                opacity: typeof focus === "number" && focus !== i ? 0.45 : 1 }}>{r}</div>
            ))}
            {typeof focus === "number" ? <Underline t={t} x={0} y={RULE_Y[focus] + 112} w={560} /> : null}
          </> : <>
            {["폐기: 02:00 / 06:00 (삼각김밥·도시락 먼저)", "택배 접수 마감: 21:00", "담배 진열: 위 칸부터 번호 순서 그대로", "온장고 온도: 60도 확인", "청소: 04:00 바닥, 07:00 출입문 유리"].map((s, i) => (
              <div key={i} style={{ fontSize: 31, lineHeight: 2.1 }}>· {s}</div>
            ))}
          </>}
        </div>
        {page === 2 ? <div style={{ position: "absolute", left: 120, top: 930, width: 800, fontFamily: PEN, fontSize: 64, lineHeight: 1.05, color: "#1d2f78",
          transform: "skewX(14deg) rotate(-3deg)", textShadow: "-6px 1px 4px rgba(47,95,216,.45)" }}>
          지문 안 찍히면, 진짜로 집에 가지 마.<br />거울 봐. 거울 속에 있는 게 너야.<br /><span style={{ marginLeft: 420 }}>- 민호</span>
          <svg style={{ position: "absolute", left: -40, top: 40, overflow: "visible" }} width={10} height={10}>
            {[0, 1, 2, 3].map((k) => <ellipse key={k} cx={-10 + 140 * k} cy={60 + 40 * (k % 2)} rx={46} ry={9} fill={BLUE} opacity={0.18} />)}
          </svg>
        </div> : null}
      </Sheet>
    </Dark>
  );
};

/** page 3 folded and taped; Minho's right-slanted writing on its face */
export const Envelope: React.FC<{ t: number; open?: number }> = ({ t, open = 0 }) => (
  <Dark t={t}>
    <Sheet t={t} w={1000} h={640} rot={-4} focus={[500, 320, 1.05]} tone="#e4ddca">
      <div style={{ position: "absolute", inset: 0, borderTop: "2px solid rgba(0,0,0,.18)", background: "linear-gradient(180deg, rgba(0,0,0,.05), rgba(0,0,0,0) 40%)" }} />
      <div style={{ position: "absolute", left: 360, top: -30, width: 260, height: 110, background: "rgba(240,236,210,.62)", transform: `rotate(${4 - 30 * open}deg) translateY(${-120 * open}px)`,
        boxShadow: "0 2px 6px rgba(0,0,0,.2)", opacity: 1 - open }} />
      <div style={{ position: "absolute", left: 110, top: 170, fontFamily: PEN, fontSize: 82, lineHeight: 1.1, color: "#1d2f78", transform: "skewX(-14deg) rotate(-2deg)" }}>
        3쪽은 꼭 <span style={{ color: "#b3161b" }}>집에서</span> 읽을 것.<br />오늘은 바로 집에 갈 것.<br /><span style={{ marginLeft: 520 }}>- 민호</span>
      </div>
    </Sheet>
  </Dark>
);

export const LETTER = [
  "집에서 이걸 읽고 있다면, 다행이다.", "너도 나왔구나.", "처음엔 헷갈릴 거야. 기억이 전부 있으니까.", "그러니까 하나만 확인해 봐.",
  "지금 이 종이, 어느 손으로 들고 있어?", "괜찮아. 원래 주인은 거울 안에서 계속 일해.", "3시 13분 손님은, 그날 근무하는 사람의 거울이야.",
  "점장님은 알아. 그래서 왼손잡이만 뽑는 거야.", "다시는 그 매장에 가지 마.", "3쪽은 꼭, 집에서 읽으라고 해.",
];
/** page 3: Minho's letter, lines revealed up to `upto`; held in a hand on the right when hand = true */
export const Letter: React.FC<{ t: number; upto: number; hand?: boolean }> = ({ t, upto, hand = false }) => {
  const fy = 150 + 105 * Math.min(upto, LETTER.length - 1);
  return (
    <Dark t={t} light={[50, 40]} bg="#0d0c0a">
      <Sheet t={t} w={1100} h={1300} rot={-2} focus={[550, fy, hand ? 0.9 : 1.15]} tone="#ebe6d6">
        <div style={{ position: "absolute", left: 80, top: 50, fontFamily: CODE, fontSize: 30, color: "#555" }}>3 / 3</div>
        {LETTER.map((s, i) => (
          <div key={i} style={{ position: "absolute", left: 90, top: 120 + 105 * i, fontFamily: PEN, fontSize: 70, color: "#1d2f78",
            transform: "skewX(-14deg)", opacity: i < upto ? 0.85 : i === upto ? clamp(t * 1.6) : 0 }}>{s}</div>
        ))}
        {hand ? <svg style={{ position: "absolute", left: 980, top: 420, overflow: "visible" }} width={10} height={10}>
          <g transform="translate(40 0) scale(-1.5 1.5)"><HandShape t={t} ink={false} /></g>
        </svg> : null}
      </Sheet>
    </Dark>
  );
};

/** a hand seen from above, palm down, fingers up: a LEFT hand (thumb on the right, the pinky-side edge 손날 on the left) */
const HandShape: React.FC<{ t: number; ink: boolean; clean?: boolean }> = ({ t, ink }) => {
  const skin = "#f1e3d6";
  const fingers: [number, number, number][] = [[-70, -150, 92], [-24, -178, 110], [22, -170, 104], [64, -140, 86]];
  return (
    <g>
      <path d="M-100 -60 Q-110 60 -80 150 L-70 330 L90 330 L95 150 Q130 60 120 -40 Z" fill={skin} />
      {fingers.map(([x, y, h], k) => <rect key={k} x={x - 22} y={y - h * 0.2} width={44} height={h + 60} rx={22} fill={skin} />)}
      <path d="M100 0 Q170 -30 200 -100 Q215 -125 190 -135 Q160 -130 130 -70 Q110 -40 95 -20 Z" fill={skin} />
      <Mark t={t} k={1} w={7} pts={[[-100, -60], [-110, 60], [-80, 150], [-70, 330]]} />
      <Mark t={t} k={2} w={7} pts={[[90, 330], [95, 150], [120, 40]]} />
      {fingers.map(([x, y, h], k) => <Mark key={k} t={t} k={3 + k} w={6} pts={[[x - 22, y + 50], [x - 22, y], [x, y - h * 0.22], [x + 22, y], [x + 22, y + 50]]} />)}
      <Mark t={t} k={8} w={6} pts={[[100, 0], [170, -30], [200, -100], [190, -135], [160, -130], [130, -70], [110, -40]]} />
      {ink ? <g style={{ filter: "blur(5px)" }}>
        <path d="M-112 -20 Q-118 80 -88 180 L-80 300" stroke={BLUE} strokeWidth={34} fill="none" opacity={0.75} strokeLinecap="round" />
        <path d="M-104 30 Q-100 110 -84 160" stroke="#1e3fa8" strokeWidth={16} fill="none" opacity={0.7} strokeLinecap="round" />
      </g> : null}
    </g>
  );
};

/** a big hand close-up over a dark counter. side L = the narrator's left hand; hold = what it holds */
export const HandShot: React.FC<{ t: number; side: "L" | "R"; ink: boolean; hold?: "none" | "bottle" | "pen" | "paper"; bg?: string; label?: string }> = ({ t, side, ink, hold = "none", bg }) => {
  const shakeX = 3 * Math.sin(t * 13) * (hold === "bottle" ? 1 : 0.3);
  // HandShape is a left hand; the right hand is its mirror image
  const flip = side === "L" ? 1 : -1;
  return (
    <AbsoluteFill style={{ background: "#0a0b0d" }}>
      {bg ? <Img src={staticFile(bg)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "blur(10px) brightness(.35) saturate(.4)", transform: `scale(${1.1 + 0.01 * t})` }} /> : null}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <g transform={`translate(${W / 2 + shakeX} ${H * 0.58 - 10 * eOut(prog(t, 0, 0.8))}) scale(${flip * 1.9} 1.9)`}>
          {hold === "bottle" ? <g transform="translate(-10 -330)">
            <rect x={-70} y={0} width={140} height={330} rx={30} fill="rgba(190,225,255,.25)" stroke="rgba(220,240,255,.8)" strokeWidth={5} />
            <rect x={-30} y={-50} width={60} height={60} rx={10} fill="rgba(80,140,230,.85)" />
            <rect x={-70} y={120} width={140} height={70} fill="rgba(230,240,255,.55)" />
          </g> : null}
          {hold === "paper" ? null : <HandShape t={t} ink={ink} />}
          {hold === "paper" ? <g transform="translate(-60 -560) rotate(-4)">
            <rect x={-330} y={0} width={560} height={520} fill="#ebe6d6" stroke="rgba(0,0,0,.3)" strokeWidth={2} />
            {[0, 1, 2, 3, 4, 5].map((k) => <path key={k} d={wob([[-290, 70 + 70 * k], [-120, 62 + 70 * k], [60 + 30 * (k % 3), 72 + 70 * k]], 40 + k, 3)} stroke="#1d2f78" strokeWidth={9} fill="none" opacity={0.8} strokeLinecap="round" />)}
          </g> : null}
          {hold === "paper" ? <HandShape t={t} ink={ink} /> : null}
          {hold === "pen" ? <g transform="translate(-10 -120) rotate(-30)"><rect x={-9} y={-200} width={18} height={260} rx={8} fill="#222" /><path d="M-9 60 L0 90 L9 60 Z" fill="#888" /></g> : null}
        </g>
      </svg>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 55% 65% at 50% 55%, rgba(0,0,0,0) 40%, rgba(0,0,0,.85) 100%)" }} />
    </AbsoluteFill>
  );
};

/** a doodle character (our 도치 skin) wearing the store's green vest */
export const VestDoodle: React.FC<{ t: number; size: number; mood?: Mood; wave?: boolean; shake?: boolean; tint?: string; hood?: boolean; flip?: boolean }> = ({ t, size, mood = "neutral", wave, shake, hood, flip }) => {
  const rot = shake ? 9 * Math.sin(t * 3.4) : 0;
  return (
    <div style={{ position: "relative", width: size, height: size, transform: `rotate(${rot}deg) scaleX(${flip ? -1 : 1})`, transformOrigin: "50% 80%" }}>
      <Doodle c={{ hair: "#232323", hairdo: hood ? "bald" : "spiky" } as never} i={3} t={t} size={size} mood={mood} />
      <svg width={size} height={size} viewBox="0 0 200 200" style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        {hood ? <>
          <path d="M28 120 Q20 20 100 14 Q180 20 172 120 Q172 190 100 192 Q28 190 28 120 Z" fill="#6b6f74" />
          <ellipse cx={100} cy={104} rx={50} ry={46} fill="#050505" />
          <path d="M40 150 Q60 140 70 160 M140 150 Q150 136 165 152" stroke="#3d4045" strokeWidth={10} fill="none" />
        </> : <>
          <path d="M40 140 Q36 172 52 188 L86 190 L100 150 L114 190 L148 188 Q164 172 160 140 L132 128 L100 150 L68 128 Z" fill={VEST} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
          <rect x={118} y={160} width={26} height={12} rx={2} fill="#f2f2f2" stroke={INK} strokeWidth={2} />
        </>}
        {wave ? <g transform={`rotate(${25 * Math.sin(t * 7)} 160 120)`}><path d="M160 120 L190 70 L196 40" stroke={INK} strokeWidth={8} fill="none" strokeLinecap="round" /><circle cx={196} cy={40} r={9} fill="white" stroke={INK} strokeWidth={5} /></g> : null}
      </svg>
    </div>
  );
};

/** the round convex security mirror in the ceiling corner. inside: a store photo bulged into a circle, and what is in it */
export const Mirror: React.FC<{ t: number; src: string; v: "empty" | "print1" | "vest" | "me" | "wave" | "shake" | "print2" | "hood"; zoom?: number }> = ({ t, src, v, zoom = 1 }) => {
  const R = 330 * zoom, cx = W * 0.5, cy = H * 0.47;
  const flick = v === "vest" ? (Math.sin(t * 23) > 0.2 || t > 2.2 ? 0 : 0.85) * clamp(1 - Math.abs(t - 1.1)) : 1;
  return (
    <AbsoluteFill style={{ background: "linear-gradient(160deg, #1d2024 0%, #0c0d10 60%, #050506 100%)", overflow: "hidden" }}>
      <svg width={W} height={H} style={{ position: "absolute" }}>
        <path d={`M0 ${H * 0.18} L${W} ${H * 0.02}`} stroke="#2a2d33" strokeWidth={4} />
        <rect x={cx - 18} y={0} width={36} height={cy - R + 10} fill="#3a3d43" />
      </svg>
      <div style={{ position: "absolute", left: cx - R, top: cy - R, width: 2 * R, height: 2 * R, borderRadius: "50%", overflow: "hidden",
        boxShadow: "0 0 0 14px #2b2e33, 0 0 0 20px #111, 0 30px 80px rgba(0,0,0,.8)" }}>
        <Img src={staticFile(src)} style={{ position: "absolute", left: "-25%", top: "-25%", width: "150%", height: "150%", objectFit: "cover",
          filter: "brightness(.55) saturate(.45) contrast(1.1) blur(1.2px)", transform: `scale(${1.05 + 0.01 * t})`, borderRadius: "50%" }} />
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 45%, rgba(0,0,0,.65) 100%)" }} />
        {v === "vest" ? <div style={{ position: "absolute", left: R * 1.25, top: R * 0.8, opacity: flick, filter: "blur(1.5px)" }}><VestDoodle t={t} size={R * 0.42} /></div> : null}
        {v === "me" || v === "wave" || v === "shake" ? <div style={{ position: "absolute", left: R * 0.72, top: R * 0.62 }}>
          <VestDoodle t={t} size={R * 0.62} wave={v === "wave"} shake={v === "shake"} mood={v === "shake" ? "sad" : "neutral"} /></div> : null}
        {v === "hood" ? <div style={{ position: "absolute", left: R * 0.8, top: R * 0.75, filter: "blur(.8px)" }}><HoodFigure t={t} size={R * 0.5} /></div> : null}
        {v === "print1" || v === "print2" ? <svg width={2 * R} height={2 * R} style={{ position: "absolute", left: 0, top: 0, filter: "blur(2.5px)" }}>
          <HandPrint x={R * 0.8} y={R * 0.8} s={R / 330} />
          {v === "print2" ? <HandPrint x={R * 1.25} y={R * 0.78} s={R / 330} flip /> : null}
        </svg> : null}
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(ellipse 40% 26% at 34% 26%, rgba(255,255,255,.22), rgba(255,255,255,0) 70%)" }} />
      </div>
    </AbsoluteFill>
  );
};

const HandPrint: React.FC<{ x: number; y: number; s: number; flip?: boolean }> = ({ x, y, s, flip }) => (
  <g transform={`translate(${x} ${y}) scale(${(flip ? -1 : 1) * s} ${s})`} fill="rgba(235,240,245,.33)">
    <ellipse cx={0} cy={40} rx={58} ry={66} />
    {[[-44, -46, 16, 46], [-15, -66, 15, 54], [14, -64, 15, 52], [40, -44, 14, 42]].map(([a, b, rx, ry], k) => <ellipse key={k} cx={a} cy={b} rx={rx} ry={ry} />)}
    <ellipse cx={72} cy={20} rx={14} ry={38} transform="rotate(-35 72 20)" />
  </g>
);

/** CCTV monitor: a grey security view of the store with drawn figures; v two = two of me, glitch = two → one */
export const Cctv: React.FC<{ t: number; src: string; v: "one" | "two" | "glitch"; clock: number }> = ({ t, src, v, clock }) => {
  const s = clock + t, hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = Math.floor(s % 60);
  const g = v === "glitch" ? clamp(1 - Math.abs(t - 2.2) * 3) : 0;
  const two = v === "two" || (v === "glitch" && t < 2.2);
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    <AbsoluteFill style={{ background: "#08090a" }}>
      <div style={{ position: "absolute", left: 210, top: 80, width: 1500, height: 900, background: "#1a1c1f", borderRadius: 26, boxShadow: "0 0 0 10px #0f1012, 0 40px 90px rgba(0,0,0,.9)" }}>
        <div style={{ position: "absolute", left: 40, top: 36, right: 40, bottom: 36, overflow: "hidden", background: "#000" }}>
          <Img src={staticFile(src)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
            filter: "grayscale(1) contrast(1.25) brightness(.8)", transform: `translateX(${g * 40 * rnd(Math.floor(t * 30), 1)}px) scale(1.04)` }} />
          <div style={{ position: "absolute", left: 470, top: 360 }}><div style={{ filter: "grayscale(1) contrast(1.1)" }}><VestDoodle t={t} size={240} /></div></div>
          {two ? <div style={{ position: "absolute", left: 820, top: 350, opacity: v === "glitch" ? 1 - g * 0.5 * (1 + rnd(Math.floor(t * 24), 3)) : 1 }}>
            <div style={{ filter: "grayscale(1) contrast(1.1)" }}><VestDoodle t={t + 0.4} size={240} /></div></div> : null}
          <div style={{ position: "absolute", left: 455, top: 610, fontFamily: CODE, fontSize: 26, color: "#ddd" }}>1번</div>
          <div style={{ position: "absolute", left: 805, top: 610, fontFamily: CODE, fontSize: 26, color: "#ddd" }}>2번</div>
          <AbsoluteFill style={{ backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,.05) 0 1px, transparent 1px 4px)", mixBlendMode: "screen" }} />
          {g > 0 ? <AbsoluteFill style={{ background: `rgba(255,255,255,${0.15 * g})`, transform: `translateY(${80 * rnd(Math.floor(t * 30), 5)}px)` }} /> : null}
          <div style={{ position: "absolute", left: 30, top: 24, fontFamily: CODE, fontWeight: 700, fontSize: 40, color: "#f2f2f2", textShadow: "0 0 6px #000" }}>CAM 02</div>
          <div style={{ position: "absolute", right: 30, top: 24, fontFamily: CODE, fontWeight: 700, fontSize: 40, color: "#f2f2f2", textShadow: "0 0 6px #000" }}>{p(hh)}:{p(mm)}:{p(ss)}</div>
          <div style={{ position: "absolute", left: 30, bottom: 24, fontFamily: CODE, fontSize: 30, color: RED }}>● REC</div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** wall time clock with a fingerprint pad; fails = how many "지문이 일치하지 않습니다" so far */
export const TimeClock: React.FC<{ t: number; fails: number }> = ({ t, fails }) => {
  const err = fails > 0;
  const blink = err && Math.floor(t * 4) % 2 === 0;
  return (
    <AbsoluteFill style={{ background: "linear-gradient(180deg,#24272b,#101113)" }}>
      <div style={{ position: "absolute", left: 610, top: 120, width: 700, height: 840, background: "#d9dadc", borderRadius: 40, boxShadow: "0 40px 90px rgba(0,0,0,.8), inset 0 -14px 0 #b7b9bc" }}>
        <div style={{ position: "absolute", left: 60, top: 60, width: 580, height: 300, background: err ? "#2a0d0d" : "#0e2a1a", borderRadius: 14, border: "8px solid #222",
          fontFamily: CODE, color: err ? (blink ? RED : "#ff8080") : "#7dffb0", textAlign: "center", paddingTop: 40 }}>
          <div style={{ fontSize: 44, fontWeight: 700 }}>퇴근 08:00</div>
          <div style={{ fontSize: 40, marginTop: 30 }}>{err ? "지문이 일치하지 않습니다" : "손가락을 올려 주세요"}</div>
          <div style={{ fontSize: 34, marginTop: 20 }}>{err ? "●".repeat(fails) + "○".repeat(Math.max(0, 3 - fails)) : ""}</div>
        </div>
        <div style={{ position: "absolute", left: 230, top: 450, width: 240, height: 300, borderRadius: 30, background: "#1d1f22", boxShadow: `0 0 ${err ? 50 : 30}px ${err ? "rgba(255,40,40,.7)" : "rgba(60,160,255,.5)"}` }}>
          <svg width={240} height={300}>{[0, 1, 2, 3, 4, 5].map((k) => <ellipse key={k} cx={120} cy={170} rx={20 + 15 * k} ry={30 + 18 * k} fill="none" stroke={err ? "#ff5050" : "#55aaff"} strokeWidth={4} opacity={0.75} />)}</svg>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** a phone with the manager's text messages, popping in one by one */
export const Phone: React.FC<{ t: number; msgs: string[]; from: string; times?: number[] }> = ({ t, msgs, from, times }) => (
  <AbsoluteFill style={{ background: "radial-gradient(circle at 50% 50%, #1b1d22, #060708)" }}>
    <div style={{ position: "absolute", left: 700, top: 50, width: 520, height: 980, borderRadius: 70, background: "#0b0b0c", boxShadow: "0 0 0 10px #2a2b2f, 0 40px 90px rgba(0,0,0,.9)" }}>
      <div style={{ position: "absolute", left: 30, top: 30, right: 30, bottom: 30, borderRadius: 50, background: "#15171b", overflow: "hidden" }}>
        <div style={{ height: 130, background: "#1f2227", fontFamily: BODY, fontWeight: 800, fontSize: 36, color: "#eee", textAlign: "center", paddingTop: 60 }}>{from}</div>
        {msgs.map((m, i) => {
          const a = prog(t, times ? times[i] : i * 1.2, 0.25);
          return a > 0 ? <div key={i} style={{ margin: "26px 34px 0", padding: "20px 26px", background: "#2c2f36", borderRadius: 26, fontFamily: BODY, fontWeight: 700,
            fontSize: 34, lineHeight: 1.35, color: "#f3f3f3", opacity: a, transform: `translateY(${20 * (1 - a)}px)`, whiteSpace: "pre-wrap" }}>{m}</div> : null;
        })}
      </div>
    </div>
  </AbsoluteFill>
);

/** red digital clock */
export const Clock: React.FC<{ t: number; text: string }> = ({ t, text }) => (
  <AbsoluteFill style={{ background: "#040405", justifyContent: "center", alignItems: "center" }}>
    <div style={{ fontFamily: CODE, fontWeight: 700, fontSize: 330, color: RED, letterSpacing: 20, textShadow: `0 0 ${30 + 10 * Math.sin(t * 9)}px rgba(255,30,30,.8)`,
      opacity: 0.8 + 0.2 * Math.sin(t * 31) * (Math.sin(t * 2) > 0.8 ? 1 : 0.1) }}>{text}</div>
  </AbsoluteFill>
);

/** the night-shift roster with Minho struck through and my name written under it */
export const Roster: React.FC<{ t: number }> = ({ t }) => (
  <Dark t={t}>
    <Sheet t={t} w={1100} h={760} rot={1.5} focus={[550, 380, 1.05]} tone="#f2efe6">
      <div style={{ position: "absolute", left: 70, top: 50, fontFamily: CODE, fontWeight: 700, fontSize: 46 }}>근무표</div>
      {[["주간", "08:00~15:00", "이수아"], ["오후", "15:00~22:00", "박정현"], ["야간", "22:00~08:00", "김민호"]].map((r, i) => (
        <div key={i} style={{ position: "absolute", left: 70, top: 160 + 120 * i, fontFamily: CODE, fontSize: 40, display: "flex", gap: 60 }}>
          <span>{r[0]}</span><span>{r[1]}</span><span style={{ position: "relative" }}>{r[2]}{i === 2 ? <span style={{ position: "absolute", left: -10, right: -10, top: 22, height: 6, background: "#222", transform: "rotate(-4deg)" }} /> : null}</span>
        </div>
      ))}
      <div style={{ position: "absolute", left: 640, top: 520, fontFamily: PEN, fontSize: 92, color: "#222", transform: "rotate(-3deg)", opacity: clamp(t * 1.5) }}>한서준</div>
    </Sheet>
  </Dark>
);

/** the work log: Minho's smudged left-slant lines, then mine; `mine` = my 3:13 line, neat */
export const LogBook: React.FC<{ t: number; mine: boolean }> = ({ t, mine }) => (
  <Dark t={t}>
    <Sheet t={t} w={1100} h={900} rot={-1} focus={[550, mine ? 600 : 420, 1.1]} tone="#efeadc">
      <div style={{ position: "absolute", left: 70, top: 46, fontFamily: CODE, fontWeight: 700, fontSize: 44 }}>근무일지 · 야간</div>
      {["00:40 택배 1건 접수", "01:30 컵라면 1", "02:00 폐기 처리"].map((s, i) => (
        <div key={i} style={{ position: "absolute", left: 90, top: 170 + 110 * i, fontFamily: PEN, fontSize: 74, color: "#1d2f78", transform: "skewX(14deg)",
          textShadow: "-7px 1px 5px rgba(47,95,216,.5)" }}>{s}</div>
      ))}
      {mine ? <div style={{ position: "absolute", left: 90, top: 520, fontFamily: PEN, fontSize: 80, color: "#1d2f78", transform: "skewX(-12deg)", opacity: clamp(t * 1.2) }}>
        03:13 생수 1</div> : null}
    </Sheet>
  </Dark>
);

/** five wet coins on the counter */
export const Coins: React.FC<{ t: number; bg?: string }> = ({ t, bg }) => (
  <AbsoluteFill style={{ background: "#0b0c0e" }}>
    {bg ? <Img src={staticFile(bg)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "blur(12px) brightness(.3)" }} /> : null}
    <svg width={W} height={H} style={{ position: "absolute" }}>
      {[[760, 560], [900, 600], [1040, 540], [1160, 610], [960, 470]].map(([x, y], k) => {
        const a = prog(t, 0.3 * k, 0.2);
        return a > 0 ? <g key={k} transform={`translate(${x} ${y - 30 * (1 - a)})`} opacity={a}>
          <ellipse rx={78} ry={46} fill="#9a9a96" stroke="#5a5a56" strokeWidth={6} /><ellipse rx={56} ry={31} fill="none" stroke="#6f6f6b" strokeWidth={4} />
          <ellipse cx={-20} cy={-12} rx={14} ry={7} fill="rgba(255,255,255,.55)" /><ellipse cx={26} cy={14} rx={9} ry={5} fill="rgba(200,230,255,.6)" />
          <path d={`M60 20 q14 ${10 + 6 * k} 2 ${26 + 4 * k}`} stroke="rgba(170,210,240,.5)" strokeWidth={8} fill="none" />
        </g> : null;
      })}
    </svg>
    <AbsoluteFill style={{ background: "radial-gradient(ellipse 55% 60% at 50% 52%, rgba(0,0,0,0) 40%, rgba(0,0,0,.9) 100%)" }} />
  </AbsoluteFill>
);

/** the grey-hooded customer (no face: the hood opening is all shadow; shoulders wet on a dry night) */
export const HoodFigure: React.FC<{ t: number; size: number }> = ({ t, size }) => (
  <svg width={size} height={size * 1.1} viewBox="0 0 400 440" style={{ overflow: "visible" }}>
    <defs><radialGradient id="hg" cx="50%" cy="30%" r="70%"><stop offset="0" stopColor="#8a8e94" /><stop offset="1" stopColor="#4a4d52" /></radialGradient></defs>
    <path d={wob([[30, 440], [40, 330], [80, 270], [120, 250], [110, 150], [140, 60], [200, 30], [260, 60], [290, 150], [280, 250], [320, 270], [360, 330], [370, 440]], boil(t), 2)} fill="url(#hg)" stroke="#111" strokeWidth={7} />
    <path d={wob([[150, 210], [140, 140], [165, 95], [200, 85], [235, 95], [260, 140], [250, 210], [200, 235], [150, 210]], boil(t) + 3, 1.5)} fill="#030303" />
    <path d="M90 268 Q130 300 150 290 M250 290 Q280 300 312 268" stroke="#3a3c40" strokeWidth={22} fill="none" opacity={0.8} strokeLinecap="round" />
    {[0, 1, 2].map((k) => { const q = (t * 0.6 + k * 0.33) % 1; return <ellipse key={k} cx={[100, 300, 128][k]} cy={290 + 120 * q} rx={4} ry={8} fill="#9cc4e0" opacity={0.7 * (1 - q)} />; })}
    <path d="M200 250 L200 440" stroke="#2c2e31" strokeWidth={5} />
  </svg>
);
export const Hoodie: React.FC<{ t: number; bg: string; close?: boolean }> = ({ t, bg, close }) => (
  <AbsoluteFill style={{ background: "#000" }}>
    <Img src={staticFile(bg)} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "brightness(.42) saturate(.35) blur(2px)", transform: `scale(${1.05 + 0.008 * t})` }} />
    <div style={{ position: "absolute", left: close ? 610 : 1060, top: close ? 200 : 470, filter: "drop-shadow(0 20px 30px rgba(0,0,0,.8))" }}>
      <HoodFigure t={t} size={close ? 700 : 420} />
    </div>
    <AbsoluteFill style={{ background: "radial-gradient(ellipse 60% 70% at 55% 50%, rgba(0,0,0,0) 35%, rgba(0,0,0,.85) 100%)" }} />
  </AbsoluteFill>
);

/** home entrance: a hand groping the left wall; the switch is on the right */
export const Switch: React.FC<{ t: number }> = ({ t }) => {
  const on = t > 2.6, hx = on ? 1300 : t < 1.4 ? 560 + 70 * Math.sin(t * 3) : 560 + 740 * eOut(prog(t, 1.4, 1.2));
  return (
    <AbsoluteFill>
      <svg width={W} height={H} style={{ position: "absolute" }}>
        <rect x={0} y={0} width={W} height={H} fill={on ? "#6d665a" : "#14120f"} />
        <rect x={1240} y={360} width={130} height={200} rx={14} fill={on ? "#e8e4da" : "#2a2824"} stroke="#000" strokeWidth={4} />
        <rect x={1280} y={400 + (on ? 0 : 60)} width={50} height={80} rx={8} fill={on ? "#cfcac0" : "#3a3833"} />
        <g transform={`translate(${hx} ${on ? 760 : 820}) scale(1.05)`}><HandShape t={t} ink={false} /></g>
      </svg>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 65% 70% at 50% 50%, rgba(0,0,0,0) 40%, rgba(0,0,0,${on ? 0.6 : 0.85}) 100%)` }} />
    </AbsoluteFill>
  );
};

/** narrator 도치 in the bottom-left corner (about 18 % of the frame height) */
export const Narrator: React.FC<{ t: number; mood: Mood; show: number; flip?: boolean }> = ({ t, mood, show, flip }) => (
  show > 0 ? <div style={{ position: "absolute", left: 50, bottom: 140, opacity: show, transform: `translateY(${30 * (1 - show)}px)` }}>
    <div style={{ filter: "drop-shadow(0 8px 14px rgba(0,0,0,.8)) brightness(.92)" }}>
      <VestDoodle t={t} size={240} mood={mood} flip={flip} />
    </div>
  </div> : null
);

/** a full-frame stock photo or clip with a slow push-in and the series' dark grade */
export const Stock: React.FC<{ t: number; src: string; video?: boolean; from?: number; zoom?: [number, number]; pos?: string; dur: number }> = ({ t, src, video, from = 0, zoom = [1.04, 1.12], pos = "50% 50%", dur }) => {
  const z = zoom[0] + (zoom[1] - zoom[0]) * clamp(t / Math.max(1, dur));
  const st: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: pos, transform: `scale(${z})`, transformOrigin: pos };
  return (
    <AbsoluteFill style={{ background: "#000", overflow: "hidden" }}>
      {video ? <OffthreadVideo src={staticFile(src)} startFrom={Math.round(from * 30)} muted style={st} /> : <Img src={staticFile(src)} style={st} />}
    </AbsoluteFill>
  );
};

/** chapter card: a red word over black, typed-document style */
export const ChapterCard: React.FC<{ t: number; n: number; title: string }> = ({ t, n, title }) => {
  const a = clamp(t * 3) * (1 - prog(t, 1.9, 0.3));
  return (
    <AbsoluteFill style={{ background: `rgba(0,0,0,${0.75 * a})`, justifyContent: "center", alignItems: "center", opacity: a }}>
      <div style={{ fontFamily: CODE, fontSize: 40, color: "#bbb", letterSpacing: 8 }}>{String(n).padStart(2, "0")}</div>
      <div style={{ fontFamily: TITLE, fontSize: 120, color: "#f2f2f2", marginTop: 10 }}>{title}</div>
    </AbsoluteFill>
  );
};

/** the thumbnail: dark store photo, three lines of white text with one red word, the convex mirror on the right */
export const Thumb: React.FC = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    <Img src={staticFile("lfhorror1/ph/7300738.jpg")} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 40%", filter: "brightness(.45) saturate(.6) blur(7px)", transform: "scale(1.05)" }} />
    <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(0,0,0,.92) 0%, rgba(0,0,0,.75) 48%, rgba(0,0,0,.15) 100%)" }} />
    <div style={{ position: "absolute", left: 1130, top: 150, width: 720, height: 720, borderRadius: "50%", overflow: "hidden",
      boxShadow: "0 0 0 16px #2b2e33, 0 0 0 24px #111, 0 30px 80px rgba(0,0,0,.9)" }}>
      <Img src={staticFile("lfhorror1/ph/15491784c.jpg")} style={{ position: "absolute", left: "-25%", top: "-25%", width: "150%", height: "150%", objectFit: "cover", filter: "brightness(.5) saturate(.4) blur(1.5px)" }} />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle, rgba(0,0,0,0) 45%, rgba(0,0,0,.7) 100%)" }} />
      <div style={{ position: "absolute", left: 190, top: 210 }}><VestDoodle t={0.3} size={360} wave /></div>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 40% 26% at 34% 26%, rgba(255,255,255,.2), rgba(255,255,255,0) 70%)" }} />
    </div>
    <div style={{ position: "absolute", left: 1475, top: 0, width: 30, height: 150, background: "#3a3d43" }} />
    <div style={{ position: "absolute", left: 90, top: 150, fontFamily: TITLE, fontSize: 190, lineHeight: 1.12, color: "#f5f5f5", WebkitTextStroke: "10px #000", paintOrder: "stroke", textShadow: "0 10px 40px #000" }}>
      <div>3쪽은</div>
      <div><span style={{ color: RED }}>여기서</span></div>
      <div>펴지 마</div>
    </div>
    <div style={{ position: "absolute", left: 96, bottom: 70, fontFamily: CODE, fontWeight: 700, fontSize: 44, color: "#d8d2c0", letterSpacing: 4 }}>야간 근무자 인수인계서</div>
  </AbsoluteFill>
);
