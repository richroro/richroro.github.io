"""Read every script line with Microsoft Edge's Korean neural voice (edge-tts) and write what
tools/build_voice.py writes: voice/<id>.wav plus timeline.json, with per-syllable times taken from
Edge's word boundaries instead of a speech recognizer.

usage: python3 voice_edge.py <id> [voice] [rate]     reads shorts/<id>/script.json, writes build/<id>/
The voice and rate default to the script's "voices.nar" entry. A line's "voice" picks another entry of "voices"
({"edge", "rate", "pitch"}), so a story can give its characters their own voices. Needs network access to
speech.platform.bing.com.
"""
import asyncio, difflib, io, json, os, re, subprocess, sys, wave
import numpy as np
import edge_tts

HERE = os.path.dirname(os.path.abspath(__file__))
sid = sys.argv[1]
out = f"{HERE}/build/{sid}"
S = json.load(open(f"{HERE}/shorts/{sid}/script.json"))
nar = S.get("voices", {}).get("nar", {})
VOICE = sys.argv[2] if len(sys.argv) > 2 else nar.get("edge", "ko-KR-SunHiNeural")
RATE = sys.argv[3] if len(sys.argv) > 3 else nar.get("rate", "+8%")
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

async def synth(text, voice=None, rate=None, pitch="+0Hz"):
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
for L in S["lines"]:
    spoken = L["say"].replace("|", "")
    lv, lr, lp = voice_of(L)
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
    t += L.get("gap", 0.2)
    write(f"{out}/voice/{L['id']}.wav", x)
    timeline["lines"].append({"id": L["id"], "voice": lv, "start": round(t, 3), "dur": round(dur, 3), "wav": f"voice/{L['id']}.wav",
                              "chunks": chunks, "chars": "".join(sc), "ct": [round(v, 3) for v in times]})
    print(f"{L['id']:6s} start={t:6.2f} dur={dur:4.2f} words={len(words)}")
    t += dur
timeline["end"] = round(t + S.get("tail", 1.5), 3)
json.dump(timeline, open(f"{out}/timeline.json", "w"), ensure_ascii=False, indent=1)
print("total", timeline["end"])
