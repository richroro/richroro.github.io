#!/usr/bin/env python3
"""경제뉴스 수집기.

feeds.json 의 언론사 RSS 를 모두 받아 분야를 나누고, 같은 사건을 다룬 기사끼리 묶어
data/ 아래에 날짜별 JSON 으로 저장한다. 시장 지표(코스피·환율·유가 …)도 같이 받는다.
표준 라이브러리만 쓴다. 깃허브 액션(.github/workflows/update-news.yml)이 돌린다.

  python fetch_news.py                       # feeds.json 전부 받기 (news/ 에서 실행)
  python fetch_news.py --offline-dir DIR     # 네트워크 없이 DIR/*.xml 을 피드로 읽기 (시험용)
  python fetch_news.py --no-markets          # 시장 지표는 건너뛰기

만드는 파일
  data/index.json          갱신 시각, 날짜 목록, 피드별 상태, 24시간 키워드
  data/days/YYYY-MM-DD.json 그날(한국 시각) 기사 목록 — 최신순
  data/markets.json        시장 지표 (실패하면 이전 값을 두고 stale 표시)

받는 데 실패한 피드는 건너뛰고, 이미 모은 기사는 그대로 둔다.
"""
from __future__ import annotations

import argparse
import email.utils
import hashlib
import html
import json
import math
import os
import re
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone

KST = timezone(timedelta(hours=9))
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/126.0 Safari/537.36 richroro-news/1.0 (+https://richroro.github.io/news/)")

KEEP_DAYS = 30          # 날짜 파일을 며칠치 남길지
WINDOW_DAYS = 2         # 오늘 + 이틀 전까지는 매번 다시 묶는다
MAX_PER_DAY = 900       # 하루 파일에 담을 최대 기사 수
SUMMARY_LEN = 110

MEDIA_NS = "http://search.yahoo.com/mrss/"

# ── 분야 나누기 ────────────────────────────────────────────────────────────
# 제목에 걸리면 2점, 요약에 걸리면 1점. 가장 높은 분야로, 0점이면 피드의 hint 로.
CATEGORIES = {
    "crypto": ["비트코인", "가상자산", "가상화폐", "암호화폐", "코인", "이더리움", "업비트", "빗썸",
               "스테이블코인", "블록체인", "리플", "디지털자산"],
    "estate": ["부동산", "아파트", "집값", "전세", "월세", "분양", "청약", "재건축", "재개발", "주택",
               "전셋값", "오피스텔", "공시가", "종부세", "주담대", "주택담보", "LH", "임대", "토지거래",
               "미분양", "정비사업"],
    "market": ["코스피", "코스닥", "증시", "주가", "상장", "공모주", "IPO", "순매수", "순매도",
               "상한가", "하한가", "시가총액", "시총", "ETF", "펀드", "증권", "나스닥", "다우",
               "S&P", "뉴욕증시", "배당", "공매도", "밸류업", "테마주", "거래소", "목표주가", "주식"],
    "macro": ["금리", "기준금리", "한은", "한국은행", "연준", "Fed", "FOMC", "물가", "CPI",
              "인플레", "환율", "원·달러", "원/달러", "원달러", "엔화", "GDP", "성장률", "경기침체",
              "경기 침체", "경기둔화", "경기 둔화", "고용", "실업", "수출", "무역수지", "경상수지",
              "국채", "채권", "재정", "세수", "예산", "기재부", "기획재정부", "가계부채", "가계대출",
              "통화", "외환"],
    "global": ["미국", "중국", "일본", "유럽", "EU", "트럼프", "관세", "미·중", "미중", "백악관",
               "시진핑", "러시아", "우크라이나", "중동", "국제유가", "OPEC", "위안화", "엔저", "독일",
               "영국", "인도", "베트남", "월가", "글로벌"],
    "industry": ["반도체", "삼성", "SK", "하이닉스", "현대차", "기아", "LG", "배터리", "이차전지",
                 "2차전지", "실적", "영업이익", "매출", "인수", "합병", "M&A", "수주", "조선", "철강",
                 "석유화학", "자동차", "AI", "인공지능", "바이오", "제약", "플랫폼", "스타트업",
                 "공장", "노조", "유통", "항공", "통신", "게임", "CEO", "회장", "그룹"],
}
# 동점이면 앞쪽이 이긴다: 좁고 뚜렷한 분야가 넓은 분야보다 먼저.
CATEGORY_ORDER = ["crypto", "estate", "market", "macro", "global", "industry"]
CATEGORY_NAMES = {
    "market": "증시", "macro": "금리·환율", "estate": "부동산", "industry": "산업·기업",
    "global": "국제", "crypto": "가상자산", "general": "경제일반",
}


def classify(title: str, summary: str, hint: str = "general") -> str:
    best, best_score = None, 0
    for cat in CATEGORY_ORDER:
        score = 0
        for word in CATEGORIES[cat]:
            if word in title:
                score += 2
            if summary and word in summary:
                score += 1
        if score > best_score:
            best, best_score = cat, score
    if best is None:
        return hint if hint in CATEGORY_NAMES else "general"
    return best


# ── 텍스트 손질 ────────────────────────────────────────────────────────────
TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"\s+")
IMG_RE = re.compile(r"<img[^>]+src=[\"']([^\"']+)[\"']", re.I)


