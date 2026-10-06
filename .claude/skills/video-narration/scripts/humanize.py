"""AI 음성을 사람처럼 들리게 하는 도구.

1. ko_normalize  : 숫자·기호·영문 약어를 사람이 읽는 한국어로 ("3가지"→"세 가지", "20영업일"→"이십 영업일",
                   "3.5%"→"삼 점 오 퍼센트", "10월"→"시월", "IPO"→"아이피오"). Supertonic 은 숫자를 자주 잘못 읽는다.
2. plan_phrases  : 문장 단위로 나누고, 사람처럼 들쭉날쭉한 쉼 길이와 문장마다 아주 조금 다른 속도를 정한다.
3. breath        : 긴 문장 앞의 작은 들숨 소리 (합성).
4. MIC_CHAIN     : 마이크로 녹음한 것 같은 음색 (저역 정리·따뜻함·존재감·약한 압축).
"""
from __future__ import annotations

import random
import re

import numpy as np

# ───────────────────────────── 숫자 읽기 ─────────────────────────────

_D = "영일이삼사오육칠팔구"
_NATIVE_ONES = ["", "하나", "둘", "셋", "넷", "다섯", "여섯", "일곱", "여덟", "아홉"]
_NATIVE_ATTR = {"하나": "한", "둘": "두", "셋": "세", "넷": "네"}
_NATIVE_TENS = ["", "열", "스물", "서른", "마흔", "쉰", "예순", "일흔", "여든", "아흔"]

# 고유어 수사로 읽는 단위 (1~99)
NATIVE_COUNTERS = ("개", "가지", "명", "사람", "살", "마리", "시간", "시", "달", "잔", "병", "권", "장", "군데", "곳",
                   "배", "번째", "번", "판", "벌", "켤레", "통", "줄", "그릇", "송이", "자루", "채", "척", "대째")
LETTERS = {"A": "에이", "B": "비", "C": "씨", "D": "디", "E": "이", "F": "에프", "G": "지", "H": "에이치", "I": "아이",
           "J": "제이", "K": "케이", "L": "엘", "M": "엠", "N": "엔", "O": "오", "P": "피", "Q": "큐", "R": "알", "S": "에스",
           "T": "티", "U": "유", "V": "브이", "W": "더블유", "X": "엑스", "Y": "와이", "Z": "지"}
UNITS = {"km": "킬로미터", "kg": "킬로그램", "cm": "센티미터", "mm": "밀리미터", "m²": "제곱미터", "㎡": "제곱미터",
         "kWh": "킬로와트시", "GB": "기가바이트", "MB": "메가바이트", "TB": "테라바이트", "ml": "밀리리터"}
WORDS = {"vs": "대", "VS": "대", "&": " 앤 ", "+": " 플러스 ", "=": " 는 ", "→": ", ", "·": ", ", "/": " ", "%p": " 퍼센트포인트"}


def sino(n: int) -> str:
    """한자어 수: 1234 → 천이백삼십사, 10000 → 만, 120000000 → 일억 이천만"""
    if n == 0:
        return "영"
    parts = []
    for unit, size in (("조", 10 ** 12), ("억", 10 ** 8), ("만", 10 ** 4), ("", 1)):
        q, n = divmod(n, size)
        if not q:
            continue
        s = ""
        for u, v in (("천", 1000), ("백", 100), ("십", 10), ("", 1)):
            d, q = divmod(q, v)
            if d:
                s += ("" if d == 1 and u else _D[d]) + u
        if unit == "만" and s == "일":
            s = ""  # 10000 = 만 (일만 아님)
        parts.append(s + unit)
    return " ".join(parts)


def native(n: int, attributive: bool = True) -> str:
    """고유어 수 (1~99): 3 → 세(관형) / 셋, 20 → 스무 / 스물, 21 → 스물한"""
    t, o = divmod(n, 10)
    ones = _NATIVE_ONES[o]
    if attributive and ones in _NATIVE_ATTR:
        ones = _NATIVE_ATTR[ones]
    tens = _NATIVE_TENS[t]
    if attributive and n == 20:
        tens = "스무"
    return tens + ones


def digits(s: str) -> str:
    return " ".join("공" if c == "0" else _D[int(c)] for c in s if c.isdigit())


def _month(n: int) -> str:
    return {6: "유월", 10: "시월"}.get(n, sino(n) + "월")


