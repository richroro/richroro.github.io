"""data/<id>.json → specs/<id>.json  (장면 문구 자동 작성)

ANTHROPIC_API_KEY 가 있으면 Claude 가 상품 사진을 보고 제목·장면 문구·확대 위치를 쓴다.
없으면 상품명·가격만으로 규칙대로 채운다 (나중에 specs/<id>.json 을 손으로 고쳐도 된다).
이미 specs/<id>.json 이 있으면 건드리지 않는다 (--force 로 덮어쓰기).

형식
  상품 1개(주소 하나)  → "single": 한 상품을 6~8 장면으로 (후킹 → 특징 클로즈업 → 가격 → 행동 유도)
  상품 여러 개          → "rank":   TOP N 을 낮은 순위부터 (1위는 마지막)

사용: python autospec.py <id> [--force]
"""
import base64
import json
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from render import load_image  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
MODEL = os.environ.get("COUPANG_COPY_MODEL") or "claude-opus-5-5"
MUSIC = ["monkeys_spinning_monkeys", "hyperfun", "sneaky_snitch", "scheming_weasel", "hustle"]

SYSTEM = """너는 한국 유튜브 쇼핑 쇼츠(쿠팡 파트너스·네이버 쇼핑커넥트 제휴) 편집자다. 음성 없이 자막과 음악만으로 보는 25초 안팎의 '흰 카드' 쇼츠의 문구를 쓴다.
화면: 흰 바탕, 위에 굵은 제목 두 줄(영상 내내 고정), 가운데 정사각 상품 사진(장면마다 다른 부분을 확대), 사진 아래 큰 글씨 한 줄(ko)과 작은 글씨 한 줄(sub).

해외에서 조회수가 높은 상품 쇼츠의 공통점을 따른다:
- 첫 장면 1초 안에 '문제' 또는 '궁금증'을 던진다 ("아직도 ~하세요?", "이거 모르면 손해", "자취 3년 차가 제일 잘 산 것").
- 장면마다 하나의 정보만. 짧고 구어체. ko 는 16자 이내, sub 는 20자 이내, 제목 한 줄은 14자 이내.
- 사진의 서로 다른 부분(버튼, 소재, 구성품, 크기감)을 확대해 보여 주며 그 부분을 설명한다. 사진에 실제로 보이는 것만 말한다.
- 가격 장면은 한 번 (price: true). 마지막 장면은 행동 유도: "제품 정보는 프로필 링크" 같은 문구.

지켜야 할 것 (표시·광고법, 쿠팡 파트너스·네이버 쇼핑커넥트 정책):
- 상품명·사진·가격에서 확인되는 사실만. 효능·의학적 효과·'최저가'·'1위'·판매량 같은 확인 안 되는 주장 금지.
- 써 보지 않았으므로 "써 봤더니", "제가 직접" 같은 사용 후기 표현 금지.
- 브랜드를 깎아내리거나 다른 제품과 비교 광고 금지.
- rank 형식의 순위는 '검색·베스트 순서' 또는 요청자가 고른 순서일 뿐이니 sub 나 제목에서 '판매 1위'처럼 단정하지 않는다.

focus 는 확대 중심 (x, y: 0~1, 사진 왼쪽 위가 0,0), zoom 은 [시작, 끝] 배율 (1.0 = 전체, 2.2 까지).
ring 은 강조할 작은 부분에 그리는 빨간 원 (x, y, 반지름: 사진 폭 비율, 반지름 0.08~0.25). 필요할 때만."""

BEAT = {
    "type": "object",
    "properties": {
        "p": {"type": "string", "description": "상품 productId"},
        "ko": {"type": "string"},
        "sub": {"type": "string"},
        "dur": {"type": "number"},
        "zoom": {"type": "array", "items": {"type": "number"}},
        "focus": {"type": "array", "items": {"type": "number"}},
        "ring": {"type": "array", "items": {"type": "number"}},
        "tag": {"type": "string"},
        "price": {"type": "boolean"},
    },
    "required": ["p", "ko", "sub", "dur", "zoom", "focus", "ring", "tag", "price"],
    "additionalProperties": False,
}
SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "array", "items": {"type": "string"}},
        "ytTitle": {"type": "string", "description": "유튜브 업로드 제목 (40자 이내, 궁금증 단어 하나)"},
        "summary": {"type": "string", "description": "설명란 첫 줄 (60자 이내)"},
        "hashtags": {"type": "array", "items": {"type": "string"}},
        "beats": {"type": "array", "items": BEAT},
    },
    "required": ["title", "ytTitle", "summary", "hashtags", "beats"],
    "additionalProperties": False,
}


