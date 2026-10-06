#!/usr/bin/env python3
"""③~⑥ 교정 대본대로 컷 편집 → 자막·강조 자막·효과음·배경음·자료화면 → mp4.

    python3 edit.py --video 원본.mp4 --transcript work/transcript.json --plan work/plan.json --out work/final.mp4

plan.json (교정 단계에서 Claude 가 쓴다):
{
  "delete":   [6, "7-8", 13],                     # 교정 대본에서 뺀 낱말 번호 (범위 "a-b" 가능)
  "fix":      {"2": "공모주 청약"},                 # 자막 표기만 고침 (소리는 그대로)
  "title":    "공모주 청약 3분 정리",               # 인트로 제목 (없으면 생략)
  "emphasis": [{"words": [16, 17], "text": "20영업일 제한!"}],   # 강조: 낱말 색 + 줌 + 효과음 (+ 큰 강조 자막)
  "broll":    [{"from": 27, "to": 34, "card": {...} | "image": "a.png" | "url": "https://...", "credit": "출처: ..."}],
  "blur":     [{"start": 6.0, "end": 11.0, "box": [x, y, w, h]}],   # 결과 영상 시각·픽셀 기준
  "bgm":      "음악.mp3"                            # 없으면 규칙집 설정(합성 배경음)
}
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import math
import os
import re
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import audio_fx  # noqa: E402
import broll  # noqa: E402
from common import (FONTS, load_json, load_rules, probe, read_audio, run_ff, save_json)  # noqa: E402

SR = audio_fx.SR


# ───────────────────────────── 계획 읽기 ─────────────────────────────

def parse_ids(items) -> set[int]:
    out = set()
    for x in items or []:
        if isinstance(x, int):
            out.add(x)
        else:
            m = re.fullmatch(r"\s*(\d+)\s*(?:-\s*(\d+))?\s*", str(x))
            if not m:
                raise ValueError(f"삭제 번호 형식 오류: {x}")
            a, b = int(m.group(1)), int(m.group(2) or m.group(1))
            out.update(range(a, b + 1))
    return out


def out_size(info: dict, rules: dict) -> tuple[int, int]:
    w, h = info["width"] or 1920, info["height"] or 1080
    s = min(1.0, rules["output"]["max_long_side"] / max(w, h))
    return int(w * s) // 2 * 2, int(h * s) // 2 * 2


# ───────────────────────────── 컷 계산 ─────────────────────────────

def plan_segments(tr: dict, plan: dict, rules: dict, fps: float) -> list[dict]:
    words = tr["words"]
    dur = tr["duration"]
    deleted = parse_ids(plan.get("delete"))
    c = rules["cut"]
    groups, cur = [], None
    for w in words:
        if w["id"] in deleted:
            continue
        if cur and w["id"] == cur[-1]["id"] + 1 and w["start"] - cur[-1]["end"] <= c["max_pause"]:
            cur.append(w)
        else:
            cur = [w]
            groups.append(cur)
    if not groups:
        raise SystemExit("남길 낱말이 없습니다 (delete 를 확인하세요)")
    by_id = {w["id"]: w for w in words}
    segs = []
    for gi, g in enumerate(groups):
        first, last = g[0], g[-1]
        prev_w, next_w = by_id.get(first["id"] - 1), by_id.get(last["id"] + 1)
        start = first["start"] - (c["head"] if gi == 0 else c["pad_before"])
        if prev_w:
            start = max(start, prev_w["end"] + 0.02)
        end = last["end"] + (c["tail"] if gi == len(groups) - 1 else c["pad_after"])
        if next_w:
            end = min(end, next_w["start"] - 0.02)
        start, end = max(0.0, start), min(dur, end)
        f0, f1 = math.floor(start * fps + 1e-6), math.ceil(end * fps - 1e-6)
        f1 = max(f1, f0 + 3)
        segs.append({"f0": f0, "f1": f1, "words": [w["id"] for w in g]})
    merged = []  # 프레임 단위로 붙어 있으면 한 덩어리 (점프 컷이 아님)
    for s in segs:
        if merged and s["f0"] <= merged[-1]["f1"] + 1:
            merged[-1]["f1"] = max(merged[-1]["f1"], s["f1"])
            merged[-1]["words"] += s["words"]
        else:
            merged.append(s)
    return merged


def _split(segs: list[dict], f: int, by_id: dict, fps: float, **mark) -> dict | None:
    """프레임 f 에서 덩어리를 둘로 나누고 뒤쪽 조각을 돌려준다 (이미 경계 근처면 그 조각)."""
    for i, s in enumerate(segs):
        if s["f0"] + 6 < f < s["f1"] - 6:
            a = {**s, "f1": f, "words": [x for x in s["words"] if by_id[x]["start"] * fps < f]}
            b = {"f0": f, "f1": s["f1"], "words": [x for x in s["words"] if x not in a["words"]], "cont": True, **mark}
            a.pop("emph_end", None)
            segs[i:i + 1] = [a, b]
            return b
        if s["f0"] - 2 <= f <= s["f0"] + 6:
            s.update(mark)
            return s
    return None


def split_for_emphasis(segs: list[dict], tr: dict, plan: dict, rules: dict, fps: float) -> None:
    """강조 낱말이 시작하는 프레임에서 줌을 넣고, 강조 시간이 지나면 원래 줌으로 돌아간다."""
    by_id = {w["id"]: w for w in tr["words"]}
    for e in plan.get("emphasis", []):
        f = round(by_id[e["words"][0]]["start"] * fps) - 1
        seg = _split(segs, f, by_id, fps, emph=True)
        if seg is None:
            continue
        end_t = max(rules["emphasis"]["duration"], by_id[e["words"][-1]]["end"] - by_id[e["words"][0]]["start"] + 0.3)
        f_end = f + round(end_t * fps)
        if f_end < seg["f1"] - round(0.5 * fps):  # 남은 부분이 충분히 길 때만 되돌린다
            _split(segs, f_end, by_id, fps, back=True)


def assign_zoom(segs: list[dict], rules: dict, fps: float) -> None:
    z = rules["zoom"]
    levels = z["levels"] if z["mode"] == "alternate" else [z["levels"][0]]
    k, prev, base = 0, None, levels[0]
    for s in segs:
        if s.get("emph") and rules["emphasis"].get("zoom", True):
            s["zoom"] = z["emphasis"]
        elif s.get("back") or (s.get("cont") and prev is not None):  # 강조가 끝나면 강조 전 줌으로
            s["zoom"] = base
        elif prev is None or (s["f1"] - s["f0"]) / fps >= z["min_segment_for_change"]:
            s["zoom"] = levels[k % len(levels)]
            k += 1
        else:
            s["zoom"] = prev
        if not s.get("emph"):
            base = s["zoom"]
        prev = s["zoom"]
    t = 0
    for s in segs:
        s["out_f0"] = t
        t += s["f1"] - s["f0"]


class Timeline:
    """원본 시각 → 결과 영상 시각."""

    def __init__(self, segs: list[dict], fps: float):
        self.segs, self.fps = segs, fps
        self.total = sum(s["f1"] - s["f0"] for s in segs) / fps

    def map(self, t: float) -> float | None:
        f = t * self.fps
        for s in self.segs:
            if s["f0"] - 0.5 <= f <= s["f1"] + 0.5:
                return (s["out_f0"] + min(max(f, s["f0"]), s["f1"]) - s["f0"]) / self.fps
        return None

    def joins(self) -> list[float]:
        return [s["out_f0"] / self.fps for s in self.segs[1:] if not s.get("cont")]


# ───────────────────────────── 영상 조각 ─────────────────────────────

def render_segments(video: str, segs: list[dict], W: int, H: int, fps: float, rules: dict, work: str, fast: bool) -> str:
    cx, cy = rules["zoom"]["center"]
    os.makedirs(os.path.join(work, "segs"), exist_ok=True)

    def one(i_s):
        i, s = i_s
        n = s["f1"] - s["f0"]
        z = s["zoom"]
        crop = (f"crop=w=trunc(iw/{z}/2)*2:h=trunc(ih/{z}/2)*2:"
                f"x=clip(iw*{cx}-iw/{z}/2\\,0\\,iw-iw/{z}):y=clip(ih*{cy}-ih/{z}/2\\,0\\,ih-ih/{z}),") if z > 1.001 else ""
        out = os.path.join(work, "segs", f"{i:04d}.mp4")
        run_ff(["-ss", f"{s['f0'] / fps:.6f}", "-i", video, "-an", "-sn",
                "-vf", f"{crop}scale={W}:{H}:flags=lanczos,setsar=1,fps={fps}",
                "-frames:v", str(n), "-c:v", "libx264", "-preset", "ultrafast" if fast else "veryfast", "-crf", "15",
                "-pix_fmt", "yuv420p", "-video_track_timescale", "90000", out])
        return out

    with cf.ThreadPoolExecutor(max_workers=min(4, os.cpu_count() or 2)) as ex:
        files = list(ex.map(one, enumerate(segs)))
    lst = os.path.join(work, "segs", "list.txt")
    with open(lst, "w") as f:
        f.writelines(f"file '{os.path.abspath(p)}'\n" for p in files)
    cat = os.path.join(work, "cut.mp4")
    run_ff(["-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", cat])
    return cat


# ───────────────────────────── 소리 ─────────────────────────────

def db(x: float) -> float:
    return 10 ** (x / 20)


def build_speech(video: str, info: dict, segs: list[dict], fps: float, rules: dict) -> np.ndarray:
    total = sum(round((s["f1"] - s["f0"]) / fps * SR) for s in segs)
    if not info["has_audio"]:
        return np.zeros(total, dtype=np.float32)
    src = read_audio(video, SR)
    fade = max(1, int(rules["cut"]["fade_ms"] / 1000 * SR))
    parts = []
    for i, s in enumerate(segs):
        a = round(s["f0"] / fps * SR)
        n = round((s["f1"] - s["f0"]) / fps * SR)
        x = src[a:a + n]
        x = np.pad(x, (0, n - len(x))) if len(x) < n else x.copy()
        if i > 0 and not s.get("cont"):
            x[:fade] *= np.linspace(0, 1, fade)
        if i + 1 < len(segs) and not segs[i + 1].get("cont"):
            x[-fade:] *= np.linspace(1, 0, fade)
        parts.append(x)
    y = np.concatenate(parts)
    # 말소리 크기 맞추기 (말하는 부분 RMS ≈ -20 dBFS)
    fr = int(0.02 * SR)
    k = len(y) // fr
    rms = np.sqrt((y[:k * fr].reshape(k, fr) ** 2).mean(axis=1) + 1e-12) if k else np.array([1e-6])
    voiced = rms[rms > db(-45)]
    if len(voiced):
        g = min(db(-20) / np.sqrt((voiced ** 2).mean()), db(20))
        y = y * g
    return y.astype(np.float32)


def activity(speech: np.ndarray) -> np.ndarray:
    """말하는 중이면 1, 아니면 0 인 부드러운 곡선 (배경음 덕킹용)."""
    fr = int(0.02 * SR)
    k = len(speech) // fr + 1
    pad = np.pad(speech, (0, k * fr - len(speech)))
    on = (np.sqrt((pad.reshape(k, fr) ** 2).mean(axis=1)) > db(-38)).astype(float)
    att, rel = 1 - math.exp(-0.02 / 0.06), 1 - math.exp(-0.02 / 0.45)
    env, v = np.empty(k), 0.0
    for i, o in enumerate(on):
        v += (att if o > v else rel) * (o - v)
        env[i] = v
    return np.repeat(env, fr)[:len(speech)]


def mix_audio(speech: np.ndarray, events: list[tuple[float, str]], plan: dict, rules: dict) -> np.ndarray:
    n = len(speech)
    out = np.repeat(speech[:, None], 2, axis=1)
    for t, name in events:
        fx = audio_fx.sfx(name) * db(rules["sfx"]["volume_db"]) / 0.9
        a = int(max(0, t) * SR)
        b = min(n, a + len(fx))
        if b > a:
            out[a:b] += fx[:b - a, None]
    b_cfg = rules["bgm"]
    bgm_file = plan.get("bgm", b_cfg.get("file"))
    if plan.get("bgm") is not False and b_cfg["enabled"]:
        if bgm_file:
            m = read_audio(bgm_file, SR, channels=2)
            reps = int(np.ceil(n / max(len(m), 1)))
            m = np.tile(m, (reps, 1))[:n]
        else:
            m = audio_fx.bgm(n / SR)
        rms = np.sqrt((m ** 2).mean()) + 1e-9
        m = m / rms * db(-20 + b_cfg["volume_db"])
        duck = 1 - activity(speech) * (1 - db(b_cfg["duck_db"]))
        t = np.arange(n) / SR
        fade = np.minimum(1, t / max(b_cfg["fade_in"], 0.01)) * np.minimum(1, (n / SR - t) / max(b_cfg["fade_out"], 0.01))
        out += m * (duck * np.clip(fade, 0, 1))[:, None]
    of = rules["outro"]["fade"]
    if of > 0:
        k = int(of * SR)
        out[-k:] *= np.linspace(1, 0, k)[:, None]
    peak = np.abs(out).max()
    if peak > 0.98:  # 부드러운 한계
        out = np.tanh(out / peak * 1.2) / math.tanh(1.2) * 0.98
    return out.astype(np.float32)


def write_wav(path: str, y: np.ndarray) -> None:
    import soundfile as sf
    sf.write(path, y, SR, subtype="PCM_16")


# ───────────────────────────── 자막 ─────────────────────────────

def ass_color(hex_: str, alpha: int = 0) -> str:
    h = hex_.lstrip("#")
    return f"&H{alpha:02X}{h[4:6]}{h[2:4]}{h[0:2]}".upper()


def ass_time(t: float) -> str:
    t = max(0.0, t)
    cs = int(round(t * 100))
    return f"{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}"


def clean_sub(text: str) -> str:
    return re.sub(r"[.,]+$", "", text.strip())  # 자막에는 마침표·쉼표를 찍지 않는다


def _len(items) -> int:
    return sum(len(x["text"].replace(" ", "")) for x in items)


def balance(items: list[dict], maxc: int) -> list[list[dict]]:
    """낱말 경계에서 k 줄로 나눠 가장 긴 줄이 가장 짧아지게. 한 글자 낱말이 줄 끝에 홀로 남는 걸 피한다."""
    if _len(items) <= maxc or len(items) == 1:
        return [items]
    k = math.ceil(_len(items) / maxc)
    n = len(items)
    best = None

    def cost(lines):
        worst = max(_len(l) for l in lines)
        over = sum(max(0, _len(l) - maxc) for l in lines) * 100
        dangling = sum(5 for l in lines[:-1] if len(l[-1]["text"].strip(".,")) == 1)
        return over + worst + dangling

    def rec(start, left, acc):
        nonlocal best
        if left == 1:
            cand = acc + [items[start:]]
            c = cost(cand)
            if best is None or c < best[0]:
                best = (c, cand)
            return
        for cut in range(start + 1, n - left + 2):
            rec(cut, left - 1, acc + [items[start:cut]])

    for kk in (k, k + 1):
        if kk <= n and n <= 40:
            rec(0, kk, [])
    if best is None:  # 아주 긴 구절: 앞에서부터 채운다
        out, cur = [], []
        for it in items:
            if cur and _len(cur + [it]) > maxc:
                out.append(cur)
                cur = []
            cur.append(it)
        return out + [cur]
    return best[1]


def build_lines(tr: dict, plan: dict, tl: Timeline, rules: dict, portrait: bool) -> list[dict]:
    sub = rules["subtitle"]
    maxc = sub["max_chars_portrait"] if portrait else sub["max_chars"]
    deleted = parse_ids(plan.get("delete"))
    fixes = {int(k): v for k, v in (plan.get("fix") or {}).items()}
    emph = {i for e in plan.get("emphasis", []) for i in e["words"]}
    items = []
    for w in tr["words"]:
        if w["id"] in deleted:
            continue
        s, e = tl.map(w["start"]), tl.map(w["end"])
        if s is None or e is None:
            continue
        txt = fixes.get(w["id"], w["text"])
        if txt.strip():
            items.append({"id": w["id"], "text": txt, "s": s, "e": e})
    phrases, cur = [], []  # 쉼·문장 끝에서 먼저 끊고
    for it in items:
        if cur and (it["s"] - cur[-1]["e"] > sub["break_pause"] or re.search(r"[.?!]$", cur[-1]["text"])):
            phrases.append(cur)
            cur = []
        cur.append(it)
    if cur:
        phrases.append(cur)
    lines = []
    for ph in phrases:  # 긴 구절은 줄 길이가 고르게 나뉘도록 자른다
        lines += balance(ph, maxc)
    out = []
    for ln in lines:
        out.append({"start": ln[0]["s"] - sub["lead"], "end": ln[-1]["e"] + sub["hold"], "ids": [x["id"] for x in ln],
                    "text": clean_sub(" ".join(x["text"] for x in ln)),
                    "parts": [(clean_sub(x["text"]) if j == len(ln) - 1 else x["text"], x["id"] in emph) for j, x in enumerate(ln)]})
    for a, b in zip(out, out[1:]):
        if b["start"] - a["end"] < 0.25:
            a["end"] = b["start"]
        a["end"] = min(a["end"], b["start"])
    if out:
        out[-1]["end"] = min(out[-1]["end"], tl.total)
    return out


def write_ass(path: str, W: int, H: int, lines: list[dict], emph_items: list[dict], title: str | None,
              rules: dict, brolls: list[dict] = ()) -> None:
    sub, em = rules["subtitle"], rules["emphasis"]

    def style(name, weight, size, color, outline_color, outline, align, margin, shadow=0):
        fam = "Pretendard" if weight in ("Bold",) else f"Pretendard {weight}"
        bold = -1 if weight == "Bold" else 0
        fs = int(H * size)
        return (f"Style: {name},{fam},{fs},{ass_color(color)},{ass_color(color)},{ass_color(outline_color)},"
                f"&H64000000,{bold},0,0,0,100,100,0,0,1,{max(1, round(fs * outline))},{shadow},{align},"
                f"{int(W * 0.05)},{int(W * 0.05)},{int(H * margin)},1")

    pos = {"bottom": 2, "middle": 5, "top": 8}
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
{style("Sub", sub["font_weight"], sub["size"], sub["color"], sub["outline_color"], sub["outline"], pos[sub["position"]], sub["margin"], sub["shadow"])}
{style("Emph", em["font_weight"], em["size"], em["color"], em["outline_color"], em["outline"], pos[em["position"]], em["margin"])}
{style("Title", "Black", 0.075, "#FFFFFF", "#000000", 0.1, 8, 0.12)}
{style("Credit", "Medium", rules["broll"].get("credit_size", 0.024), "#EBEBEB", "#000000", 0.08, 3, 0.03)}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    ev = []
    hl = ass_color(sub["highlight_color"])
    base = ass_color(sub["color"])
    for ln in lines:
        txt = " ".join((f"{{\\c{hl}}}{t}{{\\c{base}}}" if is_e else t) for t, is_e in ln["parts"])
        ev.append(f"Dialogue: 0,{ass_time(ln['start'])},{ass_time(ln['end'])},Sub,,0,0,0,,{txt}")
    pop = "{\\fscx60\\fscy60\\t(0,110,\\fscx112\\fscy112)\\t(110,200,\\fscx100\\fscy100)}"
    for e in emph_items:
        if e.get("text"):
            anim = pop if em.get("animation") == "pop" else "{\\fad(120,120)}"
            ev.append(f"Dialogue: 1,{ass_time(e['start'])},{ass_time(e['end'])},Emph,,0,0,0,,{anim}{e['text']}")
    for b in brolls:  # 출처는 줌과 상관없이 오른쪽 아래에 고정
        if b.get("credit"):
            ev.append(f"Dialogue: 1,{ass_time(b['start'])},{ass_time(b['end'])},Credit,,0,0,0,,{{\\fad(150,150)}}{b['credit']}")
    if title:
        ts = rules["intro"]["title_seconds"]
        ev.append(f"Dialogue: 2,{ass_time(0.05)},{ass_time(ts)},Title,,0,0,0,,{{\\fad(200,250)}}{title}")
    with open(path, "w", encoding="utf-8") as f:
        f.write(head + "\n".join(ev) + "\n")


def write_srt(path: str, lines: list[dict]) -> None:
    def t(x):
        ms = int(round(max(0, x) * 1000))
        return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"
    with open(path, "w", encoding="utf-8") as f:
        for i, ln in enumerate(lines, 1):
            f.write(f"{i}\n{t(ln['start'])} --> {t(ln['end'])}\n{ln['text']}\n\n")


def filter_path(p: str) -> str:
    return os.path.abspath(p).replace("\\", "/").replace(":", "\\:").replace("'", "\\'")


# ───────────────────────────── 전체 ─────────────────────────────

def edit(video: str, tr: dict, plan: dict, rules: dict, out: str, work: str, fast: bool = False) -> dict:
    os.makedirs(work, exist_ok=True)
    info = probe(video)
    fps = float(rules["output"]["fps"] or round(info["fps"]))
    W, H = out_size(info, rules)
    portrait = H > W

    segs = plan_segments(tr, plan, rules, fps)
    split_for_emphasis(segs, tr, plan, rules, fps)
    assign_zoom(segs, rules, fps)
    tl = Timeline(segs, fps)
    by_id = {w["id"]: w for w in tr["words"]}
    print(f"컷: 원본 {tr['duration']:.1f}초 → {tl.total:.1f}초 · 조각 {len(segs)}개 · 점프 컷 {len(tl.joins())}곳")

    cut = render_segments(video, segs, W, H, fps, rules, work, fast)

    events: list[tuple[float, str]] = []
    emph_items = []
    for e in plan.get("emphasis", []):
        s = tl.map(by_id[e["words"][0]]["start"])
        if s is None:
            continue
        end = tl.map(by_id[e["words"][-1]]["end"]) or s
        emph_items.append({"start": s, "end": max(s + rules["emphasis"]["duration"], end + 0.4), "text": e.get("text")})
        if rules["emphasis"].get("sfx"):
            events.append((s - 0.03, rules["emphasis"]["sfx"]))
    title = plan.get("title")
    if title and rules["intro"].get("sfx"):
        events.append((0.05, rules["intro"]["sfx"]))

    brolls = []
    br = rules["broll"]
    for i, b in enumerate(plan.get("broll", [])):
        s = tl.map(by_id[b["from"]]["start"])
        if s is None:
            print(f"  ! 자료화면 {i + 1}: 시작 낱말이 잘려 나감 → 건너뜀", file=sys.stderr)
            continue
        e = tl.map(by_id[b["to"]]["end"]) if b.get("to") is not None else None
        e = e if e is not None else s + b.get("dur", br["min_dur"])
        e = min(max(e, s + br["min_dur"]), s + br["max_dur"], tl.total)
        png = broll.build(b, W, H, rules, os.path.join(work, f"broll_{i + 1}.png"), work)
        credit = b.get("credit") or ("출처: " + b["card"]["source"] if (b.get("card") or {}).get("source") else "")
        brolls.append({"start": s, "end": e, "png": png, "credit": credit})
        if br.get("sfx"):
            events.append((s - 0.12, br["sfx"]))

    lines = build_lines(tr, plan, tl, rules, portrait)
    ass = os.path.join(work, "subs.ass")
    write_ass(ass, W, H, lines, emph_items, title, rules, brolls)
    srt = os.path.splitext(out)[0] + ".srt"
    write_srt(srt, lines)

    speech = build_speech(video, info, segs, fps, rules)
    mix = mix_audio(speech, events, plan, rules)
    wav = os.path.join(work, "mix.wav")
    write_wav(wav, mix)
    write_wav(os.path.join(work, "speech.wav"), speech)

    # 최종 합성: 컷 영상 → 흐림 → 자료화면 → 자막 → 끝 페이드
    inputs = ["-i", cut, "-i", wav]
    fc, v = [], "[0:v]"
    for k, bl in enumerate(plan.get("blur", [])):
        x, y, w, h = [int(round(q)) for q in bl["box"]]
        x, y = max(0, x), max(0, y)
        w, h = min(w, W - x) // 2 * 2, min(h, H - y) // 2 * 2
        fc.append(f"{v}split[bs{k}a][bs{k}b];[bs{k}b]crop={w}:{h}:{x}:{y},boxblur=luma_radius=min(h\\,w)/6:luma_power=3[bb{k}];"
                  f"[bs{k}a][bb{k}]overlay={x}:{y}:enable='between(t,{bl['start']:.3f},{bl['end']:.3f})'[vb{k}]")
        v = f"[vb{k}]"
    for k, b in enumerate(brolls):
        inputs += ["-loop", "1", "-t", f"{b['end'] - b['start'] + 0.1:.3f}", "-framerate", str(fps), "-i", b["png"]]
        d = b["end"] - b["start"]
        kb, fd = br["kenburns"], br["fade"]
        idx = 2 + k
        nfr = max(1, int(round((d + 0.1) * fps)))
        fc.append(f"[{idx}:v]scale={W * 2}:{H * 2},zoompan=z='1+{kb}*on/{nfr}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':"
                  f"d=1:s={W}x{H}:fps={fps},format=yuva420p,"
                  f"fade=t=in:st=0:d={fd}:alpha=1,fade=t=out:st={max(d - fd, 0):.3f}:d={fd}:alpha=1,"
                  f"setpts=PTS-STARTPTS+{b['start']:.3f}/TB[br{k}];"
                  f"{v}[br{k}]overlay=0:0:eof_action=pass:enable='between(t,{b['start']:.3f},{b['end']:.3f})'[vo{k}]")
        v = f"[vo{k}]"
    of = rules["outro"]["fade"]
    fc.append(f"{v}ass='{filter_path(ass)}':fontsdir='{filter_path(FONTS)}'" +
              (f",fade=t=out:st={max(tl.total - of, 0):.3f}:d={of}" if of > 0 else "") + "[vout]")
    fc.append(f"[1:a]loudnorm=I={rules['output']['lufs']}:TP=-1.5:LRA=11,aresample={SR}[aout]")
    o = rules["output"]
    run_ff([*inputs, "-filter_complex", ";".join(fc), "-map", "[vout]", "-map", "[aout]",
            "-c:v", "libx264", "-preset", "ultrafast" if fast else o["preset"], "-crf", str(o["crf"]), "-pix_fmt", "yuv420p",
            "-r", str(fps), "-c:a", "aac", "-b:a", "192k", "-t", f"{tl.total:.3f}", "-movflags", "+faststart", out])

    deleted = parse_ids(plan.get("delete"))
    kept = [w for w in tr["words"] if w["id"] not in deleted]
    fixes = {int(k): v for k, v in (plan.get("fix") or {}).items()}
    script = " ".join(fixes.get(w["id"], w["text"]) for w in kept)
    script = re.sub(r"([.?!])\s+", r"\1\n", script)
    with open(os.path.splitext(out)[0] + "_교정대본.txt", "w", encoding="utf-8") as f:
        f.write(script + "\n")
    report = {
        "video": os.path.abspath(video), "output": os.path.abspath(out), "fps": fps, "size": [W, H],
        "source_duration": tr["duration"], "output_duration": round(tl.total, 3),
        "removed_words": sorted(deleted), "removed_text": [by_id[i]["text"] for i in sorted(deleted) if i in by_id],
        "segments": [{"src": [round(s["f0"] / fps, 3), round(s["f1"] / fps, 3)], "out": round(s["out_f0"] / fps, 3),
                      "zoom": s["zoom"], "jump": not s.get("cont")} for s in segs],
        "joins": [round(j, 3) for j in tl.joins()],
        "subtitles": [{"start": round(l["start"], 3), "end": round(l["end"], 3), "text": l["text"]} for l in lines],
        "emphasis": [{**e, "start": round(e["start"], 3), "end": round(e["end"], 3)} for e in emph_items],
        "broll": [{"start": round(b["start"], 3), "end": round(b["end"], 3), "credit": b["credit"]} for b in brolls],
        "blur": plan.get("blur", []), "sfx": [{"t": round(t, 3), "name": n} for t, n in sorted(events)],
    }
    save_json(os.path.join(work, "edit_report.json"), report)
    return report


def main(argv=None):
    p = argparse.ArgumentParser(description="교정 대본대로 컷 편집하고 자막·효과음·배경음·자료화면을 넣는다")
    p.add_argument("--video", required=True)
    p.add_argument("--transcript", required=True)
    p.add_argument("--plan", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--work", help="중간 파일 폴더 (기본: 결과 파일 옆 work_edit)")
    p.add_argument("--rules")
    p.add_argument("--fast", action="store_true", help="빠른 미리보기 화질")
    a = p.parse_args(argv)
    work = a.work or os.path.join(os.path.dirname(os.path.abspath(a.out)), "work_edit")
    r = edit(a.video, load_json(a.transcript), load_json(a.plan), load_rules(a.rules), a.out, work, a.fast)
    saved = r["source_duration"] - r["output_duration"]
    print(f"완료 → {a.out}  ({r['output_duration']:.1f}초, {saved:.1f}초 줄임 · 자막 {len(r['subtitles'])}줄 · "
          f"강조 {len(r['emphasis'])} · 자료화면 {len(r['broll'])} · 효과음 {len(r['sfx'])})")


if __name__ == "__main__":
    main()