def clean_text(s: str | None) -> str:
    if not s:
        return ""
    s = html.unescape(s)
    s = TAG_RE.sub(" ", s)
    s = html.unescape(s)          # 두 번 이스케이프된 피드가 있다
    return WS_RE.sub(" ", s).strip()


def shorten(s: str, n: int = SUMMARY_LEN) -> str:
    if len(s) <= n:
        return s
    cut = s[:n]
    sp = cut.rfind(" ")
    if sp > n * 0.6:
        cut = cut[:sp]
    return cut.rstrip(" ,.·…") + "…"


BRACKET_RE = re.compile(r"\[[^\]]{0,12}\]|【[^】]{0,12}】|\((?:종합|속보|단독|1보|2보|3보|상보|영상|사진|포토|그래픽)[^)]{0,6}\)")
NONWORD_RE = re.compile(r"[^0-9A-Za-z가-힣]+")


# 같은 말을 다르게 쓰는 경우를 한쪽으로 모은다 (묶기·중복 판단용)
SYNONYMS = [("한국은행", "한은"), ("기획재정부", "기재부"), ("금융위원회", "금융위"), ("금융감독원", "금감원"),
            ("공정거래위원회", "공정위"), ("국토교통부", "국토부"), ("산업통상자원부", "산업부"),
            ("미국", "미"), ("중국", "중"), ("일본", "일"), ("원·달러", "원달러"), ("원/달러", "원달러")]


def title_key(title: str) -> str:
    """같은 기사인지 볼 때 쓰는 제목 — 머리말([속보] 등)과 기호를 빼고 줄임말로 맞춘 것."""
    t = BRACKET_RE.sub(" ", title)
    for long, short in SYNONYMS:
        t = t.replace(long, short)
    return NONWORD_RE.sub("", t).lower()


TRACKING = re.compile(r"^(utm_|fbclid|gclid|ref$|from$|rss$|cmpid)", re.I)


def canonical_url(url: str) -> str:
    try:
        p = urllib.parse.urlsplit(url.strip())
    except ValueError:
        return url.strip()
    q = [(k, v) for k, v in urllib.parse.parse_qsl(p.query, keep_blank_values=True) if not TRACKING.match(k)]
    host = p.netloc.lower()
    if host.startswith("m."):
        host = host[2:]
    return urllib.parse.urlunsplit(("https", host, p.path.rstrip("/"), urllib.parse.urlencode(q), ""))


def make_id(url: str) -> str:
    return hashlib.sha1(canonical_url(url).encode()).hexdigest()[:12]


def safe_url(u: str | None) -> str | None:
    if not u:
        return None
    u = html.unescape(u.strip())
    if u.startswith("//"):
        u = "https:" + u
    if u.startswith("http://"):
        u = "https://" + u[7:]       # 페이지가 https 라 http 이미지는 막힌다
    return u if u.startswith("https://") else None


