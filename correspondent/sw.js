/* ============================================================================
   오프라인 — 지하 주차장이나 산속에서도 앱이 열리게.

   리포트는 처음부터 이 기기에 쌓이므로(localStorage) 페이지만 열리면 쓸 수 있다.
   공용 보드를 쓰면 못 올린 글은 기다렸다가 연결되면 올라간다(app.js 의 syncPushPending).

   새 index.html 과 옛 app.js·sync.js 가 섞이면 앱이 깨진다(서로 부르는 함수가 있다 — 배포 직후 빈 화면).
   깃허브 페이지스는 파일을 10분씩 브라우저에 묵히고, 신호가 약하면 워커가 캐시의 사본을 꺼내니 둘 다 섞을 수 있다.
   그래서 스크립트 주소에 내용 버전을 붙인다: index.html 은 app.js?v=H 를 부르고, H 는 스크립트 셋의 해시다
   (tools/stamp.mjs 가 적는다). 새 index.html 은 새 주소를 부르므로 옛 사본이 끼어들 자리가 없다.
     · ?v= 가 붙은 파일 — 주소가 곧 내용이다. 캐시에 있으면 네트워크를 보지 않는다. 없으면 받아서 담는다.
     · 문서와 버전 없는 파일(config.js — 운영자가 손으로 고친다, 처리방침…) — 네트워크 먼저,
       3초 안에 안 오거나 끊겼으면 마지막으로 받아 둔 사본.
   워커도 sw.js?v=H 로 등록되고(app.js) 캐시 이름이 tpw-H 다. 새 버전의 워커가 서면 옛 캐시를 지운다.

   글꼴(Google Fonts)은 앱 버전과 상관없으니 따로 된 캐시(tpw-fonts)에 두고 버전이 바뀌어도 남긴다.
   글꼴 파일은 주소가 곧 내용이라 캐시 먼저, 글꼴 CSS 는 받아 둔 것을 바로 주고 뒤에서 새로 받아 둔다.
   그 밖의 다른 출처(Supabase)는 건드리지 않는다.
   범위는 /correspondent/ 뿐이다 — 이 저장소의 다른 페이지에는 손대지 않는다.
   ========================================================================== */
const V = new URL(self.location.href).searchParams.get("v") || "";
const CACHE = "tpw-" + V;
const FONTS = "tpw-fonts";
const SCOPE = new URL("./", self.location).pathname;          // /correspondent/
const SHELL = ["./", "app.js?v=" + V, "sync.js?v=" + V, "config.js", "privacy.html", "terms.html", "manifest.webmanifest", "icons/icon-192.png"];
const WAIT_MS = 3000;

/* 문서가 부르는 앱 스크립트(app.js·sync.js·admin.js)가 모두 이 워커의 판(?v=H)인가. 캐시 tpw-H 에는 H 판의 문서만
   둔다 — 새 문서만 있고 그 스크립트가 없으면 끊긴 채 열 때 빈 화면이 된다. 버전이 없는 것도 남의 판이다.
   (처리방침처럼 스크립트가 없는 문서는 참) */
const ownVersion = (html) => Array.from(html.matchAll(/<script\b[^>]*\bsrc="(?:app|sync|admin)\.js(?:\?v=([^"&]*))?"/g))
  .every((m) => m[1] === V);

self.addEventListener("install", (e) => {
  /* 버전 없이 불린 워커(배포 전의 app.js 가 sw.js 로 등록)는 서지 않는다 — 서면 버전 캐시를 지워 오프라인이 깨진다.
     있던 워커가 그대로 일하고, 새 app.js 가 열리면 버전을 달고 다시 등록한다. */
  if (!/^[0-9a-f]{6,64}$/.test(V)) { e.waitUntil(Promise.reject(new Error("버전 없는 워커"))); return; }
  /* cache:"reload" — 브라우저 HTTP 캐시에 남은 10분 묵은 사본이 아니라 서버의 것을 담는다.
     그새 또 배포돼 문서가 다른 판을 부르면 서지 않는다 — 그 판의 app.js 가 열리며 제 워커를 세운다. */
  e.waitUntil(caches.open(CACHE)
    .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" })))
      .then(() => c.match("./")).then((r) => r.text()))
    .then((html) => { if (!ownVersion(html)) throw new Error("다른 판의 문서"); })
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("tpw-") && k !== CACHE && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === "https://fonts.gstatic.com") { e.respondWith(cacheFirst(e, FONTS)); return; }
  if (url.origin === "https://fonts.googleapis.com") { e.respondWith(fontCss(e)); return; }
  if (url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE)) return;
  if (url.pathname.endsWith("/sw.js")) return;
  e.respondWith(req.mode !== "navigate" && url.searchParams.has("v") ? cacheFirst(e, CACHE) : networkFirst(req, url));
});

