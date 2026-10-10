"""Voice bake-off (README "음성 v2"): every candidate cast reads the 12 test lines; score.py scores each take.

usage: python3 voicelab/bakeoff.py <candidate> [...]    takes in build/voicelab/<candidate>/, rows in voicelab/results.csv
       python3 voicelab/bakeoff.py --table               voicelab/results.md (one row per candidate)
       python3 voicelab/bakeoff.py --sheet <candidate>   final/voice_ab/samples-<candidate>.mp3 (12 lines, 0.7 s apart)

A candidate is a cast in candidates.json: one voices entry per role of testset.json ("nar_f", "young_f", ...), plus
"target": true to bring each line to its format's speaking rate (TARGET_SPS, syllables per second). The rate is set
in two passes: a take at the entry's own rate is measured, then re-read at the corrected rate (Edge "rate",
Supertonic "speed") or time-stretched ("tempo") when the engine is too slow to read twice.
"""
import csv, json, os, subprocess, sys, time
HERE = os.path.dirname(os.path.abspath(__file__)); V = os.path.dirname(HERE)
sys.path.insert(0, V); sys.path.insert(0, HERE)
import voice_engine as ve, score

# syllables per second over a whole line, per format (research/research-voice.md §3)
TARGET_SPS = {"sseol": 6.8, "info": 7.2, "doodle": 7.6, "horror": 5.2, "story": 5.6, "docu": 5.2}
LINES = json.load(open(f"{HERE}/testset.json"))["lines"]
CANDS = json.load(open(f"{HERE}/candidates.json"))
RES = f"{HERE}/results.csv"
FIELDS = ["cand", "line", "kind", "engine", "voice", "dur", "syl", "sps", "target", "art", "np", "pmean", "pmax", "f0st", "f0hz", "mos", "cer", "rtf", "hyp"]


def entry_for(c, L):
    v = dict(c["cast"][L["role"]])
    v.update(c.get("lines", {}).get(L["n"], {}))
    return v


def text_for(v, L):
    return L["say"] if ve.engine_of(v) == "edge" else ve.ko_text(L["say"])


retime = ve.retime  # Edge "rate", Supertonic "speed", else "tempo"


def take(v, L):
    t = time.time(); x, _ = ve.synth(text_for(v, L), v); return x, time.time() - t


def run(name):
    c = CANDS[name]; out = f"{V}/build/voicelab/{name}"; os.makedirs(out, exist_ok=True)
    rows = []
    for L in LINES:
        v = entry_for(c, L); x, el = take(v, L)
        tgt = TARGET_SPS[L["fmt"]] * L.get("rate_mul", 1.0)
        if c.get("target"):
            n = len(score.hangul(L.get("read", L["say"])))
            v = retime(v, tgt / (n / (len(x) / ve.SR))); x, el = take(v, L)
        ve.write_wav(f"{out}/{L['n']}.wav", x)
        r = score.score(x, L.get("read", L["say"]))
        r.update(cand=name, line=L["n"], kind=L["kind"], engine=ve.engine_of(v), target=tgt, rtf=round(el / r["dur"], 2),
                 voice=json.dumps({k: v[k] for k in v if k != "engine"}, ensure_ascii=False))
        print(name, L["n"], {k: r[k] for k in ("sps", "target", "mos", "cer", "f0st", "rtf")}, flush=True); rows.append(r)
    old = [r for r in csv.DictReader(open(RES))] if os.path.exists(RES) else []
    with open(RES, "w", newline="") as f:
        w = csv.DictWriter(f, FIELDS); w.writeheader()
        for r in [r for r in old if r["cand"] != name] + rows: w.writerow({k: r.get(k) for k in FIELDS})


def table():
    rows = list(csv.DictReader(open(RES))); out = ["| 후보 | 엔진 | MOS 평균 | CER 평균 | 목표 속도 오차 | F0 범위(반음) 내레이션/대사 | T08 문장 사이 쉼 |", "|---|---|---|---|---|---|---|"]  # RTF: README (measured apart; takes here may come from the cache)
    for name in dict.fromkeys(r["cand"] for r in rows):
        R = [r for r in rows if r["cand"] == name]; f = lambda k: [float(r[k]) for r in R]
        err = sum(abs(float(r["sps"]) / float(r["target"]) - 1) for r in R) / len(R)
        dia = [float(r["f0st"]) for r in R if r["line"] in ("T02", "T03", "T11", "T12")]
        nar = [float(r["f0st"]) for r in R if r["line"] not in ("T02", "T03", "T11", "T12")]
        out.append(f"| {name} | {R[0]['engine']} | {sum(f('mos')) / len(R):.2f} | {100 * sum(f('cer')) / len(R):.1f}% | {100 * err:.0f}% | "
                   f"{sum(nar) / len(nar):.1f} / {sum(dia) / len(dia):.1f} | {float(R[7]['pmean']):.2f} s |")
    open(f"{HERE}/results.md", "w").write("\n".join(out) + "\n"); print("\n".join(out))


def sheet(name):
    d = f"{V}/build/voicelab/{name}"; os.makedirs(f"{V}/final/voice_ab", exist_ok=True)
    gap = (ve.np.zeros(int(0.7 * ve.SR), ve.np.float32))
    x = ve.np.concatenate([p for L in LINES for p in (ve.read_wav(f"{d}/{L['n']}.wav"), gap)])
    x = x / max(1e-6, float(ve.np.abs(x).max())) * 0.89
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(ve.SR), "-ac", "1", "-i", "pipe:0", "-af", "loudnorm=I=-16:TP=-1.5",
                    "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "64k", f"{V}/final/voice_ab/samples-{name}.mp3"], input=x.astype("float32").tobytes(), check=True)


if __name__ == "__main__":
    a = sys.argv[1:]
    if a[0] == "--table": table()
    elif a[0] == "--sheet": [sheet(n) for n in a[1:]]
    else: [run(n) for n in a]
