"""Turn one long-form's script and edit into what src/Long.tsx reads, plus its voice files, chapters and description.

usage: python3 longform/prep_long.py <id> [--no-tts]
Reads   longform/<id>/script.json   chapters of narration lines (see the README section "롱폼 제작 키트")
        longform/<id>/edit.json     the picture: sources, shots per chapter, cold open, cards, music, thumbnail
Writes  public/long/<id>/voice/*.wav, clips/*.mp4, img/*, shorts/*.mp4   (git-ignored, rebuilt here)
        src/longdata/<id>.json + src/longdata/index.ts                   (the composition's data)
        upload/specs/<id>.json "chapters" and "music" (python3 upload/make_desc.py <id> writes the description)
TTS takes are cached in build/long/<id>/tts/, so a re-run only synthesizes changed lines (--no-tts fails on a missing one).
A "voices" entry with "engine" (README "음성 v2") is read by voice_engine.py instead, which caches in build/tts_cache/.

The Edge TTS call, its trimming and the syllable timing are voice_edge.py's own code, and the number reading
(spoken_form) is prep.py's; both are loaded from those files (their function definitions only), so the long-forms
read and time words exactly as the shorts do.

Timeline: cold open (strongest lines of later chapters with their shots) -> title card -> for each chapter a chapter
card, then its lines -> outro (end-screen space, one line). Shot times are anchors as in prep.py:
  "c1a" start of line c1a · "c1a.햇빛" when that word is spoken · "c1a@end+0.2" 0.2 s after it ends · 4.5 seconds after the chapter's first line
"""
import ast, asyncio, difflib, hashlib, json, math, os, re, shutil, subprocess, sys, wave
import numpy as np

V = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FPS, SR = 30, 44100
MEDIA = os.environ.get("MEDIA", f"{V}/media")


def load_defs(path, names, ns):
    """exec only the named top-level functions/assignments of a script that runs work at import"""
    tree = ast.parse(open(path).read())
    def targets(n):
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)): return {n.name}
        if isinstance(n, ast.Assign): return {x.id for t in n.targets for x in ast.walk(t) if isinstance(x, ast.Name)}
        return set()
    keep = [n for n in tree.body if targets(n) & set(names)]
    missing = set(names) - set().union(*map(targets, keep))
    if missing: sys.exit(f"{path}: cannot find {sorted(missing)} (renamed?)")
    exec(compile(ast.Module(body=keep, type_ignores=[]), path, "exec"), ns)
    return ns


NS = {"np": np, "re": re, "subprocess": subprocess, "os": os, "io": None, "wave": wave, "difflib": difflib}
try:
    import edge_tts
    NS["edge_tts"] = edge_tts
except ImportError:
    edge_tts = None
load_defs(f"{V}/voice_edge.py", ["SR", "KEEP", "chars", "synth", "trim"], NS)
load_defs(f"{V}/prep.py", ["SYL", "DIG", "UNIT", "read_num", "spoken_form"], NS)
NS["VOICE"], NS["RATE"] = "ko-KR-InJoonNeural", "+0%"
synth, trim, chars, spoken_form, SYL = NS["synth"], NS["trim"], NS["chars"], NS["spoken_form"], NS["SYL"]


def run(cmd, **kw):
    return subprocess.run(cmd, check=True, **kw)


def probe(path):
    out = run(["ffprobe", "-v", "error", "-show_entries", "stream=width,height,codec_type:format=duration", "-of", "json", path],
              stdout=subprocess.PIPE, text=True).stdout
    j = json.loads(out); v = next((s for s in j["streams"] if s["codec_type"] == "video"), {})
    return v.get("width", 0), v.get("height", 0), float(j["format"].get("duration", 0)), any(s["codec_type"] == "audio" for s in j["streams"])


def read_wav(path):
    with wave.open(path) as w:
        x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
        return x.reshape(-1, w.getnchannels()).mean(1), w.getframerate()


def write_wav(path, x, sr=SR):
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())


