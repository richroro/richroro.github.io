// Native 16:9 narrated long-forms (1920×1080, 30 fps): documentaries over public-domain footage and photos, drawn
// 썰/괴담 stories on a wide stage, reused shorts, and full-screen cards, in chapters with a cold open, a title card and
// an end-screen outro. Everything comes from src/longdata/<id>.json, written by longform/prep_long.py from
// longform/<id>/script.json + edit.json. Each long also gets a 1280×720 thumbnail still, `<id>-thumb`.
import React from "react";
import { AbsoluteFill, Audio, Composition, Img, OffthreadVideo, Sequence, Still, getStaticFiles, staticFile, useCurrentFrame } from "remotion";
import { BODY } from "./lib/fonts";
import { loadFonts } from "./lib/fonts";
import { clamp, eInOut, lerp, prog } from "./lib/fx";
import { LongCaptions, KEY } from "./lib/long/LongCaptions";
import { BlurBg, ChapterCard, FactCard, MapCard, OutroSpace, RankCard, TextCard, TitleCard } from "./lib/long/Cards";
import { PostStage, Stage } from "./lib/long/Stage";
import { LongThumb } from "./lib/long/Thumb";
import type { FootageShot, LongData, PhotoShot, Shot } from "./lib/long/types";
import { LONGDATA } from "./longdata";

loadFonts();
const FPS = 30, W = 1920, H = 1080;
const fr = (s: number) => Math.round(s * FPS);
const have = (file?: string | null) => !!file && getStaticFiles().some((f) => f.name === file);

const Placeholder: React.FC<{ label?: string }> = ({ label }) => (
  <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 40%, #2b3566, #0b0e1d 75%)", justifyContent: "center", alignItems: "center" }}>
    <div style={{ fontFamily: BODY, fontWeight: 800, fontSize: 44, color: "rgba(255,255,255,.6)", border: "4px dashed rgba(255,255,255,.35)", borderRadius: 24, padding: "18px 30px" }}>🎬 {label ?? ""}</div>
  </AbsoluteFill>
);

/** where a w×h source goes so that (cx, cy) sits in the middle at `zoom` over a plain cover fit, never showing an edge */
const place = (w: number, h: number, cx: number, cy: number, zoom: number): React.CSSProperties => {
  const S = Math.max(W / w, H / h) * zoom, dw = w * S, dh = h * S;
  return { position: "absolute", left: Math.min(0, Math.max(W - dw, W / 2 - cx * dw)), top: Math.min(0, Math.max(H - dh, H / 2 - cy * dh)), width: dw, height: dh };
};

const Footage: React.FC<{ s: FootageShot; t: number; len: number }> = ({ s, t, len }) => {
  if (!have(s.file)) return <Placeholder label={s.label} />;
  const [p0, p1] = s.push ?? [1, 1.06];
  const push = lerp(p0, p1, clamp(t / Math.max(0.1, len)));
  const src = staticFile(s.file!);
  if (s.fit === "contain") {
    return (
      <AbsoluteFill style={{ background: "#000" }}>
        <BlurBg file={s.file} blur={s.blur} rate={s.speed} dim={0.4} />
        <AbsoluteFill style={{ transform: `scale(${push})` }}><OffthreadVideo src={src} muted playbackRate={s.speed} style={{ width: "100%", height: "100%", objectFit: "contain" }} /></AbsoluteFill>
      </AbsoluteFill>
    );
  }
  const [cx, cy, z] = s.crop ?? [0.5, 0.5, 1];
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#000" }}>
      <OffthreadVideo src={src} muted playbackRate={s.speed} style={place(s.w ?? W, s.h ?? H, cx, cy, z * push)} />
    </AbsoluteFill>
  );
};

const Photo: React.FC<{ s: PhotoShot; t: number; len: number }> = ({ s, t, len }) => {
  if (!have(s.file)) return <Placeholder />;
  const k = eInOut(clamp(t / Math.max(0.1, len)));
  const [a, b] = [s.kb.from, s.kb.to];
  const st = place(s.w, s.h, lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k));
  if (s.fit === "contain") {
    return (
      <AbsoluteFill style={{ background: "#000" }}>
        <BlurBg file={s.file} isImg blur={s.blur} dim={0.4} />
        <AbsoluteFill style={{ transform: `scale(${lerp(a[2], b[2], k)})` }}><Img src={staticFile(s.file)} style={{ width: "100%", height: "100%", objectFit: "contain" }} /></AbsoluteFill>
      </AbsoluteFill>
    );
  }
  return <AbsoluteFill style={{ overflow: "hidden", background: "#000" }}><Img src={staticFile(s.file)} style={st} /></AbsoluteFill>;
};

