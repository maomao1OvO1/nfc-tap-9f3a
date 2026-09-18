// Service Worker：把页面本身缓存下来 —— 断网也能打开
const CACHE = 'mutown-groove-v1';
const ASSETS = ['./','./index.html'];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(
    ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))
  )).then(()=>self.clients.claim()));
});
// 网络优先，失败回落缓存（音乐文件不拦，走浏览器原生缓存）
self.addEventListener('fetch', e=>{
  const url = new URL(e.request.url);
  if(url.origin !== location.origin) return;
  if(e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(r=>{
      const copy = r.clone();
      caches.open(CACHE).then(c=>c.put(e.request, copy)).catch(()=>{});
      return r;
    }).catch(()=> caches.match(e.request).then(r=> r || caches.match('./index.html')))
  );
});
