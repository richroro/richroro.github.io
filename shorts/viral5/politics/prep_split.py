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
  segments   [{"in", "out"}]  source ranges in seconds, joined in order (a white flash marks every cut);
             add "single": [cx, cy, zoom] (or true to detect) and "label" for a stretch that shows one person full-frame
  lines      [{"who": 0 | 1, "text": "..."}]  what was said, in order. Write only words you are sure of: a caption
             that puts words in someone's mouth is worse than no caption, so leave unclear bits out.
             translated shorts write {"who", "ko", "en", "at", "to"} instead: "at"/"to" pin a line to source seconds
             ("t"/"tend" to output seconds), "ko" is the caption and "en" the original under it ("" = Korean only)
  subOrder   "en-ko" leads with the English line, Korean under it (subtitle-study layout; [bracketed] English words
             are yellow);  captionY: the caption block's centre (default 1370)
  keys       words shown in yellow;  music, sfx (output seconds), tail
  names      short names by "who" (translated shorts): a line spoken while the camera is on someone else
             gets the speaker's name above it; the shot's person is the one whose name is in its "label"
  music      [{"src", "from", "at", "to", "fade", "gain"}]: a bed built from tracks in $MEDIA (or public/...), each
             placed from output second "at" to "to", starting "from" seconds into its file; a part can also be a
             voice taken from a clip, to run under other pictures;  musicGain;  duck: false keeps the bed level
  segments   also take "src" (another clip), "audio" (its level, 0 = muted), "rotate" (90/-90/180), "push" ([z0, z1]),
             "trim" ([x0, y0, x1, y1] of the source to keep; "single" is then relative to what is kept)
             and "frame": "film" (a 1080x810 box that shows a whole 4:3 frame instead of the square crop)
             and "vf" (an extra ffmpeg video filter, applied after trim and rotation)
             and "speed" (e.g. 0.4 = slow motion, baked into the clip; the segment then lasts (out - in) / speed)
             and "broll": true (its src runs on the same timeline as the main clip, the B-roll picture over the same speech,
             so moving to or from it with no gap in time is not a cut and gets no flash)
             and "credit" (this stretch's own credit line, shown instead of the short's while it is on screen)
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
    """[{w, t0, t1}] on the clip's own timeline: faster-whisper's words where it has them (politics/<id>/whisper.json),
    with the Zipformer's words (transcript.json) filling any stretch whisper skipped"""
    zp, wp = f"{HERE}/{sid}/transcript.json", f"{HERE}/{sid}/whisper.json"
    zip_words = json.load(open(zp))["asr"] if os.path.exists(zp) else []
    if not os.path.exists(wp): return zip_words, "zipformer"
    wh = [{"w": w["word"].strip(), "t0": w["start"], "t1": w["end"]}
          for seg in json.load(open(wp))["segments"] for w in seg.get("words") or [] if w["word"].strip()]
    gaps = [z for z in zip_words if not any(abs(z["t0"] - w["t0"]) < 1.2 or w["t0"] <= z["t0"] <= w["t1"] for w in wh)]
    return sorted(wh + gaps, key=lambda w: w["t0"]), f"whisper (+{len(gaps)} zipformer words in its gaps)"

def lcs_pairs(a, b):
    """index pairs of a longest common subsequence of a and b (dynamic programming, one row at a time)"""
    m, n = len(a), len(b)
    if not m or not n: return []
    bv = np.array([ord(c) for c in b])
    dp = np.zeros((m + 1, n + 1), np.int32)
    for i in range(1, m + 1):
        eq = (bv == ord(a[i - 1])).astype(np.int32)
        t = np.maximum(dp[i - 1, 1:], dp[i - 1, :-1] + eq)
        dp[i, 1:] = np.maximum.accumulate(t)
    pairs, i, j = [], m, n
    while i > 0 and j > 0:
        if a[i - 1] == b[j - 1] and dp[i, j] == dp[i - 1, j - 1] + 1: pairs.append((i - 1, j - 1)); i -= 1; j -= 1
        elif dp[i - 1, j] >= dp[i, j - 1]: i -= 1
        else: j -= 1
    pairs.reverse()
    # keep only matches that sit in a run of at least two (both sides consecutive); lone letters are chance
    keep = []
    for k, (x, y) in enumerate(pairs):
        prev_ok = k > 0 and pairs[k - 1] == (x - 1, y - 1)
        next_ok = k + 1 < len(pairs) and pairs[k + 1] == (x + 1, y + 1)
        if prev_ok or next_ok: keep.append((x, y))
    return keep