def h(*parts):
    return hashlib.sha1(json.dumps(parts, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:12]


def fmt_ts(s):
    s = int(s); return f"{s // 3600}:{s // 60 % 60:02d}:{s % 60:02d}" if s >= 3600 else f"{s // 60}:{s % 60:02d}"


# ── captions: words with [key] marks, split into pages of at most 2 lines of maxChars ──
def words_of(text):
    """caption words: [key] yellow, {key} red (괴담), '/' a page break"""
    out, key, red = [], False, False
    for raw in text.replace("/", " / ").split():
        if raw == "/": out.append({"brk": True}); continue
        buf, k_any, r_any = "", False, False
        for ch in raw:
            if ch in "[]": key = ch == "["; continue
            if ch in "{}": red = ch == "{"; continue
            buf += ch; k_any = k_any or key; r_any = r_any or red
        if buf: out.append({"text": buf, "key": k_any, **({"red": True} if r_any else {})})
    return out


def clen(ws):
    return sum(len(w["text"]) for w in ws) + max(0, len(ws) - 1)


def split_lines(ws, max_chars):
    if clen(ws) <= max_chars or len(ws) < 2: return [ws]
    best = min(range(1, len(ws)), key=lambda k: (max(clen(ws[:k]), clen(ws[k:])) > max_chars, abs(clen(ws[:k]) - clen(ws[k:]))))
    return [ws[:best], ws[best:]]


def paginate(words, max_chars):
    """explicit '/' breaks first; otherwise greedy up to 2 lines, preferring to end a page after , . ? ! and before it fills"""
    groups, cur = [], []
    for w in words:
        if w.get("brk"):
            if cur: groups.append(cur); cur = []
        else: cur.append(w)
    if cur: groups.append(cur)
    pages = []
    for g in groups:
        page = []
        for i, w in enumerate(g):
            if page and clen(page + [w]) > 2 * max_chars - 2:
                # back off to the last clause end inside this page if there is one late enough
                cut = max((k for k, x in enumerate(page) if re.search(r"[,.?!…]$", x["text"]) and clen(page[:k + 1]) >= max_chars * 0.6), default=None)
                if cut is not None and cut < len(page) - 1:
                    pages.append(page[:cut + 1]); page = page[cut + 1:]
                else:
                    pages.append(page); page = []
            page.append(w)
        if page: pages.append(page)
    return [split_lines(p, max_chars) for p in pages]


class Long:
    def __init__(self, lid, no_tts=False):
        self.id, self.no_tts = lid, no_tts
        self.dir = f"{V}/longform/{lid}"
        self.S = json.load(open(f"{self.dir}/script.json"))
        self.E = json.load(open(f"{self.dir}/edit.json"))
        self.pub = f"{V}/public/long/{lid}"; self.rel = f"long/{lid}"
        self.cache = f"{V}/build/long/{lid}/tts"
        for d in ("voice", "clips", "img", "shorts", "media"): os.makedirs(f"{self.pub}/{d}", exist_ok=True)
        os.makedirs(self.cache, exist_ok=True)
        self.voices = self.S.get("voices", {})
        self.max_chars = self.E.get("maxChars", 22)
        self.warn = []

    # ── voice ──
    def voice_of(self, L):
        nar = self.voices.get("nar", {})
        v = self.voices.get(L.get("voice", "nar"), nar)
        return v.get("edge", nar.get("edge", "ko-KR-InJoonNeural")), v.get("rate", self.rate), v.get("pitch", nar.get("pitch", "+0Hz"))

    def entry_v2(self, L):
        """the line's "voices" entry when voice_engine.py should read it (another engine, or Edge with post/tempo), else None"""
        nar = self.voices.get("nar", {}); v = dict(self.voices.get(L.get("voice", "nar"), nar))
        if v.get("engine", "edge") == "edge" and not v.get("post") and not v.get("tempo"): return None
        if L.get("voice", "nar") == "nar" and getattr(self, "v2_factor", None):  # "sps" calibration of a v2 narrator
            if v.get("engine") == "supertonic": v["speed"] = round(min(2.0, float(v.get("speed", 1.05)) * self.v2_factor), 3)
            else: v["tempo"] = round(float(v.get("tempo", 1.0)) * self.v2_factor, 3)
        return v

    def tts_v2(self, spoken, v):
        sys.path.insert(0, V); import voice_engine
        if self.no_tts:
            k = voice_engine.key_of(spoken if v.get("engine", "edge") == "edge" else voice_engine.ko_text(spoken), v)
            if not os.path.exists(f"{voice_engine.CACHE}/{k}.json"): sys.exit(f"no cached take for '{spoken[:30]}' (run without --no-tts)")
        return voice_engine.synth(spoken if v.get("engine", "edge") == "edge" else voice_engine.ko_text(spoken), v)

    def tts(self, spoken, voice, rate, pitch):
        key = h(spoken, voice, rate, pitch); wav, js = f"{self.cache}/{key}.wav", f"{self.cache}/{key}.json"
        if not os.path.exists(js):
            if self.no_tts or edge_tts is None: sys.exit(f"no cached take for '{spoken[:30]}' (run without --no-tts, pip install edge-tts)")
            for attempt in range(4):
                try:
                    x, words = asyncio.run(synth(spoken, voice, rate, pitch)); break
                except Exception as e:  # the service drops connections now and then
                    if attempt == 3: raise
                    print("  tts retry:", e)
            x, words = trim(x, words)
            write_wav(wav, x); json.dump(words, open(js, "w"), ensure_ascii=False)
        x, _ = read_wav(wav)
        return x, [tuple(w) for w in json.load(open(js))]

    def syl_times(self, spoken, x, words):
        """voice_edge.py's syllable timing: spread each boundary word's syllables over its duration, align to the text"""
        dur = len(x) / SR
        rec = [(c, t0 + d * k / max(1, len(chars(w)))) for t0, d, w in words for k, c in enumerate(chars(w))]
        sc = chars(spoken); times = [None] * len(sc)
        for blk in difflib.SequenceMatcher(a=sc, b=[c for c, _ in rec], autojunk=False).get_matching_blocks():
            for k in range(blk.size): times[blk.a + k] = rec[blk.b + k][1]
        for i in range(len(sc)):
            if times[i] is None:
                prev = next((times[j] for j in range(i - 1, -1, -1) if times[j] is not None), 0.0)
                nxt = next((times[j] for j in range(i + 1, len(sc)) if times[j] is not None), dur)
                times[i] = (prev + nxt) / 2
        return "".join(sc), times

    def calibrate(self):
        """the narrator's rate: given as "rate", or found from "sps" (target syllables per second) with one test take"""
        nar = self.voices.get("nar", {})
        self.rate = nar.get("rate", "+0%")
        target = self.S.get("sps")
        if not target: return
        if self.entry_v2({"voice": "nar"}):  # a v2 narrator: measure at its own speed, then scale speed/tempo
            sample = [L for C in self.S["chapters"] for L in C["lines"] if L.get("voice", "nar") == "nar" and "short" not in L][:4]
            syl = sum(len(SYL.findall(self.spoken(L))) for L in sample)
            dur = sum(len(self.tts_v2(self.spoken(L), self.entry_v2(L))[0]) / SR for L in sample)
            self.v2_factor = target / (syl / dur)
            print(f"rate: natural {syl / dur:.2f} syl/s -> x{self.v2_factor:.3f} for {target} syl/s"); return
        sample = [L for C in self.S["chapters"] for L in C["lines"] if L.get("voice", "nar") == "nar" and "short" not in L][:4]
        syl = dur = 0.0
        for L in sample:  # measured the way the result is: syllables over each trimmed take
            x, _ = self.tts(self.spoken(L), nar.get("edge", "ko-KR-InJoonNeural"), "+0%", nar.get("pitch", "+0Hz"))
            syl += len(SYL.findall(self.spoken(L))); dur += len(x) / SR
        base = syl / dur
        pct = round((target / base - 1) * 100)
        self.rate = f"{pct:+d}%"
        print(f"rate: natural {base:.2f} syl/s -> {self.rate} for {target} syl/s")

    @staticmethod
    def spoken(L):
        return L.get("say", re.sub(r"[\[\]{}/]", "", L.get("text", ""))).replace("|", "")

    # ── media ──
    def src_path(self, s):
        for base in (V, MEDIA, f"{V}/public"):
            p = f"{base}/{s}"
            if os.path.exists(p): return p
        return None

    def source(self, name):
        s = self.E.get("sources", {}).get(name)
        if s is None: sys.exit(f"unknown source '{name}'")
        return s

    def cut(self, path, t_in, need, speed=1.0):
        """a landscape working copy (height 1080 or width 1920, 30 fps, keyframe every 0.5 s) so the renderer seeks nothing"""
        w, hh, dur, has_a = probe(path)
        if t_in + need * speed > dur + 0.05:
            self.warn.append(f"{os.path.basename(path)}: needs {t_in:.1f}+{need * speed:.1f} s of a {dur:.1f} s source; "
                             + ("starting earlier" if need * speed <= dur else "the last frame holds"))
            t_in = max(0.0, min(t_in, dur - need * speed - 0.05))
        key = h(os.path.abspath(path), os.path.getmtime(path), round(t_in, 3), round(need, 3), speed)
        out = f"{self.pub}/clips/{key}.mp4"
        if not os.path.exists(out):
            vf = "scale=-2:1080:flags=lanczos" if w / max(1, hh) >= 16 / 9 else "scale=1920:-2:flags=lanczos"
            if w / max(1, hh) < 1.2: vf = "scale=-2:1080:flags=lanczos"  # portrait or square: whole height, shown over a blurred fill
            run(["ffmpeg", "-v", "error", "-y", "-ss", f"{max(0, t_in):.3f}", "-t", f"{need * speed + 0.6:.3f}", "-i", path, "-an", "-vf", f"{vf},fps=30",
                 "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-g", "15", "-pix_fmt", "yuv420p", out])
        w2, h2, _, _ = probe(out)
        return f"{self.rel}/clips/{key}.mp4", w2, h2

    def blurred(self, rel):
        """a 192x108 blurred copy of a working file (video or image) under public/, shown scaled up as a soft fill"""
        src = f"{V}/public/{rel}"
        if not os.path.exists(src): return None
        img = bool(re.search(r"\.(jpe?g|png|webp)$", rel, re.I))
        key = h(rel, os.path.getmtime(src)); out = f"{self.pub}/blur/{key}.{'jpg' if img else 'mp4'}"
        os.makedirs(f"{self.pub}/blur", exist_ok=True)
        if not os.path.exists(out):
            vf = "scale=192:108:force_original_aspect_ratio=increase:flags=area,crop=192:108,gblur=sigma=2.5"
            if img: run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vf", vf, "-q:v", "3", out])
            else: run(["ffmpeg", "-v", "error", "-y", "-i", src, "-an", "-vf", vf + ",fps=30", "-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-g", "30", "-pix_fmt", "yuv420p", out])
        return f"{self.rel}/blur/{os.path.basename(out)}"

    def still(self, path, t=None):
        if re.search(r"\.(jpe?g|png|webp)$", path, re.I):
            out = f"{self.pub}/img/{h(os.path.abspath(path))}{os.path.splitext(path)[1].lower()}"
            if not os.path.exists(out): shutil.copy(path, out)
        else:
            out = f"{self.pub}/img/{h(os.path.abspath(path), t)}.jpg"
            if not os.path.exists(out): run(["ffmpeg", "-v", "error", "-y", "-ss", str(t or 0), "-i", path, "-frames:v", "1", "-q:v", "2", out])
        from PIL import Image
        w, hh = Image.open(out).size
        return out[len(f"{V}/public/"):], w, hh

    # ── build ──
    def prep(self):
        S, E = self.S, self.E
        self.calibrate()
        gap0 = S.get("gap", 0.35)
        self.sleep = bool(E.get("sleep"))
        cc = E.get("chapterCard", {}); chap_style = cc.get("style", "dip" if self.sleep else "card")
        chap_dur = cc.get("dur", 1.0 if chap_style == "dip" else 2.0)
        if chap_style == "card" and not 1.5 <= chap_dur <= 2.5: self.warn.append(f"chapter card {chap_dur} s (the kit expects 1.5-2.5 s)")
        title_dur = E.get("titleCard", {}).get("dur", 3.0)
        out_dur = E.get("outro", {}).get("dur", 20.0)

        # 1) every line's take, laid out on the main timeline (cold open and title card come first, so place later)
        lines, order = {}, []
        for ci, C in enumerate(S["chapters"]):
            for L in C["lines"]:
                if L["id"] in lines: sys.exit(f"duplicate line id {L['id']}")
                lines[L["id"]] = {**L, "chapter": ci}; order.append(L["id"])
        if S.get("outro"): lines[S["outro"]["id"]] = {**S["outro"], "chapter": None}

        for lid, L in lines.items():
            if "short" in L:
                L.update(self.short_line(L)); continue
            if "pause" in L:  # a beat of silence on purpose ("정답은?" 3 s): its text, if any, stays on screen as a caption
                L["dur"] = float(L["pause"]); L["chars"], L["ct"] = "", []; continue
            spoken = self.spoken(L)
            voice, rate, pitch = self.voice_of(L)
            ent = self.entry_v2(L)
            x, words = self.tts_v2(spoken, ent) if ent else self.tts(spoken, voice, rate, pitch)
            voiced = x[np.abs(x) > 0.02]
            y = x * (10 ** (-18 / 20) / (np.sqrt(np.mean(voiced ** 2)) + 1e-9))  # prep.py's level match
            y = np.tanh(y * 1.2) / np.tanh(1.2)
            f = f"{self.pub}/voice/{lid}.wav"; write_wav(f, y)
            if self.voices.get(L.get("voice", "nar"), {}).get("fx") == "radio":  # a PA announcement or a phone: band-limited, a little crunch
                run(["ffmpeg", "-v", "error", "-y", "-i", f, "-af", "highpass=f=320,lowpass=f=3300,acrusher=bits=10:mix=0.25,volume=1.4", f + ".tmp.wav"]); os.replace(f + ".tmp.wav", f)
            L["dur"] = round(len(x) / SR, 3); L["file"] = f"{self.rel}/voice/{lid}.wav"
            L["chars"], L["ct"] = self.syl_times(spoken, x, words)
            L["syl"] = len(SYL.findall(spoken))
            L["level"] = [float(np.sqrt(np.mean(y[k * (SR // FPS):(k + 1) * (SR // FPS)] ** 2))) for k in range(len(y) // (SR // FPS))]

        # 2) cold open picks
        picks = [p if isinstance(p, str) else p["line"] for p in E.get("coldOpen", {}).get("lines", [])]
        t = 0.25; cold = []
        for p in picks:
            L = lines[p]
            cold.append({"line": p, "start": round(t, 3)}); t += L["dur"] + E.get("coldOpen", {}).get("gap", 0.45)
        cold_end = round(t + 0.2, 3) if picks else 0.0
        lo, hi = E.get("coldOpen", {}).get("min", 20), E.get("coldOpen", {}).get("max", 40)
        if picks and not lo <= cold_end <= hi: self.warn.append(f"cold open is {cold_end:.1f} s (aim for {lo}-{hi} s)")
        title_at = cold_end; t = cold_end + title_dur

        # 3) chapters
        chapters = []
        for ci, C in enumerate(S["chapters"]):
            card = round(t, 3); t += chap_dur; body = round(t, 3)
            for k, lid in enumerate(L["id"] for L in C["lines"]):
                L = lines[lid]
                t += 0.3 if k == 0 else L.get("gap", gap0)
                L["start"] = round(t, 3); t += L["dur"]
            t += C.get("tail", 0.8)
            chapters.append({"n": ci + 1, "id": C["id"], "title": C["title"], "card": card, "body": body, "end": round(t, 3)})
        for L in lines.values():
            if L.get("short") and "start" in L:
                L["media"] = [{"file": m["file"], "start": round(L["start"] + m["at"], 3), "dur": m["dur"], "from": m["from"], "gain": m["gain"], "duck": m["duck"]}
                              for m in L["_media"]]
        outro_at = round(t, 3); end = round(outro_at + out_dur, 3)
        if S.get("outro"):
            o = lines[S["outro"]["id"]]; o["start"] = round(outro_at + E.get("outro", {}).get("lineAt", 0.8), 3)
            if o["start"] + o["dur"] > end - 0.5: self.warn.append("the outro line runs to the end of the outro")
        self.lines, self.chapters = lines, chapters

        # 4) shots: per chapter from edit.json, then the auto shots of reused shorts, split around them
        shots = []
        for ch, C in zip(chapters, S["chapters"]):
            spec = E.get("chapters", {}).get(C["id"], {})
            plan = []
            for i, sh in enumerate(spec.get("shots", [])):
                a = ch["body"] if i == 0 else self.at(sh.get("at", 0), ch)
                plan.append([a, None, sh])
            if any(p1[0] > p2[0] for p1, p2 in zip(plan, plan[1:])):
                self.warn.append(f"chapter {C['id']}: shots are not in time order; sorted")
                plan.sort(key=lambda p: p[0])
            for k in range(len(plan)): plan[k][1] = plan[k + 1][0] if k + 1 < len(plan) else ch["end"]
            for L in (lines[x["id"]] for x in C["lines"]):
                if "short" in L:  # a reused short owns the screen while it plays
                    a, b = L["start"], L["start"] + L["dur"]
                    nxt = []
                    for p in plan:
                        if p[1] <= a or p[0] >= b: nxt.append(p); continue
                        if p[0] < a: nxt.append([p[0], a, p[2]])
                        if p[1] > b + 1.2: nxt.append([b, p[1], {**p[2], "_skip": (p[2].get("_skip", 0) + b - p[0])}])
                        elif p[1] > b: b = p[1]  # a sliver after the short: the short's last frame holds instead
                    nxt.append([a, b, L["shot"]]); plan = sorted(nxt, key=lambda p: p[0])
            if not plan: self.warn.append(f"chapter {C['id']} has no shots"); continue
            plan[0][0] = ch["body"]
            for a, b, sh in plan:
                shots += self.make_shot(sh, a, b, ch)
        if chap_style == "dip":  # after a dip to black each chapter fades in
            for ch in chapters:
                fs = next((x for x in shots if abs(x["start"] - ch["body"]) < 1e-3), None)
                if fs and not fs.get("fade"): fs["fade"] = 0.5
        # cards and outro become shots too, so the picture is one list
        first_of = lambda ch: next((s for s in shots if s["start"] >= ch["body"] - 1e-3 and s.get("file")), None)
        for ch in chapters:
            fs = first_of(ch)
            kick = cc.get("kicker", "CHAPTER {n:02d}").format(n=ch["n"], total=len(chapters))
            shots.append({"type": "chapter", "start": ch["card"], "end": ch["body"], "n": ch["n"], "title": ch["title"], "kicker": kick, "style": chap_style,
                          "bg": fs["file"] if fs else None, "bgIsImg": bool(fs and fs["type"] == "photo"), "fade": 0.0 if chap_style == "dip" else 0.3})
        tc = E.get("titleCard", {})
        fs = first_of(chapters[0]) if chapters else None
        bgsrc = self.make_shot(tc["bg"], title_at, title_at + title_dur, None)[0] if tc.get("bg") else None
        shots.append({"type": "title", "start": title_at, "end": round(title_at + title_dur, 3), "kicker": tc.get("kicker", ""),
                      "title": tc.get("title", S.get("thumbTitle", ["", ""])), "sub": tc.get("sub", ""),
                      "bg": (bgsrc or fs or {}).get("file"), "bgIsImg": (bgsrc or fs or {}).get("type") == "photo", "fade": 0.25})
        oc = E.get("outro", {})
        bg = self.make_shot(oc["bg"], outro_at, end, None)[0] if oc.get("bg") else None
        shots.append({"type": "outro", "start": outro_at, "end": end, "bg": bg, "label": oc.get("label", "다음 영상"), "fade": 0.5,
                      "boxes": oc.get("boxes", True)})
        # cold open: each pick gets the shot that is on screen when its line plays, from that moment
        for c in cold:
            L = lines[c["line"]]
            src = next((s for s in shots if s["start"] <= L["start"] + 1e-3 < s["end"] and s["type"] not in ("chapter", "title", "outro")), None)
            if not src: continue
            c_end = c["start"] + L["dur"] + E.get("coldOpen", {}).get("gap", 0.45)
            shots.append(self.reshoot(src, L["start"], c["start"], c_end))
        # the first cold-open shot starts at frame 0 (no black first frame), the last runs into the title card
        shots.sort(key=lambda s: s["start"])
        if shots and shots[0]["start"] > 0: shots[0]["start"] = 0.0
        for s0, s1 in zip(shots, shots[1:]):  # no black between shots: each runs until the next one starts
            if s0["end"] < s1["start"]: s0["end"] = s1["start"]
        self.shots = shots

        # blurred fills (behind cards, contained footage, vertical shorts, the outro) come from small pre-blurred
        # copies made here: a CSS blur over a full-size video layer costs the renderer more than the rest of the frame
        for s in shots:
            if s.get("bg") and isinstance(s["bg"], str): s["bgBlur"] = self.blurred(s["bg"])
            if s["type"] in ("footage", "photo") and s.get("fit") == "contain" and s.get("file"): s["blur"] = self.blurred(s["file"])
            if s["type"] == "short" and s.get("file"): s["blur"] = self.blurred(s["file"])
            if s["type"] == "outro" and s.get("bg") and s["bg"].get("file"): s["bg"]["blur"] = self.blurred(s["bg"]["file"])

        # 5) audio: voices, short media, music, ambience, the ducking envelope
        voice = []
        for c in cold: voice.append({"line": c["line"], "file": lines[c["line"]].get("file"), "start": c["start"], "dur": lines[c["line"]]["dur"]})
        for lid, L in lines.items():
            if "start" in L and not L.get("short") and L.get("file"):
                voice.append({"line": lid, "file": L["file"], "start": L["start"], "dur": L["dur"]})
        voice.sort(key=lambda v: v["start"])
        media = [m for L in lines.values() if L.get("short") for m in L.get("media", [])]
        for c in cold:  # a picked reused short line plays its own sound in the cold open too
            L = lines[c["line"]]
            if L.get("short"): media += [{**m, "start": round(m["start"] - L["start"] + c["start"], 3)} for m in L.get("media", [])]
        n = int(math.ceil(end * FPS)) + 1; env = np.zeros(n)
        for v in voice:
            lv = lines[v["line"]].get("level", [])
            f0 = int(round(v["start"] * FPS))
            for k, x in enumerate(lv):
                if 0 <= f0 + k < n: env[f0 + k] = max(env[f0 + k], x)
        if env.max() > 0: env = np.clip(env / (np.percentile(env[env > 0], 90) + 1e-9), 0, 1)
        sm = np.zeros_like(env)
        for i in range(1, n): sm[i] = env[i] if env[i] > sm[i - 1] else sm[i - 1] + (env[i] - sm[i - 1]) * 0.13
        for m in media:  # under a short's own sound the bed ducks as under a voice (1.0) or drops out (1.5: the short has its own music)
            for f in range(int(m["start"] * FPS), min(n, int((m["start"] + m["dur"]) * FPS))): sm[f] = max(sm[f], m["duck"])
        sfx = []
        for ch, C in zip(chapters, S["chapters"]):
            spec = E.get("chapters", {}).get(C["id"], {})
            for c_ in spec.get("musicCuts", []):  # the bed stops dead before a twist, then comes back over 0.5 s
                a = self.at(c_["at"], ch); d = c_.get("dur", 1.0)
                for f in range(int(a * FPS), min(n, int((a + d + 0.5) * FPS))):
                    sm[f] = max(sm[f], 1.5 if f < (a + d) * FPS else 1.5 * (1 - (f / FPS - a - d) / 0.5))
            for a, name, g in spec.get("sfx", []):
                if not os.path.exists(f"{V}/public/sfx/{name}.wav"): self.warn.append(f"sfx {name}.wav not in public/sfx (run fetch.sh)")
                sfx.append({"t": self.at(a, ch), "file": f"sfx/{name}.wav", "gain": g})
        self.music = self.music_plan(chapters, cold_end, title_at + title_dur, outro_at, end)
        self.amb = self.amb_plan(chapters)

        # 6) captions
        pages = []
        if E.get("captions", True):
            for c in cold: pages += self.pages_of(lines[c["line"]], c["start"], top=False)
            for lid, L in lines.items():
                if "start" in L: pages += self.pages_of(L, L["start"], top=L.get("chapter") is None)
            pages.sort(key=lambda p: p["startMs"])
            for i in range(len(pages) - 1):
                pages[i]["endMs"] = min(pages[i]["endMs"], pages[i + 1]["startMs"])

        data = {
            "id": self.id, "end": end, "fps": FPS, "captions": bool(E.get("captions", True)), "credit": E.get("credit", ""),
            "captionSize": E.get("captionSize", 56), "watermark": E.get("watermark", ""),
            "chapters": chapters, "coldOpen": {"end": cold_end}, "outro": {"start": outro_at},
            "shots": [{k: v for k, v in s.items() if not k.startswith("_")} for s in shots],
            "voice": [{k: v[k] for k in ("file", "start", "dur")} for v in voice if v["file"]], "media": media,
            "music": self.music, "musicDuck": E.get("music", {}).get("duck", 0.6), "amb": self.amb,
            "env": [int(round(min(1.5, float(x)) * 60)) for x in sm[::3]],  # 10 per second, 0..90 (90 = a short's own sound)
            "pages": pages, "thumb": self.thumb(), "sfx": sorted(sfx, key=lambda x: x["t"]),
            "pauses": [{"start": L["start"], "dur": L["dur"]} for L in lines.values() if "pause" in L and "start" in L],
            "dim": E.get("dim", 0.3 if self.sleep else 0.0),
        }
        os.makedirs(f"{V}/src/longdata", exist_ok=True)
        json.dump(data, open(f"{V}/src/longdata/{self.id}.json", "w"), ensure_ascii=False, separators=(",", ":"))
        self.write_index()
        self.write_spec(data)
        nar = [L for L in lines.values() if L.get("syl")]
        sps = sum(L["syl"] for L in nar) / max(1e-6, sum(L["dur"] for L in nar))
        if not 5.5 <= sps <= 6.5: self.warn.append(f"narration runs {sps:.2f} syllables/s (long-form narration is usually 5.5-6.5)")
        print(f"prep {self.id}: {fmt_ts(end)} ({end:.1f} s), {len(chapters)} chapters, {len(lines)} lines, {len(shots)} shots, "
              f"{len(pages)} caption pages, {sps:.2f} syl/s at rate {self.rate}")
        for w in dict.fromkeys(self.warn): print("  WARN", w)

    def at(self, a, ch):
        if isinstance(a, (int, float)): return ch["body"] + float(a) if ch else float(a)
        m = re.match(r"^([^.@+-]+)(?:\.([^@+-]+))?(@end)?([+-][\d.]+)?$", a)
        if not m: sys.exit(f"bad anchor {a}")
        lid, word, endf, off = m.groups()
        L = self.lines.get(lid)
        if not L or "start" not in L: sys.exit(f"anchor {a}: no line {lid}")
        if word:
            k = L.get("chars", "").find(spoken_form(word))
            if k < 0: sys.exit(f"anchor {a}: '{word}' is not spoken in {lid}")
            tt = L["start"] + L["ct"][k]
        else:
            tt = L["start"] + (L["dur"] if endf else 0.0)
        return round(tt + float(off or 0), 3)

    def rel_at(self, a, start, ch):
        return round(self.at(a, ch) - start, 3) if a is not None else None

    def credit_of(self, sh, src=None):
        return sh.get("credit") or (src or {}).get("credit") or self.E.get("credit", "")

    def make_shot(self, sh, a, b, ch):
        """one edit.json shot over [a, b) -> one or more resolved shots"""
        ty = sh.get("type", "footage"); skip = sh.get("_skip", 0.0)
        base = {"type": ty, "start": round(a, 3), "end": round(b, 3), "fade": sh.get("fade", 1.0 if self.sleep else 0.0), "lower": sh.get("lower"), "t0": round(skip, 3),
                **({"badge": sh["badge"]} if sh.get("badge") else {})}
        if ty == "footage":
            s = self.source(sh["src"]); p = self.src_path(s["file"])
            speed = sh.get("speed", 1.0); t_in = sh.get("in", 0.0) + skip * speed
            if not p: self.warn.append(f"missing source file {s['file']} (placeholder shown)"); return [{**base, "file": None, "label": s.get("label", sh["src"]), "credit": self.credit_of(sh, s)}]
            f, w, hh = self.cut(p, t_in, b - a, speed)
            return [{**base, "t0": 0, "file": f, "w": w, "h": hh, "speed": speed, "crop": sh.get("crop"), "push": sh.get("push", [1.0, 1.06]),
                     "fit": sh.get("fit", "cover" if w / hh > 1.5 else "contain"), "credit": self.credit_of(sh, s), "label": s.get("label", "")}]
        if ty == "photo":
            s = self.source(sh["src"]); p = self.src_path(s["file"])
            if not p: self.warn.append(f"missing source file {s['file']}"); return [{**base, "type": "footage", "file": None, "label": s.get("label", ""), "credit": self.credit_of(sh, s)}]
            f, w, hh = self.still(p, sh.get("time", s.get("time")))
            return [{**base, "file": f, "w": w, "h": hh, "kb": sh.get("kb", {"from": [0.5, 0.5, 1.0], "to": [0.5, 0.5, 1.12]}),
                     "fit": sh.get("fit", "cover"), "credit": self.credit_of(sh, s)}]
        if ty == "scene":
            g = {k: v for k, v in sh.items() if k not in ("type", "at", "fade", "credit", "lower", "_skip")}
            for k in ("turn", "propAt", "bigAt"):
                if k in g: g[k] = self.rel_at(g[k], a, ch)
            says = []
            for s_ in g.pop("says", []):
                L = self.lines.get(s_.get("line")) if s_.get("line") else None
                text = s_.get("text") or (L and L.get("text")) or ""
                at = self.rel_at(s_["at"], a, ch) if "at" in s_ else (round(L["start"] - a, 3) if L else 0.0)
                says.append({"who": s_.get("who", 0), "text": text.replace("/", " "), "at": at, "to": self.rel_at(s_.get("to"), a, ch) if s_.get("to") else None})
            g["says"] = says
            if g.get("chat"):
                g["chat"] = {**g["chat"], "msgs": [{**m, "at": self.rel_at(m.get("at"), a, ch)} for m in g["chat"]["msgs"]]}
            if g.get("photo"):
                s = self.source(g["photo"]); p = self.src_path(s["file"])
                g["photo"] = self.still(p, s.get("time"))[0] if p else None
                base["credit"] = self.credit_of(sh, s)
            return [{**base, "g": g, "credit": base.get("credit") or sh.get("credit", "")}]
        if ty == "post":
            g = {k: v for k, v in sh.items() if k not in ("type", "at", "fade", "credit", "lower", "_skip")}
            if "steps" in g: g["steps"] = [self.rel_at(x, a, ch) if not isinstance(x, (int, float)) else x for x in g["steps"]]
            return [{**base, "g": g, "credit": sh.get("credit", "")}]
        if ty == "card":
            out = {**base, "credit": sh.get("credit", ""), **{k: v for k, v in sh.items() if k not in ("type", "at", "fade", "_skip")}}
            if sh.get("bg"):
                bgs = self.make_shot({"type": "footage", "src": sh["bg"], "in": sh.get("bgIn", 0)}, a, b, ch)[0] if self.source(sh["bg"])["file"].endswith(".mp4") \
                    else self.make_shot({"type": "photo", "src": sh["bg"]}, a, b, ch)[0]
                out["bg"] = bgs.get("file"); out["bgIsImg"] = bgs["type"] == "photo"; out["credit"] = bgs.get("credit")
            for k in ("revealAt", "zoomAt", "circleAt"):
                if k in sh: out[k] = self.rel_at(sh[k], a, ch) if not isinstance(sh[k], (int, float)) else sh[k]
            if "steps" in sh: out["steps"] = [self.rel_at(x, a, ch) if not isinstance(x, (int, float)) else x for x in sh["steps"]]
            if sh.get("kind") == "map":
                out["dots"] = [{**d, **({"at": self.rel_at(d["at"], a, ch)} if isinstance(d.get("at"), str) else {})} for d in sh.get("dots", [])]
                out["arrows"] = [{**d, **({"at": self.rel_at(d["at"], a, ch)} if isinstance(d.get("at"), str) else {})} for d in sh.get("arrows", [])]
            return [out]
        if ty == "relayout":
            return self.relayout(sh, a, b, ch, base)
        if ty == "short":  # a reused vertical short (final/<id>.mp4) over a blurred fill, with its own sound
            return [{**base, "file": sh["file"], "t0": round(sh.get("from", 0.0) + skip, 3), "credit": sh.get("credit", ""), "fade": sh.get("fade", 0.3)}]
        sys.exit(f"unknown shot type {ty}")

    def reshoot(self, s, t_from, a, b):
        """a copy of shot s as seen from main-timeline time t_from, placed at [a, b) (cold open)"""
        off = t_from - s["start"]
        c = {**s, "start": round(a, 3), "end": round(b, 3), "fade": 0.35 if a > 0.3 else 0.0}
        if s["type"] == "footage" and s.get("file"):
            src = os.path.join(f"{V}/public", s["file"])
            # cut a fresh working copy from the working copy (its own in-point), long enough for the pick
            f, w, hh = self.cut(src, off * s.get("speed", 1.0), b - a, 1.0)
            c.update({"file": f, "speed": 1.0, "t0": 0})
        elif s["type"] == "short" and s.get("file"):
            c["t0"] = round(s.get("t0", 0) + off, 3)
        else:
            c["t0"] = round(s.get("t0", 0) + off, 3)
        return c

    def relayout(self, sh, a, b, ch, base):
        """a short's own cut list shown full-frame in 16:9: politics-style "segments" or a prepped short's clips"""
        sid = sh["short"]; parts = []
        pe = f"{V}/politics/{sid}/edit.json"; se = f"{V}/src/data/{sid}.json"
        if os.path.exists(pe) and json.load(open(pe)).get("segments"):
            ed = json.load(open(pe))
            for sg in ed["segments"]:
                p = self.src_path(sg.get("src", ed.get("src")))
                if not p: p = next((x for x in (f"{MEDIA}/{sg.get('src', ed.get('src'))}",) if os.path.exists(x)), None)
                sp = sg.get("speed", 1.0)
                parts.append({"path": p, "in": sg["in"], "dur": (sg["out"] - sg["in"]) / sp, "speed": sp, "credit": sg.get("credit") or ed.get("credit", ""),
                              "lower": (f"{sg['rank']['n']}위 · {sg['rank']['label']}" if sg.get("rank") else sg.get("label")), "rank": sg.get("rank")})
        elif os.path.exists(se):
            d = json.load(open(se))
            for c in d["clips"]:
                p = f"{V}/public/{c['file']}" if c.get("file") else None
                parts.append({"path": p, "in": 0.0, "dur": c["dur"], "speed": c.get("speed", 1.0), "credit": c.get("credit") or d.get("credit", ""), "lower": None,
                              "gfx": c.get("gfx")})
        else:
            sys.exit(f"relayout {sid}: needs politics/{sid}/edit.json segments or a prepped src/data/{sid}.json")
        if sh.get("parts"): parts = [parts[i] for i in sh["parts"]]
        out, t, k = [], a, 0
        keep_rank = None
        skip = sh.get("_skip", 0.0)
        while t < b - 1e-3 and parts:
            pt = parts[k % len(parts)]; k += 1
            d = min(pt["dur"], b - t)
            if skip >= pt["dur"]: skip -= pt["dur"]; continue
            if pt.get("rank"): keep_rank = pt["lower"]
            lower = pt["lower"] or keep_rank
            g = pt.get("gfx")
            if g and g.get("type") in ("scene", "post"):  # a drawn 썰 beat: acted again on the 16:9 stage, not cropped from the vertical frame
                out.append({**base, **self.scene_of_gfx(g), "start": round(t, 3), "end": round(t + d - skip, 3), "t0": round(skip, 3),
                            "fade": sh.get("fade", 0.0) if not out else sh.get("cutFade", 0.0), "credit": "", "lower": None})
                t += d - skip; skip = 0.0; continue
            if pt["path"] and os.path.exists(pt["path"]):
                f, w, hh = self.cut(pt["path"], pt["in"] + skip * pt["speed"], d - skip, pt["speed"])
            else:
                f, w, hh = None, 1920, 1080; self.warn.append(f"relayout {sid}: missing clip {pt['path']}")
            out.append({**base, "type": "footage", "start": round(t, 3), "end": round(t + d - skip, 3), "t0": 0, "file": f, "w": w, "h": hh,
                        "speed": pt["speed"], "fit": "cover" if w / hh > 1.5 else "contain", "push": sh.get("push", [1.0, 1.05]),
                        "fade": sh.get("fade", 0.0) if not out else sh.get("cutFade", 0.0), "credit": pt["credit"] or self.E.get("credit", ""),
                        "lower": lower if sh.get("lowerThirds", True) else base.get("lower"), "label": ""})
            t += d - skip; skip = 0.0
        return out

    @staticmethod
    def scene_of_gfx(g):
        """a short's scene/post graphic (lib/Gfx.tsx, times in steps) as a long-form scene/post shot"""
        st = g.get("steps") or []
        at = lambda i, dflt: st[i] if len(st) > i and st[i] is not None else dflt
        if g["type"] == "post":
            return {"type": "post", "g": {k: v for k, v in g.items() if k != "type"}}
        sc = {k: g[k] for k in ("bg", "sign", "place", "photo", "chars", "prop", "propX", "big", "bigSize", "card", "zoom", "focus") if k in g}
        sc["says"] = [{"who": g["say"]["who"], "text": g["say"]["text"], "at": at(0, 0.05)}] if g.get("say") else []
        sc["propAt"], sc["bigAt"] = at(1, 0.1), at(3, 0.1)
        sc["turn"] = at(2, None) if any(c.get("to") for c in g.get("chars", [])) else None
        if g.get("chat"):
            sc["chat"] = {**g["chat"], "msgs": [{**m, "at": at(4 + i, 0.15 + 0.45 * i)} for i, m in enumerate(g["chat"]["msgs"])]}
        return {"type": "scene", "g": sc}

    def short_line(self, L):
        """a script line that plays a reused short with its own sound: vertical (final/<id>.mp4 over a blurred fill)
        or relayout (a prepped short's clips full-frame, its voice and captions)"""
        sid, mode = L["short"], L.get("mode", "vertical")
        if mode == "vertical":
            p = f"{V}/final/{sid}.mp4"
            if not os.path.exists(p): sys.exit(f"reused short {sid}: no final/{sid}.mp4")
            _, _, dur, _ = probe(p)
            t0, t1 = L.get("from", 0.0), L.get("to", dur)
            out = f"{self.pub}/shorts/{sid}.mp4"
            if not os.path.exists(out) or os.path.getmtime(out) < os.path.getmtime(p): shutil.copy(p, out)
            f = f"{self.rel}/shorts/{sid}.mp4"; d = round(t1 - t0 - 0.04, 3)
            return {"dur": d, "shot": {"type": "short", "file": f, "from": t0, "credit": L.get("credit", "")},
                    "_media": [{"file": f, "at": 0.0, "dur": d, "from": t0, "gain": L.get("gain", 1.0), "duck": 1.5}]}
        if mode == "relayout":
            d = json.load(open(f"{V}/src/data/{sid}.json"))
            return {"dur": d["end"], "shot": {"type": "relayout", "short": sid, "lowerThirds": False}, "_ownShort": d,
                    "_media": [{"file": f"{sid}/voice/{x['id']}.wav", "at": x["start"], "dur": x["dur"], "from": 0.0, "gain": L.get("gain", 1.0), "duck": 1.0} for x in d["lines"]]}
        sys.exit(f"short line {L['id']}: mode {mode}?")

    @staticmethod
    def short_edit(sid):
        for p in (f"{V}/shorts/{sid}/edit.json", f"{V}/politics/{sid}/edit.json"):
            if os.path.exists(p): return json.load(open(p))
        return {}

    def music_plan(self, chapters, cold_end, title_end, outro_at, end):
        """one bed per stretch (cold open + title, each chapter from its card, the outro); the same track on
        neighbouring stretches keeps playing, a new one crossfades in over `xfade` seconds"""
        E = self.E; mc = E.get("music", {}); gain = mc.get("gain", 0.18 if self.sleep else 0.25); xf = mc.get("xfade", 3.0 if self.sleep else 1.5)
        spans = []
        first = next((E.get("chapters", {}).get(C["id"], {}).get("music") for C in self.S["chapters"] if E.get("chapters", {}).get(C["id"], {}).get("music")), None)
        if title_end > 0: spans.append((0.0, title_end, E.get("coldOpen", {}).get("music") or first))
        for ch, C in zip(chapters, self.S["chapters"]):
            spans.append((ch["card"], ch["end"], E.get("chapters", {}).get(C["id"], {}).get("music") or (spans[-1][2] if spans else first)))
        spans.append((outro_at, end, E.get("outro", {}).get("music") or (spans[-1][2] if spans else first)))
        segs = []
        for a, b, spec in spans:
            if not spec: continue
            if isinstance(spec, str): spec = {"track": spec}
            f = f"music/{spec['track']}.mp3"
            if not os.path.exists(f"{V}/public/{f}"): self.warn.append(f"music {f} not found (run fetch.sh and longform/fetch_long.sh)")
            if segs and segs[-1]["file"] == f and abs(segs[-1]["end"] - a) < 0.01 and not spec.get("restart"):
                segs[-1]["end"] = round(b, 3); continue
            segs.append({"file": f, "start": round(a, 3), "end": round(b, 3), "from": spec.get("from", 0.0), "gain": spec.get("gain", gain), "xfade": xf})
        self.music_tracks = sorted({s["file"][6:-4] for s in segs})
        return segs

    def amb_plan(self, chapters):
        out = []
        for ch, C in zip(chapters, self.S["chapters"]):
            a = self.E.get("chapters", {}).get(C["id"], {}).get("ambience")
            if not a: continue
            if isinstance(a, str): a = {"name": a}
            out.append({"file": f"amb/{a['name']}.wav", "start": ch["card"], "end": ch["end"], "gain": a.get("gain", 0.25)})
        return out

    def pages_of(self, L, start, top):
        if L.get("cap") is False or L.get("short") and not L.get("_ownShort"): return []
        if L.get("_ownShort"):
            d = L["_ownShort"]; out = []
            for p in d["pages"]:
                toks = [{"text": tk["text"], "key": tk.get("key", False)} for tk in p["tokens"]]
                out.append({"startMs": round(start * 1000 + p["startMs"]), "endMs": round(start * 1000 + p["endMs"]),
                            "lines": [toks] if clen(toks) <= self.max_chars else split_lines(toks, self.max_chars), "top": top})
            return out
        words = words_of(L.get("text", ""))
        pages = paginate(words, self.max_chars)
        flat = [w for p in pages for line in p for w in line]
        cap_chars, owner = [], []
        for wi, w in enumerate(flat):
            for c in spoken_form(w["text"]): cap_chars.append(c); owner.append(wi)
        first = [None] * len(flat)
        for blk in difflib.SequenceMatcher(a=cap_chars, b=list(L["chars"]), autojunk=False).get_matching_blocks():
            for k in range(blk.size):
                wi = owner[blk.a + k]; first[wi] = blk.b + k if first[wi] is None else min(first[wi], blk.b + k)
        times = []
        for wi in range(len(flat)):
            ts = L["ct"][first[wi]] if first[wi] is not None else None
            if ts is None:
                nxt = next((L["ct"][first[j]] for j in range(wi + 1, len(flat)) if first[j] is not None), L["dur"])
                ts = (times[-1] + nxt) / 2 if times else 0.0
            times.append(max(ts, times[-1] + 0.05) if times else 0.0)
        out, wi = [], 0
        for p in pages:
            n = sum(len(line) for line in p)
            out.append({"startMs": round((start + (times[wi] if wi else 0.0)) * 1000) - (0 if wi else 80), "lines": [[{k: w[k] for k in ("text", "key", "red") if k in w} for w in line] for line in p], "top": top})
            wi += n
        for i, p in enumerate(out):
            p["endMs"] = out[i + 1]["startMs"] if i + 1 < len(out) else round((start + L["dur"] + 0.25) * 1000)
        return out

    def thumb(self):
        th = self.E.get("thumb")
        if not th: return None
        out = {k: v for k, v in th.items() if k not in ("src",)}
        if th.get("src"):
            s = self.source(th["src"]); p = self.src_path(s["file"])
            if p: out["img"] = self.still(p, th.get("time", s.get("time")))[0]
        return out

    def write_index(self):
        ids = sorted(f[:-5] for f in os.listdir(f"{V}/src/longdata") if f.endswith(".json"))
        with open(f"{V}/src/longdata/index.ts", "w") as f:
            f.write("// generated by longform/prep_long.py: every prepared long-form (longform/<id>/ -> src/longdata/<id>.json)\n")
            f.write("import type { LongData } from \"../lib/long/types\";\n")
            for i in ids: f.write(f"import {re.sub(r'[^A-Za-z0-9_]', '_', i)} from \"./{i}.json\";\n")
            f.write("export const LONGDATA = [" + ", ".join(re.sub(r"[^A-Za-z0-9_]", "_", i) for i in ids) + "] as unknown as LongData[];\n")

    def write_spec(self, data):
        """the YouTube chapters (and the music credits) go into upload/specs/<id>.json, which upload/make_desc.py turns
        into the description in the channels' common format; other keys of an existing spec are left alone"""
        S, E = self.S, self.E
        stamps = [(0.0, E.get("introTitle", "인트로"))] + [(c["card"], c["title"]) for c in data["chapters"]]
        for (a, _), (b, t) in zip(stamps, stamps[1:] + [(data["end"], "")]):
            if b - a < 10: self.warn.append(f"chapter at {fmt_ts(a)} is {b - a:.1f} s (YouTube needs 10 s)")
        if len(stamps) < 3: self.warn.append("YouTube needs at least 3 chapters")
        # a reused vertical short plays with its own bed, which needs its credit too
        for L in self.lines.values():
            if L.get("short") and L.get("mode", "vertical") == "vertical":
                m = self.short_edit(L["short"]).get("music")
                for f in ([m["file"]] if isinstance(m, dict) else [x.get("src", "") for x in m] if isinstance(m, list) else []):
                    if "/music/" in "/" + f: self.music_tracks = sorted(set(self.music_tracks) | {os.path.splitext(os.path.basename(f))[0]})
        path = f"{V}/upload/specs/{self.id}.json"
        spec = json.load(open(path)) if os.path.exists(path) else {}
        if not spec:  # a new spec: placeholders for what a person writes, and the sources prep already knows
            srcs = [s_["desc"] for s_ in E.get("sources", {}).values() if s_.get("desc")]
            if any(s_["type"] == "card" and s_.get("kind") == "map" for s_ in self.shots): srcs.append("지도: Natural Earth")
            if any(s_["type"] in ("scene", "post") for s_ in self.shots): srcs.append("그림·캐릭터 직접 제작")
            spec = {"title": S.get("title") or "[제목]", "summary": "[요약 2~4문장, 60~320자]", "tags": ["[태그]"], "sources": srcs or ["[출처]"], "long": True}
            if any(s_["type"] in ("scene", "post") for s_ in self.shots) and E.get("description", {}).get("fiction", True): spec["fiction"] = True
        spec["chapters"] = [[fmt_ts(a), t] for a, t in stamps]
        spec["music"] = self.music_tracks  # the beds are per chapter in edit.json, so prep lists the resolved titles here
        os.makedirs(os.path.dirname(path), exist_ok=True)
        json.dump(spec, open(path, "w"), ensure_ascii=False, indent=1); open(path, "a").write("\n")

if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args: sys.exit(__doc__)
    for lid in args:
        Long(lid, no_tts="--no-tts" in sys.argv).prep()
