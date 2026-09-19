// Service Worker：把页面和资源都留在手机里 —— 断网也能打开、能播
//
// 2026-09-18 改进（重要）：改成「缓存优先」。
//   原来写的是「网络优先，失败回落缓存」—— 问题是断网时浏览器要先去试网络、
//   等它失败（几秒白屏）才回落，用户看到的就是「打不开」。
//   现在反过来：缓存里有就直接给（0 等待），同时后台悄悄联网更新一份。
//
// 2026-09-19 升 v3 → v4（**必须升**）：
//   本次改的是 index.html（切歌后进度条的总时长兜底 + 缓冲提示）。
//   而本 SW 是「缓存优先」—— 不升版本号，用户第一次打开拿到的还是缓存里的旧页面，
//   会以为「根本没修好」。升一档 → 浏览器把它当新 SW 重新安装 → install 里
//   cache.addAll 才会去拉最新的 index.html。
const CACHE = 'mutown-groove-v4';   // 版本号升一档 → 旧的 v3 缓存会在 activate 时自动清掉
const ASSETS = ['./', './index.html', './hls.min.js', './cover.jpg'];

self.addEventListener('install', e=>{
  e.waitUntil(
    caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())
  );
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(
    ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))
  )).then(()=>self.clients.claim()));
});

self.addEventListener('fetch', e=>{
  const url = new URL(e.request.url);
  if(url.origin !== location.origin) return;   // 音频分片走 Cloudflare Worker（跨域），不拦
  if(e.request.method !== 'GET') return;

  e.respondWith((async()=>{
    const cache = await caches.open(CACHE);
    // ① 缓存里有 → 立刻返回（断网、弱网都是 0 等待）
    const hit = await cache.match(e.request) || await cache.match('./index.html');
    // ② 同时后台去拿最新版，拿到就更新缓存（下次打开就是新的）
    const net = fetch(e.request).then(r=>{
      if(r && r.ok) cache.put(e.request, r.clone()).catch(()=>{});
      return r;
    }).catch(()=>null);

    if(hit){ e.waitUntil(net); return hit; }
    // ③ 缓存里没有（比如从没访问过）→ 只能等网络
    const r = await net;
    return r || (await cache.match('./index.html')) || Response.error();
  })());
});
