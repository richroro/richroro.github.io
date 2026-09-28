/*
 * 만세력 엔진 — 외부 데이터 표 없이 천문 계산으로 사주 원국을 세운다.
 *
 *  · 태양 황경: VSOP87 지구 급수(Meeus 부록 III 절단판) + 장동·광행차 → 절기 시각 오차 1분 안팎
 *  · 합삭(음력 초하루): Meeus 49장 신월 공식 → 오차 수 초
 *  · 음력: 동지가 든 달을 11월로 두고, 중기 없는 첫 달을 윤달로 둔다(한국천문연구원과 같은 규칙, 한국 표준시 기준)
 *  · 연주는 입춘, 월주는 12절(節), 일주는 율리우스 일수, 시주는 일간에서 세운다
 *  · 한국 표준시 변천(UTC+8:30 시기)과 서머타임을 되돌린 뒤, 출생지 경도(선택: 균시차)로 시를 보정한다
 *
 * 브라우저에서는 window.Manseryeok, Node 에서는 require() 로 쓴다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Manseryeok = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STEMS = '甲乙丙丁戊己庚辛壬癸';
  var BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
  var STEMS_KO = '갑을병정무기경신임계';
  var BRANCHES_KO = '자축인묘진사오미신유술해';
  var TERM_NAMES = ['춘분', '청명', '곡우', '입하', '소만', '망종', '하지', '소서', '대서', '입추', '처서', '백로',
    '추분', '한로', '상강', '입동', '소설', '대설', '동지', '소한', '대한', '입춘', '우수', '경칩'];

  var D2R = Math.PI / 180;
  function norm360(x) { x %= 360; return x < 0 ? x + 360 : x; }
  function mod(a, n) { return ((a % n) + n) % n; }

  // ───────────────────────── 달력 ↔ 율리우스일 ─────────────────────────
  // 그레고리력 날짜(시각 포함, 일의 소수) → 율리우스일
  function toJD(y, m, d) {
    if (m <= 2) { y -= 1; m += 12; }
    var A = Math.floor(y / 100);
    var B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
  }
  // 율리우스일 → {y,m,d(소수)}
  function fromJD(jd) {
    var z = Math.floor(jd + 0.5), f = jd + 0.5 - z;
    var alpha = Math.floor((z - 1867216.25) / 36524.25);
    var A = z + 1 + alpha - Math.floor(alpha / 4);
    var B = A + 1524, C = Math.floor((B - 122.1) / 365.25), D = Math.floor(365.25 * C);
    var E = Math.floor((B - D) / 30.6001);
    var day = B - D - Math.floor(30.6001 * E) + f;
    var m = E < 14 ? E - 1 : E - 13;
    var y = m > 2 ? C - 4716 : C - 4715;
    return { y: y, m: m, d: day };
  }
  // 정수 날짜 → 날짜 번호(자정 기준 율리우스 일수, JDN)
  function dayNumber(y, m, d) { return Math.floor(toJD(y, m, d) + 0.5); }
  function fromDayNumber(n) { var r = fromJD(n); return { y: r.y, m: r.m, d: Math.floor(r.d) }; }
  function daysInMonth(y, m) { return dayNumber(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1, 1) - dayNumber(y, m, 1); }

  // ΔT = TT − UT (초). Espenak & Meeus 다항식.
  function deltaT(year) {
    var t;
    if (year < 1860) { t = (year - 1820) / 100; return -20 + 32 * t * t; }
    if (year < 1900) { t = year - 1860; return 7.62 + 0.5737 * t - 0.251754 * t * t + 0.01680668 * t * t * t - 0.0004473624 * Math.pow(t, 4) + Math.pow(t, 5) / 233174; }
    if (year < 1920) { t = year - 1900; return -2.79 + 1.494119 * t - 0.0598939 * t * t + 0.0061966 * t * t * t - 0.000197 * Math.pow(t, 4); }
    if (year < 1941) { t = year - 1920; return 21.20 + 0.84493 * t - 0.0761 * t * t + 0.0020936 * t * t * t; }
    if (year < 1961) { t = year - 1950; return 29.07 + 0.407 * t - t * t / 233 + t * t * t / 2547; }
    if (year < 1986) { t = year - 1975; return 45.45 + 1.067 * t - t * t / 260 - t * t * t / 718; }
    if (year < 2005) { t = year - 2000; return 63.86 + 0.3345 * t - 0.060374 * t * t + 0.0017275 * t * t * t + 0.000651814 * Math.pow(t, 4) + 0.00002373599 * Math.pow(t, 5); }
    if (year < 2050) { t = year - 2000; return 62.92 + 0.32217 * t + 0.005589 * t * t; }
    if (year < 2150) { t = (year - 1820) / 100; return -20 + 32 * t * t - 0.5628 * (2150 - year); }
    t = (year - 1820) / 100; return -20 + 32 * t * t;
  }
  function jdUTtoTT(jd) { return jd + deltaT(2000 + (jd - 2451545) / 365.25) / 86400; }
  function jdTTtoUT(jd) { return jd - deltaT(2000 + (jd - 2451545) / 365.25) / 86400; }

  // ───────────────────────── 태양 황경 (VSOP87) ─────────────────────────
  // [진폭, 위상, 진동수] — 진폭 단위 1e-8 라디안
  var L0 = [[175347046, 0, 0], [3341656, 4.6692568, 6283.07585], [34894, 4.6261, 12566.1517], [3497, 2.7441, 5753.3849],
    [3418, 2.8289, 3.5231], [3136, 3.6277, 77713.7715], [2676, 4.4181, 7860.4194], [2343, 6.1352, 3930.2097],
    [1324, 0.7425, 11506.7698], [1273, 2.0371, 529.691], [1199, 1.1096, 1577.3435], [990, 5.233, 5884.927],
    [902, 2.045, 26.298], [857, 3.508, 398.149], [780, 1.179, 5223.694], [753, 2.533, 5507.553], [505, 4.583, 18849.228],
    [492, 4.205, 775.523], [357, 2.92, 0.067], [317, 5.849, 11790.629], [284, 1.899, 796.298], [271, 0.315, 10977.079],
    [243, 0.345, 5486.778], [206, 4.806, 2544.314], [205, 1.869, 5573.143], [202, 2.458, 6069.777], [156, 0.833, 213.299],
    [132, 3.411, 2942.463], [126, 1.083, 20.775], [115, 0.645, 0.98], [103, 0.636, 4694.003], [102, 0.976, 15720.839],
    [102, 4.267, 7.114], [99, 6.21, 2146.17], [98, 0.68, 155.42], [86, 5.98, 161000.69], [85, 1.3, 6275.96],
    [85, 3.67, 71430.7], [80, 1.81, 17260.15], [79, 3.04, 12036.46], [75, 1.76, 5088.63], [74, 3.5, 3154.69],
    [74, 4.68, 801.82], [70, 0.83, 9437.76], [62, 3.98, 8827.39], [61, 1.82, 7084.9], [57, 2.78, 6286.6],
    [56, 4.39, 14143.5], [56, 3.47, 6279.55], [52, 0.19, 12139.55], [52, 1.33, 1748.02], [51, 0.28, 5856.48],
    [49, 0.49, 1194.45], [41, 5.37, 8429.24], [41, 2.4, 19651.05], [39, 6.17, 10447.39], [37, 6.04, 10213.29],
    [37, 2.57, 1059.38], [36, 1.71, 2352.87], [36, 1.78, 6812.77], [33, 0.59, 17789.85], [30, 0.44, 83996.85],
    [30, 2.74, 1349.87], [25, 3.16, 4690.48]];
  var L1 = [[628331966747, 0, 0], [206059, 2.678235, 6283.07585], [4303, 2.6351, 12566.1517], [425, 1.59, 3.523],
    [119, 5.796, 26.298], [109, 2.966, 1577.344], [93, 2.59, 18849.23], [72, 1.14, 529.69], [68, 1.87, 398.15],
    [67, 4.41, 5507.55], [59, 2.89, 5223.69], [56, 2.17, 155.42], [45, 0.4, 796.3], [36, 0.47, 775.52], [29, 2.65, 7.11],
    [21, 5.34, 0.98], [19, 1.85, 5486.78], [19, 4.97, 213.3], [17, 2.99, 6275.96], [16, 0.03, 2544.31], [16, 1.43, 2146.17],
    [15, 1.21, 10977.08], [12, 2.83, 1748.02], [12, 3.26, 5088.63], [12, 5.27, 1194.45], [12, 2.08, 4694], [11, 0.77, 553.57],
    [10, 1.3, 6286.6], [10, 4.24, 1349.87], [9, 2.7, 242.73], [9, 5.64, 951.72], [8, 5.3, 2352.87], [6, 2.65, 9437.76],
    [6, 4.67, 4690.48]];
  var L2 = [[52919, 0, 0], [8720, 1.0721, 6283.0758], [309, 0.867, 12566.152], [27, 0.05, 3.52], [16, 5.19, 26.3],
    [16, 3.68, 155.42], [10, 0.76, 18849.23], [9, 2.06, 77713.77], [7, 0.83, 775.52], [5, 4.66, 1577.34], [4, 1.03, 7.11],
    [4, 3.44, 5573.14], [3, 5.14, 796.3], [3, 6.05, 5507.55], [3, 1.19, 242.73], [3, 6.12, 529.69], [3, 0.31, 398.15],
    [3, 2.28, 553.57], [2, 4.38, 5223.69], [2, 3.75, 0.98]];
  var L3 = [[289, 5.844, 6283.076], [35, 0, 0], [17, 5.49, 12566.15], [3, 5.2, 155.42], [1, 4.72, 3.52], [1, 5.3, 18849.23], [1, 5.97, 242.73]];
  var L4 = [[114, 3.142, 0], [8, 4.13, 6283.08], [1, 3.84, 12566.15]];
  var L5 = [[1, 3.14, 0]];
  var R0 = [[100013989, 0, 0], [1670700, 3.0984635, 6283.07585], [13956, 3.05525, 12566.1517], [3084, 5.1985, 77713.7715],
    [1628, 1.1739, 5753.3849], [1576, 2.8469, 7860.4194], [925, 5.453, 11506.77], [542, 4.564, 3930.21]];
  var R1 = [[103019, 1.10749, 6283.07585], [1721, 1.0644, 12566.1517]];

  function series(terms, t) {
    var s = 0;
    for (var i = 0; i < terms.length; i++) s += terms[i][0] * Math.cos(terms[i][1] + terms[i][2] * t);
    return s;
  }

  // 역학시(JDE) 기준 태양의 겉보기 황경(도)
  function sunLongitude(jde) {
    var tau = (jde - 2451545) / 365250;
    var L = (series(L0, tau) + series(L1, tau) * tau + series(L2, tau) * tau * tau + series(L3, tau) * Math.pow(tau, 3) +
      series(L4, tau) * Math.pow(tau, 4) + series(L5, tau) * Math.pow(tau, 5)) / 1e8;
    var R = (series(R0, tau) + series(R1, tau) * tau) / 1e8;
    var lon = L / D2R + 180;                       // 태양 기하 황경
    var T = tau * 10;
    lon += -0.09033 / 3600;                        // FK5 보정
    var omega = (125.04452 - 1934.136261 * T) * D2R;
    var Ls = (280.4665 + 36000.7698 * T) * D2R, Lm = (218.3165 + 481267.8813 * T) * D2R;
    var dpsi = -17.2 * Math.sin(omega) - 1.32 * Math.sin(2 * Ls) - 0.23 * Math.sin(2 * Lm) + 0.21 * Math.sin(2 * omega);
    lon += dpsi / 3600;                            // 황경 장동
    lon += -20.4898 / R / 3600;                    // 광행차
    return norm360(lon);
  }
  function sunLongitudeUT(jdUT) { return sunLongitude(jdUTtoTT(jdUT)); }

  // 태양 황경이 target 이 되는 시각(UT). guess 근처에서 뉴턴법.
  function solarTermUT(target, guessJD) {
    var jd = guessJD;
    for (var i = 0; i < 30; i++) {
      var diff = norm360(target - sunLongitudeUT(jd) + 180) - 180;
      jd += diff * 365.2422 / 360;
      if (Math.abs(diff) < 1e-7) break;
    }
    return jd;
  }
  // 해당 그레고리력 연도 안에서 황경 target 에 드는 시각(UT)
  function solarTermInYear(year, target) {
    // 춘분(0°) ≈ 3월 20일, 하루 약 0.9856° 전진
    var guess = toJD(year, 3, 20.5) + norm360(target) / 360 * 365.2422;
    if (guess > toJD(year + 1, 1, 1)) guess -= 365.2422;
    return solarTermUT(target, guess);
  }

  // ───────────────────────── 합삭 (Meeus 49장) ─────────────────────────
  function newMoonTT(k) {
    var T = k / 1236.85, T2 = T * T, T3 = T2 * T, T4 = T3 * T;
    var jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T2 - 0.00000015 * T3 + 0.00000000073 * T4;
    var E = 1 - 0.002516 * T - 0.0000074 * T2;
    var M = (2.5534 + 29.1053567 * k - 0.0000014 * T2 - 0.00000011 * T3) * D2R;
    var Mp = (201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4) * D2R;
    var F = (160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4) * D2R;
    var Om = (124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3) * D2R;
    var s = Math.sin;
    jde += -0.4072 * s(Mp) + 0.17241 * E * s(M) + 0.01608 * s(2 * Mp) + 0.01039 * s(2 * F) +
      0.00739 * E * s(Mp - M) - 0.00514 * E * s(Mp + M) + 0.00208 * E * E * s(2 * M) - 0.00111 * s(Mp - 2 * F) -
      0.00057 * s(Mp + 2 * F) + 0.00056 * E * s(2 * Mp + M) - 0.00042 * s(3 * Mp) + 0.00042 * E * s(M + 2 * F) +
      0.00038 * E * s(M - 2 * F) - 0.00024 * E * s(2 * Mp - M) - 0.00017 * s(Om) - 0.00007 * s(Mp + 2 * M) +
      0.00004 * s(2 * Mp - 2 * F) + 0.00004 * s(3 * M) + 0.00003 * s(Mp + M - 2 * F) + 0.00003 * s(2 * Mp + 2 * F) -
      0.00003 * s(Mp + M + 2 * F) + 0.00003 * s(Mp - M + 2 * F) - 0.00002 * s(Mp - M - 2 * F) - 0.00002 * s(3 * Mp + M) +
      0.00002 * s(4 * Mp);
    var A = [
      [0.000325, 299.77 + 0.107408 * k - 0.009173 * T2], [0.000165, 251.88 + 0.016321 * k], [0.000164, 251.83 + 26.651886 * k],
      [0.000126, 349.42 + 36.412478 * k], [0.00011, 84.66 + 18.206239 * k], [0.000062, 141.74 + 53.303771 * k],
      [0.00006, 207.14 + 2.453732 * k], [0.000056, 154.84 + 7.30686 * k], [0.000047, 34.52 + 27.261239 * k],
      [0.000042, 207.19 + 0.121824 * k], [0.00004, 291.34 + 1.844379 * k], [0.000037, 161.72 + 24.198154 * k],
      [0.000035, 239.56 + 25.513099 * k], [0.000023, 331.55 + 3.592518 * k]];
    for (var i = 0; i < A.length; i++) jde += A[i][0] * Math.sin(A[i][1] * D2R);
    return jde;
  }
  function newMoonUT(k) { return jdTTtoUT(newMoonTT(k)); }

  // ───────────────────────── 한국 표준시·서머타임 ─────────────────────────
  // 해당 지역 시각(벽시계, 서머타임 제외)의 UTC 오프셋(시간)
  function koreaStdOffset(y, m, d) {
    var n = y * 10000 + m * 100 + d;
    if (n < 19080401) return 8.5;       // 1908년 이전: 한성 지방시(약 +8:28)를 +8:30 으로 둔다
    if (n < 19120101) return 8.5;
    if (n < 19540321) return 9;
    if (n < 19610810) return 8.5;
    return 9;
  }
  // 서머타임 기간 [시작, 끝) — 벽시계 기준 YYYYMMDDHH
  var DST = [
    [1948060100, 1948091300], [1949040300, 1949091100], [1950040100, 1950091000], [1951050600, 1951090900],
    [1955050500, 1955090900], [1956052000, 1956093000], [1957050500, 1957092200], [1958050400, 1958092100],
    [1959050300, 1959092000], [1960050100, 1960091800], [1987051002, 1987101103], [1988050802, 1988100903]];
  function isKoreaDST(y, m, d, h) {
    var n = ((y * 100 + m) * 100 + d) * 100 + h;
    for (var i = 0; i < DST.length; i++) if (n >= DST[i][0] && n < DST[i][1]) return true;
    return false;
  }

  // 균시차(분) — 진태양시 − 평균태양시
  function equationOfTime(jdUT) {
    var T = (jdUTtoTT(jdUT) - 2451545) / 36525;
    var L0d = norm360(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
    var M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) * D2R;
    var e = 0.016708634 - 0.000042037 * T;
    var eps = (23.439291 - 0.0130042 * T) * D2R;
    var y = Math.tan(eps / 2); y *= y;
    var L = L0d * D2R;
    var E = y * Math.sin(2 * L) - 2 * e * Math.sin(M) + 4 * e * y * Math.sin(M) * Math.cos(2 * L) -
      0.5 * y * y * Math.sin(4 * L) - 1.25 * e * e * Math.sin(2 * M);
    return E / D2R * 4;
  }

  // ───────────────────────── 음력 (한국 음력 규칙) ─────────────────────────
  // 음력 계산에 쓰는 표준시 오프셋: 합삭·중기 날짜를 정하는 기준
  // 1912년 이전 음력은 시헌력(북경 기준, UTC+8)을 따른다.
  function lunarTZ(jdUT) {
    var c = fromJD(jdUT + 9 / 24);
    if (c.y < 1912) return 8;
    return koreaStdOffset(c.y, c.m, Math.floor(c.d));
  }
  function localDN(jdUT) { return Math.floor(jdUT + 0.5 + lunarTZ(jdUT) / 24); }

  // 날짜 번호 dn 이하(당일 포함)에 드는 가장 최근 합삭의 k 와 날짜 번호
  function newMoonOnOrBefore(dn) {
    var k = Math.floor((dn - 2451550.1) / 29.530588861) + 1;
    while (localDN(newMoonUT(k)) > dn) k--;
    while (localDN(newMoonUT(k + 1)) <= dn) k++;
    return k;
  }
  // 날짜 번호 dn 의 현지 자정(=그날 시작)에서의 태양 황경 구간(30° 단위)
  function majorTermSector(dn) {
    var jdMidnightUT = dn - 0.5 - 9 / 24;
    jdMidnightUT = dn - 0.5 - lunarTZ(jdMidnightUT) / 24;
    return Math.floor(sunLongitudeUT(jdMidnightUT) / 30);
  }

  var suiCache = {};
  // 세(歲) Y: Y-1년 동지가 든 달(11월)부터 Y년 동지가 든 달 직전까지의 달 목록
  function suiMonths(Y) {
    if (suiCache[Y]) return suiCache[Y];
    var ws1 = localDN(solarTermInYear(Y - 1, 270));
    var ws2 = localDN(solarTermInYear(Y, 270));
    var k1 = newMoonOnOrBefore(ws1), k2 = newMoonOnOrBefore(ws2);
    var starts = [];
    for (var k = k1; k <= k2; k++) starts.push(localDN(newMoonUT(k)));
    var n = starts.length - 1;                           // 이 세에 든 달 수(12 또는 13)
    var leapIdx = -1;
    if (n === 13) {
      for (var i = 1; i < n; i++) {
        if (majorTermSector(starts[i]) === majorTermSector(starts[i + 1])) { leapIdx = i; break; }
      }
    }
    var months = [], num = 11, yr = Y - 1;
    for (var j = 0; j < n; j++) {
      var leap = j === leapIdx;
      if (j > 0 && !leap) { num++; if (num > 12) { num = 1; yr = Y; } }
      months.push({ year: yr, month: num, leap: leap, start: starts[j], days: starts[j + 1] - starts[j] });
    }
    suiCache[Y] = months;
    return months;
  }

  // 양력 → 음력
  function solarToLunar(y, m, d) {
    var dn = dayNumber(y, m, d);
    var cands = [y, y + 1];
    for (var c = 0; c < cands.length; c++) {
      var ms = suiMonths(cands[c]);
      for (var i = 0; i < ms.length; i++) {
        if (dn >= ms[i].start && dn < ms[i].start + ms[i].days) {
          return { year: ms[i].year, month: ms[i].month, day: dn - ms[i].start + 1, leap: ms[i].leap, monthDays: ms[i].days };
        }
      }
    }
    return null;
  }
  // 음력 월 정보 찾기
  function findLunarMonth(ly, lm, leap) {
    var cands = [ly, ly + 1];
    for (var c = 0; c < cands.length; c++) {
      var ms = suiMonths(cands[c]);
      for (var i = 0; i < ms.length; i++) {
        if (ms[i].year === ly && ms[i].month === lm && ms[i].leap === !!leap) return ms[i];
      }
    }
    return null;
  }
  // 음력 → 양력. 없는 날짜(윤달이 아닌 해의 윤달, 30일이 없는 작은달)면 null
  function lunarToSolar(ly, lm, ld, leap) {
    var mo = findLunarMonth(ly, lm, leap);
    if (!mo || ld < 1 || ld > mo.days) return null;
    var r = fromDayNumber(mo.start + ld - 1);
    return { y: r.y, m: r.m, d: r.d };
  }
  function leapMonthOf(ly) {
    var cands = [ly, ly + 1];
    for (var c = 0; c < cands.length; c++) {
      var ms = suiMonths(cands[c]);
      for (var i = 0; i < ms.length; i++) if (ms[i].year === ly && ms[i].leap) return ms[i].month;
    }
    return 0;
  }
  function lunarMonthDays(ly, lm, leap) { var mo = findLunarMonth(ly, lm, leap); return mo ? mo.days : 0; }

  // ───────────────────────── 간지 ─────────────────────────
  function ganji(idx60) {
    idx60 = mod(idx60, 60);
    var s = idx60 % 10, b = idx60 % 12;
    return { idx: idx60, stem: s, branch: b, hanja: STEMS[s] + BRANCHES[b], hangul: STEMS_KO[s] + BRANCHES_KO[b] };
  }
  function ganjiFrom(stem, branch) {
    for (var i = 0; i < 60; i++) if (i % 10 === stem && i % 12 === branch) return ganji(i);
    return null;
  }
  function dayGanji(dn) { return ganji(dn + 49); }

  // 황경 → 월지 순번(0=寅월 … 11=丑월)
  function monthOrderFromLongitude(lon) { return Math.floor(norm360(lon - 315) / 30); }
  function termName(lon) { return TERM_NAMES[mod(Math.round(lon / 15), 24)]; }

  // 절(節: 황경 15°+30°k) 시각 — dir=+1 다음, −1 직전
  function adjacentJie(jdUT, dir) {
    var lon = sunLongitudeUT(jdUT);
    var target = dir > 0 ? 15 + 30 * Math.ceil((lon - 15) / 30 + 1e-9) : 15 + 30 * Math.floor((lon - 15) / 30);
    target = norm360(target);
    var guess = jdUT + norm360((target - lon) * dir) * dir * 365.2422 / 360;
    var jd = solarTermUT(target, guess);
    return { jd: jd, lon: target, name: termName(target) };
  }

  // UT 율리우스일 → 해당 오프셋 현지 달력 {y,m,d,h,mi}
  function jdToCivil(jdUT, offsetHours) {
    var c = fromJD(jdUT + offsetHours / 24);
    var d = Math.floor(c.d), frac = c.d - d;
    var totalMin = Math.round(frac * 1440);
    if (totalMin === 1440) { var nx = fromDayNumber(dayNumber(c.y, c.m, d) + 1); return { y: nx.y, m: nx.m, d: nx.d, h: 0, mi: 0 }; }
    return { y: c.y, m: c.m, d: d, h: Math.floor(totalMin / 60), mi: totalMin % 60 };
  }

  // ───────────────────────── 사주 원국 ─────────────────────────
  /*
   * opts:
   *   calendar: 'solar' | 'lunar', leap: bool
   *   year, month, day, hour, minute (hour=null 이면 시 모름)
   *   longitude: 출생지 경도(기본 126.978, 서울)
   *   timeMode: 'none'(보정 안 함) | 'longitude'(경도 보정, 기본) | 'solar'(경도+균시차=진태양시)
   *   jasi: 'split'(23시에 날짜 변경, 기본) | 'yajasi'(야자시: 23~24시는 당일 일주, 시주만 다음날 기준)
   *   gender: 'M' | 'F' (대운 방향)
   */
  function compute(opts) {
    var o = opts || {};
    var cal = o.calendar === 'lunar' ? 'lunar' : 'solar';
    var y = +o.year, m = +o.month, d = +o.day;
    if (!(y >= 1900 && y <= 2100)) throw new Error('1900~2100년 사이 날짜만 계산할 수 있습니다.');
    var solar, lunar;
    if (cal === 'lunar') {
      solar = lunarToSolar(y, m, d, !!o.leap);
      if (!solar) throw new Error(o.leap ? y + '년 음력 ' + m + '월은 윤달이 아니거나 그 날짜가 없습니다.' : '음력 ' + y + '년 ' + m + '월 ' + d + '일은 없는 날짜입니다.');
    } else {
      if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) throw new Error('없는 날짜입니다.');
      solar = { y: y, m: m, d: d };
    }
    lunar = solarToLunar(solar.y, solar.m, solar.d);

    var timeKnown = o.hour !== null && o.hour !== undefined && o.hour !== '';
    var hh = timeKnown ? +o.hour : 12, mi = timeKnown ? +(o.minute || 0) : 0;
    var lng = o.longitude === undefined || o.longitude === null || o.longitude === '' ? 126.978 : +o.longitude;
    var timeMode = o.timeMode || 'longitude';
    var notes = [];

    // 1) 벽시계 → 표준시 → UT
    var dst = timeKnown && isKoreaDST(solar.y, solar.m, solar.d, hh);
    var stdOff = koreaStdOffset(solar.y, solar.m, solar.d);
    var wallOff = stdOff + (dst ? 1 : 0);
    var jdUT = toJD(solar.y, solar.m, solar.d + (hh + mi / 60) / 24) - wallOff / 24;
    if (dst) notes.push('출생일이 서머타임 기간이라 1시간을 되돌려 계산했습니다.');
    if (stdOff !== 9) notes.push('당시 한국 표준시가 UTC+8:30 이라 그에 맞춰 계산했습니다.');

    // 2) 연주·월주 — 절기 시각과 절대 시각을 비교
    var lon = sunLongitudeUT(jdUT);
    var monthOrder = monthOrderFromLongitude(lon);          // 0=寅
    var sy = solar.y;
    if (solar.m <= 2 && lon < 315 && lon > 200) sy -= 1;  // 입춘 전이면 전년
    var yearGZ = ganji(sy - 4);
    var monthBranch = (monthOrder + 2) % 12;
    var monthStem = (yearGZ.stem * 2 + 2 + monthOrder) % 10;
    var monthGZ = ganjiFrom(monthStem, monthBranch);

    var prevJie = adjacentJie(jdUT, -1), nextJie = adjacentJie(jdUT, 1);
    if (!timeKnown) {
      var dayStartUT = toJD(solar.y, solar.m, solar.d) - stdOff / 24;
      if ((prevJie.jd >= dayStartUT && prevJie.jd < dayStartUT + 1) || (nextJie.jd >= dayStartUT && nextJie.jd < dayStartUT + 1)) {
        var jj = prevJie.jd >= dayStartUT && prevJie.jd < dayStartUT + 1 ? prevJie : nextJie;
        var jc = jdToCivil(jj.jd, stdOff);
        notes.push('태어난 날 ' + pad(jc.h) + ':' + pad(jc.mi) + ' 에 ' + jj.name + ' 절입이 있어, 시간을 모르면 월주(연주)가 달라질 수 있습니다. 정오 기준으로 계산했습니다.');
      }
    }

    // 3) 시 보정 → 현지 시각
    var corrMin = 0;
    if (timeMode === 'longitude' || timeMode === 'solar') corrMin += (lng - stdOff * 15) * 4;
    if (timeMode === 'solar') corrMin += equationOfTime(jdUT);
    var local = jdToCivil(jdUT, stdOff + corrMin / 60);
    var dn = dayNumber(local.y, local.m, local.d);

    var dayGZ, hourGZ = null, hourBranch = null, dayDN = dn;
    if (timeKnown) {
      var hf = local.h + local.mi / 60;
      hourBranch = Math.floor((hf + 1) / 2) % 12;
      var jasiMode = o.jasi === 'yajasi' ? 'yajasi' : 'split';
      if (hf >= 23 && jasiMode === 'split') dayDN = dn + 1;
      dayGZ = dayGanji(dayDN);
      var stemBase = dayGZ.stem;
      if (hf >= 23 && jasiMode === 'yajasi') stemBase = dayGanji(dn + 1).stem;
      hourGZ = ganjiFrom((stemBase * 2 + hourBranch) % 10, hourBranch);
      if (hf >= 23 || hf < 1) notes.push(jasiMode === 'yajasi' ? '자시(23~01시) 출생 — 야자시 기준: 23시 이후라도 일주는 당일, 시주는 다음날 기준.' : '자시(23~01시) 출생 — 23시부터 다음날 일주로 계산했습니다. 고급 옵션에서 야자시로 바꿀 수 있습니다.');
    } else {
      dayGZ = dayGanji(dayDN);
    }

    // 4) 대운
    var daeun = null;
    if (o.gender === 'M' || o.gender === 'F') {
      var yangYear = yearGZ.stem % 2 === 0;
      var forward = (yangYear && o.gender === 'M') || (!yangYear && o.gender === 'F');
      var target = forward ? nextJie : prevJie;
      var days = Math.abs(target.jd - jdUT);
      var startAge = Math.max(1, Math.round(days / 3));
      var list = [];
      for (var i = 1; i <= 10; i++) {
        var g = ganji(monthGZ.idx + (forward ? i : -i));
        list.push({ age: startAge + (i - 1) * 10, year: solar.y + startAge + (i - 1) * 10, ganji: g });
      }
      daeun = { forward: forward, startAge: startAge, days: days, list: list, basis: target.name };
    }

    var pj = jdToCivil(prevJie.jd, 9), nj = jdToCivil(nextJie.jd, 9);
    return {
      input: o,
      solar: solar,
      lunar: lunar,
      timeKnown: timeKnown,
      clock: { h: hh, m: mi },
      local: local,
      correctionMinutes: corrMin,
      dst: dst,
      stdOffset: stdOff,
      sunLongitude: lon,
      pillars: { year: yearGZ, month: monthGZ, day: dayGZ, hour: hourGZ },
      jie: { prev: { name: prevJie.name, at: pj }, next: { name: nextJie.name, at: nj } },
      daeun: daeun,
      notes: notes
    };
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  // 특정 연도의 세운(입춘 기준 연간지)
  function yearGanji(y) { return ganji(y - 4); }

  // 연도의 24절기 목록(한국 표준시)
  function solarTerms(year) {
    var out = [];
    for (var i = 0; i < 24; i++) {
      var lonT = norm360(285 + i * 15);          // 소한부터
      var jd = solarTermInYear(year, lonT);
      var c = fromJD(jd); if (c.y !== year) jd = solarTermUT(lonT, jd + (c.y < year ? 365.2422 : -365.2422));
      out.push({ name: termName(lonT), lon: lonT, jd: jd, at: jdToCivil(jd, koreaStdOffset(year, 6, 1)) });
    }
    out.sort(function (a, b) { return a.jd - b.jd; });
    return out;
  }

  return {
    STEMS: STEMS, BRANCHES: BRANCHES, STEMS_KO: STEMS_KO, BRANCHES_KO: BRANCHES_KO,
    compute: compute, solarToLunar: solarToLunar, lunarToSolar: lunarToSolar, leapMonthOf: leapMonthOf,
    lunarMonthDays: lunarMonthDays, daysInMonth: daysInMonth, ganji: ganji, ganjiFrom: ganjiFrom, dayGanji: dayGanji,
    dayNumber: dayNumber, yearGanji: yearGanji, solarTerms: solarTerms, sunLongitudeUT: sunLongitudeUT,
    solarTermInYear: solarTermInYear, newMoonUT: newMoonUT, jdToCivil: jdToCivil, toJD: toJD,
    isKoreaDST: isKoreaDST, koreaStdOffset: koreaStdOffset, equationOfTime: equationOfTime
  };
});
