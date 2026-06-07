
// ════════════════════════════════════════
// RENDER ALL
// ════════════════════════════════════════
const CG=`<colgroup><col class="c-day"><col class="c-ses"><col class="c-ct"><col class="c-ch"><col class="c-pl"><col class="c-mb"><col class="c-pr"></colgroup>`;
const VS_TH=`<thead><tr>
  <th>THỨ</th>
  <th>BUỔI</th>
  <th>NỘI DUNG CÔNG TÁC</th>
  <th>CHỦ TRÌ/DỰ</th>
  <th>ĐỊA ĐIỂM</th>
  <th>THÀNH PHẦN</th>
  <th>CƠ QUAN CHUẨN BỊ</th>
</tr></thead>`;
const TV_TH=`<thead><tr>
  <th>THỨ</th>
  <th>BUỔI</th>
  <th>NỘI DUNG CÔNG TÁC</th>
  <th>CHỦ TRÌ/DỰ</th>
  <th>ĐỊA ĐIỂM</th>
  <th>THÀNH PHẦN</th>
  <th>CƠ QUAN CHUẨN BỊ</th>
</tr></thead>`;


function _makeSpinnerEl(id){
  var sp=document.createElement('div');
  sp.id=id;
  sp.className='vs-loading-spinner';
  sp.innerHTML=
    '<div class="sk-ring-wrap">'
      +'<div class="sk-ring"></div>'
      +'<div class="sk-ring2"></div>'
      +'<div class="sk-ring3"></div>'
      +'<div class="sk-dot sk-dot1"></div>'
      +'<div class="sk-dot sk-dot2"></div>'
      +'<div class="sk-dot sk-dot3"></div>'
    +'</div>'
    +'<div class="sk-texts-wrap">'
      +'<span class="sk-txt sk-t1">Xin vui lòng chờ. Đang tải lịch làm việc...</span>'
    +'</div>'
    +'<div class="sk-bar-wrap"><div class="sk-bar"></div></div>';
  return sp;
}
function renderSkeletonTable(){
  var isTvViewer=document.body.classList.contains('is-tv-viewer');
  // Khi ở TV viewer mode → append spinner thẳng vào <body> để căn giữa toàn màn hình
  // (tránh bị giới hạn bởi containing block / overflow:hidden của .vs-tbl-outer)
  if(isTvViewer){
    if(!document.getElementById('vsLoadingSpinner')){
      var sp=_makeSpinnerEl('vsLoadingSpinner');
      // Inline style để chắc chắn full-screen, không phụ thuộc CSS class
      sp.style.cssText='position:fixed!important;top:0!important;left:0!important;right:0!important;bottom:0!important;width:100vw!important;height:100vh!important;z-index:99999!important;background:var(--bg2)!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:22px!important;margin:0!important;padding:0!important';
      document.body.appendChild(sp);
    }
  } else {
    // Desktop spinner → gắn vào .vs-tbl-outer
    var outer=document.getElementById('vsTableOuter')||document.querySelector('.vs-tbl-outer');
    if(outer&&!document.getElementById('vsLoadingSpinner')){
      outer.style.position='relative';
      outer.appendChild(_makeSpinnerEl('vsLoadingSpinner'));
    }
  }
  // Mobile spinner → gắn vào #vsCards
  var cards=document.getElementById('vsCards');
  if(cards&&!document.getElementById('vsLoadingSpinnerMob')){
    cards.style.position='relative';
    cards.appendChild(_makeSpinnerEl('vsLoadingSpinnerMob'));
  }
  // Kick off progress bar (từ 0% → 15%)
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){ setLoadProgress(15); });
  });
}
function animateProgress(pct, duration=250){
  const bar = document.querySelector('#vsLoadingSpinner .sk-bar');
  if(!bar) return;
  const start = parseFloat(bar.style.width) || 0;
  const end = pct;
  const startTime = performance.now();
  function update(now){
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const current = start + (end - start) * progress;
    setLoadProgress(current);
    if(progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

function setLoadProgress(pct){
  ['#vsLoadingSpinner .sk-bar','#vsLoadingSpinnerMob .sk-bar'].forEach(function(sel){
    var bar=document.querySelector(sel);
    if(bar) bar.style.width=pct+'%';
  });
}
function _removeSpinnerById(id){
  var sp=document.getElementById(id);
  if(sp){
    sp.style.transition='opacity .3s';
    sp.style.opacity='0';
    setTimeout(function(){if(sp.parentNode)sp.parentNode.removeChild(sp);},320);
  }
}
function removeLoadingSpinner(){
  // Chạy đến 100% rồi mới fade out cả 2 spinner
  setLoadProgress(100);
  setTimeout(function(){
    _removeSpinnerById('vsLoadingSpinner');
    _removeSpinnerById('vsLoadingSpinnerMob');
  },350);
}
// Khi chờ quá lâu mà KHÔNG tải được lịch (mạng/CDN lỗi) → thay spinner bằng
// thông báo rõ ràng + nút Tải lại, để không kẹt "Đang tải" vĩnh viễn.
function showLoadError(){
  // Nếu đã có lịch rồi thì thôi
  if(typeof events!=='undefined' && events.length>0) return;
  var html='<div class="load-error-box" role="alert">'
    +'<div class="le-ico">📡</div>'
    +'<div class="le-title">Chưa tải được lịch làm việc</div>'
    +'<div class="le-desc">Mạng có thể đang chậm hoặc gián đoạn. Vui lòng kiểm tra kết nối và thử lại.</div>'
    +'<button class="le-btn" onclick="location.reload()">🔄 Tải lại</button>'
    +'</div>';
  ['vsLoadingSpinner','vsLoadingSpinnerMob'].forEach(function(id){
    var el=document.getElementById(id);
    if(el){ el.innerHTML=html; el.classList.add('is-load-error'); }
  });
}
async function renderAll(skipFetch){
  updateNewBadge();
  // Bước 1: Kết nối (0% → 20%)
  animateProgress(20);
  // Nếu vừa save xong (_lastSig còn) → không fetch lại Firebase (tránh ghi đè data mới bằng snapshot cũ)
  const _skipDueToRecentSave=!!_lastSig;
  const _rtimeout=ms=>new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),ms));
  if(!skipFetch&&!_skipDueToRecentSave&&fbReady&&fbRef&&currentUID){
    // Bước 2: Lấy dữ liệu (20% → 70%)
    animateProgress(70);
    // Lấy snapshot một lần khi load trang
    try{
      const urlSnap=await Promise.race([
        fbDb.ref('donvi/'+currentUID+'/events_file').once('value'),
        _rtimeout(8000)
      ]);
      const eventsUrl=urlSnap.val();
      if(eventsUrl){
        // Đọc file JSON từ Storage qua URL (timeout 10 giây)
        const resp=await Promise.race([
          fetch(eventsUrl+(eventsUrl.indexOf('?')>=0?'&':'?')+'t='+Date.now(),{cache:'no-store'}),
          _rtimeout(10000)
        ]);
        const fetched=resp.ok?(await resp.json())||[]:null;
        // Kiểm tra lại: nếu trong lúc await có save mới, không ghi đè
        if(fetched!==null&&!_lastSig) events=fetched;
        else if(fetched!==null&&_lastSig){/* bỏ qua, events đã đúng */}
      }else{
        // Chưa có file → thử đọc theo cấu trúc cũ (migrate)
        const snap=await Promise.race([fbRef.once('value'),_rtimeout(8000)]);
        const val=snap.val();
        const migrated=val?Object.values(val):[];
        if(!_lastSig) events=migrated;
        // Nếu có dữ liệu cũ → migrate ngay lên Storage
        if(events.length>0&&!_lastSig){save();}
      }
      // (đã tắt cache localStorage — events chỉ đến từ Cloud Storage)
    }catch(e){
      logWarn('[renderAll] fetch lỗi:', e.message||e);
      // Cloud không truy cập được → KHÔNG dùng bản cũ cục bộ. Giữ nguyên dữ
      // liệu đang có (nếu có) để tránh xoá nhầm; chưa có gì thì để trống cho
      // UI báo lỗi tải (showLoadError) hiển thị nút Tải lại.
      if(!Array.isArray(events)) events=[];
    }
  }else{
    // Bước 2: fallback localStorage (20% → 70%)
    animateProgress(70);
    // Viewer đang có data từ _loadViewerData → không reset events
    if(_viewerRef){
      // Đã có viewer listener, giữ nguyên events
    } else {
      // Không có Firebase và không phải viewer (backend chưa sẵn sàng):
      // không còn localStorage → dùng dữ liệu mẫu tạm cho lần hiển thị đầu.
      events = samples();
    }
  }
  // Bước 3: Render (70% → 90%, rồi removeLoadingSpinner tự đẩy 100%)
  animateProgress(90);
  const ws=wkStart(wkOff);const we=addDays(ws,6);const wn=wkNum(ws);
  let wxd=wxData||null;
  if(!wxd&&!skipFetch){try{wxd=await fetchWx();}catch(e){wxd=null;}}

  // Labels
  const lblWk=`Tuần ${wn} · ${fmtVi(ws)} – ${fmtVi(we)}`;
  const dn=['Chủ nhật','Thứ hai','Thứ ba','Thứ tư','Thứ năm','Thứ sáu','Thứ bảy'];
  const el=id=>document.getElementById(id);
  if(el('vsRibWk'))el('vsRibWk').textContent='📅 '+lblWk;
  if(el('vsNavWk'))el('vsNavWk').textContent='📅 '+lblWk;
  if(el('vsNavDt'))el('vsNavDt').textContent=fmtViLong(TODAY);
  if(el('vsRibDt'))el('vsRibDt').textContent=`${dn[TODAY.getDay()]}, ${fmtVi(TODAY)}`;
  if(el('mobWkBar'))el('mobWkBar').textContent=lblWk;
  if(el('adminMobWkBar'))el('adminMobWkBar').textContent=lblWk;
  if(el('adminWkBar'))el('adminWkBar').textContent=`📅 Lịch làm việc tuần ${wn} · Từ ${fmtVi(ws)} đến ${fmtVi(we)}`;
  if(el('atbLbl'))el('atbLbl').textContent=lblWk;
  if(el('wmT'))el('wmT').textContent=`Lịch làm việc tuần ${wn} năm ${ws.getFullYear()}`;
  if(el('wmS'))el('wmS').textContent=`Từ ${fmtVi(ws)} đến ${fmtVi(we)}`;
  if(el('wmB'))el('wmB').textContent=`Tuần ${wn}/${ws.getFullYear()}`;

  // Weather
  renderWxBox(el('vsWx'),wxd);
  renderWxBox(el('ahWx'),wxd);
  renderFcStrip('vsFc',wxd);
  renderFcStrip('ahFc',wxd);

  // Tables
  if(events.length>0) removeLoadingSpinner();
  renderVsTable(ws,wxd);
  renderAdminTable(ws,wxd);
  renderSummary(ws);
  renderLegend();
  renderMobileCards(ws,wxd);
  renderAdminCards(ws,wxd);

  if(tvOn)renderTVContent(ws,wxd);
  refreshWkListIfOpen();
}

