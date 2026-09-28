// 만세력 엔진·풀이 테스트 — node --test saju/tests/engine.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const M = require('../manseryeok.js');
const I = require('../interpret.js');

function minutes(a) { return Date.UTC(a.y, a.m - 1, a.d, a.h, a.mi) / 60000; }

test('절기 시각이 한국천문연구원 발표와 1분 안으로 맞는다', () => {
  const known = [
    [2024, '입춘', { y: 2024, m: 2, d: 4, h: 17, mi: 27 }],
    [2025, '입춘', { y: 2025, m: 2, d: 3, h: 23, mi: 10 }],
    [2026, '입춘', { y: 2026, m: 2, d: 4, h: 5, mi: 2 }],
    [2000, '동지', { y: 2000, m: 12, d: 21, h: 22, mi: 37 }],
  ];
  for (const [y, name, at] of known) {
    const t = M.solarTerms(y).find((x) => x.name === name);
    assert.ok(Math.abs(minutes(t.at) - minutes(at)) <= 1, y + ' ' + name + ' ' + JSON.stringify(t.at));
  }
});

test('음력 설·추석과 윤달', () => {
  assert.deepStrictEqual(M.lunarToSolar(2024, 1, 1), { y: 2024, m: 2, d: 10 });
  assert.deepStrictEqual(M.lunarToSolar(2026, 1, 1), { y: 2026, m: 2, d: 17 });
  assert.deepStrictEqual(M.lunarToSolar(2026, 8, 15), { y: 2026, m: 9, d: 25 });
  assert.deepStrictEqual(M.lunarToSolar(2023, 2, 1, true), { y: 2023, m: 3, d: 22 });
  const leaps = { 2020: 4, 2023: 2, 2025: 6, 2028: 5, 2033: 11, 2034: 0 };
  for (const y in leaps) assert.strictEqual(M.leapMonthOf(+y), leaps[y], String(y));
  assert.strictEqual(M.lunarToSolar(2024, 3, 1, true), null);
});

test('양력 ↔ 음력 왕복 변환이 1900–2100 모든 날짜에서 일치한다', () => {
  for (let dn = M.dayNumber(1900, 3, 1); dn < M.dayNumber(2100, 11, 1); dn++) {
    const s = M.jdToCivil(dn, 0);
    const l = M.solarToLunar(s.y, s.m, s.d);
    const back = M.lunarToSolar(l.year, l.month, l.day, l.leap);
    assert.deepStrictEqual(back, { y: s.y, m: s.m, d: s.d });
  }
});

test('일진 기준점', () => {
  assert.strictEqual(M.dayGanji(M.dayNumber(2000, 1, 1)).hanja, '戊午');
  assert.strictEqual(M.dayGanji(M.dayNumber(1984, 1, 31)).hanja, '甲子');
});

// lunar-javascript(6tail) 八字와 같은 조건(동경 120° 기준 시각, 야자시)에서 뽑은 값
const FIXTURES = [[2004,1,27,0,20,"癸未 乙丑 甲辰 丙子"],[2054,9,27,0,56,"甲戌 癸酉 庚午 戊子"],[2060,1,6,16,40,"己卯 丁丑 戊寅 庚申"],[2040,1,3,0,4,"己未 丙子 己丑 丙子"],[2030,5,19,8,36,"庚戌 辛巳 甲寅 戊辰"],[2010,1,8,0,40,"己丑 丁丑 丁巳 壬子"],[1996,9,25,8,4,"丙子 丁酉 乙丑 庚辰"],[1970,9,3,16,52,"庚戌 甲申 丙戌 丙申"],[1976,1,5,16,48,"乙卯 戊子 丙辰 丙申"],[2084,1,25,8,36,"癸卯 乙丑 癸卯 丙辰"],[2022,5,11,16,12,"壬寅 乙巳 甲子 壬申"],[2040,1,21,16,20,"己未 丁丑 戊申 庚申"],[2034,5,26,8,52,"甲寅 己巳 壬午 甲辰"],[2000,5,2,8,52,"庚辰 庚辰 庚申 庚辰"],[2066,1,5,0,20,"乙酉 戊子 戊申 甲子"],[1974,5,25,16,12,"甲寅 己巳 丙寅 丙申"],[2016,1,18,0,4,"乙未 己丑 戊戌 甲子"],[1974,1,8,16,16,"癸丑 乙丑 己酉 壬申"],[2078,1,14,0,16,"丁酉 癸丑 庚申 戊子"],[1994,1,18,0,16,"癸酉 乙丑 癸卯 甲子"],[2022,1,5,0,12,"辛丑 庚子 丁巳 壬子"],[2093,1,28,16,40,"壬子 癸丑 甲午 壬申"],[2002,5,28,8,36,"壬午 乙巳 丙申 壬辰"],[1984,9,23,0,16,"甲子 癸酉 己未 丙子"],[2096,9,1,16,44,"丙辰 丙申 丙戌 丙申"],[2016,9,19,8,28,"丙申 丁酉 甲辰 戊辰"],[2010,9,21,0,8,"庚寅 乙酉 癸酉 甲子"],[2014,9,21,16,20,"甲午 癸酉 乙未 甲申"],[2056,5,8,16,52,"丙子 癸巳 庚申 甲申"],[2062,9,13,0,20,"壬午 己酉 戊戌 甲子"],[2076,1,11,16,4,"乙未 己丑 丁未 戊申"],[2046,9,3,0,12,"丙寅 丙申 甲子 丙子"],[1968,5,11,8,36,"戊申 丁巳 辛巳 壬辰"],[2036,5,19,16,28,"丙辰 癸巳 丙戌 丙申"],[2050,5,31,16,44,"庚午 辛巳 辛亥 丙申"],[2068,5,27,0,36,"戊子 丁巳 辛巳 庚子"],[1974,1,14,8,44,"癸丑 乙丑 乙卯 庚辰"],[2022,9,1,8,24,"壬寅 戊申 丁巳 甲辰"],[2030,9,19,8,56,"庚戌 乙酉 丁巳 甲辰"],[2076,5,5,8,44,"丙申 癸巳 壬寅 甲辰"]];

