// lfsaeyeon1 (사연툰 "반찬통 이름표"): the drawn sets and props for a 1920×1080 stage. Everything is drawn here
// (no photos): the kitchen, the open fridge with its labelled side-dish boxes, the living room, the bedroom and the
// split "각방" bedroom, the in-laws' living room, the dark kitchen at dawn, the front door, and close-ups
// (the 장조림 with neat or crooked star carrots, the band-aided hand, the door-lock log, the phone photo...).
// No real brand, app or logo appears: the door-lock app, the chat and the ketchup bottle are generic.
import React from "react";
import { BODY, TITLE } from "../fonts";
import { eBack, prog } from "../fx";

const INK = "#1b1b1f";
export const W = 1920, H = 1080, FLOOR = 900;
const HAND = BODY;  // labels are "handwritten" in the heavy body face

/** a white sticker label with a name */
const Label: React.FC<{ x: number; y: number; text: string; w?: number; size?: number; rot?: number; color?: string; hi?: boolean }> = ({ x, y, text, w = 120, size = 34, rot = -3, color = INK, hi }) => (
  <g transform={`translate(${x} ${y}) rotate(${rot})`}>
    <rect x={-w / 2} y={-size * 0.8} width={w} height={size * 1.6} rx={6} fill={hi ? "#fffbd1" : "#ffffff"} stroke={hi ? "#e8212e" : "#9aa0aa"} strokeWidth={hi ? 5 : 3} />
    <text x={0} y={size * 0.36} textAnchor="middle" fontFamily={HAND} fontWeight={900} fontSize={size} fill={color}>{text}</text>
  </g>
);

/** side dishes inside a box, seen from the front (a band of colour behind the box wall) */
const fillOf: Record<string, string> = { jjorim: "#7a4a2a", perilla: "#3f8f3a", kimchi: "#d9452b", myeolchi: "#c9a46a", mom: "#6b6b74", empty: "transparent", egg: "#fff3c4", tofu: "#f7f3e8" };

/** a side-dish box: glass (clear, blue lid), steel (opaque silver), red-lid (kimchi) */
export const Box: React.FC<{ x: number; y: number; w?: number; h?: number; kind?: "glass" | "steel" | "red"; label?: string; fill?: string; level?: number; hi?: boolean; ls?: number }> =
  ({ x, y, w = 200, h = 120, kind = "glass", label, fill = "jjorim", level = 0.7, hi, ls = 44 }) => {
  const lid = kind === "steel" ? "#a9b0ba" : kind === "red" ? "#e04a3a" : "#5fa8e8";
  const wall = kind === "steel" ? "url(#sy-steel)" : "rgba(220,240,255,.55)";
  return (
    <g transform={`translate(${x} ${y})`}>
      {kind !== "steel" && fill !== "empty" ? <rect x={-w / 2 + 8} y={-h * level} width={w - 16} height={h * level - 6} rx={8} fill={fillOf[fill] ?? fill} /> : null}
      {kind !== "steel" && fill === "jjorim" ? [0.25, 0.5, 0.75].map((k) => <g key={k}><ellipse cx={-w / 2 + w * k} cy={-h * level * 0.55} rx={13} ry={10} fill="#fff" /><circle cx={-w / 2 + w * k} cy={-h * level * 0.55} r={5} fill="#f5c542" /></g>) : null}
      {kind !== "steel" && fill === "perilla" ? [0.2, 0.45, 0.7].map((k) => <path key={k} d={`M${-w / 2 + w * k} ${-h * level + 10} q22 10 0 ${h * level * 0.7} q-22 -10 0 ${-h * level * 0.7}`} fill="#57b04f" stroke="#2e6b2a" strokeWidth={3} />) : null}
      <rect x={-w / 2} y={-h} width={w} height={h} rx={14} fill={wall} stroke={INK} strokeWidth={5} />
      <rect x={-w / 2 - 6} y={-h - 18} width={w + 12} height={24} rx={10} fill={lid} stroke={INK} strokeWidth={5} />
      {label ? <Label x={0} y={-h * 0.45} text={label} w={Math.max(90, label.length * ls * 0.95 + 26)} size={ls} hi={hi} /> : null}
    </g>
  );
};

