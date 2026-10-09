"""Build a political short from a 국회 영상회의록 clip, whose picture is a side-by-side two-shot (questioner | witness).
The two halves become two stacked panels with the speaker highlighted, the audio is the real hearing audio, and the
captions show exactly the words written in edit.json, timed onto the speech by aligning them with a recognizer's output.

usage: MEDIA=<dir> python3 politics/prep_split.py <id>
Reads   politics/<id>/edit.json
        politics/<id>/whisper.json   word times from faster-whisper, if present (preferred for timing)
        politics/<id>/transcript.json word times from the Korean Zipformer (transcribe.py), otherwise
Writes  public/<id>/clips/*.mp4, src/data/<id>.json, and refreshes src/data/index.ts

edit.json:
  src        clip path inside $MEDIA
  title      [line 1, line 2];  credit (optional);  context: a sticker shown at the start (date, committee)
  panels     [{"name", "role", "half": "left" | "right", "face": [cx, cy, zoom] (optional, else detected)}]  [0] = top
  segments   [{"in", "out"}]  source ranges in seconds, joined in order (a white flash marks every cut)
  lines      [{"who": 0 | 1, "text": "..."}]  what was said, in order. Write only words you are sure of: a caption
             that puts words in someone's mouth is worse than no caption, so leave unclear bits out.
  keys       words shown in yellow;  music, sfx (output seconds), tail
"""
import difflib, json, os, re, subprocess, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__)); V = os.path.dirname(HERE)
MEDIA = os.environ.get("MEDIA", f"{V}/media")
FPS, PANEL_H = 30, 540
SYL = re.compile(r"[가-힣A-Za-z0-9]")