/** a vertical short (final/<id>.mp4) at full height over its own blurred picture; its sound plays from the media list */
const ShortV: React.FC<{ file: string; t0: number; blur?: string | null }> = ({ file, t0, blur }) => {
  if (!have(file)) return <Placeholder label={file} />;
  const src = staticFile(file), from = fr(t0);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <BlurBg file={file} blur={blur} trim={from} dim={0.38} />
      <div style={{ position: "absolute", left: (W - 608) / 2, top: 0, width: 608, height: H, boxShadow: "0 0 90px rgba(0,0,0,.8)" }}>
        <OffthreadVideo src={src} muted trimBefore={from} style={{ width: "100%", height: "100%" }} />
      </div>
    </AbsoluteFill>
  );
};

const Lower: React.FC<{ text: string; t: number }> = ({ text, t }) => (
  <div style={{ position: "absolute", left: 48, bottom: 206, fontFamily: BODY, fontWeight: 900, fontSize: 40, color: "white", background: "rgba(0,0,0,.62)",
    borderLeft: `8px solid ${KEY}`, borderRadius: 10, padding: "8px 22px", opacity: prog(t, 0.1, 0.25), transform: `translateX(${-30 * (1 - prog(t, 0.1, 0.3))}px)` }}>{text}</div>
);

/** one shot inside its Sequence; t = seconds since the shot's start (negative during its fade-in) plus its t0 */
const ShotView: React.FC<{ s: Shot; lead: number }> = ({ s, lead }) => {
  const f = useCurrentFrame();
  const local = f / FPS - lead, t = local + (s.t0 ?? 0), len = s.end - s.start;
  const o = lead > 0 ? clamp(f / FPS / lead) : 1;  // the crossfade: over the outgoing shot, which stays under it
  let body: React.ReactNode;
  switch (s.type) {
    case "footage": body = <Footage s={s} t={t} len={len} />; break;
    case "photo": body = <Photo s={s} t={t} len={len} />; break;
    case "scene": body = <Stage g={s.g} t={Math.max(0, t)} />; break;
    case "post": body = <PostStage g={s.g} t={Math.max(0, t)} />; break;
    case "short": body = <ShortV file={s.file} t0={s.t0 ?? 0} blur={s.blur} />; break;
    case "chapter": body = <ChapterCard t={Math.max(0, local)} dur={len} n={s.n} title={s.title} bg={s.bg} bgIsImg={s.bgIsImg} bgBlur={s.bgBlur} />; break;
    case "title": body = <TitleCard t={Math.max(0, local)} dur={len} kicker={s.kicker} title={s.title} sub={s.sub} bg={s.bg} bgIsImg={s.bgIsImg} bgBlur={s.bgBlur} />; break;
    case "outro": body = (
      <AbsoluteFill>
        <BlurBg file={s.bg?.file} isImg={s.bg?.type === "photo"} blur={s.bg?.blur} rate={s.bg?.type === "footage" ? s.bg.speed : 1} dim={0.55} />
        <OutroSpace t={Math.max(0, local)} label={s.label} boxes={s.boxes} />
      </AbsoluteFill>
    ); break;
    case "card": {
      const bt = Math.max(0, t);
      body = (
        <AbsoluteFill>
          {s.kind === "map" ? null : <BlurBg file={s.bg} isImg={s.bgIsImg} blur={s.bgBlur} dim={0.4} />}
          {s.kind === "fact" ? <FactCard t={bt} big={s.big ?? ""} label={s.label} sub={s.sub} revealAt={s.revealAt} />
            : s.kind === "text" ? <TextCard t={bt} text={s.text ?? ""} />
            : s.kind === "rank" ? <RankCard t={bt} n={s.n ?? 1} total={s.total} title={s.title} label={s.label} />
            : <MapCard t={bt} dur={len} center={s.center ?? [127.8, 36.3]} span={s.span ?? 40} label={s.label} dots={s.dots} arrows={s.arrows} />}
        </AbsoluteFill>
      );
      break;
    }
  }
  return (
    <AbsoluteFill style={{ opacity: o }}>
      {body}
      {s.lower ? <Lower text={s.lower} t={Math.max(0, local)} /> : null}
    </AbsoluteFill>
  );
};

const PICTURE = new Set(["footage", "photo", "short"]);

