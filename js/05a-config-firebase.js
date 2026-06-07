
// ════════════════════════════════════════
// ORG_CONFIG – Chỉnh thông tin này khi triển khai cho cơ quan mới
// ════════════════════════════════════════
log('[App] Script v2025-05-12o UI-POLISH loaded');

// ── KHAI BÁO BIẾN TRẠNG THÁI SỚM NHẤT ──
// Phải ở đầu script để tránh ReferenceError khi event handler (focus/pageshow/visibilitychange)
// kích hoạt trước khi script chạy xong (bfcache, PWA restore, v.v.)
var _openedViaNotif=false;
var tvClkTimer=null, isAdmin=false, tvOn=false, scrollOn=false, _autoTV=false;
var _notifCount=0, _notifGranted=false, _isMarkingRead=false;
// Flag: true cho đến khi data Firebase load xong lần đầu — tránh hiện "Không có lịch" lúc boot
var _isInitialLoad=true;
// ─────────────────────────────────────────

const ORG_CONFIG = {
  tenCoQuan:      'UBND XÃ TRÀ BỒNG',
  tenNgan:        'Xã Trà Bồng',
  capCoQuan:      'HỆ THỐNG QUẢN LÝ LỊCH LÀM VIỆC SỐ',
  nguoiPhuTrach:  'Nguyễn Thế Hải',
  chucVu:         'Chánh Văn phòng HĐND và UBND xã Trà Bồng',
  donVi:          'xã Trà Bồng',
  diaDanh:        'Trà Bồng',
  soDienThoai:    '0917524802',
  viTri:          { lat: 15.0706, lon: 108.5308 },
  mauChinh:       '#c0392b',
  mauPhu:         '#8c1812',
  loai:           'ubnd',
};

// ── Mẫu config cho Đảng ủy (copy vào ORG_CONFIG khi dùng cho Đảng ủy) ──
// const ORG_CONFIG = {
//   tenCoQuan:     'Đảng ủy Xã Tây Trà Bồng',
//   tenNgan:       'Đảng ủy Xã Tây Trà Bồng',
//   capCoQuan:     'Đảng ủy',
//   nguoiPhuTrach: 'Ông Nguyễn Thế Hải',
//   chucVu:        'Chuyên viên',
//   donVi:         'xã Tây Trà Bồng',
//   diaDanh:       'Tây Trà Bồng',
//   soDienThoai:   '0917.524.802',
//   viTri:         { lat: 15.07, lon: 108.53 },
//   mauChinh:      '#c0392b',
//   mauPhu:        '#8c1812',
//   loai:          'dang_uy',
// };

// Đăng ký Service Worker (PWA) + force update để không cache HTML cũ
if('serviceWorker' in navigator){
  // Force SW update ngay khi load - tránh SW cũ serve file HTML cũ
  navigator.serviceWorker.getRegistrations().then(regs=>{
    regs.forEach(reg=>{
      reg.update(); // ping server để check SW mới
    });
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/OneSignalSDKWorker.js', { scope: '/' })
      .then(reg => {
        log('[SW] Registered:', reg.scope);
        reg.update(); // force check update
      })
      .catch(e => { logWarn('[SW] Register failed:', e); });
  });
}

// ════════════════════════════════════════
// CONFIG
// ════════════════════════════════════════
// ADMIN_USER/PASS cứng đã được thay bằng Firebase Authentication
// Mỗi đơn vị có email + mật khẩu riêng do admin tạo trên Firebase Console
const STORE_KEY='llv_xa-tra-bong_v1';
let WX_LAT=(typeof ORG_CONFIG!=='undefined'?ORG_CONFIG.viTri.lat:15.1624);
let WX_LON=(typeof ORG_CONFIG!=='undefined'?ORG_CONFIG.viTri.lon:108.3370);
const WX_TTL=600000;

// ════ FIREBASE CONFIG ════
const FB_CONFIG = {
  apiKey: "AIzaSyCRRuhSJqgETsPfr7wVM5BJa2qLWx-8th4",
  authDomain: "lichlamviectrabong-a4066.firebaseapp.com",
  databaseURL: "https://lichlamviectrabong-a4066-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "lichlamviectrabong-a4066",
  storageBucket: "lichlamviectrabong-a4066.firebasestorage.app",
  messagingSenderId: "18757050717",
  appId: "1:18757050717:web:42722e473da25e5145c8b4",
  measurementId: "G-E2ZMMC8NMT"
};