/* 주소가 곧 내용인 것(app.js?v=H, 글꼴 파일) — 캐시에 있으면 그대로, 없으면 받아서 담는다. */
async function cacheFirst(e, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(e.request);
  if (hit) return hit;
  const res = await fetch(e.request);
  if (res.ok && !res.redirected) e.waitUntil(cache.put(e.request, res.clone()).catch(() => {}));
  return res;
}

/* 글꼴 CSS — 받아 둔 것을 바로 주고 뒤에서 새로 받아 둔다(stale-while-revalidate). 구글이 글꼴을 바꾸면 다음번에 따라간다. */
async function fontCss(e) {
  const cache = await caches.open(FONTS);
  const hit = await cache.match(e.request);
  const net = fetch(e.request).then((res) => {
    if (res.ok) e.waitUntil(cache.put(e.request, res.clone()).catch(() => {}));
    return res;
  });
  if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
  /* 끊겼고 받아 둔 것도 없으면 빈 CSS — 글꼴 없이도 앱은 기기 글꼴로 그대로 뜬다. 실패로 넘기면 열 때마다 오류가 쌓인다 */
  return net.catch(() => new Response("", { headers: { "Content-Type": "text/css; charset=utf-8" } }));
}

/* 캐시 열쇠: 주소창의 ?write=1 같은 꼬리는 떼고, 문서면 경로만 본다. */
function keyOf(req, url) {
  return req.mode === "navigate" ? url.origin + url.pathname : req.url;
}

async function networkFirst(req, url) {
  const cache = await caches.open(CACHE);
  const key = keyOf(req, url);

  const net = fetch(req).then((res) => {
    // 같은 출처의 정상 응답만 담는다. 리다이렉트된 응답을 문서로 되돌려주면 브라우저가 거부한다.
    if (res && res.ok && res.type === "basic" && !res.redirected) {
      if (req.mode !== "navigate") cache.put(key, res.clone());
      else {
        /* 문서는 이 워커의 판만 담는다. 신호가 약해 옛 사본으로 뜬 뒤에 늦게 온 새 index.html 을 담으면
           캐시에 새 문서와 옛 스크립트만 남는다. 새 판의 문서는 새 판의 워커가 설 때 담는다. */
        const doc = res.clone(), keep = res.clone();
        doc.text().then((html) => ownVersion(html) && cache.put(key, keep)).catch(() => {});
      }
    }
    return res;
  });

  try {
    return await Promise.race([net, new Promise((_, no) => setTimeout(() => no(new Error("느림")), WAIT_MS))]);
  } catch (err) {
    const hit = await cache.match(key) ||
      (req.mode === "navigate" ? await cache.match(new URL("./", self.location).href) : undefined);
    if (hit) return hit;
    return net;   // 받아 둔 게 없으면 네트워크를 계속 기다린다(끊겼으면 브라우저의 오류 화면)
  }
}

/* ============================================================================
   폰 알림 — 서버(functions/notify)가 보낸 알림을 띄운다. 내용은 암호화되어 오고, 브라우저가 풀어서 준다.
   같은 장소 알림은 tag 로 하나로 덮는다 — 한 가게 소식이 알림 창을 채우지 않게.
   ========================================================================== */
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) {}
  e.waitUntil(self.registration.showNotification(String(d.title || "동네 특파원").slice(0, 60), {
    body: String(d.body || "지켜보는 곳에 새 소식이 있습니다.").slice(0, 160),
    tag: String(d.tag || "tpw").slice(0, 80),
    renotify: true,
    lang: "ko",
    icon: "icons/icon-192.png",
    data: { url: String(d.url || "./") }
  }));
});

/* 누르면 그 장소로. 앱이 열려 있으면 그 창을 앞으로 불러 장소 창을 열게 하고, 없으면 새로 연다.
   다른 사이트로는 데려가지 않는다 — 주소가 이 앱 범위 밖이면 앱 첫 화면으로. */
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  let url = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE)) url = new URL("./", self.registration.scope);
  const key = url.searchParams.get("place") || "";
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const w = wins.find((c) => new URL(c.url).pathname.startsWith(SCOPE));
    if (w) {
      await w.focus();
      w.postMessage({ type: "open-place", key });
      return;
    }
    await self.clients.openWindow(url.href);
  })());
});
