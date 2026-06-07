
// ════════════════════════════════════════
// STATE
// ════════════════════════════════════════
const TODAY=(()=>{const n=new Date();const vn=new Date(n.toLocaleString('en-US',{timeZone:'Asia/Ho_Chi_Minh'}));vn.setHours(0,0,0,0);return vn;})();
const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const todStr=()=>iso(TODAY);
let wkOff=0, editId=null, pending=[];
let wxData=null, wxFetchedAt=0, wxMock=false;
let aqData=null, aqFetchedAt=0; // chất lượng không khí (Open-Meteo Air Quality)
// (tvClkTimer, isAdmin, tvOn, scrollOn, _autoTV đã khai báo ở đầu script)

let events=[];
// _saveSeq: mỗi lần save tăng 1, dùng để bỏ qua poll ngay sau khi mình vừa save
let _saveSeq=0;
// _saveError: thông báo cho user biết lần save gần nhất bị lỗi
let _lastSaveError=null;
const save=()=>{
  log('[Save] start, events=', events.length, 'currentUID=', currentUID, 'fbReady=', fbReady, 'fbStorage=', !!fbStorage);
  // ⚠ CHỈ lưu trên Cloud Storage — KHÔNG cache localStorage nữa (theo yêu cầu).
  //   Hệ quả: cần có mạng + đăng nhập để xem/lưu lịch; không có dữ liệu offline.
  const jsonStr=JSON.stringify(events);
  // Lưu Firebase: upload toàn bộ events lên Storage dưới dạng JSON
  if(fbReady&&fbStorage&&fbDb&&currentUID){
    _lastSig=_sig(events);
    const seq=++_saveSeq;
    const blob=new Blob([jsonStr],{type:'application/json'});
    const storagePath='donvi/'+currentUID+'/events.json';
    const storageRef=fbStorage.ref(storagePath);
    log('[Save] uploading to Firebase Storage:', storagePath, 'size:', jsonStr.length);
    return storageRef.put(blob,{contentType:'application/json',cacheControl:'no-cache'})
      .then(()=>{
        log('[Save] Storage upload OK, getting URL');
        return storageRef.getDownloadURL();
      })
      .then(url=>{
        log('[Save] got URL, updating database refs. URL='+url.slice(0,80)+'...');
        return Promise.all([
          fbDb.ref('donvi/'+currentUID+'/events_file').set(url),
          fbDb.ref('donvi/'+currentUID+'/last_update').set(Date.now())
        ]).then(()=>url);
      })
      .then(savedUrl=>{
        log('[Save] ✅ Firebase save complete');
        _lastSaveError=null;
        // Verify: đọc lại events_file để chắc chắn URL đã được lưu đúng
        return fbDb.ref('donvi/'+currentUID+'/events_file').once('value').then(snap=>{
          const storedUrl=snap.val();
          if(storedUrl===savedUrl){
            log('[Save] ✅ Verified: events_file URL stored correctly');
          } else {
            logErr('[Save] ❌ MISMATCH! URL saved differs from URL in Database!');
            log('  Expected:',savedUrl);
            log('  Got:',storedUrl);
            showToast('⚠️ Lưu lỗi: URL không khớp. Reload có thể không có data mới.');
          }
          // Bỏ tải lại TOÀN BỘ events.json để verify nội dung sau mỗi lần lưu
          // (rất tốn bandwidth khi file lớn). Chỉ verify khi DEBUG bật.
          if(window.DEBUG){
            return fetch(savedUrl,{cache:'no-cache'}).then(r=>r.ok?r.json():null).then(verifyData=>{
              if(Array.isArray(verifyData)&&verifyData.length!==events.length){
                logErr('[Save] ❌ FILE CONTENT MISMATCH! local='+events.length+' server='+verifyData.length);
                showToast('⚠️ Upload không đầy đủ! Server có '+verifyData.length+' events, local có '+events.length);
              } else if(Array.isArray(verifyData)){
                log('[Save] ✅ Verified: file content '+verifyData.length+' events (match)');
              }
            }).catch(e=>logWarn('[Save] verify fetch failed:',e.message));
          }
        });
      })
      .then(()=>{
        if(seq===_saveSeq) bc.postMessage({type:'eventsUpdate',events});
      })
      .catch(err=>{
        logErr('[Save] ❌ Firebase save FAILED:', err.code||'', err.message||err);
        _lastSaveError=err.message||String(err);
        // Hiện toast lỗi cho user
        try{
          showToast('⚠️ Lưu Firebase lỗi: '+(err.code==='storage/unauthorized'?'Không có quyền (kiểm tra App Check / đăng nhập)':err.message||'Không rõ'));
        }catch(e){}
        if(seq===_saveSeq) bc.postMessage({type:'eventsUpdate',events});
      });
  } else {
    logWarn('[Save] Firebase chưa sẵn sàng — KHÔNG lưu được (đã tắt cache localStorage). fbReady=',fbReady,'fbStorage=',!!fbStorage,'currentUID=',currentUID);
    try{
      showToast(!currentUID
        ? '⚠️ Chưa đăng nhập admin — chưa lưu được. Vui lòng đăng nhập rồi lưu lại.'
        : '⚠️ Chưa kết nối máy chủ — chưa lưu được. Kiểm tra mạng và thử lại.');
    }catch(e){}
    bc.postMessage({type:'eventsUpdate',events});
    return Promise.resolve();
  }
};
const nid=()=>{if(!events.length)return 1;let m=0;for(const e of events){const n=parseInt(e.id)||0;if(n>m)m=n;}return m+1;};

