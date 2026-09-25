/* 뿡빵뿡 한글 숫자 서비스 워커 — 홈 화면에 추가하면 인터넷 없이도 열리게 합니다.
   항상 네트워크를 먼저 시도하고(배포 직후 옛 파일이 남지 않게), 실패할 때만 캐시를 씁니다. */
const CACHE = "ppung-v1";
const SHELL = ["/games/ppung-numbers/", "/games/ppung-numbers/manifest.webmanifest",
  "/games/ppung-numbers/icon.svg", "/games/ppung-numbers/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("ppung-") && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || !url.pathname.startsWith("/games/ppung-numbers/")) return;
  e.respondWith(fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || caches.match("/games/ppung-numbers/"))));
});
