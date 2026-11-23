const tls = require('tls');
const net = require('net');
const crypto = require('crypto');

function envBool(v, fallback=false){
  if(v===undefined || v===null || v==='') return fallback;
  return ['1','true','yes','sim','on'].includes(String(v).toLowerCase());
}

function config(conta='gestao'){
  const principal = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 465),
    secure: envBool(process.env.SMTP_SECURE, true),
    user: String(process.env.SMTP_USER || '').trim(),
    pass: String(process.env.SMTP_PASS || '').replace(/\s+/g,''),
    from: process.env.SMTP_FROM || String(process.env.SMTP_USER || '').trim()
  };
  if(conta !== 'usuarios') return principal;

  // Conta separada para e-mails de alunos/professores. Duas formas de usar:
  // 1) Mesmo Gmail, só muda o nome de exibição: deixe SMTP_USER_ALUNOS em
  //    branco e preencha só SMTP_FROM_ALUNOS (ex: "BiblioBeta Alunos <mesmo@gmail.com>").
  //    Continua autenticando com a conta principal (SMTP_USER/SMTP_PASS).
  // 2) Gmail totalmente diferente: preencha SMTP_USER_ALUNOS e SMTP_PASS_ALUNOS.
  // Se nada for definido, cai de volta 100% na conta principal.
  const userAlunos = String(process.env.SMTP_USER_ALUNOS || '').trim();
  const fromAlunos = process.env.SMTP_FROM_ALUNOS || '';
  if(!userAlunos){
    return fromAlunos ? {...principal, from: fromAlunos} : principal;
  }
  return {
    host: process.env.SMTP_HOST_ALUNOS || principal.host,
    port: Number(process.env.SMTP_PORT_ALUNOS || principal.port),
    secure: envBool(process.env.SMTP_SECURE_ALUNOS, principal.secure),
    user: userAlunos,
    pass: String(process.env.SMTP_PASS_ALUNOS || '').replace(/\s+/g,''),
    from: fromAlunos || userAlunos
  };
}

// ---------------------------------------------------------------------------
// Envio SMTP com duas rotas automáticas:
//   1) SSL direto (porta 465)  ->  2) STARTTLS (porta 587)
// Redes de escola/empresa costumam bloquear UMA das duas; tentando as duas o
// envio funciona na maioria dos casos. A conexão é forçada em IPv4 (em muitas
// redes o IPv6 do Gmail "trava" e dá timeout mesmo com a porta liberada).
// Desligar o fallback: SMTP_FALLBACK=false no .env.
// ---------------------------------------------------------------------------
function conectarSocket({host,port,secure,timeoutMs}){
  return new Promise((resolve,reject)=>{
    const family=Number(process.env.SMTP_FAMILY||4);
    const opts={host,port,family,servername:host,rejectUnauthorized:true};
    const sock=secure?tls.connect(opts):net.connect(opts);
    const t=setTimeout(()=>{
      sock.destroy();
      const e=new Error(`não foi possível conectar em ${host}:${port} em ${Math.round(timeoutMs/1000)}s (rede/firewall pode estar bloqueando a porta ${port})`);
      e.codigo='CONEXAO'; reject(e);
    },timeoutMs);
    sock.once(secure?'secureConnect':'connect',()=>{clearTimeout(t);sock.removeAllListeners('error');resolve(sock);});
    sock.once('error',e=>{clearTimeout(t);e.codigo='CONEXAO';reject(e);});
  });
}