/** the fridge, door open, filling the frame; its shelves are stocked per `stock` */
const Fridge: React.FC<{ stock?: string; t: number; crowd?: number }> = ({ stock = "label_many", t, crowd = 0 }) => {
  const close = (k: number) => crowd ? `translate(${W / 2} 700) scale(${0.62 * k})` : `translate(${W / 2} 820) scale(${k})`;
  const shelf = (y: number) => <g key={y}><rect x={250} y={y} width={1420} height={18} fill="rgba(210,235,255,.85)" stroke="#8fb6d6" strokeWidth={3} /></g>;
  const p = (d: number) => eBack(prog(t, d, 0.3), 2);
  const L = stock === "label_more" || stock === "label_many" || stock === "box_mom" || stock === "box_ji";
  const lab = (s: string) => (L ? s : undefined);
  const one = stock === "label_one";
  return (
    <g>
      <rect x={0} y={0} width={W} height={H} fill="#d8e9f5" />
      <rect x={200} y={30} width={1520} height={1040} rx={40} fill="#f4fbff" stroke="#9cbad1" strokeWidth={10} />
      <rect x={760} y={40} width={400} height={26} rx={13} fill="#fff6c9" opacity={0.95} />
      <rect x={0} y={0} width={190} height={H} fill="#e6eef5" stroke="#9cbad1" strokeWidth={8} />
      {[160, 420, 680].map((y, k) => <g key={k}><rect x={20} y={y} width={150} height={16} fill="#c9dbe8" />
        <rect x={40} y={y - 120} width={44} height={120} rx={12} fill={["#ffd36b", "#c7e8ff", "#ffb0a0"][k]} stroke={INK} strokeWidth={4} />
        <rect x={100} y={y - 90} width={52} height={90} rx={10} fill={["#9be07b", "#fff", "#ffe8a6"][k]} stroke={INK} strokeWidth={4} /></g>)}
      {[350, 640].map(shelf)}
      {/* top shelf */}
      <g transform={`scale(1)`}>
        {stock === "box_empty" || stock === "boxes_half" ? <>
          <Box x={520} y={350} w={260} h={150} fill={stock === "box_empty" ? "empty" : "perilla"} level={stock === "box_empty" ? 0 : 0.3} />
          <Box x={860} y={350} w={230} h={130} fill="jjorim" level={0.25} />
          <Box x={1180} y={350} kind="red" w={220} h={140} fill="kimchi" level={0.4} />
          <Box x={1460} y={350} w={200} h={110} fill="myeolchi" level={0.2} />
        </> : <>
          <Box x={520} y={350} w={260} h={150} fill="jjorim" label={one ? undefined : lab("지은")} />
          <Box x={860} y={350} w={230} h={130} fill="myeolchi" label={one ? undefined : lab("지은")} />
          <Box x={1180} y={350} kind="red" w={220} h={140} fill="kimchi" label={one ? undefined : lab("도윤")} />
          <Box x={1460} y={350} w={200} h={110} fill="perilla" level={0.5} label={one ? undefined : lab("지은")} />
        </>}
      </g>
      {/* middle shelf: the two steel boxes at the back */}
      <g opacity={stock === "box_empty" || stock === "boxes_half" ? 1 : 1}>
        <Box x={560} y={640} kind="steel" w={240} h={150} label={one ? undefined : stock === "box_mom" ? undefined : lab("엄마")} />
        <Box x={860} y={640} kind="steel" w={240} h={150} label={one ? "어머님 거 · 화요일" : stock === "box_mom" ? undefined : lab("엄마")} ls={one ? 40 : 44} hi={one} />
        <Box x={1200} y={640} w={240} h={120} fill="tofu" label={stock === "label_more" ? "도윤" : undefined} />
        <g transform="translate(1480 640)"><rect x={-110} y={-90} width={220} height={90} rx={10} fill="#f2e2c4" stroke={INK} strokeWidth={5} />
          {[-70, -25, 20, 65].map((x) => <ellipse key={x} cx={x} cy={-60} rx={18} ry={22} fill="#fff8ec" stroke={INK} strokeWidth={3} />)}
          {stock === "label_more" ? <Label x={0} y={-24} text="지은" w={110} size={32} /> : null}</g>
      </g>
      {/* bottom: ketchup */}
      {stock === "label_more" || stock === "ketchup" ? <g transform={`translate(1380 1010) scale(${stock === "ketchup" ? p(0.2) * 1.15 : 1})`}>
        <path d="M-50 0 L-56 -190 C-56 -230 56 -230 56 -190 L50 0 Z" fill="#e8322b" stroke={INK} strokeWidth={6} />
        <rect x={-22} y={-262} width={44} height={44} rx={8} fill="#fff" stroke={INK} strokeWidth={5} />
        <Label x={0} y={-110} text="우리" w={100} size={36} rot={4} hi={stock === "ketchup"} /></g> : null}
      {/* the steel boxes close up */}
      {stock === "box_mom" ? <g transform={close(0.6 + 0.4 * p(0.1))}>
        <rect x={-560} y={-360} width={1120} height={400} rx={30} fill="rgba(255,255,255,.75)" />
        <Box x={-240} y={0} kind="steel" w={420} h={260} label="엄마" ls={80} />
        <Box x={240} y={0} kind="steel" w={420} h={260} label="엄마" ls={80} /></g> : null}
      {stock === "box_ji" ? <g transform={close(0.6 + 0.4 * p(0.1))}>
        <rect x={-380} y={-360} width={760} height={400} rx={30} fill="rgba(255,255,255,.75)" />
        <Box x={0} y={0} w={560} h={270} fill="jjorim" label="지은" ls={80} /></g> : null}
    </g>
  );
};