// Path Firebase theo từng đơn vị (uid) — dữ liệu hoàn toàn tách biệt
function getFbPath(uid){ return 'donvi/' + uid + '/events'; }
let fbStorage=null;

// ════ ONESIGNAL – PUSH NOTIFICATION + BADGE ════
// Hỗ trợ đầy đủ iOS (PWA ≥ iOS 16.4) và Android
const ONESIGNAL_APP_ID = 'fe97329e-e7d6-4626-a063-6c1e03c11a5c'; // ← điền sau khi tạo app
let _osReady = false;

function initFCM() {
  requestNotifPermission();
  _initOneSignal();
}

function _initOneSignal() {
  if(!ONESIGNAL_APP_ID || ONESIGNAL_APP_ID.includes('PASTE')) return;
  log('[OS] _initOneSignal start, AppID:', ONESIGNAL_APP_ID);
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  OneSignalDeferred.push(async function(OneSignal) {
    try {
      log('[OS] SDK loaded, calling init...');
      await OneSignal.init({
        appId: ONESIGNAL_APP_ID,
        notifyButton: { enable: false },
        serviceWorkerParam: { scope: '/' },
        serviceWorkerPath: '/OneSignalSDKWorker.js',
        autoResubscribe: true,
      });
      log('[OS] init done');

      _osReady = true;
      window._osSdkRef = OneSignal; // lưu để dùng sau khi Firebase sẵn sàng

      // Kiểm tra quyền hiện tại
      const alreadyGranted = OneSignal.Notifications.permission;
      log('[OS] permission:', alreadyGranted, '| native:', OneSignal.Notifications.permissionNative);
      if(alreadyGranted) {
        await _saveOSPlayerId(OneSignal);
      } else if(OneSignal.Notifications.permissionNative !== 'denied') {
        // Hiện banner sau 2s để user chủ động tap (iOS bắt buộc user gesture)
        setTimeout(_showNotifBanner, 2000);
        // Chưa hỏi → hỏi ngay (iOS PWA và Android cần user gesture,
        // nhưng OneSignal tự xử lý queue khi có gesture)
        const _askOS = async function() {
          document.removeEventListener('touchend', _askOS, true);
          document.removeEventListener('click',    _askOS, true);
          try {
            const ok = await OneSignal.Notifications.requestPermission();
            if(ok) await _saveOSPlayerId(OneSignal);
          } catch(_){}
        };
        // Android: thử gọi ngay
        // iOS: hiện banner (đã xử lý ở trên qua _showNotifBanner)
        try {
          const ok = await OneSignal.Notifications.requestPermission();
          if(ok) { await _saveOSPlayerId(OneSignal); _showNotifBanner(); }
        } catch(_) {}
      }

      // Token thay đổi → lưu lại
      OneSignal.User.PushSubscription.addEventListener('change', async function() {
        await _saveOSPlayerId(OneSignal);
      });

      // Foreground: chỉ log, không tăng badge (push_trigger listener đã xử lý)
      OneSignal.Notifications.addEventListener('foregroundWillDisplay', function(e) {
        log('[OS] foregroundWillDisplay:', e.notification.title);
      });

      // Click notification → xóa badge + nhảy đến đúng sự kiện (nếu push mang date/evId)
      OneSignal.Notifications.addEventListener('click', function(event) {
        clearNotif();
        try {
          var data = (event && event.notification && event.notification.additionalData) || {};
          var d = data.evDate || data.date || null;
          var ev = data.evId || data.ev || null;
          if (d) {
            _pendingDeepLink = { date: d, evId: ev };
            if (typeof _processDeepLink === 'function') _processDeepLink(); // điều hướng nếu dữ liệu đã sẵn sàng
          }
        } catch(_) {}
      });

    } catch(err) {
      logErr('[OS] init error:', err);
    }
  });
}