// Render không load lại từ server (dùng sau khi xoá/sửa trực tiếp)
async function renderAllNoFetch(){
  updateNewBadge();
  const ws=wkStart(wkOff);const we=addDays(ws,6);const wn=wkNum(ws);
  let wxd=wxData||null;
  const lblWk=`Tuần ${wn} · ${fmtVi(ws)} – ${fmtVi(we)}`;
  const dn=['Chủ nhật','Thứ hai','Thứ ba','Thứ tư','Thứ năm','Thứ sáu','Thứ bảy'];
  const el=id=>document.getElementById(id);
  if(el('vsRibWk'))el('vsRibWk').textContent='📅 '+lblWk;
  if(el('vsNavWk'))el('vsNavWk').textContent='📅 '+lblWk;
  if(el('vsNavDt'))el('vsNavDt').textContent=fmtViLong(TODAY);
  if(el('vsRibDt'))el('vsRibDt').textContent=`${dn[TODAY.getDay()]}, ${fmtVi(TODAY)}`;
  if(el('mobWkBar'))el('mobWkBar').textContent=lblWk;
  if(el('adminMobWkBar'))el('adminMobWkBar').textContent=lblWk;
  if(el('adminWkBar'))el('adminWkBar').textContent=`📅 Lịch làm việc tuần ${wn} · Từ ${fmtVi(ws)} đến ${fmtVi(we)}`;
  if(el('atbLbl'))el('atbLbl').textContent=lblWk;
  if(el('wmT'))el('wmT').textContent=`Lịch làm việc tuần ${wn} năm ${ws.getFullYear()}`;
  if(el('wmS'))el('wmS').textContent=`Từ ${fmtVi(ws)} đến ${fmtVi(we)}`;
  if(el('wmB'))el('wmB').textContent=`Tuần ${wn}/${ws.getFullYear()}`;
  renderWxBox(el('vsWx'),wxd);renderWxBox(el('ahWx'),wxd);
  renderFcStrip('vsFc',wxd);renderFcStrip('ahFc',wxd);
  // Chỉ xóa spinner khi có data; nếu events rỗng giữ spinner cho user thấy đang load
  if(events.length>0) removeLoadingSpinner();
  renderVsTable(ws,wxd);renderAdminTable(ws,wxd);
  renderSummary(ws);renderLegend();
  renderMobileCards(ws,wxd);renderAdminCards(ws,wxd);
  if(tvOn)renderTVContent(ws,wxd);
  refreshWkListIfOpen();
}

