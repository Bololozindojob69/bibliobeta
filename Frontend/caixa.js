/* BiblioBeta — Caixa de texto: títulos, autores etc. escritos TODOS EM MAIÚSCULAS
   passam a aparecer com só a primeira letra maiúscula (ex.: "ARISTÓTELES" -> "Aristóteles").
   Vale para o site inteiro, inclusive conteúdo carregado depois. Só muda a exibição, não o banco de dados.
   Siglas curtas (ISBN, PDF, CPF, RA...) são preservadas. Para proteger um trecho: data-manter-caixa. */
(function(){
  var SKIP={SCRIPT:1,STYLE:1,NOSCRIPT:1,TEXTAREA:1,INPUT:1,CODE:1,PRE:1,SVG:1};
  var reLower=/\p{Ll}/u, reLetter=/\p{L}/gu;

  function deveConverter(t){
    if(!t || reLower.test(t)) return false;           // já tem minúscula: está certo
    var letras=(t.match(reLetter)||[]).length;
    if(letras<4) return false;                         // siglas curtas / iniciais (BB, RA, TI)
    var palavras=t.split(/[^\p{L}]+/u).filter(function(p){return p.length>0;});
    if(palavras.length===1 && letras<5) return false; // ISBN, ISSN, ...
    return true;
  }
  function frase(t){
    var s=t.toLowerCase(), out='', cap=true;
    for(var i=0;i<s.length;i++){
      var c=s.charAt(i);
      if(cap && /\p{L}/u.test(c)){ c=c.toUpperCase(); cap=false; }
      else if(/[.!?]/.test(c) && /\s/.test(s.charAt(i+1)||' ')) cap=true;
      out+=c;
    }
    return out;
  }
  function protegido(el){
    for(var n=el; n && n.nodeType===1; n=n.parentElement){
      if(SKIP[n.tagName.toUpperCase()] || n.isContentEditable || n.hasAttribute('data-manter-caixa') || n.classList.contains('manter-caixa')) return true;
    }
    return false;
  }
  function tratarTexto(node){
    var v=node.nodeValue;
    if(!v || !v.trim()) return;
    var core=v.trim();
    if(!deveConverter(core)) return;
    if(protegido(node.parentElement)) return;
    var ini=v.indexOf(core), novo=v.slice(0,ini)+frase(core)+v.slice(ini+core.length);
    if(novo!==v) node.nodeValue=novo;
  }
  function varrer(raiz){
    if(!raiz) return;
    if(raiz.nodeType===3){ tratarTexto(raiz); return; }
    if(raiz.nodeType!==1 || SKIP[raiz.tagName.toUpperCase()]) return;
    var w=document.createTreeWalker(raiz,NodeFilter.SHOW_TEXT,null), n;
    while((n=w.nextNode())) tratarTexto(n);
  }
  var fila=[], agendado=false;
  function agendar(){
    if(agendado) return; agendado=true;
    requestAnimationFrame(function(){
      agendado=false; var l=fila; fila=[];
      for(var i=0;i<l.length;i++) varrer(l[i]);
    });
  }
  function iniciar(){
    varrer(document.body);
    new MutationObserver(function(ms){
      for(var i=0;i<ms.length;i++){
        var m=ms[i];
        if(m.type==='characterData') fila.push(m.target);
        else for(var j=0;j<m.addedNodes.length;j++) fila.push(m.addedNodes[j]);
      }
      if(fila.length) agendar();
    }).observe(document.body,{childList:true,subtree:true,characterData:true});
  }
  if(document.body) iniciar(); else addEventListener('DOMContentLoaded',iniciar);
})();
