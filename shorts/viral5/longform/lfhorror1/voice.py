"""lfhorror1 voices: read longform/lfhorror1/script_src.txt, write script.json (lines with voice, gap, say, cap, chapter),
then speak every line with Edge TTS and write build/lfhorror1/voice/<n>.wav + build/lfhorror1/timeline.json
(the same timeline shape voice_edge.py writes: start, dur, chunks with t0/t1/text).

Each character has its own Edge voice, rate and pitch, and some get an ffmpeg filter after synthesis:
  doc   = the typed handover document and the fingerprint machine: SunHi through a small-speaker "radio" band-pass
  guest = the 3:13 customer: the narrator's own voice, darker and with a short mirror-room echo
  minho = the handwritten notes: a soft room tail so the page "speaks" from somewhere else
usage: python3 longform/lfhorror1/voice.py [--only N,N]   (needs speech.platform.bing.com)
"""
import asyncio, difflib, json, os, re, subprocess, sys, wave
import numpy as np
import edge_tts

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(f"{HERE}/../..")
OUT = f"{ROOT}/build/lfhorror1"
SR = 44100
VOICES = {
    "nar":   {"edge": "ko-KR-InJoonNeural", "rate": "+0%", "pitch": "-2Hz"},
    "doc":   {"edge": "ko-KR-SunHiNeural", "rate": "-2%", "pitch": "-4Hz",
              "fx": "highpass=f=320,lowpass=f=3300,acompressor=threshold=0.1:ratio=4,volume=1.6,aecho=0.8:0.5:22:0.18"},
    "boss":  {"edge": "ko-KR-HyunsuMultilingualNeural", "rate": "-10%", "pitch": "-16Hz"},
    "minho": {"edge": "ko-KR-HyunsuMultilingualNeural", "rate": "+2%", "pitch": "+6Hz",
              "fx": "aecho=0.8:0.6:60|110:0.22|0.12"},
    "daeri": {"edge": "ko-KR-InJoonNeural", "rate": "+6%", "pitch": "-24Hz"},
    "noona": {"edge": "ko-KR-SunHiNeural", "rate": "+9%", "pitch": "+12Hz"},
    "guest": {"edge": "ko-KR-InJoonNeural", "rate": "-12%", "pitch": "-6Hz",
              "fx": "lowpass=f=5200,aecho=0.85:0.7:38|71:0.35|0.22,volume=1.25"},
}
KEEP = re.compile(r"[가-힣A-Za-z0-9]")
chars = lambda s: [c for c in s if KEEP.match(c)]


def parse():
    lines, ch = [], None
    for raw in open(f"{HERE}/script_src.txt", encoding="utf-8"):
        raw = raw.rstrip("\n")
        if not raw.strip() or raw.startswith("# "):
            continue
        if raw.startswith("## "):
            ch = raw[3:].strip(); continue
        v, gap, text = [x.strip() for x in raw.split("|", 2)]
        cap = [c.strip() for c in text.split("/")]
        lines.append({"id": f"{len(lines):03d}", "chapter": ch, "voice": v, "gap": float(gap),
                      "say": "|".join(re.sub(r"[\[\]]", "", c) for c in cap), "cap": cap})
    return lines


async def synth(text, v):
    com = edge_tts.Communicate(text, v["edge"], rate=v["rate"], pitch=v["pitch"], boundary="WordBoundary",
                               proxy=os.environ.get("HTTPS_PROXY") or None)
    audio, words = bytearray(), []
    async for c in com.stream():
        if c["type"] == "audio":
            audio += c["data"]
        elif c["type"] == "WordBoundary":
            words.append((c["offset"] / 1e7, c["duration"] / 1e7, c["text"]))
    af = ["-af", v["fx"] + ",apad=pad_dur=0.25"] if v.get("fx") else []
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", "pipe:0", *af, "-ac", "1", "-ar", str(SR), "-f", "s16le", "pipe:1"],
                         input=bytes(audio), stdout=subprocess.PIPE, check=True).stdout
    return np.frombuffer(pcm, np.int16).astype(np.float32) / 32768, words


def trim(x, words, thr_db=-46, pad_a=0.05, pad_b=0.12):
    env = np.convolve(np.abs(x), np.ones(441) / 441, mode="same")
    idx = np.where(env > env.max() * 10 ** (thr_db / 20))[0]
    a = max(0, idx[0] - int(pad_a * SR)); b = min(len(x), idx[-1] + int(pad_b * SR))
    y = x[a:b].copy(); fa, fb = int(0.008 * SR), int(0.03 * SR)
    y[:fa] *= np.linspace(0, 1, fa); y[-fb:] *= np.linspace(1, 0, fb)
    return y, [(t0 - a / SR, d, w) for t0, d, w in words]


def write(path, x):
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())


def main():
    lines = parse()
    os.makedirs(f"{OUT}/voice", exist_ok=True)
    json.dump({"id": "lfhorror1", "title": "인수인계서 3쪽은 집에서 읽으래요.", "voices": VOICES, "lines": lines},
              open(f"{HERE}/script.json", "w"), ensure_ascii=False, indent=1)
    only = set(sys.argv[sys.argv.index("--only") + 1].split(",")) if "--only" in sys.argv else None
    tl, t = {"title": "인수인계서 3쪽은 집에서 읽으래요.", "lines": [], "fps": 30}, 0.0
    for L in lines:
        wav = f"{OUT}/voice/{L['id']}.wav"; meta = wav + ".json"
        if only is None or L["id"] in only or not os.path.exists(meta):
            for attempt in range(4):
                try:
                    x, words = asyncio.run(synth(L["say"].replace("|", " "), VOICES[L["voice"]])); break
                except Exception as e:  # Edge drops a connection now and then
                    print("retry", L["id"], e); import time; time.sleep(2 ** attempt)
            x, words = trim(x, words)
            write(wav, x); json.dump(words, open(meta, "w"))
        with wave.open(wav) as w:
            dur = w.getnframes() / SR
        words = json.load(open(meta))
        rec = [(c, t0 + d * k / max(1, len(chars(w)))) for t0, d, w in words for k, c in enumerate(chars(w))]
        sc = chars(L["say"]); times = [None] * len(sc)
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
        st = [0.0] + [max(0.0, s - 0.06) for s in segs[1:]]
        chunks = [{"t0": round(st[i], 3), "t1": round(st[i + 1] if i + 1 < len(st) else dur, 3), "text": L["cap"][i]}
                  for i in range(len(st))]
        t += round(L["gap"] * 0.9, 3)
        tl["lines"].append({"id": L["id"], "chapter": L["chapter"], "who": L["voice"], "voice": VOICES[L["voice"]]["edge"],
                            "start": round(t, 3), "dur": round(dur, 3), "wav": f"voice/{L['id']}.wav", "chunks": chunks})
        t += dur
    tl["end"] = round(t + 2.0, 3)
    json.dump(tl, open(f"{OUT}/timeline.json", "w"), ensure_ascii=False, indent=1)
    chs = {}
    for l in tl["lines"]:
        chs.setdefault(l["chapter"], l["start"])
    for c, s in chs.items():
        print(f"{int(s // 60)}:{int(s % 60):02d} {c}")
    words_nar = sum(len(chars(L["say"])) for L in lines if L["voice"] == "nar")
    words_all = sum(len(chars(L["say"])) for L in lines)
    print(f"total {tl['end']:.1f}s  lines {len(lines)}  chars {words_all}  narration share {words_nar / words_all:.0%}")


if __name__ == "__main__":
    main()
