
// ════════════════════════════════════════
// KEYBOARD & CLICK EVENTS
// ════════════════════════════════════════
// Safe event listeners
function safeOn(id,ev,fn){const el=document.getElementById(id);if(el)el.addEventListener(ev,fn);}
safeOn('ovLogin','click',e=>{if(e.target===e.currentTarget)closeLogin();});
safeOn('ovPrint','click',e=>{if(e.target===e.currentTarget)closePrintModal();});
// ovAdd: KHÔNG đóng khi click ra ngoài (tránh mất form khi nhỡ tay)
safeOn('ovWkList','click',e=>{if(e.target===e.currentTarget)closeWkList();});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){closeLogin();closeAdd();closeWkList();closeLb();closeSearch();closeQR();closeThongKe();closeXemThang();if(tvOn)stopTV();}
  if((e.key==='f'||e.key==='F')&&tvOn)stopTV();
  // Ctrl+Shift+A = mở đăng nhập quản trị (desktop shortcut)
  if(e.ctrlKey&&e.shiftKey&&(e.key==='A'||e.key==='a')&&!isAdmin){e.preventDefault();openLogin();}
  if(!document.getElementById('ovAdd').classList.contains('open')&&!tvOn){
    if(e.key==='ArrowLeft')nav(-1);
    if(e.key==='ArrowRight')nav(1);
  }
});

// Re-init scroll on window resize (debounced)
let _resizeTimer=null;
window.addEventListener('resize',()=>{
  clearTimeout(_resizeTimer);
  _resizeTimer=setTimeout(()=>{
    if(scrollOn||tvOn) startScroll();
    if(tvOn) setupTVScroll();
  },300);
});

// Re-render when tab becomes visible again
// Hàm xóa badge khi user mở/focus app thủ công (không qua notification)
function _onAppFocus(){
  if(typeof _openedViaNotif !== 'undefined' && _openedViaNotif){
    _openedViaNotif=false;
  }
  // Không xóa badge khi mở app — badge chỉ xóa khi user scroll đến cuối danh sách
  // Đóng notification cũ trong notification center
  if('serviceWorker' in navigator){
    navigator.serviceWorker.ready.then(function(reg){
      reg.getNotifications().then(function(notifs){
        notifs.forEach(function(n){ n.close(); });
      });
    }).catch(function(){});
  }
}

// visibilitychange: khi app từ background → foreground
document.addEventListener('visibilitychange',()=>{
  if(!document.hidden){
    // Refresh weather if stale
    if(Date.now()-wxFetchedAt>WX_TTL){wxData=null;fetchWx().then(d=>{renderWxBox(document.getElementById('vsWx'),d);renderWxBox(document.getElementById('ahWx'),d);});}
    _onAppFocus();
  }
});

// focus: khi bấm vào icon mở app từ màn hình chính (iOS/Android PWA)
window.addEventListener('focus', function(){
  _onAppFocus();
});

// pageshow: khi app được restore từ bfcache (bấm icon mở lại)
window.addEventListener('pageshow', function(e){
  _onAppFocus();
});

// (auto refresh weather moved to initApp)

// ════════════════════════════════════════
// BOOT
// ════════════════════════════════════════
// ════ INIT ALL ════
function initApp(){
  // Auth giờ do Firebase Auth quản lý qua onAuthStateChanged
  // Không cần auto-login từ localStorage nữa
  // Gắn drag-drop file zone
  initFdz();
  // Auto refresh weather
  setInterval(()=>{
    wxData=null;
    fetchWx().then(wxd=>{
      renderWxBox(document.getElementById('vsWx'),wxd);
      renderWxBox(document.getElementById('ahWx'),wxd);
      renderFcStrip('vsFc',wxd);
      renderFcStrip('ahFc',wxd);
      renderVsTable(wkStart(wkOff),wxd);
      renderAdminTable(wkStart(wkOff),wxd);
    });
  },WX_TTL);
}

