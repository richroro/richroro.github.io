"""after prep: write each photo's on-screen seconds into edit.json "sources" and media/doodle/sources.json "used_in"
usage: python3 media/doodle/v2/seconds.py doodle1 ...      (from shorts/viral5)
"""
import json, sys
SJ = "media/doodle/sources.json"
side = json.load(open(SJ)); by = {s["file"]: s for s in side["sources"]}
for sid in sys.argv[1:]:
    d = json.load(open(f"src/data/{sid}.json")); e = json.load(open(f"shorts/{sid}/edit.json"))
    spans = {}
    for c in d["clips"]:
        ph = (c.get("gfx") or {}).get("photo")
        if ph: spans.setdefault(ph.split("/")[-1], []).append([round(c["at"], 2), round(c["at"] + c["dur"], 2)])
    for k, s in e["sources"].items(): s["seconds"] = spans.get(s["file"], [])
    json.dump(e, open(f"shorts/{sid}/edit.json", "w"), ensure_ascii=False, indent=1)
    for f, sp in spans.items():
        u = [x for x in by[f]["used_in"] if x["short"] != sid] + [{"short": sid, "seconds": sp}]
        by[f]["used_in"] = sorted(u, key=lambda x: int(x["short"][6:]))
    for s in side["sources"]:  # a photo the v2 cut no longer shows
        if s["file"] not in spans: s["used_in"] = [x for x in s["used_in"] if x["short"] != sid]
json.dump(side, open(SJ, "w"), ensure_ascii=False, indent=1)
