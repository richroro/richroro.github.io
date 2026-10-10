"""Do the captions still land on the syllables? Checks a prepared short (src/data/<id>.json + build/<id>/voice/).

usage: python3 voicelab/capcheck.py <id> [label]     prints one summary line, appends it to voicelab/capcheck.csv

1. page CER: the dry voice under each caption page (startMs..endMs, nothing else mixed in) is transcribed on its own;
   its characters are compared with the page's text. A page shown too early or too late loses its first or last words.
2. word lag: faster-whisper word times on the whole dry voice track against each caption word's fromMs (median and
   95th percentile of |difference|, ms). For Edge takes this compares two independent clocks; for the local engines
   the captions came from the same recognizer, so (1) is the independent check there.
3. silent starts: caption words whose first 120 ms are silent in the voice track (a word lighting up before it is said).
"""
import csv, difflib, json, os, sys
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); V = os.path.dirname(HERE)
sys.path.insert(0, V); sys.path.insert(0, HERE)
import voice_engine as ve, score

sid = sys.argv[1]; label = sys.argv[2] if len(sys.argv) > 2 else ""
D = json.load(open(f"{V}/src/data/{sid}.json")); T = json.load(open(f"{V}/build/{sid}/timeline.json"))
SR = ve.SR; track = np.zeros(int((T["end"] + 1) * SR), np.float32)
for L in T["lines"]:
    x = ve.read_wav(f"{V}/build/{sid}/{L['wav']}"); a = int(L["start"] * SR); track[a:a + len(x)] += x[: len(track) - a]

cers, n = [], 0
for p in D["pages"]:
    a, b = int(p["startMs"] / 1000 * SR), int(p["endMs"] / 1000 * SR)
    ref = "".join(t["text"] for t in p["tokens"])
    if not score.hangul(ref) or b - a < SR * 0.2: continue
    hyp, _ = ve.transcribe(track[a:b], words=False)
    cers.append(score.cer(ref, hyp)); n += 1

_, words = ve.transcribe(track, prompt=" ".join("".join(t["text"] for t in p["tokens"]) for p in D["pages"]))
wc = [(c, w0) for w0, _, w in words for c in score.hangul(w)]
tok = [(c, t["fromMs"] / 1000) for p in D["pages"] for t in p["tokens"] for c in score.hangul(t["text"])[:1]]
lags = []
for blk in difflib.SequenceMatcher(a=[c for c, _ in tok], b=[c for c, _ in wc], autojunk=False).get_matching_blocks():
    for k in range(blk.size): lags.append(abs(tok[blk.a + k][1] - wc[blk.b + k][1]) * 1000)
hop = int(0.01 * SR); env = np.sqrt(np.convolve(track ** 2, np.ones(hop) / hop, mode="same"))[::hop]
loud = 20 * np.log10(env + 1e-7) > 20 * np.log10(env.max()) - 35
silent = sum(1 for p in D["pages"] for t in p["tokens"] if not loud[int(t["fromMs"] / 10): int(t["fromMs"] / 10) + 12].any())
ntok = sum(len(p["tokens"]) for p in D["pages"])
row = {"id": sid, "label": label, "pages": n, "page_cer": round(float(np.mean(cers)), 3) if cers else 0, "page_cer_max": round(max(cers), 3) if cers else 0,
       "lag_med_ms": round(float(np.median(lags))) if lags else None, "lag_p95_ms": round(float(np.percentile(lags, 95))) if lags else None,
       "silent_starts": f"{silent}/{ntok}"}
print(row)
path = f"{HERE}/capcheck.csv"; new = not os.path.exists(path)
with open(path, "a", newline="") as f:
    w = csv.DictWriter(f, list(row)); new and w.writeheader(); w.writerow(row)
