"""Write the wordless road cartoons drive1~10 (shorts/<id>/edit.json + script.json) from the shot lists below.

usage: python3 drive_eps.py [id ...]       then for each id: python3 voice_edge.py <id> && python3 prep.py <id> && ./render.sh <id> final/<id>.mp4
No narration and no captions: a 16:9 picture ("frame": "wide") between a Korean title over it and an English line under it
("titleEn"), close-ups of the drivers' faces (gfx road view "face") cut against 3D car shots (view "car"), sound effects
and music only. Every shot is (seconds, view, options); times inside a shot are seconds since the shot started.
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))

# the cast (drawn here, nobody real): the heroes stay the same across the series, the villains change
HERO = dict(skin="#FFD9B0", hair="short", hairColor="#2a2320", shirt="#FFD84D")
HEROINE = dict(skin="#FFE0C0", hair="bob", hairColor="#5a3a22", shirt="#FF9EBB")
COP = dict(skin="#F2C49B", hair="cap", cap="#1d2a5a", shirt="#1d2a5a", beard="mustache", hairColor="#2a2320")
TRUCKER = dict(skin="#E8B48A", hair="cap", cap="#2f6d3a", beard="full", hairColor="#4a3020", shirt="#7a8a99")

def F(dur, driver, mood, moods=(), **kw):
    """a face close-up"""
    return (dur, dict(view="face", driver=dict(driver, mood=mood, moods=[list(m) for m in moods]), **kw))

def C(dur, cam, cars, **kw):
    """a 3D car shot"""
    return (dur, dict(view="car", cam=cam, cars=cars, **kw))

def car(kind, color, lane, z, driver=None, mood="neutral", moods=(), **kw):
    d = dict(kind=kind, lane=lane, z=z, **({"color": color} if color else {}), **kw)
    if driver: d["driver"] = dict(driver, mood=mood, moods=[list(m) for m in moods])
    return d

def queue(lane, zs, colors, kind="car", **kw):
    return [car(kind, colors[i % len(colors)], lane, z, **kw) for i, z in enumerate(zs)]

TRAFFIC = ["#E8E8E8", "#8FD3FF", "#B9F27C", "#FFB36B", "#C9A7FF", "#9aa0a8"]

EPS = {}

# ── 1. 감히 경차를 무시해? (R2 감히 경차가 추월을?) — the SUV that bullied a tiny car misses its exit ──
V1 = dict(skin="#F0C090", hair="slick", hairColor="#1d1a18", beard="stubble", shirt="#2b2f38")
H1 = dict(HEROINE)
SUV, TINY = "#2b2f38", "#B9F27C"
EPS["drive1"] = dict(
    title=["감히 경차를 무시해?", ""], en="How dare you ignore a tiny car?", music="music/sneaky_snitch.mp3",
    shots=[
        F(1.4, V1, "smug", [(0.6, "grin")], flip=True, car=SUV, ahead=dict(kind="tiny", color=TINY, size=0.8), honk=[0.5], zoom=[1.0, 1.06]),
        C(1.8, "rearR", [car("suv", SUV, 3, 0, V1, "grin", honk=[0.3], marks=[[0.6, "anger"]]), car("tiny", TINY, 3, 6.8, H1, "eek", brake=[[0.4, 1.0]]),
                         car("truck", "#4DA3FF", 2, 30)], follow=0),
        F(1.6, H1, "eek", [(0.9, "scared")], car=TINY, glare=[[0.3, 0.6]], marks=[[0.4, "!"]], shake=[0.35]),
        C(2.0, "rearL", [car("tiny", TINY, 3, 0, H1, "scared"), car("suv", SUV, 3, -7, V1, "grin", path=[[0.2, 2, -4, 0.7], [0.9, 2, 16, 1.1]], fast=[0.5, 2.0])], follow=0),
        F(1.6, V1, "laugh", flip=True, car=SUV, speed=2600, peer=dict(kind="tiny", color=TINY, driver=dict(H1, mood="sad"), x0=1300, x1=2700, dur=1.4), streaks=[0, 1.6]),
        F(1.6, H1, "side", [(0.8, "cool")], car=TINY, ahead=dict(kind="suv", color=SUV, size=0.45, to=0.15, toAt=0.2)),
        C(2.2, "high", [car("tiny", TINY, 3, 0, H1, "cool", blink="R", blinkAt=0.6), car("suv", SUV, 2, 35, V1, "smug", fast=[0, 2.2])], follow=0, exit=dict(z=150),
          signs=[dict(z=60, kind="exit", text="1km")]),
        F(1.8, V1, "smug", [(0.9, "side"), (1.25, "shock")], flip=True, car=SUV, marks=[[1.25, "?!"]], dun=[1.25]),
        C(2.4, "rearL", [car("suv", SUV, 2, 0, V1, "shock", blink="R", blinkAt=0.2, brake=[[0.6, 1.4]], marks=[[0.9, "sweat"]]),
                         car("truck", "#FFB36B", 3, -3, TRUCKER, "bored"), car("tiny", TINY, 3, 22, H1, "happy", path=[[0.3, 4.6, 46, 2.0]], blink="R")],
          follow=0, exit=dict(z=40), speed=24),
        F(1.8, H1, "happy", car=TINY, speed=900, marks=[[0.5, "note"]], zoom=[1.0, 1.06]),
        C(2.2, "high", [car("suv", SUV, 2, 0, V1, "cry"), car("tiny", TINY, 4.3, 18, path=[[0, 6.5, 40, 2.2]]), car("truck", "#FFB36B", 3, -4)],
          follow=0, exit=dict(z=-10)),
        F(1.8, V1, "shock", [(0.5, "sad")], flip=True, car=SUV, dun=[0.3]),
        C(2.4, "rearR", [car("suv", SUV, 2, 0, V1, "sad", marks=[[0.5, "sweat"]])], follow=0, signs=[dict(z=40, kind="exit", text="32km")]),
        F(2.6, V1, "cry", flip=True, car=SUV, zoom=[1.0, 1.12], speed=1800),
    ],
    sfx=[(0.5, "horn", 0.8), (1.7, "horn", 0.8), (3.5, "horn", 0.7), (5.3, "engine", 0.8), (6.5, "engine", 0.5), (13.0, "dundun", 0.9),
         (14.2, "squeal", 0.6), (20.3, "dundun", 0.9)],
)

# ── 2. 합류 끝까지 달린 차의 최후 (R1 합류구간 새치기) — the last-second merger ends up behind the slowest truck ──
V2 = dict(skin="#FFD3A8", hair="spiky", hairColor="#d9a420", shirt="#FF5C5C")
RED = "#FF5C5C"
def jam(lane, z0, n, gap=9.5, **kw):
    return queue(lane, [z0 + i * gap for i in range(n)], TRAFFIC, **kw)
EPS["drive2"] = dict(
    title=["합류 끝까지 달린 차의 최후", ""], en="The Last-Second Merger", music="music/hustle.mp3",
    shots=[
        F(1.4, V2, "grin", flip=True, car=RED, speed=2600, peer=dict(kind="car", color="#8FD3FF", x0=1100, x1=2700, dur=1.2), streaks=[0, 1.4]),
        C(2.0, "rearR", [car("sports", RED, 3, 0, V2, "grin", fast=[0, 2])] + jam(2, -20, 7, vz=-14), follow=0, speed=20,
          laneEnd=dict(lane=3, z0=150, z1=200), signs=[dict(z=40, kind="merge")]),
        F(1.8, HERO, "bored", [(0.9, "side")], car="#4DA3FF", speed=250, peer=dict(kind="sports", color=RED, x0=2500, x1=-500, at=0.3, dur=0.6), marks=[[1.0, "?"]]),
        C(1.8, "rearR", [car("sports", RED, 3, -14, V2, "grin", path=[[0, 3, 30, 1.4]], brake=[[1.0, 9]], blink="L", blinkAt=1.3)] + jam(2, -12, 6), speed=6,
          laneEnd=dict(lane=3, z0=40, z1=70)),
        F(1.8, V2, "shock", [(0.8, "eek")], flip=True, car=RED, speed=0, peer=dict(kind="car", color="#B9F27C", x0=2400, x1=-400, dur=1.8), marks=[[0.3, "?!"]], shake=[0.05]),
        C(1.8, "rearL", [car("sports", RED, 3, 0, V2, "eek", blink="L", brake=True)] + jam(2, -16, 6, vz=6), speed=0,
          laneEnd=dict(lane=3, z0=4, z1=34)),
        F(1.8, HERO, "cool", car="#4DA3FF", speed=350, peer=dict(kind="sports", color=RED, driver=dict(V2, mood="sad"), x0=700, x1=2500, dur=1.8), marks=[[0.6, "note"]]),
        F(2.0, V2, "yell", [(1.2, "angry")], flip=True, car=RED, speed=0, honk=[0.3, 0.8], peer=dict(kind="car", color="#E8E8E8", x0=2400, x1=-400, dur=2.0)),
        C(2.0, "side", [car("sports", RED, 3, 0, V2, "angry", blink="L", brake=True, marks=[[0.4, "anger"]])] + jam(2, -14, 5, vz=6), speed=0,
          laneEnd=dict(lane=3, z0=4, z1=34)),
        F(1.8, V2, "sad", flip=True, car=RED, speed=0, peer=dict(kind="work", color="#FFB000", x0=2600, x1=1500, dur=1.6), marks=[[1.2, "sweat"]]),
        C(2.4, "rearR", [car("sports", RED, 3, 0, V2, "sad", blink="L", brake=[[0, 1.2]], path=[[1.2, 2, 2, 1.2]]), car("work", "#FFB000", 2, -6, path=[[0, 2, 8, 1.4]])],
          follow=0, speed=0, laneEnd=dict(lane=3, z0=4, z1=34)),
        C(2.0, "rear", [car("sports", RED, 2, 0, V2, "cry"), car("work", "#FFB000", 2, 8)], follow=0, speed=4),
        F(1.8, V2, "cry", flip=True, car=RED, speed=150, ahead=dict(kind="truck", color="#FFB000", size=0.9), dun=[0.3]),
        C(2.6, "high", [car("sports", RED, 2, 0, V2, "cry"), car("work", "#FFB000", 2, 8), car("car", "#4DA3FF", 1, 60, vz=12)], follow=0, speed=4,
          cam2="rear", camAt=0.8, camDur=1.6),
    ],
    sfx=[(0.2, "engine", 0.8), (1.6, "engine", 0.6), (3.8, "engine", 0.5), (6.0, "squeal", 0.7), (6.9, "dundun", 0.5), (12.4, "horn", 0.8), (12.9, "horn", 0.8),
         (23.6, "dundun", 0.9)],
)

# ── 3. 트럭 옆에서 까불면 안되는 이유 (R3 대형 트럭) — the show-off ends up crawling behind the truck uphill ──
V3 = dict(skin="#FFD9B0", hair="spiky", hairColor="#2a2320", shirt="#B9F27C")
SP = "#FF9F45"
EPS["drive3"] = dict(
    title=["트럭 옆에서 까불면 안되는 이유", ""], en="Never Mess With a Truck", music="music/scheming_weasel.mp3",
    shots=[
        F(1.5, TRUCKER, "bored", [(0.9, "side")], car="#4DA3FF", peer=dict(kind="sports", color=SP, driver=dict(V3, mood="grin"), x0=2500, x1=1350, dur=0.9), marks=[[1.0, "?"]]),
        C(1.8, "rearL", [car("truck", "#4DA3FF", 2, 0, TRUCKER, "bored"), car("sports", SP, 3, 6, V3, "laugh", path=[[0.2, 1, 14, 0.6], [0.9, 3, 18, 0.6]], fast=[0, 1.8])], follow=0),
        F(1.6, V3, "laugh", flip=True, car=SP, speed=2600, honk=[0.6], peer=dict(kind="truck", x0=1300, x1=1500, dur=1.6)),
        C(2.0, "rearR", [car("sports", SP, 3, 0, V3, "grin", path=[[0.2, 2, 2, 0.6]], brake=[[1.0, 1.8]]), car("truck", "#4DA3FF", 2, -16, TRUCKER, "side", brake=[[1.0, 1.9]])], follow=0),
        F(1.4, TRUCKER, "neutral", [(0.5, "side")], car="#4DA3FF", ahead=dict(kind="sports", color=SP, size=0.55, brake=[[0, 0.8]]), zoom=[1.0, 1.25]),
        F(1.6, TRUCKER, "angry", car="#4DA3FF", ahead=dict(kind="sports", color=SP, size=0.5), zoom=[1.18, 1.38]),
        C(2.2, "high", [car("truck", "#4DA3FF", 2, 0, TRUCKER, "angry"), car("sports", SP, 2, 12, V3, "grin", path=[[0.3, 1, 24, 0.8]], fast=[0.3, 1.4], brake=[[1.5, 9]])],
          follow=0, laneEnd=dict(lane=1, z0=70, z1=100), signs=[dict(z=40, kind="work", side="L")]),
        F(1.6, V3, "shock", [(0.7, "eek")], flip=True, car=SP, speed=600, ahead=dict(kind="car", color="#FF7A1A", size=0.2), shake=[0.1], marks=[[0.3, "?!"]]),
        C(2.2, "rearR", [car("sports", SP, 1, 0, V3, "eek", brake=True, blink="R", path=[[1.5, 2, -4, 0.8]]), car("truck", "#4DA3FF", 2, -18, TRUCKER, "cool", path=[[0, 2, 6, 1.6]])],
          follow=0, speed=0, laneEnd=dict(lane=1, z0=-20, z1=4)),
        F(1.8, V3, "eek", flip=True, car=SP, speed=300, ahead=dict(kind="truck", color="#4DA3FF", size=0.95)),
        C(2.6, "rear", [car("sports", SP, 2, 0, V3, "sad"), car("truck", "#4DA3FF", 2, 9, TRUCKER, "cool", smoke=[0.4, 1.5])], follow=0, speed=5, hill=6,
          laneEnd=dict(lane=1, z0=-60, z1=-30), signs=[dict(z=30, kind="speed", text="30")]),
        F(1.8, V3, "cry", flip=True, car=SP, speed=200, ahead=dict(kind="truck", color="#4DA3FF", size=1.0), dun=[0.3]),
        F(2.0, TRUCKER, "cool", car="#4DA3FF", speed=400, marks=[[0.6, "note"]], zoom=[1.0, 1.08]),
        C(3.0, "sideL", [car("sports", SP, 2, 0, V3, "cry"), car("truck", "#4DA3FF", 2, 9, TRUCKER, "cool", smoke=[0.5, 1.8]), car("car", "#E8E8E8", 2, -8), car("car", "#8FD3FF", 2, -15)],
          follow=0, speed=5, hill=6, cam2=dict(x=-16, y=5, z=-4, yaw=70, pitch=-10), camAt=0.2, camDur=2.6),
    ],
    sfx=[(1.6, "engine", 0.8), (3.9, "horn", 0.8), (5.8, "squeal", 0.6), (6.9, "dundun", 0.4), (10.2, "engine", 0.6), (11.3, "squeal", 0.7),
         (19.2, "engine", 0.4), (20.4, "dundun", 0.9)],
)

# ── 4. 추월하면 빨라지는 차의 최후 — the car that races you when you pass gets the speed camera ──
V4 = dict(skin="#F5CBA7", hair="curly", hairColor="#3b2a1d", shirt="#FF9F45")
PU = "#C9A7FF"
EPS["drive4"] = dict(
    title=["추월하면 빨라지는 차의 최후", ""], en="He Speeds Up When You Pass", music="music/hyperfun.mp3",
    shots=[
        F(1.4, V4, "side", [(0.6, "grin")], flip=True, car=PU, peer=dict(kind="car", color="#4DA3FF", driver=dict(HERO, mood="neutral"), x0=2700, x1=1500, dur=1.0)),
        C(2.0, "rearL", [car("car", "#4DA3FF", 2, 0, HERO, "neutral", blink="L", blinkAt=0.1, blinkOff=1.2, path=[[0.4, 1, 6, 0.8]]),
                         car("car", PU, 2, 12, V4, "grin", path=[[0.8, 2, 22, 1.0]])], follow=0),
        F(1.6, V4, "grin", flip=True, car=PU, speed=2600, peer=dict(kind="car", color="#4DA3FF", x0=1400, x1=2600, dur=1.2), streaks=[0.2, 1.6]),
        F(1.8, HERO, "neutral", [(0.6, "side")], ahead=dict(kind="car", color=PU, size=0.5, to=0.2, toAt=0.1), marks=[[0.8, "?"]]),
        C(2.0, "side", [car("car", PU, 2, 0, V4, "smug", brake=[[0.8, 1.6]]), car("car", "#4DA3FF", 1, -6, HERO, "side", path=[[0.4, 2, -12, 1.0]], blink="R", blinkOff=1.0)], follow=0),
        F(1.6, HERO, "bored", ahead=dict(kind="car", color=PU, size=0.6, brake=[[0.2, 1.0]])),
        C(2.0, "rearR", [car("car", "#4DA3FF", 2, 0, HERO, "bored", blink="L", path=[[0.3, 1, 5, 0.8]]),
                         car("car", PU, 2, 10, V4, "rage", path=[[0.5, 2, 36, 1.4]], fast=[0.5, 2])], follow=0, signs=[dict(z=50, kind="speed", text="100")]),
        F(1.6, V4, "yell", flip=True, car=PU, speed=3600, streaks=[0, 1.6]),
        C(2.2, "rearL", [car("car", PU, 2, 0, V4, "laugh", fast=[0, 2.2])], follow=0, speed=40, speedCam=dict(z=60, at=1.4)),
        F(1.6, V4, "shock", flip=True, car=PU, speed=2400, flash=[0.0], marks=[[0.35, "!"]], dun=[0.4]),
        C(2.0, "high", [car("car", PU, 2, 0, V4, "eek", brake=[[0, 2]]), car("car", "#4DA3FF", 1, -20, HERO, "cool", path=[[0, 1, 14, 2.0]], blink="L")], follow=0, speed=22),
        F(1.8, HERO, "cool", [(0.9, "happy")], speed=1500, peer=dict(kind="car", color=PU, driver=dict(V4, mood="cry"), x0=1300, x1=2500, dur=1.6)),
        F(2.4, V4, "cry", flip=True, car=PU, speed=1000, zoom=[1.0, 1.12], dun=[0.2]),
        C(2.6, "rearR", [car("car", PU, 2, 0, V4, "sad")] + [car("car", c, 1, z, vz=7) for c, z in zip(["#4DA3FF", "#E8E8E8", "#B9F27C"], [-30, -42, -54])], follow=0, speed=16),
    ],
    sfx=[(0.5, "engine", 0.5), (2.2, "engine", 0.8), (11.0, "engine", 0.9), (14.0, "engine", 0.7), (16.0, "shutter", 0.9), (16.4, "dundun", 0.9),
         (16.7, "squeal", 0.5), (22.0, "dundun", 0.8)],
)

# ── 5. 브레이크만 밟는 빌런 — the brake checker brake-checks a police car ──
V5 = dict(skin="#FFD9B0", hair="curly", hairColor="#7a3b1d", glasses="round", shirt="#C9A7FF")
YE = "#FFD84D"
EPS["drive5"] = dict(
    title=["브레이크만 밟는 빌런", ""], en="The Brake Checker", music="music/sneaky_snitch.mp3",
    shots=[
        F(1.3, HEROINE, "shock", ahead=dict(kind="car", color=YE, size=0.75, brake=[[0.0, 0.5], [0.8, 1.3]]), shake=[0.1], marks=[[0.15, "!"]]),
        C(2.0, "rearR", [car("car", "#4DA3FF", 2, 0, HEROINE, "eek", brake=[[0.1, 0.6], [1.0, 1.5]]), car("car", YE, 2, 9, V5, "grin", brake=[[0.0, 0.5], [0.9, 1.4]], path=[[0.5, 2, 14, 1.2]])], follow=0),
        F(1.6, V5, "grin", [(0.7, "laugh")], flip=True, car=YE),
        F(1.6, HEROINE, "eek", [(0.8, "side")], ahead=dict(kind="car", color=YE, size=0.5, brake=[[0.2, 0.7]])),
        C(2.0, "side", [car("car", YE, 2, 0, V5, "happy", brake=[[0.3, 0.8], [1.2, 1.6]], marks=[[0.6, "note"]]), car("car", "#4DA3FF", 2, -16, HEROINE, "side")], follow=0),
        F(1.8, HEROINE, "cool", ahead=dict(kind="car", color=YE, size=0.45, brake=[[0.4, 0.9]])),
        C(2.0, "rearL", [car("car", "#4DA3FF", 2, 0, HEROINE, "cool", blink="L", path=[[0.2, 1, 10, 1.6]]), car("car", YE, 2, 14, V5, "smug"),
                         car("police", "", 2, -30, COP, "neutral", path=[[0.5, 2, -10, 1.4]])], follow=0),
        F(1.7, V5, "smug", [(0.9, "grin")], flip=True, car=YE, marks=[[1.0, "note"]]),
        C(2.0, "rearR", [car("car", YE, 2, 0, V5, "grin", brake=[[0.7, 1.3]]), car("police", "", 2, -9, COP, "side", brake=[[0.8, 1.4]])], follow=0),
        F(1.8, COP, "neutral", [(0.6, "side")], car="#F2F2F2", ahead=dict(kind="car", color=YE, size=0.6, brake=[[0.1, 0.6]]), zoom=[1.0, 1.2]),
        C(1.8, "front", [car("police", "", 2, 0, COP, "side", siren=0.3)], follow=0),
        F(1.8, V5, "shock", flip=True, car=YE, police=0.0, marks=[[0.3, "?!"]], dun=[0.3]),
        C(2.6, "high", [car("car", YE, 2, 0, V5, "eek", path=[[0.2, 4, -6, 1.5]], blink="R"), car("police", "", 2, -9, COP, "side", siren=0, path=[[0.4, 4, -15, 1.5]])],
          follow=0, stopAt=1.2, speed=20),
        F(2.6, V5, "cry", flip=True, car=YE, speed=0, police=0.0, zoom=[1.0, 1.1], dun=[0.2]),
    ],
    sfx=[(0.1, "squeal", 0.7), (0.9, "squeal", 0.4), (2.4, "squeal", 0.5), (14.9, "squeal", 0.3), (17.0, "siren", 0.8), (18.6, "siren", 0.6),
         (19.2, "dundun", 0.9), (24.6, "dundun", 0.7)],
)

# ── 6. 밤에 라이트 안 켠 차의 최후 — the invisible car switches its lights on, right behind a police car ──
V6 = dict(skin="#F5CBA7", hair="bald", hairColor="#3a2a20", shirt="#5a5f6a", beard="mustache")
GR = "#5a5f6a"
N = dict(time="night")
EPS["drive6"] = dict(
    title=["밤에 라이트 안 켠 차의 최후", ""], en="The Invisible Car (No Headlights)", music="music/scheming_weasel.mp3",
    shots=[
        F(1.3, HERO, "shock", ahead=dict(kind="car", color=GR, size=0.7, dark=True), marks=[[0.2, "!"]], shake=[0.1], **N),
        C(2.0, "rearL", [car("car", "#4DA3FF", 2, 0, HERO, "eek", brake=[[0, 0.6]]), car("car", GR, 2, 10, V6, "happy", dark=True)], follow=0, **N),
        F(1.6, V6, "happy", flip=True, car=GR, marks=[[0.4, "note"]], **N),
        C(2.0, "side", [car("car", GR, 2, 0, V6, "happy", dark=True), car("car", "#E8E8E8", 1, -12, path=[[0, 1, 14, 2.0]], marks=[[0.9, "?"]])], follow=0, **N),
        F(1.8, V6, "side", [(0.9, "neutral")], flip=True, car=GR, glare=[[0.2, 0.4], [0.6, 0.8]], marks=[[1.0, "?"]], **N),
        C(2.0, "front", [car("car", GR, 2, 0, V6, "neutral", dark=True), car("car", "#4DA3FF", 2, -14, HERO, "side")], follow=0, **N),
        F(1.6, HERO, "side", [(0.8, "eek")], ahead=dict(kind="car", color=GR, size=0.45, dark=True), **N),
        C(2.2, "rearR", [car("car", GR, 2, 0, V6, "neutral", dark=True), car("police", "", 2, 40, COP, "neutral", dark=True, path=[[0, 2, 16, 2.2]])], follow=0, **N),
        F(1.6, V6, "neutral", [(0.5, "squint"), (1.0, "cool")], flip=True, car=GR, **N),
        C(2.0, "rear", [car("car", GR, 2, 0, V6, "cool", dark=0.2), car("police", "", 2, 14, COP, "side", dark=0.2, siren=0.7, brake=[[0.2, 9]])], follow=0, speed=10, **N),
        F(1.8, V6, "shock", flip=True, car=GR, police=0.0, marks=[[0.3, "!"]], dun=[0.3], **N),
        F(1.6, COP, "side", [(0.8, "cool")], car="#F2F2F2", police=0.0, zoom=[1.0, 1.15], **N),
        C(2.6, "high", [car("car", GR, 2, 0, V6, "eek", path=[[0.2, 4, 0, 1.4]], blink="R"), car("police", "", 2, 9, COP, "side", siren=0, path=[[0.1, 4, 9, 1.4]]),
                        car("car", "#4DA3FF", 1, -20, HERO, "cool", path=[[0.6, 1, 30, 2.0]])], follow=0, stopAt=0.8, speed=12, **N),
        F(2.6, V6, "cry", flip=True, car=GR, speed=0, police=0.0, zoom=[1.0, 1.1], **N),
    ],
    sfx=[(0.1, "squeal", 0.7), (0.4, "horn", 0.6), (16.0, "click", 0.9), (17.5, "siren", 0.8), (18.6, "dundun", 0.9), (20.6, "siren", 0.5), (24.0, "dundun", 0.6)],
)

# ── 7. (road1) 1차로 막는 차의 최후 — the left-lane hog ──
V7 = dict(skin="#FFD9B0", hair="cap", cap="#8b5cf6", hairColor="#2a2320", shirt="#C9A7FF")
EPS["drive7"] = dict(
    title=["1차로 막는 차의 최후", ""], en="The Left-Lane Hog", music="music/monkeys_spinning_monkeys.mp3", remake="road1",
    shots=[
        F(1.4, V7, "cool", [(0.6, "happy")], flip=True, car=RED, speed=700, marks=[[0.5, "note"]]),
        C(2.2, "high", [car("car", RED, 1, 0, V7, "happy")] + queue(1, [-9, -18, -27, -36], ["#4DA3FF", "#E8E8E8", "#B9F27C", "#FFB36B"]), follow=0, speed=14,
          cam2=dict(x=3, y=16, z=-30, yaw=0, pitch=-30), camAt=0.2, camDur=2),
        F(1.6, HERO, "bored", [(0.8, "angry")], ahead=dict(kind="car", color=RED, size=0.55), marks=[[0.9, "anger"]]),
        C(2.0, "rearL", [car("car", "#4DA3FF", 1, 0, HERO, "angry", marks=[[0.4, "anger"]]), car("car", RED, 1, 10, V7, "happy")] +
          queue(1, [-9, -18], ["#E8E8E8", "#B9F27C"], marks=[[0.9, "anger"]]), follow=0, speed=14),
        F(1.6, V7, "happy", flip=True, car=RED, speed=700, marks=[[0.3, "note"]], zoom=[1.0, 1.06]),
        C(1.8, "side", [car("car", RED, 1, 0, V7, "happy"), car("car", "#4DA3FF", 1, -9, HERO, "angry")], follow=0, speed=14),
        F(1.8, HERO, "side", [(0.9, "cool")], ahead=dict(kind="car", color=RED, size=0.5)),
        C(2.0, "rearR", [car("car", RED, 1, 0, V7, "happy"), car("police", "", 1, -30, COP, "side", path=[[0.2, 1, -10, 1.4]], siren=1.4),
                         car("car", "#4DA3FF", 2, -4, HERO, "cool", path=[[0, 2, 20, 2.0]], blink="R")], follow=0, speed=14),
        F(1.6, V7, "shock", flip=True, car=RED, speed=700, police=0.2, marks=[[0.3, "!"]]),
        F(1.8, COP, "side", car="#F2F2F2", ahead=dict(kind="car", color=RED, size=0.6), police=0.0, zoom=[1.0, 1.2]),
        C(2.4, "high", [car("car", RED, 1, 0, V7, "eek", path=[[0.2, 4, -4, 1.8]], blink="R"), car("police", "", 1, -9, COP, "side", siren=0, path=[[0.4, 4, -13, 1.8]]),
                        car("car", "#E8E8E8", 1, -20, path=[[0.8, 1, 25, 1.6]]), car("car", "#B9F27C", 1, -30, path=[[1.0, 1, 12, 1.4]])], follow=0, speed=14, stopAt=1.4),
        F(1.8, HERO, "happy", speed=2400, marks=[[0.4, "note"]]),
        C(2.4, "rearL", [car("car", RED, 4, 0, V7, "sad"), car("police", "", 4, -8, COP, "side", siren=0)] + [car("car", c, 1, z, vz=14) for c, z in zip(TRAFFIC, [-40, -55, -70])],
          follow=0, speed=0),
        F(2.6, V7, "cry", flip=True, car=RED, speed=0, police=0.0, zoom=[1.0, 1.1], dun=[0.2]),
    ],
    sfx=[(7.4, "engine", 0.3), (14.6, "siren", 0.8), (16.2, "dundun", 0.6), (18.0, "siren", 0.5), (24.6, "dundun", 0.8)],
)

# ── 8. (road2) 깜빡이 없이 끼어든 차의 최후 — the no-signal cut-in, in front of a police car ──
V8 = dict(skin="#F5CBA7", hair="spiky", hairColor="#2a2320", shirt="#FF5C5C", beard="stubble")
EPS["drive8"] = dict(
    title=["깜빡이 없이 끼어든 차의 최후", ""], en="Cut In Without a Signal?", music="music/hustle.mp3", remake="road2",
    shots=[
        F(1.3, HEROINE, "shock", ahead=dict(kind="car", color=RED, size=0.4, to=0.85, toAt=0.0, brake=[[0.4, 1.3]]), shake=[0.2], marks=[[0.2, "!"]]),
        C(2.0, "rearR", [car("car", "#4DA3FF", 2, 0, HEROINE, "eek", brake=[[0.5, 1.4]]), car("car", RED, 3, 3, V8, "smug", path=[[0.1, 2, 6, 0.6]], brake=[[0.6, 1.2]]),
                         car("car", "#E8E8E8", 2, -10, brake=[[0.8, 1.6]], marks=[[0.9, "anger"]])], follow=0),
        F(1.6, V8, "smug", [(0.8, "grin")], flip=True, car=RED),
        C(2.0, "high", [car("car", RED, 2, 0, V8, "grin", path=[[0.3, 1, 4, 0.6], [1.2, 2, 10, 0.6]]), car("car", "#B9F27C", 1, 6, brake=[[0.6, 1.3]], marks=[[0.7, "anger"]]),
                        car("car", "#FFB36B", 2, 12, brake=[[1.4, 2.0]])], follow=0),
        F(1.6, HEROINE, "eek", [(0.8, "side")], ahead=dict(kind="car", color=RED, size=0.4)),
        F(1.8, V8, "grin", flip=True, car=RED, peer=dict(kind="police", x0=2600, x1=1350, dur=1.4)),
        C(2.2, dict(x=-3, y=5, z=-16, yaw=12, pitch=-14), [car("car", RED, 3, 0, V8, "grin", path=[[0.4, 2, 2, 0.6]]), car("police", "", 2, -4, COP, "neutral", brake=[[0.8, 1.6]], siren=1.6)], follow=0),
        F(1.6, COP, "neutral", [(0.5, "side")], car="#F2F2F2", ahead=dict(kind="car", color=RED, size=0.85), zoom=[1.0, 1.2]),
        F(1.6, V8, "shock", flip=True, car=RED, police=0.1, marks=[[0.3, "!"]], dun=[0.4]),
        C(2.4, "high", [car("car", RED, 2, 0, V8, "eek", path=[[0.2, 4, -4, 1.6]], blink="R"), car("police", "", 2, -9, COP, "side", siren=0, path=[[0.4, 4, -13, 1.6]])],
          follow=0, speed=20, stopAt=1.2),
        F(1.8, HEROINE, "happy", speed=1500, peer=dict(kind="car", color=RED, driver=dict(V8, mood="cry"), x0=1100, x1=2600, dur=1.6)),
        C(2.0, "side", [car("car", RED, 4, 0, V8, "sad"), car("police", "", 4, -8, COP, "side", siren=0), car("car", "#4DA3FF", 3, -22, HEROINE, "cool", blink="L", vz=18)],
          follow=0, speed=0),
        F(2.2, V8, "cry", flip=True, car=RED, speed=0, police=0.0, zoom=[1.0, 1.1]),
        C(2.4, "high", [car("car", "#4DA3FF", 3, 0, HEROINE, "cool", blink="L", path=[[0.4, 2, 6, 1.4]]), car("car", RED, 4, -20, V8, "cry", vz=-14),
                        car("police", "", 4, -28, vz=-14, siren=0)], follow=0, speed=14),
    ],
    sfx=[(0.1, "squeal", 0.8), (0.3, "horn", 0.6), (1.9, "squeal", 0.5), (7.8, "squeal", 0.5), (11.2, "squeal", 0.5), (12.1, "siren", 0.8), (14.1, "dundun", 0.9),
         (14.6, "siren", 0.6), (23.0, "dundun", 0.5)],
)

# ── 9. (road8) 갓길로 새치기한 차의 최후 — the shoulder ends at a work truck and a police car ──
V9 = dict(skin="#FFD3A8", hair="slick", hairColor="#a0522d", shirt="#FFD84D")
WH = "#E8E8E8"
EPS["drive9"] = dict(
    title=["갓길로 새치기한 차의 최후", ""], en="The Shoulder Cheater", music="music/hyperfun.mp3", remake="road8",
    shots=[
        F(1.4, HERO, "bored", [(0.9, "shock")], speed=200, peer=dict(kind="suv", color=WH, x0=2600, x1=-500, at=0.3, dur=0.7), marks=[[0.9, "?!"]]),
        C(2.0, "rearR", [car("suv", WH, 4, 0, V9, "laugh", fast=[0, 2])] + jam(3, -30, 7, vz=-18) + jam(2, -26, 6, vz=-18), follow=0, speed=20),
        F(1.6, V9, "laugh", flip=True, car=WH, speed=2600, peer=dict(kind="car", color="#8FD3FF", x0=1100, x1=2700, dur=1.0), streaks=[0, 1.6]),
        C(1.8, "high", [car("car", "#4DA3FF", 3, 0, HERO, "side")] + jam(3, 9, 4) + jam(2, -6, 4) + jam(1, -2, 4) +
          [car("suv", WH, 4, 30, V9, "laugh", vz=14)], follow=0, speed=3),
        F(1.6, HERO, "side", [(0.8, "bored")], speed=200, ahead=dict(kind="car", color="#FFB36B", size=0.6, brake=True)),
        C(2.0, "rearR", [car("suv", WH, 4, 0, V9, "grin")] + jam(3, -10, 6, vz=-16) +
          [car("work", "#FFB000", 4, 34, vz=-20), car("police", "", 4, 44, COP, "side", vz=-20, siren=0.4)], follow=0, speed=20, stopAt=1.3),
        F(1.6, V9, "shock", flip=True, car=WH, speed=0, ahead=dict(kind="truck", color="#FFB000", size=0.8), shake=[0.1], marks=[[0.3, "!"]]),
        C(2.0, "rearL", [car("suv", WH, 4, 0, V9, "eek", blink="L", brake=True), car("work", "#FFB000", 4, 8), car("police", "", 4, 17, COP, "side", siren=0)] +
          jam(3, -14, 5, vz=3), follow=0, speed=0),
        F(1.6, COP, "side", [(0.8, "cool")], car="#F2F2F2", speed=0, police=0.0, zoom=[1.0, 1.2]),
        F(1.8, V9, "eek", flip=True, car=WH, speed=0, police=0.0, peer=dict(kind="car", color="#B9F27C", x0=2300, x1=-300, dur=1.8), marks=[[0.6, "sweat"]]),
        C(2.0, "side", [car("suv", WH, 4, 0, V9, "sad", blink="L", brake=True), car("car", "#4DA3FF", 3, -12, HERO, "cool", vz=4)] + jam(3, -24, 2, vz=4), follow=0, speed=0),
        F(1.6, HERO, "happy", speed=500, peer=dict(kind="suv", color=WH, driver=dict(V9, mood="cry"), x0=900, x1=2500, dur=1.5)),
        C(2.4, "high", [car("suv", WH, 4, 0, V9, "cry", blink="L"), car("work", "#FFB000", 4, 8), car("police", "", 4, 17, siren=0)] + jam(3, -30, 3, vz=10) + jam(2, -20, 3, vz=10),
          follow=0, speed=0, cam2=dict(x=2, y=30, z=-26, yaw=0, pitch=-45), camAt=0.3, camDur=2.0),
        F(2.6, V9, "cry", flip=True, car=WH, speed=0, police=0.0, zoom=[1.0, 1.1], dun=[0.2]),
    ],
    sfx=[(0.3, "engine", 0.8), (1.5, "engine", 0.6), (9.4, "siren", 0.6), (10.4, "squeal", 0.8), (10.8, "dundun", 0.6), (23.6, "dundun", 0.8)],
)

# ── 10. (road9) 상향등 켜고 붙던 차의 최후 — the high-beam tailgater tailgates a police car ──
V10 = dict(skin="#F0C090", hair="spiky", hairColor="#1d1a18", shirt="#2b2f38", beard="stubble")
DR = "#8b1e2a"
EPS["drive10"] = dict(
    title=["상향등 켜고 붙던 차의 최후", ""], en="Tailgating With High Beams?", music="music/scheming_weasel.mp3", remake="road9",
    shots=[
        F(1.3, HEROINE, "squint", [(0.7, "scared")], glare=[[0, 1.3]], marks=[[0.7, "sweat"]], **N),
        C(2.0, "rearL", [car("car", "#4DA3FF", 2, 0, HEROINE, "scared"), car("sports", DR, 2, -6, V10, "grin", honk=[1.2])], follow=0, **N),
        F(1.6, V10, "grin", flip=True, car=DR, honk=[0.6], ahead=dict(kind="car", color="#4DA3FF", size=0.85), **N),
        F(1.6, HEROINE, "eek", glare=[[0, 0.5], [0.8, 1.3]], marks=[[0.6, "sweat"]], **N),
        C(2.0, "side", [car("sports", DR, 2, 0, V10, "grin"), car("car", "#4DA3FF", 2, 5.5, HEROINE, "eek")], follow=0, **N),
        F(1.8, HEROINE, "cool", glare=[[0, 0.6]], **N),
        C(2.0, "rearR", [car("car", "#4DA3FF", 2, 0, HEROINE, "cool", blink="R", path=[[0.2, 3, 0, 1.0]]), car("sports", DR, 2, -6, V10, "laugh", path=[[0.8, 2, 18, 1.2]], fast=[0.8, 2])],
          follow=0, **N),
        F(1.6, V10, "laugh", flip=True, car=DR, speed=3000, streaks=[0, 1.6], **N),
        C(2.2, "rear", [car("sports", DR, 2, 0, V10, "grin", honk=[1.4]), car("police", "", 2, 30, COP, "neutral", path=[[0, 2, 6, 1.4]])], follow=0, **N),
        F(1.6, COP, "squint", [(0.8, "side")], car="#F2F2F2", glare=[[0, 1.6]], zoom=[1.0, 1.2], **N),
        C(1.8, "front", [car("police", "", 2, 0, COP, "side", siren=0.3), car("sports", DR, 2, -6, V10, "grin")], follow=0, **N),
        F(1.6, V10, "shock", flip=True, car=DR, police=0.0, marks=[[0.3, "!"]], dun=[0.3], **N),
        C(2.4, "high", [car("sports", DR, 2, 0, V10, "eek", path=[[0.2, 4, -4, 1.6]], blink="R"), car("police", "", 2, 6, COP, "side", siren=0, path=[[0.1, 4, 6, 1.6]]),
                        car("car", "#4DA3FF", 3, -20, HEROINE, "cool", path=[[0.6, 3, 30, 1.8]])], follow=0, speed=18, stopAt=1.0, **N),
        F(2.6, V10, "cry", flip=True, car=DR, speed=0, police=0.0, zoom=[1.0, 1.1], dun=[0.2], **N),
    ],
    sfx=[(2.5, "horn", 0.8), (3.9, "horn", 0.8), (9.5, "engine", 0.8), (14.8, "horn", 0.6), (16.1, "siren", 0.4), (18.0, "siren", 0.8), (19.3, "dundun", 0.9),
         (24.2, "dundun", 0.6)],
)


def write(sid):
    ep = EPS[sid]
    t, clips = 0.0, []
    for dur, g in ep["shots"]:
        clips.append({"from": round(t, 3), "frame": "wide", "zoom": [1, 1], "gfx": {"type": "road", **g}})
        t += dur
    end = round(t, 3)
    edit = {"credit": "", "titleStyle": "band", "titleEn": ep["en"], "sources": {}, "music": {"file": ep["music"], "gain": 0.32, "start": 0},
            "sfx": [[round(a, 3), n, g] for a, n, g in ep["sfx"] if a < end - 0.3], "clips": clips}
    script = {"title": ep["title"], "voices": {}, "tail": end, "lines": [],
              "note": "wordless: no narration or captions; shots and sound are in edit.json (made by drive_eps.py)" + (f"; wordless remake of {ep['remake']}" if ep.get("remake") else "")}
    os.makedirs(f"{HERE}/shorts/{sid}", exist_ok=True)
    json.dump(edit, open(f"{HERE}/shorts/{sid}/edit.json", "w"), ensure_ascii=False, indent=1)
    json.dump(script, open(f"{HERE}/shorts/{sid}/script.json", "w"), ensure_ascii=False, indent=1)
    print(f"{sid}: {len(clips)} shots, {end}s")

for sid in sys.argv[1:] or sorted(EPS, key=lambda s: int(s[5:])):
    write(sid)
