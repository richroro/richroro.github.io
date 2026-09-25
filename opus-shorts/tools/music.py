"""한 줄의 프롬프트 — 배경음악·효과음 합성 (numpy 만 사용, 샘플 파일 없음)
타이밍은 anim.js 의 장면 시간과 맞춰 두었다.
    python3 music.py out.wav
"""
import sys, wave
import numpy as np

SR = 44100
DUR = 31.0
N = int(SR * DUR)
out = np.zeros(N)
rng = np.random.default_rng(3)

BPM = 150
BEAT = 60 / BPM          # 0.4s
E8 = BEAT / 2


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def tt(d):
    return np.arange(int(SR * d)) / SR


def env(n, a=.005, r=.1, hold=None):
    """a 초 동안 올라갔다가 r 시간상수로 지수 감쇠"""
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(a, 1e-4))
    if hold is None:
        return e * np.exp(-t / r)
    return e * np.where(t < hold, 1, np.exp(-(t - hold) / r))


def add(t0, sig, gain=1.0):
    i = int(t0 * SR)
    if i >= N:
        return
    j = min(N, i + len(sig))
    out[i:j] += sig[:j - i] * gain


def square(f, d, duty=.5):
    ph = np.cumsum(np.full(int(SR * d), f) if np.isscalar(f) else f) / SR
    return np.where((ph % 1) < duty, 1.0, -1.0)


def tri(f, d):
    ph = np.cumsum(np.full(int(SR * d), f) if np.isscalar(f) else f) / SR
    return 2 * np.abs(2 * (ph % 1) - 1) - 1


def sine(f, d):
    ph = np.cumsum(np.full(int(SR * d), f) if np.isscalar(f) else f) / SR
    return np.sin(2 * np.pi * ph)


def saw(f, d):
    ph = np.cumsum(np.full(int(SR * d), f) if np.isscalar(f) else f) / SR
    return 2 * (ph % 1) - 1


