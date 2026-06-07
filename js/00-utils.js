// ════════════════════════════════════════════════════════
// COMMON UTILITIES — Phải load TRƯỚC tất cả các file khác
// (chỉ sau 00-bootstrap.js)
// ════════════════════════════════════════════════════════

// ── XSS PROTECTION ──────────────────────────────────────
// esc(): escape chuỗi khi nhúng vào HTML qua innerHTML / template literals
// Dùng cho MỌI giá trị do người dùng nhập (title, chair, location, member,
// prep, note, file.name, v.v.) trước khi đưa vào template.
//
// Ví dụ đúng:   `<div>${esc(e.title)}</div>`
// Ví dụ SAI:    `<div>${e.title}</div>`   ← có thể bị XSS
//
// Riêng URL nguy hiểm (javascript:, data:text/html…) phải dùng escAttr+kiểm tra.
window.esc = function(s){
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
};

// escAttr(): dành riêng cho thuộc tính HTML; tương tự esc() nhưng tên rõ ràng
// để code dễ đọc khi nhúng vào title="...", alt="...", v.v.
window.escAttr = window.esc;

// safeUrl(): chỉ cho phép http/https/blob/data:image, chặn javascript: và data:text/html
window.safeUrl = function(u){
  if (!u) return '';
  var s = String(u).trim();
  // Allowlist scheme
  if (/^(https?:|blob:|data:image\/)/i.test(s)) return s;
  // Path tương đối
  if (s.startsWith('/') || s.startsWith('./') || s.startsWith('../')) return s;
  return ''; // tất cả các scheme khác bị từ chối
};

// ── LOGGER ──────────────────────────────────────────────
// Bật DEBUG khi chạy localhost hoặc ?debug=1, tắt khi production
// để giảm tải mobile và ẩn thông tin nội bộ khỏi DevTools.
(function(){
  var hostIsLocal = /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(location.hostname);
  var qsDebug = /[?&]debug=1\b/.test(location.search);
  var stored = false;
  try { stored = localStorage.getItem('llv_debug') === '1'; } catch(e){}
  window.DEBUG = hostIsLocal || qsDebug || stored;

  // log(): wrapper console.log — chỉ in khi DEBUG bật
  window.log = function(){
    if (!window.DEBUG) return;
    try { console.log.apply(console, arguments); } catch(e){}
  };
  window.logWarn = function(){
    if (!window.DEBUG) return;
    try { console.warn.apply(console, arguments); } catch(e){}
  };
  // Lỗi LUÔN in (kể cả production) để có thể debug khi user báo lỗi
  window.logErr = function(){
    try { console.error.apply(console, arguments); } catch(e){}
  };

  // Cho phép user bật/tắt DEBUG runtime qua console:
  //   llvDebug(true)   → bật
  //   llvDebug(false)  → tắt
  window.llvDebug = function(on){
    window.DEBUG = !!on;
    try { localStorage.setItem('llv_debug', on?'1':'0'); } catch(e){}
    console.info('[LLV] DEBUG=', window.DEBUG);
  };
})();

// ── VIEWER UID (đa đơn vị qua subdomain) ────────────────
// Thứ tự ưu tiên khi xác định đơn vị cần hiển thị lịch:
//   1. ?uid=<UID>             ← test/dev (UID trực tiếp)
//   2. ?dv=<tendonvi>         ← test/dev (theo tên đơn vị)
//   3. subdomain              ← PRODUCTION: tendonvi.lichlamviectrabong.com.vn
//   4. <meta name="viewer-uid"> ← fallback nếu đặt cứng
//
// Với subdomain: app lấy phần đầu hostname (vd "trabong" từ
// trabong.lichlamviectrabong.com.vn), rồi tra trong SUBDOMAIN_MAP (tĩnh)
// hoặc Firebase subdomain_map/{tendonvi} (động). Hàm getViewerUid()
// trả về UID NGAY nếu có trong map tĩnh; nếu không, BOOT sẽ gọi
// resolveUidFromSubdomain() (async) để hỏi Firebase.

// MAP TĨNH: thêm đơn vị ở đây nếu muốn nhanh, không cần Firebase.
// Để rỗng nếu dùng map động (Firebase) hoàn toàn.
window.SUBDOMAIN_MAP = {
  // 'taytrabong': 'jSgnpibQwNNZFMB8T5ATA5Eb2fy2',
  // 'tradinh':    'UID_KHAC_...',
};