def _num_with_unit(m: re.Match) -> str:
    raw, frac, after = m.group(1), m.group(2), m.group(3) or ""
    n = int(raw.replace(",", ""))
    if frac:  # 소수: 3.5 → 삼 점 오
        return f"{sino(n)} 점 {digits(frac[1:])}" + (" " + after if after else "")
    if after.startswith("월") and 1 <= n <= 12:
        return _month(n) + after[1:]
    if after.startswith("번째"):
        return ("첫" if n == 1 else native(n)) + " " + after
    for c in NATIVE_COUNTERS:
        if after.startswith(c):
            rest = after + m.string[m.end():m.end() + 6]
            if 1 <= n <= 99 and not (c == "번" and re.match(r"번\s*(?:출구|호선|버스|문제|방|선|타자|트랙)", rest)):
                return native(n) + " " + after
            break
    if re.match(r"[천만억조]", after):  # 3천만 → 삼천만, 1억 → 일억
        return ("일" if n == 1 and after[0] in "억조" else "" if n == 1 else sino(n)) + after
    sep = " " if after and re.match(r"[가-힣]", after) else ""
    return sino(n) + sep + after


def expand_ranges(t: str) -> str:
    """범위: "3~5개" → "3개에서 5개" (단위를 앞에도 붙여야 '세 개에서 다섯 개'로 읽힌다). 자막에 써도 자연스럽다."""
    units = "|".join(sorted(NATIVE_COUNTERS + ("원", "년", "월", "일", "분", "초", "개월", "주", "층", "퍼센트", "%", "위", "등",
                                               "회", "억", "만"), key=len, reverse=True))
    t = re.sub(rf"(\d+)\s*[~〜]\s*(\d+)\s*({units})", lambda m: f"{m.group(1)}{m.group(3)}에서 {m.group(2)}{m.group(3)}", t)
    return re.sub(r"(\d)\s*[~〜]\s*(\d)", r"\1에서 \2", t)


def ko_normalize(text: str) -> str:
    t = expand_ranges(text)
    # 날짜: 2026-10-06 / 2026.10.6 → 2026년 10월 6일
    t = re.sub(r"(?<!\d)(\d{4})[-.](\d{1,2})[-.](\d{1,2})(?!\d)", lambda m: f"{int(m.group(1))}년 {int(m.group(2))}월 {int(m.group(3))}일", t)
    # 전화번호는 묶음마다 끊어서: 공일공, 일이삼사, 오육칠팔
    t = re.sub(r"(?<!\d)0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}(?!\d)",
               lambda m: ", ".join(digits(g).replace(" ", "") for g in re.findall(r"\d+", m.group(0))), t)
    t = re.sub(r"(\d+(?:\.\d+)?)\s*%p", r"\1 퍼센트포인트", t)
    t = re.sub(r"(\d+(?:\.\d+)?)\s*%", r"\1 퍼센트", t)
    for k, v in UNITS.items():
        t = re.sub(rf"(\d)\s*{re.escape(k)}\b", rf"\1 {v}", t)
    t = re.sub(r"\$\s*(\d[\d,]*)", r"\1 달러", t)
    t = re.sub(r"(\d{1,2}):(\d{2})", lambda m: f"{native(int(m.group(1)))} 시 {sino(int(m.group(2)))} 분"
               if int(m.group(2)) else f"{native(int(m.group(1)))} 시", t)
    # 숫자 + 뒤따르는 말
    t = re.sub(r"(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?\s*([가-힣]+)?", _num_with_unit, t)
    # 영문 약어(대문자 2~6자) → 알파벳 이름
    t = re.sub(r"(?<![A-Za-z])[A-Z]{2,6}s?(?![A-Za-z])", lambda m: "".join(LETTERS.get(c, c) for c in m.group(0).rstrip("s")), t)
    for k, v in WORDS.items():
        t = t.replace(k, v)
    return re.sub(r"\s+", " ", t).strip()


# ───────────────────────────── 쉼과 억양 ─────────────────────────────

def split_phrases(text: str, max_len: int = 70) -> list[tuple[str, str]]:
    """[(문장, 끝 종류)] — 끝 종류: '.', '?', '!', ',' (긴 문장을 쉼표에서 나눈 경우)"""
    out = []
    for s in re.split(r"(?<=[.!?…])\s+", text.strip()):
        s = s.strip()
        if not s:
            continue
        end = s[-1] if s[-1] in ".!?" else "."
        if len(s) > max_len and "," in s:
            parts = [p.strip() for p in re.split(r"(?<=,)\s*", s) if p.strip()]
            buf = ""
            for p in parts:
                if buf and len(buf) + len(p) > max_len:
                    out.append((buf.strip(), ","))
                    buf = ""
                buf += " " + p
            if buf.strip():
                out.append((buf.strip(), end))
        else:
            out.append((s, end))
    return out


