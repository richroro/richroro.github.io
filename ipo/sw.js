/* 공모주 캘린더 서비스 워커 — 오프라인에서도 마지막으로 본 일정으로 열리게 합니다.
   같은 출처 요청만 다룹니다. 항상 네트워크를 먼저 시도하고(배포 직후 옛 파일이 남지 않게),
   실패할 때만 캐시를 씁니다. 데이터는 브라우저 HTTP 캐시도 건너뛰어 새 일정이 바로 보이게 합니다. */
const CACHE = "ipo-v9";
const SHELL = ["/ipo/", "/ipo/app.js", "/ipo/score.js", "/ipo/extra.js", "/ipo/ipo.css", "/m7/assets/m7.css", "/ipo/icon.svg", "/ipo/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("ipo-") && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (!/^\/(ipo|m7\/assets)\//.test(url.pathname)) return;
  const isData = url.pathname.startsWith("/ipo/data/");
  e.respondWith(fetch(req, isData ? { cache: "no-cache" } : undefined).then((res) => {
    if (res.ok) { const copy = res.clone(); e.waitUntil(caches.open(CACHE).then((c) => c.put(req, copy))); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: url.pathname.endsWith("/") })
    // 페이지 이동일 때만 첫 화면으로 대신한다 — JSON·스크립트 자리에 HTML 을 주지 않게
    .then((hit) => hit || (req.mode === "navigate" ? caches.match("/ipo/") : Response.error()))));
});
