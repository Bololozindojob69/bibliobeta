/* BiblioBeta — sessão por aba.
   Antes, o login ficava só no localStorage, compartilhado por todas as abas do navegador:
   se uma segunda pessoa da Gestão entrasse no MESMO navegador, a conta da primeira era trocada.
   Agora o token/usuário ficam no sessionStorage (próprio de cada aba). O localStorage guarda só a
   "última sessão", que serve para abas novas já abrirem logadas. Carregue este script ANTES dos demais. */
(function () {
  var CHAVES = { bibliobeta_token: 1, bibliobeta_usuario: 1 };
  try {
    var S = window.sessionStorage, L = window.localStorage;
    var get = Storage.prototype.getItem, set = Storage.prototype.setItem,
        rem = Storage.prototype.removeItem, clr = Storage.prototype.clear;
    // Aba nova: herda a última sessão salva.
    Object.keys(CHAVES).forEach(function (k) {
      if (get.call(S, k) === null && get.call(L, k) !== null) set.call(S, k, get.call(L, k));
    });
    Storage.prototype.getItem = function (k) {
      if (this === L && CHAVES[k]) { var v = get.call(S, k); return v; }
      return get.call(this, k);
    };
    Storage.prototype.setItem = function (k, v) {
      if (this === L && CHAVES[k]) set.call(S, k, v);
      return set.call(this, k, v);
    };
    Storage.prototype.removeItem = function (k) {
      if (this === L && CHAVES[k]) rem.call(S, k);
      return rem.call(this, k);
    };
    Storage.prototype.clear = function () {
      if (this === L) Object.keys(CHAVES).forEach(function (k) { rem.call(S, k); });
      return clr.call(this);
    };
  } catch (e) { /* storage indisponível: segue o comportamento normal */ }
})();