def plan_phrases(text: str, seed: int = 0) -> list[dict]:
    """문장마다 속도 흔들림(±3%)과 뒤따르는 쉼(사람처럼 불규칙)을 정한다."""
    rnd = random.Random(seed)
    phrases = split_phrases(text)
    plan = []
    for i, (p, end) in enumerate(phrases):
        last = i == len(phrases) - 1
        base = {",": 0.22, ".": 0.48, "?": 0.58, "!": 0.52}[end]
        pause = 0.0 if last else max(0.12, base * rnd.uniform(0.8, 1.25))
        syll = len(re.findall(r"[가-힣]", p))
        jitter = rnd.uniform(0.97, 1.03) * (0.96 if re.search(r"\d", p) else 1.0)  # 숫자가 든 핵심 문장은 살짝 천천히
        plan.append({"text": p, "end": end, "pause": round(pause, 3), "speed_jitter": round(jitter, 3),
                     "breath": not last and pause >= 0.4 and len(re.findall(r"[가-힣]", phrases[i + 1][0])) >= 16})
    return plan  # breath=True 이면 이 문장 뒤 쉼 끝에(다음 긴 문장 직전) 들숨을 넣는다


def breath(sr: int, dur: float = 0.32, level_db: float = -30.0, seed: int = 0) -> np.ndarray:
    """코로 짧게 들이마시는 소리: 분홍 잡음을 사람 성도 공명대(약 0.6~2.6kHz)로 걸러 부드럽게 올렸다 내린다."""
    rng = np.random.RandomState(seed)
    n = int(dur * sr)
    white = rng.normal(0, 1, n + 1024)
    spec = np.fft.rfft(white)
    f = np.fft.rfftfreq(len(white), 1 / sr)
    pink = 1 / np.sqrt(np.maximum(f, 20))
    band = np.exp(-((np.log(np.maximum(f, 1)) - np.log(1400)) ** 2) / (2 * 0.55 ** 2))
    form = 1 + 0.6 * np.exp(-((f - 900) ** 2) / (2 * 180 ** 2)) + 0.4 * np.exp(-((f - 2300) ** 2) / (2 * 300 ** 2))
    y = np.fft.irfft(spec * pink * band * form)[:n]
    t = np.linspace(0, 1, n)
    env = np.sin(np.pi * np.clip(t / 0.7, 0, 1) / 2) ** 2 * np.clip((1 - t) / 0.3, 0, 1) ** 1.5
    y = y * env
    return (y / (np.sqrt((y ** 2).mean()) + 1e-9) * 10 ** (level_db / 20)).astype(np.float32)


# ffmpeg 오디오 필터: 마이크로 녹음한 듯한 음색
MIC_CHAIN = ",".join([
    "highpass=f=75",
    "equalizer=f=180:t=q:w=0.9:g=1.5",    # 따뜻함
    "equalizer=f=3200:t=q:w=1.2:g=2.0",   # 또렷함
    "equalizer=f=7800:t=q:w=1.8:g=-1.5",  # 디지털 쏘는 소리 줄임
    "acompressor=threshold=-18dB:ratio=1.6:attack=15:release=200:makeup=1",  # 약한 압축 (말끝이 묻히지 않게)
])
# 방 울림(aecho)은 넣지 않는다: 실측에서 발음이 가장 많이 흐려졌다 (받아쓰기 오류 4.0% → 5.0~5.3%)


def room_tone(n: int, sr: int, level_db: float = -64.0, seed: int = 0) -> np.ndarray:
    """완전한 디지털 무음 대신 아주 작은 방 소음 — 쉼이 '끊긴' 느낌이 아니라 '숨 고르는' 느낌이 된다."""
    rng = np.random.RandomState(seed + 99)
    y = rng.normal(0, 1, n)
    y = np.convolve(y, np.ones(24) / 24, mode="same")  # 고음 깎기
    return (y / (np.sqrt((y ** 2).mean()) + 1e-9) * 10 ** (level_db / 20)).astype(np.float32)


# ───────────────────────────── 여러 테이크 중 고르기 ─────────────────────────────
# 같은 문장도 만들 때마다 억양·높이·또렷함이 달라진다(실측: 억양 폭 5.6~9.3반음, 받아쓰기 오류 0~17%).
# 성우 녹음처럼 여러 번 만들어 가장 사람다운 테이크를 고른다.

_REC = None


