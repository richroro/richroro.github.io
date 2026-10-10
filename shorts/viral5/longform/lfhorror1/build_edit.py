"""Build longform/lfhorror1/edit.json from build/lfhorror1/timeline.json (voice.py) and shots.txt.
Also prints the chapter list (YouTube chapters), the live-clip share and the longest shot.
usage: python3 longform/lfhorror1/build_edit.py
"""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(f"{HERE}/../..")
tl = json.load(open(f"{ROOT}/build/lfhorror1/timeline.json"))
L = {l["id"]: l for l in tl["lines"]}
SWAP = 109  # from this line on the narrator is the reflection: the corner 도치 is drawn mirrored
# script chapters → YouTube chapters (the recipe's eight): "이상한 손님들" stays inside "인수인계서"
CH = {"인트로": "인트로", "설정": "첫 출근", "규칙": "인수인계서", "3시 13분": "3시 13분", "문서의 모순": "앞뒤가 안 맞는다",
      "3쪽": "3쪽", "마지막 줄": "마지막 줄", "아웃트로": "아웃트로"}

shots = []
for raw in open(f"{HERE}/shots.txt", encoding="utf-8"):
    raw = raw.split("#")[0].strip() if raw.startswith("#") else raw.strip()
    if not raw:
        continue
    nar = None
    if "+nar" in raw:
        raw, mood = raw.split("+nar"); nar = mood.strip()
    p = raw.split()
    lid = p[0]
    t0 = 0.0 if lid == "000" else max(0.0, L[lid]["start"] - 0.25)
    shots.append({"t0": round(t0, 3), "k": p[1], "a": p[2:], "line": int(lid),
                  **({"nar": {"mood": nar, "flip": int(lid) >= SWAP}} if nar else {})})
for a, b in zip(shots, shots[1:]):
    a["t1"] = b["t0"]
shots[-1]["t1"] = tl["end"]

caps = []
for l in tl["lines"]:
    for c in l["chunks"]:
        caps.append({"t0": round(l["start"] + c["t0"], 3), "t1": round(l["start"] + c["t1"] + 0.15, 3), "text": c["text"], "who": l["who"]})
for a, b in zip(caps, caps[1:]):
    a["t1"] = min(a["t1"], b["t0"])

chap, cards = [], []
for l in tl["lines"]:
    name = CH.get(l["chapter"])
    if name and (not chap or chap[-1][1] != name):
        t = 0.0 if not chap else max(0.0, l["start"] - 0.6)
        chap.append((t, name))
for n, (t, name) in enumerate(chap[1:-1], 1):
    cards.append({"t": round(t, 3), "n": n, "title": name})

edit = {"id": "lfhorror1", "fps": 30, "end": tl["end"], "audio": "lfhorror1/mix.wav", "shots": shots, "caps": caps, "cards": cards,
        "title": {"t0": round(L["005"]["start"] + 1.0, 3), "t1": round(L["006"]["start"] - 0.1, 3), "lines": ["인수인계서 [3쪽]은", "집에서 읽으래요."]},
        "mirrorSrc": "lfhorror1/ph/15491784c.jpg", "cctvSrc": "lfhorror1/ph/15491784c.jpg",
        "chapters": [[f"{int(t // 60)}:{int(t % 60):02d}", n] for t, n in chap],
        "music": ["music/Lightless Dawn.mp3", "music/Darkest Child.mp3", "music/Gathering Darkness.mp3"]}
json.dump(edit, open(f"{HERE}/edit.json", "w"), ensure_ascii=False, indent=1)
live = sum(s["t1"] - s["t0"] for s in shots if s["k"] in ("v", "static"))
longest = max(shots, key=lambda s: s["t1"] - s["t0"])
print("chapters:", " / ".join(f"{a} {b}" for a, b in edit["chapters"]))
print(f"shots {len(shots)}  mean {tl['end'] / len(shots):.1f}s  longest {longest['t1'] - longest['t0']:.1f}s (line {longest['line']})  live clips {live:.0f}s = {live / tl['end']:.0%}")
