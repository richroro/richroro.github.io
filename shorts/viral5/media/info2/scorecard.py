"""Benchmark scorecard for info shorts v2 against research/benchmark-targets-footage.json "info_reason".

usage: python3 media/info2/scorecard.py <id> [<id> ...]    (after render.sh wrote final/<id>.mp4 and voice_edge.py the timeline)
Measures ours: length (ffprobe), hook end (end of the first spoken line, timeline), first cut / mean / longest shot
(qa_review.py's own scene detection), syllables per second (all syllables / length; and speech only, over the lines'
own durations), number of lines (sentences spoken), title characters per line. Prints a markdown row per short.
"""
import json, os, re, statistics, sys
HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, HERE)
import qa_review

T = json.load(open(f"{HERE}/research/benchmark-targets-footage.json"))["info_reason"]
SYL = re.compile(r"[가-힣A-Za-z0-9]")

def card(sid):
    tl = json.load(open(f"{HERE}/build/{sid}/timeline.json")); s = json.load(open(f"{HERE}/shorts/{sid}/script.json"))
    dur, _, _, cuts, _ = qa_review.measure(f"{HERE}/final/{sid}.mp4", 0.12)
    shots = [b - a for a, b in zip([0.0] + cuts, cuts + [dur])]
    syl = sum(len(L["chars"]) for L in tl["lines"]); speech = sum(L["dur"] for L in tl["lines"])
    sentences = sum(max(1, len(re.findall(r"[.?!]", L["say"]))) for L in s["lines"])
    first = tl["lines"][0]; hook = first["start"] + first["dur"]
    title = [len(t.replace("[", "").replace("]", "")) for t in s["title"]]
    return {"id": sid, "len": round(dur, 1), "hook": round(hook, 2), "cut": round(shots[0], 2), "mean": round(statistics.mean(shots), 2),
            "max": round(max(shots), 2), "sps": round(syl / dur, 2), "speech": round(syl / speech, 2), "lines": sentences, "title": title}

if __name__ == "__main__":
    print(f"| id | 길이 (목표 {T['length_s']}, 28–40) | 훅 끝 (≤{T['hook_end_s']}) | 첫 컷 ({T['first_cut_s']}) | 평균 샷 ({T['shot_mean_s']}) | 최장 샷 (≤{T['shot_max_s']}) | 음절/초 전체 ({T['syl_per_s']}) · 발화 | 문장 ({T['lines']}) | 제목 글자/줄 ({T['title_chars_per_line']}) |")
    print("|---|---|---|---|---|---|---|---|---|")
    for sid in sys.argv[1:]:
        c = card(sid)
        print(f"| {sid} | {c['len']} | {c['hook']} | {c['cut']} | {c['mean']} | {c['max']} | {c['sps']} · {c['speech']} | {c['lines']} | {'+'.join(map(str, c['title']))} |")
        json.dump(c, open(f"{HERE}/out/review/{sid}/scorecard.json", "w"), ensure_ascii=False)
