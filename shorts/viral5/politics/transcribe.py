"""Word-timed transcript of a clip, so captions show exactly what was said.

usage: python3 transcribe.py <clip.mp4> <out.json> [--vtt subs.ko.vtt --offset SECONDS]
- Runs the Korean Zipformer recognizer (sherpa-onnx) over the clip, cut at pauses into short chunks.
- If YouTube's Korean captions are given (word-timed auto captions), they are parsed too; --offset is
  the clip's start inside the original video, so caption times line up with the clip.
Writes {"asr": [{"w", "t0", "t1"}], "vtt": [{"w", "t0"}]} with times in seconds from the clip start.
"""
import json, os, re, subprocess, sys
import numpy as np, sherpa_onnx

HERE = os.path.dirname(os.path.abspath(__file__))
ZK = os.environ.get("ZIPFORMER", f"{HERE}/../../build/models/sherpa-onnx-zipformer-korean-2024-06-24")
SR = 16000

def audio(path):
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"], stdout=subprocess.PIPE, check=True).stdout
    return np.frombuffer(pcm, np.int16).astype(np.float32) / 32768

def chunks(x, max_len=18.0, min_gap=0.25):
    """split at quiet spots so every chunk is short enough for the offline recognizer"""
    hop = int(0.02 * SR); e = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2)) for i in range(0, len(x) - hop, hop)])
    quiet = e < max(np.percentile(e, 20) * 1.8, 0.004)
    out, start, i = [], 0, 0
    while i < len(e):
        dur = (i - start) * hop / SR
        if dur > 4 and quiet[i:i + int(min_gap * SR / hop)].all() or dur >= max_len:
            out.append((start * hop, i * hop)); start = i
        i += 1
    out.append((start * hop, len(x)))
    return [(a, b) for a, b in out if b - a > 0.3 * SR]

def asr_words(x):
    rec = sherpa_onnx.OfflineRecognizer.from_transducer(
        encoder=f"{ZK}/encoder-epoch-99-avg-1.int8.onnx", decoder=f"{ZK}/decoder-epoch-99-avg-1.int8.onnx",
        joiner=f"{ZK}/joiner-epoch-99-avg-1.int8.onnx", tokens=f"{ZK}/tokens.txt", num_threads=4)
    words = []
    for a, b in chunks(x):
        st = rec.create_stream(); st.accept_waveform(SR, x[a:b]); rec.decode_stream(st)
        toks, ts = list(st.result.tokens), list(st.result.timestamps)
        for k, (tok, t) in enumerate(zip(toks, ts)):
            t = a / SR + t; t_next = a / SR + ts[k + 1] if k + 1 < len(ts) else t + 0.25
            piece = tok.lstrip(" ▁")  # sherpa-onnx marks a word start with a leading space (the BPE "▁")
            if tok[:1] in (" ", "▁") or not words:
                words.append({"w": piece, "t0": round(t, 3), "t1": round(t_next, 3)})
            else:
                if not words[-1]["w"]: words[-1]["t0"] = round(t, 3)  # a bare separator token: time the word by its first syllable
                words[-1]["w"] += piece; words[-1]["t1"] = round(t_next, 3)
    return [w for w in words if w["w"]]

TS = re.compile(r"(\d+):(\d\d):(\d\d)\.(\d\d\d)")
def secs(s):
    h, m, sec, ms = map(int, TS.match(s).groups()); return h * 3600 + m * 60 + sec + ms / 1000

def vtt_words(path, offset):
    """YouTube auto captions: a cue line with inline <00:00:01.520><c> word</c> timings holds the new words"""
    words, cue_t0 = [], None
    for line in open(path, encoding="utf-8"):
        line = line.strip()
        if "-->" in line:
            cue_t0 = secs(line.split("-->")[0].strip()); continue
        if "<c>" not in line or cue_t0 is None:
            continue
        first, *rest = re.split(r"<(\d+:\d\d:\d\d\.\d\d\d)>", line)
        clean = lambda s: re.sub(r"</?c[^>]*>", "", s).strip()
        if clean(first): words.append({"w": clean(first), "t0": cue_t0})
        for k in range(0, len(rest) - 1, 2):
            w = clean(rest[k + 1])
            if w: words.append({"w": w, "t0": secs(rest[k])})
    return [{"w": w["w"], "t0": round(w["t0"] - offset, 3)} for w in words if w["t0"] - offset > -0.5]

if __name__ == "__main__":
    clip, out = sys.argv[1], sys.argv[2]
    args = sys.argv[3:]; vtt = args[args.index("--vtt") + 1] if "--vtt" in args else None
    offset = float(args[args.index("--offset") + 1]) if "--offset" in args else 0.0
    res = {"asr": asr_words(audio(clip)), "vtt": vtt_words(vtt, offset) if vtt and os.path.exists(vtt) else []}
    json.dump(res, open(out, "w"), ensure_ascii=False, indent=0)
    print(f"{clip}: {len(res['asr'])} ASR words, {len(res['vtt'])} caption words")
    print(" ".join(w["w"] for w in res["asr"])[:400])
