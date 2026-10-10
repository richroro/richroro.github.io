"""정보 쇼츠 v2 options for prep.py (the template side is src/lib/Info2.tsx). Shorts without these keys are untouched.

edit.json
  "cover": {"src": "<source key>", "in": 12.3, "title": ["줄 1", "[노랑] 줄 2"], "dur": 0.5, "focus": "50% 40%", "zoom": 1.1,
            "arrow": {"x": 640, "y": 1100, "rot": 35, "len": 230}, "ring": {"x": 540, "y": 1000, "r": 140}, "at": "top",
            "note": "사진: 같은 폭풍, 미국"}
      a 0.5 s thumbnail frame before the episode: a still of the source (a photo as is, a video's frame at "in" seconds)
      full screen, the two-line title big in white and yellow, an optional red arrow or ring. Without "title" it uses the
      script's title.
  "capStyle": "info2"   captions in at most two lines, yellow as the only highlight
  "hideCredit": true    no credit badge on screen (credits go in the upload description)
  "tags": [{"text": "자료화면", "from": "ok", "to": "call-0.1", "y": 424}]   a small plain label at the picture's top left
  "frame": "tall"       (prep.py's own key) the picture fills everything under the title band, 1080x1520
"""
import os, re, subprocess

def extend(data, edit, script, sid, pub, at):
    for k in ("capStyle", "hideCredit"):
        if edit.get(k) is not None: data[k] = edit[k]
    if edit.get("tags"):
        data["tags"] = [{"text": g["text"], "from": round(at(g["from"]), 3), "to": round(at(g["to"]), 3), **({"y": g["y"]} if "y" in g else {})} for g in edit["tags"]]
    c = edit.get("cover")
    if not c: return
    s = edit["sources"][c["src"]]; srcf = f"{pub}/src/{s['file']}"
    out = f"{pub}/cover.jpg"
    if re.search(r"\.(jpe?g|png|webp)$", srcf, re.I):
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", srcf, "-q:v", "2", out], check=True)
    else:
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(c.get("in", 0)), "-i", srcf, "-frames:v", "1", "-q:v", "2", out], check=True)
    data["cover"] = {"file": f"{sid}/cover.jpg", "title": c.get("title", script["title"]), "dur": c.get("dur", 0.5),
                     **{k: c[k] for k in ("focus", "zoom", "arrow", "ring", "at", "note") if k in c}}
