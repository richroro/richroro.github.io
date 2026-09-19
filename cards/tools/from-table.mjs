// Turn a pasted ranking table into a content JSON for infographic.mjs.
//
//   node cards/tools/from-table.mjs table.txt 0019-marketcap "시가총액 상위 10" > out.json
//
// Each line is: 이름 <tab or 2+ spaces> 값 [<tab> 보조설명]
// The value's leading number drives the bar length; everything else is
// printed as written, so units and formatting stay under your control.
import { readFileSync } from 'node:fs';

const [file, slug, title] = process.argv.slice(2);
if (!file || !slug) {
  console.error('usage: node cards/tools/from-table.mjs <table.txt> <slug> [title]');
  process.exit(1);
}

const rows = readFileSync(file, 'utf8')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'))
  .map((line, i) => {
    const [label, value, sub = ''] = line.split(/\t+|\s{2,}/).map((c) => c.trim());
    if (!label || !value) throw new Error(`line ${i + 1} needs a name and a value: ${line}`);
    const n = Number(value.replace(/[^\d.]/g, ''));
    if (!Number.isFinite(n) || n <= 0) throw new Error(`line ${i + 1} has no usable number: ${value}`);
    return { rank: i + 1, label, sub, mid: '', price: value, _v: n };
  });

const max = Math.max(...rows.map((r) => r._v));
for (const r of rows) { r.bar = Number((r._v / max).toFixed(4)); delete r._v; }

process.stdout.write(JSON.stringify({
  slug,
  rowType: 'rank',
  icons: 'coin',
  badge: ['숫자로 보는', '시장'],
  title: (title || slug).split('|').map((s) => s.trim()),
  subtitle: '기준일을 반드시 적어주세요',
  head: { left: '', right: '' },
  rows,
  note: ['기준일: (YYYY년 M월 D일 종가)', '출처: (KRX / 네이버 금융 등)',
         '시가총액은 매일 바뀝니다. 위 순위는 기준일 시점의 값입니다.'],
  closing: ['', ''],
  brand: '삶의 문장 노트',
}, null, 2) + '\n');
