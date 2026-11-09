/* =====================================================
   LIVROS — Gestão / catálogo integrado ao SQLite
   ISBN -> Google Books -> API -> SQLite
   ===================================================== */
(function () {
  const API = window.BiblioBetaAPI?.base || '/api';
  const token = () => localStorage.getItem('bibliobeta_token') || '';
  const authHeaders = () => ({ 'Authorization': 'Bearer ' + token(), 'Content-Type': 'application/json' });

  const $ = id => document.getElementById(id);
  const tbody = $('livros-lista');
  const backdrop = $('modalLivroBackdrop');
  const form = $('formLivro');
  const btnBuscar = $('btnBuscarIsbn');
  const isbnInput = $('livroIsbnInput');
  const feedback = $('isbnFeedback');
  const capaArquivo = $('livroCapaArquivo');
  const btnEnviarCapa = $('btnEnviarCapa');
  const capaFeedback = $('capaFeedback');

  function escapeHtml(texto) {
    return String(texto ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }

  function normalizarISBN(v) {
    return String(v || '').toUpperCase().replace(/[^0-9X]/g, '');
  }

  function setFeedback(texto, tipo) {
    feedback.textContent = texto || '';
    feedback.style.color = tipo === 'ok' ? '#2e7d32' : tipo === 'warn' ? '#b9650a' : tipo === 'error' ? '#c62828' : '';
  }

  async function apiFetch(url, options = {}) {
    const opts = { ...options, headers: { ...authHeaders(), ...(options.headers || {}) } };
    const resp = await (window.BiblioBetaAPI?.fetch ? window.BiblioBetaAPI.fetch(url, opts) : fetch(url, opts));
    let data = null;
    try { data = await resp.json(); } catch (_) {}
    if (resp.status === 401) {
      localStorage.removeItem('bibliobeta_token');
      localStorage.removeItem('bibliobeta_usuario');
      throw new Error('Sua sessão expirou. Faça login novamente.');
    }
    if (!resp.ok) {
      const erro = new Error(data?.erro || 'Erro na comunicação com o servidor.');
      erro.status = resp.status;
      erro.data = data;
      throw erro;
    }
    return data;
  }

  // ---- Gêneros do livro (chips) ----
  let generosTodos = [];
  const generosSel = new Set();
  function renderGenerosChips() {
    const caixa = $('livroGeneros'); if (!caixa) return;
    if (!generosTodos.length) { caixa.innerHTML = '<small>Nenhum gênero cadastrado.</small>'; return; }
    caixa.innerHTML = generosTodos.map(g =>
      '<button type="button" class="genero-chip' + (generosSel.has(g.id) ? ' ativo' : '') + '" data-gid="' + g.id + '" style="--g:' + escapeHtml(g.cor || '#8d5a2b') + '" aria-pressed="' + generosSel.has(g.id) + '">' +
      escapeHtml((g.icone || '') + ' ' + g.nome) + '</button>').join('');
  }
  async function carregarGenerosLista() {
    try { generosTodos = await apiFetch(API + '/generos'); } catch (e) { generosTodos = []; console.warn('Gêneros:', e.message); }
    renderGenerosChips();
  }
  function marcarGeneros(ids) { generosSel.clear(); (ids || []).forEach(i => generosSel.add(Number(i))); renderGenerosChips(); }
  function dicaGeneros(t) { if ($('livroGenerosDica')) $('livroGenerosDica').textContent = t; }

  async function carregarCategorias() {
    const select = $('livroCategoria');
    if (!select) return [];
    try {
      const categorias = await apiFetch(API + '/categorias');
      select.innerHTML = '<option value="">Sem categoria</option>' + categorias.map(c =>
        '<option value="' + escapeHtml(String(c.id)) + '">' + escapeHtml(c.nome) + '</option>'
      ).join('');
      return categorias;
    } catch (e) {
      console.warn('Categorias:', e.message);
      return [];
    }
  }

  async function carregarLivros() {
    if (!tbody) return;
    try {
      const livros = await apiFetch(API + '/livros');
      renderCatalogo(livros);
    } catch (e) {
      tbody.innerHTML = '<tr><td colspan="7">' + escapeHtml(e.message) + '</td></tr>';
    }
  }

  function renderCatalogo(livros) {
    const totalTitulos = livros.length;
    const totalDisponiveis = livros.reduce((s, l) => s + Number(l.disponiveis || 0), 0);
    const totalExemplares = livros.reduce((s, l) => s + Number(l.quantidade || 0), 0);
    const totalEmprestados = Math.max(0, totalExemplares - totalDisponiveis);

    if ($('livrosTotalStat')) $('livrosTotalStat').textContent = String(totalTitulos);
    if ($('livrosDisponiveisStat')) $('livrosDisponiveisStat').textContent = String(totalDisponiveis);
    if ($('livrosEmprestadosStat')) $('livrosEmprestadosStat').textContent = String(totalEmprestados);

    if (!livros.length) {
      tbody.innerHTML = '<tr><td colspan="7">Nenhum livro cadastrado ainda.</td></tr>';
      return;
    }

    tbody.innerHTML = livros.map(l => {
      const qtd = Number(l.quantidade || 0);
      const disp = Number(l.disponiveis || 0);
      const capaFallback = l.isbn
        ? 'https://covers.openlibrary.org/b/isbn/' + encodeURIComponent(l.isbn) + '-M.jpg'
        : '';
      const capaHtml = l.capa || capaFallback
        ? '<img src="' + escapeHtml(l.capa || capaFallback) + '" data-fallback="' + escapeHtml(capaFallback) + '" onerror="if(this.dataset.fallback && this.src !== this.dataset.fallback) this.src=this.dataset.fallback; else this.style.display=\'none\';" alt="Capa de ' + escapeHtml(l.titulo || 'livro') + '" style="width:32px;height:44px;object-fit:cover;border-radius:6px">'
        : '<span class="avatar">' + escapeHtml((l.titulo || '?').slice(0, 2).toUpperCase()) + '</span>';
      return '<tr>' +
        '<td>' + capaHtml + '</td>' +
        '<td>' + escapeHtml(l.titulo) + '<br><small>ISBN: ' + escapeHtml(l.isbn || 'não informado') + '</small></td>' +
        '<td>' + escapeHtml(l.autor) + '</td>' +
        '<td>' + ((l.generos && l.generos.length) ? l.generos.map(g => '<span class="genero-chip genero-chip--mini" style="--g:' + escapeHtml(g.cor || '#8d5a2b') + '">' + escapeHtml((g.icone || '') + ' ' + g.nome) + '</span>').join(' ') : escapeHtml(l.categoria || '-')) + '</td>' +
        '<td>' + qtd + '</td>' +
        '<td><span class="badge ' + (disp > 0 ? 'badge-ativo' : 'badge-pendente') + '">' +
          (disp > 0 ? disp + ' disponível(is)' : 'Sem exemplares disponíveis') +
        '</span></td>' +
        '<td><button type="button" class="row-acao-btn" data-editar-livro="' + l.id + '">Editar</button> <button type="button" class="row-acao-btn" data-excluir-livro="' + l.id + '">Desativar</button></td>' +
        '</tr>';
    }).join('');
  }

  function limparFormulario() {
    if (!form) return;
    form.reset();
    $('livroQuantidade').value = 1;
    $('livroQuantidade').disabled = false;
    setFeedback('', '');
    $('livroPreview').hidden = true;
    $('livroPreviewCapa').src = '';
    form.dataset.capaUrl = '';
    form.dataset.isbn = '';
    marcarGeneros([]); dicaGeneros('Ao buscar pelo ISBN, o gênero é sugerido automaticamente.');
    if(capaArquivo) capaArquivo.value = '';
    if(capaFeedback) capaFeedback.textContent = '';
    form.dataset.editId = ''; if($('modalLivroTitulo')) $('modalLivroTitulo').textContent='Adicionar Livro ao Catálogo'; if($('btnSalvarLivro')) $('btnSalvarLivro').textContent='Adicionar ao catálogo';
  }


  async function editarLivro(id) {
    try {
      const livros = await apiFetch(API + '/livros');
      const l = livros.find(x => String(x.id) === String(id)); if (!l) return;
      await carregarCategorias();
      $('livroTitulo').value=l.titulo||''; $('livroAutor').value=l.autor||''; $('livroEditora').value=l.editora||''; $('livroAno').value=l.ano_publicacao||''; if($('livroDescricao')) $('livroDescricao').value=l.descricao||''; $('livroQuantidade').value=1; $('livroQuantidade').disabled=true; $('livroIsbnInput').value=l.isbn||''; $('livroCategoria').value=l.categoria_id||'';
      marcarGeneros((l.generos||[]).map(g=>g.id)); dicaGeneros((l.generos||[]).length?'':'Este livro ainda não tem gênero.'); form.dataset.editId=l.id; form.dataset.capaUrl=l.capa||''; form.dataset.isbn=l.isbn||''; if($('modalLivroTitulo')) $('modalLivroTitulo').textContent='Editar Livro'; if($('btnSalvarLivro')) $('btnSalvarLivro').textContent='Salvar alterações';
      backdrop.classList.add('show');
      document.body.classList.add('livro-modal-aberta');
    } catch(e){ alert(e.message); }
  }
  async function salvarEdicaoLivro(id){
    const payload={categoria_id:$('livroCategoria').value||null,titulo:$('livroTitulo').value.trim(),autor:$('livroAutor').value.trim(),editora:$('livroEditora').value.trim(),isbn:normalizarISBN($('livroIsbnInput').value),ano_publicacao:$('livroAno').value?Number($('livroAno').value):null,descricao:$('livroDescricao') ? $('livroDescricao').value.trim() : '',capa:form.dataset.capaUrl||null,generos:[...generosSel]};
    await apiFetch(API+'/livros/'+id,{method:'PUT',body:JSON.stringify(payload)}); fecharModal(); form.dataset.editId=''; await carregarLivros();
  }

  function abrirModal() {
    limparFormulario();
    backdrop.classList.add('show');
    document.body.classList.add('livro-modal-aberta');
    isbnInput.focus();
    carregarCategorias();
  }

  function fecharModal() { backdrop.classList.remove('show'); document.body.classList.remove('livro-modal-aberta'); }

  async function buscarLivroPorIsbn() {
    const isbn = normalizarISBN(isbnInput.value);
    if (!isbn) return setFeedback('Digite um ISBN válido.', 'error');

    setFeedback('Consultando ISBN...', '');
    btnBuscar.disabled = true;
    try {
      const dados = await apiFetch(API + '/livros/isbn/' + encodeURIComponent(isbn));
      $('livroTitulo').value = dados.titulo || '';
      $('livroAutor').value = dados.autor || '';
      $('livroEditora').value = dados.editora || '';
      $('livroAno').value = dados.ano_publicacao || '';
      form.dataset.capaUrl = '/api/capas/isbn/' + encodeURIComponent(dados.isbn || isbn);
      form.dataset.isbn = dados.isbn || isbn;

      const select = $('livroCategoria');
      const categoriaTexto = String(dados.categoria || '').trim().toLowerCase();
      const opcao = Array.from(select.options).find(o => o.textContent.trim().toLowerCase() === categoriaTexto);
      if (opcao) select.value = opcao.value;
      const sugeridos = dados.generos_sugeridos || [];
      if (sugeridos.length) {
        sugeridos.forEach(g => generosSel.add(g.id)); renderGenerosChips();
        dicaGeneros('Gêneros sugeridos pela API: ' + sugeridos.map(g => g.nome).join(', ') + '. Ajuste se quiser.');
      } else dicaGeneros('A API não informou o gênero deste livro. Escolha manualmente.');

      if (dados.titulo || dados.autor) {
        const capa = $('livroPreviewCapa');
        // Sempre usamos o endpoint local da BiblioBeta para a capa. O servidor
        // busca a imagem em fontes externas e entrega ao navegador, evitando
        // bloqueios/URLs quebradas de Google Books, Open Library ou editoras.
        const capaLocal = '/api/capas/isbn/' + encodeURIComponent(dados.isbn || isbn);
        const capaFallback = dados.capa && dados.capa !== capaLocal
          ? dados.capa
          : 'https://covers.openlibrary.org/b/isbn/' + encodeURIComponent(dados.isbn || isbn) + '-M.jpg';
        capa.onerror = () => {
          if (capa.src !== capaFallback) capa.src = capaFallback;
          else capa.style.display = 'none';
        };
        capa.src = capaLocal;
        capa.alt = 'Capa de ' + (dados.titulo || 'livro');
        $('livroPreviewTitulo').textContent = dados.titulo || 'Sem título';
        $('livroPreviewAutor').textContent = dados.autor || 'Autor desconhecido';
        $('livroPreview').hidden = false;
      }
      isbnInput.value = dados.isbn || isbn;
      setFeedback((dados.fonte ? 'Dados encontrados via ' + dados.fonte + '. Confira e salve o livro.' : 'Dados encontrados. Confira e salve o livro.'), 'ok');
    } catch (e) {
      // Se o ISBN já estiver cadastrado, não bloqueamos o usuário.
      // Carregamos o livro existente e deixamos o botão "Adicionar ao catálogo"
      // seguir o fluxo normal: o backend abrirá "Gerenciar exemplares" para
      // adicionar uma nova cópia, em vez de criar um título duplicado.
      if (e.status === 409 && e.data?.livro) {
        const existente = e.data.livro;
        $('livroTitulo').value = existente.titulo || '';
        $('livroAutor').value = existente.autor || '';
        $('livroIsbnInput').value = existente.isbn || isbn;
        form.dataset.isbn = existente.isbn || isbn;
        form.dataset.capaUrl = '/api/capas/isbn/' + encodeURIComponent(existente.isbn || isbn);

        const livros = await apiFetch(API + '/livros');
        const livroCompleto = livros.find(x => String(x.id) === String(existente.id));
        if (livroCompleto) {
          $('livroEditora').value = livroCompleto.editora || '';
          $('livroAno').value = livroCompleto.ano_publicacao || '';
          const select = $('livroCategoria');
          if (select && livroCompleto.categoria_id != null) select.value = String(livroCompleto.categoria_id);
        }

        $('livroPreviewTitulo').textContent = existente.titulo || 'Livro já cadastrado';
        $('livroPreviewAutor').textContent = existente.autor || 'Autor desconhecido';
        const capa = $('livroPreviewCapa');
        capa.src = '/api/capas/isbn/' + encodeURIComponent(existente.isbn || isbn);
        capa.alt = 'Capa de ' + (existente.titulo || 'livro');
        capa.style.display = 'block';
        $('livroPreview').hidden = false;
        setFeedback('Este livro já está no catálogo. Clique em "Adicionar ao catálogo" para adicionar outra cópia.', 'warn');
      } else if (/já está cadastrado/i.test(e.message)) {
        setFeedback(e.message, 'warn');
      } else {
        setFeedback(e.message, 'error');
      }
    } finally {
      btnBuscar.disabled = false;
    }
  }

  async function enviarCapaManual() {
    if(!capaArquivo?.files?.[0]) {
      if(capaFeedback) { capaFeedback.textContent='Selecione uma imagem primeiro.'; capaFeedback.style.color='#c62828'; }
      return;
    }
    const arquivo=capaArquivo.files[0];
    if(arquivo.size>5*1024*1024) {
      if(capaFeedback) { capaFeedback.textContent='A capa deve ter no máximo 5 MB.'; capaFeedback.style.color='#c62828'; }
      return;
    }
    const fd=new FormData(); fd.append('capa',arquivo);
    btnEnviarCapa.disabled=true;
    if(capaFeedback) { capaFeedback.textContent='Enviando capa para o servidor...'; capaFeedback.style.color=''; }
    try {
      const resp=await (window.BiblioBetaAPI?.fetch
        ? window.BiblioBetaAPI.fetch(API+'/capas/upload',{method:'POST',body:fd})
        : fetch(API+'/capas/upload',{method:'POST',headers:{'Authorization':'Bearer '+token()},body:fd}));
      let data=null; try{data=await resp.json()}catch(_){}
      if(!resp.ok) throw new Error(data?.erro||'Não foi possível enviar a capa.');
      form.dataset.capaUrl=data.url;
      const capa=$('livroPreviewCapa'); capa.src=data.url; capa.style.display='block';
      $('livroPreview').hidden=false;
      if(capaFeedback) { capaFeedback.textContent='Capa enviada e salva no servidor.'; capaFeedback.style.color='#2e7d32'; }
    } catch(e) {
      if(capaFeedback) { capaFeedback.textContent=e.message; capaFeedback.style.color='#c62828'; }
    } finally { btnEnviarCapa.disabled=false; }
  }

  async function salvarLivro(e) {
    e.preventDefault();
    if(form.dataset.editId){ try{ await salvarEdicaoLivro(form.dataset.editId); setFeedback('Livro atualizado com sucesso!','ok'); } catch(err){ setFeedback(err.message,'error'); } return; }
    const isbn = normalizarISBN(form.dataset.isbn || isbnInput.value);
    const titulo = $('livroTitulo').value.trim();
    const autor = $('livroAutor').value.trim();
    const quantidade = Math.max(1, Number($('livroQuantidade').value) || 1);

    if (!titulo || !autor) return setFeedback('Título e autor são obrigatórios.', 'error');
    if (isbn && !/^\d{10}$|^\d{9}X$|^\d{13}$/.test(isbn)) return setFeedback('ISBN deve ter 10 ou 13 caracteres válidos.', 'error');

    const botaoSalvar = form.querySelector('button[type="submit"]');
    botaoSalvar.disabled = true;
    setFeedback('Salvando no banco de dados...', '');

    try {
      const livro = await apiFetch(API + '/livros', {
        method: 'POST',
        body: JSON.stringify({
          isbn: isbn || null,
          titulo,
          autor,
          editora: $('livroEditora').value.trim() || null,
          ano_publicacao: $('livroAno').value ? Number($('livroAno').value) : null,
          categoria_id: $('livroCategoria').value ? Number($('livroCategoria').value) : null,
          capa: form.dataset.capaUrl || null,
          generos: [...generosSel],
          quantidade
        })
      });
      setFeedback('Livro salvo no banco com sucesso!', 'ok');
      fecharModal();
      await carregarLivros();
      console.log('Livro cadastrado:', livro);
    } catch (e) {
      if (e.status === 409 && e.data?.livro_existente_id) {
        setFeedback('Este livro já existe no catálogo.', 'warn');
        fecharModal();
        return;
      } else {
        setFeedback(e.message, 'error');
      }
    } finally {
      botaoSalvar.disabled = false;
    }
  }

  async function abrirGerenciadorExemplares(livroId) {
    const modal = $('modalExemplares');
    const tbodyEx = $('exemplaresLivroLista');
    if (!modal || !tbodyEx) return;
    modal.dataset.livroId = String(livroId);
    try {
      const livros = await apiFetch(API + '/livros');
      const livro = livros.find(x => String(x.id) === String(livroId));
      if (!livro) throw new Error('Livro não encontrado.');
      $('exemplaresTitulo').textContent = 'Exemplares — ' + livro.titulo;
      $('exemplaresSubtitulo').textContent = 'O título fica único no catálogo. Aqui você controla cada cópia física, sua localização e seu status.';
      await carregarListaExemplares(livroId);
      $('novoExemplarObservacao').value = '';
      $('exemplarMensagem').textContent = '';
      modal.hidden = false;
      modal.setAttribute('aria-hidden','false');
      document.body.classList.add('notificacao-modal-aberta');
    } catch(e) {
      alert(e.message);
    }
  }

  async function carregarListaExemplares(livroId) {
    const tbodyEx = $('exemplaresLivroLista');
    const resumo = $('exemplaresResumo');
    const lista = await apiFetch(API + '/livros/' + livroId + '/exemplares');
    const contar = st => lista.filter(x => x.status === st).length;
    resumo.innerHTML =
      '<div class="exemplares-resumo-item"><strong>'+lista.length+'</strong><span>Total</span></div>' +
      '<div class="exemplares-resumo-item"><strong>'+contar('disponivel')+'</strong><span>Disponíveis</span></div>' +
      '<div class="exemplares-resumo-item"><strong>'+contar('emprestado')+'</strong><span>Emprestados</span></div>' +
      '<div class="exemplares-resumo-item"><strong>'+lista.filter(x=>['danificado','perdido'].includes(x.status)).length+'</strong><span>Indisponíveis</span></div>';
    tbodyEx.innerHTML = lista.map(x =>
      '<tr><td><span class="exemplar-codigo">'+escapeHtml(x.codigo)+'</span></td>' +
      '<td><span class="exemplar-localizacao">'+escapeHtml(x.localizacao || 'Sem localização')+'</span></td>' +
      '<td><span class="badge '+(x.status==='disponivel'?'badge-ativo':'badge-pendente')+' exemplar-status">'+escapeHtml(x.status)+'</span></td>' +
      '<td>'+escapeHtml(x.observacao || '—')+'</td>' +
      '<td>'+(x.status==='emprestado'?'Em empréstimo':'—')+'</td></tr>'
    ).join('') || '<tr><td colspan="5">Nenhum exemplar cadastrado.</td></tr>';
  }

  function fecharGerenciadorExemplares() {
    const modal = $('modalExemplares');
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute('aria-hidden','true');
    document.body.classList.remove('notificacao-modal-aberta');
  }

  if ($('btnAdicionarExemplar')) $('btnAdicionarExemplar').addEventListener('click', async () => {
    const modal = $('modalExemplares');
    const livroId = modal?.dataset.livroId;
    const msg = $('exemplarMensagem');
    const btn = $('btnAdicionarExemplar');
    if (!livroId) return;
    btn.disabled = true; msg.textContent='Adicionando exemplar...'; msg.className='form-msg';
    try {
      await apiFetch(API + '/livros/' + livroId + '/exemplares', {
        method:'POST',
        body:JSON.stringify({observacao:$('novoExemplarObservacao').value.trim()})
      });
      msg.textContent='Exemplar adicionado com sucesso.'; msg.className='form-msg sucesso';
      $('novoExemplarObservacao').value='';
      await carregarListaExemplares(livroId);
      await carregarLivros();
    } catch(e) {
      msg.textContent=e.message; msg.className='form-msg erro';
    } finally { btn.disabled=false; }
  });

  if ($('fecharExemplares')) $('fecharExemplares').addEventListener('click', fecharGerenciadorExemplares);
  document.querySelectorAll('[data-fechar-exemplares]').forEach(el => el.addEventListener('click', fecharGerenciadorExemplares));

  if ($('btnAbrirModalLivro')) $('btnAbrirModalLivro').addEventListener('click', abrirModal);
  if ($('livroGeneros')) $('livroGeneros').addEventListener('click', e => {
    const b = e.target.closest('[data-gid]'); if (!b) return;
    const id = Number(b.dataset.gid);
    if (generosSel.has(id)) generosSel.delete(id); else generosSel.add(id);
    renderGenerosChips();
  });
  // Em livro já salvo: pede ao servidor para procurar o gênero nas APIs de ISBN. Em livro novo: usa o ISBN digitado.
  if ($('btnGenerosApi')) $('btnGenerosApi').addEventListener('click', async () => {
    const btn = $('btnGenerosApi'); btn.disabled = true; dicaGeneros('Procurando...');
    try {
      const editId = form.dataset.editId;
      if (editId) {
        const r = await apiFetch(API + '/livros/' + editId + '/detectar-generos', { method: 'POST', body: JSON.stringify({}) });
        if (r.generos && r.generos.length) { r.generos.forEach(n => { const g = generosTodos.find(x => x.nome === n); if (g) generosSel.add(g.id); }); renderGenerosChips(); dicaGeneros('Encontrado: ' + r.generos.join(', ') + '. Clique em "Salvar alterações" para gravar.'); }
        else dicaGeneros(r.motivo || 'A API não informou o gênero.');
      } else {
        const isbn = normalizarISBN(isbnInput.value);
        if (!isbn) { dicaGeneros('Digite o ISBN primeiro e clique em buscar.'); return; }
        await buscarLivroPorIsbn();
      }
    } catch (e) { dicaGeneros(e.message); }
    finally { btn.disabled = false; }
  });
  if ($('btnDetectarGeneros')) $('btnDetectarGeneros').addEventListener('click', async () => {
    const btn = $('btnDetectarGeneros'); const antes = btn.textContent; btn.disabled = true; btn.textContent = 'Procurando...';
    try {
      const r = await apiFetch(API + '/generos/detectar-todos', { method: 'POST', body: JSON.stringify({}) });
      alert(r.analisados ? ('Livros sem gênero analisados: ' + r.analisados + '\nGênero encontrado para: ' + r.com_genero + (r.com_genero < r.analisados ? '\nOs demais ficam para você escolher em "Editar".' : '')) : 'Todos os livros já têm gênero.');
      await carregarLivros();
    } catch (e) { alert(e.message); }
    finally { btn.disabled = false; btn.textContent = antes; }
  });
  // O botão abre o seletor de arquivos. Depois que a imagem é escolhida,
  // ela é enviada automaticamente para o servidor e fica vinculada ao livro.
  if (btnEnviarCapa) btnEnviarCapa.addEventListener('click', ()=>capaArquivo?.click());
  if (capaArquivo) capaArquivo.addEventListener('change', async ()=>{
    const a=capaArquivo.files?.[0];
    const nome=$('nomeCapaSelecionada');
    if(!a) return;
    if(nome) nome.textContent=a.name;
    await enviarCapaManual();
  });
  document.addEventListener('click', async e=>{
    const rb=e.target.closest('[data-reativar-livro]'); if(rb){await reativarLivro(rb.dataset.reativarLivro);return;}
        const ed=e.target.closest('[data-editar-livro]'); if(ed){await editarLivro(ed.dataset.editarLivro);return;}
    const del=e.target.closest('[data-excluir-livro]'); if(del){if(!confirm('Desativar este livro do catálogo?'))return;try{const r=await apiFetch(API+'/livros/'+del.dataset.excluirLivro,{method:'DELETE'});await carregarLivros();await carregarLivrosDesativados();alert('Livro desativado. Ele ficou em Livros desativados e poderá ser colocado novamente no catálogo pela Gestão.');}catch(err){alert(err.message)}}
  });

  if ($('modalLivroClose')) $('modalLivroClose').addEventListener('click', fecharModal);
  if ($('btnCancelarLivro')) $('btnCancelarLivro').addEventListener('click', fecharModal);
  if (backdrop) backdrop.addEventListener('click', e => { if (e.target === backdrop) fecharModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && backdrop?.classList.contains('show')) fecharModal(); });
  if (btnBuscar) btnBuscar.addEventListener('click', buscarLivroPorIsbn);
  if (isbnInput) isbnInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); buscarLivroPorIsbn(); } });
  if (form) form.addEventListener('submit', salvarLivro);

  carregarCategorias();
  carregarGenerosLista();
  carregarLivros();
  window.addEventListener('bibliobeta:categorias-atualizadas', ()=>carregarCategorias());

  async function carregarLivrosDesativados() {
    const t = $('livros-desativados-lista'); if (!t) return;
    try {
      const lista = await apiFetch(API + '/livros-desativados');
      t.innerHTML = lista.length ? lista.map(l => '<tr><td><strong>' + escapeHtml(l.titulo) + '</strong></td><td>' + escapeHtml(l.autor || '-') + '</td><td>' + escapeHtml(l.isbn || '-') + '</td><td>' + Number(l.quantidade || 0) + '</td><td><button type="button" class="row-acao-btn" data-reativar-livro="' + l.id + '">Colocar no catálogo</button></td></tr>').join('') : '<tr><td colspan="5">Nenhum livro desativado.</td></tr>';
    } catch(e) { t.innerHTML = '<tr><td colspan="5">' + escapeHtml(e.message) + '</td></tr>'; }
  }

  async function reativarLivro(id) {
    const l = await apiFetch(API + '/livros-desativados');
    const livro = l.find(x => String(x.id) === String(id));
    if (!livro) return;
    if (!confirm('Colocar "' + livro.titulo + '" novamente no catálogo?')) return;
    try {
      await apiFetch(API + '/livros/' + id + '/reativar', {method:'POST', body:JSON.stringify({})});
      await carregarLivros();
      await carregarLivrosDesativados();
      alert('Livro reativado e voltou ao catálogo.');
    } catch(e) { alert(e.message); }
  }


  document.getElementById('btnAtualizarDesativados')?.addEventListener('click', carregarLivrosDesativados);
  carregarLivrosDesativados();

  // Tempo real: quando a Gestão avisa que algo mudou, recarrega o catálogo sem F5.
  document.addEventListener('bibliobeta:atualizar', function () {
    try { carregarLivros(); if (typeof carregarLivrosDesativados === 'function') carregarLivrosDesativados(); } catch (e) { /* ignora */ }
  });
})();
