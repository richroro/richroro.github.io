"""lfsaeyeon1: write script.json from story.py and read it with Edge TTS, one voice per character.

script.json is the shorts' format (voice_edge.py): lines of {id, voice, say ("|" splits caption pages), cap, gap},
plus "voices" ({edge, rate, pitch} per character). Narration gets bottom-caption pages; dialogue lines have
"cap": [""] because their words are in the speech bubble.

The voice pass works like voice_edge.py (per-syllable times from Edge's word boundaries), but for a long-form:
it writes build/lfsaeyeon1/voice/<line>.wav and build/lfsaeyeon1/timeline.json, caches each line by its text and
voice, and puts longer pauses where a scene or chapter turns.

usage: python3 longform/lfsaeyeon1/voice.py [--script-only] [--voices cast.json]
--voices replaces entries of VOICES from a JSON file for this run (A/B; script.json keeps the cast it was written with).
VOICE_ENGINE=azure reads the Edge voices with the same-named Azure voices.
An entry with "engine" (README "음성 v2") is read by voice_engine.py (cached in build/tts_cache/, word times aligned).
"""
import asyncio, difflib, hashlib, json, os, re, subprocess, sys, wave
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
import story

SID = "lfsaeyeon1"
TITLE_GAP = 3.6
VOICES = {
    # 지은's narration: calm, a touch quicker than neutral (research: +3~+5% for a long-form narrator)
    "nar": {"edge": "ko-KR-SunHiNeural", "rate": "+4%", "pitch": "+0Hz"},
    # 지은 speaking in a scene: the same woman, brighter and quicker than her narration
    "me": {"edge": "ko-KR-SunHiNeural", "rate": "+7%", "pitch": "+7Hz"},
    # 도윤: a soft, low young man who talks little
    "hus": {"edge": "ko-KR-HyunsuMultilingualNeural", "rate": "+0%", "pitch": "-5Hz"},
    # 어머님: slow and low
    "mom": {"edge": "ko-KR-SunHiNeural", "rate": "-12%", "pitch": "-20Hz"},
    # 형님: quick and high, tired but chatty
    "sis": {"edge": "ko-KR-SunHiNeural", "rate": "+12%", "pitch": "+16Hz"},
}
KEEP = re.compile(r"[가-힣A-Za-z0-9]")
chars = lambda s: [c for c in s if KEEP.match(c)]

def pages(text, limit=24):
    """split a narration line into caption pages at sentence and clause ends, each at most ~limit characters"""
    parts = re.findall(r"[^.?!,…]+[.?!,…]*\s*", text)
    out = []
    for p in parts:
        p = p.strip()
        if not p:
            continue
        if out and len(out[-1]) + len(p) + 1 <= limit and not re.search(r"[.?!]$", out[-1]):
            out[-1] += " " + p
        else:
            out.append(p)
    # a page longer than the limit is split at its middle space
    res = []
    for p in out:
        while len(p) > limit + 4 and " " in p:
            sp = [m.start() for m in re.finditer(" ", p)]
            cut = min(sp, key=lambda k: abs(k - len(p) / 2))
            res.append(p[:cut]); p = p[cut + 1:]
        res.append(p)
    return res

def script():
    lines, prev_voice = [], None
    for i, (voice, text, sc) in enumerate(story.B):
        gap = 0.28 if voice != "nar" and prev_voice not in (None, "nar") else 0.42
        if sc is None:
            gap = 0.22
        if sc and sc.get("ch") is not None and i:
            gap = 0.9
        if sc and sc.get("card"):
            gap = 0.7
        if sc and sc.get("ch") == 1:
            gap = TITLE_GAP  # the series/title card between the cold open and the story
        if i and story.B[i - 1][2] and story.B[i - 1][2].get("quiet"):
            gap = 1.4  # the beat of silence before the dawn kitchen
        if voice == "nar":
            caps = pages(text)
            say = "|".join(caps)
        else:
            caps, say = [""], text
        L = {"id": f"l{i:03d}", "voice": voice, "say": say, "cap": caps, "gap": gap}
        lines.append(L)
        prev_voice = voice
    S = {"title": "반찬통에 이름 써 붙이는 남편과 각방 쓴 사연", "voices": VOICES, "lines": lines, "tail": 2.0}
    json.dump(S, open(f"{HERE}/script.json", "w"), ensure_ascii=False, indent=1)
    return S

SR = 44100

async def synth(text, v):
    import edge_tts, ssl, edge_tts.communicate as etc
    ca = os.environ.get("SSL_CERT_FILE")  # edge-tts trusts only certifi's bundle; behind a TLS-inspecting proxy use the system's
    if ca and os.path.exists(ca) and hasattr(etc, "_SSL_CTX"): etc._SSL_CTX = ssl.create_default_context(cafile=ca)
    com = edge_tts.Communicate(text, v["edge"], rate=v.get("rate", "+0%"), pitch=v.get("pitch", "+0Hz"), boundary="WordBoundary", proxy=os.environ.get("HTTPS_PROXY") or None)
    audio, words = bytearray(), []
    async for ch in com.stream():
        if ch["type"] == "audio":
            audio += ch["data"]
        elif ch["type"] == "WordBoundary":
            words.append((ch["offset"] / 1e7, ch["duration"] / 1e7, ch["text"]))
    return bytes(audio), words