# ── 날짜 ───────────────────────────────────────────────────────────────────
def parse_date(s: str | None) -> datetime | None:
    if not s:
        return None
    s = s.strip()
    try:
        d = email.utils.parsedate_to_datetime(s)
        if d is not None:
            return d if d.tzinfo else d.replace(tzinfo=KST)
    except (TypeError, ValueError, IndexError):
        pass
    iso = s.replace("Z", "+00:00")
    iso = re.sub(r"([+-]\d{2})(\d{2})$", r"\1:\2", iso)
    for cand in (iso, iso.replace(" ", "T", 1)):
        try:
            d = datetime.fromisoformat(cand)
            return d if d.tzinfo else d.replace(tzinfo=KST)
        except ValueError:
            continue
    m = re.match(r"(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})\D+(\d{1,2}):(\d{2})(?::(\d{2}))?", s)
    if m:
        y, mo, da, h, mi, se = (int(x) if x else 0 for x in m.groups())
        try:
            return datetime(y, mo, da, h, mi, se, tzinfo=KST)
        except ValueError:
            return None
    return None


# ── RSS/Atom 읽기 ──────────────────────────────────────────────────────────
DECL_RE = re.compile(rb"^\s*<\?xml[^>]*\?>", re.S)
DECL_STR_RE = re.compile(r"^\s*<\?xml[^>]*\?>", re.S)
ENC_RE = re.compile(rb"encoding=[\"']([A-Za-z0-9_\-]+)[\"']")
BARE_AMP_RE = re.compile(r"&(?!(?:[A-Za-z][A-Za-z0-9]{1,31}|#\d{1,7}|#x[0-9A-Fa-f]{1,6});)")
CTRL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")


def decode_feed(raw: bytes, header_charset: str | None = None) -> str:
    if raw.startswith(b"\xef\xbb\xbf"):
        raw = raw[3:]
    enc = None
    m = DECL_RE.match(raw)
    if m:
        e = ENC_RE.search(m.group(0))
        if e:
            enc = e.group(1).decode().lower()
    for cand in (enc, header_charset, "utf-8", "cp949"):
        if not cand:
            continue
        if cand in ("euc-kr", "ks_c_5601-1987", "ksc5601"):
            cand = "cp949"
        try:
            return raw.decode(cand)
        except (LookupError, UnicodeDecodeError):
            continue
    return raw.decode("utf-8", errors="replace")


def local(tag) -> str:
    return tag.split("}", 1)[1] if isinstance(tag, str) and "}" in tag else (tag if isinstance(tag, str) else "")


def ns(tag) -> str:
    return tag[1:].split("}", 1)[0] if isinstance(tag, str) and tag.startswith("{") else ""


def _parse_xml(text: str):
    text = DECL_STR_RE.sub("", text, count=1)
    text = CTRL_RE.sub("", text)
    try:
        return ET.fromstring(text)
    except ET.ParseError:
        pass
    # 흔한 고장: 이스케이프 안 된 & , HTML 엔티티(&nbsp; 등)
    fixed = BARE_AMP_RE.sub("&amp;", text)
    fixed = re.sub(r"&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9A-Fa-f]+);)([A-Za-z][A-Za-z0-9]*);",
                   lambda mm: html.unescape("&" + mm.group(1) + ";").replace("&", "&amp;").replace("<", "&lt;"),
                   fixed)
    return ET.fromstring(fixed)


