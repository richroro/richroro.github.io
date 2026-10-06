"""Mix narration, SFX and BGM into one stereo WAV following build/plan.json.

usage: python3 mix.py <build_dir> <bgm.wav> <out.wav>
- narration lines are level-matched and placed at their timeline starts
- BGM is time-shifted so the song's chorus drop lands on the stats reveal,
  ducked under speech, tape-stopped for the subscribe gag, then resumed
"""
import sys, json, wave, numpy as np
B, BGM, OUT = sys.argv[1:4]
SR = 44100

def read(path):
    with wave.open(path) as w:
        sr, ch, n = w.getframerate(), w.getnchannels(), w.getnframes()
        x = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32) / 32768
    x = x.reshape(-1, ch)
    if sr != SR:  # linear resample (voice is 44.1k already; kept for safety)
        idx = np.arange(0, len(x) - 1, sr / SR); i0 = idx.astype(int); fr = (idx - i0)[:, None]
        x = x[i0] * (1 - fr) + x[i0 + 1] * fr
    return x if ch == 2 else np.repeat(x, 2, axis=1)

def db(x): return 10 ** (x / 20)
def rms(x): return float(np.sqrt(np.mean(x ** 2)) + 1e-12)

tl = json.load(open(f"{B}/timeline.json")); plan = json.load(open(f"{B}/plan.json"))
N = int((tl["end"] + 0.2) * SR)
voice = np.zeros((N, 2), np.float32); fx = np.zeros((N, 2), np.float32); music = np.zeros((N, 2), np.float32)

def add(buf, x, t, g=1.0):
    i = int(round(t * SR));
    if i >= N: return
    j = min(N, i + len(x)); buf[i:j] += x[: j - i] * g

# narration: each line to the same loudness, then a gentle presence lift
for L in tl["lines"]:
    x = read(f"{B}/{L['wav']}")
    x = x * (db(-17) / rms(x[np.abs(x).max(1) > 0.01] if (np.abs(x).max(1) > 0.01).any() else x))
    add(voice, x, L["start"])
# soft-knee compression on the voice bus
voice = np.tanh(voice * 1.6) / np.tanh(1.6)

# sfx
cache = {}
for c in plan["sfx"]:
    if c["name"] not in cache: cache[c["name"]] = read(f"{B}/sfx/{c['name']}.wav")
    add(fx, cache[c["name"]], c["t"], c["gain"] * db(-9))

# bgm arrangement
song = read(BGM)
m = plan["music"]; off = m["songDrop"] - m["dropAt"]
cut, res, end = m["cutAt"], m["resumeAt"], m["end"]
seg = song[int(off * SR): int(off * SR) + int(cut * SR)]
add(music, seg, 0.0)
# tape stop: playback rate falls 1 → 0 over 0.5 s
ts = 0.5; n = int(ts * SR); rate = np.linspace(1, 0, n) ** 1.3
pos = int((off + cut) * SR) + np.cumsum(rate); pos = pos.astype(int).clip(0, len(song) - 1)
tape = song[pos] * np.linspace(1, 0.2, n)[:, None]
add(music, tape, cut)
# resume on the dance break for the ending
tail = song[int(m["resumeSong"] * SR): int(m["resumeSong"] * SR) + int((end - res + 0.3) * SR)].copy()
fi = int(0.03 * SR); tail[:fi] *= np.linspace(0, 1, fi)[:, None]
add(music, tail, res)
# fades: quick in at 0, out over the last 1.4 s
music[: int(0.08 * SR)] *= np.linspace(0, 1, int(0.08 * SR))[:, None]
fo0 = int((end - 1.4) * SR); music[fo0:] *= np.linspace(1, 0, N - fo0)[:, None] ** 1.5

# ducking: follow the voice envelope (30 ms attack, 280 ms release)
env = np.abs(voice).max(1); hop = 441
e = np.array([env[i:i + hop].max() for i in range(0, N, hop)])
sm = np.zeros_like(e); a_att, a_rel = 1 - np.exp(-1 / 3), 1 - np.exp(-1 / 28)
for i in range(1, len(e)):
    k = a_att if e[i] > sm[i - 1] else a_rel; sm[i] = sm[i - 1] + k * (e[i] - sm[i - 1])
duck = 1 - 0.55 * np.clip(sm / 0.25, 0, 1)
gain = np.repeat(duck, hop)[:N]
music *= (gain * db(-9.0))[:, None]
# effects also step back (up to -6 dB) while someone is talking
fx *= (1 - 0.5 * np.clip(np.repeat(sm, hop)[:N] / 0.25, 0, 1))[:, None]
# extra dip under the "근데 진짜 소름은" build so the heartbeat reads
tw0 = plan["sfx"] and min(c["t"] for c in plan["sfx"] if c["name"] == "heartbeat") - 0.3
i0, i1 = int(tw0 * SR), int(m["dropAt"] * SR)
music[i0:i1] *= np.linspace(1, 0.35, i1 - i0)[:, None] ** 0.5

# keep every spoken line at least 13 dB above the music under it (the chorus is louder than the verse)
lg = np.ones(N, np.float32)
for L in tl["lines"]:
    a, b = int(L["start"] * SR), int((L["start"] + L["dur"]) * SR)
    short = 13.0 - 20 * np.log10(rms(voice[a:b]) / rms(music[a:b]))
    if short > 0:
        r = int(0.12 * SR); g = db(-short)
        lg[a:b] = np.minimum(lg[a:b], g)
        lg[max(0, a - r):a] = np.minimum(lg[max(0, a - r):a], np.linspace(1, g, a - max(0, a - r)))
        lg[b:b + r] = np.minimum(lg[b:b + r], np.linspace(g, 1, len(lg[b:b + r])))
music *= lg[:, None]
for L in tl["lines"]:
    a, b = int(L["start"] * SR), int((L["start"] + L["dur"]) * SR)
    L["snr"] = round(20 * np.log10(rms(voice[a:b]) / rms(music[a:b])), 1)
print("voice-over-music dB:", " ".join(f"{L['id']}:{L['snr']}" for L in tl["lines"]))
act = np.repeat(sm > 0.08, hop)[:N]; gap = np.repeat(sm < 0.01, hop)[:N]
lv = lambda x, msk: round(20 * np.log10(rms(x[msk]) if msk.any() else 1e-9), 1)
print("speech: voice", lv(voice, act), "music", lv(music, act), "| gaps: music", lv(music, gap), "fx(all)", lv(fx, np.abs(fx).max(1) > 1e-4))
mix = voice + fx + music
peak = np.abs(mix).max(); mix = np.tanh(mix / peak * 1.25) / np.tanh(1.25) * db(-1.0)
with wave.open(OUT, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(mix, -1, 1) * 32767).astype(np.int16).tobytes())
print("mix", OUT, f"{N / SR:.2f}s", "voice rms", round(20 * np.log10(rms(voice)), 1), "music rms", round(20 * np.log10(rms(music)), 1), "fx rms", round(20 * np.log10(rms(fx)), 1))
