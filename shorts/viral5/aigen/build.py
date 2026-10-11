"""AI 썰 (the 썰구리 format, README "쇼츠 50만+ AI"): write shorts/<id>/script.json and edit.json from aigen/eps/<id>.py,
and copy the scene pictures aigen/gen.py made (aigen/img/<id>/<line>.jpg) to public/<id>/ai/ for the render.

usage: python3 aigen/build.py <id> [<id> ...]
then:  python3 voice_edge.py <id> && python3 prep.py <id> && ./render.sh <id> final/<id>.mp4 && python3 qa_review.py <id>

A spec is a module with EP = {
  "title": "일진이 매일 나한테 빵을 준다ㅋㅋ",      # the post's title (and the qa title)
  "seed": 101,                                      # one seed for every picture of the short (a line's pic may override it)
  "music": ("sneaky_snitch", 0.14) or None,
  "voices": {"nar": {"engine": "supertonic", "voice": "M1", "sps": 6.8}, ...},   # 음성 v2 entries, kept as they are
  "beats": [ (line id, voice, say, cap, pic or None), ... ],   # None: the previous picture stays on screen
}
`cap` is the post body for the line ("/" starts a new row, 12 characters at most per row, [word] in red).
`pic` = {"p": scene prompt with {me} {tae} ... (aigen/cast.py), "move": "in"|"out"|"left"|"right"|"up"|"punch", "seed": n}.
"""
import importlib.util, json, os, re, shutil, sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAUSES = {"line": 0.14, "turn": 0.24, "punch": 0.5}  # 음성 v2, 썰 쇼츠
MOVES = ["in", "left", "out", "right", "up"]


def load(sid):
    spec = importlib.util.spec_from_file_location(sid, f"{HERE}/aigen/eps/{sid}.py")
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    return mod.EP


def build(sid):
    ep = load(sid)
    lines, clips, prev = [], [], None
    os.makedirs(f"{HERE}/public/{sid}/ai", exist_ok=True)
    for i, (lid, voice, say, cap, pic) in enumerate(ep["beats"]):
        lines.append({"id": lid, "voice": voice, "say": say, "cap": [cap]})
        if not pic:
            continue
        img = f"{HERE}/aigen/img/{sid}/{lid}.jpg"
        if os.path.exists(img):
            shutil.copy(img, f"{HERE}/public/{sid}/ai/{lid}.jpg")
        else:  # the script (and so the voice) can be made before the pictures; build again before rendering
            print(f"{sid}: no picture for line {lid} yet (python3 aigen/gen.py {sid})")
        src = f"{sid}/ai/{lid}.jpg"
        g = {"type": "still", "src": src, "prev": prev, "move": pic.get("move", MOVES[len(clips) % len(MOVES)])}
        if i == 0:
            g["fade"] = 0  # the first frame is the thumbnail: the picture is there at 0 s
        clips.append({"from": lid, "label": lid, "gfx": g})
        prev = src
    script = {"title": [ep["title"]], "voices": ep["voices"], "pauses": ep.get("pauses", PAUSES), "tail": ep.get("tail", 0.45), "lines": lines}
    edit = {"credit": "", "postFrame": {"app": "썰방", "color": ep.get("color", "#FF8A4C"), "meta": ep.get("meta", "익명 | 창작 사연게시판")},
            "sources": {}, "sfx": ep.get("sfx", []), "clips": clips}
    if ep.get("music"):
        edit["music"] = {"file": f"music/{ep['music'][0]}.mp3", "gain": ep["music"][1], "start": ep.get("music_start", 0)}
    os.makedirs(f"{HERE}/shorts/{sid}", exist_ok=True)
    json.dump(script, open(f"{HERE}/shorts/{sid}/script.json", "w"), ensure_ascii=False, indent=1)
    json.dump(edit, open(f"{HERE}/shorts/{sid}/edit.json", "w"), ensure_ascii=False, indent=1)
    rows = [p.strip() for _, _, _, cap, _ in ep["beats"] for p in cap.split("/") if p.strip()]
    long = [r for r in rows if len(re.findall(r"[가-힣A-Za-z0-9%]", re.sub(r"[\[\]{}]", "", r))) > 12]
    syl = sum(len(re.findall(r"[가-힣]", b[2])) for b in ep["beats"])
    print(f"{sid}: {len(lines)} lines, {len(clips)} pictures, {syl} syllables" + (f"  ROWS OVER 12: {long}" if long else ""))


if __name__ == "__main__":
    for sid in sys.argv[1:] or sys.exit(__doc__):
        build(sid)
