// lfsaeyeon1's own Remotion entry (no change to the shorts' Root.tsx): the episode and its thumbnail.
// Render with longform/lfsaeyeon1/render.sh after prep.py has written src/data/lfsaeyeon1.json.
import React from "react";
import { AbsoluteFill, Composition, registerRoot } from "remotion";
import { loadFonts } from "../fonts";
import { SyThumb } from "./lfsaeyeon1_thumb";
import { FPS, SyVideo, syFrames, type SyData } from "./lfsaeyeon1_video";
import data from "../../data/lfsaeyeon1.json";

const Thumb: React.FC = () => { loadFonts(); return <AbsoluteFill><SyThumb /></AbsoluteFill>; };
const d = data as unknown as SyData;
const Root: React.FC = () => (
  <>
    <Composition id="lfsaeyeon1" component={SyVideo} defaultProps={{ data: d }} width={1920} height={1080} fps={FPS} durationInFrames={syFrames(d)} />
    <Composition id="lfsaeyeon1-thumb" component={Thumb} width={1920} height={1080} fps={FPS} durationInFrames={1} />
  </>
);
registerRoot(Root);
