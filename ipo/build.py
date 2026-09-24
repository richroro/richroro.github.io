#!/usr/bin/env python3
"""공모주 캘린더 데이터 빌드.

38커뮤니케이션(www.38.co.kr)의 공개 표 세 개와 종목별 상세 페이지를 읽어
ipo/data/ipo.json 한 파일로 묶는다. 페이지는 이 파일 하나만 읽는다.

  청약 일정    /html/fund/index.htm?o=k    종목명 · 공모주일정 · 확정공모가 · 희망공모가 · 청약경쟁률 · 주간사
  수요예측     /html/fund/index.htm?o=r1   예측일 · 공모금액 · 기관경쟁률 · 의무보유확약
  신규상장     /html/fund/index.htm?o=nw   신규상장일 · 공모가 · 시초가 · 첫날종가 · 현재가
  상세         /html/fund/?o=v&no=…        시장구분 · 업종 · 총공모주식수 · 환불일 · 상장일

표 모양이 조금 바뀌어도 버티도록 열을 순서가 아니라 머리글 글자로 찾는다. 한 곳이 막히면
그 부분만 이전 파일의 값을 쓰고, 청약 일정 표를 하나도 못 읽으면 실패로 끝나 기존 파일을 지킨다.

사용 예
  python ipo/build.py                       # 네트워크에서
  python ipo/build.py --html-dir /tmp/38    # 받아 둔 HTML(k.html, r1.html, nw.html, v-<no>.html)로
  python ipo/build.py --no-detail           # 상세 페이지 생략(이전 값 유지)
"""
from __future__ import annotations

import argparse
import datetime as dt
import html.parser
import json
import os
import re
import ssl
import sys
import time
import urllib.parse
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
OUT = os.path.join(DATA, "ipo.json")
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
BASE = "https://www.38.co.kr"
LIST_URL = BASE + "/html/fund/index.htm?o={o}&page={page}"
DETAIL_URL = BASE + "/html/fund/?o=v&no={no}&l=&page=1"
KST = dt.timezone(dt.timedelta(hours=9))

# 머리글 → 필드. 공백을 지운 머리글이 이 글자로 시작하거나 같으면 그 열로 본다.
SCHEDULE_COLS = {"name": ("종목명", "기업명"), "sub": ("공모주일정", "청약일정", "공모청약일"),
                 "price": ("확정공모가",), "band": ("희망공모가",), "comp": ("청약경쟁률",), "uw": ("주간사",)}
FORECAST_COLS = {"name": ("기업명", "종목명"), "fc": ("예측일", "수요예측일"), "band": ("공모희망가", "희망공모가"),
                 "price": ("공모가", "확정공모가"), "amount": ("공모금액",), "inst": ("기관경쟁률",),
                 "lockup": ("의무보유확약",), "uw": ("주간사",)}
LISTING_COLS = {"name": ("기업명", "종목명"), "list": ("신규상장일", "상장일"), "cur": ("현재가",),
                "price": ("공모가(원)", "공모가"), "open": ("시초가(원)", "시초가"), "close1": ("첫날종가",)}
# 상세 페이지의 "이름표 | 값" 칸
DETAIL_LABELS = {"market": ("시장구분",), "sector": ("업종",), "shares": ("총공모주식수",),
                 "refund": ("환불일",), "list": ("상장일",), "code": ("종목코드",),
                 "post_shares": ("상장후주식수", "공모후상장주식수", "상장예정주식수", "공모후주식수", "상장주식수")}
# 상세 페이지 글 전체에서 찾는 값 — 칸 위치가 종목마다 달라 이름표 옆 칸으로 못 잡는다
OLD_RE = re.compile(r"구주\s*매출\s*[:：]?\s*([\d,]+)\s*주")
FLOAT_RE = re.compile(r"유통\s*가능[^%]{0,60}?(?<![\d.,])(\d{1,3}(?:\.\d+)?)\s*%")
UW_ALLOC_RE = re.compile(r"([가-힣A-Za-z]{1,12}증권)\s*[:：]?\s*([\d,]{3,})\s*주")


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def legacy_tls() -> ssl.SSLContext:
    """38 서버는 오래된 TLS·암호 방식만 받아 기본 설정(OpenSSL 3)으로는 악수가 거절된다.
    인증서 검증은 그대로 두고, 받을 수 있는 버전·암호만 넓힌다. 이 사이트에만 쓴다."""
    c = ssl.create_default_context()
    c.set_ciphers("DEFAULT:@SECLEVEL=0")
    c.minimum_version = ssl.TLSVersion.TLSv1
    c.options |= getattr(ssl, "OP_LEGACY_SERVER_CONNECT", 0x4)
    return c