function criarLeitor(sock){
  let buf='',erro=null;
  const fila=[];
  const tentar=()=>{
    if(!fila.length) return;
    // Resposta SMTP = linhas "250-..." seguidas de uma linha final "250 ...".
    const m=buf.match(/^(?:\d{3}-[^\r\n]*\r\n)*\d{3}(?: [^\r\n]*)?\r\n/);
    if(!m) return;
    buf=buf.slice(m[0].length);
    fila.shift().res(m[0]);
    tentar();
  };
  const falhar=e=>{ erro=erro||e; fila.splice(0).forEach(p=>{clearTimeout(p.t);p.rej(erro);}); };
  const onData=d=>{buf+=d.toString('utf8');tentar();};
  sock.on('data',onData);
  sock.on('error',e=>{e.codigo='CONEXAO';falhar(e);});
  sock.on('close',()=>{const e=new Error('conexão SMTP encerrada inesperadamente');e.codigo='CONEXAO';falhar(e);});
  return {
    sock,
    parar(){sock.removeListener('data',onData);},
    esperar(ms=15000){
      return new Promise((res,rej)=>{
        if(erro) return rej(erro);
        const p={res:v=>{clearTimeout(p.t);res(v);},rej,t:null};
        p.t=setTimeout(()=>{
          const i=fila.indexOf(p); if(i>=0) fila.splice(i,1);
          const e=new Error('tempo esgotado aguardando resposta do servidor SMTP'); e.codigo='CONEXAO'; rej(e);
        },ms);
        fila.push(p); tentar();
      });
    }
  };
}

function montarMime(cfg,{to,subject,text,html}){
  const boundary='----=_BiblioBeta_'+crypto.randomBytes(12).toString('hex');
  const safeSubject=String(subject||'BiblioBeta').replace(/[\r\n]/g,' ');
  // Assunto com acentos precisa ir codificado (RFC 2047) para não chegar quebrado.
  const subjectHeader=/^[\x20-\x7e]*$/.test(safeSubject)?safeSubject:'=?UTF-8?B?'+Buffer.from(safeSubject,'utf8').toString('base64')+'?=';
  const fromHeader=String(cfg.from||cfg.user).replace(/[\r\n]/g,' ');
  const textBody=String(text||'').replace(/\r?\n/g,'\r\n');
  const htmlBody=String(html||'').replace(/\r?\n/g,'\r\n');
  // Date e Message-ID melhoram a entregabilidade: sem eles, filtros mais rígidos
  // (Workspace institucional, escolas) aceitam no SMTP e descartam depois.
  const dataHeader=new Date().toUTCString().replace('GMT','+0000');
  const messageIdHost=String(cfg.user).split('@')[1]||'bibliobeta.local';
  const messageId=`<${Date.now()}.${crypto.randomBytes(8).toString('hex')}@${messageIdHost}>`;
  const mime=[
    `From: ${fromHeader}`,`To: ${to}`,`Subject: ${subjectHeader}`,`Date: ${dataHeader}`,`Message-ID: ${messageId}`,
    'MIME-Version: 1.0',`Content-Type: multipart/alternative; boundary="${boundary}"`,'',
    `--${boundary}`,'Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: 8bit','',textBody,'',
    `--${boundary}`,'Content-Type: text/html; charset=UTF-8','Content-Transfer-Encoding: 8bit','',htmlBody,'',
    `--${boundary}--`,''
  ].join('\r\n');
  // Linha iniciada por "." precisa ser escapada no protocolo SMTP.
  return mime.split('\r\n').map(l=>l.startsWith('.')?'.'+l:l).join('\r\n');
}

