// Auto-hide fullscreen button — hiện khi di chuột/chạm, ẩn sau 3 giây
(function(){
  var _fsTimer=null;
  function showFsBtn(){
    var b1=document.getElementById('tvFullscreenBtn');
    var b2=document.getElementById('tvViewerExitBtn');
    if(b1)b1.style.opacity='1';
    if(b2)b2.style.opacity='1';
    clearTimeout(_fsTimer);
    _fsTimer=setTimeout(function(){
      if(b1)b1.style.opacity='0';
      if(b2)b2.style.opacity='0';
    },3000);
  }
  document.addEventListener('mousemove',showFsBtn,{passive:true});
  document.addEventListener('touchstart',showFsBtn,{passive:true});
  document.addEventListener('click',showFsBtn,{passive:true});
})();

function toggleFullscreen(){
  var btn=document.getElementById('tvFullscreenBtn');
  if(!document.fullscreenElement){
    document.documentElement.requestFullscreen().then(function(){
      if(btn){btn.innerHTML='✕ Thoát toàn màn hình';}
    }).catch(function(){});
  } else {
    document.exitFullscreen().then(function(){
      if(btn){btn.innerHTML='⛶ Toàn màn hình';}
    }).catch(function(){});
  }
}
document.addEventListener('fullscreenchange',function(){
  var btn=document.getElementById('tvFullscreenBtn');
  if(btn){btn.innerHTML=document.fullscreenElement?'✕ Thoát toàn màn hình':'⛶ Toàn màn hình';}
});
