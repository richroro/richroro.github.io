"""Turn one short's voice build + edit list into what the Remotion project reads.

usage: python3 prep.py <id> [<id> ...]
Reads   shorts/<id>/script.json, shorts/<id>/edit.json, build/<id>/timeline.json (+ voice/*.wav from voice_edge.py)
Writes  public/<id>/voice/*.wav, public/<id>/clips/*.mp4 (cut from public/<id>/src/), src/data/<id>.json, src/data/index.ts

edit.json times are anchors on the narration, so a new voice take re-times the whole edit:
  "chute"           start of line "chute"
  "chute.낙하산"     the moment "낙하산" is spoken in that line
  "crane@end+0.1"   0.1 s after line "crane" ends

A clip may be a graphic instead of footage (src/lib/Gfx.tsx): "gfx": {"type": "counter" | "bars" | "units" | "text" | "ox" |
"vs" | "rank" | "quiz" | "scene" | "post", ...} (scene and post are the story shorts' drawn scenes, src/lib/Sseol.tsx). Its "steps" are anchors as above (or numbers: seconds after the clip starts) for its reveals.
A gfx clip needs no "src"; with one, that footage plays darkened behind the graphic. A source whose file is a photo
(.jpg/.png/.webp) is shown still, with the slow zoom. "marks": [{"kind": "circle" | "arrow", "x", "y", "r", "rot",
"from", "to"}] draws red circles and arrows over the picture (x, y in the 1080x1920 frame).
In a "cap", [word] is yellow and {word} is red. A line whose "cap" is [""] gets no caption (a character's line that the scene shows in a speech bubble).
"""
import difflib, json, os, re, subprocess, sys, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
FPS, SR = 30, 44100
SYL = re.compile(r"[가-힣A-Za-z0-9%]")

def read(path):
    with wave.open(path) as w:
        x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
        return x.reshape(-1, w.getnchannels()).mean(1), w.getframerate()

def write(path, x, sr=SR):
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())

# ── captions: same rules as number-oops (pages split on '/', words timed on the spoken syllables) ──
def words_of(page):
    out, key, red = [], False, False
    for raw in page.split():
        segs, buf = [], ""
        for ch in raw:
            if ch in "[]{}":
                if buf: segs.append((buf, key, red)); buf = ""
                if ch in "[]": key = ch == "["
                else: red = ch == "{"
            else:
                buf += ch
        if buf: segs.append((buf, key, red))
        w = {"text": "".join(s for s, _, _ in segs), "key": any(k for _, k, _ in segs), "n": sum(len(SYL.findall(s)) for s, _, _ in segs)}
        if any(r for _, _, r in segs): w["red"] = True  # {word}: red (only written when used, so older shorts' data is unchanged)
        out.append(w)
    merged = []
    for w in out:
        if w["n"] == 0 and merged: merged[-1]["text"] += " " + w["text"]
        else: merged.append(w)
    return merged

DIG, UNIT = "영일이삼사오육칠팔구", ["", "십", "백", "천"]
def read_num(n):
    if n == 0: return DIG[0]
    out, big = "", ["", "만", "억", "조"]
    for b in range(3, -1, -1):
        part = n // 10 ** (4 * b) % 10 ** 4
        if not part: continue
        for k in range(3, -1, -1):
            d = part // 10 ** k % 10
            if d: out += ("" if d == 1 and k else DIG[d]) + UNIT[k]
        out += big[b]
    return out
def spoken_form(word):
    w = re.sub(r"(\d),(\d)", r"\1\2", word)
    return "".join(SYL.findall(re.sub(r"\d+", lambda m: read_num(int(m.group())), w)))

