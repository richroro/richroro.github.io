"""Screen every voice of an engine on two lines (casual narration T01, documentary T08) before building casts.
usage: python3 voicelab/screen.py edge|supertonic|qwen     appends to voicelab/screen.csv, takes in build/voicelab/screen/
"""
import csv, json, os, sys, time
HERE = os.path.dirname(os.path.abspath(__file__)); V = os.path.dirname(HERE)
sys.path.insert(0, V); sys.path.insert(0, HERE)
import voice_engine as ve, score

T = {L["n"]: L for L in json.load(open(f"{HERE}/testset.json"))["lines"]}
EDGE = ["ko-KR-SunHiNeural", "ko-KR-InJoonNeural", "ko-KR-HyunsuMultilingualNeural", "en-US-AvaMultilingualNeural", "en-US-EmmaMultilingualNeural",
        "de-DE-SeraphinaMultilingualNeural", "fr-FR-VivienneMultilingualNeural", "pt-BR-ThalitaMultilingualNeural", "en-US-AndrewMultilingualNeural",
        "en-US-BrianMultilingualNeural", "de-DE-FlorianMultilingualNeural", "fr-FR-RemyMultilingualNeural", "it-IT-GiuseppeMultilingualNeural",
        "en-AU-WilliamMultilingualNeural"]
ENTRIES = {
    "edge": [{"edge": v, "rate": "+0%"} for v in EDGE],
    "supertonic": [{"engine": "supertonic", "voice": v, "speed": 1.05} for v in ["F1", "F2", "F3", "F4", "F5", "M1", "M2", "M3", "M4", "M5"]],
    "qwen": [{"engine": "qwen", "speaker": s} for s in ["sohee", "vivian", "serena", "ono_anna", "ryan", "aiden", "dylan", "eric", "uncle_fu"]],
}
eng = sys.argv[1]
out = f"{V}/build/voicelab/screen"; os.makedirs(out, exist_ok=True)
rows = []
for v in ENTRIES[eng]:
    for n in ("T01", "T08"):
        L = T[n]; text = L["say"] if eng == "edge" else ve.ko_text(L["say"])
        t = time.time(); x, _ = ve.synth(text, v) if eng == "edge" else (ve.trim(ve.to_float(*ve.RAW[eng](text, v)))[0], None); el = time.time() - t
        name = v.get("edge") or v.get("voice") or v.get("speaker")
        ve.write_wav(f"{out}/{eng}-{name}-{n}.wav", x)
        r = score.score(x, L.get("read", L["say"]))
        r.update(engine=eng, voice=name, line=n, rtf=round(el / r["dur"], 2))
        print(r, flush=True); rows.append(r)
path = f"{HERE}/screen.csv"; new = not os.path.exists(path)
with open(path, "a", newline="") as f:
    w = csv.DictWriter(f, ["engine", "voice", "line", "dur", "syl", "sps", "art", "np", "pmean", "pmax", "f0st", "f0hz", "mos", "cer", "rtf", "hyp"])
    if new: w.writeheader()
    for r in rows: w.writerow({k: r.get(k) for k in w.fieldnames})
