// 몽글이 오프라인 지원: 게임 파일은 설치 때 저장, 페이지는 네트워크 우선(업데이트 반영),
// 나머지(폰트·아이콘)는 캐시 우선. 게임 파일을 바꾸면 VERSION을 올린다.
const VERSION = "mongle-v9";
const CORE = ["./", "./index.html", "./manifest.webmanifest",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png", "./icons/favicon-32.png",
  "./fonts/Galmuri11.woff2", "./fonts/Galmuri11-Bold.woff2"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // 로그인·DB 요청 등 다른 사이트는 건드리지 않는다(폰트만 예외로 캐시)
  if (url.origin !== self.location.origin && !/^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) return;
  // Firebase 로그인 경로(/__/auth, /__/firebase)는 항상 네트워크로 그대로 보낸다
  if (url.pathname.startsWith("/__/")) return;
  // 설정 파일은 항상 최신 확인
  if (url.pathname.endsWith("/firebase-config.js")) {
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); return res; })
      .catch(() => caches.match(req)));
    return;
  }
  if (req.mode === "navigate") {
    e.respondWith(fetch(req)
      .then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put("./index.html", copy)); return res; })
      .catch(() => caches.match("./index.html")));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
    return res;
  })));
});