// ════════════════════════════════════════
// VIEWER TABLE (single table, sticky thead)
// ════════════════════════════════════════
function renderVsTable(ws,wxd){
  // Nếu events hoàn toàn rỗng → giữ spinner
  if(events.length===0){
    if(!document.getElementById('vsLoadingSpinner')){
      var isTvViewer=document.body.classList.contains('is-tv-viewer');
      if(isTvViewer){
        var sp=_makeSpinnerEl('vsLoadingSpinner');
        sp.style.cssText='position:fixed!important;top:0!important;left:0!important;right:0!important;bottom:0!important;width:100vw!important;height:100vh!important;z-index:99999!important;background:var(--bg2)!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:22px!important;margin:0!important;padding:0!important';
        document.body.appendChild(sp);
      } else {
        const outer=document.getElementById('vsTableOuter')||document.querySelector('.vs-tbl-outer');
        if(outer){
          outer.style.position='relative';
          outer.appendChild(_makeSpinnerEl('vsLoadingSpinner'));
        }
      }
    }
    return;
  }
  _removeSpinnerById('vsLoadingSpinner');
  const days=Array.from({length:7},(_,i)=>addDays(ws,i));
  const ts=todStr();let html='';
  days.forEach(d=>{
    const ds=iso(d);const itd=ds===ts;const sun=d.getDay()===0;const sat=d.getDay()===6;
    const dc=itd?'td-today':sun?'td-sun':sat?'td-sat':'';
    const eS=dayEvs(ds,'sang');const eC=dayEvs(ds,'chieu');
    const wxS=wxd?wxSes(wxd,ds,'sang'):null;const wxC=wxd?wxSes(wxd,ds,'chieu'):null;
    const wxShow=wxS||wxC;
    const wxH=wxShow?`<div class="vd-wx"><span class="vd-wx-row"><span class="wi">${wxShow.icon}</span><span class="wt">${wxShow.temp}°C</span></span><span class="wr">${wxShow.prob>0?wxShow.prob+'%🌧':wxShow.desc}</span></div>`:'';
    const eT=dayEvs(ds,'toi');const nS=Math.max(eS.length,1),nC=Math.max(eC.length,1),nT=eT.length,nR=2+nS+nC+(nT>0?1+nT:0);

    // Session sáng header
    html+=`<tr>
      <td class="td-day ${dc}" rowspan="${nR}">
        <div class="vd-dow">${viDow(d.getDay())}</div>
        <div class="vd-num">${String(d.getDate()).padStart(2,'0')}</div>
        <div class="vd-dt">${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}</div>
        ${wxH}
      </td>
      <td class="td-ses-hdr">${spill('sang')}</td>
      <td class="td-ses-span" colspan="5"></td>
    </tr>`;
    // Sáng events
    eS.length===0 ? html+=emptyRow() : eS.forEach(e=>{html+=vsEvRow(e,itd);});
    // Session chiều header
    html+=`<tr><td class="td-ses-hdr">${spill('chieu')}</td><td class="td-ses-span" colspan="5"></td></tr>`;
    // Chiều events
    eC.length===0 ? html+=emptyRow() : eC.forEach(e=>{html+=vsEvRow(e,itd);});
    // Tối: chỉ hiện nếu có lịch
    if(eT.length>0){
      html+=`<tr><td class="td-ses-hdr">${spill('toi')}</td><td class="td-ses-span" colspan="5"></td></tr>`;
      eT.forEach(e=>{html+=vsEvRow(e,itd);});
    }
  });

  // Đặt thead vào vsHeadFixed (cố định)
  const headFixed=document.getElementById('vsHeadFixed');
  if(headFixed)headFixed.innerHTML=`<table class="vs-tbl">${CG}${VS_TH}</table>`;

  // vsWrap chỉ chứa tbody (cuộn / translateY)
  const wrap=document.getElementById('vsWrap');
  if(wrap)wrap.innerHTML=`<table class="vs-tbl">${CG}<tbody>${html}</tbody></table>`;

  initScroll();
}

function spill(ses){
  if(ses==='sang')return`<span class="ses-pill sp-s">☀️ SÁNG</span>`;
  if(ses==='toi')return`<span class="ses-pill sp-t">🌙 TỐI</span>`;
  return`<span class="ses-pill sp-c">🌤 CHIỀU</span>`;
}
function emptyRow(){return`<tr class="tr-empty"><td class="td-ses-empty"></td><td colspan="5"><span class="e-dash"></span></td></tr>`;}
function vsEvRow(e,itd){
  const fileList=(e.files||[]);
  const files=fileList.length?
    ` `+fileList.map((f,fi)=>`<span class="ev-fb" onclick="openFile(events.find(x=>x.id==${e.id}).files[${fi}]);event.stopPropagation()" style="background:${fBg(f.type)};border-color:${fBorder(f.type)};color:${fColor(f.type)}" title="${escAttr(f.name||'File đi kèm')}"><span class="ev-fb-ico">${fIcon(f.type)}</span><span class="ev-fb-name">File đi kèm</span><span style="font-size:8.5px;font-weight:800;background:${fColor(f.type)};color:#fff;border-radius:3px;padding:1px 4px;margin-left:2px;flex-shrink:0">${esc(fLabel(f.type,f.name))}</span></span>`).join(' '):'';
  return`<tr class="tr-ev${itd?' tr-today':''}${isHoan(e)?' ev-hoan':''}">
    <td class="td-ses-empty"></td>
    <td class="td-ct ac-${e.cat}">${e.time?`<div class="ev-time">🕐 ${esc(e.time)}</div>`:''}<div class="ev-title">${catOf(e).icon} ${esc(e.title)}${isHoan(e)?' <span class="ev-hoan-badge">⏸ Hoãn</span>':''}${e.isNew&&e.isNew>0?' <span class="ev-new-badge">NEW</span>':''}${files}</div></td>
    <td class="td-ch">${esc(e.chair)||'—'}</td>
    <td class="td-pl">${e.location?'📍 '+esc(e.location):'—'}</td>
    <td class="td-mb">${esc(e.member)||'—'}</td>
    <td class="td-pr">${esc(e.prep)||'—'}</td>
  </tr>`;
}