_WAYS: list[str] = []  # 한 번 통한 방법을 먼저 쓴다


def fetch(url: str, timeout: int = 30) -> str:
    """기본 TLS → 넓힌 TLS → http 순서로 시도한다. 공개 표만 읽으므로 http 로 떨어져도 된다."""
    ways = _WAYS or ["default", "legacy", "http"]
    last = None
    for way in ways:
        u = url.replace("https://", "http://", 1) if way == "http" else url
        req = urllib.request.Request(u, headers={"User-Agent": UA, "Referer": BASE + "/"})
        try:
            ctx = legacy_tls() if way == "legacy" else None
            with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r:
                raw = r.read()
                ctype = r.headers.get("Content-Type", "")
            if not _WAYS:
                _WAYS.append(way)
                if way != "default":
                    log(f"  38 연결: {'넓힌 TLS' if way == 'legacy' else 'http'} 로 읽음")
            return decode(raw, ctype)
        except (ssl.SSLError, urllib.error.URLError, ConnectionError, TimeoutError) as e:
            last = e
            if isinstance(e, urllib.error.HTTPError):
                raise  # 서버가 답은 했다 — 다른 방법으로 바꿔도 같다
    raise last


def decode(raw: bytes, ctype: str = "") -> str:
    m = re.search(r"charset=([\w-]+)", ctype, re.I) or re.search(rb"charset=[\"']?([\w-]+)", raw[:4000], re.I)
    enc = (m.group(1).decode() if isinstance(m.group(1), bytes) else m.group(1)) if m else "utf-8"
    enc = enc.lower()
    if enc in ("euc-kr", "ks_c_5601-1987", "ksc5601", "x-windows-949", "windows-949"):
        enc = "cp949"  # euc-kr 표에 없는 글자(똠·햏 …)도 읽히게
    try:
        return raw.decode(enc)
    except (LookupError, UnicodeDecodeError):
        return raw.decode("cp949", errors="replace")


