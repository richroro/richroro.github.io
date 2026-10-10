"""quick voice-timeline check: length, hook end, syllables per second (Hangul syllables / sum of line durations)"""
import json, re, sys
SYL = re.compile(r"[가-힣]")
for sid in sys.argv[1:]:
    t = json.load(open(f"build/{sid}/timeline.json")); s = json.load(open(f"shorts/{sid}/script.json"))
    say = {L["id"]: L["say"] for L in s["lines"]}
    syl = sum(len(SYL.findall(say[L["id"]])) for L in t["lines"]); d = sum(L["dur"] for L in t["lines"])
    L0 = t["lines"][0]
    print(f"{sid} end {t['end']:.1f} hook {L0['start'] + L0['dur']:.2f} syl/s {syl / d:.2f} lines {len(t['lines'])}")