// Lấy tên đơn vị (subdomain) từ hostname hoặc query ?dv=
window.getDonViSlug = function(){
  // ?dv= override (test)
  try {
    var p = new URLSearchParams(location.search);
    var dv = p.get('dv');
    if (dv && /^[a-z0-9-]{2,40}$/i.test(dv)) return dv.toLowerCase();
  } catch(e){}
  // subdomain: phần đầu của hostname
  try {
    var host = location.hostname.toLowerCase();
    // Bỏ qua localhost / IP / domain gốc không có subdomain đơn vị
    if (/^(localhost|127\.|\[)/.test(host)) return null;
    var parts = host.split('.');
    // tendonvi.lichlamviectaytra.com.vn → ['tendonvi','lichlamviec','com','vn'] (4 phần)
    // lichlamviectaytra.com.vn → 3 phần (không có subdomain đơn vị)
    // www.lichlamviectaytra.com.vn → 'www' (bỏ qua)
    if (parts.length >= 4) {
      var sub = parts[0];
      if (sub && sub !== 'www') return sub;
    }
  } catch(e){}
  return null;
};

window.getViewerUid = function(){
  // 1. ?uid= trực tiếp (test/dev) — ưu tiên cao nhất để debug
  try {
    var p = new URLSearchParams(location.search);
    var u = p.get('uid');
    if (u && /^[A-Za-z0-9]{20,40}$/.test(u)) return u;
  } catch(e){}
  // 2. meta tag — CÁCH CHÍNH cho mô hình "mỗi đơn vị một tên miền riêng".
  //    Mỗi bản deploy ghim sẵn UID đơn vị trong index.html → không phụ
  //    thuộc tên miền, chạy đúng với mọi dạng domain (gốc, www, subdomain).
  try {
    var m = document.querySelector('meta[name="viewer-uid"]');
    if (m && m.content && /^[A-Za-z0-9]{20,40}$/.test(m.content)) return m.content;
  } catch(e){}
  // 3. subdomain → tra map tĩnh (chỉ dùng nếu chạy mô hình đa đơn vị 1 tên miền chung)
  try {
    var slug = getDonViSlug();
    if (slug && window.SUBDOMAIN_MAP && window.SUBDOMAIN_MAP[slug]) {
      return window.SUBDOMAIN_MAP[slug];
    }
  } catch(e){}
  // 4. Fallback cuối: Trà Bồng (giữ tương thích ngược)
  return 'jSgnpibQwNNZFMB8T5ATA5Eb2fy2';
};

// resolveUidFromSubdomain(): async — tra Firebase subdomain_map/{slug} → UID
// Gọi trong BOOT TRƯỚC khi load lịch. Nếu tìm thấy, ghi đè getViewerUid().
// Cấu trúc Firebase:
//   subdomain_map/
//     taytrabong: { uid: "jSgnpi...", ten: "UBND xã Trà Bồng" }
//     tradinh:    { uid: "abc123...", ten: "UBND xã Trà Đình" }
window.resolveUidFromSubdomain = async function(){
  var slug = getDonViSlug();
  if (!slug) return null;
  // Nếu đã có trong map tĩnh thì khỏi hỏi Firebase
  if (window.SUBDOMAIN_MAP && window.SUBDOMAIN_MAP[slug]) {
    return window.SUBDOMAIN_MAP[slug];
  }
  // Hỏi Firebase (cần fbDb đã sẵn sàng)
  try {
    if (typeof fbDb === 'undefined' || !fbDb) return null;
    var snap = await fbDb.ref('subdomain_map/' + slug).once('value');
    var data = snap.val();
    if (data && data.uid && /^[A-Za-z0-9]{20,40}$/.test(data.uid)) {
      // Cache vào map tĩnh để các lần gọi getViewerUid() sau dùng được
      window.SUBDOMAIN_MAP[slug] = data.uid;
      if (data.ten) window.DONVI_TEN = data.ten;
      log('[Subdomain] resolved', slug, '→', data.uid);
      return data.uid;
    }
    logWarn('[Subdomain] không tìm thấy đơn vị:', slug);
  } catch(e){
    logErr('[Subdomain] lỗi tra Firebase:', e.message);
  }
  return null;
};

// ── CATEGORY ────────────────────────────────────────────
// CAT và catOf() được khai báo trong js/05b-notification.js (gần phần cuối),
// vì có nhiều icon/label cụ thể cho app. Không nhân đôi ở đây để tránh
// conflict `const CAT` redeclaration.
//
// isHoan(e): kiểm tra event đã hoãn — cũng được khai báo lại ở 05b nên đặt
// tạm ở đây dạng fallback (nếu file load sớm gọi đến isHoan trước khi 05b load,
// sẽ dùng cái này. Sau 05b load, sẽ ghi đè bằng const isHoan ở 05b — nhưng
// const không cho redeclare nên không an toàn).
// → KHÔNG khai báo isHoan ở đây nữa, đảm bảo chỉ có 1 nguồn duy nhất ở 05b.
