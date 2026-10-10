"""Benchmark scorecard for the "○○ 특" v2 shorts against targets.teuk (research/benchmark-targets-drawn.json), measured
the way the benchmark report measured ours: the render (final/<id>.mp4, qa_review's picture crop and scene threshold)
and the voice timeline (build/<id>/timeline.json: Hangul syllables / summed line lengths, pauses left out).

usage: python3 media/teuk/score.py <id> [...]      prints one markdown row per short (and the cut list with -v)
"""
import json, os, re, statistics, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, ROOT)
from qa_review import measure  # same cut detection as the review (scene > 0.12 for photo/face clips, merged within 0.3 s)

T = json.load(open(f"{ROOT}/research/benchmark-targets-drawn.json"))["teuk"]
print(f"| 목표 | {T['length_s']}초 | {T['hook_end_s']}초 | {T['first_cut_s']}초 | {T['shot_mean_s']} / {T['shot_max_s']}초 | {T['syl_per_s']} | {T['lines']} | 3~7자 |")
for sid in [a for a in sys.argv[1:] if a != "-v"]:
    tl = json.load(open(f"{ROOT}/build/{sid}/timeline.json"))
    script = json.load(open(f"{ROOT}/shorts/{sid}/script.json"))
    edit = json.load(open(f"{ROOT}/shorts/{sid}/edit.json"))
    drawn = all(c.get("gfx", {}).get("type") in ("scene", "post", "road") for c in edit["clips"])
    dur, _, _, cuts, _ = measure(f"{ROOT}/final/{sid}.mp4", 0.04 if drawn else 0.12)
    shots = [b - a for a, b in zip([0.0] + cuts, cuts + [dur])]
    syl = sum(len(re.findall(r"[가-힣]", L["chars"])) for L in tl["lines"]); talk = sum(L["dur"] for L in tl["lines"])
    hook = tl["lines"][0]["start"] + tl["lines"][0]["dur"]
    title = " ".join(script["title"]); tl_len = len(re.findall(r"[가-힣A-Za-z0-9]", title))
    print(f"| `{sid}` {title} | {dur:.1f}초 | {hook:.2f}초 | {shots[0]:.2f}초 | {statistics.mean(shots):.2f} / {max(shots):.2f}초 | {syl / talk:.2f} | {len(tl['lines'])} | {tl_len}자 |")
    if "-v" in sys.argv: print("   cuts:", [round(c, 2) for c in cuts])
