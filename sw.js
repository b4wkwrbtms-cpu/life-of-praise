/* 생명의 찬양 웹앱: 한 번 연 화면·악보·서식은 기기에 남겨 인터넷이 없어도 열리게 한다 */
const NAME = 'lop-v3';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'data/backup.json', 'images/dawn.webp', 'icons/icon-192.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(NAME).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== NAME).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const page = req.mode === 'navigate' || /index\.html$|\/$/.test(new URL(req.url).pathname);
  if (page) { // 화면은 새것을 먼저, 안 되면 저장해 둔 것
    e.respondWith(fetch(req).then((r) => { if (r.ok) { const copy = r.clone(); caches.open(NAME).then((c) => c.put('index.html', copy)); } return r; }).catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => { if (r.ok) { const copy = r.clone(); caches.open(NAME).then((c) => c.put(req, copy)); } return r; })));
});
