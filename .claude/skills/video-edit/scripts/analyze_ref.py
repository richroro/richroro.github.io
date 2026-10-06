#!/usr/bin/env python3
"""1. 레퍼런스 영상의 편집 스타일을 숫자와 장면 모음으로 분해한다 → Claude 가 보고 '편집 규칙집'을 쓴다.

    python3 analyze_ref.py ref1.mp4 ref2.mp4 --out refs/

영상마다 refs/<이름>/ 에:
    analysis.json   컷 간격·말 속도·쉼 길이·배경음 크기·효과음 추정 시점·화면 글자 위치/크기/색
    sheet_*.png     2초 간격 장면 모음 (자막 글꼴·색·위치, 자료화면 방식 확인용)
    cuts.png        컷 직전/직후 짝 (점프 컷 줌 여부 확인용)
    intro.png / outro.png   처음·마지막 10초를 0.5초 간격으로
그리고 refs/summary.md 에 여러 영상의 평균을 모은다.
"""
from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import ffmpeg, fmt_time, font_path, probe, read_audio, run_ff, save_json  # noqa: E402


def cuts(path: str, thr: float = 0.04) -> list[float]:
    """장면 변화 점수가 thr 이상인 순간. 점프 컷(같은 배경)은 점수가 낮아서 문턱을 낮게 둔다."""
    p = subprocess.run([ffmpeg(), "-hide_banner", "-nostdin", "-i", path, "-an", "-vf",
                        f"scale=320:-2,select='gt(scene,{thr})',showinfo", "-f", "null", "-"], capture_output=True, text=True)
    out = []
    for t in (float(x) for x in re.findall(r"pts_time:([\d.]+)", p.stderr)):
        if not out or t - out[-1] > 0.35:  # 페이드 전환은 여러 프레임에 걸쳐 잡히므로 하나로
            out.append(t)
    return out


def speech_stats(path: str) -> tuple[dict, list[dict]]:
    """낱말 시각으로 말 속도·쉼 길이·배경음 크기를 잰다 (배경음이 있어도 낱말 경계는 잘 잡힌다)."""
    from transcribe import transcribe
    from common import load_rules
    tr = transcribe(path, load_rules())
    words = tr["words"]
    if not words:
        return {}, []
    a = read_audio(path, 16000)
    talk = sum(w["end"] - w["start"] for w in words)
    syll = sum(len(re.findall(r"[가-힣]", w["text"])) for w in words)
    gaps = [b["start"] - a_["end"] for a_, b in zip(words, words[1:]) if b["start"] - a_["end"] > 0.08]
    g = np.array(gaps) if gaps else np.array([0.0])

    def rms_db(spans):
        v = [a[int(s * 16000):int(e * 16000)] for s, e in spans if e - s > 0.05]
        v = np.concatenate(v) if v else np.zeros(1)
        return 20 * np.log10(np.sqrt((v ** 2).mean()) + 1e-9)
    sp = rms_db([(w["start"], w["end"]) for w in words])
    holes = [(a_["end"] + 0.06, b["start"] - 0.06) for a_, b in zip(words, words[1:]) if b["start"] - a_["end"] > 0.3]
    bg = rms_db(holes) if holes else None
    return ({"words": len(words), "speech_ratio": round(talk / tr["duration"], 3),
             "syllables_per_sec": round(syll / max(talk, 1e-6), 2),
             "pause_p50": round(float(np.percentile(g, 50)), 3), "pause_p90": round(float(np.percentile(g, 90)), 3),
             "speech_db": round(float(sp), 1), "between_words_db": round(float(bg), 1) if bg is not None else None,
             "bgm_relative_db": round(float(bg - sp), 1) if bg is not None else None}, words)


def sfx_candidates(path: str, words: list[dict]) -> list[float]:
    """낱말 사이 빈틈에서 고음역 에너지가 갑자기 솟는 순간 (효과음 후보, 대략적).
    말소리 자음과 구분이 어려워 낱말 안쪽은 빼고 센다. 장면 모음(sfx.png)과 같이 보고 판단한다."""
    a = read_audio(path, 48000)
    n = 1024
    k = len(a) // n
    if k < 4:
        return []
    frames = a[:k * n].reshape(k, n) * np.hanning(n)
    spec = np.abs(np.fft.rfft(frames, axis=1))[:, int(4000 / 48000 * n):]
    flux = np.maximum(np.diff(np.log1p(spec * 50), axis=0), 0).sum(axis=1)
    med = np.median(flux)
    thr = med + 10 * (np.median(np.abs(flux - med)) + 1e-9)
    out, last = [], -1.0
    for i in np.where(flux > thr)[0]:
        t = (i + 1) * n / 48000
        inside = any(w["start"] - 0.03 <= t <= w["end"] + 0.03 for w in words)
        if t - last > 0.5 and not inside:
            out.append(round(float(t), 2))
        last = t
    return out


