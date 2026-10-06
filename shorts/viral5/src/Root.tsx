import { Composition } from "remotion";
import { ClipShort, FPS } from "./ClipShort";
import { SHORTS } from "./data";

export const RemotionRoot: React.FC = () => (
  <>
    {SHORTS.map((d) => (
      <Composition key={d.id} id={d.id} component={ClipShort} defaultProps={{ data: d }} width={1080} height={1920} fps={FPS} durationInFrames={Math.ceil(d.end * FPS)} />
    ))}
  </>
);
