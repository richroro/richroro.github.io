import { Composition } from "remotion";
import { END, Short } from "./Short";
import { FPS } from "./timeline";

export const RemotionRoot: React.FC = () => (
  <Composition id="Short" component={Short} width={1080} height={1920} fps={FPS} durationInFrames={Math.ceil(END * FPS)} />
);
