#!/usr/bin/env python3
"""④ 완성본 자체 검수.

    python3 review.py --work work_edit [--fix --plan plan.json --transcript transcript.json]

검사 항목
    자막 오타   : 결과 음성을 다시 받아써서 자막과 글자 단위로 비교 (어긋나면 표시)
    소리 끊김   : 자막이 떠 있는데 소리가 비는 곳, 낱말 한가운데를 자른 점프 컷, 소리 깨짐(클리핑)
    화면 멈춤   : 자료화면이 아닌데 화면이 멈춘 곳 (freezedetect), 검은 화면
    개인정보    : 1초마다 화면 글자 인식 → 전화번호·이메일·주민번호·카드·계좌번호
    눈으로 확인 : 일정 간격 장면 모음(review_sheet_N.png) — Claude 가 직접 열어 본다
--fix 를 주면 찾은 개인정보 위치를 plan.json 의 blur 에 넣고 다시 렌더링한 뒤 다시 검수한다.
"""
from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import (fmt_time, load_json, load_rules, make_recognizer, read_audio, run_ff, save_json,  # noqa: E402
                    speech_segments, ffmpeg)

PII = [
    ("휴대전화", re.compile(r"01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}")),
    ("전화번호", re.compile(r"0\d{1,2}[-.)\s]\d{3,4}[-.\s]\d{4}")),
    ("이메일", re.compile(r"[\w.+-]+@[\w-]+\.[A-Za-z]{2,}")),
    ("주민등록번호", re.compile(r"\d{6}[-\s]?[1-4]\d{6}")),
    ("카드번호", re.compile(r"\d{4}[-\s]\d{4}[-\s]\d{4}[-\s]\d{4}")),
    ("계좌번호", re.compile(r"\d{3,6}-\d{2,6}-\d{2,8}")),
]


def cer(ref: str, hyp: str) -> float:
    a, b = re.sub(r"[\s.,?!]", "", ref), re.sub(r"[\s.,?!]", "", hyp)
    if not a:
        return 0.0
    d = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        p, d[0] = d[0], i
        for j, cb in enumerate(b, 1):
            p, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, p + (ca != cb))
    return d[-1] / len(a)


def check_subtitles(work: str, rep: dict, rules: dict) -> list[dict]:
    audio = read_audio(os.path.join(work, "speech.wav"), 16000)
    rec = make_recognizer()
    toks = []  # (시각, 글자)
    for s, e in speech_segments(audio, 16000):
        a = max(0.0, s - 0.1)
        st = rec.create_stream()
        st.accept_waveform(16000, audio[int(a * 16000):int((e + 0.1) * 16000)])
        rec.decode_stream(st)
        toks += [(a + t, tok) for tok, t in zip(st.result.tokens, st.result.timestamps)]
    out = []
    for ln in rep["subtitles"]:
        heard = "".join(tok for t, tok in toks if ln["start"] - 0.15 <= t < ln["end"] - 0.05).strip()
        c = cer(ln["text"], heard)
        if c > rules["review"]["typo_cer"]:
            out.append({"at": round(ln["start"], 2), "subtitle": ln["text"], "heard": heard, "cer": round(c, 2)})
    return out


