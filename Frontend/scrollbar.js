/* BiblioBeta — barra de rolagem flutuante da página (sem trilho). */
(function(){
  var de=document.documentElement,wrap=document.createElement('div'),th=document.createElement('i'),hide,drag=null;
  wrap.className='bb-pagescroll';wrap.setAttribute('aria-hidden','true');wrap.appendChild(th);
  function ini(){document.body.appendChild(wrap);upd();}
  function upd(){
    var H=de.clientHeight,T=de.scrollHeight;
    if(T<=H+1){wrap.style.display='none';return;}
    wrap.style.display='';
    var h=Math.max(36,H*H/T),top=(de.scrollTop/(T-H))*(H-h);
    th.style.height=h+'px';th.style.top=top+'px';
  }
  function show(){wrap.classList.add('on');clearTimeout(hide);hide=setTimeout(function(){if(!drag)wrap.classList.remove('on');},1100);}
  addEventListener('scroll',function(){upd();show();},{passive:true});
  addEventListener('resize',upd);
  addEventListener('mousemove',function(e){if(e.clientX>innerWidth-40)show();},{passive:true});
  if(window.ResizeObserver)new ResizeObserver(upd).observe(de);
  setInterval(upd,1500);
  th.addEventListener('mousedown',function(e){
    drag={y:e.clientY,s:de.scrollTop};wrap.classList.add('drag','on');e.preventDefault();
  });
  addEventListener('mousemove',function(e){
    if(!drag)return;var H=de.clientHeight,T=de.scrollHeight,h=th.offsetHeight;
    de.scrollTop=drag.s+(e.clientY-drag.y)*(T-H)/(H-h);
  });
  addEventListener('mouseup',function(){if(drag){drag=null;wrap.classList.remove('drag');show();}});
  if(document.body)ini();else addEventListener('DOMContentLoaded',ini);
})();