def _entry_from_element(el) -> dict:
    e = {"title": "", "link": "", "date": None, "desc": "", "image": None, "source": None}
    for ch in el:
        name, space = local(ch.tag), ns(ch.tag)
        text = (ch.text or "").strip()
        if space == MEDIA_NS:
            if name in ("content", "thumbnail") and not e["image"]:
                typ = ch.get("type", "") or ch.get("medium", "")
                if not typ or "image" in typ:
                    e["image"] = ch.get("url")
            elif name == "group":
                for g in ch:
                    if local(g.tag) in ("content", "thumbnail") and not e["image"]:
                        e["image"] = g.get("url")
            continue
        if name == "title":
            e["title"] = "".join(ch.itertext()).strip()
        elif name == "link":
            href = ch.get("href")
            if href:
                if ch.get("rel", "alternate") == "alternate" and not e["link"]:
                    e["link"] = href
            elif text and not e["link"]:
                e["link"] = text
        elif name == "guid" and text.startswith("http") and ch.get("isPermaLink", "true") != "false":
            e.setdefault("guid", text)
        elif name in ("pubDate", "date", "published", "issued") and not e["date"]:
            e["date"] = text
        elif name in ("updated", "modified") and not e["date"]:
            e["updated"] = text
        elif name in ("description", "summary") and not e["desc"]:
            e["desc"] = "".join(ch.itertext()) if len(ch) else (ch.text or "")
        elif name in ("encoded", "content") and not e["desc"]:
            e["desc"] = "".join(ch.itertext()) if len(ch) else (ch.text or "")
            e["_rich"] = True
        elif name == "enclosure" and not e["image"] and "image" in ch.get("type", "image"):
            e["image"] = ch.get("url")
        elif name == "source" and text:
            e["source"] = text
    if not e["link"] and e.get("guid"):
        e["link"] = e["guid"]
    if not e["date"] and e.get("updated"):
        e["date"] = e["updated"]
    if not e["image"] and e["desc"]:
        m = IMG_RE.search(e["desc"])
        if m:
            e["image"] = m.group(1)
    return e


ITEM_RE = re.compile(r"<(item|entry)\b[^>]*>(.*?)</\1>", re.S | re.I)


def _field(block: str, *names: str) -> str:
    for n in names:
        m = re.search(r"<%s\b[^>]*>(.*?)</%s>" % (re.escape(n), re.escape(n)), block, re.S | re.I)
        if m:
            v = m.group(1).strip()
            cd = re.fullmatch(r"<!\[CDATA\[(.*?)\]\]>", v, re.S)
            return cd.group(1) if cd else v
    return ""


def _regex_entries(text: str) -> list[dict]:
    """XML 로 못 읽는 피드를 위한 마지막 수단."""
    out = []
    for m in ITEM_RE.finditer(text):
        b = m.group(2)
        link = _field(b, "link")
        if not link:
            lm = re.search(r"<link[^>]+href=[\"']([^\"']+)", b, re.I)
            link = lm.group(1) if lm else _field(b, "guid")
        desc = _field(b, "description", "summary", "content:encoded", "content")
        img = re.search(r"<(?:media:content|media:thumbnail|enclosure)[^>]+url=[\"']([^\"']+)", b, re.I)
        im2 = IMG_RE.search(html.unescape(desc))
        out.append({
            "title": html.unescape(_field(b, "title")),
            "link": html.unescape(link),
            "date": _field(b, "pubDate", "dc:date", "published", "updated"),
            "desc": desc,
            "image": (img.group(1) if img else (im2.group(1) if im2 else None)),
            "source": _field(b, "source") or None,
        })
    return out


def parse_feed(text: str) -> list[dict]:
    try:
        root = _parse_xml(text)
    except ET.ParseError:
        return _regex_entries(text)
    return [_entry_from_element(el) for el in root.iter() if local(el.tag) in ("item", "entry")]


# ── 기사 만들기 ────────────────────────────────────────────────────────────
TAIL_SOURCE_RE = re.compile(r"\s+[-–—|]\s+([^-–—|]{1,30})$")


def build_items(entries: list[dict], feed: dict, now: datetime) -> list[dict]:
    items = []
    for e in entries:
        title = clean_text(e.get("title"))
        link = safe_url(e.get("link"))
        if not title or not link:
            continue
        source = feed["source"]
        if feed.get("aggregator"):
            m = TAIL_SOURCE_RE.search(title)
            src = clean_text(e.get("source")) or (m.group(1).strip() if m else "")
            if m:
                title = title[:m.start()].strip()
            if not src:
                continue
            source = src
        published = parse_date(e.get("date")) or now
        if published > now + timedelta(minutes=10):
            published = now
        summary = clean_text(e.get("desc"))
        if summary and title_key(summary).startswith(title_key(title)[:20]) and len(summary) < len(title) + 15:
            summary = ""
        summary = shorten(summary)
        item = {
            "id": make_id(link),
            "title": title,
            "url": link,
            "source": source,
            "cat": classify(title, summary, feed.get("hint", "general")),
            "time": int(published.timestamp()),
            "summary": summary,
        }
        img = safe_url(e.get("image"))
        if img:
            item["image"] = img
        if feed.get("aggregator"):
            item["via"] = feed["source"]
        items.append(item)
    return items


