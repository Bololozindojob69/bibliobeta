// BiblioBeta - envio manual de e-mails AGORA (sem esperar o servidor).
// Rode pelo "Reenviar E-mails.bat" ou:  node reenviar-emails.js [opcoes]
//
// Opcoes:
//   --para=todos|alunos|professores|email1,email2   (padrao: alunos)
//   --pendentes      reenvia os avisos importantes dos ultimos --dias (padrao 7) de cada pessoa
//   --dias=N         usado com --pendentes
//   --assunto="..."  --mensagem="..."   envia um aviso livre (se nao usar --pendentes)
//   --simular        so mostra o que seria enviado, sem enviar
// Le o banco em modo somente-leitura: pode rodar com o servidor ligado.
const path=require('path'),fs=require('fs');
const ENV_PATH=path.join(__dirname,'.env');
if(fs.existsSync(ENV_PATH)){
  for(const l of fs.readFileSync(ENV_PATH,'utf8').split(/\r?\n/)){
    const m=l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if(m&&process.env[m[1]]===undefined) process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,'');
  }
}
const sqlite3=require('sqlite3');
const {enviarEmailSMTP}=require('./smtp-email');

const arg={};
for(const a of process.argv.slice(2)){const m=a.match(/^--([^=]+)(?:=(.*))?$/);if(m)arg[m[1]]=m[2]===undefined?true:m[2];}
const esc=s=>String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const db=new sqlite3.Database(path.join(__dirname,'database.sqlite'),sqlite3.OPEN_READONLY);
const all=(s,p=[])=>new Promise((res,rej)=>db.all(s,p,(e,r)=>e?rej(e):res(r)));
const espera=ms=>new Promise(r=>setTimeout(r,ms));
const IMPORTANTES=['emprestimo','solicitacao','devolucao','reserva','prazo','atraso','cobranca','penalidade','renovacao','info'];

function html(nome,itens){
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;line-height:1.5;color:#222">
<h2 style="color:#1a4d8f">BiblioBeta</h2><p>Olá, ${esc(nome)}!</p>`+
  itens.map(i=>`<div style="border-left:4px solid #1a4d8f;padding:6px 12px;margin:12px 0;background:#f4f7fb"><strong>${esc(i.titulo)}</strong><br>${esc(i.mensagem)}</div>`).join('')+
  `<p>Acesse o BiblioBeta para mais detalhes.</p><p>BiblioBeta — Gestão</p></body></html>`;
}

(async()=>{
  const para=String(arg.para||'alunos').toLowerCase();
  let usuarios;
  if(para==='todos') usuarios=await all("SELECT id,nome,email,email_alternativo FROM leitores WHERE status='ativo' AND tipo IN ('aluno','professor')");
  else if(para==='alunos'||para==='professores'){
    usuarios=await all("SELECT id,nome,email,email_alternativo FROM leitores WHERE status='ativo' AND tipo=?",[para==='alunos'?'aluno':'professor']);
  }else{
    const lista=para.split(',').map(s=>s.trim()).filter(Boolean);
    usuarios=await all(`SELECT id,nome,email,email_alternativo FROM leitores WHERE status='ativo' AND (LOWER(email) IN (${lista.map(()=>'?').join(',')}) OR LOWER(email_alternativo) IN (${lista.map(()=>'?').join(',')}))`,[...lista,...lista]);
  }
  if(!usuarios.length){console.log('Nenhum destinatario encontrado para:',para);process.exit(1);}

  const dias=Math.max(1,Number(arg.dias||7));
  let enviados=0,falhas=0,pulados=0;
  console.log(`Destinatarios: ${usuarios.length}${arg.simular?'  (SIMULACAO - nada sera enviado)':''}\n`);
  for(const u of usuarios){
    let itens;
    if(arg.pendentes){
      itens=await all(`SELECT titulo,mensagem FROM notificacoes WHERE usuario_id=? AND tipo IN (${IMPORTANTES.map(()=>'?').join(',')}) AND criado_em>=datetime('now',?) ORDER BY id`,[u.id,...IMPORTANTES,`-${dias} days`]);
      if(!itens.length){console.log(`- ${u.nome}: sem avisos importantes nos ultimos ${dias} dias (pulado)`);pulados++;continue;}
    }else{
      if(!arg.mensagem){console.log('Informe --mensagem="..." ou use --pendentes.');process.exit(1);}
      itens=[{titulo:String(arg.assunto||'Aviso da biblioteca'),mensagem:String(arg.mensagem)}];
    }
    const assunto=arg.pendentes?`BiblioBeta — ${itens.length} aviso(s) da biblioteca`:`BiblioBeta — ${itens[0].titulo}`;
    const texto=`Olá, ${u.nome}!\n\n`+itens.map(i=>`• ${i.titulo}\n  ${i.mensagem}`).join('\n\n')+`\n\nAcesse o BiblioBeta para mais detalhes.\n\nBiblioBeta — Gestão`;
    const destinos=[...new Set([u.email,u.email_alternativo].map(s=>String(s||'').trim().toLowerCase()).filter(s=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)))];
    for(const to of destinos){
      if(arg.simular){console.log(`[simulado] ${u.nome} <${to}> — ${itens.length} item(ns)`);continue;}
      try{
        await enviarEmailSMTP({to,subject:assunto,text:texto,html:html(u.nome,itens),conta:'usuarios',codigo:''});
        console.log(`OK    ${u.nome} <${to}>`);enviados++;
      }catch(e){console.log(`FALHA ${u.nome} <${to}>: ${e.message}`);falhas++;}
      await espera(1500); // evita bloqueio por envio muito rapido
    }
  }
  console.log(`\nResumo: ${enviados} enviado(s), ${falhas} falha(s), ${pulados} sem avisos.`);
  db.close();
})().catch(e=>{console.error('Erro:',e.message);process.exit(1);});
