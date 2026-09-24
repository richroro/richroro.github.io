#!/usr/bin/env python3
"""전 종목 탐색기 데이터 빌드.

미국(나스닥·뉴욕·아메리칸)과 한국(코스피·코스닥·코넥스) 상장 종목을 한 파일
(finder/data/stocks.json)로 묶는다. 페이지는 이 파일 하나만 읽는다.

출처
  미국 종목 목록·시총·업종   github.com/rreichel3/US-Stock-Symbols (나스닥 스크리너를 매일 받아 두는 저장소)
  미국 1년 일봉                Yahoo Finance (yfinance) — 실패하면 이전 파일의 지표를 그대로 둔다
  한국 1년 일봉·시총           github.com/FinanceData/marcap (KRX 전종목 시세를 매일 쌓는 저장소)
  한국 업종·주요제품           KIND 상장법인목록 — 실패하면 data/kr_meta.json 캐시를 쓴다
  원/달러                      Yahoo KRW=X → 실패하면 KB금융·신한지주 ADR 과 원주 종가 비율

지표는 전부 수정 종가로 계산한다. 한국은 가격제한폭(±30%)을 넘는 하루 변동을
액면분할·병합 같은 비시장 이벤트로 보고 그 이전 가격을 같은 비율로 맞춘다.

사용 예
  python finder/build.py                          # 전부 네트워크에서
  python finder/build.py --no-us-history          # 미국 일봉 생략(이전 지표 유지)
  python finder/build.py --us-dir /tmp/us --kr-dir /tmp/marcap   # 받아 둔 파일로
"""
from __future__ import annotations

import argparse
import datetime as dt
import html.parser
import io
import json
import math
import os
import re
import sys
import time
import urllib.request

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"

US_RAW = "https://raw.githubusercontent.com/rreichel3/US-Stock-Symbols/main/{ex}/{ex}_full_tickers.json"
KR_RAW = "https://raw.githubusercontent.com/FinanceData/marcap/master/data/marcap-{year}.parquet"
KIND_URL = "https://kind.krx.co.kr/corpgeneral/corpList.do?method=download&searchType=13"

US_SECTOR_KO = {
    "Technology": "기술", "Finance": "금융", "Health Care": "헬스케어",
    "Consumer Discretionary": "경기소비재", "Consumer Staples": "필수소비재",
    "Industrials": "산업재", "Energy": "에너지", "Utilities": "유틸리티",
    "Real Estate": "부동산", "Basic Materials": "소재", "Telecommunications": "통신",
    "Miscellaneous": "기타",
}
DROP_NAME = re.compile(r"\b(warrants?|rights?|units?)\b", re.I)
# 거래소에 주식처럼 올라와 있지만 채권·우선주 상품인 것(AT&T 5.35% Notes, 컴캐스트 ZONES, 알파벳 우선주 예탁증권 …).
# 모회사 시가총액이 그대로 붙어 있어 시총 순위를 흐린다. 우선주가 본주인 ADR(이타우 ITUB 등)은 남긴다.
DROP_INSTRUMENT = re.compile(
    r"\d+(\.\d+)?\s?%|\bNotes?\b|\bDebentures?\b|\bZONES\b|\bPreferred\s+(Stock|Securities|Shares|Units)\b|"
    r"\bTrust Preferred\b|\bFixed[- ]to[- ]Floating\b|Interest in a (Share|Preferred)", re.I)


def is_instrument(name: str) -> bool:
    return bool(DROP_INSTRUMENT.search(name)) and "american depositary" not in name.lower()
NAME_TAIL = re.compile(
    r"\s*(,)?\s*(Common Stock|Common Shares|Ordinary Shares?|American Depositary Shares?|"
    r"American Depository Shares?|Depositary Shares?|ADS|Class [A-C] (Common Stock|Ordinary Shares?)|"
    r"Capital Stock|Common Units?|Shares of Beneficial Interest)\b.*$", re.I)

SPARK_ABC = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_"


def log(*a):
    print(*a, file=sys.stderr, flush=True)


def fetch(url: str, timeout: int = 60) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


# --------------------------------------------------------------------------- 미국
def load_us_universe(us_dir: str | None) -> list[dict]:
    out = []
    for ex in ("nasdaq", "nyse", "amex"):
        if us_dir:
            with open(os.path.join(us_dir, f"{ex}_full_tickers.json"), encoding="utf-8") as f:
                rows = json.load(f)
        else:
            rows = json.loads(fetch(US_RAW.format(ex=ex)))
        for r in rows:
            sym = r["symbol"].strip()
            if "^" in sym or not sym or DROP_NAME.search(r["name"]) or is_instrument(r["name"]):
                continue
            sym = sym.replace("/", ".")
            name = r["name"].strip()
            short = NAME_TAIL.sub("", name).strip(" ,") or name
            # "Class A Common Stock" 에서 Class A 는 남긴다 — GOOGL/GOOG 처럼 둘 다 상장된 경우가 있다
            m = re.search(r"\bClass ([A-C])\b", name)
            if m and f"Class {m.group(1)}" not in short:
                short += f" Class {m.group(1)}"
            out.append({
                "id": sym, "m": ex.upper(), "n": short,
                "sec": US_SECTOR_KO.get(r.get("sector") or "", ""),
                "ind": (r.get("industry") or "").strip(),
                "cty": (r.get("country") or "").strip(),
                "ipo": int(r["ipoyear"]) if (r.get("ipoyear") or "").isdigit() else None,
                "p": num(r.get("lastsale")), "d1": num(r.get("pctchange")),
                "mc": num(r.get("marketCap")), "vol0": num(r.get("volume")),
            })
    # 같은 심볼이 두 거래소 파일에 겹치면 첫 번째만
    seen, uniq = set(), []
    for r in out:
        if r["id"] in seen:
            continue
        seen.add(r["id"]); uniq.append(r)
    return uniq


def num(s):
    if s is None:
        return None
    s = str(s).replace("$", "").replace("%", "").replace(",", "").strip()
    try:
        v = float(s)
    except ValueError:
        return None
    return v if math.isfinite(v) else None


def us_history(symbols: list[str], batch: int = 150) -> dict[str, dict]:
    """yfinance 로 1년 남짓 일봉을 받는다. 받지 못한 심볼은 결과에 없다."""
    try:
        import yfinance as yf
    except ImportError:
        log("yfinance 없음 — 미국 일봉 생략")
        return {}
    out: dict[str, dict] = {}
    ymap = {s.replace(".", "-"): s for s in symbols}
    ys = list(ymap)
    for i in range(0, len(ys), batch):
        chunk = ys[i:i + batch]
        for attempt in range(3):
            try:
                df = yf.download(chunk, period="14mo", interval="1d", auto_adjust=True,
                                 group_by="ticker", threads=True, progress=False)
                break
            except Exception as e:  # 속도 제한 등
                log(f"  yfinance 실패({attempt + 1}/3): {e}")
                time.sleep(10 * (attempt + 1))
        else:
            continue
        if df is None or df.empty:
            continue
        multi = getattr(df.columns, "nlevels", 1) > 1
        for y in chunk:
            try:
                sub = df[y] if multi else df
                sub = sub.dropna(subset=["Close"])
            except KeyError:
                continue
            if len(sub) < 2:
                continue
            close = sub["Close"].to_numpy(dtype=float)
            vol = sub["Volume"].fillna(0).to_numpy(dtype=float)
            out[ymap[y]] = {
                "dates": [d.date() for d in sub.index], "close": close,
                "vol": vol, "val": close * vol,
            }
        log(f"  미국 일봉 {min(i + batch, len(ys))}/{len(ys)} (확보 {len(out)})")
        time.sleep(1.5)
    return out