def text_boxes(path: str, dur: float, H: int, W: int) -> dict:
    """화면 글자(자막) 위치·크기·색. 글자 인식 모델은 한글을 못 읽어도 글자 '상자'는 찾는다."""
    try:
        from rapidocr_onnxruntime import RapidOCR
    except ImportError:
        return {}
    from PIL import Image
    ocr = RapidOCR()
    tmp = os.path.join(os.path.dirname(path) or ".", ".ref_ocr")
    os.makedirs(tmp, exist_ok=True)
    every = max(1.0, dur / 120)
    run_ff(["-i", path, "-vf", f"fps=1/{every}", "-q:v", "3", os.path.join(tmp, "%05d.jpg")])
    regions = {"top": [], "middle": [], "bottom": []}
    colors, frames_with_bottom, total = [], 0, 0
    for f in sorted(os.listdir(tmp)):
        p = os.path.join(tmp, f)
        res, _ = ocr(p, use_cls=False, use_rec=False)  # 글자 상자만
        total += 1
        im = np.asarray(Image.open(p).convert("RGB"))
        hb = False
        for box in (res or []):
            pts = np.array(box[0] if isinstance(box[0], (list, tuple)) and len(box[0]) == 4 else box)
            pts = pts.reshape(-1, 2)
            x0, y0 = pts.min(axis=0)
            x1, y1 = pts.max(axis=0)
            h = (y1 - y0) / H
            if h < 0.015:
                continue
            cy = (y0 + y1) / 2 / H
            reg = "top" if cy < 0.33 else "bottom" if cy > 0.66 else "middle"
            regions[reg].append({"h": h, "cy": cy, "cx": (x0 + x1) / 2 / W, "w": (x1 - x0) / W})
            if reg == "bottom":
                hb = True
            crop = im[int(y0):int(y1), int(x0):int(x1)].reshape(-1, 3)
            if len(crop) > 50:
                lum = crop.mean(axis=1)
                top = crop[lum >= np.percentile(lum, 85)]
                colors.append("#%02X%02X%02X" % tuple(int(v) for v in np.median(top, axis=0)))
        frames_with_bottom += hb
    for f in os.listdir(tmp):
        os.remove(os.path.join(tmp, f))
    os.rmdir(tmp)

    def summ(v):
        if not v:
            return None
        return {"count": len(v), "height_ratio": round(float(np.median([x["h"] for x in v])), 4),
                "center_y": round(float(np.median([x["cy"] for x in v])), 3),
                "center_x": round(float(np.median([x["cx"] for x in v])), 3),
                "width_ratio": round(float(np.median([x["w"] for x in v])), 3)}
    from collections import Counter
    return {"regions": {k: summ(v) for k, v in regions.items()},
            "bottom_text_coverage": round(frames_with_bottom / max(total, 1), 3),
            "common_text_colors": [c for c, _ in Counter(colors).most_common(5)]}