# ---------------------------------------------------------------- HTML → 행 목록
class Rows(html.parser.HTMLParser):
    """문서 안의 모든 <tr> 을 순서대로 [칸, …] 로 모은다. 칸은 {"t": 글자, "href": 첫 링크}.

    38 은 표 안에 표를 겹겹이 넣는다. 글자는 가장 안쪽의 열린 칸에만 붙여,
    바깥 행이 안쪽 표 글자를 삼키지 않게 한다."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows: list[list[dict]] = []
        self.stack: list[list[dict]] = []   # 열린 <tr> 들
        self.cell: list[dict | None] = []   # 행마다 열린 칸

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            row: list[dict] = []
            self.rows.append(row)
            self.stack.append(row)
            self.cell.append(None)
        elif tag in ("td", "th") and self.stack:
            c = {"t": "", "href": None}
            self.stack[-1].append(c)
            self.cell[-1] = c
        elif tag == "a" and self.stack and self.cell[-1] is not None and self.cell[-1]["href"] is None:
            self.cell[-1]["href"] = dict(attrs).get("href")
        elif tag == "br" and self.stack and self.cell[-1] is not None:
            self.cell[-1]["t"] += " "

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self.stack:
            self.cell[-1] = None
        elif tag == "tr" and self.stack:
            self.stack.pop()
            self.cell.pop()
        elif tag == "table":
            pass

    def handle_data(self, d):
        if self.stack and self.cell[-1] is not None:
            self.cell[-1]["t"] += d


def html_rows(text: str) -> list[list[dict]]:
    p = Rows()
    p.feed(text)
    p.close()
    out = []
    for r in p.rows:
        for c in r:
            c["t"] = re.sub(r"\s+", " ", c["t"].replace("\xa0", " ")).strip()
        if r:
            out.append(r)
    return out


def squash(s: str) -> str:
    return re.sub(r"\s+", "", s or "")


def header_map(row: list[dict], spec: dict) -> dict[str, int] | None:
    """행이 spec 의 머리글 행이면 {필드: 열 번호}. 이름 열과 절반 넘는 열을 찾아야 머리글로 본다."""
    heads = [squash(c["t"]) for c in row]
    found: dict[str, int] = {}
    for key, names in spec.items():
        for i, h in enumerate(heads):
            if i in found.values() or not h:
                continue
            if any(h == n or h.startswith(n) for n in names):
                found[key] = i
                break
    if "name" not in found or len(found) * 2 <= len(spec):
        return None
    return found


def table(rows: list[list[dict]], spec: dict, must: str) -> list[dict]:
    """머리글 행 아래의 같은 칸 수 행을 읽는다. must 열이 비면(쪽 번호·광고 행) 건너뛴다."""
    out, cols, width = [], None, 0
    for r in rows:
        m = header_map(r, spec)
        if m:
            cols, width = m, len(r)
            continue
        if not cols or len(r) != width:
            continue
        rec = {k: r[i]["t"] for k, i in cols.items()}
        if not rec.get(must) or not rec.get("name"):
            continue
        rec["_href"] = r[cols["name"]]["href"]
        out.append(rec)
    return out


# ---------------------------------------------------------------- 값 다듬기
def to_int(s) -> int | None:
    if s is None:
        return None
    m = re.search(r"-?[\d,]+", str(s))
    if not m:
        return None
    try:
        return int(m.group(0).replace(",", ""))
    except ValueError:
        return None


def to_float(s) -> float | None:
    if s is None:
        return None
    m = re.search(r"-?[\d,]*\.?\d+", str(s))
    if not m:
        return None
    try:
        return float(m.group(0).replace(",", ""))
    except ValueError:
        return None


def ratio(s) -> float | None:
    """'1,234.56:1' · '1234.56 대 1' → 1234.56. 비어 있거나 '-' 면 None."""
    s = str(s or "")
    if not re.search(r"\d", s):
        return None
    head = re.split(r"[:：]|대\s*1", s)[0]
    return to_float(head)


def band(s) -> tuple[int | None, int | None]:
    nums = [int(x.replace(",", "")) for x in re.findall(r"\d[\d,]*", str(s or ""))]
    nums = [n for n in nums if n >= 100]  # '원' 앞 숫자만 — 비율·주 수가 섞이지 않게
    if not nums:
        return None, None
    return min(nums), max(nums)


def price(s) -> int | None:
    v = to_int(s)
    return v if v and v >= 100 else None


def iso(y: int, m: int, d: int) -> str | None:
    try:
        return dt.date(y, m, d).isoformat()
    except ValueError:
        return None


def date_range(s, today: dt.date) -> tuple[str | None, str | None]:
    """'2026.09.24~09.25' · '2026.12.30~2027.01.02' · '2026/09/24' → (시작, 끝) ISO.
    끝에 연도가 없고 월이 시작보다 작으면 이듬해로 본다."""
    s = str(s or "")
    parts = re.split(r"\s*[~∼～]\s*", s, maxsplit=1)
    m = re.search(r"(\d{4})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{1,2})", parts[0])
    if not m:
        m2 = re.search(r"(\d{1,2})\s*[./-]\s*(\d{1,2})", parts[0])
        if not m2:
            return None, None
        y, mo, d = today.year, int(m2.group(1)), int(m2.group(2))
    else:
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
    start = iso(y, mo, d)
    end = start
    if len(parts) > 1:
        m = re.search(r"(\d{4})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(\d{1,2})", parts[1])
        if m:
            end = iso(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        else:
            m = re.search(r"(\d{1,2})\s*[./-]\s*(\d{1,2})", parts[1])
            if m:
                em, ed = int(m.group(1)), int(m.group(2))
                end = iso(y + (1 if em < mo else 0), em, ed)
    return start, end


def one_date(s, today: dt.date) -> str | None:
    return date_range(s, today)[0]


def underwriters(s) -> list[str]:
    parts = re.split(r"[,，/·]|\s{2,}", str(s or ""))
    out = []
    for p in parts:
        p = p.strip()
        p = re.sub(r"\((대표|공동|인수)\)$", "", p).strip()
        if p and p not in out and p != "-":
            out.append(p)
    return out


def detail_no(href) -> str | None:
    if not href:
        return None
    q = urllib.parse.parse_qs(urllib.parse.urlparse(href).query)
    no = (q.get("no") or [None])[0]
    return no if no and no.isdigit() else None


MARK = re.compile(r"\((유가|코스닥|코넥스|유가증권|KOSPI|KOSDAQ|구\s*[^)]*)\)", re.I)


def norm_name(s: str) -> str:
    s = MARK.sub("", s or "")
    s = re.sub(r"[\s·()\[\]]", "", s)
    return s.replace("㈜", "").replace("(주)", "").lower()


def clean_name(s: str) -> str:
    return re.sub(r"\s+", " ", MARK.sub("", s or "")).strip()


# ---------------------------------------------------------------- 표 하나씩
def parse_schedule(text: str, today: dt.date) -> list[dict]:
    out = []
    for r in table(html_rows(text), SCHEDULE_COLS, "sub"):
        s, e = date_range(r.get("sub"), today)
        if not s:
            continue
        lo, hi = band(r.get("band"))
        out.append({"name": clean_name(r["name"]), "no": detail_no(r["_href"]), "sub_start": s, "sub_end": e,
                    "band_lo": lo, "band_hi": hi, "price": price(r.get("price")),
                    "sub_comp": ratio(r.get("comp")), "uw": underwriters(r.get("uw"))})
    return out


def parse_forecast(text: str, today: dt.date) -> list[dict]:
    out = []
    for r in table(html_rows(text), FORECAST_COLS, "fc"):
        s, e = date_range(r.get("fc"), today)
        if not s:
            continue
        lo, hi = band(r.get("band"))
        amt = to_float(r.get("amount"))
        out.append({"name": clean_name(r["name"]), "no": detail_no(r["_href"]), "fc_start": s, "fc_end": e,
                    "band_lo": lo, "band_hi": hi, "price": price(r.get("price")),
                    # 38 은 공모금액을 백만원 단위로 적는다 → 억원
                    "amount": round(amt / 100, 1) if amt else None,
                    "inst_comp": ratio(r.get("inst")), "lockup": to_float(r.get("lockup")),
                    "uw": underwriters(r.get("uw"))})
    return out


def parse_listing(text: str, today: dt.date) -> list[dict]:
    out = []
    for r in table(html_rows(text), LISTING_COLS, "list"):
        d = one_date(r.get("list"), today)
        if not d:
            continue
        out.append({"name": clean_name(r["name"]), "list_date": d, "price": price(r.get("price")),
                    "open": price(r.get("open")), "close1": price(r.get("close1")), "cur": price(r.get("cur"))})
    return out


def parse_detail(text: str, today: dt.date) -> dict:
    """상세 페이지의 '이름표 | 값' 칸에서 아는 이름표만 뽑는다."""
    got: dict = {}
    for r in html_rows(text):
        for i, c in enumerate(r[:-1]):
            lab = squash(c["t"])
            for key, names in DETAIL_LABELS.items():
                if key in got or lab not in names:
                    continue
                v = r[i + 1]["t"]
                if key == "market":
                    got[key] = "KOSPI" if re.search(r"유가|코스피|KOSPI", v, re.I) else \
                        "KOSDAQ" if re.search(r"코스닥|KOSDAQ", v, re.I) else \
                        "KONEX" if re.search(r"코넥스|KONEX", v, re.I) else None
                elif key == "sector":
                    got[key] = v[:40] or None
                elif key in ("shares", "post_shares"):
                    got[key] = to_int(v)
                elif key in ("refund", "list"):
                    got[key] = one_date(v, today)
                elif key == "code":
                    m = re.search(r"\b(\d{5}[0-9A-Z])\b", v)
                    got[key] = m.group(1) if m else None
    got.update(detail_extras(text, got.get("shares")))
    return {k: v for k, v in got.items() if v is not None}


def detail_extras(text: str, shares: int | None) -> dict:
    """구주매출 주식 수, 상장일 유통가능 물량 비율, 주간사별 배정 주식 수 — 못 찾거나 말이 안 되면 뺀다."""
    flat = " ".join(c["t"] for r in html_rows(text) for c in r)
    out: dict = {}
    m = OLD_RE.search(flat)
    if m:
        v = to_int(m.group(1))
        if v is not None and (not shares or v <= shares):
            out["old_shares"] = v
    m = FLOAT_RE.search(flat)
    if m:
        v = float(m.group(1))
        if 1 <= v <= 100:
            out["float_pct"] = v
    alloc: dict[str, int] = {}
    for name, n in UW_ALLOC_RE.findall(flat):
        n = to_int(n)
        if n and name not in alloc:
            alloc[name] = n
    if alloc and (not shares or sum(alloc.values()) <= shares * 1.05):
        out["uw_alloc"] = [[k, v] for k, v in alloc.items()]
    return out


# ---------------------------------------------------------------- 합치기
FIELDS = ["id", "name", "no", "market", "sector", "code", "uw", "uw_alloc", "band_lo", "band_hi", "price", "amount",
          "shares", "post_shares", "old_shares", "float_pct",
          "fc_start", "fc_end", "inst_comp", "lockup", "sub_start", "sub_end", "sub_comp", "refund",
          "list_date", "open", "close1", "cur", "spac"]


def merge(prev: list[dict], schedule, forecast, listing, details: dict[str, dict], today: dt.date,
          keep_days: int = 400) -> list[dict]:
    by: dict[str, dict] = {}
    for p in prev:
        by[norm_name(p["name"])] = dict(p)

    def put(rec: dict, weak_uw: bool):
        k = norm_name(rec["name"])
        cur = by.setdefault(k, {"name": rec["name"]})
        for f, v in rec.items():
            if v in (None, [], ""):
                continue
            if f == "uw" and weak_uw and cur.get("uw"):
                continue  # 수요예측 표는 주간사를 '한국투자'처럼 줄여 적는다 — 청약 표 이름을 둔다
            cur[f] = v

    # 뒤에 오는 표가 이긴다 — 확정가는 청약·상장 표가 최신
    for src, weak in ((forecast, True), (schedule, False), (listing, False)):
        for r in src:
            put(r, weak)
    for it in by.values():
        d = details.get(it.get("no") or "")
        if d:
            for f, v in d.items():
                f = "list_date" if f == "list" else f
                if f == "list_date" and it.get("list_date") and it["list_date"] != v:
                    continue  # 신규상장 표의 날짜가 더 믿을 만하다
                it[f] = v
        it["spac"] = bool(re.search(r"스팩|SPAC|기업인수목적", it["name"], re.I))

    cut = (today - dt.timedelta(days=keep_days)).isoformat()
    out = []
    for it in by.values():
        last = max(x for x in (it.get("list_date"), it.get("sub_end"), it.get("fc_end"), it.get("sub_start"), "0000")
                   if x)
        if last < cut:
            continue
        it["id"] = it.get("no") or "n-" + norm_name(it["name"])
        out.append({f: it[f] for f in FIELDS if f in it and it[f] not in (None, [], "")})
    out.sort(key=lambda x: (x.get("sub_start") or x.get("list_date") or x.get("fc_start") or ""), reverse=True)
    return out


def need_detail(it: dict, today: dt.date, prev_by_no: dict[str, dict]) -> int:
    """상세 페이지를 다시 읽을 차례. 0 = 안 읽음, 1 = 먼저(앞으로 일정이 있거나 최근 2주), 2 = 여유 있을 때(반년 안, 한 번도 못 읽음).
    지난 종목을 채워 두면 '판정별 시초가 성적'을 더 많은 표본으로 볼 수 있다."""
    if not it.get("no"):
        return 0
    last = max(it.get("sub_end") or "", it.get("fc_end") or "", it.get("list_date") or "")
    p = prev_by_no.get(it["no"], {})
    if last >= (today - dt.timedelta(days=14)).isoformat():
        return 1 if not all(p.get(k) for k in ("market", "list_date", "refund")) or not p.get("float_pct") else 0
    if last >= (today - dt.timedelta(days=400)).isoformat() and not p.get("market"):
        return 2
    return 0


# ---------------------------------------------------------------- 실행
def load_prev(path: str) -> list[dict]:
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f).get("items", [])
    except (OSError, ValueError):
        return []


def get_list(o: str, pages: int, html_dir: str | None) -> str:
    if html_dir:
        path = os.path.join(html_dir, f"{o}.html")
        with open(path, "rb") as f:
            return decode(f.read())
    chunks = []
    for page in range(1, pages + 1):
        for attempt in range(3):
            try:
                chunks.append(fetch(LIST_URL.format(o=o, page=page)))
                break
            except Exception as e:  # noqa: BLE001 — 네트워크 오류는 종류를 가리지 않고 다시 시도
                log(f"  {o} {page}쪽 실패({attempt + 1}/3): {e}")
                time.sleep(2 ** attempt)
        time.sleep(0.7)
    return "\n".join(chunks)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--html-dir", help="받아 둔 HTML 폴더(k.html, r1.html, nw.html, v-<no>.html)")
    ap.add_argument("--pages", type=int, default=3, help="표마다 몇 쪽까지 읽을지(쪽당 약 20종목)")
    ap.add_argument("--no-detail", action="store_true", help="상세 페이지를 읽지 않는다")
    ap.add_argument("--detail-limit", type=int, default=40, help="한 번에 읽을 상세 페이지 수(빈 값 채우기는 여러 번에 나눠 한다)")
    ap.add_argument("--min-schedule", type=int, default=5, help="청약 일정 표에서 최소 몇 종목을 읽어야 성공으로 볼지")
    ap.add_argument("--out", default=OUT)
    ap.add_argument("--today", help="YYYY-MM-DD (테스트용)")
    a = ap.parse_args(argv)

    now = dt.datetime.now(KST)
    today = dt.date.fromisoformat(a.today) if a.today else now.date()
    prev = load_prev(a.out)
    notes = []

    parsed = {}
    for o, fn, label in (("k", parse_schedule, "청약 일정"), ("r1", parse_forecast, "수요예측"),
                         ("nw", parse_listing, "신규상장")):
        try:
            rows = fn(get_list(o, a.pages, a.html_dir), today)
        except Exception as e:  # noqa: BLE001
            log(f"{label}: 읽기 실패 — {e}")
            rows = []
        log(f"{label}: {len(rows)}종목")
        if not rows:
            notes.append(f"{label} 표를 읽지 못해 이전 값을 썼습니다")
        parsed[o] = rows

    if len(parsed["k"]) < a.min_schedule:
        why = "38 에 접속하지 못했습니다" if not _WAYS and not a.html_dir else "38 페이지 모양이 바뀌었을 수 있습니다"
        log(f"청약 일정이 {len(parsed['k'])}종목뿐 — {why}. 기존 파일을 그대로 둡니다.")
        return 1

    items = merge(prev, parsed["k"], parsed["r1"], parsed["nw"], {}, today)
    details: dict[str, dict] = {}
    if not a.no_detail:
        prev_by_no = {p["no"]: p for p in prev if p.get("no")}
        rank = [(need_detail(it, today, prev_by_no), it["no"]) for it in items if it.get("no")]
        todo = [no for r, no in sorted(x for x in rank if x[0])]
        log(f"상세 페이지 {len(todo)}곳")
        for no in todo[:max(0, a.detail_limit)]:
            try:
                if a.html_dir:
                    path = os.path.join(a.html_dir, f"v-{no}.html")
                    if not os.path.exists(path):
                        continue
                    with open(path, "rb") as f:
                        text = decode(f.read())
                else:
                    text = fetch(DETAIL_URL.format(no=no))
                    time.sleep(0.7)
                details[no] = parse_detail(text, today)
            except Exception as e:  # noqa: BLE001
                log(f"  상세 {no} 실패: {e}")
        if todo and not details:
            notes.append("상세 페이지를 읽지 못해 시장·환불일·상장일은 이전 값입니다")
        items = merge(items, [], [], [], details, today)

    out = {"updated": now.isoformat(timespec="minutes"), "asof": today.isoformat(),
           "source": "38커뮤니케이션 (www.38.co.kr)", "notes": notes, "items": items}
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    tmp = a.out + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    os.replace(tmp, a.out)
    up = [i for i in items if (i.get("sub_end") or "") >= today.isoformat()]
    log(f"저장: {len(items)}종목 (청약 예정·진행 {len(up)}) → {os.path.relpath(a.out)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
