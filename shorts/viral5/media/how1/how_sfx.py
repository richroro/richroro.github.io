"""Machine sounds for the voiceless process shorts (how1~), synthesized here with numpy (no samples, nothing to credit):
  laser.wav   a laser powder-bed printer: a high buzzing scan with tiny crackles of melting powder (4 s, loops)
  grind.wav   a friction-stir weld head: a low spinning whir with a grinding rumble (4 s, loops)
  clunk.wav   a heavy metal clunk, for a lift landing or a clamp closing
  hiss.wav    a long hiss of steam or water (3 s)
usage: python3 media/how1/how_sfx.py public/sfx"""
import os, sys, wave
import numpy as np
SR = 48000
rng = np.random.default_rng(7)
def save(path, x):
    x = np.clip(x / (np.abs(x).max() + 1e-9) * 0.89, -1, 1)
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x * 32767).astype(np.int16).tobytes())
def lp(x, a):  # one-pole low-pass
    y = np.empty_like(x); s = 0.0
    for i, v in enumerate(x): s += a * (v - s); y[i] = s
    return y
def fade(x, a=0.02, b=0.02):
    n = len(x); e = np.ones(n); ka, kb = int(a * SR), int(b * SR)
    e[:ka] = np.linspace(0, 1, ka); e[n - kb:] = np.linspace(1, 0, kb); return x * e
def laser(d=4.0):
    t = np.arange(int(d * SR)) / SR
    f = 2400 + 900 * np.sin(2 * np.pi * 3.1 * t)  # the scan sweeping back and forth
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.25 + np.sign(np.sin(2 * np.pi * 120 * t)) * 0.05
    noise = rng.standard_normal(len(t)); hiss = noise - lp(noise, 0.25)
    crackle = np.zeros(len(t)); idx = rng.integers(0, len(t) - 200, int(d * 260))
    for i in idx: crackle[i:i + 60] += rng.standard_normal(60) * np.exp(-np.arange(60) / 12) * rng.uniform(0.2, 0.8)
    return fade(tone * 0.6 + hiss * 0.12 + crackle * 0.5, 0.05, 0.05)
def grind(d=4.0):
    t = np.arange(int(d * SR)) / SR
    hum = sum(np.sin(2 * np.pi * h * 47 * t + h) / h for h in range(1, 9)) * (1 + 0.15 * np.sin(2 * np.pi * 7.8 * t))
    noise = rng.standard_normal(len(t)); rumble = lp(noise, 0.02) * 6 * (1 + 0.5 * np.sin(2 * np.pi * 13 * t))
    screech = np.sin(2 * np.pi * (1800 + 40 * np.sin(2 * np.pi * 0.7 * t)) * t) * 0.04
    return fade(hum * 0.35 + rumble + screech, 0.08, 0.08)
def clunk(d=0.7):
    t = np.arange(int(d * SR)) / SR
    body = sum(np.sin(2 * np.pi * f * t) * np.exp(-t * k) for f, k in ((92, 9), (231, 14), (517, 22), (1290, 40)))
    hit = rng.standard_normal(len(t)) * np.exp(-t * 90)
    return fade(body + hit * 0.6, 0.001, 0.05)
def hiss(d=3.0):
    t = np.arange(int(d * SR)) / SR
    n = rng.standard_normal(len(t)); x = n - lp(n, 0.05)
    return fade(x * (0.6 + 0.4 * np.sin(2 * np.pi * 0.4 * t + 1)), 0.3, 0.6)
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
for name, fn in (("laser", laser), ("grind", grind), ("clunk", clunk), ("hiss", hiss)):
    save(f"{out}/{name}.wav", fn()); print(name)
