/* =====================================================
   GESTÃO - dados reais da API
   Usuários, alunos, turmas e usuário atualmente logado.
   Sistema BiblioBeta
   ===================================================== */
(function () {
  const API_URL = 'http://localhost:3000';
  let token = localStorage.getItem('bibliobeta_token');
  let usuarioLogado = JSON.parse(localStorage.getItem('bibliobeta_usuario') || 'null');

  if (!token || !usuarioLogado || usuarioLogado.tipo !== 'gestao') {
    window.location.href = 'Index.html';
    return;
  }

  document.querySelectorAll('[data-logout]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      localStorage.removeItem('bibliobeta_token');
      localStorage.removeItem('bibliobeta_usuario');
    });
  });

  async function apiFetch(caminho) {
    const resposta = await fetch(API_URL + caminho, {
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/json'
      }
    });
    if (resposta.status === 401) {
      localStorage.removeItem('bibliobeta_token');
      localStorage.removeItem('bibliobeta_usuario');
      window.location.href = 'Index.html';
      throw new Error('Sessão expirada. Faça login novamente.');
    }
    const texto = await resposta.text();
    let dados;
    try { dados = texto ? JSON.parse(texto) : null; } catch (_) { dados = null; }
    if (!resposta.ok) throw new Error((dados && dados.erro) || 'Falha ao buscar ' + caminho);
    return dados;
  }

  function iniciais(nome) {
    const partes = String(nome || '').trim().split(/\s+/);
    return (((partes[0] || '')[0] || '') + ((partes[1] || '')[0] || '')).toUpperCase();
  }

  function rotuloTurma(aluno) {
    const serie = String(aluno.serie || '').trim();
    const turma = String(aluno.turma || '').trim();
    if (serie && turma) return serie + ' — Turma ' + turma;
    return serie ? serie : (turma ? 'Turma ' + turma : 'Sem turma');
  }

  function atualizarUsuarioLogado() {
    const nome = usuarioLogado.nome || 'Gestão';
    const avatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userName');
    const dashboardTitle = document.querySelector('#pane-dashboard h2');
    if (avatar) avatar.textContent = iniciais(nome) || 'GE';
    if (userName) userName.textContent = nome;
    if (dashboardTitle) dashboardTitle.textContent = 'Bem-vindo(a), ' + nome + '!';
  }

  function renderTabelaAlunos(alunos) {
    const card = document.querySelector('#pane-alunos .data-table-card');
    const tabela = card && card.querySelector('.data-table');
    if (!tabela) return;
    const thead = tabela.querySelector('thead tr');
    const tbody = tabela.querySelector('tbody');
    if (!tbody) return;
    if (thead) thead.innerHTML = '<th>Nome</th><th>Turma</th><th>E-mail</th><th>Status</th>';
    if (!alunos.length) {
      tbody.innerHTML = '<tr><td colspan="4">Nenhum aluno cadastrado ainda.</td></tr>';
      return;
    }
    tbody.innerHTML = alunos.map(function (a) {
      const ativo = a.status === 'ativo';
      return '<tr>' +
        '<td><div class="avatar-row"><span class="avatar">' + iniciais(a.nome) + '</span>' + a.nome + '</div></td>' +
        '<td>' + rotuloTurma(a) + '</td>' +
        '<td>' + a.email + '</td>' +
        '<td><span class="badge ' + (ativo ? 'badge-ativo' : 'badge-pendente') + '">' + (ativo ? 'Ativo' : 'Inativo') + '</span></td>' +
        '</tr>';
    }).join('');
    const totalStat = document.querySelector('#pane-alunos .painel-card .stat');
    if (totalStat) totalStat.textContent = String(alunos.length);
  }

  function renderTurmas(alunos) {
    const grid = document.querySelector('#pane-turmas .painel-grid');
    if (!grid) return;
    const grupos = {};
    alunos.forEach(function (a) {
      const chave = rotuloTurma(a);
      (grupos[chave] = grupos[chave] || []).push(a);
    });
    const chaves = Object.keys(grupos).sort();
    if (!chaves.length) {
      grid.innerHTML = '<article class="painel-card"><h3>Nenhuma turma</h3><p>Nenhum aluno com série/turma cadastrada ainda.</p></article>';
      return;
    }
    grid.innerHTML = chaves.map(function (chave) {
      const lista = grupos[chave];
      return '<article class="painel-card data-table-card">' +
        '<h3>' + chave + ' <span class="badge badge-ativo">' + lista.length + ' aluno' + (lista.length === 1 ? '' : 's') + '</span></h3>' +
        '<table class="data-table"><thead><tr><th>RA</th><th>Aluno</th><th>E-mail</th><th>Chamada</th></tr></thead><tbody>' +
        lista.map(function (a) { return '<tr><td>' + (a.ra || '-') + '</td><td>' + a.nome + '</td><td>' + a.email + '</td><td>' + (a.numero_chamada || '-') + '</td></tr>'; }).join('') +
        '</tbody></table></article>';
    }).join('');
  }

  function renderUsuarios(usuarios) {
    const lista = document.getElementById('usuarios-lista');
    const resumo = document.getElementById('usuarios-resumo');
    if (!lista || !resumo) return;

    const alunos = usuarios.filter(u => u.tipo === 'aluno').length;
    const professores = usuarios.filter(u => u.tipo === 'professor').length;
    const gestao = usuarios.filter(u => u.tipo === 'gestao').length;
    resumo.innerHTML =
      '<article class="painel-card"><div class="stat">' + alunos + '</div><h3>Alunos</h3><p>Contas cadastradas.</p></article>' +
      '<article class="painel-card"><div class="stat">' + professores + '</div><h3>Professores</h3><p>Contas cadastradas.</p></article>' +
      '<article class="painel-card"><div class="stat">' + gestao + '</div><h3>Gestão</h3><p>Contas cadastradas.</p></article>';

    if (!usuarios.length) {
      lista.innerHTML = '<tr><td colspan="4">Nenhum usuário cadastrado.</td></tr>';
      return;
    }

    const tipo = { aluno: 'Aluno', professor: 'Professor', gestao: 'Gestão' };
    lista.innerHTML = usuarios.map(function (u) {
      const souEu = usuarioLogado && Number(u.id) === Number(usuarioLogado.id);
      return '<tr>' +
        '<td><div class="avatar-row"><span class="avatar">' + iniciais(u.nome) + '</span>' + u.nome + (souEu ? ' <strong>(Você)</strong>' : '') + '</div></td>' +
        '<td>' + (tipo[u.tipo] || u.tipo) + '</td>' +
        '<td>' + u.email + '</td>' +
        '<td><span class="badge ' + (u.status === 'ativo' ? 'badge-ativo' : 'badge-pendente') + '">' + (u.status || '-') + '</span></td>' +
        '</tr>';
    }).join('');
  }

  async function iniciar() {
    atualizarUsuarioLogado();
    try {
      // Confirma os dados do usuário no banco e atualiza o localStorage.
      const me = await apiFetch('/api/auth/me');
      if (me && me.usuario) {
        usuarioLogado = me.usuario;
        localStorage.setItem('bibliobeta_usuario', JSON.stringify(usuarioLogado));
        atualizarUsuarioLogado();
      }

      const resultados = await Promise.all([
        apiFetch('/api/alunos'),
        apiFetch('/api/usuarios')
      ]);
      renderTabelaAlunos(resultados[0] || []);
      renderTurmas(resultados[0] || []);
      renderUsuarios(resultados[1] || []);
    } catch (e) {
      console.warn('Erro ao carregar dados da gestão:', e.message);
      const turma = document.querySelector('#pane-turmas .painel-grid');
      const usuarios = document.getElementById('usuarios-lista');
      if (turma) turma.innerHTML = '<article class="painel-card"><h3>Não foi possível carregar as turmas</h3><p>' + e.message + '</p></article>';
      if (usuarios) usuarios.innerHTML = '<tr><td colspan="4">Não foi possível carregar os usuários: ' + e.message + '</td></tr>';
    }
  }

  iniciar();
})();
