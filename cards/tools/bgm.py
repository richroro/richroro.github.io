#!/usr/bin/env python3
"""Synthesise a slow piano ballad bed for the card-news shorts.

Everything here is generated from scratch - no samples, no pretrained model -
so the result is rights-clear for upload. (The obvious alternative, Meta's
MusicGen, ships its weights under CC-BY-NC, which rules it out for a channel
that might be monetised.) Deterministic: a given duration always renders the
same track.

    python3 cards/tools/bgm.py out.wav 45.9 [ballad|drive|bright]

ballad - slow piano, for the reflective card sets.
drive  - four-on-the-floor pulse under a plucked arpeggio, for rankings and
         countdowns, where a ballad just sits there.
bright - major key, marimba and claps, syncopated. Light rather than urgent.
"""
import math
import sys
import wave

import numpy as np

SR = 44100

# Descending-bass progression, the backbone of a lot of Korean ballads:
# the bass walks C-B-A-G-F-E-D-G while the harmony stays warm.
PROGRESSION = [
    ('C4', ['C4', 'E4', 'G4'], 'C2'),
    ('G3', ['B3', 'D4', 'G4'], 'B1'),
    ('A3', ['A3', 'C4', 'E4'], 'A1'),
    ('E3', ['A3', 'C4', 'E4'], 'G1'),
    ('F3', ['F3', 'A3', 'C4'], 'F1'),
    ('C4', ['E3', 'G3', 'C4'], 'E1'),
    ('D3', ['D3', 'F3', 'A3'], 'D2'),
    ('G3', ['D3', 'G3', 'B3'], 'G1'),
]

# Sparse top line. One entry per bar: (beat, note) pairs, beats are 0-3.
MELODY = [
    [(0.0, 'G4'), (2.0, 'E4')],
    [(0.0, 'D4')],
    [(0.0, 'C5'), (2.0, 'A4')],
    [(0.0, 'G4')],
    [(0.0, 'A4'), (2.5, 'C5')],
    [(0.0, 'G4'), (2.0, 'E4')],
    [(0.0, 'F4'), (2.0, 'A4')],
    [(0.0, 'G4')],
    [(0.0, 'E5'), (2.0, 'C5')],
    [(0.0, 'D5')],
    [(0.0, 'C5'), (2.0, 'A4')],
    [(0.0, 'G4')],
    [(0.0, 'E4')],
    [(0.0, 'C4')],
]

STEPS = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def freq(name):
    """'A4' -> 440.0"""
    semitone = STEPS[name[0]] + (int(name[1:]) + 1) * 12
    return 440.0 * 2 ** ((semitone - 69) / 12)


_cache = {}