/** wall + floor */
const Room: React.FC<{ c1: string; c2: string; floor: string; children?: React.ReactNode }> = ({ c1, c2, floor, children }) => (
  <g>
    <defs><linearGradient id={`sy-w-${c1.slice(1)}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c1} /><stop offset="1" stopColor={c2} /></linearGradient></defs>
    <rect x={0} y={0} width={W} height={H} fill={`url(#sy-w-${c1.slice(1)})`} />
    {children}
    <rect x={0} y={FLOOR - 40} width={W} height={H - FLOOR + 40} fill={floor} />
    <rect x={0} y={FLOOR - 52} width={W} height={14} fill="rgba(0,0,0,.12)" />
  </g>
);

const Kitchen: React.FC<{ dark?: boolean }> = ({ dark }) => (
  <g>
    <Room c1={dark ? "#1b2340" : "#fff4e6"} c2={dark ? "#252f55" : "#ffe8cf"} floor={dark ? "#2a2a3e" : "#d7b48c"}>
      {/* tiles */}
      <rect x={0} y={330} width={W} height={300} fill={dark ? "#222a4a" : "#f3fbff"} />
      {Array.from({ length: 24 }, (_, k) => <path key={k} d={`M${k * 80} 330 L${k * 80} 630`} stroke={dark ? "#2c365c" : "#d8e8f0"} strokeWidth={3} />)}
      {[410, 490, 570].map((y) => <path key={y} d={`M0 ${y} L${W} ${y}`} stroke={dark ? "#2c365c" : "#d8e8f0"} strokeWidth={3} />)}
      {/* upper cabinets */}
      {[0, 1, 2, 3].map((k) => <rect key={k} x={120 + k * 280} y={60} width={260} height={240} rx={10} fill={dark ? "#3a3f63" : "#f7d9b5"} stroke={dark ? "#14182e" : "#c69a6b"} strokeWidth={6} />)}
      {/* hood */}
      <path d="M1290 60 L1550 60 L1610 300 L1230 300 Z" fill={dark ? "#4b506e" : "#c7ccd4"} stroke={INK} strokeWidth={6} />
      {/* counter */}
      <rect x={60} y={630} width={1640} height={40} rx={8} fill={dark ? "#5a5f80" : "#f1f1f1"} stroke={INK} strokeWidth={5} />
      <rect x={80} y={670} width={1600} height={200} fill={dark ? "#39405f" : "#e9c79d"} stroke={INK} strokeWidth={5} />
      {[0, 1, 2, 3, 4].map((k) => <rect key={k} x={110 + k * 315} y={700} width={280} height={140} rx={8} fill="none" stroke={dark ? "#2b3150" : "#c69a6b"} strokeWidth={5} />)}
      {/* stove */}
      <rect x={1290} y={612} width={260} height={20} rx={6} fill="#2b2b33" />
      <path d="M1330 600 L1330 540 C1330 520 1450 520 1450 540 L1450 600 Z" fill={dark ? "#8a8fa8" : "#9aa3ad"} stroke={INK} strokeWidth={5} />
      {/* fridge on the right */}
      <rect x={1720} y={110} width={190} height={760} rx={20} fill={dark ? "#4a5070" : "#e8eef3"} stroke={INK} strokeWidth={6} />
      <path d="M1720 420 L1910 420" stroke={INK} strokeWidth={5} /><rect x={1740} y={250} width={14} height={120} rx={7} fill={INK} />
      {dark ? <>
        <path d="M1020 0 L1020 120" stroke={INK} strokeWidth={6} />
        <path d="M960 120 L1080 120 L1110 170 L930 170 Z" fill="#ffd36b" stroke={INK} strokeWidth={5} />
        <path d="M930 170 L1110 170 L1420 880 L620 880 Z" fill="rgba(255,214,120,.25)" />
        {[0, 1, 2].map((k) => <path key={k} d={`M${1380 + k * 30} 520 q-14 -30 0 -60 q14 -30 0 -60`} fill="none" stroke="rgba(255,255,255,.4)" strokeWidth={6} strokeLinecap="round" />)}
      </> : null}
    </Room>
  </g>
);

const Living: React.FC = () => (
  <Room c1="#eef3e6" c2="#e2ead6" floor="#c9a57e">
    <rect x={180} y={140} width={520} height={400} rx={6} fill="#cfeaff" stroke="#fff" strokeWidth={22} />
    <path d="M440 140 L440 540 M180 340 L700 340" stroke="#fff" strokeWidth={14} />
    <rect x={150} y={120} width={60} height={460} rx={20} fill="#f2c6a0" /><rect x={670} y={120} width={60} height={460} rx={20} fill="#f2c6a0" />
    <rect x={1040} y={210} width={560} height={320} rx={16} fill="#2d2f3a" stroke={INK} strokeWidth={8} />
    <rect x={1000} y={540} width={640} height={60} rx={10} fill="#b98a5e" stroke={INK} strokeWidth={5} />
    <g transform="translate(1720 860)"><rect x={-60} y={-120} width={120} height={120} rx={16} fill="#d98a5b" stroke={INK} strokeWidth={5} />
      {[-50, 0, 50].map((a) => <ellipse key={a} cx={a * 0.9} cy={-210} rx={40} ry={90} fill="#69b85b" stroke={INK} strokeWidth={4} transform={`rotate(${a * 0.5} 0 -120)`} />)}</g>
  </Room>
);

const Bedroom: React.FC<{ x0?: number; w?: number; tint?: string }> = ({ x0 = 0, w = W, tint = "#e9e4ff" }) => (
  <g>
    <rect x={x0} y={0} width={w} height={H} fill={tint} />
    <rect x={x0 + w * 0.12} y={150} width={w * 0.22} height={300} rx={6} fill="#20264d" stroke="#fff" strokeWidth={16} />
    <circle cx={x0 + w * 0.27} cy={230} r={34} fill="#fff1a8" />
    <rect x={x0} y={FLOOR - 40} width={w} height={H - FLOOR + 40} fill="#b48d6a" />
    <rect x={x0 + w * 0.5} y={560} width={w * 0.44} height={260} rx={30} fill="#f4f4f4" stroke={INK} strokeWidth={6} />
    <rect x={x0 + w * 0.53} y={520} width={w * 0.38} height={120} rx={40} fill="#ffb3c7" stroke={INK} strokeWidth={5} />
    <rect x={x0 + w * 0.88} y={440} width={w * 0.08} height={420} rx={10} fill="#a8774e" stroke={INK} strokeWidth={5} />
  </g>
);

const Inlaw: React.FC = () => (
  <Room c1="#f6ead2" c2="#efdcb8" floor="#c08b55">
    {/* a sliding paper door, a folding screen with a painted plum branch, a wall clock */}
    <rect x={120} y={120} width={560} height={600} fill="#fbf6ea" stroke="#8a5a32" strokeWidth={14} />
    {[0, 1, 2].map((k) => <path key={k} d={`M${120 + (k + 1) * 140} 120 L${120 + (k + 1) * 140} 720`} stroke="#8a5a32" strokeWidth={6} />)}
    {[0, 1, 2, 3].map((k) => <path key={k} d={`M120 ${240 + k * 120} L680 ${240 + k * 120}`} stroke="#8a5a32" strokeWidth={6} />)}
    {[0, 1, 2, 3].map((k) => <rect key={k} x={1080 + k * 170} y={180} width={160} height={560} fill="#f3e3c3" stroke="#7a4f2e" strokeWidth={8} />)}
    <path d="M1110 640 C1200 520 1300 520 1380 420 C1440 340 1520 330 1600 250" fill="none" stroke="#5b3a22" strokeWidth={10} strokeLinecap="round" />
    {[[1240, 520], [1380, 420], [1500, 320], [1600, 250], [1180, 600]].map(([x, y], k) => <circle key={k} cx={x} cy={y} r={18} fill="#ff8fab" stroke="#b34766" strokeWidth={3} />)}
    <circle cx={880} cy={200} r={70} fill="#fff" stroke="#7a4f2e" strokeWidth={10} /><path d="M880 200 L880 155 M880 200 L912 214" stroke={INK} strokeWidth={7} strokeLinecap="round" />
    {/* the low table with dishes, in front */}
    <rect x={320} y={850} width={1280} height={60} rx={20} fill="#8a4f2a" stroke={INK} strokeWidth={6} />
    {[480, 760, 1040, 1320, 1480].map((x, k) => <ellipse key={k} cx={x} cy={846} rx={70} ry={20} fill={["#fff", "#f4e1c1", "#fff", "#e9f3ff", "#fff"][k]} stroke={INK} strokeWidth={4} />)}
  </Room>
);

const Door: React.FC = () => (
  <Room c1="#efe6d8" c2="#e6dac8" floor="#b9a58c">
    <rect x={760} y={110} width={420} height={760} rx={8} fill="#7a4e33" stroke="#4e311f" strokeWidth={14} />
    <rect x={1080} y={430} width={70} height={130} rx={12} fill="#2b2b33" stroke={INK} strokeWidth={5} />
    {[0, 1, 2].map((r) => [0, 1].map((c) => <circle key={`${r}${c}`} cx={1100 + c * 30} cy={455 + r * 30} r={8} fill="#9fd3ff" />))}
    <rect x={720} y={870} width={500} height={30} rx={8} fill="#7d6b5a" />
    <rect x={1300} y={560} width={300} height={300} rx={10} fill="#d9b48a" stroke={INK} strokeWidth={5} />
    {[640, 740].map((y) => <path key={y} d={`M1300 ${y} L1600 ${y}`} stroke={INK} strokeWidth={5} />)}
    <rect x={260} y={200} width={300} height={380} rx={14} fill="#f6f3ea" stroke={INK} strokeWidth={6} />
    <rect x={290} y={230} width={240} height={320} rx={8} fill="#d5e8f5" />
  </Room>
);

const NightCar: React.FC<{ t: number }> = ({ t }) => (
  <g>
    <rect x={0} y={0} width={W} height={H} fill="#141a33" />
    <rect x={100} y={120} width={1720} height={520} rx={60} fill="#232b52" stroke="#0b0f22" strokeWidth={20} />
    {Array.from({ length: 9 }, (_, k) => { const x = ((k * 260 - t * 420) % 2000 + 2000) % 2000 - 40; return <circle key={k} cx={x} cy={300 + (k % 3) * 60} r={16} fill="#ffd36b" opacity={0.7} />; })}
    <rect x={0} y={640} width={W} height={440} fill="#2a2f45" />
    <rect x={200} y={600} width={520} height={380} rx={60} fill="#3d4466" stroke={INK} strokeWidth={6} />
    <rect x={1200} y={600} width={520} height={380} rx={60} fill="#3d4466" stroke={INK} strokeWidth={6} />
  </g>
);

const Flash: React.FC = () => (
  <g>
    <defs><radialGradient id="sy-flash" cx="0.5" cy="0.45" r="0.75"><stop offset="0" stopColor="#fff3dc" /><stop offset="0.7" stopColor="#f2d8b0" /><stop offset="1" stopColor="#b98d5e" /></radialGradient></defs>
    <rect x={0} y={0} width={W} height={H} fill="url(#sy-flash)" />
    {Array.from({ length: 14 }, (_, k) => <circle key={k} cx={(k * 331) % W} cy={(k * 197) % 700 + 60} r={6 + (k % 3) * 4} fill="#fff" opacity={0.5} />)}
    <rect x={0} y={FLOOR - 40} width={W} height={H - FLOOR + 40} fill="rgba(160,120,80,.35)" />
  </g>
);

const Plain: React.FC<{ c1: string; c2: string }> = ({ c1, c2 }) => (
  <g><defs><radialGradient id={`sy-p-${c1.slice(1)}`} cx="0.5" cy="0.5" r="0.8"><stop offset="0" stopColor={c1} /><stop offset="1" stopColor={c2} /></radialGradient></defs>
    <rect x={0} y={0} width={W} height={H} fill={`url(#sy-p-${c1.slice(1)})`} /></g>
);

const Table: React.FC = () => (
  <g><rect x={0} y={0} width={W} height={H} fill="#c8955f" />
    {Array.from({ length: 12 }, (_, k) => <path key={k} d={`M0 ${k * 95 + 20} C600 ${k * 95 + 50} 1300 ${k * 95 - 10} ${W} ${k * 95 + 30}`} stroke="#b07e4b" strokeWidth={6} fill="none" />)}</g>
);

/** the backdrop for a scene */
export const Set: React.FC<{ bg: string; stock?: string; t: number; crowd?: number }> = ({ bg, stock, t, crowd }) => {
  switch (bg) {
    case "kitchen": return <Kitchen />;
    case "dawn": return <Kitchen dark />;
    case "fridge": return <Fridge stock={stock} t={t} crowd={crowd} />;
    case "living": return <Living />;
    case "bedroom": return <Bedroom />;
    case "bedroom2": return <g><Bedroom x0={0} w={W / 2} tint="#e9e4ff" /><Bedroom x0={W / 2} w={W / 2} tint="#dfeee4" />
      <rect x={W / 2 - 18} y={0} width={36} height={H} fill="#8a7f72" stroke={INK} strokeWidth={6} /></g>;
    case "inlaw": return <Inlaw />;
    case "door": return <Door />;
    case "night_car": return <NightCar t={t} />;
    case "flash": return <Flash />;
    case "table": return <Table />;
    case "ear": return <Plain c1="#ffe3e3" c2="#ffb3b3" />;
    case "hands": return <Plain c1="#fff6e8" c2="#f2d4b0" />;
    case "photo": return <Plain c1="#f3eadf" c2="#d9c6b0" />;
    case "lockapp": return <Plain c1="#e8f0fa" c2="#b8c9de" />;
    default: return <Plain c1="#fff6e8" c2="#ffe1c4" />;
  }
};

/** a bowl of 장조림 seen from above: halved quail eggs and star carrots, neat or crooked */
const Jjorim: React.FC<{ bad?: boolean; s?: number }> = ({ bad, s = 1 }) => {
  const star = (cx: number, cy: number, r: number, k: number) => {
    const pts = Array.from({ length: 10 }, (_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * (bad ? 0.62 + 0.25 * Math.sin(k * 7 + i * 3) : 0.45) : r * (bad ? 0.8 + 0.3 * Math.sin(k * 5 + i) : 1);
      return `${cx + Math.cos(a + (bad ? 0.2 * Math.sin(k + i) : 0)) * rr},${cy + Math.sin(a) * rr}`;
    });
    return <polygon key={k} points={pts.join(" ")} fill="#ff8a2a" stroke="#a84a10" strokeWidth={4} strokeLinejoin="round" />;
  };
  return (
    <g transform={`scale(${s})`}>
      <ellipse cx={0} cy={30} rx={400} ry={130} fill="rgba(0,0,0,.18)" />
      <ellipse cx={0} cy={0} rx={390} ry={250} fill="#fdfdfb" stroke={INK} strokeWidth={8} />
      <ellipse cx={0} cy={0} rx={330} ry={200} fill={bad ? "#4a2a14" : "#7a4a2a"} />
      {[[-220, -40], [-60, -110], [120, -60], [230, 40], [-130, 90], [40, 110]].map(([x, y], k) =>
        <path key={k} d={`M${x - 70} ${y} q35 -12 70 4 q35 10 70 -4`} stroke="#5a301a" strokeWidth={22} fill="none" strokeLinecap="round" />)}
      {[[-170, -100], [10, -20], [200, -120], [-40, 120], [220, 110], [-250, 50]].map(([x, y], k) => (
        <g key={k} transform={`translate(${x} ${y}) rotate(${bad ? 25 * Math.sin(k * 3) : 0})`}>
          <ellipse cx={0} cy={0} rx={bad ? 34 + 10 * Math.sin(k) : 40} ry={bad ? 26 + 8 * Math.cos(k * 2) : 32} fill="#fffaf0" stroke="#c9b48a" strokeWidth={3} />
          <ellipse cx={bad ? 6 : 0} cy={bad ? -3 : 0} rx={bad ? 13 : 17} ry={bad ? 10 : 15} fill="#f5c542" /></g>))}
      {[[-90, -40], [110, 40], [-230, -120], [260, -10], [-10, 170], [130, -150]].map(([x, y], k) => star(x, y, 44, k))}
      {bad ? [[-300, -170], [290, 160]].map(([x, y], k) => <text key={k} x={x} y={y} fontFamily={TITLE} fontSize={60} fill="#e8212e">!</text>) : null}
    </g>
  );
};

/** a phone, with whatever screen */
const Phone: React.FC<{ w?: number; h?: number; children: React.ReactNode }> = ({ w = 520, h = 900, children }) => (
  <g>
    <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={60} fill="#1b1b1f" />
    <rect x={-w / 2 + 18} y={-h / 2 + 18} width={w - 36} height={h - 36} rx={44} fill="#f6f8fb" />
    <svg x={-w / 2 + 18} y={-h / 2 + 18} width={w - 36} height={h - 36} viewBox={`0 0 ${w - 36} ${h - 36}`}>{children}</svg>
  </g>
);

const Hand: React.FC<{ old?: boolean; band?: boolean }> = ({ old, band }) => {
  const skin = old ? "#efc7a6" : "#ffd9c0", fingers = [[-120, -190, 300], [-40, -250, 360], [40, -235, 345], [118, -180, 290]];
  return (
    <g transform="scale(1.35)">
      {fingers.map(([x, y, h], k) => <rect key={k} x={x - 36} y={y} width={72} height={h} rx={36} fill={skin} stroke={INK} strokeWidth={8} />)}
      <rect x={-170} y={-20} width={340} height={330} rx={90} fill={skin} stroke={INK} strokeWidth={8} />
      {fingers.map(([x, y], k) => <rect key={k} x={x - 28} y={y + 40} width={56} height={60} rx={26} fill={skin} />)}
      <rect x={-250} y={20} width={150} height={74} rx={37} fill={skin} stroke={INK} strokeWidth={8} transform="rotate(-35 -170 60)" />
      {fingers.map(([x, y], k) => <path key={k} d={`M${x - 16} ${y + 26} q16 -10 32 0`} stroke="#d9a888" strokeWidth={5} fill="none" />)}
      {old ? fingers.map(([x, y], k) => <ellipse key={k} cx={x} cy={y + 120} rx={44} ry={30} fill="#e9a98a" stroke="#b9765a" strokeWidth={4} />) : null}
      {band ? [[-120, -110, -12], [-40, -150, 8], [40, -40, -6]].map(([x, y, r], k) => <g key={k} transform={`translate(${x} ${y}) rotate(${r})`}>
        <rect x={-50} y={-22} width={100} height={44} rx={18} fill="#f1c896" stroke={INK} strokeWidth={5} /><rect x={-16} y={-15} width={32} height={30} rx={5} fill="#e8b47a" />
        {[-34, 30].map((dx) => [-8, 8].map((dy) => <circle key={`${dx}${dy}`} cx={dx} cy={dy} r={3} fill="#d49a5e" />))}</g>) : null}
    </g>
  );
};

/** the prop for a scene: big and centred when nobody stands in the shot, at the side (on a little stand) otherwise */
export const Prop: React.FC<{ kind: string; t: number; alone: boolean }> = ({ kind, t, alone }) => {
  const p = eBack(prog(t, 0.15, 0.35), 2.2), s = alone ? 1 : 0.72;
  const at = (x: number, y: number, body: React.ReactNode) => <g transform={`translate(${x} ${y}) scale(${s * p})`}>{body}</g>;
  const cx = alone ? W / 2 : 1460, cy = alone ? 560 : 520;
  switch (kind) {
    case "jjorim": return at(cx, cy, <Jjorim />);
    case "jjorim_bad": return at(cx, cy, <Jjorim bad />);
    case "perilla": return at(cx, alone ? cy : 700, <g><Box x={0} y={140} w={520} h={260} fill="perilla" level={0.85} /></g>);
    case "boxes_row": return at(cx, alone ? cy : 640, <g>{[-330, -110, 110, 330].map((x, k) => <Box key={x} x={x} y={120} w={190} h={130} kind={k === 2 ? "red" : "glass"} fill={["jjorim", "myeolchi", "kimchi", "perilla"][k]} />)}</g>);
    case "box_mom": return at(cx, alone ? cy : 640, <g><Box x={-140} y={150} kind="steel" w={250} h={170} label="엄마" ls={56} /><Box x={140} y={150} kind="steel" w={250} h={170} label="엄마" ls={56} /></g>);
    case "box_ji": return at(cx, alone ? cy : 640, <Box x={0} y={150} w={360} h={200} fill="jjorim" label="지은" ls={60} />);
    case "hands": return at(cx, alone ? 600 : 560, <Hand band />);
    case "hands_mom": return at(cx, alone ? 600 : 560, <Hand old />);
    case "gloves_off": return at(cx, alone ? cy : 640, <g><path d="M-140 120 L-130 -60 C-130 -90 -90 -90 -90 -60 L-90 -120 C-90 -150 -50 -150 -50 -120 L-50 -140 C-50 -170 -10 -170 -10 -140 L-10 -120 C-10 -150 30 -150 30 -120 L30 -40 C30 -70 70 -70 70 -40 L70 60 C70 120 40 160 -20 160 Z"
      fill="#fff" stroke={INK} strokeWidth={7} transform="rotate(-20)" />{[-100, -60, -20].map((y) => <path key={y} d={`M-110 ${y + 120} l120 -20`} stroke="#d0d0d0" strokeWidth={4} />)}</g>);
    case "suitcase": return at(cx, alone ? cy : 640, <g><rect x={-260} y={-80} width={520} height={300} rx={30} fill="#3d7bd9" stroke={INK} strokeWidth={8} />
      <rect x={-240} y={-60} width={480} height={160} rx={16} fill="#f6f1e6" />{[[-180, "#ff8c7a"], [-40, "#ffe066"], [100, "#9be07b"]].map(([x, c]) => <rect key={x as number} x={x as number} y={-40} width={110} height={120} rx={10} fill={c as string} stroke={INK} strokeWidth={4} />)}
      <rect x={-60} y={-130} width={120} height={60} rx={20} fill="none" stroke={INK} strokeWidth={10} /></g>);
    case "notebook": return at(cx, alone ? cy : 600, <g><g transform="rotate(-6)"><rect x={-300} y={-220} width={420} height={500} rx={14} fill="#fffaf0" stroke={INK} strokeWidth={8} />
      <text x={-260} y={-140} fontFamily={HAND} fontWeight={900} fontSize={46} fill={INK}>지은이 장조림</text>
      {["간장 4큰술", "메추리알 반으로", "당근은 ★ 모양!"].map((s2, k) => <text key={k} x={-260} y={-50 + k * 80} fontFamily={HAND} fontWeight={800} fontSize={40} fill={k === 2 ? "#e8212e" : "#3b3b46"}>{s2}</text>)}</g>
      <g transform="translate(260 40) rotate(8)"><Phone w={260} h={460}><rect x={0} y={0} width={224} height={424} fill="#fffaf0" />
        <text x={20} y={80} fontFamily={HAND} fontWeight={900} fontSize={26} fill={INK}>지은이 장조림</text><text x={20} y={140} fontFamily={HAND} fontWeight={800} fontSize={22} fill="#3b3b46">간장 4큰술</text></Phone></g></g>);
    case "lockapp": return at(cx, alone ? 540 : 520, <Phone w={600} h={980}>
      <rect x={0} y={0} width={564} height={130} fill="#3b4a66" /><text x={282} y={84} textAnchor="middle" fontFamily={HAND} fontWeight={900} fontSize={42} fill="#fff">현관 · 열림 기록</text>
      {[["화", "14:10", 1], ["월", "19:42", 0], ["목", "14:10", 1], ["화", "14:11", 1], ["월", "08:05", 0], ["목", "14:09", 1]].map(([d, tm, hot], k) => (
        <g key={k} transform={`translate(0 ${170 + k * 120})`} opacity={prog(t, 0.4 + k * 0.25, 0.2)}>
          <rect x={24} y={0} width={516} height={100} rx={20} fill={hot ? "#fff0f0" : "#ffffff"} stroke={hot ? "#e8212e" : "#cfd6df"} strokeWidth={hot ? 5 : 3} />
          <text x={60} y={64} fontFamily={HAND} fontWeight={900} fontSize={44} fill={hot ? "#e8212e" : INK}>{`${d} ${tm}`}</text>
          <text x={500} y={64} textAnchor="end" fontFamily={HAND} fontWeight={800} fontSize={34} fill="#6b7280">비밀번호 열림</text></g>))}
    </Phone>);
    case "photo": return at(cx, alone ? 540 : 520, <Phone w={600} h={980}>
      <rect x={0} y={0} width={564} height={944} fill="#f1f3f6" />
      <svg x={0} y={140} width={564} height={460} viewBox="-420 -280 840 560"><rect x={-420} y={-280} width={840} height={560} fill="#c8955f" /><Jjorim /></svg>
      <rect x={30} y={640} width={420} height={110} rx={30} fill="#fff" stroke="#cfd6df" strokeWidth={3} />
      <text x={60} y={708} fontFamily={HAND} fontWeight={900} fontSize={40} fill={INK}>역시 엄마 장조림 👍</text>
      <text x={40} y={90} fontFamily={HAND} fontWeight={900} fontSize={40} fill="#6b7280">사진 · 한 달 전</text>
    </Phone>);
    case "ramen": return at(cx, alone ? cy : 660, <g><path d="M-200 -40 L200 -40 L170 160 C160 200 -160 200 -170 160 Z" fill="#c7ccd4" stroke={INK} strokeWidth={8} />
      <rect x={-230} y={-60} width={460} height={30} rx={14} fill="#9aa3ad" stroke={INK} strokeWidth={6} />
      {[-120, 0, 120].map((x, k) => <path key={x} d={`M${x} -70 q-20 -40 0 -80 q20 -40 0 -80`} fill="none" stroke="#9ec9ff" strokeWidth={14} strokeLinecap="round" opacity={0.6 + 0.4 * Math.sin(t * 5 + k)} />)}
      <path d="M200 0 q40 30 20 90 q-10 40 10 70" fill="none" stroke="#9ec9ff" strokeWidth={18} strokeLinecap="round" /></g>);
    case "sink_wet": return at(cx, alone ? cy : 660, <g><rect x={-260} y={-40} width={520} height={200} rx={30} fill="#d9dee5" stroke={INK} strokeWidth={8} />
      <rect x={-220} y={-20} width={440} height={140} rx={24} fill="#b9c3cf" />
      {Array.from({ length: 9 }, (_, k) => <path key={k} d={`M${-180 + k * 45} ${10 + (k % 3) * 30} q8 -16 16 0 q0 10 -8 10 q-8 0 -8 -10`} fill="#4fb3ff" />)}
      <path d="M180 -40 L180 -160 L60 -160" fill="none" stroke="#9aa3ad" strokeWidth={22} strokeLinecap="round" />
      <g transform="translate(420 40)"><path d="M-110 -60 L110 -60 L90 160 L-90 160 Z" fill="#7cc4a0" stroke={INK} strokeWidth={7} />
        <path d="M-40 30 l20 -34 l20 34 M-20 30 l0 50 M0 50 l40 0" stroke="#fff" strokeWidth={8} fill="none" opacity={0.0} />
        {[[-60, -80], [-20, -96], [24, -84], [64, -76], [-40, -110], [8, -118], [44, -104]].map(([x, y], k) => <path key={k} d={`M${x - 22} ${y + 10} q22 -40 44 0 l-8 -6 l-8 8 l-8 -8 l-8 8 l-8 -8 Z`} fill="#f4ead2" stroke="#8a6d4a" strokeWidth={3} transform={`rotate(${(k * 37) % 50 - 25} ${x} ${y})`} />)}
        {[[-50, -84], [30, -100], [0, -78]].map(([x, y], k) => <circle key={k} cx={x} cy={y} r={5} fill="#8a6d4a" opacity={0.7} />)}</g></g>);
    case "label_many": case "label_more": case "label_one": case "ketchup": case "boxes_half": case "box_empty": return null;  // drawn in the fridge
    default: return null;
  }
};