def check_audio(work: str, rep: dict, rules: dict, video: str) -> list[dict]:
    issues = []
    sp = read_audio(os.path.join(work, "speech.wav"), 16000)
    fr = 160  # 10ms
    k = len(sp) // fr
    rms = np.sqrt((sp[:k * fr].reshape(k, fr) ** 2).mean(axis=1) + 1e-12)
    thr = max(np.percentile(rms, 30) * 2, 10 ** (-48 / 20))
    for ln in rep["subtitles"]:
        a, b = int(ln["start"] / 0.01) + 8, int(ln["end"] / 0.01) - 8
        seg = rms[a:b] < thr
        run = best = 0
        for q in seg:
            run = run + 1 if q else 0
            best = max(best, run)
        if best * 0.01 >= rules["review"]["dropout_sec"]:
            issues.append({"kind": "소리 빔", "at": round(ln["start"], 2), "detail": f"자막 '{ln['text']}' 중 {best * 0.01:.1f}초 무음"})
    for j in rep["joins"]:  # 점프 컷 양쪽 모두 소리가 크면 낱말 중간을 잘랐을 가능성
        i = int(j / 0.01)
        before, after = rms[max(0, i - 3):i].mean() if i > 3 else 0, rms[i:i + 3].mean() if i + 3 < k else 0
        if before > thr * 4 and after > thr * 4:
            issues.append({"kind": "말 중간 컷 의심", "at": round(j, 2), "detail": "컷 직전·직후 모두 말소리가 큼"})
    full = read_audio(video, 48000, channels=2)
    clip = int((np.abs(full) > 0.995).sum())
    if clip > 50:
        issues.append({"kind": "소리 깨짐", "at": 0, "detail": f"클리핑 샘플 {clip}개"})
    return issues


def check_video(video: str, rep: dict, rules: dict) -> list[dict]:
    p = subprocess.run([ffmpeg(), "-hide_banner", "-nostdin", "-i", video, "-vf",
                        f"freezedetect=n=-55dB:d={rules['review']['freeze_sec']},blackdetect=d=0.4:pix_th=0.06",
                        "-an", "-f", "null", "-"], capture_output=True, text=True)
    issues = []
    for m in re.finditer(r"freeze_start: ([\d.]+).*?freeze_end: ([\d.]+)", p.stderr, re.S):
        s, e = float(m.group(1)), float(m.group(2))
        if any(b["start"] - 0.3 <= s and e <= b["end"] + 0.3 for b in rep["broll"]):
            continue
        issues.append({"kind": "화면 멈춤", "at": round(s, 2), "detail": f"{e - s:.1f}초 동안 화면 변화 없음 (원본이 고정 촬영이면 정상일 수 있음)"})
    for m in re.finditer(r"black_start:([\d.]+) black_end:([\d.]+)", p.stderr):
        s, e = float(m.group(1)), float(m.group(2))
        if e < rep["output_duration"] - rules["outro"]["fade"] - 0.2:
            issues.append({"kind": "검은 화면", "at": round(s, 2), "detail": f"{e - s:.1f}초"})
    return issues


def grab_frames(video: str, every: float, width: int | None, folder: str) -> list[tuple[float, str]]:
    os.makedirs(folder, exist_ok=True)
    for f in os.listdir(folder):
        os.remove(os.path.join(folder, f))
    vf = f"fps=1/{every}" + (f",scale={width}:-2" if width else "")
    run_ff(["-i", video, "-vf", vf, "-q:v", "3", os.path.join(folder, "%05d.jpg")])
    files = sorted(os.listdir(folder))
    return [((i + 0.5) * every, os.path.join(folder, f)) for i, f in enumerate(files)]


