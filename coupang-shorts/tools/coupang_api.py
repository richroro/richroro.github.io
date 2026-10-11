"""쿠팡 파트너스 Open API 클라이언트 (표준 라이브러리만 사용).

키는 환경변수 COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY 에서 읽는다.
서명 방식은 쿠팡 파트너스 공식 예제(HmacSHA256, signed-date = yyMMdd'T'HHmmss'Z' GMT)를 그대로 따른다.

쓰는 API
  search(keyword)           상품 검색 (한 번에 최대 10개, 시간당 호출 수 제한이 빡빡하다)
  best(category_id)         카테고리 베스트
  goldbox()                 골드박스(오늘의 특가)
  deeplink(urls)            쿠팡 상품 주소 → 내 파트너스 단축 링크
"""
import hashlib
import hmac
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request

HOST = os.environ.get("COUPANG_API_HOST", "https://api-gateway.coupang.com")  # 시험용으로만 바꾼다
BASE = "/v2/providers/affiliate_open_api/apis/openapi/v1"

# 쿠팡 파트너스 베스트 카테고리 번호
CATEGORIES = {
    1001: "여성패션", 1002: "남성패션", 1010: "뷰티", 1011: "출산/유아동", 1012: "식품",
    1013: "주방용품", 1014: "생활용품", 1015: "홈인테리어", 1016: "가전디지털", 1017: "스포츠/레저",
    1018: "자동차용품", 1019: "도서/음반/DVD", 1020: "완구/취미", 1021: "문구/오피스",
    1024: "헬스/건강식품", 1025: "국내여행", 1026: "해외여행", 1029: "반려동물용품", 1030: "유아동패션",
}


class ApiError(RuntimeError):
    pass


def authorization(method: str, path_and_query: str, access: str, secret: str, now: float | None = None) -> str:
    """CEA 서명 헤더. path_and_query 는 '/v2/...?...' (쿼리는 이미 인코딩된 그대로)."""
    path, _, query = path_and_query.partition("?")
    t = time.gmtime(now if now is not None else time.time())
    signed = time.strftime("%y%m%dT%H%M%SZ", t)
    msg = signed + method + path + query
    sig = hmac.new(secret.encode(), msg.encode(), hashlib.sha256).hexdigest()
    return f"CEA algorithm=HmacSHA256, access-key={access}, signed-date={signed}, signature={sig}"


class Client:
    def __init__(self, access: str | None = None, secret: str | None = None, sub_id: str | None = None):
        self.access = access or os.environ.get("COUPANG_ACCESS_KEY", "")
        self.secret = secret or os.environ.get("COUPANG_SECRET_KEY", "")
        self.sub_id = sub_id or os.environ.get("COUPANG_SUB_ID") or None
        if not (self.access and self.secret):
            raise ApiError("COUPANG_ACCESS_KEY / COUPANG_SECRET_KEY 가 없습니다 (저장소 Settings → Secrets → Actions).")

    def _call(self, method: str, path: str, params: dict | None = None, body: dict | None = None):
        q = urllib.parse.urlencode({k: v for k, v in (params or {}).items() if v is not None}, quote_via=urllib.parse.quote)
        pq = BASE + path + (f"?{q}" if q else "")
        data = json.dumps(body).encode() if body is not None else None
        for attempt in range(3):
            req = urllib.request.Request(HOST + pq, data=data, method=method, headers={
                "Authorization": authorization(method, pq, self.access, self.secret),
                "Content-Type": "application/json;charset=UTF-8",
            })
            try:
                with urllib.request.urlopen(req, timeout=30) as r:
                    out = json.load(r)
                break
            except urllib.error.HTTPError as e:
                detail = e.read().decode("utf-8", "replace")[:500]
                if e.code in (429, 500, 502, 503) and attempt < 2:
                    time.sleep(5 * (attempt + 1))
                    continue
                raise ApiError(f"{method} {path} → HTTP {e.code}: {detail}") from None
        if str(out.get("rCode", "0")) != "0":
            raise ApiError(f"{method} {path} → {out.get('rCode')} {out.get('rMessage')}")
        return out.get("data")

    def search(self, keyword: str, limit: int = 10, image_size: str = "800x800") -> list[dict]:
        d = self._call("GET", "/products/search", {"keyword": keyword, "limit": min(limit, 10), "subId": self.sub_id, "imageSize": image_size})
        return (d or {}).get("productData", [])

    def best(self, category_id: int, limit: int = 20, image_size: str = "800x800") -> list[dict]:
        return self._call("GET", f"/products/bestcategories/{category_id}", {"limit": limit, "subId": self.sub_id, "imageSize": image_size}) or []

    def goldbox(self, image_size: str = "800x800") -> list[dict]:
        return self._call("GET", "/products/goldbox", {"subId": self.sub_id, "imageSize": image_size}) or []

    def deeplink(self, urls: list[str]) -> list[dict]:
        body = {"coupangUrls": urls}
        if self.sub_id:
            body["subId"] = self.sub_id
        return self._call("POST", "/deeplink", body=body) or []