def sheet(path: str, times: list[float], out: str, width: int = 384, cols: int = 5, labels=None) -> str | None:
    from PIL import Image, ImageDraw, ImageFont
    if not times:
        return None
    tmp = out + ".d"
    os.makedirs(tmp, exist_ok=True)
    ims = []
    for i, t in enumerate(times):
        f = os.path.join(tmp, f"{i:04d}.jpg")
        run_ff(["-ss", f"{max(t, 0):.3f}", "-i", path, "-frames:v", "1", "-vf", f"scale={width}:-2", "-q:v", "4", f])
        if os.path.exists(f):
            ims.append((labels[i] if labels else fmt_time(t), Image.open(f)))
    if not ims:
        return None
    w, h = ims[0][1].size
    rows = (len(ims) + cols - 1) // cols
    S = Image.new("RGB", (cols * w, rows * h), "black")
    d = ImageDraw.Draw(S)
    fnt = ImageFont.truetype(font_path("Bold"), 18)
    for i, (lab, im) in enumerate(ims):
        x, y = (i % cols) * w, (i // cols) * h
        S.paste(im.resize((w, h)), (x, y))
        d.text((x + 6, y + 4), lab, font=fnt, fill=(255, 60, 60), stroke_width=2, stroke_fill="black")
    S.save(out)
    for f in os.listdir(tmp):
        os.remove(os.path.join(tmp, f))
    os.rmdir(tmp)
    return out


def analyze(path: str, out: str) -> dict:
    os.makedirs(out, exist_ok=True)
    info = probe(path)
    dur = info["duration"]
    c = cuts(path)
    shots = np.diff([0.0] + c + [dur])
    res = {"file": os.path.basename(path), "duration": round(dur, 2), "size": [info["width"], info["height"]],
           "fps": info["fps"], "cuts": len(c), "cuts_per_min": round(len(c) / max(dur / 60, 1e-6), 1),
           "shot_median": round(float(np.median(shots)), 2), "shot_p10": round(float(np.percentile(shots, 10)), 2),
           "shot_p90": round(float(np.percentile(shots, 90)), 2), "cut_times": [round(x, 2) for x in c]}
    if info["has_audio"]:
        res["speech"], words = speech_stats(path)
        res["sfx_candidates"] = sfx_candidates(path, words)
    res["screen_text"] = text_boxes(path, dur, info["height"], info["width"])
    every = max(2.0, dur / 60)
    sheets = []
    ts = list(np.arange(every / 2, dur, every))
    for n in range(0, len(ts), 25):
        s = sheet(path, ts[n:n + 25], os.path.join(out, f"sheet_{n // 25 + 1}.png"))
        if s:
            sheets.append(s)
    pairs, labels = [], []
    for t in c[:20]:
        pairs += [t - 0.15, t + 0.15]
        labels += [f"{fmt_time(t)} 전", f"{fmt_time(t)} 후"]
    res["images"] = {"sheets": sheets,
                     "cuts": sheet(path, pairs, os.path.join(out, "cuts.png"), cols=4, labels=labels),
                     "intro": sheet(path, list(np.arange(0.25, min(10, dur), 0.5)), os.path.join(out, "intro.png")),
                     "outro": sheet(path, list(np.arange(max(0, dur - 10) + 0.25, dur, 0.5)), os.path.join(out, "outro.png")),
                     "sfx": sheet(path, res.get("sfx_candidates", [])[:20], os.path.join(out, "sfx.png"))}
    save_json(os.path.join(out, "analysis.json"), res)
    return res


def main(argv=None):
    p = argparse.ArgumentParser(description="레퍼런스 영상 편집 스타일 분석")
    p.add_argument("videos", nargs="+")
    p.add_argument("--out", default="refs")
    a = p.parse_args(argv)
    results = []
    for v in a.videos:
        name = re.sub(r"[^\w가-힣-]+", "_", os.path.splitext(os.path.basename(v))[0])[:40]
        print(f"분석 중: {v}")
        results.append(analyze(v, os.path.join(a.out, name)))
    keys = [("cuts_per_min", "분당 컷 수"), ("shot_median", "컷 길이 중앙값(초)")]
    lines = ["# 레퍼런스 분석 요약", ""]
    for r in results:
        sp = r.get("speech", {})
        st = r.get("screen_text", {}).get("regions", {}) or {}
        b = st.get("bottom") or {}
        lines.append(f"## {r['file']} ({r['duration']}초, {r['size'][0]}x{r['size'][1]})")
        lines += [f"- {lab}: {r[k]}" for k, lab in keys]
        if sp:
            lines.append(f"- 말 속도: 초당 {sp['syllables_per_sec']}음절 · 말하는 비율 {sp['speech_ratio']:.0%} · 낱말 사이 "
                         f"쉼 중앙값 {sp['pause_p50']}초 / 상위10% {sp['pause_p90']}초")
            lines.append(f"- 배경음: 말소리보다 {sp['bgm_relative_db']}dB (말 사이 구간 기준)")
            lines.append(f"- 효과음 후보(낱말 사이, 대략): {len(r.get('sfx_candidates', []))}곳 (분당 {len(r.get('sfx_candidates', [])) / max(r['duration'] / 60, 1e-6):.1f})")
        if b:
            lines.append(f"- 아래 자막: 화면의 {r['screen_text']['bottom_text_coverage']:.0%} 에 등장 · 글자 높이 {b['height_ratio']:.3f}H · "
                         f"세로 위치 {b['center_y']:.2f}H")
        if st.get("top"):
            lines.append(f"- 위쪽 글자(강조/제목): {st['top']['count']}회 · 높이 {st['top']['height_ratio']:.3f}H")
        lines.append(f"- 자주 보인 글자 색: {', '.join(r.get('screen_text', {}).get('common_text_colors', []))}")
        lines.append(f"- 장면 모음: {', '.join(x for x in [*r['images']['sheets'], r['images']['cuts'], r['images']['intro'], r['images']['outro'], r['images']['sfx']] if x)}")
        lines.append("")
    with open(os.path.join(a.out, "summary.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print("\n".join(lines))


if __name__ == "__main__":
    main()