// Lưu Player ID vào Firebase (để GAS gửi push đến đúng thiết bị)
// Hiện banner "Bật thông báo" — luôn hiện trừ khi đã granted
function _showNotifBanner() {
  // Đã cho phép → không hiện nữa
  if(Notification.permission === 'granted') return;
  // Mọi trường hợp khác (denied, default) → vẫn hiện
  const b = document.getElementById('notifBanner');
  if(b) b.style.display = 'flex';
  // Chặn scroll body khi modal mở
  document.body.style.overflow = 'hidden';
}

// Gọi khi user tap vào banner
async function _requestOSPermission() {
  const b = document.getElementById('notifBanner');
  if(b) b.style.display = 'none';
  document.body.style.overflow = '';
  if(window._osSdkRef) {
    try {
      const ok = await window._osSdkRef.Notifications.requestPermission();
      if(ok) {
        // Cho phép → lưu ID, không hiện lại nữa
        await _saveOSPlayerId(window._osSdkRef);
        showNotice('✅ Đã bật thông báo lịch mới!');
      }
      // Từ chối → không lưu gì, lần sau mở app hiện lại
    } catch(e) {
      Notification.requestPermission().then(p => {
        if(p === 'granted') showNotice('✅ Đã bật thông báo!');
      });
    }
  } else {
    Notification.requestPermission();
  }
}

