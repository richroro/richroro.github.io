"""Turn the voice build into what the Remotion project reads.

usage: python3 prep.py <voice_build_dir>
  <voice_build_dir> is where tools/build_voice.py wrote timeline.json and voice/*.wav.
Writes (all git-ignored):
  public/voice/<id>.wav       one narration line each
  public/sfx/*.wav            synthesized effects plus two composites from the Kenney sounds
  src/data/timeline.json      line starts, caption chunks and per-syllable ASR times
  src/data/captions.json      caption pages; a page is one '/'-separated piece of a script caption
  src/data/voice_env.json     per-frame narration level, 0..1, used to duck the music
"""
import difflib, json, os, re, subprocess, sys, wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SRC, PUB = f"{HERE}/src/data", f"{HERE}/public"
FPS, SR = 30, 44100
vb = sys.argv[1]
os.makedirs(SRC, exist_ok=True); os.makedirs(f"{PUB}/voice", exist_ok=True); os.makedirs(f"{PUB}/sfx", exist_ok=True)

tl = json.load(open(f"{vb}/timeline.json"))
script = json.load(open(f"{HERE}/script.json"))
caps = {L["id"]: L["cap"] for L in script["lines"]}

def read(path):
    with wave.open(path) as w:
        x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
        return x.reshape(-1, w.getnchannels()).mean(1), w.getframerate()

def write(path, x, sr=SR):
    with wave.open(path, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())

