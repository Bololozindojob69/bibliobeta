/* =====================================================
   PAINEL - tema + navbar lateral (glider)
   Sistema BiblioBeta
   ===================================================== */
(function () {
  // ---------- Conexão com a API / proteção da página ----------
  const API_URL = 'http://localhost:3000';
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

  // Helper para chamar a API sempre com o token de autenticação.
  // Se o token expirar/for inválido, o backend responde 401 e mandamos o usuário para o login de novo.
  async function apiFetch(caminho, opcoes) {
    opcoes = opcoes || {};
    opcoes.headers = Object.assign({
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    }, opcoes.headers || {});

    const resposta = await fetch(API_URL + caminho, opcoes);
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
    btn.addEventListener('click', function () {
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

  // ---------- Troca de painel ----------
  function mostrarPane(alvo) {
    panes.forEach(function (p) {
      p.classList.toggle('active', p.id === 'pane-' + alvo);
    });
  }

  radios.forEach(function (r) {
    r.addEventListener('change', function () {
      mostrarPane(r.value);
      if (isMobile()) setTimeout(closeNav, 260);
    });
  });

  const marcado = document.querySelector('.radio-container input:checked');
  if (marcado) mostrarPane(marcado.value);

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

  // ---------- Busca/filtro em cada tabela ----------
  function initFiltroTabelas() {
    document.querySelectorAll('.data-table-card').forEach(function (card) {
      const tabela = card.querySelector('.data-table');
      const titulo = card.querySelector('h3');
      if (!tabela || !titulo) return;

      const campo = document.createElement('input');
      campo.type = 'search';
      campo.className = 'table-search';
      campo.placeholder = 'Buscar...';
      campo.setAttribute('aria-label', 'Buscar em ' + titulo.textContent.trim());
      titulo.insertAdjacentElement('afterend', campo);

      const linhas = Array.from(tabela.querySelectorAll('tbody tr'));

      campo.addEventListener('input', function () {
        const termo = campo.value.trim().toLowerCase();
        linhas.forEach(function (linha) {
          const texto = linha.textContent.toLowerCase();
          linha.style.display = texto.includes(termo) ? '' : 'none';
        });
      });
    });
  }

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
    // Empréstimos, reservas, histórico e favoritos ainda são simulados localmente,
    // pois o backend atual não tem tabelas/rotas para isso (só usuários, escolas e livros).
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
        favoritos: []
      };
    }

    function getDB() {
      try {
        const raw = localStorage.getItem(DB_KEY);
        if (raw) return JSON.parse(raw);
      } catch (e) { /* ignora e recria */ }
      const db = seedDB();
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
            cor: PALETA_CAPAS[i % PALETA_CAPAS.length],
            disponivel: (l.disponiveis === undefined ? l.quantidade : l.disponiveis) > 0
          };
        });
        saveDB(db);
        renderTudo();
      } catch (e) {
        // Se o backend estiver fora do ar, mantém a tela funcionando com o catálogo vazio
        console.warn('Não foi possível carregar os livros do backend:', e.message);
      }
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
      if (!userName) return; // não estamos na página do aluno
      userName.textContent = 'Olá, ' + db.aluno.nome.split(' ')[0] + '!';

      const avatarEl = document.getElementById('userAvatar');
      if (avatarEl) {
        avatarEl.textContent = db.aluno.nome.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
      }

      const notificacoes = [];
      db.emprestimos.filter(e => e.status === 'ativo').forEach(e => {
        const dias = diasRestantes(e.dataDevolucao);
        const livro = livroPorId(e.livroId);
        if (dias < 0) notificacoes.push({ titulo: (livro ? livro.titulo : 'Livro') + ' está atrasado', texto: 'Devolva o quanto antes para evitar multa.' });
        else if (dias <= 3) notificacoes.push({ titulo: (livro ? livro.titulo : 'Livro') + ' vence em breve', texto: dias === 0 ? 'Vence hoje.' : 'Vence em ' + dias + ' dia(s).' });
      });
      db.reservas.filter(r => r.status === 'pronto').forEach(r => {
        const livro = livroPorId(r.livroId);
        notificacoes.push({ titulo: (livro ? livro.titulo : 'Reserva') + ' está pronto', texto: 'Pronto para retirada na biblioteca.' });
      });

      const badge = document.getElementById('bellBadge');
      const lista = document.getElementById('topbarNotifLista');
      if (badge) { badge.hidden = notificacoes.length === 0; badge.textContent = notificacoes.length; }
      if (lista) {
        lista.innerHTML = notificacoes.length
          ? notificacoes.map(n => `<li><strong>${n.titulo}</strong><span>${n.texto}</span></li>`).join('')
          : '<li class="notif-vazio">Nenhuma notificação por aqui.</li>';
      }
    }

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
        <article class="painel-card stat-card">
          <span class="stat-icone icone-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16v12H4z"/><path d="M8 10h8M8 14h5"/></svg></span>
          <div><div class="stat">${ativos.length}</div><h3>Empréstimos ativos</h3><p>Livros que estão com você neste momento.</p></div>
        </article>
        <article class="painel-card stat-card">
          <span class="stat-icone icone-2"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg></span>
          <div><div class="stat">${ativos.length ? Math.max(proxDevolucao, 0) : '—'}</div><h3>Devoluções próximas</h3><p>${ativos.length ? 'Prazo mais próximo: em ' + Math.max(proxDevolucao, 0) + ' dias.' : 'Nenhuma devolução pendente.'}</p></div>
        </article>
        <article class="painel-card stat-card">
          <span class="stat-icone icone-3"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg></span>
          <div><div class="stat">${db.historico.length}</div><h3>Histórico</h3><p>Total de livros já devolvidos.</p></div>
        </article>
      `;

      const tbody = document.getElementById('inicioTabelaEmprestimos');
      const vazio = document.getElementById('inicioEmprestimosVazio');
      tbody.innerHTML = '';
      if (!ativos.length) {
        vazio.hidden = false;
      } else {
        vazio.hidden = true;
        ativos.forEach(e => {
          const livro = livroPorId(e.livroId);
          const st = statusEmprestimo(e);
          tbody.insertAdjacentHTML('beforeend', `
            <tr><td>${livro ? livro.titulo : '—'}</td><td>${formatarBR(e.dataDevolucao)}</td>
            <td><span class="badge ${st.classe}">${st.texto}</span></td></tr>
          `);
        });
      }
    }

    // ---------- Renderização: Catálogo ----------
    let filtroTexto = '';
    let filtroCategoria = 'todos';

    function renderCatalogo() {
      const grid = document.getElementById('catalogoGrid');
      if (!grid) return;
      const vazio = document.getElementById('catalogoVazio');

      const termo = filtroTexto.trim().toLowerCase();
      const lista = db.livros.filter(l => {
        const bateCategoria = filtroCategoria === 'todos' || l.categoria === filtroCategoria;
        const bateTexto = !termo || l.titulo.toLowerCase().includes(termo) || l.autor.toLowerCase().includes(termo) || l.categoria.toLowerCase().includes(termo);
        return bateCategoria && bateTexto;
      });

      grid.innerHTML = '';
      vazio.hidden = lista.length !== 0;

      lista.forEach(l => {
        const favoritado = db.favoritos.includes(l.id);
        const iniciais = l.titulo.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase();
        grid.insertAdjacentHTML('beforeend', `
          <article class="livro-card" data-id="${l.id}">
            <div class="livro-capa" style="background:${l.cor}">
              <span>${l.titulo}</span>
              <button type="button" class="livro-fav ${favoritado ? 'ativo' : ''}" data-fav="${l.id}" aria-label="Favoritar ${l.titulo}">${favoritado ? '♥' : '♡'}</button>
            </div>
            <div class="livro-info">
              <h4>${l.titulo}</h4>
              <span class="livro-autor">${l.autor}</span>
              <span class="livro-disp ${l.disponivel ? '' : 'indisponivel'}">${l.disponivel ? 'Disponível' : 'Emprestado'}</span>
              ${l.disponivel
                ? `<button type="button" class="livro-btn" data-emprestar="${l.id}">Emprestar</button>`
                : `<button type="button" class="livro-btn secundario" data-reservar="${l.id}">Reservar</button>`}
            </div>
          </article>
        `);
      });
    }

    // ---------- Renderização: Meus empréstimos ----------
    function renderEmprestimos() {
      const tbody = document.getElementById('emprestimosTabela');
      if (!tbody) return;
      const vazio = document.getElementById('emprestimosVazio');
      const ativos = db.emprestimos.filter(e => e.status === 'ativo');

      tbody.innerHTML = '';
      vazio.hidden = ativos.length !== 0;

      ativos.forEach(e => {
        const livro = livroPorId(e.livroId);
        const st = statusEmprestimo(e);
        const podeRenovar = e.renovacoes < 2;
        tbody.insertAdjacentHTML('beforeend', `
          <tr>
            <td>${livro ? livro.titulo : '—'}</td>
            <td>${formatarBR(e.dataDevolucao)}</td>
            <td>${e.renovacoes} de 2</td>
            <td><span class="badge ${st.classe}">${st.texto}</span></td>
            <td>${podeRenovar ? `<button type="button" class="row-acao-btn" data-renovar="${e.id}">Renovar</button>` : ''}</td>
          </tr>
        `);
      });

      const multasEl = document.getElementById('multasValor');
      const multasTexto = document.getElementById('multasTexto');
      if (multasEl) {
        const atrasados = ativos.filter(e => diasRestantes(e.dataDevolucao) < 0).length;
        const valor = atrasados * 5;
        multasEl.textContent = 'R$ ' + valor;
        multasTexto.textContent = valor ? atrasados + ' empréstimo(s) em atraso — R$ 5 por dia após o vencimento.' : 'Nenhuma pendência registrada.';
      }
    }

    function renovarEmprestimo(id) {
      const emp = db.emprestimos.find(e => e.id === id);
      if (!emp || emp.renovacoes >= 2) return;
      emp.renovacoes += 1;
      const nova = new Date(emp.dataDevolucao + 'T00:00:00');
      nova.setDate(nova.getDate() + 7);
      emp.dataDevolucao = nova.toISOString().slice(0, 10);
      saveDB(db);
      renderTudo();
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

    function reservarLivro(livroId) {
      const jaReservado = db.reservas.some(r => r.livroId === Number(livroId));
      if (jaReservado) return;
      db.reservas.push({ id: novoId('r'), livroId: Number(livroId), dataReserva: hojeISO(), status: 'fila' });
      saveDB(db);
      renderTudo();
    }

    function cancelarReserva(id) {
      db.reservas = db.reservas.filter(r => r.id !== id);
      saveDB(db);
      renderTudo();
    }

    // ---------- Renderização: Histórico ----------
    function renderHistorico() {
      const tbody = document.getElementById('historicoTabela');
      if (!tbody) return;
      const vazio = document.getElementById('historicoVazio');
      tbody.innerHTML = '';
      vazio.hidden = db.historico.length !== 0;
      db.historico.forEach(h => {
        const livro = livroPorId(h.livroId);
        const titulo = h.titulo || (livro ? livro.titulo : '—');
        tbody.insertAdjacentHTML('beforeend', `
          <tr><td>${titulo}</td><td>${formatarBR(h.dataRetirada)}</td><td>${formatarBR(h.dataDevolucao)}</td></tr>
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
        grid.insertAdjacentHTML('beforeend', `
          <article class="painel-card">
            <h3>${l.titulo}</h3>
            <p>${l.autor} · ${l.disponivel ? 'Disponível' : 'Emprestado'}</p>
          </article>
        `);
      });
    }

    function toggleFavorito(livroId) {
      livroId = Number(livroId);
      const idx = db.favoritos.indexOf(livroId);
      if (idx === -1) db.favoritos.push(livroId);
      else db.favoritos.splice(idx, 1);
      saveDB(db);
      renderTudo();
    }

    // ---------- Renderização: Informações ----------
    function renderInformacoes() {
      const grid = document.getElementById('informacoesGrid');
      if (!grid) return;
      const rotuloSerie = ehProfessor ? 'Disciplina' : 'Série';
      const rotuloMatricula = ehProfessor ? 'Registro' : 'Matrícula';
      grid.innerHTML = `
        <article class="painel-card"><h3>Nome</h3><p>${db.aluno.nome}</p></article>
        <article class="painel-card"><h3>${rotuloSerie}</h3><p>${db.aluno.serie}</p></article>
        <article class="painel-card"><h3>${rotuloMatricula}</h3><p>${db.aluno.matricula}</p></article>
        <article class="painel-card"><h3>Contato</h3><p>${db.aluno.email}</p></article>
      `;
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

      campoData.min = hojeISO();

      function abrirModal(livroId) {
        livroSelecionadoId = Number(livroId);
        const livro = livroPorId(livroSelecionadoId);
        if (!livro) return;
        campoNome.value = db.aluno.nome;
        campoSerie.value = db.aluno.serie;
        campoData.value = '';
        preview.innerHTML = `
          <div class="mini-capa" style="background:${livro.cor}"></div>
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

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        const livro = livroPorId(livroSelecionadoId);
        if (!livro) return;

        db.aluno.nome = campoNome.value.trim() || db.aluno.nome;
        db.aluno.serie = campoSerie.value || db.aluno.serie;

        const dataRetirada = campoData.value || hojeISO();
        const devolucao = new Date(dataRetirada + 'T00:00:00');
        devolucao.setDate(devolucao.getDate() + 14);

        const emprestimo = {
          id: novoId('e'),
          livroId: livro.id,
          dataRetirada: dataRetirada,
          dataDevolucao: devolucao.toISOString().slice(0, 10),
          renovacoes: 0,
          status: 'ativo',
          codigo: gerarCodigo()
        };
        db.emprestimos.push(emprestimo);
        livro.disponivel = false;
        saveDB(db);
        renderTudo();

        document.getElementById('confirmaResumo').innerHTML = `
          <div><dt>Nome</dt><dd>${db.aluno.nome}</dd></div>
          <div><dt>${ehProfessor ? 'Disciplina' : 'Série'}</dt><dd>${db.aluno.serie}</dd></div>
          <div><dt>Livro escolhido</dt><dd>${livro.titulo} — ${livro.autor}</dd></div>
          <div><dt>Data de devolução</dt><dd>${formatarBR(emprestimo.dataDevolucao)} (14 dias corridos)</dd></div>
        `;
        document.getElementById('confirmaCodigo').textContent = emprestimo.codigo;
        passoForm.hidden = true;
        passoConfirma.hidden = false;
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

      const empBtn = e.target.closest('[data-emprestar]');
      if (empBtn && window.__abrirModalEmprestimo) { window.__abrirModalEmprestimo(empBtn.getAttribute('data-emprestar')); return; }

      const resBtn = e.target.closest('[data-reservar]');
      if (resBtn) { reservarLivro(resBtn.getAttribute('data-reservar')); return; }

      const cancelBtn = e.target.closest('[data-cancelar-reserva]');
      if (cancelBtn) { cancelarReserva(cancelBtn.getAttribute('data-cancelar-reserva')); return; }

      const renovarBtn = e.target.closest('[data-renovar]');
      if (renovarBtn) { renovarEmprestimo(renovarBtn.getAttribute('data-renovar')); return; }

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

    const buscaCatalogo = document.getElementById('catalogoBusca');
    if (buscaCatalogo) {
      buscaCatalogo.addEventListener('input', function () {
        filtroTexto = buscaCatalogo.value;
        renderCatalogo();
      });
    }

    function renderTudo() {
      renderTopbarAluno();
      renderInicio();
      renderCatalogo();
      renderEmprestimos();
      renderReservas();
      renderHistorico();
      renderFavoritos();
      renderInformacoes();
    }

    renderTudo();
    carregarLivrosReais(); // atualiza o catálogo com os livros reais assim que a API responder
  }
})();