// Nhận message từ SW khi user click notification
if('serviceWorker' in navigator){
  navigator.serviceWorker.addEventListener('message', function(e){
    if(!e.data) return;
    if(e.data.type==='NOTIF_CLICKED'){
      _openedViaNotif=true;
      // Reset sau 2 giây phòng trường hợp app không focus
      setTimeout(function(){_openedViaNotif=false;}, 2000);
    }
    // Android: SW relay badge về trang — chỉ set navigator badge, không gọi setAppIconBadge
    if(e.data.type==='DO_BADGE'||e.data.type==='BADGE_SET'){
      var n=parseInt(e.data.count)||0;
      if('setAppBadge' in navigator){
        try{
          if(n>0) navigator.setAppBadge(n).catch(function(){});
          else    navigator.clearAppBadge().catch(function(){});
        }catch(err){}
      }
      return; // Không xử lý thêm — tránh vòng lặp badge
    }
  });
}

// ── Lazy load script ─────────────────────────────────────────
function _loadScript(url, cb){
  if(document.querySelector('script[src="'+url+'"]')){if(cb)cb();return;}
  const s=document.createElement('script');
  s.src=url;
  s.onload=cb||null;
  document.head.appendChild(s);
}
function _ensureXlsx(cb){_loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',cb);}
function _ensureDocx(cb){_loadScript('https://unpkg.com/docx@8.5.0/build/index.umd.js',cb);}
function _ensureMammoth(cb){
  if(typeof mammoth!=='undefined'){if(cb)cb();return;}
  _loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js',cb);
}
function _ensurePdf(cb){
  if(typeof pdfjsLib!=='undefined'){if(cb)cb();return;}
  _loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',function(){
    pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    if(cb)cb();
  });
}

// BroadcastChannel (safe fallback nếu không hỗ trợ)
let bc;
try{
  bc=new BroadcastChannel('lcttb_sync');
  bc.onmessage=e=>{
  if(e.data.type==='eventsUpdate'){events=e.data.events;renderAllNoFetch();}
  if(e.data.type==='tvOn')startTV();
  if(e.data.type==='tvOff')stopTV();
  if(e.data.type==='scrollOn'){scrollOn=true;startScroll();}
  if(e.data.type==='scrollOff'){scrollOn=false;stopScroll();}
  };
}catch(e){
  // BroadcastChannel không hỗ trợ (file://, private browsing, v.v.)
  bc={postMessage:()=>{},close:()=>{}};
}

