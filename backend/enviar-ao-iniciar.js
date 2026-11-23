// BiblioBeta - envio automatico de e-mails QUANDO O SERVIDOR E LIGADO.
// Chamado pelo "Iniciar BiblioBeta.bat". Configuracao: backend/envio-ao-iniciar.txt
//   MODO=livros | avisos | ambos | nao      (padrao: livros)
//   DIAS_PRIMEIRA_VEZ=7                     (janela na 1a vez de cada pessoa)
//   PARA=alunos | professores | todos
// Para NAO mandar repetido a cada vez que o servidor liga, o arquivo
// envio-ao-iniciar.estado.json guarda, por e-mail, o ultimo livro/aviso ja enviado.
// So avanca quando o envio deu certo; se falhar, tenta de novo na proxima vez que ligar.
// Uso manual de teste:  node enviar-ao-iniciar.js --simular
const path=require('path'),fs=require('fs');
const DIR=__dirname;
const ENV_PATH=path.join(DIR,'.env');
if(fs.existsSync(ENV_PATH)){
  for(const l of fs.readFileSync(ENV_PATH,'utf8').split(/\r?\n/)){
    const m=l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if(m&&process.env[m[1]]===undefined) process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,'');
  }
}
const CFG_PATH=process.env.ENVIO_CFG||path.join(DIR,'envio-ao-iniciar.txt');
const ESTADO_PATH=process.env.ENVIO_ESTADO||path.join(DIR,'envio-ao-iniciar.estado.json');
const LOG_PATH=process.env.ENVIO_LOG||path.join(DIR,'envio-ao-iniciar.log');
const simular=process.argv.includes('--simular');
const semEspera=process.argv.includes('--sem-espera');

const cfg={MODO:'livros',DIAS_PRIMEIRA_VEZ:'7',PARA:'alunos'};
if(fs.existsSync(CFG_PATH)){
  for(const l of fs.readFileSync(CFG_PATH,'utf8').split(/\r?\n/)){
    const m=l.match(/^\s*([A-Za-z_]+)\s*=\s*(.*?)\s*$/); if(m) cfg[m[1].toUpperCase()]=m[2];
  }
}
const modo=String(cfg.MODO).toLowerCase();
const dias=Math.max(1,Number(cfg.DIAS_PRIMEIRA_VEZ)||7);
const para=String(cfg.PARA).toLowerCase();
function log(s){const l=`[${new Date().toLocaleString('pt-BR')}] ${s}`;console.log(l);try{fs.appendFileSync(LOG_PATH,l+'\n');}catch(_){}}

if(!['livros','avisos','ambos'].includes(modo)){log(`Envio ao iniciar DESLIGADO (MODO=${cfg.MODO}).`);process.exit(0);}