# --------------------------------------------------------------------------- 한국
def load_kr(kr_dir: str | None, today: dt.date):
    import pandas as pd
    frames = []
    for year in (today.year - 1, today.year):
        try:
            if kr_dir:
                path = os.path.join(kr_dir, f"marcap-{year}.parquet")
                if not os.path.exists(path):
                    continue
                frames.append(pd.read_parquet(path))
            else:
                frames.append(pd.read_parquet(io.BytesIO(fetch(KR_RAW.format(year=year), timeout=300))))
            log(f"  marcap {year} 읽음")
        except Exception as e:
            log(f"  marcap {year} 실패: {e}")
    if not frames:
        return [], {}, None
    df = pd.concat(frames, ignore_index=True)
    df = df[df["Date"] >= pd.Timestamp(today - dt.timedelta(days=430))]
    asof = df["Date"].max()
    last = df[df["Date"] == asof]
    rows, hist = [], {}
    df = df.sort_values(["Code", "Date"])
    groups = dict(tuple(df.groupby("Code", sort=False)))
    for _, r in last.iterrows():
        code = r["Code"]
        g = groups.get(code)
        if g is None:
            continue
        mkt = str(r["Market"]).replace(" GLOBAL", "")
        dept = str(r["Dept"]) if isinstance(r["Dept"], str) else ""
        rows.append({
            "id": code, "m": mkt, "n": r["Name"], "sec": "", "ind": "",
            "p": float(r["Close"]), "d1": float(r["ChangesRatio"]),
            "mc": float(r["Marcap"]), "warn": 1 if ("관리" in dept or "환기" in dept) else 0,
        })
        close = g["Close"].to_numpy(dtype=float)
        stocks = g["Stocks"].to_numpy(dtype=float)
        close = kr_adjust(close, stocks)
        hist[code] = {
            "dates": [d.date() for d in g["Date"]], "close": close,
            "vol": g["Volume"].fillna(0).to_numpy(dtype=float),
            "val": g["Amount"].fillna(0).to_numpy(dtype=float),
        }
    return rows, hist, asof.date()


def kr_adjust(close: np.ndarray, stocks: np.ndarray) -> np.ndarray:
    """가격제한폭(±30%)을 넘는 하루 변동은 시장이 아니라 주식 수 변경에서 온 것이다.
    그날의 비율로 이전 가격을 모두 맞춰, 분할 전후가 이어지게 한다."""
    c = close.copy()
    for i in range(len(c) - 1, 0, -1):
        prev, cur = c[i - 1], c[i]
        if prev <= 0 or cur <= 0:
            continue
        ratio = cur / prev
        if ratio > 1.31 or ratio < 0.69:
            # 주식 수가 같이 바뀐 날이면 주식 수 비율이 더 정확하다
            sr = stocks[i - 1] / stocks[i] if stocks[i] > 0 else 0
            f = sr if sr > 0 and abs(math.log(sr / ratio)) < 0.15 else ratio
            c[:i] *= f
    return c


class _Table(html.parser.HTMLParser):
    def __init__(self):
        super().__init__(); self.rows, self._row, self._cell = [], None, None

    def handle_starttag(self, tag, attrs):
        if tag == "tr": self._row = []
        elif tag in ("td", "th") and self._row is not None: self._cell = []

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self._cell is not None and self._row is not None:
            self._row.append("".join(self._cell).strip()); self._cell = None
        elif tag == "tr" and self._row is not None:
            self.rows.append(self._row); self._row = None

    def handle_data(self, d):
        if self._cell is not None: self._cell.append(d)


