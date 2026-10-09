#!/usr/bin/env python3
"""해외 경제뉴스 수집기.

feeds.json 의 영어 경제 매체 RSS(CNBC·MarketWatch·FT·BBC·Bloomberg 등)를 모두 받아 분야를 나누고,
같은 사건을 다룬 기사끼리 묶어 data/ 아래에 날짜(한국 시각)별 JSON 으로 저장한다.
새 기사 제목을 한국어로 옮긴다 — ANTHROPIC_API_KEY 가 있으면 Claude 로 제목·요약을(translate.py),
없으면 무료 기계 번역으로 제목만(free_translate.py). 시장 지표도 같이 받는다.
번역을 빼면 표준 라이브러리만 쓴다. 깃허브 액션(.github/workflows/update-news.yml)이 돌린다.

  python fetch_news.py                       # feeds.json 전부 받기
  python fetch_news.py --offline-dir DIR     # 네트워크 없이 DIR 의 파일을 피드로 읽기 (시험용)
  python fetch_news.py --no-markets --no-translate

만드는 파일
  data/index.json          갱신 시각, 날짜 목록, 피드별 상태, 24시간 키워드
  data/days/YYYY-MM-DD.json 그날(한국 시각) 기사 목록 — 최신순
  data/markets.json        시장 지표 (실패하면 이전 값을 두고 stale 표시)

받는 데 실패한 피드는 건너뛰고, 이미 모은 기사는 그대로 둔다. 번역이 실패하면 영어로 두고 다음 실행에서 다시 옮긴다.
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
SUMMARY_LEN = 240
TRANSLATE_HOURS = 36    # Claude: 이보다 오래된 기사는 번역하지 않는다
TRANSLATE_LIMIT = 240   # Claude: 한 번 실행에 옮길 최대 기사 수 (비용 상한)
FREE_TRANSLATE_LIMIT = 900   # 무료 번역: 한 번 실행에 옮길 최대 제목 수 (요청 수 상한)

MEDIA_NS = "http://search.yahoo.com/mrss/"

# ── 분야 나누기 ────────────────────────────────────────────────────────────
# 제목에 걸리면 2점, 요약에 걸리면 1점. 가장 높은 분야로, 0점이면 피드의 hint 로.
CATEGORIES = {
    "crypto": r"bitcoin|crypto\w*|ether(?:eum)?|stablecoins?|coinbase|binance|blockchain|solana|xrp|digital assets?|btc",
    "estate": r"housing|home ?sales|home ?prices|homebuyers?|homebuilders?|mortgages?|real estate|propert(?:y|ies)|rents?|rental"
              r"|reits?|existing-home|new-home|landlords?|office space",
    "energy": r"oil|crude|brent|wti|opec\+?|natural gas|lng|gasoline|gold|silver|copper|commodit(?:y|ies)|energy|iron ore"
              r"|wheat|lithium|refiner(?:y|ies)|metals?",
    "macro": r"fed|federal reserve|interest rates?|rate (?:cut|hike)s?|inflation|cpi|pce|ppi|jobs report|payrolls?"
             r"|unemployment|jobless|labor market|gdp|recession|treasur(?:y|ies)|bond yields?|yields?|central banks?|ecb"
             r"|bank of england|boj|bank of japan|powell|lagarde|deficit|debt ceiling|consumer spending|retail sales"
             r"|economy|economic|economists?|dollar|yen|euro|currenc(?:y|ies)|forex|monetary|fiscal|bonds?",
    "global": r"tariffs?|trade (?:war|deal|talks|deficit|surplus|tensions)|sanctions?|china|chinese|beijing|xi|trump|white house"
              r"|european union|eu|russia|ukraine|middle east|iran|israel|geopolitic\w*|export controls?|wto|g7|g20|imf"
              r"|world bank|emerging markets?|india|japan|germany|britain|uk",
    "market": r"stocks?|shares?|wall street|s&p(?: 500)?|nasdaq|dow|equit(?:y|ies)|ipos?|rally|rallies|sell-?off|investors?"
              r"|futures|hedge funds?|etfs?|index|indexes|indices|bull market|bear market|volatility|vix|nikkei|ftse|stoxx"
              r"|market cap|valuations?|brokerages?",
    "industry": r"earnings|revenue|profits?|quarterly|ceo|mergers?|acquisitions?|acquires?|acquired|takeover|layoffs?"
                r"|job cuts|nvidia|apple|microsoft|amazon|alphabet|google|meta|tesla|openai|ai|artificial intelligence|chips?"
                r"|chipmakers?|semiconductors?|boeing|automakers?|carmakers?|startups?|bankruptcy|antitrust|airlines?"
                r"|pharma\w*|retailers?",
}
CATEGORY_RES = {k: re.compile(r"(?<![A-Za-z0-9])(?:%s)(?![A-Za-z0-9])" % v, re.I) for k, v in CATEGORIES.items()}
# 동점이면 앞쪽이 이긴다: 좁고 뚜렷한 분야가 넓은 분야보다 먼저.
CATEGORY_ORDER = ["crypto", "estate", "energy", "macro", "global", "market", "industry"]
CATEGORY_NAMES = {
    "market": "증시", "macro": "금리·물가", "energy": "원자재", "estate": "부동산", "industry": "기업·테크",
    "global": "무역·국제", "crypto": "가상자산", "general": "경제일반",
}
# 한국 독자가 따로 보고 싶어 할 기사: 한국·한국 기업·원화가 나오면 kr 표시
KOREA_RE = re.compile(r"(?<![A-Za-z])(?:south korea\w*|korea\w*|seoul|samsung|sk hynix|hynix|hyundai|kia|lg (?:energy|electronics|chem)\w*"
                      r"|kospi|kosdaq|posco|naver|kakao|coupang|krw|korean won)(?![A-Za-z])", re.I)


def classify(title: str, summary: str, hint: str = "general") -> str:
    best, best_score = None, 0
    for cat in CATEGORY_ORDER:
        rx = CATEGORY_RES[cat]
        score = 2 * len(set(m.lower() for m in rx.findall(title)))
        if summary:
            score += len(set(m.lower() for m in rx.findall(summary)))
        if score > best_score:
            best, best_score = cat, score
    if best is None:
        return hint if hint in CATEGORY_NAMES else "general"
    return best


def is_korea(text: str) -> bool:
    return bool(KOREA_RE.search(text))


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


# 머리말·꼬리말: "BREAKING:", "UPDATE 2-", "(Reuters)", "| Video" 같은 것
BRACKET_RE = re.compile(r"^\s*(?:breaking|update\s*\d*|exclusive|analysis|explainer|live|watch|video|opinion|factbox|instant view)"
                        r"\s*[:\-–—|]\s*|\((?:reuters|ap|bloomberg|video|updated?)\)|\s+[|]\s+[^|]{1,30}$|\[[^\]]{0,20}\]", re.I)
NONWORD_RE = re.compile(r"[^0-9a-z가-힣]+")

# 같은 것을 다르게 부르는 말을 한쪽으로 모은다 (소문자 기준, 묶기·중복 판단용)
SYNONYMS = [("federal reserve", "fed"), ("u.s.", "us"), ("u.s", "us"), ("united states", "us"), ("america's", "us"),
            ("european central bank", "ecb"), ("bank of japan", "boj"), ("bank of england", "boe"),
            ("s&p 500", "s&p"), ("standard & poor's", "s&p"), ("dow jones", "dow"), ("nasdaq composite", "nasdaq"),
            ("wall st.", "wall street"), ("wall st", "wall street"), ("u.k.", "uk"), ("britain", "uk"),
            ("european union", "eu"), ("opec+", "opec"), ("bitcoin's", "bitcoin"), ("percent", "%"), ("per cent", "%")]


SYN_RES = [(re.compile(r"(?<![A-Za-z])" + re.escape(a) + r"(?![A-Za-z])", re.I), b) for a, b in SYNONYMS]


def normalize(title: str) -> str:
    t = BRACKET_RE.sub(" ", title).lower().replace("’", "'")
    for long, short in SYNONYMS:
        t = t.replace(long, short)
    return t


def title_key(title: str) -> str:
    """같은 기사인지 볼 때 쓰는 제목 — 머리말·기호를 빼고 줄임말로 맞춘 것."""
    return NONWORD_RE.sub("", normalize(title))


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
        if is_korea(title + " " + summary):
            item["kr"] = 1
        img = safe_url(e.get("image"))
        if img:
            item["image"] = img
        if feed.get("aggregator"):
            item["via"] = feed["source"]
        items.append(item)
    return items


# ── 묶기 ───────────────────────────────────────────────────────────────────
EN_STOP = set("""a an the of to in on for and or as at by with from after before over under amid into onto its it it's is are
was were be been being has have had will would could should can may might must says said say than that this these those their
his her they them we you our your i not no up down out about how why what who whom when where which while but if so just still
also new more most less least over vs via per amid despite against during through between since until again ahead there here
all any some much many other another such only very even back off into near later last far year years month months
week weeks day days see sees seen first time""".split())
# 이름처럼 대문자로 쓰지만 사건을 가르지 못하는 말
CAP_GENERIC = {"ceo", "ai", "us", "new", "update", "breaking", "exclusive", "analysis", "watch", "video", "live"}
TOKEN_SYN = {"federal": "fed", "reserve": "fed", "american": "us", "america": "us", "chinese": "china", "beijing": "china",
             "european": "eu", "europe": "eu", "japanese": "japan", "tokyo": "japan", "british": "uk", "london": "uk",
             "german": "germany", "berlin": "germany", "russian": "russia", "moscow": "russia", "indian": "india",
             "korean": "korea", "seoul": "korea", "canadian": "canada", "mexican": "mexico", "french": "france"}
# 같은 뜻으로 쓰이는 헤드라인 낱말(어간 기준)을 하나로
WORD_SYN = {}
for _canon, _ws in {
    "up": "rise rose jump surge climb gain soar rall rally rebound advance spike pop",
    "down": "fall fell drop slide slip sink sank tumble plunge slump decline retreat dip lose lost",
    "share": "stock equity",
    "hold": "keep kept unchanged steady pause leave left",
    "chip": "semiconductor chipmaker",
    "beat": "top exceed surpass hit cross break breach pass",
    "estimate": "expectation forecast expected consensus",
    "tariff": "levy duty",
    "cut": "lower reduce slash",
    "hike": "raise",
    "job": "payroll",
    "profit": "earning income",
    "buy": "acquire acquisition purchase takeover",
    "invest": "investment stake",
    "say": "says said tell warn",
}.items():
    for _w in _ws.split():
        WORD_SYN[_w] = _canon
MONTHS = set("january february march april may june july august september october november december "
             "jan feb mar apr jun jul aug sep sept oct nov dec monday tuesday wednesday thursday friday saturday sunday".split())
LATIN_RE = re.compile(r"[A-Za-z][A-Za-z0-9&'.\-]*[A-Za-z0-9&]|[A-Za-z]")
NUM_RE = re.compile(r"(?<![A-Za-z0-9])([$€£¥])?\s?(\d[\d,]*(?:\.\d+)?)\s*(%|bn|billion|mn|million|trillion|tn|bps|basis points|k\b|m\b|b\b)?", re.I)
UNIT = {"billion": "b", "bn": "b", "b": "b", "million": "m", "mn": "m", "m": "m", "trillion": "t", "tn": "t",
        "basis points": "bps", "bps": "bps", "k": "k", "%": "%"}


def stem(w: str) -> str:
    """아주 거친 영어 어간: rises→rise, cuts→cut, prices→price, jumped→jump."""
    w = w.lower().strip(".'-")
    if w.endswith("'s"):
        w = w[:-2]
    if len(w) > 4 and w.endswith("ies"):
        return w[:-3] + "y"
    if len(w) > 5 and w.endswith("ing"):
        return w[:-3]
    if len(w) > 4 and w.endswith("ed") and not w.endswith("eed"):
        return w[:-2]
    if len(w) > 4 and w.endswith(("ches", "shes", "sses", "xes")):
        return w[:-2]
    if len(w) > 3 and w.endswith("s") and not w.endswith(("ss", "us", "is")):
        return w[:-1]
    return w


def words(title: str) -> list[str]:
    """제목의 뜻있는 낱말(소문자 어간, 불용어 뺌)."""
    out = []
    for w in LATIN_RE.findall(normalize(title)):
        w = w.lower()
        if w in EN_STOP or len(w) < 2 and w not in ("%",):
            continue
        k = TOKEN_SYN.get(w) or WORD_SYN.get(w)
        if not k:
            k = stem(w)
            k = WORD_SYN.get(k, k)
        out.append(k)
    return out


def numbers(title: str) -> set[str]:
    """제목 속 숫자(+단위). '$1.5 billion' → '1.5b', '2.5%' → '2.5%'. 연도는 뺀다. 숫자가 엇갈리면 다른 사건으로 본다."""
    out = set()
    for cur, n, unit in NUM_RE.findall(normalize(title)):
        n = n.replace(",", "").rstrip(".")
        u = UNIT.get(unit.lower(), "") if unit else ""
        if not u and re.fullmatch(r"(19|20)\d\d", n):
            continue                    # 연도
        if not u and not cur and len(n) == 1:
            continue                    # 한 자리 맨숫자: "3 things", "Q3" 같은 것
        out.add(n + u)
    return out


def proper_nouns(title: str) -> set[str] | None:
    """대문자로 시작하는 말(회사·나라·사람). 제목이 Title Case 라 가릴 수 없으면 None."""
    t = BRACKET_RE.sub(" ", title).replace("’", "'")
    for rx, short in SYN_RES:            # "Bank of Japan" → "Boj": 이름이 같은 것끼리 맞춘다
        t = rx.sub(short[:1].upper() + short[1:], t)
    toks = LATIN_RE.findall(t)
    if not toks:
        return None
    caps_stop = [w for w in toks[1:] if w.lower() in EN_STOP and len(w) > 2 and w[0].isupper()]
    if caps_stop:
        return None                     # "Fed Holds Rates Steady As Inflation Cools" 꼴
    out = set()
    for w in toks:
        if not w[0].isupper() or w.lower() in EN_STOP:
            continue
        k = TOKEN_SYN.get(w.lower(), stem(w))
        if k not in CAP_GENERIC and k not in MONTHS:
            out.add(k)
    lowers = [w for w in toks[1:] if w[0].islower()]
    if not lowers and len(toks) > 3:
        return None                     # 낱말이 모두 대문자로 시작 — 판단 보류
    return out


def features(title: str) -> set[str]:
    """제목 낱말 + 이웃한 낱말 쌍."""
    ws = words(title)
    f = {"#" + w for w in ws}
    f.update(a + "_" + b for a, b in zip(ws, ws[1:]))
    f.update("=" + n for n in numbers(title))
    return f


def same_story(fa: set, fb: set, na: set, nb: set, pa, pb, idf: dict) -> bool:
    if na - nb and nb - na and not na & nb:   # 숫자가 엇갈린다: "Apple shares fall 3%" vs "… fall 5%"
        return False
    if pa and pb and not pa & pb:             # 주인공이 다르다: Apple vs Tesla
        return False
    shared = fa & fb
    if not shared:
        return False
    w = lambda xs: sum(idf.get(x, 1.0) ** 2 for x in xs)  # noqa: E731
    sim = w(shared) / ((w(fa) * w(fb)) ** 0.5 or 1)
    same_num = bool(na & nb)
    same_name = len(pa & pb) if pa is not None and pb is not None else 0
    if same_num and same_name:                # 같은 숫자 + 같은 주인공: "Nvidia … 6%"
        need = 0.15
    elif same_num or same_name >= 2:
        need = 0.26
    elif same_name:
        need = 0.34
    else:
        need = 0.42
    return sim >= need


def cluster(items: list[dict]) -> None:
    """제목이 비슷한 기사를 한 사건으로 묶는다. item['cluster'] 에 대표(가장 먼저 나온) 기사 id 를 넣는다.

    낱말·낱말 쌍을 흔한 정도로 가중한 코사인 유사도를 보되, 숫자가 엇갈리거나 주인공(대문자 이름)이
    하나도 겹치지 않으면 떼어 놓는다. 낱말 색인으로 후보만 비교하므로 수천 건도 금방 끝난다.
    """
    order = sorted(items, key=lambda x: (x["time"], x["id"]))
    feats = [features(it["title"]) for it in order]
    nums = [numbers(it["title"]) for it in order]
    props = [proper_nouns(it["title"]) for it in order]
    df: dict[str, int] = {}
    for f in feats:
        for x in f:
            df[x] = df.get(x, 0) + 1
    n = len(order)
    idf = {x: math.log(1 + n / c) for x, c in df.items()}
    common = max(8, n // 15)          # 너무 흔한 말은 후보 찾기에 안 쓴다
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
            if find(i) != find(j) and same_story(f, feats[j], nums[i], nums[j], props[i], props[j], idf):
                ri, rj = find(i), find(j)
                parent[max(ri, rj)] = min(ri, rj)
        for x in f:
            if df[x] <= common:
                index.setdefault(x, []).append(i)
    for i, it in enumerate(order):
        it["cluster"] = order[find(i)]["id"]


# ── 키워드 ─────────────────────────────────────────────────────────────────
# 제목에 흔히 나오지만 오늘 무슨 일이 있었는지는 말해 주지 않는 말
KW_STOP = set("""stock share market price investor say report update live latest news video watch analysis know could plan
week month year day today first high low record rise fall gain drop jump surge slip slide climb sink tumble soar rebound fear
hit set top big back ahead company business firm global world people time make take get go come see show look help keep
expect forecast data quarter billion million trillion % percent us biggest largest lower higher end start after amid near
best worst still lead key major move point level sign signal deal talk call cut beat hold profit quarterly sale demand
estimate forecast expectation growth result results gains loss losses plans plan announce announces rally rallies
amid await awaits ahead flag warn""".split())


def keywords(items: list[dict], now: datetime, hours: int = 24, top: int = 24) -> list[list]:
    """최근 24시간 제목에서 많이 나온 말. 같은 사건은 한 번만 센다. [[표시형, 사건 수], …]"""
    since = now.timestamp() - hours * 3600
    per_cluster: dict[str, set[str]] = {}
    surface: dict[str, dict[str, int]] = {}
    for it in items:
        if it["time"] < since:
            continue
        ks = set()
        for w in LATIN_RE.findall(BRACKET_RE.sub(" ", it["title"]).replace("’", "'")):
            low = w.lower().strip(".'-")
            if w.endswith("'s"):
                w, low = w[:-2], low[:-2] if low.endswith("'s") else low
            if low in EN_STOP or len(low) < 2:
                continue
            k = TOKEN_SYN.get(low, stem(low))
            if k in KW_STOP or k.isdigit():
                continue
            ks.add(k)
            form = w if (w.isupper() or w[0].isupper()) and len(w) > 1 else low
            surface.setdefault(k, {})
            surface[k][form] = surface[k].get(form, 0) + 1
        per_cluster.setdefault(it.get("cluster", it["id"]), set()).update(ks)
    counts: dict[str, int] = {}
    for ks in per_cluster.values():
        for k in ks:
            counts[k] = counts.get(k, 0) + 1
    ranked = sorted(((k, c) for k, c in counts.items() if c >= 2), key=lambda x: (-x[1], x[0]))
    out = []
    for k, c in ranked[:top]:
        forms = surface[k]
        # 문장 첫머리 대문자보다 소문자형이 많으면 소문자, 이름(Fed, Nvidia)은 대문자형
        best = max(forms.items(), key=lambda kv: (kv[1], kv[0][0].isupper()))[0]
        out.append([best, c])
    return out


# ── 네트워크 ───────────────────────────────────────────────────────────────
def http_get(url: str, timeout: int = 20) -> tuple[bytes, str | None]:
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, application/json, */*;q=0.5",
        "Accept-Language": "en-US,en;q=0.9",
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

    # 2-1) 한국어로 옮기기. 실패한 기사는 영어로 두고 다음 실행에서 다시 한다.
    #      키가 있으면 Claude(제목·요약, 최근 36시간), 없으면 무료 기계 번역(제목만, 묶는 범위 전체).
    translated = 0
    if not args.no_translate:
        use_claude = bool(os.environ.get("ANTHROPIC_API_KEY"))
        since = (now.timestamp() - TRANSLATE_HOURS * 3600) if use_claude else oldest
        limit = args.translate_limit or (TRANSLATE_LIMIT if use_claude else FREE_TRANSLATE_LIMIT)
        pending = sorted((it for it in items if "title_ko" not in it and it["time"] >= since),
                         key=lambda x: -x["time"])[:limit]
        if pending:
            try:
                if use_claude:
                    import translate  # 같은 폴더. anthropic 패키지가 필요하다
                    translated = translate.translate_items(pending)
                else:
                    import free_translate  # 같은 폴더. 표준 라이브러리만
                    translated = free_translate.translate_titles(pending)
            except Exception as ex:  # noqa: BLE001 — 번역이 안 돼도 수집은 마친다
                print(f"  ✗ 번역 {type(ex).__name__}: {ex}"[:200])
        engine = "Claude" if use_claude else "무료 기계 번역(제목만)"
        print(f"  번역 {translated}/{len(pending)}건 · {engine}")

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

    print(f"피드 {ok_count}/{len(cfg['feeds'])} 성공 · 새 기사 {added}건 · 번역 {translated}건 · 바뀐 날짜 {', '.join(changed) or '없음'}")
    return 0 if ok_count else 1


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--config")
    ap.add_argument("--out")
    ap.add_argument("--offline-dir", help="피드를 네트워크 대신 이 폴더의 파일에서 읽는다 (feed 의 file 또는 url 해시.xml)")
    ap.add_argument("--no-markets", action="store_true")
    ap.add_argument("--now", help="현재 시각을 고정 (ISO 8601, 시험용)")
    ap.add_argument("--force-index", action="store_true", help="바뀐 게 없어도 index.json 을 다시 쓴다")
    ap.add_argument("--no-translate", action="store_true", help="번역하지 않는다")
    ap.add_argument("--translate-limit", type=int, default=None,
                    help=f"한 번에 옮길 최대 기사 수 (기본 Claude {TRANSLATE_LIMIT} · 무료 {FREE_TRANSLATE_LIMIT})")
    return run(ap.parse_args(argv))


if __name__ == "__main__":
    sys.exit(main())
