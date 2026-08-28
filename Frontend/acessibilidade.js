/* =====================================================
   ACESSIBILIDADE - leitura por voz (Web Speech API)
   + alto contraste persistente
   Sistema BiblioBeta  —  versão corrigida
   Correções:
   - não repete mais a mesma fala (clique duplicado em label/input,
     bubbling e cliques repetidos no mesmo elemento)
   - fala ao clicar em praticamente qualquer área com texto
   - usa voz pt-BR quando disponível
   ===================================================== */
(function () {
  var KEY_SELECT = 'bibliobeta-theme-select-v1';
  var KEY_VOZ = 'bibliobeta-a11y-voz-v1';
  var KEY_VEL = 'bibliobeta-a11y-velocidade-v1';

  try {
    if (localStorage.getItem(KEY_SELECT) === 'contraste') {
      document.documentElement.classList.add('alto-contraste');
    }
  } catch (e) { /* ignora */ }

  var suporte = 'speechSynthesis' in window;
  var vozPt = null;

  function carregarVozes() {
    if (!suporte) return;
    var vozes = window.speechSynthesis.getVoices() || [];
    vozPt = vozes.filter(function (v) { return /pt[-_]?BR/i.test(v.lang); })[0] ||
      vozes.filter(function (v) { return /^pt/i.test(v.lang); })[0] || null;
  }
  if (suporte) {
    carregarVozes();
    window.speechSynthesis.onvoiceschanged = carregarVozes;
  }

  var fab = document.createElement('button');
  fab.className = 'a11y-fab';
  fab.type = 'button';
  fab.id = 'a11yFab';
  fab.setAttribute('aria-label', 'Abrir opções de acessibilidade e leitura por voz');
  fab.setAttribute('aria-expanded', 'false');
  fab.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="12" cy="4" r="2"/><path d="M4 8h16"/><path d="M12 8v6"/><path d="M9 21l3-7 3 7"/></svg>';

  var painel = document.createElement('div');
  painel.className = 'a11y-panel';
  painel.id = 'a11yPanel';
  painel.setAttribute('role', 'dialog');
  painel.setAttribute('aria-label', 'Acessibilidade');
  painel.innerHTML =
    '<h4>Acessibilidade</h4>' +
    '<div class="a11y-row"><label for="a11yContraste">Alto contraste</label>' +
    '<input type="checkbox" id="a11yContraste"></div>' +
    '<div class="a11y-row"><label for="a11yVoz">Ler ao clicar no texto</label>' +
    '<input type="checkbox" id="a11yVoz"></div>' +
    '<div class="a11y-row"><label for="a11yVelocidade">Velocidade da voz</label>' +
    '<input type="range" id="a11yVelocidade" min="0.6" max="1.6" step="0.1" value="1"></div>' +
    '<div class="a11y-actions">' +
    '<button type="button" class="a11y-btn" id="a11yLerPagina">Ler página</button>' +
    '<button type="button" class="a11y-btn secondary" id="a11yParar">Parar</button>' +
    '</div>' +
    '<span class="a11y-hint" id="a11yHint">Com a leitura ativada, clique em qualquer texto para ouvi-lo.</span>';

  function montar() {
    if (document.getElementById('a11yFab')) return;
    document.body.appendChild(fab);
    document.body.appendChild(painel);
    iniciar();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', montar);
  } else {
    montar();
  }

  function iniciar() {
    var chkContraste = document.getElementById('a11yContraste');
    var chkVoz = document.getElementById('a11yVoz');
    var velocidade = document.getElementById('a11yVelocidade');
    var btnLer = document.getElementById('a11yLerPagina');
    var btnParar = document.getElementById('a11yParar');
    var hint = document.getElementById('a11yHint');

    chkContraste.checked = document.documentElement.classList.contains('alto-contraste');

    try {
      chkVoz.checked = localStorage.getItem(KEY_VOZ) === '1';
      var v = parseFloat(localStorage.getItem(KEY_VEL));
      if (!isNaN(v)) velocidade.value = v;
    } catch (e) { /* ignora */ }

    if (!suporte) {
      chkVoz.disabled = true;
      btnLer.disabled = true;
      btnParar.disabled = true;
      hint.textContent = 'Seu navegador não oferece leitura por voz.';
    }

    function alternar() {
      var aberto = painel.classList.toggle('show');
      fab.setAttribute('aria-expanded', aberto ? 'true' : 'false');
    }
    fab.addEventListener('click', function (e) { e.stopPropagation(); alternar(); });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        painel.classList.remove('show');
        fab.setAttribute('aria-expanded', 'false');
        parar();
      }
    });

    chkContraste.addEventListener('change', function () {
      document.documentElement.classList.toggle('alto-contraste', chkContraste.checked);
      var select = document.getElementById('themeSelect');
      if (chkContraste.checked) {
        if (select && window.BiblioBetaTema) {
          select.value = 'contraste';
          window.BiblioBetaTema.setTheme('contraste');
        }
      } else if (select && window.BiblioBetaTema) {
        select.value = 'laranja';
        window.BiblioBetaTema.setTheme('laranja');
      }
    });

    // ---------- voz ----------
    function parar() {
      if (!suporte) return;
      window.speechSynthesis.cancel();
      var lendo = document.querySelectorAll('.a11y-lendo');
      for (var i = 0; i < lendo.length; i++) lendo[i].classList.remove('a11y-lendo');
    }

    var falaAtualId = 0;

    function falar(texto, alvo) {
      if (!suporte || !texto) return;
      falaAtualId++;
      var minhaFala = falaAtualId;
      parar();
      var partes = dividir(texto);
      // pequeno atraso: o cancel() do Chrome é assíncrono e engolia/repetia falas
      setTimeout(function () {
        // se outra fala mais nova começou nesse meio-tempo, esta fica cancelada
        if (minhaFala !== falaAtualId) return;
        partes.forEach(function (parte, i) {
          var u = new SpeechSynthesisUtterance(parte);
          u.lang = 'pt-BR';
          if (vozPt) u.voice = vozPt;
          u.rate = parseFloat(velocidade.value) || 1;
          if (alvo && i === 0) {
            u.onstart = function () { alvo.classList.add('a11y-lendo'); };
          }
          if (i === partes.length - 1) {
            u.onend = function () { if (alvo) alvo.classList.remove('a11y-lendo'); };
          }
          window.speechSynthesis.speak(u);
        });
      }, 90);
    }

    function dividir(texto) {
      var limpo = texto.replace(/\s+/g, ' ').trim();
      var frases = limpo.match(/[^.!?]+[.!?]*/g) || [limpo];
      var blocos = [];
      var atual = '';
      frases.forEach(function (f) {
        if ((atual + f).length > 200) { if (atual.trim()) blocos.push(atual.trim()); atual = f; }
        else { atual += f; }
      });
      if (atual.trim()) blocos.push(atual.trim());
      return blocos;
    }

    btnParar.addEventListener('click', function (e) {
      e.stopPropagation();
      falaAtualId++; // invalida qualquer fala ainda pendente no setTimeout
      parar();
    });

    btnLer.addEventListener('click', function (e) {
      e.stopPropagation();
      var main = document.querySelector('.painel-pane.active') ||
        document.querySelector('main') || document.body;
      falar(main.innerText, null);
    });

    chkVoz.addEventListener('change', function () {
      try { localStorage.setItem(KEY_VOZ, chkVoz.checked ? '1' : '0'); } catch (e) { /* ignora */ }
      if (!chkVoz.checked) parar();
      hint.textContent = chkVoz.checked
        ? 'Leitura ativada: clique em qualquer texto para ouvi-lo.'
        : 'Com a leitura ativada, clique em qualquer texto para ouvi-lo.';
    });

    velocidade.addEventListener('input', function () {
      try { localStorage.setItem(KEY_VEL, velocidade.value); } catch (e) { /* ignora */ }
    });

    // ---------- ler ao clicar ----------
    var LEGIVEIS = 'p,h1,h2,h3,h4,h5,h6,li,a,button,label,span,strong,em,small,td,th,' +
      'summary,blockquote,figcaption,dt,dd,option,legend,.card,.painel-pane,section,article';

    var ultimoTexto = '';
    var ultimoTempo = 0;

    function textoDe(el) {
      if (!el) return '';
      var t = (el.getAttribute && el.getAttribute('aria-label')) ||
        (el.innerText || el.textContent || '');
      return t.replace(/\s+/g, ' ').trim();
    }

    function alvoLegivel(el) {
      var direto = el.closest ? el.closest(LEGIVEIS) : null;
      if (direto && textoDe(direto)) return direto;
      // sobe até achar algo com texto (cards, divs, etc.)
      var atual = el;
      while (atual && atual !== document.body) {
        if (textoDe(atual)) return atual;
        atual = atual.parentElement;
      }
      return null;
    }

    document.addEventListener('click', function (e) {
      var dentroPainel = painel.contains(e.target) || fab.contains(e.target);

      // fecha o painel ao clicar fora
      if (!dentroPainel) {
        painel.classList.remove('show');
        fab.setAttribute('aria-expanded', 'false');
      }

      if (!chkVoz.checked || !suporte || dentroPainel) return;

      // não lê nada ao clicar em campos editáveis (input, textarea, select, contenteditable)
      // isso evita que a leitura "atrapalhe" quem está digitando
      var alvoClicado = e.target;
      var elEditavel = alvoClicado.closest
        ? alvoClicado.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]')
        : null;
      if (elEditavel || alvoClicado.isContentEditable) return;

      var alvo = alvoLegivel(e.target);
      if (!alvo) return;

      var texto = textoDe(alvo);
      if (!texto) return;
      if (texto.length > 1200) texto = texto.slice(0, 1200);

      // evita repetição: label -> input dispara 2 cliques com o mesmo texto
      var agora = Date.now();
      if (texto === ultimoTexto && agora - ultimoTempo < 700) return;
      ultimoTexto = texto;
      ultimoTempo = agora;

      falar(texto, alvo);
    }, true);

    window.addEventListener('beforeunload', parar);
    window.addEventListener('pagehide', parar);
  }
})();