def kr_meta(use_kind: bool) -> dict:
    """종목코드 → {sec 업종, prod 주요제품, lst 상장일}. KIND 가 안 되면 캐시."""
    cache = os.path.join(DATA, "kr_meta.json")
    old = {}
    if os.path.exists(cache):
        with open(cache, encoding="utf-8") as f:
            old = json.load(f)
    if not use_kind:
        return old
    try:
        raw = fetch(KIND_URL, timeout=60)
        text = raw.decode("euc-kr", errors="replace")
        p = _Table(); p.feed(text)
        head, *body = p.rows
        ix = {k: head.index(k) for k in ("종목코드", "업종", "주요제품", "상장일") if k in head}
        meta = {}
        for r in body:
            if len(r) < len(head):
                continue
            code = r[ix["종목코드"]].strip().zfill(6)
            meta[code] = {"sec": r[ix["업종"]].strip(), "prod": r[ix["주요제품"]].strip()[:80],
                          "lst": r[ix["상장일"]].strip()[:4] if "상장일" in ix else ""}
        if len(meta) > 1000:
            with open(cache, "w", encoding="utf-8") as f:
                json.dump(meta, f, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
            log(f"  KIND 업종 {len(meta)}건 갱신")
            return meta
        log(f"  KIND 응답이 이상함({len(meta)}건) — 캐시 사용")
    except Exception as e:
        log(f"  KIND 실패: {e} — 캐시 사용")
    return old


# --------------------------------------------------------------------------- 지표
def metrics(h: dict) -> dict:
    c = h["close"]; v = h["vol"]; val = h["val"]; dates = h["dates"]
    n = len(c)
    p = c[-1]
    out: dict = {"nd": n}

    def ret(k):
        return (p / c[-1 - k] - 1) * 100 if n > k and c[-1 - k] > 0 else None

    out["r5"], out["r21"], out["r63"], out["r126"], out["r252"] = (ret(k) for k in (5, 21, 63, 126, 252))
    if n > 1:
        out["d1h"] = ret(1)
    # 연초 대비: 올해 첫 거래일 전날 종가 기준
    y0 = next((i for i, d in enumerate(dates) if d.year == dates[-1].year), None)
    if y0 is not None and y0 > 0:
        out["ytd"] = (p / c[y0 - 1] - 1) * 100
    w = c[-252:]
    hi, lo = w.max(), w.min()
    out["fh"] = (p / hi - 1) * 100 if hi > 0 else None
    out["fl"] = (p / lo - 1) * 100 if lo > 0 else None
    out["h52"], out["l52"] = hi, lo

    def sma(k, end=None):
        s = c[:end] if end else c
        return s[-k:].mean() if len(s) >= k else None

    ma50, ma200 = sma(50), sma(200)
    out["pm50"] = (p / ma50 - 1) * 100 if ma50 else None
    out["pm200"] = (p / ma200 - 1) * 100 if ma200 else None
    # 최근 20거래일 안의 50/200일선 교차
    x = ""
    if n >= 221:
        a = np.convolve(c, np.ones(50) / 50, "valid")[-21:]
        b = np.convolve(c, np.ones(200) / 200, "valid")[-21:]
        d = np.sign(a - b)
        for i in range(1, len(d)):
            if d[i - 1] <= 0 < d[i]: x = "G"
            elif d[i - 1] >= 0 > d[i]: x = "D"
    out["x"] = x
    out["up"] = 1 if (ma50 and ma200 and ma50 > ma200) else 0
    # RSI(14) — Wilder
    if n >= 30:
        dlt = np.diff(c[-120:])
        g = np.clip(dlt, 0, None); l = np.clip(-dlt, 0, None)
        ag, al = g[:14].mean(), l[:14].mean()
        for i in range(14, len(dlt)):
            ag = (ag * 13 + g[i]) / 14; al = (al * 13 + l[i]) / 14
        out["rsi"] = 100.0 if al == 0 else 100 - 100 / (1 + ag / al)
    # 변동성(최근 63거래일, 연환산)
    if n >= 22:
        lr = np.diff(np.log(c[-64:]))
        lr = lr[np.isfinite(lr)]
        if len(lr) > 10:
            out["vol"] = float(lr.std(ddof=1) * math.sqrt(252) * 100)
    # 1년 최대낙폭
    peak = np.maximum.accumulate(w)
    out["mdd"] = float(((w / peak) - 1).min() * 100)
    # 유동성: 20일 평균 거래대금, 거래량 급증 = 5일 평균 / 60일 평균
    out["tv"] = float(val[-20:].mean()) if n else None
    if n >= 60 and v[-60:].mean() > 0:
        out["vs"] = float(v[-5:].mean() / v[-60:].mean())
    # 주간 스파크라인: 끝에서부터 5거래일 간격
    wk = c[::-1][::5][::-1][-53:]
    if len(wk) >= 4:
        lo_, hi_ = float(wk.min()), float(wk.max())
        span = hi_ - lo_ or 1.0
        out["sp"] = "".join(SPARK_ABC[int(round((x_ - lo_) / span * 63))] for x_ in wk)
        out["spl"], out["sph"] = lo_, hi_
    out["asof"] = dates[-1].isoformat()
    return out


def pct_rank(values: list, higher_better=True) -> list:
    """같은 시장 안에서의 백분위(0~100). None 은 None."""
    idx = [i for i, x in enumerate(values) if x is not None and math.isfinite(x)]
    if len(idx) < 10:
        return [None] * len(values)
    arr = np.array([values[i] for i in idx])
    order = arr.argsort(kind="mergesort")
    ranks = np.empty(len(arr)); ranks[order] = np.arange(len(arr))
    pr = ranks / (len(arr) - 1) * 100
    if not higher_better:
        pr = 100 - pr
    out = [None] * len(values)
    for j, i in enumerate(idx):
        out[i] = pr[j]
    return out


def mean_ok(*xs):
    xs = [x for x in xs if x is not None]
    return sum(xs) / len(xs) if xs else None


def scores(rows: list[dict]):
    """모멘텀·추세·안정성·유동성 네 점수. 미국은 미국끼리, 한국은 한국끼리 비교한다."""
    for grp in ("US", "KR"):
        rs = [r for r in rows if r["g"] == grp and (r.get("nd") or 0) >= 60]
        if not rs:
            continue
        col = lambda k: [r.get(k) for r in rs]
        p63, p126, p252 = pct_rank(col("r63")), pct_rank(col("r126")), pct_rank(col("r252"))
        p50, p200 = pct_rank(col("pm50")), pct_rank(col("pm200"))
        pvol, pmdd = pct_rank(col("vol"), higher_better=False), pct_rank(col("mdd"))
        ptv = pct_rank(col("tv"))
        for i, r in enumerate(rs):
            r["sm"] = mean_ok(p63[i], p126[i], p252[i])
            r["st"] = mean_ok(p50[i], p200[i])
            r["ss"] = mean_ok(pvol[i], pmdd[i])
            r["sl"] = ptv[i]


# --------------------------------------------------------------------------- 재무
QUOTE_URL = "https://query1.finance.yahoo.com/v7/finance/quote"
FUND = ("pe", "fpe", "pb", "dy", "eps", "roe", "ern", "ar", "fs", "tgt")


def yahoo_symbol(r: dict) -> str | None:
    if r["g"] == "US":
        return r["id"].replace(".", "-")
    suffix = {"KOSPI": ".KS", "KOSDAQ": ".KQ"}.get(r["m"])  # 코넥스는 Yahoo 에 없다
    return r["id"] + suffix if suffix else None


def _ok(v, lo, hi):
    return v if isinstance(v, (int, float)) and math.isfinite(v) and lo < v < hi else None


def parse_quote(q: dict, today: dt.date) -> dict:
    """Yahoo v7 quote 한 건 → 재무 지표. 통화가 섞인 ADR 처럼 앞뒤가 안 맞는 값은 버린다."""
    price = q.get("regularMarketPrice")
    out = {"pe": _ok(q.get("trailingPE"), 0, 3000), "fpe": _ok(q.get("forwardPE"), 0, 3000),
           "pb": _ok(q.get("priceToBook"), 0, 500), "eps": _ok(q.get("epsTrailingTwelveMonths"), -1e7, 1e7)}
    rate = q.get("dividendRate") or q.get("trailingAnnualDividendRate")
    out["dy"] = _ok(rate / price * 100, 0, 25) if rate and price else (0.0 if price else None)
    # ROE ≈ 주당순이익 ÷ 주당순자산. 장부가 통화가 주가와 같은지(PBR 이 price/bookValue 와 맞는지) 확인한다
    bv = q.get("bookValue")
    if out["eps"] is not None and bv and bv > 0 and price and out["pb"] and abs(price / bv / out["pb"] - 1) < 0.2:
        out["roe"] = _ok(out["eps"] / bv * 100, -300, 300)
    ern = None
    for k in ("earningsTimestampStart", "earningsTimestamp"):
        ts = q.get(k)
        if ts:
            d = dt.datetime.fromtimestamp(ts, dt.timezone.utc).date()
            if d >= today:
                ern = d.isoformat(); break
    out["ern"] = ern
    m = re.match(r"\s*([\d.]+)", str(q.get("averageAnalystRating") or ""))
    out["ar"] = _ok(float(m.group(1)), 0.9, 5.1) if m else None
    return out


def yahoo_fund(rows: list[dict], today: dt.date, batch: int = 150) -> dict[str, dict]:
    """Yahoo 일괄 시세(v7 quote). 실적일·애널리스트 의견은 여기서만 나온다.
    Yahoo 는 데이터센터 IP 에 인증 토큰(crumb)을 잘 주지 않는다 — 401/403 이면 바로 그만둔다."""
    try:
        from yfinance.data import YfData
    except ImportError:
        log("  yfinance 없음 — Yahoo 재무 생략")
        return {}
    yd = YfData()
    ymap = {yahoo_symbol(r): r["id"] for r in rows if yahoo_symbol(r)}
    keys, out, fails = list(ymap), {}, 0
    for i in range(0, len(keys), batch):
        chunk = keys[i:i + batch]
        j = None
        for attempt in range(3):
            try:
                j = yd.get_raw_json(QUOTE_URL, params={"symbols": ",".join(chunk), "formatted": "false",
                                                       "lang": "en-US", "region": "US"})
                break
            except Exception as e:
                msg = str(e)[:120]
                if re.search(r"\b40[13]\b", msg):
                    log(f"  Yahoo 재무: 인증 거부({msg}) — 건너뜀")
                    return out
                log(f"  Yahoo 재무 실패({attempt + 1}/3): {msg}")
                time.sleep(8 * (attempt + 1))
        if j is None:
            fails += 1
            if fails >= 3 and not out:
                log("  Yahoo 재무: 연속 실패 — 건너뜀")
                return out
            continue
        for q in (j.get("quoteResponse") or {}).get("result") or []:
            sid = ymap.get(q.get("symbol"))
            if sid:
                out[sid] = dict(parse_quote(q, today), fs="Y")
        time.sleep(0.6)
    return out


# ---- 미국: SEC EDGAR — 미국 정부 공시 데이터(퍼블릭 도메인). frames API 는 한 지표를 전 회사에 대해 한 번에 준다
def sec_user_agent() -> str | None:
    """SEC 는 요청마다 '이름 연락처이메일' 형식의 User-Agent 를 요구한다(없으면 403).
    SEC_USER_AGENT(전체 문자열) 또는 SEC_CONTACT(이메일) 환경변수로 받는다."""
    ua = os.environ.get("SEC_USER_AGENT", "").strip()
    if ua:
        return ua
    mail = os.environ.get("SEC_CONTACT", "").strip()
    return f"richroro-finder {mail}" if "@" in mail else None


def sec_json(url: str):
    import gzip
    req = urllib.request.Request(url, headers={"User-Agent": sec_user_agent() or "", "Accept-Encoding": "gzip"})
    with urllib.request.urlopen(req, timeout=90) as r:
        raw = r.read()
        if r.headers.get("Content-Encoding") == "gzip":
            raw = gzip.decompress(raw)
    time.sleep(0.15)  # SEC 는 초당 10건까지
    return json.loads(raw)


def sec_latest(tag: str, unit: str, periods: list[str]) -> dict[int, dict]:
    """여러 기간의 frame 을 받아 회사(CIK)마다 가장 최근 값을 고른다."""
    best: dict[int, dict] = {}
    for per in periods:
        try:
            data = sec_json(f"https://data.sec.gov/api/xbrl/frames/us-gaap/{tag}/{unit}/{per}.json").get("data", [])
        except Exception as e:
            if "404" not in str(e):
                log(f"  SEC {tag} {per}: {str(e)[:80]}")
            continue
        for d in data:
            c = d.get("cik")
            if c is not None and (c not in best or d["end"] > best[c]["end"]):
                best[c] = d
    return best


def sec_fund(rows: list[dict], today: dt.date) -> dict[str, dict]:
    """PER = 시총 ÷ 순이익, PBR = 시총 ÷ 자기자본, ROE = 순이익 ÷ 자기자본, 배당 = 배당 지급액 ÷ 시총.
    주당 값 대신 총액으로 계산해 결산 뒤 액면분할이 있어도 틀어지지 않게 한다. 최근 회계연도(연간) 기준."""
    if not sec_user_agent():
        log("  SEC: 연락처(SEC_CONTACT)가 없어 건너뜀 — SEC 는 User-Agent 에 이메일을 요구한다")
        return {}
    try:
        tick = sec_json("https://www.sec.gov/files/company_tickers.json")
    except Exception as e:
        body = re.sub(rb"<[^>]+>|\s+", b" ", getattr(e, "read", lambda: b"")()[:400])[:160]
        log(f"  SEC 티커 목록 실패: {str(e)[:100]} {body!r} — 건너뜀")
        return {}
    cik_of = {v["ticker"].upper().replace("-", "."): int(v["cik_str"]) for v in tick.values()}
    Y = today.year
    annual = [f"CY{Y}", f"CY{Y - 1}", f"CY{Y - 2}"]
    q0 = (today.month - 1) // 3 + 1
    instants = []
    for k in range(1, 6):  # 지난 다섯 분기 말
        y, q = Y, q0 - k
        while q <= 0:
            y, q = y - 1, q + 4
        instants.append(f"CY{y}Q{q}I")
    ni = sec_latest("NetIncomeLoss", "USD", annual)
    eq = sec_latest("StockholdersEquity", "USD", instants)
    dv = sec_latest("PaymentsOfDividendsCommonStock", "USD", annual)
    for c, d in sec_latest("PaymentsOfDividends", "USD", annual).items():
        dv.setdefault(c, d)
    stale = (today - dt.timedelta(days=550)).isoformat()
    out = {}
    for r in rows:
        if r["g"] != "US" or not r.get("mc"):
            continue
        c = cik_of.get(r["id"])
        if c is None:
            continue
        f, mc = {}, r["mc"]
        n = ni.get(c)
        e = eq.get(c)
        if n and n["end"] >= stale:
            f["pe"] = _ok(mc / n["val"], 0, 3000) if n["val"] > 0 else None
            if r.get("p"):
                f["eps"] = r["p"] * n["val"] / mc  # 주가 × 순이익/시총 = 주당순이익(분할 반영)
        if e and e["end"] >= stale and e["val"] > 0:
            f["pb"] = _ok(mc / e["val"], 0, 500)
            if n and n["end"] >= stale:
                f["roe"] = _ok(n["val"] / e["val"] * 100, -300, 300)
        d = dv.get(c)
        if n and n["end"] >= stale:  # 배당 기록이 없으면 무배당으로 본다
            f["dy"] = _ok(abs(d["val"]) / mc * 100, 0, 25) if d and d["end"] >= stale else 0.0
        if any(v is not None for v in f.values()):
            out[r["id"]] = dict(f, fs="S")
    return out


# ---- 한국: 한국거래소 PER/PBR/배당수익률(전종목) 표 한 장
def _krx_num(s):
    s = str(s or "").replace(",", "").strip()
    try:
        v = float(s)
    except ValueError:
        return None
    return v if math.isfinite(v) else None


def krx_fund(asof: dt.date | None) -> dict[str, dict]:
    """한국거래소 정보데이터시스템의 PER/PBR/배당수익률 전종목 표. 먼저 화면을 열어 세션 쿠키를 받는다."""
    import http.cookiejar
    import urllib.parse
    if not asof:
        return {}
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    page = "http://data.krx.co.kr/contents/MDC/MDI/mdiLoader/index.cmd?menuId=MDC0201020502"
    try:
        opener.open(urllib.request.Request(page, headers={"User-Agent": UA}), timeout=30).read()
    except Exception as e:
        log(f"  KRX 세션: {str(e)[:100]}")
    url = "http://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd"
    for back in range(0, 7):
        d = asof - dt.timedelta(days=back)
        if d.weekday() >= 5:
            continue
        body = urllib.parse.urlencode({"bld": "dbms/MDC/STAT/standard/MDCSTAT03501", "locale": "ko_KR",
                                       "searchType": "1", "mktId": "ALL", "trdDd": d.strftime("%Y%m%d"),
                                       "csvxls_isNo": "false"}).encode()
        req = urllib.request.Request(url, data=body, headers={
            "User-Agent": UA, "X-Requested-With": "XMLHttpRequest", "Origin": "http://data.krx.co.kr",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "Referer": page})
        try:
            with opener.open(req, timeout=60) as r:
                text = r.read().decode("utf-8", errors="replace")
            j = json.loads(text)
        except Exception as e:
            body_txt = getattr(e, "read", lambda: b"")()[:160]
            log(f"  KRX 재무 {d}: {str(e)[:80]} {body_txt!r}")
            return {}
        rows = j.get("output") or j.get("OutBlock_1") or []
        if len(rows) < 500:
            continue
        out = {}
        for x in rows:
            code = str(x.get("ISU_SRT_CD", "")).zfill(6)
            eps, bps = _krx_num(x.get("EPS")), _krx_num(x.get("BPS"))
            f = {"pe": _ok(_krx_num(x.get("PER")), 0, 3000), "pb": _ok(_krx_num(x.get("PBR")), 0, 500),
                 "dy": _ok(_krx_num(x.get("DVD_YLD")), -0.001, 25), "eps": eps}
            if eps is not None and bps and bps > 0:
                f["roe"] = _ok(eps / bps * 100, -300, 300)
            out[code] = dict(f, fs="K")
        log(f"  KRX 재무 {d}: {len(out)}종목")
        return out
    log("  KRX 재무: 응답이 비었습니다")
    return {}


NAVER_API = "https://m.stock.naver.com/api/stock/{code}/integration"
# 네이버 증권 종목 요약의 항목 이름 → 우리 열
NAVER_KEYS = {"per": "pe", "pbr": "pb", "eps": "eps", "bps": "bps", "dividendyieldratio": "dy", "cnsper": "fpe",
              "PER": "pe", "PBR": "pb", "EPS": "eps", "BPS": "bps", "배당수익률": "dy", "추정PER": "fpe"}


def parse_naver(j: dict) -> dict:
    """{"totalInfos":[{"code":"per","key":"PER","value":"13.21배"}, ...]} → 재무 지표. 모르는 항목은 무시한다."""
    got = {}
    infos = j.get("totalInfos") or j.get("stockItemTotalInfos") or []
    for it in infos:
        k = NAVER_KEYS.get(str(it.get("code", "")).lower()) or NAVER_KEYS.get(str(it.get("key", "")))
        if not k or k in got:
            continue
        m = re.search(r"-?[\d,]+(?:\.\d+)?", str(it.get("value", "")))
        if m:
            got[k] = float(m.group(0).replace(",", ""))
    f = {"pe": _ok(got.get("pe"), 0, 3000), "fpe": _ok(got.get("fpe"), 0, 3000), "pb": _ok(got.get("pb"), 0, 500),
         "dy": _ok(got.get("dy"), -0.001, 25), "eps": got.get("eps")}
    if got.get("eps") is not None and got.get("bps", 0) > 0:
        f["roe"] = _ok(got["eps"] / got["bps"] * 100, -300, 300)
    return f


def naver_fund(rows: list[dict], workers: int = 6) -> dict[str, dict]:
    """KRX 가 막혔을 때: 네이버 증권 종목 요약을 종목마다 받는다(코스피·코스닥, 동시 6개)."""
    from concurrent.futures import ThreadPoolExecutor
    codes = [r["id"] for r in rows if r["g"] == "KR" and r["m"] in ("KOSPI", "KOSDAQ")]
    errs = []

    def one(code):
        req = urllib.request.Request(NAVER_API.format(code=code), headers={"User-Agent": UA, "Referer": "https://m.stock.naver.com/"})
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                return code, parse_naver(json.loads(r.read()))
        except Exception as e:
            errs.append(str(e)[:80])
            return code, None

    out = {}
    # 처음 몇 개로 통하는지 본다 — 전부 막히면 2천여 번 두드리지 않는다
    for code, f in map(one, codes[:5]):
        if f and any(v is not None for v in f.values()):
            out[code] = dict(f, fs="N")
    if not out:
        log(f"  네이버 재무: 첫 5종목 실패({errs[:1]}) — 건너뜀")
        return {}
    with ThreadPoolExecutor(workers) as ex:
        for code, f in ex.map(one, codes[5:]):
            if f and any(v is not None for v in f.values()):
                out[code] = dict(f, fs="N")
    log(f"  네이버 재무: {len(out)}/{len(codes)}종목 (실패 {len(errs)})")
    return out


# 미국 종목도 네이버 증권(해외주식)에 요약이 있다. 심볼 형식(로이터 코드)과 주소를 몇 종목으로 먼저 확인한다.
NAVER_US_URLS = ["https://api.stock.naver.com/stock/{sym}/integration", "https://api.stock.naver.com/stock/{sym}/basic",
                 "https://m.stock.naver.com/api/stock/{sym}/integration"]
NAVER_RIC = {"NASDAQ": [".O", ""], "NYSE": ["", ".N", ".K"], "AMEX": [".A", "", ".K"]}


def _naver_get(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": "https://m.stock.naver.com/"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read())


def naver_us_fund(rows: list[dict], limit: int = 3000, workers: int = 6) -> dict[str, dict]:
    from concurrent.futures import ThreadPoolExecutor
    us = sorted([r for r in rows if r["g"] == "US" and r.get("mcu")], key=lambda r: -r["mcu"])[:limit]
    # 형식 확인에는 점이 없는 티커를 쓴다(BRK.B 같은 건 따로 표기법이 있을 수 있다)
    by_m = {m: next((r for r in us if r["m"] == m and "." not in r["id"]), None) for m in NAVER_RIC}
    plan: dict[str, tuple[str, str]] = {}  # 거래소 → (주소 형식, 접미사)
    for m, r in by_m.items():
        if not r:
            continue
        for url in NAVER_US_URLS:
            for suf in NAVER_RIC[m]:
                try:
                    f = parse_naver(_naver_get(url.format(sym=r["id"] + suf)))
                except Exception:
                    continue
                if f.get("pe") is not None or f.get("pb") is not None:
                    plan[m] = (url, suf); break
            if m in plan:
                break
    log(f"  네이버(미국) 형식: {plan or '찾지 못함'}")
    if not plan:
        return {}

    def one(r):
        url, suf = plan.get(r["m"], (None, None))
        if url is None:
            return r["id"], None
        try:
            return r["id"], parse_naver(_naver_get(url.format(sym=r["id"] + suf)))
        except Exception:
            return r["id"], None

    out = {}
    with ThreadPoolExecutor(workers) as ex:
        for sid, f in ex.map(one, us):
            if f and any(v is not None for v in f.values()):
                out[sid] = dict(f, fs="N")
    log(f"  네이버(미국) 재무: {len(out)}/{len(us)}종목")
    return out


# ---- 미국: 나스닥 웹사이트 API — 종목 목록을 주는 저장소가 GitHub Actions 에서 매일 긁는 곳이라 막힐 가능성이 가장 낮다
NASDAQ_HDR = {"User-Agent": UA, "Accept": "application/json, text/plain, */*", "Accept-Language": "en-US,en;q=0.9",
              "Origin": "https://www.nasdaq.com", "Referer": "https://www.nasdaq.com/"}


def nasdaq_json(url: str):
    req = urllib.request.Request(url, headers=NASDAQ_HDR)
    with urllib.request.urlopen(req, timeout=25) as r:
        return json.loads(r.read())


def _num(v):
    """'$1,234.50' · '0.44%' · 33.1 · 'N/A' → 숫자 또는 None"""
    if isinstance(v, (int, float)):
        return float(v) if math.isfinite(v) else None
    t = str(v or "").replace("\u2212", "-").replace("$", "").replace(" ", "")
    m = re.search(r"-?[\d,]*\.?\d+", t)
    if not m:
        return None
    try:
        x = float(m.group(0).replace(",", ""))
    except ValueError:
        return None
    return -abs(x) if t.startswith("(") and t.endswith(")") else x  # 회계식 음수 ($0.45)


def parse_nasdaq_summary(j: dict, price: float | None) -> dict:
    sd = ((j or {}).get("data") or {}).get("summaryData") or {}
    val = lambda k: (sd.get(k) or {}).get("value")
    f = {"pe": _ok(_num(val("PERatio")), 0, 3000), "fpe": _ok(_num(val("ForwardPE1Yr")), 0, 3000),
         "eps": _num(val("EarningsPerShare")), "tgt": _ok(_num(val("OneYrTarget")), 0, 1e7)}
    dy = _num(val("Yield"))
    if dy is None:
        ann = _num(val("AnnualizedDividend"))
        dy = ann / price * 100 if ann is not None and price else None
    f["dy"] = _ok(dy, -0.001, 25)
    return f


def nasdaq_fund(rows: list[dict], limit: int = 3000, workers: int = 6) -> dict[str, dict]:
    """종목마다 나스닥 요약(PER·선행 PER·EPS·배당수익률·1년 목표가). 시총 상위 limit 곳만."""
    from concurrent.futures import ThreadPoolExecutor
    us = sorted([r for r in rows if r["g"] == "US" and r.get("mcu")], key=lambda r: -r["mcu"])[:limit]
    url = "https://api.nasdaq.com/api/quote/{sym}/summary?assetclass=stocks"
    try:
        probe = parse_nasdaq_summary(nasdaq_json(url.format(sym="AAPL")), None)
    except Exception as e:
        log(f"  나스닥 요약: 확인 실패({str(e)[:100]}) — 건너뜀")
        return {}
    if all(v is None for v in probe.values()):
        log("  나스닥 요약: 응답은 오지만 값이 비었습니다 — 건너뜀")
        return {}
    fails = []

    def one(r):
        try:
            return r["id"], parse_nasdaq_summary(nasdaq_json(url.format(sym=r["id"].replace(".", "%5E"))), r.get("p"))
        except Exception as e:
            fails.append(str(e)[:60])
            return r["id"], None

    out = {}
    with ThreadPoolExecutor(workers) as ex:
        for sid, f in ex.map(one, us):
            if f and any(v is not None for v in f.values()):
                out[sid] = dict(f, fs="Q")
    log(f"  나스닥 요약: {len(out)}/{len(us)}종목 (실패 {len(fails)}{', 예: ' + fails[0] if fails else ''})")
    return out


def nasdaq_earnings(today: dt.date, days: int = 21) -> dict[str, str]:
    """나스닥 실적 캘린더 — 날짜 하나에 그날 발표하는 미국 회사 전부가 온다."""
    out: dict[str, str] = {}
    for k in range(days):
        d = today + dt.timedelta(days=k)
        if d.weekday() >= 5:
            continue
        try:
            j = nasdaq_json(f"https://api.nasdaq.com/api/calendar/earnings?date={d.isoformat()}")
        except Exception as e:
            log(f"  나스닥 실적 캘린더 {d}: {str(e)[:80]} — 중단")
            break
        for row in ((j.get("data") or {}).get("rows") or []):
            sym = str(row.get("symbol", "")).strip().upper().replace("/", ".").replace("^", ".")
            if sym and sym not in out:
                out[sym] = d.isoformat()
        time.sleep(0.3)
    log(f"  나스닥 실적 캘린더: {len(out)}종목")
    return out


def fundamentals(rows: list[dict], today: dt.date, kr_asof: dt.date | None) -> tuple[dict[str, dict], dict]:
    """출처를 겹쳐 쓴다. 한국은 거래소 값을 우선하고, 미국은 Yahoo(최근 4분기)가 되면 그것을,
    안 되면 SEC(최근 회계연도)를 쓴다. 실적일·애널리스트 의견은 Yahoo 에서만 나온다."""
    y = yahoo_fund(rows, today)
    log(f"  Yahoo {len(y)}종목")
    q = {} if len(y) >= 1000 else nasdaq_fund(rows)
    s = sec_fund(rows, today)
    log(f"  SEC {len(s)}종목")
    if not y and not q and len(s) < 1000:  # 미국 쪽이 다 막히면 네이버 해외주식으로 채운다
        for sid, f in naver_us_fund(rows).items():
            s.setdefault(sid, f)
    n_sec = sum(1 for f in s.values() if f.get("fs") == "S")
    # 미국 우선순위: Yahoo > 나스닥 > SEC/네이버. 앞 출처에 없는 칸만 뒤 출처로 채운다
    for sid, f in q.items():
        base = s.get(sid, {})
        s[sid] = dict(base, **{kk: v for kk, v in f.items() if v is not None})
    ern = nasdaq_earnings(today)
    k = krx_fund(kr_asof) or naver_fund(rows)
    out: dict[str, dict] = {}
    for sid, f in s.items():
        out[sid] = dict(f)
    for sid, f in y.items():
        cur = out.setdefault(sid, {})
        if sid in k:  # 한국: 가격 지표는 거래소 값, Yahoo 는 실적일·의견만
            cur.update({kk: f[kk] for kk in ("ern", "ar", "fpe") if f.get(kk) is not None})
        else:
            cur.update({kk: v for kk, v in f.items() if v is not None})
    for sid, f in k.items():
        out.setdefault(sid, {}).update({kk: v for kk, v in f.items() if v is not None})
    for sid, d in ern.items():  # 실적일은 나스닥 캘린더가 더 정확하다(Yahoo 가 막힌 날에도 나온다)
        out.setdefault(sid, {})["ern"] = d
    counts = {"Y": len(y), "Q": len(q), "E": len(ern), "S": n_sec,
              "K": sum(1 for f in k.values() if f.get("fs") == "K"),
              "N": sum(1 for f in list(k.values()) + list(s.values()) if f.get("fs") == "N")}
    return out, counts


# --------------------------------------------------------------------------- 지수 · 베타
INDICES = [("^KS11", "코스피", "KR"), ("^KQ11", "코스닥", "KR"), ("^GSPC", "S&P 500", "US"),
           ("^IXIC", "나스닥 종합", "US"), ("^DJI", "다우존스", "US"), ("^VIX", "VIX 공포지수", "US")]


def index_history() -> dict[str, dict]:
    try:
        import yfinance as yf
        df = yf.download([s for s, _, _ in INDICES], period="14mo", interval="1d", auto_adjust=True,
                         group_by="ticker", threads=True, progress=False)
    except Exception as e:
        log(f"  지수 실패: {str(e)[:100]}")
        return {}
    out = {}
    for sym, _, _ in INDICES:
        try:
            sub = df[sym].dropna(subset=["Close"])
        except Exception:
            continue
        if len(sub) > 20:
            c = sub["Close"].to_numpy(dtype=float)
            v = sub["Volume"].fillna(0).to_numpy(dtype=float)
            out[sym] = {"dates": [d.date() for d in sub.index], "close": c, "vol": v, "val": c * v}
    return out


def index_meta(idx: dict[str, dict], prev: list) -> list:
    """첫 화면 지수 칸. 못 받은 지수는 이전 값을 그대로 둔다."""
    old = {x["s"]: x for x in prev or []}
    out = []
    for sym, name, g in INDICES:
        h = idx.get(sym)
        if h is None:
            if sym in old:
                out.append(old[sym])
            continue
        m = metrics(h)
        out.append({"s": sym, "n": name, "g": g, "p": rnd(float(h["close"][-1]), 2),
                    **{k: rnd(m.get(k), 2 if k == "d1h" else 1) for k in ("d1h", "r5", "r21", "r252", "ytd", "fh")},
                    "sp": m.get("sp", ""), "spl": rnd(m.get("spl"), 2), "sph": rnd(m.get("sph"), 2), "asof": m.get("asof")})
    return out


def beta(h: dict, ih: dict | None, days: int = 252) -> float | None:
    """1년 일간 수익률로 본 베타 = 공분산(종목, 지수) ÷ 분산(지수). 날짜가 겹치는 날만 쓴다."""
    if not ih:
        return None
    ix = dict(zip(ih["dates"], ih["close"]))
    pairs = [(c, ix[d]) for d, c in zip(h["dates"][-days - 1:], h["close"][-days - 1:]) if d in ix]
    if len(pairs) < 60:
        return None
    a = np.array(pairs, dtype=float)
    if (a <= 0).any():
        return None
    rs, ri = np.diff(np.log(a[:, 0])), np.diff(np.log(a[:, 1]))
    var = ri.var()
    if var <= 0:
        return None
    b = float(np.cov(rs, ri, bias=True)[0, 1] / var)
    return b if -3 < b < 6 else None


def bench_for(r: dict) -> str:
    return "^GSPC" if r["g"] == "US" else "^KS11" if r["m"] == "KOSPI" else "^KQ11"


# --------------------------------------------------------------------------- 환율
def fx_rate(us_rows, kr_rows, prev_meta, today: dt.date) -> tuple[float | None, str, str | None]:
    """원/달러와 그 출처, 실측 날짜."""
    try:
        import yfinance as yf
        h = yf.Ticker("KRW=X").history(period="5d")
        if len(h):
            return float(h["Close"].iloc[-1]), "Yahoo KRW=X", today.isoformat()
    except Exception as e:
        log(f"  환율(Yahoo) 실패: {str(e)[:120]}")
    # 일주일 안의 실측값이 있으면 그것을 쓴다 — ADR 은 원주보다 프리미엄이 붙어 추정이 몇 % 빗나간다
    at = prev_meta.get("fxAt")
    if prev_meta.get("fx") and at and (today - dt.date.fromisoformat(at)).days <= 7:
        return prev_meta["fx"], f"Yahoo KRW=X({at} 값)", at
    us = {r["id"]: r for r in us_rows}
    kr = {r["id"]: r for r in kr_rows}
    pairs = [("KB", "105560", 1), ("SHG", "055550", 1)]  # ADR 1주 = 원주 1주
    est = [kr[c]["p"] * k / us[a]["p"] for a, c, k in pairs
           if a in us and c in kr and us[a].get("p") and kr[c].get("p")]
    if est:
        return float(np.median(est)), "KB금융·신한지주 ADR/원주 종가 비율(추정)", None
    return prev_meta.get("fx"), prev_meta.get("fxSrc", ""), at


# --------------------------------------------------------------------------- 출력
COLS = ["id", "m", "n", "ko", "sec", "ind", "cty", "ipo", "p", "d1", "mc", "mcu",
        "r5", "r21", "r63", "r126", "r252", "ytd", "fh", "fl", "h52", "l52", "pm50", "pm200",
        "x", "up", "rsi", "vol", "mdd", "tv", "vs", "sm", "st", "ss", "sl",
        "sp", "spl", "sph", "nd", "asof", "warn", "prod",
        "pe", "fpe", "pb", "dy", "eps", "roe", "ern", "ar", "fs", "tgt", "beta"]


def rnd(v, k):
    if v is None or (isinstance(v, float) and not math.isfinite(v)):
        return None
    return round(float(v), k)


def price_round(v, grp):
    if v is None:
        return None
    if grp == "KR":
        return int(round(v))
    return round(v, 4 if abs(v) < 1 else 2)


def to_row(r: dict) -> list:
    g = r["g"]
    fx = r.get("_fx") or 0
    out = {
        "id": r["id"], "m": r["m"], "n": r["n"], "ko": r.get("ko") or "",
        "sec": r.get("sec") or "", "ind": r.get("ind") or "", "cty": r.get("cty") or "",
        "ipo": r.get("ipo"), "p": price_round(r.get("p"), g), "d1": rnd(r.get("d1"), 2),
        # 시총: 원래 통화 백만 단위 · mcu 는 비교용 달러 백만
        "mc": int(round(r["mc"] / 1e6)) if r.get("mc") else None,
        "mcu": (int(round(r["mc"] / 1e6 / (fx if g == "KR" else 1)))
                if r.get("mc") and (g == "US" or fx) else None),
    }
    for k in ("r5", "r21", "r63", "r126", "r252", "ytd", "fh", "fl", "pm50", "pm200", "vol", "mdd"):
        out[k] = rnd(r.get(k), 1)
    out["h52"], out["l52"] = price_round(r.get("h52"), g), price_round(r.get("l52"), g)
    out["x"], out["up"] = r.get("x", ""), r.get("up")
    out["rsi"] = rnd(r.get("rsi"), 0)
    out["tv"] = int(round(r["tv"] / 1e6)) if r.get("tv") else None  # 백만 단위
    out["vs"] = rnd(r.get("vs"), 2)
    for k in ("sm", "st", "ss", "sl"):
        out[k] = int(round(r[k])) if r.get(k) is not None else None
    out["sp"] = r.get("sp") or ""
    out["spl"], out["sph"] = price_round(r.get("spl"), g), price_round(r.get("sph"), g)
    out["nd"] = r.get("nd")
    out["asof"] = r.get("asof") or ""
    out["warn"] = r.get("warn") or 0
    out["prod"] = r.get("prod") or ""
    for k in ("pe", "fpe", "pb", "dy", "roe"):
        out[k] = rnd(r.get(k), 1 if k != "pb" else 2)
    out["eps"] = rnd(r.get("eps"), 2 if g == "US" else 0)
    out["ern"] = r.get("ern") or ""
    out["ar"] = rnd(r.get("ar"), 1)
    out["fs"] = r.get("fs") or ""
    out["tgt"] = price_round(r.get("tgt"), g)
    out["beta"] = rnd(r.get("beta"), 2)
    return [out[c] for c in COLS]


def from_prev(v: dict) -> dict:
    """이전 파일의 행(출력 단위)을 계산 단위로 되돌린다 — 시총·거래대금은 백만 단위로 저장돼 있다."""
    r = dict(v)
    for k in ("mc", "tv"):
        if r.get(k) is not None:
            r[k] = r[k] * 1e6
    return r


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(DATA, "stocks.json"))
    ap.add_argument("--us-dir"); ap.add_argument("--kr-dir")
    ap.add_argument("--no-us-history", action="store_true")
    ap.add_argument("--no-kind", action="store_true")
    ap.add_argument("--no-fund", action="store_true", help="재무 지표 생략(이전 값 유지)")
    ap.add_argument("--us-limit", type=int, default=0, help="시총 상위 N개만 일봉을 받는다(0=전부)")
    ap.add_argument("--min-rows", type=int, default=0,
                    help="종목 수가 이보다 적으면 저장하지 않고 실패한다(원천 데이터가 깨졌을 때 좋은 파일을 덮지 않도록)")
    a = ap.parse_args()

    today = dt.date.today()
    prev_rows, prev_meta = {}, {}
    if os.path.exists(a.out):
        with open(a.out, encoding="utf-8") as f:
            prev = json.load(f)
        prev_meta = prev.get("meta", {})
        pc = prev_meta.get("cols", COLS)
        prev_rows = {r[0]: dict(zip(pc, r)) for r in prev.get("rows", [])}

    with open(os.path.join(HERE, "ko_alias.json"), encoding="utf-8") as f:
        ko_alias = json.load(f)

    log("미국 종목 목록")
    us = load_us_universe(a.us_dir)
    for r in us:
        r["g"] = "US"
        if r["id"] in ko_alias:
            r["ko"] = ko_alias[r["id"]]
    log(f"  {len(us)}종목")

    log("한국 시세")
    kr, kr_hist, kr_asof = load_kr(a.kr_dir, today)
    meta_kr = kr_meta(not a.no_kind)
    for r in kr:
        r["g"] = "KR"
        m = meta_kr.get(r["id"])
        if m:
            r["sec"], r["prod"] = m.get("sec", ""), m.get("prod", "")
            if m.get("lst", "").isdigit():
                r["ipo"] = int(m["lst"])
    log(f"  {len(kr)}종목 · 기준일 {kr_asof}")
    if not kr and prev_rows:
        # 한국 쪽을 못 받았으면 이전 행을 그대로 쓴다
        kr = [dict(from_prev(v), g="KR") for v in prev_rows.values() if v.get("m") in ("KOSPI", "KOSDAQ", "KONEX")]

    idx = {} if a.no_us_history else index_history()
    log(f"지수 {len(idx)}개")
    for r in kr:
        h = kr_hist.get(r["id"])
        if h is not None and len(h["close"]) >= 2:
            r.update(metrics(h))
            r["beta"] = beta(h, idx.get(bench_for(r)))

    us_hist = {}
    if not a.no_us_history:
        syms = [r["id"] for r in sorted(us, key=lambda r: -(r.get("mc") or 0))]
        if a.us_limit:
            syms = syms[:a.us_limit]
        log(f"미국 일봉 {len(syms)}종목")
        us_hist = us_history(syms)
    us_asof = None
    carry = ("r5", "r21", "r63", "r126", "r252", "ytd", "fh", "fl", "h52", "l52", "pm50", "pm200",
             "x", "up", "rsi", "vol", "mdd", "tv", "vs", "sp", "spl", "sph", "nd", "asof", "beta")
    for r in us:
        h = us_hist.get(r["id"])
        if h is not None and len(h["close"]) >= 2:
            snap_p = r.get("p")
            r.update(metrics(h))
            r["beta"] = beta(h, idx.get("^GSPC"))
            last = float(h["close"][-1])
            if snap_p and r.get("mc"):
                r["mc"] *= last / snap_p  # 스냅샷 시총을 최신 종가로 맞춘다
            r["p"] = last
            if r.get("d1h") is not None:
                r["d1"] = r["d1h"]
            us_asof = max(us_asof or h["dates"][-1], h["dates"][-1])
        else:
            # 이번에 못 받은 종목은 이전 지표를 유지한다(스냅샷 가격·등락·시총은 새 값)
            old = prev_rows.get(r["id"])
            if old:
                for k in carry:
                    if r.get(k) is None and old.get(k) not in (None, ""):
                        r[k] = old[k] * 1e6 if k == "tv" else old[k]
            if r.get("tv") is None and r.get("vol0") and r.get("p"):
                r["tv"] = r["vol0"] * r["p"]  # 일봉이 없으면 당일 거래대금으로 대신한다
    if not us_asof and prev_meta.get("usAsof"):
        us_asof = prev_meta["usAsof"]

    for r in kr:  # 지수를 못 받은 날은 한국 베타도 이전 값
        if r.get("beta") is None and prev_rows.get(r["id"], {}).get("beta") is not None:
            r["beta"] = prev_rows[r["id"]]["beta"]
    fund, fund_n = ({}, {}) if a.no_fund else (log("재무 지표") or fundamentals(us + kr, today, kr_asof))
    log(f"  재무 확보 {len(fund)}종목 {fund_n}")
    for r in us + kr:
        # 이번에 받은 칸은 새 값(없다고 온 None 포함), 아예 안 온 칸은 이전 값
        old = prev_rows.get(r["id"], {})
        f = {k: old.get(k) for k in FUND}
        f.update(fund.get(r["id"], {}))
        if f.get("ern") and f["ern"] < today.isoformat():
            f["ern"] = None
        for k in FUND:
            if f.get(k) is not None and f.get(k) != "":
                r[k] = f[k]

    fx, fx_src, fx_at = fx_rate(us, kr, prev_meta, today)
    log(f"환율 {fx} ({fx_src})")
    rows = us + kr
    for r in rows:
        r["_fx"] = fx
    scores(rows)

    out_rows = [to_row(r) for r in rows]
    mcu = COLS.index("mcu")
    out_rows.sort(key=lambda v: -(v[mcu] or 0))

    if len(out_rows) < a.min_rows or not us or not kr:
        log(f"종목 수가 너무 적습니다(미국 {len(us)} · 한국 {len(kr)}) — 저장하지 않습니다.")
        sys.exit(1)

    meta = {
        "built": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
        "usAsof": us_asof.isoformat() if isinstance(us_asof, dt.date) else us_asof,
        "krAsof": kr_asof.isoformat() if kr_asof else prev_meta.get("krAsof"),
        "fx": rnd(fx, 2) if fx else None, "fxSrc": fx_src, "fxAt": fx_at,
        "counts": {"US": len(us), "KR": len(kr)},
        "fundN": len(fund) or prev_meta.get("fundN", 0), "fundSrc": fund_n or prev_meta.get("fundSrc", {}),
        "fundAt": (dt.date.today().isoformat() if fund else prev_meta.get("fundAt")),
        "idx": index_meta(idx, prev_meta.get("idx")),
        "cols": COLS,
    }
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as f:
        f.write('{"meta":' + json.dumps(meta, ensure_ascii=False, separators=(",", ":")) + ',"rows":[\n')
        f.write(",\n".join(json.dumps(v, ensure_ascii=False, separators=(",", ":")) for v in out_rows))
        f.write("\n]}\n")
    log(f"저장: {a.out} ({os.path.getsize(a.out) / 1e6:.2f} MB, {len(out_rows)}종목)")


if __name__ == "__main__":
    main()
