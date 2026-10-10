"""lfhorror1 soundtrack → public/lfhorror1/mix.wav (stereo 48 kHz, roughly -16 LUFS; render_long / ffmpeg loudnorm sets -14).
Layers: voices (build/lfhorror1/voice), a synthesized store room tone (fluorescent hum + fridge motor, about -30 LUFS),
numpy-made effects (door chime, scanner beep, fingerprint error, phone buzz, coins, heartbeat, glitch, tape, paper),
and Kevin MacLeod music (CC BY 4.0) only in the build-ups, cut to silence 2 s before the reveals.
usage: python3 longform/lfhorror1/mix.py
"""
import json, os, subprocess, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(f"{HERE}/../..")
B = f"{ROOT}/build/lfhorror1"
SR = 48000
tl = json.load(open(f"{B}/timeline.json"))
L = {l["id"]: l for l in tl["lines"]}
N = int((tl["end"] + 0.5) * SR)
mix = np.zeros((N, 2), np.float32)
rng = np.random.default_rng(13)
db = lambda x: 10 ** (x / 20)


def load(path, sr=SR):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-ac", "2", "-ar", str(sr), "-f", "f32le", "-"], stdout=subprocess.PIPE, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).copy()


def put(x, t, g=1.0, pan=0.0):
    if x.ndim == 1:
        x = np.stack([x * (1 - max(0, pan)), x * (1 + min(0, pan))], 1)
    a = int(t * SR); b = min(N, a + len(x))
    if a < N:
        mix[a:b] += x[: b - a] * g


def env(n, a=0.005, r=0.2):
    e = np.ones(n, np.float32); na, nr = int(a * SR), int(r * SR)
    e[:na] = np.linspace(0, 1, na); e[-nr:] *= np.linspace(1, 0, nr) ** 2
    return e


def tone(f, d, decay=3.0):
    t = np.arange(int(d * SR)) / SR
    return np.sin(2 * np.pi * f * t) * np.exp(-decay * t)


def lowpass(x, k):
    return np.convolve(x, np.ones(k) / k, mode="same")


def at(lid, chunk=0, dt=0.0):
    l = L[lid]; return l["start"] + l["chunks"][min(chunk, len(l["chunks"]) - 1)]["t0"] + dt


# ---- voices
for l in tl["lines"]:
    with wave.open(f"{B}/{l['wav']}") as w:
        x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
        sr = w.getframerate()
    x = np.interp(np.arange(int(len(x) * SR / sr)) * sr / SR, np.arange(len(x)), x).astype(np.float32)
    rms = np.sqrt(np.mean(x ** 2)) + 1e-9
    g = 0.085 / rms * {"doc": 0.9, "guest": 0.8, "minho": 0.95}.get(l["who"], 1.0)
    put(x, l["start"], g, pan={"guest": -0.15, "noona": 0.1, "daeri": 0.1}.get(l["who"], 0.0))

# ---- room tone: store (0 → leaving at line 180), home after (soft)
t = np.arange(N) / SR
hum = (0.6 * np.sin(2 * np.pi * 120 * t) + 0.25 * np.sin(2 * np.pi * 240 * t) + 0.12 * np.sin(2 * np.pi * 360 * t)) * (1 + 0.15 * np.sin(2 * np.pi * 0.13 * t))
brown = np.cumsum(rng.standard_normal(N).astype(np.float32)); brown -= lowpass(brown, 4801); brown /= np.abs(brown).max() + 1e-9
fridge = lowpass(rng.standard_normal(N).astype(np.float32), 60) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.05 * t))
room = 0.010 * hum + 0.05 * brown + 0.05 * fridge / (np.abs(fridge).max() + 1e-9)
store_end = L["180"]["start"] - 1.0
mask = np.clip((store_end - t) / 1.5, 0, 1) * 1.0 + np.clip((t - store_end) / 2, 0, 1) * 0.35
mix += np.stack([room * mask, np.roll(room, 997) * mask], 1)

# ---- effects
def chime(t0):
    put(tone(784, 1.2, 2.5) * 0.35, t0); put(tone(622, 1.6, 2.0) * 0.35, t0 + 0.45)
def beep(t0):
    put(tone(2400, 0.12, 8) * env(int(0.12 * SR), 0.002, 0.03) * 0.18, t0)
def err(t0):
    s = np.sign(np.sin(2 * np.pi * 330 * np.arange(int(0.42 * SR)) / SR)) * env(int(0.42 * SR), 0.004, 0.05) * 0.06
    put(s, t0); put(s, t0 + 0.5)