export const Long: React.FC<{ d: LongData }> = ({ d }) => {
  const f = useCurrentFrame(), t = f / FPS, total = Math.ceil(d.end * FPS);
  const cur = [...d.shots].reverse().find((s) => t >= s.start && t < s.end) ?? d.shots[d.shots.length - 1];
  const ch = d.chapters.find((c) => t >= c.body && t < c.end);
  // the picture's own credit; drawn scenes and plain cards carry none (prep sets "" for them)
  const credit = cur && !["chapter", "title", "outro"].includes(cur.type) ? (cur.credit ?? d.credit) : "";
  const envAt = (absF: number) => (d.env[Math.floor(absF / 3)] ?? 0) / 60;
  const duck = (e: number) => (e <= 1 ? 1 - d.musicDuck * e : (1 - d.musicDuck) * clamp(1 - (e - 1) / 0.5));
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {d.shots.map((s, i) => {
        const a = Math.max(0, fr(s.start - s.fade)), lead = (fr(s.start) - a) / FPS;
        // the last shot runs to the composition's last frame, so the video never ends on black
        const b = fr(s.end) >= total - 1 ? total : fr(s.end);
        return b > a ? <Sequence key={i} from={a} durationInFrames={b - a}><ShotView s={s} lead={lead} /></Sequence> : null;
      })}
      {cur && PICTURE.has(cur.type) && d.captions ? (
        <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(0,0,0,.35) 0%, rgba(0,0,0,0) 14%, rgba(0,0,0,0) 72%, rgba(0,0,0,.45) 100%)" }} />
      ) : null}
      {ch ? (
        <div style={{ position: "absolute", left: 40, top: 34, fontFamily: BODY, fontWeight: 800, fontSize: 28, color: "white", background: "rgba(0,0,0,.5)",
          borderLeft: `6px solid ${KEY}`, borderRadius: 8, padding: "5px 16px", opacity: prog(t, ch.body, 0.4) }}>{String(ch.n).padStart(2, "0")} · {ch.title}</div>
      ) : null}
      {credit || d.watermark ? (
        <div style={{ position: "absolute", right: 40, top: 34, textAlign: "right", fontFamily: BODY }}>
          {credit ? <div style={{ fontWeight: 700, fontSize: 24, color: "rgba(255,255,255,.85)", background: "rgba(0,0,0,.4)", borderRadius: 10, padding: "5px 14px" }}>{credit}</div> : null}
          {d.watermark ? <div style={{ fontWeight: 800, fontSize: 24, color: "rgba(255,255,255,.5)", marginTop: 6 }}>{d.watermark}</div> : null}
        </div>
      ) : null}
      {d.captions ? <LongCaptions pages={d.pages} size={d.captionSize} /> : null}

      {d.voice.map((v, i) => (
        <Sequence key={`v${i}`} from={fr(v.start)} durationInFrames={Math.max(1, fr(v.dur) + 2)} layout="none"><Audio src={staticFile(v.file)} /></Sequence>
      ))}
      {d.media.map((m, i) => (
        <Sequence key={`m${i}`} from={fr(m.start)} durationInFrames={Math.max(1, fr(m.dur))} layout="none">
          <Audio src={staticFile(m.file)} trimBefore={fr(m.from)} volume={(lf) => m.gain * prog(lf / FPS, 0, 0.15) * (1 - prog(lf / FPS, m.dur - 0.2, 0.2))} />
        </Sequence>
      ))}
      {d.music.map((m, i) => {
        const a = Math.max(0, fr(m.start - m.xfade / 2)), b = Math.min(total, fr(m.end + m.xfade / 2));
        const first = m.start <= 0.01, last = m.end >= d.end - 0.01;
        return b > a && have(m.file) ? (
          <Sequence key={`b${i}`} from={a} durationInFrames={b - a} layout="none">
            <Audio src={staticFile(m.file)} loop trimBefore={fr(m.from)} volume={(lf) => {
              const s = lf / FPS, len = (b - a) / FPS;
              const fin = first ? prog(s, 0, 0.4) : prog(s, 0, m.xfade), fout = last ? 1 - prog(s, len - 3, 3) : 1 - prog(s, len - m.xfade, m.xfade);
              return m.gain * fin * fout * duck(envAt(a + lf));
            }} />
          </Sequence>
        ) : null;
      })}
      {d.amb.map((m, i) => {
        const a = fr(m.start), b = Math.min(total, fr(m.end));
        return b > a && have(m.file) ? (
          <Sequence key={`a${i}`} from={a} durationInFrames={b - a} layout="none">
            <Audio src={staticFile(m.file)} loop volume={(lf) => m.gain * prog(lf / FPS, 0, 1) * (1 - prog(lf / FPS, (b - a) / FPS - 1, 1))} />
          </Sequence>
        ) : null;
      })}
    </AbsoluteFill>
  );
};

/** every prepared long-form and its thumbnail; Root.tsx renders this once */
export const LongCompositions: React.FC = () => (
  <>
    {LONGDATA.map((d) => (
      <React.Fragment key={d.id}>
        <Composition id={d.id} component={Long} defaultProps={{ d }} width={W} height={H} fps={FPS} durationInFrames={Math.max(1, Math.ceil(d.end * FPS))} />
        {d.thumb ? <Still id={`${d.id}-thumb`} component={LongThumb} defaultProps={{ d }} width={1280} height={720} /> : null}
      </React.Fragment>
    ))}
  </>
);
