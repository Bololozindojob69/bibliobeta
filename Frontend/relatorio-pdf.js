/* BiblioBeta — gerador de PDF para os relatórios da Gestão.
   Não usa biblioteca externa (funciona offline). Gera uma tabela com:
   título, informações do filtro, cabeçalho repetido em cada página e numeração.
   Uso: BiblioBetaPDF.gerar({ titulo, info:[...], cols:[...], linhas:[[...]] }) -> Blob */
(function () {
  'use strict';

  var MAPA = { '\u2014': 0x97, '\u2013': 0x96, '\u2018': 0x91, '\u2019': 0x92, '\u201C': 0x93, '\u201D': 0x94, '\u2022': 0x95, '\u2026': 0x85, '\u20AC': 0x80 };

  // Texto -> "string binária" (1 caractere = 1 byte) na codificação WinAnsi, já com escape de ( ) \
  function esc(s) {
    s = String(s == null ? '' : s).normalize('NFC');
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i), b;
      if (c < 32) b = 32;
      else if (c < 256) b = c;
      else b = MAPA[s[i]] || 63;
      if (b === 40 || b === 41 || b === 92) out += '\\';
      out += String.fromCharCode(b);
    }
    return out;
  }

  var ctx = null;
  function larg(t, sz, neg) {
    if (!ctx) ctx = document.createElement('canvas').getContext('2d');
    ctx.font = (neg ? 'bold ' : '') + '100px Helvetica, Arial, sans-serif';
    return ctx.measureText(String(t == null ? '' : t)).width * sz / 100;
  }

  function quebrar(t, max, sz, neg) {
    t = String(t == null ? '' : t).replace(/\s+/g, ' ').trim();
    if (!t) return [''];
    var palavras = t.split(' '), linhas = [], atual = '';
    palavras.forEach(function (p) {
      while (larg(p, sz, neg) > max && p.length > 1) {
        var n = p.length;
        while (n > 1 && larg(p.slice(0, n), sz, neg) > max) n--;
        if (atual) { linhas.push(atual); atual = ''; }
        linhas.push(p.slice(0, n));
        p = p.slice(n);
      }
      var tent = atual ? atual + ' ' + p : p;
      if (larg(tent, sz, neg) <= max) atual = tent;
      else { if (atual) linhas.push(atual); atual = p; }
    });
    if (atual) linhas.push(atual);
    return linhas;
  }

  function f2(n) { return (Math.round(n * 100) / 100).toString(); }

  function gerar(o) {
    var cols = o.cols || [], rows = o.linhas || [];
    var paisagem = o.paisagem !== undefined ? o.paisagem : cols.length > 5;
    var W = paisagem ? 841.89 : 595.28, H = paisagem ? 595.28 : 841.89;
    var M = 36, SZ = 8.5, SZH = 7.5, PAD = 4, LH = SZ * 1.28;
    var avail = W - 2 * M;

    // ----- larguras das colunas -----
    var ideal = cols.map(function (c, i) {
      var m = larg(String(c), SZH, true) + 4;
      for (var r = 0; r < rows.length; r++) {
        var w = larg(rows[r][i], SZ);
        if (w > m) m = w;
      }
      return Math.min(m, 230) + 2 * PAD + 2;
    });
    var soma = ideal.reduce(function (a, b) { return a + b; }, 0) || 1;
    var cw;
    if (soma <= avail) {
      cw = ideal.map(function (w) { return w * avail / soma; });
    } else {
      // Só as colunas largas encolhem; as curtas (ISBN, números) mantêm a largura ideal
      cw = ideal.slice();
      var fixo = cols.map(function () { return false; }), livre = avail, mudou = true;
      while (mudou) {
        mudou = false;
        var abertas = fixo.filter(function (f) { return !f; }).length;
        if (!abertas) break;
        var cota = livre / abertas;
        for (var q = 0; q < cw.length; q++) {
          if (!fixo[q] && ideal[q] <= cota) { fixo[q] = true; livre -= ideal[q]; mudou = true; }
        }
      }
      var somaAbertas = 0;
      for (var q2 = 0; q2 < cw.length; q2++) if (!fixo[q2]) somaAbertas += ideal[q2];
      for (var q3 = 0; q3 < cw.length; q3++) if (!fixo[q3]) cw[q3] = Math.max(38, ideal[q3] * livre / somaAbertas);
      var tot = cw.reduce(function (a, b) { return a + b; }, 0);
      if (tot > avail) cw = cw.map(function (w) { return w * avail / tot; });
    }
    var xs = [], acc = M;
    cw.forEach(function (w) { xs.push(acc); acc += w; });

    // ----- monta as páginas (operações de desenho) -----
    var paginas = [], ops, y;

    function texto(x, yTopo, s, sz, neg, cor) {
      ops.push(cor + ' rg BT /' + (neg ? 'F2' : 'F1') + ' ' + sz + ' Tf ' + f2(x) + ' ' + f2(H - yTopo) + ' Td (' + esc(s) + ') Tj ET');
    }
    function retang(x, yTopo, w, h, cor) {
      ops.push(cor + ' rg ' + f2(x) + ' ' + f2(H - yTopo - h) + ' ' + f2(w) + ' ' + f2(h) + ' re f');
    }
    function linha(x1, x2, yTopo, cor) {
      ops.push(cor + ' RG 0.5 w ' + f2(x1) + ' ' + f2(H - yTopo) + ' m ' + f2(x2) + ' ' + f2(H - yTopo) + ' l S');
    }
    function cabecalhoTabela() {
      var linhasCab = cols.map(function (c, i) { return quebrar(String(c), cw[i] - 2 * PAD, SZH, true); });
      var n = Math.max.apply(null, linhasCab.map(function (l) { return l.length; }));
      var h = n * SZH * 1.25 + 2 * PAD;
      retang(M, y, avail, h, '0.29 0.17 0.10');
      linhasCab.forEach(function (ls, i) {
        ls.forEach(function (t, k) { texto(xs[i] + PAD, y + PAD + SZH + k * SZH * 1.25 - 1.5, t, SZH, true, '1 1 1'); });
      });
      y += h;
    }
    function novaPagina(primeira) {
      ops = [];
      paginas.push(ops);
      y = M;
      if (primeira) {
        texto(M, y + 16, o.titulo || 'Relatório', 16, true, '0.29 0.17 0.10');
        y += 24;
        retang(M, y, 46, 2.5, '0.92 0.42 0.07');
        y += 12;
        (o.info || []).forEach(function (t) {
          quebrar(t, avail, 8.5, false).forEach(function (l) {
            texto(M, y + 8, l, 8.5, false, '0.35 0.30 0.26');
            y += 11.5;
          });
        });
        y += 8;
      } else {
        texto(M, y + 8, (o.titulo || 'Relatório') + ' (continuação)', 8.5, false, '0.45 0.40 0.36');
        y += 16;
      }
      cabecalhoTabela();
    }

    novaPagina(true);
    var zebra = false;
    rows.forEach(function (r) {
      var cel = cols.map(function (c, i) { return quebrar(r[i], cw[i] - 2 * PAD, SZ, false); });
      var n = Math.max.apply(null, cel.map(function (l) { return l.length; }));
      var h = n * LH + 2 * PAD;
      if (y + h > H - M - 14) { novaPagina(false); zebra = false; }
      if (zebra) retang(M, y, avail, h, '0.98 0.96 0.92');
      cel.forEach(function (ls, i) {
        ls.forEach(function (t, k) { texto(xs[i] + PAD, y + PAD + SZ + k * LH - 1, t, SZ, false, '0.15 0.12 0.10'); });
      });
      y += h;
      linha(M, M + avail, y, '0.87 0.84 0.80');
      zebra = !zebra;
    });
    if (!rows.length) {
      texto(M + PAD, y + 18, 'Nenhum registro encontrado com esses filtros.', SZ, false, '0.35 0.30 0.26');
    }

    // rodapé com numeração
    var total = paginas.length;
    paginas.forEach(function (p, k) {
      ops = p;
      texto(M, H - 18, 'BiblioBeta · Gestão Bibliotecária', 7.5, false, '0.5 0.45 0.4');
      var t = 'Página ' + (k + 1) + ' de ' + total;
      texto(W - M - larg(t, 7.5), H - 18, t, 7.5, false, '0.5 0.45 0.4');
    });

    // ----- monta o arquivo PDF -----
    var corpo = '%PDF-1.4\n%\u00E2\u00E3\u00CF\u00D3\n';
    var offs = [];
    function obj(id, conteudo) { offs[id] = corpo.length; corpo += id + ' 0 obj\n' + conteudo + '\nendobj\n'; }

    var kids = [];
    for (var k = 0; k < total; k++) kids.push((6 + 2 * k) + ' 0 R');
    obj(1, '<</Type/Catalog/Pages 2 0 R>>');
    obj(2, '<</Type/Pages/Kids [' + kids.join(' ') + ']/Count ' + total + '>>');
    obj(3, '<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>');
    obj(4, '<</Type/Font/Subtype/Type1/BaseFont/Helvetica-Bold/Encoding/WinAnsiEncoding>>');
    paginas.forEach(function (p, k) {
      var stream = p.join('\n');
      obj(5 + 2 * k, '<</Length ' + stream.length + '>>\nstream\n' + stream + '\nendstream');
      obj(6 + 2 * k, '<</Type/Page/Parent 2 0 R/MediaBox [0 0 ' + f2(W) + ' ' + f2(H) + ']/Resources<</Font<</F1 3 0 R/F2 4 0 R>>>>/Contents ' + (5 + 2 * k) + ' 0 R>>');
    });
    var nObj = 5 + 2 * total;
    var xref = corpo.length;
    corpo += 'xref\n0 ' + nObj + '\n0000000000 65535 f \n';
    for (var i = 1; i < nObj; i++) corpo += ('0000000000' + offs[i]).slice(-10) + ' 00000 n \n';
    corpo += 'trailer\n<</Size ' + nObj + '/Root 1 0 R>>\nstartxref\n' + xref + '\n%%EOF';

    var bytes = new Uint8Array(corpo.length);
    for (var j = 0; j < corpo.length; j++) bytes[j] = corpo.charCodeAt(j) & 255;
    return new Blob([bytes], { type: 'application/pdf' });
  }

  window.BiblioBetaPDF = { gerar: gerar };
})();
