"""After prep.py: write the seconds each photo is on screen into shorts/<id>/edit.json "sources" (used_seconds) and
media/teuk/photos.json (used). usage: python3 media/teuk/used.py"""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
P = json.load(open(f"{HERE}/photos.json"))
for p in P.values(): p["used"] = []
for i in range(1, 15):
    sid = f"teuk{i}"; e = json.load(open(f"{ROOT}/shorts/{sid}/edit.json")); d = json.load(open(f"{ROOT}/src/data/{sid}.json"))
    for k in e["sources"]: e["sources"][k]["used_seconds"] = []
    for c, dc in zip(e["clips"], d["clips"]):
        if c.get("src"):
            span = [round(dc["at"], 2), round(dc["at"] + dc["dur"], 2)]
            e["sources"][c["src"]]["used_seconds"].append(span); P[c["src"]]["used"].append({"short": sid, "seconds": span})
    json.dump(e, open(f"{ROOT}/shorts/{sid}/edit.json", "w"), ensure_ascii=False, indent=1)
json.dump(P, open(f"{HERE}/photos.json", "w"), ensure_ascii=False, indent=1)
