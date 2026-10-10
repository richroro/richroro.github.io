"""낙서 짤툰 v2 builder: writes shorts/<id>/script.json and edit.json in the v2 look (README "낙서 짤툰 v2").

The v2 look: the picture box runs to the bottom ("frame": "tall"), captions sit in a navy box over the bottom of the picture
("capBox"), one accent colour (yellow) everywhere, no on-screen source badge, and 도치 is drawn 1.5-2x bigger with a
different shot per scene (mid, close-up cut at the chest, side with a tilt). doodle1-10 reuse their v1 scenes (read from
git at the v1 commit) under a new script; doodle11-16 are written here from scratch.
"""
import json, os, re, subprocess

HERE = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
V1 = "6b46ca7"  # the last commit with the v1 doodle1-10
ORANGE = "#FF7A1A"
SYL = re.compile(r"[가-힣A-Za-z0-9%]")
vis = lambda s: len(SYL.findall(re.sub(r"[\[\]{}]", "", s)))
plain = lambda s: re.sub(r"[\[\]{}]", "", s) if isinstance(s, str) else s

def v1(sid, kind):
    return json.loads(subprocess.run(["git", "show", f"{V1}:shorts/viral5/shorts/{sid}/{kind}.json"], cwd=HERE, capture_output=True, text=True, check=True).stdout)

VOICES = {"nar": {"edge": "ko-KR-InJoonNeural", "rate": "+50%"},
          "me": {"edge": "ko-KR-HyunsuMultilingualNeural", "rate": "+42%", "pitch": "+12Hz"}}

def cap_pages(cap):
    """merge "A / B" into one two-line page when it still fits the 12-character page rule"""
    if not cap: return [""]
    parts = [p.strip() for p in cap.split("/")]
    out = []
    for p in parts:
        if out and vis(out[-1] + p) <= 12: out[-1] = out[-1] + " " + p
        else: out.append(p)
    return [" / ".join(out)]

# shots for a lone character, in turn: mid, close-up (cut at the chest), side (tilted, flipped)
SHOTS = [dict(size=1.6, x=0.5), dict(size=2.1, x=0.5, y=110), dict(size=1.75, x=0.3, rot=-4), dict(size=1.95, x=0.64, y=80, flip=True, rot=3)]

def shoot(g, k):
    """put a v1 scene into the tall box: raise the floor, enlarge and vary the characters, one accent colour"""
    g = json.loads(json.dumps(g))
    g["floor"] = g.get("floor", 400)
    n = len(g.get("chars", []))
    for key in ("big", "card"):
        if g.get(key): g[key] = plain(g[key])
    if g.get("big") and len(g["big"].replace(" ", "")) > 6: g["bigSize"] = 118 if len(g["big"].replace(" ", "")) <= 9 else 104
    if g.get("say"): g["say"]["text"] = plain(g["say"]["text"])
    for m in (g.get("chat") or {}).get("msgs", []): m["text"] = plain(m["text"])
    if n == 1 and not g.get("chat"):
        c = g["chars"][0]
        if not c.get("_keep"):
            sh = dict(SHOTS[k % len(SHOTS)])
            if g.get("prop") or g.get("say") and sh.get("y", 0) > 250: sh = dict(size=1.75, x=0.3, rot=-3)  # leave room for the prop
            if g.get("prop"): g["propX"] = 0.76
            for a in ("x", "size", "y", "rot", "flip"): c.pop(a, None)
            c.update(sh)
        c.pop("_keep", None)
    elif n:
        s = {2: 1.4, 3: 1.12, 4: 0.92}.get(n, 0.9) if not g.get("chat") else 1.25
        for c in g["chars"]:
            c["size"] = c.get("_size", s); c.pop("_size", None)
    return g