async function _saveOSPlayerId(OneSignal) {
  try {
    const userId = await OneSignal.User.PushSubscription.id;
    log('[OS] Player ID:', userId, '| fbDb:', !!fbDb);
    if(!userId) { logWarn('[OS] Không có Player ID'); return; }
    const platform = /iphone|ipad|ipod/i.test(navigator.userAgent) ? 'ios'
                    : /android/i.test(navigator.userAgent) ? 'android' : 'web';
    const key = userId.replace(/[.$#\[\]/]/g, '_');
    // fbDb có thể chưa ready → thử lại sau 2s nếu cần
    const _doSave = (db) => {
      db.ref('onesignal_ids/' + key).set({
        id: userId, platform, ts: Date.now(), ua: navigator.userAgent.slice(0,80)
      }).then(() => log('[OS] Đã lưu Player ID:', userId.slice(0,8)+'...'))
        .catch(e => logErr('[OS] Lỗi lưu:', e.message));
    };
    if(fbDb) {
      _doSave(fbDb);
    } else {
      // Firebase chưa init xong → chờ
      logWarn('[OS] fbDb chưa sẵn sàng, thử lại sau 3s...');
      setTimeout(() => { if(fbDb) _doSave(fbDb); }, 3000);
    }
  } catch(e) { logErr('[OS] _saveOSPlayerId error:', e); }
}

// Gửi push qua GAS (GAS sẽ gọi OneSignal API)


// ════════════════════════════════════════
// FIREBASE — Tây Trà Bồng
// Viewer: đọc thẳng donvi/{uid}/events (rules .read=true)
// Admin: đọc/ghi sau khi đăng nhập
// ════════════════════════════════════════
let fbDb=null, fbRef=null, fbReady=false;
let fbAuth=null;
let currentUID=null;
let currentUnitInfo=null;
let _fbInitialized=false;
let _isSaving=false;
const _sig=arr=>arr.map(e=>e.id+'|'+(e.hoan||0)+'|'+(e.title||'')+'|'+(e.date||'')+'|'+(e.time||'')+'|'+(e.location||'')+'|'+(e.chair||'')+'|'+(e.ses||'')).sort().join('~');
let _lastSig='';
let _lastSaveTs=0;
let _viewerRef=null;
// Reference giữ push_trigger listener để cleanup khi cần (đăng nhập/đăng xuất nhiều lần)
let _pushTriggerRef=null;
let _pushTriggerCb=null;

function _startPushTriggerListener(){
  if(!fbDb) return;
  // Tránh đăng ký nhiều listener cho cùng 1 path (memory leak khi user
  // đăng nhập/đăng xuất nhiều lần trong 1 session)
  if(_pushTriggerRef) return;
  _pushTriggerRef = fbDb.ref('push_trigger/latest');
  _pushTriggerCb = snap => {
    const d = snap.val();
    if(!d||!d.ts) return;
    const _ptKey = 'llv_pt_seen';
    const lastSeen = parseInt(localStorage.getItem(_ptKey)||'0');
    // Đã thấy push này rồi → bỏ qua
    if(d.ts <= lastSeen) return;
    localStorage.setItem(_ptKey, String(d.ts));
    const n = parseInt(d.count)||1;
    const _clr = parseInt(localStorage.getItem('llv_np_cleared')||'0');
    // Push cũ hơn thời điểm đã đọc → chỉ poll data, không thêm thông báo
    const isNew = d.ts > _clr && !_seenNewTs.has(d.ts);
    if(n > 0) {
      if(d.msg && isNew) {
        // Lấy evId/evDate trực tiếp từ payload (ưu tiên), fallback tìm theo ts/title
        let _evDate=d.evDate||null, _evId=d.evId||null, _evCatIcon=null, _evCatColor=null;
        if(!_evId && d.ts && d.msg){
          // Tìm event theo isNew timestamp (thêm mới)
          let _matched=events.find(e=>e.isNew&&Math.abs(e.isNew-d.ts)<5000);
          // Nếu không tìm được (sửa/hoãn/chuyển) → tìm theo title trong msg
          if(!_matched){
            const _msgLower=d.msg.toLowerCase();
            _matched=events.find(e=>{
              if(!e.title) return false;
              const t=e.title.toLowerCase();
              return _msgLower.includes(t)||t.split(' ').filter(w=>w.length>3).some(w=>_msgLower.includes(w));
            });
          }
          if(_matched){
            _evDate=_matched.date||null;
            _evId=_matched.id||null;
          }
        }
        // Lấy cat icon/color từ evId
        if(_evId){
          const _evObj=events.find(e=>e.id==_evId);
          if(_evObj){const _cat=CAT[_evObj.cat]||{icon:'📌',color:'#5b2d8e'};_evCatIcon=_cat.icon;_evCatColor=_cat.color;}
        }
        _addNotifMsg({msg:d.msg, ts:d.ts, date:_evDate, evId:_evId,
          catIcon:_evCatIcon, catColor:_evCatColor});
        if(typeof _updateMobNotifBadge==='function') _updateMobNotifBadge(_npMsgLog.length);
      }
      if(isNew) {
        triggerNotif(n);
        if('setAppBadge' in navigator) {
          const newBadge = (_getLocalBadge()||0) + n;
          navigator.setAppBadge(newBadge).catch(()=>{});
        }
      }
      // Luôn poll data mới nhất dù có hay không có thông báo
      if(!currentUID && typeof _pollViewer==='function') _pollViewer();
    }
  };
  _pushTriggerRef.on('value', _pushTriggerCb);
}

// Cleanup push_trigger listener — gọi khi cần (chưa dùng nhưng để sẵn cho future refactor)
function _stopPushTriggerListener(){
  if(_pushTriggerRef && _pushTriggerCb){
    try { _pushTriggerRef.off('value', _pushTriggerCb); } catch(e){}
  }
  _pushTriggerRef = null;
  _pushTriggerCb = null;
}

async function initFirebase(){
  try{
    if(typeof firebase==='undefined'||FB_CONFIG.apiKey==='PASTE_YOUR_API_KEY'){
return;}
    const app=firebase.initializeApp(FB_CONFIG);
    fbDb=firebase.database(app);
    fbAuth=firebase.auth(app);
    try{fbStorage=firebase.storage(app);}catch(e){}

    // App Check đã được gỡ bỏ cho lịch xã Tây Trà (không enforce trên RTDB/Storage).
    // Nếu sau này muốn bật lại: nạp firebase-app-check-compat.js ở index.html,
    // khai báo domain trong reCAPTCHA admin, rồi activate ReCaptchaV3Provider ở đây.

    fbReady=true;
    log('[Firebase] SDK ready');

    // Load viewer data + setup auth song song, KHÔNG block initFirebase resolve
    // initFirebase trả về ngay sau khi SDK init xong
    _loadViewerData().catch(e=>logWarn('[Firebase] _loadViewerData error:',e));
    _startPushTriggerListener();
    if(_osReady&&window._osSdkRef) _saveOSPlayerId(window._osSdkRef);

    fbAuth.onAuthStateChanged(async user=>{
      try{
      if(user){
        log('[Auth] user signed in:',user.uid);
        currentUID=user.uid;
        fbRef=fbDb.ref('donvi/'+user.uid+'/events');
        try{
          const snap=await fbDb.ref('donvi/'+user.uid+'/info').once('value');
          currentUnitInfo=snap.val()||null;
          if(currentUnitInfo){
            if(currentUnitInfo.tenCoQuan)ORG_CONFIG.tenCoQuan=currentUnitInfo.tenCoQuan;
            if(currentUnitInfo.tenNgan)ORG_CONFIG.tenNgan=currentUnitInfo.tenNgan;
            if(currentUnitInfo.nguoiPhuTrach)ORG_CONFIG.nguoiPhuTrach=currentUnitInfo.nguoiPhuTrach;
            if(currentUnitInfo.chucVu)ORG_CONFIG.chucVu=currentUnitInfo.chucVu;
            if(currentUnitInfo.donVi)ORG_CONFIG.donVi=currentUnitInfo.donVi;
            if(currentUnitInfo.soDienThoai)ORG_CONFIG.soDienThoai=currentUnitInfo.soDienThoai;
            if(currentUnitInfo.viTri&&currentUnitInfo.viTri.lat){WX_LAT=currentUnitInfo.viTri.lat;WX_LON=currentUnitInfo.viTri.lon;wxData=null;wxFetchedAt=0;}
            document.title='Lịch Làm Việc Số – '+ORG_CONFIG.tenCoQuan;
            ['orgCapVs','orgCapAdmin','orgCapTv'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=ORG_CONFIG.capCoQuan.toUpperCase();});
            ['orgTenVs','orgTenAdmin','orgTenTv'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=ORG_CONFIG.tenCoQuan;});
            const _b=document.getElementById('ahUnitName');if(_b)_b.textContent='👤 '+(ORG_CONFIG.tenNgan||ORG_CONFIG.tenCoQuan);
          }
        }catch(e){}
        isAdmin=true;
        await loadApiKeyFromFirebase();
        document.body.classList.add('is-admin');
        closeLogin();
        _stopViewerListener();
        _fbInitialized=false;
        _startRealtimeListener();
        await renderAll();
        if(_autoTV&&!tvOn){setTimeout(()=>{startTV();try{bc.postMessage({type:'tvOn'});}catch(e){}},300);}
      }else{
        log('[Auth] no user (viewer mode)');
        if(fbRef){try{fbRef.off();}catch(e){}}
        currentUID=null;currentUnitInfo=null;fbRef=null;_fbInitialized=false;
        isAdmin=false;
        document.body.classList.remove('is-admin');
        try{localStorage.removeItem('lcttb_auth');}catch(e){}
        // Sau logout: load lại viewer data NGAY để tránh lịch trống
        // (admin events khác viewer events, không thể giữ lại)
        try{
          _stopViewerListener();
          await _loadViewerData();
          renderAllNoFetch();
        }catch(e2){logWarn('[Auth] viewer reload failed:',e2);}
        if(_autoTV&&!tvOn){setTimeout(()=>{startTV();try{bc.postMessage({type:'tvOn'});}catch(e){}},500);}
      }
      }catch(e){
        logErr('[Auth] error:',e);
        try{await _loadViewerData();}catch(e2){}
        renderAllNoFetch();
        if(_autoTV&&!tvOn){setTimeout(()=>{startTV();try{bc.postMessage({type:'tvOn'});}catch(e2){}},500);}
      }
    });
  }catch(e){logErr('[Firebase] init error:',e);fbReady=false;}
}

