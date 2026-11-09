/* =====================================================
   Relógio do cartão de data e hora (Início do aluno e Gestão)
   Usa o horário do computador/celular de quem está usando.
   Marque o cartão com data-relogio; os textos são preenchidos
   pelos atributos data-rel-semana, data-rel-data, data-rel-hora,
   data-rel-seg e data-rel-periodo.
   ===================================================== */
(function () {
  'use strict';

  var cartoes = document.querySelectorAll('[data-relogio]');
  if (!cartoes.length) return;

  var fmtSemana = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' });
  var fmtData = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  function dois(n) { return (n < 10 ? '0' : '') + n; }
  function capitalizar(t) { return t.charAt(0).toUpperCase() + t.slice(1); }

  function periodoDoDia(h) {
    if (h < 6) return { nome: 'Madrugada', tema: 'noite' };
    if (h < 12) return { nome: 'Manhã', tema: 'dia' };
    if (h < 18) return { nome: 'Tarde', tema: 'dia' };
    return { nome: 'Noite', tema: 'noite' };
  }

  function definir(el, texto) {
    if (el && el.textContent !== texto) el.textContent = texto;
  }

  function atualizar() {
    var agora = new Date();
    var hhmm = dois(agora.getHours()) + ':' + dois(agora.getMinutes());
    var periodo = periodoDoDia(agora.getHours());
    var iso = agora.getFullYear() + '-' + dois(agora.getMonth() + 1) + '-' + dois(agora.getDate()) + 'T' + hhmm + ':' + dois(agora.getSeconds());

    cartoes.forEach(function (cartao) {
      definir(cartao.querySelector('[data-rel-semana]'), capitalizar(fmtSemana.format(agora)));
      definir(cartao.querySelector('[data-rel-data]'), fmtData.format(agora));
      definir(cartao.querySelector('[data-rel-periodo]'), periodo.nome);

      var hora = cartao.querySelector('[data-rel-hora]');
      if (hora) {
        hora.setAttribute('datetime', iso);
        definir(hora.querySelector('[data-rel-hm]'), hhmm);
        definir(hora.querySelector('[data-rel-seg]'), dois(agora.getSeconds()));
      }
      if (cartao.getAttribute('data-periodo') !== periodo.tema) {
        cartao.setAttribute('data-periodo', periodo.tema);
      }
    });
  }

  // atualiza sempre na virada do segundo, sem acumular atraso
  function agendar() {
    atualizar();
    setTimeout(agendar, 1000 - (Date.now() % 1000) + 5);
  }

  // ao voltar para a aba, mostra a hora certa na hora (abas em segundo plano atrasam timers)
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) atualizar();
  });

  agendar();
})();
