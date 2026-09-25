#!/usr/bin/env python3
"""data/stocks.json 검사. 커밋 전에 돌려 깨진 파일이 배포되지 않게 한다.

실패(종료 코드 1): 구조가 틀렸거나, 종목이 너무 적거나, 값이 말이 안 될 때
경고(종료 코드 0): 데이터가 오래됐거나 재무 지표 비율이 낮을 때 — 페이지는 그대로 쓸 수 있다
"""
from __future__ import annotations

import datetime as dt
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REQUIRED = ["id", "m", "n", "p", "d1", "mc", "mcu", "r252", "rsi", "sp", "spl", "sph", "nd", "pe", "pb", "dy"]
MARKETS = {"NASDAQ", "NYSE", "AMEX", "CBOE", "KOSPI", "KOSDAQ", "KONEX"}


def check(path: str, min_rows: int = 5000, stale_days: int = 5, today: dt.date | None = None):
    errors, warns = [], []
    with open(path, encoding="utf-8") as f:
        d = json.load(f)
    meta, rows = d.get("meta", {}), d.get("rows", [])
    cols = meta.get("cols", [])
    miss = [c for c in REQUIRED if c not in cols]
    if miss:
        errors.append(f"필수 열 없음: {miss}")
        return errors, warns
    if len(rows) < min_rows:
        errors.append(f"종목 수 {len(rows)} < {min_rows}")
    ix = {c: i for i, c in enumerate(cols)}
    ids, bad = set(), 0
    for v in rows:
        if len(v) != len(cols):
            errors.append(f"열 개수 불일치: {v[:2]}"); break
        i = v[ix["id"]]
        if i in ids:
            errors.append(f"중복 종목: {i}")
        ids.add(i)
        if v[ix["m"]] not in MARKETS:
            errors.append(f"알 수 없는 시장 {v[ix['m']]}: {i}")
        p = v[ix["p"]]
        if p is not None and (not isinstance(p, (int, float)) or p <= 0 or not math.isfinite(p)):
            bad += 1
        r = v[ix["rsi"]]
        if r is not None and not 0 <= r <= 100:
            errors.append(f"RSI 범위 밖 {r}: {i}")
        sp = v[ix["sp"]]
        if sp and (v[ix["spl"]] is None or v[ix["sph"]] is None):
            errors.append(f"스파크라인 범위 없음: {i}")
    if bad > len(rows) * 0.01:
        errors.append(f"가격이 이상한 종목 {bad}개")
    by_g = {"US": [], "KR": []}
    etfs = {"US": 0, "KR": 0}
    for v in rows:
        g = "KR" if v[ix["m"]] in ("KOSPI", "KOSDAQ", "KONEX") else "US"
        if "ty" in ix and v[ix["ty"]] == "E":  # ETF 는 재무 지표가 없어 주식 비율 검사에서 뺀다
            etfs[g] += 1
        else:
            by_g[g].append(v)
    if "ty" in ix:
        for g, n in etfs.items():
            if n < 100:
                warns.append(f"{g} ETF {n}개 — 목록을 못 받았을 수 있습니다")
    for g, rs in by_g.items():
        if not rs:
            errors.append(f"{g} 종목이 없음"); continue
        hist = sum(1 for v in rs if v[ix["nd"]]) / len(rs)
        if hist < 0.8:
            warns.append(f"{g} 일봉 보유 비율 {hist:.0%}")
        fk = [ix[k] for k in ("pe", "pb", "dy", "tgt") if k in ix]
        fund = sum(1 for v in rs if any(v[i] is not None for i in fk)) / len(rs)
        if fund < 0.3:
            warns.append(f"{g} 재무 지표 보유 비율 {fund:.0%}")
    today = today or dt.date.today()
    for k in ("usAsof", "krAsof"):
        s = meta.get(k)
        if not s:
            warns.append(f"{k} 없음"); continue
        age = (today - dt.date.fromisoformat(s)).days
        if age > stale_days:
            warns.append(f"{k} {s} — {age}일 지남")
    return errors, warns


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "data", "stocks.json")
    errors, warns = check(path)
    for w in warns:
        print(f"::warning::{w}")
    for e in errors:
        print(f"::error::{e}")
    print(f"검사: 오류 {len(errors)} · 경고 {len(warns)}")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
