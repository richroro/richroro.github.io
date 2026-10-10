// lfsaeyeon1's compositions (the episode and its thumbnail), added at the end of Root.tsx with one line.
// The data is longform/lfsaeyeon1/video.json (prep.py). Render with longform/lfsaeyeon1/render.sh.
import React from "react";
import { AbsoluteFill, Composition } from "remotion";
import { loadFonts } from "../fonts";
import { SyThumb } from "./lfsaeyeon1_thumb";
import { FPS, SyVideo, syFrames, type SyData } from "./lfsaeyeon1_video";
import data from "../../../longform/lfsaeyeon1/video.json";

const Thumb: React.FC = () => { loadFonts(); return <AbsoluteFill><SyThumb /></AbsoluteFill>; };
const d = data as unknown as SyData;
export const LfSaeyeon1Comps: React.FC = () => (
  <>
    <Composition id="lfsaeyeon1" component={SyVideo} defaultProps={{ data: d }} width={1920} height={1080} fps={FPS} durationInFrames={syFrames(d)} />
    <Composition id="lfsaeyeon1-thumb" component={Thumb} width={1920} height={1080} fps={FPS} durationInFrames={1} />
  </>
);

