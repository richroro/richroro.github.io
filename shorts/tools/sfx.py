"""Synthesize the short's sound effects (no samples, all numpy). Writes 44.1k stereo-ready mono WAVs."""
import sys, os, numpy as np, wave
SR = 44100
rng = np.random.default_rng(3)
out = sys.argv[1]; os.makedirs(out, exist_ok=True)

def t_(d): return np.arange(int(d * SR)) / SR
def env_exp(d, k): return np.exp(-t_(d) * k)
def norm(x, peak=0.9): return x / (np.abs(x).max() + 1e-9) * peak
def lp(x, a):  # one-pole low-pass, a in (0,1): higher = brighter
    y = np.zeros_like(x); acc = 0.0
    for i, v in enumerate(x): acc += a * (v - acc); y[i] = acc
    return y
def hp(x, a): return x - lp(x, a)
def save(name, x):
    x = np.clip(x, -1, 1)
    with wave.open(f"{out}/{name}.wav", "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())

# 찰칵 — camera shutter: two mechanical clicks + a short filtered noise "whirr"
def shutter():
    x = np.zeros(int(0.32 * SR))
    for at, amp, dec in ((0.0, 1.0, 380), (0.075, 0.75, 300)):
        n = rng.standard_normal(int(0.06 * SR)) * env_exp(0.06, dec) * amp
        n = hp(n, 0.35) + 0.35 * np.sin(2 * np.pi * 2300 * t_(0.06)) * env_exp(0.06, 500)
        i = int(at * SR); x[i:i + len(n)] += n
    whirr = rng.standard_normal(int(0.12 * SR)) * np.sin(np.pi * np.linspace(0, 1, int(0.12 * SR))) * 0.12
    i = int(0.02 * SR); x[i:i + len(whirr)] += lp(whirr, 0.25)
    return norm(x, 0.85)

# 휙 — whoosh: band-passed noise with a rising-then-falling sweep
def whoosh(d=0.38, up=True):
    n = rng.standard_normal(int(d * SR)); tt = np.linspace(0, 1, len(n))
    shape = np.sin(np.pi * tt) ** 1.6
    a = 0.04 + 0.32 * (tt if up else 1 - tt)
    y = np.zeros_like(n); acc = 0.0; acc2 = 0.0
    for i, v in enumerate(n):
        acc += a[i] * (v - acc); acc2 += 0.5 * a[i] * (acc - acc2); y[i] = acc - acc2 * 0.6
    return norm(y * shape, 0.7)

# 뿅 — pop: sine blip with fast pitch drop
def pop(f0=900, f1=260, d=0.12):
    tt = t_(d); f = f1 + (f0 - f1) * np.exp(-tt * 40)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return norm(np.sin(ph) * env_exp(d, 30) * (1 - np.exp(-tt * 2000)), 0.8)

# 띠링 — ding: bell partials
def ding(f=1318.5, d=0.9):
    tt = t_(d); x = sum(a * np.sin(2 * np.pi * f * m * tt) * np.exp(-tt * k) for m, a, k in ((1, 1, 4), (2.76, .35, 7), (5.4, .18, 11), (8.9, .08, 16)))
    return norm(x * (1 - np.exp(-tt * 3000)), 0.7)

# 톡 — chat bubble send (Kakao-ish): two quick soft blips
def bubble():
    x = np.zeros(int(0.2 * SR))
    for at, f in ((0.0, 1046.5), (0.06, 1568)):
        b = np.sin(2 * np.pi * f * t_(0.09)) * env_exp(0.09, 45)
        i = int(at * SR); x[i:i + len(b)] += b
    return norm(x, 0.6)

# 타닥 — keyboard typing burst (n keys)
def typing(n=8, gap=0.07):
    x = np.zeros(int((n * gap + 0.1) * SR))
    for k in range(n):
        c = rng.standard_normal(int(0.025 * SR)) * env_exp(0.025, 260)
        c = hp(c, 0.5) * (0.6 + 0.4 * rng.random())
        i = int((k * gap + rng.uniform(-0.01, 0.01)) * SR); i = max(0, i); x[i:i + len(c)] += c
    return norm(x, 0.5)

# 쿵 — impact boom: sine drop + noise thump
def boom(d=1.1):
    tt = t_(d); f = 45 + 90 * np.exp(-tt * 9)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 3.2)
    n = lp(rng.standard_normal(len(tt)), 0.06) * np.exp(-tt * 14) * 2.5
    return norm(np.tanh((s + n) * 1.6), 0.95)

