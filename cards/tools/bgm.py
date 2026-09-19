#!/usr/bin/env python3
"""Synthesise a calm ambient bed for the card-news shorts.

Written from scratch (no samples, no external audio), so the result is
rights-clear for upload. Deterministic: the same duration always gives the
same track.

    python3 cards/tools/bgm.py out.wav 45.5
"""
import math
import struct
import sys
import wave

import numpy as np

SR = 44100
# A minor, one chord per phrase. Slow, unresolved, stays out of the way.
PROGRESSION = [
    (220.00, 261.63, 329.63),  # Am
    (174.61, 220.00, 261.63),  # F
    (261.63, 329.63, 392.00),  # C
    (196.00, 246.94, 293.66),  # G
]
# Pentatonic notes for the sparse bell line, two octaves up.
BELLS = [440.00, 523.25, 587.33, 659.25, 783.99, 880.00]


def pad(freq, n, detune):
    """One sustained voice: a few harmonics with a slow breathing envelope."""
    t = np.arange(n) / SR
    v = np.zeros(n)
    for mult, amp in ((1.0, 1.0), (2.0, 0.26), (3.0, 0.10), (4.0, 0.04)):
        v += amp * np.sin(2 * math.pi * freq * mult * (1 + detune) * t)
    breath = 1 + 0.16 * np.sin(2 * math.pi * 0.055 * t + freq % 3)
    return v * breath / 1.4


def bell(freq, n):
    """A soft struck tone - fast attack, long exponential decay."""
    t = np.arange(n) / SR
    env = np.exp(-t * 2.3) * (1 - np.exp(-t * 260))
    v = np.sin(2 * math.pi * freq * t) + 0.22 * np.sin(2 * math.pi * freq * 2.01 * t)
    return v * env


def lowpass(x, cutoff):
    """One-pole lowpass, run twice, to take the edge off the harmonics."""
    a = math.exp(-2 * math.pi * cutoff / SR)
    for _ in range(2):
        out = np.empty_like(x)
        acc = 0.0
        for i in range(len(x)):
            acc = (1 - a) * x[i] + a * acc
            out[i] = acc
        x = out
    return x


def reverb(x, taps=((0.083, 0.34), (0.147, 0.24), (0.233, 0.17), (0.361, 0.11))):
    """Cheap smeared tail from a handful of delayed copies."""
    out = x.copy()
    for delay, gain in taps:
        d = int(delay * SR)
        out[d:] += x[:-d] * gain
    return out


def render(seconds):
    n = int(seconds * SR)
    rng = np.random.default_rng(7)
    left, right = np.zeros(n), np.zeros(n)

    # --- pad: chords crossfading into one another ---
    phrase = seconds / len(PROGRESSION)
    span = int(phrase * SR)
    fade = int(min(3.0, phrase * 0.5) * SR)
    for i, chord in enumerate(PROGRESSION):
        start = i * span
        length = min(span + fade, n - start)
        if length <= 0:
            break
        env = np.ones(length)
        env[:fade] = np.linspace(0, 1, fade) ** 1.5
        env[-fade:] = np.linspace(1, 0, fade) ** 1.5
        for j, f in enumerate(chord):
            # Detune the channels apart slightly so the pad sits wide.
            left[start:start + length] += pad(f, length, -0.0012 - j * 0.0004) * env * 0.30
            right[start:start + length] += pad(f, length, 0.0012 + j * 0.0004) * env * 0.30

    # --- bells: one every few seconds, drifting across the stereo field ---
    pos = 3.0
    while pos < seconds - 2.5:
        f = BELLS[rng.integers(len(BELLS))]
        start = int(pos * SR)
        length = min(int(3.2 * SR), n - start)
        v = bell(f, length) * 0.16
        p = rng.uniform(0.3, 0.7)
        left[start:start + length] += v * (1 - p)
        right[start:start + length] += v * p
        pos += rng.uniform(2.2, 3.6)

    left, right = reverb(left), reverb(right)
    left, right = lowpass(left, 2600), lowpass(right, 2600)

    # --- master fades so it never starts or stops abruptly ---
    fi, fo = int(2.5 * SR), int(4.0 * SR)
    for ch in (left, right):
        ch[:fi] *= np.linspace(0, 1, fi) ** 2
        ch[-fo:] *= np.linspace(1, 0, fo) ** 2

    stereo = np.stack([left, right], axis=1)
    peak = np.abs(stereo).max()
    if peak > 0:
        stereo *= 0.25 / peak  # quiet: this sits under the video, not over it
    return stereo


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else 'bgm.wav'
    seconds = float(sys.argv[2]) if len(sys.argv) > 2 else 45.0
    audio = render(seconds)
    pcm = (audio * 32767).astype(np.int16)
    with wave.open(out, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print(f'{out}  {seconds:.1f}s  peak={np.abs(audio).max():.3f}  rms={np.sqrt((audio**2).mean()):.4f}')


if __name__ == '__main__':
    main()