def jamo(ch):
    """a Hangul syllable as its letters, so that near-misses from the recognizer (두발/도발) still line up"""
    c = ord(ch) - 0xAC00
    if 0 <= c < 11172:
        out = [chr(0x1100 + c // 588), chr(0x1161 + c % 588 // 28)]
        return out + [chr(0x11A7 + c % 28)] if c % 28 else out
    return [ch] if SYL.match(ch) else []

def probe(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", path],
                         stdout=subprocess.PIPE, text=True, check=True).stdout.strip().split(",")
    return int(out[0]), int(out[1])

def face_in(path, ranges, x0, x1):
    """median centre and height of the largest frontal face inside the x0..x1 part of the frame (0..1 units)"""
    import cv2
    det = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    cap = cv2.VideoCapture(path); pts = []
    for a, b in ranges:
        for t in np.arange(a, b, 0.5):
            cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000); ok, fr = cap.read()
            if not ok: continue
            h, w = fr.shape[:2]; xa, xb = int(x0 * w), int(x1 * w)
            g = cv2.cvtColor(fr[:, xa:xb], cv2.COLOR_BGR2GRAY)
            faces = det.detectMultiScale(g, 1.12, 5, minSize=(int(h * 0.07), int(h * 0.07)))
            if len(faces):
                x, y, fw, fh = max(faces, key=lambda f: f[2] * f[3])
                pts.append(((xa + x + fw / 2) / w, (y + fh / 2) / h, fh / h))
    cap.release()
    return [float(v) for v in np.median(np.array(pts), 0)] if pts else None

def recognized_words(sid):
    """[{w, t0, t1}] on the clip's own timeline, from whisper.json if there is one, else the Zipformer transcript"""
    wp = f"{HERE}/{sid}/whisper.json"
    if os.path.exists(wp):
        out = []
        for seg in json.load(open(wp))["segments"]:
            for w in seg.get("words") or []:
                if w["word"].strip(): out.append({"w": w["word"].strip(), "t0": w["start"], "t1": w["end"]})
        return out, "whisper"
    return json.load(open(f"{HERE}/{sid}/transcript.json"))["asr"], "zipformer"

def align(lines, rec):
    """time every word of `lines` (output seconds) by aligning its letters with the recognizer's letters"""
    ref, owner = [], []  # letters of the script, and (line, word) for each
    words = [[w for w in L["text"].split()] for L in lines]
    for li, ws in enumerate(words):
        for wi, w in enumerate(ws):
            for ch in w:
                for j in jamo(ch): ref.append(j); owner.append((li, wi))
    hyp, ht = [], []  # recognizer letters and their times (letters spread evenly over each word)
    for r in rec:
        chars = [ch for ch in r["w"] if SYL.match(ch)]
        for k, ch in enumerate(chars):
            t = r["t0"] + (r["t1"] - r["t0"]) * k / max(1, len(chars))
            for j in jamo(ch): hyp.append(j); ht.append(t)
    first = {}
    for blk in difflib.SequenceMatcher(a=ref, b=hyp, autojunk=False).get_matching_blocks():
        if blk.size < 2: continue  # a lone matching letter is as likely chance as speech
        for k in range(blk.size):
            key = owner[blk.a + k]
            first[key] = min(first.get(key, 1e9), ht[blk.b + k])
    flat = [(li, wi) for li, ws in enumerate(words) for wi in range(len(ws))]
    times = [first.get(k) for k in flat]
    # words the recognizer missed: spread them between their timed neighbours, by length
    n = [len(SYL.findall(words[li][wi])) or 1 for li, wi in flat]
    i = 0
    while i < len(flat):
        if times[i] is not None: i += 1; continue
        j = i
        while j < len(flat) and times[j] is None: j += 1
        a = times[i - 1] + 0.16 * n[i - 1] if i > 0 else (times[j] - 0.16 * sum(n[i:j]) if j < len(flat) else 0.0)
        b = times[j] if j < len(flat) else a + 0.16 * sum(n[i:j])
        acc = 0
        for k in range(i, j):
            times[k] = a + (b - a) * acc / max(1, sum(n[i:j])); acc += n[k]
        i = j
    for k in range(1, len(times)):  # never let a word start before the one it follows
        times[k] = max(times[k], times[k - 1] + 0.06)
    return {k: t for k, t in zip(flat, times)}, words, n

def main(sid):
    ed = json.load(open(f"{HERE}/{sid}/edit.json"))
    src = f"{MEDIA}/{ed['src']}"; W, H = probe(src)
    pub = f"{V}/public/{sid}"; os.makedirs(f"{pub}/clips", exist_ok=True)

    # segments → clips, and the map from source time to output time
    clips, at, starts = [], 0.0, []
    for k, s in enumerate(ed["segments"]):
        dur = s["out"] - s["in"]; out = f"{pub}/clips/c{k:02d}.mp4"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(s["in"]), "-t", f"{dur:.3f}", "-i", src, "-vf", "fps=30",
                        "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", out], check=True)
        clips.append({"file": f"{sid}/clips/c{k:02d}.mp4", "label": "", "at": round(at, 3), "dur": round(dur, 3), "speed": 1.0,
                      "frame": "square", "zoom": [1.0, 1.04], "focus": "50% 50%", "audio": 1.0})
        starts.append(at); at += dur
    def out_t(t):
        for s, a in zip(ed["segments"], starts):
            if s["in"] - 0.3 <= t <= s["out"] + 0.3: return a + t - s["in"]
        return None

    # panels: each person's face inside their half
    ranges = [(s["in"], s["out"]) for s in ed["segments"]]
    panels = []
    for p in ed["panels"]:
        x0, x1 = (0.0, 0.5) if p["half"] == "left" else (0.5, 1.0)
        f = p.get("face") or face_in(src, ranges, x0, x1) or [(x0 + x1) / 2, 0.4, 0.12]
        zoom = f[2] if p.get("face") else min(2.0, max(1.0, 0.4 * PANEL_H / (f[2] * H * 1080 / ((x1 - x0) * W))))
        dh = H * 1080 / ((x1 - x0) * W) * zoom
        panels.append({"name": p["name"], "role": p.get("role", ""), "cx": round(f[0], 4), "cy": round(f[1] + 0.05 * PANEL_H / dh, 4),
                       "zoom": round(zoom, 3), "x0": x0, "x1": x1})

    # captions: the written lines, timed on the recognizer's words (moved onto the output timeline)
    rec, engine = recognized_words(sid)
    rec_out = []
    for r in rec:
        a, b = out_t(r["t0"]), out_t(r["t1"])
        if a is not None: rec_out.append({"w": r["w"], "t0": a, "t1": b if b is not None else a + 0.3})
    times, words, nsyl = align(ed["lines"], rec_out)
    keys = ed.get("keys", [])
    pages, speakers = [], []
    for li, L in enumerate(ed["lines"]):
        cur = []
        for wi, w in enumerate(words[li]):
            n = len(SYL.findall(w))
            if cur and (len(cur) >= 4 or sum(len(SYL.findall(c["text"])) for c in cur) + n > 11):
                pages.append(cur); cur = []
            cur.append({"text": w, "key": any(kw in w for kw in keys), "fromMs": round(times[(li, wi)] * 1000), "n": n})
            if w[-1] in ".?!,": pages.append(cur); cur = []
        if cur: pages.append(cur)
        t0 = times[(li, 0)]; last = len(words[li]) - 1
        t1 = times[(li, last)] + 0.17 * nsyl[sum(len(x) for x in words[:li]) + last] + 0.25
        if speakers and speakers[-1]["who"] == L["who"] and t0 - speakers[-1]["to"] < 0.8: speakers[-1]["to"] = round(t1, 3)
        else: speakers.append({"from": round(t0 - 0.1, 3), "to": round(t1, 3), "who": L["who"]})
    out_pages = []
    for i, toks in enumerate(pages):
        nxt = pages[i + 1][0]["fromMs"] if i + 1 < len(pages) else round(at * 1000)
        end = min(nxt, toks[-1]["fromMs"] + 170 * toks[-1]["n"] + 700)
        for j, tk in enumerate(toks):
            tk["toMs"] = toks[j + 1]["fromMs"] if j + 1 < len(toks) else end
        out_pages.append({"startMs": toks[0]["fromMs"], "endMs": end, "tokens": [{k: v for k, v in tk.items() if k != "n"} for tk in toks]})

    tail = ed.get("tail", 0.6); end = round(at + tail, 3)
    env = np.zeros(int(np.ceil(end * FPS)) + 1)  # speech level per frame, for ducking any music under the hearing audio
    for sp in speakers: env[int(sp["from"] * FPS):int(sp["to"] * FPS)] = 1.0
    stickers = []
    if ed.get("context"):
        stickers.append({"text": ed["context"], "from": 0.15, "to": min(3.2, at - 0.2), "x": 540, "y": 1236, "rot": -2, "bg": "#FFFFFF", "fg": "#111", "size": 40})
    data = {"id": sid, "end": end, "title": ed["title"], "credit": ed.get("credit", "출처: 국회 영상회의록"), "lines": [], "origVoice": True,
            "pages": out_pages, "env": [round(float(v), 3) for v in env], "clips": clips, "moments": [],
            "stickers": stickers + ed.get("stickers", []), "sfx": [{"t": a, "name": n, "gain": g} for a, n, g in ed.get("sfx", [])],
            "music": ed.get("music"), "flashes": [round(a, 3) for a in starts[1:]], "punches": [],
            "split": {"w": W, "h": H, "panels": panels}, "speakers": speakers, "captionY": ed.get("captionY", 1370)}
    os.makedirs(f"{V}/src/data", exist_ok=True)
    json.dump(data, open(f"{V}/src/data/{sid}.json", "w"), ensure_ascii=False)
    print(f"prep {sid}: {len(clips)} segments, {at:.1f}s + {tail}s tail, {len(out_pages)} caption pages timed on {engine}")
    for p in panels: print(f"  panel {p['name']}: face ({p['cx']:.3f}, {p['cy']:.3f}) zoom {p['zoom']}")
    for p in out_pages:
        print(f"  {p['startMs'] / 1000:6.2f}–{p['endMs'] / 1000:6.2f}  " + " ".join(t["text"] for t in p["tokens"]))

main(sys.argv[1])
ids = sorted(f[:-5] for f in os.listdir(f"{V}/src/data") if f.endswith(".json"))
with open(f"{V}/src/data/index.ts", "w") as f:
    f.write("// generated by prep.py / politics/prep_*.py\nimport type { ShortData } from \"../ClipShort\";\n")
    for i in ids: f.write(f"import {i} from \"./{i}.json\";\n")
    f.write("export const SHORTS = [" + ", ".join(ids) + "] as unknown as ShortData[];\n")
