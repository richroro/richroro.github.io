// More marker doodles for the white card's first item (lib/Card.tsx, "doodle" on an item): the "I didn't just draw it
// badly" hook, where our own scribble of a strange animal cuts to the real photo. Same hand as the sea pig and the
// chicken: thick black outline, flat fill, the line redrawn 8 times a second.
import React from "react";
import { BODY } from "./fonts";
import { CARD_BOX, blob, line, rnd } from "./Card";

const FPS = 30;
const INK = "#111";

/** a buffalo treehopper from the side (bug1): a green thorn-shaped body that rises to two horns over the head, a
 *  dot eye under the horns, orange stick legs and a "?" over it */
const TreehopperDoodle: React.FC<{ f: number }> = ({ f }) => {
  const s = Math.floor(f / (FPS / 8)) % 3 + 1;
  const W = CARD_BOX.width, H = CARD_BOX.height;
  const body: [number, number][] = [[150, 470], [300, 400], [460, 320], [610, 250], [700, 205], [780, 150], [770, 230], [820, 300], [835, 380],
    [800, 470], [700, 500], [560, 500], [400, 495], [260, 490], [150, 470]];
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <rect width={W} height={H} fill="#FFF7EC" />
      <path d={line([[60, 640], [300, 632], [520, 644], [760, 630], [940, 640]], s * 3, 4)} stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" />
      {[[420, 0], [560, 1], [700, 2]].map(([x, k]) => (
        <path key={k} d={line([[x, 495], [x - 30, 560], [x - 70, 630]], s * 7 + k, 3)} stroke="#E8A13A" strokeWidth={12} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      ))}
      <path d={line(body, s, 4) + " Z"} fill="#A8D86A" stroke={INK} strokeWidth={10} strokeLinejoin="round" />
      {/* the second horn, behind the first */}
      <path d={line([[690, 215], [735, 130], [745, 210]], s * 5, 3) + " Z"} fill="#C9A23A" stroke={INK} strokeWidth={8} strokeLinejoin="round" />
      {/* wing veins */}
      <path d={line([[200, 465], [380, 430], [560, 400]], s * 9, 3)} stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" />
      <path d={line([[300, 485], [450, 455], [600, 445]], s * 11, 3)} stroke={INK} strokeWidth={6} fill="none" strokeLinecap="round" />
      <path d={blob(780, 370, 26, 26, s * 13, 10, 0.08)} fill="#fff" stroke={INK} strokeWidth={7} />
      <circle cx={786 + rnd(s, 1) * 2} cy={372} r={10} fill={INK} />
      <text x={150 + rnd(s, 3) * 3} y={250} fontFamily={BODY} fontWeight={800} fontSize={100} fill={INK}>?</text>
      <text x={860 + rnd(s, 4) * 3} y={160} fontFamily={BODY} fontWeight={800} fontSize={70} fill={INK}>?</text>
    </svg>
  );
};

export const MORE_DOODLES = { treehopper: TreehopperDoodle };
