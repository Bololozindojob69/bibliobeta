/* =====================================================
   PAINEL - tema + navbar lateral (glider)
   Sistema BiblioBeta
   ===================================================== */
(function () {

  // ---------- Confirmações seguras para ações importantes ----------
  function criarModalConfirmacao() {
    if (document.getElementById('bbConfirmModal')) return;
    const el = document.createElement('div');
    el.id = 'bbConfirmModal';
    el.className = 'bb-confirm-backdrop';
    el.hidden = true;
    el.innerHTML = `<div class="bb-confirm-box" role="dialog" aria-modal="true" aria-labelledby="bbConfirmTitulo">
      <div class="bb-confirm-icone">⚠️</div>
      <h3 id="bbConfirmTitulo">Tem certeza?</h3>
      <p id="bbConfirmMensagem"></p>
      <div class="bb-confirm-acoes">
        <button type="button" class="row-acao-btn" id="bbConfirmCancelar">Cancelar</button>
        <button type="button" class="btn-primario" id="bbConfirmOk">Sim, continuar</button>
      </div>
    </div>`;
    document.body.appendChild(el);
  }
  function confirmarAcao(mensagem, titulo='Tem certeza?') {
    criarModalConfirmacao();
    return new Promise(resolve => {
      const modal=document.getElementById('bbConfirmModal'), msg=document.getElementById('bbConfirmMensagem'), tit=document.getElementById('bbConfirmTitulo');
      msg.textContent=mensagem; tit.textContent=titulo; modal.hidden=false;
      const fechar=(resultado)=>{modal.hidden=true; document.removeEventListener('keydown',tecla); resolve(resultado)};
      const tecla=e=>{if(e.key==='Escape')fechar(false)};
      const ok=document.getElementById('bbConfirmOk'), cancelar=document.getElementById('bbConfirmCancelar');
      const onOk=()=>{limpar();fechar(true)}, onCancel=()=>{limpar();fechar(false)};
      function limpar(){ok.removeEventListener('click',onOk);cancelar.removeEventListener('click',onCancel);modal.removeEventListener('click',fora)}
      function fora(e){if(e.target===modal)onCancel()}
      ok.addEventListener('click',onOk);cancelar.addEventListener('click',onCancel);modal.addEventListener('click',fora);document.addEventListener('keydown',tecla);
    });
  }

  // ---------- Conexão com a API / proteção da página ----------
  const API_URL = window.BiblioBetaAPI?.origin || window.location.origin;
  const token = localStorage.getItem('bibliobeta_token');
  const usuarioLogado = JSON.parse(localStorage.getItem('bibliobeta_usuario') || 'null');
  // Sem login válido, volta para a tela inicial em vez de mostrar o painel
  if (!token || !usuarioLogado) {
    window.location.href = 'Index.html';
    return;
  }

  // ---------- Papel do usuário (aluno ou professor) ----------
  // O painel é único para os dois perfis; só o que é exibido muda.
  const perfilUsuario = usuarioLogado.perfil || {};
  const ehProfessor = usuarioLogado.tipo === 'professor' || !!perfilUsuario.disciplina;
  const papel = ehProfessor ? 'professor' : 'aluno';

  // ---------- Ajusta textos da página conforme o papel ----------
  (function aplicarRotulosPapel() {
    const rotuloTipo = ehProfessor ? 'Professor' : 'Aluno';

    const brandTipo = document.getElementById('sideBrandTipo');
    if (brandTipo) brandTipo.textContent = rotuloTipo;

    const painelTitle = document.getElementById('painelTitle');
    if (painelTitle) document.title = 'Área do ' + rotuloTipo + ' — BiblioBeta';

    const headTitulo = document.getElementById('painelHeadTitulo');
    if (headTitulo) headTitulo.textContent = 'Área do ' + rotuloTipo;

    const headDescricao = document.getElementById('painelHeadDescricao');
    if (headDescricao) {
      headDescricao.textContent = ehProfessor
        ? 'Reserve obras, organize bibliografias e sugira aquisições.'
        : 'Acompanhe seus empréstimos, prazos e o acervo da biblioteca.';
    }

    // No modal de empréstimo, o campo "Série" só faz sentido para aluno;
    // para o professor viramos um campo de texto livre para a disciplina.
    const campoSerieLabel = document.getElementById('campoSerieLabel');
    const campoSerieWrap = document.getElementById('campoSerieWrap');
    if (ehProfessor && campoSerieLabel && campoSerieWrap) {
      campoSerieLabel.textContent = 'Disciplina';
      const selectAntigo = document.getElementById('campoSerie');
      if (selectAntigo && selectAntigo.tagName === 'SELECT') {
        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'campoSerie';
        input.required = true;
        input.placeholder = 'Digite sua disciplina';
        selectAntigo.replaceWith(input);
      }
    }
  })();

  // ---------- Cabeçalho animado: frases que se "digitam" sozinhas ----------
  (function cabecalhoDigitando() {
    const el = document.getElementById('phDigitando') || document.getElementById('phDigitandoGestao');
    if (!el) return;
    const ehGestao = usuarioLogado.tipo === 'gestao';
    const frases = ehGestao
      ? ['Bem-vindo à BiblioBeta 📚', 'Acompanhe os empréstimos do dia', 'Mantenha o acervo em dia ✨', 'Aprove solicitações pendentes 💡']
      : ehProfessor
      ? ['Bem-vindo à BiblioBeta 📚', 'Que obra vai inspirar a aula?', 'Organize sua bibliografia ✨', 'Sugira novos livros ao acervo 💡']
      : ['Bem-vindo à BiblioBeta 📚', 'Qual vai ser a próxima leitura?', 'Um livro, um mundo novo ✨', 'Prazos em dia, leitura em dia ⏰'];
    // Quem prefere menos movimento vê só a primeira frase, parada.
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = frases[0];
      return;
    }
    let f = 0, i = 0, apagando = false;
    function passo() {
      const frase = frases[f];
      i += apagando ? -1 : 1;
      el.textContent = frase.slice(0, i);
      let espera = apagando ? 28 : 65;
      if (!apagando && i === frase.length) { apagando = true; espera = 1800; }
      else if (apagando && i === 0) { apagando = false; f = (f + 1) % frases.length; espera = 350; }
      setTimeout(passo, espera);
    }
    el.textContent = '';
    setTimeout(passo, 400);
  })();

  // Helper para chamar a API sempre com o token de autenticação.
  // Se o token expirar/for inválido, o backend responde 401 e mandamos o usuário para o login de novo.
  async function apiFetch(caminho, opcoes) {
    opcoes = opcoes || {};
    opcoes.headers = Object.assign({
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    }, opcoes.headers || {});

    const resposta = await (window.BiblioBetaAPI?.fetch ? window.BiblioBetaAPI.fetch(caminho, opcoes) : fetch(API_URL + caminho, opcoes));
    if (resposta.status === 401) {
      localStorage.removeItem('bibliobeta_token');
      localStorage.removeItem('bibliobeta_usuario');
      window.location.href = 'Index.html';
      throw new Error('Sessão expirada.');
    }
    return resposta;
  }

  // Botão de sair (se existir na página) limpa a sessão
  document.querySelectorAll('[data-logout]').forEach(function (btn) {
    btn.addEventListener('click', async function (ev) {
      ev.preventDefault();
      if (!await confirmarAcao('Você será desconectado desta conta. Deseja realmente sair?', 'Sair da conta?')) return;
      localStorage.removeItem('bibliobeta_token');
      localStorage.removeItem('bibliobeta_usuario');
      window.location.href = 'Index.html';
    });
  });

  // ---------- Aplica o tema salvo na página inicial ----------
  try {
    const saved = localStorage.getItem('bibliobeta-theme-v1');
    if (saved) {
      const vars = JSON.parse(saved);
      Object.keys(vars).forEach(function (k) {
        document.documentElement.style.setProperty(k, vars[k]);
      });
    }
    if (localStorage.getItem('bibliobeta-theme-select-v1') === 'contraste') {
      document.documentElement.classList.add('alto-contraste');
    }
  } catch (e) { /* tema padrão */ }

  const sideNav = document.getElementById('sideNav');
  const backdrop = document.getElementById('sideBackdrop');
  const logoToggle = document.getElementById('logoToggle');
  const sideToggle = document.getElementById('sideToggle');
  const radios = document.querySelectorAll('.radio-container input[type="radio"]');
  const panes = document.querySelectorAll('.painel-pane');
  const isMobile = () => window.matchMedia('(max-width: 900px)').matches;

  function openNav() {
    sideNav.classList.add('open');
    backdrop.classList.add('show');
  }
  function closeNav() {
    sideNav.classList.remove('open');
    backdrop.classList.remove('show');
  }

  if (logoToggle) {
    logoToggle.addEventListener('click', function () {
      sideNav.classList.contains('open') ? closeNav() : openNav();
    });
  }
  if (backdrop) backdrop.addEventListener('click', closeNav);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeNav();
  });

  // ---------- Navbar recolhida (só ícones) ----------
  const NAV_COLLAPSE_KEY = 'bibliobeta-nav-collapsed';
  function setCollapsed(collapsed) {
    document.body.classList.toggle('nav-collapsed', collapsed);
    if (sideToggle) sideToggle.setAttribute('aria-label', collapsed ? 'Expandir menu' : 'Recolher menu');
    try { localStorage.setItem(NAV_COLLAPSE_KEY, collapsed ? '1' : '0'); } catch (e) { /* ignora */ }
  }
  try {
    if (localStorage.getItem(NAV_COLLAPSE_KEY) === '1' && !isMobile()) setCollapsed(true);
  } catch (e) { /* ignora */ }
  if (sideToggle) {
    sideToggle.addEventListener('click', function () {
      setCollapsed(!document.body.classList.contains('nav-collapsed'));
    });
  }

  // ---------- Troca de painel ----------
  function mostrarPane(alvo) {
    panes.forEach(function (p) {
      p.classList.toggle('active', p.id === 'pane-' + alvo);
    });
    // A animação do topo só aparece no início (aluno/professor: "inicio", gestão: "dashboard")
    document.body.classList.toggle('fora-do-inicio', alvo !== 'inicio' && alvo !== 'dashboard');
  }

  radios.forEach(function (r) {
    r.addEventListener('change', function () {
      mostrarPane(r.value);
      if (isMobile()) setTimeout(closeNav, 260);
    });
  });

  const marcado = document.querySelector('.radio-container input:checked');
  if (marcado) mostrarPane(marcado.value);

  // ---------- Glider (brilho lateral) sempre alinhado ao item marcado ----------
  // Antes a posição era "N x 100%" da altura do glider (altura = 100% / --total-radio).
  // Se --total-radio não batia com a quantidade real de itens, o brilho ia "escorregando"
  // para baixo. Agora a posição/altura vêm direto do label marcado.
  (function gliderPreciso() {
    const cont = document.querySelector('.radio-container');
    const glider = cont && cont.querySelector('.glider');
    if (!glider) return;
    function posicionar(semAnim) {
      const r = cont.querySelector('input:checked');
      const l = r && cont.querySelector('label[for="' + r.id + '"]');
      if (!l || !l.offsetHeight) return;
      if (semAnim) glider.style.transition = 'none';
      glider.style.height = l.offsetHeight + 'px';
      glider.style.transform = 'translateY(' + l.offsetTop + 'px)';
      if (semAnim) { void glider.offsetHeight; glider.style.transition = ''; }
    }
    cont.querySelectorAll('input[type="radio"]').forEach(function (r) {
      r.addEventListener('change', function () { posicionar(false); });
    });
    window.addEventListener('resize', function () { posicionar(true); });
    window.addEventListener('load', function () { posicionar(true); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { posicionar(true); });
    if (window.ResizeObserver) new ResizeObserver(function () { posicionar(true); }).observe(cont);
    posicionar(true);
  })();

  window.addEventListener('resize', function () {
    if (!isMobile()) closeNav();
  });

  // ---------- Topbar: sino de notificações + dropdown de perfil ----------
  (function initTopbar() {
    const bell = document.getElementById('topbarBell');
    const notifPanel = document.getElementById('topbarNotif');
    const userBtn = document.getElementById('topbarUser');

    function fecharTudo() {
      if (notifPanel) notifPanel.hidden = true;
      if (userBtn) userBtn.classList.remove('open');
    }

    if (bell && notifPanel) {
      bell.addEventListener('click', function (e) {
        e.stopPropagation();
        const abrindo = notifPanel.hidden;
        fecharTudo();
        notifPanel.hidden = !abrindo;
      });

      notifPanel.querySelectorAll('[data-fecha-nav]').forEach(function (link) {
        link.addEventListener('click', function (e) {
          const alvo = link.getAttribute('data-fecha-nav');
          const radio = document.getElementById('nav-' + alvo);
          if (radio) {
            e.preventDefault();
            radio.checked = true;
            radio.dispatchEvent(new Event('change'));
          }
          fecharTudo();
        });
      });
    }

    if (userBtn) {
      userBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        const abrindo = !userBtn.classList.contains('open');
        fecharTudo();
        if (abrindo) userBtn.classList.add('open');
      });

      userBtn.querySelectorAll('[data-fecha-nav]').forEach(function (link) {
        link.addEventListener('click', function (e) {
          const alvo = link.getAttribute('data-fecha-nav');
          const radio = document.getElementById('nav-' + alvo);
          if (radio) {
            e.preventDefault();
            radio.checked = true;
            radio.dispatchEvent(new Event('change'));
          }
          fecharTudo();
        });
      });
    }

    document.addEventListener('click', fecharTudo);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') fecharTudo();
    });
  })();

  // ---------- Status automático por data (coluna "Devolução") ----------
  function calcularAtrasado(dataStr) {
    // aceita "18/08" ou "18/08/2026"
    const partes = dataStr.trim().split('/').map(Number);
    if (partes.length < 2 || !partes[0] || !partes[1]) return null;
    const hoje = new Date();
    const ano = partes[2] || hoje.getFullYear();
    const limite = new Date(ano, partes[1] - 1, partes[0], 23, 59, 59);
    return limite.getTime() < hoje.getTime();
  }

  function atualizarBadgesPorData() {
    document.querySelectorAll('.data-table').forEach(function (tabela) {
      const headers = Array.from(tabela.querySelectorAll('thead th')).map(th => th.textContent.trim());
      const idxDevolucao = headers.findIndex(h => h.toLowerCase().startsWith('devolu'));
      if (idxDevolucao === -1) return;

      tabela.querySelectorAll('tbody tr').forEach(function (linha) {
        const celulas = linha.querySelectorAll('td');
        const celulaData = celulas[idxDevolucao];
        const badge = linha.querySelector('.badge');
        if (!celulaData || !badge) return;

        const atrasado = calcularAtrasado(celulaData.textContent);
        if (atrasado === true && !badge.classList.contains('badge-atrasado')) {
          badge.className = 'badge badge-atrasado';
          badge.textContent = 'Atrasado';
        }
      });
    });
  }

  // ---------- Busca: toda a lógica fica em busca.js (BiblioBetaBusca) ----------
  const B = window.BiblioBetaBusca || {
    // Plano B simples caso o busca.js não carregue (a tela continua funcionando).
    bate: function (t) { const c = Array.prototype.slice.call(arguments, 1).join(' ').toLowerCase(); return !t || String(t).toLowerCase().split(/\s+/).every(function (p) { return c.indexOf(p) !== -1; }); },
    ligar: function (i, f) { if (i) i.addEventListener('input', function () { f(i.value); }); },
    tabelas: function () {}
  };

  function initFiltroTabelas() { B.tabelas(); }

  // ---------- BiblioBeta: "banco de dados" + funções reais do aluno ----------
  initBiblioteca();

  atualizarBadgesPorData();
  initFiltroTabelas();

  function initBiblioteca() {
    // Base de dados isolada por usuário, para não misturar empréstimos/reservas
    // simulados de uma conta com os de outra no mesmo navegador.
    const DB_KEY = 'bibliobeta-db-v1-' + usuarioLogado.id;

    function hojeISO() {
      const d = new Date();
      return d.toISOString().slice(0, 10);
    }

    // Monta o perfil do aluno a partir do usuário realmente logado (vindo do backend).
    // Empréstimos, reservas, histórico, favoritos e notificações são sincronizados
    // com o backend; localStorage serve apenas como cache da interface.
    function seedDB() {
      const perfil = (usuarioLogado && usuarioLogado.perfil) || {};
      return {
        aluno: {
          nome: usuarioLogado.nome || 'Usuário',
          serie: perfil.serie || perfil.turma || perfil.disciplina || '-',
          matricula: perfil.ra || perfil.matricula || '-',
          email: usuarioLogado.email || '-'
        },
        livros: [], // preenchido a partir de GET /api/livros em carregarLivrosReais()
        emprestimos: [],
        reservas: [],
        historico: [],
        favoritos: [],
        notificacoes: [],
        solicitacoes: []
      };
    }

    function getDB() {
      try {
        const raw = localStorage.getItem(DB_KEY);
        const salvo = raw ? JSON.parse(raw) : null;
        // Nunca reutiliza dados locais de outro usuário. O backend é a fonte de verdade.
        if (salvo && salvo._usuarioId === usuarioLogado?.id) return salvo;
      } catch (e) { /* ignora e recria */ }
      const db = seedDB();
      db._usuarioId = usuarioLogado?.id || null;
      saveDB(db);
      return db;
    }

    // Paleta usada para colorir as capas dos livros vindos do backend (que não tem campo "cor")
    const PALETA_CAPAS = ['#8d5a2b', '#b9650a', '#6b4a8a', '#c9822f', '#3d2b1f', '#e0942c', '#a14b2b', '#43506b', '#7a3e2b', '#3e8f6b', '#5c4a3d', '#2c6e7a', '#4a4a4a', '#8a6d3b', '#2f2f2f'];

    // Busca o catálogo real de livros no backend e substitui os dados simulados
    async function carregarLivrosReais() {
      try {
        const resposta = await apiFetch('/api/livros');
        if (!resposta.ok) return;
        const dados = await resposta.json();
        const lista = Array.isArray(dados) ? dados : (dados.livros || []);
        db.livros = lista.map(function (l, i) {
          return {
            id: l.id,
            titulo: l.titulo,
            autor: l.autor,
            categoria: l.categoria || 'Geral',
            generos: (l.generos || []).map(function (g) { return g.nome; }),
            isbn: l.isbn || '',
            capa: l.capa || (l.isbn ? 'https://covers.openlibrary.org/b/isbn/' + encodeURIComponent(l.isbn) + '-M.jpg' : ''),
            cor: PALETA_CAPAS[i % PALETA_CAPAS.length],
            disponivel: (l.disponiveis === undefined ? l.quantidade : l.disponiveis) > 0
          };
        });
        saveDB(db);
        // O catálogo e os dados pessoais são sincronizados separadamente.
        // Evita repetir 6 requisições à API no primeiro carregamento.
        renderTudo();
      } catch (e) {
        // Se o backend estiver fora do ar, mantém a tela funcionando com o catálogo vazio
        console.warn('Não foi possível carregar os livros do backend:', e.message);
      }
    }

    async function sincronizarBibliotecaReal() {
      try {
        const [empResp,resResp,solResp,notifResp,favResp,penResp]=await Promise.all([apiFetch('/api/emprestimos/meus'),apiFetch('/api/reservas/minhas'),apiFetch('/api/solicitacoes-emprestimo/minhas'),apiFetch('/api/notificacoes'),apiFetch('/api/favoritos'),apiFetch('/api/penalidades')]);
        if(empResp.ok){ const arr=await empResp.json(); db.emprestimos=arr.map(e=>({id:e.id,livroId:e.livro_id,dataRetirada:String(e.data_emprestimo||'').slice(0,10),dataDevolucao:String(e.data_prevista_devolucao||'').slice(0,10),dataDevolucaoReal:String(e.data_devolucao||'').slice(0,10),renovacoes:e.renovacoes,status:e.status,codigo:e.codigo,codigoSeguranca:e.codigo_seguranca,codigoDevolucao:e.codigo_devolucao,retiradaConfirmada:e.retirada_confirmada,titulo:e.titulo,autor:e.autor,avisoDevolucao:e.aviso_devolucao})); }
        if(resResp.ok){ const arr=await resResp.json(); db.reservas=arr.map(r=>({id:r.id,livroId:r.livro_id,dataReserva:String(r.data_reserva||'').slice(0,10),status:r.status})); }
        if(solResp.ok){ db.solicitacoes=await solResp.json(); }
        if(notifResp.ok){ db.notificacoes=await notifResp.json(); }
        if(favResp.ok){ const arr=await favResp.json(); db.favoritos=arr.map(f=>Number(f.livro_id)); }
        if(penResp.ok){ db.penalidades=await penResp.json(); }
        db.historico=db.emprestimos.filter(e=>e.status==='devolvido'); saveDB(db);
      }catch(e){console.warn('Não foi possível sincronizar empréstimos/notificações:',e.message)}
    }

    function saveDB(db) {
      try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch (e) { /* armazenamento indisponível */ }
    }

    let db = getDB();
    const livroPorId = id => db.livros.find(l => l.id === Number(id));

    function formatarBR(iso) {
      if (!iso) return '';
      const [ano, mes, dia] = iso.split('-');
      return dia + '/' + mes;
    }

    function diasRestantes(iso) {
      const hoje = new Date(hojeISO() + 'T00:00:00');
      const alvo = new Date(iso + 'T00:00:00');
      return Math.round((alvo - hoje) / 86400000);
    }

    function statusEmprestimo(emp) {
      const dias = diasRestantes(emp.dataDevolucao);
      if (dias < 0) return { classe: 'badge-atrasado', texto: 'Atrasado' };
      if (dias <= 3) return { classe: 'badge-pendente', texto: dias === 0 ? 'Vence hoje' : 'Vence em ' + dias + ' dias' };
      return { classe: 'badge-ativo', texto: 'No prazo' };
    }

    function gerarCodigo() {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const bloco = n => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      return bloco(4) + '-' + bloco(4);
    }

    function novoId(prefixo) {
      return prefixo + Date.now().toString(36) + Math.floor(Math.random() * 100);
    }

    // ---------- Topbar: nome, avatar e notificações reais do aluno ----------
    function renderTopbarAluno() {
      const userName = document.getElementById('userName');
      if (!userName) return;
      userName.textContent = 'Olá, ' + db.aluno.nome.split(' ')[0] + '!';
      const avatarEl = document.getElementById('userAvatar');
      if (avatarEl) avatarEl.textContent = db.aluno.nome.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
      const notificacoes = (db.notificacoes || []).filter(n => !Number(n.lida)).slice(0,8).map(n => ({id:n.id,titulo:n.titulo,texto:n.mensagem}));
      const badge = document.getElementById('bellBadge');
      const lista = document.getElementById('topbarNotifLista');
      if (badge) { badge.hidden = notificacoes.length === 0; badge.textContent = notificacoes.length; }
      if (lista) lista.innerHTML = notificacoes.length ? notificacoes.map(n => `<li data-notif-id="${n.id}"><strong>${n.titulo}</strong><span>${n.texto}</span></li>`).join('') : '<li class="notif-vazio">Nenhuma notificação por aqui.</li>';
    }

    document.addEventListener('click', async function(e){
      const item=e.target.closest('[data-notif-id]');
      if(!item)return;
      try{await apiFetch('/api/notificacoes/'+item.dataset.notifId+'/lida',{method:'PUT'}); await sincronizarBibliotecaReal(); renderTudo();}catch(_){}
    });

    // ---------- Página "Notificações": lista completa (novas e antigas) ----------
    function formatarDataHora(iso) {
      if (!iso) return '-';
      return new Date(iso).toLocaleDateString('pt-BR');
    }

    function renderNotificacoesAluno() {
      const tabela = document.getElementById('notificacoesAlunoLista');
      const vazio = document.getElementById('notificacoesAlunoVazio');
      if (!tabela) return;
      const lista = db.notificacoes || [];
      const naoLidas = lista.filter(n => !Number(n.lida)).length;

      // badge no item de menu, igual ao sininho do topo
      const navBadge = document.getElementById('navNotifBadge');
      if (navBadge) { navBadge.hidden = naoLidas === 0; navBadge.textContent = naoLidas; }

      if (!lista.length) {
        tabela.innerHTML = '';
        if (vazio) vazio.hidden = false;
        return;
      }
      if (vazio) vazio.hidden = true;

      tabela.innerHTML = lista.map(function (n) {
        const lida = Number(n.lida);
        const statusHtml = lida
          ? '<span class="badge badge-ativo">Lida</span>'
          : '<span class="badge badge-pendente">Nova</span>';
        const acaoHtml = lida
          ? ''
          : '<button type="button" class="row-acao-btn" data-ler-notificacao-aluno="' + n.id + '">Marcar como lida</button>';
        return '<li class="bb-notif' + (lida ? ' bb-notif--lida' : '') + '">'
          + '<div class="bb-notif__icone" aria-hidden="true">🔔</div>'
          + '<div class="bb-notif__corpo">'
          + '<h3 class="bb-notif__titulo">' + (n.titulo || '') + '</h3>'
          + '<p class="bb-notif__msg">' + (n.mensagem || '') + '</p>'
          + '<p class="bb-notif__meta">' + formatarDataHora(n.criado_em) + '</p>'
          + '</div>'
          + '<div class="bb-notif__acoes">' + statusHtml + acaoHtml + '</div>'
          + '</li>';
      }).join('');
    }

    document.addEventListener('click', async function (e) {
      const marcarUma = e.target.closest('[data-ler-notificacao-aluno]');
      if (marcarUma) {
        try {
          await apiFetch('/api/notificacoes/' + marcarUma.dataset.lerNotificacaoAluno + '/lida', { method: 'PUT' });
          await sincronizarBibliotecaReal();
          renderTudo();
        } catch (_) { /* mantém a lista como está se a API falhar */ }
        return;
      }
      const marcarTodas = e.target.closest('#marcarTodasNotificacoesAluno');
      if (marcarTodas) {
        try {
          await apiFetch('/api/notificacoes/marcar-todas-lidas', { method: 'PUT' });
          await sincronizarBibliotecaReal();
          renderTudo();
        } catch (_) { /* mantém a lista como está se a API falhar */ }
      }
    });

    // ---------- Renderização: Início ----------
    function renderInicio() {
      const nomeEl = document.getElementById('inicioNome');
      if (!nomeEl) return; // não estamos na página do aluno
      nomeEl.textContent = db.aluno.nome.split(' ')[0];

      const ativos = db.emprestimos.filter(e => e.status === 'ativo');
      const proxDevolucao = ativos
        .map(e => diasRestantes(e.dataDevolucao))
        .sort((a, b) => a - b)[0];

      const statsEl = document.getElementById('inicioStats');
      statsEl.innerHTML = `
        <article class="painel-card stat-card stat-clicavel" data-ir-pane="emprestimos" role="link" tabindex="0" aria-label="Ver meus empréstimos">
          <span class="stat-icone icone-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16v12H4z"/><path d="M8 10h8M8 14h5"/></svg></span>
          <div><div class="stat">${ativos.length}</div><h3>Empréstimos ativos</h3><p>Livros que estão com você neste momento.</p></div>
        </article>
        <article class="painel-card stat-card stat-clicavel" data-ir-pane="emprestimos" role="link" tabindex="0" aria-label="Ver prazos de devolução">
          <span class="stat-icone icone-2"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg></span>
          <div><div class="stat">${ativos.length ? Math.max(proxDevolucao, 0) : '—'}</div><h3>Devoluções próximas</h3><p>${ativos.length ? 'Prazo mais próximo: em ' + Math.max(proxDevolucao, 0) + ' dias.' : 'Nenhuma devolução pendente.'}</p></div>
        </article>
        <article class="painel-card stat-card stat-clicavel" data-ir-pane="historico" role="link" tabindex="0" aria-label="Ver meu histórico">
          <span class="stat-icone icone-3"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg></span>
          <div><div class="stat">${db.historico.length}</div><h3>Histórico</h3><p>Total de livros já devolvidos.</p></div>
        </article>
      `;

      const listaEl = document.getElementById('inicioTabelaEmprestimos');
      const vazio = document.getElementById('inicioEmprestimosVazio');
      listaEl.innerHTML = '';
      if (!ativos.length) {
        vazio.hidden = false;
      } else {
        vazio.hidden = true;
        // Mostra primeiro quem vence mais perto — é o que mais importa no resumo do dashboard.
        const ordenados = ativos.slice().sort((a, b) => diasRestantes(a.dataDevolucao) - diasRestantes(b.dataDevolucao));
        const limite = 3;
        ordenados.slice(0, limite).forEach(e => {
          const livro = livroPorId(e.livroId);
          const titulo = livro ? livro.titulo : '—';
          const st = statusEmprestimo(e);
          const iniciais = titulo.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
          const cor = (livro && livro.cor) || 'var(--btn)';
          listaEl.insertAdjacentHTML('beforeend', `
            <article class="emprestimo-item">
              <div class="emprestimo-item-capa" style="background:${cor}">
                ${livro && livro.capa ? `<img src="${livro.capa}" alt="" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><span style="display:none">${iniciais}</span>` : `<span>${iniciais}</span>`}
              </div>
              <div class="emprestimo-item-info">
                <span class="emprestimo-item-titulo">${titulo}</span>
                <span class="emprestimo-item-meta">
                  <span>Devolução: ${formatarBR(e.dataDevolucao)}</span>
                  <span class="badge ${st.classe}">${st.texto}</span>
                </span>
              </div>
            </article>
          `);
        });
        const restantes = ordenados.length - limite;
        if (restantes > 0) {
          listaEl.insertAdjacentHTML('beforeend', `<button type="button" class="card-link emprestimos-ver-mais" data-ir-pane="emprestimos">Ver mais ${restantes} empréstimo${restantes === 1 ? '' : 's'}</button>`);
        }
      }

      renderGraficoLivrosLidos();
    }

    // ---------- Gráfico "Livros lidos por mês" (Início) ----------
    const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    function escaparTexto(v) {
      return String(v ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    }

    function gerarUltimosMeses(qtd) {
      const arr = [];
      const base = new Date(); base.setDate(1); base.setHours(0, 0, 0, 0);
      for (let i = qtd - 1; i >= 0; i--) {
        const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
        arr.push({
          chave: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'),
          label: MESES_ABREV[d.getMonth()],
          dataLonga: MESES_ABREV[d.getMonth()] + ' de ' + d.getFullYear(),
          total: 0,
          livros: []
        });
      }
      return arr;
    }

    function renderGraficoBarrasReal(containerId, itens, comLivros, chaveAtual) {
      const cont = document.getElementById(containerId);
      if (!cont) return;
      const max = Math.max(1, ...itens.map(d => d.total));
      const colsHtml = itens.map(d => {
        const alturaPct = d.total ? Math.max(8, Math.round((d.total / max) * 100)) : 4;
        const ehMax = d.total > 0 && d.total === max;
        const ehAtual = chaveAtual && d.chave === chaveAtual;
        const livrosAttr = comLivros ? escaparTexto(d.livros && d.livros.length ? d.livros.join(', ') : 'Nenhum livro registrado') : '';
        return '<button type="button" class="cbr-col' + (ehMax ? ' cbr-col-max' : '') + (ehAtual ? ' cbr-col-hoje' : '') + '" data-total="' + d.total + '" data-data-longa="' + escaparTexto(d.dataLonga) + '"' + (comLivros ? ' data-livros="' + livrosAttr + '"' : '') + '>'
          + '<span class="cbr-valor">' + d.total + '</span>'
          + '<span class="cbr-bar-track"><span class="cbr-bar" style="height:' + alturaPct + '%"></span></span>'
          + '<span class="cbr-label">' + d.label + '</span>'
          + '</button>';
      }).join('');
      cont.innerHTML = '<div class="cbr-linha">' + colsHtml + '</div><p class="cbr-detalhe">Passe o mouse ou toque em um mês para ver os livros.</p>';
      const detalhe = cont.querySelector('.cbr-detalhe');
      function mostrar(col) {
        const total = col.dataset.total, dataLonga = col.dataset.dataLonga, livros = col.dataset.livros;
        let texto = '<strong>' + dataLonga + ':</strong> ' + total + ' livro' + (total === '1' ? '' : 's') + ' lido' + (total === '1' ? '' : 's');
        if (comLivros && Number(total) > 0) texto += ' — ' + livros;
        detalhe.innerHTML = texto;
      }
      cont.querySelectorAll('.cbr-col').forEach(col => {
        col.addEventListener('mouseenter', () => mostrar(col));
        col.addEventListener('focus', () => mostrar(col));
        col.addEventListener('click', () => mostrar(col));
      });
      const destaque = cont.querySelector('.cbr-col-hoje') || cont.querySelector('.cbr-col-max');
      if (destaque) mostrar(destaque);
    }

    function renderGraficoLivrosLidos() {
      const cont = document.getElementById('inicioGraficoLivrosLidos');
      if (!cont) return;
      const meses = gerarUltimosMeses(6);
      const porMes = {};
      meses.forEach(m => porMes[m.chave] = m);
      const chaveAtual = meses[meses.length - 1].chave;
      db.historico.forEach(e => {
        const iso = e.dataDevolucaoReal || e.dataDevolucao || '';
        const chave = iso.slice(0, 7);
        const m = porMes[chave];
        if (m) { m.total++; if (e.titulo) m.livros.push(e.titulo); }
      });
      renderGraficoBarrasReal('inicioGraficoLivrosLidos', meses, true, chaveAtual);
      const totalPeriodo = meses.reduce((s, m) => s + m.total, 0);
      const legenda = document.getElementById('inicioChartCaption');
      if (legenda) legenda.textContent = meses[0].label + ' – ' + meses[meses.length - 1].label + ' · ' + totalPeriodo + ' livro' + (totalPeriodo === 1 ? '' : 's') + ' no total';
    }

    // ---------- Renderização: Catálogo ----------
    let filtroTexto = '';
    let filtroCategoria = 'todos';

    // Livro "aberto" no catálogo: a capa gira e mostra a página de dentro. No computador abre
    // ao passar o mouse; no celular/teclado abre ao tocar/focar. Guardamos qual está aberto
    // para a animação não "resetar" quando o catálogo é redesenhado (favoritar, atualização).
    let livroFixadoId = null;
    let livroHoverId = null;

    // ---- Gêneros do catálogo ----
    let generosLista = []; // [{id,nome,icone,cor,descricao,total}] vindo de /api/generos
    async function carregarGeneros() {
      try {
        const r = await apiFetch('/api/generos');
        if (!r.ok) return;
        const dados = await r.json();
        generosLista = Array.isArray(dados) ? dados : [];
        renderCatalogo();
      } catch (e) { console.warn('Não foi possível carregar os gêneros:', e.message); }
    }
    function corGenero(g) { return /^#[0-9a-f]{6}$/i.test((g && g.cor) || '') ? g.cor : '#8d5a2b'; }

    function cartaoLivroHTML(l) {
      const favoritado = db.favoritos.includes(l.id);
      const iniciais = escaparTexto(l.titulo.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase());
      const titulo = escaparTexto(l.titulo), autor = escaparTexto(l.autor);
      const categoria = (l.generos && l.generos.length)
        ? '<span class="genero-tags">' + l.generos.slice(0, 2).map(n => '<span class="genero-tag" style="--g:' + corGenero(generosLista.find(g => g.nome === n)) + '">' + escaparTexto(n) + '</span>').join('') + (l.generos.length > 2 ? '<span class="genero-tag genero-tag--mais" title="' + escaparTexto(l.generos.slice(2).join(', ')) + '">+' + (l.generos.length - 2) + '</span>' : '') + '</span>'
        : escaparTexto(l.categoria);
      const fixado = String(l.id) === String(livroFixadoId);
      const aberto = fixado || String(l.id) === String(livroHoverId);
      return `
        <article class="livro-card livro-card--3d${aberto ? ' aberto sem-anim' : ''}" data-id="${l.id}">
          <button type="button" class="livro-fav ${favoritado ? 'ativo' : ''}" data-fav="${l.id}" aria-label="Favoritar ${titulo}">${favoritado ? '♥' : '♡'}</button>
          <div class="livro-book">
            <button type="button" class="livro-book__cover" aria-expanded="${fixado}" aria-label="Ver detalhes de ${titulo}" style="background:${l.cor}">
              ${l.capa ? `<img src="${escaparTexto(l.capa)}" alt="Capa de ${titulo}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><span class="livro-capa-fallback" style="display:none">${iniciais}</span>` : `<span class="livro-capa-fallback">${iniciais}</span>`}
              <span class="livro-dica" aria-hidden="true"><span class="livro-dica-icone">👆</span><span class="livro-dica-hover">Passe o mouse</span><span class="livro-dica-toque">Toque para abrir</span></span>
            </button>
            <div class="livro-book__pagina">
              <span class="livro-book__categoria">${categoria}</span>
              <span class="livro-disp ${l.disponivel ? '' : 'indisponivel'}">${l.disponivel ? 'Disponível' : 'Emprestado'}</span>
              ${l.disponivel
                ? `<button type="button" class="livro-btn" data-emprestar="${l.id}">Solicitar empréstimo</button>`
                : `<button type="button" class="livro-btn secundario" data-reservar="${l.id}">Reservar</button>`}
            </div>
          </div>
          <div class="livro-legenda">
            <h3>${titulo}</h3>
            <span class="livro-autor">${autor}</span>
          </div>
        </article>`;
    }

    function renderGaleriaGeneros(contagem, semGenero) {
      const caixa = document.getElementById('catalogoCategorias');
      if (!caixa) return;
      if (!generosLista.length) { caixa.hidden = true; return; }
      caixa.hidden = false;
      const total = db.livros.length;
      const aba = (valor, nome, qtd, cor) => `
        <button type="button" class="genero-aba${filtroCategoria === valor ? ' ativo' : ''}" data-genero="${escaparTexto(valor)}" style="--g:${cor}" aria-pressed="${filtroCategoria === valor}">
          <span class="genero-aba__nome">${escaparTexto(nome)}</span><span class="genero-aba__qtd">${qtd}</span>
        </button>`;
      let html = aba('todos', 'Todos', total, '#6b4226');
      generosLista.forEach(g => {
        const qtd = contagem.get(g.nome) || 0;
        if (qtd) html += aba(g.nome, g.nome, qtd, corGenero(g));
      });
      if (semGenero) html += aba('__sem__', 'Outros', semGenero, '#64748b');
      caixa.innerHTML = html;
    }

    function renderCatalogo() {
      const grid = document.getElementById('catalogoGrid');
      if (!grid) return;
      const vazio = document.getElementById('catalogoVazio');
      const banner = document.getElementById('catalogoBanner');

      const termo = filtroTexto.trim();
      const contagem = new Map();
      let semGenero = 0;
      db.livros.forEach(l => {
        if (!l.generos || !l.generos.length) semGenero++;
        (l.generos || []).forEach(n => contagem.set(n, (contagem.get(n) || 0) + 1));
      });
      // Se o filtro escolhido deixou de existir (gênero apagado), volta para "Todos".
      if (filtroCategoria !== 'todos' && filtroCategoria !== '__sem__' && generosLista.length && !contagem.get(filtroCategoria)) filtroCategoria = 'todos';
      renderGaleriaGeneros(contagem, semGenero);

      const bateTexto = l => !termo || (B.bateLivro || B.bate)(termo, l.titulo, l.autor, l.categoria, l.isbn, l.generos);
      const bateGenero = l => filtroCategoria === 'todos' ||
        (filtroCategoria === '__sem__' ? !(l.generos && l.generos.length) : (l.generos || []).includes(filtroCategoria) || (!generosLista.length && l.categoria === filtroCategoria));
      const porGenero = db.livros.filter(bateGenero);
      const lista = (termo && B.filtrar)
        ? B.filtrar(porGenero, termo, l => [l.titulo, l.autor, l.categoria, l.isbn, l.generos], { titulo: l => l.titulo })
        : porGenero.filter(bateTexto);

      // Sem filtro e sem busca: prateleiras por gênero. Com filtro/busca: grade simples.
      const prateleiras = generosLista.length > 0 && filtroCategoria === 'todos' && !termo;
      grid.classList.toggle('livro-grid--prateleiras', prateleiras);
      grid.innerHTML = '';
      vazio.hidden = lista.length !== 0;

      if (banner) {
        const g = generosLista.find(x => x.nome === filtroCategoria);
        if (filtroCategoria !== 'todos' && (g || filtroCategoria === '__sem__')) {
          const cor = g ? corGenero(g) : '#64748b';
          banner.hidden = false;
          banner.style.setProperty('--g', cor);
          const n = lista.length;
          banner.innerHTML = `<button type="button" class="genero-banner__limpar" data-genero="todos"><span aria-hidden="true">←</span> Todos os gêneros</button>
            <div class="genero-banner__texto"><h3>${escaparTexto(g ? g.nome : 'Outros')} <small>${n} ${n === 1 ? 'livro' : 'livros'}</small></h3>${g && g.descricao ? `<p>${escaparTexto(g.descricao)}</p>` : ''}</div>`;
        } else banner.hidden = true;
      }

      if (prateleiras) {
        const blocos = [];
        generosLista.forEach(g => {
          const livros = lista.filter(l => (l.generos || []).includes(g.nome));
          if (livros.length) blocos.push({ chave: g.nome, icone: escaparTexto(g.icone || '📘'), nome: g.nome, desc: g.descricao || '', cor: corGenero(g), livros });
        });
        const outros = lista.filter(l => !(l.generos && l.generos.length));
        if (outros.length) blocos.push({ chave: '__sem__', icone: '🔖', nome: 'Outros', desc: 'Livros que ainda não têm gênero definido.', cor: '#64748b', livros: outros });
        blocos.forEach(b => {
          grid.insertAdjacentHTML('beforeend', `
            <section class="genero-prateleira" style="--g:${b.cor}">
              <header class="genero-prateleira__topo">
                <div class="genero-prateleira__titulo"><h3>${escaparTexto(b.nome)} <small>${b.livros.length}</small></h3>${b.desc ? `<p>${escaparTexto(b.desc)}</p>` : ''}</div>
                <button type="button" class="genero-prateleira__ver" data-genero="${escaparTexto(b.chave)}">Ver todos</button>
              </header>
              <div class="genero-prateleira__trilho">${b.livros.map(cartaoLivroHTML).join('')}</div>
            </section>`);
        });
      } else {
        grid.insertAdjacentHTML('beforeend', lista.map(cartaoLivroHTML).join(''));
      }

      // Cartões recriados já abertos entram sem animar (senão fechariam e abririam de novo).
      if (grid.querySelector('.sem-anim')) {
        void grid.offsetWidth;
        grid.querySelectorAll('.sem-anim').forEach(c => c.classList.remove('sem-anim'));
      }
    }

    function atualizarLivrosAbertos() {
      document.querySelectorAll('#catalogoGrid .livro-card--3d').forEach(c => {
        const aberto = String(c.dataset.id) === String(livroFixadoId);
        c.classList.toggle('aberto', aberto);
        const capa = c.querySelector('.livro-book__cover');
        if (capa) capa.setAttribute('aria-expanded', aberto ? 'true' : 'false');
      });
    }

    (function eventosLivro3D() {
      const grid = document.getElementById('catalogoGrid');
      if (!grid) return;
      // Toque/clique na capa fixa o livro aberto (e um novo toque fecha).
      grid.addEventListener('click', e => {
        const capa = e.target.closest('.livro-book__cover');
        if (!capa) return;
        const id = capa.closest('.livro-card').dataset.id;
        livroFixadoId = String(livroFixadoId) === String(id) ? null : id;
        atualizarLivrosAbertos();
      });
      // Lembra qual livro está sob o mouse para manter a animação após redesenhar o catálogo.
      grid.addEventListener('pointerover', e => {
        if (e.pointerType !== 'mouse') return;
        const c = e.target.closest('.livro-card');
        const novo = c ? c.dataset.id : null;
        if (novo !== livroHoverId) { livroHoverId = novo; atualizarLivrosAbertos(); }
      });
      grid.addEventListener('pointerleave', () => {
        if (livroHoverId !== null) { livroHoverId = null; atualizarLivrosAbertos(); }
      });
      // Clicar fora ou apertar Esc fecha o livro que ficou aberto.
      document.addEventListener('click', e => {
        if (livroFixadoId !== null && !e.target.closest('.livro-card')) { livroFixadoId = null; atualizarLivrosAbertos(); }
      });
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && livroFixadoId !== null) { livroFixadoId = null; atualizarLivrosAbertos(); }
      });
    })();

    // ---------- Renderização: Meus empréstimos ----------
    function renderEmprestimos() {
      const lista = document.getElementById('emprestimosTabela'); if (!lista) return;
      const vazio = document.getElementById('emprestimosVazio');
      const ativos = db.emprestimos.filter(e => e.status !== 'devolvido');
      lista.innerHTML=''; if(vazio) vazio.hidden=ativos.length!==0;
      ativos.forEach(e=>{
        const livro=livroPorId(e.livroId); const titulo=e.titulo||(livro&&livro.titulo)||'—';
        const autor=(livro&&livro.autor)||'';
        const aguardandoRetirada=!Number(e.retiradaConfirmada)&&e.status!=='devolvido'; const st=aguardandoRetirada?{classe:'badge-pendente',texto:'Aguardando retirada'}:statusEmprestimo({dataDevolucao:e.dataDevolucao,status:e.status});
        const max=Number(window.__bibliobetaMaxRenovacoes||2); const pode=Number(e.renovacoes||0)<max && e.status!=='atrasado';
        const avisou=Number(e.avisoDevolucao);
        const btnRenovar=pode?`<button type="button" class="row-acao-btn" data-renovar="${e.id}">Renovar</button>`:'';
        const btnDevolver=aguardandoRetirada?'':(avisou
          ?'<span class="emprestimo-item-aviso">Devolução avisada</span>'
          :`<button type="button" class="row-acao-btn" data-avisar-devolucao="${e.id}">Avisar devolução</button>`);
        const iniciais=titulo.split(' ').slice(0,2).map(p=>p[0]).join('').toUpperCase();
        const cor=(livro&&livro.cor)||'var(--btn)';
        const dias=diasRestantes(e.dataDevolucao);
        const diasTexto=dias<0?`Atrasado há ${Math.abs(dias)} dia${Math.abs(dias)===1?'':'s'}`
          :dias===0?'Vence hoje'
          :`${dias} dia${dias===1?'':'s'} restante${dias===1?'':'s'}`;
        const diasClasse=dias<0?'emprestimo-item-dias-atrasado':dias<=3?'emprestimo-item-dias-pendente':'';
        lista.insertAdjacentHTML('beforeend',`
          <article class="emprestimo-item">
            <div class="emprestimo-item-capa" style="background:${cor}">
              ${livro&&livro.capa?`<img src="${livro.capa}" alt="" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><span style="display:none">${iniciais}</span>`:`<span>${iniciais}</span>`}
            </div>
            <div class="emprestimo-item-info">
              <span class="emprestimo-item-titulo">${titulo}</span>
              ${autor?`<span class="emprestimo-item-autor">${autor}</span>`:''}
              <span class="emprestimo-item-meta">
                <span>Devolução: ${formatarBR(e.dataDevolucao)}</span>
                <span>Renovações: ${e.renovacoes||0} de ${max}</span>
                ${!Number(e.retiradaConfirmada) ? `<span class="emprestimo-item-token"><strong>Código de retirada:</strong> <code>${e.codigoSeguranca||'—'}</code> <small>Apresente este código na biblioteca para pegar o livro.</small></span>` : ''}${e.codigoDevolucao ? `<span class="emprestimo-item-token"><strong>Código de devolução:</strong> <code>${e.codigoDevolucao}</code> <small>Use na Gestão ao devolver.</small></span>` : `<span class="emprestimo-item-token"><small>Avise a Gestão quando for devolver para receber o código de devolução.</small></span>`}
                <span class="badge ${st.classe}">${st.texto}</span>
              </span>
              <span class="emprestimo-item-dias ${diasClasse}">${diasTexto}</span>
            </div>
            <div class="emprestimo-item-acoes">${btnRenovar}${btnDevolver}</div>
          </article>
        `);
      });
      // O BiblioBeta não cobra multa em dinheiro: atraso gera penalidade de
      // bloqueio (advertência ou X dias sem poder pegar livro), controlada
      // pela Gestão em /api/penalidades. Este card mostra essa penalidade
      // real, em vez de um valor calculado no navegador.
      const multasEl=document.getElementById('multasValor'), multasTexto=document.getElementById('multasTexto'), multasCard=document.getElementById('multasCard');
      const atrasados=ativos.filter(e=>e.status==='atrasado'||diasRestantes(e.dataDevolucao)<0).length;
      const penalidadeAtiva=(db.penalidades||[]).find(p=>p.status==='ativa');
      if(penalidadeAtiva){
        const bloqueada=penalidadeAtiva.fim_em && new Date(penalidadeAtiva.fim_em)>new Date();
        if(multasEl) multasEl.textContent=bloqueada?'Bloqueado':'Advertência';
        if(multasTexto) multasTexto.textContent=bloqueada
          ? `Novos empréstimos bloqueados até ${formatarBR(String(penalidadeAtiva.fim_em).slice(0,10))}.`
          : (penalidadeAtiva.descricao||'Você recebeu uma advertência da Gestão.');
        if(multasCard) multasCard.classList.toggle('tem-pendencia', true);
      } else {
        if(multasEl) multasEl.textContent='Em dia';
        if(multasTexto) multasTexto.textContent=atrasados
          ? `${atrasados} empréstimo(s) em atraso. Devolva o quanto antes para evitar bloqueio.`
          : 'Nenhuma pendência registrada.';
        if(multasCard) multasCard.classList.toggle('tem-pendencia', atrasados>0);
      }
    }

    async function renovarEmprestimo(id) {
      if (!await confirmarAcao('O prazo deste empréstimo será renovado conforme as regras da biblioteca. Deseja continuar?', 'Confirmar renovação?')) return;
      try{ const r=await apiFetch('/api/emprestimos/'+id+'/renovar',{method:'POST'}); const d=await r.json(); if(!r.ok) throw new Error(d.erro||'Não foi possível renovar.'); await sincronizarBibliotecaReal(); renderTudo(); alert('Empréstimo renovado com sucesso.'); }
      catch(e){ alert(e.message); }
    }

    async function avisarDevolucaoEmprestimo(id) {
      if (!confirm('Avisar a Gestão de que você vai devolver este livro? Leve-o até a biblioteca para a devolução ser confirmada.')) return;
      try{ const r=await apiFetch('/api/emprestimos/'+id+'/avisar-devolucao',{method:'POST'}); const d=await r.json(); if(!r.ok) throw new Error(d.erro||'Não foi possível avisar a devolução.'); await sincronizarBibliotecaReal(); renderTudo(); alert(d.codigo_devolucao ? 'Gestão avisada. Seu código de devolução é '+d.codigo_devolucao+'. Guarde-o: ele será usado na hora da devolução.' : 'Gestão avisada. Leve o livro até a biblioteca para confirmar a devolução.'); }
      catch(e){ alert(e.message); }
    }

    // ---------- Renderização: Solicitações de empréstimo ----------
    function renderSolicitacoes() {
      const tbody = document.getElementById('solicitacoesTabela');
      const vazio = document.getElementById('solicitacoesVazio');
      if (!tbody) return;
      const lista = db.solicitacoes || [];
      tbody.innerHTML = '';
      if (vazio) vazio.hidden = lista.length !== 0;
      lista.forEach(r => {
        const statusMap = {pendente:['badge-pendente','Pendente'],aprovada:['badge-ativo','Aprovada'],recusada:['badge-atrasado','Recusada'],cancelada:['badge-pendente','Cancelada']};
        const st = statusMap[r.status] || ['badge-pendente', r.status];
        tbody.insertAdjacentHTML('beforeend', `<tr><td>${r.titulo || '—'}</td><td>${formatarBR(String(r.data_solicitacao||'').slice(0,10))}</td><td>${r.data_desejada ? formatarBR(r.data_desejada) : '—'}</td><td><span class="badge ${st[0]}">${st[1]}</span></td><td>${r.status==='pendente'?`<button type="button" class="row-acao-btn" data-cancelar-solicitacao="${r.id}">Cancelar</button>`:''}</td></tr>`);
      });
    }

    async function cancelarSolicitacao(id) {
      if (!await confirmarAcao('A solicitação de empréstimo será cancelada e não poderá seguir para aprovação. Deseja continuar?', 'Cancelar solicitação?')) return;
      try { const r=await apiFetch('/api/solicitacoes-emprestimo/'+id,{method:'DELETE'}); const d=await r.json(); if(!r.ok) throw new Error(d.erro||'Não foi possível cancelar.'); await sincronizarBibliotecaReal(); renderTudo(); }
      catch(e){ alert(e.message); }
    }

    // ---------- Renderização: Reservas ----------
    function renderReservas() {
      const tbody = document.getElementById('reservasTabela');
      if (!tbody) return;
      const vazio = document.getElementById('reservasVazio');
      const statsEl = document.getElementById('reservasStats');

      const prontos = db.reservas.filter(r => r.status === 'pronto').length;
      const fila = db.reservas.filter(r => r.status === 'fila').length;
      statsEl.innerHTML = `
        <article class="painel-card"><div class="stat">${prontos}</div><h3>Aguardando retirada</h3><p>Reservas prontas para você buscar.</p></article>
        <article class="painel-card"><div class="stat">${fila}</div><h3>Na fila</h3><p>Reservas aguardando disponibilidade.</p></article>
      `;

      tbody.innerHTML = '';
      vazio.hidden = db.reservas.length !== 0;
      db.reservas.forEach(r => {
        const livro = livroPorId(r.livroId);
        tbody.insertAdjacentHTML('beforeend', `
          <tr>
            <td>${livro ? livro.titulo : '—'}</td>
            <td>${formatarBR(r.dataReserva)}</td>
            <td><span class="badge ${r.status === 'pronto' ? 'badge-ativo' : 'badge-pendente'}">${r.status === 'pronto' ? 'Pronto para retirada' : 'Na fila'}</span></td>
            <td><button type="button" class="row-acao-btn" data-cancelar-reserva="${r.id}">Cancelar</button></td>
          </tr>
        `);
      });
    }

    async function reservarLivro(livroId) {
      if (window.BiblioBetaAPI && window.BiblioBetaAPI.bloqueadoAgora && window.BiblioBetaAPI.bloqueadoAgora()) { window.BiblioBetaAPI.mostrarTelaPunicao(); return; }
      try{ const r=await apiFetch('/api/reservas',{method:'POST',body:JSON.stringify({livro_id:Number(livroId)})}); const d=await r.json(); if(!r.ok && d.codigo==='PUNIDO') return; if(!r.ok) throw new Error(d.erro||'Não foi possível reservar.'); await sincronizarBibliotecaReal(); renderTudo(); alert('Reserva registrada.'); }catch(e){alert(e.message)}
    }

    async function cancelarReserva(id) {
      if (!await confirmarAcao('Sua reserva será cancelada. Deseja realmente cancelar esta reserva?', 'Cancelar reserva?')) return;
      try{ const r=await apiFetch('/api/reservas/'+id,{method:'DELETE'}); const d=await r.json(); if(!r.ok) throw new Error(d.erro||'Não foi possível cancelar.'); await sincronizarBibliotecaReal(); renderTudo(); }catch(e){alert(e.message)}
    }

    // ---------- Renderização: Histórico ----------
    let filtroHistorico = '';
    let filtroHistoricoPeriodo = 'todos';
    function noPeriodoHistorico(h) {
      if (filtroHistoricoPeriodo === 'todos') return true;
      const dia = String(h.dataDevolucao || '').slice(0, 10);
      if (!dia) return false;
      const hoje = new Date();
      if (filtroHistoricoPeriodo === 'ano') return dia.slice(0, 4) === String(hoje.getFullYear());
      const limite = new Date(hoje.getTime() - Number(filtroHistoricoPeriodo) * 86400000).toISOString().slice(0, 10);
      return dia >= limite;
    }
    function renderHistorico() {
      const lista = document.getElementById('historicoTabela');
      if (!lista) return;
      const vazio = document.getElementById('historicoVazio');
      const contagem = document.getElementById('historicoContagem');

      const todosHist = db.historico.map(h => {
        const livro = livroPorId(h.livroId);
        const titulo = h.titulo || (livro ? livro.titulo : '—');
        return { h, livro, titulo };
      });
      const itens = (B.filtrar
        ? B.filtrar(todosHist.filter(y => noPeriodoHistorico(y.h)), filtroHistorico, y => [y.titulo, y.livro && y.livro.autor])
        : todosHist.filter(y => noPeriodoHistorico(y.h)).filter(y => B.bate(filtroHistorico, y.titulo, y.livro && y.livro.autor)))
        .sort((a, b) => (b.h.dataDevolucao || '').localeCompare(a.h.dataDevolucao || ''));

      document.querySelectorAll('#historicoFiltroChips [data-hist-periodo]').forEach(c => c.classList.toggle('active', c.dataset.histPeriodo === filtroHistoricoPeriodo));
      lista.innerHTML = '';
      vazio.hidden = db.historico.length !== 0;
      if (contagem) contagem.textContent = db.historico.length ? db.historico.length + (db.historico.length === 1 ? ' livro' : ' livros') : '';

      if (db.historico.length !== 0 && itens.length === 0) {
        lista.insertAdjacentHTML('beforeend', '<p class="empty-msg">Nenhum resultado para essa busca.</p>');
        return;
      }

      itens.forEach(({ h, livro, titulo }) => {
        const autor = (livro && livro.autor) || '';
        const iniciais = titulo.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
        const cor = (livro && livro.cor) || 'var(--btn)';
        let duracaoTexto = '';
        if (h.dataRetirada && h.dataDevolucao) {
          const dias = Math.round((new Date(h.dataDevolucao + 'T00:00:00') - new Date(h.dataRetirada + 'T00:00:00')) / 86400000);
          if (dias >= 0) duracaoTexto = `<span class="badge badge-ativo">${dias} dia${dias === 1 ? '' : 's'} emprestado</span>`;
        }
        lista.insertAdjacentHTML('beforeend', `
          <article class="historico-item">
            <div class="emprestimo-item-capa" style="background:${cor}">
              ${livro && livro.capa ? `<img src="${livro.capa}" alt="" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><span style="display:none">${iniciais}</span>` : `<span>${iniciais}</span>`}
            </div>
            <div class="emprestimo-item-info">
              <span class="emprestimo-item-titulo">${titulo}</span>
              ${autor ? `<span class="emprestimo-item-autor">${autor}</span>` : ''}
              <span class="emprestimo-item-meta">
                <span>Retirado em: ${formatarBR(h.dataRetirada)}</span>
                <span>Devolvido em: ${formatarBR(h.dataDevolucao)}</span>
                ${duracaoTexto}
              </span>
            </div>
          </article>
        `);
      });
    }

    // ---------- Renderização: Favoritos ----------
    function renderFavoritos() {
      const grid = document.getElementById('favoritosGrid');
      if (!grid) return;
      const vazio = document.getElementById('favoritosVazio');
      const lista = db.favoritos.map(id => livroPorId(id)).filter(Boolean);
      grid.innerHTML = '';
      vazio.hidden = lista.length !== 0;
      lista.forEach(l => {
        const titulo = escaparTexto(l.titulo), autor = escaparTexto(l.autor);
        const iniciais = escaparTexto(l.titulo.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase());
        const capa = l.capa
          ? `<img src="${escaparTexto(l.capa)}" alt="Capa de ${titulo}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><span class="favorito-capa-fallback" style="display:none">${iniciais}</span>`
          : `<span class="favorito-capa-fallback">${iniciais}</span>`;
        grid.insertAdjacentHTML('beforeend', `
          <button type="button" class="painel-card favorito-card" data-ver-no-catalogo="${l.id}" aria-label="Ver ${titulo} no catálogo">
            <span class="favorito-capa" style="background:${l.cor || '#8d5a2b'}">${capa}</span>
            <span class="favorito-info">
              <strong class="favorito-titulo">${titulo}</strong>
              <span class="favorito-autor">${autor}</span>
              <span class="livro-disp ${l.disponivel ? '' : 'indisponivel'}">${l.disponivel ? 'Disponível' : 'Emprestado'}</span>
              <span class="favorito-ver">Ver no catálogo →</span>
            </span>
          </button>
        `);
      });
    }

    // Abre o livro no Catálogo: limpa filtros/busca, troca de tela, rola até o cartão,
    // abre o livro (capa girada) e dá um destaque rápido.
    function irParaLivroNoCatalogo(livroId) {
      filtroTexto = '';
      filtroCategoria = 'todos';
      if (buscaCatalogo) buscaCatalogo.value = '';
      livroFixadoId = null;
      renderCatalogo();
      const radio = document.getElementById('nav-catalogo');
      if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change')); }
      // O clique que veio dos Favoritos ainda passa pelos outros ouvintes (que fecham livros abertos);
      // por isso a abertura e a rolagem acontecem logo depois.
      setTimeout(() => {
        const card = document.querySelector('#catalogoGrid .livro-card--3d[data-id="' + String(livroId) + '"]');
        if (!card) return;
        livroFixadoId = String(livroId);
        atualizarLivrosAbertos();
        const reduzir = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        card.scrollIntoView({ behavior: reduzir ? 'auto' : 'smooth', block: 'center', inline: 'center' });
        card.classList.remove('livro-destaque');
        void card.offsetWidth;
        card.classList.add('livro-destaque');
        setTimeout(() => card.classList.remove('livro-destaque'), 2400);
      }, 60);
    }

    async function toggleFavorito(livroId) {
      livroId = Number(livroId);
      const ativo = db.favoritos.includes(livroId);
      try {
        const r = await apiFetch('/api/favoritos/' + livroId, { method: ativo ? 'DELETE' : 'POST' });
        const d = await r.json();
        if (!r.ok) throw new Error(d.erro || 'Não foi possível atualizar o favorito.');
        if (ativo) db.favoritos = db.favoritos.filter(id => id !== livroId);
        else db.favoritos.push(livroId);
        saveDB(db);
        renderTudo();
      } catch (e) { alert(e.message); }
    }

    // ---------- Renderização: Informações ----------
    function renderInformacoes() {
      const grid = document.getElementById('informacoesGrid');
      if (!grid) return;
      const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
      const vazio = v => v == null || String(v).trim() === '' || String(v).trim() === '-';
      const ico = d => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
      const ICONES = {
        serie: ico('<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2 9 2 12 0v-5"/>'),
        turma: ico('<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/><path d="M16 11a3 3 0 1 0 0-6M18 15c2 .6 3 2.2 3 5"/>'),
        disciplina: ico('<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5"/><path d="M9 8h6"/>'),
        matricula: ico('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="12" r="2"/><path d="M14 10h4M14 14h3M6 16c.6-1.2 1.6-2 3-2s2.400.8 3 2"/>'),
        email: ico('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'),
        telefone: ico('<path d="M5 4h4l2 5-2.500 1.500a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z"/>'),
        desde: ico('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>')
      };
      const nome = usuarioLogado.nome || db.aluno.nome || 'Usuário';
      const iniciais = nome.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase() || 'U';
      const email = usuarioLogado.email || db.aluno.email;
      const emailAlt = ehProfessor ? (usuarioLogado.email_alternativo || '') : '';
      const telefone = usuarioLogado.telefone;
      const etapaTxt = ({ medio: 'Ensino Médio', fundamental: 'Ensino Fundamental' })[String(perfilUsuario.etapa || '').toLowerCase()] || '';
      let serieTxt = db.aluno.serie;
      if (!ehProfessor && /^\d+$/.test(String(serieTxt))) serieTxt = serieTxt + 'º ano';
      const turma = perfilUsuario.turma;
      let desde = '';
      try { if (usuarioLogado.criado_em) desde = new Date(String(usuarioLogado.criado_em).replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(String(usuarioLogado.criado_em)) ? '' : 'Z')).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }); } catch (_) {}

      const item = (chave, rotulo, valor, extra, classe) => vazio(valor) ? '' : `
        <article class="info-item ${classe || ''}">
          <span class="info-item-icone">${ICONES[chave]}</span>
          <div class="info-item-texto">
            <span class="info-item-rotulo">${esc(rotulo)}</span>
            <strong class="info-item-valor">${esc(valor)}</strong>
            ${extra ? `<span class="info-item-extra">${esc(extra)}</span>` : ''}
          </div>
        </article>`;

      grid.className = 'info-perfil';
      grid.innerHTML = `
        <header class="info-hero">
          <div class="info-avatar" aria-hidden="true">${esc(iniciais)}</div>
          <div class="info-hero-texto">
            <h3>${esc(nome)}</h3>
            <div class="info-chips">
              <span class="info-chip info-chip-papel">${ehProfessor ? 'Professor(a)' : 'Aluno(a)'}</span>
              ${!ehProfessor && etapaTxt ? `<span class="info-chip">${esc(etapaTxt)}</span>` : ''}
              <span class="info-chip info-chip-ok">Cadastro ativo</span>
            </div>
          </div>
        </header>
        <div class="info-lista">
          ${ehProfessor
            ? item('disciplina', 'Disciplina', db.aluno.serie)
            : item('serie', 'Série', serieTxt) + item('turma', 'Turma', turma)}
          ${item('matricula', ehProfessor ? 'Registro' : 'Matrícula (RA)', db.aluno.matricula, !ehProfessor && perfilUsuario.ra_digito ? 'Dígito ' + perfilUsuario.ra_digito : '')}
          ${item('telefone', 'Telefone', telefone)}
          ${item('desde', 'Cadastrado em', desde)}
        </div>
        ${vazio(email) ? '' : `
        <article class="info-email">
          <span class="info-item-icone">${ICONES.email}</span>
          <div class="info-item-texto">
            <span class="info-item-rotulo">E-mail de contato</span>
            <a class="info-email-endereco" href="mailto:${esc(email)}">${esc(email)}</a>
            <span class="info-item-extra">É para este endereço que a biblioteca envia avisos de empréstimos, prazos e reservas.</span>
            ${vazio(emailAlt) ? '' : `<span class="info-item-rotulo" style="margin-top:8px;display:block">2º e-mail</span><a class="info-email-endereco" href="mailto:${esc(emailAlt)}">${esc(emailAlt)}</a><span class="info-item-extra">Os avisos também são enviados para este endereço.</span>`}
          </div>
          <button type="button" class="info-copiar" id="btnCopiarEmail" data-email="${esc(email)}">Copiar</button>
        </article>`}
      `;
      const btn = document.getElementById('btnCopiarEmail');
      if (btn) btn.addEventListener('click', async () => {
        const original = btn.textContent;
        try { await navigator.clipboard.writeText(btn.dataset.email); btn.textContent = 'Copiado ✓'; }
        catch (_) { btn.textContent = 'Selecione e copie'; }
        setTimeout(() => { btn.textContent = original; }, 1800);
      });
    }

    // ---------- Modal de empréstimo ----------
    const modalBackdrop = document.getElementById('modalBackdrop');
    if (modalBackdrop) {
      const passoForm = document.getElementById('modalPassoForm');
      const passoConfirma = document.getElementById('modalPassoConfirma');
      const form = document.getElementById('formEmprestimo');
      const campoNome = document.getElementById('campoNome');
      const campoSerie = document.getElementById('campoSerie');
      const campoData = document.getElementById('campoData');
      const preview = document.getElementById('modalLivroPreview');
      let livroSelecionadoId = null;

      // Mantém as opções de série do empréstimo compatíveis com a etapa
      // cadastrada no perfil. O Ensino Médio usa 1º, 2º e 3º ano.
      function atualizarSeriesEmprestimo() {
        if (!campoSerie || campoSerie.tagName !== 'SELECT' || ehProfessor) return;
        const etapa = String(perfilUsuario.etapa || '').toLowerCase();
        const serieAtual = String(perfilUsuario.serie || db.aluno.serie || '').trim();
        const turmaAtual = String(perfilUsuario.turma || '').trim().toUpperCase();
        const anos = etapa === 'medio'
          ? ['1º Ano', '2º Ano', '3º Ano']
          : ['1º Ano','2º Ano','3º Ano','4º Ano','5º Ano','6º Ano','7º Ano','8º Ano A','8º Ano B','9º Ano A','9º Ano B'];

        campoSerie.innerHTML = '<option value="">Selecione sua série</option>';
        anos.forEach(function (ano) {
          const option = document.createElement('option');
          option.value = ano;
          option.textContent = ano;
          campoSerie.appendChild(option);
        });

        let valor = serieAtual;
        if (/^[1-3]$/.test(valor) && etapa === 'medio') valor = valor + 'º Ano';
        if (/^[1-9]$/.test(valor) && etapa === 'fundamental') valor = valor + 'º Ano';
        if (etapa === 'medio' && turmaAtual && /^(1º|2º|3º) Ano$/i.test(valor)) {
          // O modal pede a série; a turma continua vinculada ao cadastro do aluno.
        }
        if (anos.includes(valor)) campoSerie.value = valor;
      }

      atualizarSeriesEmprestimo();
      campoData.min = hojeISO();

      function abrirModal(livroId) {
        // Punido: não abre o pedido, mostra a tela de bloqueio.
        if (window.BiblioBetaAPI && window.BiblioBetaAPI.bloqueadoAgora && window.BiblioBetaAPI.bloqueadoAgora()) { window.BiblioBetaAPI.mostrarTelaPunicao(); return; }
        livroSelecionadoId = Number(livroId);
        const livro = livroPorId(livroSelecionadoId);
        if (!livro) return;
        campoNome.value = usuarioLogado.nome || db.aluno.nome;
        const seriePerfil = String(perfilUsuario.serie || db.aluno.serie || '').trim();
        if (campoSerie.tagName === 'SELECT' && !ehProfessor) {
          const serieModal = /^[1-3]$/.test(seriePerfil) && String(perfilUsuario.etapa || '').toLowerCase() === 'medio'
            ? seriePerfil + 'º Ano'
            : /^[1-9]$/.test(seriePerfil) ? seriePerfil + 'º Ano' : seriePerfil;
          campoSerie.value = serieModal;
        } else {
          campoSerie.value = seriePerfil;
        }
        campoData.value = '';
        preview.innerHTML = `
          <div class="mini-capa" style="background:${livro.cor}">${livro.capa ? `<img src="${livro.capa}" alt="Capa de ${livro.titulo}" onerror="this.style.display='none';">` : ''}</div>
          <div class="mini-info"><strong>${livro.titulo}</strong><span>${livro.autor}</span></div>
        `;
        passoForm.hidden = false;
        passoConfirma.hidden = true;
        modalBackdrop.classList.add('show');
      }

      function fecharModal() {
        modalBackdrop.classList.remove('show');
      }

      document.getElementById('modalFechar').addEventListener('click', fecharModal);
      document.getElementById('modalCancelar').addEventListener('click', fecharModal);
      modalBackdrop.addEventListener('click', function (e) {
        if (e.target === modalBackdrop) fecharModal();
      });

      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        const livro = livroPorId(livroSelecionadoId);
        if (!livro) return;

        db.aluno.nome = campoNome.value.trim() || db.aluno.nome;
        db.aluno.serie = campoSerie.value || db.aluno.serie;

        try{
          // O aluno/professor envia uma solicitação real; a Gestão decide se aprova.
          const r=await apiFetch('/api/solicitacoes-emprestimo',{method:'POST',body:JSON.stringify({livro_id:livro.id,data_desejada:campoData.value})}); const d=await r.json();
          if(!r.ok){ if(d.codigo==='PUNIDO'){ fecharModal(); return; } throw new Error(d.erro||'Não foi possível solicitar o livro.'); }
          await sincronizarBibliotecaReal(); renderTudo();
          // O código de retirada só existe depois que a Gestão aprova a
          // solicitação (POST /api/solicitacoes-emprestimo não gera código
          // nenhum, só registra o pedido como pendente). Por isso este passo
          // de confirmação não mostra código nenhum — só o status do pedido.
          document.getElementById('confirmaResumo').innerHTML=`<div><dt>Nome</dt><dd>${db.aluno.nome}</dd></div><div><dt>Livro solicitado</dt><dd>${livro.titulo} — ${livro.autor}</dd></div><div><dt>Status</dt><dd>Aguardando aprovação da Gestão.</dd></div>`;
          passoForm.hidden=true; passoConfirma.hidden=false;
        }catch(err){alert(err.message)}
      });

      document.getElementById('confirmaVoltarInicio').addEventListener('click', function () {
        fecharModal();
        const radioInicio = document.getElementById('nav-inicio');
        if (radioInicio) { radioInicio.checked = true; radioInicio.dispatchEvent(new Event('change')); }
      });
      document.getElementById('confirmaVerEmprestimos').addEventListener('click', function () {
        fecharModal();
        const radioEmp = document.getElementById('nav-emprestimos');
        if (radioEmp) { radioEmp.checked = true; radioEmp.dispatchEvent(new Event('change')); }
      });

      window.__abrirModalEmprestimo = abrirModal;
    }

    // ---------- Eventos delegados (catálogo, tabelas, favoritos) ----------
    document.addEventListener('click', function (e) {
      const favBtn = e.target.closest('[data-fav]');
      if (favBtn) { toggleFavorito(favBtn.getAttribute('data-fav')); return; }

      const verCatalogo = e.target.closest('[data-ver-no-catalogo]');
      if (verCatalogo) { irParaLivroNoCatalogo(verCatalogo.getAttribute('data-ver-no-catalogo')); return; }

      const empBtn = e.target.closest('[data-emprestar]');
      if (empBtn && window.__abrirModalEmprestimo) { window.__abrirModalEmprestimo(empBtn.getAttribute('data-emprestar')); return; }

      const resBtn = e.target.closest('[data-reservar]');
      if (resBtn) { reservarLivro(resBtn.getAttribute('data-reservar')); return; }

      const cancelBtn = e.target.closest('[data-cancelar-reserva]');
      if (cancelBtn) { cancelarReserva(cancelBtn.getAttribute('data-cancelar-reserva')); return; }

      const cancelSolBtn = e.target.closest('[data-cancelar-solicitacao]');
      if (cancelSolBtn) { cancelarSolicitacao(cancelSolBtn.getAttribute('data-cancelar-solicitacao')); return; }

      const renovarBtn = e.target.closest('[data-renovar]');
      if (renovarBtn) { renovarEmprestimo(renovarBtn.getAttribute('data-renovar')); return; }

      const devolverBtn = e.target.closest('[data-avisar-devolucao]');
      if (devolverBtn) { avisarDevolucaoEmprestimo(devolverBtn.getAttribute('data-avisar-devolucao')); return; }

      const tileGenero = e.target.closest('[data-genero]');
      if (tileGenero) {
        filtroCategoria = tileGenero.getAttribute('data-genero');
        renderCatalogo();
        const alvo = document.getElementById('catalogoBanner');
        if (filtroCategoria !== 'todos' && alvo && tileGenero.closest('.genero-prateleira')) alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      const pill = e.target.closest('.pill');
      if (pill) {
        document.querySelectorAll('.categoria-pills .pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        filtroCategoria = pill.getAttribute('data-categoria');
        renderCatalogo();
        return;
      }

      const irPane = e.target.closest('[data-ir-pane]');
      if (irPane) {
        const alvo = irPane.getAttribute('data-ir-pane');
        const radio = document.getElementById('nav-' + alvo);
        if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change')); }
      }
    });

    // Cards do início acessíveis pelo teclado (Enter/Espaço), como os botões.
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const c = e.target && e.target.closest ? e.target.closest('.stat-clicavel') : null;
      if (!c || e.target !== c) return;
      e.preventDefault();
      c.click();
    });

    const buscaCatalogo = document.getElementById('catalogoBusca');
    if (buscaCatalogo) {
      B.ligar(buscaCatalogo, function (valor) {
        filtroTexto = valor;
        renderCatalogo();
      }, { atraso: 80 });
    }

    const chipsHistorico = document.getElementById('historicoFiltroChips');
    if (chipsHistorico) {
      chipsHistorico.addEventListener('click', function (e) {
        const b = e.target.closest('[data-hist-periodo]');
        if (!b) return;
        filtroHistoricoPeriodo = b.dataset.histPeriodo;
        renderHistorico();
      });
    }

    const buscaHistorico = document.getElementById('historicoBusca');
    if (buscaHistorico) {
      B.ligar(buscaHistorico, function (valor) {
        filtroHistorico = valor;
        renderHistorico();
      });
    }

    function renderTudo() {
      renderTopbarAluno();
      renderInicio();
      renderCatalogo();
      renderEmprestimos();
      renderReservas();
      renderSolicitacoes();
      renderHistorico();
      renderFavoritos();
      renderInformacoes();
      renderNotificacoesAluno();
    }

    function iniciarTempoRealLeitor(){
      const token=localStorage.getItem('bibliobeta_token');
      const base=(window.BiblioBetaAPI?.origin || window.location.origin);
      if(!window.EventSource||!token)return;
      const url=base+'/api/tempo-real?token='+encodeURIComponent(token);
      let es,encerrado=false,jaConectou=false;
      const conectar=()=>{ if(encerrado)return; es=new EventSource(url); es.addEventListener('conta_excluida',()=>{ encerrado=true; es.close(); window.BiblioBetaAPI?.contaExcluida?.(); }); es.addEventListener('conta_desativada',()=>{ encerrado=true; es.close(); window.BiblioBetaAPI?.contaDesativada?.(); }); es.addEventListener('cobranca_devolucao',()=>{ window.BiblioBetaAPI?.verificarCobrancas?.(); }); es.addEventListener('punicao',()=>{ window.BiblioBetaAPI?.verificarPunicao?.(true); }); let t=null; const atualizar=()=>{ if(t)return; t=setTimeout(async()=>{ t=null; await Promise.all([sincronizarBibliotecaReal(),carregarLivrosReais()]); renderTudo(); },250); }; es.addEventListener('notificacao',atualizar); es.addEventListener('atualizar',atualizar);
        // Ao (re)conectar: se o site mudou (servidor reiniciado com arquivos novos) recarrega a página sozinha;
        // se só caiu a conexão, busca os dados de novo para não ficar com a tela velha.
        es.addEventListener('conectado',ev=>{ try{ const v=JSON.parse(ev.data||'{}').versao; if(v){ if(window.__bbVersaoSite&&window.__bbVersaoSite!==v){ location.reload(); return; } window.__bbVersaoSite=v; } }catch(_){} if(jaConectou) atualizar(); jaConectou=true; });
        es.onerror=()=>{es.close();setTimeout(conectar,3000)}; };
      conectar();
    }

    // ---------- Tela de boas-vindas ----------
    // "Bem-vindo(a) ao BiblioBeta" (logo após o cadastro) e "Bem-vindo(a) de volta"
    // (a cada login). Aparece uma única vez por entrada, em tela cheia, e o resumo
    // do "de volta" é preenchido quando os dados reais chegam da API.
    let telaBoasVindas = null;
    // Livro folheando (loader). Usado no "de volta" enquanto carrega o resumo e no cadastro novo.
    const LIVRO_HTML = '<div class="bb-livro" aria-hidden="true"><div class="bb-livro__pg-shadow"></div><div class="bb-livro__pg"></div><div class="bb-livro__pg bb-livro__pg--2"></div><div class="bb-livro__pg bb-livro__pg--3"></div><div class="bb-livro__pg bb-livro__pg--4"></div><div class="bb-livro__pg bb-livro__pg--5"></div></div>';

    function abrirTelaBoasVindas() {
      let info = null;
      try { info = JSON.parse(sessionStorage.getItem('bibliobeta_boasvindas') || 'null'); } catch (_) {}
      try { sessionStorage.removeItem('bibliobeta_boasvindas'); } catch (_) {}
      if (!info || document.getElementById('bbBoasVindas')) return;

      const modo = info.modo === 'novo' ? 'novo' : 'retorno';
      const rotuloPapel = ehProfessor ? 'professor(a)' : 'aluno(a)';
      const primeiroNome = String((db.aluno && db.aluno.nome) || usuarioLogado.nome || '').trim().split(/\s+/)[0] || 'leitor(a)';
      const hora = new Date().getHours();
      const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';

      // O SQLite guarda datas em UTC ("AAAA-MM-DD HH:MM:SS"); converte para o horário local.
      const paraData = valor => {
        if (!valor) return null;
        const txt = String(valor);
        const d = new Date(txt.replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(txt) ? '' : 'Z'));
        return isNaN(d) ? null : d;
      };
      const ultimoAcesso = modo === 'retorno' ? paraData(info.ultimoAcesso) : null;

      const el = document.createElement('div');
      el.id = 'bbBoasVindas';
      el.className = 'bb-bv';
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      el.setAttribute('aria-labelledby', 'bbBvTitulo');
      el.innerHTML = `<div class="bb-bv-conteudo">
        <img class="bb-bv-logo" src="logo-bibliobeta.png" alt="BiblioBeta" width="84" height="84">
        <div class="bb-bv-emoji" aria-hidden="true"></div>
        <p class="bb-bv-saudacao"></p>
        <h1 class="bb-bv-titulo" id="bbBvTitulo"></h1>
        <p class="bb-bv-sub"></p>
        <div class="bb-bv-cards" aria-live="polite"></div>
        <div class="bb-bv-acoes">
          <button type="button" class="row-acao-btn bb-bv-secundario" data-bv-notif hidden>Ver notificações</button>
          <button type="button" class="btn-primario bb-bv-primario" data-bv-entrar></button>
        </div>
        <p class="bb-bv-manual">📖 <a href="manual.html" target="_blank" rel="noopener" data-bv-manual>Ver manual de como funciona o BiblioBeta</a></p>
      </div>`;

      // O livro folheando fica na tela o tempo todo (nos dois modos); o emoji vai para a saudação.
      const emojiEl = el.querySelector('.bb-bv-emoji');
      emojiEl.classList.add('bb-bv-emoji--livro');
      emojiEl.innerHTML = LIVRO_HTML;
      el.querySelector('.bb-bv-saudacao').textContent = modo === 'novo' ? '🎉 Conta criada com sucesso' : '👋 ' + saudacao;
      el.querySelector('.bb-bv-titulo').textContent = modo === 'novo'
        ? 'Bem-vindo(a) ao BiblioBeta, ' + primeiroNome + '!'
        : 'Bem-vindo(a) de volta, ' + primeiroNome + '!';
      el.querySelector('.bb-bv-sub').textContent = modo === 'novo'
        ? 'Sua conta de ' + rotuloPapel + ' já está ativa. Veja por onde começar:'
        : (ultimoAcesso
            ? 'Seu último acesso foi em ' + ultimoAcesso.toLocaleDateString('pt-BR') + ' às ' + ultimoAcesso.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + '.'
            : 'Que bom ver você por aqui de novo.');

      const btnEntrar = el.querySelector('[data-bv-entrar]');
      const btnNotif = el.querySelector('[data-bv-notif]');
      btnEntrar.textContent = modo === 'novo' ? 'Começar a explorar' : 'Entrar no painel';

      const fechar = () => {
        if (!telaBoasVindas) return;
        document.removeEventListener('keydown', aoTeclar);
        document.body.classList.remove('bb-bv-aberta');
        el.classList.add('bb-bv--saindo');
        setTimeout(() => el.remove(), 320);
        telaBoasVindas = null;
      };
      const aoTeclar = e => {
        if (e.key === 'Escape') { fechar(); return; }
        if (e.key === 'Tab') { // mantém o foco dentro da tela
          const focaveis = [btnNotif, btnEntrar, el.querySelector('[data-bv-manual]')].filter(b => b && !b.hidden);
          const pos = focaveis.indexOf(document.activeElement);
          if (pos === -1) { e.preventDefault(); focaveis[0].focus(); }
          else if (e.shiftKey && pos === 0) { e.preventDefault(); focaveis[focaveis.length - 1].focus(); }
          else if (!e.shiftKey && pos === focaveis.length - 1) { e.preventDefault(); focaveis[0].focus(); }
        }
      };
      btnEntrar.addEventListener('click', fechar);
      btnNotif.addEventListener('click', () => {
        fechar();
        const radio = document.getElementById('nav-notificacoes');
        if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change')); }
      });
      document.addEventListener('keydown', aoTeclar);

      telaBoasVindas = { el, modo, ultimoAcesso, paraData, btnNotif, carregado: modo === 'novo' };
      document.body.classList.add('bb-bv-aberta');
      document.body.appendChild(el);
      btnEntrar.focus();
      atualizarTelaBoasVindas();
    }

    // Monta (ou refaz) os cartões da tela. Chamada ao abrir e de novo quando a API responde.
    function atualizarTelaBoasVindas(dadosProntos) {
      const t = telaBoasVindas;
      if (!t) return;
      if (dadosProntos) t.carregado = true;
      const area = t.el.querySelector('.bb-bv-cards');
      const plural = (n, singular, pluralTxt) => n === 1 ? singular : pluralTxt;
      const cartoes = [];

      if (t.modo === 'novo') {
        cartoes.push({ topo: '📚', titulo: 'Explore o catálogo', desc: 'Busque livros por título, autor ou categoria.' });
        cartoes.push({ topo: '📝', titulo: 'Peça seus livros', desc: 'Solicite um empréstimo e acompanhe a resposta da biblioteca.' });
        cartoes.push({ topo: '🔔', titulo: 'Fique de olho nos avisos', desc: 'Prazos, reservas e retiradas chegam nas notificações e por e-mail.' });
      } else if (!t.carregado) {
        cartoes.push({ carregando: true });
      } else {
        const naoLidas = (db.notificacoes || []).filter(n => !Number(n.lida));
        const novas = t.ultimoAcesso ? naoLidas.filter(n => { const d = t.paraData(n.criado_em); return d && d > t.ultimoAcesso; }).length : 0;
        const abertos = (db.emprestimos || []).filter(e => e.status !== 'devolvido');
        const atrasados = abertos.filter(e => e.status === 'atrasado' || diasRestantes(e.dataDevolucao) < 0).length;
        const vencendo = abertos.filter(e => { const d = diasRestantes(e.dataDevolucao); return d >= 0 && d <= 3 && e.status !== 'atrasado'; }).length;
        const prontas = (db.reservas || []).filter(r => r.status === 'pronto').length;

        if (naoLidas.length) cartoes.push({ topo: naoLidas.length, titulo: plural(naoLidas.length, 'notificação não lida', 'notificações não lidas'), desc: novas ? novas + ' ' + plural(novas, 'chegou', 'chegaram') + ' desde seu último acesso' : '' });
        if (atrasados) cartoes.push({ topo: atrasados, titulo: plural(atrasados, 'empréstimo atrasado', 'empréstimos atrasados'), desc: 'Procure a biblioteca para regularizar', alerta: true });
        if (vencendo) cartoes.push({ topo: vencendo, titulo: plural(vencendo, 'empréstimo vence', 'empréstimos vencem') + ' em até 3 dias', desc: '' });
        if (prontas) cartoes.push({ topo: prontas, titulo: plural(prontas, 'reserva pronta', 'reservas prontas') + ' para retirada', desc: 'Retire dentro do prazo' });
        if (!cartoes.length) cartoes.push({ topo: '✅', titulo: 'Tudo em dia!', desc: 'Você não tem pendências no momento.', larga: true });
        t.btnNotif.hidden = !naoLidas.length;
      }

      area.replaceChildren(...cartoes.map((c, i) => {
        if (c.carregando) {
          const box = document.createElement('p');
          box.className = 'bb-carregando-texto';
          box.setAttribute('role', 'status');
          box.textContent = 'Carregando seu resumo…';
          return box;
        }
        const card = document.createElement('div');
        card.className = 'bb-bv-card' + (c.alerta ? ' bb-bv-card--alerta' : '') + (c.larga ? ' bb-bv-card--larga' : '');
        card.style.setProperty('--i', i);
        const topo = document.createElement('span'); topo.className = 'bb-bv-card-topo'; topo.textContent = c.topo;
        const titulo = document.createElement('strong'); titulo.className = 'bb-bv-card-titulo'; titulo.textContent = c.titulo;
        card.append(topo, titulo);
        if (c.desc) { const desc = document.createElement('span'); desc.className = 'bb-bv-card-desc'; desc.textContent = c.desc; card.appendChild(desc); }
        return card;
      }));
    }

    abrirTelaBoasVindas();
    renderTudo();
    iniciarTempoRealLeitor();
    sincronizarBibliotecaReal().then(() => { renderTudo(); atualizarTelaBoasVindas(true); });
    carregarLivrosReais(); // atualiza o catálogo com os livros reais assim que a API responder
    carregarGeneros(); // gêneros usados na galeria e nas prateleiras do catálogo

    // Atualização automática do catálogo: não é mais necessário dar F5.
    // A cada 5 segundos o catálogo consulta o backend e atualiza a tela
    // somente quando os dados realmente mudaram. Também atualiza ao voltar
    // para a aba/janela do navegador.
    let assinaturaCatalogo = '';
    async function atualizarCatalogoAutomaticamente() {
      if (document.hidden) return;
      try {
        const resposta = await apiFetch('/api/livros');
        if (!resposta.ok) return;
        const dados = await resposta.json();
        const lista = Array.isArray(dados) ? dados : (dados.livros || []);
        const assinatura = lista.map(l => [l.id,l.titulo,l.autor,l.quantidade,l.disponiveis,l.capa,(l.generos || []).map(g => g.id).join(','),l.updated_at || l.atualizado_em || ''].join('|')).join('\n');
        if (assinatura !== assinaturaCatalogo) {
          assinaturaCatalogo = assinatura;
          db.livros = lista.map(function (l, i) {
            return {
              id: l.id,
              titulo: l.titulo,
              autor: l.autor,
              categoria: l.categoria || 'Geral',
            generos: (l.generos || []).map(function (g) { return g.nome; }),
              isbn: l.isbn || '',
              capa: l.capa || (l.isbn ? 'https://covers.openlibrary.org/b/isbn/' + encodeURIComponent(l.isbn) + '-M.jpg' : ''),
              cor: PALETA_CAPAS[i % PALETA_CAPAS.length],
              disponivel: (l.disponiveis === undefined ? l.quantidade : l.disponiveis) > 0
            };
          });
          saveDB(db);
          // Não sincroniza empréstimos/notificações a cada atualização do catálogo.
          // Isso reduz bastante o tráfego e o trabalho em celulares antigos.
          renderTudo();
        }
      } catch (e) {
        console.warn('Atualização automática do catálogo:', e.message);
      }
    }
    window.addEventListener('focus', atualizarCatalogoAutomaticamente);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) atualizarCatalogoAutomaticamente(); });
    // 15s mantém o catálogo atualizado sem sobrecarregar celulares antigos.
    // Ao voltar para a aba, o evento de visibilitychange já faz uma atualização imediata.
    setInterval(atualizarCatalogoAutomaticamente, 15000);
  }
})();