// ════════════════════════════════════════
// UTILS
// ════════════════════════════════════════
function wkStart(off=0){const d=new Date(TODAY);const dow=d.getDay();d.setDate(d.getDate()+(dow===0?-6:1-dow)+off*7);d.setHours(0,0,0,0);return d}
function addDays(d,n){const r=new Date(d);r.setDate(r.getDate()+n);return r}
function fmtVi(d){return`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`}
function fmtViLong(d){const dn=['Chủ nhật','Thứ hai','Thứ ba','Thứ tư','Thứ năm','Thứ sáu','Thứ bảy'];return`${dn[d.getDay()]}, ngày ${String(d.getDate()).padStart(2,'0')} tháng ${String(d.getMonth()+1).padStart(2,'0')} năm ${d.getFullYear()}`}
function fmtSh(d){return`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`}
function viDow(w){return['Chủ nhật','Thứ hai','Thứ ba','Thứ tư','Thứ năm','Thứ sáu','Thứ bảy'][w]}
// ── Âm lịch Việt Nam ──
// Thuật toán Hồ Ngọc Đức đã được tách ra file js/lunar.js cho dễ bảo trì.
// Hàm toLunar(d,m,y) và fmtLunar(date) được expose qua window.
// File js/lunar.js phải load TRƯỚC file này.
function wkNum(d){const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const day=t.getUTCDay()||7;t.setUTCDate(t.getUTCDate()+4-day);const y=new Date(Date.UTC(t.getUTCFullYear(),0,1));return Math.ceil((((t-y)/86400000)+1)/7)}
function dayEvs(ds,ses){return events.filter(e=>e.date===ds&&e.ses===ses).sort((a,b)=>(a.time||'').localeCompare(b.time||''))}
function fIcon(t){return t&&t.startsWith('image/')?'🖼️':t&&t.includes('pdf')?'📄':t&&(t.includes('word')||t.includes('document'))?'📝':t&&(t.includes('excel')||t.includes('spreadsheet'))?'📊':'📎'}
function fColor(t){return t&&t.startsWith('image/')?'#7c3aed':t&&t.includes('pdf')?'#dc2626':t&&(t.includes('word')||t.includes('document'))?'#1d4ed8':t&&(t.includes('excel')||t.includes('spreadsheet'))?'#15803d':'#92400e'}
function fBg(t){return t&&t.startsWith('image/')?'#f3e8ff':t&&t.includes('pdf')?'#fee2e2':t&&(t.includes('word')||t.includes('document'))?'#dbeafe':t&&(t.includes('excel')||t.includes('spreadsheet'))?'#dcfce7':'#fef3c7'}
function fBorder(t){return t&&t.startsWith('image/')?'#c4b5fd':t&&t.includes('pdf')?'#fca5a5':t&&(t.includes('word')||t.includes('document'))?'#93c5fd':t&&(t.includes('excel')||t.includes('spreadsheet'))?'#86efac':'#fcd34d'}
function fLabel(t,name){
  if(name){const ext=name.split('.').pop().toUpperCase();return ext||'FILE';}
  return t&&t.startsWith('image/')?'ẢNH':t&&t.includes('pdf')?'PDF':t&&(t.includes('word')||t.includes('document'))?'WORD':t&&(t.includes('excel')||t.includes('spreadsheet'))?'EXCEL':'FILE';
}
function fShortName(name,maxLen=22){if(!name)return 'File đi kèm';return name.length>maxLen?name.slice(0,maxLen-1)+'…':name;}

function samples(){
  const ws=wkStart(0);const f=n=>iso(addDays(ws,n));
  return[
    {id:1,title:'Giao ban đầu tuần',date:f(0),ses:'sang',cat:'hop',time:'07:00',location:'Phòng họp UBND',chair:'Chủ tịch UBND',prep:'Toàn thể CBCC chuẩn bị báo cáo',note:'',files:[]},
    {id:2,title:'Kiểm tra công trình NTM thôn 3, 4',date:f(1),ses:'sang',cat:'kt',time:'08:00',location:'Thôn 3, Thôn 4',chair:'Phó Chủ tịch UBND',prep:'BCĐ NTM chuẩn bị biên bản',note:'',files:[]},
    {id:3,title:'Tiếp công dân định kỳ',date:f(1),ses:'chieu',cat:'nd',time:'14:00',location:'Phòng tiếp dân UBND xã',chair:'Chủ tịch UBND',prep:'Cán bộ tư pháp hỗ trợ',note:'',files:[]},
    {id:4,title:'Họp UBND thường kỳ – KH phát triển KT-XH',date:f(2),ses:'sang',cat:'hop',time:'07:30',location:'Hội trường UBND xã',chair:'Bí thư Đảng uỷ',prep:'Các ban ngành chuẩn bị báo cáo',note:'',files:[]},
    {id:5,title:'Lãnh đạo thăm hộ nghèo, gia đình chính sách',date:f(3),ses:'sang',cat:'ldao',time:'08:00',location:'Thôn 1, Thôn 2',chair:'Chủ tịch UBND',prep:'UBMTTQ lập danh sách',note:'',files:[]},
    {id:6,title:'Hội nghị BCĐ PCCC',date:f(3),ses:'chieu',cat:'hop',time:'14:00',location:'Phòng họp UBND',chair:'Phó Chủ tịch UBND',prep:'Thành viên BCĐ chuẩn bị báo cáo',note:'',files:[]},
    {id:7,title:'Kiểm tra hộ khẩu thường trú',date:f(4),ses:'sang',cat:'kt',time:'08:30',location:'Thôn 5, Thôn 6',chair:'Cán bộ tư pháp',prep:'CA xã phối hợp',note:'',files:[]},
  ];
}