def decode(mp3):
    import numpy as np
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", "pipe:0", "-ac", "1", "-ar", str(SR), "-f", "s16le", "pipe:1"], input=mp3, stdout=subprocess.PIPE, check=True).stdout
    return np.frombuffer(pcm, np.int16).astype(np.float32) / 32768

def trim(x, words, thr_db=-46, pad_a=0.05, pad_b=0.10):
    import numpy as np
    env = np.convolve(np.abs(x), np.ones(441) / 441, mode="same")
    idx = np.where(env > env.max() * 10 ** (thr_db / 20))[0]
    a = max(0, idx[0] - int(pad_a * SR)); b = min(len(x), idx[-1] + int(pad_b * SR))
    y = x[a:b].copy(); fa, fb = int(0.008 * SR), int(0.02 * SR)
    y[:fa] *= np.linspace(0, 1, fa); y[-fb:] *= np.linspace(1, 0, fb)
    return y, [(t0 - a / SR, d, w) for t0, d, w in words]

def write(path, x):
    import numpy as np
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())

def main():
    S = script()
    if "--voices" in sys.argv:  # after script(): script.json keeps the cast it was written with
        VOICES.update(json.load(open(sys.argv[sys.argv.index("--voices") + 1])))
    if os.environ.get("VOICE_ENGINE", "edge") != "edge":  # VOICE_ENGINE=azure: the same voice names on Azure
        for r, v in VOICES.items():
            if v.get("engine", "edge") == "edge": VOICES[r] = dict(v, engine=os.environ["VOICE_ENGINE"])
    if "--script-only" in sys.argv:
        print(len(S["lines"]), "lines"); return
    out = f"{ROOT}/build/{SID}"; cache = f"{out}/cache"
    os.makedirs(f"{out}/voice", exist_ok=True); os.makedirs(cache, exist_ok=True)
    tl = {"title": S["title"], "lines": [], "fps": 30}
    t = 0.0
    for L in S["lines"]:
        v = VOICES[L["voice"]]; spoken = L["say"].replace("|", "")
        key = hashlib.sha1(json.dumps([spoken, v], ensure_ascii=False).encode()).hexdigest()[:16]
        if v.get("engine", "edge") != "edge" or v.get("post") or v.get("tempo") or v.get("sps"):  # 음성 v2: voice_engine.py reads, trims, aligns
            sys.path.insert(0, ROOT); import voice_engine
            x, words = voice_engine.synth(spoken if v.get("engine", "edge") == "edge" else voice_engine.ko_text(spoken), v)
        elif not os.path.exists(f"{cache}/{key}.json"):
            for attempt in range(4):
                try:
                    mp3, words = asyncio.run(synth(spoken, v)); break
                except Exception as e:  # the service drops a connection now and then
                    print("retry", L["id"], e); import time; time.sleep(2 ** attempt)
            open(f"{cache}/{key}.mp3", "wb").write(mp3); json.dump(words, open(f"{cache}/{key}.json", "w"))
        if not (v.get("engine", "edge") != "edge" or v.get("post") or v.get("tempo") or v.get("sps")):
            x = decode(open(f"{cache}/{key}.mp3", "rb").read()); words = json.load(open(f"{cache}/{key}.json"))
            x, words = trim(x, words)
        dur = len(x) / SR
        rec = [(c, t0 + d * k / max(1, len(chars(w)))) for t0, d, w in words for k, c in enumerate(chars(w))]
        sc = chars(spoken); times = [None] * len(sc)
        for blk in difflib.SequenceMatcher(a=sc, b=[c for c, _ in rec], autojunk=False).get_matching_blocks():
            for k in range(blk.size):
                times[blk.a + k] = rec[blk.b + k][1]
        for i in range(len(sc)):
            if times[i] is None:
                prev = next((times[j] for j in range(i - 1, -1, -1) if times[j] is not None), 0.0)
                nxt = next((times[j] for j in range(i + 1, len(sc)) if times[j] is not None), dur)
                times[i] = (prev + nxt) / 2
        segs, pos = [], 0
        for seg in L["say"].split("|"):
            segs.append(times[pos] if pos < len(times) else dur); pos += len(chars(seg))
        seg_t = [0.0] + [max(0.0, s - 0.06) for s in segs[1:]]
        chunks = [{"t0": round(seg_t[i], 3), "t1": round(seg_t[i + 1] if i + 1 < len(seg_t) else dur, 3), "text": L["cap"][i]} for i in range(len(seg_t))]
        t += L["gap"]
        write(f"{out}/voice/{L['id']}.wav", x)
        tl["lines"].append({"id": L["id"], "voice": L["voice"], "start": round(t, 3), "dur": round(dur, 3), "wav": f"voice/{L['id']}.wav", "chunks": chunks})
        t += dur
    tl["end"] = round(t + S["tail"], 3)
    json.dump(tl, open(f"{out}/timeline.json", "w"), ensure_ascii=False, indent=1)
    print(len(tl["lines"]), "lines, voice ends at", round(t, 1), "s")

if __name__ == "__main__":
    main()
