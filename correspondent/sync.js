/* ============================================================================
   공용 보드 — PostgREST + GoTrue 에 fetch 로 직접 붙는다.

   라이브러리를 안 쓰는 이유: 이 저장소의 앱들은 외부 스크립트 없이 도는 게 원칙이다.
   supabase-js 는 120KB 인데 여기서 쓰는 건 표 몇 개에 대한 GET/POST/DELETE, 서버 함수 부르기,
   토큰 갱신뿐이라 직접 부르는 편이 짧고 읽기 쉽다. 앱(app.js)과 운영 화면(admin.js)이 함께 쓴다.

   지키는 규칙 하나: 링크로 받은 리포트는 서버에 올리지 않는다.
   남이 쓴 글을 내 계정으로 올리면 작성자가 세탁된다. 내가 쓴 것(mine)만 올라간다.
   ========================================================================== */
(function (global) {
  "use strict";

  const CFG = global.TPW_CONFIG || {};
  const SKEY = "tpw.session";
  const enabled = !!(CFG.url && CFG.anonKey);
  const api = (p) => CFG.url.replace(/\/+$/, "") + p;

  const store = {
    get(k, fb) { try { const v = localStorage.getItem(k); return v == null ? fb : JSON.parse(v); } catch (e) { return fb; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  let session = store.get(SKEY, null);   // {access_token, refresh_token, expires_at, uid}

  function saveSession(s) {
    if (!s || !s.access_token) { session = null; store.del(SKEY); return null; }
    session = {
      access_token: s.access_token,
      refresh_token: s.refresh_token,
      expires_at: s.expires_at || (Math.floor(Date.now() / 1000) + (s.expires_in || 3600)),
      uid: s.user ? s.user.id : (session && session.uid)
    };
    store.set(SKEY, session);
    return session;
  }

  /* ─────────────────────────── 요청 ─────────────────────────── */
  async function call(path, opt, retry) {
    opt = opt || {};
    const h = Object.assign({ apikey: CFG.anonKey, "Content-Type": "application/json" }, opt.headers || {});
    if (session && session.access_token) h.Authorization = "Bearer " + session.access_token;
    const res = await fetch(api(path), { method: opt.method || "GET", headers: h, body: opt.body });
    if (res.status === 401 && session && session.refresh_token && !retry) {
      if (await refresh()) return call(path, opt, true);
    }
    if (!res.ok) {
      let msg = res.status + "";
      try { const j = await res.json(); msg = j.message || j.error_description || j.hint || msg; } catch (e) {}
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    if (res.status === 204) return null;
    const txt = await res.text();
    return txt ? JSON.parse(txt) : null;
  }

  async function refresh() {
    try {
      const res = await fetch(api("/auth/v1/token?grant_type=refresh_token"), {
        method: "POST",
        headers: { apikey: CFG.anonKey, "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: session.refresh_token })
      });
      if (!res.ok) { saveSession(null); return false; }
      saveSession(await res.json());
      return true;
    } catch (e) { return false; }
  }

  /* ─────────────────────────── 로그인 ─────────────────────────── */
  const here = () => location.origin + location.pathname;

  function signInKakao() {
    location.href = api("/auth/v1/authorize?provider=kakao&redirect_to=" + encodeURIComponent(here()));
  }
  /* 카카오 심사 전에 시험할 때 쓰는 길. 메일로 온 링크를 누르면 같은 해시로 돌아온다. */
  function signInEmail(email) {
    return call("/auth/v1/otp", { method: "POST", body: JSON.stringify({ email, options: { email_redirect_to: here() } }) });
  }
  function signOut() {
    const had = !!session;
    if (had) call("/auth/v1/logout", { method: "POST" }).catch(() => {});
    saveSession(null);
    return had;
  }

  /* 로그인하고 돌아오면 토큰이 해시에 실려 온다.
     이 앱은 해시를 이미 #r= 로 쓰고 있으므로, 토큰만 걷어내고 나머지는 그대로 둔다. */
  function consumeAuthHash() {
    const h = location.hash.slice(1);
    if (!h || h.indexOf("access_token=") === -1) return false;
    const q = new URLSearchParams(h);
    saveSession({
      access_token: q.get("access_token"),
      refresh_token: q.get("refresh_token"),
      expires_in: Number(q.get("expires_in")) || 3600
    });
    q.delete("access_token"); q.delete("refresh_token"); q.delete("expires_in");
    q.delete("token_type"); q.delete("type"); q.delete("provider_token");
    const rest = q.toString();
    history.replaceState(null, "", location.pathname + location.search + (rest ? "#" + rest : ""));
    return true;
  }

  async function whoami() {
    if (!session) return null;
    if (session.uid) return session.uid;
    const u = await call("/auth/v1/user");
    session.uid = u && u.id;
    store.set(SKEY, session);
    return session.uid;
  }

  /* ─────────────────────────── 표 ─────────────────────────── */
  const rest = "/rest/v1";

  const listHoods = () => call(rest + "/hoods?select=code,label,sido,sigungu,dong&active=is.true&order=label");

  async function myProfile() {
    const uid = await whoami();
    if (!uid) return null;
    const rows = await call(rest + "/correspondents?select=id,name,hood_code,banned_until&id=eq." + uid);
    return rows && rows[0] ? rows[0] : null;
  }

  /* 프로필은 함수로만 쓴다(policies.sql 의 save_profile 설명). 누구의 것인지는 서버가 토큰에서 정한다. */
  function saveProfile(name, hoodCode) {
    if (!session) return Promise.reject(new Error("로그인이 필요합니다"));
    return call(rest + "/rpc/save_profile", {
      method: "POST",
      body: JSON.stringify({ p_name: name, p_hood: hoodCode || null })
    });
  }

  /* 동네 속보를 받아 온다. since 를 주면 그 뒤로 들어온 것만. */
  function pull(hood, since, limit) {
    let q = rest + "/reports?select=id,by_name,t,cat,place,area,wait,crowd,park,rate,tags,note,mine,hidden" +
      "&hood_code=eq." + encodeURIComponent(hood) + "&order=t.desc&limit=" + (limit || 200);
    if (since) q += "&t=gt." + encodeURIComponent(since);
    return call(q);
  }

  /* 내가 쓴 것만 올라간다. 서버가 author 와 이름을 토큰에서 다시 채운다. */
  function push(r, hood) {
    return call(rest + "/reports", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        id: r.id, author: null, by_name: r.by, t: new Date(r.t).toISOString(), hood_code: hood,
        cat: r.cat, place: r.place, area: r.area, wait: r.wait, crowd: r.crowd,
        park: r.park, rate: r.rate, tags: r.tags, note: r.note
      })
    });
  }

  const flag = (id, reason) =>
    call(rest + "/flags", { method: "POST", body: JSON.stringify({ report_id: id, reporter: null, reason }) });

  /* 지운 행을 돌려받는다. 0건이면 이미 없거나, 지금 로그인한 계정의 글이 아니다 —
     PostgREST 는 권한 때문에 0건이 지워져도 성공으로 답하므로 여기서 가려야 한다. */
  const removeMine = (id) => call(rest + "/reports?id=eq." + encodeURIComponent(id),
    { method: "DELETE", headers: { Prefer: "return=representation" } });
  const exists = async (id) => {
    const rows = await call(rest + "/reports?select=id&id=eq." + encodeURIComponent(id));
    return !!(rows && rows.length);
  };

  /* 서버 함수 부르기. 운영 화면(admin.js)이 쓴다 — 운영자인지는 함수가 토큰으로 가린다. */
  const rpc = (name, args) => call(rest + "/rpc/" + name, { method: "POST", body: JSON.stringify(args || {}) });

  /* 계정을 지운다. 로그인 계정 → 프로필 → 내 리포트 → 내 신고가 서버에서 함께 사라진다.
     지운 뒤의 토큰은 쓸모가 없으니 logout 을 부르지 않고 세션만 버린다. */
  async function deleteAccount() {
    await call(rest + "/rpc/delete_my_account", { method: "POST", body: "{}" });
    saveSession(null);
  }

  /* 서버 행 → 앱의 리포트 모양. 검사는 앱의 sane() 이 한 번 더 한다. */
  const toReport = (row) => ({
    id: row.id, t: new Date(row.t).getTime(), by: row.by_name, cat: row.cat,
    place: row.place, area: row.area || "", wait: row.wait, crowd: row.crowd,
    park: row.park, rate: row.rate, tags: row.tags || [], note: row.note || ""
  });

  global.TPW_SYNC = {
    enabled,
    hasSession: () => !!(session && session.access_token),
    uid: () => session && session.uid,
    consumeAuthHash, whoami, signInKakao, signInEmail, signOut,
    listHoods, myProfile, saveProfile, pull, push, flag, removeMine, exists, deleteAccount, toReport, rpc
  };
})(window);