// ════════════════════════════════════════
// WEATHER
// ════════════════════════════════════════
function wxInfo(code,day){
  const d={0:'Trời quang',1:'Ít mây',2:'Mây rải rác',3:'Nhiều mây',45:'Sương mù',51:'Mưa phùn nhẹ',53:'Mưa phùn',61:'Mưa nhẹ',63:'Mưa vừa',65:'Mưa to',80:'Mưa rào nhẹ',81:'Mưa rào',82:'Mưa rào to',95:'Giông bão'};
  const i={0:day?'☀️':'🌙',1:day?'🌤':'🌙',2:'⛅',3:'☁️',45:'🌫️',51:'🌦️',53:'🌦️',61:'🌧️',63:'🌧️',65:'⛈️',80:'🌦️',81:'🌧️',82:'⛈️',95:'⛈️'};
  return{icon:i[code]||'🌡️',desc:d[code]||'Không xác định'};
}

function mockWx(){
  const now=new Date();const m=now.getMonth()+1;const h=now.getHours();
  const ta=[23,24,26,28,30,31,31,31,29,27,25,23];
  const rain=m>=9||m<=1;const cur=ta[m-1]+(h>=12&&h<15?2:h<6?-3:0);
  const code=rain?(Math.random()>.4?61:3):(Math.random()>.3?0:1);
  const ws=wkStart(wkOff);const T=[],Te=[],Co=[],Pr=[],Ra=[];
  for(let d=0;d<7;d++){const day=addDays(ws,d);for(let hh=0;hh<24;hh++){const ds=iso(day);T.push(`${ds}T${String(hh).padStart(2,'0')}:00`);Te.push(Math.round((ta[day.getMonth()]+(hh>=12&&hh<15?2:hh<6?-3:0)+(Math.random()*2-1))*10)/10);const dc=rain?(d%3===0?61:d%3===1?80:3):(d%4===0?1:0);Co.push(dc);Pr.push(rain?(hh>=8&&hh<18?60:20):5);Ra.push(rain&&hh>=8&&hh<18?Math.random()*3:0);}}
  return{_mock:true,current:{temperature_2m:cur,relative_humidity_2m:rain?82:65,apparent_temperature:cur-2,rain:0,weather_code:code,wind_speed_10m:8+Math.random()*6,is_day:h>=6&&h<18?1:0},hourly:{time:T,temperature_2m:Te,weather_code:Co,precipitation_probability:Pr,precipitation:Ra}};
}

