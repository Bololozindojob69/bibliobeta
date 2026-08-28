/* =====================================================
   PAINEL - tema + navbar lateral (glider)
   Sistema BiblioBeta
   ===================================================== */
(function () {
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
    const DB_KEY = 'bibliobeta-db-v1';

    function hojeISO() {
      const d = new Date();
      return d.toISOString().slice(0, 10);
    }

    function seedDB() {
      return {
        aluno: {
          nome: 'Maria Silva',
          serie: '8º Ano A',
          matricula: '2026084512',
          email: 'maria.silva@escola.com'
        },
        livros: [
          { id: 1,  titulo: 'Dom Casmurro', autor: 'Machado de Assis', categoria: 'Ficção', cor: '#8d5a2b', disponivel: true },
          { id: 2,  titulo: 'O Cortiço', autor: 'Aluísio Azevedo', categoria: 'Ficção', cor: '#b9650a', disponivel: true },
          { id: 3,  titulo: 'O Hobbit', autor: 'J.R.R. Tolkien', categoria: 'Juvenil', cor: '#6b4a8a', disponivel: true },
          { id: 4,  titulo: 'Extraordinário', autor: 'R.J. Palacio', categoria: 'Juvenil', cor: '#c9822f', disponivel: true },
          { id: 5,  titulo: 'O Sol é para Todos', autor: 'Harper Lee', categoria: 'Ficção', cor: '#3d2b1f', disponivel: false },
          { id: 6,  titulo: 'O Pequeno Príncipe', autor: 'Antoine de Saint-Exupéry', categoria: 'Infantil', cor: '#e0942c', disponivel: true },
          { id: 7,  titulo: 'A Menina que Roubava Livros', autor: 'Markus Zusak', categoria: 'Ficção', cor: '#a14b2b', disponivel: true },
          { id: 8,  titulo: '1984', autor: 'George Orwell', categoria: 'Ficção', cor: '#43506b', disponivel: false },
          { id: 9,  titulo: 'Torto Arado', autor: 'Itamar Vieira Jr.', categoria: 'Ficção', cor: '#7a3e2b', disponivel: true },
          { id: 10, titulo: 'Marcelo, Marmelo, Martelo', autor: 'Ruth Rocha', categoria: 'Infantil', cor: '#3e8f6b', disponivel: true },
          { id: 11, titulo: 'Vidas Secas', autor: 'Graciliano Ramos', categoria: 'Não ficção', cor: '#5c4a3d', disponivel: true },
          { id: 12, titulo: 'Capitães da Areia', autor: 'Jorge Amado', categoria: 'Ficção', cor: '#2c6e7a', disponivel: true },
          { id: 13, titulo: 'Sapiens', autor: 'Yuval Noah Harari', categoria: 'Não ficção', cor: '#4a4a4a', disponivel: true },
          { id: 14, titulo: 'O Diário de Anne Frank', autor: 'Anne Frank', categoria: 'Biografias', cor: '#8a6d3b', disponivel: true },
          { id: 15, titulo: 'Steve Jobs', autor: 'Walter Isaacson', categoria: 'Biografias', cor: '#2f2f2f', disponivel: true }
        ],
        emprestimos: [
          { id: 'e1', livroId: 1, dataRetirada: '2026-08-04', dataDevolucao: '2026-08-18', renovacoes: 0, status: 'ativo', codigo: 'AB72-XK9P' },
          { id: 'e2', livroId: 2, dataRetirada: '2026-08-11', dataDevolucao: '2026-08-25', renovacoes: 1, status: 'ativo', codigo: 'CT31-QW4L' }
        ],
        reservas: [
          { id: 'r1', livroId: 8, dataReserva: '2026-08-10', status: 'pronto' }
        ],
        historico: [
          { livroId: 12, dataRetirada: '2026-03-02', dataDevolucao: '2026-03-16' },
          { livroId: 1,  dataRetirada: '2026-02-20', dataDevolucao: '2026-03-05', titulo: 'Memórias Póstumas de Brás Cubas' },
          { livroId: 5,  dataRetirada: '2026-01-08', dataDevolucao: '2026-01-22', titulo: 'Iracema' }
        ],
        favoritos: [3, 4, 5]
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
      // só roda na página do Aluno: exige também #inicioNome, exclusivo dela
      if (!userName || !document.getElementById('inicioNome')) return;
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
      grid.innerHTML = `
        <article class="painel-card"><h3>Nome</h3><p>${db.aluno.nome}</p></article>
        <article class="painel-card"><h3>Série</h3><p>${db.aluno.serie}</p></article>
        <article class="painel-card"><h3>Matrícula</h3><p>${db.aluno.matricula}</p></article>
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
          <div><dt>Nome do aluno</dt><dd>${db.aluno.nome}</dd></div>
          <div><dt>Série</dt><dd>${db.aluno.serie}</dd></div>
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
  }
})();