def check_pii(video: str, work: str, rep: dict) -> tuple[list[dict], list[str]]:
    try:
        from rapidocr_onnxruntime import RapidOCR
    except ImportError:
        return [], ["(글자 인식 도구 없음: setup.sh 실행 필요)"]
    ocr = RapidOCR()
    hits, seen = [], []
    for t, path in grab_frames(video, 1.0, None, os.path.join(work, "ocr_frames")):
        res, _ = ocr(path)
        for box, text, score in res or []:
            if score < 0.5:
                continue
            seen.append(text)
            norm = text.replace(" ", "").replace("O", "0").replace("o", "0")
            for kind, rx in PII:
                if rx.search(text) or rx.search(norm):
                    xs, ys = [p[0] for p in box], [p[1] for p in box]
                    hits.append({"t": t, "kind": kind, "text": text,
                                 "box": [min(xs) - 10, min(ys) - 8, max(xs) - min(xs) + 20, max(ys) - min(ys) + 16]})
                    break
    groups = []  # 같은 자리에 이어서 보이면 한 구간으로
    for h in sorted(hits, key=lambda x: x["t"]):
        g = next((g for g in groups if g["kind"] == h["kind"] and h["t"] - g["last"] <= 1.6 and _overlap(g["box"], h["box"])), None)
        if g:
            g["last"] = h["t"]
            x0, y0 = min(g["box"][0], h["box"][0]), min(g["box"][1], h["box"][1])
            x1 = max(g["box"][0] + g["box"][2], h["box"][0] + h["box"][2])
            y1 = max(g["box"][1] + g["box"][3], h["box"][1] + h["box"][3])
            g["box"] = [x0, y0, x1 - x0, y1 - y0]
        else:
            groups.append({"kind": h["kind"], "first": h["t"], "last": h["t"], "box": h["box"], "text": mask(h["text"])})
    out = [{"kind": g["kind"], "text": g["text"], "start": round(max(0, g["first"] - 1.0), 2),
            "end": round(min(rep["output_duration"], g["last"] + 1.0), 2), "box": [round(v) for v in g["box"]]} for g in groups]
    return out, sorted(set(seen))


def _overlap(a, b) -> bool:
    return not (a[0] + a[2] < b[0] or b[0] + b[2] < a[0] or a[1] + a[3] < b[1] or b[1] + b[3] < a[1])


def mask(s: str) -> str:
    """보고서에도 번호를 그대로 남기지 않는다: 앞 숫자 3개만 보이고 나머지는 *."""
    n = 0

    def sub(m):
        nonlocal n
        n += 1
        return m.group(0) if n <= 3 else "*"
    s = re.sub(r"\d", sub, s)
    return re.sub(r"(?<=^.)[^@]*(?=@)", "***", s)