def has_pic(p: dict) -> bool:
    return bool(p.get("image") or p.get("imageFile"))


def short_name(name: str, words: int = 3) -> str:
    n = re.sub(r"\[[^\]]*\]|\([^)]*\)|【[^】]*】", " ", name or "")
    n = re.sub(r"\b\d+(?:\.\d+)?\s*(?:개|매|팩|세트|ml|mL|L|g|kg|cm|mm|EA|ea|P|p|입|롤|구)\b.*$", "", n)
    n = re.sub(r"[,/+|]+.*$", "", n)
    w = n.split()
    return " ".join(w[:words]) or (name or "")[:14]


def rule_spec(data: dict) -> dict:
    prods = [p for p in data["products"] if has_pic(p)]
    req = data.get("request", {})
    asked = [p for p in prods if p.get("requested")]
    if len(asked) == 1 and len(req.get("urls", [])) + len(req.get("products", [])) == 1:
        p = asked[0]
        nm = short_name(p["name"])
        beats = [
            {"p": p["productId"], "ko": "오늘 소개할 이것", "sub": nm, "zoom": [1.0, 1.1]},
            {"p": p["productId"], "ko": nm, "sub": p.get("category", ""), "zoom": [1.3, 1.5], "focus": [0.5, 0.4]},
            {"p": p["productId"], "ko": "가격은 이 정도", "sub": "(올린 날 기준)", "price": True, "zoom": [1.0, 1.06]},
        ]
        if p.get("rocket"):
            beats.append({"p": p["productId"], "ko": "로켓배송 상품", "sub": "주문하면 빠르게 와요", "zoom": [1.2, 1.35], "focus": [0.5, 0.6]})
        beats.append({"p": p["productId"], "ko": "제품 정보는 프로필 링크", "sub": "가격은 수시로 바뀌어요", "dur": 3.2, "zoom": [1.0, 1.08]})
        tags = (["쿠팡추천", "쿠팡꿀템"] if (p.get("links") or {}).get("coupang") or p.get("link") else ["꿀템추천"]) + ["살림템"]
        return {"title": ["이거 뭔지 아세요?", nm[:14]], "ytTitle": f"{nm} 이거 뭐길래?", "summary": f"{nm} 한눈에 보기",
                "hashtags": tags, "beats": beats}
    top = prods[: int(req.get("limit", 5))]
    n = len(top)
    kw = req.get("keyword") or (top[0].get("category") if top else "") or "추천템"
    api = bool(req.get("keyword") or req.get("category") or req.get("goldbox"))
    basis = ("쿠팡 " + ("베스트" if req.get("category") else "검색") + " 기준") if api else "채널 추천 순서"
    beats = [{"p": p["productId"], "ko": short_name(p["name"]), "sub": f"{int(p['price']):,}원" if p.get("price") else "",
              "tag": f"{n - i}위", "zoom": [1.0, 1.12]} for i, p in enumerate(reversed(top))]
    if top:
        beats.append({"p": top[0]["productId"], "ko": "제품 정보는 프로필 링크", "sub": f"순위는 {basis}", "dur": 3.2, "zoom": [1.0, 1.08]})
    if api:
        return {"title": [f"쿠팡 {kw}", f"인기 TOP {n}"], "ytTitle": f"쿠팡 {kw} 인기 TOP {n} 정리", "summary": f"쿠팡 {kw} 인기 상품 {n}개",
                "hashtags": ["쿠팡추천", "쿠팡꿀템", kw.replace(" ", "")], "beats": beats}
    return {"title": [f"{kw}", f"추천 TOP {n}"], "ytTitle": f"{kw} 추천 TOP {n} 정리", "summary": f"{kw} 추천 상품 {n}개",
            "hashtags": ["살림템", "꿀템추천", kw.replace(" ", "")], "beats": beats}


