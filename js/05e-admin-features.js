
// ════════════════════════════════════════
// ADMIN AUTH
// ════════════════════════════════════════
// Show datalist on click
function showList(inp){
  inp.value='';
  inp.dispatchEvent(new Event('input'));
  inp.focus();
}

// Multi-select functions
function toggleMsDropdown(boxId){
  const dd=document.getElementById(boxId).querySelector('.ms-dropdown');
  const allDd=document.querySelectorAll('.ms-dropdown.open');
  allDd.forEach(d=>{if(d!==dd)d.classList.remove('open');});
  dd.classList.toggle('open');
}
function updateMsDisplay(boxId,hiddenId){
  const box=document.getElementById(boxId);
  const checked=[...box.querySelectorAll('input[type=checkbox]:checked')].map(i=>i.value);
  const display=box.querySelector('.ms-display');
  const hidden=document.getElementById(hiddenId);
  hidden.value=checked.join(', ');
  // Hiển thị tags
  const existing=display.querySelectorAll('.ms-tag');
  existing.forEach(t=>t.remove());
  if(checked.length===0){
    display.innerHTML='-- Chọn đơn vị -- <span style="margin-left:auto">▾</span>';
  } else {
    display.innerHTML='';
    checked.forEach(v=>{
      const tag=document.createElement('span');
      tag.className='ms-tag';
      tag.textContent=v;  // textContent đã an toàn — không cần esc
      display.appendChild(tag);
    });
    const arr=document.createElement('span');
    arr.style.cssText='margin-left:auto;color:var(--muted);font-size:12px';
    arr.textContent='▾';
    display.appendChild(arr);
  }
}
function resetMsDropdown(boxId,hiddenId){
  const box=document.getElementById(boxId);
  box.querySelectorAll('input[type=checkbox]').forEach(cb=>cb.checked=false);
  updateMsDisplay(boxId,hiddenId);
  box.querySelector('.ms-dropdown').classList.remove('open');
}
function setMsValues(boxId,hiddenId,valStr){
  const vals=(valStr||'').split(',').map(v=>v.trim()).filter(Boolean);
  const box=document.getElementById(boxId);
  box.querySelectorAll('input[type=checkbox]').forEach(cb=>{
    cb.checked=vals.includes(cb.value);
  });
  updateMsDisplay(boxId,hiddenId);
}
// Close dropdown when clicking outside
document.addEventListener('click',e=>{
  if(!e.target.closest('.multi-select')){
    document.querySelectorAll('.ms-dropdown.open').forEach(d=>d.classList.remove('open'));
  }
});
function togglePw(){
  const inp=document.getElementById('lPass');
  const btn=document.getElementById('btnTogglePw');
  if(!inp)return;
  if(inp.type==='password'){inp.type='text';if(btn)btn.textContent='🙈';}
  else{inp.type='password';if(btn)btn.textContent='👁️';}
  inp.focus();
}
function openLogin(){document.getElementById('ovLogin').classList.add('open');document.getElementById('lUser').value='';document.getElementById('lPass').value='';document.getElementById('loginErr').classList.remove('show');setTimeout(()=>document.getElementById('lUser').focus(),100);}
function closeLogin(){document.getElementById('ovLogin').classList.remove('open');document.getElementById('loginErr').classList.remove('show');const p=document.getElementById('lPass');const b=document.getElementById('btnTogglePw');if(p)p.type='password';if(b)b.textContent='👁️';const ld=document.getElementById('loginLoading');if(ld)ld.style.display='none';const btn=document.getElementById('btnDoLogin');if(btn){btn.disabled=false;btn.textContent='Đăng nhập';}}
async function doLogin(){
  const tenXa=document.getElementById('lUser').value.trim().toLowerCase();
  const pass=document.getElementById('lPass').value;
  const errEl=document.getElementById('loginErr');
  // Validate tên xã: chỉ cho phép chữ thường, số, dấu gạch ngang
  if(!tenXa||!pass){
    errEl.textContent='Vui lòng nhập tên đơn vị và mật khẩu!';
    errEl.classList.add('show');return;
  }
  if(!/^[a-z0-9\-]+$/.test(tenXa)){
    errEl.textContent='Tên đơn vị chỉ gồm chữ không dấu, số (vd: taytrabong)';
    errEl.classList.add('show');return;
  }
  // Tự ghép email ẩn — người dùng chỉ cần gõ tên ngắn
  const email=tenXa+'@lichlamviectaytra.com.vn';
  const btn=document.getElementById('btnDoLogin');
  const ld=document.getElementById('loginLoading');
  if(btn){btn.disabled=true;btn.textContent='...';}
  if(ld) ld.style.display='block';
  errEl.classList.remove('show');
  try{
    await fbAuth.signInWithEmailAndPassword(email,pass);
    // onAuthStateChanged sẽ xử lý phần còn lại
  }catch(e){
    if(ld) ld.style.display='none';
    if(btn){btn.disabled=false;btn.textContent='Đăng nhập';}
    if(e.code==='auth/invalid-credential'||e.code==='auth/wrong-password'||e.code==='auth/user-not-found'){
      errEl.textContent='Tên đơn vị hoặc mật khẩu không đúng!';
    } else if(e.code==='auth/too-many-requests'){
      errEl.textContent='Thử quá nhiều lần, vui lòng chờ vài phút.';
    } else {
      errEl.textContent='Lỗi đăng nhập: '+e.message;
    }
    errEl.classList.add('show');
    document.getElementById('lPass').value='';
    document.getElementById('lPass').focus();
  }
}
// ════════════════════════════════════════
// CÀI ĐẶT THỜI TIẾT
// ════════════════════════════════════════
function openWxSetting(){
  const ov=document.getElementById('ovWxSetting');
  const sel=document.getElementById('wxLocationSelect');
  const info=document.getElementById('wxCurrentInfo');
  const err=document.getElementById('wxSettingErr');
  err.classList.remove('show');
  // Hiện tọa độ đang dùng
  if(WX_LAT&&WX_LON){
    info.style.display='block';
    info.textContent='📍 Hiện tại: '+WX_LAT.toFixed(4)+', '+WX_LON.toFixed(4);
    // Tự chọn option đang dùng nếu khớp
    for(let i=0;i<sel.options.length;i++){
      const v=sel.options[i].value;
      if(!v) continue;
      const[la,lo]=v.split('|').map(Number);
      if(Math.abs(la-WX_LAT)<0.001&&Math.abs(lo-WX_LON)<0.001){sel.value=v;break;}
    }
  }
  ov.classList.add('open');
}
function closeWxSetting(){
  document.getElementById('ovWxSetting').classList.remove('open');
}
async function saveWxSetting(){
  const sel=document.getElementById('wxLocationSelect');
  const err=document.getElementById('wxSettingErr');
  if(!sel.value){err.classList.add('show');return;}
  const[la,lo]=sel.value.split('|').map(Number);
  // Cập nhật biến runtime
  WX_LAT=la; WX_LON=lo;
  wxData=null; wxFetchedAt=0; // Reset cache để fetch lại
  // Lưu vào Firebase donvi/{uid}/info/viTri
  if(fbReady&&currentUID){
    try{
      await fbDb.ref('donvi/'+currentUID+'/info/viTri').set({lat:la,lon:lo});
      // Cập nhật ORG_CONFIG luôn
      ORG_CONFIG.viTri={lat:la,lon:lo};
    }catch(e){
}
  }
  closeWxSetting();
  // Fetch thời tiết mới theo địa danh vừa chọn
  const wxd=await fetchWx();
  renderWxBox(document.getElementById('vsWx'),wxd);
  renderWxBox(document.getElementById('ahWx'),wxd);
  renderFcStrip('vsFc',wxd);
  renderFcStrip('ahFc',wxd);
  renderVsTable(wkStart(wkOff),wxd);
  renderAdminTable(wkStart(wkOff),wxd);
}