function trackVisit(){
  if(!fbDb) return;
  try{
    // Ngày hôm nay theo giờ VN
    var now=new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Ho_Chi_Minh'}));
    var dateKey=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
    // Session key: user + ngày (tránh đếm refresh)
    var sessKey='visit_'+dateKey;
    if(sessionStorage.getItem(sessKey)) return; // đã tính trong session này
    sessionStorage.setItem(sessKey,'1');
    // Ghi vào Firebase: analytics/visits/{dateKey}/total (tăng 1)
    var ref=fbDb.ref('analytics/visits/'+dateKey+'/total');
    ref.transaction(function(cur){ return (cur||0)+1; });
    // Ghi thêm platform
    var platform=/iphone|ipad|ipod/i.test(navigator.userAgent)?'ios'
                :/android/i.test(navigator.userAgent)?'android':'desktop';
    var pRef=fbDb.ref('analytics/visits/'+dateKey+'/'+platform);
    pRef.transaction(function(cur){ return (cur||0)+1; });
  }catch(e){}
}

(async()=>{
  renderSkeletonTable();
  initScroll();
  initApp();

  const _params=new URLSearchParams(window.location.search);
  const _tvParam=_params.get('tv');
  if(_tvParam==='1'||_tvParam===''||window.location.search.includes('tv1')){
    _autoTV=true;
    // Không startTV() ngay — sẽ startTV sau khi Firebase load xong để có dữ liệu
  }
  if(!_autoTV) initFCM();
  setTimeout(_onAppFocus,300);

  const _T=ms=>new Promise((_,r)=>setTimeout(()=>r(new Error('timeout_'+ms)),ms));

  try{
    log('[Boot] start');
    setLoadProgress(10);

    // Khởi động weather NGAY ở đầu boot (song song với Firebase)
    const _wxPromise=fetchWx().catch(()=>null);

    // Bước 1: Khởi động Firebase SDK
    log('[Boot] initFirebase...');
    await Promise.race([initFirebase(), _T(6000)]).catch(e=>{
      logWarn('[Boot] initFirebase timeout/error:',e.message);
    });
    log('[Boot] fbReady='+fbReady+', events='+events.length);
    setLoadProgress(50);

    // Bước 2: Chờ _loadViewerData load xong từ Firebase (tối đa 60s cho file lớn)
    if(fbReady && events.length===0){
      log('[Boot] waiting for Firebase data...');
      await Promise.race([
        new Promise(resolve=>{
          const _check=setInterval(()=>{
            if(events.length>0||!fbReady){clearInterval(_check);resolve();}
          },200);
        }),
        _T(60000)
      ]).catch(()=>{logWarn('[Boot] Firebase data timeout after 60s');});
      log('[Boot] events after Firebase wait='+events.length);
    }

    // Deep-link từ push mở bằng URL (?d=YYYY-MM-DD&ev=<id>) → nhảy đến sự kiện
    // CHỈ lưu lại; xử lý SAU khi đã render (DOM mới có card ngày) ở cuối hàm boot.
    try{
      var _dl_d = _params.get('d') || _params.get('date');
      var _dl_ev = _params.get('ev') || _params.get('evId');
      if(_dl_d){ window._pendingDeepLink = { date: _dl_d, evId: _dl_ev }; }
    }catch(_){}

    // Bước 3: Chờ weather xong (tối đa 8s, đã chạy song song nên thường đã có)
    setLoadProgress(80);
    log('[Boot] waiting for weather...');
    const wxd=await Promise.race([_wxPromise, _T(8000)]).catch(()=>null);
    if(wxd&&!wxData){wxData=wxd;wxFetchedAt=Date.now();}
    log('[Boot] weather ready, wxData='+!!wxData+', mock='+wxMock);

    // Bước 4: Render — đã có data thật, tắt flag initial load
    _isInitialLoad=false;
    setLoadProgress(95);
    // Chỉ xóa spinner khi có data, nếu không cứ giữ spinner cho đến khi data về
    if(events.length>0) removeLoadingSpinner();
    else showLoadError(); // không tải được lịch → báo lỗi + nút tải lại, KHÔNG kẹt mãi
    if(_autoTV&&!tvOn){
      startTV();
      try{bc.postMessage({type:'tvOn'});}catch(e){}
    } else {
      await renderAllNoFetch();
    }
    // Xử lý deep-link SAU khi đã render (DOM đã có card ngày) — sửa lỗi không nhảy đúng lịch
    try{ if(window._pendingDeepLink && typeof _processDeepLink==='function'){ setTimeout(_processDeepLink, 300); } }catch(_){}
    trackVisit();
    log('[Boot] done, events='+events.length);
  }catch(err){
    logErr('[Boot] error:',err);
    _isInitialLoad=false;
    if(events.length>0) removeLoadingSpinner();
    renderAllNoFetch();
  }
})();