def claude_spec(data: dict) -> dict:
    import anthropic

    prods = [p for p in data["products"] if has_pic(p)][:9]
    req = data.get("request", {})
    asked = [p for p in prods if p.get("requested")]
    mode = "single" if len(asked) == 1 and len(req.get("urls", [])) + len(req.get("products", [])) == 1 else "rank"
    if mode == "single":
        prods = asked  # 검색으로 같이 받은 다른 상품은 보내지 않는다
    content = []
    for p in prods:
        buf = __import__("io").BytesIO()
        load_image(p).resize((768, 768)).save(buf, "JPEG", quality=85)
        content.append({"type": "text", "text": json.dumps({k: p.get(k) for k in ("productId", "name", "price", "rocket", "category")}, ensure_ascii=False)})
        content.append({"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": base64.standard_b64encode(buf.getvalue()).decode()}})
    if mode == "single":
        ask = ("상품 하나로 'single' 쇼츠를 만든다. 장면 7~8개, 장면당 2.5~3초, 총 22~26초. 모든 장면의 p 는 같은 상품. "
               "첫 장면은 사진 전체(zoom 1.0→1.1), 이후 장면은 사진 속 다른 부분을 확대. 마지막은 행동 유도 장면(3초).")
    else:
        ask = (f"상품 {len(prods)}개로 'rank' 쇼츠(TOP {len(prods)})를 만든다. 낮은 순위부터 1위를 마지막에, 장면당 2.6~2.8초, "
               "tag 는 'N위', ko 는 짧은 상품 이름, sub 는 한 줄 특징. 순서는 주어진 순서(먼저 나온 것이 1위). 마지막에 행동 유도 장면(3초, 1위 상품).")
    if req.get("note"):
        ask += f"\n요청자 메모: {req['note']}"
    content.append({"type": "text", "text": ask + "\n쓰지 않는 필드는 빈 값으로: ring [] , tag \"\", price false."})
    client = anthropic.Anthropic(max_retries=3, timeout=300.0)
    r = client.beta.messages.create(
        model=MODEL,
        max_tokens=16000,
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
        output_config={"effort": "high", "format": {"type": "json_schema", "schema": SCHEMA}},
        system=SYSTEM,
        messages=[{"role": "user", "content": content}],
    )
    if r.stop_reason in ("refusal", "max_tokens"):
        raise RuntimeError(f"문구 작성 실패: {r.stop_reason}")
    spec = json.loads(next(b.text for b in r.content if b.type == "text"))
    ids = {p["productId"] for p in prods}
    beats = []
    for b in spec["beats"]:
        if b["p"] not in ids:
            continue
        b = {k: v for k, v in b.items() if v not in ("", [], False)}
        b["dur"] = min(4.0, max(1.8, float(b.get("dur", 2.7))))
        z = b.get("zoom", [1.0, 1.1])
        b["zoom"] = [min(2.2, max(1.0, float(x))) for x in (z + z)[:2]]
        f = b.get("focus", [0.5, 0.5])
        b["focus"] = [min(1.0, max(0.0, float(x))) for x in (f + [0.5, 0.5])[:2]]
        if b.get("ring") and len(b["ring"]) != 3:
            b.pop("ring")
        beats.append(b)
    if not beats:
        raise RuntimeError("쓸 수 있는 장면이 없음")
    spec["beats"] = beats
    spec["title"] = [t for t in spec["title"] if t][:2]
    return spec


def main(argv: list[str]) -> int:
    force = "--force" in argv
    for rid in [a for a in argv if not a.startswith("--")]:
        out = ROOT / "specs" / f"{rid}.json"
        if out.exists() and not force:
            print(f"[{rid}] specs 가 이미 있어 그대로 둡니다")
            continue
        data = json.loads((ROOT / "data" / f"{rid}.json").read_text())
        if not any(has_pic(p) for p in data["products"]):
            print(f"[{rid}] 사진이 있는 상품이 없어 문구를 못 씁니다 — 쿠팡은 요청에 \"keyword\", 직접 넣은 상품은 \"imageFile\"/\"image\" 를 넣으세요")
            continue
        how = "규칙"
        if os.environ.get("ANTHROPIC_API_KEY"):
            try:
                spec = claude_spec(data)
                how = f"Claude ({MODEL})"
            except Exception as e:  # noqa: BLE001 — 실패하면 규칙으로라도 만든다
                print(f"[{rid}] Claude 문구 실패 → 규칙으로: {type(e).__name__}: {str(e)[:200]}")
                spec = rule_spec(data)
        else:
            spec = rule_spec(data)
        req = data.get("request", {})
        spec = {"data": rid, "badge": req.get("channel") or os.environ.get("CHANNEL_NAME") or "",
                "music": req.get("music") or MUSIC[sum(map(ord, rid)) % 3], "musicStart": 0, **spec}
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(spec, ensure_ascii=False, indent=1) + "\n")
        print(f"[{rid}] 장면 {len(spec['beats'])}개 ({how}) → {out.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
