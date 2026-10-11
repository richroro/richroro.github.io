"""after prep: write each photo's on-screen seconds into the short's edit.json "sources" (rule1, senior1)
usage: python3 media/hit500/seconds.py rule1 senior1      (from shorts/viral5)
"""
import json, sys
for sid in sys.argv[1:]:
    d = json.load(open(f"src/data/{sid}.json")); e = json.load(open(f"shorts/{sid}/edit.json"))
    spans = {}
    for c in d["clips"]:
        ph = (c.get("gfx") or {}).get("photo")
        if ph: spans.setdefault(ph.split("/")[-1], []).append([round(c["at"], 2), round(c["at"] + c["dur"], 2)])
    for s in e["sources"].values(): s["seconds"] = spans.get(s["file"], [])
    json.dump(e, open(f"shorts/{sid}/edit.json", "w"), ensure_ascii=False, indent=1)
    print(sid, {k: len(v) for k, v in spans.items()})