def align(lines, rec, out_t):
    """time every word of `lines` (output seconds): a longest-common-subsequence alignment of the script's letters
    with the recognizer's letters over the whole clip, split into windows wherever a line has an "at" (source s) pin"""
    hyp, ht = [], []
    for r in rec:
        chars = [ch for ch in r["w"] if SYL.match(ch)]
        for i, ch in enumerate(chars):
            t = r["t0"] + (r["t1"] - r["t0"]) * i / max(1, len(chars))
            for j in jamo(ch): hyp.append(j); ht.append(t)
    words = [L["text"].split() for L in lines]
    flat = [(li, wi) for li, ws in enumerate(words) for wi in range(len(ws))]
    n = [len(SYL.findall(words[li][wi])) or 1 for li, wi in flat]
    pins = [li for li, L in enumerate(lines) if L.get("at") is not None]
    bounds = [0] + pins + [len(lines)]
    est = {}  # flat word index -> estimated start time
    for b0, b1 in zip(bounds[:-1], bounds[1:]):
        if b0 >= b1: continue
        t_lo = out_t(lines[b0]["at"]) - 0.5 if lines[b0].get("at") is not None else -1e9
        t_hi = out_t(lines[b1]["at"]) + 0.3 if b1 < len(lines) and lines[b1].get("at") is not None else 1e9
        ref, owner = [], []
        for li in range(b0, b1):
            for wi, w in enumerate(words[li]):
                pos = 0
                for ch in w:
                    for j in jamo(ch): ref.append(j); owner.append((flat.index((li, wi)), pos)); pos += 1
        idx = [k for k, t in enumerate(ht) if t_lo <= t < t_hi]
        sub = [hyp[k] for k in idx]
        got = {}
        for x, y in lcs_pairs(ref, sub):
            fw, pos = owner[x]
            got.setdefault(fw, []).append(ht[idx[y]] - 0.065 * pos)  # back off to where the word would have started
        for fw, ts in got.items(): est[fw] = float(np.median(ts))
    times = [est.get(k) for k in range(len(flat))]
    for li in pins:  # a pinned line starts exactly where it is pinned
        times[flat.index((li, 0))] = out_t(lines[li]["at"])
    # words the recognizer missed: spread them between timed neighbours, by length
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
    for k in range(1, len(times)):  # a word never starts before the one it follows
        times[k] = max(times[k], times[k - 1] + 0.06)
    return {k: t for k, t in zip(flat, times)}, words, n