# ── 묶기 ───────────────────────────────────────────────────────────────────
NUM_RE = re.compile(r"(\d[\d,]*(?:\.\d+)?)\s*([%만억조천원달러배선주년월일분p]?)")


def numbers(title: str) -> set[str]:
    """제목 속 숫자(+단위 한 글자). '2,900선' → '2900선'. 숫자가 다르면 다른 사건으로 본다."""
    return {n.replace(",", "").rstrip(".") + u for n, u in NUM_RE.findall(title)}


def features(title: str) -> set[str]:
    """제목의 글자 두 개짜리 조각 + 낱말(조사 뗀 것)."""
    k = title_key(title)
    f = {k[i:i + 2] for i in range(len(k) - 1)}
    t = BRACKET_RE.sub(" ", title)
    for long, short in SYNONYMS:
        t = t.replace(long, short)
    for w in WORD_RE.findall(t):
        w = strip_josa(w) if re.match(r"[가-힣]", w) else w
        if len(w) >= 2:
            f.add("#" + w.lower())
    return f


def same_story(fa: set, fb: set, na: set, nb: set, idf: dict) -> bool:
    if na - nb and nb - na:          # 서로 다른 숫자를 하나씩 갖고 있다 → 코스피 2,900 vs 코스닥 900
        return False
    shared = fa & fb
    if not shared:
        return False
    w = lambda xs: sum(idf.get(x, 1.0) ** 2 for x in xs)  # noqa: E731
    sim = w(shared) / ((w(fa) * w(fb)) ** 0.5 or 1)
    return sim >= 0.5 or (bool(na & nb) and sim >= 0.3)


