"""Read every script line with Microsoft Edge's Korean neural voice (edge-tts) and write what
tools/build_voice.py writes: voice/<id>.wav plus timeline.json, with per-syllable times taken from
Edge's word boundaries instead of a speech recognizer.

usage: python3 voice_edge.py <id> [voice] [rate] [--voices cast.json]   reads shorts/<id>/script.json, writes build/<id>/
The voice and rate default to the script's "voices.nar" entry. A line's "voice" picks another entry of "voices"
({"edge", "rate", "pitch"}), so a story can give its characters their own voices. Needs network access to
speech.platform.bing.com.
An entry with "engine" (README "음성 v2": "supertonic", "qwen", or "edge" with "post"/"tempo") is read by
voice_engine.py instead; its syllable times come from aligned word times, so timeline.json has the same fields.
--voices replaces entries of "voices" from a JSON file ({"nar": {...}, "me": {...}}) without touching the script (A/B);
its "pauses" key, like a script's own "pauses" ({"line": 0.15, "turn": 0.25, "punch": 0.45}), sets the gap before each
line: "turn" when the speaker changes, "punch" before the last line, "line" otherwise. Without it each line's "gap" counts.
"""
import asyncio, difflib, io, json, os, re, subprocess, sys, wave
import numpy as np
import edge_tts

HERE = os.path.dirname(os.path.abspath(__file__))
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
CAST = sys.argv[sys.argv.index("--voices") + 1] if "--voices" in sys.argv else None
if CAST: ARGS.remove(CAST)
sid = ARGS[0]
out = f"{HERE}/build/{sid}"
S = json.load(open(f"{HERE}/shorts/{sid}/script.json"))
if CAST:
    C = json.load(open(CAST))
    if "pauses" in C: S["pauses"] = C.pop("pauses")
    S.setdefault("voices", {}).update(C)
P = S.get("pauses")  # 음성 v2 pause rules {"line", "turn", "punch"} (s) replace the lines' own "gap"
nar = S.get("voices", {}).get("nar", {})
VOICE = ARGS[1] if len(ARGS) > 1 else nar.get("edge", "ko-KR-SunHiNeural")
RATE = ARGS[2] if len(ARGS) > 2 else nar.get("rate", "+8%")
SR = 44100
KEEP = re.compile(r"[가-힣A-Za-z0-9]")
chars = lambda s: [c for c in s if KEEP.match(c)]
os.makedirs(f"{out}/voice", exist_ok=True)

def voice_of(L):
    """(voice, rate, pitch) for a line: its own "voices" entry, else the narrator's"""
    v = S.get("voices", {}).get(L.get("voice", "nar")) if L.get("voice", "nar") != "nar" else None
    if not v:
        return VOICE, RATE, nar.get("pitch", "+0Hz")
    return v.get("edge", VOICE), v.get("rate", RATE), v.get("pitch", "+0Hz")

def entry_of(L):
    """the line's whole "voices" entry when it names another engine or a v2 option, else None (plain Edge)"""
    v = S.get("voices", {}).get(L.get("voice", "nar")) or nar
    return v if v.get("engine", "edge") != "edge" or v.get("post") or v.get("tempo") else None

async def synth(text, voice=None, rate=None, pitch="+0Hz"):
    ca = os.environ.get("SSL_CERT_FILE")  # edge-tts trusts only certifi's bundle; behind a TLS-inspecting proxy use the system's
    if ca and os.path.exists(ca):
        import ssl, edge_tts.communicate as etc
        if hasattr(etc, "_SSL_CTX"): etc._SSL_CTX = ssl.create_default_context(cafile=ca)
    com = edge_tts.Communicate(text, voice or VOICE, rate=rate or RATE, pitch=pitch, boundary="WordBoundary", proxy=os.environ.get("HTTPS_PROXY") or None)
    audio, words = bytearray(), []
    async for ch in com.stream():
        if ch["type"] == "audio":
            audio += ch["data"]
        elif ch["type"] == "WordBoundary":
            words.append((ch["offset"] / 1e7, ch["duration"] / 1e7, ch["text"]))
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", "pipe:0", "-ac", "1", "-ar", str(SR), "-f", "s16le", "pipe:1"],
                         input=bytes(audio), stdout=subprocess.PIPE, check=True).stdout
    return np.frombuffer(pcm, np.int16).astype(np.float32) / 32768, words