async function fetchWx(){
  const now=Date.now();
  // Tải chất lượng không khí song song (không chặn thời tiết). Khi xong, nếu
  // panel thời tiết đang mở thì vẽ lại để hiện AQI thật.
  fetchAirQuality().then(aq=>{
    if(aq){
      try{
        var box=document.getElementById('vsWx');
        if(box && box.classList.contains('wx-open') && (wxData&&wxData.current)){
          var panel=document.getElementById('vsWxPanel');
          if(panel) panel.innerHTML=buildWxDetail(wxData, wxData.current);
        }
      }catch(e){}
    }
  });
  // Chỉ dùng cache nếu là dữ liệu THẬT (không phải mock)
  if(wxData&&!wxMock&&now-wxFetchedAt<WX_TTL)return wxData;
  const ws=wkStart(wkOff);const we=addDays(ws,6);
  const p=`?latitude=${WX_LAT}&longitude=${WX_LON}&current=temperature_2m,relative_humidity_2m,apparent_temperature,rain,weather_code,wind_speed_10m,is_day&hourly=temperature_2m,precipitation_probability,weather_code,precipitation&timezone=Asia%2FHo_Chi_Minh&start_date=${iso(ws)}&end_date=${iso(we)}`;
  try{
    // Tăng timeout lên 8s vì open-meteo đôi khi chậm
    const to=new Promise((_,rej)=>setTimeout(()=>rej('timeout'),8000));
    const res=await Promise.race([fetch('https://api.open-meteo.com/v1/forecast'+p),to]);
    if(!res.ok)throw new Error('http_'+res.status);
    const data=await res.json();
    if(data&&data.current){
      wxData=data;wxFetchedAt=now;wxMock=false;
      log('[Wx] ✅ loaded:',data.current.temperature_2m+'°C');
      return wxData;
    }
    throw new Error('no_data');
  }catch(e){
    logWarn('[Wx] failed:',e.message||e,'- using mock');
    wxMock=true;wxData=mockWx();wxFetchedAt=now;
    // Retry trong nền sau 5 giây nếu là mock (có thể mạng đang chậm)
    setTimeout(()=>{
      if(wxMock){
        log('[Wx] retrying...');
        wxFetchedAt=0; // reset cache để force fetch lại
        fetchWx().then(d=>{
          if(d&&!wxMock){
            // Có data thật → update UI
            try{
              renderWxBox(document.getElementById('vsWx'),d);
              renderWxBox(document.getElementById('ahWx'),d);
              renderFcStrip('vsFc',d);
              renderFcStrip('ahFc',d);
            }catch(e){}
          }
        });
      }
    },5000);
    return wxData;
  }
}

// ── Chất lượng không khí (Open-Meteo Air Quality API, miễn phí, không cần key) ──
const AQ_TTL = 30*60*1000; // cache 30 phút
async function fetchAirQuality(){
  const now=Date.now();
  if(aqData && now-aqFetchedAt < AQ_TTL) return aqData;
  // dùng cùng tọa độ với thời tiết; lấy us_aqi (thang 0-500 quen thuộc)
  const url='https://air-quality-api.open-meteo.com/v1/air-quality'+
    `?latitude=${WX_LAT}&longitude=${WX_LON}&current=us_aqi,pm2_5&timezone=Asia%2FHo_Chi_Minh`;
  try{
    const to=new Promise((_,rej)=>setTimeout(()=>rej('timeout'),8000));
    const res=await Promise.race([fetch(url),to]);
    if(!res.ok) throw new Error('http_'+res.status);
    const data=await res.json();
    if(data && data.current && data.current.us_aqi!=null){
      aqData={ aqi: Math.round(data.current.us_aqi), pm25: data.current.pm2_5 };
      aqFetchedAt=now;
      log('[AQ] ✅ AQI:', aqData.aqi);
      return aqData;
    }
    throw new Error('no_data');
  }catch(e){
    logWarn('[AQ] failed:', e.message||e);
    return null; // thất bại → panel sẽ ẩn dòng AQI, không phá thời tiết
  }
}
// Quy đổi chỉ số US AQI sang nhãn tiếng Việt + màu
function aqiLabel(aqi){
  if(aqi==null) return null;
  if(aqi<=50)  return {txt:'Tốt',          col:'#1a9850'};
  if(aqi<=100) return {txt:'Trung bình',   col:'#f0a500'};
  if(aqi<=150) return {txt:'Kém (nhạy cảm)',col:'#e8622a'};
  if(aqi<=200) return {txt:'Xấu',          col:'#d62828'};
  if(aqi<=300) return {txt:'Rất xấu',      col:'#8e44ad'};
  return {txt:'Nguy hại',                  col:'#6e1423'};
}