def caption_pages(tl, caps, grouped=False):
    pages = []
    for L in tl["lines"]:
        groups = [(ci, words_of(p)) for ci, cap in enumerate(caps[L["id"]]) for p in cap.split("/") if p.strip()]
        if not groups: continue  # "cap": [""]: no caption for this line (a character's line shown in a speech bubble)
        words = [w for _, p in groups for w in p]
        cap_chars, owner = [], []
        for wi, w in enumerate(words):
            for c in spoken_form(w["text"]): cap_chars.append(c); owner.append(wi)
        first = [None] * len(words)
        for blk in difflib.SequenceMatcher(a=cap_chars, b=list(L["chars"]), autojunk=False).get_matching_blocks():
            for k in range(blk.size):
                wi = owner[blk.a + k]; first[wi] = blk.b + k if first[wi] is None else min(first[wi], blk.b + k)
        times = []
        for wi, w in enumerate(words):
            if first[wi] is not None: ts = L["ct"][first[wi]]
            else:
                nxt = next((L["ct"][first[j]] for j in range(wi + 1, len(words)) if first[j] is not None), L["dur"])
                ts = (times[-1] + nxt) / 2 if times else 0.0
            times.append(max(ts, times[-1] + 0.05) if times else 0.0)
        wi = 0
        for ci, p in groups:
            toks = []
            for w in p:
                toks.append({"text": w["text"], "key": w["key"], **({"red": True} if w.get("red") else {}), "fromMs": round((L["start"] + times[wi]) * 1000)}); wi += 1
            pages.append({"tokens": toks, "lineEndMs": round((L["start"] + L["dur"]) * 1000), **({"g": f"{L['id']}:{ci}"} if grouped else {})})
    for i, p in enumerate(pages):
        nxt = pages[i + 1]["tokens"][0]["fromMs"] if i + 1 < len(pages) else 10 ** 9
        p["startMs"] = p["tokens"][0]["fromMs"]
        p["endMs"] = min(nxt, (p["lineEndMs"] if nxt > p["lineEndMs"] else nxt) + 500)
        for j, tk in enumerate(p["tokens"]):
            tk["toMs"] = p["tokens"][j + 1]["fromMs"] if j + 1 < len(p["tokens"]) else min(p["endMs"], nxt, p["lineEndMs"] + 150)
        del p["lineEndMs"]
    return pages

