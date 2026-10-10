// Stand-alone Remotion entry for lfhorror1 (used until the long-form kit's Long.tsx takes it over):
//   npx remotion render src/lib/long/lfhorror1_entry.tsx lfhorror1 out/lfhorror1.mp4
import { Composition, registerRoot } from "remotion";
import edit from "../../../longform/lfhorror1/edit.json";
import { LfhMain, type LfhEdit } from "./lfhorror1_main";

const e = edit as unknown as LfhEdit;
registerRoot(() => (
  <Composition id="lfhorror1" component={LfhMain} defaultProps={{ e }} width={1920} height={1080} fps={30} durationInFrames={Math.ceil(e.end * 30)} />
));
