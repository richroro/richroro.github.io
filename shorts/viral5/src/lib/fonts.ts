// Korean display fonts (SIL OFL), loaded from public/fonts before the first frame renders.
import { continueRender, delayRender, staticFile } from "remotion";

export const TITLE = "BlackHanSans";
export const BODY = "Pretendard";

let started = false;
export const loadFonts = () => {
  if (started) return;
  started = true;
  const handle = delayRender("fonts");
  const faces = [
    new FontFace(TITLE, `url('${staticFile("fonts/BlackHanSans-Regular.ttf")}')`),
    new FontFace(BODY, `url('${staticFile("fonts/Pretendard-Black.otf")}')`, { weight: "900" }),
    new FontFace(BODY, `url('${staticFile("fonts/Pretendard-ExtraBold.otf")}')`, { weight: "800" }),
    new FontFace(BODY, `url('${staticFile("fonts/Pretendard-Bold.otf")}')`, { weight: "700" }),
  ];
  Promise.all(faces.map((f) => f.load().then(() => document.fonts.add(f))))
    .then(() => continueRender(handle))
    .catch((e) => { throw e; });
};
