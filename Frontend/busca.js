/* =====================================================
   BiblioBeta — Busca única para TODAS as telas
   Um só lugar com a regra de busca. Quem usa:
   - Tabelas (.data-table-card): barra + filtros criados e ligados automaticamente
   - Listas de notificações (.bb-notifs__lista): busca + Todas / Não lidas / Lidas
   - Catálogo e Histórico do aluno/professor
   - Catálogo, Empréstimos e Solicitações da Gestão
   - Qualquer lista nova: <input type="search" data-busca-itens="#lista li">
   Regras:
   - ignora acentos e maiúsculas ("misterio" acha "Mistério")
   - várias palavras = todas precisam aparecer, cada uma como COMEÇO de palavra ("ra" acha "Racionais")
   - "RUÍDO" não conta na primeira tentativa: o domínio do e-mail (@al.educacao.sp.gov.br) e colunas de
     rótulo (Categoria, Status, Tipo...) não fazem "al" achar todo mundo. Se nada for achado, aí sim
     a busca olha essas colunas ("aluno", "gmail", "atrasado" continuam funcionando)
   - ISBN com ou sem hífen/pontos
   - uma letra só = mostra o que COMEÇA com ela (A ou a, tanto faz); nos livros, o título
   - Esc limpa a barra; o "x" do campo também funciona
   - Tabelas ganham chips de filtro (Status, Situação...) montados sozinhos a partir dos dados da coluna
   - Rápida: o texto de cada linha é normalizado uma vez só (cache) e a digitação tem um atraso mínimo
   ===================================================== */
