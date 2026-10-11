"""requests/<id>.json → data/<id>.json  (쿠팡 파트너스 API 로 상품 정보 + 내 파트너스 링크 받기)

요청 파일 형식 (셋 중 하나 이상):
  {"urls": ["https://www.coupang.com/vp/products/9024123826?itemId=..."],
   "keyword": "검색어",          # urls 의 상품을 검색 결과에서 찾아 이름·가격·이미지를 채운다. 없으면 링크만 만든다
   "category": 1014,             # 카테고리 베스트에서 limit 개
   "goldbox": true,              # 오늘의 특가
   "limit": 9}

API 는 상품 번호로 직접 조회하는 기능이 없어서, 주소로 준 상품은 keyword 검색 결과 안에서 productId 로 찾는다.
못 찾으면 상품 페이지의 og 태그를 한 번 읽어 보고(막히면 그만), 그래도 없으면 missing 으로 남긴다.

사용: python fetch.py <id> [<id> ...]   (키는 COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY)
"""
import html
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from coupang_api import CATEGORIES, ApiError, Client  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36"


def pid_of(url: str) -> str | None:
    m = re.search(r"/products/(\d+)", url)
    return m.group(1) if m else None


def item_of(url: str) -> str | None:
    m = re.search(r"[?&]itemId=(\d+)", url)
    return m.group(1) if m else None


def norm(p: dict, source: str) -> dict:
    """API 응답 한 건 → 우리 형식"""
    return {
        "productId": str(p.get("productId", "")),
        "name": p.get("productName", ""),
        "price": p.get("productPrice"),
        "image": p.get("productImage", ""),
        "link": p.get("productUrl", ""),
        "rocket": bool(p.get("isRocket")),
        "freeShipping": bool(p.get("isFreeShipping")),
        "category": p.get("categoryName", ""),
        "rank": p.get("rank"),
        "source": source,
    }


def og_scrape(url: str) -> dict:
    """상품 페이지 og 태그 (쿠팡은 봇을 자주 막는다 — 실패해도 조용히 넘어간다)"""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "ko-KR,ko;q=0.9"})
        with urllib.request.urlopen(req, timeout=20) as r:
            page = r.read(600_000).decode("utf-8", "replace")
    except Exception as e:  # noqa: BLE001
        return {"error": str(e)[:200]}
    def og(k):
        m = re.search(rf'<meta[^>]+property="og:{k}"[^>]+content="([^"]*)"', page)
        return html.unescape(m.group(1)) if m else ""
    price = re.search(r'"(?:salePrice|finalPrice|price)"\s*:\s*"?([\d,]+)', page)
    return {"name": og("title").replace(" - 쿠팡!", "").strip(), "image": og("image"),
            "price": int(price.group(1).replace(",", "")) if price else None}


def fetch(rid: str, api: Client) -> dict:
    req = json.loads((ROOT / "requests" / f"{rid}.json").read_text())
    limit = int(req.get("limit", 9))
    out = {"id": rid, "fetchedAt": time.strftime("%Y-%m-%d %H:%M KST", time.gmtime(time.time() + 9 * 3600)),
           "request": req, "products": [], "missing": [], "log": []}
    pool: dict[str, dict] = {}

    if req.get("keyword"):
        for p in api.search(req["keyword"], limit=10):
            pool.setdefault(str(p.get("productId")), norm(p, f"search:{req['keyword']}"))
        out["log"].append(f"검색 '{req['keyword']}' → {len(pool)}개")
    if req.get("category"):
        c = int(req["category"])
        got = api.best(c, limit=max(limit, 10))
        for p in got:
            pool.setdefault(str(p.get("productId")), norm(p, f"best:{CATEGORIES.get(c, c)}"))
        out["log"].append(f"베스트 {CATEGORIES.get(c, c)} → {len(got)}개")
    if req.get("goldbox"):
        got = api.goldbox()
        for p in got:
            pool.setdefault(str(p.get("productId")), norm(p, "goldbox"))
        out["log"].append(f"골드박스 → {len(got)}개")

    urls = req.get("urls", [])
    links = {}
    if urls:
        for d in api.deeplink(urls):
            links[d.get("originalUrl", "")] = d.get("shortenUrl") or d.get("landingUrl", "")
    for u in urls:
        pid = pid_of(u)
        p = dict(pool.get(pid or "", {})) or {"productId": pid or "", "source": "url"}
        if not p.get("name") or not p.get("image"):
            og = og_scrape(u)
            if og.get("error"):
                out["log"].append(f"{pid}: 상품 페이지 읽기 실패 ({og['error']})")
            for k in ("name", "image", "price"):
                if og.get(k) and not p.get(k):
                    p[k] = og[k]
        p["url"] = u
        p["itemId"] = item_of(u)
        p["link"] = links.get(u) or p.get("link", "")
        p["requested"] = True
        if not (p.get("name") and p.get("image")):
            out["missing"].append(pid or u)
            out["log"].append(f"{pid}: 이름·이미지를 못 찾음 → 요청에 \"keyword\" (상품명 핵심어)를 넣어 다시 받으세요")
        out["products"].append(p)

    # 주소로 고른 상품 다음에 검색·베스트 결과를 붙인다 (랭킹형 쇼츠 후보)
    chosen = {p.get("productId") for p in out["products"]}
    for pid, p in pool.items():
        if pid not in chosen and len(out["products"]) < max(limit, len(urls)):
            out["products"].append(p)
    # 단축 링크가 없는 후보도 내 파트너스 링크(productUrl)를 그대로 쓴다 — API 응답의 productUrl 이 이미 파트너스 링크다
    return out


def main(ids: list[str]) -> int:
    bad = 0
    for rid in ids:
        try:
            d = fetch(rid, Client())
        except ApiError as e:
            print(f"[{rid}] 실패: {e}")
            bad += 1
            continue
        p = ROOT / "data" / f"{rid}.json"
        p.write_text(json.dumps(d, ensure_ascii=False, indent=1) + "\n")
        print(f"[{rid}] 상품 {len(d['products'])}개, 못 찾음 {len(d['missing'])}개 → {p.relative_to(ROOT)}")
        for line in d["log"]:
            print("   ", line)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