def main(sid):
    ed = json.load(open(f"{HERE}/{sid}/edit.json"))
    src = f"{MEDIA}/{ed['src']}"; W, H = probe(src)
    pub = f"{V}/public/{sid}"; os.makedirs(f"{pub}/clips", exist_ok=True)

    # segments → clips, and the map from source time to output time
    clips, at, starts = [], 0.0, []
    for k, s in enumerate(ed["segments"]):
        sp = s.get("speed", 1.0); dur = (s["out"] - s["in"]) / sp; out = f"{pub}/clips/c{k:02d}.mp4"
        seg_src = f"{MEDIA}/{s['src']}" if s.get("src") else src  # a segment may come from another clip of the same hearing
        tx0, ty0, tx1, ty1 = s.get("trim", [0, 0, 1, 1])  # cut a band off the source (a broadcaster's lower third) before anything else
        vf = (f"setpts=(PTS-STARTPTS)/{sp}," if sp != 1.0 else "") + "fps=30" + (f",crop=trunc(iw*{tx1 - tx0}/2)*2:trunc(ih*{ty1 - ty0}/2)*2:iw*{tx0}:ih*{ty0}" if s.get("trim") else "")
        vf += {90: ",transpose=1", -90: ",transpose=2", 180: ",hflip,vflip"}.get(s.get("rotate", 0), "")  # e.g. a camera mounted sideways
        if s.get("vf"): vf += "," + s["vf"]  # an extra ffmpeg filter for this stretch (grade a dark shot, blur a face)
        af = ["-af", ",".join(f"atempo={x}" for x in ([0.5] * int(np.log(sp) / np.log(0.5) + 1e-9) + [sp / 0.5 ** int(np.log(sp) / np.log(0.5) + 1e-9)]))] if sp != 1.0 else []
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(s["in"]), "-t", f"{s['out'] - s['in']:.3f}", "-i", seg_src, "-vf", vf, *af,
                        "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", out], check=True)
        clip = {"file": f"{sid}/clips/c{k:02d}.mp4", "label": s.get("label", ""), "at": round(at, 3), "dur": round(dur, 3), "speed": 1.0,
                "frame": s.get("frame", "square"), "zoom": s.get("push", [1.0, 1.04]), "focus": "50% 50%", "audio": s.get("audio", 1.0)}
        if s.get("credit"): clip["credit"] = s["credit"]  # this stretch's own source line (B-roll from another archive)
        if s.get("single"):  # this stretch is a one-person shot, not the two-shot: one face-centred crop, labelled
            given = isinstance(s["single"], list)
            f = s["single"] if given else (face_in(seg_src, [(s["in"], s["out"])], 0.0, 1.0) or [0.5, 0.4, 0.2])
            sw, sh = probe(f"{pub}/clips/c{k:02d}.mp4")  # the clip as cut (trimmed, rotated)
            clip["crop"] = {"cx": round(f[0], 3), "cy": round(f[1], 3), "zoom": f[2] if given else 1.3, "w": sw, "h": sh}
        clips.append(clip)
        starts.append(at); at += dur
    def out_t(t, src_name=None):
        for s, a in zip(ed["segments"], starts):
            if src_name is not None and s.get("src", ed["src"]) != src_name: continue
            if s["in"] - 0.3 <= t <= s["out"] + 0.3: return a + (t - s["in"]) / s.get("speed", 1.0)
        return None

    # panels: each person's face inside their half
    ranges = [(s["in"], s["out"]) for s in ed["segments"] if not s.get("single")]
    panels = []
    for p in ed["panels"]:
        x0, x1 = (0.0, 0.5) if p["half"] == "left" else (0.5, 1.0)
        f = p.get("face") or face_in(src, ranges, x0, x1) or [(x0 + x1) / 2, 0.4, 0.12]
        zoom = f[2] if p.get("face") else min(2.0, max(1.0, 0.4 * PANEL_H / (f[2] * H * 1080 / ((x1 - x0) * W))))
        dh = H * 1080 / ((x1 - x0) * W) * zoom
        panels.append({"name": p["name"], "role": p.get("role", ""), "cx": round(f[0], 4), "cy": round(f[1] + 0.05 * PANEL_H / dh, 4),
                       "zoom": round(zoom, 3), "x0": x0, "x1": x1})

    keys = ed.get("keys", [])
    names = ed.get("names") or []
    seg_who = [next((i for i, n in enumerate(names) if n in s.get("label", "")), None) for s in ed["segments"]]
    def off_screen(who, t0, t1):
        """is someone else on camera for the first half second of this line, or for most of it?"""
        def on(t):
            k = next((k for k, a in enumerate(starts) if a <= t < a + clips[k]["dur"]), None)
            return seg_who[k] if k is not None else None
        other = [on(t) not in (None, who) for t in np.arange(t0, max(t1, t0 + 0.1), 0.1)]
        lead = next((i for i, o in enumerate(other) if not o), len(other))
        return lead >= 5 or sum(other) > len(other) / 2
    pages, speakers = [], []
    if all("ko" in L for L in ed["lines"]):
        # translation: each line is one page, timed by its "at" (source s) until the next line or its own "to";
        # no per-word highlight, because Korean word order doesn't follow the English speech
        # a line is placed by "at"/"to" on its clip's own timeline, or by "t"/"tend" in output seconds (a voice that
        # runs on under other pictures)
        start = lambda L: L["t"] if "t" in L else out_t(L["at"], L.get("src", ed["src"]))
        for li, L in enumerate(ed["lines"]):
            t0 = start(L)
            nl = ed["lines"][li + 1] if li + 1 < len(ed["lines"]) else None
            nxt = start(nl) if nl else None
            t1 = L["tend"] if "tend" in L else out_t(L["to"], L.get("src", ed["src"])) if L.get("to") is not None else (nxt if nxt is not None else at)
            toks = [{"text": w, "key": any(kw in w for kw in keys), "fromMs": round(t0 * 1000), "n": 0} for w in L["ko"].split()]
            for tk in toks: tk["toMs"] = tk["fromMs"]
            page = {"startMs": round(t0 * 1000), "endMs": round(min(t1, nxt if nxt is not None else 1e9) * 1000), "tokens": toks, "en": L.get("en", "")}
            if names and off_screen(L["who"], t0, page["endMs"] / 1000): page["who"] = names[L["who"]]
            pages.append(page)
            if speakers and speakers[-1]["who"] == L["who"] and t0 - speakers[-1]["to"] < 0.8: speakers[-1]["to"] = round(t1, 3)
            else: speakers.append({"from": round(t0 - 0.1, 3), "to": round(t1, 3), "who": L["who"]})
        engine = "translation (line times)"
    else:
        # captions: the written lines, timed on the recognizer's words (moved onto the output timeline)
        rec, engine = recognized_words(sid)
        rec_out = []
        for r in rec:
            a_, b_ = out_t(r["t0"]), out_t(r["t1"])
            if a_ is not None: rec_out.append({"w": r["w"], "t0": a_, "t1": b_ if b_ is not None else a_ + 0.3})
        times, words, nsyl = align(ed["lines"], rec_out, out_t)
        tok_pages = []
        for li, L in enumerate(ed["lines"]):
            cur = []
            for wi, w in enumerate(words[li]):
                n = len(SYL.findall(w))
                if cur and (len(cur) >= 4 or sum(len(SYL.findall(c["text"])) for c in cur) + n > 11):
                    tok_pages.append(cur); cur = []
                cur.append({"text": w, "key": any(kw in w for kw in keys), "fromMs": max(30, round(times[(li, wi)] * 1000)), "n": n})
                if w[-1] in ".?!,": tok_pages.append(cur); cur = []
            if cur: tok_pages.append(cur)
            t0 = times[(li, 0)]; last = len(words[li]) - 1
            t1 = times[(li, last)] + 0.17 * nsyl[sum(len(x) for x in words[:li]) + last] + 0.25
            if speakers and speakers[-1]["who"] == L["who"] and t0 - speakers[-1]["to"] < 0.8: speakers[-1]["to"] = round(t1, 3)
            else: speakers.append({"from": round(t0 - 0.1, 3), "to": round(t1, 3), "who": L["who"]})
        for i, toks in enumerate(tok_pages):
            nxt = tok_pages[i + 1][0]["fromMs"] if i + 1 < len(tok_pages) else round(at * 1000)
            end = min(nxt, toks[-1]["fromMs"] + 170 * toks[-1]["n"] + 700)
            for j, tk in enumerate(toks):
                tk["toMs"] = toks[j + 1]["fromMs"] if j + 1 < len(toks) else end
            pages.append({"startMs": toks[0]["fromMs"], "endMs": end, "tokens": toks})
    out_pages = [{**{k: v for k, v in p.items() if k != "tokens"}, "tokens": [{k: v for k, v in tk.items() if k != "n"} for tk in p["tokens"]]} for p in pages]
    tail = ed.get("tail", 0.6); end = round(at + tail, 3)
    env = np.zeros(int(np.ceil(end * FPS)) + 1)  # speech level per frame, for ducking any music under the hearing audio
    if ed.get("duck", True):
        for sp in speakers: env[int(sp["from"] * FPS):int(sp["to"] * FPS)] = 1.0
    music = None
    if ed.get("music"):  # one bed file out of the listed parts, so the template plays a single track
        ins, chains = [], []
        for k, m in enumerate(ed["music"]):
            dur, fd = m["to"] - m["at"], m.get("fade", 0.8)
            ins += ["-i", f"{V}/{m['src']}" if m["src"].startswith("public/") else f"{MEDIA}/{m['src']}"]
            chains.append(f"[{k}:a]atrim={m.get('from', 0)}:{m.get('from', 0) + dur},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,volume={m.get('gain', 1.0)},"
                          f"afade=t=in:d={min(fd, 0.3) if m['at'] == 0 else fd},afade=t=out:st={dur - fd:.3f}:d={fd},adelay={int(m['at'] * 1000)}:all=1[m{k}]")
        mix = "".join(f"[m{k}]" for k in range(len(ed["music"]))) + f"amix=inputs={len(ed['music'])}:normalize=0[out]"
        subprocess.run(["ffmpeg", "-v", "error", "-y", *ins, "-filter_complex", ";".join(chains + [mix]), "-map", "[out]", "-c:a", "aac", "-b:a", "192k",
                        f"{pub}/music.m4a"], check=True)
        music = {"file": f"{sid}/music.m4a", "gain": ed.get("musicGain", 0.9), "start": 0}
    stickers = []
    if ed.get("context"):
        stickers.append({"text": ed["context"], "from": 0.15, "to": min(3.2, at - 0.2), "x": 540, "y": 1236, "rot": -2, "bg": "#FFFFFF", "fg": "#111", "size": 40})
    data = {"id": sid, "end": end, "title": ed["title"], "credit": ed.get("credit", "출처: 국회 영상회의록"), "lines": [], "origVoice": True,
            "pages": out_pages, "env": [round(float(v), 3) for v in env], "clips": clips, "moments": [],
            "stickers": stickers + ed.get("stickers", []), "sfx": [{"t": a, "name": n, "gain": g} for a, n, g in ed.get("sfx", [])],
            "music": music, "flashes": [round(a, 3) for k, a in enumerate(starts) if k and (abs(ed["segments"][k]["in"] - ed["segments"][k - 1]["out"]) > 0.05
                                                                       or ed["segments"][k].get("src") != ed["segments"][k - 1].get("src")
                                                                       and not (ed["segments"][k].get("broll") or ed["segments"][k - 1].get("broll")))], "punches": [],
            "split": {"w": W, "h": H, "panels": panels}, "speakers": speakers, "captionY": ed.get("captionY", 1370), "subOrder": ed.get("subOrder", "ko-en")}
    os.makedirs(f"{V}/src/data", exist_ok=True)
    json.dump(data, open(f"{V}/src/data/{sid}.json", "w"), ensure_ascii=False)
    print(f"prep {sid}: {len(clips)} segments, {at:.1f}s + {tail}s tail, {len(out_pages)} caption pages timed on {engine}")
    for p in panels: print(f"  panel {p['name']}: face ({p['cx']:.3f}, {p['cy']:.3f}) zoom {p['zoom']}")
    for p in out_pages:
        print(f"  {p['startMs'] / 1000:6.2f}–{p['endMs'] / 1000:6.2f}  " + (f"[{p['who']}] " if p.get("who") else "") + " ".join(t["text"] for t in p["tokens"]))

main(sys.argv[1])
ids = sorted(f[:-5] for f in os.listdir(f"{V}/src/data") if f.endswith(".json"))
with open(f"{V}/src/data/index.ts", "w") as f:
    f.write("// generated by prep.py / politics/prep_*.py\nimport type { ShortData } from \"../ClipShort\";\n")
    for i in ids: f.write(f"import {i} from \"./{i}.json\";\n")
    f.write("export const SHORTS = [" + ", ".join(ids) + "] as unknown as ShortData[];\n")