(function () {
  'use strict';

  const normalizar = function (t) {
    return String(t == null ? '' : t)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/\s+/g, ' ').trim();
  };
  const palavras = function (termo) { return normalizar(termo).split(' ').filter(Boolean); };
  const achatar = function (campos) {
    const saida = [];
    (function empilhar(v) {
      if (Array.isArray(v)) v.forEach(empilhar);
      else if (v != null) saida.push(String(v));
    })(campos);
    return saida.join(' ');
  };
  // Tira o domínio dos e-mails ("0000123sp@al.educacao.sp.gov.br" -> "0000123sp"):
  // ele é igual para todo mundo e só atrapalha a busca.
  const semDominio = function (t) { return String(t).replace(/@[^\s,;<>]*/g, ' '); };

  // ---------- Núcleo: texto preparado + as 3 regras ----------
  function preparar(textoNormalizado) {
    const t = textoNormalizado;
    return { t: t, c: t.replace(/[\s.\-]/g, ''), w: t.split(/[^a-z0-9]+/).filter(Boolean) };
  }
  // 1) cada pedaço = COMEÇO de uma palavra. Números grandes (ISBN, ano) valem em qualquer parte.
  function porComeco(ps, p) {
    return ps.every(function (x) {
      const n = x.replace(/[^a-z0-9]/g, '');
      if (!n) return true;
      if (/^\d+$/.test(n) && n.length >= 3) return p.c.indexOf(n) !== -1;
      return p.w.some(function (w) { return w.indexOf(n) === 0; });
    });
  }
  // 2) plano B: o pedaço pode estar em qualquer parte da palavra.
  function emQualquerParte(ps, p) {
    return ps.every(function (x) {
      return p.t.indexOf(x) !== -1 || p.c.indexOf(x.replace(/[.\-]/g, '')) !== -1;
    });
  }

  // Uma letra (ou número) só: mostra quem COMEÇA com ela. A/a e acentos valem igual.
  const inicioDe = function (t) { return normalizar(t).replace(/^[^a-z0-9]+/, '').charAt(0); };
  const umCaractere = function (ps) { return ps.length === 1 && ps[0].length === 1 && /[a-z0-9]/.test(ps[0]); };
  function comecaCom(letra, campos) {
    const lista = [];
    (function empilhar(v) {
      if (Array.isArray(v)) v.forEach(empilhar);
      else if (v != null) lista.push(String(v));
    })(campos);
    return lista.some(function (c) { return inicioDe(c) === letra; });
  }

  // true se TODAS as palavras da busca aparecem em algum dos campos (começo de palavra).
  // bate('culpa estrelas', livro.titulo, livro.autor, livro.generos)
  function bate(termo) {
    const ps = palavras(termo);
    if (!ps.length) return true;
    const campos = Array.prototype.slice.call(arguments, 1);
    if (umCaractere(ps)) return comecaCom(ps[0], campos);
    return porComeco(ps, preparar(normalizar(semDominio(achatar(campos)))));
  }

  // Regra larga (plano B): o pedaço pode estar em qualquer parte da palavra (e-mail completo incluído).
  function bateAmplo(termo) {
    const ps = palavras(termo);
    if (!ps.length) return true;
    const campos = Array.prototype.slice.call(arguments, 1);
    if (umCaractere(ps)) return comecaCom(ps[0], campos);
    return emQualquerParte(ps, preparar(normalizar(achatar(campos))));
  }

  // Busca de livros: com UMA letra só, mostra os livros cujo TÍTULO começa com ela.
  function bateLivro(termo, titulo) {
    const t = normalizar(termo);
    if (t.length === 1 && /[a-z0-9]/.test(t)) {
      return normalizar(titulo).replace(/^[^a-z0-9]+/, '').charAt(0) === t;
    }
    return bate.apply(null, arguments);
  }

  // Filtra uma lista: 1º começo de palavra; se não achar nada, tenta "contém".
  // O 1º campo que camposDe(item) devolve é o "principal" (nome/título): quem casa nele vem primeiro.
  // opc.titulo(item) -> título: uma letra = título começa com ela.
  function filtrar(itens, termo, camposDe, opc) {
    const ps = palavras(termo);
    if (!ps.length) return itens.slice();
    const tit = opc && opc.titulo;
    const q = normalizar(termo);
    const passo = function (fn) {
      return itens.filter(function (i) { return fn.apply(null, [termo].concat(camposDe(i))); });
    };
    let r;
    if (tit && umCaractere(ps)) r = itens.filter(function (i) { return inicioDe(tit(i)) === ps[0]; });
    else {
      r = passo(bate);
      if (!r.length && !umCaractere(ps)) r = passo(bateAmplo);
    }
    if (r.length > 1 && !umCaractere(ps)) {
      const principal = tit || function (i) { const c = camposDe(i); return Array.isArray(c) ? achatar(c[0]) : c; };
      const nota = function (i) {
        const t = normalizar(principal(i)).replace(/^[^a-z0-9]+/, '');
        if (t.indexOf(q) === 0) return 0;                                            // começa com o que digitou
        return porComeco(ps, preparar(t)) ? 1 : 2;                                   // tem as palavras no título/nome
      };
      r = r.map(function (i, k) { return { i: i, n: nota(i), k: k }; })
        .sort(function (a, b) { return a.n - b.n || a.k - b.k; })
        .map(function (x) { return x.i; });
    }
    return r;
  }

  // Liga uma barra de pesquisa. fn(valor) roda a cada digitação (e ao limpar).
  function ligar(input, fn, opcoes) {
    if (!input || input.dataset.buscaLigada) return null;
    input.dataset.buscaLigada = '1';
    input.setAttribute('autocomplete', 'off');
    const atraso = (opcoes && opcoes.atraso) || 0;
    let t = null;
    const disparar = function () {
      clearTimeout(t);
      if (atraso) t = setTimeout(function () { fn(input.value); }, atraso);
      else fn(input.value);
    };
    input.addEventListener('input', disparar);
    input.addEventListener('search', disparar);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && input.value) { input.value = ''; clearTimeout(t); fn(''); }
    });
    return { refazer: function () { fn(input.value); } };
  }

  const ehLinhaDeAviso = function (linha) {
    return linha.cells.length === 1 && linha.cells[0].colSpan > 1;
  };

  // ---------- Tabelas ----------
  // Colunas que não entram na busca de UMA letra:
  const COLUNAS_SEM_LETRA = ['', '#', 'capa', 'acoes', 'acao', 'qtd.', 'status', 'dados', 'tipo', 'categoria', 'situacao', 'disponibilidade', 'mensagem', 'permissao', 'e-mail'];
  // Colunas de "rótulo": só entram na busca se nada for achado antes.
  const COLUNAS_ROTULO = ['', '#', 'capa', 'acoes', 'acao', 'qtd.', 'status', 'dados', 'tipo', 'categoria', 'situacao', 'disponibilidade', 'permissao'];
  const COLUNAS_SEM_TEXTO = ['', 'capa', 'acoes', 'acao'];

  function textoDaCelula(celula) {
    if (!celula.querySelector('.avatar')) return celula.textContent;
    const copia = celula.cloneNode(true);   // tira as iniciais do avatar (IM, AD...)
    copia.querySelectorAll('.avatar').forEach(function (a) { a.remove(); });
    return copia.textContent;
  }

  function colunasDaTabela(tabela) {
    const cfg = { rotulo: [], semTexto: [], semLetra: [], chave: '' };
    if (tabela) {
      Array.prototype.forEach.call(tabela.querySelectorAll('thead th'), function (th, i) {
        const nome = normalizar(th.textContent);
        if (COLUNAS_ROTULO.indexOf(nome) !== -1) cfg.rotulo.push(i);
        if (COLUNAS_SEM_TEXTO.indexOf(nome) !== -1) cfg.semTexto.push(i);
        if (COLUNAS_SEM_LETRA.indexOf(nome) !== -1) cfg.semLetra.push(i);
        cfg.chave += nome + '|';
      });
    }
    return cfg;
  }

  // Texto da linha já normalizado, guardado na própria linha (só refaz se o conteúdo mudar).
  function dadosDaLinha(linha, cfg) {
    const bruto = linha.textContent;
    const c = linha.__bb;
    if (c && c.bruto === bruto && c.chave === cfg.chave) return c;
    const textos = Array.prototype.map.call(linha.cells, textoDaCelula);
    const uteis = textos.filter(function (x, i) { return cfg.semTexto.indexOf(i) === -1; });
    const conteudo = textos.filter(function (x, i) { return cfg.semTexto.indexOf(i) === -1 && cfg.rotulo.indexOf(i) === -1; });
    const novo = {
      bruto: bruto, chave: cfg.chave,
      principal: preparar(normalizar(semDominio(conteudo.join(' ')))),   // nome, título, livro, código... sem ruído
      tudo: preparar(normalizar(uteis.join(' '))),                       // tudo, e-mail completo incluído
      letras: textos.filter(function (x, i) { return cfg.semLetra.indexOf(i) === -1; })
    };
    linha.__bb = novo;
    return novo;
  }

  // Mostra/esconde linhas de uma tabela. Devolve quantas ficaram visíveis.
  // opc.filtro(linha) -> false esconde a linha (chips de Status etc.).
  function filtrarLinhas(corpo, termo, opc) {
    const ps = palavras(termo);
    const umaLetra = umCaractere(ps);
    const filtro = opc && opc.filtro;
    const tabela = corpo.closest ? corpo.closest('table') : null;
    const cfg = colunasDaTabela(tabela);
    const todas = Array.prototype.filter.call(corpo.rows, function (l) { return !ehLinhaDeAviso(l); });

    Array.prototype.forEach.call(corpo.rows, function (linha) {
      if (ehLinhaDeAviso(linha)) linha.style.display = (ps.length || filtro) ? 'none' : '';
    });

    const passaFiltro = filtro ? todas.map(function (l) { return !!filtro(l); }) : null;
    const dados = ps.length ? todas.map(function (l) { return dadosDaLinha(l, cfg); }) : null;

    const mostrar = function (ok) {
      let n = 0;
      todas.forEach(function (linha, i) {
        const v = (!passaFiltro || passaFiltro[i]) && (ps.length ? ok(dados[i]) : true);
        linha.style.display = v ? '' : 'none';
        if (v) n++;
      });
      return n;
    };

    if (!ps.length) return mostrar(null);
    if (umaLetra) return mostrar(function (d) { return comecaCom(ps[0], d.letras); });
    // 1ª tentativa: sem ruído. 2ª: tudo (começo de palavra). 3ª: qualquer parte.
    let n = mostrar(function (d) { return porComeco(ps, d.principal); });
    if (!n) n = mostrar(function (d) { return porComeco(ps, d.tudo); });
    if (!n) n = mostrar(function (d) { return emQualquerParte(ps, d.tudo); });
    return n;
  }

  // ---------- Chips de filtro montados a partir dos dados da coluna ----------
  const COLUNAS_FILTRO = ['situacao', 'status', 'disponibilidade', 'permissao', 'tipo'];
  function colunaDoFiltro(tabela) {
    const nomes = Array.prototype.map.call(tabela.querySelectorAll('thead th'), function (th) { return normalizar(th.textContent); });
    for (let k = 0; k < COLUNAS_FILTRO.length; k++) {
      const i = nomes.indexOf(COLUNAS_FILTRO[k]);
      if (i !== -1) return i;
    }
    return -1;
  }
  const rotuloBonito = function (t) { t = String(t).replace(/\s+/g, ' ').trim(); return t.charAt(0).toUpperCase() + t.slice(1); };

  // ---------- Tabelas: barra automática em todo .data-table-card ----------
  const SEM_BUSCA = ['#', 'capa', 'acoes', 'acao', 'qtd.', 'status', 'dados'];
  function placeholderDaTabela(tabela) {
    const nomes = Array.prototype.map.call(tabela.querySelectorAll('thead th'), function (th) { return th.textContent.trim().toLowerCase(); })
      .filter(function (n) { return n && SEM_BUSCA.indexOf(normalizar(n)) === -1; })
      .slice(0, 3);
    if (!nomes.length) return 'Buscar...';
    const fim = nomes.length > 1 ? ' ou ' + nomes.pop() : '';
    return 'Buscar por ' + nomes.join(', ') + fim + '...';
  }

  function ligarTabela(card) {
    if (card.dataset.buscaTabela) return;
    const tabela = card.querySelector('.data-table');
    const titulo = card.querySelector('h3');
    if (!tabela) return;
    // Tabela de permissões (só caixinhas) não precisa de busca.
    if (/enviar e-mail/i.test(tabela.textContent.slice(0, 200)) && tabela.querySelector('input[type="checkbox"]')) return;
    // Cards que já têm barra própria (Catálogo, Empréstimos, Solicitações...) não ganham outra.
    if (card.querySelector('.table-search')) return;
    card.dataset.buscaTabela = '1';

    const campo = document.createElement('input');
    campo.type = 'search';
    campo.className = 'table-search';
    campo.placeholder = placeholderDaTabela(tabela);
    const painel = card.closest('.painel-pane');
    const nomeTela = titulo ? titulo.textContent : ((painel && painel.querySelector('h2')) ? painel.querySelector('h2').textContent : 'tabela');
    campo.setAttribute('aria-label', 'Buscar em ' + nomeTela.trim());
    if (titulo) {
      (titulo.closest('.painel-card-head') || titulo).insertAdjacentElement('afterend', campo);
    } else {
      // Tabela sem título (Multas, Contatos...): a barra vai logo acima dela.
      const envolta = tabela.parentElement;
      (envolta && envolta !== card && envolta.tagName === 'DIV' ? envolta : tabela).insertAdjacentElement('beforebegin', campo);
    }

    // Chips (Status, Situação...) — só se o card ainda não tem filtros próprios.
    let chips = null, filtroAtivo = '', assinatura = '';
    const querChips = !card.querySelector('.filtro-chips') && !card.hasAttribute('data-sem-filtro') && colunaDoFiltro(tabela) !== -1;
    if (querChips) {
      chips = document.createElement('div');
      chips.className = 'filtro-chips filtro-auto';
      chips.setAttribute('role', 'group');
      chips.hidden = true;
      campo.insertAdjacentElement('afterend', chips);
      chips.addEventListener('click', function (e) {
        const b = e.target.closest('[data-chip-valor]');
        if (!b) return;
        filtroAtivo = b.dataset.chipValor;
        aplicar();
      });
    }

    const vazio = document.createElement('p');
    vazio.className = 'table-search-vazio';
    vazio.hidden = true;
    vazio.textContent = 'Nenhum resultado para essa busca.';
    const pai = tabela.parentElement;
    (pai && pai !== card && pai.tagName === 'DIV' ? pai : tabela).insertAdjacentElement('afterend', vazio);

    const valorDaLinha = function (linha, i) {
      const c = linha.cells[i];
      return c ? normalizar(textoDaCelula(c)) : '';
    };

    // Lê os valores da coluna e (re)monta os chips só quando algo mudou.
    function montarChips(corpo) {
      if (!chips) return;
      const col = colunaDoFiltro(tabela);
      const mapa = new Map();
      let total = 0;
      Array.prototype.forEach.call(corpo.rows, function (l) {
        if (ehLinhaDeAviso(l)) return;
        const v = valorDaLinha(l, col);
        if (!v || v === '—' || v === '-') return;
        total++;
        const x = mapa.get(v) || { v: v, rotulo: rotuloBonito(textoDaCelula(l.cells[col])), n: 0 };
        x.n++; mapa.set(v, x);
      });
      const lista = Array.from(mapa.values());
      if (filtroAtivo && !mapa.has(filtroAtivo)) filtroAtivo = '';
      const util = lista.length >= 2 && lista.length <= 8;
      const nova = util ? lista.map(function (x) { return x.v + ':' + x.n; }).join('|') + '#' + total : '';
      if (nova !== assinatura) {
        assinatura = nova;
        chips.hidden = !util;
        chips.innerHTML = util
          ? '<button type="button" class="chip" data-chip-valor="">Todos (' + total + ')</button>' +
            lista.map(function (x) { return '<button type="button" class="chip" data-chip-valor="' + x.v.replace(/"/g, '') + '">' + x.rotulo.replace(/</g, '&lt;') + ' (' + x.n + ')</button>'; }).join('')
          : '';
      }
      Array.prototype.forEach.call(chips.children, function (b) { b.classList.toggle('active', b.dataset.chipValor === filtroAtivo); });
    }

    // Sempre lê a tabela NA HORA (ela pode ser recriada pelo sistema depois).
    function aplicar() {
      const corpo = card.querySelector('.data-table tbody');
      if (!corpo) return;
      montarChips(corpo);
      const termo = campo.value;
      const col = chips && !chips.hidden ? colunaDoFiltro(tabela) : -1;
      const filtro = (col !== -1 && filtroAtivo) ? function (l) { return valorDaLinha(l, col) === filtroAtivo; } : null;
      const visiveis = filtrarLinhas(corpo, termo, { filtro: filtro });
      const ativo = palavras(termo).length || filtro;
      const msg = filtro ? 'Nenhum resultado para essa busca e esse filtro.' : 'Nenhum resultado para essa busca.';
      if (vazio.textContent !== msg) vazio.textContent = msg;   // só troca se mudou (evita laço com o observador)
      vazio.hidden = !(ativo && visiveis === 0);
    }
    ligar(campo, aplicar, { atraso: 40 });
    aplicar();

    // Quando o sistema recarrega a tabela (30 em 30 s, ou após uma ação), refaz chips e filtro.
    let agendado = false;
    new MutationObserver(function () {
      if (agendado) return;
      agendado = true;
      requestAnimationFrame(function () { agendado = false; aplicar(); });
    }).observe(card, { childList: true, subtree: true });
  }

  function tabelas() {
    document.querySelectorAll('.data-table-card').forEach(ligarTabela);
  }

  // ---------- Notificações: busca + Todas / Não lidas / Lidas ----------
  function ligarNotificacoes(ul) {
    if (ul.dataset.buscaNotif) return;
    ul.dataset.buscaNotif = '1';
    const barra = document.createElement('div');
    barra.className = 'filtro-notifs';
    barra.innerHTML =
      '<input type="search" class="table-search" placeholder="Buscar nas notificações..." aria-label="Buscar nas notificações" autocomplete="off">' +
      '<div class="filtro-chips" role="group">' +
      '<button type="button" class="chip active" data-notif-filtro="todas">Todas</button>' +
      '<button type="button" class="chip" data-notif-filtro="nao-lidas">Não lidas</button>' +
      '<button type="button" class="chip" data-notif-filtro="lidas">Lidas</button></div>';
    ul.insertAdjacentElement('beforebegin', barra);
    const campo = barra.querySelector('input');
    const vazio = document.createElement('p');
    vazio.className = 'table-search-vazio';
    vazio.hidden = true;
    ul.insertAdjacentElement('afterend', vazio);
    let modo = 'todas';

    const itens = function () { return Array.prototype.filter.call(ul.children, function (li) { return li.classList.contains('bb-notif'); }); };
    const textoDe = function (li) {
      const t = li.querySelector('.bb-notif__titulo'), m = li.querySelector('.bb-notif__msg');
      return (t ? t.textContent : '') + ' ' + (m ? m.textContent : '');
    };
    function aplicar() {
      const lis = itens();
      const termo = campo.value;
      const ps = palavras(termo);
      const lida = function (li) { return li.classList.contains('bb-notif--lida'); };
      const nNao = lis.filter(function (l) { return !lida(l); }).length;
      const rot = { 'todas': 'Todas (' + lis.length + ')', 'nao-lidas': 'Não lidas (' + nNao + ')', 'lidas': 'Lidas (' + (lis.length - nNao) + ')' };
      Array.prototype.forEach.call(barra.querySelectorAll('[data-notif-filtro]'), function (b) {
        if (lis.length) b.textContent = rot[b.dataset.notifFiltro];
        b.classList.toggle('active', b.dataset.notifFiltro === modo);
      });
      barra.hidden = !lis.length;
      const doModo = lis.filter(function (l) { return modo === 'todas' || (modo === 'lidas') === lida(l); });
      let visiveis = doModo;
      if (ps.length) {
        visiveis = doModo.filter(function (l) { return bate(termo, textoDe(l)); });
        if (!visiveis.length) visiveis = doModo.filter(function (l) { return bateAmplo(termo, textoDe(l)); });
      }
      lis.forEach(function (l) { l.hidden = visiveis.indexOf(l) === -1; });
      const msg = modo === 'nao-lidas' && !ps.length ? 'Nenhuma notificação não lida. 🎉' : 'Nenhuma notificação encontrada.';
      if (vazio.textContent !== msg) vazio.textContent = msg;
      vazio.hidden = !(lis.length && !visiveis.length);
    }
    ligar(campo, aplicar, { atraso: 40 });
    barra.addEventListener('click', function (e) {
      const b = e.target.closest('[data-notif-filtro]');
      if (!b) return;
      modo = b.dataset.notifFiltro;
      aplicar();
    });
    let agendado = false;
    new MutationObserver(function () {
      if (agendado) return;
      agendado = true;
      requestAnimationFrame(function () { agendado = false; aplicar(); });
    }).observe(ul, { childList: true });
    aplicar();
  }

  // ---------- Listas quaisquer (declarativo) ----------
  // <input type="search" data-busca-itens="#minhaLista li" data-busca-vazio="#semResultado">
  function ligarListaDeclarativa(input) {
    const seletor = input.dataset.buscaItens;
    if (!seletor) return;
    const aplicar = function () {
      const termo = input.value;
      const els = document.querySelectorAll(seletor);
      const passar = function (regra) {
        let n = 0;
        els.forEach(function (el) { const ok = regra(termo, el.textContent); el.hidden = !ok; if (ok) n++; });
        return n;
      };
      let visiveis = passar(bate);
      if (!visiveis && palavras(termo).length > 0 && !umCaractere(palavras(termo))) visiveis = passar(bateAmplo);
      const aviso = input.dataset.buscaVazio && document.querySelector(input.dataset.buscaVazio);
      if (aviso) aviso.hidden = !(palavras(termo).length && visiveis === 0);
    };
    ligar(input, aplicar, { atraso: 40 });
    let agendado = false;
    new MutationObserver(function () {
      if (agendado || !palavras(input.value).length) return;
      agendado = true;
      requestAnimationFrame(function () { agendado = false; aplicar(); });
    }).observe(document.body, { childList: true, subtree: true });
  }

  function iniciar() {
    tabelas();
    document.querySelectorAll('ul.bb-notifs__lista').forEach(ligarNotificacoes);
    document.querySelectorAll('input[data-busca-itens]').forEach(ligarListaDeclarativa);
  }

  window.BiblioBetaBusca = {
    normalizar: normalizar,
    bate: bate,
    bateAmplo: bateAmplo,
    filtrar: filtrar,
    bateLivro: bateLivro,
    ligar: ligar,
    filtrarLinhas: filtrarLinhas,
    tabelas: tabelas,
    iniciar: iniciar
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