// ════════════════════════════════════════
// ADMIN TABLE (standard table, same colgroup)
// ════════════════════════════════════════
function renderAdminTable(ws,wxd){
  const el=document.getElementById('adminTbody');if(!el)return;
  const days=Array.from({length:7},(_,i)=>addDays(ws,i));const ts=todStr();let html='';
  days.forEach(d=>{
    const ds=iso(d);const itd=ds===ts;const sun=d.getDay()===0;const sat=d.getDay()===6;
    const dc=itd?'td-today':sat?'td-sat':sun?'td-sun':'';
    const eS=dayEvs(ds,'sang');const eC=dayEvs(ds,'chieu');
    const wxS=wxd?wxSes(wxd,ds,'sang'):null;const wxC=wxd?wxSes(wxd,ds,'chieu'):null;const wxShow=wxS||wxC;
    const wxH=wxShow?`<div class="ad-wx" style="display:inline-flex;align-items:center;gap:2px;margin-top:3px;font-size:9px;background:var(--bg);border-radius:4px;padding:2px 5px">${wxShow.icon}<span style="font-weight:800;color:var(--red2)">${wxShow.temp}°C</span></div>`:'';
    const eT=dayEvs(ds,'toi');const nS=Math.max(eS.length,1),nC=Math.max(eC.length,1),nT=eT.length,nR=2+nS+nC+(nT>0?1+nT:0);

    // Sáng header row
    html+=`<tr>
      <td class="td-aday ${dc}" rowspan="${nR}">
        <div class="ad-dow">${viDow(d.getDay())}</div>
        <div class="ad-dt">${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}</div>
        ${wxH}
      </td>
      <td class="td-ases"><span class="ases-b ab-s">☀️ SÁNG</span></td>
      <td class="td-ases-span" colspan="5"></td>
    </tr>`;
    // Sáng events
    if(eS.length===0){html+=aEmptyRow(ds,'sang',itd);}
    else eS.forEach((e,i)=>{html+=aEvRow(ds,'sang',itd,e,i===eS.length-1);});
    // Chiều header row
    html+=`<tr><td class="td-ases"><span class="ases-b ab-c">🌤 CHIỀU</span></td><td class="td-ases-span" colspan="5"></td></tr>`;
    // Chiều events
    if(eC.length===0){html+=aEmptyRow(ds,'chieu',itd);}
    else eC.forEach((e,i)=>{html+=aEvRow(ds,'chieu',itd,e,i===eC.length-1);});
    // Tối: chỉ hiện nếu có lịch
    if(eT.length>0){
      html+=`<tr><td class="td-ases"><span class="ases-b" style="background:linear-gradient(135deg,#e8e0ff,#c5b8ff);color:#3a1a8c;border-left:3px solid #6b4fd4">🌙 TỐI</span></td><td class="td-ases-span" colspan="5"></td></tr>`;
      eT.forEach((e,i)=>{html+=aEvRow(ds,'toi',itd,e,i===eT.length-1);});
    }
  });
  el.innerHTML=html;
}

function aEmptyRow(ds,ses,itd){
  return`<tr><td class="td-ases-empty"></td><td class="td-aev td-add${itd?' td-today-s':''}" colspan="5" onclick="openAddDs('${ds}','${ses}')"><div class="add-hint">＋ Thêm Lịch làm việc</div></td></tr>`;
}

function aEvRow(ds,ses,itd,e,isLast){
  const fb=(e.files||[]).map((f,fi)=>`<span class="ace-fb" onclick="openFile(events.find(x=>x.id==${e.id}).files[${fi}]);event.stopPropagation()" style="cursor:pointer" title="${escAttr(f.name)}">${fIcon(f.type)} File đi kèm</span>`).join('');
  return`<tr>
    <td class="td-ases-empty"></td>
    <td class="td-aev td-add${itd?' td-today-s':''}" onclick="openEdit(${e.id})">
      <div class="acard ac-admin-${e.cat}">
        ${e.time?`<div class="ace-t">🕐 ${esc(e.time)}</div>`:''}
        <div class="ace-title">${catOf(e).icon} ${esc(e.title)}${isHoan(e)?'<span class="badge-hoan">⏸ Hoãn</span>':''}${e.isNew&&e.isNew>0?'<span class="badge-new">NEW</span>':''}</div>
        ${fb?`<div class="ace-files">${fb}</div>`:''}
      </div>
      ${isLast?`<div class="add-hint" onclick="openAddDs('${ds}','${ses}');event.stopPropagation()">＋ Thêm Lịch làm việc</div>`:''}
    </td>
    <td class="td-aev${itd?' td-today-s':''}" style="font-size:11px;color:var(--muted);vertical-align:middle;padding:5px 8px!important">${e.chair?esc(e.chair):'—'}</td>
    <td class="td-aev${itd?' td-today-s':''}" style="font-size:11px;color:var(--muted);vertical-align:middle;padding:5px 8px!important">${e.location?'📍 '+esc(e.location):'—'}</td>
    <td class="td-aev${itd?' td-today-s':''}" style="font-size:10.5px;color:var(--subtle);vertical-align:middle;padding:5px 8px!important">${esc(e.member)||'—'}</td>
    <td class="td-aev${itd?' td-today-s':''}" style="font-size:10.5px;color:var(--subtle);vertical-align:middle;padding:5px 8px!important">${esc(e.prep)||'—'}</td>
  </tr>`;
}

function renderSummary(ws){
  const el=document.getElementById('adminSum');if(!el)return;
  const wds=Array.from({length:7},(_,i)=>iso(addDays(ws,i)));
  const we=events.filter(e=>wds.includes(e.date));
  el.innerHTML=Object.entries(CAT).map(([k,v])=>{const n=we.filter(e=>e.cat===k).length;return`<div class="asc ${k}"><span class="si">${v.icon}</span><div><div class="sn">${n}</div><div class="sl">${v.label}</div></div></div>`;}).join('');
}

function renderLegend(){
  const vs=document.getElementById('vsLeg');const tv=document.getElementById('tvLeg');
  const al=document.getElementById('adminLeg');
  const h=Object.entries(CAT).map(([k,v])=>`<div class="leg-i"><span class="leg-d" style="background:${v.color}"></span>${v.icon} ${v.label}</div>`).join('');
  if(vs)vs.innerHTML=h;
  if(al)al.innerHTML=h;
  if(tv)tv.innerHTML=Object.entries(CAT).map(([k,v])=>`<div class="tv-li"><span class="tv-ld" style="background:${v.color}"></span>${v.icon} ${v.label}</div>`).join('');
}

// ════════════════════════════════════════
// MOBILE CARDS
// ════════════════════════════════════════
function renderMobileCards(ws,wxd){
  const el=document.getElementById('vsCards');if(!el)return;
  // Nếu events hoàn toàn rỗng → giữ spinner thay vì hiện "Không có lịch"
  // (chỉ admin mới có thể tạo lịch mới, viewer thấy lịch trống = bất thường = đang load)
  if(events.length===0){
    // Đảm bảo spinner đang hiển thị
    if(!document.getElementById('vsLoadingSpinnerMob')){
      const sp=_makeSpinnerEl('vsLoadingSpinnerMob');
      el.style.position='relative';
      el.appendChild(sp);
    }
    log('[renderMobileCards] events=0, keeping spinner');
    return;
  }
  // Có data → xóa spinner nếu còn
  _removeSpinnerById('vsLoadingSpinnerMob');
  const days=Array.from({length:7},(_,i)=>addDays(ws,i));const ts=todStr();let h='';
  days.forEach(d=>{
    const ds=iso(d);const itd=ds===ts;const sat=d.getDay()===6;
    const hc=itd?'h-today':sat?'h-sat':'h-red';
    const eS=dayEvs(ds,'sang');const eC=dayEvs(ds,'chieu');
    const wxS=wxd?wxSes(wxd,ds,'sang'):null;const wxC=wxd?wxSes(wxd,ds,'chieu'):null;const wxShow=wxS||wxC;
    const total=eS.length+eC.length;
    // Hiện đủ 7 ngày kể cả ngày không có lịch
    const wxH=wxShow?`<div class="vdc-wx">${wxShow.icon} ${wxShow.temp}°C</div>`:'';
    h+=`<div class="vdc" data-date="${ds}">
      <div class="vdc-hdr ${hc}${itd?' vdc-hdr-today':''}">
        <div class="vdc-main"><span class="vdc-dow">${viDow(d.getDay())}</span><span class="vdc-sep">·</span><span class="vdc-dt">${fmtSh(d)}</span><span style="font-size:13px;opacity:.85;margin-left:4px;font-weight:700">· ${(typeof fmtLunar==='function'?fmtLunar(d):'')} Âm lịch</span></div>
        ${wxH}
      </div>
      <div class="vdc-ses">
        <div class="vdc-ses-lbl">☀️ SÁNG</div>
        ${eS.length===0?`<div class="vm-empty">Không có lịch sáng</div>`:eS.map(e=>vmEv(e)).join('')}
        <div class="vdc-ses-lbl" style="margin-top:4px">🌤 CHIỀU</div>
        ${eC.length===0?`<div class="vm-empty">Không có lịch chiều</div>`:eC.map(e=>vmEv(e)).join('')}
      </div>
    </div>`;
  });
  el.innerHTML=h||'<div style="text-align:center;padding:40px;color:var(--muted)">📭 Tuần này chưa có lịch</div>';
  // Scroll về hôm nay (scroll từ thông báo do _scrollToDate tự xử lý)
  requestAnimationFrame(function(){
    if(!_npScrollDate){
      var todayHdr=el.querySelector('.vdc-hdr.h-today');
      var todayCardEl=todayHdr?todayHdr.closest('.vdc'):null;
      if(todayCardEl) el.scrollTop=todayCardEl.offsetTop-10;
    }
  });
  // Gắn scroll listener: xóa badge khi lướt đến cuối
  el.onscroll=function(){
    if(el.scrollTop+el.clientHeight>=el.scrollHeight-40){
      if(_notifCount>0) clearNotif();
    }
  };
}

