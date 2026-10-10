"""Picture helpers for media/teuk/episodes.py (the "○○ 특" v2 shorts, src/lib/Teuk.tsx)."""

def F(mood, pos="close", to=None, at=None, fx=None, prop=None, big=None, bigat=None, say=None, burst=None, **kw):
    """a big mascot close-up; `at` is when it switches to `to`, `bigat` when `big` lands (anchors or seconds)"""
    g = {"type": "face", "mood": mood, "pos": pos}
    for k, v in (("to", to), ("fx", fx), ("prop", prop), ("big", big), ("burst", burst)):
        if v: g[k] = v
    if say: g["say"] = {"text": say}
    g.update(kw)
    g["steps"] = [at if at is not None else 0.9, 0.05, bigat if bigat is not None else 0.15]
    return g

def P(key, react=None, side="right", to=None, at=None, tag=None, big=None, bigat=None, pos=None, zoom=None, size=None, say=None, pop=0.12):
    """a photo from photos.json; `react` is the mascot's mood in the round inset, `to` its switch at `at`"""
    g = {"type": "photo", "src": key}
    if react: g["react"] = {"mood": react, "side": side, **({"to": to} if to else {}), **({"size": size} if size else {})}
    for k, v in (("tag", tag), ("big", big), ("pos", pos), ("zoom", zoom)):
        if v: g[k] = v
    if say: g["say"] = {"text": say}
    g["steps"] = [pop, 0.2, bigat if bigat is not None else 0.25, at if at is not None else 1e3]
    return g

def S(**scene):
    """one of the drawn story scenes (src/lib/Sseol.tsx Scene)"""
    return {"type": "scene", **scene}

ME = "#FFB36B"  # the series mascot
def me(mood, **kw): return {"name": "나", "color": ME, "mood": mood, **kw}

