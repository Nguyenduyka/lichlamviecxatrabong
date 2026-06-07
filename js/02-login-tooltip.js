  (function(){
    var btn=document.getElementById('desktopLoginBtn');
    var tip=document.getElementById('loginBtnTip');
    if(btn&&tip){
      btn.addEventListener('mouseenter',function(){tip.style.opacity='1';});
      btn.addEventListener('mouseleave',function(){tip.style.opacity='0';});
    }
  })();
  