function wxSes(data,ds,ses){
  if(!data||!data.hourly)return null;
  const{time:T,temperature_2m:Te,weather_code:Co,precipitation_probability:Pr,precipitation:Ra}=data.hourly;
  const[h0,h1]=ses==='sang'?[6,12]:[12,18];
  const sl=T.map((t,i)=>({t,temp:Te[i],code:Co[i],prob:Pr[i]||0,rain:Ra[i]||0})).filter(s=>s.t.startsWith(ds)&&parseInt(s.t.slice(11,13))>=h0&&parseInt(s.t.slice(11,13))<h1);
  if(!sl.length)return null;
  const sv=c=>c>=95?10:c>=80?8:c>=61?7:c>=51?5:c>=45?3:c>=3?2:c>=1?1:0;
  const dom=sl.reduce((a,b)=>sv(b.code)>sv(a.code)?b:a,sl[0]);
  return{icon:wxInfo(dom.code,1).icon,desc:wxInfo(dom.code,1).desc,temp:Math.round(sl.reduce((s,x)=>s+x.temp,0)/sl.length),prob:Math.max(...sl.map(x=>x.prob)),rain:Math.round(sl.reduce((s,x)=>s+x.rain,0)*10)/10};
}

function renderWxBox(el,data){
  if(!el)return;
  if(!data||!data.current){el.innerHTML='<div class="wx-loading">🌤 Đang cập nhật...</div>';return;}
  const c=data.current;const wi=wxInfo(c.weather_code,c.is_day);
  // Badge nhỏ khi dữ liệu thời tiết là ước tính (API fail, dùng mock)
  // → để user biết không phải số thực tế, tránh hiểu nhầm
  const tag=wxMock?' <span style="font-size:9px;background:rgba(255,200,0,.25);color:#f59e0b;padding:1px 5px;border-radius:8px;font-weight:700;margin-left:3px">ước tính</span>':'';
  const tm=new Date().toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'});
  var isMob=window.innerWidth<=600;
  if(isMob){
    // Tính min/max nhiệt độ hôm nay + khả năng mưa cao nhất hôm nay (từ hourly)
    var _wxDetail = buildWxDetail(data, c);
    el.innerHTML=`<button type="button" class="wx-mini-btn" onclick="toggleWxPanel(event)" aria-label="Xem chi tiết thời tiết">`+
        `<span class="wx-ico">${wi.icon}</span><span class="wx-temp">${Math.round(c.temperature_2m)}°C</span>`+
        `<span class="wx-caret">▾</span></button>`+
      `<div class="wx-panel" id="vsWxPanel">${_wxDetail}</div>`;
  }else{
    el.innerHTML=`<div class="wx-ico">${wi.icon}</div><div class="wx-info"><div class="wx-row1"><span class="wx-temp">${Math.round(c.temperature_2m)}°C</span><span class="wx-desc">${wi.desc}${tag}</span><span class="wx-ext-inline"><span>💧 ${c.relative_humidity_2m}%</span><span>💨 ${Math.round(c.wind_speed_10m)}km/h</span><span>🌡 ${Math.round(c.apparent_temperature)}°C</span></span></div></div>`;
  }
}

