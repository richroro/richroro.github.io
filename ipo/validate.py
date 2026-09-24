#!/usr/bin/env python3
"""data/ipo.json 검사. 커밋 전에 돌려 깨진 파일이 배포되지 않게 한다.

실패(종료 코드 1): 구조가 틀렸거나, 종목이 너무 적거나, 값이 말이 안 될 때
경고(종료 코드 0): 데이터가 오래됐거나 비어 있을 때 — 페이지는 그대로 열린다
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATE_FIELDS = ["fc_start", "fc_end", "sub_start", "sub_end", "refund", "list_date"]
ISO = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def check(path: str, min_items: int = 5, stale_days: int = 3, today: dt.date | None = None):
    errors, warns = [], []
    today = today or dt.date.today()
    with open(path, encoding="utf-8") as f:
        d = json.load(f)
    items = d.get("items")
    if not isinstance(items, list):
        return ["items 가 목록이 아님"], warns
    if len(items) < min_items:
        errors.append(f"종목 수 {len(items)} < {min_items}")
    if not items:
        warns.append("종목이 없습니다 — 첫 자동 갱신 전이면 정상")
    ids = set()
    for it in items:
        tag = f"{it.get('name')}({it.get('id')})"
        if not it.get("id") or not it.get("name"):
            errors.append(f"id·name 없음: {tag}")
            continue
        if it["id"] in ids:
            errors.append(f"중복 id: {tag}")
        ids.add(it["id"])
        for k in DATE_FIELDS:
            if k in it and not (isinstance(it[k], str) and ISO.match(it[k])):
                errors.append(f"{tag} {k} 날짜 형식: {it[k]!r}")
        if it.get("sub_start") and it.get("sub_end") and it["sub_end"] < it["sub_start"]:
            errors.append(f"{tag} 청약 끝이 시작보다 앞")
        if it.get("band_lo") and it.get("band_hi") and it["band_lo"] > it["band_hi"]:
            errors.append(f"{tag} 희망 밴드 거꾸로")
        for k in ("price", "band_lo", "band_hi", "open", "close1", "cur"):
            v = it.get(k)
            if v is not None and not (isinstance(v, int) and 100 <= v <= 10_000_000):
                errors.append(f"{tag} {k} 값 이상: {v!r}")
        if it.get("lockup") is not None and not 0 <= it["lockup"] <= 100:
            errors.append(f"{tag} 확약 비율 이상: {it['lockup']}")
        if it.get("float_pct") is not None and not 0 < it["float_pct"] <= 100:
            errors.append(f"{tag} 유통가능 비율 이상: {it['float_pct']}")
        if it.get("old_shares") and it.get("shares") and it["old_shares"] > it["shares"]:
            errors.append(f"{tag} 구주매출이 총공모주식수보다 많음")
        ua = it.get("uw_alloc")
        if ua is not None and not (isinstance(ua, list) and all(isinstance(x, list) and len(x) == 2 and isinstance(x[1], int) for x in ua)):
            errors.append(f"{tag} uw_alloc 형식: {ua!r}")
    up = d.get("updated")
    if up:
        try:
            age = (today - dt.datetime.fromisoformat(up).date()).days
            if age > stale_days:
                warns.append(f"{age}일 전 데이터")
        except ValueError:
            errors.append(f"updated 형식: {up!r}")
    return errors, warns


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("path", nargs="?", default=os.path.join(HERE, "data", "ipo.json"))
    ap.add_argument("--min-items", type=int, default=0)
    a = ap.parse_args(argv)
    errors, warns = check(a.path, min_items=a.min_items)
    for w in warns:
        print(f"경고: {w}")
    for e in errors[:30]:
        print(f"오류: {e}")
    if errors:
        return 1
    with open(a.path, encoding="utf-8") as f:
        n = len(json.load(f).get("items", []))
    print(f"ipo.json 정상 — {n}종목")
    return 0


if __name__ == "__main__":
    sys.exit(main())