def vs_scene(g, mood="think"):
    """a v1 "vs" card as a drawn scene: 도치 between the two sides, the sides as one big line"""
    L, R = g["left"], g["right"]
    big = f"{L['label']} vs {R['label']}"
    return {"type": "scene", "bg": "#FFE14D" if g.get("win") != "right" else "#dff3ff", "chars": [{"style": "doodle", "hair": ORANGE, "mood": mood, "_keep": 1, "size": 1.25, "x": 0.5}],
            "prop": f"{L.get('emoji', '')}  {R.get('emoji', '')}", "propX": 0.5, "big": big, "steps": [9, 0.1, 9, g["steps"][-1] if len(g.get("steps", [])) > 2 else 0.3]}

def me(mood, to=None, **kw):
    c = {"style": "doodle", "hair": ORANGE, "mood": mood, **kw}
    if to: c["to"] = to
    return c

def guy(mood, hairdo="bob", hair="#3b3b3b", to=None, **kw):
    c = {"style": "doodle", "hairdo": hairdo, "hair": hair, "mood": mood, **kw}
    if to: c["to"] = to
    return c

def build(sid, title, lines, clips, music, sfx, voices=None, sources=None):
    """lines: (id, voice, say, cap); clips: (line id, scene dict) in line order; sources: {key: source} (photos used)"""
    script = {"title": title, "voices": {**VOICES, **(voices or {})}, "tail": 0.3,
              "lines": [{"id": i, "voice": v, "gap": 0.04 if k == 0 else (0.06 if v != "nar" else 0.08), "say": re.sub(r"\.\s+(?=\S)", ", ", s), "cap": cap_pages(c)} for k, (i, v, s, c) in enumerate(lines)]}
    script["lines"][0]["gap"] = 0.0
    if script["lines"][0]["cap"] == [""]:  # a cold-open line of dialogue: captioned from frame 0 (in quotes) instead of a bubble
        script["lines"][0]["cap"] = cap_pages('"' + lines[0][2].rstrip(".") + '"')
        if clips and clips[0][1].get("say"): clips[0] = (clips[0][0], {k: v for k, v in clips[0][1].items() if k != "say"})
    out = []
    for k, (frm, g) in enumerate(clips):
        g = shoot({"type": "scene", **g} if "type" not in g else g, k)
        out.append({"from": frm, "label": frm, "gfx": g})
    photos = {g["gfx"]["photo"].split("/")[-1].rsplit(".", 1)[0] for g in out if g["gfx"].get("photo")}
    edit = {"credit": "", "titleStyle": "band", "titleKey": "#FFE14D", "frame": "tall", "capBox": {"y": 1600},
            "sources": {k: v for k, v in (sources or {}).items() if k in photos}, "music": music, "sfx": sfx, "clips": out}
    missing = photos - set(edit["sources"])
    if missing: raise SystemExit(f"{sid}: no source for {missing}")
    d = f"{HERE}/shorts/{sid}"; os.makedirs(d, exist_ok=True)
    json.dump(script, open(f"{d}/script.json", "w"), ensure_ascii=False, indent=1)
    json.dump(edit, open(f"{d}/edit.json", "w"), ensure_ascii=False, indent=1)
    print(sid, len(lines), "lines", len(out), "clips")

def all_sources():
    """sources.json entries in edit.json's "sources" shape (seconds are filled in by seconds.py after prep)"""
    out = {}
    for s in json.load(open(f"{HERE}/media/doodle/sources.json"))["sources"]:
        k = s["file"].rsplit(".", 1)[0]
        out[k] = {"file": s["file"], "path": f"public/doodle/{s['file']}", "page": s["page"], "file_url": s["file_url"], "license": s["license"],
                  "creator": s["creator"], "credit": "사진: Pexels (설명란 표기)", "seconds": []}
    return out

def keep_sfx(old, lines, extra=()):
    """v1 sound effects whose anchor line (and word) the new script still has, plus new ones"""
    say = {i: s for i, _, s, _ in lines}
    def ok(a):
        m = re.match(r"^([^.@+-]+)(?:\.([^@+-]+))?", a); lid, w = m.groups()
        return lid in say and (not w or w in say[lid].replace(" ", "") or w in say[lid])
    return [x for x in old if ok(x[0])] + [list(x) for x in extra]
