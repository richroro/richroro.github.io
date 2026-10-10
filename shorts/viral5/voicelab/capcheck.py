"""Do the captions still land on the syllables? Checks a prepared short (src/data/<id>.json + build/<id>/voice/).

usage: python3 voicelab/capcheck.py <id> [label] [--until s]     prints one summary line, appends it to voicelab/capcheck.csv
A long-form without src/data/<id>.json (lfsaeyeon1) is checked on its timeline's caption chunks (one token per chunk).

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

A = [a for a in sys.argv[1:] if not a.startswith("--")]
UNTIL = float(sys.argv[sys.argv.index("--until") + 1]) if "--until" in sys.argv else None
if UNTIL: A.remove(sys.argv[sys.argv.index("--until") + 1])
sid = A[0]; label = A[1] if len(A) > 1 else ""
T = json.load(open(f"{V}/build/{sid}/timeline.json"))
if os.path.exists(f"{V}/src/data/{sid}.json"):
    D = json.load(open(f"{V}/src/data/{sid}.json"))
else:  # long-form: caption chunks of the timeline, one token each
    D = {"pages": [{"startMs": round((L["start"] + c["t0"]) * 1000), "endMs": round((L["start"] + c["t1"]) * 1000),
                    "tokens": [{"text": c["text"], "fromMs": round((L["start"] + c["t0"]) * 1000)}]}
                   for L in T["lines"] for c in L["chunks"] if c["text"]]}
if UNTIL:
    D["pages"] = [p for p in D["pages"] if p["endMs"] <= UNTIL * 1000]
    T["lines"] = [L for L in T["lines"] if L["start"] < UNTIL]; T["end"] = min(T["end"], UNTIL + 5)
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
# every Hangul character of the captions against every one Whisper heard; a caption word's lag is measured where its
# first character meets a word-initial character
wc = [(c, w0, k == 0) for w0, _, w in words for k, c in enumerate(score.hangul(w))]
tok = [(c, t["fromMs"] / 1000, k == 0) for p in D["pages"] for t in p["tokens"] for k, c in enumerate(score.hangul(t["text"]))]
lags = []
for blk in difflib.SequenceMatcher(a=[c for c, _, _ in tok], b=[c for c, _, _ in wc], autojunk=False).get_matching_blocks():
    for k in range(blk.size):
        (_, ta, fa), (_, tb, fb) = tok[blk.a + k], wc[blk.b + k]
        if fa and fb: lags.append(abs(ta - tb) * 1000)
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
