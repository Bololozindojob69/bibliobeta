/* BiblioBeta — Tooltip moderno global.
   - Menu lateral recolhido: mostra o nome do item ao passar o mouse (ou focar com o teclado).
   - Qualquer elemento com title="..." ou data-tip="..." ganha a legenda bonita (o title nativo é suprimido).
   - Botões só com ícone (aria-label, sem texto) também ganham legenda.  */
(function(){
  if(!window.matchMedia || !matchMedia('(hover:hover)').matches) return;
  var tip=document.createElement('div');
  tip.className='bb-tip'; tip.setAttribute('role','tooltip'); tip.setAttribute('aria-hidden','true');
  var cur=null, timer=null;
  function add(){ if(!tip.parentNode) document.body.appendChild(tip); }
  if(document.body) add(); else addEventListener('DOMContentLoaded',add);

  var SEL='[data-tip],[title],.side-nav .radio-container label,.side-nav .side-foot a,.side-toggle,button[aria-label],a[aria-label]';

  function collapsed(){ return document.body.classList.contains('nav-collapsed'); }
  function cleanText(el){
    var c=el.cloneNode(true);
    var junk=c.querySelectorAll('[class*="badge"],svg,script,style');
    for(var i=0;i<junk.length;i++) junk[i].remove();
    return (c.textContent||'').replace(/\s+/g,' ').trim();
  }
  function textFor(el){
    if(el.hasAttribute('title')){ // move title -> data-tip (evita o balão nativo do navegador)
      var t=el.getAttribute('title'); el.removeAttribute('title');
      if(t){ el.setAttribute('data-tip',t); if(!el.getAttribute('aria-label') && !cleanText(el)) el.setAttribute('aria-label',t); }
    }
    var d=el.getAttribute('data-tip'); if(d) return d;
    if(el.closest('.side-nav') && el.closest('.side-nav') !== el && collapsed() && el.matches('label,a')) return cleanText(el);
    if(el.matches('.side-toggle')) return collapsed()?'Expandir menu':'Recolher menu';
    var a=el.getAttribute('aria-label');
    if(a && !cleanText(el)) return a;
    return '';
  }
  function pick(node){
    if(!node || !node.closest) return null;
    var el=node.closest(SEL), guard=0;
    while(el && guard++<5){ if(textFor(el)) return el; el=el.parentElement && el.parentElement.closest(SEL); }
    return null;
  }
  function place(el){
    var r=el.getBoundingClientRect(), tw=tip.offsetWidth, th=tip.offsetHeight, vw=innerWidth, vh=innerHeight, m=10, gap=12, x,y,side;
    if(el.closest('.side-nav')||el.matches('.side-toggle')){
      side='right'; x=r.right+gap; y=r.top+r.height/2-th/2;
    }else{
      side='top'; x=r.left+r.width/2-tw/2; y=r.top-th-gap;
      if(y<m){ side='bottom'; y=r.bottom+gap; }
    }
    var nx=Math.max(m,Math.min(x,vw-tw-m)); y=Math.max(m,Math.min(y,vh-th-m));
    if(side!=='right') tip.style.setProperty('--ax',(r.left+r.width/2-nx)+'px');
    tip.dataset.side=side; tip.style.left=nx+'px'; tip.style.top=y+'px';
  }
  function show(el){
    var t=textFor(el); if(!t) return;
    cur=el; tip.textContent=t; tip.classList.remove('on');
    tip.style.left='0px'; tip.style.top='0px';
    place(el);
    requestAnimationFrame(function(){ if(cur===el) tip.classList.add('on'); });
  }
  function hide(){ clearTimeout(timer); cur=null; tip.classList.remove('on'); }

  document.addEventListener('mouseover',function(e){
    var el=pick(e.target);
    if(el===cur) return;
    clearTimeout(timer);
    if(!el){ hide(); return; }
    var fast=tip.classList.contains('on'); // já tem uma aberta: troca na hora
    timer=setTimeout(function(){ show(el); }, fast?0:140);
  },true);
  document.addEventListener('mouseout',function(e){
    if(!cur && !timer) return;
    var to=e.relatedTarget;
    if(to && cur && cur.contains(to)) return;
    if(!to || !pick(to)) hide();
  },true);
  document.addEventListener('focusin',function(e){
    var n=e.target;
    if(n.matches && n.matches('.radio-container input') && n.id){
      var l=document.querySelector('label[for="'+n.id+'"]');
      if(l && l.matches(':focus-visible, *') && n.matches(':focus-visible')) n=l; else return;
    } else if(!(n.matches && n.matches(':focus-visible'))) return;
    var el=pick(n); if(el) show(el);
  });
  document.addEventListener('focusout',hide);
  document.addEventListener('mousedown',hide,true);
  document.addEventListener('keydown',function(e){ if(e.key==='Escape') hide(); });
  addEventListener('scroll',hide,true);
  addEventListener('resize',hide);
})();