# ── narration: copy lines, measure a per-frame level for ducking ──
n_frames = int(np.ceil(tl["end"] * FPS)) + 1
env = np.zeros(n_frames)
for L in tl["lines"]:
    x, sr = read(f"{vb}/{L['wav']}")
    voiced = x[np.abs(x) > 0.02]  # every line at the same loudness (-18 dBFS RMS over voiced samples)
    x = x * (10 ** (-18 / 20) / (np.sqrt(np.mean(voiced ** 2)) + 1e-9))
    write(f"{PUB}/voice/{L['id']}.wav", np.tanh(x * 1.2) / np.tanh(1.2), sr)
    hop = sr // FPS
    for k in range(len(x) // hop):
        fr = int(round(L["start"] * FPS)) + k
        if fr < n_frames:
            env[fr] = max(env[fr], float(np.sqrt(np.mean(x[k * hop:(k + 1) * hop] ** 2))))
env = np.clip(env / (np.percentile(env[env > 0], 90) + 1e-9), 0, 1)
sm = np.zeros_like(env)  # fast attack, ~0.25 s release
for i in range(1, len(env)):
    sm[i] = env[i] if env[i] > sm[i - 1] else sm[i - 1] + (env[i] - sm[i - 1]) * 0.13
json.dump([round(float(v), 3) for v in sm], open(f"{SRC}/voice_env.json", "w"))

json.dump({"end": tl["end"], "fps": FPS, "lines": [
    {k: L[k] for k in ("id", "start", "dur", "chunks", "chars", "ct")} for L in tl["lines"]]},
    open(f"{SRC}/timeline.json", "w"), ensure_ascii=False)

# ── captions: script caption chunk -> pages split on '/', words timed from the ASR syllables ──
SYL = re.compile(r"[가-힣A-Za-z0-9%]")
def words_of(page):
    """'[숫자 칸]을 꽉' -> [{'text': '숫자', 'key': True}, {'text': '칸을', 'key': ...}, ...]"""
    out, key = [], False
    for raw in page.split():
        segs, buf = [], ""
        for ch in raw:
            if ch in "[]":
                if buf: segs.append((buf, key)); buf = ""
                key = ch == "["
            else:
                buf += ch
        if buf: segs.append((buf, key))
        out.append({"text": "".join(s for s, _ in segs), "key": any(k for _, k in segs), "n": sum(len(SYL.findall(s)) for s, _ in segs)})
    merged = []  # an emoji-only word rides along with the word before it
    for w in out:
        if w["n"] == 0 and merged:
            merged[-1]["text"] += " " + w["text"]
        else:
            merged.append(w)
    return merged

DIG, UNIT = "영일이삼사오육칠팔구", ["", "십", "백", "천"]
def read_num(n):
    """sino-Korean reading: 2500 -> 이천오백, 125000000 -> 일억이천오백만"""
    if n == 0: return DIG[0]
    out, big = "", ["", "만", "억", "조"]
    for b in range(3, -1, -1):
        part = n // 10 ** (4 * b) % 10 ** 4
        if not part: continue
        for k in range(3, -1, -1):
            d = part // 10 ** k % 10
            if d: out += ("" if d == 1 and k else DIG[d]) + UNIT[k]
        out += big[b]
    return out
def spoken_form(word):
    return "".join(SYL.findall(re.sub(r"\d+", lambda m: read_num(int(m.group())), word)))

pages = []
for L in tl["lines"]:
    # every caption word of the line, in order; a page is a '/'-piece of one script caption chunk
    groups = [(ci, words_of(p)) for ci, cap in enumerate(caps[L["id"]]) for p in cap.split("/")]
    words = [w for _, p in groups for w in p]
    # align the captions (digits read out loud) to the line's spoken syllables; a word starts at its first matched syllable
    cap_chars, owner = [], []
    for wi, w in enumerate(words):
        for c in spoken_form(w["text"]):
            cap_chars.append(c); owner.append(wi)
    first = [None] * len(words)
    for blk in difflib.SequenceMatcher(a=cap_chars, b=list(L["chars"]), autojunk=False).get_matching_blocks():
        for k in range(blk.size):
            wi = owner[blk.a + k]
            first[wi] = blk.b + k if first[wi] is None else min(first[wi], blk.b + k)
    times = []
    for wi, w in enumerate(words):
        if first[wi] is not None: ts = L["ct"][first[wi]]
        else:  # unmatched: halfway to the next matched word
            nxt = next((L["ct"][first[j]] for j in range(wi + 1, len(words)) if first[j] is not None), L["dur"])
            ts = (times[-1] + nxt) / 2 if times else 0.0
        times.append(max(ts, times[-1] + 0.05) if times else 0.0)
    wi = 0
    for ci, p in groups:
        toks = []
        for w in p:
            toks.append({"text": w["text"], "key": w["key"], "fromMs": round((L["start"] + times[wi]) * 1000)}); wi += 1
        pages.append({"line": L["id"], "tokens": toks, "lineEndMs": round((L["start"] + L["dur"]) * 1000)})
for i, p in enumerate(pages):
    nxt = pages[i + 1]["tokens"][0]["fromMs"] if i + 1 < len(pages) else 10 ** 9
    p["startMs"] = p["tokens"][0]["fromMs"]
    p["endMs"] = min(nxt, (p["lineEndMs"] if nxt > p["lineEndMs"] else nxt) + 500)
    for j, tk in enumerate(p["tokens"]):
        tk["toMs"] = p["tokens"][j + 1]["fromMs"] if j + 1 < len(p["tokens"]) else min(p["endMs"], nxt, p["lineEndMs"] + 150)
    del p["lineEndMs"]
json.dump(pages, open(f"{SRC}/captions.json", "w"), ensure_ascii=False, indent=0)

# ── effects: the numpy synth set, plus a glitch stutter and a counter tick-roll from Kenney's sounds ──
subprocess.run([sys.executable, f"{HERE}/../tools/sfx.py", f"{PUB}/sfx"], check=True, stdout=subprocess.DEVNULL)
g = [read(f"{PUB}/sfx/k_glitch_00{i}.wav")[0] for i in (1, 2, 3, 4)]
rng = np.random.default_rng(5); out = np.zeros(int(0.55 * SR)); t = 0.0
while t < 0.45:  # stutter: random glitch grains, tightening toward the end
    s = g[rng.integers(0, 4)]; i = int(t * SR); out[i:i + len(s)] += s[: len(out) - i] * (0.6 + 0.4 * rng.random())
    t += 0.035 + 0.04 * rng.random()
write(f"{PUB}/sfx/glitch.wav", out / np.abs(out).max() * 0.85)
tick = read(f"{PUB}/sfx/k_tick_002.wav")[0]; dur = 2.2; out = np.zeros(int(dur * SR)); t = 0.0
while t < dur - 0.05:  # ticks that speed up like a spinning counter
    i = int(t * SR); out[i:i + len(tick)] += tick[: len(out) - i] * (0.35 + 0.65 * t / dur)
    t += 0.13 - 0.09 * (t / dur) ** 0.7
write(f"{PUB}/sfx/tickroll.wav", out / np.abs(out).max() * 0.8)
print(f"prep: {len(tl['lines'])} lines, {len(pages)} caption pages, end {tl['end']}s")