function logout(){
  var _sealSrc='';var _sealEl=document.querySelector('#ovLogin .ll-ico img');if(_sealEl)_sealSrc=_sealEl.src;
  var _icoHtml=_sealSrc?'<img src="'+_sealSrc+'" alt="Quốc huy" style="width:56px;height:56px;display:block;margin:0 auto 4px">':'';
  showConfirmModal('🚪 Đăng xuất','Bạn có chắc muốn đăng xuất khỏi hệ thống?',()=>{
    if(fbAuth) fbAuth.signOut();
    isAdmin=false;
    try{localStorage.removeItem('lcttb_auth');}catch(e){}
    document.body.classList.remove('is-admin');
    if(tvOn){stopTV();try{bc.postMessage({type:'tvOff'});}catch(e){}}
  },_icoHtml);
}

function showConfirmModal(title, msg, onOk, iconHtml){
  const parts=title.split(' ');
  const icon=parts[0];
  const t=parts.slice(1).join(' ');
  const cfmIco=document.getElementById('cfmIcon');
  if(iconHtml){cfmIco.innerHTML=iconHtml;}
  else if(icon.startsWith('<')){cfmIco.innerHTML=icon;}
  else{cfmIco.innerHTML='';cfmIco.textContent=icon;}
  document.getElementById('cfmTitle').textContent=iconHtml?title:t;
  document.getElementById('cfmMsg').textContent=msg;
  const modal=document.getElementById('confirmModal');
  modal.style.display='flex';
  const btn=document.getElementById('cfmOk');
  btn.onclick=()=>{closeConfirmModal();onOk();};
  modal.onclick=(e)=>{if(e.target===modal)closeConfirmModal();};
}

function closeConfirmModal(){
  document.getElementById('confirmModal').style.display='none';
}

// ════════════════════════════════════════
// ADD/EDIT EVENT
// ════════════════════════════════════════
let _isHoan=false, _isChuyen=false, _origDate=null, _origSes=null;

