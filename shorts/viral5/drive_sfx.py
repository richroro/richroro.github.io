"""Synthesize the wordless road cartoons' sound effects (numpy only, no samples): an engine roar, a tyre squeal and
the "dun-dun" sting. (The horn and the siren come from road_sfx.py.)

usage: python3 drive_sfx.py public/sfx      writes engine.wav (1.4 s, revving up), squeal.wav (0.9 s), dundun.wav (1.8 s)
"""
import os, sys, wave
import numpy as np

SR = 44100
out = sys.argv[1] if len(sys.argv) > 1 else "public/sfx"
os.makedirs(out, exist_ok=True)
rng = np.random.default_rng(7)

def save(name, x):
    x = np.clip(x / (np.abs(x).max() + 1e-9) * 0.85, -1, 1)
    with wave.open(f"{out}/{name}.wav", "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())

def env(n, a=0.01, r=0.06):
    e = np.ones(n); ka, kr = int(a * SR), int(r * SR)
    e[:ka] = np.linspace(0, 1, ka); e[-kr:] = np.linspace(1, 0, kr)
    return e

def lowpass(x, k):
    return np.convolve(x, np.ones(k) / k, mode="same")

# 부앙 — an engine revving: a pulse train whose firing rate climbs 38 → 120 Hz, through a low-pass, with a little noise
t = np.arange(int(1.4 * SR)) / SR
f = 38 + 82 * (1 - np.exp(-t * 2.6))
ph = np.cumsum(f) / SR
pulse = (np.sin(2 * np.pi * ph) > 0.6).astype(float) + 0.6 * np.sin(2 * np.pi * ph * 2) + 0.3 * np.sin(2 * np.pi * ph * 3)
engine = lowpass(pulse + 0.25 * rng.standard_normal(len(t)), 18)
save("engine", np.tanh(2.2 * engine) * env(len(t), 0.05, 0.35))

# 끼익 — a tyre squeal: narrow noise bands around a wobbling 2.1 kHz tone
t = np.arange(int(0.9 * SR)) / SR
fq = 2100 + 260 * np.sin(2 * np.pi * 9 * t) - 400 * t
tone = np.sin(2 * np.pi * np.cumsum(fq) / SR) + 0.5 * np.sin(2 * np.pi * np.cumsum(fq * 1.5) / SR)
noise = rng.standard_normal(len(t)); noise = noise - lowpass(noise, 6)
save("squeal", (tone * (0.7 + 0.3 * np.abs(noise))) * env(len(t), 0.03, 0.3))

# 둥둥 — the dramatic sting: two low brassy hits, the second lower and longer
def hit(f0, dur):
    tt = np.arange(int(dur * SR)) / SR
    x = sum(np.sin(2 * np.pi * f0 * k * tt) / k for k in range(1, 7)) + 0.8 * np.sin(2 * np.pi * f0 / 2 * tt)
    return np.tanh(1.8 * x) * np.exp(-tt * 2.2) * env(len(tt), 0.008, 0.2)
a, b = hit(73.4, 0.55), hit(61.7, 1.2)
dun = np.zeros(int(1.8 * SR)); dun[:len(a)] += a; s = int(0.55 * SR); dun[s:s + len(b)] += 1.15 * b
save("dundun", dun)
print("drive sfx ready in", out)