def prep(sid):
    sdir, build, pub = f"{HERE}/shorts/{sid}", f"{HERE}/build/{sid}", f"{HERE}/public/{sid}"
    script, edit = json.load(open(f"{sdir}/script.json")), json.load(open(f"{sdir}/edit.json"))
    tl = json.load(open(f"{build}/timeline.json"))
    os.makedirs(f"{pub}/voice", exist_ok=True); os.makedirs(f"{pub}/clips", exist_ok=True)
    by = {L["id"]: L for L in tl["lines"]}

    def at(a):
        if isinstance(a, (int, float)): return float(a)
        m = re.match(r"^([^.@+-]+)(?:\.([^@+-]+))?(@end)?([+-][\d.]+)?$", a)
        if not m: raise ValueError(f"bad anchor {a}")
        lid, word, endf, off = m.groups(); L = by[lid]
        if word:
            k = L["chars"].find(spoken_form(word))
            if k < 0: raise ValueError(f"'{word}' not spoken in {lid}")
            t = L["start"] + L["ct"][k]
        else:
            t = L["start"] + (L["dur"] if endf else 0.0)
        return t + float(off or 0)

    # narration, level-matched, plus a per-frame level for ducking
    n_frames = int(np.ceil(tl["end"] * FPS)) + 1; env = np.zeros(n_frames)
    for L in tl["lines"]:
        x, sr = read(f"{build}/{L['wav']}")
        voiced = x[np.abs(x) > 0.02]
        x = x * (10 ** (-18 / 20) / (np.sqrt(np.mean(voiced ** 2)) + 1e-9))
        write(f"{pub}/voice/{L['id']}.wav", np.tanh(x * 1.2) / np.tanh(1.2), sr)
        hop = sr // FPS
        for k in range(len(x) // hop):
            f = int(round(L["start"] * FPS)) + k
            if f < n_frames: env[f] = max(env[f], float(np.sqrt(np.mean(x[k * hop:(k + 1) * hop] ** 2))))
    if (env > 0).any(): env = np.clip(env / (np.percentile(env[env > 0], 90) + 1e-9), 0, 1)  # a wordless short has no voice
    sm = np.zeros_like(env)
    for i in range(1, len(env)): sm[i] = env[i] if env[i] > sm[i - 1] else sm[i - 1] + (env[i] - sm[i - 1]) * 0.13

    # clips: each runs until the next one starts; cut from the source so the renderer seeks nothing
    src = edit["sources"]; clips = []; ranks = []
    for i, c in enumerate(edit["clips"]):
        a = at(c["from"]) if i else 0.0  # the first shot covers frame 0 too, so the video never opens on black
        b = at(edit["clips"][i + 1]["from"]) if i + 1 < len(edit["clips"]) else tl["end"]
        s = src[c["src"]] if c.get("src") else {}; speed = c.get("speed", 1.0); file = None
        srcf = f"{pub}/src/{s['file']}" if s.get("file") else ""
        if srcf and os.path.exists(srcf) and re.search(r"\.(jpe?g|png|webp)$", srcf, re.I):  # a still photo: copied as is
            ext = srcf.rsplit(".", 1)[1].lower(); out = f"{pub}/clips/c{i:02d}.{ext}"
            subprocess.run(["cp", srcf, out], check=True); file = f"{sid}/clips/c{i:02d}.{ext}"
        elif c.get("in") is not None and os.path.exists(srcf):
            out = f"{pub}/clips/c{i:02d}.mp4"; need = (b - a) * speed + 0.5
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(c["in"]), "-t", f"{need:.3f}", "-i", srcf, "-vf", "scale='min(1920,iw)':-2,fps=30",
                            "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", out], check=True)
            file = f"{sid}/clips/c{i:02d}.mp4"
        clip = {"file": file, "label": c.get("label", c.get("src", "")), "at": round(a, 3), "dur": round(b - a, 3), "speed": speed,
                "frame": c.get("frame", edit.get("frame", "square")), "zoom": c.get("zoom", [1.04, 1.12]), "focus": c.get("focus", "50% 50%"), "audio": c.get("audio", 0.12)}
        for k in ("grain", "year"):  # 그 시절 레트로 ("frame": "rounded43"): film grain and the year sticker, per clip or for the whole short
            if c.get(k, edit.get(k)) is not None: clip[k] = c.get(k, edit.get(k))
        if c.get("credit", s.get("credit")): clip["credit"] = c.get("credit", s.get("credit"))  # per-source credit line (else the short's)
        if c.get("crop") and os.path.exists(srcf):  # [cx, cy, zoom]: aim at one panel of a split-screen source
            wh = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", srcf],
                                stdout=subprocess.PIPE, text=True, check=True).stdout.strip().split(",")
            clip["crop"] = {"cx": c["crop"][0], "cy": c["crop"][1], "zoom": c["crop"][2], "w": int(wh[0]), "h": int(wh[1])}
        if c.get("rank"): ranks.append({"n": c["rank"]["n"], "label": c["rank"]["label"], "from": round(a, 3)})  # a TOP-N place
        if c.get("gfx"):  # a graphic in place of footage; its step anchors become seconds since the clip started
            g = dict(c["gfx"])
            if "steps" in g: g["steps"] = [round(x if isinstance(x, (int, float)) else at(x) - a, 3) for x in g["steps"]]
            clip["gfx"] = g
        clips.append(clip)

    caps = {L["id"]: L["cap"] for L in script["lines"]}
    data = {
        "id": sid, "end": tl["end"], "title": script["title"], "credit": edit["credit"],
        "lines": [{"id": L["id"], "start": L["start"], "dur": L["dur"]} for L in tl["lines"]],
        "pages": caption_pages(tl, caps, edit.get("layout") == "teuk"), "env": [round(float(v), 3) for v in sm], "clips": clips,
        "moments": [{"from": round(at(m["from"]), 3), "to": round(at(m["to"]), 3), "gain": m.get("gain", 1.0)} for m in edit.get("moments", [])],
        "stickers": [{"text": s["text"], "from": round(at(s["from"]), 3), "to": round(at(s["to"]), 3), "x": s.get("x", 540), "y": s.get("y", 560),
                      "rot": s.get("rot", -3), "bg": s.get("bg", "#FFE14D"), "fg": s.get("fg", "#111"), "size": s.get("size", 46)} for s in edit.get("stickers", [])],
        "sfx": sorted([{"t": round(at(a), 3), "name": n, "gain": g} for a, n, g in edit.get("sfx", [])], key=lambda s: s["t"]),
        "music": edit.get("music"), "flashes": [round(at(a), 3) for a in edit.get("flashes", [])], "punches": [round(at(a), 3) for a in edit.get("punches", [])],
    }
    # translated captions for the footage's own speech (a "moment"), placed by anchors; same page shape as prep_split's
    for s in edit.get("subs", []):
        t0, t1 = round(at(s["from"]) * 1000), round(at(s["to"]) * 1000)
        toks = [{"text": re.sub(r"[][]", "", w), "key": "[" in w, "fromMs": t0, "toMs": t0} for w in s["ko"].split()]
        data["pages"].append({"startMs": t0, "endMs": t1, "tokens": toks, "en": s.get("en", "")})
    data["pages"].sort(key=lambda p: p["startMs"])
    if edit.get("captionY"): data["captionY"] = edit["captionY"]  # e.g. lower the captions when the action sits at the bottom of the frame
    if edit.get("look"): data["look"] = edit["look"]  # "retro2": 그 시절 레트로 v2 layout (src/lib/RetroV2.tsx)
    for k in ("titleStyle", "titleKey", "hook", "hookY", "titleEn", "titleY", "capLook"):  # news-shorts look: banner title and a red headline over the picture
        if edit.get(k) is not None: data[k] = edit[k]
    if edit.get("capBox"): data["capBox"] = edit["capBox"]  # captions in a box over the picture's bottom (src/lib/CapBox.tsx)
    if edit.get("hookTo") is not None: data["hookTo"] = round(at(edit["hookTo"]), 3)
    if edit.get("postFrame"):  # 썰 v2 (src/lib/PostFrame.tsx): the whole short is a post; its body is each line's caption, one row per "/" page
        body = [{"from": round(L["start"] - 0.05 if i else 0.0, 3), "text": "\n".join(p.strip() for c in caps[L["id"]] for p in c.split("/") if p.strip())} for i, L in enumerate(tl["lines"])]
        data["postFrame"] = {**edit["postFrame"], "body": [b for b in body if b["text"]]}
    for k in ("layout", "teuk"):  # "teuk": the "○○ 특" v2 look (src/lib/Teuk.tsx); its caption pages carry "g", the script caption they belong to
        if edit.get(k) is not None: data[k] = edit[k]
    if ranks: data["ranks"] = {"rows": ranks, **({"y": edit["rankY"]} if edit.get("rankY") else {})}
    if edit.get("marks"):
        data["marks"] = [{**{k: m[k] for k in ("kind", "x", "y", "r", "rot", "color") if k in m}, "from": round(at(m["from"]), 3), "to": round(at(m["to"]), 3)}
                         for m in edit["marks"]]
    if any(k in edit for k in ("cover", "capStyle", "hideCredit", "tags")):  # 정보 쇼츠 v2 (info2_prep.py)
        import info2_prep; info2_prep.extend(data, edit, script, sid, pub, at)
    os.makedirs(f"{HERE}/src/data", exist_ok=True)
    json.dump(data, open(f"{HERE}/src/data/{sid}.json", "w"), ensure_ascii=False)
    real = sum(1 for c in clips if c["file"])
    print(f"prep {sid}: {len(tl['lines'])} lines, {len(data['pages'])} caption pages, {real}/{len(clips)} clips with footage, end {tl['end']}s")

for sid in sys.argv[1:]:
    prep(sid)
ids = sorted(f[:-5] for f in os.listdir(f"{HERE}/src/data") if f.endswith(".json"))
with open(f"{HERE}/src/data/index.ts", "w") as f:
    f.write("// generated by prep.py\nimport type { ShortData } from \"../ClipShort\";\n")
    for i in ids: f.write(f"import {i} from \"./{i}.json\";\n")
    f.write("export const SHORTS = [" + ", ".join(ids) + "] as unknown as ShortData[];\n")