function toggleHoanBtn(){
  _isHoan=!_isHoan;
  const btn=document.getElementById('fHoanLabel');
  const icon=document.getElementById('fHoanIcon');
  const txt=document.getElementById('fHoanText');
  const chuyenBtn=document.getElementById('fChuyenLabel');
  const chuyenRow=document.getElementById('fChuyenRow');
  if(_isHoan){
    // Bật Hoãn: nút đỏ rực, hiện nút Chuyển ngày (nếu đang sửa)
    btn.style.background='#e74c3c';btn.style.color='#fff';btn.style.borderColor='#c0392b';
    if(icon) icon.textContent='⏸';
    if(txt) txt.textContent='Đã hoãn';
    // Hiện nút Chuyển ngày để người dùng có thể chọn chuyển
    if(chuyenBtn&&editId) chuyenBtn.style.display='flex';
  } else {
    // Tắt Hoãn: reset về mặc định, ẩn Chuyển ngày
    btn.style.background='#fff5f5';btn.style.color='#c0392b';btn.style.borderColor='#e74c3c';
    if(icon) icon.textContent='⏸';
    if(txt) txt.textContent='Hoãn lịch';
    _isChuyen=false;
    if(chuyenBtn){chuyenBtn.style.display='none';chuyenBtn.style.background='#f0f6ff';chuyenBtn.style.color='#1a4f7a';chuyenBtn.style.borderColor='#3b82f6';chuyenBtn.style.opacity='1';chuyenBtn.style.pointerEvents='';}
  }
}
function toggleHoan(cb){}
function toggleChuyenBtn(){
  // Chỉ hoạt động khi đã bật Hoãn
  if(!_isHoan) return;
  // Lấy ngày đang chọn trên ô Ngày của form
  const newDate=document.getElementById('fD').value;
  const newSes=document.getElementById('fSes').value;
  if(!newDate||(newDate===_origDate&&newSes===_origSes)){
    alert('Vui lòng chọn ngày hoặc buổi khác với lịch hiện tại trước khi chuyển!');
    return;
  }
  // Đánh dấu chuyển, làm mờ nút — bấm Lưu lịch mới thực sự chuyển
  _isChuyen=true;
  const btn=document.getElementById('fChuyenLabel');
  if(btn){btn.style.opacity='0.45';btn.style.pointerEvents='none';btn.style.background='#3b82f6';btn.style.color='#fff';btn.style.borderColor='#1a4f7a';}
}
function resetHoanChuyen(){
  _isHoan=false; _isChuyen=false;
  const hoanBtn=document.getElementById('fHoanLabel');
  if(hoanBtn){hoanBtn.style.background='#fff5f5';hoanBtn.style.color='#c0392b';hoanBtn.style.borderColor='#e74c3c';}
  const hoanTxt=document.getElementById('fHoanText');
  if(hoanTxt) hoanTxt.textContent='Hoãn lịch';
  const hoanIcon=document.getElementById('fHoanIcon');
  if(hoanIcon) hoanIcon.textContent='⏸';
  const chuyenBtn=document.getElementById('fChuyenLabel');
  if(chuyenBtn){chuyenBtn.style.background='#f0f6ff';chuyenBtn.style.color='#1a4f7a';chuyenBtn.style.borderColor='#3b82f6';chuyenBtn.style.opacity='1';chuyenBtn.style.pointerEvents='';}
}
function openAdd(date,ses){
  editId=null;pending=[];
  document.getElementById('mTitle').textContent='➕ Thêm lịch làm việc';
  document.getElementById('btnDel').style.display='none';
  document.getElementById('fT').value='';
  // Ẩn cả Hoãn lịch lẫn Chuyển ngày khi thêm mới (chưa có lịch thì không hoãn được)
  const _lbl=document.getElementById('fChuyenLabel');
  if(_lbl) _lbl.style.display='none';
  const _hoanLbl=document.getElementById('fHoanLabel');
  if(_hoanLbl) _hoanLbl.style.display='none';
  resetHoanChuyen();
  resetLapLai();
  _origDate=null; _origSes=null;
  const _lapRow=document.getElementById('fLapLaiRow');
  if(_lapRow) _lapRow.style.display='';
  // Populate dropdown ngày theo tuần đang xem
  const _ws=wkStart(wkOff);
  const _vn=['Chủ nhật','Thứ hai','Thứ ba','Thứ tư','Thứ năm','Thứ sáu','Thứ bảy'];
  const _fD=document.getElementById('fD');
  _fD.innerHTML='';
  for(let i=0;i<7;i++){const _d=addDays(_ws,i);const _iso=iso(_d);const _opt=document.createElement('option');_opt.value=_iso;_opt.textContent=`${_vn[_d.getDay()]} – ${String(_d.getDate()).padStart(2,'0')}/${String(_d.getMonth()+1).padStart(2,'0')}/${_d.getFullYear()}`;_fD.appendChild(_opt);}
  _fD.value=date||iso(wkStart(wkOff));
  const _ses=ses||'sang';
  document.getElementById('fSes').value=_ses;
  document.getElementById('fC').value='hop';
  document.getElementById('fS').value=_ses==='chieu'?'14:00':_ses==='toi'?'19:00':'07:30';
  document.getElementById('fL').value='Hội trường UBND xã';
  document.getElementById('fCh').value='';document.getElementById('fMb').value='';document.getElementById('fPr').value='';document.getElementById('fN').value='';
  renderAttach();
  document.getElementById('ovAdd').classList.add('open');
  setTimeout(()=>document.getElementById('fT').focus(),80);
}
function openAddDs(ds,ses){openAdd(ds,ses);}
function openEdit(id){
  const e=events.find(x=>x.id===id);if(!e)return;
  editId=id;pending=[...(e.files||[])];
  document.getElementById('mTitle').textContent='✏️ Sửa lịch làm việc';
  document.getElementById('btnDel').style.display='';
  document.getElementById('fT').value=e.title||'';
  // Hiện nút Hoãn khi sửa; Chuyển ngày ẩn ban đầu (chỉ hiện khi bật Hoãn)
  const _lbl2=document.getElementById('fChuyenLabel');
  if(_lbl2) _lbl2.style.display='none';
  const _hoanLbl2=document.getElementById('fHoanLabel');
  if(_hoanLbl2) _hoanLbl2.style.display='flex';
  resetHoanChuyen();
  resetLapLai();
  const _lapRow2=document.getElementById('fLapLaiRow');
  if(_lapRow2) _lapRow2.style.display='none'; // Ẩn lặp lại khi sửa
  // Khôi phục trạng thái hoãn
  _isHoan=!!(e.hoan);
  if(_isHoan){
    const hoanBtn=document.getElementById('fHoanLabel');
    const hoanTxt=document.getElementById('fHoanText');
    if(hoanBtn){hoanBtn.style.background='#e74c3c';hoanBtn.style.color='#fff';hoanBtn.style.borderColor='#c0392b';}
    if(hoanTxt) hoanTxt.textContent='Đã hoãn';
    // Hiện nút Chuyển ngày vì đang hoãn
    const _chLbl=document.getElementById('fChuyenLabel');
    if(_chLbl) _chLbl.style.display='flex';
  }
  // Populate dropdown ngày theo tuần chứa sự kiện đang sửa (không phụ thuộc tuần đang xem)
  const _eVn=['Chủ nhật','Thứ hai','Thứ ba','Thứ tư','Thứ năm','Thứ sáu','Thứ bảy'];
  const _eFd=document.getElementById('fD');
  _eFd.innerHTML='';
  // Tính Thứ 2 đầu tuần chứa e.date
  let _evWs;
  if(e.date){
    const _evDate=new Date(e.date+'T00:00:00');
    const _evDow=_evDate.getDay(); // 0=CN,1=T2,...
    _evWs=new Date(_evDate);
    _evWs.setDate(_evDate.getDate()+(_evDow===0?-6:1-_evDow));
    _evWs.setHours(0,0,0,0);
  } else {
    _evWs=wkStart(wkOff);
  }
  for(let i=0;i<7;i++){const _d=addDays(_evWs,i);const _iso=iso(_d);const _opt=document.createElement('option');_opt.value=_iso;_opt.textContent=`${_eVn[_d.getDay()]} – ${String(_d.getDate()).padStart(2,'0')}/${String(_d.getMonth()+1).padStart(2,'0')}/${_d.getFullYear()}`;_eFd.appendChild(_opt);}
  _eFd.value=e.date||'';
  _origDate=e.date||null;
  _origSes=e.ses||'sang';
  document.getElementById('fSes').value=e.ses||'sang';
  document.getElementById('fC').value=e.cat||'hop';
  document.getElementById('fS').value=e.time||'';
  document.getElementById('fL').value=e.location||'';const _mb=document.getElementById('fMb');if(_mb)_mb.value=e.member||'';
  document.getElementById('fCh').value=e.chair||'';
  document.getElementById('fPr').value=e.prep||'';
  document.getElementById('fN').value=e.note||'';
  renderAttach();
  document.getElementById('ovAdd').classList.add('open');
}
function closeAdd(){document.getElementById('ovAdd').classList.remove('open');pending=[];editId=null;resetHoanChuyen();}
function resetPWABanner(){localStorage.removeItem('pwaDismiss2');location.reload();}
function saveEv(){
  const title=document.getElementById('fT').value.trim();
  let date=document.getElementById('fD').value;
  if(!title||!date){alert('Vui lòng điền tiêu đề và ngày!');return;}
  if(pending.some(f=>f._uploading)){alert('Vui lòng chờ file đang tải lên xong!');return;}

  const member=(document.getElementById('fMb')||{value:''}).value.trim();
  const baseEv={
    title,date,
    ses:document.getElementById('fSes').value,
    cat:document.getElementById('fC').value,
    time:document.getElementById('fS').value,
    location:document.getElementById('fL').value.trim(),
    member,
    chair:document.getElementById('fCh').value.trim(),
    prep:document.getElementById('fPr').value.trim(),
    note:document.getElementById('fN').value.trim(),
    files:[...pending],
    hoan:0  // mặc định 0, sẽ override bên dưới nếu cần
  };

  // ── TRƯỜNG HỢP: Chuyển ngày (sửa lịch, có chọn ngày chuyển) ──
  if(editId && _isHoan && _isChuyen){
    const newDate=document.getElementById('fD').value;
    const _newSes=document.getElementById('fSes').value;
    if(!newDate||(newDate===_origDate&&_newSes===_origSes)){alert('Vui lòng chọn ngày hoặc buổi khác với lịch gốc!');return;}
    // Lịch cũ: giữ lại, đánh dấu Hoãn nhấp nháy ở ngày gốc
    const oldEv=Object.assign({},baseEv,{id:editId,date:_origDate,ses:_origSes,hoan:true,isNew:0});
    const _oldIdx=events.findIndex(x=>x.id===editId);
    if(_oldIdx>=0) events[_oldIdx]=oldEv;
    // Lịch mới: ngày mới, badge NEW xanh, KHÔNG có hoan
    const cleanTitle=baseEv.title.replace(/\s*\(Hoãn\)\s*$/i,'').trim();
    const newEv=Object.assign({},baseEv,{id:nid(),date:newDate,ses:document.getElementById('fSes').value,title:cleanTitle,hoan:0,isNew:Date.now()});
    events.push(newEv);
    const _saveResult2=save();
    closeAdd();renderAllNoFetch();
    setTimeout(()=>{var ac=document.getElementById('adminCards');if(ac)ac.scrollTop=0;},50);
    Promise.resolve(_saveResult2).then(()=>{
      sendFCMPush(1,'📅 Lịch đã được chuyển ngày: '+cleanTitle, newEv.id, newEv.date);
    });
    showToast('✅ Đã chuyển lịch sang ngày mới, lịch cũ đánh dấu Hoãn');
    setTimeout(()=>{const idx=events.findIndex(x=>x.id===newEv.id);if(idx>=0&&events[idx].isNew){events[idx].isNew=0;save();renderAllNoFetch();}},5*60*1000);
    return;
  }

  // ── TRƯỜNG HỢP: Hoãn không chuyển ngày → lưu tại chỗ với hoan:true ──
  // (xử lý bên dưới qua _isHoan)

  // Lặp lại (chỉ khi thêm mới)
  const lapLai=!editId?(document.getElementById('fLapLai')||{value:''}).value:'';
  const soLan=lapLai?parseInt((document.getElementById('fLapLaiSo')||{value:'4'}).value)||4:0;

  // Không chuyển ngày — lưu bình thường
  const isNewEv=!editId;
  const ev=Object.assign({},baseEv,{id:editId||nid(),hoan:_isHoan,isNew:isNewEv?Date.now():0});
  if(editId){const _idx=events.findIndex(x=>x.id===editId);if(_idx>=0)events[_idx]=ev;else events.push(ev);}
  else events.push(ev);

  // Tạo các lịch lặp lại
  if(lapLai&&soLan>0){
    const baseDate=new Date(date+'T00:00:00');
    for(let i=1;i<soLan;i++){
      const nd=new Date(baseDate);
      if(lapLai==='weekly') nd.setDate(nd.getDate()+7*i);
      else if(lapLai==='biweekly') nd.setDate(nd.getDate()+14*i);
      else if(lapLai==='monthly') nd.setMonth(nd.getMonth()+i);
      const ndIso=iso(nd);
      events.push(Object.assign({},baseEv,{id:nid(),date:ndIso,hoan:0,isNew:Date.now()}));
    }
    showToast('✅ Đã tạo '+soLan+' lịch lặp lại!');
  }

  const _saveResult=save();
  closeAdd();renderAllNoFetch();
  setTimeout(()=>{var ac=document.getElementById('adminCards');if(ac&&isNewEv){var ws2=wkStart(wkOff);var ds2=date;var el2=ac.querySelector('[data-date="'+ds2+'"]');if(el2)el2.scrollIntoView({behavior:'smooth',block:'nearest'});}},80);
  // Push thông báo đến điện thoại — CHỈ SAU KHI save() đã upload Firebase xong
  var _pushMsg=_isHoan?('⏸ Lịch hoãn: '+ev.title)
    :lapLai?('➕ Đã thêm '+soLan+' lịch lặp lại: '+ev.title)
    :isNewEv?('➕ Lịch mới: '+ev.title)
    :('✏️ Lịch đã sửa: '+ev.title);
  // Wait save xong rồi mới gửi push để viewer nhận được data MỚI NHẤT
  Promise.resolve(_saveResult).then(()=>{
    sendFCMPush(1, _pushMsg, ev.id, ev.date);
  });
  if(isNewEv&&!lapLai){
    setTimeout(()=>{
      const idx=events.findIndex(x=>x.id===ev.id);
      if(idx>=0&&events[idx].isNew){events[idx].isNew=0;save();renderAllNoFetch();}
    },5*60*1000);
  }
}
function delCurEv(){
  if(!editId||!confirm('Xoá lịch này?'))return;
  const _delEv=events.find(e=>e.id===editId);
  events=events.filter(e=>e.id!==editId);
  // Xóa file đính kèm trên Firebase Storage nếu có
  if(fbStorage&&_delEv&&_delEv.files){
    _delEv.files.forEach(function(f){
      if(f.path){try{fbStorage.ref(f.path).delete().catch(()=>{});}catch(e){}}
    });
  }
  // save() đã xử lý cả localStorage lẫn Firebase và bc.postMessage
  const _saveResult=save();
  closeAdd();renderAllNoFetch();
  // Gửi push SAU KHI Firebase đã upload xong (đồng bộ data trước, push sau)
  Promise.resolve(_saveResult).then(()=>{
    sendFCMPush(1,'🗑 Đã xoá lịch'+(_delEv?': '+_delEv.title:''));
  });
}
async function clearAll(){
  if(!confirm('Xoá TOÀN BỘ lịch? Không thể hoàn tác!'))return;
  events=[];
  save(); // save() đã xử lý localStorage, Firebase và bc.postMessage
  closeAdd();
  renderAllNoFetch();
}

