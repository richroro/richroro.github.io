"""specs/<id>.json + data/<id>.json → out/<id>.txt  (유튜브 업로드용 제목·설명·고정댓글)

쇼츠 설명란·댓글의 링크는 눌리지 않을 수 있어서, 링크는 채널 프로필의 링크 모음에도 같이 올린다.
대가성 문구는 설명란 맨 위와 고정댓글 둘 다에 넣는다.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DISCLOSURE = "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다."
MUSIC = {  # Kevin MacLeod (incompetech.com), CC BY 4.0
    "monkeys_spinning_monkeys": "Monkeys Spinning Monkeys", "hyperfun": "Hyperfun", "sneaky_snitch": "Sneaky Snitch",
    "scheming_weasel": "Scheming Weasel (faster version)", "hustle": "Hustle",
}


def desc(sid: str) -> str:
    spec = json.loads((ROOT / "specs" / f"{sid}.json").read_text())
    data = json.loads((ROOT / "data" / f"{spec.get('data', sid)}.json").read_text())
    byid = {str(p["productId"]): p for p in data["products"]}
    seen, items = set(), []
    for b in spec["beats"]:
        p = byid.get(str(b.get("p")))
        if p and p["productId"] not in seen:
            seen.add(p["productId"])
            items.append((b.get("tag", ""), p))
    if any(t for t, _ in items):
        items.sort(key=lambda x: int("".join(c for c in x[0] if c.isdigit()) or 99))
    lines = [f"▶ {(t + ' ') if t else ''}{p['name']}\n{p.get('link') or p.get('url', '')}" for t, p in items]
    tags = " ".join("#" + h.lstrip("#").replace(" ", "") for h in (spec.get("hashtags") or [])[:10])
    music = MUSIC.get(spec.get("music", ""), spec.get("music", ""))
    title = spec.get("ytTitle") or " ".join(spec["title"])
    body = "\n".join([
        DISCLOSURE,
        "",
        spec.get("summary", ""),
        "",
        *lines,
        "",
        f"※ 가격·배송은 {data.get('fetchedAt', '')[:10]} 기준이며 바뀔 수 있어요. 제품 링크는 프로필 링크에도 있어요.",
        "",
        f"Music: \"{music}\" Kevin MacLeod (incompetech.com) Licensed under Creative Commons: By Attribution 4.0 http://creativecommons.org/licenses/by/4.0/" if music else "",
        "",
        tags + " #쇼츠",
    ])
    pinned = "\n".join([DISCLOSURE, "", *lines])
    return f"[제목]\n{title} #쇼츠\n\n[설명]\n{body}\n\n[고정댓글]\n{pinned}\n\n[설정]\n- 업로드 화면 '자세히 보기' → 유료 프로모션 → '간접 광고·스폰서십·보증광고 등 유료 프로모션 포함' 체크\n- 아동용 아님\n"


if __name__ == "__main__":
    for sid in sys.argv[1:]:
        out = ROOT / "out" / f"{sid}.txt"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(desc(sid))
        print("업로드 문구:", out.relative_to(ROOT))