def recognizer():
    """한국어 받아쓰기 모델 (video-edit 스킬과 같은 캐시). 없으면 한 번 받는다(330MB). 실패하면 None."""
    global _REC
    if _REC is not None:
        return _REC or None
    import os
    import subprocess
    try:
        import sherpa_onnx
    except ImportError:
        _REC = False
        return None
    root = os.environ.get("VIDEO_EDIT_CACHE") or os.path.expanduser("~/.cache/video-edit")
    d = os.path.join(root, "models", "sherpa-onnx-zipformer-korean-2024-06-24")
    if not os.path.exists(os.path.join(d, "tokens.txt")):
        os.makedirs(os.path.dirname(d), exist_ok=True)
        url = "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-zipformer-korean-2024-06-24.tar.bz2"
        print("  발음 확인용 받아쓰기 모델 받는 중 (330MB, 처음 한 번만)…", flush=True)
        r = subprocess.run(f"curl -sSL --fail -m 900 '{url}' | tar xj -C '{os.path.dirname(d)}'", shell=True)
        if r.returncode:
            _REC = False
            return None
    try:
        _REC = sherpa_onnx.OfflineRecognizer.from_transducer(
            encoder=f"{d}/encoder-epoch-99-avg-1.int8.onnx", decoder=f"{d}/decoder-epoch-99-avg-1.int8.onnx",
            joiner=f"{d}/joiner-epoch-99-avg-1.int8.onnx", tokens=f"{d}/tokens.txt", num_threads=4)
    except Exception:
        _REC = False
    return _REC or None


def heard(y: np.ndarray, sr: int) -> str | None:
    rec = recognizer()
    if rec is None:
        return None
    n = int(len(y) * 16000 / sr)
    x = np.interp(np.linspace(0, len(y) - 1, n), np.arange(len(y)), y).astype(np.float32)
    s = rec.create_stream()
    s.accept_waveform(16000, x)
    rec.decode_stream(s)
    return s.result.text


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


def pitch(y: np.ndarray, sr: int) -> dict:
    """음높이 통계: range(10~90% 폭, 반음), median(Hz), end(문장 끝 - 앞 절반, 반음)."""
    if sr != 16000:  # 계산량을 줄이려고 16kHz 로
        n = int(len(y) * 16000 / sr)
        y, sr = np.interp(np.linspace(0, len(y) - 1, n), np.arange(len(y)), y).astype(np.float32), 16000
    hop, win = int(sr * 0.01), int(sr * 0.04)
    lo, hi = int(sr / 450), int(sr / 65)
    f = []
    for i in range(0, len(y) - win, hop):
        fr = y[i:i + win]
        if np.sqrt((fr ** 2).mean()) < 0.015:
            continue
        fr = fr - fr.mean()
        ac = np.correlate(fr, fr, "full")[win - 1:]
        k = lo + int(np.argmax(ac[lo:hi]))
        if ac[k] > 0.45 * ac[0]:
            f.append(sr / k)
    if len(f) < 12:
        return {}
    f = np.array(f)
    st = 12 * np.log2(f / np.median(f))
    return {"range": float(np.percentile(st, 90) - np.percentile(st, 10)), "median": float(np.median(f)),
            "end": float(np.median(st[-12:]) - np.median(st[: len(st) // 2]))}


def take_score(y: np.ndarray, sr: int, spoken: str, end: str, ref_median: float | None) -> tuple[float, dict]:
    """높을수록 사람답다: 또렷함 · 단조롭지 않은 억양 · 자연스러운 문장 끝 · 앞 문장과 같은 목소리 높이."""
    info = pitch(y, sr)
    h = heard(y, sr)
    c = cer(spoken, ko_normalize(h)) if h is not None else 0.0
    score = -40 * c
    if info:
        r = info["range"]
        score -= 1.5 * max(0, 6.5 - r) + 1.0 * max(0, r - 10.5)  # 너무 단조롭거나 너무 출렁이면 감점
        e = info["end"]
        if end == "?":
            score -= 0.6 * max(0, 0.5 - e)  # 질문은 끝이 올라가야
        elif end in ".!":
            score -= 0.6 * max(0, e + 2) + 0.4 * max(0, -8 - e)  # 평서문은 끝이 2~8반음 내려가야
        if ref_median:
            score -= 2.5 * max(0, abs(12 * np.log2(info["median"] / ref_median)) - 0.6)  # 사람이 바뀐 듯한 높이 변화 감점
    info.update({"cer": round(c, 3), "heard": h})
    return score, info
