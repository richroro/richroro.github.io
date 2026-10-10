"""캐릭터 썰 v2: write shorts/<id>/script.json and edit.json from one compact story spec, sseol_v2/eps/<id>.py.

usage: python3 sseol_v2/build.py <id> [<id> ...]      then: python3 voice_edge.py <id> && python3 prep.py <id> && ./render.sh <id> final/<id>.mp4

A spec is a module with EP = {
  "title": "짝꿍이 내 우유만 마신다",           # one line, the post's title (and the qa title)
  "music": ("monkeys_spinning_monkeys", 0.18),
  "voices": {"nar": ("SunHi", "+28%"), "jj": ("InJoon", "+22%", "+20Hz")},
  "cast": {"me": {"look": {...}}, "jj": {"name": "짝꿍", "look": {...}}},   # lib/Chibi.tsx Look
  "beats": [ (line id, voice, say, cap, scene or None), ... ],             # None: the previous picture stays
  "sfx": [["b.원샷", "pop", 0.3], ...],
}
`cap` is the post body for the line: "/" starts a new row (12 characters at most per row).
A scene is a lib/Sseol.tsx scene ("bg", "prop", "big", "card", "place", "chat", "zoom", "zoom0", "focus", "steps", ...) whose
"chars" are strings "key:mood>to@x*size!" (to, x, size and ! = flip optional) or full dicts; "tags": true shows name tags.
"""
import importlib.util, json, os, re, sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EDGE = {"SunHi": "ko-KR-SunHiNeural", "InJoon": "ko-KR-InJoonNeural", "Hyunsu": "ko-KR-HyunsuMultilingualNeural"}
CHAR = re.compile(r"^(\w+)(?::(\w+))?(?:>(\w+))?(?:@([\d.]+))?(?:\*([\d.]+))?(!)?$")

def char(spec, cast, tags):
    if isinstance(spec, dict):
        return spec
    m = CHAR.match(spec)
    if not m: raise ValueError(f"bad char {spec}")
    key, mood, to, x, size, flip = m.groups()
    c = {"style": "chibi", **{k: v for k, v in cast[key].items() if k != "name"}}
    if tags and cast[key].get("name"): c["name"] = cast[key]["name"]
    if mood: c["mood"] = mood
    if to: c["to"] = to
    if x: c["x"] = float(x)
    if size: c["size"] = float(size)
    if flip: c["flip"] = True
    return c

def build(sid):
    spec = importlib.util.spec_from_file_location(sid, f"{HERE}/sseol_v2/eps/{sid}.py")
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    ep = mod.EP
    voices = {}
    for k, v in ep["voices"].items():
        voices[k] = {"edge": EDGE[v[0]], "rate": v[1], **({"pitch": v[2]} if len(v) > 2 else {})}
    lines, clips = [], []
    for i, (lid, voice, say, cap, scene) in enumerate(ep["beats"]):
        lines.append({"id": lid, "voice": voice, "gap": 0.05 if i == 0 else (0.12 if voice == "nar" else 0.1), "say": say, "cap": [cap]})
        if scene is None: continue
        g = {"type": "scene", **{k: v for k, v in scene.items() if k not in ("chars", "tags")}}
        g["chars"] = [char(c, ep["cast"], scene.get("tags")) for c in scene.get("chars", [])]
        clips.append({"from": lid, "label": lid, "gfx": g})
    script = {"title": [ep["title"]], "voices": voices, "tail": ep.get("tail", 0.45), "lines": lines}
    edit = {"credit": "", "postFrame": {"app": "썰방", "color": ep.get("color", "#FF8A4C"), "meta": ep.get("meta", "익명 | 창작 사연게시판")},
            "sources": {}, "music": {"file": f"music/{ep['music'][0]}.mp3", "gain": ep["music"][1], "start": ep.get("music_start", 0)},
            "sfx": ep.get("sfx", []), "clips": clips}
    os.makedirs(f"{HERE}/shorts/{sid}", exist_ok=True)
    json.dump(script, open(f"{HERE}/shorts/{sid}/script.json", "w"), ensure_ascii=False, indent=1)
    json.dump(edit, open(f"{HERE}/shorts/{sid}/edit.json", "w"), ensure_ascii=False, indent=1)
    rows = [p.strip() for _, _, _, cap, _ in ep["beats"] for p in cap.split("/") if p.strip()]
    long = [r for r in rows if len(re.findall(r"[가-힣A-Za-z0-9%]", re.sub(r"[\[\]{}]", "", r))) > 12]
    syl = sum(len(re.findall(r"[가-힣]", b[2])) for b in ep["beats"])
    print(f"{sid}: {len(lines)} lines, {len(clips)} scenes, {syl} syllables" + (f"  ROWS OVER 12: {long}" if long else ""))

for sid in sys.argv[1:]:
    build(sid)
