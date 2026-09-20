#!/usr/bin/env python3
"""Check each card's internal consistency.

    python3 cards/tools/factcheck.py

Two mistakes kept recurring and neither is visible by reading the card:

1. A bar drawn from the reciprocal of what the row prints, so a shorter wait
   got a longer bar. The bar must rank the rows the same way the printed
   figures do.
2. A number in the footer or the closing line that is a rounding away from the
   row it refers to - 2,739 against a row saying 2,738.

Both are caught by comparing the card against itself, which needs no network.
"""
import json
import re
import sys
from pathlib import Path

CONTENT = Path('cards/tools/content')


def parse(text):
    """Best-effort magnitude for a printed Korean figure."""
    t = text.replace(',', '').strip()
    m = re.search(r'([\d.]+)조\s*([\d.]+)?억?', t)
    if m:
        return float(m.group(1)) * 1e12 + (float(m.group(2)) * 1e8 if m.group(2) else 0)
    m = re.search(r'([\d.]+)억\s*([\d.]+)?만?', t)
    if m:
        return float(m.group(1)) * 1e8 + (float(m.group(2)) * 1e4 if m.group(2) else 0)
    m = re.search(r'([\d.]+)만', t)
    if m:
        return float(m.group(1)) * 1e4
    m = re.search(r'(\d+)년\s*(\d+)\s*개월', t)
    if m:
        return int(m.group(1)) * 12 + int(m.group(2))
    m = re.search(r'(\d+)년', t)
    if m:
        return int(m.group(1)) * 12
    m = re.search(r'(\d+)개월', t)
    if m:
        return int(m.group(1))
    m = re.search(r'([\d.]+)', t)
    return float(m.group(1)) if m else None


def check(path):
    d = json.loads(path.read_text(encoding='utf-8'))
    rows = d.get('rows')
    if not isinstance(rows, list):
        return []
    out = []
    slug = d['slug']

    # --- bars are present, normalised, and rank the rows as the figures do ---
    bars = [r.get('bar') for r in rows]
    if any(b is None for b in bars):
        out.append(f'{slug}: a row has no bar')
    else:
        if abs(max(bars) - 1.0) > 0.02:
            out.append(f'{slug}: longest bar is {max(bars)}, expected 1.0')
        if min(bars) < 0:
            out.append(f'{slug}: negative bar')
        vals = [parse(r['price']) for r in rows]
        if all(v is not None for v in vals):
            # compare orderings pairwise; a reciprocal bar inverts every pair
            disagree = sum(
                1
                for i in range(len(vals))
                for j in range(i + 1, len(vals))
                if (vals[i] - vals[j]) * (bars[i] - bars[j]) < 0
            )
            pairs = len(vals) * (len(vals) - 1) // 2
            if disagree > pairs * 0.15:
                out.append(f'{slug}: bar disagrees with the printed figure in '
                           f'{disagree}/{pairs} pairs - is it an inverse?')

    # --- a figure in the prose that is a rounding away from a row ---
    row_nums = set()
    for r in rows:
        for field in ('price', 'sub', 'mid'):
            for tok in re.findall(r'[\d,]+\.?\d*', str(r.get(field, ''))):
                v = tok.replace(',', '')
                if v.replace('.', '').isdigit() and float(v) >= 100:
                    row_nums.add(float(v))
    # the YouTube title is a separate field and drifts when a figure is
    # corrected in the card but not in it - 0024, 0028, 0034 all did
    title = (d.get('youtube') or {}).get('title', '')
    prose = ' '.join(d.get('note', []) + d.get('closing', []) + [title])
    for tok in re.findall(r'[\d,]+\.?\d*', prose):
        v = tok.replace(',', '')
        if not v.replace('.', '').isdigit() or float(v) < 100:
            continue
        x = float(v)
        if x in row_nums:
            continue
        near = [n for n in row_nums if n and abs(n - x) / max(n, x) < 0.01 and n != x]
        if near:
            out.append(f'{slug}: prose says {tok} but a row says '
                       f'{near[0]:,.0f} - rounding mismatch?')
    return out


UNIT = r'(?:조|억|만)?\s*(?:원|년|개월|대|%|배)?'


def title_figures(d):
    """Title figures with no exact counterpart in the card.

    Not a failure: a title may round on purpose ('13억 7,300만원' -> '13억').
    But '4대보험으로 매달 38만원' against a card saying 404,891원 is a mistake,
    and only a person can tell the two apart. So list them and let them look.
    """
    title = (d.get('youtube') or {}).get('title', '')
    if not title:
        return []
    card = []
    for r in d.get('rows', []):
        for f in ('price', 'sub', 'mid', 'label'):
            card += re.findall(r'[\d,]+\.?\d*\s*' + UNIT, str(r.get(f, '')))
    for line in (d.get('note', []) + d.get('closing', [])
                 + d.get('title', []) + [d.get('subtitle', '')]):
        card += re.findall(r'[\d,]+\.?\d*\s*' + UNIT, line)
    mags = {m for m in (parse(c) for c in card) if m is not None}
    odd = []
    for tok in re.findall(r'[\d,]+\.?\d*\s*' + UNIT, title):
        v = parse(tok)
        if v is None or v < 100:
            continue
        if not any(abs(v - m) / max(v, m) < 1e-9 for m in mags):
            odd.append(tok.strip())
    return [f"{d['slug']}: 제목의 {t} 는 카드에 그대로 나오지 않는다" for t in odd]


def main():
    problems, advisories = [], []
    files = sorted(CONTENT.glob('0*.json'))
    for p in files:
        problems += check(p)
        advisories += title_figures(json.loads(p.read_text(encoding='utf-8')))
    print(f'{len(files)} cards checked')
    if advisories:
        print('제목 숫자 확인 (실패 아님, 눈으로 볼 것):')
        for line in advisories:
            print(f'  ~ {line}')
    if not problems:
        print('no inconsistencies found')
        return 0
    for line in problems:
        print(f'  ! {line}')
    return 1


if __name__ == '__main__':
    sys.exit(main())
