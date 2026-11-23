/* Gestão BiblioBeta — operações reais de empréstimos, devoluções, usuários e regras. */
(function(){
 const API=window.BiblioBetaAPI?.origin || window.location.origin; let token=localStorage.getItem('bibliobeta_token'); let usuario=JSON.parse(localStorage.getItem('bibliobeta_usuario')||'null');
 if(!token||!usuario||usuario.tipo!=='gestao'){location.href='Index.html';return;}
 const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
 const B = window.BiblioBetaBusca || {
  // Plano B simples caso o busca.js não carregue (a tela continua funcionando).
  bate: function (t) { const c = Array.prototype.slice.call(arguments, 1).join(' ').toLowerCase(); return !t || String(t).toLowerCase().split(/\s+/).every(function (p) { return c.indexOf(p) !== -1; }); },
  ligar: function (i, f) { if (i) i.addEventListener('input', function () { f(i.value); }); },
  tabelas: function () {}
  };
 // Nível da Gestão: 'admin' (tudo) ou 'bibliotecario' (rotina). Contas antigas contam como admin.
 // O servidor confere o nível a cada chamada; aqui só escondemos o que a pessoa não pode usar.
 const ehAdmin=String(usuario.perfil&&usuario.perfil.nivel_acesso||'').toLowerCase()!=='bibliotecario';
 if(!ehAdmin){const st=document.createElement('style');st.textContent='.somente-admin{display:none!important}';document.head.appendChild(st);}
 async function api(path,opt={}){opt.headers=Object.assign({'Authorization':'Bearer '+token,'Content-Type':'application/json'},opt.headers||{});const r=await (window.BiblioBetaAPI?.fetch ? window.BiblioBetaAPI.fetch(path,opt) : fetch(API+path,opt));let d=null;try{d=await r.json()}catch{}if(r.status===401){localStorage.clear();location.href='Index.html';throw new Error('Sessão expirada.')}if(!r.ok)throw new Error(d?.erro||'Erro na operação.');return d}
 // painel.js mantém a confirmação visual, mas ela fica dentro de outro escopo. Use-a quando disponível e tenha fallback para evitar que ações da Gestão parem por ReferenceError.
 const confirmarAcao=window.confirmarAcao || ((mensagem,titulo='Tem certeza?')=>Promise.resolve(window.confirm(titulo+'\n\n'+mensagem)));
 function iniciais(n){return String(n||'Gestão').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase()}
 function data(v){if(!v)return '-';return new Date(v).toLocaleDateString('pt-BR')}
 function status(v){return v==='atrasado'?'<span class="badge badge-atrasado">Atrasado</span>':v==='devolvido'?'<span class="badge badge-ativo">Devolvido</span>':'<span class="badge badge-ativo">Ativo</span>'}
 function pane(v){$$('.painel-pane').forEach(x=>x.classList.toggle('active',x.id==='pane-'+v));document.body.classList.toggle('fora-do-inicio',v!=='dashboard');}
 $$('.radio-container input[type=radio]').forEach(r=>r.addEventListener('change',()=>pane(r.value))); const checked=$('.radio-container input[type=radio]:checked');if(checked)pane(checked.value);
 $$('.radio-container label').forEach(l=>l.addEventListener('click',()=>setTimeout(()=>{if(matchMedia('(max-width:900px)').matches)$('#sideNav')?.classList.remove('open')},200)));
 // Abrir/fechar o menu lateral (botão logo + backdrop) já é controlado pelo painel.js;
 // um segundo listener aqui fazia o menu abrir e fechar sozinho a cada clique.
 $$('#userName').forEach(x=>x.textContent=usuario.nome||'Gestão'); $('#userAvatar')?.replaceChildren(document.createTextNode(iniciais(usuario.nome)));
 $$('[data-logout]').forEach(b=>b.addEventListener('click',async e=>{e.preventDefault();if(!await confirmarAcao('Você será desconectado desta conta. Deseja realmente sair?','Sair da conta?'))return;localStorage.clear();window.location.href='Index.html';}));
 document.addEventListener('click',e=>{const a=e.target.closest('[data-fecha-nav]');if(!a)return;e.preventDefault();const r=$('#nav-'+a.dataset.fechaNav);if(r){r.checked=true;r.dispatchEvent(new Event('change'))}if(matchMedia('(max-width:900px)').matches)$('#sideNav')?.classList.remove('open');if(a.dataset.rolar){setTimeout(()=>{const alvo=$(a.dataset.rolar);if(alvo)alvo.scrollIntoView({behavior:'smooth',block:'start'})},120)}});
 // Cards do painel inicial acessíveis pelo teclado (Enter/Espaço).
 document.addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const c=e.target.closest&&e.target.closest('.stat-clicavel');if(!c||e.target!==c)return;e.preventDefault();c.click()});
 const ICONE_ALERTA='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>';
 const ICONE_RELOGIO='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>';
 const ICONE_SINO='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>';
 const estadoAvisos={atrasados:0,solicitacoesPendentes:0,notificacoesNaoLidas:0,cadastrosPendentes:0};
 let emprestimosCache=[],solicitacoesCache=[];
 let filtroEmprestimoStatus='todos',filtroEmprestimoBusca='';
 let filtroSolicitacaoBusca='';
 function setTexto(id,val){const el=$(id);if(el)el.textContent=val}
 function atualizarAvisosDashboard(){const cont=$('#dashboardAvisos');if(!cont)return;const itens=[];const a=estadoAvisos;if(a.atrasados>0)itens.push({classe:'aviso-atrasado',icone:ICONE_ALERTA,titulo:a.atrasados+' empréstimo'+(a.atrasados>1?'s':'')+' atrasado'+(a.atrasados>1?'s':''),desc:'Alunos devem devolver os livros.',nav:'emprestimos'});if(a.solicitacoesPendentes>0)itens.push({classe:'aviso-pendente',icone:ICONE_RELOGIO,titulo:a.solicitacoesPendentes+' solicitaç'+(a.solicitacoesPendentes>1?'ões':'ão')+' pendente'+(a.solicitacoesPendentes>1?'s':''),desc:'Aguardando aprovação da Gestão.',nav:'emprestimos'});if(a.cadastrosPendentes>0)itens.push({classe:'aviso-pendente',icone:ICONE_RELOGIO,titulo:'Novos cadastros',desc:'Veja quem se cadastrou recentemente.',nav:'cadastros-pendentes'});if(a.notificacoesNaoLidas>0)itens.push({classe:'aviso-info',icone:ICONE_SINO,titulo:a.notificacoesNaoLidas+' notificaç'+(a.notificacoesNaoLidas>1?'ões':'ão')+' não lida'+(a.notificacoesNaoLidas>1?'s':''),desc:'Veja a central de notificações.',nav:'notificacoes'});cont.innerHTML=itens.length?'<ul class="avisos-lista">'+itens.map(i=>'<li class="aviso-item '+i.classe+'"><span class="aviso-dot">'+i.icone+'</span><div class="aviso-item-texto"><a href="#pane-'+i.nav+'" data-fecha-nav="'+i.nav+'"><strong>'+i.titulo+'</strong></a><span>'+i.desc+'</span></div></li>').join('')+'</ul>':'<p class="avisos-vazio">Nenhuma pendência no momento.</p>';const cardSol=$('#cardSolicitacoes');if(cardSol)cardSol.classList.toggle('painel-card-alerta',a.solicitacoesPendentes>0)}
 function renderDashboardUsuarios(us){const t=$('#dashboardUsuariosLista');if(!t)return;const recentes=us.filter(u=>u.tipo==='aluno'||u.tipo==='professor').slice(0,6);t.innerHTML=recentes.map(u=>'<tr><td><div class="avatar-row"><span class="avatar">'+iniciais(u.nome)+'</span>'+u.nome+'</div></td><td>'+u.tipo+'</td><td>'+u.email+'</td><td><span class="badge '+(u.status==='ativo'?'badge-ativo':'badge-pendente')+'">'+u.status+'</span></td></tr>').join('')||'<tr><td colspan="4">Nenhum usuário.</td></tr>'}
 const DIAS_SEMANA_ABREV=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
 function gerarUltimosDias(qtd){const arr=[];const hoje=new Date();hoje.setHours(0,0,0,0);for(let i=qtd-1;i>=0;i--){const d=new Date(hoje);d.setDate(d.getDate()-i);const iso=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');arr.push({data:iso,label:String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0'),dataLonga:DIAS_SEMANA_ABREV[d.getDay()]+', '+String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear(),total:0,livros:[]})}return arr}
 function renderGraficoBarrasReal(containerId,dias,comLivros){const cont=$('#'+containerId);if(!cont)return;const max=Math.max(1,...dias.map(d=>d.total));const hojeStr=(()=>{const h=new Date();return h.getFullYear()+'-'+String(h.getMonth()+1).padStart(2,'0')+'-'+String(h.getDate()).padStart(2,'0')})();
  const colsHtml=dias.map(d=>{const alturaPct=d.total?Math.max(8,Math.round((d.total/max)*100)):4;const ehMax=d.total>0&&d.total===max;const ehHoje=d.data===hojeStr;const livrosAttr=comLivros?escapar(d.livros&&d.livros.length?d.livros.join(', '):'Nenhum livro registrado'):'';
    return '<button type="button" class="cbr-col'+(ehMax?' cbr-col-max':'')+(ehHoje?' cbr-col-hoje':'')+'" data-total="'+d.total+'" data-data-longa="'+escapar(d.dataLonga)+'"'+(comLivros?' data-livros="'+livrosAttr+'"':'')+'>'
      +'<span class="cbr-valor">'+d.total+'</span>'
      +'<span class="cbr-bar-track"><span class="cbr-bar" style="height:'+alturaPct+'%"></span></span>'
      +'<span class="cbr-label">'+d.label+'</span>'
    +'</button>'}).join('');
  cont.innerHTML='<div class="cbr-linha">'+colsHtml+'</div><p class="cbr-detalhe">Passe o mouse ou toque em um dia para ver os detalhes.</p>';
  const detalhe=cont.querySelector('.cbr-detalhe');
  function mostrar(col){const total=col.dataset.total;const dataLonga=col.dataset.dataLonga;const livros=col.dataset.livros;let texto='<strong>'+dataLonga+':</strong> '+total+' empréstimo'+(total==='1'?'':'s');if(comLivros&&Number(total)>0)texto+=' — '+livros;detalhe.innerHTML=texto}
  cont.querySelectorAll('.cbr-col').forEach(col=>{col.addEventListener('mouseenter',()=>mostrar(col));col.addEventListener('focus',()=>mostrar(col));col.addEventListener('click',()=>mostrar(col))});
  const destaque=cont.querySelector('.cbr-col-hoje')||cont.querySelector('.cbr-col-max');
  if(destaque)mostrar(destaque)}
 function renderGraficoEmprestimosDashboard(lista){const cont=$('#dashboardGraficoEmprestimos');if(!cont)return;const dias=gerarUltimosDias(7);const porData={};dias.forEach(d=>porData[d.data]=d);lista.forEach(e=>{const iso=String(e.data_emprestimo||'').slice(0,10);const d=porData[iso];if(d){d.total++;if(e.titulo)d.livros.push(e.titulo)}});renderGraficoBarrasReal('dashboardGraficoEmprestimos',dias,true)}
 function renderLivrosTopDashboard(lista){const el=$('#dashboardLivrosTop');if(!el)return;const contagem={};lista.forEach(e=>{contagem[e.titulo]=(contagem[e.titulo]||0)+1});const top=Object.entries(contagem).sort((a,b)=>b[1]-a[1]).slice(0,5);el.innerHTML=top.map(([titulo,qtd])=>'<li><span class="ranking-titulo">'+titulo+'</span><span class="ranking-valor">'+qtd+'</span></li>').join('')||'<li>Nenhum empréstimo registrado.</li>'}
 function renderDashboardEmprestimos(lista){const t=$('#dashboardEmprestimosLista');if(!t)return;const recentes=[...lista].sort((x,y)=>new Date(y.data_emprestimo)-new Date(x.data_emprestimo)).slice(0,5);t.innerHTML=recentes.map(e=>'<tr><td><div class="avatar-row"><span class="avatar">'+iniciais(e.usuario)+'</span>'+e.usuario+'</div></td><td>'+e.titulo+'</td><td>'+data(e.data_emprestimo)+'</td><td>'+data(e.data_prevista_devolucao)+'</td><td>'+status(e.status)+'</td></tr>').join('')||'<tr><td colspan="5">Nenhum empréstimo registrado.</td></tr>'}
 function atualizarStatsEmprestimosDashboard(lista){const hoje=new Date().toISOString().slice(0,10);const hojeD=lista.filter(e=>e.status==='devolvido'&&String(e.data_devolucao||'').slice(0,10)===hoje).length;const atrasados=lista.filter(e=>e.status==='atrasado').length;setTexto('#statDevolucoesHoje',hojeD);setTexto('#statEmprestimosSub','Atrasados: '+atrasados+'.');estadoAvisos.atrasados=atrasados}
 async function carregarDashboard(){try{const d=await api('/api/dashboard');setTexto('#statLivros',d.livros);setTexto('#livrosTotalStat',d.livros);setTexto('#livrosDisponiveisStat',d.exemplares_disponiveis);setTexto('#livrosEmprestadosStat',d.exemplares_emprestados||0);setTexto('#statUsuarios',d.usuarios);setTexto('#statEmprestimos',d.emprestimos_ativos);setTexto('#statEmprestimosSub','Atrasados: '+d.atrasados+'.');estadoAvisos.atrasados=d.atrasados;atualizarAvisosDashboard()}catch(e){console.warn(e.message)}}
 // Leitores unificados: Alunos + Professores + Novos cadastros na mesma tela.
 let leitoresCache={us:[],al:[],rec:[]},filtroLeitor='todos';
 const DIAS_NOVO=7;
 function ehNovoLeitor(u){const t=new Date(u.criado_em).getTime();return !isNaN(t)&&(Date.now()-t)<=DIAS_NOVO*86400000}
 function renderCadastrosPendentes(lista){
  leitoresCache.rec=lista||[];
  estadoAvisos.cadastrosPendentes=0;
  atualizarAvisosDashboard();
  renderUsuarios();
 }
 async function carregarCadastrosPendentes(){try{const lista=await api('/api/cadastros-recentes');renderCadastrosPendentes(lista)}catch(e){console.warn('Cadastros pendentes:',e.message)}}
 async function carregarUsuarios(){const [us,al,rec]=await Promise.all([api('/api/usuarios'),api('/api/alunos'),api('/api/cadastros-recentes').catch(()=>leitoresCache.rec)]); leitoresCache.al=al;leitoresCache.rec=rec;renderUsuarios(us); preencherUsuarios(us.filter(u=>u.tipo==='aluno'||u.tipo==='professor'));renderDashboardUsuarios(us);const leitores=us.filter(u=>u.tipo==='aluno'||u.tipo==='professor');setTexto('#statUsuarios',leitores.length);setTexto('#statUsuariosSub','Ativos: '+leitores.filter(u=>u.status==='ativo').length+'.');setTexto('#alunosTotalStat',al.length);setTexto('#alunosAtivosStat',al.filter(a=>a.status==='ativo').length);setTexto('#alunosInativosStat',al.filter(a=>a.status==='inativo').length)}
 function renderUsuarios(us){
  const l=$('#usuarios-lista'),r=$('#usuarios-resumo');if(!l)return;
  if(us)leitoresCache.us=us;
  const leitores=leitoresCache.us.filter(u=>u.tipo==='aluno'||u.tipo==='professor');
  const alunoPorId=new Map(leitoresCache.al.map(a=>[a.id,a]));
  const recPorId=new Map(leitoresCache.rec.map(x=>[x.id,x]));
  const conta=f=>leitores.filter(f).length;
  const novos=conta(u=>ehNovoLeitor(u)&&u.status!=='inativo');
  const card=(n,t,d)=>'<article class="painel-card"><div class="stat">'+n+'</div><h3>'+t+'</h3><p>'+d+'</p></article>';
  r.innerHTML=card(leitores.length,'Total','Alunos e professores cadastrados.')+card(conta(u=>u.tipo==='aluno'),'Alunos','Leitores cadastrados.')+card(conta(u=>u.tipo==='professor'),'Professores','Leitores cadastrados.')+card(novos,'Novos','Cadastrados nos últimos '+DIAS_NOVO+' dias.')+card(conta(u=>u.status==='inativo'),'Inativos','Sem acesso. O histórico continua salvo.');
  // contador do menu lateral (antes ficava em "Novos cadastros")
  const b=$('#cadastrosPendentesBadge');if(b){b.textContent=novos;b.hidden=!novos}
  // contagem em cada filtro
  const rotulos={todos:['Todos',leitores.length],aluno:['Alunos',conta(u=>u.tipo==='aluno')],professor:['Professores',conta(u=>u.tipo==='professor')],novos:['Novos cadastros',novos],inativo:['Inativos',conta(u=>u.status==='inativo')]};
  $$('#leitoresFiltroChips [data-filtro-leitor]').forEach(c=>{const x=rotulos[c.dataset.filtroLeitor];if(x)c.textContent=x[0]+' ('+x[1]+')';c.classList.toggle('active',c.dataset.filtroLeitor===filtroLeitor)});
  const lista=leitores.filter(u=>filtroLeitor==='aluno'?u.tipo==='aluno':filtroLeitor==='professor'?u.tipo==='professor':filtroLeitor==='novos'?(ehNovoLeitor(u)&&u.status!=='inativo'):filtroLeitor==='inativo'?u.status==='inativo':true);
  const cont=$('#leitoresContagem');if(cont)cont.textContent=leitores.length?lista.length+' de '+leitores.length+' leitor'+(leitores.length===1?'':'es'):'';
  l.innerHTML=lista.map(u=>{
    const inativo=u.status==='inativo';
    let dados='—';
    if(u.tipo==='aluno'){const a=alunoPorId.get(u.id);if(a)dados=escapar((formatarSerie(a.serie)||'—')+(a.turma?' — Turma '+a.turma:''))}
    else{const x=recPorId.get(u.id);dados=escapar((x&&x.disciplina)||'—')}
    const badge=inativo?'<span class="badge badge-inativo">Inativo</span>':u.status==='ativo'?'<span class="badge badge-ativo">Ativo</span>':'<span class="badge badge-pendente">'+escapar(u.status)+'</span>';
    const novo=ehNovoLeitor(u)&&!inativo?'<span class="badge badge-novo">Novo</span>':'';
    return '<tr'+(inativo?' class="leitor-inativo"':'')+'><td><div class="avatar-row"><span class="avatar">'+iniciais(u.nome)+'</span>'+escapar(u.nome)+novo+'</div></td><td>'+(u.tipo==='aluno'?'Aluno':'Professor')+'</td><td>'+dados+'</td><td>'+escapar(u.email)+'</td><td>'+data(u.criado_em)+'</td><td>'+badge+'</td><td><button class="row-acao-btn" data-edit-user="'+u.id+'" data-nome="'+escapar(u.nome)+'" data-email="'+escapar(u.email)+'">Editar</button> <button class="row-acao-btn" data-toggle-user="'+u.id+'" data-status="'+u.status+'">'+(inativo?'Reativar':'Inativar')+'</button></td></tr>';
  }).join('')||'<tr><td colspan="7">'+(leitores.length?'Nenhum leitor neste filtro.':'Nenhum leitor cadastrado.')+'</td></tr>';
 }
 $('#leitoresFiltroChips')?.addEventListener('click',e=>{const b=e.target.closest('[data-filtro-leitor]');if(!b)return;filtroLeitor=b.dataset.filtroLeitor;renderUsuarios()});
 function formatarSerie(v){const x=String(v??'').trim();if(/^\d+$/.test(x)){return x+'º ano';}return x.replace(/\b(\d+)\s*[º°]?\s*(ano|Ano)\b/g,'$1º ano');}
 function escapar(v){return String(v??'').replace(/[&<>\"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[m]))}
 // Busca nas turmas: mesma lógica das outras barras (uma letra, começo de palavra e, se nada, qualquer parte).
 function aplicarBuscaTurmas(){
  const campo=$('#buscaTurmas');if(!campo)return;
  const termo=campo.value,cards=[...$$('#turmas-lista .turma-card')],aviso=$('#buscaTurmasVazio');
  const passo=regra=>{let n=0;cards.forEach(c=>{
   const titulo=(c.querySelector('h3')||{}).textContent||'';
   const casaTitulo=!!termo.trim()&&regra(termo,titulo);
   let vis=0;
   c.querySelectorAll('.turma-alunos .avatar-row').forEach(l=>{const nome=((l.querySelector('span:not(.avatar)')||l).textContent||'');const ok=!termo.trim()||casaTitulo||regra(termo,nome);l.style.display=ok?'':'none';if(ok)vis++});
   const esconde=!!termo.trim()&&vis===0&&!casaTitulo;c.style.display=esconde?'none':'';if(!esconde)n++});return n};
  let n=passo(B.bate);
  if(!n&&termo.trim()&&B.bateAmplo&&termo.trim().length>1)n=passo(B.bateAmplo);
  if(aviso)aviso.hidden=!(termo.trim()&&cards.length&&!n);
 }
 B.ligar($('#buscaTurmas'),aplicarBuscaTurmas);
 async function carregarTurmas(){
  const cont=$('#turmas-lista');
  if(!cont)return;
  try{
   const alunos=await api('/api/alunos');
   const grupos={};
   alunos.forEach(a=>{
    const serie=String(a.serie||'Sem série').trim()||'Sem série';
    const turma=String(a.turma||'Sem turma').trim()||'Sem turma';
    const chave=serie+' — Turma '+turma;
    if(!grupos[chave])grupos[chave]={serie,turma,alunos:[]};
    grupos[chave].alunos.push(a);
   });
   const lista=Object.values(grupos).sort((a,b)=>(a.serie+' '+a.turma).localeCompare(b.serie+' '+b.turma,'pt-BR'));
   if(!lista.length){cont.innerHTML='<article class="painel-card"><p>Nenhuma turma encontrada. Cadastre alunos com série e turma.</p></article>';return;}
   cont.innerHTML=lista.map(g=>`<article class="painel-card turma-card"><div class="painel-card-head"><div><h3>${escapar(formatarSerie(g.serie))} — Turma ${escapar(g.turma)}</h3><p>${g.alunos.length} aluno${g.alunos.length===1?'':'s'} cadastrado${g.alunos.length===1?'':'s'}.</p></div><div class="stat">${g.alunos.length}</div></div><div class="turma-alunos">${g.alunos.sort((a,b)=>String(a.nome).localeCompare(String(b.nome),'pt-BR')).map(a=>`<div class="avatar-row"><span class="avatar">${iniciais(a.nome)}</span><span>${escapar(a.nome)}</span></div>`).join('')}</div></article>`).join('');aplicarBuscaTurmas();
  }catch(e){console.error('Erro ao carregar turmas:',e);cont.innerHTML='<article class="painel-card"><p>Não foi possível carregar as turmas. Verifique se o backend está funcionando e tente novamente.</p></article>';}
 }
 function preencherUsuarios(us){const s=$('#emprestimoUsuario');if(!s)return;const sel=s.value;const ordenados=[...us].sort((a,b)=>String(a.nome).localeCompare(String(b.nome),'pt-BR'));s.innerHTML='<option value="">Selecione o usuário</option>'+ordenados.map(u=>'<option value="'+u.id+'">'+u.nome+' — '+u.email+'</option>').join('');if(sel&&[...s.options].some(o=>o.value===sel))s.value=sel}
 async function carregarExemplares(){const ex=await api('/api/exemplares/disponiveis');const s=$('#emprestimoExemplar');const selEx=s?s.value:'';const ordenados=[...ex].sort((a,b)=>String(a.titulo).localeCompare(String(b.titulo),'pt-BR'));if(s)s.innerHTML='<option value="">Selecione o exemplar</option>'+ordenados.map(e=>'<option value="'+e.id+'">'+e.titulo+' — '+e.codigo+(e.isbn?' · ISBN '+e.isbn:'')+'</option>').join('')||'<option value="">Nenhum exemplar disponível</option>';if(s&&selEx&&[...s.options].some(o=>o.value===selEx))s.value=selEx;setTexto('#statLivrosSub','Disponíveis: '+ex.length+'.');setTexto('#livrosDisponiveisStat',ex.length);setTexto('#exemplaresDisponiveisInfo',ex.length?ex.length+' exemplar'+(ex.length===1?'':'es')+' disponível'+(ex.length===1?'':'is')+' no momento.':'Nenhum exemplar disponível no momento.')}
 function atualizarStatsCardsEmprestimos(lista){const st=$('#emprestimosStats');if(!st)return;const ab=lista.filter(e=>e.status!=='devolvido').length,at=lista.filter(e=>e.status==='atrasado').length;const hoje=new Date().toISOString().slice(0,10),dev=lista.filter(e=>e.data_devolucao&&String(e.data_devolucao).slice(0,10)===hoje).length;const ativo=v=>filtroEmprestimoStatus===v?' stat-ativo':'';st.innerHTML='<article class="painel-card stat-card stat-filtravel'+ativo('aberto')+'" data-filtro-emprestimo="aberto"><div><div class="stat">'+ab+'</div><h3>Em aberto</h3><p>Empréstimos não devolvidos.</p></div></article><article class="painel-card stat-card stat-filtravel'+ativo('atrasado')+'" data-filtro-emprestimo="atrasado"><div><div class="stat">'+at+'</div><h3>Atrasados</h3><p>Prazo de devolução vencido.</p></div></article><article class="painel-card stat-card stat-filtravel'+ativo('devolvido-hoje')+'" data-filtro-emprestimo="devolvido-hoje"><div><div class="stat">'+dev+'</div><h3>Devolvidos hoje</h3><p>Devoluções registradas hoje.</p></div></article>'}
 function ordenarEmprestimos(lista){const abertos=lista.filter(e=>e.status!=='devolvido').sort((a,b)=>new Date(a.data_prevista_devolucao)-new Date(b.data_prevista_devolucao));const devolvidos=lista.filter(e=>e.status==='devolvido').sort((a,b)=>new Date(b.data_devolucao)-new Date(a.data_devolucao));return abertos.concat(devolvidos)}
 function renderLinhasEmprestimos(lista){const tbody=$('#emprestimosGestaoLista');if(!tbody)return;tbody.innerHTML=lista.map(e=>{const avisoDev=Number(e.aviso_devolucao)&&e.status!=='devolvido';const aguardando=!Number(e.retirada_confirmada)&&e.status!=='devolvido';const classes=[];if(e.status==='atrasado')classes.push('linha-atrasada');else if(avisoDev)classes.push('linha-aviso');else if(aguardando)classes.push('linha-retirada');const statusTexto=aguardando?'<span class="badge badge-pendente">Aguardando retirada</span>':status(e.status);const acao=e.status==='devolvido'?'—':aguardando?'<button class="row-acao-btn" data-confirmar-retirada="'+e.id+'">Confirmar retirada</button>':(avisoDev?'<button class="row-acao-btn" data-devolver="'+e.id+'">Confirmar devolução</button>':'<span class="status-pendente">Aguardando aviso do usuário</span>');return '<tr'+(classes.length?' class="'+classes.join(' ')+'"':'')+'><td>'+e.usuario+'</td><td>'+e.titulo+(aguardando?' <span class="badge badge-pendente">Código de retirada</span>':(avisoDev?' <span class="badge badge-pendente">Aviso de devolução</span>':''))+'</td><td>'+e.codigo+'</td><td>'+data(e.data_emprestimo)+'</td><td>'+data(e.data_prevista_devolucao)+'</td><td>'+statusTexto+'</td><td>'+acao+'</td></tr>'}).join('')||'<tr><td colspan="7">'+((filtroEmprestimoBusca||filtroEmprestimoStatus!=='todos')?'Nenhum empréstimo encontrado com esse filtro.':'Nenhum empréstimo.')+'</td></tr>'}
 function aplicarFiltroEmprestimos(){const hoje=new Date().toISOString().slice(0,10);let lista=[...emprestimosCache];if(filtroEmprestimoStatus==='aberto')lista=lista.filter(e=>e.status!=='devolvido');else if(filtroEmprestimoStatus==='atrasado')lista=lista.filter(e=>e.status==='atrasado');else if(filtroEmprestimoStatus==='devolvido')lista=lista.filter(e=>e.status==='devolvido');else if(filtroEmprestimoStatus==='devolvido-hoje')lista=lista.filter(e=>e.status==='devolvido'&&String(e.data_devolucao||'').slice(0,10)===hoje);if(filtroEmprestimoBusca.trim())lista=B.filtrar?B.filtrar(lista,filtroEmprestimoBusca,e=>[e.usuario,e.titulo,e.codigo]):lista.filter(e=>B.bate(filtroEmprestimoBusca,e.usuario,e.titulo,e.codigo));lista=ordenarEmprestimos(lista);renderLinhasEmprestimos(lista);const cont=$('#emprestimosContagem');if(cont)cont.textContent=emprestimosCache.length?lista.length+' de '+emprestimosCache.length+' empréstimo'+(emprestimosCache.length===1?'':'s'):''}
 function setFiltroEmprestimo(v){filtroEmprestimoStatus=v;$$('#emprestimosFiltroChips .chip').forEach(c=>c.classList.toggle('active',c.dataset.filtroEmprestimo===v));atualizarStatsCardsEmprestimos(emprestimosCache);aplicarFiltroEmprestimos()}
 function renderEmprestimos(lista){emprestimosCache=lista;atualizarStatsCardsEmprestimos(lista);aplicarFiltroEmprestimos()}
 B.ligar($('#buscaEmprestimos'),v=>{filtroEmprestimoBusca=v;aplicarFiltroEmprestimos()});
 async function carregarNotificacoes(){try{const lista=await api('/api/notificacoes');window.__bibliobetaNotificacoes=lista;renderNotificacoes(lista);const n=lista.filter(x=>!Number(x.lida)).length;const badge=$('#gestaoNotifBadge');if(badge){badge.textContent=n;badge.hidden=n===0}const topBadge=$('#bellBadge');if(topBadge){topBadge.textContent=n;topBadge.hidden=n===0}const top=$('#topbarNotifLista');if(top){const novas=lista.filter(x=>!Number(x.lida)).slice(0,5);top.innerHTML=(novas.map(n=>'<li class="topbar-notif-item" data-notif-id="'+n.id+'" role="button" tabindex="0"><strong>'+escapar(n.titulo)+'</strong><span>'+escapar(n.mensagem)+'</span><small>Ver notificação</small></li>').join('')||'<li class="notif-vazio">Nenhuma notificação nova.</li>')+'<li class="topbar-notif-ver-todas"><a href="#pane-notificacoes" data-fecha-nav="notificacoes">Ver todas as notificações</a></li>';}estadoAvisos.notificacoesNaoLidas=n;atualizarAvisosDashboard()}catch(e){console.warn(e.message)}}
 function renderNotificacoes(lista){const t=$('#notificacoesGestaoLista');if(!t)return;t.innerHTML=lista.map(n=>{const lida=Number(n.lida);return '<li class="bb-notif notificacao-row-clicavel'+(lida?' bb-notif--lida':'')+'" data-notif-row="'+n.id+'"><div class="bb-notif__icone" aria-hidden="true">🔔</div><div class="bb-notif__corpo"><h3 class="bb-notif__titulo">'+escapar(n.titulo)+'</h3><p class="bb-notif__msg">'+escapar(n.mensagem)+'</p><p class="bb-notif__meta">'+data(n.criado_em)+'</p></div><div class="bb-notif__acoes">'+(lida?'<span class="badge badge-ativo">Lida</span>':'<span class="badge badge-pendente">Nova</span>')+'<button class="row-acao-btn" data-ver-notificacao="'+n.id+'">Ver mensagem</button>'+(lida?'':'<button class="row-acao-btn" data-ler-notificacao="'+n.id+'">Marcar como lida</button>')+'</div></li>'}).join('')||'<li class="empty-msg">Nenhuma notificação.</li>'}
 function abrirNotificacaoModal(n){const modal=$('#notificacaoModal');if(!modal)return;$('#notificacaoModalTitulo').textContent=n?.titulo||'Notificação';$('#notificacaoModalMensagem').textContent=n?.mensagem||'Sem mensagem.';$('#notificacaoModalData').textContent=n?.criado_em?'Recebida em '+new Date(n.criado_em).toLocaleString('pt-BR'):'';$('#notificacaoModalStatus').textContent=Number(n?.lida)?'Lida':'Nova';$('#notificacaoModalTipo').textContent=n?.tipo||'Notificação';modal.hidden=false;modal.setAttribute('aria-hidden','false');document.body.classList.add('notificacao-modal-aberta')}
 function fecharNotificacaoModal(){const modal=$('#notificacaoModal');if(!modal)return;modal.hidden=true;modal.setAttribute('aria-hidden','true');document.body.classList.remove('notificacao-modal-aberta')}
 function buscarNotificacaoPorId(id){return (window.__bibliobetaNotificacoes||[]).find(n=>String(n.id)===String(id))||null}

 async function carregarSolicitacoes(){try{const lista=await api('/api/solicitacoes-emprestimo');renderSolicitacoes(lista);const pend=lista.filter(s=>s.status==='pendente').length;setTexto('#statSolicitacoes',pend);estadoAvisos.solicitacoesPendentes=pend;atualizarAvisosDashboard()}catch(e){console.warn(e.message)}}
 function renderLinhasSolicitacoes(pend){const t=$('#solicitacoesGestaoLista');if(!t)return;t.innerHTML=pend.map(s=>'<tr><td><div class="avatar-row"><span class="avatar">'+iniciais(s.usuario)+'</span>'+s.usuario+'</div></td><td>'+s.titulo+'</td><td>'+data(s.data_desejada)+'</td><td>'+data(s.data_solicitacao)+'</td><td>'+(s.disponiveis>0?'<span class="badge badge-ativo">Disponível</span>':'<span class="badge badge-pendente">Sem exemplar</span>')+'</td><td><button class="row-acao-btn" data-aprovar-solicitacao="'+s.id+'" '+(s.disponiveis>0?'':'disabled')+'>Aprovar</button> <button class="row-acao-btn" data-recusar-solicitacao="'+s.id+'">Recusar</button></td></tr>').join('')||'<tr><td colspan="6">'+(filtroSolicitacaoBusca?'Nenhuma solicitação encontrada com esse filtro.':'Nenhuma solicitação pendente.')+'</td></tr>'}
 function aplicarFiltroSolicitacoes(){let pend=solicitacoesCache.filter(s=>s.status==='pendente');if(filtroSolicitacaoBusca.trim())pend=B.filtrar?B.filtrar(pend,filtroSolicitacaoBusca,s=>[s.usuario,s.titulo]):pend.filter(s=>B.bate(filtroSolicitacaoBusca,s.usuario,s.titulo));renderLinhasSolicitacoes(pend);const cont=$('#solicitacoesContagem');if(cont)cont.textContent=pend.length?pend.length+' pendente'+(pend.length===1?'':'s'):''}
 function renderSolicitacoes(lista){solicitacoesCache=lista;aplicarFiltroSolicitacoes()}
 B.ligar($('#buscaSolicitacoes'),v=>{filtroSolicitacaoBusca=v;aplicarFiltroSolicitacoes()});
 async function carregarEmprestimos(){const lista=await api('/api/emprestimos');renderCobranca(lista);setTexto('#livrosEmprestadosStat',lista.filter(e=>e.status!=='devolvido').length);renderEmprestimos(lista);renderDevolucoes(lista);renderDashboardEmprestimos(lista);atualizarStatsEmprestimosDashboard(lista);renderGraficoEmprestimosDashboard(lista);renderLivrosTopDashboard(lista);atualizarAvisosDashboard()}
 function renderDevolucoes(lista){const t=$('#devolucoesLista');if(!t)return;const hoje=new Date().toISOString().slice(0,10), atras=lista.filter(e=>e.status==='atrasado').length, hojeD=lista.filter(e=>e.status==='devolvido'&&String(e.data_devolucao||'').slice(0,10)===hoje).length, proximas=lista.filter(e=>e.status!=='devolvido'&&new Date(e.data_prevista_devolucao)-Date.now()<3*86400000&&new Date(e.data_prevista_devolucao)>=new Date()).length;const st=$('#devolucoesStats');if(st)st.innerHTML='<article class="painel-card"><div class="stat">'+hojeD+'</div><h3>Devolvidas hoje</h3><p>Livros retornados.</p></article><article class="painel-card"><div class="stat">'+atras+'</div><h3>Atrasadas</h3><p>Empréstimos pendentes.</p></article><article class="painel-card"><div class="stat">'+proximas+'</div><h3>Próximas</h3><p>Vencem em até 3 dias.</p></article>';const avisadas=lista.filter(e=>Number(e.aviso_devolucao)&&e.status!=='devolvido');const av=$('#devolucoesAvisadasLista');if(av){av.innerHTML=avisadas.map(e=>'<tr class="linha-aviso"><td>'+escapar(e.usuario)+'</td><td>'+escapar(e.titulo)+'</td><td><code>'+escapar(e.codigo_devolucao||'—')+'</code></td><td>'+data(e.data_prevista_devolucao)+'</td><td><button class="row-acao-btn" data-devolver="'+e.id+'">Confirmar devolução</button></td></tr>').join('')||'<tr><td colspan="5">Nenhuma devolução avisada.</td></tr>';const c=$('#devolucoesAvisadasContagem');if(c)c.textContent=avisadas.length?avisadas.length+' pendente'+(avisadas.length===1?'':'s'):''}t.innerHTML=lista.filter(e=>e.status==='devolvido').map(e=>'<tr><td>'+escapar(e.usuario)+'</td><td>'+escapar(e.titulo)+'</td><td>'+data(e.data_devolucao)+'</td><td>'+data(e.data_prevista_devolucao)+'</td><td>'+status(e.status)+'</td></tr>').join('')||'<tr><td colspan="5">Nenhuma devolução registrada.</td></tr>'}
 $('#formNovoEmprestimo')?.addEventListener('submit',async e=>{e.preventDefault();const msg=$('#emprestimoMensagem');const btn=$('#btnConfirmarEmprestimo');msg.className='form-msg';msg.textContent='';if(btn){btn.disabled=true;btn.textContent='Registrando...'}try{await api('/api/emprestimos',{method:'POST',body:JSON.stringify({usuario_id:Number($('#emprestimoUsuario').value),exemplar_id:Number($('#emprestimoExemplar').value)})});msg.classList.add('sucesso');msg.textContent='Empréstimo registrado. O usuário foi notificado no sistema e, se o e-mail estiver configurado, também por e-mail.';e.target.reset();await carregarExemplares();await carregarEmprestimos();await carregarDashboard()}catch(err){msg.classList.add('erro');msg.textContent=err.message}finally{if(btn){btn.disabled=false;btn.textContent='Confirmar empréstimo'}}});
 document.addEventListener('click',async e=>{
  const editUser=e.target.closest('[data-edit-user]');if(editUser){const nome=prompt('Nome completo:',editUser.dataset.nome||'');if(nome===null)return;const emailNovo=prompt('E-mail:',editUser.dataset.email||'');if(emailNovo===null)return;try{await api('/api/usuarios/'+editUser.dataset.editUser,{method:'PUT',body:JSON.stringify({nome,email:emailNovo})});await carregarUsuarios()}catch(err){alert(err.message)}return;}
  const resetUser=e.target.closest('[data-reset-user]');if(resetUser){const senha=prompt('Nova senha (mínimo 8, maiúscula, minúscula, número e símbolo):');if(senha===null)return;try{await api('/api/usuarios/'+resetUser.dataset.resetUser+'/senha',{method:'PUT',body:JSON.stringify({senha})});alert('Senha redefinida com sucesso.')}catch(err){alert(err.message)}return;}
  const novaTurma=e.target.closest('#btnNovaTurma');if(novaTurma){const nome=prompt('Nome da turma:');if(!nome)return;const ano=prompt('Ano/série (opcional):')||'';const etapa=prompt('Etapa (opcional):')||'';try{await api('/api/turmas',{method:'POST',body:JSON.stringify({nome,ano,etapa})});await carregarTurmas()}catch(err){alert(err.message)}return;}
  const editTurma=e.target.closest('[data-edit-turma]');if(editTurma){const nome=prompt('Novo nome da turma:');if(nome===null)return;const ano=prompt('Ano/série (opcional):')||'';const etapa=prompt('Etapa (opcional):')||'';const statusNovo=confirm('Turma ativa? OK = ativa / Cancelar = inativa');try{await api('/api/turmas/'+editTurma.dataset.editTurma,{method:'PUT',body:JSON.stringify({nome,ano,etapa,status:statusNovo?'ativo':'inativo'})});await carregarTurmas();await carregarUsuarios()}catch(err){alert(err.message)}return;}
  const delTurma=e.target.closest('[data-del-turma]');if(delTurma){if(!await confirmarAcao('A turma será desativada e deixará de aparecer como ativa. Deseja continuar?','Desativar turma?'))return;try{await api('/api/turmas/'+delTurma.dataset.delTurma,{method:'DELETE'});await carregarTurmas()}catch(err){alert(err.message)}return;}
  const newLoc=e.target.closest('#btnNovaLocalizacao');if(newLoc){const nome=prompt('Nome da localização:');if(!nome)return;const descricao=prompt('Descrição (opcional):')||'';try{await api('/api/localizacoes',{method:'POST',body:JSON.stringify({nome,descricao})});await carregarAcervoAdmin()}catch(err){alert(err.message)}return;}
  const editLoc=e.target.closest('[data-edit-loc]');if(editLoc){const nome=prompt('Novo nome da localização:');if(nome===null)return;const descricao=prompt('Descrição (opcional):')||'';try{await api('/api/localizacoes/'+editLoc.dataset.editLoc,{method:'PUT',body:JSON.stringify({nome,descricao})});await carregarAcervoAdmin()}catch(err){alert(err.message)}return;}
  const delLoc=e.target.closest('[data-del-loc]');if(delLoc){if(!await confirmarAcao('A localização será excluída do cadastro. Deseja continuar?','Excluir localização?'))return;try{await api('/api/localizacoes/'+delLoc.dataset.delLoc,{method:'DELETE'});await carregarAcervoAdmin()}catch(err){alert(err.message)}return;}
  const userBtn=e.target.closest('[data-toggle-user]');if(userBtn){const novo=userBtn.dataset.status==='ativo'?'inativo':'ativo';if(!confirm((novo==='inativo'?'Inativar':'Reativar')+' este leitor? '+(novo==='inativo'?'Ele deixa de acessar o sistema, mas o histórico continua salvo.':'Ele volta a acessar o sistema.')))return;try{await api('/api/usuarios/'+userBtn.dataset.toggleUser+'/status',{method:'PUT',body:JSON.stringify({status:novo})});await carregarUsuarios()}catch(err){alert(err.message)}return;}
  const delUser=e.target.closest('[data-del-user]');if(delUser){const nome=delUser.dataset.nome||'este usuário';if(!await confirmarAcao('"'+nome+'" será excluído(a) de forma permanente, junto com o histórico de empréstimos e as reservas. Essa ação não pode ser desfeita.','Excluir usuário?'))return;try{await api('/api/usuarios/'+delUser.dataset.delUser,{method:'DELETE'});await carregarUsuarios();await carregarCadastrosPendentes();try{await carregarTurmas()}catch(_){}}catch(err){alert(err.message)}return;}
  const eqBtn=e.target.closest('[data-equipe-status]');if(eqBtn){const novo=eqBtn.dataset.status;const msg=novo==='ativo'?'Liberar o acesso desta pessoa à Gestão?':(eqBtn.textContent.trim()==='Recusar'?'Recusar este pedido de acesso?':'Desativar o acesso desta pessoa à Gestão?');if(!confirm(msg))return;try{await api('/api/equipe-gestao/'+eqBtn.dataset.equipeStatus,{method:'PUT',body:JSON.stringify({status:novo})});await carregarEquipe()}catch(err){alert(err.message);await carregarEquipe()}return;}
  const reservaBtn=e.target.closest('[data-reserva-status]');if(reservaBtn){try{await api('/api/reservas/'+reservaBtn.dataset.reservaStatus+'/status',{method:'PUT',body:JSON.stringify({status:reservaBtn.dataset.status})});await carregarReservas()}catch(err){alert(err.message)}return;}
  const punir=e.target.closest('[data-aplicar-punicao]');if(punir){const card=punir.closest('[data-multa-card]');const op=card.querySelector('input[type=radio]:checked');if(!op){alert('Escolha uma punição.');return}const v=op.value;const nome=card.dataset.nome||'esta pessoa';const msg={advertencia:'Advertência para '+nome+'. Ela continua podendo pedir livros.','3':'Bloquear novos empréstimos de '+nome+' por 3 dias.','7':'Bloquear novos empréstimos de '+nome+' por 7 dias.','15':'Bloquear novos empréstimos de '+nome+' por 15 dias.',regularizacao:'Bloquear novos empréstimos de '+nome+' até ela devolver o livro em atraso.',dispensar:'Dispensar '+nome+' sem nenhuma punição por este atraso.'}[v];if(!await confirmarAcao(msg+' A pessoa será avisada.','Aplicar punição?'))return;const corpo={usuario_id:Number(card.dataset.usuario),emprestimo_id:Number(card.dataset.emprestimo),descricao:(card.querySelector('.mx-obs')?.value||'').trim()};if(v==='advertencia'||v==='regularizacao'||v==='dispensar')corpo.tipo=v;else{corpo.tipo='bloqueio';corpo.dias_bloqueio=Number(v)}punir.disabled=true;try{await api('/api/penalidades',{method:'POST',body:JSON.stringify(corpo)});await carregarMultas();try{await carregarNotificacoes()}catch(_){}}catch(err){punir.disabled=false;alert(err.message)}return;}
  const avisarPen=e.target.closest('[data-avisar-pen]');if(avisarPen){avisarPen.disabled=true;const antes=avisarPen.textContent;avisarPen.textContent='Enviando...';try{const d=await api('/api/penalidades/'+avisarPen.dataset.avisarPen+'/avisar',{method:'POST'});alert(d.mensagem||'Aviso enviado.')}catch(err){alert(err.message)}avisarPen.disabled=false;avisarPen.textContent=antes;return;}
  const encerrar=e.target.closest('[data-encerrar-pen]');if(encerrar){if(!await confirmarAcao('A punição será encerrada e a pessoa poderá pedir livros de novo.','Encerrar punição?'))return;encerrar.disabled=true;try{await api('/api/penalidades/'+encerrar.dataset.encerrarPen+'/status',{method:'PUT',body:JSON.stringify({status:'cancelada'})});await carregarMultas()}catch(err){encerrar.disabled=false;alert(err.message)}return;}
  const multaBtn=e.target.closest('[data-multa-status]');if(multaBtn){if(!confirm(multaBtn.dataset.status==='paga'?'Confirmar pagamento da multa?':'Cancelar esta multa?'))return;try{await api('/api/multas/'+multaBtn.dataset.multaStatus+'/status',{method:'PUT',body:JSON.stringify({status:multaBtn.dataset.status})});await carregarMultas()}catch(err){alert(err.message)}return;}
  const novaCat=e.target.closest('#btnNovaCategoria');if(novaCat){const nome=prompt('Nome da categoria:');if(!nome)return;const descricao=prompt('Descrição (opcional):')||'';try{await api('/api/categorias',{method:'POST',body:JSON.stringify({nome,descricao})});await carregarAcervoAdmin();window.dispatchEvent(new Event('bibliobeta:categorias-atualizadas'))}catch(err){alert(err.message)}return;}
  const editCat=e.target.closest('[data-edit-cat]');if(editCat){const atual=prompt('Novo nome da categoria:');if(!atual)return;const descricao=prompt('Nova descrição (opcional):')||'';try{await api('/api/categorias/'+editCat.dataset.editCat,{method:'PUT',body:JSON.stringify({nome:atual,descricao})});await carregarAcervoAdmin()}catch(err){alert(err.message)}return;}
  const delCat=e.target.closest('[data-del-cat]');if(delCat){if(!await confirmarAcao('A categoria será excluída do cadastro. Deseja continuar?','Excluir categoria?'))return;try{await api('/api/categorias/'+delCat.dataset.delCat,{method:'DELETE'});await carregarAcervoAdmin()}catch(err){alert(err.message)}return;}
  const editEx=e.target.closest('[data-edit-exemplar]');if(editEx){const codigo=prompt('Código do exemplar:');if(!codigo)return;const status=prompt('Status: disponivel, reservado, danificado ou perdido','disponivel');if(!status)return;const localizacao_id=prompt('ID da localização (opcional):')||'';const obs=prompt('Observação (opcional):')||'';try{await api('/api/exemplares/'+editEx.dataset.editExemplar,{method:'PUT',body:JSON.stringify({codigo,status,localizacao_id,observacao:obs})});await carregarAcervoAdmin();await carregarExemplares()}catch(err){alert(err.message)}return;}
  const delEx=e.target.closest('[data-del-exemplar]');if(delEx){if(!await confirmarAcao('Este exemplar será retirado do acervo. Deseja realmente continuar?','Retirar exemplar?'))return;try{await api('/api/exemplares/'+delEx.dataset.delExemplar,{method:'DELETE'});await carregarAcervoAdmin();await carregarAcervoAdmin()}catch(err){alert(err.message)}return;}
  const filtroBtn=e.target.closest('[data-filtro-emprestimo]');
  if(filtroBtn){setFiltroEmprestimo(filtroBtn.dataset.filtroEmprestimo);return;}
  const ler=e.target.closest('[data-ler-notificacao]');
  if(ler){try{await api('/api/notificacoes/'+ler.dataset.lerNotificacao+'/lida',{method:'PUT'});await carregarNotificacoes()}catch(err){alert(err.message)}return;}
  const aprovar=e.target.closest('[data-aprovar-solicitacao]');
  if(aprovar){if(!confirm('Aprovar esta solicitação e criar o empréstimo?'))return;aprovar.disabled=true;try{await api('/api/solicitacoes-emprestimo/'+aprovar.dataset.aprovarSolicitacao+'/aprovar',{method:'POST'});alert('Solicitação aprovada. O usuário foi notificado.');await carregarSolicitacoes();await carregarEmprestimos();await carregarExemplares();await carregarDashboard();}catch(err){aprovar.disabled=false;alert(err.message)}return;}
  const recusar=e.target.closest('[data-recusar-solicitacao]');
  if(recusar){if(!await confirmarAcao('A solicitação será recusada. Deseja continuar?','Recusar solicitação?'))return;const motivo=prompt('Informe o motivo da recusa:','Solicitação não aprovada pela Gestão.');if(motivo===null)return;recusar.disabled=true;try{await api('/api/solicitacoes-emprestimo/'+recusar.dataset.recusarSolicitacao+'/recusar',{method:'POST',body:JSON.stringify({motivo})});alert('Solicitação recusada e usuário notificado.');await carregarSolicitacoes();}catch(err){recusar.disabled=false;alert(err.message)}return;}
  const cr=e.target.closest('[data-confirmar-retirada]');if(cr){abrirCodigoOperacao('retirada',cr.dataset.confirmarRetirada);return;}
  const b=e.target.closest('[data-devolver]');if(!b)return;abrirCodigoOperacao('devolucao',b.dataset.devolver)
});

 // ---------- Cobrança de devolução (manual) ----------
 const CANAL_ROTULO={site:'Site',email:'Gmail',ambos:'Site + Gmail'};
 function renderCobranca(lista){
  const t=$('#cobrancaLista');if(!t)return;
  const abertos=lista.filter(e=>e.status!=='devolvido'&&Number(e.retirada_confirmada)).sort((a,b)=>new Date(a.data_prevista_devolucao)-new Date(b.data_prevista_devolucao));
  const c=$('#cobrancaContagem');if(c)c.textContent=abertos.length?abertos.length+' com livro':'';
  const agora=new Date();
  t.innerHTML=abertos.map(e=>{const venc=new Date(e.data_prevista_devolucao),atras=venc<agora;const ult=e.cobranca_em?(data(String(e.cobranca_em).replace(' ','T')+'Z')+' · '+(CANAL_ROTULO[e.cobranca_canal]||'')+(Number(e.cobranca_total)>1?' ('+e.cobranca_total+'x)':'')):'<span class="status-pendente">Nunca</span>';
   return '<tr'+(atras?' class="linha-atrasada"':'')+'><td>'+escapar(e.usuario)+'</td><td>'+escapar(e.titulo)+'</td><td>'+data(e.data_prevista_devolucao)+'</td><td>'+(atras?'<span class="badge badge-atrasado">Atrasado</span>':'<span class="badge badge-ativo">No prazo</span>')+'</td><td>'+ult+'</td><td><button class="row-acao-btn" data-cobrar="'+e.id+'">Cobrar devolução</button></td></tr>'}).join('')||'<tr><td colspan="6">Ninguém está com livro no momento.</td></tr>';
 }
 function msgCobranca(el,texto,ok){if(!el)return;el.textContent=texto;el.style.color=ok?'green':'#b42318'}
 document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-cobrar]');
  if(b){const msg=$('#cobrancaMensagemStatus');b.disabled=true;const antes=b.textContent;b.textContent='Enviando...';
   try{const d=await api('/api/emprestimos/'+b.dataset.cobrar+'/cobrar-devolucao',{method:'POST',body:JSON.stringify({canal:$('#cobrancaCanal').value,mensagem:$('#cobrancaMensagem').value})});msgCobranca(msg,d.mensagem||'Aviso enviado.',true);await carregarEmprestimos()}
   catch(err){msgCobranca(msg,err.message,false);b.disabled=false;b.textContent=antes}
   return}
  if(e.target.closest('#btnCobrarLote')){const btn=$('#btnCobrarLote'),msg=$('#cobrancaMensagemStatus');
   const alvoTxt=$('#cobrancaAlvo').selectedOptions[0].textContent.toLowerCase();
   if(!await confirmarAcao('Será enviado um aviso de devolução para: '+alvoTxt+' (por '+$('#cobrancaCanal').selectedOptions[0].textContent+'). Deseja continuar?','Avisar em lote?'))return;
   btn.disabled=true;try{const d=await api('/api/emprestimos/cobrar-devolucao-lote',{method:'POST',body:JSON.stringify({canal:$('#cobrancaCanal').value,alvo:$('#cobrancaAlvo').value,mensagem:$('#cobrancaMensagem').value})});msgCobranca(msg,d.mensagem||'Avisos enviados.',true);setTimeout(()=>carregarEmprestimos().catch(()=>{}),2500)}
   catch(err){msgCobranca(msg,err.message,false)}finally{btn.disabled=false}}
 });
 // ---------- Cobrança automática (Configurações) ----------
 async function carregarCobrancaAuto(){if(!ehAdmin||!$('#formCobrancaAuto'))return;try{const c=await api('/api/configuracoes/cobranca');$('#cobAuto').value=String(c.cobranca_auto?1:0);$('#cobCanal').value=c.cobranca_canal;$('#cobAlvo').value=c.cobranca_alvo;$('#cobIntervalo').value=c.cobranca_intervalo_dias}catch(_){}}
 $('#formCobrancaAuto')?.addEventListener('submit',async e=>{e.preventDefault();const m=$('#cobAutoMensagem');try{await api('/api/configuracoes/cobranca',{method:'PUT',body:JSON.stringify({auto:$('#cobAuto').value==='1',canal:$('#cobCanal').value,alvo:$('#cobAlvo').value,intervalo_dias:Number($('#cobIntervalo').value)})});msgCobranca(m,$('#cobAuto').value==='1'?'Salvo. O envio automático está ligado.':'Salvo. O envio automático está desligado.',true)}catch(err){msgCobranca(m,err.message,false)}});
 async function carregarEquipe(){if(!ehAdmin)return;const box=$('#equipeLista');if(!box)return;try{const l=await api('/api/equipe-gestao');box.innerHTML=l.map(m=>'<tr><td><div class="avatar-row"><span class="avatar">'+iniciais(m.nome)+'</span>'+escapar(m.nome)+(m.voce?' <small>(você)</small>':'')+'</div></td><td>'+escapar(m.email)+'</td><td><select data-equipe-nivel="'+m.id+'"'+(m.voce?' disabled':'')+'><option value="admin"'+(m.nivel==='admin'?' selected':'')+'>Administrador</option><option value="bibliotecario"'+(m.nivel==='bibliotecario'?' selected':'')+'>Bibliotecário</option></select></td><td><span class="badge '+(m.status==='ativo'?'badge-ativo':'badge-pendente')+'">'+escapar(m.status)+'</span></td><td>'+(m.voce?'—':(m.status==='pendente'?'<button class="row-acao-btn" data-equipe-status="'+m.id+'" data-status="ativo">Aprovar</button> <button class="row-acao-btn" data-equipe-status="'+m.id+'" data-status="inativo">Recusar</button>':'<button class="row-acao-btn" data-equipe-status="'+m.id+'" data-status="'+(m.status==='ativo'?'inativo':'ativo')+'">'+(m.status==='ativo'?'Desativar':'Ativar')+'</button>'))+'</td></tr>').join('')||'<tr><td colspan="5">Nenhum membro.</td></tr>'}catch(e){console.warn('Equipe:',e.message)}}
 document.addEventListener('change',async e=>{const s=e.target.closest('[data-equipe-nivel]');if(!s)return;try{await api('/api/equipe-gestao/'+s.dataset.equipeNivel,{method:'PUT',body:JSON.stringify({nivel:s.value})});await carregarEquipe()}catch(err){alert(err.message);await carregarEquipe()}});
 $('#formNovoMembro')?.addEventListener('submit',async e=>{e.preventDefault();const m=$('#membroMensagem');try{await api('/api/equipe-gestao',{method:'POST',body:JSON.stringify({nome:$('#membroNome').value,email:$('#membroEmail').value,senha:$('#membroSenha').value,nivel:$('#membroNivel').value})});m.textContent='Pessoa adicionada à equipe.';m.style.color='green';e.target.reset();await carregarEquipe()}catch(err){m.textContent=err.message;m.style.color='crimson'}});
 document.addEventListener('change',async e=>{const s=e.target.closest('[data-contato-status]');if(!s)return;try{await api('/api/contatos/'+s.dataset.contatoStatus+'/status',{method:'PUT',body:JSON.stringify({status:s.value})});await carregarContatos()}catch(err){alert(err.message)}});
 $('#marcarTodasNotificacoes')?.addEventListener('click',async()=>{try{await api('/api/notificacoes/marcar-todas-lidas',{method:'PUT'});await carregarNotificacoes()}catch(e){alert(e.message)}});
 // O abrir/fechar do sino (#topbarBell/#topbarNotif) já é controlado pelo painel.js,
 // que é carregado antes deste arquivo. Aqui só recarregamos a lista quando o painel abre,
 // evitando um segundo listener de clique que fazia o painel abrir e fechar no mesmo clique.
 const topbarBell=$('#topbarBell');
 const topbarNotif=$('#topbarNotif');
 topbarBell?.addEventListener('click',()=>{setTimeout(()=>{if(topbarNotif&&!topbarNotif.hidden)carregarNotificacoes().catch(()=>{});},0);});
 $('#topbarNotifLista')?.addEventListener('click',async e=>{const item=e.target.closest('[data-notif-id]');if(!item)return;const id=item.dataset.notifId;const n=buscarNotificacaoPorId(id)||{titulo:item.querySelector('strong')?.textContent||'Notificação',mensagem:item.querySelector('span')?.textContent||''};try{if(!Number(n.lida))await api('/api/notificacoes/'+id+'/lida',{method:'PUT'});n.lida=1;abrirNotificacaoModal(n);await carregarNotificacoes()}catch(err){console.warn(err.message)}});
 $('#notificacoesGestaoLista')?.addEventListener('click',async e=>{const ver=e.target.closest('[data-ver-notificacao]');const ler=e.target.closest('[data-ler-notificacao]');const el=ver||ler;if(!el)return;e.stopPropagation();const id=el.dataset.verNotificacao||el.dataset.lerNotificacao;const n=buscarNotificacaoPorId(id);if(ver){if(n)abrirNotificacaoModal(n);if(n&&!Number(n.lida)){try{await api('/api/notificacoes/'+id+'/lida',{method:'PUT'});n.lida=1;await carregarNotificacoes()}catch(err){console.warn(err.message)}}}else{try{await api('/api/notificacoes/'+id+'/lida',{method:'PUT'});await carregarNotificacoes()}catch(err){alert(err.message)}}});
 $('#notificacoesGestaoLista')?.addEventListener('click',e=>{if(e.target.closest('button'))return;const row=e.target.closest('[data-notif-row]');if(!row)return;const n=buscarNotificacaoPorId(row.dataset.notifRow);if(n)abrirNotificacaoModal(n)});
 $('#fecharNotificacaoModal')?.addEventListener('click',fecharNotificacaoModal);
 $('#notificacaoModal')?.addEventListener('click',e=>{if(e.target.closest('[data-fechar-notificacao]'))fecharNotificacaoModal()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#notificacaoModal')?.hidden)fecharNotificacaoModal()});
 $('#topbarNotifLista')?.addEventListener('keydown',e=>{const item=e.target.closest('[data-notif-id]');if(item&&(e.key==='Enter'||e.key===' ')){e.preventDefault();item.click();}});
 async function carregarReservas(){try{const lista=await api('/api/reservas');const fila=lista.filter(r=>r.status==='fila').length;const prontas=lista.filter(r=>r.status==='pronto').length;setTexto('#reservasAguardandoStat',fila);setTexto('#reservasProntasStat',prontas);const t=$('#reservasGestaoLista');if(t)t.innerHTML=lista.map(r=>'<tr><td><div class="avatar-row"><span class="avatar">'+iniciais(r.usuario)+'</span>'+escapar(r.usuario)+'</div></td><td>'+escapar(r.titulo)+'</td><td>'+data(r.data_reserva)+'</td><td><span class="badge '+(r.status==='cancelada'?'badge-pendente':'badge-ativo')+'">'+escapar(r.status)+'</span></td><td>'+(r.status==='fila'?'<button class="row-acao-btn" data-reserva-status="'+r.id+'" data-status="pronto">Marcar pronta</button> ':'')+(r.status==='pronto'?'<button class="row-acao-btn" data-reserva-status="'+r.id+'" data-status="retirada">Marcar retirada</button> ':'')+((r.status==='fila'||r.status==='pronto')?'<button class="row-acao-btn" data-reserva-status="'+r.id+'" data-status="cancelada">Cancelar</button>':'')+'</td></tr>').join('')||'<tr><td colspan="5">Nenhuma reserva.</td></tr>'}catch(e){console.warn('Reservas:',e.message)}}
let operacaoEmprestimoId=null;let operacaoTipo=null;function abrirCodigoOperacao(tipo,id){operacaoTipo=tipo;operacaoEmprestimoId=id;const modal=$('#codigoOperacaoModal');const titulo=$('#codigoOperacaoTitulo');const texto=$('#codigoOperacaoTexto');const input=$('#codigoOperacaoInput');const livro=$('#codigoOperacaoLivro');const ep=emprestimosCache.find(x=>String(x.id)===String(id));if(titulo)titulo.textContent=tipo==='retirada'?'Confirmar retirada':'Confirmar devolução';if(texto)texto.textContent=tipo==='retirada'?'Digite o código de retirada apresentado pelo aluno ou professor.':'Digite o código de devolução apresentado pelo aluno ou professor.';if(livro)livro.textContent=ep?(ep.titulo+' · '+ep.usuario):'';if(input){input.value='';input.maxLength=6;input.placeholder='000000';setTimeout(()=>input.focus(),50)}if(modal)modal.hidden=false}function fecharCodigoOperacao(){const modal=$('#codigoOperacaoModal');if(modal)modal.hidden=true;operacaoEmprestimoId=null;operacaoTipo=null}async function confirmarCodigoOperacao(){const input=$('#codigoOperacaoInput');const btn=$('#confirmarCodigoOperacao');const codigo=String(input?.value||'').trim();if(!/^\d{6}$/.test(codigo)){if(input)input.focus();$('#codigoOperacaoErro').textContent='Digite os 6 números do código.';return}if(!operacaoEmprestimoId||!operacaoTipo)return;btn.disabled=true;btn.textContent='Confirmando...';$('#codigoOperacaoErro').textContent='';try{const rota=operacaoTipo==='retirada'?'/api/emprestimos/'+operacaoEmprestimoId+'/confirmar-retirada':'/api/emprestimos/'+operacaoEmprestimoId+'/devolver';const corpo=operacaoTipo==='retirada'?{codigo_retirada:codigo}:{codigo_devolucao:codigo};await api(rota,{method:'POST',body:JSON.stringify(corpo)});fecharCodigoOperacao();await carregarEmprestimos();await carregarExemplares();await carregarDashboard();}catch(err){$('#codigoOperacaoErro').textContent=err.message||'Não foi possível confirmar a operação.'}finally{btn.disabled=false;btn.textContent='Confirmar'}}
function punicaoSugerida(dias){return dias<=2?'advertencia':dias<=7?'3':dias<=14?'7':'15'}
 function rotuloPenalidade(p){return p.tipo==='advertencia'?'Advertência':p.tipo==='bloqueio_regularizacao'?'Bloqueio até devolver':(p.tipo||'').startsWith('bloqueio_')?'Bloqueio de '+p.dias_bloqueio+' dias':p.tipo}
 function fmtData(v){if(!v)return'—';const d=new Date(v);return isNaN(d)?'—':d.toLocaleDateString('pt-BR')}
 function cartaoMulta(m){
  const sug=punicaoSugerida(m.dias_atraso),id=m.emprestimo_id;
  const ops=[['advertencia','📝','Advertência','Só um aviso'],['3','⏳','3 dias','Bloqueia pedidos'],['7','⏳','7 dias','Bloqueia pedidos'],['15','🚫','15 dias','Bloqueia pedidos'],['regularizacao','🔒','Até devolver','Libera ao devolver'],['dispensar','🤝','Dispensar','Sem punição']];
  const quem=[m.usuario_tipo==='professor'?'Professor(a)':'Aluno(a)',m.serie?m.serie+'º ano':'',m.turma?'turma '+m.turma:''].filter(Boolean).join(' · ');
  return '<article class="mx-card" data-multa-card data-emprestimo="'+id+'" data-usuario="'+m.usuario_id+'" data-nome="'+escapar(m.usuario)+'">'
   +'<div class="mx-card__topo"><span class="avatar">'+iniciais(m.usuario)+'</span><div class="mx-card__quem"><strong>'+escapar(m.usuario)+'</strong><span>'+escapar(quem)+'</span></div><span class="mx-atraso"><b>'+m.dias_atraso+'</b> '+(m.dias_atraso===1?'dia':'dias')+' de atraso</span></div>'
   +'<div class="mx-card__livro">'+(m.capa?'<img src="'+escapar(m.capa)+'" alt="" loading="lazy" onerror="this.style.display=\'none\'">':'')+'<div><strong>'+escapar(m.titulo)+'</strong><span>Exemplar '+escapar(m.codigo)+' · devia devolver em '+fmtData(m.data_prevista_devolucao)+'</span>'+(m.penalidades_ativas?'<span class="mx-aviso">Já tem '+m.penalidades_ativas+' penalidade(s) ativa(s)</span>':'')+'</div></div>'
   +'<fieldset class="mx-ops"><legend>Qual punição?</legend>'+ops.map(o=>'<label class="mx-op"><input type="radio" name="pun-'+id+'" value="'+o[0]+'"'+(o[0]===sug?' checked':'')+'><span class="mx-op__corpo"><span class="mx-op__icone">'+o[1]+'</span><b>'+o[2]+'</b><small>'+(o[0]===sug?'Sugerida':o[3])+'</small></span></label>').join('')+'</fieldset>'
   +'<div class="mx-card__rodape"><input type="text" class="mx-obs" maxlength="200" placeholder="Observação (opcional) — aparece para a pessoa"><button type="button" class="btn-primario" data-aplicar-punicao>Aplicar punição</button></div></article>';
 }
 async function carregarMultas(){try{const [d,p]=await Promise.all([api('/api/multas'),api('/api/penalidades')]);
  const ag=d.aguardando||[];setTexto('#multasAguardandoStat',ag.length);setTexto('#multasUsuariosStat',d.usuarios_com_multa);const ativas=p.filter(x=>x.status==='ativa');setTexto('#multasTotalStat',ativas.length);
  const badge=$('#multasNavBadge');if(badge){badge.textContent=ag.length;badge.hidden=!ag.length}
  const box=$('#multasAguardando');if(box)box.innerHTML=ag.length?ag.map(cartaoMulta).join(''):'<p class="empty-msg mx-vazio">✅ Nenhum atraso esperando punição.</p>';
  const t=$('#multasLista');if(t)t.innerHTML=p.slice(0,40).map(x=>{const st=x.status==='ativa'?'<span class="badge badge-pendente">Ativa</span>':x.status==='cumprida'?'<span class="badge badge-ativo">Cumprida</span>':'<span class="badge">'+(/dispensado/i.test(x.descricao||'')?'Dispensada':'Cancelada')+'</span>';return '<tr><td><div class="avatar-row"><span class="avatar">'+iniciais(x.usuario)+'</span>'+escapar(x.usuario)+'</div></td><td>'+escapar(x.titulo||'—')+'</td><td>'+escapar(rotuloPenalidade(x))+(x.descricao?'<br><small>'+escapar(x.descricao)+'</small>':'')+'</td><td>'+(x.tipo==='bloqueio_regularizacao'?'Até devolver':x.fim_em?fmtData(x.fim_em):'—')+'</td><td>'+st+'</td><td>'+(x.status==='ativa'?'<button type="button" class="row-acao-btn" data-avisar-pen="'+x.id+'" title="Envia o aviso por Gmail e abre a tela no site do aluno">Avisar</button> <button type="button" class="row-acao-btn" data-encerrar-pen="'+x.id+'">Encerrar</button>':'')+'</td></tr>'}).join('')||'<tr><td colspan="6">Nenhuma penalidade registrada.</td></tr>'}catch(e){console.warn('Penalidades:',e.message)}}
 async function carregarAcervoAdmin(){try{const [cats,exs,locs]=await Promise.all([api('/api/categorias'),api('/api/exemplares'),api('/api/localizacoes')]);const tc=$('#categoriasGestaoLista');if(tc)tc.innerHTML=cats.map(c=>'<tr><td>'+escapar(c.nome)+'</td><td>'+escapar(c.descricao||'—')+'</td><td><button class="row-acao-btn" data-edit-cat="'+c.id+'">Editar</button> <button class="row-acao-btn" data-del-cat="'+c.id+'">Excluir</button></td></tr>').join('')||'<tr><td colspan="3">Nenhuma categoria.</td></tr>';const te=$('#exemplaresGestaoLista');if(te)te.innerHTML=exs.map(x=>'<tr><td>'+escapar(x.titulo)+'</td><td>'+escapar(x.codigo)+'</td><td>'+escapar(x.localizacao||'—')+'</td><td>'+escapar(x.status)+(x.usuario_emprestimo?' <small>— '+escapar(x.usuario_emprestimo)+'</small>':'')+'</td><td>'+(x.status==='emprestado'&&x.emprestimo_id?'<button class="row-acao-btn" data-devolver="'+x.emprestimo_id+'">↩ Colocar de volta</button> ':'')+(x.status==='emprestado'?'':'<button class="row-acao-btn" data-edit-exemplar="'+x.id+'">Editar</button> <button class="row-acao-btn" data-del-exemplar="'+x.id+'">Retirar</button>')+'</td></tr>').join('')||'<tr><td colspan="5">Nenhum exemplar.</td></tr>';let tl=$('#localizacoesGestaoLista');if(tl)tl.innerHTML=locs.map(x=>'<tr><td>'+escapar(x.nome)+'</td><td>'+escapar(x.descricao||'—')+'</td><td><button class="row-acao-btn" data-edit-loc="'+x.id+'">Editar</button> <button class="row-acao-btn" data-del-loc="'+x.id+'">Excluir</button></td></tr>').join('')||'<tr><td colspan="3">Nenhuma localização.</td></tr>'}catch(e){console.warn('Acervo:',e.message)}}

async function carregarContatos(){try{const lista=await api('/api/contatos');setTexto('#contatosNovosStat',lista.filter(x=>x.status==='novo').length);setTexto('#contatosTotalStat',lista.length);const t=$('#contatosLista');if(t)t.innerHTML=lista.map(c=>'<tr><td>'+escapar(c.nome)+'</td><td>'+escapar(c.email)+'</td><td>'+escapar(c.mensagem)+'</td><td>'+data(c.criado_em)+'</td><td>'+escapar(c.status)+'</td><td><select class="contato-status" data-contato-status="'+c.id+'"><option value="novo" '+(c.status==='novo'?'selected':'')+'>Novo</option><option value="lido" '+(c.status==='lido'?'selected':'')+'>Lido</option><option value="respondido" '+(c.status==='respondido'?'selected':'')+'>Respondido</option></select></td></tr>').join('')||'<tr><td colspan="6">Nenhuma mensagem.</td></tr>'}catch(e){console.warn('Contatos:',e.message)}}

async function carregarRelatorios(){try{const d=await api('/api/relatorios');setTexto('#relatorioFrequenciaStat',d.media_semanal);const catTotal=d.categorias.reduce((s,c)=>s+Number(c.total||0),0);const catTexto=d.categorias.slice(0,3).map(c=>{const pct=catTotal?Math.round(c.total*100/catTotal):0;return escapar(c.categoria)+' '+pct+'%'}).join(' · ');setTexto('#relatorioCategorias',catTexto||'Sem dados.');const t=$('#relatorioMaisEmprestados');if(t)t.innerHTML=d.mais_emprestados.slice(0,5).map((x,i)=>'<tr><td>'+(i+1)+'</td><td>'+escapar(x.titulo)+'</td><td>'+x.emprestimos+'</td></tr>').join('')||'<tr><td colspan="3">Nenhum empréstimo registrado.</td></tr>';const diasRelatorio=gerarUltimosDias(30);const porDataRelatorio={};diasRelatorio.forEach(x=>porDataRelatorio[x.data]=x);(d.periodo||[]).forEach(p=>{const iso=String(p.dia||'').slice(0,10);const item=porDataRelatorio[iso];if(item)item.total=Number(p.total)||0});renderGraficoBarrasReal('relatorioGraficoEmprestimos',diasRelatorio,false)}catch(e){console.warn('Relatórios:',e.message)}}
 async function carregarConfig(){try{const c=await api('/api/configuracoes');$('#cfgDias').value=c.dias_emprestimo;$('#cfgAluno').value=c.limite_livros_aluno;$('#cfgProfessor').value=c.limite_livros_professor;$('#cfgRenovacoes').value=c.maximo_renovacoes;$('#cfgReservas').value=c.permitir_reservas?'1':'0'}catch(e){}}
 $('#formConfiguracoes')?.addEventListener('submit',async e=>{e.preventDefault();try{await api('/api/configuracoes',{method:'PUT',body:JSON.stringify({dias_emprestimo:Number($('#cfgDias').value),limite_livros_aluno:Number($('#cfgAluno').value),limite_livros_professor:Number($('#cfgProfessor').value),maximo_renovacoes:Number($('#cfgRenovacoes').value),permitir_reservas:$('#cfgReservas').value==='1'})});$('#cfgMensagem').textContent='Configurações salvas.';window.__bibliobetaMaxRenovacoes=Number($('#cfgRenovacoes').value)}catch(err){$('#cfgMensagem').textContent=err.message}});

 // ---- E-mails automáticos por categoria ----
 let emailCategoriasCache=[];
 async function carregarEmailCategorias(){
  const tb=$('#emailCategoriasLista'); if(!tb||!ehAdmin)return;
  try{
   emailCategoriasCache=await api('/api/configuracoes/email-categorias');
   const chk=(c,campo)=>'<td><input type="checkbox" data-cat="'+c.id+'" data-campo="'+campo+'" aria-label="'+escapar(c.nome)+' — '+campo.replace('para_','')+'" '+(Number(c[campo])?'checked':'')+'></td>';
   tb.innerHTML=emailCategoriasCache.map(c=>'<tr><td><strong>'+escapar(c.nome)+'</strong><br><small>'+escapar(c.descricao)+'</small></td>'+chk(c,'ativo')+chk(c,'para_aluno')+chk(c,'para_professor')+chk(c,'para_gestao')+'</tr>').join('');
   const sel=$('#envCategoria'); if(sel)sel.innerHTML=emailCategoriasCache.map(c=>'<option value="'+c.id+'"'+(c.id==='informativo'?' selected':'')+'>'+escapar(c.nome)+'</option>').join('');
   mensagensAutoCache=await api('/api/configuracoes/mensagens-automaticas');
   const mod=$('#envModelo'); if(mod){const grupos={};mensagensAutoCache.forEach(m=>{(grupos[m.categoria_nome]=grupos[m.categoria_nome]||[]).push(m)});mod.innerHTML='<option value="">Mensagem personalizada</option>'+Object.keys(grupos).map(g=>'<optgroup label="'+escapar(g)+'">'+grupos[g].map(m=>'<option value="'+m.id+'">'+escapar(m.nome)+'</option>').join('')+'</optgroup>').join('')}
   const us=await api('/api/usuarios'); const selU=$('#envUsuario'); if(selU)selU.innerHTML='<option value="">Escolha o usuário...</option>'+us.filter(u=>u.status==='ativo').map(u=>'<option value="'+u.id+'">'+escapar(u.nome)+' ('+escapar(u.tipo)+') — '+escapar(u.email)+'</option>').join('');
  }catch(e){tb.innerHTML='<tr><td colspan="5">'+escapar(e.message)+'</td></tr>'}
 }
 let mensagensAutoCache=[];
 function atualizarEnvioUsuario(){const w=$('#envUsuarioWrap'),d=$('#envDestinatarios');if(w&&d)w.style.display=d.value==='usuario'?'':'none'}
 $('#envDestinatarios')?.addEventListener('change',atualizarEnvioUsuario); atualizarEnvioUsuario();
 let modeloAtual=null;
 function aplicarModelo(){
  const livroSel=$('#envLivro'),opt=livroSel&&livroSel.options[livroSel.selectedIndex];
  const livro=opt&&opt.value?opt.dataset.titulo:'',autor=opt&&opt.value?opt.dataset.autor:'';
  const troca=t=>{let r=t;if(livro)r=r.split('[livro]').join(livro);if(autor)r=r.split('[autor]').join(autor||'autor não informado');return r};
  if(!modeloAtual)return;
  $('#envTitulo').value=troca(modeloAtual.titulo);$('#envMensagem').value=troca(modeloAtual.mensagem);
 }
 async function carregarLivrosEnvio(){
  const sel=$('#envLivro');if(!sel||sel.dataset.ok)return;
  try{const livros=await api('/api/livros');sel.innerHTML='<option value="">Escolha o livro...</option>'+livros.map(l=>'<option value="'+l.id+'" data-titulo="'+escapar(l.titulo)+'" data-autor="'+escapar(l.autor||'')+'">'+escapar(l.titulo)+(l.autor?' — '+escapar(l.autor):'')+'</option>').join('');sel.dataset.ok='1'}catch(e){}
 }
 $('#envLivro')?.addEventListener('change',aplicarModelo);
 $('#envModelo')?.addEventListener('change',async()=>{
  modeloAtual=mensagensAutoCache.find(x=>String(x.id)===$('#envModelo').value)||null;
  const wrap=$('#envLivroWrap');
  if(!modeloAtual){if(wrap)wrap.style.display='none';return}
  $('#envCategoria').value=modeloAtual.categoria;
  const usaLivro=/\[livro\]/.test(modeloAtual.titulo+modeloAtual.mensagem);
  if(wrap)wrap.style.display=usaLivro?'':'none';
  if(usaLivro){await carregarLivrosEnvio();$('#envLivro').value=''}
  if(modeloAtual.destinatarios){$('#envDestinatarios').value=modeloAtual.destinatarios;atualizarEnvioUsuario()}
  aplicarModelo();
 });
 $('#btnSalvarEmailCategorias')?.addEventListener('click',async()=>{
  const b=$('#btnSalvarEmailCategorias'),m=$('#emailCategoriasMensagem');
  const regras=emailCategoriasCache.map(c=>{const g=campo=>!!document.querySelector('input[data-cat="'+c.id+'"][data-campo="'+campo+'"]')?.checked;return {categoria:c.id,ativo:g('ativo'),para_aluno:g('para_aluno'),para_professor:g('para_professor'),para_gestao:g('para_gestao')}});
  try{b.disabled=true;await api('/api/configuracoes/email-categorias',{method:'PUT',body:JSON.stringify({regras})});m.textContent='Categorias salvas.';m.style.color='green'}
  catch(err){m.textContent=err.message;m.style.color='crimson'}finally{b.disabled=false}
 });
 $('#formEnviarCategoria')?.addEventListener('submit',async e=>{
  e.preventDefault();
  const b=$('#btnEnviarCategoria'),m=$('#envCategoriaMensagem'),dest=$('#envDestinatarios');
  if(dest.value==='usuario'&&!$('#envUsuario').value){m.textContent='Escolha o usuário que vai receber.';m.style.color='crimson';return}
  const pend=($('#envTitulo').value+' '+$('#envMensagem').value).match(/\[[^\]]+\]/);
  if(pend){m.textContent='Preencha o campo '+pend[0]+' antes de enviar.';m.style.color='crimson';return}
  const quem=dest.value==='usuario'?$('#envUsuario').options[$('#envUsuario').selectedIndex].text:dest.options[dest.selectedIndex].text.toLowerCase();
  if(!await confirmarAcao('A mensagem será enviada agora para: '+quem+'.','Enviar mensagem?'))return;
  try{b.disabled=true;m.textContent='';const d=await api('/api/configuracoes/email-categorias/enviar',{method:'POST',body:JSON.stringify({categoria:$('#envCategoria').value,destinatarios:dest.value,usuario_id:$('#envUsuario')?.value,titulo:$('#envTitulo').value,mensagem:$('#envMensagem').value})});m.textContent=d.mensagem||'Mensagem enviada.';m.style.color='green';$('#envTitulo').value='';$('#envMensagem').value=''}
  catch(err){m.textContent=err.message;m.style.color='crimson'}finally{b.disabled=false}
 });
 $('#btnTesteEmail')?.addEventListener('click',async()=>{const b=$('#btnTesteEmail'),m=$('#testeEmailMensagem');try{b.disabled=true;b.textContent='Enviando...';m.textContent='';const d=await api('/api/configuracoes/teste-email',{method:'POST'});m.textContent=d.mensagem||'E-mail de teste enviado.';m.style.color='green';}catch(err){m.textContent=err.message;m.style.color='crimson';}finally{b.disabled=false;b.textContent='📧 Testar envio de e-mail (Gestão)';}});
 $('#btnTesteEmailUsuarios')?.addEventListener('click',async()=>{const b=$('#btnTesteEmailUsuarios'),m=$('#testeEmailUsuariosMensagem'),campo=$('#emailTesteUsuarios');try{const dest=(campo?.value||'').trim();if(!dest){m.textContent='Informe um e-mail para receber o teste.';m.style.color='crimson';return;}b.disabled=true;b.textContent='Enviando...';m.textContent='';const d=await api('/api/configuracoes/teste-email-usuarios',{method:'POST',body:JSON.stringify({email:dest})});m.textContent=d.mensagem||'E-mail de teste enviado.';m.style.color='green';}catch(err){m.textContent=err.message;m.style.color='crimson';}finally{b.disabled=false;b.textContent='📧 Testar envio de e-mail (Alunos/Professores)';}});
 $('#btnExportarRelatorio')?.addEventListener('click',async()=>{const b=$('#btnExportarRelatorio'),msg=$('#relatorioExportMensagem');try{b.disabled=true;b.textContent='Gerando...';const r=await fetch((window.BiblioBetaAPI?.url?window.BiblioBetaAPI.url('/api/relatorios/emprestimos.csv'):API+'/api/relatorios/emprestimos.csv'),{headers:{Authorization:'Bearer '+token}});if(!r.ok){let d={};try{d=await r.json()}catch{}throw new Error(d.erro||'Não foi possível exportar.')}const blob=await r.blob();const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='bibliobeta-emprestimos.csv';a.click();URL.revokeObjectURL(a.href);if(msg)msg.textContent='CSV gerado com sucesso.'}catch(e){if(msg)msg.textContent=e.message}finally{b.disabled=false;b.textContent='Exportar CSV'}});
 // Atualiza todas as áreas da Gestão. Vários avisos seguidos viram uma única atualização.
 // Fica de fora o que é formulário de configuração (para não apagar o que a pessoa está digitando).
 let _recTimer=null,_recRodando=false,_recPendente=false;
 function recarregarTudo(){
  if(_recTimer)return;
  _recTimer=setTimeout(async()=>{
   _recTimer=null;
   if(_recRodando){_recPendente=true;return}
   _recRodando=true;
   try{
    await Promise.all([carregarDashboard(),carregarUsuarios(),carregarExemplares(),carregarEmprestimos(),carregarSolicitacoes(),carregarNotificacoes(),carregarCadastrosPendentes(),carregarTurmas(),carregarEquipe(),carregarReservas(),carregarMultas(),carregarRelatorios(),carregarContatos(),carregarAcervoAdmin()].map(p=>Promise.resolve(p).catch(()=>{})));
    document.dispatchEvent(new CustomEvent('bibliobeta:atualizar'));
   }finally{_recRodando=false;if(_recPendente){_recPendente=false;recarregarTudo()}}
  },250);
 }
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)recarregarTudo()});
// Aviso rápido (canto da tela) quando alguém da Gestão cadastra um livro.
function mostrarAvisoLivro(d){
  try{
    if(!document.getElementById('bbToastCss')){
      const st=document.createElement('style'); st.id='bbToastCss';
      st.textContent='#bbToastBox{position:fixed;top:72px;right:16px;z-index:99999;display:flex;flex-direction:column;gap:10px;max-width:min(360px,calc(100vw - 32px));pointer-events:none}'
      +'.bb-toast{pointer-events:auto;background:#12372a;color:#fff;border-left:5px solid #34d399;border-radius:12px;padding:12px 14px;box-shadow:0 8px 24px rgba(0,0,0,.25);font:14px/1.35 system-ui,Arial,sans-serif;animation:bbToastIn .25s ease-out}'
      +'.bb-toast b{display:block;font-size:13px;opacity:.85;margin-bottom:2px}.bb-toast strong{display:block;font-size:15px}.bb-toast small{display:block;opacity:.8;margin-top:4px}'
      +'@keyframes bbToastIn{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:none}}@media (prefers-reduced-motion:reduce){.bb-toast{animation:none}}';
      document.head.appendChild(st);
    }
    let box=document.getElementById('bbToastBox');
    if(!box){ box=document.createElement('div'); box.id='bbToastBox'; box.setAttribute('role','status'); box.setAttribute('aria-live','polite'); document.body.appendChild(box); }
    const el=document.createElement('div'); el.className='bb-toast';
    const eu=usuario&&Number(d.por_id)===Number(usuario.id);
    const t1=document.createElement('b'); t1.textContent='📚 Livro cadastrado';
    const t2=document.createElement('strong'); t2.textContent=d.titulo||'(sem título)';
    const t3=document.createElement('small'); t3.textContent=(d.autor?d.autor+' · ':'')+'por '+(eu?'você':(d.por||'Gestão'))+(d.total!=null?' · '+d.total+' no catálogo':'');
    el.append(t1,t2,t3); box.appendChild(el);
    while(box.children.length>4) box.removeChild(box.firstChild);
    setTimeout(()=>{ el.style.transition='opacity .3s'; el.style.opacity='0'; setTimeout(()=>el.remove(),320); },6000);
  }catch(_){}
}
function iniciarTempoRealGestao(){
  if(!window.EventSource||!token)return;
  const url=API+'/api/tempo-real?token='+encodeURIComponent(token);
  let es,jaConectou=false;
  const conectar=()=>{ es=new EventSource(url); es.addEventListener('conta_desativada',()=>{es.close();window.BiblioBetaAPI?.contaDesativada?.()}); es.addEventListener('conta_excluida',()=>{es.close();window.BiblioBetaAPI?.contaExcluida?.()}); es.addEventListener('notificacao',()=>recarregarTudo()); es.addEventListener('livro_cadastrado',ev=>{ try{ mostrarAvisoLivro(JSON.parse(ev.data||'{}')); }catch(_){} }); es.addEventListener('atualizar',()=>recarregarTudo()); es.addEventListener('conectado',ev=>{ try{ const v=JSON.parse(ev.data||'{}').versao; if(v){ if(window.__bbVersaoSite&&window.__bbVersaoSite!==v){ location.reload(); return; } window.__bbVersaoSite=v; } }catch(_){} }); es.onopen=()=>{if(jaConectou)recarregarTudo();jaConectou=true}; es.onerror=()=>{es.close();setTimeout(conectar,3000)}; };
  conectar();
}
async function iniciar(){
  try{
    // Nome já aparece do cache (linha acima); a conferência com o servidor roda em paralelo
    // com o carregamento dos dados, em vez de travar tudo até a API responder.
    setTexto('#dashboardNome',usuario.nome);
    api('/api/auth/me').then(me=>{
      usuario=me.usuario;
      try{localStorage.setItem('bibliobeta_usuario',JSON.stringify(usuario))}catch{}
      $$('#userName').forEach(x=>x.textContent=usuario.nome||'Gestão');
      $('#userAvatar')?.replaceChildren(document.createTextNode(iniciais(usuario.nome)));
      setTexto('#dashboardNome',usuario.nome);
    }).catch(e=>console.warn('Sessão:',e.message));

    // Carrega primeiro o que aparece e é usado na tela inicial.
    // As áreas administrativas secundárias ficam para logo depois, reduzindo
    // o pico de requisições em celulares antigos ou conexões Wi-Fi mais lentas.
    await Promise.all([
      carregarDashboard(),
      carregarUsuarios(),
      carregarExemplares(),
      carregarEmprestimos(),
      carregarSolicitacoes(),
      carregarNotificacoes()
    ]);

    setTimeout(()=>{
      Promise.all([
        carregarCadastrosPendentes(),
        carregarTurmas(),
        carregarConfig(),carregarCobrancaAuto(),
        carregarEmailCategorias(),
        carregarEquipe(),
        carregarReservas(),
        carregarMultas(),
        carregarRelatorios(),
        carregarContatos(),
        carregarAcervoAdmin()
      ]).catch(e=>console.warn('Carregamento secundário da Gestão:',e));
    },350);
  }catch(e){console.error(e)}
}
 $('#fecharCodigoOperacao')?.addEventListener('click',fecharCodigoOperacao);$('#cancelarCodigoOperacao')?.addEventListener('click',fecharCodigoOperacao);$('#confirmarCodigoOperacao')?.addEventListener('click',confirmarCodigoOperacao);$('#codigoOperacaoModal')?.addEventListener('click',e=>{if(e.target.closest('[data-fechar-codigo]'))fecharCodigoOperacao()});$('#codigoOperacaoInput')?.addEventListener('keydown',e=>{if(e.key==='Enter')confirmarCodigoOperacao()});

 // ===== Relatórios: escolher qual relatório gerar e baixar em CSV =====
 const fmtDia=v=>{if(!v)return '';const d=new Date(v);return isNaN(d)?'':d.toLocaleDateString('pt-BR')};
 const dentroPeriodo=(v,dias)=>{if(!dias)return true;const t=new Date(v).getTime();return !isNaN(t)&&t>=Date.now()-dias*86400000};
 const ROTULO_EMP={ativo:'Em aberto',atrasado:'Atrasado',devolvido:'Devolvido'};
 const COLS_EMP=['Usuário','Livro','Exemplar','Empréstimo','Devolução prevista','Devolução','Status'];
 const linhaEmp=e=>[e.usuario,e.titulo,e.codigo,fmtDia(e.data_emprestimo),fmtDia(e.data_prevista_devolucao),fmtDia(e.data_devolucao),ROTULO_EMP[e.status]||e.status];
 const RELATORIOS={
  'emprestimos':async d=>({cols:COLS_EMP,linhas:(await api('/api/emprestimos')).filter(e=>dentroPeriodo(e.data_emprestimo,d)).map(linhaEmp)}),
  'devolucoes':async d=>({cols:COLS_EMP,linhas:(await api('/api/emprestimos')).filter(e=>e.status==='devolvido'&&dentroPeriodo(e.data_devolucao,d)).map(linhaEmp)}),
  'atrasos':async()=>({cols:COLS_EMP.concat('Dias de atraso'),linhas:(await api('/api/emprestimos')).filter(e=>e.status!=='devolvido'&&new Date(e.data_prevista_devolucao)<new Date()).map(e=>linhaEmp(e).concat(Math.max(1,Math.floor((Date.now()-new Date(e.data_prevista_devolucao))/86400000))))}),
  'reservas':async d=>({cols:['Usuário','Livro','Data da reserva','Status'],linhas:(await api('/api/reservas')).filter(r=>dentroPeriodo(r.data_reserva,d)).map(r=>[r.usuario,r.titulo,fmtDia(r.data_reserva),r.status])}),
  'multas':async d=>({cols:['Usuário','Livro','Punição','Detalhes','Até','Status'],linhas:(await api('/api/penalidades')).filter(x=>!x.criada_em||dentroPeriodo(x.criada_em,d)).map(x=>[x.usuario,x.titulo||'',rotuloPenalidade(x),x.descricao||'',x.tipo==='bloqueio_regularizacao'?'Até devolver':fmtDia(x.fim_em),x.status])}),
  'livros':async()=>({cols:['Título','Autor','ISBN','Editora','Categoria','Gêneros','Exemplares','Disponíveis'],linhas:(await api('/api/livros')).map(l=>[l.titulo,l.autor,l.isbn||'',l.editora||'',l.categoria||'',(l.generos||[]).map(g=>g.nome).join(', '),l.quantidade,l.disponiveis])}),
  'mais-emprestados':async d=>{const m=new Map();(await api('/api/emprestimos')).filter(e=>dentroPeriodo(e.data_emprestimo,d)).forEach(e=>{const k=e.livro_id||e.titulo;const x=m.get(k)||{titulo:e.titulo,n:0};x.n++;m.set(k,x)});return{cols:['Posição','Livro','Empréstimos'],linhas:[...m.values()].sort((a,b)=>b.n-a.n||String(a.titulo).localeCompare(b.titulo,'pt-BR')).map((x,i)=>[i+1,x.titulo,x.n])}},
  'leitores':async()=>{const [us,al]=await Promise.all([api('/api/usuarios'),api('/api/alunos')]);const am=new Map(al.map(a=>[a.id,a]));return{cols:['Nome','Categoria','E-mail','Identificação','Cadastrado em','Status'],linhas:us.filter(u=>u.tipo==='aluno'||u.tipo==='professor').map(u=>{const a=am.get(u.id);return[u.nome,u.tipo==='aluno'?'Aluno':'Professor',u.email,a?((formatarSerie(a.serie)||'')+(a.turma?' — Turma '+a.turma:'')):'',fmtDia(u.criado_em),u.status==='inativo'?'Inativo':'Ativo']})}},
  'novos-cadastros':async d=>{const r=await RELATORIOS.leitores(0);const us=(await api('/api/usuarios')).filter(u=>(u.tipo==='aluno'||u.tipo==='professor')&&dentroPeriodo(u.criado_em,d)).map(u=>u.email);return{cols:r.cols,linhas:r.linhas.filter(l=>us.includes(l[2]))}}
 };
 const SEM_PERIODO=['atrasos','livros','leitores'];
 const REL_NOME={'emprestimos':'Empréstimos','devolucoes':'Devoluções','atrasos':'Atrasos','reservas':'Reservas','multas':'Multas e punições','livros':'Livros (acervo)','mais-emprestados':'Livros mais emprestados','leitores':'Leitores','novos-cadastros':'Novos cadastros'};
 // Filtros de cada relatório: "col" é a posição da coluna; "multi" separa valores por vírgula (ex.: gêneros)
 const FILTROS_LEITORES=[{col:1,nome:'Categoria'},{col:3,nome:'Série / Turma'},{col:5,nome:'Status'}];
 const REL_FILTROS={
  'emprestimos':[{col:6,nome:'Status'}],
  'devolucoes':[],
  'atrasos':[],
  'reservas':[{col:3,nome:'Status'}],
  'multas':[{col:2,nome:'Punição'},{col:5,nome:'Status'}],
  'livros':[{col:5,nome:'Gênero',multi:true},{col:4,nome:'Categoria'},{col:1,nome:'Autor'},{col:3,nome:'Editora'},{disp:true,nome:'Só livros com exemplar disponível'}],
  'mais-emprestados':[],
  'leitores':FILTROS_LEITORES,
  'novos-cadastros':FILTROS_LEITORES
 };
 let relBase=null,relSeq=0,relTimer=null,relTipoAtual=null;
 const relSel={ocultas:new Set(),filtros:{},busca:'',disp:false};
 const relNorm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const relTipo=()=>document.querySelector('input[name="relTipo"]:checked')?.value||'emprestimos';
 const relDias=()=>Number($('#relPeriodo')?.value||0);
 async function relMontar(){const t=relTipo();return RELATORIOS[t](SEM_PERIODO.includes(t)?0:relDias())}

 // Lê o que está marcado na tela (filtros e colunas) e guarda em relSel
 function relLerControles(){
  const g=$('#relGerador');if(!g||!$('#relBusca'))return;
  relSel.busca=$('#relBusca').value;
  relSel.filtros={};g.querySelectorAll('[data-rel-filtro]').forEach(x=>{if(x.value)relSel.filtros[x.dataset.relFiltro]=x.value});
  relSel.disp=!!g.querySelector('[data-rel-disp]:checked');
  const oc=new Set();g.querySelectorAll('[data-rel-col]').forEach(c=>{if(!c.checked)oc.add(Number(c.dataset.relCol))});
  relSel.ocultas=oc;
 }
 function relValores(s){
  const set=new Set();
  relBase.linhas.forEach(l=>{const c=String(l[s.col]??'').trim();if(!c)return;(s.multi?c.split(',').map(x=>x.trim()):[c]).forEach(x=>{if(x)set.add(x)})});
  return [...set].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 }
 function relDesenharControles(){
  const t=relTipo(),specs=REL_FILTROS[t]||[];
  let h='<label class="rel-campo rel-campo--busca"><span>Buscar</span><input type="search" id="relBusca" placeholder="Nome, livro, autor..." value="'+escapar(relSel.busca)+'"></label>';
  specs.forEach(s=>{
   if(s.disp){h+='<label class="rel-check rel-check--largo"><input type="checkbox" data-rel-disp'+(relSel.disp?' checked':'')+'> '+escapar(s.nome)+'</label>';return}
   const vals=relValores(s);if(!vals.length)return;
   h+='<label class="rel-campo"><span>'+escapar(s.nome)+'</span><select data-rel-filtro="'+s.col+'"><option value="">Todos</option>'+vals.map(v=>'<option value="'+escapar(v)+'"'+(relSel.filtros[s.col]===v?' selected':'')+'>'+escapar(v)+'</option>').join('')+'</select></label>';
  });
  $('#relFiltros').innerHTML=h;
  $('#relColunas').innerHTML=relBase.cols.map((c,i)=>'<label class="rel-check"><input type="checkbox" data-rel-col="'+i+'"'+(relSel.ocultas.has(i)?'':' checked')+'> '+escapar(c)+'</label>').join('');
 }
 // Aplica busca, filtros e colunas escolhidas sobre os dados completos
 function relFiltrada(){
  if(!relBase)return null;
  relLerControles();
  const t=relTipo(),specs=REL_FILTROS[t]||[],termo=relNorm(relSel.busca.trim());
  const linhas=relBase.linhas.filter(l=>{
   if(termo&&!l.some(c=>relNorm(c).includes(termo)))return false;
   for(const s of specs){
    if(s.disp){if(relSel.disp&&!(Number(l[7])>0))return false;continue}
    const v=relSel.filtros[s.col];if(!v)continue;
    const c=String(l[s.col]??'').trim();
    if(s.multi){if(!c.split(',').map(x=>x.trim()).includes(v))return false}else if(c!==v)return false;
   }
   return true;
  });
  const idx=relBase.cols.map((_,i)=>i).filter(i=>!relSel.ocultas.has(i));
  const desc=[];
  if(relSel.busca.trim())desc.push('Busca: "'+relSel.busca.trim()+'"');
  specs.forEach(s=>{if(s.disp){if(relSel.disp)desc.push(s.nome)}else if(relSel.filtros[s.col])desc.push(s.nome+': '+relSel.filtros[s.col])});
  return{cols:idx.map(i=>relBase.cols[i]),linhas:linhas.map(l=>idx.map(i=>l[i])),total:relBase.linhas.length,desc};
 }
 function relAplicar(){
  const box=$('#relPrevia'),res=$('#relResumo');if(!box||!res)return;
  const r=relFiltrada();if(!r)return;
  const t=relTipo(),sem=SEM_PERIODO.includes(t),sel=$('#relPeriodo');
  res.textContent=r.linhas.length+' de '+r.total+' registro'+(r.total===1?'':'s')+(sem?' (situação de hoje)':' — '+sel.options[sel.selectedIndex].text.toLowerCase())+(r.linhas.length>5?'. Prévia das 5 primeiras linhas:':'.');
  const fi=$('#relFiltrosInfo'),ci=$('#relColsInfo');
  if(fi)fi.textContent=r.desc.length?r.desc.length+(r.desc.length===1?' filtro ativo':' filtros ativos'):'Nenhum filtro ativo.';
  if(ci)ci.textContent=r.cols.length+' de '+relBase.cols.length+' colunas no relatório';
  box.innerHTML=r.linhas.length?'<table class="data-table"><thead><tr>'+r.cols.map(c=>'<th>'+escapar(c)+'</th>').join('')+'</tr></thead><tbody>'+r.linhas.slice(0,5).map(l=>'<tr>'+l.map(c=>'<td>'+escapar(c)+'</td>').join('')+'</tr>').join('')+'</tbody></table>':'<p class="rel-vazio">Nenhum registro com esses filtros.</p>';
 }
 async function relCarregar(){
  const res=$('#relResumo');if(!res)return;
  const seq=++relSeq;res.textContent='Carregando prévia...';
  try{
   const t=relTipo(),r=await relMontar();if(seq!==relSeq)return;
   if(relTipoAtual===t)relLerControles();
   else{relTipoAtual=t;relSel.ocultas=new Set();relSel.filtros={};relSel.busca='';relSel.disp=false}
   relBase=r;$('#relPeriodo').disabled=SEM_PERIODO.includes(t);
   relDesenharControles();relAplicar();
  }catch(e){if(seq===relSeq){res.textContent=e.message||'Não foi possível montar o relatório.';$('#relPrevia').innerHTML='';relBase=null}}
 }
 function relAgendar(){clearTimeout(relTimer);relTimer=setTimeout(relCarregar,120)}
 const csvCelula=v=>{let t=String(v??'');if(/^[=+\-@\t]/.test(t)&&!/^-?\d+([.,]\d+)?$/.test(t))t="'"+t;return '"'+t.replace(/"/g,'""')+'"'};
 function baixarArquivo(blob,nome){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=nome;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500)}
 // Mudou o tipo de relatório ou o período: busca os dados de novo
 $('#relGerador')?.addEventListener('change',e=>{if(e.target.matches('input[name="relTipo"],#relPeriodo'))relAgendar()});
 // Mexeu em filtro, busca ou coluna: só reaplica (instantâneo)
 $('#relGerador')?.addEventListener('input',e=>{if(e.target.matches('#relBusca'))relAplicar()});
 $('#relGerador')?.addEventListener('change',e=>{
  if(e.target.matches('[data-rel-col]')&&!$('#relGerador').querySelector('[data-rel-col]:checked')){e.target.checked=true;const m=$('#relMensagem');if(m)m.textContent='Deixe pelo menos uma coluna marcada.';return}
  if(e.target.matches('[data-rel-filtro],[data-rel-disp],[data-rel-col]'))relAplicar();
 });
 $('#relLimpar')?.addEventListener('click',()=>{
  const g=$('#relGerador');$('#relBusca')&&($('#relBusca').value='');
  g.querySelectorAll('[data-rel-filtro]').forEach(x=>x.value='');g.querySelectorAll('[data-rel-disp]').forEach(x=>x.checked=false);relAplicar();
 });
 $('#relColsTodas')?.addEventListener('click',()=>{$('#relGerador').querySelectorAll('[data-rel-col]').forEach(x=>x.checked=true);relAplicar()});
 $('#nav-relatorios')?.addEventListener('change',relAgendar);
 async function relExportar(formato){
  const b=formato==='pdf'?$('#btnRelPdf'):$('#btnGerarRelatorio'),msg=$('#relMensagem'),rotulo=b.textContent;
  try{
   $('#btnGerarRelatorio').disabled=true;$('#btnRelPdf').disabled=true;b.textContent='Gerando...';if(msg)msg.textContent='';
   relBase=await relMontar();
   const r=relFiltrada();
   if(!r||!r.linhas.length){if(msg)msg.textContent='Nenhum registro com esses filtros.';return}
   const t=relTipo(),dia=new Date().toISOString().slice(0,10);
   if(formato==='pdf'){
    if(!window.BiblioBetaPDF)throw new Error('O gerador de PDF não carregou. Atualize a página (Ctrl+F5).');
    const sel=$('#relPeriodo'),info=['Gerado em '+new Date().toLocaleString('pt-BR')+' · '+r.linhas.length+' registro'+(r.linhas.length===1?'':'s')+(r.linhas.length!==r.total?' (de '+r.total+')':'')];
    info.push(SEM_PERIODO.includes(t)?'Situação de hoje':'Período: '+sel.options[sel.selectedIndex].text);
    if(r.desc.length)info.push('Filtros: '+r.desc.join(' · '));
    baixarArquivo(window.BiblioBetaPDF.gerar({titulo:'Relatório — '+REL_NOME[t],info,cols:r.cols,linhas:r.linhas}),'bibliobeta-'+t+'-'+dia+'.pdf');
    if(msg)msg.textContent='PDF baixado.';
   }else{
    const csv='\ufeff'+[r.cols].concat(r.linhas).map(l=>l.map(csvCelula).join(';')).join('\r\n');
    baixarArquivo(new Blob([csv],{type:'text/csv;charset=utf-8'}),'bibliobeta-'+t+'-'+dia+'.csv');
    if(msg)msg.textContent='Relatório baixado.';
   }
   relAplicar();
  }catch(e){if(msg)msg.textContent=e.message||'Não foi possível gerar o relatório.'}
  finally{$('#btnGerarRelatorio').disabled=false;$('#btnRelPdf').disabled=false;b.textContent=rotulo}
 }
 $('#btnGerarRelatorio')?.addEventListener('click',()=>relExportar('csv'));
 $('#btnRelPdf')?.addEventListener('click',()=>relExportar('pdf'));
 setTimeout(relAgendar,800);
 iniciar();iniciarTempoRealGestao();setInterval(()=>{if(!document.hidden)recarregarTudo()},30000);
})();