"""Read every narration line of longform/odyssey/script.json with Edge TTS and write one wav per line plus
voice.json (per-line duration and word boundary times), so the edit can be timed before the render.

usage: python3 voice.py <out_dir>        needs network access to speech.platform.bing.com
Lines already synthesised (same text, voice and rate) are kept.
"""
import asyncio, json, os, subprocess, sys, wave
import numpy as np
import edge_tts

HERE = os.path.dirname(os.path.abspath(__file__))
S = json.load(open(f"{HERE}/script.json"))
OUT = sys.argv[1]
VOICE, RATE = S["voice"]["edge"], S["voice"]["rate"]
SR = 48000
os.makedirs(f"{OUT}/voice", exist_ok=True)

async def synth(text):
    com = edge_tts.Communicate(text, VOICE, rate=RATE, boundary="WordBoundary", proxy=os.environ.get("HTTPS_PROXY") or None)
    audio, words = bytearray(), []
    async for ch in com.stream():
        if ch["type"] == "audio":
            audio += ch["data"]
        elif ch["type"] == "WordBoundary":
            words.append([ch["offset"] / 1e7, ch["duration"] / 1e7, ch["text"]])
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", "pipe:0", "-ac", "1", "-ar", str(SR), "-f", "s16le", "pipe:1"],
                         input=bytes(audio), stdout=subprocess.PIPE, check=True).stdout
    return np.frombuffer(pcm, np.int16).astype(np.float32) / 32768, words

def trim(x, words, thr_db=-46, pad_a=0.04, pad_b=0.08):
    env = np.convolve(np.abs(x), np.ones(480) / 480, mode="same")
    idx = np.where(env > env.max() * 10 ** (thr_db / 20))[0]
    a = max(0, idx[0] - int(pad_a * SR)); b = min(len(x), idx[-1] + int(pad_b * SR))
    y = x[a:b].copy(); fa, fb = int(0.008 * SR), int(0.03 * SR)
    y[:fa] *= np.linspace(0, 1, fa); y[-fb:] *= np.linspace(1, 0, fb)
    return y, [[round(t0 - a / SR, 3), round(d, 3), w] for t0, d, w in words]

def write(path, x):
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())

async def main():
    old = {}
    if os.path.exists(f"{OUT}/voice.json"):
        old = {L["key"]: L for L in json.load(open(f"{OUT}/voice.json"))["lines"]}
    lines = []
    n = 0
    for ch in S["chapters"]:
        for L in ch["lines"]:
            key = f"{VOICE}|{RATE}|{L['text']}"
            name = f"l{n:03d}.wav"
            if key in old and old[key]["file"] == name and os.path.exists(f"{OUT}/voice/{name}"):
                lines.append(old[key])
            else:
                for attempt in range(4):
                    try:
                        x, words = await synth(L["text"]); break
                    except Exception as e:
                        print("retry", n, e, file=sys.stderr); await asyncio.sleep(3 * (attempt + 1))
                y, words = trim(x, words)
                write(f"{OUT}/voice/{name}", y)
                lines.append({"key": key, "file": name, "dur": round(len(y) / SR, 3), "words": words})
                print(n, round(len(y) / SR, 2), L["text"][:30], flush=True)
            n += 1
    json.dump({"voice": VOICE, "rate": RATE, "lines": lines}, open(f"{OUT}/voice.json", "w"), ensure_ascii=False, indent=0)
    print("total speech", round(sum(L["dur"] for L in lines), 1), "s,", len(lines), "lines")

asyncio.run(main())
