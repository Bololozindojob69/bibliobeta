/* BiblioBeta 0.5 — cliente HTTP centralizado */
(function () {
  const base = '/api';
  const origin = window.location.origin;
  // ---------- Conta excluída pela Gestão ----------
  // Quando a Gestão exclui um aluno/professor que está com o site aberto, ele é levado de volta
  // ao início e vê uma tela avisando. O aviso chega de dois jeitos: em tempo real (evento
  // "conta_excluida") ou, se a pessoa estava offline, na próxima chamada à API (401 CONTA_EXCLUIDA).
  const FLAG_EXCLUIDA = 'bibliobeta_conta_excluida';
  let _excluidaTratada = false;
  function naPaginaInicial() { return /(^|\/)(index\.html)?$/i.test(window.location.pathname); }
  function mostrarTelaContaExcluida(recarregarAoFechar) {
    if (document.getElementById('bbContaExcluida')) return;
    const css = document.createElement('style');
    css.textContent =
      '#bbContaExcluida{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(15,23,42,.72);backdrop-filter:blur(4px);font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}' +
      '#bbContaExcluida .bbce-card{max-width:440px;width:100%;background:#fff;color:#1d2939;border-radius:18px;padding:32px 28px;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,.35);animation:bbceIn .25s ease-out}' +
      '#bbContaExcluida .bbce-icone{width:64px;height:64px;margin:0 auto 14px;border-radius:50%;background:#fee4e2;color:#d92d20;display:flex;align-items:center;justify-content:center;font-size:30px}' +
      '#bbContaExcluida h2{margin:0 0 10px;font-size:22px}' +
      '#bbContaExcluida p{margin:0 0 8px;line-height:1.55;color:#475467;font-size:15px}' +
      '#bbContaExcluida button{margin-top:18px;padding:12px 28px;border:0;border-radius:10px;background:#1d4ed8;color:#fff;font-size:15px;font-weight:600;cursor:pointer}' +
      '#bbContaExcluida button:hover{background:#1e40af}' +
      '#bbContaExcluida button:focus-visible{outline:3px solid #93c5fd;outline-offset:2px}' +
      '@keyframes bbceIn{from{opacity:0;transform:translateY(10px) scale(.97)}to{opacity:1;transform:none}}';
    document.head.appendChild(css);
    const box = document.createElement('div');
    box.id = 'bbContaExcluida';
    box.setAttribute('role', 'alertdialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-labelledby', 'bbceTitulo');
    box.setAttribute('aria-describedby', 'bbceTexto');
    box.innerHTML =
      '<div class="bbce-card">' +
        '<div class="bbce-icone" aria-hidden="true">!</div>' +
        '<h2 id="bbceTitulo">Sua conta foi excluída</h2>' +
        '<p id="bbceTexto">A Gestão da biblioteca excluiu a sua conta do BiblioBeta, e você foi desconectado(a).</p>' +
        '<p>Se você acha que isso foi um engano, procure a biblioteca da escola.</p>' +
        '<button type="button" id="bbceOk">Entendi</button>' +
      '</div>';
    document.body.appendChild(box);
    const ok = document.getElementById('bbceOk');
    ok.addEventListener('click', function () {
      if (recarregarAoFechar) window.location.reload(); else box.remove();
    });
    ok.focus();
  }
  function contaExcluida() {
    if (_excluidaTratada) return;
    _excluidaTratada = true;
    try { localStorage.removeItem('bibliobeta_token'); localStorage.removeItem('bibliobeta_usuario'); } catch (_) {}
    if (naPaginaInicial()) {            // já está no início: só mostra a tela
      mostrarTelaContaExcluida(true);
    } else {                            // painel do aluno etc.: volta ao início e mostra lá
      try { sessionStorage.setItem(FLAG_EXCLUIDA, '1'); } catch (_) {}
      window.location.replace('Index.html');
    }
  }
  // Chegou no início depois de ser desconectado por exclusão: mostra a tela uma única vez.
  function verificarFlagContaExcluida() {
    let achou = false;
    try { achou = sessionStorage.getItem(FLAG_EXCLUIDA) === '1'; sessionStorage.removeItem(FLAG_EXCLUIDA); } catch (_) {}
    if (achou) mostrarTelaContaExcluida(false);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', verificarFlagContaExcluida);
  else verificarFlagContaExcluida();

  // ---------- Conta desativada pela Gestão ----------
  // Diferente da exclusão: a conta continua existindo e a Gestão pode reativá-la.
  // Chega em tempo real (evento "conta_desativada"), na próxima chamada à API (403 CONTA_DESATIVADA)
  // ou ao tentar entrar (login recusado com codigo CONTA_DESATIVADA).
  const FLAG_DESATIVADA = 'bibliobeta_conta_desativada';
  let _desativadaTratada = false;
  function estilosTelasBB() {
    if (document.getElementById('bbTelasCss')) return;
    const css = document.createElement('style');
    css.id = 'bbTelasCss';
    css.textContent =
      '.bbt{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(15,23,42,.72);backdrop-filter:blur(4px);font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;overflow:auto}' +
      '.bbt .bbt-card{max-width:460px;width:100%;background:#fff;color:#1d2939;border-radius:18px;padding:30px 28px;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,.35);animation:bbtIn .25s ease-out;margin:auto}' +
      '.bbt .bbt-icone{width:64px;height:64px;margin:0 auto 14px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:30px;line-height:1}' +
      '.bbt .bbt-icone.aviso{background:#fef0c7;color:#b54708}.bbt .bbt-icone.perigo{background:#fee4e2;color:#d92d20}.bbt .bbt-icone.bloqueio{background:#e4e7ec;color:#475467}' +
      '.bbt h2{margin:0 0 10px;font-size:22px}' +
      '.bbt p{margin:0 0 8px;line-height:1.55;color:#475467;font-size:15px}' +
      '.bbt .bbt-lista{list-style:none;margin:14px 0 4px;padding:0;text-align:left;display:grid;gap:10px}' +
      '.bbt .bbt-livro{display:flex;gap:12px;align-items:center;padding:10px 12px;border:1px solid #eaecf0;border-radius:12px;background:#f9fafb}' +
      '.bbt .bbt-livro img{width:38px;height:54px;object-fit:cover;border-radius:4px;background:#e4e7ec;flex:none}' +
      '.bbt .bbt-livro strong{display:block;font-size:14px;color:#101828}' +
      '.bbt .bbt-livro small{display:block;color:#667085;font-size:12.5px;margin-top:2px}' +
      '.bbt .bbt-livro .atraso{color:#b42318;font-weight:700}' +
      '.bbt .bbt-msg{margin-top:6px;font-size:13px;color:#475467;font-style:italic}' +
      '.bbt button{margin-top:18px;padding:12px 28px;border:0;border-radius:10px;background:#1d4ed8;color:#fff;font-size:15px;font-weight:600;cursor:pointer}' +
      '.bbt button:hover{background:#1e40af}.bbt button:focus-visible{outline:3px solid #93c5fd;outline-offset:2px}' +
      '@keyframes bbtIn{from{opacity:0;transform:translateY(10px) scale(.97)}to{opacity:1;transform:none}}';
    document.head.appendChild(css);
  }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]; }); }
  function mostrarTelaContaDesativada(irParaInicio) {
    if (document.getElementById('bbContaDesativada')) return;
    estilosTelasBB();
    const box = document.createElement('div');
    box.id = 'bbContaDesativada';
    box.className = 'bbt';
    box.setAttribute('role', 'alertdialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-labelledby', 'bbcdTitulo');
    box.setAttribute('aria-describedby', 'bbcdTexto');
    box.innerHTML =
      '<div class="bbt-card">' +
        '<div class="bbt-icone bloqueio" aria-hidden="true">&#128274;</div>' +
        '<h2 id="bbcdTitulo">Sua conta está desativada</h2>' +
        '<p id="bbcdTexto">A Gestão da biblioteca desativou o seu acesso ao BiblioBeta, e você foi desconectado(a).</p>' +
        '<p>Enquanto a conta estiver desativada você não consegue entrar nem pedir livros. Se estiver com algum livro emprestado, devolva-o na biblioteca.</p>' +
        '<p>Para voltar a usar o sistema, procure a Gestão da biblioteca da escola.</p>' +
        '<button type="button" id="bbcdOk">Entendi</button>' +
      '</div>';
    document.body.appendChild(box);
    const ok = document.getElementById('bbcdOk');
    ok.addEventListener('click', function () {
      if (irParaInicio && !naPaginaInicial()) window.location.replace('Index.html'); else box.remove();
    });
    ok.focus();
  }
  function contaDesativada() {
    if (_desativadaTratada) return;
    _desativadaTratada = true;
    try { localStorage.removeItem('bibliobeta_token'); localStorage.removeItem('bibliobeta_usuario'); } catch (_) {}
    if (naPaginaInicial()) {
      mostrarTelaContaDesativada(false);
    } else {
      try { sessionStorage.setItem(FLAG_DESATIVADA, '1'); } catch (_) {}
      window.location.replace('Index.html');
    }
  }
  function verificarFlagContaDesativada() {
    let achou = false;
    try { achou = sessionStorage.getItem(FLAG_DESATIVADA) === '1'; sessionStorage.removeItem(FLAG_DESATIVADA); } catch (_) {}
    if (achou) mostrarTelaContaDesativada(false);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', verificarFlagContaDesativada);
  else verificarFlagContaDesativada();

  // ---------- Aviso: você precisa devolver o livro ----------
  // A Gestão (manual ou automático) pede a devolução. A tela aparece na hora (evento
  // "cobranca_devolucao") e de novo a cada entrada no painel enquanto o livro não for devolvido.
  // "Entendi" só fecha a tela nesta sessão do navegador; ela volta se a Gestão cobrar de novo.
  function dataBR(v) { const d = new Date(v); return isNaN(d) ? '-' : d.toLocaleDateString('pt-BR'); }
  function chaveVista(c) { return 'bibliobeta_cobranca_vista_' + c.id + '_' + c.cobranca_em; }
  function mostrarTelaDevolverLivro(lista) {
    if (!lista || !lista.length) return;
    const antiga = document.getElementById('bbDevolverLivro'); if (antiga) antiga.remove();
    estilosTelasBB();
    const agora = new Date();
    const itens = lista.map(function (c) {
      const venc = new Date(c.data_prevista_devolucao), atrasado = venc < agora;
      const dias = Math.ceil((venc - agora) / 86400000);
      const situacao = atrasado ? '<span class="atraso">Atrasado desde ' + dataBR(venc) + '</span>' : (dias <= 0 ? 'Vence hoje' : 'Devolver até ' + dataBR(venc));
      return '<li class="bbt-livro">' +
        (c.capa ? '<img src="' + esc(c.capa) + '" alt="" loading="lazy" onerror="this.remove()">' : '') +
        '<div><strong>' + esc(c.titulo) + '</strong><small>' + situacao + ' · exemplar ' + esc(c.codigo) + '</small>' +
        (c.cobranca_msg ? '<div class="bbt-msg">' + esc(c.cobranca_msg) + '</div>' : '') + '</div></li>';
    }).join('');
    const plural = lista.length > 1;
    const algumAtrasado = lista.some(function (c) { return new Date(c.data_prevista_devolucao) < agora; });
    const box = document.createElement('div');
    box.id = 'bbDevolverLivro';
    box.className = 'bbt';
    box.setAttribute('role', 'alertdialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-labelledby', 'bbdlTitulo');
    box.innerHTML =
      '<div class="bbt-card">' +
        '<div class="bbt-icone ' + (algumAtrasado ? 'perigo' : 'aviso') + '" aria-hidden="true">&#128218;</div>' +
        '<h2 id="bbdlTitulo">' + (plural ? 'Você precisa devolver ' + lista.length + ' livros' : 'Você precisa devolver um livro') + '</h2>' +
        '<p>A Gestão da biblioteca pediu a devolução ' + (plural ? 'destes livros' : 'deste livro') + '. Leve ' + (plural ? 'os exemplares' : 'o exemplar') + ' até a biblioteca da escola.</p>' +
        '<ul class="bbt-lista">' + itens + '</ul>' +
        '<p style="margin-top:12px;font-size:13px">Ao levar o livro, use <strong>Avisar devolução</strong> em “Meus empréstimos” para receber o código de devolução.</p>' +
        '<button type="button" id="bbdlOk">Entendi</button>' +
      '</div>';
    document.body.appendChild(box);
    const ok = document.getElementById('bbdlOk');
    ok.addEventListener('click', function () {
      try { lista.forEach(function (c) { sessionStorage.setItem(chaveVista(c), '1'); }); } catch (_) {}
      box.remove();
    });
    ok.focus();
  }
  async function verificarCobrancas() {
    let usuario = null;
    try { usuario = JSON.parse(localStorage.getItem('bibliobeta_usuario') || 'null'); } catch (_) {}
    if (!usuario || usuario.tipo === 'gestao' || !localStorage.getItem('bibliobeta_token')) return;
    try {
      const r = await window.BiblioBetaAPI.fetch('/api/emprestimos/cobrancas');
      if (!r.ok) return;
      let lista = await r.json();
      if (!Array.isArray(lista)) return;
      lista = lista.filter(function (c) { try { return !sessionStorage.getItem(chaveVista(c)); } catch (_) { return true; } });
      mostrarTelaDevolverLivro(lista);
    } catch (_) {}
  }
  function iniciarVerificacaoCobrancas() { if (!naPaginaInicial()) setTimeout(function () { verificarCobrancas(); }, 800); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciarVerificacaoCobrancas);
  else iniciarVerificacaoCobrancas();

  // ---------- Punição: tela "você não pode pegar livros agora" ----------
  // Aparece quando o aluno/professor tenta pedir ou reservar um livro estando punido (a API responde
  // 403 com codigo "PUNIDO") e também na hora em que a Gestão aplica a punição (evento "punicao").
  let _punicao = null;
  function punicaoVigente(p) { return !!p && (!p.fim_em || new Date(p.fim_em) > new Date()) && p.tipo !== 'advertencia'; }
  function bloqueadoAgora() { return punicaoVigente(_punicao); }
  function mostrarTelaPunicao(info) {
    if (info) _punicao = info;
    const p = _punicao;
    if (!p || document.getElementById('bbPunicao')) return;
    estilosTelasBB();
    const regular = !p.fim_em;
    const dias = regular ? 0 : Math.max(1, Math.ceil((new Date(p.fim_em) - new Date()) / 86400000));
    const quando = regular ? 'Até você devolver o livro em atraso' : 'Até ' + dataBR(p.fim_em) + ' (' + (dias === 1 ? 'falta 1 dia' : 'faltam ' + dias + ' dias') + ')';
    const box = document.createElement('div');
    box.id = 'bbPunicao';
    box.className = 'bbt';
    box.setAttribute('role', 'alertdialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-labelledby', 'bbpTitulo');
    box.innerHTML =
      '<div class="bbt-card">' +
        '<div class="bbt-icone perigo" aria-hidden="true">&#128683;</div>' +
        '<h2 id="bbpTitulo">Você não pode pegar livros agora</h2>' +
        '<p>Você está com uma <strong>punição</strong> por atraso na devolução' + (p.livro ? ' de <strong>' + esc(p.livro) + '</strong>' : '') + '. Enquanto ela estiver valendo, não é possível pedir, reservar nem retirar livros.</p>' +
        '<ul class="bbt-lista"><li class="bbt-livro"><div>' +
          '<strong>' + (regular ? 'Bloqueio até regularizar' : 'Bloqueio de ' + (p.dias_bloqueio || dias) + ' dias') + '</strong>' +
          '<small>' + esc(quando) + '</small>' +
          (p.descricao ? '<div class="bbt-msg">' + esc(p.descricao) + '</div>' : '') +
        '</div></li></ul>' +
        '<p style="margin-top:12px;font-size:13px">' + (regular ? 'Devolva o livro na biblioteca e a Gestão libera seus empréstimos.' : 'Quando o prazo terminar, tudo volta ao normal automaticamente.') + ' Dúvidas? Fale com a Gestão da biblioteca.</p>' +
        '<button type="button" id="bbpOk">Entendi</button>' +
      '</div>';
    document.body.appendChild(box);
    const ok = document.getElementById('bbpOk');
    ok.addEventListener('click', function () { box.remove(); });
    ok.focus();
  }
  async function verificarPunicao(mostrar) {
    let usuario = null;
    try { usuario = JSON.parse(localStorage.getItem('bibliobeta_usuario') || 'null'); } catch (_) {}
    if (!usuario || usuario.tipo === 'gestao' || !localStorage.getItem('bibliobeta_token')) return false;
    try {
      const r = await window.BiblioBetaAPI.fetch('/api/penalidades/bloqueio');
      if (!r.ok) return false;
      const d = await r.json();
      _punicao = d && d.bloqueado ? d.punicao : null;
      if (mostrar && bloqueadoAgora()) mostrarTelaPunicao();
      return bloqueadoAgora();
    } catch (_) { return false; }
  }
  function iniciarVerificacaoPunicao() { if (!naPaginaInicial()) setTimeout(function () { verificarPunicao(false); }, 600); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciarVerificacaoPunicao);
  else iniciarVerificacaoPunicao();

  window.BiblioBetaAPI = {
    contaExcluida,
    contaDesativada,
    mostrarTelaContaDesativada,
    verificarCobrancas,
    mostrarTelaPunicao,
    verificarPunicao,
    bloqueadoAgora,
    origin,
    base,
    url(path) {
      const p = String(path || '');
      return origin + (p.startsWith('/') ? p : '/' + p);
    },
    async fetch(path, options = {}) {
      const headers = Object.assign({}, options.headers || {});
      // Não defina Content-Type manualmente para FormData: o navegador precisa
      // adicionar automaticamente o multipart/form-data com o boundary correto.
      const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
      if (!isFormData && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
      const token = localStorage.getItem('bibliobeta_token');
      if (token && !headers.Authorization) headers.Authorization = 'Bearer ' + token;
      const controller = new AbortController();
      // Envio de e-mail (SMTP) pode demorar mais que uma requisição comum.
      const limite = options.timeout || (/teste-email|recuperar|recuperacao/i.test(String(path)) ? 60000 : 15000);
      const timeout = setTimeout(() => controller.abort(), limite);
      try {
        const { timeout: _t, ...resto } = options;
        const resp = await fetch(this.url(path), Object.assign({}, resto, { headers, signal: options.signal || controller.signal }));
        if (resp.status === 401) {
          try { const d = await resp.clone().json(); if (d && d.codigo === 'CONTA_EXCLUIDA') contaExcluida(); } catch (_) {}
        }
        if (resp.status === 403) {
          try { const d = await resp.clone().json(); if (d && d.codigo === 'CONTA_DESATIVADA' && localStorage.getItem('bibliobeta_token')) contaDesativada(); } catch (_) {}
          try { const d = await resp.clone().json(); if (d && d.codigo === 'PUNIDO') mostrarTelaPunicao(d.punicao); } catch (_) {}
        }
        return resp;
      } catch (err) {
        if (err && err.name === 'AbortError') {
          throw new Error('O servidor demorou mais de ' + Math.round(limite / 1000) + 's para responder. Verifique se o backend está rodando e se a internet/porta 465 do Gmail está liberada.');
        }
        throw err;
      } finally {
        clearTimeout(timeout);
      }
    }
  };
})();
