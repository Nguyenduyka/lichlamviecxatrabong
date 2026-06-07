// OneSignalSDKWorker.js – Service Worker chính
// Gộp OneSignal + Badge API + Cache + Push
//
// CACHE STRATEGY (v17):
// - HTML (index.html): network-first → cache fallback (đảm bảo user luôn có
//   bản mới nhất khi online, fallback cache khi offline)
// - JS/CSS: stale-while-revalidate (response cache ngay, update background)
// - Cross-origin (Firebase, OneSignal, CDN, fonts): bypass cache (network only)
//
// KHÔNG precache JS riêng lẻ: vì khi deploy phiên bản mới, nếu precache
// list khác đi mà HTML chưa update, sẽ xảy ra "HTML cũ + JS mới" → lỗi
// ReferenceError. Strategy stale-while-revalidate sẽ tự cache lần đầu user
// truy cập, tự update background. An toàn hơn precache.

// ── ONESIGNAL (bắt buộc import đầu tiên) ──────
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

// ── CACHE ──────────────────────────────────────
const CACHE_NAME = 'llv-xa-tra-bong-v1';

// Precache tài nguyên cốt lõi cần NGAY khi mở app, kể cả mạng kém/đổi version.
// QUAN TRỌNG: precache cả CSS — nếu không, sau khi đổi CACHE_NAME (xóa cache cũ)
// mà mạng chập chờn, request CSS có thể trả rỗng → trang mất CSS (quốc huy phình to).
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/styles/main.css',
  '/styles/hover-effects.css'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => {
      // allSettled: mạng kém vẫn cache được phần nào
      return Promise.allSettled(
        CORE_ASSETS.map(url => c.add(url).catch(() => null))
      );
    })
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Helper: kiểm tra URL có nên bypass cache hoàn toàn không
// CHỈ bypass dữ liệu ĐỘNG (realtime DB, storage, API, gửi push, thời tiết).
// Các THƯ VIỆN TĨNH (Firebase SDK, QR, fonts) KHÔNG bypass → được cache lại
// (xem _isCacheableLib) để lần sau vào không phải tải lại từ mạng quốc tế.
function _shouldBypass(url){
  return url.includes('firebaseio.com') ||                      // realtime DB
         url.includes('firebasestorage.googleapis.com') ||      // storage files
         url.includes('identitytoolkit.googleapis.com') ||      // auth
         url.includes('securetoken.googleapis.com') ||          // auth token
         url.includes('script.google.com') ||                   // GAS push
         url.includes('api.onesignal.com') ||                   // OneSignal API
         url.includes('onesignal.com/api') ||
         url.includes('open-meteo.com');                        // thời tiết + AQI
}
// Thư viện tĩnh từ CDN — nên cache để app khởi động ổn định khi mạng chập chờn
function _isCacheableLib(url){
  return url.includes('gstatic.com/firebasejs') ||   // Firebase SDK
         url.includes('cdn.onesignal.com/sdks') ||    // OneSignal SDK
         url.includes('cdnjs.cloudflare.com') ||      // QRCode
         url.includes('unpkg.com') ||
         url.includes('fonts.googleapis.com') ||      // CSS fonts
         url.includes('fonts.gstatic.com');           // font files
}

// Helper: nhận diện request HTML (navigation hoặc Accept: text/html)
function _isHTML(req){
  if (req.mode === 'navigate') return true;
  var accept = req.headers.get('accept') || '';
  return accept.indexOf('text/html') !== -1;
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url;

  // Bypass: không can thiệp các domain external (dữ liệu động)
  if (_shouldBypass(url)) return;

  // Thư viện tĩnh từ CDN (Firebase SDK, OneSignal SDK, QR, fonts):
  // cache-first → lần sau vào dùng ngay bản đã lưu, KHÔNG phụ thuộc mạng quốc tế.
  // Nền: vẫn thử cập nhật bản mới khi online.
  if (_isCacheableLib(url)) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        // Đã có trong cache → DÙNG LUÔN, KHÔNG tải lại nền (tiết kiệm bandwidth).
        // Thư viện CDN có version cố định; khi deploy bản mới chỉ cần bump CACHE_NAME.
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res && (res.ok || res.type === 'opaque')) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone)).catch(() => {});
          }
          return res;
        });
      })
    );
    return;
  }

  // STRATEGY 1: HTML → network-first
  // Mục tiêu: user luôn nhận được HTML mới nhất khi online, đảm bảo JS/CSS
  // version mới được nạp đúng. Khi offline, fallback cache.
  if (_isHTML(e.request)) {
    e.respondWith(
      fetch(e.request).then(res => {
        // Cache lại response mới (background)
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone)).catch(() => {});
        }
        return res;
      }).catch(() => {
        // Offline: fallback cache (hoặc index.html nếu route khác)
        return caches.match(e.request).then(c => c || caches.match('/index.html'));
      })
    );
    return;
  }

  // STRATEGY 2: Asset tĩnh (JS, CSS, ảnh) → CACHE-FIRST, chắc chắn không vỡ.
  // - Có trong cache → trả ngay (CSS luôn áp dụng được, không phụ thuộc mạng).
  // - Chưa có → tải mạng rồi cache lại.
  // - Mạng lỗi + chưa cache → trả lại cached (nếu có) thay vì undefined
  //   (undefined sẽ khiến trình duyệt coi như lỗi tải → mất CSS/JS).
  // Cập nhật bản mới qua bump CACHE_NAME mỗi lần deploy (install sẽ precache lại).
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
    })
  );
});

// ── BADGE API ──────────────────────────────────
self.addEventListener('message', e => {
  if (!e.data) return;
  const { type, count } = e.data;

  if (type === 'SET_BADGE') {
    const n = parseInt(count) || 0;
    try {
      if ('setAppBadge' in self) {
        if (n > 0) self.setAppBadge(n).catch(() => {});
        else self.clearAppBadge().catch(() => {});
      } else if ('setAppBadge' in navigator) {
        if (n > 0) navigator.setAppBadge(n).catch(() => {});
        else navigator.clearAppBadge().catch(() => {});
      }
    } catch (_) {}
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => clients.forEach(c => c.postMessage({ type: 'BADGE_SET', count: n })))
      .catch(() => {});
  }

  if (type === 'CLEAR_BADGE') {
    try {
      if ('clearAppBadge' in self) self.clearAppBadge().catch(() => {});
      else if ('clearAppBadge' in navigator) navigator.clearAppBadge().catch(() => {});
    } catch (_) {}
    self.registration.getNotifications({ tag: 'lich-update' })
      .then(ns => ns.forEach(n => n.close())).catch(() => {});
  }

  if (type === 'SKIP_WAITING') self.skipWaiting();
});

// ── NOTIFICATION CLICK ─────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url)
    ? e.notification.data.url : self.registration.scope;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        for (const c of clients) {
          if (c.url.startsWith(self.registration.scope) && 'focus' in c) {
            c.postMessage({ type: 'NOTIF_CLICKED' });
            return c.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(target);
      })
  );
});