def contact_sheets(video: str, work: str, rules: dict, dur: float) -> list[str]:
    from PIL import Image, ImageDraw, ImageFont
    from common import font_path
    every = max(rules["review"]["sheet_every"], dur / 60)
    frames = grab_frames(video, every, 480, os.path.join(work, "sheet_frames"))
    sheets, per = [], 20
    f = ImageFont.truetype(font_path("Bold"), 22)
    for n in range(0, len(frames), per):
        chunk = frames[n:n + per]
        ims = [Image.open(p) for _, p in chunk]
        w, h = ims[0].size
        cols = 4
        rows = (len(ims) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * w, rows * h), "black")
        d = ImageDraw.Draw(sheet)
        for i, ((t, _), im) in enumerate(zip(chunk, ims)):
            x, y = (i % cols) * w, (i // cols) * h
            sheet.paste(im, (x, y))
            d.text((x + 8, y + 6), fmt_time(t), font=f, fill=(255, 60, 60), stroke_width=2, stroke_fill="black")
        path = os.path.join(work, f"review_sheet_{n // per + 1}.png")
        sheet.save(path)
        sheets.append(path)
    return sheets


def review(work: str, rules: dict) -> dict:
    rep = load_json(os.path.join(work, "edit_report.json"))
    video = rep["output"]
    typos = check_subtitles(work, rep, rules)
    audio = check_audio(work, rep, rules, video)
    vid = check_video(video, rep, rules)
    pii, seen = check_pii(video, work, rep)
    sheets = contact_sheets(video, work, rules, rep["output_duration"])
    res = {"video": video, "duration": rep["output_duration"], "subtitle_mismatch": typos, "audio": audio, "video_issues": vid,
           "pii": pii, "screen_text": seen[:200], "sheets": sheets, "subtitles": rep["subtitles"]}
    save_json(os.path.join(work, "review.json"), res)
    lines = [f"# 자체 검수 — {os.path.basename(video)} ({rep['output_duration']:.1f}초)", ""]
    lines.append(f"## 자막 대조 (다시 받아쓴 소리와 다른 줄 {len(typos)}개)")
    lines += [f"- {fmt_time(x['at'])} 자막 「{x['subtitle']}」 ↔ 들린 소리 「{x['heard']}」" for x in typos] or ["- 없음"]
    lines.append(f"\n## 소리 ({len(audio)}건)")
    lines += [f"- {fmt_time(x['at'])} {x['kind']}: {x['detail']}" for x in audio] or ["- 없음"]
    lines.append(f"\n## 화면 ({len(vid)}건)")
    lines += [f"- {fmt_time(x['at'])} {x['kind']}: {x['detail']}" for x in vid] or ["- 없음"]
    lines.append(f"\n## 개인정보 ({len(pii)}건)")
    lines += [f"- {fmt_time(x['start'])}~{fmt_time(x['end'])} {x['kind']} {x['text']} 위치 {x['box']}" for x in pii] or ["- 글자 인식으로는 없음"]
    lines.append("\n## 눈으로 확인할 장면 모음\n" + "\n".join(f"- {s}" for s in sheets))
    with open(os.path.join(work, "review.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    return res


def add_blur(plan: dict, pii: list[dict]) -> int:
    blur = plan.setdefault("blur", [])
    added = 0
    for p in pii:
        if any(abs(b["start"] - p["start"]) < 0.6 and _overlap(b["box"], p["box"]) for b in blur):
            continue
        blur.append({"start": p["start"], "end": p["end"], "box": p["box"], "why": p["kind"]})
        added += 1
    return added


def grab_grid(video: str, t: float, out: str) -> str:
    """t 초 화면을 원래 크기로 뽑고 100px 격자·좌표를 그린다 — blur 상자 좌표를 눈으로 정할 때."""
    from PIL import Image, ImageDraw
    run_ff(["-ss", f"{t:.3f}", "-i", video, "-frames:v", "1", out])
    im = Image.open(out).convert("RGB")
    d = ImageDraw.Draw(im)
    W, H = im.size
    for x in range(0, W, 100):
        d.line((x, 0, x, H), fill=(255, 0, 0) if x % 500 == 0 else (255, 120, 120), width=1)
        d.text((x + 3, 3), str(x), fill=(255, 255, 0))
    for y in range(0, H, 100):
        d.line((0, y, W, y), fill=(255, 0, 0) if y % 500 == 0 else (255, 120, 120), width=1)
        d.text((3, y + 3), str(y), fill=(255, 255, 0))
    im.save(out)
    return out


def main(argv=None):
    if argv is None and len(sys.argv) > 1 and sys.argv[1] == "grab":
        # python3 review.py grab 결과.mp4 5.0 frame.png
        print(grab_grid(sys.argv[2], float(sys.argv[3]), sys.argv[4]))
        return
    p = argparse.ArgumentParser(description="완성본 자체 검수  (좌표 격자 화면: review.py grab 영상 초 out.png)")
    p.add_argument("--work", required=True, help="edit.py 의 작업 폴더 (edit_report.json 이 있는 곳)")
    p.add_argument("--rules")
    p.add_argument("--fix", action="store_true", help="개인정보를 흐리게 처리하고 다시 렌더링")
    p.add_argument("--plan")
    p.add_argument("--transcript")
    a = p.parse_args(argv)
    rules = load_rules(a.rules)
    res = review(a.work, rules)
    for _ in range(2):
        if not (a.fix and res["pii"] and rules["review"]["auto_blur_pii"]):
            break
        if not (a.plan and a.transcript):
            sys.exit("--fix 에는 --plan 과 --transcript 가 필요합니다")
        plan = load_json(a.plan)
        n = add_blur(plan, res["pii"])
        if not n:
            break
        save_json(a.plan, plan)
        print(f"개인정보 {n}곳 흐림 처리 후 다시 렌더링…")
        import edit
        rep = load_json(os.path.join(a.work, "edit_report.json"))
        edit.edit(rep["video"], load_json(a.transcript), plan, rules, rep["output"], a.work)
        res = review(a.work, rules)
    print(open(os.path.join(a.work, "review.md"), encoding="utf-8").read())


if __name__ == "__main__":
    main()