// ════════════════════════════════════════
// FILES
// ════════════════════════════════════════

// Nén ảnh nhanh: dùng createImageBitmap (không cần Image.onload) + OffscreenCanvas nếu có
async function compressImage(file){
  try{
    const maxW=1280,maxH=1280,quality=0.78;
    // createImageBitmap nhanh hơn new Image() vì không cần dataUrl
    const bmp=await createImageBitmap(file);
    let w=bmp.width,h=bmp.height;
    const needResize=w>maxW||h>maxH;
    if(!needResize&&file.size<300*1024){bmp.close&&bmp.close();return null;} // nhỏ, giữ nguyên
    const ratio=needResize?Math.min(maxW/w,maxH/h):1;
    w=Math.round(w*ratio);h=Math.round(h*ratio);
    // Dùng OffscreenCanvas nếu có (nhanh hơn ~2x, không block UI)
    let canvas;
    if(typeof OffscreenCanvas!=='undefined'){
      canvas=new OffscreenCanvas(w,h);
    }else{
      canvas=document.createElement('canvas');
      canvas.width=w;canvas.height=h;
    }
    const ctx=canvas.getContext('2d');
    ctx.drawImage(bmp,0,0,w,h);
    bmp.close&&bmp.close();
    const mimeOut=file.type==='image/png'?'image/png':'image/jpeg';
    const q=file.type==='image/png'?0.9:quality;
    // convertToBlob (OffscreenCanvas) hoặc toBlob (HTMLCanvas)
    if(canvas.convertToBlob) return await canvas.convertToBlob({type:mimeOut,quality:q});
    return await new Promise(r=>canvas.toBlob(r,mimeOut,q));
  }catch(e){return null;}
}

