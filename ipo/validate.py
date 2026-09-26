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


MARKETS = {"KOSPI", "KOSDAQ", "KONEX"}
NUM_FIELDS = ["band_lo", "band_hi", "price", "amount", "shares", "post_shares", "old_shares", "float_pct",
              "inst_comp", "lockup", "sub_comp", "prop_comp", "open", "close1", "cur"]
HANGUL = re.compile(r"[가-힣]")


def check(path: str, min_items: int = 5, stale_days: int = 3, today: dt.date | None = None, prev_path: str | None = None):
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
        # 일정 순서: 수요예측 ≤ 청약 ≤ 환불 ≤ 상장
        order = [("fc_end", "sub_start", "수요예측이 청약보다 늦음"), ("sub_end", "refund", "환불이 청약 끝보다 앞"),
                 ("sub_end", "list_date", "상장이 청약 끝보다 앞"), ("fc_start", "fc_end", "수요예측 끝이 시작보다 앞")]
        for a, b, msg in order:
            if it.get(a) and it.get(b) and isinstance(it[a], str) and isinstance(it[b], str) and it[b] < it[a]:
                errors.append(f"{tag} {msg}")
        for k in NUM_FIELDS:
            if k in it and (isinstance(it[k], bool) or not isinstance(it[k], (int, float)) or it[k] < 0):
                errors.append(f"{tag} {k} 숫자가 아님/음수: {it[k]!r}")
        if "spac" in it and not isinstance(it["spac"], bool):
            errors.append(f"{tag} spac 가 참/거짓이 아님: {it['spac']!r}")
        if it.get("market") is not None and it["market"] not in MARKETS:
            errors.append(f"{tag} 시장 값 이상: {it['market']!r}")
        if it.get("sector") is not None and not HANGUL.search(str(it["sector"])):
            errors.append(f"{tag} 업종 값 이상: {it['sector']!r}")
        # 상장 첫날 가격은 공모가의 60%~400% (2023-06 이후) — 조금 넉넉히
        p = it.get("price")
        if isinstance(p, (int, float)) and p > 0 and not it.get("spac"):
            for k in ("open", "close1"):
                v = it.get(k)
                if isinstance(v, (int, float)) and not 0.55 <= v / p <= 4.05:
                    errors.append(f"{tag} {k} 가 공모가의 {v / p:.2f}배 — 60%~400% 밖")
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
    # 기업 분석(corp.json) — 없어도 된다. 있으면 모양만 본다
    cpath = os.path.join(os.path.dirname(path), "corp.json")
    if os.path.exists(cpath):
        try:
            with open(cpath, encoding="utf-8") as f:
                corp = json.load(f).get("items")
            if not isinstance(corp, dict):
                errors.append("corp.json items 가 사전이 아님")
                corp = {}
        except ValueError as e:
            errors.append(f"corp.json 을 읽지 못함: {e}")
            corp = {}
        for cid, c in corp.items():
            tag = f"corp.json {cid}"
            if cid not in ids:
                warns.append(f"{tag}: ipo.json 에 없는 종목")
            if not isinstance(c, dict):
                errors.append(f"{tag} 형식: {type(c).__name__}")
                continue
            for k in ("biz", "ceo", "kind", "addr", "web", "holder"):
                if k in c and not isinstance(c[k], str):
                    errors.append(f"{tag} {k} 가 글자가 아님")
            for k in ("g", "v", "fy", "r", "own", "dem", "otc", "mix", "peers"):
                if k in c and not isinstance(c[k], dict):
                    errors.append(f"{tag} {k} 형식")
    up = d.get("updated")
    if items and not up:
        errors.append("종목은 있는데 updated 가 없음")
    # 직전에 커밋된 파일보다 종목이 20% 넘게 줄면 수집이 부서진 것
    if prev_path:
        try:
            with open(prev_path, encoding="utf-8") as f:
                n_prev = len(json.load(f).get("items", []))
            if n_prev >= 10 and len(items) < n_prev * 0.8:
                errors.append(f"종목 수가 {n_prev} → {len(items)} 로 20% 넘게 줄었음")
        except (OSError, ValueError):
            warns.append("이전 파일을 읽지 못해 종목 수 비교를 건너뜀")
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
    ap.add_argument("--prev", help="직전 커밋의 ipo.json — 종목 수가 크게 줄면 실패")
    a = ap.parse_args(argv)
    errors, warns = check(a.path, min_items=a.min_items, prev_path=a.prev)
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
