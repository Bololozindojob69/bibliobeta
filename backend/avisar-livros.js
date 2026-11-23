// BiblioBeta - e-mail de AVISO DE LIVROS (novidades do acervo) AGORA.
// Uso:  node avisar-livros.js [--dias=7 | --todos] [--para=alunos|professores|todos|email1,email2] [--simular]
//   --dias=N   livros cadastrados nos ultimos N dias (padrao 7)
//   --todos    lista o acervo inteiro (agrupado por categoria)
// Cada pessoa recebe UM e-mail com a lista de livros. Banco aberto so para leitura.
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

(async()=>{
  const dias=Math.max(1,Number(arg.dias||7));
  const base=`SELECT l.titulo,l.autor,COALESCE(c.nome,'Outros') categoria,
    (SELECT COUNT(*) FROM exemplares e WHERE e.livro_id=l.id AND e.status='disponivel') disp
    FROM livros l LEFT JOIN categorias c ON c.id=l.categoria_id WHERE l.ativo=1`;
  const livros=arg.todos
    ? await all(base+' ORDER BY categoria,l.titulo')
    : await all(base+` AND l.criado_em>=datetime('now',?) ORDER BY categoria,l.titulo`,[`-${dias} days`]);
  if(!livros.length){console.log(`Nenhum livro cadastrado nos ultimos ${dias} dias. Use --todos para listar o acervo inteiro.`);process.exit(0);}

  const para=String(arg.para||'alunos').toLowerCase();
  let usuarios;
  if(para==='todos') usuarios=await all("SELECT nome,email,email_alternativo FROM leitores WHERE status='ativo' AND tipo IN ('aluno','professor')");
  else if(para==='alunos'||para==='professores') usuarios=await all("SELECT nome,email,email_alternativo FROM leitores WHERE status='ativo' AND tipo=?",[para==='alunos'?'aluno':'professor']);
  else{const l=para.split(',').map(s=>s.trim()).filter(Boolean);const q=l.map(()=>'?').join(',');
    usuarios=await all(`SELECT nome,email,email_alternativo FROM leitores WHERE status='ativo' AND (LOWER(email) IN (${q}) OR LOWER(email_alternativo) IN (${q}))`,[...l,...l]);}
  if(!usuarios.length){console.log('Nenhum destinatario encontrado para:',para);process.exit(1);}

  const grupos={};for(const b of livros)(grupos[b.categoria]=grupos[b.categoria]||[]).push(b);
  const titulo=arg.todos?'Acervo da biblioteca':`Novos livros na biblioteca (${livros.length})`;
  const intro=arg.todos?'Veja os livros disponíveis no acervo da biblioteca:':'Chegaram livros novos ao catálogo do BiblioBeta:';
  const linha=b=>`${b.titulo}${b.autor?' — '+b.autor:''}${b.disp?'':' (sem exemplar disponível no momento)'}`;
  const texto=n=>`Olá, ${n}!\n\n${intro}\n\n`+Object.entries(grupos).map(([c,l])=>`${c.toUpperCase()}\n`+l.map(b=>'• '+linha(b)).join('\n')).join('\n\n')+`\n\nEntre no BiblioBeta para solicitar o seu.\n\nBiblioBeta — Gestão`;
  const html=n=>`<!doctype html><html><body style="font-family:Arial,sans-serif;line-height:1.5;color:#222"><h2 style="color:#1a4d8f">📚 BiblioBeta</h2><p>Olá, ${esc(n)}!</p><p>${esc(intro)}</p>`+
    Object.entries(grupos).map(([c,l])=>`<h3 style="color:#1a4d8f;margin-bottom:4px">${esc(c)}</h3><ul style="margin-top:0">`+l.map(b=>`<li><strong>${esc(b.titulo)}</strong>${b.autor?' — '+esc(b.autor):''}${b.disp?'':' <em>(sem exemplar disponível no momento)</em>'}</li>`).join('')+'</ul>').join('')+
    `<p>Entre no BiblioBeta para solicitar o seu.</p><p>BiblioBeta — Gestão</p></body></html>`;

  console.log(`${livros.length} livro(s) na lista | ${usuarios.length} destinatario(s)${arg.simular?'  (SIMULACAO - nada sera enviado)':''}\n`);
  let ok=0,falha=0;
  for(const u of usuarios){
    const dest=[...new Set([u.email,u.email_alternativo].map(s=>String(s||'').trim().toLowerCase()).filter(s=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)))];
    for(const to of dest){
      if(arg.simular){console.log(`[simulado] ${u.nome} <${to}>`);continue;}
      try{await enviarEmailSMTP({to,subject:`BiblioBeta — ${titulo}`,text:texto(u.nome),html:html(u.nome),conta:'usuarios',codigo:''});console.log(`OK    ${u.nome} <${to}>`);ok++;}
      catch(e){console.log(`FALHA ${u.nome} <${to}>: ${e.message}`);falha++;}
      await espera(1500);
    }
  }
  console.log(`\nResumo: ${ok} enviado(s), ${falha} falha(s).`);
  db.close();
})().catch(e=>{console.error('Erro:',e.message);process.exit(1);});
