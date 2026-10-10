"""Synthesize loopable ambience beds for long-forms: rain, wind, deep (underwater rumble), room (quiet room tone).
usage: python3 longform/ambience.py <out dir>      writes <name>.wav, 60 s, 44.1 kHz mono, peak about -6 dBFS
Generated from noise here, so there is no licence to track. The last 2 s are crossfaded into the start, so <Audio loop> is seamless.
"""
import os, sys, wave
import numpy as np

SR, N = 44100, 60 * 44100
rng = np.random.default_rng(7)

def lp_fast(x, fc):  # the same filter via FFT (one-pole magnitude response), fast for long signals
    f = np.fft.rfftfreq(len(x), 1 / SR); return np.fft.irfft(np.fft.rfft(x) / np.sqrt(1 + (f / fc) ** 2), len(x))

def hp_fast(x, fc):
    f = np.fft.rfftfreq(len(x), 1 / SR); h = (f / fc) / np.sqrt(1 + (f / fc) ** 2); return np.fft.irfft(np.fft.rfft(x) * h, len(x))

def slow(n_pts, lo, hi):  # a smooth random curve between lo and hi over the whole bed
    k = np.interp(np.arange(N), np.linspace(0, N, n_pts), rng.uniform(lo, hi, n_pts)); return k

def loopable(x, fade=2.0):
    n = int(fade * SR); w = np.linspace(0, 1, n); y = x[:-n].copy(); y[:n] = y[:n] * w + x[-n:] * (1 - w); return y

def norm(x, peak=0.5):
    return x / (np.abs(x).max() + 1e-9) * peak

def rain():
    hiss = hp_fast(lp_fast(rng.standard_normal(N), 6000), 400) * slow(40, 0.7, 1.0)
    drops = np.zeros(N); idx = rng.integers(0, N - 400, 9000)
    env = np.exp(-np.arange(300) / 40.0) * rng.standard_normal(300)
    for i, g in zip(idx, rng.uniform(0.2, 1.0, len(idx))): drops[i:i + 300] += g * env
    return norm(hiss + 0.6 * hp_fast(drops, 1500))

def wind():
    b = np.cumsum(rng.standard_normal(N)); b = hp_fast(b - b.mean(), 30)
    return norm(lp_fast(b, 500) * slow(25, 0.3, 1.0))

def deep():
    b = np.cumsum(rng.standard_normal(N)); b = hp_fast(b - b.mean(), 18)
    rumble = lp_fast(b, 140) * slow(20, 0.6, 1.0)
    t = np.arange(N) / SR; hum = 0.15 * np.sin(2 * np.pi * 55 * t) * slow(10, 0.3, 1.0)
    return norm(norm(rumble) + hum)

def room():
    return norm(lp_fast(rng.standard_normal(N), 900), 0.12)

out = sys.argv[1]; os.makedirs(out, exist_ok=True)
for name, fn in (("rain", rain), ("wind", wind), ("deep", deep), ("room", room)):
    x = loopable(fn())
    with wave.open(f"{out}/{name}.wav", "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())
    print(f"{out}/{name}.wav")