function vmEv(e){
  const col={hop:'var(--red)',ldao:'var(--green)',kt:'var(--blue)',nd:'var(--amber)',kh:'var(--purple)'}[e.cat];
  const fileList2=(e.files||[]);
  const files=fileList2.length?
    `<div class="vm-files">${
      fileList2.map((f,fi)=>`<button class="vm-fb" onclick="openFile(events.find(x=>x.id==${e.id}).files[${fi}])" style="background:${fBg(f.type)};border-color:${fBorder(f.type)};color:${fColor(f.type)}" title="${escAttr(f.name)}">${fIcon(f.type)} <span>File đi kèm</span> <span style="font-size:8px;font-weight:800;background:${fColor(f.type)};color:#fff;border-radius:3px;padding:1px 4px;margin-left:2px">${esc(fLabel(f.type,f.name))}</span></button>`).join('')
    }</div>`:'';
  return`<div class="vm-ev" data-evid="${e.id}"><div class="vm-ev-top"><div class="vm-dot" style="background:${col}"></div><div class="vm-body">
    ${e.time?`<div class="vm-t">🕐 ${esc(e.time)}</div>`:''}
    <div class="vm-title">${catOf(e).icon} ${esc(e.title)}${isHoan(e)?'<span class="badge-hoan">⏸ Hoãn</span>':''}${e.isNew&&e.isNew>0?'<span class="badge-new">NEW</span>':''}</div>
    <div class="vm-meta">${e.chair?`<span>👤 ${esc(e.chair)}</span>`:''} ${e.location?`<span>📍 ${esc(e.location)}</span>`:''} ${e.prep?`<span>📋 ${esc(e.prep)}</span>`:''}</div>
    ${files}
  </div></div></div>`;
}

function renderAdminCards(ws,wxd){
  const el=document.getElementById('adminCards');if(!el)return;
  const days=Array.from({length:7},(_,i)=>addDays(ws,i));const ts=todStr();let h='';
  days.forEach(d=>{
    const ds=iso(d);const itd=ds===ts;const sat=d.getDay()===6;
    const hc=itd?'h-today':sat?'h-sat':'h-red';
    const eS=dayEvs(ds,'sang');const eC=dayEvs(ds,'chieu');
    const wxS=wxd?wxSes(wxd,ds,'sang'):null;const wxC=wxd?wxSes(wxd,ds,'chieu'):null;
    const wxShow=wxS||wxC;
    const wxH=wxShow?`<div class="vdc-wx">${wxShow.icon} ${wxShow.temp}°C</div>`:'';
    h+=`<div class="vdc" data-date="${ds}">
      <div class="vdc-hdr ${hc}">
        <div class="vdc-main">
          <span class="vdc-dow">${viDow(d.getDay())}</span>
          <span class="vdc-sep">·</span>
          <span class="vdc-dt">${fmtSh(d)}</span>
          <span style="font-size:13px;opacity:.85;margin-left:4px;font-weight:700">· ${(typeof fmtLunar==='function'?fmtLunar(d):'')} Âm lịch</span>
        </div>
        ${wxH}
      </div>
      <div class="vdc-ses">
        <div class="vdc-ses-lbl">☀️ SÁNG</div>
        ${eS.length===0?'<div class="vm-empty">Không có lịch sáng</div>':eS.map(e=>adcEvFull(e)).join('')}
        <button class="adc-add" onclick="openAddDs('${ds}','sang')">＋ Thêm lịch sáng</button>
        <div class="vdc-ses-lbl" style="margin-top:4px">🌤 CHIỀU</div>
        ${eC.length===0?'<div class="vm-empty">Không có lịch chiều</div>':eC.map(e=>adcEvFull(e)).join('')}
        <button class="adc-add" onclick="openAddDs('${ds}','chieu')">＋ Thêm lịch chiều</button>
      </div>
    </div>`;
  });
  el.innerHTML=h;
  // Scroll đến ngày hôm nay
  var todayCard=el.querySelector('.vdc-hdr.h-today');
  if(todayCard){
    var cardEl=todayCard.closest('.vdc');
    if(cardEl) setTimeout(function(){
      var top=cardEl.offsetTop-10;
      el.scrollTo({top:top,behavior:'instant'});
    },0);
  }
}

