"""Write politics/<id>/edit.json for a "역대급 ○○ 랭킹 TOP5" v2 short (research/benchmark-footage.md §3) from its compact
spec, politics/<id>/spec.json, so the timing rules live in one place:
- places run 5위 → 1위, each as 1–3 shots laid end to end; the first shot is short (≤2.5 s) so the picture moves at once
- one caption per shot (a place with fewer captions than shots keeps its last caption up), the first one at 0 s
- a whoosh where each place after the first starts; music under all of it; no tail, so 1위 cuts straight back to 5위
- the source list ("sources") is kept from the spec, with each file's seconds used filled in

usage: python3 politics/top_v2.py <id> [<id> ...]   then  MEDIA=$PWD/media python3 politics/prep_split.py <id>

spec.json:
  title      [line 1 (coloured, "역대급 ○○"), line 2 (white, "랭킹 TOP5")];  sub: the small line 3;  color: line 1's colour
  music      a file under public/music;  musicFrom: where in it to start;  keys: caption words set in yellow
  places     [{"n": 5, "label": "2–4자", "caps": ["~하는데..", "그대로 ○○??"],
               "shots": [{"src": "topN/x.mp4", "in": s, "dur": s, "single": [cx, cy, zoom], "vf"?: "...", "speed"?: 1}]}]
  sources    [{"file", "page", "file_url", "license", "credit", ...}]
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))

def build(sid):
    sp = json.load(open(f"{HERE}/{sid}/spec.json"))
    segs, lines, sfx, used, t = [], [], [], {}, 0.0
    for pi, pl in enumerate(sp["places"]):
        if pi: sfx.append([round(t, 2), "whoosh", 0.5])
        caps = pl["caps"]
        for si, sh in enumerate(pl["shots"]):
            speed = sh.get("speed", 1.0)
            seg = {"src": sh["src"], "in": sh["in"], "out": round(sh["in"] + sh["dur"] * speed, 3), "frame": "tall",
                   "single": sh.get("single", [0.5, 0.5, 1.0]), "push": sh.get("push", [1.0, 1.06]), "audio": 0}
            for k in ("vf", "trim", "rotate"):
                if sh.get(k): seg[k] = sh[k]
            if speed != 1.0: seg["speed"] = speed
            if si == 0: seg["rank"] = {"n": pl["n"], "label": pl["label"]}
            segs.append(seg)
            used.setdefault(sh["src"], []).append([sh["in"], seg["out"]])
            if si < len(caps):
                lines.append({"who": 0, "t": round(t, 3), "tend": round(t + sh["dur"], 3), "ko": caps[si]})
            else:  # no caption of its own: the place's last caption stays up
                lines[-1]["tend"] = round(t + sh["dur"], 3)
            t += sh["dur"]
    for s in sp.get("sources", []):
        if s["file"] in used: s["used_seconds"] = used[s["file"]]
    missing = sorted(set(used) - {s["file"] for s in sp.get("sources", [])})
    if missing: sys.exit(f"{sid}: no source entry for {missing}")
    ed = {"src": segs[0]["src"], "title": sp["title"], "titleStyle": "band", "credit": "", "panels": [],
          "rank2": {"sub": sp["sub"], "color": sp.get("color", "#FF5FA2"), "hide": sp.get("hide", [1])},
          "flash": False, "keys": sp.get("keys", []), "sfx": sfx,
          "music": [{"src": sp["music"], "from": sp.get("musicFrom", 0.0), "at": 0.0, "to": round(t, 3), "fade": 0.3, "gain": 1.0}],
          "musicGain": sp.get("musicGain", 0.8), "duck": False, "captionY": sp.get("captionY", 1640), "tail": 0.0,
          "segments": segs, "lines": lines, "sources": sp.get("sources", [])}
    json.dump(ed, open(f"{HERE}/{sid}/edit.json", "w"), ensure_ascii=False, indent=1)
    shots = [s["dur"] for p in sp["places"] for s in p["shots"]]
    print(f"{sid}: {t:.2f}s, {len(shots)} shots (first {shots[0]:.2f}, mean {t / len(shots):.2f}, max {max(shots):.2f}), {len(lines)} captions")

for sid in sys.argv[1:]: build(sid)