def lp(x, cut):
    """한 극 로우패스"""
    a = np.exp(-2 * np.pi * cut / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc = (1 - a) * x[i] + a * acc
        y[i] = acc
    return y


def hp(x, cut):
    return x - lp(x, cut)


def noise(d):
    return rng.uniform(-1, 1, int(SR * d))


def sweep(f0, f1, d, curve=2.0):
    p = np.linspace(0, 1, int(SR * d))
    return f0 * (f1 / f0) ** (p ** (1 / curve) if f1 > f0 else p)


# ---------- 악기 ----------
def kick(t0, g=.9):
    d = .28
    f = 45 + 110 * np.exp(-tt(d) / .03)
    add(t0, sine(f, d) * env(int(SR * d), .001, .09), g)


def snare(t0, g=.35):
    d = .2
    n = hp(noise(d), 1500) * env(int(SR * d), .001, .05)
    b = sine(190, d) * env(int(SR * d), .001, .04)
    add(t0, n + .5 * b, g)


def hat(t0, g=.12, open_=False):
    d = .18 if open_ else .05
    add(t0, hp(noise(d), 7000) * env(int(SR * d), .001, .06 if open_ else .015), g)


def pluck(t0, m, d=.18, g=.16, duty=.25):
    s = square(hz(m), d, duty) * env(int(SR * d), .002, d * .45)
    add(t0, lp(s, 5000), g)


def bass(t0, m, d=.19, g=.22):
    s = tri(hz(m), d) * .8 + square(hz(m), d, .5) * .2
    add(t0, s * env(int(SR * d), .003, .5, hold=d * .7), g)


def bell(t0, f, g=.2, r=.5):
    d = r * 4
    s = sine(f, d) + .5 * sine(f * 2.76, d) + .25 * sine(f * 5.4, d)
    add(t0, s * env(int(SR * d), .001, r), g)


def pad(t0, notes, d, g=.08, cut=1200, a=.4):
    n = int(SR * d)
    s = np.zeros(n)
    for m in notes:
        for det in (-.08, .08):
            s += saw(hz(m + det), d)
    e = np.minimum(1, np.arange(n) / (SR * a)) * np.minimum(1, (n - np.arange(n)) / (SR * .4))
    add(t0, lp(s, cut) * e / len(notes), g)


def whoosh(t0, d, f0, f1, g=.25):
    n = noise(d)
    fs = sweep(f0, f1, d)
    # 대역을 흉내: 스윕 사인으로 링 변조한 노이즈를 로우패스
    s = lp(n * sine(fs, d), 3000) * np.sin(np.linspace(0, np.pi, len(n)))
    add(t0, s, g)


def blip(t0, f0, f1, d, g=.15, duty=.5):
    s = square(sweep(f0, f1, d), d, duty) * env(int(SR * d), .002, d * .6)
    add(t0, lp(s, 6000), g)


# ---------- 1장: 터미널 (0–4.3) ----------
pad(0.0, [48, 55, 64, 71], 4.6, g=.13, cut=900, a=1.2)
TYPED_LEN = 12
for i in range(TYPED_LEN):
    t0 = .6 + i * (2.0 / TYPED_LEN) + .01
    d = .03
    add(t0, hp(noise(d), 3000) * env(int(SR * d), .0005, .006), .55)
    add(t0, sine(2400 + 200 * (i % 3), .02) * env(int(SR * .02), .0005, .004), .08)
add(3.0, hp(noise(.05), 1500) * env(int(SR * .05), .0005, .012), .5)   # 엔터
bell(3.02, hz(88), .16, .35)
bell(3.1, hz(95), .1, .35)
for k, t0 in enumerate([3.25, 3.5, 3.75]):
    pluck(t0, 79 + k * 2, .1, .06, .5)
pluck(3.85, 84, .12, .1, .5)
pluck(3.95, 88, .2, .1, .5)

# ---------- 2장: 커서가 깨어난다 (4.3–9.0) ----------
d = .6
add(4.35, sine(sweep(1800, 250, d), d) * np.linspace(.2, 1, int(SR * d)), .12)   # 떨어지는 휘파람
kick(4.95, 1.0)
add(4.95, lp(noise(.25), 800) * env(int(SR * .25), .001, .06), .3)
for i, m in enumerate([72, 76, 79, 84, 88, 91, 96]):                           # 변신 반짝
    pluck(5.2 + i * .1, m, .25, .1, .5)
whoosh(5.2, .7, 400, 4000, .12)
blip(5.95, 500, 1400, .12, .18)                                                 # 뽁
bell(6.0, hz(96), .08, .4)
for i, t0 in enumerate([6.4, 6.9, 7.35]):                                       # 두리번
    blip(t0, 900 - i * 60, 700 - i * 60, .06, .05)
blip(7.8, 1046, 1568, .09, .16, .25)                                            # 느낌표
blip(7.9, 1568, 2093, .09, .14, .25)
pad(4.3, [45, 52, 60, 64], 4.8, g=.1, cut=1000, a=1.5)
# 기대감: 6.0 부터 은은한 아르페지오
arp = [60, 64, 67, 72, 67, 64]
t0 = 6.0
i = 0
while t0 < 8.8:
    pluck(t0, arp[i % len(arp)] + (5 if t0 > 7.6 else 0), .12, .045, .5)
    t0 += E8
    i += 1
add(8.0, lp(noise(1.0), 6000) * np.linspace(0, 1, SR) ** 2, .12)                 # 라이저
blip(8.6, 200, 800, .4, .08)

# ---------- 그루브 ----------
CHORDS = [36, 33, 29, 31]          # C Am F G 근음
PADS = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]]
LEAD = [
    [76, None, 79, None, 84, None, 83, 79],
    [81, None, 84, None, 88, None, 86, 84],
    [77, 81, 84, 81, 77, None, 81, 84],
    [86, None, 83, None, 79, 81, 83, 86],
]
LEAD2 = [                           # 새벽 파트: 한 옥타브 위 변주
    [84, 88, 91, 88, 96, None, 95, 91],
    [93, None, 96, 93, 100, None, 98, 96],
    [89, 93, 96, 93, 101, None, 100, 96],
    [98, None, 95, 91, 98, 100, 103, None],
]