function adcEvFull(e){
  const col={hop:'var(--red)',ldao:'var(--green)',kt:'var(--blue)',nd:'var(--amber)',kh:'var(--purple)'}[e.cat];
  const bg={hop:'#fdecea',ldao:'#e3f5ec',kt:'#deeaf8',nd:'#fdf2dc',kh:'#f0e8fa'}[e.cat];
  const fbs=(e.files||[]).length?`<div class="vm-files" style="margin-top:6px">${(e.files||[]).map((f,fi)=>`<button class="vm-fb" onclick="openFile(events.find(x=>x.id==${e.id}).files[${fi}]);event.stopPropagation()" style="background:${fBg(f.type)};border-color:${fBorder(f.type)};color:${fColor(f.type)}" title="${escAttr(f.name)}">${fIcon(f.type)} <span>File đi kèm</span> <span style="font-size:8px;font-weight:800;background:${fColor(f.type)};color:#fff;border-radius:3px;padding:1px 4px;margin-left:2px">${esc(fLabel(f.type,f.name))}</span></button>`).join('')}</div>`:'';
  return`<div class="adm-ev" style="border-color:${col}20;background:${bg}" onclick="openEdit(${e.id})">
    <div class="adm-ev-left" style="background:${col}"></div>
    <div class="adm-ev-body">
      ${e.time?`<div class="adm-ev-time">🕐 ${esc(e.time)} &nbsp;·&nbsp; ${catOf(e).icon} ${esc(catOf(e).label)}</div>`:`<div class="adm-ev-time">${catOf(e).icon} ${esc(catOf(e).label)}</div>`}
      <div class="adm-ev-title">${esc(e.title)}${isHoan(e)?'<span class="badge-hoan">⏸ Hoãn</span>':''}${e.isNew&&e.isNew>0?'<span class="badge-new">NEW</span>':''}</div>
      <div class="adm-ev-meta">
        ${e.chair?`<span>👤 ${esc(e.chair)}</span>`:''}
        ${e.location?`<span>📍 ${esc(e.location)}</span>`:''}
        ${e.prep?`<span>📋 ${esc(e.prep)}</span>`:''}
      </div>
      ${fbs}
    </div>
    <div class="adm-ev-edit">✏️</div>
  </div>`;
}

function adcEv(e){
  const col={hop:'var(--red)',ldao:'var(--green)',kt:'var(--blue)',nd:'var(--amber)',kh:'var(--purple)'}[e.cat];
  const bg={hop:'#fdecea',ldao:'#e3f5ec',kt:'#deeaf8',nd:'#fdf2dc',kh:'#f0e8fa'}[e.cat];
  const fbs=(e.files||[]).map((f,fi)=>`<span onclick="openFile(events.find(x=>x.id==${e.id}).files[${fi}]);event.stopPropagation()" style="display:inline-flex;align-items:center;gap:3px;padding:2px 8px;background:rgba(0,0,0,.08);border-radius:4px;font-size:10px;font-weight:700;color:#1a4f7a;cursor:pointer;margin-right:4px">${fIcon(f.type)} File đi kèm</span>`).join('');
  return`<div class="adev-card" style="background:${bg};border-left-color:${col}" onclick="openEdit(${e.id})">
    <div class="adev-body">${e.time?`<div class="adev-t">🕐 ${esc(e.time)}</div>`:''}
      <div class="adev-title" style="color:${col}">${catOf(e).icon} ${esc(e.title)}${isHoan(e)?'<span class="badge-hoan">⏸ Hoãn</span>':''}${e.isNew&&e.isNew>0?'<span class="badge-new">NEW</span>':''}</div>
      <div class="adev-sub">${e.chair?esc(e.chair)+' ':''} ${e.location?'📍 '+esc(e.location):''}</div>
      ${fbs?`<div style="margin-top:5px;display:flex;flex-wrap:wrap;gap:3px">${fbs}</div>`:''}
    </div><span style="color:${col};font-size:13px;flex-shrink:0">✏️</span>
  </div>`;
}

// ════════════════════════════════════════
// SCROLL (EXTERNAL SCREEN DETECTION)
// Không dùng getScreenDetails() — gây popup xin permission
// Chỉ dùng các cách passive không cần quyền
// ════════════════════════════════════════
function initScroll(){
  stopScroll();
  if(tvOn||scrollOn){startScroll();return;}
  const ext=detectExtPassive();
  if(ext){scrollOn=true;startScroll();showToast('📺 Phát hiện màn hình ngoài – đang cuộn tự động');}
}

function detectExtPassive(){
  try{
    // Cách 1: availWidth > screen.width → có màn hình mở rộng
    if(window.screen&&window.screen.availWidth>window.screen.width+60)return true;
    // Cách 2: cửa sổ nằm ngoài màn hình chính (đã kéo sang màn hình phụ)
    if(window.screenX<-80||window.screenX>window.screen.width+80)return true;
    if(window.screenY<-80||window.screenY>window.screen.height+80)return true;
  }catch{}
  return false;
}

// Theo dõi thay đổi mỗi 3 giây — passive, không cần permission
setInterval(()=>{
  if(typeof tvOn==='undefined'||typeof scrollOn==='undefined'||typeof isAdmin==='undefined')return;
  if(tvOn||isAdmin)return;
  const ext=detectExtPassive();
  if(ext&&!scrollOn){scrollOn=true;startScroll();showToast('📺 Phát hiện màn hình ngoài – bật cuộn');}
  else if(!ext&&scrollOn&&!tvOn){scrollOn=false;stopScroll();showToast('🖥️ Ngắt màn hình ngoài – tắt cuộn');}
},3000);

function startScroll(){
  const wrap=document.getElementById('vsWrap');if(!wrap)return;
  if(window._vsRAF){cancelAnimationFrame(window._vsRAF);window._vsRAF=null;}
  wrap.style.transform='translateY(0)';
  const inner=document.getElementById('vsTblInner');
  if(inner){inner.style.overflowY='hidden';inner.style.overflowX='hidden';}

  setTimeout(()=>{
    const tbl=wrap.querySelector('table');if(!tbl)return;
    const tbody=tbl.querySelector('tbody');if(!tbody)return;
    const tbodyH=tbody.offsetHeight;
    const outerH=inner?inner.clientHeight:0;
    if(tbodyH<=outerH)return;

    // Clone tbody seamless
    if(tbl.querySelectorAll('tbody').length===1){tbl.appendChild(tbody.cloneNode(true));}

    let pos=0,last=null;
    function loop(ts){
      if(!scrollOn&&!tvOn){wrap.style.transform='translateY(0)';return;}
      if(!last)last=ts;const dt=(ts-last)/1000;last=ts;
      pos+=28*dt;if(pos>=tbodyH)pos-=tbodyH;
      wrap.style.transform=`translateY(-${pos}px)`;
      window._vsRAF=requestAnimationFrame(loop);
    }
    window._vsRAF=requestAnimationFrame(loop);
  },400);
}

function stopScroll(){
  if(window._vsRAF){cancelAnimationFrame(window._vsRAF);window._vsRAF=null;}
  const wrap=document.getElementById('vsWrap');
  if(wrap){
    wrap.style.transform='translateY(0)';
    const tbl=wrap.querySelector('table');
    if(tbl){const tbs=tbl.querySelectorAll('tbody');for(let i=1;i<tbs.length;i++)tbs[i].remove();}
  }
  const inner=document.getElementById('vsTblInner');
  if(inner){inner.style.overflowY='auto';inner.style.overflowX='hidden';}
}