def trim(x, words, thr_db=-46, pad_a=0.05, pad_b=0.09):
    env = np.convolve(np.abs(x), np.ones(441) / 441, mode="same")
    idx = np.where(env > env.max() * 10 ** (thr_db / 20))[0]
    a = max(0, idx[0] - int(pad_a * SR)); b = min(len(x), idx[-1] + int(pad_b * SR))
    y = x[a:b].copy(); fa, fb = int(0.008 * SR), int(0.02 * SR)
    y[:fa] *= np.linspace(0, 1, fa); y[-fb:] *= np.linspace(1, 0, fb)
    return y, [(t0 - a / SR, d, w) for t0, d, w in words]

def write(path, x):
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())

timeline = {"title": S["title"], "lines": [], "fps": 30, "voice": VOICE, "rate": RATE}
t = 0.0
for li, L in enumerate(S["lines"]):
    spoken = L["say"].replace("|", "")
    lv, lr, lp = voice_of(L)
    ent = entry_of(L)
    if ent:  # 음성 v2 engine: voice_engine.py reads, trims and aligns (cached)
        import voice_engine
        x, words = voice_engine.synth(spoken if ent.get("engine", "edge") == "edge" else voice_engine.ko_text(spoken), ent)
        lv = ent.get("edge") or f'{ent["engine"]}:{ent.get("voice") or ent.get("speaker") or "design"}'
    else:
        x, words = asyncio.run(synth(spoken, lv, lr, lp))
        x, words = trim(x, words)
    dur = len(x) / SR
    # syllable times: each boundary word spreads its syllables over its duration, then align to the script text
    rec = [(c, t0 + d * k / max(1, len(chars(w)))) for t0, d, w in words for k, c in enumerate(chars(w))]
    sc = chars(spoken); times = [None] * len(sc)
    for blk in difflib.SequenceMatcher(a=sc, b=[c for c, _ in rec], autojunk=False).get_matching_blocks():
        for k in range(blk.size):
            times[blk.a + k] = rec[blk.b + k][1]
    for i in range(len(sc)):  # fill any gap by interpolation
        if times[i] is None:
            prev = next((times[j] for j in range(i - 1, -1, -1) if times[j] is not None), 0.0)
            nxt = next((times[j] for j in range(i + 1, len(sc)) if times[j] is not None), dur)
            times[i] = (prev + nxt) / 2
    segs, pos = [], 0
    for seg in L["say"].split("|"):
        segs.append(times[pos] if pos < len(times) else dur); pos += len(chars(seg))
    seg_t = [0.0] + [max(0.0, s - 0.06) for s in segs[1:]]
    chunks = [{"t0": round(seg_t[i], 3), "t1": round(seg_t[i + 1] if i + 1 < len(seg_t) else dur, 3), "text": L["cap"][i]} for i in range(len(seg_t))]
    if P and li:
        prev = S["lines"][li - 1].get("voice", "nar")
        t += P["punch"] if li == len(S["lines"]) - 1 else P["turn"] if prev != L.get("voice", "nar") else P["line"]
    else:
        t += L.get("gap", 0.2)
    write(f"{out}/voice/{L['id']}.wav", x)
    timeline["lines"].append({"id": L["id"], "voice": lv, "start": round(t, 3), "dur": round(dur, 3), "wav": f"voice/{L['id']}.wav",
                              "chunks": chunks, "chars": "".join(sc), "ct": [round(v, 3) for v in times]})
    print(f"{L['id']:6s} start={t:6.2f} dur={dur:4.2f} words={len(words)}")
    t += dur
timeline["end"] = round(t + S.get("tail", 1.5), 3)
json.dump(timeline, open(f"{out}/timeline.json", "w"), ensure_ascii=False, indent=1)
print("total", timeline["end"])