// Upload 1 file lên Firebase Storage với nén + tiến trình
async function uploadFileToStorage(file,pendingId){
  if(!fbStorage||!currentUID) return null;
  try{
    let blob=null;
    let finalType=file.type;
    let finalName=file.name;

    const _upd=(pct,label)=>{
      const idx=pending.findIndex(p=>p._id===pendingId);
      if(idx>=0){pending[idx]._pct=pct;pending[idx]._label=label;renderAttach();}
    };

    // Nén ảnh song song với việc đọc file
    if(file.type&&file.type.startsWith('image/')){
      _upd(0,'Đang nén...');
      const compressed=await compressImage(file);
      if(compressed){
        blob=compressed;
        finalType=blob.type||file.type;
        if(finalType==='image/jpeg'&&!finalName.toLowerCase().match(/\.jpe?g$/))
          finalName=finalName.replace(/\.[^.]+$/,'')+'.jpg';
      }
    }

    // Nếu chưa có blob → đọc file trực tiếp (không qua dataUrl)
    if(!blob){
      _upd(0,'Đang đọc...');
      blob=file; // Firebase SDK nhận File trực tiếp, không cần Blob
    }

    const ext=finalName.split('.').pop()||'bin';
    const path='donvi/'+currentUID+'/files/'+Date.now()+'_'+Math.random().toString(36).slice(2)+'.'+ext;
    const ref=fbStorage.ref(path);

    await new Promise(function(resolve,reject){
      const task=ref.put(blob,{contentType:finalType,contentDisposition:'inline; filename="'+finalName+'"',cacheControl:'public, max-age=31536000, immutable'});
      task.on('state_changed',
        function(snap){
          const pct=Math.round(snap.bytesTransferred/snap.totalBytes*100);
          _upd(pct,'Đang tải '+pct+'%');
        },
        reject,resolve
      );
    });

    const url=await ref.getDownloadURL();
    return {name:finalName,type:finalType,url,path};
  }catch(e){return null;}
}

