/* BiblioBeta — tour guiado (manual interativo) do painel do aluno/professor.
   Abre pelo ícone do livro no topo. Troca de tela sozinho, destaca o que explicar e mostra um cursor "clicando". */
(function () {
  'use strict';
  var REDUZ = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PASSOS = [
    { pane: 'inicio', centro: true, titulo: 'Vamos conhecer o BiblioBeta?',
      texto: 'Em menos de 1 minuto você vê onde <strong>pedir um livro</strong>, acompanhar o pedido e <strong>devolver</strong>. Eu mudo de tela por você.' },
    { pane: 'inicio', alvo: 'label[for="nav-inicio"]', lado: 'direita', titulo: 'Início',
      texto: 'Seu resumo: <strong>prazos de devolução</strong>, avisos da biblioteca e novidades do acervo.' },
    { pane: 'catalogo', alvo: '#catalogoBusca', lado: 'baixo', titulo: 'Catálogo',
      texto: 'Todos os livros da biblioteca. Pesquise por <strong>título, autor ou assunto</strong> e escolha um gênero para filtrar.' },
    { pane: 'catalogo', alvo: '#catalogoGrid .livro-card|#catalogoGrid', lado: 'direita', titulo: 'Pedir um livro',
      texto: 'Passe o mouse na capa (ou toque, no celular) para abrir o livro e escolher <strong>Solicitar empréstimo</strong>. O coração ♥ guarda para ler depois.' },
    { pane: 'solicitacoes', alvo: '#pane-solicitacoes h2', lado: 'baixo', titulo: 'Solicitações',
      texto: 'Seu pedido fica aqui até a Gestão aprovar. Aprovado, você recebe um <strong>código de 6 números</strong> para retirar o livro na biblioteca.' },
    { pane: 'emprestimos', alvo: '#pane-emprestimos .emprestimos-card', lado: 'baixo', titulo: 'Meus Empréstimos',
      texto: 'Veja a <strong>data de devolução</strong>. Precisa de mais tempo? Toque em Renovar. Terminou? Toque em <strong>Avisar devolução</strong> e leve o código à biblioteca.' },
    { pane: 'reservas', alvo: '#pane-reservas h2', lado: 'baixo', titulo: 'Reservas',
      texto: 'Todos os exemplares emprestados? Reserve e entre na fila. Quando chegar sua vez, você tem <strong>2 dias</strong> para retirar.' },
    { pane: 'reservas', alvo: '#topbarBell', lado: 'esquerda', titulo: 'Avisos',
      texto: 'O sino mostra pedido aprovado, prazo perto do fim e devolução registrada. O <strong>número vermelho</strong> é o que você ainda não leu.' },
    { pane: 'inicio', centro: true, final: true, titulo: 'Pronto!',
      texto: 'O caminho é: <strong>Catálogo → Solicitar → Retirar → Devolver</strong>. Você pode refazer este tour quando quiser, pelo ícone do livro.' }
  ];

  var el = {}, atual = 0, ativo = false, paneOrigem = 'inicio', ocupado = false, timers = [];
  var NARROW = function () { return window.matchMedia('(max-width: 900px)').matches; };
  function q(s) { return document.querySelector(s); }
  function visivel(n) { if (!n) return false; var r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0; }
  function achar(lista) { var s = lista.split('|'); for (var k = 0; k < s.length; k++) { var n = q(s[k].trim()); if (visivel(n)) return n; } return null; }
  function espera(fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; }
  function limparTimers() { timers.forEach(clearTimeout); timers = []; }

  function montar() {
    if (el.raiz) return;
    var r = document.createElement('div');
    r.className = 'bbt'; r.hidden = true;
    r.innerHTML =
      '<div class="bbt-trava"></div><div class="bbt-foco"></div>' +
      '<svg class="bbt-cursor" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3l14 8-6 1.8L9.5 19z" fill="#fff" stroke="#4A2C1A" stroke-width="1.6" stroke-linejoin="round"/></svg>' +
      '<div class="bbt-balao" role="dialog" aria-modal="true" aria-labelledby="bbtTitulo" aria-describedby="bbtTexto">' +
        '<button type="button" class="bbt-fechar" aria-label="Fechar o tour">×</button>' +
        '<h3 id="bbtTitulo"></h3><p id="bbtTexto"></p><div class="bbt-extra"></div>' +
        '<div class="bbt-rodape"><span class="bbt-prog"><i></i></span><span class="bbt-cont"></span>' +
          '<button type="button" class="bbt-b bbt-voltar">Voltar</button><button type="button" class="bbt-b bbt-prox">Próximo</button></div>' +
      '</div>';
    document.body.appendChild(r);
    el = { raiz: r, foco: r.querySelector('.bbt-foco'), cursor: r.querySelector('.bbt-cursor'), balao: r.querySelector('.bbt-balao'),
      titulo: r.querySelector('#bbtTitulo'), texto: r.querySelector('#bbtTexto'), extra: r.querySelector('.bbt-extra'),
      prog: r.querySelector('.bbt-prog i'), cont: r.querySelector('.bbt-cont'), voltar: r.querySelector('.bbt-voltar'), prox: r.querySelector('.bbt-prox') };
    r.querySelector('.bbt-fechar').addEventListener('click', function () { fechar(); });
    el.voltar.addEventListener('click', function () { ir(atual - 1); });
    el.prox.addEventListener('click', function () { atual >= PASSOS.length - 1 ? fechar() : ir(atual + 1); });
    document.addEventListener('keydown', function (e) {
      if (!ativo) return;
      if (e.key === 'Escape') fechar();
      else if (e.key === 'ArrowRight') el.prox.click();
      else if (e.key === 'ArrowLeft' && atual > 0) el.voltar.click();
    });
    window.addEventListener('resize', function () { if (ativo && !ocupado) desenhar(); });
  }

  // Troca de tela mostrando o cursor "clicando" no menu (só no computador).
  function irParaTela(pane, depois) {
    var radio = document.getElementById('nav-' + pane);
    if (!radio || radio.checked) { depois(); return; }
    var rotulo = q('label[for="nav-' + pane + '"]');
    if (REDUZ || NARROW() || !visivel(rotulo)) { radio.click(); espera(depois, 150); return; }
    var rr = rotulo.getBoundingClientRect(), x = rr.left + rr.width * 0.4, y = rr.top + rr.height / 2, c = el.cursor;
    if (!c.style.opacity || c.style.opacity === '0') { c.style.transition = 'none'; c.style.transform = 'translate(' + (innerWidth * 0.62) + 'px,' + (innerHeight * 0.7) + 'px)'; void c.offsetWidth; c.style.transition = ''; }
    c.style.opacity = '1'; c.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    espera(function () {
      c.classList.add('clicando');
      espera(function () { radio.click(); c.classList.remove('clicando'); c.style.opacity = '0'; espera(depois, 260); }, 190);
    }, 800);
  }

  function ir(n) {
    if (n < 0 || n >= PASSOS.length) return;
    limparTimers(); atual = n; ocupado = true;
    var p = PASSOS[n];
    el.balao.classList.add('oculto'); el.foco.classList.remove('visivel');
    irParaTela(p.pane, function () {
      var tentativas = 0;
      (function procurar() {
        var alvo = p.alvo ? achar(p.alvo) : null;
        if (p.alvo && !alvo && tentativas++ < 8) { espera(procurar, 150); return; }   // espera o catálogo carregar
        if (alvo) alvo.scrollIntoView({ block: 'center' });
        espera(function () { ocupado = false; desenhar(); }, 80);
      })();
    });
  }

  function desenhar() {
    var p = PASSOS[atual], alvo = p.alvo ? achar(p.alvo) : null, centro = p.centro || !alvo;
    el.raiz.classList.toggle('sem-alvo', centro);
    el.titulo.textContent = p.titulo; el.texto.innerHTML = p.texto;
    el.extra.innerHTML = p.final ? '<a class="bbt-link" href="manual.html" target="_blank" rel="noopener">Abrir o manual completo (texto)</a>' : '';
    el.cont.textContent = (atual + 1) + ' de ' + PASSOS.length;
    el.prog.style.width = ((atual + 1) / PASSOS.length * 100) + '%';
    el.voltar.hidden = atual === 0;
    el.prox.textContent = atual === 0 ? 'Começar' : (atual === PASSOS.length - 1 ? 'Concluir' : 'Próximo');
    var vw = innerWidth, vh = innerHeight, b = el.balao, pad = 8, gap = 16, x, y;
    el.balao.classList.remove('oculto');
    var bw = b.offsetWidth, bh = b.offsetHeight;
    if (centro) {
      el.foco.classList.remove('visivel');
      x = (vw - bw) / 2; y = (vh - bh) / 2;
    } else {
      var r = alvo.getBoundingClientRect();
      var fx = Math.max(4, r.left - pad), fy = Math.max(4, r.top - pad);
      var fw = Math.min(vw - 8, r.width + pad * 2), fh = Math.min(vh - 8, r.height + pad * 2);
      Object.assign(el.foco.style, { left: fx + 'px', top: fy + 'px', width: fw + 'px', height: fh + 'px' });
      el.foco.classList.add('visivel');
      var lugares = {
        direita: [fx + fw + gap, fy + fh / 2 - bh / 2], esquerda: [fx - bw - gap, fy + fh / 2 - bh / 2],
        baixo: [fx, fy + fh + gap], cima: [fx, fy - bh - gap]
      };
      var ordem = [p.lado || 'baixo', 'baixo', 'direita', 'cima', 'esquerda'], achou = null;
      for (var k = 0; k < ordem.length && !achou; k++) {
        var c = lugares[ordem[k]];
        if (c[0] >= 8 && c[1] >= 8 && c[0] + bw <= vw - 8 && c[1] + bh <= vh - 8) achou = c;
      }
      if (!achou) achou = [fx, Math.min(fy + fh + gap, vh - bh - 8)];
      x = achou[0]; y = achou[1];
    }
    b.style.left = Math.max(8, Math.min(x, vw - bw - 8)) + 'px';
    b.style.top = Math.max(8, Math.min(y, vh - bh - 8)) + 'px';
    el.prox.focus({ preventScroll: true });
  }

  function iniciar() {
    montar();
    var marcado = q('.radio-container input[type="radio"]:checked');
    paneOrigem = marcado ? marcado.value : 'inicio';
    ativo = true; el.raiz.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    ir(0);
  }

  function fechar() {
    if (!ativo) return;
    ativo = false; limparTimers(); ocupado = false;
    el.raiz.hidden = true; el.cursor.style.opacity = '0';
    document.documentElement.style.overflow = '';
    var radio = document.getElementById('nav-' + paneOrigem);
    if (radio && !radio.checked) radio.click();
  }

  function ligar() {
    var botao = document.getElementById('topbarManual');
    if (!botao) return;
    botao.setAttribute('title', 'Tour guiado pelo BiblioBeta');
    botao.setAttribute('aria-label', 'Fazer um tour guiado pelo BiblioBeta');
    botao.addEventListener('click', function (e) { e.preventDefault(); iniciar(); });
  }
  window.BiblioBetaTour = { iniciar: iniciar, fechar: fechar };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ligar); else ligar();
})();
