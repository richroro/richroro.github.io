/* 오늘의 경제 — data/ 의 JSON 을 읽어 그린다. 수집은 fetch_news.py(깃허브 액션)가 한다. */
(function () {
  'use strict';

  var CATS = [
    ['all', '전체'], ['market', '증시'], ['macro', '금리·환율'], ['estate', '부동산'],
    ['industry', '산업·기업'], ['global', '국제'], ['crypto', '가상자산'], ['general', '경제일반'], ['saved', '저장한 기사']
  ];
  var CAT_NAME = {};
  CATS.forEach(function (c) { CAT_NAME[c[0]] = c[1]; });
  var PAGE = 40;
  var POLL_MS = 5 * 60 * 1000;
  var TZ = 'Asia/Seoul';

  var $ = function (id) { return document.getElementById(id); };
  var state = { cat: 'all', q: '', src: '', day: '24h', limit: PAGE };
  var index = null, dayCache = {}, items = [], openRel = {};

  // ── 저장소(브라우저) ────────────────────────────────────────────────────
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 개인 창 등 */ } }
  var saved = lsGet('news.saved', []);
  var readIds = new Set(lsGet('news.read', []));
  function isSaved(id) { return saved.some(function (s) { return s.id === id; }); }
  function toggleSave(it) {
    if (isSaved(it.id)) saved = saved.filter(function (s) { return s.id !== it.id; });
    else saved.unshift(it);
    saved = saved.slice(0, 300);
    lsSet('news.saved', saved);
  }
  function markRead(id) {
    readIds.add(id);
    var arr = Array.from(readIds);
    if (arr.length > 1500) arr = arr.slice(arr.length - 1500);
    lsSet('news.read', arr);
  }

  // ── 글자 ───────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function safeHref(u) { return /^https:\/\//i.test(u || '') ? u : '#'; }
  function hl(text, q) {
    if (!q) return esc(text);
    var t = String(text), lo = t.toLowerCase(), ql = q.toLowerCase(), out = '', i = 0, j;
    while ((j = lo.indexOf(ql, i)) !== -1) {
      out += esc(t.slice(i, j)) + '<mark>' + esc(t.slice(j, j + q.length)) + '</mark>';
      i = j + q.length;
    }
    return out + esc(t.slice(i));
  }

  // ── 시간 ───────────────────────────────────────────────────────────────
  var fmtDate = new Intl.DateTimeFormat('ko-KR', { timeZone: TZ, year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  var fmtMD = new Intl.DateTimeFormat('ko-KR', { timeZone: TZ, month: 'long', day: 'numeric', weekday: 'short' });
  var fmtHM = new Intl.DateTimeFormat('ko-KR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
  var fmtYMD = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  function ymd(sec) { return fmtYMD.format(new Date(sec * 1000)); }
  function hm(sec) { return fmtHM.format(new Date(sec * 1000)); }
  function ago(sec) {
    var d = Date.now() / 1000 - sec;
    if (d < 90) return '방금';
    if (d < 3600) return Math.round(d / 60) + '분 전';
    if (d < 86400) return Math.floor(d / 3600) + '시간 전';
    return fmtMD.format(new Date(sec * 1000)) + ' ' + hm(sec);
  }
  function dayLabel(date) {
    var d = new Date(date + 'T12:00:00+09:00');
    return fmtMD.format(d);
  }

  // ── 자료 읽기 ───────────────────────────────────────────────────────────
  function getJSON(path, bust) {
    return fetch(path + '?v=' + encodeURIComponent(bust || Date.now()), { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(path + ' ' + r.status);
      return r.json();
    });
  }
  function loadDay(date) {
    if (dayCache[date]) return Promise.resolve(dayCache[date]);
    return getJSON('data/days/' + date + '.json', index.updated).then(function (d) {
      dayCache[date] = d.items || [];
      return dayCache[date];
    }).catch(function () { return []; });
  }
  function loadItems() {
    if (!index || !index.days || !index.days.length) { items = []; return Promise.resolve(); }
    var dates = state.day === '24h' ? index.days.slice(0, 2).map(function (d) { return d.date; }) : [state.day];
    return Promise.all(dates.map(loadDay)).then(function (lists) {
      var seen = {}, all = [];
      lists.forEach(function (l) { l.forEach(function (it) { if (!seen[it.id]) { seen[it.id] = 1; all.push(it); } }); });
      if (state.day === '24h') {
        var ref = Math.min(Date.now() / 1000, index.updated || Date.now() / 1000);
        all = all.filter(function (it) { return it.time >= ref - 86400; });
      }
      all.sort(function (a, b) { return b.time - a.time; });
      items = all;
    });
  }

  // ── 거르기·묶기 ─────────────────────────────────────────────────────────
  function matches(it, opts) {
    if (opts.src && it.source !== opts.src) return false;
    if (opts.cat && opts.cat !== 'all' && opts.cat !== 'saved' && it.cat !== opts.cat) return false;
    if (opts.q) {
      var q = opts.q.toLowerCase();
      if ((it.title + ' ' + (it.summary || '') + ' ' + it.source).toLowerCase().indexOf(q) === -1) return false;
    }
    return true;
  }
  function pool() { return state.cat === 'saved' ? saved.slice() : items; }
  function filtered() {
    var o = { cat: state.cat, q: state.q, src: state.src };
    return pool().filter(function (it) { return matches(it, o); });
  }
  function groups(list) {
    var map = {}, order = [];
    list.forEach(function (it) {
      var k = it.cluster || it.id;
      if (!map[k]) { map[k] = []; order.push(k); }
      map[k].push(it);
    });
    return order.map(function (k) {
      var arr = map[k].sort(function (a, b) { return b.time - a.time; });
      var srcs = {};
      arr.forEach(function (it) { srcs[it.source] = 1; });
      return { key: k, items: arr, sources: Object.keys(srcs).length, latest: arr[0].time, rep: pickRep(arr) };
    });
  }
  // 대표 기사: 직접 받은 기사 > 모음 기사, [속보] 아닌 것, 요약 있는 것, 그다음 최신
  function pickRep(arr) {
    function score(it) {
      return (it.via ? 0 : 4) + (/^\s*[\[(【]?\s*속보/.test(it.title) ? 0 : 2) + (it.summary ? 1 : 0) + (it.image ? 0.5 : 0);
    }
    return arr.slice().sort(function (a, b) { return score(b) - score(a) || b.time - a.time; })[0];
  }

  // ── 그리기: 공통 조각 ───────────────────────────────────────────────────
  var STAR = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.2l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7z"/></svg>';
  var STAR_O = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3.2l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7z"/></svg>';
  function chip(cat) { return '<span class="chip c-' + esc(cat) + '">' + esc(CAT_NAME[cat] || '경제일반') + '</span>'; }
  function starBtn(it) {
    var on = isSaved(it.id);
    return '<button class="star" type="button" data-save="' + esc(it.id) + '" aria-pressed="' + on + '" aria-label="' + (on ? '저장 취소' : '저장') + '">' + (on ? STAR : STAR_O) + '</button>';
  }
  function byline(g, it) {
    var h = chip(it.cat) + '<span class="src">' + esc(it.source) + '</span><span>' + esc(ago(it.time)) + '</span>';
    if (g && g.sources > 1) h += '<span class="many">' + g.sources + '개 매체</span>';
    return '<div class="byline">' + h + '</div>';
  }
  function relList(g, rep, max) {
    var others = g.items.filter(function (x) { return x.id !== rep.id; });
    if (!others.length) return '';
    var open = openRel[g.key], show = open ? others : others.slice(0, max);
    var h = '<ul class="rel">' + show.map(function (x) {
      return '<li><a href="' + esc(safeHref(x.url)) + '" target="_blank" rel="noopener noreferrer" data-read="' + esc(x.id) + '">' + hl(x.title, state.q) +
        '</a> <span class="s">' + esc(x.source) + ' · ' + esc(hm(x.time)) + '</span></li>';
    }).join('') + '</ul>';
    if (others.length > max) {
      h += '<button class="more-rel" type="button" data-rel="' + esc(g.key) + '">' +
        (open ? '접기' : '관련 기사 ' + (others.length - max) + '건 더 보기') + '</button>';
    }
    return h;
  }
  function itemLink(it, inner) {
    return '<a class="hl" href="' + esc(safeHref(it.url)) + '" target="_blank" rel="noopener noreferrer" data-read="' + esc(it.id) + '">' + inner + '</a>';
  }

  // ── 그리기: 주요 뉴스 ───────────────────────────────────────────────────
  function renderTop(gs) {
    var sec = $('top-sec');
    var ranked = gs.filter(function (g) { return g.sources >= 2; }).sort(function (a, b) {
      return b.sources - a.sources || b.items.length - a.items.length || b.latest - a.latest;
    }).slice(0, 5);
    if (!ranked.length || state.cat === 'saved') { sec.hidden = true; return {}; }
    sec.hidden = false;
    $('top-title').textContent = state.cat === 'all' ? '주요 뉴스' : CAT_NAME[state.cat] + ' 주요 뉴스';
    var lead = ranked[0], r = lead.rep;
    var leadImg = r.image || (lead.items.filter(function (x) { return x.image; })[0] || {}).image;
    var h = '<article class="story lead' + (readIds.has(r.id) ? ' read' : '') + '">';
    if (leadImg) h += itemLink(r, '<div class="img"><img src="' + esc(safeHref(leadImg)) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.remove()"></div>');
    h += byline(lead, r) + itemLink(r, '<h3>' + hl(r.title, state.q) + '</h3>');
    if (r.summary) h += '<p>' + hl(r.summary, state.q) + '</p>';
    h += relList(lead, r, 4) + '</article><div class="subs">';
    ranked.slice(1).forEach(function (g) {
      var it = g.rep;
      h += '<article class="story sub' + (readIds.has(it.id) ? ' read' : '') + '">' + byline(g, it) +
        itemLink(it, '<h3>' + hl(it.title, state.q) + '</h3>') + relList(g, it, 2) + '</article>';
    });
    $('top').innerHTML = h + '</div>';
    var used = {};
    ranked.forEach(function (g) { used[g.key] = 1; });
    return used;
  }

  // ── 그리기: 목록 ────────────────────────────────────────────────────────
  function renderList(gs, used) {
    var rest = gs.filter(function (g) { return !used[g.key]; }).sort(function (a, b) { return b.latest - a.latest; });
    var shown = rest.slice(0, state.limit);
    var h = '', lastDay = null, multiDay = state.day === '24h' || state.cat === 'saved';
    if (!rest.length) {
      h = '<div class="empty"><b>' + (state.cat === 'saved' ? '저장한 기사가 없습니다' : '조건에 맞는 기사가 없습니다') + '</b>' +
        (state.cat === 'saved' ? '기사 옆 ☆ 를 누르면 이 브라우저에 저장됩니다.' : '검색어나 분야·매체·기간을 바꿔 보세요.') + '</div>';
    }
    shown.forEach(function (g) {
      var it = g.rep, d = ymd(it.time);
      if (multiDay && d !== lastDay) {
        if (lastDay !== null || ymd(Date.now() / 1000) !== d) h += '<div class="day-sep">' + esc(dayLabel(d)) + '</div>';
        lastDay = d;
      }
      h += '<article class="row story' + (readIds.has(it.id) ? ' read' : '') + '">' +
        '<div class="tm">' + esc(hm(it.time)) + '</div><div>' +
        itemLink(it, '<div class="t">' + hl(it.title, state.q) + '</div>') +
        (it.summary ? '<div class="d">' + hl(it.summary, state.q) + '</div>' : '') +
        byline(g, it) + relList(g, it, 2) + '</div>' + starBtn(it) + '</article>';
    });
    $('list').innerHTML = h;
    $('more').hidden = rest.length <= state.limit;
    $('more').textContent = '더 보기 (' + (rest.length - shown.length) + '건 남음)';
    var arts = rest.reduce(function (n, g) { return n + g.items.length; }, 0);
    $('list-count').textContent = rest.length ? ('사건 ' + rest.length + '개 · 기사 ' + arts + '건') : '';
    $('list-title').textContent = state.cat === 'saved' ? '저장한 기사' : (state.q ? '‘' + state.q + '’ 검색 결과' : '최신 뉴스');
  }

  // ── 그리기: 탭·사이드 ───────────────────────────────────────────────────
  function renderTabs() {
    var base = items.filter(function (it) { return matches(it, { q: state.q, src: state.src }); });
    var cnt = { all: groups(base).length, saved: saved.length };
    CATS.forEach(function (c) {
      if (c[0] !== 'all' && c[0] !== 'saved') cnt[c[0]] = groups(base.filter(function (it) { return it.cat === c[0]; })).length;
    });
    $('tabs').innerHTML = CATS.map(function (c) {
      return '<button class="tab" role="tab" type="button" data-cat="' + c[0] + '" aria-selected="' + (state.cat === c[0]) + '">' +
        esc(c[1]) + '<span class="n">' + (cnt[c[0]] || 0) + '</span></button>';
    }).join('');
  }
  function bars(el, rows, attr, colorOf) {
    var max = rows.reduce(function (m, r) { return Math.max(m, r[1]); }, 1);
    el.innerHTML = rows.map(function (r) {
      return '<button class="brow" type="button" data-' + attr + '="' + esc(r[0]) + '"><span class="l">' + esc(r[2] || r[0]) +
        '</span><span class="track"><span class="fill" style="width:' + (r[1] / max * 100).toFixed(1) + '%;--c:' + colorOf(r[0]) + '"></span></span>' +
        '<span class="v">' + r[1] + '</span></button>';
    }).join('') || '<div class="note">아직 기사가 없습니다.</div>';
  }
  function renderSide() {
    var period = state.day === '24h' ? '최근 24시간' : dayLabel(state.day);
    var cc = {}, sc = {};
    items.forEach(function (it) { cc[it.cat] = (cc[it.cat] || 0) + 1; sc[it.source] = (sc[it.source] || 0) + 1; });
    $('cat-span').textContent = period;
    $('src-span').textContent = period;
    bars($('cats'), CATS.filter(function (c) { return cc[c[0]]; }).map(function (c) { return [c[0], cc[c[0]], c[1]]; })
      .sort(function (a, b) { return b[1] - a[1]; }), 'cat', function (k) { return 'var(--chip-' + k + ')'; });
    bars($('srcs'), Object.keys(sc).map(function (k) { return [k, sc[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 12),
      'src', function () { return 'var(--accent)'; });

    var kw = (index && index.keywords) || [];
    $('kw').innerHTML = kw.length ? kw.map(function (k, i) {
      return '<button type="button" class="r' + (i + 1) + '" data-q="' + esc(k[0]) + '" aria-pressed="' + (state.q === k[0]) + '"><b>' + esc(k[0]) + '</b><i>' + k[1] + '</i></button>';
    }).join('') : '<div class="note">키워드를 모으는 중입니다.</div>';

    var feeds = (index && index.feeds) || [], by = {};
    feeds.forEach(function (f) {
      var b = by[f.source] || (by[f.source] = { ok: 0, n: 0, err: [] });
      b.n++; if (f.ok) b.ok++; else b.err.push(f.error || '');
    });
    $('feeds').innerHTML = Object.keys(by).map(function (s) {
      var b = by[s], bad = b.ok < b.n;
      return '<div title="' + esc(b.err.join('\n')) + '"><span><i class="dot' + (bad ? ' bad' : '') + '"></i>' + esc(s) + '</span>' +
        '<span class="' + (bad ? 'bad' : '') + '">' + b.ok + '/' + b.n + '</span></div>';
    }).join('') || '<div class="note">아직 수집 기록이 없습니다.</div>';
  }
  function renderSources() {
    var sel = $('src'), cur = state.src, set = {};
    items.forEach(function (it) { set[it.source] = (set[it.source] || 0) + 1; });
    if (cur && !set[cur]) set[cur] = 0;
    sel.innerHTML = '<option value="">모든 매체</option>' + Object.keys(set).sort(function (a, b) { return set[b] - set[a] || a.localeCompare(b, 'ko'); })
      .map(function (s) { return '<option value="' + esc(s) + '"' + (s === cur ? ' selected' : '') + '>' + esc(s) + ' (' + set[s] + ')</option>'; }).join('');
  }
  function renderDays() {
    var days = (index && index.days) || [];
    $('day').innerHTML = '<option value="24h">최근 24시간</option>' + days.map(function (d) {
      return '<option value="' + esc(d.date) + '"' + (state.day === d.date ? ' selected' : '') + '>' + esc(dayLabel(d.date)) + ' · ' + d.count + '건</option>';
    }).join('');
    $('day').value = state.day;
  }
  function renderStamp() {
    $('today').textContent = fmtDate.format(new Date());
    if (!index) return;
    if (!index.updated) { $('stamp').textContent = '아직 수집된 자료가 없습니다'; return; }
    var ok = (index.feeds || []).filter(function (f) { return f.ok; }).length;
    var srcN = {};
    (index.feeds || []).forEach(function (f) { srcN[f.source] = 1; });
    $('stamp').innerHTML = '업데이트 <b>' + esc(ago(index.updated)) + '</b> · ' + Object.keys(srcN).length + '개 언론사 · 피드 ' + ok + '/' + (index.feeds || []).length;
  }

  // ── 그리기: 시장 지표 ───────────────────────────────────────────────────
  function fmtPrice(m) {
    var p = m.price, d = Math.abs(p) >= 10000 ? 0 : 2;
    var s = p.toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d });
    if (m.unit === '$') return '$' + s;
    if (m.unit === '%') return s + '%';
    if (m.unit === '원') return s + '원';
    return s;
  }
  function spark(vals, cls) {
    if (!vals || vals.length < 2) return '';
    var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals), rg = mx - mn || 1;
    var pts = vals.map(function (v, i) { return (i / (vals.length - 1) * 56).toFixed(1) + ',' + (24 - (v - mn) / rg * 22 + 1).toFixed(1); });
    return '<svg viewBox="0 0 56 26" class="' + cls + '" aria-hidden="true"><polyline points="' + pts.join(' ') +
      '" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  }
  function renderMarkets(data) {
    var rows = (data && data.items) || [];
    if (!rows.length) { $('ticker').innerHTML = '<div class="ticker-empty">시장 지표가 아직 없습니다.</div>'; return; }
    $('ticker').innerHTML = rows.map(function (m) {
      var cls = m.change > 0 ? 'up' : m.change < 0 ? 'down' : 'flat';
      var arrow = m.change > 0 ? '▲' : m.change < 0 ? '▼' : '–';
      var t = m.name + ' · ' + new Date(m.time * 1000).toLocaleString('ko-KR', { timeZone: TZ }) + ' 기준' + (m.stale ? ' (갱신 실패, 이전 값)' : '');
      return '<div class="tk' + (m.stale ? ' stale' : '') + '" title="' + esc(t) + '"><span class="nm">' + esc(m.name) + '</span>' +
        '<span class="px">' + esc(fmtPrice(m)) + '</span><span class="ch ' + cls + '">' + arrow + ' ' + Math.abs(m.pct).toFixed(2) + '%</span>' +
        spark(m.spark, cls) + '</div>';
    }).join('');
  }

  // ── 전체 그리기 ─────────────────────────────────────────────────────────
  function render() {
    if (index && (!index.days || !index.days.length)) {
      $('top-sec').hidden = true;
      $('list').innerHTML = '<div class="empty"><b>첫 수집을 기다리는 중입니다</b>깃허브 액션이 언론사 RSS 를 모으면 여기에 뉴스가 뜹니다. 보통 한 시간 안에 시작됩니다.</div>';
    } else {
      var gs = groups(filtered());
      var used = renderTop(gs);
      renderList(gs, used);
    }
    renderTabs();
    renderSide();
    renderStamp();
  }

  // ── 주소창과 상태 맞추기 ────────────────────────────────────────────────
  function readHash() {
    var p = new URLSearchParams(location.hash.slice(1));
    state.cat = CAT_NAME[p.get('cat')] ? p.get('cat') : 'all';
    state.q = p.get('q') || '';
    state.src = p.get('src') || '';
    state.day = p.get('day') || '24h';
    $('q').value = state.q;
  }
  function writeHash() {
    var p = new URLSearchParams();
    if (state.cat !== 'all') p.set('cat', state.cat);
    if (state.q) p.set('q', state.q);
    if (state.src) p.set('src', state.src);
    if (state.day !== '24h') p.set('day', state.day);
    var h = p.toString();
    history.replaceState(null, '', h ? '#' + h : location.pathname + location.search);
  }
  function update(patch, reload) {
    Object.keys(patch).forEach(function (k) { state[k] = patch[k]; });
    state.limit = PAGE;
    openRel = {};
    writeHash();
    (reload ? loadItems() : Promise.resolve()).then(function () { renderSources(); render(); });
  }

  // ── 이벤트 ─────────────────────────────────────────────────────────────
  $('tabs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-cat]');
    if (b) update({ cat: b.getAttribute('data-cat') });
  });
  $('cats').addEventListener('click', function (e) {
    var b = e.target.closest('[data-cat]');
    if (b) { update({ cat: b.getAttribute('data-cat') }); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  });
  $('srcs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-src]');
    if (b) { update({ src: state.src === b.getAttribute('data-src') ? '' : b.getAttribute('data-src') }); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  });
  $('kw').addEventListener('click', function (e) {
    var b = e.target.closest('[data-q]');
    if (!b) return;
    var q = b.getAttribute('data-q');
    q = state.q === q ? '' : q;
    $('q').value = q;
    update({ q: q });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  var qTimer;
  $('q').addEventListener('input', function () {
    clearTimeout(qTimer);
    var v = this.value.trim();
    qTimer = setTimeout(function () { update({ q: v }); }, 180);
  });
  $('src').addEventListener('change', function () { update({ src: this.value }); });
  $('day').addEventListener('change', function () { update({ day: this.value }, true); });
  $('more').addEventListener('click', function () { state.limit += PAGE; render(); });
  document.addEventListener('click', function (e) {
    var s = e.target.closest('[data-save]');
    if (s) {
      var id = s.getAttribute('data-save');
      var it = items.filter(function (x) { return x.id === id; })[0] || saved.filter(function (x) { return x.id === id; })[0];
      if (it) { toggleSave(it); render(); }
      return;
    }
    var r = e.target.closest('[data-rel]');
    if (r) { var k = r.getAttribute('data-rel'); openRel[k] = !openRel[k]; render(); return; }
    var a = e.target.closest('[data-read]');
    if (a) {
      markRead(a.getAttribute('data-read'));
      var st = a.closest('.story');
      if (st) st.classList.add('read');
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && document.activeElement !== $('q') && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) {
      e.preventDefault(); $('q').focus();
    } else if (e.key === 'Escape' && document.activeElement === $('q')) {
      $('q').value = ''; update({ q: '' }); $('q').blur();
    }
  });
  window.addEventListener('hashchange', function () {
    var prevDay = state.day;
    readHash();
    renderDays();
    loadItems().then(function () { if (prevDay !== state.day) renderSources(); render(); });
  });

  // 테마: 시스템 → 밝게 → 어둡게
  var theme = lsGet('news.theme', '');
  function applyTheme() {
    if (theme) document.documentElement.setAttribute('data-theme', theme);
    else document.documentElement.removeAttribute('data-theme');
  }
  applyTheme();
  $('theme').addEventListener('click', function () {
    var dark = matchMedia('(prefers-color-scheme: dark)').matches;
    var cur = theme || (dark ? 'dark' : 'light');
    theme = cur === 'dark' ? 'light' : 'dark';
    if ((theme === 'dark') === dark) theme = '';
    lsSet('news.theme', theme);
    applyTheme();
  });

  // ── 새 기사 확인 ───────────────────────────────────────────────────────
  function refresh() {
    dayCache = {};
    return getJSON('data/index.json').then(function (idx) {
      index = idx;
      $('fresh').classList.remove('on');
      renderDays();
      return Promise.all([loadItems(), getJSON('data/markets.json', idx.updated).then(renderMarkets).catch(function () { renderMarkets(null); })]);
    }).then(function () { renderSources(); render(); });
  }
  function poll() {
    if (document.hidden || !index) return;
    getJSON('data/index.json').then(function (idx) {
      if (idx.updated > index.updated) {
        var before = (index.days[0] || {}).count || 0, after = (idx.days[0] || {}).count || 0;
        $('fresh').textContent = after > before ? '새 기사 ' + (after - before) + '건' : '새로 고침';
        $('fresh').classList.add('on');
      }
      renderStamp();
    }).catch(function () {});
  }
  $('fresh').addEventListener('click', function () { refresh(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  setInterval(poll, POLL_MS);
  setInterval(renderStamp, 60 * 1000);
  document.addEventListener('visibilitychange', poll);

  // ── 시작 ───────────────────────────────────────────────────────────────
  readHash();
  renderStamp();
  refresh().catch(function () {
    index = { days: [], feeds: [], keywords: [] };
    renderDays();
    render();
    renderMarkets(null);
  });
})();
