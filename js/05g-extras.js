
// ════════════════════════════════════════
// TÌM KIẾM LỊCH
// ════════════════════════════════════════
function openSearch(){
  document.getElementById('ovSearch').classList.add('open');
  document.getElementById('searchInput').value='';
  document.getElementById('searchResults').innerHTML='<p style="color:var(--muted);font-size:13px;text-align:center;padding:20px">Nhập từ khóa để tìm kiếm...</p>';
  setTimeout(()=>document.getElementById('searchInput').focus(),80);
}
function closeSearch(){document.getElementById('ovSearch').classList.remove('open');}

function doSearch(q){
  const box=document.getElementById('searchResults');
  q=q.trim().toLowerCase();
  if(!q){box.innerHTML='<p style="color:var(--muted);font-size:13px;text-align:center;padding:20px">Nhập từ khóa để tìm kiếm...</p>';return;}
  const res=events.filter(e=>
    (e.title&&e.title.toLowerCase().includes(q))||
    (e.chair&&e.chair.toLowerCase().includes(q))||
    (e.location&&e.location.toLowerCase().includes(q))||
    (e.member&&e.member.toLowerCase().includes(q))||
    (e.prep&&e.prep.toLowerCase().includes(q))
  ).sort((a,b)=>a.date.localeCompare(b.date));

  if(!res.length){box.innerHTML='<p style="color:var(--muted);font-size:13px;text-align:center;padding:20px">Không tìm thấy kết quả nào.</p>';return;}

  const dn=['CN','T2','T3','T4','T5','T6','T7'];
  // hl(): escape giá trị TRƯỚC, sau đó wrap match query bằng <mark>.
  // Vì escape xong các ký tự HTML đã thành entity nên không thể inject script.
  const hl=(txt)=>{
    if(!txt) return '';
    const safe=esc(txt);
    return safe.replace(new RegExp('('+q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi'),'<mark style="background:#fde68a;border-radius:2px;padding:0 1px">$1</mark>');
  };
  box.innerHTML=res.map(e=>{
    const d=new Date(e.date+'T00:00:00');
    const dow=dn[d.getDay()]||'';
    const dt=String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear();
    const ses=e.ses==='sang'?'Sáng':e.ses==='chieu'?'Chiều':'Tối';
    return`<div onclick="closeSearch();goToWeekOf('${e.date}')" style="cursor:pointer;padding:10px 12px;border:1.5px solid var(--line);border-radius:10px;background:var(--bg2);transition:all .13s" onmouseover="this.style.borderColor='var(--red)';this.style.background='#fff'" onmouseout="this.style.borderColor='var(--line)';this.style.background='var(--bg2)'">
      <div style="font-size:10px;color:var(--muted);font-weight:700;margin-bottom:4px">${dow} ${dt} · ${ses}${e.time?' · 🕐'+esc(e.time):''}</div>
      <div style="font-size:13px;font-weight:800;color:var(--ink)">${CAT[e.cat]?.icon||''} ${hl(e.title)}${isHoan(e)?' <span style="color:#c0392b;font-size:11px">⏸ Hoãn</span>':''}</div>
      ${e.chair?`<div style="font-size:11px;color:var(--muted);margin-top:3px">👤 ${hl(e.chair)}</div>`:''}
      ${e.location?`<div style="font-size:11px;color:var(--muted)">📍 ${hl(e.location)}</div>`:''}
    </div>`;
  }).join('');
}

function goToWeekOf(dateStr){
  const d=new Date(dateStr+'T00:00:00');
  const ws=wkStart(0);// tuần hiện tại
  const diff=Math.round((d-ws)/(7*86400000));
  wkOff=diff>=0?Math.floor(diff):Math.ceil(diff/1)*1;
  // Tính wkOff chính xác
  const target=new Date(dateStr+'T00:00:00');
  let off=0;
  for(let i=-52;i<=52;i++){const w=wkStart(i);const we=addDays(w,6);if(target>=w&&target<=we){off=i;break;}}
  wkOff=off;
  renderAllNoFetch();
}

// ════════════════════════════════════════
// QR CODE LỊCH TUẦN
// ════════════════════════════════════════
let _qrInstance=null;let _qrUrl='';
function openQR(){
  document.getElementById('ovQR').classList.add('open');
  _qrUrl=window.location.href.split('?')[0];
  const canvas=document.getElementById('qrCanvas');
  canvas.innerHTML='';
  if(typeof QRCode!=='undefined'){
    _qrInstance=new QRCode(canvas,{text:_qrUrl,width:200,height:200,colorDark:'#1a1410',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.H});
  } else {
    canvas.innerHTML='<p style="color:var(--muted);font-size:12px;padding:20px">Đang tải thư viện QR...</p>';
  }
  const btnShare=document.getElementById('btnShareQR');
  if(btnShare) btnShare.style.display='';
}
function closeQR(){document.getElementById('ovQR').classList.remove('open');closeShareMenu();}
function closeShareMenu(){const m=document.getElementById('qrShareMenu');if(m)m.remove();}
function downloadQR(){
  const canvas=document.querySelector('#qrCanvas canvas');
  if(!canvas){showToast('❌ Chưa tạo được QR');return;}
  const a=document.createElement('a');
  a.href=canvas.toDataURL('image/png');
  a.download='QR_LichLamViec.png';
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  showToast('✅ Đã tải QR Code!');
}
async function shareQR(){
  const url=_qrUrl||window.location.href.split('?')[0];
  // Thử Web Share API trước (điện thoại)
  if(navigator.share){
    const canvas=document.querySelector('#qrCanvas canvas');
    if(canvas){
      try{
        canvas.toBlob(async blob=>{
          const file=new File([blob],'QR_LichLamViec.png',{type:'image/png'});
          const sd={title:'Lịch Làm Việc Số',text:'Quét mã QR để xem lịch làm việc số',url:url};
          if(navigator.canShare&&navigator.canShare({files:[file]})) sd.files=[file];
          try{await navigator.share(sd);}catch(e){if(e.name!=='AbortError') showShareMenu(url);}
        },'image/png');
        return;
      }catch(e){}
    }
  }
  // Fallback: hiện menu chia sẻ thủ công
  showShareMenu(url);
}
function showShareMenu(url){
  closeShareMenu();
  const enc=encodeURIComponent(url);
  const txt=encodeURIComponent('Xem lịch làm việc số tại: '+url);
  const items=[
    {ico:'<svg width="20" height="20" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="24" fill="#0068FF"/><path d="M31.5 14h-4.2c-.9 0-1.8.9-1.8 2.1V19H31l-.6 4.2h-4.9V37h-4.9V23.2h-3.1V19h3.1v-3.3C20.5 12.6 22.7 11 25.8 11c1.4 0 3 .2 3.7.3V14z" fill="#fff"/></svg>',label:'Facebook',url:`https://www.facebook.com/sharer/sharer.php?u=${enc}`},
    {ico:'<svg width="20" height="20" viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="#00B14F"/><text x="50%" y="55%" text-anchor="middle" dominant-baseline="middle" font-size="22" font-weight="bold" fill="white" font-family="Arial">Z</text></svg>',label:'Zalo',url:`https://zalo.me/share/url?url=${enc}&title=${txt}`},
    {ico:'<svg width="20" height="20" viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="#0084FF"/><path d="M24 10C16.27 10 10 15.84 10 23c0 4.07 1.93 7.71 4.97 10.18V38l4.54-2.5c1.21.34 2.49.5 3.49.5 7.73 0 14-5.84 14-13S31.73 10 24 10z" fill="#fff"/></svg>',label:'Messenger',url:`https://www.facebook.com/dialog/send?link=${enc}&app_id=291494977691819&redirect_uri=${enc}`},
    {ico:'<svg width="20" height="20" viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="#25D366"/><path d="M35.4 12.6A16.7 16.7 0 0 0 7.3 29.7L5 43l13.6-3.6a16.7 16.7 0 0 0 8 2h.1c9.2 0 16.7-7.5 16.7-16.7 0-4.5-1.7-8.7-4.9-11.9l-.1-.2zm-11.7 25.7a13.9 13.9 0 0 1-7.1-1.9l-.5-.3-5.3 1.4 1.4-5.1-.3-.5a13.9 13.9 0 1 1 11.8 6.4z" fill="#fff"/></svg>',label:'WhatsApp',url:`https://wa.me/?text=${txt}`},
    {ico:'📋',label:'Sao chép link',url:null},
  ];
  const menu=document.createElement('div');
  menu.id='qrShareMenu';
  menu.style.cssText='position:fixed;top:0;right:0;bottom:0;left:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(10,6,4,.55);backdrop-filter:blur(3px)';
  menu.innerHTML=`<div style="background:#fff;border-radius:16px;padding:20px 18px 16px;width:300px;max-width:90vw;box-shadow:0 8px 40px rgba(0,0,0,.25);animation:mIn .18s ease">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
      <span style="font-size:14px;font-weight:800;color:#1a1410">📤 Chia sẻ lịch</span>
      <button onclick="closeShareMenu()" style="width:30px;height:30px;border-radius:8px;border:none;background:#f0ebe5;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center">✕</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px">
      ${items.filter(i=>i.url).map(i=>`<a href="${i.url}" target="_blank" rel="noopener" onclick="closeShareMenu()" style="display:flex;flex-direction:column;align-items:center;gap:5px;text-decoration:none;padding:8px 4px;border-radius:10px;background:#f5f1ec;transition:background .13s" onmouseover="this.style.background='#e5ddd6'" onmouseout="this.style.background='#f5f1ec'">${i.ico}<span style="font-size:10px;font-weight:700;color:#1a1410;text-align:center">${i.label}</span></a>`).join('')}
    </div>
    <button onclick="navigator.clipboard.writeText('${url.replace(/'/g,"\\'")}').then(()=>{showToast('✅ Đã sao chép link!');closeShareMenu();})" style="width:100%;padding:9px;border-radius:10px;border:1.5px solid #e5ddd6;background:#f5f1ec;font-family:'Be Vietnam Pro',sans-serif;font-size:13px;font-weight:700;color:#1a1410;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px">📋 Sao chép link</button>
  </div>`;
  menu.addEventListener('click',e=>{if(e.target===menu)closeShareMenu();});
  document.body.appendChild(menu);
}

// ════════════════════════════════════════
// THỐNG KÊ
// ════════════════════════════════════════
function openThongKe(){
  document.getElementById('ovThongKe').classList.add('open');
  renderThongKe();
}
function closeThongKe(){document.getElementById('ovThongKe').classList.remove('open');}
function renderThongKe(){
  const body=document.getElementById('thongKeBody');
  const now=new Date();
  const thangHT=now.getMonth();const namHT=now.getFullYear();
  // Lịch tuần này
  const ws=wkStart(wkOff);const we=addDays(ws,6);
  const evTuan=events.filter(e=>{const d=e.date;return d>=iso(ws)&&d<=iso(we);});
  // Lịch tháng này
  const evThang=events.filter(e=>{
    const d=new Date(e.date+'T00:00:00');
    return d.getMonth()===thangHT&&d.getFullYear()===namHT;
  });
  // Tổng tất cả
  const evAll=events;

  const statBlock=(title,evs)=>{
    const bycat={};
    Object.keys(CAT).forEach(k=>{bycat[k]=0;});
    evs.forEach(e=>{if(bycat[e.cat]!==undefined)bycat[e.cat]++;});
    const total=evs.length;
    const hoan=evs.filter(e=>isHoan(e)).length;
    return`<div style="background:var(--bg2);border:1.5px solid var(--line);border-radius:12px;padding:14px 16px">
      <div style="font-size:13px;font-weight:800;color:var(--red2);margin-bottom:10px">${title} — <span style="font-size:20px;font-weight:900">${total}</span> lịch</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px">
        ${Object.keys(CAT).map(k=>`<div style="background:#fff;border:1px solid var(--line);border-radius:8px;padding:8px;text-align:center">
          <div style="font-size:18px">${CAT[k].icon}</div>
          <div style="font-size:18px;font-weight:900;color:var(--ink)">${bycat[k]}</div>
          <div style="font-size:10px;color:var(--muted)">${CAT[k].label}</div>
        </div>`).join('')}
      </div>
      ${hoan>0?`<div style="font-size:12px;color:#c0392b;font-weight:700">⏸ Đã hoãn: ${hoan} lịch</div>`:''}
    </div>`;
  };

  body.innerHTML=
    statBlock('📅 Tuần này',evTuan)+
    statBlock('🗓 Tháng '+String(thangHT+1).padStart(2,'0')+'/'+namHT,evThang)+
    statBlock('📋 Tổng toàn bộ',evAll);
}

// ════════════════════════════════════════
// XEM THÁNG
// ════════════════════════════════════════
let _thangOff=0;
function openXemThang(){
  _thangOff=0;
  document.getElementById('ovXemThang').classList.add('open');
  renderXemThang();
}
function closeXemThang(){document.getElementById('ovXemThang').classList.remove('open');}
function navThang(d){_thangOff+=d;renderXemThang();}
function renderXemThang(){
  const now=new Date();
  const t=new Date(now.getFullYear(),now.getMonth()+_thangOff,1);
  const thang=t.getMonth();const nam=t.getFullYear();
  document.getElementById('thangTitle').textContent='Tháng '+String(thang+1).padStart(2,'0')+'/'+nam;
  const firstDay=new Date(nam,thang,1);
  const lastDay=new Date(nam,thang+1,0);
  const startDow=(firstDay.getDay()+6)%7; // 0=T2
  const dn=['T2','T3','T4','T5','T6','T7','CN'];
  let html=`<table style="width:100%;border-collapse:collapse;font-size:12px">
    <thead><tr>${dn.map(d=>`<th style="padding:6px;text-align:center;font-weight:800;color:var(--muted);font-size:11px">${d}</th>`).join('')}</tr></thead>
    <tbody><tr>`;
  // Ô trống đầu
  for(let i=0;i<startDow;i++) html+=`<td style="padding:4px;height:70px;vertical-align:top;border:1px solid var(--line2)"></td>`;
  const todayStr=iso(new Date());
  for(let day=1;day<=lastDay.getDate();day++){
    const d=new Date(nam,thang,day);
    const diso=iso(d);
    const dow=(d.getDay()+6)%7;
    const evDay=events.filter(e=>e.date===diso);
    const isToday=diso===todayStr;
    const isSun=d.getDay()===0;const isSat=d.getDay()===6;
    html+=`<td style="padding:3px;height:70px;vertical-align:top;border:1px solid var(--line2);background:${isToday?'#fff6f5':'#fff'};cursor:${evDay.length?'pointer':'default'}" onclick="if(${evDay.length})closeXemThang()">
      <div style="font-size:13px;font-weight:900;color:${isToday?'#c0392b':isSun?'#c0392b':isSat?'#1a4f7a':'var(--ink)'};margin-bottom:2px">${day}</div>
      ${evDay.slice(0,3).map(e=>`<div style="font-size:9px;font-weight:700;color:#fff;background:${CAT[e.cat]?.color||'#888'};border-radius:3px;padding:1px 4px;margin-bottom:1px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;max-width:100%">${esc(e.title)}</div>`).join('')}
      ${evDay.length>3?`<div style="font-size:9px;color:var(--muted)">+${evDay.length-3} lịch</div>`:''}
    </td>`;
    if(dow===6&&day<lastDay.getDate()) html+=`</tr><tr>`;
  }
  // Ô trống cuối
  const endDow=(lastDay.getDay()+6)%7;
  for(let i=endDow+1;i<7;i++) html+=`<td style="padding:4px;height:70px;vertical-align:top;border:1px solid var(--line2);background:#fafafa"></td>`;
  html+=`</tr></tbody></table>`;
  document.getElementById('xemThangBody').innerHTML=html;
}

// ════════════════════════════════════════
// LỊCH LẶP LẠI
// ════════════════════════════════════════
function toggleLapLai(val){
  document.getElementById('fLapLaiSoTuan').style.display=val?'':'none';
}
function resetLapLai(){
  const sel=document.getElementById('fLapLai');
  if(sel) sel.value='';
  document.getElementById('fLapLaiSoTuan').style.display='none';
}

function dlHTML(){
  const c=document.documentElement.outerHTML;const b=new Blob([c],{type:'text/html;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(b);
  a.download=`LichLamViec_TayTraBong_Tuan${wkNum(wkStart(wkOff))}_${wkStart(wkOff).getFullYear()}.html`;
  a.click();URL.revokeObjectURL(a.href);
}

function fixDatesPlus1(){
  if(!confirm("⚠️ Thao tác này sẽ cộng thêm 1 ngày vào TẤT CẢ lịch hiện tại (sửa lỗi múi giờ cũ).\nBạn có chắc chắn?"))return;
  events=events.map(e=>{
    const parts=e.date.split("-");const d=new Date(+parts[0],+parts[1]-1,+parts[2]);
    d.setDate(d.getDate()+1);
    return{...e,date:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};
  });
  save();renderAllNoFetch();
  showToast("✅ Đã sửa ngày +1 cho "+events.length+" lịch!");
}
// ════════════════════════════════════════
// MIGRATE: chuyển file đính kèm base64 (dataUrl) sang Firebase Storage
// Mục đích: giảm kích thước events.json (16MB → vài chục KB)
// ════════════════════════════════════════
async function migrateBase64Files(){
  if(!fbStorage||!currentUID){
    showToast('⚠️ Cần đăng nhập admin để chạy tối ưu');
    return;
  }
  // Đếm số file base64 cần migrate
  let totalBase64=0;
  let totalSize=0;
  for(const ev of events){
    if(Array.isArray(ev.files)){
      for(const f of ev.files){
        if(f&&f.dataUrl&&!f.url){
          totalBase64++;
          totalSize+=f.dataUrl.length;
        }
      }
    }
  }
  if(totalBase64===0){
    showToast('✅ Không có file base64 nào cần tối ưu — đã tối ưu rồi');
    return;
  }
  const sizeMB=(totalSize/1024/1024).toFixed(1);
  if(!confirm('🔄 TỐI ƯU FILE ĐÍNH KÈM\n\n'
    +'Tìm thấy: '+totalBase64+' file đính kèm dạng base64 (~'+sizeMB+' MB)\n'
    +'Hành động: upload lên Firebase Storage để giảm dung lượng app\n\n'
    +'Quá trình này có thể mất vài phút, KHÔNG TẮT TRÌNH DUYỆT!\n\n'
    +'Tiếp tục?'))return;

  log('[Migrate] start - '+totalBase64+' files, ~'+sizeMB+' MB');
  showToast('🔄 Đang tối ưu '+totalBase64+' file, vui lòng đợi...');

  // Tạo progress UI nổi
  const progressEl=document.createElement('div');
  progressEl.style.cssText='position:fixed;top:20px;right:20px;z-index:99999;background:#fff;border:2px solid #16a34a;padding:14px 18px;border-radius:10px;box-shadow:0 4px 12px rgba(0,0,0,0.15);font-family:"Be Vietnam Pro",sans-serif;min-width:280px;font-size:13px';
  progressEl.innerHTML='<div style="font-weight:700;color:#16a34a;margin-bottom:6px">🔄 Đang tối ưu file...</div><div id="_migProgressText">0 / '+totalBase64+'</div><div style="margin-top:8px;background:#e5e7eb;border-radius:6px;height:8px;overflow:hidden"><div id="_migProgressBar" style="background:#16a34a;height:100%;width:0%;transition:width 0.3s"></div></div>';
  document.body.appendChild(progressEl);
  const txtEl=document.getElementById('_migProgressText');
  const barEl=document.getElementById('_migProgressBar');

  let done=0;
  let failed=0;
  let savedBytes=0;

  // Helper: convert dataUrl → Blob
  function dataUrlToBlob(dataUrl){
    const parts=dataUrl.split(',');
    if(parts.length<2)return null;
    const meta=parts[0]||'';
    const m=meta.match(/data:([^;]+)/);
    const mime=m?m[1]:'application/octet-stream';
    try{
      const bin=atob(parts[1]);
      const arr=new Uint8Array(bin.length);
      for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);
      return new Blob([arr],{type:mime});
    }catch(e){return null;}
  }

  // Migrate từng file
  for(let evIdx=0;evIdx<events.length;evIdx++){
    const ev=events[evIdx];
    if(!Array.isArray(ev.files))continue;
    for(let fIdx=0;fIdx<ev.files.length;fIdx++){
      const f=ev.files[fIdx];
      if(!f||!f.dataUrl||f.url)continue;
      try{
        const blob=dataUrlToBlob(f.dataUrl);
        if(!blob){logWarn('[Migrate] cannot convert dataUrl for',f.name);failed++;done++;continue;}
        const ext=(f.name||'file').split('.').pop()||'bin';
        const path='donvi/'+currentUID+'/files/'+Date.now()+'_'+Math.random().toString(36).slice(2)+'.'+ext;
        const ref=fbStorage.ref(path);
        await ref.put(blob,{
          contentType:blob.type||'application/octet-stream',
          contentDisposition:'inline; filename="'+(f.name||'file')+'"'
        });
        const url=await ref.getDownloadURL();
        // Cập nhật file: thay dataUrl bằng url + path
        savedBytes+=f.dataUrl.length;
        events[evIdx].files[fIdx]={
          name:f.name,
          size:f.size||blob.size,
          type:f.type||blob.type,
          url:url,
          path:path
        };
        done++;
        const pct=Math.round(done/totalBase64*100);
        if(txtEl)txtEl.textContent=done+' / '+totalBase64+' ('+pct+'%)';
        if(barEl)barEl.style.width=pct+'%';
        log('[Migrate] ✅ '+done+'/'+totalBase64+': '+(f.name||'file'));
      }catch(err){
        logWarn('[Migrate] ❌ failed:',f.name,err.message);
        failed++;done++;
        const pct=Math.round(done/totalBase64*100);
        if(txtEl)txtEl.textContent=done+' / '+totalBase64+' ('+pct+'%) — '+failed+' lỗi';
        if(barEl)barEl.style.width=pct+'%';
      }
    }
  }

  // Save events đã được cập nhật lên Firebase
  if(txtEl)txtEl.textContent='Đang lưu...';
  try{
    await save();
    const savedMB=(savedBytes/1024/1024).toFixed(2);
    log('[Migrate] ✅ COMPLETE. Migrated:',done-failed,'failed:',failed,'saved:',savedMB,'MB');
    if(progressEl)progressEl.remove();
    alert('✅ HOÀN THÀNH TỐI ƯU\n\n'
      +'• Đã chuyển: '+(done-failed)+' file\n'
      +'• Lỗi: '+failed+' file\n'
      +'• Tiết kiệm: ~'+savedMB+' MB\n\n'
      +'App sẽ load nhanh hơn nhiều từ lúc này.');
    renderAllNoFetch();
  }catch(e){
    if(progressEl)progressEl.remove();
    alert('⚠️ Đã migrate '+(done-failed)+' file nhưng lưu Firebase lỗi: '+e.message+'\nThử lại sau.');
    logErr('[Migrate] save error:',e);
  }
}

function backupData(){
  // Xuất dữ liệu lịch ra file JSON
  const data={
    version:1,
    exportedAt:new Date().toISOString(),
    exportedBy:(typeof ORG_CONFIG!=='undefined'?ORG_CONFIG.tenCoQuan:'UBND XÃ TÂY TRÀ BỒNG'),
    events:events
  };
  const json=JSON.stringify(data,null,2);
  const b=new Blob([json],{type:'application/json;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(b);
  const d=new Date();
  a.download=`LichLamViec_Backup_${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}_${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('✅ Đã sao lưu '+events.length+' lịch thành công!');
}

function restoreData(){
  if(!confirm('⚠️ Khôi phục sẽ GHI ĐÈ toàn bộ lịch hiện tại!\nBạn có chắc chắn không?'))return;
  const inp=document.createElement('input');
  inp.type='file';
  inp.accept='.json';
  inp.onchange=e=>{
    const file=e.target.files[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=ev=>{
      try{
        const data=JSON.parse(ev.target.result);
        if(!data.events||!Array.isArray(data.events))throw new Error('File không hợp lệ');
        events=data.events;
        save();
        renderAll();
        showToast('✅ Đã khôi phục '+events.length+' lịch từ file backup!');
      }catch(err){
        alert('❌ Lỗi đọc file: '+err.message+'\nVui lòng chọn file backup đúng định dạng.');
      }
    };
    reader.readAsText(file,'UTF-8');
  };
  inp.click();
}
