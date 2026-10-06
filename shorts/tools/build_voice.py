"""Synthesize every script line, trim it, align caption chunks with ASR timestamps,
and write timeline.json (absolute times) plus one WAV per line.

usage: python3 build_voice.py <script.json> <tts_model_dir> <asr_root> <out_dir>
"""
import sys, json, os, re, difflib
import numpy as np, sherpa_onnx
sys.path.insert(0, os.path.dirname(__file__))
from tts_lib import load_tts, synth, write_wav

script_path, tts_dir, asr_root, out = sys.argv[1:5]
os.makedirs(f"{out}/voice", exist_ok=True)
S = json.load(open(script_path))
tts = load_tts(tts_dir)
zk = f"{asr_root}/sherpa-onnx-zipformer-korean-2024-06-24"
asr = sherpa_onnx.OfflineRecognizer.from_transducer(
    encoder=f"{zk}/encoder-epoch-99-avg-1.int8.onnx", decoder=f"{zk}/decoder-epoch-99-avg-1.int8.onnx",
    joiner=f"{zk}/joiner-epoch-99-avg-1.int8.onnx", tokens=f"{zk}/tokens.txt", num_threads=4)

def trim(x, sr, thr_db=-46, pad_a=0.06, pad_b=0.09):
    env = np.convolve(np.abs(x), np.ones(int(0.01 * sr)) / int(0.01 * sr), mode="same")
    thr = env.max() * 10 ** (thr_db / 20)
    idx = np.where(env > thr)[0]
    a = max(0, idx[0] - int(pad_a * sr)); b = min(len(x), idx[-1] + int(pad_b * sr))
    y = x[a:b].copy()
    fa, fb = int(0.008 * sr), int(0.02 * sr)  # tiny fades so the cut never clicks
    y[:fa] *= np.linspace(0, 1, fa); y[-fb:] *= np.linspace(1, 0, fb)
    return y

KEEP = re.compile(r"[가-힣A-Za-z0-9]")
def chars(s):
    return [c for c in s if KEEP.match(c)]

def recognize(x, sr):
    st = asr.create_stream(); st.accept_waveform(sr, x); asr.decode_stream(st)
    r = st.result
    out = []  # (char, time)
    toks, ts = list(r.tokens), list(r.timestamps)
    for i, (tok, t0) in enumerate(zip(toks, ts)):
        t1 = ts[i + 1] if i + 1 < len(ts) else t0 + 0.12
        cs = chars(tok.replace("▁", ""))
        for k, c in enumerate(cs):
            out.append((c, t0 + (t1 - t0) * k / max(1, len(cs))))
    return r.text, out

def align(spoken, rec, dur):
    sc = chars(spoken); rc = [c for c, _ in rec]
    times = [None] * len(sc)
    sm = difflib.SequenceMatcher(a=sc, b=rc, autojunk=False)
    for blk in sm.get_matching_blocks():
        for k in range(blk.size):
            times[blk.a + k] = rec[blk.b + k][1]
    known = [i for i, t in enumerate(times) if t is not None]
    if not known:  # fall back to uniform
        return [dur * i / len(sc) for i in range(len(sc))], 0.0
    for i in range(len(sc)):
        if times[i] is None:
            prev = max([k for k in known if k < i], default=None); nxt = min([k for k in known if k > i], default=None)
            if prev is None: times[i] = times[nxt] * i / max(1, nxt)
            elif nxt is None: times[i] = times[prev] + (dur - times[prev]) * (i - prev) / (len(sc) - prev)
            else: times[i] = times[prev] + (times[nxt] - times[prev]) * (i - prev) / (nxt - prev)
    hs = [c for c in sc if "가" <= c <= "힣"]; hr = [c for c in rc if "가" <= c <= "힣"]
    return times, difflib.SequenceMatcher(a=hs, b=hr, autojunk=False).ratio()

timeline = {"title": S["title"], "lines": [], "fps": 30}
t = 0.0
for L in S["lines"]:
    v = S["voices"][L["voice"]]
    spoken = L["say"].replace("|", "")
    best = None
    tries = [(v["speed"], sd) for sd in (7, 11, 23, 31, 47, 59)] + [(v["speed"] - 0.06, sd) for sd in (7, 11, 23)]
    if "seed" in L: tries = [(L.get("speed", v["speed"]), L["seed"])]  # a take picked by ear-proxy (ASR under the mix)
    for speed, seed in tries:
        if best is not None and best[3] >= 0.9 and speed != v["speed"]: break
        x, sr = synth(tts, spoken, v["sid"], speed=speed, seed=seed)
        x = trim(x, sr)
        text, rec = recognize(x, sr)
        times, ratio = align(spoken.replace("<sigh>", ""), rec, len(x) / sr)
        if best is None or ratio > best[3]: best = (x, sr, times, ratio, text, seed)
        if ratio >= 0.97: break
    x, sr, times, ratio, text, seed = best
    dur = len(x) / sr
    # chunk boundaries: first spoken char of each '|' segment
    segs, pos = [], 0
    for seg in L["say"].split("|"):
        n = len(chars(seg.replace("<sigh>", "")))
        segs.append(times[pos] if n else (times[pos] if pos < len(times) else dur)); pos += n
    seg_t = [0.0] + [max(0.0, s - 0.06) for s in segs[1:]]
    chunks = [{"t0": round(seg_t[i], 3), "t1": round(seg_t[i + 1] if i + 1 < len(seg_t) else dur, 3), "text": L["cap"][i]} for i in range(len(seg_t))]
    t += L.get("gap", 0.2)
    path = f"{out}/voice/{L['id']}.wav"; write_wav(path, x, sr)
    timeline["lines"].append({"id": L["id"], "voice": L["voice"], "start": round(t, 3), "dur": round(dur, 3), "wav": f"voice/{L['id']}.wav", "chunks": chunks,
                               "asr": text, "match": round(ratio, 3), "seed": seed})
    print(f"{L['id']:10s} start={t:6.2f} dur={dur:4.2f} match={ratio:.2f} seed={seed} | {text}")
    t += dur
timeline["end"] = round(t + S.get("tail", 1.5), 3)
json.dump(timeline, open(f"{out}/timeline.json", "w"), ensure_ascii=False, indent=1)
print("total", timeline["end"])
