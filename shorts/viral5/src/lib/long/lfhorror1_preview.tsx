// Dev-only preview of the lfhorror1 drawn pieces: npx remotion still src/lib/long/lfhorror1_preview.tsx lfhPreview --props='{"k":0}'
import React from "react";
import { Composition, registerRoot, useCurrentFrame } from "remotion";
import { loadFonts } from "../fonts";
import * as D from "./lfhorror1_draw";

const PICS: ((t: number) => React.ReactNode)[] = [
  (t) => <D.DocPage t={t} page={1} focus={2} />,
  (t) => <D.DocPage t={t} page={2} focus="note" />,
  (t) => <D.Envelope t={t} />,
  (t) => <D.HandShot t={t} side="R" ink={false} hold="paper" />,
  (t) => <D.Mirror t={t} src="lfhorror1/ph/15491784.jpg" v="wave" />,
  (t) => <D.Mirror t={t} src="lfhorror1/ph/15491784.jpg" v="print2" />,
  (t) => <D.HandShot t={t} side="L" ink />,
  (t) => <D.HandShot t={t} side="R" ink hold="bottle" bg="lfhorror1/ph/7300738.jpg" />,
  (t) => <D.Cctv t={t} src="lfhorror1/ph/15491784.jpg" v="two" clock={3 * 3600 + 13 * 60} />,
  (t) => <D.TimeClock t={t} fails={2} />,
  (t) => <D.Phone t={t} from="점장님" msgs={["서준아. 지문 안 찍혔지.", "오늘 밤 3시 13분 전에\n매장으로 와.", "그래야 돌아와."]} />,
  (t) => <D.Roster t={t} />,
  (t) => <D.LogBook t={t} mine />,
  (t) => <D.Coins t={t} bg="lfhorror1/ph/7300738.jpg" />,
  (t) => <D.Hoodie t={t} bg="lfhorror1/ph/15491784.jpg" />,
  (t) => <D.Switch t={t} />,
  (t) => <><D.Stock t={t} src="lfhorror1/ph/15491784.jpg" dur={10} /><D.Narrator t={t} mood="think" show={1} /></>,
  (t) => <D.Clock t={t} text="03:13" />,
  () => <D.Thumb />,
];
const P: React.FC<{ k: number }> = ({ k }) => {
  loadFonts(); D.loadLfhFonts();
  const t = useCurrentFrame() / 30;
  return <>{PICS[k](t)}</>;
};
registerRoot(() => <Composition id="lfhPreview" component={P} defaultProps={{ k: 0 }} width={1920} height={1080} fps={30} durationInFrames={300} />);
