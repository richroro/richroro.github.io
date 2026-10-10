"""[괴담] v2 benchmark scorecard: one row per short against research/benchmark-targets-footage.json "horror_riddle".
usage: python3 media/horror/scorecard.py horror1 [horror2 ...]     (after render.sh; reads final/<id>.mp4, build/<id>/timeline.json)
Length and shots are measured on the render with qa_review.py's own scene detection (threshold 0.12, cuts closer than 0.3 s
merged); the hook end (the first sentence's last syllable + 0.15 s), syllables per second (all syllables / length) and
lines (script lines; sentences in brackets) come from the voice timeline and script."""
import json, os, re, statistics, sys
HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, HERE)
from qa_review import measure  # noqa: E402  (the review's own measurement, unchanged)
T = json.load(open(f"{HERE}/research/benchmark-targets-footage.json"))["horror_riddle"]
KEEP = re.compile(r"[가-힣A-Za-z0-9]")

def card(sid):
    tl = json.load(open(f"{HERE}/build/{sid}/timeline.json")); sc = json.load(open(f"{HERE}/shorts/{sid}/script.json"))
    dur, _, _, cuts, _ = measure(f"{HERE}/final/{sid}.mp4", 0.12)
    shots = [b - a for a, b in zip([0.0] + cuts, cuts + [dur])]
    a = tl["lines"][0]; n0 = len(KEEP.findall(sc["lines"][0]["say"].split("|")[0]))
    hook = a["start"] + a["ct"][n0 - 1] + 0.15
    syl = sum(len(L["chars"]) for L in tl["lines"])
    sents = sum(len([p for p in L["say"].split("|") if p.strip()]) for L in sc["lines"])
    title = [re.sub(r"[\\\[\]]", "", t) for t in sc["title"]]
    return {"id": sid, "len": round(dur, 1), "hook": round(hook, 2), "first_cut": round(shots[0], 2), "mean": round(statistics.mean(shots), 2),
            "max": round(max(shots), 2), "syl_s": round(syl / dur, 2), "syl": syl, "lines": len(sc["lines"]), "sents": sents,
            "title": " / ".join(title), "title_chars": [len(KEEP.findall(t)) for t in title]}

if __name__ == "__main__":
    print(f"| id | 길이 (목표 20–23, {T['length_s']}) | 훅 끝 (≤{T['hook_end_s']}) | 첫 전환 (≤{T['first_cut_s']}) | 평균 샷 ({T['shot_mean_s']}) | 최장 샷 (≤{T['shot_max_s']}) | 음절/초 (≥{T['syl_per_s']}) | 줄 수 ({T['lines']}) | 화면 제목 ({'+'.join(map(str, T['title_chars_per_line']))}자) |")
    print("|---|---|---|---|---|---|---|---|---|")
    for sid in sys.argv[1:]:
        c = card(sid)
        print(f"| `{c['id']}` | {c['len']}초 | {c['hook']}초 | {c['first_cut']}초 | {c['mean']}초 | {c['max']}초 | {c['syl_s']} ({c['syl']}음절) | {c['lines']}줄 ({c['sents']}문장) | {c['title']} ({'+'.join(map(str, c['title_chars']))}자) |")
