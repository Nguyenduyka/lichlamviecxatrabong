var _lbScale=1;
var _lbTx=0, _lbTy=0;   // giữ vị trí pan hiện tại
var _lbMode='img';

// Áp transform nhất quán: luôn scale + translate cùng lúc
function _applyZoom(){
  var target=_lbMode==='pdf'
    ? document.getElementById('lbPdfPages')
    : document.getElementById('lbImg');
  if(target){
    if(_lbScale <= 1){
      target.style.transform='';
    } else {
      target.style.transformOrigin='center top';
      target.style.transform='scale('+_lbScale+') translate('+_lbTx+'px,'+_lbTy+'px)';
    }
    target.style.imageRendering=_lbScale>1.5?'pixelated':'auto';
  }
  var zl=document.getElementById('lbZoomLbl');
  if(zl) zl.textContent=Math.round(_lbScale*100)+'%';
}

// Zoom nút +/-
function lbZoom(dir){
  _lbScale=Math.max(.25,Math.min(6,_lbScale*(dir>0?1.3:1/1.3)));
  if(_lbScale<=1){_lbTx=0;_lbTy=0;}
  _applyZoom();
}

(function(){
  var bd   = document.getElementById('lboxBody');
  var wrap = document.getElementById('lbScrollWrap');

  // Click nền ngoài → đóng lightbox
  bd.addEventListener('click', function(e){
    if(e.target === bd || e.target === wrap) closeLb();
  });

  // Pinch state
  var _initD=0, _initS=1;
  var _isPinch=false;
  // Pan khi zoom state
  var _panStartX=0, _panStartY=0, _panStartTx=0, _panStartTy=0;
  var _isPan=false;
  // Cờ phân biệt pinch / di chuyển với chạm-gõ (tap) để không reset nhầm khi nhả pinch
  var _tapMoved=false;
  // Theo dõi trong CẢ lượt chạm (từ lúc đặt ngón đầu đến khi nhả hết): số ngón tối đa
  // và đã từng có gesture phóng to chưa. Dùng để biết chắc đây có phải tap đơn thuần không.
  var _seqMaxTouches=0, _seqHadGesture=false;

  // Ngăn pull-to-refresh khi lightbox mở (iOS/Android)
  document.addEventListener('touchmove', function(e){
    if(!document.getElementById('lbox').classList.contains('open')) return;
    // Chỉ block khi pinch hoặc zoom > 1 để không ảnh hưởng scroll PDF
    if(_isPinch || _lbScale > 1) e.preventDefault();
  }, {passive:false});

  wrap.addEventListener('touchstart', function(e){
    _seqMaxTouches = Math.max(_seqMaxTouches, e.touches.length);
    if(e.touches.length === 2){
      _isPinch = true; _isPan = false;
      _initD = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      _initS = _lbScale;
      e.preventDefault();
    } else if(e.touches.length === 1){
      _isPinch = false;
      _tapMoved = false;
      if(_lbScale > 1){
        _isPan = true;
        _panStartX  = e.touches[0].clientX;
        _panStartY  = e.touches[0].clientY;
        _panStartTx = _lbTx;
        _panStartTy = _lbTy;
        e.preventDefault(); // block native scroll khi đang zoom
      }
    }
  }, {passive:false});

  wrap.addEventListener('touchmove', function(e){
    if(_isPinch && e.touches.length === 2){
      var d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      _lbScale = Math.max(.5, Math.min(5, _initS * (d / _initD)));
      _applyZoom();
      e.preventDefault();
    } else if(_isPan && e.touches.length === 1 && _lbScale > 1){
      var dx = (e.touches[0].clientX - _panStartX) / _lbScale;
      var dy = (e.touches[0].clientY - _panStartY) / _lbScale;
      _lbTx = _panStartTx + dx;
      _lbTy = _panStartTy + dy;
      _tapMoved = true;
      _applyZoom();
      e.preventDefault();
    }
    // scale=1: để native scroll hoạt động bình thường (cuộn xem trang PDF)
  }, {passive:false});

  wrap.addEventListener('touchend', function(e){
    if(e.touches.length < 2) _isPinch = false;
    if(e.touches.length === 0) _isPan  = false;
    if(_lbScale <= 1){ _lbTx=0; _lbTy=0; _applyZoom(); }

    // Double-tap reset zoom — CHỈ tính khi cả lượt chạm vừa rồi là 1 ngón đơn thuần:
    // không lúc nào chạm 2 ngón, không có gesture phóng to (iOS), và không di chuyển.
    // Nhờ vậy, nhả tay sau khi phóng to (dù giữ yên bao lâu) KHÔNG bị hiểu nhầm là double-tap.
    if(e.touches.length === 0){
      var _cleanTap = (_seqMaxTouches <= 1) && !_seqHadGesture && !_tapMoved;
      if(_cleanTap){
        var now = Date.now();
        if(now - (wrap._lastTap||0) < 300){
          _lbScale=1; _lbTx=0; _lbTy=0; _applyZoom();
          wrap._lastTap = 0;
        } else {
          wrap._lastTap = now;
        }
      }
      // Reset cờ cho lượt chạm kế tiếp
      _seqMaxTouches = 0; _seqHadGesture = false; _tapMoved = false;
    }
  });

  // iOS Safari: gesture events (pinch-zoom native)
  var _gestureStartScale = 1;
  wrap.addEventListener('gesturestart', function(e){
    e.preventDefault();
    _gestureStartScale = _lbScale;
    _seqHadGesture = true;
  }, {passive:false});
  wrap.addEventListener('gesturechange', function(e){
    e.preventDefault();
    _seqHadGesture = true;
    _lbScale = Math.max(.5, Math.min(5, _gestureStartScale * e.scale));
    _applyZoom();
  }, {passive:false});
  wrap.addEventListener('gestureend', function(e){
    e.preventDefault();
    _seqHadGesture = true;
    if(_lbScale <= 1){ _lbTx=0; _lbTy=0; _applyZoom(); }
  }, {passive:false});
})();
var _lbPdfBlob=null;
function closeLb(){
  document.getElementById('lbox').classList.remove('open');
  _lbScale=1; _lbTx=0; _lbTy=0; _lbMode='img';
  var img=document.getElementById('lbImg');
  if(img){img.style.transform='';img.src='';img.style.display='block';}
  var pp=document.getElementById('lbPdfPages');
  if(pp){pp.innerHTML='';pp.style.display='none';pp.style.transform='';}
  var sw=document.getElementById('lbScrollWrap');
  if(sw) sw.scrollTop=0;
  var ld=document.getElementById('lbPdfLoading');if(ld)ld.style.display='none';
  var zl=document.getElementById('lbZoomLbl');if(zl)zl.textContent='100%';
  var ic=document.getElementById('lbImgCtrls');if(ic)ic.style.display='none';
  var pc=document.getElementById('lbPdfCtrls');if(pc)pc.style.display='none';
  _lbPdfBlob=null;
}
function lbDownload(){
  if(!_lbPdfBlob)return;
  var a=document.createElement('a');
  a.href=URL.createObjectURL(_lbPdfBlob.blob);
  a.download=_lbPdfBlob.name;
  a.click();
  setTimeout(function(){URL.revokeObjectURL(a.href);},5000);
}
async function lbShare(){
  if(!_lbPdfBlob)return;
  var file=new File([_lbPdfBlob.blob],_lbPdfBlob.name,{type:'application/pdf'});
  if(navigator.canShare&&navigator.canShare({files:[file]})){
    try{await navigator.share({files:[file],title:_lbPdfBlob.name});}catch(e){}
  }else{lbDownload();showToast('Thiết bị chưa hỗ trợ Share, đang tải xuống...');}
}
// Render PDF bằng PDF.js – song song tất cả trang, pinch-zoom, sắc nét
async function _renderPdfBlob(blob){
  if(typeof pdfjsLib==='undefined'){
    await new Promise(r=>_ensurePdf(r));
  }
  if(typeof pdfjsLib==='undefined'){
    var url=URL.createObjectURL(blob);
    window.open(url,'_blank');
    setTimeout(function(){URL.revokeObjectURL(url);},60000);
    return;
  }
  _lbMode='pdf';
  var ld=document.getElementById('lbPdfLoading');
  var pp=document.getElementById('lbPdfPages');
  var pl=document.getElementById('lbPdfPageLbl');
  if(ld){ld.style.display='flex';ld.style.flexDirection='column';ld.style.alignItems='center';}
  if(pp){pp.innerHTML='';pp.style.display='none';pp.style.transform='';}
  _lbScale=1;
  try{
    var ab=await blob.arrayBuffer();
    var pdf=await pdfjsLib.getDocument({
      data:ab,
      disableRange:false,
      disableStream:false,
      cMapUrl:'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
      cMapPacked:true,
    }).promise;
    var total=pdf.numPages;
    if(pl)pl.textContent=total+' trang';
    var lt=document.getElementById('lbPdfLoadTxt');
    if(lt)lt.textContent='Đang tải PDF ('+total+' trang)...';

    // dpr tối đa 3 trên màn hình retina để sắc nét hơn
    var dpr=Math.min(window.devicePixelRatio||1, 3);
    var maxW=window.innerWidth-8;

    // Tạo trước tất cả canvas placeholder
    var canvases=[];
    if(pp)pp.style.display='flex';
    for(var i=1;i<=total;i++){
      var c=document.createElement('canvas');
      c.style.cssText='display:block;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,.35);background:#f0f0f0;width:'+maxW+'px;height:'+Math.round(maxW*1.414)+'px';
      if(pp)pp.appendChild(c);
      canvases.push(c);
    }
    if(ld)ld.style.display='none';

    // Render song song: batch lớn hơn (5) cho máy mạnh, nhỏ hơn (2) cho máy yếu
    var ram=(navigator.deviceMemory||4);
    var batchSize=ram>=4?5:2;
    var done=0;
    for(var b=0;b<total;b+=batchSize){
      var batch=[];
      for(var j=b;j<Math.min(b+batchSize,total);j++){
        batch.push((function(idx){
          return pdf.getPage(idx+1).then(function(page){
            var vp0=page.getViewport({scale:1});
            var scale=(maxW/vp0.width)*dpr;
            var vp=page.getViewport({scale:scale});
            var canvas=canvases[idx];
            canvas.width=vp.width;
            canvas.height=vp.height;
            canvas.style.width=(vp.width/dpr)+'px';
            canvas.style.height=(vp.height/dpr)+'px';
            canvas.style.background='#fff';
            // intent:'display' để ưu tiên hiển thị nhanh
            return page.render({
              canvasContext:canvas.getContext('2d',{alpha:false}),
              viewport:vp,
              intent:'display'
            }).promise;
          }).then(function(){
            done++;
            if(pl)pl.textContent=done+'/'+total+' trang';
          });
        })(j));
      }
      await Promise.all(batch);
    }
    if(pl)pl.textContent=total+' trang';
  }catch(e){
    if(ld)ld.style.display='none';
    showToast('Không đọc được PDF, đang tải xuống...');
    lbDownload();
  }
}
