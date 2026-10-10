import { Composition } from "remotion";
import { ClipShort, FPS, type ShortData } from "./ClipShort";
import { LongForm, longFrames } from "./LongForm";
import { PostFrameShort } from "./lib/PostFrame";
import { LongCompositions } from "./Long";
import { SHORTS } from "./data";
import { LONGS } from "./longs";
import { F1_FPS, F1Odyssey, f1Metadata } from "./lib/long/f1_Odyssey";
import { LfSaeyeon1Comps } from "./lib/long/lfsaeyeon1_comps";

export const RemotionRoot: React.FC = () => (
  <>
    {SHORTS.map((d) => (
      <Composition key={d.id} id={d.id} component={"postFrame" in d ? PostFrameShort : ClipShort} defaultProps={{ data: d }} width={1080} height={1920} fps={FPS} durationInFrames={Math.ceil(d.end * FPS)} />
    ))}
    {LONGS.map((l) => {
      const parts = l.parts.map((id) => SHORTS.find((d) => d.id === id)).filter((d): d is ShortData => !!d);
      return parts.length ? (
        <Composition key={l.id} id={l.id} component={LongForm} defaultProps={{ long: { ...l, parts } }} width={1920} height={1080} fps={FPS}
          durationInFrames={longFrames(parts)} />
      ) : null;
    })}
    <LongCompositions />
    <LfSaeyeon1Comps />
    <Composition id="odyssey" component={F1Odyssey} defaultProps={{ edit: null, route: null }} calculateMetadata={f1Metadata} width={1920} height={1080} fps={F1_FPS} durationInFrames={1} />
  </>
);