# 두근 — heartbeat (lub-dub)
def heartbeat():
    x = np.zeros(int(0.7 * SR))
    for at, amp in ((0.0, 1.0), (0.2, 0.7)):
        tt = t_(0.18); s = np.sin(2 * np.pi * (50 + 30 * np.exp(-tt * 30)) * tt) * np.exp(-tt * 22) * amp
        i = int(at * SR); x[i:i + len(s)] += s
    return norm(x, 0.9)

# 끼익 — record scratch: noise + wobbling pitch
def scratch(d=0.45):
    tt = t_(d); f = 300 + 900 * np.abs(np.sin(2 * np.pi * 3.2 * tt)) * np.exp(-tt * 2)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.6 + hp(rng.standard_normal(len(tt)), 0.3) * 0.5
    return norm(s * np.exp(-tt * 3) * (1 - np.exp(-tt * 400)), 0.75)

# 띠용 — boing: vibrato pitch bend
def boing(d=0.5):
    tt = t_(d); f = 220 + 260 * np.exp(-tt * 6) + 18 * np.sin(2 * np.pi * 14 * tt)
    return norm(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 5) * (1 - np.exp(-tt * 800)), 0.7)

# 촤라락 — riser: noise + rising tone into the drop
def riser(d=1.4):
    tt = t_(d); f = 200 * (8 ** (tt / d))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.25 + hp(rng.standard_normal(len(tt)), 0.2) * 0.35
    return norm(s * (tt / d) ** 2.2, 0.6)

# 딸깍 — mouse click
def click():
    c = hp(rng.standard_normal(int(0.03 * SR)), 0.6) * env_exp(0.03, 300) + 0.4 * np.sin(2 * np.pi * 3200 * t_(0.03)) * env_exp(0.03, 400)
    return norm(c, 0.6)

# 짠 — success sting: quick major arpeggio (C E G C)
def tada():
    x = np.zeros(int(0.9 * SR))
    for k, f in enumerate((523.25, 659.25, 783.99, 1046.5)):
        tt = t_(0.6); b = (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(4 * np.pi * f * tt)) * np.exp(-tt * 6)
        i = int(k * 0.055 * SR); x[i:i + len(b)] += b
    return norm(x, 0.7)

# 띠-딩 — cash register "월급 0원"
def coin():
    x = np.zeros(int(0.5 * SR))
    for at, f in ((0.0, 987.77), (0.08, 1318.5)):
        tt = t_(0.42); b = np.sin(2 * np.pi * f * tt) * np.exp(-tt * 9) + 0.3 * np.sin(2 * np.pi * f * 2.01 * tt) * np.exp(-tt * 14)
        i = int(at * SR); x[i:i + len(b)] += b
    return norm(x, 0.6)

for name, fn in [("shutter", shutter), ("whoosh", whoosh), ("whoosh_dn", lambda: whoosh(0.3, False)), ("pop", pop), ("pop_hi", lambda: pop(1400, 500, 0.1)),
                 ("ding", ding), ("bubble", bubble), ("typing", typing), ("boom", boom), ("heartbeat", heartbeat), ("scratch", scratch),
                 ("boing", boing), ("riser", riser), ("click", click), ("tada", tada), ("coin", coin)]:
    save(name, fn()); print("sfx", name)