// Dựng nội dung panel chi tiết thời tiết (mobile) — giống bảng thời tiết quen thuộc
function buildWxDetail(data,c){
  try{
    // min/max + khả năng mưa cao nhất của HÔM NAY từ mảng hourly
    var lo=null,hi=null,rainMax=0;
    if(data&&data.hourly&&data.hourly.time){
      var todayIso=iso(new Date());
      var T=data.hourly.time,Te=data.hourly.temperature_2m,Pr=data.hourly.precipitation_probability||[];
      for(var i=0;i<T.length;i++){
        if((T[i]||'').slice(0,10)===todayIso){
          var t=Te[i];
          if(t!=null){ if(lo==null||t<lo)lo=t; if(hi==null||t>hi)hi=t; }
          if(Pr[i]!=null&&Pr[i]>rainMax)rainMax=Pr[i];
        }
      }
    }
    var temp=Math.round(c.temperature_2m);
    var range=(lo!=null&&hi!=null)?(' ('+Math.round(lo)+'°-'+Math.round(hi)+'°)'):'';
    var hum=c.relative_humidity_2m;
    // Chất lượng không khí THẬT từ Open-Meteo Air Quality (nếu đã tải được)
    var aqiRow='';
    if(aqData && aqData.aqi!=null){
      var al=aqiLabel(aqData.aqi);
      aqiRow='<div class="wxp-row"><span class="wxp-i">🌫️</span><span class="wxp-l">Chất lượng không khí:</span>'+
        '<span class="wxp-v"><b style="color:'+al.col+'">'+al.txt+'</b> <span style="opacity:.65;font-size:11px">(AQI '+aqData.aqi+')</span></span></div>';
    }else{
      // chưa có dữ liệu AQI → dòng tạm, sẽ tự cập nhật khi fetch xong
      aqiRow='<div class="wxp-row"><span class="wxp-i">🌫️</span><span class="wxp-l">Chất lượng không khí:</span><span class="wxp-v" style="opacity:.6">đang cập nhật…</span></div>';
    }
    var locName=(typeof ORG_CONFIG!=='undefined'&&ORG_CONFIG.tenNgan)?ORG_CONFIG.tenNgan:'Địa phương';
    return ''+
      '<div class="wxp-hd"><span class="wxp-loc">'+esc(locName)+'</span></div>'+
      '<div class="wxp-row"><span class="wxp-i">🌡️</span><span class="wxp-l">Nhiệt độ:</span><span class="wxp-v"><b>'+temp+'°C</b>'+range+'</span></div>'+
      '<div class="wxp-row"><span class="wxp-i">💧</span><span class="wxp-l">Độ ẩm:</span><span class="wxp-v"><b>'+hum+'%</b></span></div>'+
      aqiRow+
      '<div class="wxp-row"><span class="wxp-i">🌧️</span><span class="wxp-l">Khả năng mưa:</span><span class="wxp-v"><b>'+rainMax+'%</b></span></div>';
  }catch(e){ return '<div class="wxp-row">Không có dữ liệu chi tiết</div>'; }
}

// Bật/thu panel thời tiết (mobile). Bấm nút → mở; bấm lại hoặc bấm ra ngoài → thu.
window.toggleWxPanel=function(ev){
  if(ev){ ev.stopPropagation(); }
  var box=document.getElementById('vsWx'); if(!box)return;
  var open=box.classList.toggle('wx-open');
  if(open){
    // Nếu chưa có AQI → tải ngay, về thì cập nhật panel
    if(!aqData && typeof fetchAirQuality==='function'){
      fetchAirQuality().then(aq=>{
        if(aq){
          var panel=document.getElementById('vsWxPanel');
          if(panel && wxData && wxData.current) panel.innerHTML=buildWxDetail(wxData, wxData.current);
        }
      });
    }
    // bấm ra ngoài để đóng
    setTimeout(function(){
      document.addEventListener('click',_closeWxOnOutside,{once:true});
    },0);
  }
};
function _closeWxOnOutside(e){
  var box=document.getElementById('vsWx');
  if(box&&!box.contains(e.target)){ box.classList.remove('wx-open'); }
  else if(box&&box.classList.contains('wx-open')){
    // bấm bên trong (không phải nút) → vẫn lắng nghe tiếp
    document.addEventListener('click',_closeWxOnOutside,{once:true});
  }
}

function renderFcStrip(id,data){
  const el=document.getElementById(id);if(!el||!data)return;
  const ws=wkStart(wkOff);const days=Array.from({length:7},(_,i)=>addDays(ws,i));
  const vd=['CN','thứ 2','thứ 3','thứ 4','thứ 5','thứ 6','thứ 7'];let h='';
  days.forEach(d=>{
    const ds=iso(d);const s=wxSes(data,ds,'sang');const c=wxSes(data,ds,'chieu');const v=vd[d.getDay()];
    const lS=v==='CN'?'Sáng CN':'Sáng '+v;const lC=v==='CN'?'Chiều CN':'Chiều '+v;
    if(s)h+=`<div class="fcc"><span class="fcc-ses">${lS}</span><span class="fcc-ico">${s.icon}</span><span class="fcc-t">${s.temp}°C</span><span class="fcc-r">${s.prob>0?s.prob+'% mưa':s.desc}</span></div>`;
    if(c)h+=`<div class="fcc"><span class="fcc-ses">${lC}</span><span class="fcc-ico">${c.icon}</span><span class="fcc-t">${c.temp}°C</span><span class="fcc-r">${c.prob>0?c.prob+'% mưa':c.desc}</span></div>`;
  });
  el.innerHTML=h||'<div style="font-size:10px;color:rgba(255,255,255,.5);padding:0 8px">Không có dự báo</div>';
}