const sqlite3=require('sqlite3');
const {enviarEmailSMTP}=require('./smtp-email');
const esc=s=>String(s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const db=new sqlite3.Database(path.join(DIR,'database.sqlite'),sqlite3.OPEN_READONLY);
const all=(s,p=[])=>new Promise((res,rej)=>db.all(s,p,(e,r)=>e?rej(e):res(r)));
const espera=ms=>new Promise(r=>setTimeout(r,ms));
const IMPORTANTES=['emprestimo','solicitacao','devolucao','reserva','prazo','atraso','cobranca','penalidade','renovacao','info'];

let estado={};
try{estado=JSON.parse(fs.readFileSync(ESTADO_PATH,'utf8'));}catch(_){}
function salvar(){ if(simular) return; const tmp=ESTADO_PATH+'.tmp'; fs.writeFileSync(tmp,JSON.stringify(estado,null,2)); fs.renameSync(tmp,ESTADO_PATH); }

function emailLivros(nome,livros){
  const grupos={};for(const b of livros)(grupos[b.categoria]=grupos[b.categoria]||[]).push(b);
  const intro='Chegaram livros novos ao catálogo do BiblioBeta:';
  const linha=b=>`${b.titulo}${b.autor?' — '+b.autor:''}${b.disp?'':' (sem exemplar disponível no momento)'}`;
  return {
    subject:`BiblioBeta — Novos livros na biblioteca (${livros.length})`,
    text:`Olá, ${nome}!\n\n${intro}\n\n`+Object.entries(grupos).map(([c,l])=>`${c.toUpperCase()}\n`+l.map(b=>'• '+linha(b)).join('\n')).join('\n\n')+`\n\nEntre no BiblioBeta para solicitar o seu.\n\nBiblioBeta — Gestão`,
    html:`<!doctype html><html><body style="font-family:Arial,sans-serif;line-height:1.5;color:#222"><h2 style="color:#1a4d8f">📚 BiblioBeta</h2><p>Olá, ${esc(nome)}!</p><p>${intro}</p>`+
      Object.entries(grupos).map(([c,l])=>`<h3 style="color:#1a4d8f;margin-bottom:4px">${esc(c)}</h3><ul style="margin-top:0">`+l.map(b=>`<li><strong>${esc(b.titulo)}</strong>${b.autor?' — '+esc(b.autor):''}${b.disp?'':' <em>(sem exemplar disponível no momento)</em>'}</li>`).join('')+'</ul>').join('')+
      `<p>Entre no BiblioBeta para solicitar o seu.</p><p>BiblioBeta — Gestão</p></body></html>`
  };
}
function emailAvisos(nome,itens){
  return {
    subject:`BiblioBeta — ${itens.length} aviso(s) da biblioteca`,
    text:`Olá, ${nome}!\n\n`+itens.map(i=>`• ${i.titulo}\n  ${i.mensagem}`).join('\n\n')+`\n\nAcesse o BiblioBeta para mais detalhes.\n\nBiblioBeta — Gestão`,
    html:`<!doctype html><html><body style="font-family:Arial,sans-serif;line-height:1.5;color:#222"><h2 style="color:#1a4d8f">BiblioBeta</h2><p>Olá, ${esc(nome)}!</p>`+
      itens.map(i=>`<div style="border-left:4px solid #1a4d8f;padding:6px 12px;margin:12px 0;background:#f4f7fb"><strong>${esc(i.titulo)}</strong><br>${esc(i.mensagem)}</div>`).join('')+`<p>Acesse o BiblioBeta para mais detalhes.</p><p>BiblioBeta — Gestão</p></body></html>`
  };
}
async function enviar(to,msg){
  if(simular){log(`[simulado] ${to} — ${msg.subject}`);return true;}
  try{await enviarEmailSMTP({to,...msg,conta:'usuarios',codigo:''});log(`OK    ${to} — ${msg.subject}`);return true;}
  catch(e){log(`FALHA ${to}: ${e.message}`);return false;}
}

(async()=>{
  // Espera o servidor terminar de iniciar (ele ajusta o banco ao ligar).
  if(!semEspera) await espera(10000);
  log(`Envio ao iniciar: MODO=${modo}, PARA=${para}${simular?' (SIMULACAO)':''}`);
  const filtro=para==='todos'?"tipo IN ('aluno','professor')":para==='professores'?"tipo='professor'":"tipo='aluno'";
  const usuarios=await all(`SELECT id,nome,email,email_alternativo FROM leitores WHERE status='ativo' AND ${filtro}`);
  let total=0;
  for(const u of usuarios){
    const destinos=[...new Set([u.email,u.email_alternativo].map(s=>String(s||'').trim().toLowerCase()).filter(s=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)))];
    if(!destinos.length) continue;
    const chave=destinos[0];
    const st=estado[chave]=estado[chave]||{};

    if(modo==='livros'||modo==='ambos'){
      const q=`SELECT l.id,l.titulo,l.autor,COALESCE(c.nome,'Outros') categoria,(SELECT COUNT(*) FROM exemplares e WHERE e.livro_id=l.id AND e.status='disponivel') disp FROM livros l LEFT JOIN categorias c ON c.id=l.categoria_id WHERE l.ativo=1 AND `;
      const livros=st.livro===undefined
        ? await all(q+"l.criado_em>=datetime('now',?) ORDER BY categoria,l.titulo",[`-${dias} days`])
        : await all(q+'l.id>? ORDER BY categoria,l.titulo',[st.livro]);
      if(livros.length){
        const maxId=Math.max(...livros.map(b=>b.id));
        const msg=emailLivros(u.nome,livros);
        let ok=false; for(const to of destinos) ok=(await enviar(to,msg))||ok;
        if(ok){ st.livro=Math.max(maxId,st.livro||0); salvar(); total++; }
        await espera(simular?0:1500);
      }else if(st.livro===undefined){ st.livro=(await all('SELECT COALESCE(MAX(id),0) m FROM livros'))[0].m; salvar(); }
    }

    if(modo==='avisos'||modo==='ambos'){
      const q=`SELECT id,titulo,mensagem FROM notificacoes WHERE usuario_id=? AND tipo IN (${IMPORTANTES.map(()=>'?').join(',')}) AND `;
      const itens=st.aviso===undefined
        ? await all(q+"criado_em>=datetime('now',?) ORDER BY id",[u.id,...IMPORTANTES,`-${dias} days`])
        : await all(q+'id>? ORDER BY id',[u.id,...IMPORTANTES,st.aviso]);
      if(itens.length){
        const maxId=Math.max(...itens.map(i=>i.id));
        const msg=emailAvisos(u.nome,itens);
        let ok=false; for(const to of destinos) ok=(await enviar(to,msg))||ok;
        if(ok){ st.aviso=Math.max(maxId,st.aviso||0); salvar(); total++; }
        await espera(simular?0:1500);
      }else if(st.aviso===undefined){ st.aviso=(await all('SELECT COALESCE(MAX(id),0) m FROM notificacoes WHERE usuario_id=?',[u.id]))[0].m; salvar(); }
    }
  }
  log(total?`Concluido: ${total} e-mail(s) com envio bem-sucedido.`:'Nada novo para enviar.');
  db.close();
})().catch(e=>{log('Erro: '+e.message);process.exit(1);});
