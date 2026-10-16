"""제휴 플랫폼별 이름·광고 표시 문구. 한 편에 쓰인 플랫폼(상품의 links 키)에 맞춰 화면·설명란 문구를 고른다.

네이버 쇼핑커넥트 문구는 공식 지정 문구를 확인하지 못해 쿠팡 문구와 같은 틀로 썼다 —
브랜드커넥트 안내에 정해진 문구가 있으면 여기 "disclosure" 만 바꾸면 화면·설명란이 같이 바뀐다.
"""
PLATFORMS = {
    "coupang": {"name": "쿠팡", "program": "쿠팡 파트너스",
                "disclosure": "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다."},
    "naver": {"name": "네이버", "program": "네이버 쇼핑커넥트",
              "disclosure": "이 포스팅은 네이버 쇼핑커넥트 활동의 일환으로, 판매 발생 시 수수료를 제공받습니다."},
}
ORDER = list(PLATFORMS)


def used(products: list[dict]) -> list[str]:
    """상품들의 links 에 실제로 들어 있는 플랫폼 (정해진 순서). 하나도 없으면 쿠팡."""
    keys = {k for p in products for k, v in (p.get("links") or {}).items() if v}
    return [k for k in ORDER if k in keys] or ["coupang"]


def chip(ps: list[str]) -> str:
    """화면 오른쪽 위 작은 표시"""
    return "광고 · " + (PLATFORMS[ps[0]]["program"] if len(ps) == 1 else "·".join(PLATFORMS[p]["name"] for p in ps) + " 제휴")


def screen_lines(ps: list[str]) -> list[str]:
    """화면 아래 두 줄 고지"""
    if ps == ["coupang"]:
        return ["이 영상은 쿠팡 파트너스 활동의 일환으로,", "이에 따른 일정액의 수수료를 제공받습니다."]
    if ps == ["naver"]:
        return ["이 영상은 네이버 쇼핑커넥트 활동의 일환으로,", "판매 발생 시 수수료를 제공받습니다."]
    return [f"이 영상은 {'·'.join(PLATFORMS[p]['program'] for p in ps)} 활동의", "일환으로, 판매 발생 시 수수료를 제공받습니다."]


def disclosures(ps: list[str]) -> list[str]:
    """설명란·고정댓글 맨 위 문구 (플랫폼마다 한 줄)"""
    return [PLATFORMS[p]["disclosure"] for p in ps]
