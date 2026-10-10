"""Objective scores for one take (README "음성 v2" bake-off). Nobody listens here, so these only make the shortlist.

  mos    UTMOS22 strong (MIT; ONNX export, 16 kHz). Trained on English listening tests: a rough naturalness proxy for Korean.
  cer    character error rate of faster-whisper's transcript against the line, Hangul only (digits and the few Latin
         words of the test set are read out first on both sides)
  sps    syllables per second over the whole trimmed take (pauses included)
  art    articulation rate: syllables per second of voiced time (pauses of 80 ms or more left out)
  pauses internal silences of 80 ms or more (s): count, mean, longest
  f0     pitch range in semitones between the 5th and 95th percentile of voiced frames (pYIN), and median Hz
"""
import os, re, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import voice_engine as ve

SR = ve.SR
UTMOS = os.environ.get("UTMOS_ONNX", os.path.expanduser("~/.cache/voicelab/utmos/utmos22_strong.onnx"))
LATIN = {"NASA": "나사", "KTX": "케이티엑스", "CG": "씨지", "TV": "티비", "UFO": "유에프오", "ISO": "아이에스오"}
_s = {}


def hangul(text):
    t = re.sub(r"(\d),(\d)", r"\1\2", text)
    t = re.sub(r"\d+", lambda m: ve.read_num(int(m.group())), t)
    t = re.sub(r"[A-Za-z]+", lambda m: LATIN.get(m.group().upper(), m.group()), t)
    return "".join(re.findall(r"[가-힣]", t))


def cer(ref, hyp):
    a, b = hangul(ref), hangul(hyp)
    d = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        p, d[0] = d[0], i
        for j in range(1, len(b) + 1):
            p, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, p + (a[i - 1] != b[j - 1]))
    return d[len(b)] / max(1, len(a))


def mos(x):
    import onnxruntime as ort
    if "mos" not in _s:
        _s["mos"] = ort.InferenceSession(UTMOS, providers=["CPUExecutionProvider"])
    import librosa
    x16 = librosa.resample(x.astype(np.float32), orig_sr=SR, target_sr=16000)
    return float(_s["mos"].run(None, {"wave": x16[None].astype(np.float32)})[0][0])


def pauses(x, min_len=0.08, thr_db=-35):
    hop = int(0.01 * SR)
    env = np.sqrt(np.convolve(x ** 2, np.ones(hop) / hop, mode="same"))[::hop]
    db = 20 * np.log10(env + 1e-7); quiet = db < db.max() + thr_db
    idx = np.where(~quiet)[0]
    if not len(idx): return []
    q = quiet[idx[0]: idx[-1] + 1]; out, run = [], 0
    for v in q:
        if v: run += 1
        else:
            if run * 0.01 >= min_len: out.append(run * 0.01)
            run = 0
    return out


def f0(x):
    import librosa
    y = librosa.resample(x.astype(np.float32), orig_sr=SR, target_sr=16000)
    f, v, _ = librosa.pyin(y, fmin=60, fmax=600, sr=16000, frame_length=1024)
    f = f[v & ~np.isnan(f)]
    if len(f) < 10: return 0.0, 0.0
    lo, hi = np.percentile(f, [5, 95])
    return float(12 * np.log2(hi / lo)), float(np.median(f))


def score(x, ref, asr=True):
    n = len(hangul(ref)); dur = len(x) / SR; ps = pauses(x)
    r = {"dur": round(dur, 2), "syl": n, "sps": round(n / dur, 2), "art": round(n / max(0.1, dur - sum(ps)), 2),
         "np": len(ps), "pmean": round(float(np.mean(ps)), 2) if ps else 0.0, "pmax": round(max(ps), 2) if ps else 0.0}
    r["f0st"], r["f0hz"] = (round(v, 1) for v in f0(x))
    r["mos"] = round(mos(x), 2)
    if asr:
        hyp, _ = ve.transcribe(x, words=False)
        r["hyp"], r["cer"] = hyp, round(cer(ref, hyp), 3)
    return r