def piano(f0, dur, vel=1.0):
    """A struck-string tone: inharmonic partials that decay at their own rates.

    The two details that keep it from sounding like a plain oscillator are the
    stretched partial series (real strings are stiff, so overtones sit sharp)
    and the per-partial decay - the bright top of a piano note dies away long
    before the fundamental does.
    """
    key = (round(f0, 2), round(dur, 2), round(vel, 2))
    if key in _cache:
        return _cache[key]

    n = int(dur * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    stiffness = 0.0004 + 0.004 * math.exp(-f0 / 90)  # bass strings are stiffer
    for k in range(1, 19):
        fk = k * f0 * math.sqrt(1 + stiffness * k * k)
        if fk > 15000:
            break
        amp = 1.0 / k ** 1.25
        if k % 2 == 0:
            amp *= 0.72  # odd partials dominate, as on a struck string
        tau = (0.85 + 2.6 * math.exp(-f0 / 240)) / k ** 0.55
        out += amp * np.exp(-t / tau) * np.sin(2 * math.pi * fk * t + k * 1.7)

    out *= 1 - np.exp(-t * 520)  # hammer strike, a few ms
    # A touch of filtered noise at the onset reads as felt hitting string.
    thump = min(n, int(0.014 * SR))
    rng = np.random.default_rng(int(f0))
    out[:thump] += rng.normal(0, 0.28, thump) * np.exp(-np.arange(thump) / (0.0035 * SR))

    out *= vel / 3.2
    _cache[key] = out
    return out


def strings(f0, dur, vel=1.0):
    """Soft sustained pad sitting under the piano."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    v = np.zeros(n)
    for mult, amp in ((1.0, 1.0), (2.0, 0.3), (3.0, 0.12), (5.0, 0.05)):
        v += amp * np.sin(2 * math.pi * f0 * mult * t + mult)
    env = (1 - np.exp(-t * 2.2)) * np.exp(-t * 0.30)
    v *= 1 + 0.05 * np.sin(2 * math.pi * 4.6 * t)  # slow vibrato
    return v * env * vel / 1.5


def add(buf, sig, at, gain=1.0, pan=0.5):
    # Humanising jitter can push an onset slightly before zero; a negative
    # index would wrap the slice to the end of the buffer instead of clipping.
    start = int(at * SR)
    if start < 0:
        sig, start = sig[-start:], 0
    length = min(len(sig), buf.shape[0] - start)
    if length <= 0:
        return
    buf[start:start + length, 0] += sig[:length] * gain * (1 - pan) * 2
    buf[start:start + length, 1] += sig[:length] * gain * pan * 2


def _impulse(seconds=1.9, decay=0.40, predelay=0.018):
    """A synthetic room: decaying noise, which is what a diffuse tail really is.

    A handful of discrete delay taps would be cheaper, but on piano you hear
    those as separate echoes rather than as a room.
    """
    n = int(seconds * SR)
    rng = np.random.default_rng(3)
    ir = rng.normal(0, 1, n) * np.exp(-np.arange(n) / (SR * decay))
    # Roll the top off the tail so it sits behind the notes.
    b = math.exp(-2 * math.pi * 3200 / SR)
    acc = 0.0
    for i in range(n):
        acc = (1 - b) * ir[i] + b * acc
        ir[i] = acc
    ir[: int(predelay * SR)] = 0
    ir /= np.sqrt((ir ** 2).sum())
    return ir


def reverb(x, wet=0.34):
    """Convolve each channel with the room, via FFT (direct convolution is far
    too slow at this length)."""
    ir = _impulse()
    size = 1 << int(math.ceil(math.log2(len(x) + len(ir))))
    tail = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size))[: len(x)]
    return x * (1 - wet) + tail * wet * 3.0


def lowshelf_soften(x, cutoff=5200):
    """One-pole lowpass twice - takes the glassy top off the additive tone."""
    a = math.exp(-2 * math.pi * cutoff / SR)
    y = np.empty_like(x)
    for _ in range(2):
        acc = 0.0
        for i in range(len(x)):
            acc = (1 - a) * x[i] + a * acc
            y[i] = acc
        x = y.copy()
    return x


def render(seconds):
    # Pick a bar count that lands the tempo in slow-ballad territory.
    bars = max(8, round(seconds / 3.85))
    bpm = bars * 4 * 60 / seconds
    while bpm > 74 and bars > 8:
        bars -= 1
        bpm = bars * 4 * 60 / seconds
    while bpm < 54:
        bars += 1
        bpm = bars * 4 * 60 / seconds
    beat = 60 / bpm
    bar = beat * 4

    n = int(seconds * SR) + int(3 * SR)  # headroom for the last note to ring
    buf = np.zeros((n, 2))
    rng = np.random.default_rng(11)

    for b in range(bars):
        root_name, chord, bass_name = PROGRESSION[b % len(PROGRESSION)]
        t0 = b * bar
        if t0 > seconds:
            break

        # Bass on the downbeat, held.
        add(buf, piano(freq(bass_name), 4.2, 0.95), t0, 0.52, 0.5)

        # Broken chord, the standard ballad accompaniment figure.
        tones = [freq(x) for x in chord]
        figure = [tones[0], tones[1], tones[2], tones[1],
                  tones[2] * 2, tones[1], tones[2], tones[1]]
        for i, f in enumerate(figure):
            when = t0 + i * beat / 2 + rng.normal(0, 0.006)  # human, not quantised
            vel = 0.5 if i % 2 else 0.66
            add(buf, piano(f, 2.4, vel), when, 0.30, 0.42 + 0.16 * (i % 3) / 2)

        # Pad underneath.
        for f in tones:
            add(buf, strings(f / 2, bar + 1.2, 0.5), t0, 0.075, 0.5)

        # Melody.
        for when, note in MELODY[b % len(MELODY)]:
            add(buf, piano(freq(note) * 2, 3.0, 0.8), t0 + when * beat, 0.21, 0.5)

    buf = buf[:int(seconds * SR)]
    for ch in range(2):
        buf[:, ch] = lowshelf_soften(reverb(buf[:, ch]))

    fi, fo = int(1.6 * SR), int(3.6 * SR)
    buf[:fi] *= np.linspace(0, 1, fi).reshape(-1, 1) ** 2
    buf[-fo:] *= np.linspace(1, 0, fo).reshape(-1, 1) ** 2

    peak = np.abs(buf).max()
    if peak > 0:
        # Lands around -20 LUFS: quiet enough to read over, loud enough that
        # platforms which don't normalise still play it at a sensible level.
        buf *= 0.50 / peak
    print(f'  {bars} bars @ {bpm:.1f} BPM', file=sys.stderr)
    return buf


# ---------------------------------------------------------------- drive style

DRIVE_CHORDS = [  # Am - F - C - G, one bar each
    ('A2', ['A3', 'C4', 'E4', 'A4']),
    ('F2', ['F3', 'A3', 'C4', 'F4']),
    ('C3', ['C4', 'E4', 'G4', 'C5']),
    ('G2', ['G3', 'B3', 'D4', 'G4']),
]


def _lp(x, cutoff, poles=2):
    """One-pole lowpass for short percussion buffers.

    These start as a difference of white noise, which is very nearly a
    differentiator: almost all of the energy lands at the top of the spectrum
    and reads as hiss rather than as an instrument. This puts each one back in
    its own band.
    """
    a = math.exp(-2 * math.pi * cutoff / SR)
    for _ in range(poles):
        out = np.empty_like(x)
        acc = 0.0
        for i in range(len(x)):
            acc = (1 - a) * x[i] + a * acc
            out[i] = acc
        x = out
    return x


def kick(dur=0.30):
    n = int(dur * SR)
    t = np.arange(n) / SR
    # Pitch drops fast from a click down to the body of the drum.
    f = 118 * np.exp(-t * 34) + 44
    body = np.sin(2 * math.pi * np.cumsum(f) / SR) * np.exp(-t * 15)
    click = np.random.default_rng(1).normal(0, 1, n) * np.exp(-t * 320) * 0.25
    return body + click


def hat(dur=0.07, seed=2):
    n = int(dur * SR)
    rng = np.random.default_rng(seed)
    x = np.diff(np.r_[0, rng.normal(0, 1, n)])
    x = _lp(x, 4200)
    return x * np.exp(-np.arange(n) / (SR * 0.011)) * 2.2


def pluck(f0, dur=0.42, vel=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    v = np.zeros(n)
    for k, a in ((1, 1.0), (2, 0.45), (3, 0.22), (4, 0.11), (5, 0.06)):
        v += a * np.sin(2 * math.pi * f0 * k * t)
    return v * np.exp(-t * 7.5) * (1 - np.exp(-t * 700)) * vel / 1.9


def bass(f0, dur=0.5, vel=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    v = np.sin(2 * math.pi * f0 * t) + 0.4 * np.sin(2 * math.pi * f0 * 2 * t)
    return v * np.exp(-t * 4.2) * (1 - np.exp(-t * 400)) * vel / 1.5


def render_drive(seconds):
    bpm = 104.0
    beat = 60 / bpm
    bar = beat * 4
    bars = max(4, int(math.ceil(seconds / bar)))

    n = int(seconds * SR) + int(2 * SR)
    buf = np.zeros((n, 2))
    rng = np.random.default_rng(5)

    for b in range(bars):
        t0 = b * bar
        if t0 > seconds:
            break
        root, tones = DRIVE_CHORDS[b % 4]
        # Layers enter one at a time so the track builds instead of starting flat.
        lv_kick = 0.0 if b < 2 else 1.0
        lv_bass = 0.0 if b < 3 else 1.0
        lv_hat = 0.0 if b < 5 else 1.0

        for k in range(4):
            if lv_kick:
                add(buf, kick(), t0 + k * beat, 0.62, 0.5)
            if lv_hat:
                add(buf, hat(seed=2 + b * 4 + k), t0 + k * beat + beat / 2, 0.30, 0.5)
        if lv_bass:
            for k in (0, 2):
                add(buf, bass(freq(root), vel=1.0), t0 + k * beat, 0.46, 0.5)

        # Eighth-note arpeggio, the part that actually carries the movement.
        pattern = [0, 1, 2, 3, 2, 1, 2, 3]
        for i, idx in enumerate(pattern):
            f = freq(tones[idx])
            vel = 0.9 if i % 2 == 0 else 0.62
            add(buf, pluck(f, vel=vel), t0 + i * beat / 2 + rng.normal(0, 0.004),
                0.30, 0.34 + 0.32 * (i % 3) / 2)

        for f in tones[:3]:
            add(buf, strings(freq(f) / 2, bar + 0.8, 0.5), t0, 0.045, 0.5)

    buf = buf[:int(seconds * SR)]
    for ch in range(2):
        buf[:, ch] = reverb(buf[:, ch], wet=0.20)

    fi, fo = int(0.35 * SR), int(1.8 * SR)
    buf[:fi] *= np.linspace(0, 1, fi).reshape(-1, 1)
    buf[-fo:] *= np.linspace(1, 0, fo).reshape(-1, 1) ** 1.5

    peak = np.abs(buf).max()
    if peak > 0:
        buf *= 0.62 / peak
    print(f'  drive: {bars} bars @ {bpm:.0f} BPM', file=sys.stderr)
    return buf


# --------------------------------------------------------------- bright style

# I-V-vi-IV in C. The bass note is separate because the fifth answers it.
BRIGHT_CHORDS = [
    ('C3', 'G3', ['C5', 'E5', 'G5', 'C6']),
    ('G2', 'D3', ['B4', 'D5', 'G5', 'B5']),
    ('A2', 'E3', ['A4', 'C5', 'E5', 'A5']),
    ('F2', 'C3', ['A4', 'C5', 'F5', 'A5']),
]

# Where the hits land inside a bar, in eighths. Off-beats are what make it
# bounce instead of march.
MARIMBA_PATTERN = [0, 1.5, 2, 3, 4, 5.5, 6, 7]
MELODY_PATTERN = [(0, 3), (1.5, 2), (3, 1), (4, 2), (5.5, 3), (7, 0)]


def marimba(f0, dur=0.7, vel=1.0):
    """Struck wood: odd harmonics, quick decay, a little knock at the onset."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    v = np.zeros(n)
    # a bar's overtones sit near the 4th and 10th partial, not the octave
    for mult, amp, dec in ((1.0, 1.0, 5.0), (3.9, 0.34, 12.0), (10.0, 0.05, 26.0)):
        v += amp * np.sin(2 * math.pi * f0 * mult * t) * np.exp(-t * dec)
    knock = np.random.default_rng(int(f0) % 97).normal(0, 1, n) * np.exp(-t * 420) * 0.12
    return (v + knock) * (1 - np.exp(-t * 900)) * vel / 1.7


def clap(dur=0.26, seed=4):
    """Three quick noise bursts, then a short tail - a hand clap, not a snare."""
    n = int(dur * SR)
    rng = np.random.default_rng(seed)
    x = rng.normal(0, 1, n)
    x = np.diff(np.r_[0, x])
    env = np.zeros(n)
    for off, amp in ((0.0, 1.0), (0.011, 0.8), (0.022, 0.65)):
        i = int(off * SR)
        env[i:] = np.maximum(env[i:], amp * np.exp(-np.arange(n - i) / (SR * 0.013)))
    env += 0.30 * np.exp(-np.arange(n) / (SR * 0.055))
    return _lp(x * env, 2200) * 7.0


def shaker(dur=0.06, seed=9, vel=1.0):
    n = int(dur * SR)
    rng = np.random.default_rng(seed)
    x = _lp(np.diff(np.r_[0, rng.normal(0, 1, n)]), 4600)
    return x * np.exp(-np.arange(n) / (SR * 0.009)) * 2.2 * vel


def bounce_bass(f0, dur=0.34, vel=1.0):
    n = int(dur * SR)
    t = np.arange(n) / SR
    v = np.sin(2 * math.pi * f0 * t) + 0.3 * np.sin(2 * math.pi * f0 * 2 * t)
    return v * np.exp(-t * 7.5) * (1 - np.exp(-t * 600)) * vel / 1.5


def render_bright(seconds):
    bpm = 124.0
    beat = 60 / bpm
    bar = beat * 4
    eighth = beat / 2
    bars = max(4, int(math.ceil(seconds / bar)))

    n = int(seconds * SR) + int(2 * SR)
    buf = np.zeros((n, 2))
    rng = np.random.default_rng(13)

    for b in range(bars):
        t0 = b * bar
        if t0 > seconds:
            break
        root, fifth, tones = BRIGHT_CHORDS[b % 4]
        full = b >= 2          # let the marimba open alone for two bars
        busy = b >= 4

        if full:
            for k in (0, 2):
                add(buf, kick(0.22), t0 + k * beat, 0.70, 0.5)
            for k in (1, 3):
                add(buf, clap(seed=4 + b * 4 + k), t0 + k * beat, 0.22, 0.5)
            add(buf, bounce_bass(freq(root)), t0, 0.62, 0.5)
            add(buf, bounce_bass(freq(fifth)), t0 + 2 * beat, 0.52, 0.5)
        if busy:
            for e in range(8):
                add(buf, shaker(seed=9 + b * 8 + e, vel=1.0 if e % 2 else 0.55),
                    t0 + e * eighth, 0.12, 0.42 + 0.16 * (e % 2))

        for i, pos in enumerate(MARIMBA_PATTERN):
            f = freq(tones[i % len(tones)])
            vel = 0.95 if pos == int(pos) else 0.66
            add(buf, marimba(f, vel=vel), t0 + pos * eighth + rng.normal(0, 0.004),
                0.48, 0.34 + 0.32 * (i % 3) / 2)

        if full:
            for pos, idx in MELODY_PATTERN:
                add(buf, marimba(freq(tones[idx]) * 2, dur=0.5, vel=0.55),
                    t0 + pos * eighth, 0.20, 0.5)

        for f in tones[:3]:
            add(buf, strings(freq(f) / 4, bar + 0.6, 0.5), t0, 0.035, 0.5)

    buf = buf[:int(seconds * SR)]
    for ch in range(2):
        buf[:, ch] = reverb(buf[:, ch], wet=0.16)

    fi, fo = int(0.25 * SR), int(1.4 * SR)
    buf[:fi] *= np.linspace(0, 1, fi).reshape(-1, 1)
    buf[-fo:] *= np.linspace(1, 0, fo).reshape(-1, 1) ** 1.4

    peak = np.abs(buf).max()
    if peak > 0:
        buf *= 0.62 / peak
    print(f'  bright: {bars} bars @ {bpm:.0f} BPM', file=sys.stderr)
    return buf


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else 'bgm.wav'
    seconds = float(sys.argv[2]) if len(sys.argv) > 2 else 45.0
    style = sys.argv[3] if len(sys.argv) > 3 else 'ballad'
    audio = (render_bright(seconds) if style == 'bright'
             else render_drive(seconds) if style == 'drive'
             else render(seconds))
    with wave.open(out, 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((audio * 32767).astype(np.int16).tobytes())
    print(f'{out}  {seconds:.1f}s  peak={np.abs(audio).max():.3f}  '
          f'rms={np.sqrt((audio ** 2).mean()):.4f}')


if __name__ == '__main__':
    main()
