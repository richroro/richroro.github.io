"""Benchmark scorecard for 그 시절 레트로 v2 shorts against research/benchmark-targets-footage.json ("retro").

usage: python3 media/retro/v2_scorecard.py retro1 [...]      (run from shorts/viral5, after render; prints a markdown table)
- length, first cut, mean and longest shot: final/<id>.mp4, measured with qa_review.py's own scene detection
- hook end: when the first spoken phrase (up to the first "|") ends, from build/<id>/timeline.json
- syllables per second: spoken syllables (numbers read out, as prep.py does) ÷ length; lines: narration lines
- title: characters per on-screen title line (spaces not counted)
"""
import json, os, statistics, sys

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, HERE)
from qa_review import measure  # noqa: E402  (the same measurement the review uses)
sys.argv, ids = sys.argv[:1], sys.argv[1:]
from prep import SYL, spoken_form  # noqa: E402

T = json.load(open(f"{HERE}/research/benchmark-targets-footage.json"))["retro"]
print("| id | 길이 | 훅 끝 | 첫 전환 | 평균 샷 | 최장 샷 | 음절/초 | 줄 수 | 제목 글자 |")
print("|---|---|---|---|---|---|---|---|---|")
print(f"| 목표 | {T['length_s']}초 | ≤{T['hook_end_s']}초 | ≤{T['first_cut_s']}초 | {T['shot_mean_s']}초 | ≤{T['shot_max_s']}초 | {T['syl_per_s']} | ≤{T['lines']} | {T['title_chars_per_line'][0]}/{T['title_chars_per_line'][1]} |")
for sid in ids:
    dur, _, _, cuts, _ = measure(f"{HERE}/final/{sid}.mp4", 0.12)
    shots = [b - a for a, b in zip([0.0] + cuts, cuts + [dur])]
    tl = json.load(open(f"{HERE}/build/{sid}/timeline.json")); s = json.load(open(f"{HERE}/shorts/{sid}/script.json"))
    L = tl["lines"][0]; first = len(SYL.findall(s["lines"][0]["say"].split("|")[0]))  # timeline chars are the written ones
    hook = L["start"] + L["ct"][min(first, len(L["ct"])) - 1] + 0.15  # the last syllable of the first phrase, plus its length
    syl = sum(len(spoken_form(x["say"].replace("|", ""))) for x in s["lines"])
    title = "/".join(str(len(t.replace(" ", ""))) for t in s["title"])
    print(f"| `{sid}` | {dur:.1f}초 | {hook:.1f}초 | {shots[0]:.1f}초 | {statistics.mean(shots):.1f}초 | {max(shots):.1f}초 | {syl / dur:.1f} | {len(s['lines'])} | {title} |")