def buzz(t0, n=2):
    for k in range(n):
        d = int(0.5 * SR); x = np.sin(2 * np.pi * 160 * np.arange(d) / SR) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 30 * np.arange(d) / SR)))
        put(lowpass(x.astype(np.float32), 8) * env(d, 0.01, 0.05) * 0.12, t0 + 0.9 * k)
def coin(t0):
    for f in (3150, 4720, 6010):
        put(tone(f, 0.6, 9) * 0.05, t0)
def heart(t0, n):
    for k in range(n):
        for dt, g in ((0, 1), (0.22, 0.7)):
            put(tone(55, 0.25, 18) * 0.5 * g, t0 + 1.05 * k + dt)
def glitch(t0, d=0.6):
    n = int(d * SR); x = rng.standard_normal(n).astype(np.float32) * (np.sin(2 * np.pi * 37 * np.arange(n) / SR) > 0) * env(n, 0.002, 0.1)
    put(x * 0.12, t0)
def boom(t0):
    put(tone(42, 2.2, 1.6) * 0.5 + lowpass(rng.standard_normal(int(2.2 * SR)).astype(np.float32), 200) * env(int(2.2 * SR), 0.01, 1.5) * 0.4, t0)
def paper(t0):
    n = int(0.5 * SR); x = rng.standard_normal(n).astype(np.float32); x -= lowpass(x, 6)
    put(x * env(n, 0.03, 0.2) * 0.05, t0)
def tape(t0):
    n = int(0.7 * SR); x = rng.standard_normal(n).astype(np.float32) * (0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 70 * np.arange(n) / SR)))
    x -= lowpass(x, 4); put(x * env(n, 0.01, 0.15) * 0.07, t0)

chime(at("082", 1, -0.1))
for lid in ("099", "161"):
    beep(at(lid, 1 if lid == "099" else 0, 0.1))
for lid in ("164", "166", "168"):
    err(L[lid]["start"] - 0.9)
for lid in ("135", "169"):
    buzz(at(lid, 0, -0.2), 2)
buzz(L["204"]["start"] - 1.0, 2)
for k in range(5):
    coin(L["101"]["start"] + 0.6 + 0.55 * k)
heart(L["106"]["start"], 6)
glitch(L["107"]["start"] - 0.25, 0.5)
glitch(L["109"]["start"] + 0.2, 1.4)
glitch(at("143", 1), 0.8)
for c in ("006", "032", "081", "127", "180", "208"):
    boom(L[c]["start"] - 0.9)
boom(L["194"]["start"] - 0.2)
boom(L["216"]["start"] - 0.2)
tape(L["185"]["start"] + 1.3)
for lid in ("033", "057", "146", "185", "187"):
    paper(L[lid]["start"] - 0.2)

# ---- music: (file, start in video, end in video, offset in track, gain dB); every end fades out 1.5 s
M = f"{B}/music"
cues = [("Lightless Dawn", 0.0, L["006"]["start"] - 0.5, 0, -27),
        ("Darkest Child", L["081"]["start"] - 1.0, L["107"]["start"] - 2.0, 0, -25),
        ("Gathering Darkness", L["127"]["start"] - 1.0, L["180"]["start"] - 0.5, 20, -28),
        ("Lightless Dawn", L["185"]["start"], L["194"]["start"] - 2.0, 60, -27),
        ("Lightless Dawn", L["195"]["start"] + 1.0, L["216"]["start"] - 2.0, 140, -28),
        ("Darkest Child", L["217"]["start"] - 0.3, tl["end"], 120, -29)]
for name, a, b, off, g in cues:
    x = load(f"{M}/{name}.mp3")[int(off * SR):][: int((b - a) * SR)]
    n = len(x); e = np.ones(n, np.float32); fi, fo = int(1.0 * SR), min(n, int(1.5 * SR))
    e[:fi] = np.linspace(0, 1, fi); e[-fo:] *= np.linspace(1, 0, fo)
    put(x * e[:, None], a, db(g) * 3.2)

peak = np.abs(mix).max()
if peak > 0.98:
    mix *= 0.98 / peak
os.makedirs(f"{ROOT}/public/lfhorror1", exist_ok=True)
out = f"{ROOT}/public/lfhorror1/mix.wav"
with wave.open(out, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(mix, -1, 1) * 32767).astype(np.int16).tobytes())
print("wrote", out, f"{N / SR:.1f}s peak {peak:.2f}")