function handleFiles(files){
  const filesArr=Array.from(files);
  // Thêm tất cả vào pending ngay lập tức (không cần đọc dataUrl trước)
  const newItems=filesArr.map(f=>({
    name:f.name,type:f.type,
    dataUrl:null,_uploading:true,_pct:0,_label:'Đang xử lý...',
    _id:Date.now()+'_'+Math.random().toString(36).slice(2),
    _file:f // giữ tham chiếu File gốc cho AI đọc
  }));
  newItems.forEach(item=>pending.push(item));
  renderAttach();

  // Upload tất cả song song (Promise.all)
  Promise.all(newItems.map(async item=>{
    const result=await uploadFileToStorage(item._file,item._id);
    const idx=pending.findIndex(p=>p._id===item._id);
    if(idx>=0){
      if(result){
        pending[idx]=Object.assign({},result,{_uploading:false,_id:item._id});
      }else{
        // Fallback base64 nếu Storage lỗi
        const dataUrl=await new Promise(r=>{const rd=new FileReader();rd.onload=e=>r(e.target.result);rd.readAsDataURL(item._file);});
        pending[idx]=Object.assign({},item,{dataUrl,_uploading:false,_label:''});
      }
      renderAttach();
    }
  }));

  document.getElementById('fileIn').value='';
  // AI đọc file gốc song song
  if(typeof aiReadFiles==='function') aiReadFiles(filesArr);
}
// Drag-drop file zone (safe - chỉ gắn nếu element tồn tại)
function initFdz(){
  const fdz=document.getElementById('fdz');
  if(!fdz)return;
  ['dragover','dragenter'].forEach(ev=>fdz.addEventListener(ev,e=>{e.preventDefault();fdz.classList.add('drag')}));
  ['dragleave','drop'].forEach(ev=>fdz.addEventListener(ev,e=>{e.preventDefault();fdz.classList.remove('drag')}));
  fdz.addEventListener('drop',e=>handleFiles(e.dataTransfer.files));
}
function renderAttach(){
  document.getElementById('attachList').innerHTML=pending.map((f,i)=>{
    const statusTxt=f._uploading
      ?(f._label||'⏳ Đang xử lý...')
      :'✅ '+esc(f.name.split('.').pop().toUpperCase());
    return `<div class="aitem"><span style="font-size:14px">${fIcon(f.type)}</span><span class="an">${esc(f.name)}</span><span class="at">${esc(statusTxt)}</span><button class="adel" onclick="pending.splice(${i},1);renderAttach()">✕</button></div>`;
  }).join('');
}
function openFile(f){
  // Hỗ trợ cả file mới (url Storage) lẫn file cũ (dataUrl base64)
  const src=f.url||f.dataUrl;
  if(!f||!src)return;
  // Hiện overlay ngay lập tức trước khi xử lý
  showFileLoading('Đang mở file...');
  // Nhường cho browser render overlay, sau đó mới xử lý
  setTimeout(function(){ _doOpenFile(f,src); }, 30);
}
function _doOpenFile(f,src){
  // Ảnh → lightbox xem ngay trong trang (pinch-zoom, nút trở về)
  if(f.type&&f.type.startsWith('image/')){
    var lbImg=document.getElementById('lbImg');
    var lbName=document.getElementById('lbFileName');
    if(lbImg){lbImg.style.display='block';lbImg.src=src;}
    if(lbName)lbName.textContent=f.name||'File đi kèm';
    var ifr=document.getElementById('lbPdfFrame');if(ifr)ifr.style.display='none';
    var ic=document.getElementById('lbImgCtrls');if(ic)ic.style.display='flex';
    var pc=document.getElementById('lbPdfCtrls');if(pc)pc.style.display='none';
    var bb=document.getElementById('lbBackBtn');if(bb)bb.style.display='flex';
    document.getElementById('lbox').classList.add('open');
    hideFileLoading();
    return;
  }

  // PDF: mobile → lightbox PDF.js; desktop → mở tab mới
  if(f.type==='application/pdf'||f.name.toLowerCase().endsWith('.pdf')){
    var _isMob=/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    // Nếu là URL Storage → fetch về blob rồi xử lý
    if(f.url){
      fetch(f.url).then(function(r){return r.blob();}).then(function(_blob){
        hideFileLoading();
        if(_isMob){
          _lbPdfBlob={blob:_blob,name:f.name||'file.pdf'};
          var lbImg2=document.getElementById('lbImg');if(lbImg2)lbImg2.style.display='none';
          var lbName=document.getElementById('lbFileName');if(lbName)lbName.textContent=f.name||'File PDF';
          var ic=document.getElementById('lbImgCtrls');if(ic)ic.style.display='none';
          var pc=document.getElementById('lbPdfCtrls');if(pc)pc.style.display='flex';
          var bb=document.getElementById('lbBackBtn');if(bb)bb.style.display='flex';
          var lb2=document.getElementById('lboxBody');if(lb2)lb2.scrollTop=0;
          document.getElementById('lbox').classList.add('open');
          _renderPdfBlob(_blob);
        }else{
          var _blobUrl=URL.createObjectURL(_blob);
          var _w=window.open(_blobUrl,'_blank');
          setTimeout(function(){URL.revokeObjectURL(_blobUrl);},60000);
          if(!_w) alert('Trình duyệt đang chặn popup. Vui lòng cho phép popup rồi thử lại.');
        }
      }).catch(function(){hideFileLoading();window.open(f.url,'_blank');});
      return;
    }
    try{
      var _b64=src.split(',')[1];
      var _bs=atob(_b64);
      var _ab=new ArrayBuffer(_bs.length);
      var _ia=new Uint8Array(_ab);
      for(var _k=0;_k<_bs.length;_k++) _ia[_k]=_bs.charCodeAt(_k);
      var _blob=new Blob([_ab],{type:'application/pdf'});
      hideFileLoading();
      if(_isMob){
        _lbPdfBlob={blob:_blob,name:f.name||'file.pdf'};
        var lbImg2=document.getElementById('lbImg');if(lbImg2)lbImg2.style.display='none';
        var lbName=document.getElementById('lbFileName');
        if(lbName)lbName.textContent=f.name||'File PDF';
        var ic=document.getElementById('lbImgCtrls');if(ic)ic.style.display='none';
        var pc=document.getElementById('lbPdfCtrls');if(pc)pc.style.display='flex';
        var bb=document.getElementById('lbBackBtn');if(bb)bb.style.display='flex';
        var lb2=document.getElementById('lboxBody');if(lb2)lb2.scrollTop=0;
        document.getElementById('lbox').classList.add('open');
        _renderPdfBlob(_blob);
      }else{
        var _blobUrl=URL.createObjectURL(_blob);
        var _w=window.open(_blobUrl,'_blank');
        setTimeout(function(){URL.revokeObjectURL(_blobUrl);},60000);
        if(!_w) alert('Trình duyệt đang chặn popup. Vui lòng cho phép popup cho trang này rồi thử lại.');
      }
    }catch(_e){
      hideFileLoading();
      window.open(src,'_blank');
    }
    return;
  }
  // Word / Excel → mở bằng Google Docs Viewer (dùng URL Firebase Storage)
  const isWord=f.name.toLowerCase().match(/\.docx?$/);
  const isExcel=f.name.toLowerCase().match(/\.xlsx?$/);
  if(isWord||isExcel){
    openWithGoogle(f);
    return;
  }
  // Khác → tải về hoặc mở URL
  hideFileLoading();
  if(f.url){window.open(f.url,'_blank');return;}
  const a=document.createElement('a');
  a.href=src;a.download=f.name;a.click();
}