function showToast(msg){
  let n=document.getElementById('screenNotice');if(!n){n=document.createElement('div');n.id='screenNotice';document.body.appendChild(n);}
  n.textContent=msg;n.style.opacity='1';clearTimeout(n._t);n._t=setTimeout(()=>{n.style.opacity='0';},2000);
}
// Overlay ⏳ giữa màn hình – hiện ngay khi bấm file
function showFileLoading(msg){
  let ol=document.getElementById('_fileLoadOverlay');
  if(!ol){
    ol=document.createElement('div');
    ol.id='_fileLoadOverlay';
    ol.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;z-index:9998;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px)';
    ol.innerHTML='<div style="background:#fff;border-radius:14px;padding:22px 32px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,.25);min-width:160px"><div style="font-size:32px;margin-bottom:8px">⏳</div><div id="_fileLoadMsg" style="font-family:\'Be Vietnam Pro\',sans-serif;font-size:14px;font-weight:700;color:#1a1a1a"></div></div>';
    document.body.appendChild(ol);
  }
  const m=document.getElementById('_fileLoadMsg');
  if(m) m.textContent=msg||'Đang mở file...';
  ol.style.display='flex';
}
function hideFileLoading(){
  const ol=document.getElementById('_fileLoadOverlay');
  if(ol) ol.style.display='none';
}
function showNotice(msg){ showToast(msg); }

// ════════════════════════════════════════
// TV
// ════════════════════════════════════════
function toggleTV(){
  tvOn?stopTV():startTV();
  bc.postMessage({type:tvOn?'tvOff':'tvOn'});
}
function toggleScroll(){
  scrollOn=!scrollOn;
  const b=document.getElementById('btnScroll');
  if(scrollOn){startScroll();if(b)b.textContent='⏸ Tạm dừng cuộn';bc.postMessage({type:'scrollOn'});}
  else{stopScroll();if(b)b.textContent='▶ Bật cuộn';bc.postMessage({type:'scrollOff'});}
}

function renderVsTicker(){
  const ws=wkStart(wkOff);
  const wkDates=Array.from({length:7},(_,i)=>iso(addDays(ws,i)));
  const wkEvs=events.filter(e=>wkDates.includes(e.date)).sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);
  const dow7=['Chủ nhật','Thứ hai','Thứ ba','Thứ tư','Thứ năm','Thứ sáu','Thứ bảy'];
  const items=wkEvs.map(e=>{
    const parts=e.date.split('-');const d=new Date(+parts[0],+parts[1]-1,+parts[2]);
    const sesLbl=e.ses==='sang'?'☀️ Sáng':'🌤 Chiều';
    const dateStr=`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
    return`<span class="vstick"><span class="vstick-dow">${dow7[d.getDay()]}</span><span class="vstick-date">${dateStr}</span><span class="vstick-ses">${sesLbl}</span>${e.time?`<span class="vstick-time">🕐${esc(e.time)}</span>`:''}<span class="vstick-ico">${catOf(e).icon}</span><span class="vstick-title">${esc(e.title)}</span>${e.location?`<span class="vstick-loc">📍${esc(e.location)}</span>`:''}</span><span class="vstick-sep">❖</span>`;
  });
  const el=document.getElementById('vsTickerInner');
  if(el)el.innerHTML=items.join('')||'<span class="vstick">📋 Không có lịch trong tuần này</span>';
}

function startTV(){
  tvOn=true;scrollOn=true;
  // Dùng viewer sáng thay vì màn TV đen
  document.body.classList.remove('is-tv');
  document.body.classList.remove('is-admin');
  document.body.classList.add('is-tv-viewer');
  // Khóa scroll body khi chiếu tivi
  document.documentElement.style.overflow='hidden';
  document.body.style.overflow='hidden';
  document.body.style.height='100vh';
  document.body.style.touchAction='none';
  const b=document.getElementById('btnTV');if(b){b.textContent='📺 Tắt chiếu lịch';b.classList.add('tv-on');}
  const bs=document.getElementById('btnScroll');if(bs)bs.textContent='⏸ Tạm dừng cuộn';
  // Render với dữ liệu hiện có; nếu chưa có data thì renderAllNoFetch sẽ gọi lại sau
  fetchWx().then(wxd=>{
    if(wxd&&!wxData){wxData=wxd;wxFetchedAt=Date.now();}
    renderWxBox(document.getElementById('vsWx'),wxd||wxData);
    renderFcStrip('vsFc',wxd||wxData);
    renderVsTable(wkStart(wkOff),wxd||wxData);
    renderLegend();
    renderVsTicker();
    setTimeout(()=>{startScroll();},700);
  }).catch(()=>{
    // Nếu weather fail vẫn render với data hiện có
    renderVsTable(wkStart(wkOff),wxData);
    renderLegend();
    renderVsTicker();
    setTimeout(()=>{startScroll();},700);
  });
}

function stopTV(){
  tvOn=false;scrollOn=false;
  document.body.classList.remove('is-tv');
  document.body.classList.remove('is-tv-viewer');
  // Quay lại admin nếu đang là admin
  if(isAdmin){document.body.classList.add('is-admin');}
  // Mở lại scroll body
  document.documentElement.style.overflow='';
  document.body.style.overflow='';
  document.body.style.height='';
  document.body.style.touchAction='';
  const b=document.getElementById('btnTV');if(b){b.textContent='📺 Bật chiếu lịch';b.classList.remove('tv-on');}
  const bs=document.getElementById('btnScroll');if(bs)bs.textContent='▶ Bật cuộn';
  if(tvClkTimer){clearInterval(tvClkTimer);tvClkTimer=null;}
  if(window._tvRAF){cancelAnimationFrame(window._tvRAF);window._tvRAF=null;}
  stopScroll();
}

function renderTVContent(ws,wxd){
  const we=addDays(ws,6);const wn=wkNum(ws);
  const wkDates=Array.from({length:7},(_,i)=>iso(addDays(ws,i)));
  const wkEvs=events.filter(e=>wkDates.includes(e.date)).sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);
  const el=id=>document.getElementById(id);
  el('tvRibWk').textContent=`Tuần ${wn} · ${fmtVi(ws)} – ${fmtVi(we)}`;
  el('tvRibTotal').textContent=wkEvs.length;
  el('tvRibSang').textContent=wkEvs.filter(e=>e.ses==='sang').length;
  el('tvRibChieu').textContent=wkEvs.filter(e=>e.ses==='chieu').length;
  el('tvWkLbl').textContent=`Tuần ${wn}/${ws.getFullYear()}`;
  renderLegend();
  renderTVWx(wxd);
  const dow7=['Chủ nhật','Thứ hai','Thứ ba','Thứ tư','Thứ năm','Thứ sáu','Thứ bảy'];
  const items=wkEvs.map(e=>{
    const parts=e.date.split('-');const d=new Date(+parts[0],+parts[1]-1,+parts[2]);
    const sesLbl=e.ses==='sang'?'Sáng':'Chiều';
    const dateStr=`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    return`<span class="ttick"><span class="ttick-dow">${dow7[d.getDay()]}</span><span class="ttick-date">${dateStr}</span><span class="ttick-ses">${sesLbl}</span>${e.time?`<span class="ttick-time">${esc(e.time)}</span>`:''}<span class="ttick-ico">${catOf(e).icon}</span><span class="ttick-title">${esc(e.title)}</span>${e.location?`<span class="ttick-loc">📍 ${esc(e.location)}</span>`:''}</span><span class="ttick-sep">❖</span>`;
  });
  el('tvTicker').innerHTML=items.join('')||'<span class="ttick">Không có lịch trong tuần này</span>';

  const days=Array.from({length:7},(_,i)=>addDays(ws,i));const ts=todStr();
  let html='';
  days.forEach(d=>{
    const ds=iso(d);const itd=ds===ts;const sun=d.getDay()===0;const sat=d.getDay()===6;
    const trc=itd?'tv-tr-today':'';const dcc=(itd?'td-tvtoday':'')+(sun?' td-tvsun':sat?' td-tvsat':'');
    const eS=dayEvs(ds,'sang');const eC=dayEvs(ds,'chieu');
    const wxS=wxd?wxSes(wxd,ds,'sang'):null;const wxC=wxd?wxSes(wxd,ds,'chieu'):null;const wxShow=wxS||wxC;
    const nS=Math.max(eS.length,1),nC=Math.max(eC.length,1),nR=2+nS+nC;
    const wxH=wxShow?`<div class="twx"><span class="twi">${wxShow.icon}</span><span class="twt">${wxShow.temp}°C</span><span class="twr">${wxShow.prob>0?wxShow.prob+'%🌧':wxShow.desc}</span></div>`:'';

    html+=`<tr class="tv-sh ${trc}">
      <td class="tv-dc ${dcc}" rowspan="${nR}"><div class="tdow">${viDow(d.getDay())}</div><div class="tdt">${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}</div>${wxH}</td>
      <td class="td-ses-hdr" style="background:rgba(255,255,255,.02);border-top:1px solid rgba(255,255,255,.06);padding:4px 10px">${tvSpill('sang')}</td>
      <td class="tv-sh-span" colspan="5" style="background:rgba(255,255,255,.02);border-top:1px solid rgba(255,255,255,.06)"></td>
    </tr>`;
    eS.length===0?html+=tvEmptyRow(trc):eS.forEach(e=>{html+=tvEvRow(e,trc);});
    html+=`<tr class="tv-sh ${trc}"><td style="background:rgba(255,255,255,.02);border-top:1px solid rgba(255,255,255,.06);padding:4px 10px;vertical-align:middle">${tvSpill('chieu')}</td><td colspan="5" style="background:rgba(255,255,255,.02);border-top:1px solid rgba(255,255,255,.06)"></td></tr>`;
    eC.length===0?html+=tvEmptyRow(trc):eC.forEach(e=>{html+=tvEvRow(e,trc);});
  });

  // Thead cố định trong tvHeadFixed
  const headFixed=el('tvHeadFixed');
  if(headFixed)headFixed.innerHTML=`<table class="tv-tbl">${CG}${TV_TH}</table>`;

  // tvWrap chỉ chứa tbody (translateY cuộn)
  const wrap=el('tvWrap');
  if(wrap)wrap.innerHTML=`<table class="tv-tbl">${CG}<tbody id="tvTbA">${html}</tbody><tbody id="tvTbB">${html}</tbody></table>`;
  setupTVScroll();
}

