// Uso:  node diagnostico-email.js [email-para-receber-o-teste]
// Mostra se a rede deixa conectar no Gmail (portas 465 e 587) e, se você
// informar um e-mail, tenta enviar uma mensagem de teste de verdade.
const net = require('net');
const path = require('path');
const fs = require('fs');

const ENV_PATH = path.join(__dirname, '.env');
if (fs.existsSync(ENV_PATH)) {
  for (const linha of fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
const { enviarEmailSMTP } = require('./smtp-email');

function testarPorta(host, port) {
  return new Promise(resolve => {
    const t0 = Date.now();
    const s = net.connect({ host, port, family: 4 });
    const fim = ok => { s.destroy(); resolve({ port, ok, ms: Date.now() - t0 }); };
    s.setTimeout(8000, () => fim(false));
    s.once('connect', () => fim(true));
    s.once('error', () => fim(false));
  });
}

(async () => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  console.log(`\nTestando conexão com ${host} ...\n`);
  for (const p of [465, 587]) {
    const r = await testarPorta(host, p);
    console.log(`  porta ${p}: ${r.ok ? 'ABERTA' : 'BLOQUEADA / sem resposta'} (${r.ms} ms)`);
  }
  console.log('\n  Se as DUAS estiverem bloqueadas, a rede (escola/roteador/antivírus) está barrando o');
  console.log('  envio de e-mail. Teste em outra rede (ex.: hotspot do celular).\n');

  const para = process.argv[2];
  if (!para) { console.log('Dica: rode  node diagnostico-email.js seu@email.com  para enviar um teste de verdade.\n'); return; }
  try {
    await enviarEmailSMTP({
      to: para, codigo: '', subject: 'BiblioBeta — teste de diagnóstico',
      text: 'Se você recebeu isto, o envio de e-mail do BiblioBeta está funcionando.',
      html: '<p>Se você recebeu isto, o envio de e-mail do <b>BiblioBeta</b> está funcionando.</p>'
    });
    console.log(`E-mail de teste ENVIADO para ${para}. Confira a caixa de entrada e o spam.\n`);
  } catch (e) {
    console.log('FALHA no envio:', e.message, '\n');
  }
})();
