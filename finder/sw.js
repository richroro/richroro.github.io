/* 전 종목 탐색기 서비스 워커 — 오프라인에서도 마지막으로 본 데이터로 열리게 합니다.
   같은 출처 요청만 다룹니다. 항상 네트워크를 먼저 시도하고(배포 직후 옛 파일이 남지 않게),
   실패할 때만 캐시를 씁니다. 글꼴·TradingView 같은 외부 요청은 건드리지 않습니다. */
const CACHE = "finder-v3";
const SHELL = ["/finder/", "/finder/app.js", "/finder/finder.css", "/m7/assets/m7.css", "/stocks/assets/registry.js",
  "/finder/icon.svg", "/finder/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("finder-") && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (!/^\/(finder|m7\/assets|stocks\/assets)\//.test(url.pathname)) return;
  e.respondWith(fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: url.pathname.endsWith("/") }).then((hit) => hit || caches.match("/finder/"))));
});