def cluster(items: list[dict]) -> None:
    """제목이 비슷한 기사를 한 사건으로 묶는다. item['cluster'] 에 대표(가장 먼저 나온) 기사 id 를 넣는다.

    제목 조각·낱말을 흔한 정도로 가중한 코사인 유사도에, 숫자가 엇갈리면 떼어 놓는 규칙을 더했다.
    조각 색인으로 후보만 비교하므로 수천 건도 금방 끝난다.
    """
    order = sorted(items, key=lambda x: (x["time"], x["id"]))
    feats = [features(it["title"]) for it in order]
    nums = [numbers(BRACKET_RE.sub(" ", it["title"])) for it in order]
    df: dict[str, int] = {}
    for f in feats:
        for x in f:
            df[x] = df.get(x, 0) + 1
    n = len(order)
    idf = {x: math.log((n + 1) / (c + 0.5)) + 0.1 for x, c in df.items()}
    common = max(8, n // 20)          # 너무 흔한 조각은 후보 찾기에 안 쓴다
    parent = list(range(n))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    index: dict[str, list[int]] = {}
    for i, f in enumerate(feats):
        cands: set[int] = set()
        for x in f:
            if df[x] <= common:
                cands.update(index.get(x, ()))
        for j in cands:
            if order[i]["time"] - order[j]["time"] > 36 * 3600:
                continue
            if find(i) != find(j) and same_story(f, feats[j], nums[i], nums[j], idf):
                ri, rj = find(i), find(j)
                parent[max(ri, rj)] = min(ri, rj)
        for x in f:
            if df[x] <= common:
                index.setdefault(x, []).append(i)
    for i, it in enumerate(order):
        it["cluster"] = order[find(i)]["id"]


# ── 키워드 ─────────────────────────────────────────────────────────────────
JOSA = ("에서는", "으로는", "에게서", "까지", "부터", "에서", "으로", "에게", "이나", "보다",
        "처럼", "만큼", "이다", "했다", "한다", "하는", "하고", "되는", "된다", "은", "는", "이", "가",
        "을", "를", "에", "의", "도", "로", "와", "과", "만", "서", "고")
STOP = set("""속보 종합 단독 오늘 올해 내년 지난해 작년 대한 위해 관련 기자 뉴스 경제 사진 포토 이번 지난 최근 전망
우리 국내 해외 한국 정부 시장 기업 가능성 이상 이하 만에 가운데 대비 대해 통해 따라 위한 이후 이전 첫 중 등 것 수
더 또 및 그 이 저 제 각 전 후 앞 뒤 연속 역대 최대 최고 최저 상승 하락 증가 감소 확대 축소 결정 발표 추진 검토
예정 계획 영상 그래픽 인터뷰 일보 2보 3보 1보 사설 칼럼 오피니언 기고 데스크 마감 개장 오전 오후 이유 문제 효과
영향 우려 기대 논란 공개 진행 상황 분석 조사 의견 강조 지원 개최 참석 강화 필요 가능 제공
돌파 넘어 개월 분기 강세 약세 둔화 회복 급등 급락 반등 하락세 상승세 만에 사상 기록 출시 시작 마무리 예고 확인 유지
전년 동기 대비 지속 올라 내려 늘어 줄어 첫날 이틀 사흘 연중 연말 연초 하반기 상반기 주간 시간 오늘의""".split())
WORD_RE = re.compile(r"[A-Za-z][A-Za-z0-9&·]*|[가-힣]+|\d+(?:\.\d+)?%?")


def strip_josa(w: str) -> str:
    for j in JOSA:
        if len(w) > len(j) + 1 and w.endswith(j):
            return w[: -len(j)]
    return w


def keywords(items: list[dict], now: datetime, hours: int = 24, top: int = 24) -> list[list]:
    since = now.timestamp() - hours * 3600
    seen_cluster: dict[str, set[str]] = {}
    for it in items:
        if it["time"] < since:
            continue
        words = set()
        for w in WORD_RE.findall(BRACKET_RE.sub(" ", it["title"])):
            if re.fullmatch(r"[\d.%]+", w):
                continue
            w = strip_josa(w) if re.match(r"[가-힣]", w) else w
            if len(w) < 2 or w in STOP:
                continue
            words.add(w)
        seen_cluster.setdefault(it.get("cluster", it["id"]), set()).update(words)
    counts: dict[str, int] = {}
    for words in seen_cluster.values():
        for w in words:
            counts[w] = counts.get(w, 0) + 1
    ranked = sorted(((w, c) for w, c in counts.items() if c >= 2), key=lambda x: (-x[1], x[0]))
    return [[w, c] for w, c in ranked[:top]]


# ── 네트워크 ───────────────────────────────────────────────────────────────
def http_get(url: str, timeout: int = 20) -> tuple[bytes, str | None]:
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, application/json, */*;q=0.5",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.5",
    })
    last = None
    for attempt in range(2):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read(), r.headers.get_content_charset()
        except Exception as ex:   # noqa: BLE001 — 어떤 실패든 다음 피드로 넘어간다
            last = ex
            time.sleep(1.5 * (attempt + 1))
    raise last  # type: ignore[misc]


def fetch_feed_text(feed: dict, offline_dir: str | None) -> str:
    if offline_dir:
        name = feed.get("file") or (hashlib.sha1(feed["url"].encode()).hexdigest()[:10] + ".xml")
        with open(os.path.join(offline_dir, name), "rb") as f:
            return decode_feed(f.read())
    raw, charset = http_get(feed["url"])
    return decode_feed(raw, charset)


def fetch_market(m: dict) -> dict:
    sym = urllib.parse.quote(m["symbol"])
    last = None
    for host in ("query1", "query2"):
        url = f"https://{host}.finance.yahoo.com/v8/finance/chart/{sym}?range=1mo&interval=1d"
        try:
            raw, _ = http_get(url, timeout=15)
            res = json.loads(raw)["chart"]["result"][0]
            break
        except Exception as ex:  # noqa: BLE001
            last = ex
    else:
        raise last  # type: ignore[misc]
    return market_from_chart(m, res)


def market_from_chart(m: dict, res: dict) -> dict:
    meta = res.get("meta", {})
    ts = res.get("timestamp") or []
    closes_raw = (res.get("indicators", {}).get("quote") or [{}])[0].get("close") or []
    pts = [(t, c) for t, c in zip(ts, closes_raw) if c is not None]
    if not pts:
        raise ValueError("종가 없음")
    price = meta.get("regularMarketPrice") or pts[-1][1]
    mtime = meta.get("regularMarketTime") or pts[-1][0]
    tz = timezone(timedelta(seconds=meta.get("gmtoffset", 0) or 0))
    last_day = datetime.fromtimestamp(pts[-1][0], tz).date()
    market_day = datetime.fromtimestamp(mtime, tz).date()
    # 마지막 봉이 오늘(장중 포함)이면 그 앞 봉이 전일 종가
    prev = pts[-2][1] if (last_day == market_day and len(pts) >= 2) else pts[-1][1]
    change = price - prev
    return {
        "symbol": m["symbol"], "name": m["name"], "unit": m.get("unit", ""),
        "price": round(price, 4), "change": round(change, 4),
        "pct": round(change / prev * 100, 2) if prev else 0.0,
        "time": int(mtime), "spark": [round(c, 4) for _, c in pts[-22:]],
    }


# ── 저장 ───────────────────────────────────────────────────────────────────
def kst_date(ts: int) -> str:
    return datetime.fromtimestamp(ts, KST).strftime("%Y-%m-%d")


def load_json(path: str, default):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def write_json(path: str, obj) -> bool:
    """내용이 같으면 쓰지 않는다(빈 커밋 방지). 썼으면 True."""
    text = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    try:
        with open(path, encoding="utf-8") as f:
            if f.read() == text:
                return False
    except OSError:
        pass
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(text)
    os.replace(tmp, path)
    return True


def merge(existing: list[dict], fresh: list[dict]) -> list[dict]:
    """기존 기사는 그대로 두고 새 기사만 더한다. 같은 매체의 같은 제목, 모음 피드의 중복은 버린다."""
    by_id = {it["id"]: it for it in existing}
    src_title = {(it["source"], title_key(it["title"])) for it in existing}
    direct_titles = {title_key(it["title"]) for it in existing if "via" not in it}
    for it in fresh:
        if "via" not in it:
            direct_titles.add(title_key(it["title"]))
    for it in fresh:
        key = (it["source"], title_key(it["title"]))
        if it["id"] in by_id or key in src_title:
            continue
        if "via" in it and title_key(it["title"]) in direct_titles:
            continue
        by_id[it["id"]] = it
        src_title.add(key)
    return list(by_id.values())


def run(args) -> int:
    base = os.path.dirname(os.path.abspath(__file__))
    cfg = load_json(args.config or os.path.join(base, "feeds.json"), None)
    if not cfg:
        print("feeds.json 을 읽지 못했습니다", file=sys.stderr)
        return 2
    out = args.out or os.path.join(base, "data")
    days_dir = os.path.join(out, "days")
    now = datetime.fromisoformat(args.now).astimezone(KST) if args.now else datetime.now(KST)

    prev_index = load_json(os.path.join(out, "index.json"), {})

    # 1) 피드 받기
    fresh: list[dict] = []
    status = []
    ok_count = 0
    for feed in cfg["feeds"]:
        st = {"source": feed["source"], "url": feed["url"], "hint": feed.get("hint", "general")}
        try:
            entries = parse_feed(fetch_feed_text(feed, args.offline_dir))
            items = build_items(entries, feed, now)
            if not items:
                raise ValueError("기사 0건")
            fresh.extend(items)
            st.update(ok=True, count=len(items))
            ok_count += 1
            print(f"  ✓ {feed['source']:<6} {len(items):>3}건  {feed['url']}")
        except Exception as ex:  # noqa: BLE001
            msg = f"{type(ex).__name__}: {ex}"[:160]
            st.update(ok=False, count=0, error=msg)
            print(f"  ✗ {feed['source']:<6} {msg}  {feed['url']}")
        status.append(st)

    # 2) 최근 날짜 파일과 합치기
    window = [(now - timedelta(days=d)).strftime("%Y-%m-%d") for d in range(WINDOW_DAYS, -1, -1)]
    existing: list[dict] = []
    for day in window:
        existing.extend(load_json(os.path.join(days_dir, day + ".json"), {}).get("items", []))
    oldest = datetime.strptime(window[0], "%Y-%m-%d").replace(tzinfo=KST).timestamp()
    fresh = [it for it in fresh if it["time"] >= oldest]
    items = merge(existing, fresh)
    cluster(items)
    added = len(items) - len(existing)

    # 3) 날짜별로 나눠 쓰기
    by_day: dict[str, list[dict]] = {d: [] for d in window}
    for it in items:
        d = kst_date(it["time"])
        if d in by_day:
            by_day[d].append(it)
    changed = []
    for day, lst in by_day.items():
        if not lst:
            continue
        lst.sort(key=lambda x: (-x["time"], x["id"]))
        if write_json(os.path.join(days_dir, day + ".json"), {"date": day, "items": lst[:MAX_PER_DAY]}):
            changed.append(day)

    # 4) 오래된 날짜 파일 정리
    cutoff = (now - timedelta(days=KEEP_DAYS)).strftime("%Y-%m-%d")
    days = []
    if os.path.isdir(days_dir):
        for name in sorted(os.listdir(days_dir)):
            if not name.endswith(".json"):
                continue
            day = name[:-5]
            if day < cutoff:
                os.remove(os.path.join(days_dir, name))
                continue
            n = len(load_json(os.path.join(days_dir, name), {}).get("items", []))
            days.append({"date": day, "count": n})
    days.sort(key=lambda d: d["date"], reverse=True)

    # 5) 시장 지표
    markets_changed = False
    if not args.no_markets and cfg.get("markets"):
        mpath = os.path.join(out, "markets.json")
        prev_m = {m["symbol"]: m for m in load_json(mpath, {}).get("items", [])}
        rows = []
        for m in cfg["markets"]:
            try:
                row = fetch_market(m)
                print(f"  ✓ {m['name']:<8} {row['price']:,} ({row['pct']:+.2f}%)")
            except Exception as ex:  # noqa: BLE001
                print(f"  ✗ {m['name']:<8} {type(ex).__name__}: {ex}"[:160])
                row = dict(prev_m[m["symbol"]], stale=True) if m["symbol"] in prev_m else None
            if row:
                rows.append(row)
        if rows:
            prev_rows = load_json(mpath, {}).get("items", [])
            if rows != prev_rows:
                markets_changed = write_json(mpath, {"updated": int(now.timestamp()), "items": rows})

    # 6) 색인 — 기사·지표·피드 성공 여부가 그대로면 다시 쓰지 않는다(빈 커밋 방지)
    flags = [(f["url"], f["ok"]) for f in status]
    prev_flags = [(f.get("url"), f.get("ok")) for f in prev_index.get("feeds", [])]
    if changed or markets_changed or flags != prev_flags or not prev_index or args.force_index:
        index = {
            "updated": int(now.timestamp()),
            "categories": CATEGORY_NAMES,
            "days": days,
            "feeds": status,
            "keywords": keywords(items, now),
        }
        write_json(os.path.join(out, "index.json"), index)

    print(f"피드 {ok_count}/{len(cfg['feeds'])} 성공 · 새 기사 {added}건 · 바뀐 날짜 {', '.join(changed) or '없음'}")
    return 0 if ok_count else 1


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--config")
    ap.add_argument("--out")
    ap.add_argument("--offline-dir", help="피드를 네트워크 대신 이 폴더의 파일에서 읽는다 (feed 의 file 또는 url 해시.xml)")
    ap.add_argument("--no-markets", action="store_true")
    ap.add_argument("--now", help="현재 시각을 고정 (ISO 8601, 시험용)")
    ap.add_argument("--force-index", action="store_true", help="바뀐 게 없어도 index.json 을 다시 쓴다")
    return run(ap.parse_args(argv))


if __name__ == "__main__":
    sys.exit(main())
