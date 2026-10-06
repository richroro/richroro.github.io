"""효과음·배경음을 코드로 합성한다 (저작권 걱정 없음, 네트워크 불필요).

효과음: pop(강조 자막) · whoosh(자료화면 전환) · ding(인트로 제목) · click · swoosh_up
배경음: 잔잔한 4코드 패드 + 가벼운 비트. 사용자가 음악 파일을 주면 그걸 쓴다.
"""
from __future__ import annotations

import numpy as np

SR = 48000


def _env(n: int, attack: float, release: float) -> np.ndarray:
    t = np.arange(n) / SR
    return np.minimum(1, t / max(attack, 1e-4)) * np.exp(-t / max(release, 1e-4))


def _noise(n: int, seed: int) -> np.ndarray:
    return np.random.RandomState(seed).uniform(-1, 1, n)


def _lowpass(x: np.ndarray, cutoff: np.ndarray | float) -> np.ndarray:
    """1차 저역통과. cutoff 는 샘플마다 바뀌어도 된다(스윕)."""
    c = np.broadcast_to(np.asarray(cutoff, dtype=float), x.shape)
    a = 1 - np.exp(-2 * np.pi * c / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):  # 효과음은 짧아서 파이썬 루프로 충분
        acc += a[i] * (x[i] - acc)
        y[i] = acc
    return y


def pop() -> np.ndarray:
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    f = 900 * np.exp(-t * 25) + 380
    ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) * _env(n, 0.002, 0.035)) * 0.9


def click() -> np.ndarray:
    n = int(0.03 * SR)
    return _noise(n, 3) * _env(n, 0.0005, 0.004) * 0.6


def whoosh(dur: float = 0.45) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    shape = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.6
    cutoff = 400 + 5000 * np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 2
    y = _lowpass(_noise(n, 7), cutoff) * shape
    return y / (np.abs(y).max() + 1e-9) * 0.7


def swoosh_up(dur: float = 0.35) -> np.ndarray:
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = _lowpass(_noise(n, 11), 300 + 7000 * (t / dur) ** 2) * (t / dur) ** 1.2 * np.exp(-((t - dur) ** 2) / 0.002)
    return y / (np.abs(y).max() + 1e-9) * 0.6


def ding() -> np.ndarray:
    n = int(1.1 * SR)
    t = np.arange(n) / SR
    y = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t * d) for f, a, d in
            [(1318.5, 1.0, 4.0), (2637, 0.35, 6.0), (3955, 0.15, 9.0), (1975.5, 0.25, 5.0)])
    return y * _env(n, 0.003, 10) / 1.6 * 0.6


SFX = {"pop": pop, "click": click, "whoosh": whoosh, "swoosh_up": swoosh_up, "ding": ding}


def sfx(name: str) -> np.ndarray:
    if name not in SFX:
        raise ValueError(f"모르는 효과음: {name} (가능: {', '.join(SFX)})")
    return SFX[name]()


def bgm(duration: float, bpm: int = 84, seed: int = 1) -> np.ndarray:
    """잔잔한 배경음 (스테레오 [n, 2]). Cmaj7 - Am7 - Fmaj7 - G6, 마디마다 한 코드."""
    n = int(duration * SR)
    t = np.arange(n) / SR
    beat = 60 / bpm
    bar = beat * 4
    chords = [[261.6, 329.6, 392.0, 493.9], [220.0, 261.6, 329.6, 392.0],
              [174.6, 220.0, 261.6, 329.6], [196.0, 246.9, 293.7, 329.6]]
    idx = (t // bar).astype(int) % 4
    pos = t % bar
    pad = np.zeros(n)
    for k in range(4):
        notes = np.array(chords[k])
        m = idx == k
        if not m.any():
            continue
        tt = t[m]
        v = sum(np.sin(2 * np.pi * f * tt + 0.3 * np.sin(2 * np.pi * 0.2 * tt)) +
                0.3 * np.sin(2 * np.pi * 2 * f * tt) for f in notes) / len(notes)
        pad[m] = v
    swell = np.minimum(1, pos / 0.6) * np.minimum(1, (bar - pos) / 0.4)
    pad *= 0.35 * swell
    bass_f = np.array([65.4, 55.0, 87.3, 98.0])[idx]
    bass = 0.35 * np.sin(2 * np.pi * np.cumsum(bass_f) / SR) * np.exp(-(t % (beat * 2)) * 3)
    kick_t = t % beat
    kick = 0.5 * np.sin(2 * np.pi * (50 + 90 * np.exp(-kick_t * 40)) * kick_t) * np.exp(-kick_t * 18)
    kick *= ((t // beat).astype(int) % 2 == 0)
    hat_t = (t + beat / 2) % beat
    hat = 0.05 * np.random.RandomState(seed).uniform(-1, 1, n) * np.exp(-hat_t * 70)
    y = pad + bass + kick + hat
    y = np.tanh(y * 0.9) * 0.6
    left = y + 0.04 * np.roll(pad, int(0.012 * SR))
    right = y + 0.04 * np.roll(pad, int(0.019 * SR))
    return np.stack([left, right], axis=1)