def groove(start, end, lead, bright=False):
    step = 0
    t0 = start
    while t0 < end - 1e-6:
        bar = (step // 8) % 4
        s8 = step % 8
        if s8 % 2 == 0:
            kick(t0, .8)
        if s8 in (2, 6):
            snare(t0, .3)
        hat(t0 + (0.0 if s8 % 2 == 0 else .01), .09 if s8 % 2 else .06, open_=(s8 == 7))
        root = CHORDS[bar]
        bass(t0, root + (12 if s8 % 2 else 0), .19, .24)
        m = lead[bar][s8]
        if m is not None:
            pluck(t0, m, .19, .11 if not bright else .09, .25)
            if bright:
                pluck(t0 + .005, m - 12, .19, .05, .5)
        if s8 == 0:
            pad(t0, [n + 12 for n in PADS[bar]], min(1.6, end - t0), g=.05, cut=2200, a=.05)
        t0 += E8
        step += 1


# ---------- 3장: 세계를 짓는다 (9.0–16.0) ----------
groove(9.0, 16.0, LEAD)
POPS = [84, 86, 88, 91, 93, 96, 98, 100]
for k in range(8):
    s = 9.2 + k * .8
    blip(s, 260, 720, .13, .12, .5)                     # 톡 (도약)
    add(s + .5, sine(sweep(160, 60, .08), .08) * env(int(SR * .08), .001, .03), .35)   # 착지
    pop = s + .5 + .32
    blip(pop, hz(POPS[k]) * .5, hz(POPS[k]), .05, .1, .25)
    bell(pop + .02, hz(POPS[k]), .07, .25)
bell(15.7, hz(96), .12, .5)
bell(15.78, hz(100), .1, .5)

# ---------- 4장: 버그 (16.0–19.0) ----------
d = .45                                                  # 테이프 멈춤
add(16.0, lp(saw(sweep(hz(60), 30, d), d), 1500) * np.linspace(1, 0, int(SR * d)), .25)
d = 2.5
drone = lp(saw(55 + 3 * np.sin(2 * np.pi * 6 * tt(d)), d) + saw(55.7, d), 600)
add(16.2, drone * np.minimum(1, tt(d) / .3) * np.minimum(1, (d - tt(d)) / .1), .12)
t0 = 16.0
while t0 < 17.3:                                         # 버그 발소리
    add(t0, hp(noise(.012), 4000) * env(int(SR * .012), .0005, .003), .18)
    t0 += 1 / 13
for t0 in [16.35, 16.62, 17.05, 17.4, 17.85, 18.2]:     # 지직
    d = .09 + rng.uniform(0, .08)
    crushed = np.repeat(noise(d)[::12], 12)[:int(SR * d)]
    add(t0, crushed * np.sign(sine(90, d)), .12)
for i, t0 in enumerate([16.5, 16.85, 17.2]):             # 에러 칩
    blip(t0, 220 - i * 20, 180 - i * 20, .12, .12, .5)
add(17.8, lp(saw(sweep(80, 400, .4), .4), 2000) * np.linspace(0, 1, int(SR * .4)), .12)   # 기합
whoosh(18.15, .38, 300, 3000, .35)                       # 돌진
kick(18.5, 1.3)                                          # 쾅
add(18.5, lp(noise(.8), 5000) * env(int(SR * .8), .001, .25), .45)
add(18.5, square(sweep(300, 70, .3), .3) * env(int(SR * .3), .001, .1), .25)
for i, m in enumerate([84, 88, 91, 96]):                 # 해결 징글
    pluck(19.0 + i * .075, m, .22, .14, .5)
bell(19.3, hz(96), .12, .6)
for i in range(5):                                       # 나비 반짝
    bell(18.7 + i * .45, hz(100 + (i % 3) * 3), .035, .3)

# ---------- 5장: 새벽 + 펠리컨 (19.6–27.0) ----------
groove(19.6, 22.8, LEAD)
groove(22.8, 27.0, LEAD2, bright=True)
for t0 in [23.0, 23.22]:                                 # 따릉따릉
    bell(t0, 2100, .12, .12)
    bell(t0 + .005, 2780, .08, .1)
blip(24.05, 300, 1400, .45, .12, .5)                     # 점프
whoosh(24.1, .8, 600, 5000, .15)
add(24.95, hp(noise(.1), 800) * env(int(SR * .1), .001, .03), .35)   # 착지 + 폭죽
kick(24.95, .6)
r2 = np.random.default_rng(9)
for i in range(18):
    bell(24.95 + r2.uniform(0, 1.2), hz(int(r2.choice([84, 88, 91, 96, 100, 103]))), .03, .15)
for t0 in (25.5, 26.0):
    blip(t0, 400, 900, .12, .1, .5)

# ---------- 6장: 엔딩 (27.0–31.0) ----------
add(27.0, hp(noise(2.0), 5000) * env(int(SR * 2.0), .001, .6), .18)   # 심벌
kick(27.0, 1.0)
pad(27.0, [48, 55, 60, 64, 67, 72], 4.0, g=.16, cut=1800, a=.02)
bass(27.0, 36, 3.0, .25)
whoosh(27.55, .5, 500, 4000, .15)
for i, m in enumerate([72, 76, 79, 84, 88, 91, 96, 100]):
    pluck(27.7 + i * .14, m, .3, .07, .5)
for i, t0 in enumerate([28.5, 28.68]):
    blip(t0, 800 + i * 200, 1600 + i * 300, .08, .12, .25)
for i in range(6):
    bell(28.9 + i * .3, hz([96, 100, 103, 108, 103, 100][i]), .05, .5)

# ---------- 마스터 ----------
fade = np.ones(N)
f0 = int(30.3 * SR)
fade[f0:] = np.linspace(1, 0, N - f0) ** 1.5
fade[:int(.05 * SR)] = np.linspace(0, 1, int(.05 * SR))
x = out * fade
x = np.tanh(x * 1.4) / np.tanh(1.4)
x = x / np.max(np.abs(x)) * .89
st = np.stack([x, x], axis=1)
pcm = (st * 32767).astype('<i2')
with wave.open(sys.argv[1] if len(sys.argv) > 1 else 'music.wav', 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('ok', len(x) / SR, 's')
