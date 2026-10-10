"""Synthesize the road cartoons' two extra sound effects (numpy only, no samples): a car horn and a police siren.

usage: python3 road_sfx.py public/sfx      writes horn.wav (0.5 s, two-tone "빵") and siren.wav (1.6 s, wail)
"""
import os, sys, wave
import numpy as np

SR = 44100
out = sys.argv[1] if len(sys.argv) > 1 else "public/sfx"
os.makedirs(out, exist_ok=True)

def save(name, x):
    x = np.clip(x / (np.abs(x).max() + 1e-9) * 0.85, -1, 1)
    with wave.open(f"{out}/{name}.wav", "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())

def env(n, a=0.01, r=0.06):
    e = np.ones(n); ka, kr = int(a * SR), int(r * SR)
    e[:ka] = np.linspace(0, 1, ka); e[-kr:] = np.linspace(1, 0, kr)
    return e

# 빵 — a car horn: two detuned buzzy tones (a major third apart), lightly clipped
t = np.arange(int(0.5 * SR)) / SR
horn = sum(np.tanh(3 * np.sin(2 * np.pi * f * t)) for f in (415, 523)) * env(len(t))
save("horn", horn)

# 위용 — a siren: a sine wail sweeping 650..1300 Hz twice
t = np.arange(int(1.6 * SR)) / SR
f = 975 + 325 * np.sin(2 * np.pi * 1.25 * t - np.pi / 2)
siren = np.sin(2 * np.pi * np.cumsum(f) / SR) + 0.3 * np.sin(4 * np.pi * np.cumsum(f) / SR)
save("siren", siren * env(len(t), 0.05, 0.2))
print("road sfx ready in", out)