async function _loadViewerData(){
  if(!fbDb)return;
  // UID viewer đọc từ subdomain (tendonvi.lichlamviectaytra.com.vn) qua getViewerUid().
  // Nếu subdomain chưa có trong map tĩnh, hỏi Firebase subdomain_map/{slug} (động).
  // Cách này cho phép thêm đơn vị mới chỉ bằng 1 record Firebase, không sửa code.
  let uid = getViewerUid();
  // Mô hình "mỗi đơn vị một tên miền": nếu index.html đã ghim sẵn meta
  // viewer-uid thì dùng luôn, KHÔNG hỏi subdomain_map (tránh tên miền lạ/www
  // làm tra nhầm). Chỉ resolve subdomain khi KHÔNG có meta tag (mô hình
  // đa đơn vị dùng chung 1 tên miền qua subdomain).
  let _hasMetaUid = false;
  try{
    const _m = document.querySelector('meta[name="viewer-uid"]');
    _hasMetaUid = !!(_m && _m.content && /^[A-Za-z0-9]{20,40}$/.test(_m.content));
  }catch(e){}
  try{
    if(!_hasMetaUid && typeof resolveUidFromSubdomain === 'function'){
      const resolved = await Promise.race([
        resolveUidFromSubdomain(),
        new Promise(r=>setTimeout(()=>r(null), 6000))
      ]);
      if(resolved) uid = resolved;
    }
  }catch(e){ logWarn('[Subdomain] resolve failed, dùng fallback:', e.message); }
  log('[ViewerData] đơn vị slug=', getDonViSlug(), '→ uid=', uid);
  const _timeout=ms=>new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),ms));
  try{
    const urlSnap=await Promise.race([
      fbDb.ref('donvi/'+uid+'/events_file').once('value'),
      _timeout(8000)
    ]);
    const eventsUrl=urlSnap.val();
    if(eventsUrl){
      // URL ổn định (không cache-buster) + cache:'no-cache' → luôn revalidate
      // bằng ETag, trả 304 (không tải body) khi events.json không đổi → tiết kiệm bandwidth.
      const fetchUrl=eventsUrl;
      log('[ViewerData] fetching:',fetchUrl.slice(0,120)+'...');
      const resp=await Promise.race([
        fetch(fetchUrl,{cache:'no-cache'}),
        _timeout(60000)
      ]);
      const fetched=resp.ok?(await resp.json())||[]:[];
      log('[ViewerData] fetched events.json, length='+fetched.length);
      if(fetched.length>0){
        events=fetched;
        // (đã tắt cache localStorage — dữ liệu chỉ lấy từ Cloud Storage)
        // Nếu boot đã hiện thông báo lỗi (do trước đó chưa có data) → giờ data về,
        // render lại để thay lỗi bằng lịch thật và gỡ spinner.
        try{
          var _spD=document.getElementById('vsLoadingSpinner');
          var _spM=document.getElementById('vsLoadingSpinnerMob');
          var _hasErr=(_spD&&_spD.classList.contains('is-load-error'))
                    ||(_spM&&_spM.classList.contains('is-load-error'));
          if(_hasErr){
            renderAllNoFetch();
            if(typeof removeLoadingSpinner==='function') removeLoadingSpinner();
          }
        }catch(e){}
      }
    }
    // Lấy last_update hiện tại để baseline (tránh refetch trong _onLuChange lần đầu)
    let _lastUpdateTs=-1;
    try{
      const _initLu=await Promise.race([
        fbDb.ref('donvi/'+uid+'/last_update').once('value'),
        _timeout(5000)
      ]);
      _lastUpdateTs=_initLu.val()||0;
      log('[Viewer] initial last_update:',_lastUpdateTs);
    }catch(e){}
    // Listener realtime: lắng nghe last_update thay đổi → poll ngay LẬP TỨC
    const _luRef=fbDb.ref('donvi/'+uid+'/last_update');
    const _onLuChange=async snap=>{
      if(currentUID)return; // đang ở admin mode
      const ts=snap.val()||0;
      if(ts===_lastUpdateTs)return; // không đổi (kể cả lần đầu vì đã baseline)
      _lastUpdateTs=ts;
      log('[Viewer] last_update changed → fetching new data');
      try{
        const urlSnap2=await Promise.race([
          fbDb.ref('donvi/'+uid+'/events_file').once('value'),
          _timeout(8000)
        ]);
        const url2=urlSnap2.val();if(!url2)return;
        const r=await Promise.race([fetch(url2,{cache:'no-cache'}),_timeout(60000)]);
        const incoming=r.ok?(await r.json())||[]:[];
        if(_sig(incoming)===_sig(events))return;
        const unseenNew=incoming.filter(e=>e.isNew&&e.isNew>0&&!_seenNewTs.has(e.isNew));
        events=incoming;
        renderAllNoFetch();
        unseenNew.forEach(e=>_markSeenNew(e.isNew));
        log('[Viewer] ✅ updated, events='+events.length);
      }catch(e){logWarn('[Viewer] fetch error:',e.message||e);}
    };
    _luRef.on('value', _onLuChange);

    _viewerRef={
      off:function(){
        try{_luRef.off('value',_onLuChange);}catch(e){}
        if(this._timer)clearInterval(this._timer);
      }
    };
    // Backup poll mỗi 5 phút (phòng trường hợp listener bị rớt khi network instability)
    async function _pollViewer(){
      if(currentUID)return;
      try{
        const snap=await Promise.race([
          fbDb.ref('donvi/'+uid+'/last_update').once('value'),
          _timeout(8000)
        ]);
        const ts=snap.val()||0;
        if(ts===_lastUpdateTs)return;
        // Trigger _onLuChange manually nếu listener bị skip
        _onLuChange({val:()=>ts});
      }catch(e){}
    }
    _viewerRef._timer=setInterval(_pollViewer,5*60*1000);
    updateNewBadge();
  }catch(e){
    logWarn('[ViewerData] Firebase error/timeout:', e.message||e);
  }
}

