"""Voice engines behind voice_edge.py, longform/prep_long.py and longform/lfsaeyeon1/voice.py (README "음성 v2").

A script's "voices" entry picks its engine; an entry without "engine" is Edge, read exactly as before:
  {"edge": "ko-KR-SunHiNeural", "rate": "+25%", "pitch": "+0Hz"}                       Edge TTS (network)
  {"engine": "supertonic", "voice": "F3", "speed": 1.3}                                 Supertonic 3 preset voice (CPU, ONNX)
  {"engine": "qwen", "speaker": "sohee", "instruct": "...", "tempo": 1.15}              Qwen3-TTS built-in speaker (CPU, slow)
Every engine also takes "post": true (high-pass, presence lift, gentle compression, de-ess) and "tempo" (time-stretch
after synthesis, 0.8-1.6). synth(text, entry) returns (x, words) like voice_edge.py's synth: x is float32 mono 44.1 kHz,
trimmed; words are [(start, duration, word)]. Edge gives its word boundaries; the other engines get theirs from
faster-whisper word timestamps (MIT code and weights), so the per-syllable caption timing is computed the same way.
Takes from the local engines are cached in build/tts_cache/ by text and entry.

Weights are not in the repository: python3 voicelab/fetch_models.py downloads them (see that file).
"""
import asyncio, hashlib, json, os, re, ssl, subprocess, wave
import numpy as np

SR = 44100
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.environ.get("VOICE_CACHE", f"{HERE}/build/tts_cache")
ASR_MODEL = os.environ.get("VOICE_ASR", "deepdml/faster-whisper-large-v3-turbo-ct2")
POST = "highpass=f=80,equalizer=f=3500:t=q:w=1.0:g=2.5,acompressor=threshold=-20dB:ratio=2.5:attack=8:release=150:makeup=1.5,deesser=i=0.35:m=0.5:f=0.5"
_models = {}


def engine_of(v):
    return (v or {}).get("engine", "edge")