test('사주 네 기둥이 참조 구현과 일치한다', () => {
  for (const [y, m, d, h, mi, want] of FIXTURES) {
    const r = M.compute({ year: y, month: m, day: d, hour: h, minute: mi, timeMode: 'longitude', longitude: 120, jasi: 'yajasi' });
    const got = ['year', 'month', 'day', 'hour'].map((k) => r.pillars[k].hanja).join(' ');
    assert.strictEqual(got, want, [y, m, d, h, mi].join('-'));
  }
});

test('입춘 직전·직후로 연주와 월주가 바뀐다', () => {
  const before = M.compute({ year: 2024, month: 2, day: 4, hour: 17, minute: 20, timeMode: 'none' });
  const after = M.compute({ year: 2024, month: 2, day: 4, hour: 17, minute: 35, timeMode: 'none' });
  assert.strictEqual(before.pillars.year.hanja, '癸卯');
  assert.strictEqual(before.pillars.month.hanja, '乙丑');
  assert.strictEqual(after.pillars.year.hanja, '甲辰');
  assert.strictEqual(after.pillars.month.hanja, '丙寅');
});

test('서머타임·경도 보정·자시 규칙', () => {
  const r = M.compute({ year: 1987, month: 7, day: 1, hour: 10, minute: 0 });
  assert.strictEqual(r.dst, true);
  assert.deepStrictEqual([r.local.h, r.local.mi], [8, 28]);
  // 서울 00:10 → 보정 23:38(전날). 23시 변경이면 일주는 달력 날짜 그대로
  const split = M.compute({ year: 2020, month: 5, day: 10, hour: 0, minute: 10 });
  assert.strictEqual(split.pillars.day.hanja, M.dayGanji(M.dayNumber(2020, 5, 10)).hanja);
  assert.strictEqual(split.pillars.hour.branch, 0);
  const ya = M.compute({ year: 2020, month: 5, day: 10, hour: 0, minute: 10, jasi: 'yajasi' });
  assert.strictEqual(ya.pillars.day.hanja, M.dayGanji(M.dayNumber(2020, 5, 9)).hanja);
  assert.strictEqual(ya.pillars.hour.hanja, split.pillars.hour.hanja);
  const unknown = M.compute({ year: 2020, month: 5, day: 10, hour: null });
  assert.strictEqual(unknown.pillars.hour, null);
});

test('대운 방향과 대운수', () => {
  // 양년(甲辰) 남자는 순행, 여자는 역행
  const m = M.compute({ year: 2024, month: 3, day: 1, hour: 12, minute: 0, gender: 'M' });
  const f = M.compute({ year: 2024, month: 3, day: 1, hour: 12, minute: 0, gender: 'F' });
  assert.strictEqual(m.daeun.forward, true);
  assert.strictEqual(f.daeun.forward, false);
  assert.strictEqual(m.daeun.list[0].ganji.hanja, '丁卯');
  assert.strictEqual(f.daeun.list[0].ganji.hanja, '乙丑');
  assert.ok(m.daeun.startAge >= 1 && m.daeun.startAge <= 10);
});

test('풀이가 모든 항목을 채운다', () => {
  for (const [y, m, d, h, mi] of FIXTURES.slice(0, 20)) {
    for (const gender of ['M', 'F']) {
      const A = I.analyze(M.compute({ year: y, month: m, day: d, hour: h, minute: mi, gender }), { refYear: 2026 });
      assert.strictEqual(Math.round(A.powerPct.reduce((a, b) => a + b, 0)), 100);
      assert.ok(['극신약', '신약', '중화', '신강', '극신강'].includes(A.strength));
      assert.ok(A.yongsin.el >= 0 && A.yongsin.el < 5);
      for (const k of ['personality', 'love', 'career', 'wealth']) {
        assert.ok(A.reports[k].paragraphs.length >= 3, k);
        for (const p of A.reports[k].paragraphs) assert.ok(!/undefined|NaN|null/.test(p), p);
      }
      assert.strictEqual(A.daeun.length, 10);
      assert.strictEqual(A.seun[0].ganji.hanja, '丙午');
    }
  }
});
