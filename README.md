# Hệ thống quản lý lịch làm việc số

PWA (Progressive Web App) hỗ trợ UBND xã/Đảng ủy quản lý lịch làm việc tuần, có push notification, AI đọc file điền form tự động, chế độ TV chiếu lịch, đa cơ quan.

## Cấu trúc thư mục

```
.
├── index.html                  ← HTML chính
├── manifest.json               ← PWA manifest
├── OneSignalSDKWorker.js       ← Service Worker (cache + push + badge)
├── sw.js                       ← SW dự phòng (legacy)
├── CNAME                       ← Custom domain GitHub Pages
├── icons/                      ← Icon PWA các size
├── styles/
│   └── main.css                ← Toàn bộ CSS (đã minify)
├── js/
│   ├── 00-utils.js             ← 🆕 esc/log/getViewerUid (load đầu tiên)
│   ├── 00-bootstrap.js         ← Viewport + ORG_CONFIG title
│   ├── 01-onesignal-init.js    ← OneSignal deferred init
│   ├── 02-login-tooltip.js     ← Login button tooltip
│   ├── 03-fullscreen-btn.js    ← Auto-hide fullscreen
│   ├── 04-lightbox.js          ← Lightbox xem ảnh/PDF
│   ├── 05a-config-firebase.js  ← Firebase + OneSignal push
│   ├── 05b-notification.js     ← Hệ thống thông báo + CAT
│   ├── lunar.js                ← 🆕 Âm lịch (Hồ Ngọc Đức) — tách riêng
│   ├── 05c-state-utils.js      ← State + utils + Weather API
│   ├── 05d-render-tables.js    ← Render bảng Viewer/Admin/Mobile/TV
│   ├── 05e-admin-features.js   ← Admin auth + Form thêm/sửa
│   ├── 05f-nav-download.js     ← Điều hướng + Download/Print
│   ├── 05g-extras.js           ← Tìm kiếm + QR + Thống kê + Xem tháng
│   ├── 05h-boot.js             ← Keyboard/Click events + BOOT
│   ├── 06-pwa-install.js       ← Gợi ý cài PWA
│   └── 07-ai-notify.js         ← Gemini AI + Modals thông báo
├── firebase.json               ← 🆕 Cấu hình deploy Firebase
├── .firebaserc                 ← 🆕 Project name
├── firebase-rules/             ← 🆕 Security Rules
│   ├── database.rules.json     ← Realtime DB rules (chặt theo UID)
│   └── storage.rules           ← Storage rules (whitelist content-type)
└── functions/                  ← 🆕 Cloud Function proxy Gemini
    ├── index.js
    ├── package.json
    └── README.md               ← Hướng dẫn deploy chi tiết
```

## Thứ tự load `<script>` (KHÔNG được đổi)

```html
<!-- 1. Trong <head> -->
<script src="js/00-utils.js"></script>        <!-- esc, log, CAT fallback, getViewerUid -->
<script src="js/00-bootstrap.js"></script>    <!-- Viewport + title -->
<script src="js/01-onesignal-init.js"></script>

<!-- 2. Sau khi DOM render -->
<script src="js/02-login-tooltip.js"></script>
<script src="js/03-fullscreen-btn.js"></script>
<script src="js/04-lightbox.js"></script>
<script src="js/05a-config-firebase.js"></script>
<script src="js/05b-notification.js"></script>   <!-- Khai báo CAT thật, isHoan, catOf -->
<script src="js/lunar.js"></script>              <!-- Trước 05c vì 05c dùng fmtLunar -->
<script src="js/05c-state-utils.js"></script>
<script src="js/05d-render-tables.js"></script>
<script src="js/05e-admin-features.js"></script>
<script src="js/05f-nav-download.js"></script>
<script src="js/05g-extras.js"></script>
<script src="js/05h-boot.js"></script>
<script src="js/06-pwa-install.js"></script>
<script src="js/07-ai-notify.js"></script>
```

## ⚠ Bảo mật — đã được củng cố

### 1. Chống XSS (`esc()`)

Tất cả nội dung do người dùng nhập (`title`, `chair`, `location`, `member`, `prep`, tên file…) đã được escape qua `esc()` định nghĩa trong `js/00-utils.js`:

```js
// Đúng
return `<div>${esc(e.title)}</div>`;

// Sai (có thể bị XSS)
return `<div>${e.title}</div>`;
```

Nếu thêm template mới, **luôn** dùng `esc()` cho biến do người dùng nhập.

### 2. Firebase Security Rules

Phải áp dụng trước khi deploy production:

```bash
firebase deploy --only database,storage
```

`firebase-rules/database.rules.json` đảm bảo:
- `donvi/{uid}/config` (chứa Gemini API key) chỉ admin của chính UID đó đọc/ghi được
- Các path công khai (`events_file`, `last_update`, `info`) chỉ admin cùng UID mới ghi được, viewer chỉ đọc
- `push_trigger` chỉ server ghi
- Chặn list tất cả đơn vị (tránh leak UID)

### 3. Gemini API Key — không còn lưu client

**Trước:** Key lưu ở `donvi/{uid}/config/geminiKeys` → ai biết URL DB cũng đọc được.

**Sau:** Triển khai Cloud Function `geminiProxy` (xem `functions/README.md`). Client chỉ cần đăng nhập admin → gọi function → function giữ key server-side → gọi Gemini → trả kết quả.

