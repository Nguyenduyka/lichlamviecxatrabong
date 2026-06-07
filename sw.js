// sw.js – không dùng nữa, OneSignalSDKWorker.js là SW chính
// Giữ file này để tránh lỗi 404 từ manifest cũ
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());