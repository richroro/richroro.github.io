#!/usr/bin/env python3
"""Paste-ready YouTube descriptions in the house format (upload/README.md):

    summary (2–4 sentences) → [chapters, long-form only] → ▶ subscribe line → [related link] → 출처 line → hashtags

usage: python3 upload/make_desc.py <id> [<id> ...]     one video each (reads upload/specs/<id>.json)
       python3 upload/make_desc.py --all               every spec, plus one index per channel (upload/<channel>.md)
Writes upload/txt/<id>.txt (just the description, to paste as is). Problems are printed as WARN lines; the exit code is 1
when a spec is missing fields the description needs.
"""
import json, re, sys
from pathlib import Path

UP = Path(__file__).resolve().parent
ROOT = UP.parent
CFG = json.loads((UP / "channels.json").read_text())
MAX_TAGS = 15  # YouTube ignores every hashtag past 60; 15 keeps them relevant
CC_BY = "Kevin MacLeod (incompetech.com), CC BY 4.0 (creativecommons.org/licenses/by/4.0)"


def channel_key(vid, spec):
    if spec.get("channel"):
        return spec["channel"]
    stem = re.sub(r"\d+$", "", vid)
    for key, ch in CFG["channels"].items():
        if stem in ch.get("prefixes", []):
            return key
    raise SystemExit(f"{vid}: no channel in channels.json for prefix '{stem}' (set \"channel\" in the spec)")


def music_of(vid):
    """Kevin MacLeod titles from the video's edit.json (shorts/, politics/ or longform/)."""
    for d in ("shorts", "politics", "longform"):
        f = ROOT / d / vid / "edit.json"
        if not f.exists():
            continue
        e = json.loads(f.read_text())
        ms = e.get("music")
        ms = ms if isinstance(ms, list) else [ms] if ms else []
        out = []
        for m in ms:
            name = Path(m if isinstance(m, str) else m.get("file", "")).stem
            if name:
                out.append(name if " " in name or name[:1].isupper() else name.replace("_", " ").title())
        return out
    return []


def build(vid):
    spec = json.loads((UP / "specs" / f"{vid}.json").read_text())
    key = channel_key(vid, spec)
    ch = CFG["channels"][key]
    long = spec.get("long", ch.get("long", False))
    warn, missing = [], [k for k in ("title", "summary", "tags") if not spec.get(k)]
    if missing:
        print(f"FAIL {vid}: missing {', '.join(missing)}")
        return None

    summary = re.sub(r"\s+", " ", spec["summary"]).strip()
    if spec.get("fiction") and "창작" not in summary:
        summary = "(창작) " + summary
    sentences = [s for s in re.split(r"(?<=[.?!])\s+", summary) if s]
    if not 2 <= len(sentences) <= 4:
        warn.append(f"summary has {len(sentences)} sentences (2–4)")
    if not 60 <= len(summary) <= 320:
        warn.append(f"summary is {len(summary)} characters (60–320)")
    blocks = [summary]

    if long:
        chapters = spec.get("chapters") or []
        if len(chapters) < 3 or chapters[0][0] not in ("0:00", "00:00"):
            warn.append("long-form needs 3+ chapters starting at 0:00")
        blocks.append("\n".join(f"{t} {name}" for t, name in chapters))

    blocks.append(f"▶ {ch['name']} 채널 구독: https://www.youtube.com/@{ch['handle'].lstrip('@')}")
    if ch.get("link"):
        blocks.append(f"{ch['link']['label']} ({ch['link']['url']})")

    src = list(spec.get("sources", []))
    music = spec.get("music", music_of(vid))
    if music:
        src.append("음악: " + ", ".join(f'"{m}"' for m in music) + " " + CC_BY)
    if spec.get("caveat"):
        src.append(spec["caveat"])
    if not src:
        warn.append("no sources")
    blocks.append("출처: " + " · ".join(src))

    tags, seen = [], set()
    for t in (["Shorts"] if not long else []) + spec["tags"] + ch.get("tags", []):
        t = re.sub(r"\s+", "", t.lstrip("#"))
        if t and t.lower() not in seen:
            seen.add(t.lower())
            tags.append(t)
    if len(tags) > MAX_TAGS:
        warn.append(f"{len(tags)} hashtags, kept the first {MAX_TAGS}")
        tags = tags[:MAX_TAGS]
    elif len(tags) < 8:
        warn.append(f"only {len(tags)} hashtags (8–15)")
    blocks.append(" ".join("#" + t for t in tags))

    text = "\n\n".join(blocks) + "\n"
    if "저작권 만료" in text:
        warn.append('"저작권 만료" wording: credit the source instead')
    if len(text) > 4900:
        warn.append(f"{len(text)} characters (YouTube allows 5000)")
    if "[채널명]" in text or "[핸들]" in text:
        warn.append("channel name/handle still placeholders in upload/channels.json")
    (UP / "txt").mkdir(exist_ok=True)
    (UP / "txt" / f"{vid}.txt").write_text(text)
    for w in warn:
        print(f"WARN {vid}: {w}")
    return key, spec, text


def index(results):
    """one page per channel, in upload-plan order where the plan lists the video"""
    plan = (ROOT / "UPLOAD_PLAN.md").read_text()
    order = {vid: i for i, vid in enumerate(re.findall(r"^\| *\d+ *\| *([a-z0-9_]+) *\|", plan, flags=re.M))}
    by = {}
    for vid, (key, spec, text) in results.items():
        by.setdefault(key, []).append((order.get(vid, 10_000), vid, spec, text))
    for key, rows in by.items():
        ch = CFG["channels"][key]
        out = [f"# {ch.get('label', key)} 업로드 문구\n",
               "제목, 설명글, 고정 댓글을 그대로 복사해 씁니다. 설명글 파일만 따로 필요하면 `upload/txt/<id>.txt`를 엽니다.\n"]
        for _, vid, spec, text in sorted(rows):
            out += [f"## {vid}\n", f"**제목**\n\n```\n{spec['title']}\n```\n", f"**설명글**\n\n```\n{text}```\n"]
            if spec.get("pinned"):
                out.append(f"**고정 댓글**\n\n```\n{spec['pinned']}\n```\n")
        (UP / f"{key}.md").write_text("\n".join(out))


if __name__ == "__main__":
    args = sys.argv[1:]
    ids = sorted(p.stem for p in (UP / "specs").glob("*.json")) if args == ["--all"] else args
    if not ids:
        raise SystemExit(__doc__)
    results, bad = {}, False
    for vid in ids:
        r = build(vid)
        if r:
            results[vid] = r
        else:
            bad = True
    if args == ["--all"]:
        index(results)
    print(f"{len(results)} descriptions written to upload/txt/")
    sys.exit(1 if bad else 0)