function _stopViewerListener(){if(_viewerRef){try{_viewerRef.off();}catch(e){};_viewerRef=null;}}
let _adminPollTimer=null;
let _pollAdminFn=null; // exposed để setInterval gọi được từ ngoài scope
function _startAdminPollTimer(){
  if(_adminPollTimer)clearInterval(_adminPollTimer);
  _adminPollTimer=setInterval(function(){if(_pollAdminFn)_pollAdminFn();},3*60*1000);
}

function _startRealtimeListener(){
  if(!fbRef||!currentUID)return;
  // Poll thay vì .on() để tiết kiệm bandwidth
  let _adminLastUpdateTs=0;
  async function _pollAdmin(){
    if(!fbRef||!currentUID)return;
    try{
      // Lần đầu load: fetch file JSON từ Storage
      if(!_fbInitialized){
        const urlSnap=await fbDb.ref('donvi/'+currentUID+'/events_file').once('value');
        const eventsUrl=urlSnap.val();
        let incoming=[];
        if(eventsUrl){
          const resp=await fetch(eventsUrl,{cache:'no-cache'});
          incoming=resp.ok?(await resp.json())||[]:[];
        }else{
          // Migrate từ cấu trúc cũ nếu chưa có file
          const snap=await fbRef.once('value');
          const val=snap.val();
          incoming=val?Object.values(val):[];
          if(incoming.length>0){events=incoming;save();}
        }
        _fbInitialized=true;
        events=incoming;
        renderAllNoFetch();
        _startAdminPollTimer();
        const lu=await fbDb.ref('donvi/'+currentUID+'/last_update').once('value');
        _adminLastUpdateTs=lu.val()||0;
        return;
      }
      // Các lần sau: chỉ poll last_update (vài byte)
      const lu=await fbDb.ref('donvi/'+currentUID+'/last_update').once('value');
      const ts=lu.val()||0;
      if(ts===_adminLastUpdateTs)return;
      _adminLastUpdateTs=ts;
      // Có thay đổi → fetch lại file JSON từ Storage
      const urlSnap=await fbDb.ref('donvi/'+currentUID+'/events_file').once('value');
      const eventsUrl=urlSnap.val();
      if(!eventsUrl)return;
      const resp=await fetch(eventsUrl,{cache:'no-cache'});
      const incoming=resp.ok?(await resp.json())||[]:[];
      const inSig=_sig(incoming);
      if(inSig===_lastSig&&_lastSig!==''){
        // Đây chính là data ta vừa save → không ghi đè, nhưng giữ _lastSig thêm 1 vòng nữa
        // để tránh trường hợp Firebase chưa propagate kịp ở lần poll tiếp theo
        setTimeout(()=>{_lastSig='';},8000);
        return;
      }
      _lastSig='';
      if(inSig!==_sig(events)){
        events=incoming;
        renderAllNoFetch();
      }
    }catch(e){}
  }
  _pollAdminFn=_pollAdmin;
  _pollAdmin();
} // end _startRealtimeListener
