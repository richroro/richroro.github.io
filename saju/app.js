/* 만세력 사주 — 화면 */
(function () {
  'use strict';
  var M = window.Manseryeok, I = window.SajuInterpret;
  var $ = function (id) { return document.getElementById(id); };
  var EL = I.EL, ELH = I.EL_HANJA;
  var CITIES = [
    ['서울', 126.98], ['인천', 126.71], ['수원', 127.03], ['춘천', 127.73], ['강릉', 128.9], ['청주', 127.49],
    ['대전', 127.38], ['전주', 127.15], ['광주', 126.85], ['대구', 128.6], ['포항', 129.37], ['울산', 129.31],
    ['부산', 129.08], ['창원', 128.68], ['목포', 126.39], ['제주', 126.53], ['평양', 125.75]];

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function opt(v, t, sel) { return '<option value="' + v + '"' + (sel ? ' selected' : '') + '>' + t + '</option>'; }
  function radio(name) { var r = document.querySelector('input[name="' + name + '"]:checked'); return r ? r.value : null; }
  function setRadio(name, v) { var r = document.querySelector('input[name="' + name + '"][value="' + v + '"]'); if (r) r.checked = true; }

  // ───────── 폼 채우기 ─────────
  var html = '';
  for (var y = 2100; y >= 1900; y--) html += opt(y, y + '년', y === 1990);
  $('y').innerHTML = html;
  html = ''; for (var m = 1; m <= 12; m++) html += opt(m, m + '월', m === 1); $('m').innerHTML = html;
  html = opt('', '시각 모름', false);
  for (var h = 0; h < 24; h++) html += opt(h, pad(h) + '시', h === 12);
  $('hh').innerHTML = html;
  html = ''; for (var mi = 0; mi < 60; mi++) html += opt(mi, pad(mi) + '분', mi === 0); $('mm').innerHTML = html;
  $('city').innerHTML = CITIES.map(function (c, i) { return opt(i, c[0] + ' (동경 ' + c[1].toFixed(2) + '°)', i === 0); }).join('') + opt('x', '해외 · 모름 (경도 보정 없음)', false);

  function refreshDays() {
    var cal = radio('cal'), yy = +$('y').value, mm = +$('m').value, keep = +$('d').value || 1, n, hint = $('leapHint');
    if (cal === 'solar') { n = M.daysInMonth(yy, mm); hint.classList.add('hidden'); }
    else {
      var lp = M.leapMonthOf(yy);
      n = M.lunarMonthDays(yy, mm, cal === 'leap') || 30;
      hint.classList.remove('hidden');
      hint.textContent = lp ? yy + '년은 음력 ' + lp + '월에 윤달이 있습니다.' : yy + '년은 윤달이 없는 해입니다.';
    }
    var s = ''; for (var d = 1; d <= n; d++) s += opt(d, d + '일', d === Math.min(keep, n));
    $('d').innerHTML = s;
  }
  ['y', 'm'].forEach(function (id) { $(id).addEventListener('change', refreshDays); });
  document.querySelectorAll('input[name="cal"]').forEach(function (r) { r.addEventListener('change', refreshDays); });
  $('hh').addEventListener('change', function () { $('mm').disabled = $('hh').value === ''; });
  refreshDays();
  $('d').value = '1';

  // 오늘의 일진
  (function () {
    var t = new Date(), dn = M.dayNumber(t.getFullYear(), t.getMonth() + 1, t.getDate()), g = M.dayGanji(dn);
    $('todayLabel').innerHTML = '오늘 <span class="font-serif font-bold text-ink">' + g.hanja + '</span>일 · ' + (t.getMonth() + 1) + '월 ' + t.getDate() + '일';
  })();

  // ───────── 입력 ↔ 주소 ─────────
  function readForm() {
    var cal = radio('cal'), cityV = $('city').value, hh = $('hh').value;
    return {
      name: $('name').value.trim().slice(0, 20), gender: radio('gender'),
      calendar: cal === 'solar' ? 'solar' : 'lunar', leap: cal === 'leap', calRaw: cal,
      year: +$('y').value, month: +$('m').value, day: +$('d').value,
      hour: hh === '' ? null : +hh, minute: hh === '' ? 0 : +$('mm').value,
      city: cityV, longitude: cityV === 'x' ? 135 : CITIES[+cityV][1],
      timeMode: cityV === 'x' ? 'none' : radio('tm'), tmRaw: radio('tm'), jasi: radio('js')
    };
  }
  function toQuery(f) {
    var p = new URLSearchParams();
    if (f.name) p.set('n', f.name);
    p.set('g', f.gender); p.set('c', f.calRaw);
    p.set('d', f.year + pad(f.month) + pad(f.day));
    p.set('t', f.hour === null ? 'x' : pad(f.hour) + pad(f.minute));
    p.set('p', f.city); p.set('tm', f.tmRaw); p.set('js', f.jasi);
    return p.toString();
  }
  function fromQuery() {
    var p = new URLSearchParams(location.search), d = p.get('d');
    if (!d || !/^\d{8}$/.test(d)) return false;
    $('name').value = p.get('n') || '';
    setRadio('gender', p.get('g') === 'F' ? 'F' : 'M');
    setRadio('cal', ['solar', 'lunar', 'leap'].indexOf(p.get('c')) >= 0 ? p.get('c') : 'solar');
    $('y').value = String(+d.slice(0, 4)); $('m').value = String(+d.slice(4, 6));
    refreshDays(); $('d').value = String(+d.slice(6, 8));
    var t = p.get('t');
    if (t && /^\d{4}$/.test(t)) { $('hh').value = String(+t.slice(0, 2)); $('mm').value = String(+t.slice(2)); }
    else $('hh').value = '';
    $('mm').disabled = $('hh').value === '';
    var c = p.get('p'); if (c !== null && (c === 'x' || CITIES[+c])) $('city').value = c;
    if (p.get('tm')) setRadio('tm', p.get('tm'));
    if (p.get('js')) setRadio('js', p.get('js'));
    return true;
  }

  // ───────── 계산 ─────────
  var current = null;
  $('f').addEventListener('submit', function (e) {
    e.preventDefault();
    run(true);
  });
  function run(scroll) {
    var f = readForm(), err = $('err');
    err.classList.add('hidden');
    var res;
    try { res = M.compute(f); } catch (x) { err.textContent = x.message; err.classList.remove('hidden'); return; }
    var A = I.analyze(res, { name: f.name, gender: f.gender });
    current = { f: f, res: res, A: A };
    render(current);
    history.replaceState(null, '', '?' + toQuery(f));
    $('result').classList.remove('hidden');
    if (scroll) $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ───────── 그리기 ─────────
  function tile(ch, ko, el, yang, big) {
    return '<div class="tile el-' + el + ' ' + (yang ? 'yang' : 'yin') + ' rounded-[3px] ' + (big ? 'py-3 sm:py-4' : 'py-1.5') + '">' +
      '<div class="hz font-serif el-text leading-none ' + (big ? 'text-[34px] sm:text-[46px]' : 'text-[19px]') + '">' + ch + '</div>' +
      '<div class="text-[11px] sm:text-[12px] text-ink2 mt-1.5">' + ko + (big ? ' · ' + (yang ? '+' : '−') + EL[el] : '') + '</div></div>';
  }
  function elChip(e, label) {
    return '<span class="el-' + e + ' inline-flex items-center gap-1.5 border el-border el-bg rounded-[3px] px-2 py-1 text-[13.5px]">' +
      (label ? '<span class="text-ink3 text-[12px]">' + label + '</span>' : '') +
      '<b class="font-serif el-text">' + ELH[e] + '</b><span class="font-medium">' + EL[e] + '</span></span>';
  }

  function render(C) {
    var f = C.f, r = C.res, A = C.A, P = r.pillars;
    var who = [f.name || null, f.gender === 'F' ? '여' : '남'].filter(Boolean).join(' · ');
    $('rWho').textContent = who;
    $('rTitle').textContent = P.year.hangul + '년 ' + P.month.hangul + '월 ' + P.day.hangul + '일' + (P.hour ? ' ' + P.hour.hangul + '시' : '');

    var lunarTxt = r.lunar ? '음 ' + r.lunar.year + '.' + pad(r.lunar.month) + '.' + pad(r.lunar.day) + (r.lunar.leap ? ' (윤)' : '') : '';
    var clock = r.timeKnown ? pad(r.clock.h) + ':' + pad(r.clock.m) : '모름';
    var corr = r.timeKnown ? pad(r.local.h) + ':' + pad(r.local.mi) + ' <span class="text-ink3">(' + (r.correctionMinutes >= 0 ? '+' : '−') + Math.abs(Math.round(r.correctionMinutes)) + '분)</span>' : '—';
    var meta = [
      ['양력', r.solar.y + '.' + pad(r.solar.m) + '.' + pad(r.solar.d)],
      ['음력', lunarTxt.replace('음 ', '')],
      ['출생 시각', clock + (r.dst ? ' <span class="text-ink3">(서머타임)</span>' : '')],
      ['보정 시각', corr],
      ['절입', r.jie.prev.name + ' ' + r.jie.prev.at.m + '/' + r.jie.prev.at.d + ' ' + pad(r.jie.prev.at.h) + ':' + pad(r.jie.prev.at.mi)],
      ['다음 절', r.jie.next.name + ' ' + r.jie.next.at.m + '/' + r.jie.next.at.d + ' ' + pad(r.jie.next.at.h) + ':' + pad(r.jie.next.at.mi)],
      ['공망', A.gongmang],
      ['띠', '<span class="font-serif">' + M.BRANCHES[P.year.branch] + '</span> ' + '쥐소범토끼용뱀말양원숭이닭개돼지'.match(/쥐|소|범|토끼|용|뱀|말|양|원숭이|닭|개|돼지/g)[P.year.branch] + '띠']];
    $('rMeta').innerHTML = meta.map(function (x) { return '<div><dt class="text-ink3 text-[12px]">' + x[0] + '</dt><dd class="font-medium mt-0.5">' + x[1] + '</dd></div>'; }).join('');
    $('rNotes').innerHTML = r.notes.map(function (n) { return '<li class="flex gap-2"><span class="text-seal">※</span><span>' + esc(n) + '</span></li>'; }).join('');

    // 원국 표: 시·일·월·년
    var order = ['hour', 'day', 'month', 'year'], labels = { hour: '시주', day: '일주', month: '월주', year: '년주' };
    var colBy = {}; A.cols.forEach(function (c) { colBy[c.key] = c; });
    var rowLabel = function (t) { return '<div class="text-[11.5px] sm:text-[12.5px] text-ink3 flex items-center justify-start text-left leading-tight">' + t + '</div>'; };
    var g = '<div></div>' + order.map(function (k) { return '<div class="text-[12.5px] font-semibold ' + (k === 'day' ? 'text-seal' : 'text-ink2') + ' pb-1">' + labels[k] + (k === 'day' ? ' <span class="font-normal">(나)</span>' : '') + '</div>'; }).join('');
    function row(label, fn) { g += rowLabel(label) + order.map(function (k) { var c = colBy[k]; return '<div class="min-w-0">' + (c ? fn(c) : (label === '천간' || label === '지지' ? '<div class="border border-dashed border-line rounded-[3px] h-full grid place-items-center text-[12px] text-ink3 py-3 sm:py-4">모름</div>' : '')) + '</div>'; }).join(''); }
    row('십성', function (c) { return '<div class="text-[12.5px] sm:text-[13.5px] font-medium ' + (c.key === 'day' ? 'text-seal' : '') + '">' + (c.stem.ten || '일간') + '</div>'; });
    row('천간', function (c) { return tile(c.stem.hanja, c.stem.ko, c.stem.el, c.stem.yang, true); });
    row('지지', function (c) { return tile(c.branch.hanja, c.branch.ko, c.branch.el, c.branch.yang, true); });
    row('십성', function (c) { return '<div class="text-[12.5px] sm:text-[13.5px] font-medium">' + c.branch.ten + '</div>'; });
    row('지장간', function (c) { return '<div class="flex justify-center gap-0.5 sm:gap-1 font-serif text-[14px] sm:text-[16px]">' + c.branch.hidden.map(function (h) { return '<span class="el-' + h.el + ' el-text" title="' + h.ko + ' · ' + h.ten + '">' + h.hanja + '</span>'; }).join('') + '</div>'; });
    row('12운성', function (c) { return '<div class="text-[12.5px] sm:text-[13.5px] text-ink2">' + c.branch.stage + '</div>'; });
    row('신살', function (c) { return '<div class="text-[11.5px] sm:text-[12.5px] text-ink2 leading-snug">' + (c.shinsal.length ? c.shinsal.join('<br>') : '<span class="text-ink3">—</span>') + '</div>'; });
    $('chart').innerHTML = g;

    // 오행
    var yong = A.yongsin;
    $('elements').innerHTML = [0, 1, 2, 3, 4].map(function (e) {
      var tag = e === yong.el ? '용신' : e === yong.heeEl ? '희신' : e === yong.giEl ? '기신' : '';
      return '<div class="el-' + e + ' grid grid-cols-[44px_1fr_64px] items-center gap-3">' +
        '<div class="flex items-baseline gap-1"><b class="font-serif el-text text-[18px]">' + ELH[e] + '</b><span class="text-[13px] text-ink2">' + EL[e] + '</span></div>' +
        '<div class="h-6 bg-line/50 rounded-[2px] overflow-hidden relative"><div class="el-fill h-full rounded-[2px]" style="width:' + Math.max(A.powerPct[e], 0.5) + '%"></div>' +
        (tag ? '<span class="absolute right-2 top-1/2 -translate-y-1/2 text-[11.5px] font-semibold ' + (tag === '기신' ? 'text-ink3' : 'text-seal') + '">' + tag + '</span>' : '') + '</div>' +
        '<div class="text-right text-[13px]"><b class="font-semibold">' + A.powerPct[e].toFixed(0) + '%</b> <span class="text-ink3">' + A.count[e] + '개</span></div></div>';
    }).join('');

    // 신강약 게이지
    var marks = [['극신약', 0, 22], ['신약', 22, 35], ['중화', 35, 48], ['신강', 48, 62], ['극신강', 62, 100]];
    var pos = Math.min(98, Math.max(2, A.support));
    $('strength').innerHTML =
      '<div class="flex items-baseline gap-3"><span class="font-serif font-black text-[28px]">' + A.strength + '</span><span class="text-[13.5px] text-ink2">비겁·인성 비중 ' + A.support + '% · ' + (A.deukryeong ? '월령을 얻음(득령)' : '월령을 얻지 못함(실령)') + '</span></div>' +
      '<div class="relative mt-4 h-2 flex rounded-full overflow-hidden">' + marks.map(function (m, i) { return '<div style="width:' + (m[2] - m[1]) + '%" class="' + ['bg-line', 'bg-line/70', 'bg-ink/25', 'bg-line/70', 'bg-line'][i] + '"></div>'; }).join('') + '</div>' +
      '<div class="relative h-4"><div class="absolute -top-3.5 w-3 h-3 -ml-1.5 rotate-45 bg-seal" style="left:' + pos + '%"></div></div>' +
      '<div class="flex text-[11.5px] text-ink3 -mt-1">' + marks.map(function (m) { return '<div style="width:' + (m[2] - m[1]) + '%" class="' + (m[0] === A.strength ? 'text-ink font-semibold' : '') + '">' + m[0] + '</div>'; }).join('') + '</div>';

    // 용신
    $('yongsin').innerHTML =
      '<div class="flex flex-wrap gap-2">' + elChip(yong.el, '용신') + elChip(yong.heeEl, '희신') + elChip(yong.giEl, '기신') + (yong.johu !== null && yong.johu !== yong.el ? elChip(yong.johu, '조후') : '') + '</div>' +
      '<p class="text-[14px] text-ink2 leading-6 mt-3">' + esc(yong.why) + (yong.johu !== null && yong.johuWhy && yong.why.indexOf(yong.johuWhy) < 0 ? ' ' + esc(yong.johuWhy) : '') + '</p>';

    // 십성 그룹
    var GROUP_DESC = { '비겁': '나·동료·경쟁', '식상': '표현·재능·자녀', '재성': '돈·결과·현실', '관성': '직장·명예·규칙', '인성': '학문·문서·도움' };
    var maxG = Math.max.apply(null, A.groupPct);
    $('groups').innerHTML = I.GROUPS.map(function (gname, i) {
      var tens = I.TEN.slice(i * 2, i * 2 + 2).map(function (t) { return t + ' ' + A.tenCount[t]; }).join(' · ');
      return '<div class="grid grid-cols-[52px_1fr_52px] items-center gap-3"><div class="text-[14px] font-semibold">' + gname + '</div>' +
        '<div><div class="h-2.5 bg-line/50 rounded-[2px] overflow-hidden"><div class="h-full rounded-[2px] ' + (A.groupPct[i] === maxG ? 'bg-seal' : 'bg-ink/60') + '" style="width:' + Math.max(A.groupPct[i], 0.5) + '%"></div></div>' +
        '<div class="text-[11.5px] text-ink3 mt-1">' + GROUP_DESC[gname] + ' · ' + tens + '</div></div>' +
        '<div class="text-right text-[13px] font-semibold">' + A.groupPct[i].toFixed(0) + '%</div></div>';
    }).join('');

    // 신살·합충
    var seen = {}, salItems = [];
    A.shinsal.forEach(function (s) { if (!seen[s.name]) { seen[s.name] = { desc: s.desc, pos: [] }; salItems.push(s.name); } seen[s.name].pos.push(labels[s.pos]); });
    var sh = salItems.length ? '<ul class="divide-y divide-line border-y border-line">' + salItems.map(function (n) {
      return '<li class="py-2.5 grid grid-cols-[76px_1fr] gap-3"><b class="font-semibold text-[14px]">' + n + '</b><span class="text-[13.5px] text-ink2">' + seen[n].desc + ' <span class="text-ink3">· ' + seen[n].pos.join(', ') + '</span></span></li>';
    }).join('') + '</ul>' : '<p class="text-[14px] text-ink3">두드러진 신살이 없습니다.</p>';
    if (A.relations.length) {
      sh += '<div class="flex flex-wrap gap-1.5 mt-4">' + A.relations.map(function (x) {
        return '<span class="inline-flex items-center gap-1.5 border rounded-[3px] px-2 py-1 text-[13px] ' + (x.good ? 'border-ink/30' : 'border-seal/40 text-seal') + '"><span class="font-serif font-bold">' + x.text + '</span><span class="text-ink3 text-[11.5px]">' + x.where + '</span></span>';
      }).join('') + '</div>';
    }
    $('sals').innerHTML = sh;

    // 대운·세운
    function luckCard(item, top, current) {
      var lc = item.luck.label === '좋음' ? 'text-seal' : item.luck.label === '주의' ? 'text-ink3' : 'text-ink2';
      return '<div class="w-[84px] shrink-0 border ' + (current ? 'border-seal bg-card' : 'border-line') + ' rounded-[3px] p-2 text-center">' +
        '<div class="text-[12px] leading-tight ' + (current ? 'text-seal font-semibold' : 'text-ink3') + '">' + top + '</div>' +
        '<div class="grid gap-1 mt-1.5">' + tile(M.STEMS[item.ganji.stem], item.stemTen, item.stemEl, item.ganji.stem % 2 === 0) + tile(M.BRANCHES[item.ganji.branch], item.branchTen, item.branchEl, item.ganji.branch % 2 === 0) + '</div>' +
        '<div class="text-[12px] font-semibold mt-1.5 ' + lc + '">' + item.luck.label + '</div></div>';
    }
    if (A.daeun) {
      $('daeunInfo').textContent = '대운수 ' + r.daeun.startAge + ' · ' + (r.daeun.forward ? '순행' : '역행') + ' (' + r.daeun.basis + '까지 ' + r.daeun.days.toFixed(1) + '일)';
      $('daeun').innerHTML = A.daeun.map(function (d) { return luckCard(d, '<b class="text-[13px] font-semibold ' + (A.currentDaeun === d ? '' : 'text-ink') + '">' + d.age + '세</b><br>' + d.year + '~', A.currentDaeun === d); }).join('');
    }
    $('seun').innerHTML = A.seun.map(function (s, i) { return luckCard(s, s.year + '년', i === 0); }).join('');

    // 리포트 탭
    var keys = ['personality', 'love', 'career', 'wealth'];
    $('tabs').innerHTML = keys.map(function (k, i) {
      return '<button role="tab" type="button" data-k="' + k + '" aria-selected="' + (i === 0) + '" class="tab shrink-0 px-4 h-11 -mb-px border-b-2 border-transparent text-[15px] font-semibold text-ink3">' + A.reports[k].title + '</button>';
    }).join('');
    showReport('personality');
  }

  function showReport(k) {
    var rep = current.A.reports[k];
    document.querySelectorAll('#tabs .tab').forEach(function (t) { t.setAttribute('aria-selected', String(t.dataset.k === k)); });
    $('report').innerHTML =
      '<p class="font-serif font-bold text-[19px] sm:text-[22px] leading-snug">' + esc(rep.headline) + '</p>' +
      '<div class="flex flex-wrap gap-1.5 mt-3">' + rep.keywords.map(function (w) { return '<span class="text-[12.5px] border border-line rounded-full px-2.5 py-0.5 text-ink2">' + esc(w) + '</span>'; }).join('') + '</div>' +
      '<div class="mt-5 space-y-3.5 text-[15.5px] leading-[1.85] max-w-3xl">' + rep.paragraphs.map(function (p) {
        var m = /^(\d{4}년\([^)]*\)):\s*/.exec(p);
        return m ? '<p class="pl-3 border-l-2 border-seal/60"><b class="font-semibold">' + esc(m[1]) + '</b> ' + esc(p.slice(m[0].length)) + '</p>' : '<p>' + esc(p) + '</p>';
      }).join('') + '</div>';
  }
  $('tabs').addEventListener('click', function (e) { var b = e.target.closest('.tab'); if (b) showReport(b.dataset.k); });

  // ───────── 버튼 ─────────
  function copy(text, btn) {
    var done = function () { var o = btn.textContent; btn.textContent = '복사됨'; setTimeout(function () { btn.textContent = o; }, 1400); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    else fallback();
    function fallback() { var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (x) { } ta.remove(); }
  }
  $('btnLink').addEventListener('click', function () { copy(location.href, this); });
  $('btnText').addEventListener('click', function () {
    var A = current.A, P = current.res.pillars, out = [];
    out.push('[사주 원국] ' + ['hour', 'day', 'month', 'year'].map(function (k) { return P[k] ? P[k].hanja : '??'; }).join(' ') + ' (시일월년)');
    out.push('일간 ' + A.dmHanja + '(' + A.dmKo + ') · ' + A.strength + ' · 용신 ' + EL[A.yongsin.el] + '(' + ELH[A.yongsin.el] + ')');
    ['personality', 'love', 'career', 'wealth'].forEach(function (k) { var r = A.reports[k]; out.push('\n■ ' + r.title + ' — ' + r.headline); r.paragraphs.forEach(function (p) { out.push('- ' + p); }); });
    out.push('\n' + location.href);
    copy(out.join('\n'), this);
  });
  $('btnEdit').addEventListener('click', function () { $('formSec').scrollIntoView({ behavior: 'smooth' }); $('name').focus({ preventScroll: true }); });

  if (fromQuery()) run(false);
})();