function openWithGoogle(f){
  // Nếu file đã có URL từ Firebase Storage → dùng trực tiếp (không cần upload lại)
  if(f.url){
    const gdocsUrl='https://docs.google.com/viewer?url='+encodeURIComponent(f.url)+'&embedded=false';
    hideFileLoading();
    const w=window.open(gdocsUrl,'_blank');
    if(!w) alert('Trình duyệt đang chặn popup. Vui lòng cho phép popup rồi thử lại.');
    return;
  }
  // Fallback: file cũ chỉ có dataUrl (base64) → tải về, không có cách mở online
  hideFileLoading();
  showToast('⚠️ File chưa được upload lên server, đang tải về máy...');
  const a=document.createElement('a');
  a.href=f.dataUrl;a.download=f.name;a.click();
}

// ════════════════════════════════════════
// WEEK LIST
// ════════════════════════════════════════
function buildWkListHTML(){
  const ws0=wkStart(0);const wm={};
  events.forEach(e=>{if(!e.date||!/^\d{4}-\d{2}-\d{2}$/.test(e.date))return;const parts=e.date.split('-');const d=new Date(+parts[0],+parts[1]-1,+parts[2]);if(isNaN(d.getTime()))return;const ew=new Date(d);const dw=ew.getDay();ew.setDate(ew.getDate()+(dw===0?-6:1-dw));ew.setHours(0,0,0,0);const off=Math.round((ew-ws0)/(7*86400000));if(!wm[off])wm[off]={cnt:0,ws:ew};wm[off].cnt++;});
  for(let i=-2;i<=7;i++)if(!wm[i])wm[i]={cnt:0,ws:wkStart(i)};
  const sorted=Object.entries(wm).map(([k,v])=>({off:parseInt(k),...v})).sort((a,b)=>a.off-b.off);
  return sorted.map(({off,cnt,ws})=>{
    const we=addDays(ws,6);const wn=wkNum(ws);const cur=off===wkOff;
    const lbl=off===0?'📍 Tuần này':off===1?'▶ Tuần tới':off===-1?'◀ Tuần trước':`${off>0?'▶':'◀'} Tuần ${wn}/${ws.getFullYear()}`;
    return`<div class="witem${cur?' witem-cur':''}" onclick="goWk(${off})"><div><div class="witem-lbl">${lbl}</div><div class="witem-sub">Từ ${fmtVi(ws)} đến ${fmtVi(we)}</div></div>${cnt>0?`<span class="witem-cnt">${cnt} lịch</span>`:'<span style="font-size:11px;color:var(--muted)">Trống</span>'}</div>`;
  }).join('');
}
function openWkList(){
  document.getElementById('wkListBody').innerHTML=`<div class="wlist">${buildWkListHTML()}</div>`;
  document.getElementById('ovWkList').classList.add('open');
}
function refreshWkListIfOpen(){
  const ov=document.getElementById('ovWkList');
  if(ov&&ov.classList.contains('open')){
    document.getElementById('wkListBody').innerHTML=`<div class="wlist">${buildWkListHTML()}</div>`;
  }
}
function goWk(off){wkOff=off;closeWkList();wxData=null;wxFetchedAt=0;renderAll();}
function closeWkList(){document.getElementById('ovWkList').classList.remove('open');}
