/* ============================================================================
   오프라인 — 지하 주차장이나 산속에서도 앱이 열리게.

   리포트는 처음부터 이 기기에 쌓이므로(localStorage) 페이지만 열리면 쓸 수 있다.
   공용 보드를 쓰면 못 올린 글은 기다렸다가 연결되면 올라간다(app.js 의 syncPushPending).

   전략은 하나다: 네트워크 먼저, 3초 안에 안 오거나 끊겨 있으면 마지막으로 받아 둔 사본.
   캐시를 먼저 보여 주면 빠르지만, 배포 직후 새 index.html 과 옛 app.js·sync.js 가 섞일 수 있다.
   이 앱은 둘이 서로 부르는 함수가 있어서 섞이면 깨진다. 연결돼 있을 때는 워커가 없는 것과
   똑같이 동작하게 두고, 연결이 없을 때만 나선다.

   다른 출처(Supabase, Google Fonts)의 요청은 건드리지 않는다.
   범위는 /correspondent/ 뿐이다 — 이 저장소의 다른 페이지에는 손대지 않는다.
   ========================================================================== */
const CACHE = "tpw-v3";   // 새 차림(머리띠·아이콘) — 옛 사본을 비운다
const SCOPE = new URL("./", self.location).pathname;          // /correspondent/
const SHELL = ["./", "app.js", "sync.js", "config.js", "privacy.html", "terms.html", "manifest.webmanifest", "icons/icon-192.png"];
const WAIT_MS = 3000;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("tpw-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE)) return;
  if (url.pathname.endsWith("/sw.js")) return;
  e.respondWith(networkFirst(req, url));
});

/* 캐시 열쇠: 주소창의 ?write=1 같은 꼬리는 떼고, 문서면 경로만 본다. */
function keyOf(req, url) {
  return req.mode === "navigate" ? url.origin + url.pathname : req.url;
}

async function networkFirst(req, url) {
  const cache = await caches.open(CACHE);
  const key = keyOf(req, url);

  const net = fetch(req).then((res) => {
    // 같은 출처의 정상 응답만 담는다. 리다이렉트된 응답을 문서로 되돌려주면 브라우저가 거부한다.
    if (res && res.ok && res.type === "basic" && !res.redirected) cache.put(key, res.clone());
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
