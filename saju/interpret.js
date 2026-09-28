/*
 * 사주 풀이 — Manseryeok.compute() 결과에서 오행·십성·지장간·12운성·신강약·용신·신살·합충을 뽑고,
 * 그것을 근거로 성향·연애·이직·재물 리포트 문장을 조립한다.
 * 규칙은 명리학에서 널리 쓰는 기본값을 따르되, 유파마다 다른 부분(용신 등)은 단순화했다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./manseryeok.js'));
  else root.SajuInterpret = factory(root.Manseryeok);
})(typeof self !== 'undefined' ? self : this, function (M) {
  'use strict';

  var EL = ['목', '화', '토', '금', '수'];
  var EL_HANJA = ['木', '火', '土', '金', '水'];
  var BRANCH_EL = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4];
  var STEM_KO = M.STEMS_KO, BR_KO = M.BRANCHES_KO, STEMS = M.STEMS, BRS = M.BRANCHES;
  // 지장간 [천간, 일수] — 여기·중기·정기 순
  var HIDDEN = [
    [[8, 10], [9, 20]], [[9, 9], [7, 3], [5, 18]], [[4, 7], [2, 7], [0, 16]], [[0, 10], [1, 20]],
    [[1, 9], [9, 3], [4, 18]], [[4, 7], [6, 7], [2, 16]], [[2, 10], [5, 9], [3, 11]], [[3, 9], [1, 3], [5, 18]],
    [[4, 7], [8, 7], [6, 16]], [[6, 10], [7, 20]], [[7, 9], [3, 3], [4, 18]], [[4, 7], [0, 7], [8, 16]]];
  var MAIN_HIDDEN = [9, 5, 0, 1, 4, 2, 3, 5, 6, 7, 4, 8];
  var TEN = ['비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인'];
  var GROUPS = ['비겁', '식상', '재성', '관성', '인성'];
  var STAGES = ['장생', '목욕', '관대', '건록', '제왕', '쇠', '병', '사', '묘', '절', '태', '양'];
  var STAGE_START = [11, 6, 2, 9, 2, 9, 5, 0, 8, 3];   // 甲亥 乙午 丙寅 丁酉 戊寅 己酉 庚巳 辛子 壬申 癸卯
  var POS = ['year', 'month', 'day', 'hour'];
  var POS_KO = { year: '년주', month: '월주', day: '일주', hour: '시주' };
  var POS_SHORT = { year: '년', month: '월', day: '일', hour: '시' };

  function stemEl(s) { return Math.floor(s / 2); }
  function tenGod(dm, stem) {
    var d = stemEl(dm), e = stemEl(stem);
    var rel = ((e - d) % 5 + 5) % 5;          // 0 같음, 1 내가 생, 2 내가 극, 3 나를 극, 4 나를 생
    var same = (dm % 2) === (stem % 2);
    return rel * 2 + (same ? 0 : 1);
  }
  function groupOf(t) { return Math.floor(t / 2); }
  function stage12(dm, branch) {
    var st = STAGE_START[dm];
    return dm % 2 === 0 ? ((branch - st) % 12 + 12) % 12 : ((st - branch) % 12 + 12) % 12;
  }
  function samhapGroup(b) { return [[8, 0, 4], [11, 3, 7], [2, 6, 10], [5, 9, 1]].filter(function (g) { return g.indexOf(b) >= 0; })[0]; }
  function dohwa(b) { return [9, 3, 6, 0][[[8, 0, 4], [11, 3, 7], [2, 6, 10], [5, 9, 1]].indexOf(samhapGroup(b))]; }
  function yeokma(b) { var g = samhapGroup(b); return (g[0] + 6) % 12; }
  function hwagae(b) { return samhapGroup(b)[2]; }

  // ───────────────────────── 분석 ─────────────────────────
  function analyze(res, opt) {
    opt = opt || {};
    var P = res.pillars, dm = P.day.stem, dEl = stemEl(dm);
    var gender = opt.gender || (res.input && res.input.gender);
    var refYear = opt.refYear || new Date().getFullYear();
    var positions = POS.filter(function (k) { return P[k]; });

    // 기둥별 상세
    var cols = positions.map(function (k) {
      var g = P[k];
      return {
        key: k, label: POS_KO[k], ganji: g,
        stem: { idx: g.stem, hanja: STEMS[g.stem], ko: STEM_KO[g.stem], el: stemEl(g.stem), yang: g.stem % 2 === 0, ten: k === 'day' ? null : TEN[tenGod(dm, g.stem)] },
        branch: {
          idx: g.branch, hanja: BRS[g.branch], ko: BR_KO[g.branch], el: BRANCH_EL[g.branch], yang: g.branch % 2 === 0,
          ten: TEN[tenGod(dm, MAIN_HIDDEN[g.branch])],
          hidden: HIDDEN[g.branch].map(function (h) { return { hanja: STEMS[h[0]], ko: STEM_KO[h[0]], el: stemEl(h[0]), ten: TEN[tenGod(dm, h[0])] }; }),
          stage: STAGES[stage12(dm, g.branch)]
        },
        shinsal: []
      };
    });
    var col = {}; cols.forEach(function (c) { col[c.key] = c; });

    // 오행 개수(여덟 글자, 지지는 본기)와 세력(지장간 비율·월령 가중)
    var count = [0, 0, 0, 0, 0], power = [0, 0, 0, 0, 0];
    var W_STEM = { year: 1, month: 1.2, day: 1, hour: 1 }, W_BR = { year: 1, month: 3, day: 1.5, hour: 1 };
    cols.forEach(function (c) {
      count[c.stem.el]++; count[c.branch.el]++;
      power[c.stem.el] += W_STEM[c.key];
      var hs = HIDDEN[c.branch.idx], tot = hs.reduce(function (a, h) { return a + h[1]; }, 0);
      hs.forEach(function (h) { power[stemEl(h[0])] += W_BR[c.key] * h[1] / tot; });
    });
    var powerSum = power.reduce(function (a, b) { return a + b; }, 0);
    var powerPct = power.map(function (p) { return Math.round(p / powerSum * 1000) / 10; });

    // 십성 그룹 세력(일간 제외)
    var groupPow = [0, 0, 0, 0, 0], tenCount = {};
    TEN.forEach(function (t) { tenCount[t] = 0; });
    cols.forEach(function (c) {
      if (c.key !== 'day') { groupPow[groupOf(tenGod(dm, c.stem.idx))] += W_STEM[c.key]; tenCount[c.stem.ten]++; }
      tenCount[c.branch.ten]++;
      var hs = HIDDEN[c.branch.idx], tot = hs.reduce(function (a, h) { return a + h[1]; }, 0);
      hs.forEach(function (h) { groupPow[groupOf(tenGod(dm, h[0]))] += W_BR[c.key] * h[1] / tot; });
    });
    var groupSum = groupPow.reduce(function (a, b) { return a + b; }, 0);
    var groupPct = groupPow.map(function (p) { return Math.round(p / groupSum * 1000) / 10; });

    // 신강·신약: 비겁+인성 비중. 무작위 명식 분포의 중앙값이 40 근처라 그 둘레를 중화로 본다.
    var support = (groupPow[0] + groupPow[4]) / groupSum * 100;
    var deukryeong = [0, 4].indexOf(groupOf(tenGod(dm, MAIN_HIDDEN[P.month.branch]))) >= 0;
    var strengthLabel = support < 22 ? '극신약' : support < 35 ? '신약' : support <= 48 ? '중화' : support <= 62 ? '신강' : '극신강';
    var strong = support > 48, weak = support < 35;

    // 용신(억부 + 조후)
    function elOfGroup(g) { return (dEl + g) % 5; }
    var eokbu, eokbuWhy;
    if (strong) {
      if (groupPow[4] > groupPow[0]) { eokbu = 2; eokbuWhy = '인성이 많아 신강하니, 인성을 누르는 재성이 필요합니다.'; }
      else if (groupPow[3] >= 0.8) { eokbu = 3; eokbuWhy = '비겁이 많아 신강하니, 비겁을 다스리는 관성이 필요합니다.'; }
      else { eokbu = 1; eokbuWhy = '비겁이 많아 신강한데 관성이 약해, 힘을 밖으로 풀어 주는 식상이 필요합니다.'; }
    } else if (weak) {
      var drain = [1, 2, 3].sort(function (a, b) { return groupPow[b] - groupPow[a]; })[0];
      if (drain === 2) { eokbu = 0; eokbuWhy = '재성이 많아 신약하니, 재성을 감당할 비겁이 필요합니다.'; }
      else { eokbu = 4; eokbuWhy = (drain === 3 ? '관성이' : '식상이') + ' 많아 신약하니, 일간을 생해 주는 인성이 필요합니다.'; }
    } else {
      eokbu = null;
    }
    var mb = P.month.branch, johu = null, johuWhy = '';
    if ([11, 0, 1].indexOf(mb) >= 0 && powerPct[1] < 15) { johu = 1; johuWhy = '한겨울(' + BR_KO[mb] + '월)에 태어났는데 화 기운이 약해, 온기를 더하는 화(火)가 조후용신입니다.'; }
    if ([5, 6, 7].indexOf(mb) >= 0 && powerPct[4] < 15) { johu = 4; johuWhy = '한여름(' + BR_KO[mb] + '월)에 태어났는데 수 기운이 약해, 열기를 식히는 수(水)가 조후용신입니다.'; }
    var yong, yongWhy;
    if (eokbu !== null) { yong = elOfGroup(eokbu); yongWhy = eokbuWhy; }
    else if (johu !== null) { yong = johu; yongWhy = '일간의 힘은 중화에 가까워, 계절의 치우침을 바로잡는 조후를 우선합니다. ' + johuWhy; }
    else {
      var low = [0, 1, 2, 3, 4].sort(function (a, b) { return power[a] - power[b]; })[0];
      yong = low; yongWhy = '일간의 힘이 중화에 가까워, 가장 부족한 ' + EL[low] + '(' + EL_HANJA[low] + ') 기운으로 균형을 맞춥니다.';
    }
    var hee = (yong + 4) % 5;                 // 용신을 생하는 오행
    var gi = (yong + 3) % 5;                  // 용신을 극하는 오행
    var yongsin = {
      el: yong, heeEl: hee, giEl: gi, why: yongWhy,
      johu: johu, johuWhy: johuWhy,
      group: GROUPS[((yong - dEl) % 5 + 5) % 5]
    };

    // 신살
    var shinsal = [];
    function addSal(name, key, desc) {
      shinsal.push({ name: name, pos: key, desc: desc });
      if (col[key] && col[key].shinsal.indexOf(name) < 0) col[key].shinsal.push(name);
    }
    var cheoneul = { 0: [1, 7], 4: [1, 7], 6: [1, 7], 1: [0, 8], 5: [0, 8], 2: [11, 9], 3: [11, 9], 7: [2, 6], 8: [5, 3], 9: [5, 3] }[dm];
    var munchang = [5, 6, 8, 9, 8, 9, 11, 0, 2, 3][dm];
    var yangin = { 0: 3, 2: 6, 4: 6, 6: 9, 8: 0 }[dm];
    var hongyeom = [6, 8, 2, 7, 4, 4, 10, 9, 0, 8][dm];
    var yb = P.year.branch, db = P.day.branch;
    var baekho = ['甲辰', '乙未', '丙戌', '丁丑', '戊辰', '壬戌', '癸丑'];
    positions.forEach(function (k) {
      var b = P[k].branch;
      if (cheoneul.indexOf(b) >= 0) addSal('천을귀인', k, '어려울 때 돕는 사람이 나타나는 가장 좋은 길신');
      if (b === munchang) addSal('문창귀인', k, '글·시험·학문에 재능, 두뇌 회전이 빠름');
      if (yangin !== undefined && b === yangin) addSal('양인', k, '강한 추진력과 승부욕, 다치거나 다투는 일 조심');
      if (b === hongyeom) addSal('홍염', k, '타고난 이성적 매력과 분위기');
      if (k !== 'year' && b === dohwa(yb)) addSal('도화', k, '사람을 끄는 매력·인기, 이성 인연이 활발');
      else if (k !== 'day' && b === dohwa(db)) addSal('도화', k, '사람을 끄는 매력·인기, 이성 인연이 활발');
      if (k !== 'year' && b === yeokma(yb)) addSal('역마', k, '이동·출장·해외·이사가 잦고 활동 무대가 넓음');
      else if (k !== 'day' && b === yeokma(db)) addSal('역마', k, '이동·출장·해외·이사가 잦고 활동 무대가 넓음');
      if (k !== 'year' && b === hwagae(yb)) addSal('화개', k, '예술·종교·학문에 깊이 몰입, 혼자 있는 시간이 필요');
      else if (k !== 'day' && b === hwagae(db)) addSal('화개', k, '예술·종교·학문에 깊이 몰입, 혼자 있는 시간이 필요');
      if (baekho.indexOf(P[k].hanja) >= 0) addSal('백호', k, '기세가 강하고 결단이 빠름, 사고·수술수 조심');
    });
    if (['庚辰', '庚戌', '壬辰', '壬戌', '戊戌'].indexOf(P.day.hanja) >= 0) addSal('괴강', 'day', '카리스마와 강한 리더십, 극과 극의 기질');
    var xun = P.day.idx - P.day.idx % 10, gm = [(xun % 12 + 10) % 12, (xun % 12 + 11) % 12];
    positions.forEach(function (k) { if (k !== 'day' && gm.indexOf(P[k].branch) >= 0) addSal('공망', k, '그 자리의 기운이 비어 있어 기대만큼 채워지지 않거나 늦게 이뤄짐'); });

    // 합·충·형·원진
    var rel = [];
    var HAP_EL = { '0-5': 2, '1-6': 3, '2-7': 4, '3-8': 0, '4-9': 1 };
    for (var i = 0; i < positions.length; i++) for (var j = i + 1; j < positions.length; j++) {
      var a = positions[i], b = positions[j], A = P[a], B = P[b];
      var tag = POS_SHORT[a] + '·' + POS_SHORT[b];
      var s1 = Math.min(A.stem, B.stem), s2 = Math.max(A.stem, B.stem);
      if (s2 - s1 === 5) rel.push({ type: '천간합', where: tag, text: STEMS[A.stem] + STEMS[B.stem] + '합(' + EL_HANJA[HAP_EL[s1 + '-' + s2]] + ')', good: true });
      if (s2 - s1 === 6 && s1 < 4) rel.push({ type: '천간충', where: tag, text: STEMS[A.stem] + STEMS[B.stem] + '충', good: false });
      var b1 = A.branch, b2 = B.branch;
      if ((b1 + b2) % 12 === 1 && b1 !== b2) rel.push({ type: '육합', where: tag, text: BRS[b1] + BRS[b2] + '합', good: true });
      if (Math.abs(b1 - b2) === 6) rel.push({ type: '충', where: tag, text: BRS[b1] + BRS[b2] + '충', good: false });
      var pair = [b1, b2].sort(function (x, y) { return x - y; }).join('-');
      if (['0-7', '1-6', '2-9', '3-8', '4-11', '5-10'].indexOf(pair) >= 0) rel.push({ type: '원진', where: tag, text: BRS[b1] + BRS[b2] + '원진', good: false });
      if (['2-5', '5-8', '1-10', '7-10', '0-3'].indexOf(pair) >= 0) rel.push({ type: '형', where: tag, text: BRS[b1] + BRS[b2] + '형', good: false });
      if (b1 === b2 && [4, 6, 9, 11].indexOf(b1) >= 0) rel.push({ type: '자형', where: tag, text: BRS[b1] + BRS[b2] + '자형', good: false });
    }
    var branchSet = positions.map(function (k) { return P[k].branch; });
    [[8, 0, 4, '수'], [11, 3, 7, '목'], [2, 6, 10, '화'], [5, 9, 1, '금']].forEach(function (g) {
      var has = g.slice(0, 3).filter(function (b) { return branchSet.indexOf(b) >= 0; });
      if (has.length === 3) rel.push({ type: '삼합', where: '지지', text: BRS[g[0]] + BRS[g[1]] + BRS[g[2]] + ' 삼합 ' + g[3] + '국', good: true });
      else if (has.length === 2 && has.indexOf(g[1]) >= 0) rel.push({ type: '반합', where: '지지', text: has.map(function (b) { return BRS[b]; }).join('') + ' 반합(' + g[3] + ')', good: true });
    });

    // 운의 결 — 오행이 용신·희신이면 +, 기신이면 −
    function elScore(el) { return el === yong ? 2 : el === hee ? 1 : el === gi ? -2 : el === (gi + 4) % 5 ? -1 : 0; }
    function luck(g) {
      var sc = elScore(stemEl(g.stem)) + elScore(BRANCH_EL[g.branch]);
      return { score: sc, label: sc >= 2 ? '좋음' : sc <= -2 ? '주의' : '보통' };
    }
    function describeGanji(g) {
      return {
        ganji: g, stemTen: TEN[tenGod(dm, g.stem)], branchTen: TEN[tenGod(dm, MAIN_HIDDEN[g.branch])],
        stemEl: stemEl(g.stem), branchEl: BRANCH_EL[g.branch], luck: luck(g)
      };
    }
    var birthYear = res.solar.y;
    var daeun = null, currentDaeun = null;
    if (res.daeun) {
      daeun = res.daeun.list.map(function (d) {
        var x = describeGanji(d.ganji); x.age = d.age; x.year = d.year; return x;
      });
      var ageNow = refYear - birthYear;
      daeun.forEach(function (d) { if (ageNow >= d.age) currentDaeun = d; });
    }
    var seun = [];
    for (var yy = refYear; yy < refYear + 10; yy++) { var s = describeGanji(M.yearGanji(yy)); s.year = yy; s.age = yy - birthYear; seun.push(s); }

    var A = {
      res: res, gender: gender, name: opt.name || '', refYear: refYear,
      dm: dm, dmEl: dEl, dmHanja: STEMS[dm], dmKo: STEM_KO[dm],
      cols: cols, count: count, power: power, powerPct: powerPct,
      groupPow: groupPow, groupPct: groupPct, tenCount: tenCount,
      support: Math.round(support), strength: strengthLabel, strong: strong, weak: weak, deukryeong: deukryeong,
      yongsin: yongsin, shinsal: shinsal, relations: rel, gongmang: gm.map(function (b) { return BRS[b]; }).join(''),
      daeun: daeun, currentDaeun: currentDaeun, seun: seun
    };
    A.reports = buildReports(A);
    return A;
  }

  // ───────────────────────── 리포트 문장 ─────────────────────────
  var DM_TEXT = [
    { img: '큰 나무', core: '곧게 위로 뻗는 큰 나무의 기질입니다. 한번 정한 방향으로 밀고 나가는 추진력과 원칙이 있고, 무리를 이끄는 자리에 자연스럽게 섭니다.', edge: '굽히기를 싫어해 부딪히면 부러지는 쪽을 택하기 쉽습니다. 한 박자 늦추고 다른 사람의 방식도 인정해 주면 그릇이 훨씬 커집니다.' },
    { img: '풀과 덩굴', core: '어디서든 뿌리를 내리는 풀과 덩굴의 기질입니다. 부드럽고 눈치가 빨라 환경에 잘 적응하고, 사람 사이를 이어 주는 능력이 뛰어납니다.', edge: '겉으로는 맞춰 주면서 속으로 계산이 많아 스스로 지치기 쉽습니다. 원하는 것을 먼저 말하는 연습이 관계를 편하게 만듭니다.' },
    { img: '태양', core: '온 세상을 비추는 태양의 기질입니다. 밝고 솔직하며 표현력이 커서 어디서든 분위기를 끌어올리고, 공정함을 중요하게 여깁니다.', edge: '열정이 빨리 타오르는 만큼 식는 것도 빠를 수 있습니다. 시작한 일을 끝까지 가져가는 지구력을 챙기면 결과가 달라집니다.' },
    { img: '등불', core: '어둠을 밝히는 등불의 기질입니다. 섬세하고 따뜻하며, 한 가지에 깊게 몰입하는 집중력과 예술적 감각이 있습니다.', edge: '겉은 차분해도 속의 감정이 뜨거워 쉽게 서운해질 수 있습니다. 감정을 쌓아 두지 말고 그때그때 풀어내는 편이 좋습니다.' },
    { img: '큰 산', core: '묵직하게 자리를 지키는 큰 산의 기질입니다. 믿음직하고 포용력이 있어 사람들이 기대며, 갈등을 중재하는 데 능합니다.', edge: '변화에 느리고 한번 굳힌 생각을 잘 바꾸지 않습니다. 새로운 흐름을 가볍게 시험해 보는 유연함이 기회를 늘립니다.' },
    { img: '기름진 논밭', core: '무엇이든 길러 내는 논밭의 기질입니다. 실속 있고 꼼꼼하며, 사람과 일을 차근차근 키워 결실을 만드는 힘이 있습니다.', edge: '걱정이 많고 속내를 잘 드러내지 않아 오해를 사기도 합니다. 완벽하게 준비될 때까지 기다리기보다 먼저 움직여 보세요.' },
    { img: '무쇠와 바위', core: '단단한 무쇠의 기질입니다. 결단이 빠르고 의리가 있으며, 옳다고 믿는 일은 끝까지 밀어붙이는 강직함이 있습니다.', edge: '말과 행동이 직선적이라 의도와 달리 상처를 줄 수 있습니다. 결론 전에 한 문장의 공감을 붙이면 적이 줄어듭니다.' },
    { img: '보석', core: '빛나는 보석의 기질입니다. 깔끔하고 섬세하며 심미안이 뛰어나고, 자기 기준과 자존감이 분명합니다.', edge: '완벽주의 때문에 스스로를 몰아세우고, 작은 말에도 상처받기 쉽습니다. 충분히 괜찮다는 기준선을 정해 두세요.' },
    { img: '큰 강과 바다', core: '멀리 흐르는 큰 강의 기질입니다. 지혜롭고 스케일이 크며, 여러 사람과 정보를 품어 판을 짜는 기획력이 있습니다.', edge: '관심사가 넓고 자유로운 만큼 방향이 자주 바뀔 수 있습니다. 큰 목표 하나를 정해 흐름을 모으면 힘이 배가됩니다.' },
    { img: '비와 이슬', core: '만물을 적시는 비와 이슬의 기질입니다. 총명하고 감수성이 풍부하며, 조용하지만 사람들에게 깊은 영향을 줍니다.', edge: '생각이 많아 결정을 미루거나 불안을 키우기 쉽습니다. 작은 결정부터 빨리 내리는 습관이 자신감을 키웁니다.' }];
  var GROUP_TEXT = {
    '비겁': { good: '주체성과 독립심이 강하고, 동료·친구와 함께할 때 힘이 납니다. 경쟁이 붙으면 오히려 잘하는 타입입니다.', warn: '고집이 세지고 남의 조언을 흘려들을 수 있으며, 사람 때문에 돈이 새는 일을 조심해야 합니다.' },
    '식상': { good: '표현력과 창의력이 뛰어나 말·글·기술로 자신을 드러내는 데 능합니다. 아이디어를 결과물로 만드는 손이 빠릅니다.', warn: '틀에 갇히는 것을 못 견뎌 윗사람이나 규칙과 부딪힐 수 있습니다. 하고 싶은 말을 거르는 필터가 필요합니다.' },
    '재성': { good: '현실 감각과 결과 지향성이 뛰어나 일을 효율적으로 굴리고 돈의 흐름을 잘 읽습니다.', warn: '욕심이 앞서 일을 너무 벌리거나, 결과에 쫓겨 사람을 놓칠 수 있습니다.' },
    '관성': { good: '책임감과 규범 의식이 강해 조직에서 신뢰를 얻고, 명예와 평판을 중요하게 여깁니다.', warn: '스스로에게 엄격해 압박과 긴장을 오래 안고 삽니다. 쉬는 것도 일의 일부로 여기세요.' },
    '인성': { good: '배우고 생각하는 힘이 깊고, 윗사람의 도움과 인복이 따릅니다. 자격·학위·전문성이 무기가 됩니다.', warn: '생각이 행동보다 앞서 실행이 늦어지거나, 받는 데 익숙해질 수 있습니다.' }};
  var LACK_TEXT = {
    '비겁': '비겁이 약해 혼자 버티는 힘보다 주변의 인정에 기운이 좌우되기 쉽습니다. 믿을 만한 동료를 곁에 두세요.',
    '식상': '식상이 약해 생각을 겉으로 드러내는 데 시간이 걸립니다. 기록·발표처럼 표현을 습관화하면 평가가 달라집니다.',
    '재성': '재성이 약해 돈을 목표로 삼기보다 의미를 따라 움직입니다. 돈 관리는 자동화된 규칙에 맡기는 편이 좋습니다.',
    '관성': '관성이 약해 규칙이나 조직보다 자유로운 환경에서 능력이 잘 나옵니다. 스스로 마감과 기준을 정해 두세요.',
    '인성': '인성이 약해 이론보다 실전으로 배우는 타입입니다. 쉬지 않고 달리다 지치지 않도록 충전 루틴을 만드세요.' };
  var EL_EXCESS = [
    '목 기운이 넘쳐 의욕과 계획이 많지만 시작만 하고 마무리가 약해질 수 있습니다.',
    '화 기운이 넘쳐 열정적이지만 성급하고 감정 기복이 커질 수 있습니다.',
    '토 기운이 넘쳐 신중하고 듬직하지만 고집스럽고 변화에 둔할 수 있습니다.',
    '금 기운이 넘쳐 결단력이 있지만 날카롭고 냉정하게 비칠 수 있습니다.',
    '수 기운이 넘쳐 생각이 깊지만 걱정이 많고 실행이 늦어질 수 있습니다.'];
  var EL_LACK = [
    '목이 없어 새로운 일을 시작하는 추진력이나 성장 욕구를 의식적으로 채워야 합니다.',
    '화가 없어 자신을 드러내고 표현하는 데 소극적일 수 있습니다.',
    '토가 없어 중심을 잡고 꾸준히 버티는 힘을 의식적으로 길러야 합니다.',
    '금이 없어 맺고 끊는 결단, 거절하는 힘이 부족할 수 있습니다.',
    '수가 없어 쉬어 가며 생각을 정리하는 여유가 부족할 수 있습니다.'];
  var SPOUSE_PALACE = {
    '비견': '배우자 자리에 비견이 있어 친구처럼 대등한 관계를 원합니다. 서로의 영역을 존중할 때 오래갑니다. 주도권 싸움은 피하세요.',
    '겁재': '배우자 자리에 겁재가 있어 강하게 끌리고 소유욕도 큰 편입니다. 돈 문제는 처음부터 분명히 나누는 것이 좋습니다.',
    '식신': '배우자 자리에 식신이 있어 편안하고 다정한 관계를 만듭니다. 함께 먹고 즐기는 일상에서 애정이 자랍니다.',
    '상관': '배우자 자리에 상관이 있어 표현이 풍부하고 매력적이지만 기준이 높습니다. 말로 상처 주지 않도록 조심하세요.',
    '편재': '배우자 자리에 편재가 있어 활동적이고 이성에게 인기가 많습니다. 여러 인연 사이에서 정착이 늦어질 수 있습니다.',
    '정재': '배우자 자리에 정재가 있어 성실하고 현실적인 배우자 복이 있습니다. 안정된 가정을 중심에 둡니다.',
    '편관': '배우자 자리에 편관이 있어 카리스마 있는 상대에게 강하게 끌립니다. 긴장감이 매력이지만 기싸움은 줄이세요.',
    '정관': '배우자 자리에 정관이 있어 반듯하고 예의 바른 관계, 결혼을 전제로 한 만남을 선호합니다.',
    '편인': '배우자 자리에 편인이 있어 정신적인 교감을 중시하고 혼자만의 시간도 필요합니다. 표현을 아끼면 오해가 생깁니다.',
    '정인': '배우자 자리에 정인이 있어 서로 보살피는 관계에서 안정감을 얻습니다. 한쪽이 기대기만 하지 않도록 균형을 맞추세요.' };
  var CAREER_FIELDS = [
    ['교육', '출판·콘텐츠', '기획', '의료·복지', '환경·원예', '패션'],
    ['미디어·방송', '마케팅·광고', 'IT·전자', '디자인', '엔터테인먼트', '에너지'],
    ['부동산·건설', '중개·컨설팅', '공공·행정', '농식품', '인사·총무'],
    ['금융·회계', '법률·감사', '엔지니어링·제조', '의료기기', '보안·군경', '품질관리'],
    ['무역·유통·물류', '연구·데이터', '여행·해운', '상담·심리', '해외 사업']];
  var WORK_STYLE = {
    '비겁': '같은 목표를 가진 동료와 경쟁하며 성장하는 환경, 또는 내 이름을 걸고 일하는 독립형 커리어가 맞습니다.',
    '식상': '전문 기술·창작·말로 성과를 내는 직무가 맞습니다. 결과물이 눈에 보이는 일에서 인정받습니다.',
    '재성': '숫자와 성과로 평가받는 영업·사업·관리 직무가 맞습니다. 보상 체계가 분명한 곳에서 힘이 납니다.',
    '관성': '체계가 잡힌 조직, 직급과 역할이 분명한 곳에서 꾸준히 올라가는 커리어가 맞습니다.',
    '인성': '공부와 자격이 쌓이는 전문직·연구·교육 분야가 맞습니다. 깊이로 승부하는 자리에서 빛납니다.' };
  var YEAR_CAREER = {
    '비견': '경쟁자가 늘고 독립 욕구가 커지는 해입니다. 옮기기보다 입지를 굳히는 쪽이 유리하고, 동업은 역할을 문서로 나누세요.',
    '겁재': '경쟁과 지출이 커지는 해입니다. 충동적인 퇴사는 피하고, 새 자리는 조건을 꼼꼼히 확인한 뒤 움직이세요.',
    '식신': '실력이 자연스럽게 드러나는 해입니다. 포트폴리오를 정리하고 부업·전문성 확장을 시작하기 좋습니다.',
    '상관': '변화 욕구가 강해지는 해로 이직 신호가 뚜렷합니다. 다만 윗사람과 부딪혀 나오기보다 다음 자리를 정하고 움직이세요.',
    '편재': '기회가 여기저기서 들어오는 해입니다. 연봉·조건을 높이는 이직이나 사업 확장에 유리하지만 과욕은 금물입니다.',
    '정재': '성실함이 보상으로 돌아오는 해입니다. 연봉 협상과 안정적인 자리 이동에 좋습니다.',
    '편관': '책임과 압박이 커지는 해입니다. 갑작스러운 조직 변동이 올 수 있으니 버틸지 옮길지 기준을 미리 세워 두세요.',
    '정관': '인정과 승진의 해입니다. 지금 조직 안에서 자리를 높이거나, 더 좋은 조직으로 정식 이동하기 좋습니다.',
    '편인': '새 분야에 대한 관심이 커지는 해입니다. 이직보다는 공부·자격·전환 준비에 쓰면 다음 해에 결실을 봅니다.',
    '정인': '문서·계약 운이 좋은 해입니다. 자격 취득, 학위, 좋은 조건의 계약서에 도장을 찍기 좋습니다.' };
  var YEAR_WEALTH = {
    '비견': '들어오는 만큼 나가는 해입니다. 지인과의 돈거래·보증은 피하세요.',
    '겁재': '지출과 손재 신호가 있는 해입니다. 큰 투자보다 현금 흐름을 지키는 쪽이 이깁니다.',
    '식신': '일한 만큼 돈이 붙는 해입니다. 부수입·재능 판매에 유리합니다.',
    '상관': '아이디어가 돈이 되는 해지만 씀씀이도 커집니다. 수익의 일정 비율을 자동 저축하세요.',
    '편재': '큰 돈의 흐름이 보이는 해입니다. 투자·사업 기회가 오지만 한 번에 몰지 말고 나눠 들어가세요.',
    '정재': '안정적인 수입과 저축의 해입니다. 목돈 만들기, 대출 정리에 좋습니다.',
    '편관': '예상 못 한 지출이 생기기 쉬운 해입니다. 비상금을 넉넉히 두세요.',
    '정관': '신용과 평판이 돈이 되는 해입니다. 승진·연봉 인상으로 수입 기반이 단단해집니다.',
    '편인': '돈보다 공부·준비에 쓰는 해입니다. 자기계발 투자는 길게 보면 이득입니다.',
    '정인': '문서로 재산이 늘어나는 해입니다. 부동산·계약·상속 같은 문서 일이 유리합니다.' };

  function josa(word, a, b) {
    var c = word.charCodeAt(word.length - 1);
    if (c < 0xAC00 || c > 0xD7A3) return word + b;
    return word + ((c - 0xAC00) % 28 ? a : b);
  }
  function elName(e) { return EL[e] + '(' + EL_HANJA[e] + ')'; }

  function buildReports(A) {
    var gp = A.groupPct, order = [0, 1, 2, 3, 4].sort(function (a, b) { return gp[b] - gp[a]; });
    var top = GROUPS[order[0]], second = GROUPS[order[1]];
    var dmT = DM_TEXT[A.dm];
    var dayCol = A.cols.filter(function (c) { return c.key === 'day'; })[0];
    var sals = A.shinsal.map(function (s) { return s.name; });
    function hasSal(n) { return sals.indexOf(n) >= 0; }
    var thisYear = A.seun[0], nextYear = A.seun[1];

    // 성향
    var p = [];
    p.push('일간은 ' + A.dmHanja + '(' + A.dmKo + ')' + ', ' + dmT.img + '입니다. ' + dmT.core);
    p.push(A.strength === '중화'
      ? '일간의 힘이 균형(중화)에 가까워, 상황에 따라 앞에 서기도 하고 한발 물러서기도 하는 유연함이 있습니다.'
      : A.strong
        ? '일간의 힘이 강한 ' + A.strength + ' 사주라, 자기 주관이 뚜렷하고 스스로 판을 짜서 움직일 때 가장 잘 풀립니다. 내 뜻대로 밀어붙이기보다 에너지를 결과물로 흘려보내는 것이 관건입니다.'
        : '일간의 힘이 약한 ' + A.strength + ' 사주라, 혼자보다 좋은 환경과 사람을 만났을 때 능력이 크게 살아납니다. 무리하게 여러 일을 떠안기보다 선택과 집중이 유리합니다.');
    p.push('원국에서 가장 두드러진 것은 ' + top + '(' + gp[order[0]] + '%)입니다. ' + GROUP_TEXT[top].good + ' 다만 ' + GROUP_TEXT[top].warn);
    var lacks = [0, 1, 2, 3, 4].filter(function (g) { return gp[g] < 6; });
    if (lacks.length) p.push(LACK_TEXT[GROUPS[lacks[0]]]);
    var over = [0, 1, 2, 3, 4].filter(function (e) { return A.powerPct[e] >= 38; });
    var none = [0, 1, 2, 3, 4].filter(function (e) { return A.count[e] === 0; });
    if (over.length) p.push(EL_EXCESS[over[0]]);
    if (none.length) p.push(none.map(function (e) { return EL_LACK[e]; }).join(' '));
    p.push(dmT.edge);
    var personality = {
      title: '성향', headline: A.dmHanja + '(' + A.dmKo + ') 일간 · ' + dmT.img + ' · ' + top + ' 중심',
      keywords: [dmT.img, A.strength, top, second].concat(hasSal('화개') ? ['화개'] : []).concat(hasSal('괴강') ? ['괴강'] : []),
      paragraphs: p
    };

    // 연애
    var male = A.gender === 'M';
    var spouseGroup = male ? 2 : 3;
    var spouseCount = 0, spouseMix = { '편': 0, '정': 0 };
    A.cols.forEach(function (c) {
      [c.stem.ten, c.branch.ten].forEach(function (t) {
        if (!t) return;
        if (groupOf(TEN.indexOf(t)) === spouseGroup) { spouseCount++; spouseMix[t[0] === '편' ? '편' : '정']++; }
      });
    });
    var starName = male ? '재성' : '관성';
    var lp = [];
    if (!A.gender) lp.push('성별을 입력하지 않아 배우자성은 일반론으로 풉니다.');
    if (spouseCount === 0) lp.push('원국에 이성을 뜻하는 ' + starName + '이 드러나 있지 않습니다. 인연이 저절로 오기보다 스스로 움직일 때 만나며, ' + starName + '이 들어오는 해에 인연이 활발해집니다.');
    else if (spouseCount >= 3) lp.push('원국에 ' + starName + '이 ' + spouseCount + '개로 많아 이성 인연이 풍부합니다. ' + (spouseMix['편'] && spouseMix['정'] ? '다만 편·정이 섞여 있어 마음이 두 갈래로 나뉘기 쉬우니, 결정은 신중하게 하세요.' : '선택지가 많은 만큼 기준을 분명히 세우는 것이 중요합니다.'));
    else lp.push('원국에 ' + starName + '이 ' + spouseCount + '개 있어 인연이 적당히 들어옵니다. ' + (spouseMix['정'] ? '안정적이고 진지한 관계를 선호합니다.' : '자유롭고 설레는 관계에 먼저 끌립니다.'));
    lp.push(SPOUSE_PALACE[dayCol.branch.ten]);
    if (hasSal('도화') || hasSal('홍염')) lp.push((hasSal('도화') && hasSal('홍염') ? '도화와 홍염이 함께 있어' : hasSal('도화') ? '도화가 있어' : '홍염이 있어') + ' 타고난 매력으로 사람을 끕니다. 인기가 많은 만큼 오해받지 않도록 선을 분명히 하세요.');
    var dayRel = A.relations.filter(function (r) { return r.where.indexOf('일') >= 0 && !r.good; });
    if (dayRel.length) lp.push('배우자 자리(일지)에 ' + dayRel.map(function (r) { return r.text; }).join('·') + '이 걸려 있어 관계에 기복이 생길 수 있습니다. 감정이 올라올 때 결론을 하루 미루는 습관이 도움이 됩니다.');
    function loveYear(s) {
      var st = groupOf(TEN.indexOf(s.stemTen)), bt = groupOf(TEN.indexOf(s.branchTen));
      var dh = s.ganji.branch === dohwa(A.res.pillars.year.branch) || s.ganji.branch === dohwa(A.res.pillars.day.branch);
      var hap = (s.ganji.branch + A.res.pillars.day.branch) % 12 === 1;
      var chung = Math.abs(s.ganji.branch - A.res.pillars.day.branch) === 6;
      var t = s.year + '년(' + s.ganji.hangul + '): ';
      if (st === spouseGroup || bt === spouseGroup) t += starName + '이 들어와 새 인연이나 관계 진전이 기대되는 해입니다.';
      else if (hap) t += '배우자 자리와 합이 들어 마음이 통하는 사람을 만나거나 관계가 깊어지는 해입니다.';
      else if (dh) t += '도화가 들어 이성의 관심이 늘어나는 해입니다.';
      else t += '연애운은 잔잔한 해입니다. 기존 관계를 다지는 데 집중하세요.';
      if (chung) t += ' 다만 배우자 자리를 충하니 이사·이별·다툼 같은 변화가 따를 수 있습니다.';
      return t;
    }
    lp.push(loveYear(thisYear));
    lp.push(loveYear(nextYear));
    var love = {
      title: '연애', headline: starName + ' ' + spouseCount + '개 · 배우자궁 ' + dayCol.branch.ten,
      keywords: [starName + ' ' + spouseCount, '일지 ' + dayCol.branch.ten].concat(hasSal('도화') ? ['도화'] : []).concat(hasSal('홍염') ? ['홍염'] : []),
      paragraphs: lp
    };

    // 이직·직업
    var cp = [];
    var workTop = [1, 2, 3, 4, 0].sort(function (a, b) { return gp[b] - gp[a]; })[0];
    cp.push(WORK_STYLE[GROUPS[workTop]]);
    cp.push('용신이 ' + elName(A.yongsin.el) + ([0, 3].indexOf(A.yongsin.el) >= 0 ? '이라, ' : '라, ') + CAREER_FIELDS[A.yongsin.el].join('·') + ' 같은 ' + EL[A.yongsin.el] + ' 기운의 분야에서 운이 잘 붙습니다. 희신 ' + elName(A.yongsin.heeEl) + ' 분야(' + CAREER_FIELDS[A.yongsin.heeEl].slice(0, 3).join('·') + ')도 잘 맞습니다.');
    if (hasSal('역마')) cp.push('역마가 있어 한곳에 오래 머물기보다 이동·출장·해외가 잦은 일에서 활로가 열립니다. 이직 자체가 기회가 되는 사주입니다.');
    if (gp[3] >= 25 && gp[1] >= 20) cp.push('관성과 식상이 함께 강해 조직의 규칙과 나의 방식이 자주 부딪힙니다. 재량권이 큰 자리를 고르면 두 힘이 모두 살아납니다.');
    if (A.currentDaeun) cp.push('지금은 ' + A.currentDaeun.age + '세부터 이어지는 ' + A.currentDaeun.ganji.hangul + ' 대운(' + A.currentDaeun.stemTen + '·' + A.currentDaeun.branchTen + ')으로, 운의 결은 ‘' + A.currentDaeun.luck.label + '’입니다.');
    function careerYear(s) {
      var t = s.year + '년(' + s.ganji.hangul + ', ' + s.stemTen + '): ' + YEAR_CAREER[s.stemTen];
      if (Math.abs(s.ganji.branch - A.res.pillars.month.branch) === 6) t += ' 직장 자리(월지)를 충하는 해라 부서 이동·이직 같은 환경 변화가 실제로 일어나기 쉽습니다.';
      return t;
    }
    cp.push(careerYear(thisYear));
    cp.push(careerYear(nextYear));
    var bestMove = A.seun.filter(function (s) { return ['식신', '상관', '편재', '정재', '정관'].indexOf(s.stemTen) >= 0 && s.luck.score >= 0; }).slice(0, 3).map(function (s) { return s.year; });
    if (bestMove.length) cp.push('앞으로 10년 중 이직·도약에 힘이 실리는 해: ' + bestMove.join(', ') + '년.');
    var career = {
      title: '이직·직업', headline: GROUPS[workTop] + '형 커리어 · 용신 ' + elName(A.yongsin.el),
      keywords: [GROUPS[workTop] + '형'].concat(CAREER_FIELDS[A.yongsin.el].slice(0, 3)).concat(hasSal('역마') ? ['역마'] : []),
      paragraphs: cp
    };

    // 재물
    var wp = [];
    var jae = gp[2], sik = gp[1], bi = gp[0];
    if (jae < 6) wp.push('원국에 재성이 거의 없어 돈을 좇기보다 실력과 명예를 쌓을 때 돈이 따라오는 구조입니다. 재성이 들어오는 해를 놓치지 마세요.');
    else if (jae >= 30 && A.weak) wp.push('재성은 많은데 일간이 약한 재다신약입니다. 돈이 눈앞에 많이 보여도 다 쥐려 하면 탈이 납니다. 감당할 수 있는 크기부터 확실히 챙기세요.');
    else if (jae >= 30) wp.push('재성이 강하고 일간도 버틸 힘이 있어 돈을 다루는 그릇이 큰 편입니다. 사업·투자 감각을 살려 볼 만합니다.');
    else wp.push('재성이 적당히 있어 벌고 쓰는 균형이 잡힌 구조입니다. 꾸준히 불려 가는 방식이 잘 맞습니다.');
    if (sik >= 15 && jae >= 12) wp.push('식상이 재성을 생하는 식상생재 흐름이 있어, 기술·아이디어·콘텐츠가 곧바로 돈으로 연결됩니다. 재능을 파는 부업이 잘 맞습니다.');
    if (bi >= 30 && jae < 15) wp.push('비겁이 많고 재성이 약해 사람을 통해 돈이 새기 쉽습니다(군겁쟁재). 동업·보증·돈거래는 문서로 분명히 하세요.');
    if (A.tenCount['편재'] > A.tenCount['정재']) wp.push('편재가 정재보다 많아 월급보다 사업·투자·성과급처럼 크게 오가는 돈에 강합니다. 수익과 손실의 폭을 관리하는 규칙이 필요합니다.');
    else if (A.tenCount['정재'] > 0) wp.push('정재 위주라 고정 수입을 차곡차곡 쌓는 방식이 가장 확실합니다. 자동이체 저축과 장기 투자가 잘 맞습니다.');
    var jaego = A.cols.filter(function (c) { return [1, 4, 7, 10].indexOf(c.branch.idx) >= 0 && c.branch.hidden.some(function (h) { return h.ten === '편재' || h.ten === '정재'; }); });
    if (jaego.length) wp.push(jaego.map(function (c) { return c.label; }).join('·') + '의 ' + jaego.map(function (c) { return c.branch.hanja; }).join('·') + '에 재성이 저장된 재고(財庫)가 있어, 모아 두는 힘이 있습니다.');
    wp.push(thisYear.year + '년(' + thisYear.ganji.hangul + '): ' + YEAR_WEALTH[thisYear.stemTen]);
    wp.push(nextYear.year + '년(' + nextYear.ganji.hangul + '): ' + YEAR_WEALTH[nextYear.stemTen]);
    if (A.daeun) {
      var goodDaeun = A.daeun.filter(function (d) { return d.luck.score >= 2 && d.age + 9 >= A.refYear - A.res.solar.y; }).slice(0, 2);
      if (goodDaeun.length) wp.push('운의 결이 좋아 재물 기회가 커지는 대운: ' + goodDaeun.map(function (d) { return d.age + '세(' + d.year + '년~) ' + d.ganji.hangul; }).join(', ') + '.');
    }
    var wealth = {
      title: '재물운', headline: '재성 ' + jae + '% · 편재 ' + A.tenCount['편재'] + ' · 정재 ' + A.tenCount['정재'],
      keywords: ['재성 ' + jae + '%'].concat(sik >= 15 && jae >= 12 ? ['식상생재'] : []).concat(jaego.length ? ['재고'] : []).concat(jae >= 30 && A.weak ? ['재다신약'] : []),
      paragraphs: wp
    };

    return { personality: personality, love: love, career: career, wealth: wealth };
  }

  return {
    analyze: analyze, EL: EL, EL_HANJA: EL_HANJA, TEN: TEN, GROUPS: GROUPS, BRANCH_EL: BRANCH_EL,
    stemEl: stemEl, tenGod: tenGod, josa: josa
  };
});