def key_of(text, v):
    return hashlib.sha1(json.dumps([text, v], ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:16]


def ffmpeg_pcm(data, args_in, af=None):
    cmd = ["ffmpeg", "-v", "error"] + args_in + ["-i", "pipe:0"] + (["-af", af] if af else []) + ["-ac", "1", "-ar", str(SR), "-f", "s16le", "pipe:1"]
    pcm = subprocess.run(cmd, input=data, stdout=subprocess.PIPE, check=True).stdout
    return np.frombuffer(pcm, np.int16).astype(np.float32) / 32768


def to_float(x, sr, af=None):
    """resample float audio to 44.1 kHz through ffmpeg, optionally with a filter chain"""
    x = np.asarray(x, np.float32).reshape(-1)
    return ffmpeg_pcm((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes(), ["-f", "s16le", "-ar", str(sr), "-ac", "1"], af)


def tempo_filter(t):
    t = float(t); parts = []
    while t > 2.0: parts.append("atempo=2.0"); t /= 2.0
    while t < 0.5: parts.append("atempo=0.5"); t /= 0.5
    return ",".join(parts + [f"atempo={t:.4f}"])


def post_chain(v):
    fs = []
    if v.get("tempo") and float(v["tempo"]) != 1.0: fs.append(tempo_filter(v["tempo"]))
    if v.get("post"): fs.append(POST)
    return ",".join(fs) or None


def trim(x, thr_db=-46, pad_a=0.05, pad_b=0.09):
    """voice_edge.py's trim without the word shift: cut leading/trailing silence, short fades"""
    env = np.convolve(np.abs(x), np.ones(441) / 441, mode="same")
    idx = np.where(env > env.max() * 10 ** (thr_db / 20))[0]
    a = max(0, idx[0] - int(pad_a * SR)); b = min(len(x), idx[-1] + int(pad_b * SR))
    y = x[a:b].copy(); fa, fb = int(0.008 * SR), int(0.02 * SR)
    y[:fa] *= np.linspace(0, 1, fa); y[-fb:] *= np.linspace(1, 0, fb)
    return y, a / SR


# ── Edge ──
def edge_ssl():
    """edge-tts verifies TLS against certifi's bundle only; behind a TLS-inspecting proxy point it at SSL_CERT_FILE"""
    ca = os.environ.get("SSL_CERT_FILE")
    if ca and os.path.exists(ca):
        import edge_tts.communicate as c
        if hasattr(c, "_SSL_CTX"): c._SSL_CTX = ssl.create_default_context(cafile=ca)


async def edge_synth(text, voice, rate="+0%", pitch="+0Hz"):
    import edge_tts
    edge_ssl()
    com = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, boundary="WordBoundary", proxy=os.environ.get("HTTPS_PROXY") or None)
    audio, words = bytearray(), []
    async for ch in com.stream():
        if ch["type"] == "audio": audio += ch["data"]
        elif ch["type"] == "WordBoundary": words.append((ch["offset"] / 1e7, ch["duration"] / 1e7, ch["text"]))
    return bytes(audio), words


# ── local engines ──
def supertonic_raw(text, v):
    from supertonic import TTS
    m = _models.get("supertonic")
    if m is None:
        m = _models["supertonic"] = TTS(model=v.get("model", "supertonic-3"), auto_download=True)
    style = m.get_voice_style(voice_name=v.get("voice", "F1"))
    wav, _ = m.synthesize(text, voice_style=style, lang="ko", speed=float(v.get("speed", 1.05)), total_steps=int(v.get("steps", 8)),
                          silence_duration=float(v.get("silence", 0.3)))
    return np.asarray(wav).reshape(-1), m.sample_rate


def qwen_raw(text, v):
    import torch
    from qwen_tts import Qwen3TTSModel
    torch.set_num_threads(os.cpu_count() or 4)
    name = v.get("model", "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice")
    m = _models.get(name)
    if m is None:
        m = _models[name] = Qwen3TTSModel.from_pretrained(name, device_map="cpu", dtype=torch.float32)
    torch.manual_seed(int(v.get("seed", 7)))
    if "design" in v:
        w, sr = m.generate_voice_design(text=text, language="Korean", instruct=v["design"])
    else:
        kw = {"instruct": v["instruct"]} if v.get("instruct") else {}
        w, sr = m.generate_custom_voice(text=text, language="Korean", speaker=v.get("speaker", "sohee"), **kw)
    return np.asarray(w[0]).reshape(-1), sr


RAW = {"supertonic": supertonic_raw, "qwen": qwen_raw}


def asr():
    m = _models.get("asr")
    if m is None:
        from faster_whisper import WhisperModel
        m = _models["asr"] = WhisperModel(ASR_MODEL, device="cpu", compute_type="int8", cpu_threads=os.cpu_count() or 4)
    return m


def transcribe(x, sr=SR, prompt=None, words=True):
    """faster-whisper on a float clip: (text, [(start, duration, word)])"""
    x16 = to_float(x, sr) if sr != SR else x
    x16 = ffmpeg_pcm((np.clip(x16, -1, 1) * 32767).astype(np.int16).tobytes(), ["-f", "s16le", "-ar", str(SR), "-ac", "1"])
    x16 = subprocess.run(["ffmpeg", "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "pipe:0", "-ar", "16000", "-f", "f32le", "pipe:1"],
                         input=x16.astype(np.float32).tobytes(), stdout=subprocess.PIPE, check=True).stdout
    segs, _ = asr().transcribe(np.frombuffer(x16, np.float32), language="ko", beam_size=5, word_timestamps=words, initial_prompt=prompt,
                               condition_on_previous_text=False, vad_filter=False)
    segs = list(segs)
    ws = [(w.start, max(0.02, w.end - w.start), w.word.strip()) for s in segs for w in (s.words or [])]
    return "".join(s.text for s in segs).strip(), ws


def snap(words, x, win=0.12):
    """move each word start onto the nearest rise in loudness within ±win s (Whisper's word times wander ~0.1 s)"""
    hop = int(0.01 * SR)
    env = np.sqrt(np.convolve(x ** 2, np.ones(hop) / hop, mode="same"))[::hop]
    db = 20 * np.log10(env + 1e-6); rise = np.maximum(0, np.diff(db, prepend=db[0]))
    out, prev = [], -1.0
    for t0, d, w in words:
        a, b = max(0, int((t0 - win) * 100), int((prev + 0.08) * 100)), min(len(rise), int((t0 + win) * 100) + 1)
        k = a + int(np.argmax(rise[a:b])) if b > a and rise[a:b].max() > 6 else int(round(t0 * 100))
        t = max(k / 100, prev + 0.04)
        out.append((round(t, 3), round(float(d), 3), w)); prev = t
    return out


def synth(text, v):
    """(x, words) for one line with the entry's engine. Edge is not cached here (voice_edge.py never cached it)."""
    eng = engine_of(v)
    if eng == "edge":
        mp3, words = asyncio.run(edge_synth(text, v["edge"], v.get("rate", "+0%"), v.get("pitch", "+0Hz")))
        x = ffmpeg_pcm(mp3, [], post_chain(v))
        t = float(v.get("tempo", 1.0))
        words = [(t0 / t, d / t, w) for t0, d, w in words]
        x, a = trim(x)
        return x, [(t0 - a, d, w) for t0, d, w in words]
    if eng not in RAW: raise SystemExit(f"unknown voice engine {eng!r} (edge, {', '.join(RAW)})")
    os.makedirs(CACHE, exist_ok=True)
    k = key_of(text, v); wav, js = f"{CACHE}/{k}.wav", f"{CACHE}/{k}.json"
    if os.path.exists(js):
        return read_wav(wav), [tuple(w) for w in json.load(open(js))["words"]]
    rk = key_of(text, {a: b for a, b in v.items() if a not in ("tempo", "post")})  # the raw take, before tempo and post
    if os.path.exists(f"{CACHE}/raw-{rk}.npy"):
        raw, sr = np.load(f"{CACHE}/raw-{rk}.npy"), int(open(f"{CACHE}/raw-{rk}.sr").read())
    else:
        raw, sr = RAW[eng](text, v)
        np.save(f"{CACHE}/raw-{rk}.npy", np.asarray(raw, np.float32)); open(f"{CACHE}/raw-{rk}.sr", "w").write(str(sr))
    x, _ = trim(to_float(raw, sr, post_chain(v)))
    _, words = transcribe(x, prompt=text)
    words = snap(words, x)
    write_wav(wav, x); json.dump({"text": text, "entry": v, "words": words}, open(js, "w"), ensure_ascii=False)
    return x, words


def read_wav(path):
    with wave.open(path) as w:
        return np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768


def write_wav(path, x):
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())


DIG, UNIT, BIG = "영일이삼사오육칠팔구", ["", "십", "백", "천"], ["", "만", "억", "조"]


def read_num(n):
    """Sino-Korean reading of an integer (prep.py's read_num, extended past 9999)"""
    if n == 0: return DIG[0]
    out, g = "", 0
    while n:
        n, part = divmod(n, 10000)
        if part:
            s = ""
            for k in range(3, -1, -1):
                d = part // 10 ** k % 10
                if d: s += ("" if d == 1 and k else DIG[d]) + UNIT[k]
            out = ("" if part == 1 and g == 1 else s) + BIG[g] + out
        g += 1
    return out


def ko_text(text):
    """what the local engines read: digits as Korean words (Edge reads digits itself), "…" as a comma pause"""
    t = re.sub(r"(\d),(\d)", r"\1\2", text)
    t = re.sub(r"\d+", lambda m: read_num(int(m.group())), t)
    return t.replace("…", ",").replace(",,", ",")
