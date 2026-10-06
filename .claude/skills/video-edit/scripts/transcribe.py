#!/usr/bin/env python3
"""① 원본 영상의 음성을 낱말 단위 시각과 함께 받아쓴다.

    python3 transcribe.py 원본.mp4 --out work/

만드는 것:
    work/transcript.json  낱말 [{id, text, start, end}] · 말한 구간 · 삭제 추천
    work/transcript.txt   교정 대본을 만들 때 읽는 번호 붙은 대본
                          (3)어*   ← * 는 삭제 추천(군말·반복·말 끊김), ⏸1.8s ← 긴 멈춤
"""
from __future__ import annotations

import argparse
import os
import re
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import fmt_time, load_rules, make_recognizer, read_audio, save_json, speech_segments  # noqa: E402

SR = 16000


def envelope(audio: np.ndarray, hop: float = 0.01) -> np.ndarray:
    n = int(hop * SR)
    k = len(audio) // n
    return np.sqrt((audio[: k * n].reshape(k, n) ** 2).mean(axis=1) + 1e-12)


def refine(words: list[dict], env: np.ndarray, floor: float) -> None:
    """토큰 시작 시각만 있으므로 끝 시각은 소리 에너지로 찾는다. 다음 낱말 시작을 넘지 않는다."""
    hop = 0.01
    for i, w in enumerate(words):
        nxt = words[i + 1]["start"] if i + 1 < len(words) else w["start"] + 1.2
        limit = min(nxt, w["seg_end"] + 0.05, w["start"] + 1.6)
        a, b = int(w["start"] / hop), max(int(limit / hop), int(w["start"] / hop) + 1)
        seg = env[a:b]
        loud = np.where(seg > floor)[0]
        end = w["start"] + (loud[-1] + 1) * hop if len(loud) else w["start"] + 0.12
        w["end"] = round(min(max(end, w["start"] + 0.06), limit), 3)
        # 시작도 살짝 앞당긴다: 토큰 시각은 첫 음절 중간쯤에 찍히는 경우가 많다
        a2 = int(max(w["start"] - 0.25, words[i - 1]["end"] if i else 0) / hop)
        pre = env[a2:int(w["start"] / hop)]
        quiet = np.where(pre <= floor)[0]
        if len(pre):
            new = (a2 + (quiet[-1] + 1 if len(quiet) else 0)) * hop
            w["start"] = round(max(new, w["start"] - 0.25), 3)


def suggest_deletions(words: list[dict], rules: dict) -> dict[int, str]:
    """군말·반복·말 끊김 후보. 최종 판단은 교정 단계(Claude)가 한다."""
    fillers = set(rules["correct"]["fillers"])
    out: dict[int, str] = {}
    t = [re.sub(r"[^\w]", "", w["text"]) for w in words]
    for i, w in enumerate(t):
        if w in fillers:
            out[i] = "군말"
    n = len(t)
    for size in (3, 2, 1):  # 긴 반복부터: "먼저 계좌를 / 먼저 계좌를"
        for i in range(n - 2 * size + 1):
            a, b = t[i:i + size], t[i + size:i + 2 * size]
            if a == b and all(a) and not any(j in out for j in range(i, i + size)):
                for j in range(i, i + size):
                    out[j] = "반복"
    for i in range(n - 1):
        if i not in out and t[i] and t[i + 1].startswith(t[i]) and len(t[i]) < len(t[i + 1]) \
                and words[i + 1]["start"] - words[i]["end"] < 0.8:
            out[i] = "말 끊김"
    return out


def transcribe(path: str, rules: dict) -> dict:
    audio = read_audio(path, SR)
    dur = len(audio) / SR
    segs = speech_segments(audio, SR)
    rec = make_recognizer()
    env = envelope(audio)
    floor = max(np.percentile(env, 20) * 3, 0.004)
    words: list[dict] = []
    for si, (s, e) in enumerate(segs):
        a, b = max(0.0, s - 0.15), min(dur, e + 0.15)
        st = rec.create_stream()
        st.accept_waveform(SR, audio[int(a * SR):int(b * SR)])
        rec.decode_stream(st)
        r = st.result
        cur = None
        for tok, ts in zip(r.tokens, r.timestamps):
            t0 = a + ts
            if tok.startswith((" ", "▁")) or cur is None:  # sherpa 는 ▁ 를 공백으로 바꿔 준다
                cur = {"text": tok.lstrip(" ▁"), "start": round(t0, 3), "seg": si, "seg_end": b}
                words.append(cur)
            else:
                cur["text"] += tok
        words[:] = [w for w in words if w["text"]]
    words.sort(key=lambda w: w["start"])
    refine(words, env, floor)
    for i, w in enumerate(words):
        w["id"] = i
        w.pop("seg_end", None)
    sug = suggest_deletions(words, rules)
    pauses = []
    for i in range(len(words) - 1):
        gap = words[i + 1]["start"] - words[i]["end"]
        if gap >= rules["cut"]["max_pause"]:
            pauses.append({"after": i, "length": round(gap, 2)})
    return {"source": os.path.abspath(path), "duration": round(dur, 3),
            "segments": [{"start": round(s, 3), "end": round(e, 3)} for s, e in segs],
            "words": [{"id": w["id"], "text": w["text"], "start": w["start"], "end": w["end"], "seg": w["seg"]} for w in words],
            "suggest_delete": {str(k): v for k, v in sorted(sug.items())}, "pauses": pauses}


def to_text(tr: dict) -> str:
    sug = tr["suggest_delete"]
    pause = {p["after"]: p["length"] for p in tr["pauses"]}
    lines, cur, seg = [], [], None
    for w in tr["words"]:
        if seg is not None and w["seg"] != seg:
            lines.append(cur)
            cur = []
        if not cur:
            cur.append(f"[{fmt_time(w['start'])}]")
        seg = w["seg"]
        cur.append(f"({w['id']}){w['text']}" + ("*" if str(w["id"]) in sug else ""))
        if w["id"] in pause:
            cur.append(f"⏸{pause[w['id']]:.1f}s")
    if cur:
        lines.append(cur)
    head = ("# 받아쓴 대본 — (번호)낱말, * = 삭제 추천(군말·반복·말 끊김), ⏸ = 긴 멈춤(자동으로 줄어듦)\n"
            f"# 삭제 추천 이유: " + ", ".join(f"{k}:{v}" for k, v in list(sug.items())[:60]) + "\n")
    return head + "\n".join(" ".join(l) for l in lines) + "\n"


def main(argv=None):
    p = argparse.ArgumentParser(description="원본 영상 받아쓰기 (낱말 시각 포함)")
    p.add_argument("video")
    p.add_argument("--out", default="work")
    p.add_argument("--rules")
    a = p.parse_args(argv)
    os.makedirs(a.out, exist_ok=True)
    tr = transcribe(a.video, load_rules(a.rules))
    save_json(os.path.join(a.out, "transcript.json"), tr)
    with open(os.path.join(a.out, "transcript.txt"), "w", encoding="utf-8") as f:
        f.write(to_text(tr))
    print(f"낱말 {len(tr['words'])}개 · 말한 구간 {len(tr['segments'])}개 · 삭제 추천 {len(tr['suggest_delete'])}개 · "
          f"긴 멈춤 {len(tr['pauses'])}곳 → {a.out}/transcript.txt")


if __name__ == "__main__":
    main()