> ⚠ Cloud Function đã được viết sẵn nhưng client (`07-ai-notify.js`) **chưa** được chuyển sang dùng nó. Đây là việc cần làm tiếp theo — xem mục "Việc cần làm tiếp" bên dưới.

### 4. Cache-busting Service Worker

`OneSignalSDKWorker.js` đã được viết lại:
- **HTML**: network-first → user luôn có bản mới nhất khi online
- **JS/CSS**: stale-while-revalidate → response nhanh, update background
- **Cross-origin** (Firebase, OneSignal, CDN): bypass cache

Khi deploy phiên bản mới: tăng `CACHE_NAME` (hiện `llv-v16`) lên `v17`, `v18`… để invalidate cache cũ.

## Deploy

### Hosting tĩnh (không có Firebase Functions)

Upload nguyên thư mục (trừ `functions/`, `firebase-rules/`, `firebase.json`) lên GitHub Pages, Netlify, Vercel, v.v. Đảm bảo file `OneSignalSDKWorker.js` ở root.

### Firebase đầy đủ (khuyến nghị)

```bash
# 1. Install Firebase CLI
npm install -g firebase-tools
firebase login
firebase use --add  # chọn project lichxattbong

# 2. Deploy rules + hosting trong 1 lệnh
firebase deploy --only database,storage,hosting

# 3. Deploy Cloud Function Gemini (nếu dùng AI)
cd functions
npm install
firebase functions:secrets:set GEMINI_API_KEY  # paste key
firebase deploy --only functions:geminiProxy
```

## Đa cơ quan

`js/00-utils.js → getViewerUid()` đọc UID từ:
1. URL query: `?uid=<UID>` (dev/test)
2. Meta tag: `<meta name="viewer-uid" content="UID">` (production)
3. Subdomain map: `window.VIEWER_UID_MAP = {sub: uid}` (production nâng cao)
4. Fallback hardcode (chỉ giữ cho Tây Trà Bồng)

**Triển khai cho cơ quan mới:**

1. Tạo Firebase Auth user mới (email = `<tenxa>@lichlamviec.com.vn`)
2. Lấy UID của user đó từ Firebase Console
3. Set thông tin cơ quan: `donvi/<UID>/info/{tenCoQuan, viTri, ...}`
4. Deploy app với `<meta name="viewer-uid" content="<UID>">` riêng cho subdomain

## Sửa code sau này

| Sửa cái gì | File |
|---|---|
| CSS giao diện | `styles/main.css` |
| Logic admin (thêm/xóa/sửa) | `js/05e-admin-features.js` |
| Render bảng (viewer/admin/mobile/TV) | `js/05d-render-tables.js` |
| Firebase config | `js/05a-config-firebase.js` |
| AI đọc file | `js/07-ai-notify.js` |
| Logic chung / weather | `js/05c-state-utils.js` |
| Thuật toán âm lịch | `js/lunar.js` |
| Utils chung (esc, log) | `js/00-utils.js` |
| Service Worker cache | `OneSignalSDKWorker.js` |
| Firebase Rules | `firebase-rules/database.rules.json` |
| Cloud Function | `functions/index.js` |

## Debug

- Bật DEBUG runtime: mở DevTools console, gõ `llvDebug(true)` → reload
- Hoặc thêm `?debug=1` vào URL

Khi DEBUG bật, các `log()`, `logWarn()` mới in ra console. `logErr()` luôn in (ngay cả production) để admin có thể debug khi user báo lỗi.

## Việc đã làm trong refactor lần này

- [x] Chống XSS với `esc()` trên tất cả render template (vsEvRow, aEvRow, vmEv, adcEvFull, adcEv, tvEvRow, ticker, search, notification, attach)
- [x] Firebase Security Rules chặt chẽ cho `donvi/$uid/config`
- [x] Cloud Function Gemini proxy (đã code đầy đủ)
- [x] Service Worker network-first cho HTML, stale-while-revalidate cho assets
- [x] Logger có DEBUG flag (tắt console.log ở production)
- [x] Đa cơ quan qua `getViewerUid()` thay vì hardcode UID
- [x] Tách `lunar.js` riêng (format đẹp lại từ 1 dòng siêu dài)
- [x] Cleanup `push_trigger` listener (tránh memory leak)
- [x] Toast cảnh báo khi localStorage quota đầy
- [x] Badge "Ước tính" khi weather dùng mock
- [x] Validate JSON, syntax check tất cả file

## Việc còn lại (Phase 2)

- [ ] Wire client (`07-ai-notify.js`) gọi `geminiProxy` thay vì gọi Gemini trực tiếp
- [ ] Xoá UI nhập Gemini key (không cần nữa sau khi có proxy)
- [ ] Restrict Gemini API key trong Google Cloud Console theo HTTP referer (lớp bảo vệ thứ 2)
- [ ] Refactor inline `onclick=` sang event delegation (CSP-friendly)
- [ ] Refactor sang ES modules + Vite (dài hạn — cho team mở rộng)
- [ ] Lưu events theo node `donvi/{uid}/events/{id}` thay vì upload nguyên file JSON
- [ ] Audit thêm listener leak (tất cả `.on('value')` phải có `.off()` tương ứng)

## License

Internal — không phân phối ngoài cơ quan.