function tvSpill(ses){
  return ses==='sang'
    ?`<span class="tv-pill tvp-s">☀️ SÁNG</span>`
    :`<span class="tv-pill tvp-c">🌤 CHIỀU</span>`;
}
function tvEmptyRow(trc){return`<tr class="tv-emp ${trc}"><td class="tv-ses-empty"></td><td colspan="5"><span class="tv-dash"></span></td></tr>`;}
function tvEvRow(e,trc){
  return`<tr class="tv-er ${trc}">
    <td class="tv-ses-empty"></td>
    <td class="tv-ct tv-acc-${e.cat}">${e.time?`<div class="tv-etime">🕐 ${esc(e.time)}</div>`:''}<div class="tv-etitle">${catOf(e).icon} ${esc(e.title)}</div></td>
    <td class="tv-ch">${e.chair?esc(e.chair):'—'}</td>
    <td class="tv-pl">${e.location?'📍 '+esc(e.location):'—'}</td>
    <td class="tv-mb">${esc(e.member)||'—'}</td>
    <td class="tv-pr">${esc(e.prep)||'—'}</td>
  </tr>`;
}

function setupTVScroll(){
  const wrap=document.getElementById('tvWrap');const bar=document.getElementById('tvProg');
  if(!wrap)return;
  wrap.style.transform='translateY(0)';
  if(window._tvRAF){cancelAnimationFrame(window._tvRAF);window._tvRAF=null;}
  setTimeout(()=>{
    const tbA=document.getElementById('tvTbA');if(!tbA)return;
    const oneH=tbA.offsetHeight;if(oneH<=0)return;
    let pos=0,last=null;
    function loop(ts){
      if(!document.body.classList.contains('is-tv'))return;
      if(!last)last=ts;const dt=(ts-last)/1000;last=ts;
      pos+=40*dt;if(pos>=oneH)pos-=oneH;
      wrap.style.transform=`translateY(-${pos}px)`;
      if(bar)bar.style.width=((pos/oneH)*100).toFixed(2)+'%';
      window._tvRAF=requestAnimationFrame(loop);
    }
    window._tvRAF=requestAnimationFrame(loop);
  },300);
}

function renderTVWx(data){
  if(!data)data=wxData;if(!data||!data.current)return;
  const c=data.current;const wi=wxInfo(c.weather_code,c.is_day);
  const s=id=>{const e=document.getElementById(id);if(e)return e;return{textContent:'',innerHTML:''};};
  s('tvWxI').textContent=wi.icon;s('tvWxT').textContent=`${Math.round(c.temperature_2m)}°C`;
  s('tvWxD').textContent=wi.desc+(wxMock?' (ước tính)':'');
  s('tvWxE').innerHTML=`<span>💧${c.relative_humidity_2m}%</span><span>💨${Math.round(c.wind_speed_10m)}km/h</span><span>🌡${Math.round(c.apparent_temperature)}°C</span>`;
  s('tvRibWx').textContent=`${wi.icon} ${Math.round(c.temperature_2m)}°C · ${wi.desc}`;
  const t0=iso(TODAY);const t1=iso(addDays(TODAY,1));
  s('tvWxFc').innerHTML=[{ds:t0,ses:'sang',l:'HN Sáng'},{ds:t0,ses:'chieu',l:'HN Chiều'},{ds:t1,ses:'sang',l:'NM Sáng'},{ds:t1,ses:'chieu',l:'NM Chiều'}].map(it=>{const wx=wxSes(data,it.ds,it.ses);if(!wx)return'';return`<div class="tfci"><span class="tfs">${it.l}</span><span class="tfi">${wx.icon}</span><span class="tft">${wx.temp}°C</span><span class="tfr">${wx.prob>0?wx.prob+'%🌧':wx.desc}</span></div>`;}).join('');
  const now=new Date();s('tvWxUpd').textContent=wxMock?'Ước tính theo mùa':`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
}

function updateClock(){
  const now=new Date();
  const c=document.getElementById('tvClock');if(c)c.textContent=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
  const dn=['Chủ nhật','Thứ hai','Thứ ba','Thứ tư','Thứ năm','Thứ sáu','Thứ bảy'];
  const dt=document.getElementById('tvDt');if(dt)dt.textContent=`${dn[now.getDay()]}, ${fmtVi(now)}`;
}