async function enviarPorRota(cfg,{port,secure},msg){
  const host=cfg.host;
  let sock=await conectarSocket({host,port,secure,timeoutMs:Number(process.env.SMTP_TIMEOUT_MS||12000)});
  let leitor=criarLeitor(sock);
  const cmd=async(c,esperado,ms)=>{
    if(c) leitor.sock.write(c+'\r\n');
    const rep=await leitor.esperar(ms);
    const code=Number(rep.slice(0,3));
    if(!esperado.includes(code)){
      const e=new Error(`SMTP ${code}: ${rep.trim()}`); e.codigo='SMTP'; e.smtp=code; throw e;
    }
    return rep;
  };
  try{
    await cmd(null,[220]);
    await cmd('EHLO bibliobeta.local',[250]);
    if(!secure){
      await cmd('STARTTLS',[220]);
      leitor.parar();
      sock=await new Promise((res,rej)=>{
        const s=tls.connect({socket:sock,servername:host,rejectUnauthorized:true});
        s.once('secureConnect',()=>{s.removeAllListeners('error');res(s);});
        s.once('error',e=>{e.codigo='CONEXAO';rej(e);});
      });
      leitor=criarLeitor(sock);
      await cmd('EHLO bibliobeta.local',[250]);
    }
    await cmd('AUTH LOGIN',[334]);
    await cmd(Buffer.from(cfg.user,'utf8').toString('base64'),[334]);
    await cmd(Buffer.from(cfg.pass,'utf8').toString('base64'),[235]);
    await cmd(`MAIL FROM:<${cfg.user}>`,[250]);
    await cmd(`RCPT TO:<${msg.to}>`,[250,251]);
    await cmd('DATA',[354]);
    sock.write(montarMime(cfg,msg)+'\r\n.\r\n');
    await cmd(null,[250],30000);
    try{ await cmd('QUIT',[221],4000); }catch{}
    return true;
  } finally { try{sock.destroy();}catch{} }
}

async function smtpSend({to,subject,text,html,conta='gestao'}){
  const cfg=config(conta);
  if(!cfg.user||!cfg.pass) throw new Error('SMTP não configurado. Defina SMTP_USER e SMTP_PASS no .env.');
  if(!to) throw new Error('Destinatário não informado.');

  const rotas=[{port:cfg.port,secure:cfg.secure}];
  if(envBool(process.env.SMTP_FALLBACK,true)){
    const alt=cfg.port===465?{port:587,secure:false}:{port:465,secure:true};
    if(alt.port!==cfg.port) rotas.push(alt);
  }
  const falhas=[];
  for(const rota of rotas){
    try{ return await enviarPorRota(cfg,rota,{to,subject,text,html}); }
    catch(e){
      // Erro de login/destinatário (SMTP 5xx) não melhora trocando de porta: avisa na hora.
      if(e.codigo==='SMTP'){
        if(e.smtp===535||e.smtp===534) throw new Error(`o Gmail recusou o login (${e.message}). Gere uma nova Senha de app e atualize SMTP_PASS no backend/.env.`);
        throw e;
      }
      falhas.push(`porta ${rota.port}: ${e.message}`);
    }
  }
  throw new Error(`Falha de conexão com ${cfg.host} — ${falhas.join(' | ')}`);
}

async function enviarEmailSMTP({to, codigo, minutos=15, subject=null, text=null, html=null, conta='gestao'}){
  const assunto=subject || 'BiblioBeta — código de recuperação de senha';
  const corpoTexto=text || `Olá!\n\nSeu código de recuperação de senha do BiblioBeta é: ${codigo}\n\nEste código é válido por ${minutos} minutos e só pode ser usado uma vez.\nSe você não solicitou a recuperação, ignore este e-mail.\n\nBiblioBeta`;
  const safeCode=String(codigo||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const corpoHtml=html || `<!doctype html><html><body style="font-family:Arial,sans-serif;line-height:1.5">
  <h2>BiblioBeta</h2><p>Olá!</p><p>Seu código de recuperação de senha é:</p>
  <p style="font-size:30px;font-weight:700;letter-spacing:6px">${safeCode}</p>
  <p>Este código é válido por <strong>${minutos} minutos</strong> e só pode ser usado uma vez.</p>
  <p>Se você não solicitou a recuperação, ignore este e-mail.</p>
  </body></html>`;
  return smtpSend({to,subject:assunto,text:corpoTexto,html:corpoHtml,conta});
}

function smtpConfigurado(conta='gestao'){
  const cfg = config(conta);
  return !!(cfg.user && cfg.pass);
}

module.exports={enviarEmailSMTP,smtpConfigurado};
