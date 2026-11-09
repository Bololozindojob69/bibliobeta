const path=require('path'),fs=require('fs'),crypto=require('crypto'),express=require('express'),cors=require('cors'),bcrypt=require('bcryptjs'),jwt=require('jsonwebtoken'),sqlite3=require('sqlite3').verbose(),multer=require('multer');
const {enviarEmailSMTP,smtpConfigurado}=require('./smtp-email');
const {mapearGeneros,garantirGeneros}=require('./generos');
const ENV_PATH=path.join(__dirname,'.env');
if(fs.existsSync(ENV_PATH)){
  for(const linha of fs.readFileSync(ENV_PATH,'utf8').split(/\r?\n/)){
    const m=linha.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/); if(m && process.env[m[1]]===undefined) process.env[m[1]]=m[2].replace(/^['\"]|['\"]$/g,'');
  }
}
const PORT=process.env.PORT||3000, JWT_SECRET=process.env.JWT_SECRET||'troque-esta-chave-em-producao', DB_PATH=path.join(__dirname,'database.sqlite'), FRONTEND_PATH=path.join(__dirname,'..','Frontend'), UPLOADS_PATH=path.join(__dirname,'uploads'), CAPAS_PATH=path.join(UPLOADS_PATH,'capas');
fs.mkdirSync(CAPAS_PATH,{recursive:true});
const app=express(); app.disable('x-powered-by'); app.use(cors());
// Compressão gzip/brotli das respostas (HTML/CSS/JS/JSON): reduz muito o tamanho transferido.
// Se o pacote ainda não estiver instalado (npm install), o servidor continua funcionando sem compressão.
try{ const compression=require('compression'); app.use(compression({threshold:1024})); }
catch(_){ console.warn('[aviso] Pacote "compression" nao instalado. Rode "npm install" na pasta backend para ativar a compressao.'); }
// Clientes conectados em tempo real (SSE). Cada usuário recebe apenas seus próprios eventos.
const clientesTempoReal=new Map();
function enviarEventoTempoReal(usuarioId, evento, dados={}){ const lista=clientesTempoReal.get(Number(usuarioId)); if(!lista)return; const payload=`event: ${evento}\ndata: ${JSON.stringify(dados)}\n\n`; for(const res of [...lista]){ try{res.write(payload);}catch{lista.delete(res);} } }
// Avisa a pessoa (se estiver com o site aberto) que a conta foi excluída e fecha as conexões dela.
function avisarContaExcluida(usuarioId){
  const id=Number(usuarioId),lista=clientesTempoReal.get(id);
  enviarEventoTempoReal(id,'conta_excluida',{mensagem:'Sua conta foi excluída pela Gestão da biblioteca.'});
  if(!lista)return;
  setTimeout(()=>{for(const r of [...lista]){try{r.end()}catch{}}clientesTempoReal.delete(id)},500);
}
// Avisa a pessoa (se estiver com o site aberto) que a conta foi DESATIVADA (diferente de excluída: pode voltar).
function avisarContaDesativada(usuarioId){
  const id=Number(usuarioId),lista=clientesTempoReal.get(id);
  enviarEventoTempoReal(id,'conta_desativada',{mensagem:'Sua conta foi desativada pela Gestão da biblioteca.'});
  if(!lista)return;
  setTimeout(()=>{for(const r of [...lista]){try{r.end()}catch{}}clientesTempoReal.delete(id)},500);
}
function registrarClienteTempoReal(usuarioId,res){ const id=Number(usuarioId); if(!clientesTempoReal.has(id))clientesTempoReal.set(id,new Set()); clientesTempoReal.get(id).add(res); res.on('close',()=>{const set=clientesTempoReal.get(id);if(set){set.delete(res);if(!set.size)clientesTempoReal.delete(id);}}); } // Tempo real geral: toda alteração bem-sucedida (cadastro, empréstimo, devolução, livro, etc.)
// avisa todas as telas abertas para se atualizarem sozinhas. O aviso não leva dados; cada tela
// busca de novo o que precisa, com o próprio login. Vários avisos seguidos viram um só.
let _avisoAtualizarTimer=null;
function avisarAtualizacaoGeral(){
  if(_avisoAtualizarTimer) return;
  _avisoAtualizarTimer=setTimeout(()=>{
    _avisoAtualizarTimer=null;
    for(const [id] of clientesTempoReal) enviarEventoTempoReal(id,'atualizar',{em:Date.now()});
  },200);
}
app.use('/api',(req,res,next)=>{
  if(['POST','PUT','PATCH','DELETE'].includes(req.method)){
    res.on('finish',()=>{ if(res.statusCode<400) avisarAtualizacaoGeral(); });
  }
  next();
});
app.use(express.json({limit:'256kb'})); app.use(express.urlencoded({extended:true})); const db=new sqlite3.Database(DB_PATH);
// SQLite otimizado para leituras frequentes e vários acessos simultâneos na rede local.
db.serialize(()=>{
  db.run('PRAGMA foreign_keys=ON');
  db.run('PRAGMA journal_mode=WAL');
  db.run('PRAGMA synchronous=NORMAL');
  db.run('PRAGMA temp_store=MEMORY');
  db.run('PRAGMA cache_size=-20000');
  db.run('PRAGMA busy_timeout=5000');
});
const run=(sql,p=[])=>new Promise((res,rej)=>db.run(sql,p,function(e){e?rej(e):res({id:this.lastID,changes:this.changes})})); const get=(sql,p=[])=>new Promise((res,rej)=>db.get(sql,p,(e,r)=>e?rej(e):res(r))); const all=(sql,p=[])=>new Promise((res,rej)=>db.all(sql,p,(e,r)=>e?rej(e):res(r)));
function email(v){return String(v||'').trim().toLowerCase()}
function senhaValida(s){
  s=String(s||'');
  return s.length>=8 && /[A-Z]/.test(s) && /[a-z]/.test(s) && /\d/.test(s) && /[^A-Za-z0-9]/.test(s);
}
function emailValido(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||''))}
function normalizarRA(v){
  const d=String(v||'').replace(/\D/g,'');
  const n=d.replace(/^0+(?=\d)/,'');
  return n||'0';
}
// RA + dígito: o dígito verificador pode ser número OU letra (ex.: 0001114501815 + X).
function normalizarRADigito(v){
  const d=String(v||'').toLowerCase().replace(/[^0-9a-z]/g,'');
  const n=d.replace(/^0+(?=[0-9a-z])/,'');
  return n||'0';
}
function gerarTokenEmprestimo(){let s='';for(let i=0;i<6;i++)s+=String(crypto.randomInt(10));return s}
function gerarCodigoDevolucao(){return gerarTokenEmprestimo()}
// Gmail pessoal: qualquer endereço @gmail.com válido (com ou sem ponto, com números etc.).
function emailPessoalProfessor(v){return /^[a-z0-9](?:[a-z0-9._+-]*[a-z0-9])?@(?:gmail|googlemail)\.com$/i.test(String(v||'').trim())}
// Institucional: @prof.educacao.sp.gov.br (e também @educacao.sp.gov.br).
function emailInstitucionalProfessor(v){return /^[^\s@]+@(?:prof\.|professor\.)?educacao\.sp\.gov\.br$/i.test(String(v||'').trim())}
// Valida o 2º e-mail do professor (pode ser vazio). Retorna {ok,valor,erro}.
function validarEmailAlternativo(v,principal){
  const em=email(v);
  if(!em) return {ok:true,valor:null};
  if(!emailValido(em)) return {ok:false,erro:'O segundo e-mail é inválido.'};
  if(!(emailPessoalProfessor(em)||emailInstitucionalProfessor(em))) return {ok:false,erro:'O segundo e-mail deve ser um Gmail ou o e-mail institucional (@prof.educacao.sp.gov.br).'};
  if(em===email(principal)) return {ok:false,erro:'Os dois e-mails não podem ser iguais.'};
  return {ok:true,valor:em};
}
// Destinos de uma pessoa: e-mail principal + e-mail alternativo (sem repetir).
function destinosEmail(u){
  const l=[];
  for(const e of [u&&u.email,u&&u.email_alternativo]){const x=email(e); if(x&&emailValido(x)&&!l.includes(x)) l.push(x);}
  return l;
}
function politicaEmail(v,tipo,ra,digito){
  const em=email(v);
  if(!emailValido(em)) return {ok:false,erro:'Informe um e-mail válido.'};
  if(tipo==='aluno'){
    const m=em.match(/^([0-9a-z]+)(sp)@al\.educacao\.sp\.gov\.br$/i);
    if(!m) return {ok:false,erro:'Aluno deve usar o e-mail institucional no formato RA+dígito+sp@al.educacao.sp.gov.br.'};
    const esperado=normalizarRADigito(String(ra||'')+String(digito||''));
    if(normalizarRADigito(m[1])!==esperado) return {ok:false,erro:'O número do e-mail institucional deve corresponder ao RA + dígito informado.'};
    return {ok:true,tipo:'institucional'};
  }
  if(tipo==='professor'){
    if(emailPessoalProfessor(em) || emailInstitucionalProfessor(em)) return {ok:true,tipo:'permitido'};
    return {ok:false,erro:'Professor deve usar um Gmail pessoal ou o e-mail institucional (@prof.educacao.sp.gov.br).'};
  }
  return {ok:true,tipo:'normal'};
}

function scryptHash(password){const salt=crypto.randomBytes(16);const key=crypto.scryptSync(String(password),salt,64);return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`}
function verifyPassword(password,stored){
  if(String(stored||'').startsWith('scrypt$')){
    const parts=String(stored).split('$');
    if(parts.length!==3)return false;
    try{return crypto.timingSafeEqual(crypto.scryptSync(String(password),Buffer.from(parts[1],'hex'),64),Buffer.from(parts[2],'hex'))}catch{return false}
  }
  return bcrypt.compare(String(password),stored)
} function token(u){return jwt.sign({id:u.id,tipo:u.tipo},JWT_SECRET,{expiresIn:'8h'})} async function auth(req,res,next){
  let dec;
  try{const t=(req.headers.authorization||'').split(' ')[1];if(!t)throw 0;dec=jwt.verify(t,JWT_SECRET)}
  catch{return res.status(401).json({erro:'Token inválido ou não informado.'})}
  // O token (JWT) continua válido por até 8h mesmo depois que a Gestão exclui a conta.
  // Por isso confirmamos no banco que a pessoa ainda existe; se não existir, o front mostra a tela "conta excluída".
  try{
    const existe=await get('SELECT id,status FROM leitores WHERE id=?',[dec.id]);
    if(!existe)return res.status(401).json({erro:'Sua conta foi excluída pela Gestão da biblioteca.',codigo:'CONTA_EXCLUIDA'});
    // Conta desativada: o token continua válido por até 8h, mas a pessoa não pode mais usar o sistema.
    if(existe.status==='inativo')return res.status(403).json({erro:'Sua conta foi desativada pela Gestão da biblioteca.',codigo:'CONTA_DESATIVADA'});
    req.usuario=dec;next();
  }catch(e){return res.status(500).json({erro:e.message})}
} function only(...tipos){return (req,res,next)=>tipos.includes(req.usuario.tipo)?next():res.status(403).json({erro:'Sem permissão.'})}
// Níveis da Gestão: 'admin' (tudo) e 'bibliotecario' (rotina da biblioteca). O nível é lido do
// banco a cada chamada (não do token), então mudar o nível vale na hora, sem novo login.
// Contas antigas com nível 'gestao' contam como admin, para não tirar acesso de ninguém.
async function nivelGestao(usuarioId){const g=await get('SELECT nivel_acesso FROM gestao WHERE usuario_id=?',[usuarioId]);const n=String(g&&g.nivel_acesso||'').toLowerCase();return n==='bibliotecario'?'bibliotecario':'admin'}
function onlyAdmin(req,res,next){nivelGestao(req.usuario.id).then(n=>n==='admin'?next():res.status(403).json({erro:'Apenas o administrador da Gestão pode fazer isso.'})).catch(e=>res.status(500).json({erro:e.message}))}
async function perfil(u){let p=null;if(u.tipo==='aluno')p=await get('SELECT * FROM alunos WHERE usuario_id=?',[u.id]);if(u.tipo==='professor')p=await get('SELECT * FROM professores WHERE usuario_id=?',[u.id]);if(u.tipo==='gestao')p=await get('SELECT * FROM gestao WHERE usuario_id=?',[u.id]);return {...u,senha_hash:undefined,perfil:p}}

// O BiblioBeta usa SQLite como banco principal. O Gmail SMTP também é usado para
// o envio automático de todas as notificações quando o SMTP estiver configurado.
function escaparHTML(v){return String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\\':'&#92;','"':'&quot;'}[c]));}
function montarEmailBiblioBeta({nome,titulo,mensagem,tipo='info',detalhes=[]}){
  const linhas=(detalhes||[]).filter(x=>x && x.valor!==undefined && x.valor!==null && String(x.valor)!=='').map(x=>`<tr><td style="padding:8px 10px;font-weight:700;color:#555">${escaparHTML(x.label)}</td><td style="padding:8px 10px">${escaparHTML(x.valor)}</td></tr>`).join('');
  const cor={atraso:'#b42318',prazo:'#b54708',emprestimo:'#175cd3',devolucao:'#067647',reserva:'#7f56d9',solicitacao:'#344054',penalidade:'#b42318',contato:'#344054',info:'#344054'}[tipo]||'#344054';
  return `<!doctype html><html><body style="margin:0;background:#f5f7fa;font-family:Arial,sans-serif;color:#1d2939"><div style="max-width:620px;margin:24px auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e4e7ec"><div style="padding:20px 24px;background:${cor};color:#fff"><div style="font-size:13px;opacity:.9">BiblioBeta · Gestão</div><h2 style="margin:6px 0 0;font-size:22px">${escaparHTML(titulo)}</h2></div><div style="padding:24px"><p>Olá, <strong>${escaparHTML(nome||'')}</strong>!</p><p style="white-space:pre-line;line-height:1.6">${escaparHTML(mensagem)}</p>${linhas?`<table style="width:100%;border-collapse:collapse;background:#f9fafb;margin:18px 0">${linhas}</table>`:''}<p style="font-size:13px;color:#667085">Acesse o BiblioBeta para consultar os detalhes e realizar as ações necessárias.</p><hr style="border:0;border-top:1px solid #eaecf0"><p style="font-size:12px;color:#98a2b3;margin-bottom:0">Mensagem automática do BiblioBeta. Não responda a este e-mail.</p></div></div></body></html>`;
}

async function notificarUsuario(usuarioId,titulo,mensagem,tipo='info',opts={}){
  // Fluxos definidos pelo BiblioBeta: a notificação é registrada no site e,
  // quando o SMTP estiver configurado, enviada também ao e-mail cadastrado.
  return registrarNotificacao(usuarioId,titulo,mensagem,tipo,{...opts,enviar:true});
}

// Status do último envio de e-mail, guardado em memória para diagnóstico.
// Antes esse erro só ia pro console (que ninguém vê); agora fica disponível
// em GET /api/configuracoes/status-email para a Gestão consultar pelo site.
const statusEmail={ultimoErro:null,ultimoErroEm:null,ultimoSucessoEm:null,totalFalhasSeguidas:0};

async function registrarNotificacao(usuarioId,titulo,mensagem,tipo='info',emailOpts={}){
  // somenteEmail: não cria aviso no painel (usado quando a Gestão escolhe cobrar só pelo Gmail).
  if(emailOpts.somenteEmail){ await enviarEmailNotificacao(usuarioId,titulo,mensagem,tipo,emailOpts); return true; }
  const recente=emailOpts.ignorarDuplicata?null:await get('SELECT id FROM notificacoes WHERE usuario_id=? AND titulo=? AND mensagem=? AND criado_em>=datetime(\'now\',\'-24 hours\') LIMIT 1',[usuarioId,titulo,mensagem]);
  if(recente) return false;
  const inserida=await run('INSERT INTO notificacoes(usuario_id,titulo,mensagem,tipo) VALUES(?,?,?,?)',[usuarioId,titulo,mensagem,tipo]);
  enviarEventoTempoReal(usuarioId,'notificacao',{id:inserida.id,titulo,mensagem,tipo,criado_em:new Date().toISOString()});

  // O envio do e-mail acontece em segundo plano (sem "await" aqui) para que
  // a notificação no site e a resposta da API não fiquem presas esperando o
  // SMTP responder. Se o Gmail estiver lento ou fora do ar, quem chamou
  // registrarNotificacao (ex.: cadastrar um livro) não sente isso na resposta;
  // o resultado do envio (sucesso/erro) continua indo para statusEmail e para
  // GET /api/configuracoes/status-email, como antes.
  if(emailOpts.enviar !== false){
    const envio=enviarEmailNotificacao(usuarioId,titulo,mensagem,tipo,emailOpts);
    if(emailOpts.aguardar) await envio;
  }
  return true;
}

// Categorias dos e-mails automáticos. A Gestão (administrador) liga/desliga cada categoria e
// escolhe quais tipos de usuário recebem, em Configurações > E-mails automáticos por categoria.
// Os avisos dentro do painel continuam sempre sendo criados; as regras valem só para o e-mail.
const CATEGORIAS_EMAIL=[
  {id:'boas_vindas',nome:'Boas-vindas',descricao:'Enviado quando uma pessoa conclui o cadastro.'},
  {id:'cadastro',nome:'Cadastros e acesso à Gestão',descricao:'Novos cadastros e pedidos de acesso à Gestão.'},
  {id:'solicitacao',nome:'Solicitações de empréstimo',descricao:'Pedido enviado, aprovado ou recusado.'},
  {id:'emprestimo',nome:'Empréstimos',descricao:'Empréstimo registrado, aprovado e retirada confirmada.'},
  {id:'renovacao',nome:'Renovações',descricao:'Empréstimo renovado com a nova data de devolução.'},
  {id:'devolucao',nome:'Devoluções',descricao:'Aviso de devolução, código de devolução e devolução registrada.'},
  {id:'reserva',nome:'Reservas',descricao:'Reserva registrada, disponível, expirada ou retirada.'},
  {id:'prazo',nome:'Lembretes de prazo',descricao:'Devolução em 3 dias e devolução no dia.'},
  {id:'atraso',nome:'Atrasos',descricao:'Empréstimo atrasado.'},
  {id:'cobranca',nome:'Cobrança de devolução',descricao:'Aviso da Gestão pedindo para devolver o livro (manual ou automático).'},
  {id:'penalidade',nome:'Multas e penalidades',descricao:'Penalidade aplicada ou encerrada.'},
  {id:'livro',nome:'Novidades do acervo',descricao:'Livro novo, atualizado, removido ou de volta ao catálogo.'},
  {id:'contato',nome:'Mensagens de contato',descricao:'Mensagens enviadas pelo formulário de contato do site.'},
  {id:'informativo',nome:'Avisos gerais da Gestão',descricao:'Comunicados enviados manualmente pela Gestão.'}
];
// Mensagens que o sistema envia automaticamente (mesmos textos usados no código). Servem de modelo
// para a Gestão reenviar manualmente quando o envio automático falhar. [Entre colchetes] = preencher.
const MENSAGENS_AUTOMATICAS=[
  {categoria:'boas_vindas',nome:'Boas-vindas — aluno',titulo:'👋 Bem-vindo(a), aluno(a)!',mensagem:'Sua conta de aluno foi criada com sucesso. Agora você pode acessar o catálogo, solicitar livros, acompanhar seus empréstimos e receber avisos da biblioteca pelo BiblioBeta.'},
  {categoria:'boas_vindas',nome:'Boas-vindas — professor',titulo:'👋 Bem-vindo(a), professor(a)!',mensagem:'Sua conta de professor foi criada com sucesso. Agora você pode acessar o catálogo, consultar livros, acompanhar seus empréstimos e receber avisos da biblioteca pelo BiblioBeta.'},
  {categoria:'solicitacao',nome:'Solicitação enviada',titulo:'Solicitação enviada',mensagem:'Sua solicitação do livro "[livro]" foi enviada para a Gestão. Aguarde a aprovação. Quando a Gestão aprovar, você receberá um código de retirada.'},
  {categoria:'solicitacao',nome:'Solicitação recusada',titulo:'Solicitação recusada: [livro]',mensagem:'[motivo da recusa]'},
  {categoria:'emprestimo',nome:'Empréstimo aprovado (código de retirada)',titulo:'Empréstimo aprovado: [livro]',mensagem:'Sua solicitação foi aprovada. O exemplar [código do exemplar] está separado para você. Seu código de retirada é [código de retirada]. Apresente esse código na biblioteca para pegar o livro.'},
  {categoria:'emprestimo',nome:'Empréstimo registrado',titulo:'Empréstimo registrado: [livro]',mensagem:'O livro foi registrado em seu nome. A devolução está prevista para [data].'},
  {categoria:'emprestimo',nome:'Retirada confirmada',titulo:'Retirada confirmada: [livro]',mensagem:'A Gestão confirmou a retirada de "[livro]". A devolução está prevista para [data].'},
  {categoria:'renovacao',nome:'Empréstimo renovado',titulo:'Empréstimo renovado: [livro]',mensagem:'A nova data prevista de devolução é [data].'},
  {categoria:'devolucao',nome:'Código de devolução',titulo:'Código de devolução: [código]',mensagem:'Guarde o código [código]. Ele será usado pela Gestão no momento em que você devolver o livro.'},
  {categoria:'devolucao',nome:'Devolução registrada',titulo:'Devolução registrada: [livro]',mensagem:'A Gestão confirmou a devolução de "[livro]". O exemplar [código do exemplar] voltou a ficar disponível no acervo.'},
  {categoria:'reserva',nome:'Reserva registrada',titulo:'Reserva registrada: [livro]',mensagem:'Sua reserva foi registrada e você entrou na fila de espera.'},
  {categoria:'reserva',nome:'Reserva disponível',titulo:'Reserva disponível: [livro]',mensagem:'O livro reservado já está disponível para retirada na biblioteca.'},
  {categoria:'reserva',nome:'Reserva expirada',titulo:'Reserva expirada: [livro]',mensagem:'O prazo para retirada da reserva terminou e ela foi cancelada automaticamente.'},
  {categoria:'prazo',nome:'Devolução em 3 dias',titulo:'Devolução em 3 dias: [livro]',mensagem:'Seu empréstimo vence em 3 dias.'},
  {categoria:'prazo',nome:'Devolução hoje',titulo:'Devolução hoje: [livro]',mensagem:'O prazo de devolução deste livro termina hoje.'},
  {categoria:'cobranca',nome:'Cobrança — devolver o livro',titulo:'📚 Devolva o livro: [livro]',mensagem:'A Gestão da biblioteca pede que você devolva o livro "[livro]". Leve o exemplar à biblioteca o quanto antes.'},
  {categoria:'atraso',nome:'Empréstimo atrasado',titulo:'Empréstimo atrasado: [livro]',mensagem:'O prazo de devolução venceu. Procure a biblioteca para regularizar o empréstimo.'},
  {categoria:'penalidade',nome:'Penalidade aplicada',titulo:'Penalidade aplicada',mensagem:'[descrição da penalidade]'},
  {categoria:'penalidade',nome:'Penalidade encerrada',titulo:'Penalidade encerrada',mensagem:'A penalidade registrada em seu nome foi encerrada.'},
  {categoria:'livro',nome:'Novo livro no catálogo',titulo:'Novo livro no catálogo: [livro]',mensagem:'O livro "[livro]", de [autor], chegou ao catálogo do BiblioBeta e já está disponível para solicitação.',destinatarios:'leitores'},
  {categoria:'livro',nome:'Livro novamente disponível',titulo:'Livro novamente disponível: [livro]',mensagem:'O livro "[livro]", de [autor], voltou ao catálogo e possui exemplar disponível para solicitação.'},
  {categoria:'cadastro',nome:'Acesso à Gestão aprovado',titulo:'Acesso à Gestão aprovado',mensagem:'Seu acesso à Gestão foi aprovado. Você já pode entrar.'}
];
const IDS_CATEGORIAS_EMAIL=new Set(CATEGORIAS_EMAIL.map(c=>c.id));
function categoriaDoEmail(tipo,emailOpts={}){
  if(emailOpts.categoria && IDS_CATEGORIAS_EMAIL.has(emailOpts.categoria)) return emailOpts.categoria;
  return IDS_CATEGORIAS_EMAIL.has(tipo) ? tipo : 'informativo';
}
async function categoriaPermiteEmail(categoria,tipoUsuario){
  const r=await get('SELECT * FROM email_categorias WHERE categoria=?',[categoria]);
  if(!r) return true;
  if(!Number(r.ativo)) return false;
  const col=tipoUsuario==='gestao'?'para_gestao':tipoUsuario==='professor'?'para_professor':'para_aluno';
  return !!Number(r[col]);
}

// ---- Reenvio automático de e-mails que falharam por motivo temporário ----
// Tentativas após 1, 5, 15 e 60 minutos (5 envios no total). Fica gravado no banco,
// então os e-mails pendentes sobrevivem se o servidor for reiniciado.
const ESPERA_REENVIO_MIN=[1,5,15,60];
function erroTemporarioEmail(e){
  const m=String(e&&e.message||'');
  if(/recusou o login|n[ãa]o configurado/i.test(m)) return false;   // não adianta tentar de novo
  if(e&&e.codigo==='SMTP') return e.smtp>=400&&e.smtp<500;           // 4xx = temporário; 5xx = definitivo
  return true;                                                         // conexão, timeout, DNS...
}
async function enfileirarReenvio(msg,erro,tentativas){
  const min=ESPERA_REENVIO_MIN[tentativas-1];
  if(min===undefined){ console.error('E-mail descartado após várias tentativas:',msg.to,erro); return; }
  await run("INSERT INTO email_fila(para,conta,assunto,texto,html,tentativas,proxima_em,ultimo_erro) VALUES(?,?,?,?,?,?,datetime('now',?),?)",[msg.to,msg.conta,msg.subject,msg.text,msg.html,tentativas,`+${min} minutes`,String(erro||'').slice(0,300)]);
}
let processandoFila=false;
async function processarFilaEmail(){
  if(processandoFila) return; processandoFila=true;
  try{
    const itens=await all("SELECT * FROM email_fila WHERE proxima_em<=CURRENT_TIMESTAMP ORDER BY id LIMIT 20");
    for(const it of itens){
      // "pega" o item de forma atômica (evita envio duplicado se algo rodar em paralelo)
      const pegou=await run('DELETE FROM email_fila WHERE id=?',[it.id]);
      if(pegou.changes!==1) continue;
      const msg={to:it.para,conta:it.conta,subject:it.assunto,text:it.texto,html:it.html};
      try{
        await enviarEmailSMTP({...msg,codigo:'',minutos:15});
        statusEmail.ultimoSucessoEm=new Date().toISOString();
        statusEmail.totalFalhasSeguidas=0;
      }catch(err){
        statusEmail.ultimoErro=err.message; statusEmail.ultimoErroEm=new Date().toISOString(); statusEmail.totalFalhasSeguidas++;
        if(erroTemporarioEmail(err)) await enfileirarReenvio(msg,err.message,it.tentativas+1);
        // Se a rede ainda está fora, não adianta tentar o resto da fila agora.
        if(!err.codigo || err.codigo!=='SMTP') break;
      }
    }
  }catch(e){ console.warn('Fila de e-mail:',e.message); }
  finally{ processandoFila=false; }
}

async function enviarEmailNotificacao(usuarioId,titulo,mensagem,tipo,emailOpts={}){
  // Envia também por e-mail quando a notificação tiver um destinatário válido.
  // Usa a conta de e-mail correta conforme o tipo do destinatário: Gestão usa
  // a conta principal (SMTP_USER); aluno/professor usa a conta separada
  // (SMTP_USER_ALUNOS), se configurada — evitando misturar os dois fluxos.
  try{
    const u=await get("SELECT nome,email,email_alternativo,tipo FROM leitores WHERE id=? AND status='ativo' LIMIT 1",[usuarioId]);
    if(u && emailValido(u.email)){
      // Regras por categoria (Configurações). Envio manual da Gestão ignora as regras (emailOpts.forcar).
      if(!emailOpts.forcar && !(await categoriaPermiteEmail(categoriaDoEmail(tipo,emailOpts),u.tipo))) return;
      const conta=u.tipo==='gestao' ? 'gestao' : 'usuarios';
      if(!smtpConfigurado(conta)){
        statusEmail.ultimoErro=`SMTP (${conta}) não configurado.`;
        statusEmail.ultimoErroEm=new Date().toISOString();
      } else {
        const base={
          conta,
          subject:emailOpts.assunto || `BiblioBeta — ${titulo}`,
          text:`Olá, ${u.nome || ''}!\n\n${mensagem}\n\nAcesse o BiblioBeta para mais detalhes.\n\nBiblioBeta — Gestão`,
          html:emailOpts.html || montarEmailBiblioBeta({nome:u.nome,titulo,mensagem,tipo,detalhes:emailOpts.detalhes||[]})
        };
        // Cada endereço (pessoal e institucional) recebe a sua cópia; uma falha em um não cancela o outro.
        let primeiroErro=null, algumOk=false;
        for(const to of destinosEmail(u)){
          const msg={...base,to};
          try{
            await enviarEmailSMTP({...msg,codigo:'',minutos:15});
            algumOk=true;
          }catch(err){
            // Falha temporária (rede, Gmail fora do ar): guarda na fila para reenviar sozinho.
            if(erroTemporarioEmail(err)){ try{ await enfileirarReenvio(msg,err.message,1); }catch(_){} }
            primeiroErro=primeiroErro||err;
            console.error('Aviso: e-mail não enviado para '+to+':',err.message);
          }
        }
        if(algumOk){ statusEmail.ultimoSucessoEm=new Date().toISOString(); statusEmail.totalFalhasSeguidas=0; }
        else if(primeiroErro) throw primeiroErro;
      }
    }
  }catch(e){
    statusEmail.ultimoErro=e.message;
    statusEmail.ultimoErroEm=new Date().toISOString();
    statusEmail.totalFalhasSeguidas++;
    console.error('Aviso: notificação criada, mas o e-mail não foi enviado:',e.message);
  }
}
async function processarReservas(){
  const expiradas=await all("SELECT r.id,r.usuario_id,r.livro_id,l.titulo FROM reservas r JOIN livros l ON l.id=r.livro_id WHERE r.status='pronto' AND r.prazo_retirada IS NOT NULL AND r.prazo_retirada<CURRENT_TIMESTAMP");
  for(const r of expiradas){
    await run("UPDATE reservas SET status='cancelada' WHERE id=? AND status='pronto'",[r.id]);
    await registrarNotificacao(r.usuario_id,`Reserva expirada: ${r.titulo}`,`O prazo para retirada da reserva terminou e ela foi cancelada automaticamente.`,'reserva',{assunto:`BiblioBeta — reserva expirada: ${r.titulo}`});
    const proxima=await get("SELECT r.id,r.usuario_id FROM reservas r WHERE r.livro_id=? AND r.status='fila' ORDER BY r.data_reserva ASC LIMIT 1",[r.livro_id]);
    if(proxima){
      await run("UPDATE reservas SET status='pronto',prazo_retirada=datetime('now','+2 days') WHERE id=?",[proxima.id]);
      await registrarNotificacao(proxima.usuario_id,`Reserva disponível: ${r.titulo}`,`Sua reserva foi liberada. O prazo para retirada é de 2 dias.`,'reserva',{assunto:`BiblioBeta — reserva disponível: ${r.titulo}`});
    }
  }
}

// Quando o último livro em atraso é devolvido, o bloqueio "até regularizar" termina sozinho.
async function encerrarBloqueiosRegularizacao(usuarioId){
  const restam=await get("SELECT COUNT(*) total FROM emprestimos WHERE usuario_id=? AND status!='devolvido' AND julianday(data_prevista_devolucao)<julianday('now')",[usuarioId]);
  if(restam.total>0) return;
  const lista=await all("SELECT id FROM penalidades WHERE usuario_id=? AND status='ativa' AND tipo='bloqueio_regularizacao'",[usuarioId]);
  for(const p of lista){
    await run("UPDATE penalidades SET status='cumprida',fim_em=? WHERE id=?",[new Date().toISOString(),p.id]);
    await registrarNotificacao(usuarioId,'Penalidade encerrada','Você devolveu o livro em atraso e seus empréstimos foram liberados novamente.','penalidade');
  }
}
// Bloqueios por dias que já passaram viram "cumprida" automaticamente.
async function encerrarPenalidadesVencidas(){
  const lista=await all("SELECT id,usuario_id,fim_em FROM penalidades WHERE status='ativa' AND fim_em IS NOT NULL");
  for(const p of lista){
    if(new Date(p.fim_em).getTime()>Date.now()) continue;
    await run("UPDATE penalidades SET status='cumprida' WHERE id=? AND status='ativa'",[p.id]);
    await registrarNotificacao(p.usuario_id,'Penalidade encerrada','O prazo da sua penalidade terminou. Você já pode pedir livros novamente.','penalidade');
  }
}
async function processarPrazos(){
  try{ await encerrarPenalidadesVencidas(); }catch(e){ console.warn('Falha ao encerrar penalidades vencidas:',e.message); }
  const lista=await all(`SELECT ep.id,ep.usuario_id,ep.data_prevista_devolucao,ep.status,l.titulo,u.email,u.nome FROM emprestimos ep JOIN exemplares ex ON ex.id=ep.exemplar_id JOIN livros l ON l.id=ex.livro_id JOIN leitores u ON u.id=ep.usuario_id WHERE ep.status!='devolvido'`);
  for(const ep of lista){
    const prazo=new Date(ep.data_prevista_devolucao), agora=new Date(), dias=Math.ceil((prazo-agora)/86400000);
    if(dias<0){
      const ficouAtrasado=ep.status!=='atrasado';
      if(ficouAtrasado) await run("UPDATE emprestimos SET status='atrasado' WHERE id=? AND status!='devolvido'",[ep.id]);
      await registrarNotificacao(ep.usuario_id,`Empréstimo atrasado: ${ep.titulo}`,`O prazo de devolução venceu. Procure a biblioteca para regularizar o empréstimo.`,`atraso`,{assunto:`BiblioBeta — empréstimo atrasado: ${ep.titulo}`});
      if(ficouAtrasado){
        const gestores=await all("SELECT id FROM leitores WHERE tipo='gestao' AND status='ativo'");
        for(const g of gestores) await registrarNotificacao(g.id,`Empréstimo atrasado: ${ep.titulo}`,`${ep.nome} está com o livro em atraso. Verifique a devolução ou aplique uma penalidade.`,`atraso`,{detalhes:[{label:'Usuário',valor:ep.nome},{label:'Livro',valor:ep.titulo},{label:'Vencimento',valor:new Date(ep.data_prevista_devolucao).toLocaleDateString('pt-BR')}]});
      }
    }else if(dias===0){
      await registrarNotificacao(ep.usuario_id,`Devolução hoje: ${ep.titulo}`,`O prazo de devolução deste livro termina hoje.`,`prazo`,{assunto:`BiblioBeta — devolução hoje: ${ep.titulo}`});
    }else if(dias===3){
      await registrarNotificacao(ep.usuario_id,`Devolução em 3 dias: ${ep.titulo}`,`Seu empréstimo vence em 3 dias.`,`prazo`,{assunto:`BiblioBeta — devolução em 3 dias: ${ep.titulo}`});
    }
  }
  await processarCobrancasAutomaticas();
}


// ---- Cobrança de devolução ----
// A Gestão pede para a pessoa devolver o livro. Canais: 'site' (aviso no painel + tela de aviso),
// 'email' (só Gmail) ou 'ambos'. Pode ser manual (botões na Gestão) ou automático (Configurações).
const CANAIS_COBRANCA=['site','email','ambos'];
function textoCobranca(ep){
  const prazo=new Date(ep.data_prevista_devolucao), dias=Math.ceil((prazo-new Date())/86400000), data=prazo.toLocaleDateString('pt-BR');
  if(dias<0) return `O prazo de devolução de "${ep.titulo}" venceu em ${data}. Você precisa devolver o livro à biblioteca o quanto antes.`;
  if(dias===0) return `O prazo de devolução de "${ep.titulo}" termina hoje (${data}). Leve o livro à biblioteca para devolver.`;
  return `Você está com o livro "${ep.titulo}" e a devolução está prevista para ${data}. Lembre-se de devolvê-lo à biblioteca.`;
}
async function cobrarDevolucao(ep,{canal='ambos',mensagem='',automatico=false}={}){
  canal=CANAIS_COBRANCA.includes(canal)?canal:'ambos';
  const atrasado=new Date(ep.data_prevista_devolucao)<new Date();
  const titulo=`📚 Devolva o livro: ${ep.titulo}`;
  const msg=String(mensagem||'').trim()||textoCobranca(ep);
  const detalhes=[{label:'Livro',valor:ep.titulo},{label:'Exemplar',valor:ep.exemplar_codigo},{label:'Prazo de devolução',valor:new Date(ep.data_prevista_devolucao).toLocaleDateString('pt-BR')}];
  await run("UPDATE emprestimos SET cobranca_em=CURRENT_TIMESTAMP,cobranca_total=COALESCE(cobranca_total,0)+1,cobranca_canal=?,cobranca_msg=?,cobranca_tela=? WHERE id=?",[canal,msg,canal==='email'?0:1,ep.id]);
  const opts={categoria:'cobranca',assunto:`BiblioBeta — devolva o livro: ${ep.titulo}`,detalhes,ignorarDuplicata:true,aguardar:true};
  if(!automatico) opts.forcar=true; // manual ignora as regras de e-mail por categoria; o automático respeita
  if(canal==='email') opts.somenteEmail=true;
  else if(canal==='site') opts.enviar=false;
  const erroAntes=statusEmail.ultimoErroEm;
  await registrarNotificacao(ep.usuario_id,titulo,msg,atrasado?'atraso':'prazo',opts);
  if(canal!=='email') enviarEventoTempoReal(ep.usuario_id,'cobranca_devolucao',{emprestimo_id:ep.id,titulo:ep.titulo});
  const emailFalhou=canal!=='site' && statusEmail.ultimoErroEm!==erroAntes;
  return {titulo:ep.titulo,usuario:ep.usuario,emailFalhou};
}
const SQL_EMPRESTIMOS_COBRAVEIS=`SELECT ep.*,u.nome usuario,u.email,u.tipo usuario_tipo,l.titulo,e.codigo exemplar_codigo FROM emprestimos ep JOIN leitores u ON u.id=ep.usuario_id AND u.status='ativo' JOIN exemplares e ON e.id=ep.exemplar_id JOIN livros l ON l.id=e.livro_id WHERE ep.status!='devolvido' AND ep.retirada_confirmada=1`;
function filtrarPorAlvo(lista,alvo){
  const agora=new Date();
  return lista.filter(ep=>{const venc=new Date(ep.data_prevista_devolucao),dias=Math.ceil((venc-agora)/86400000);
    if(alvo==='atrasados') return venc<agora;
    if(alvo==='vencendo') return venc>=agora && dias<=3;
    return venc<agora || dias<=3; // 'todos' = atrasados + vencendo em até 3 dias
  });
}
let cobrandoAuto=false;
async function processarCobrancasAutomaticas(){
  if(cobrandoAuto) return; cobrandoAuto=true;
  try{
    const c=await get('SELECT cobranca_auto,cobranca_canal,cobranca_alvo,cobranca_intervalo_dias FROM configuracoes WHERE id=1');
    if(!c||!Number(c.cobranca_auto)) return;
    const intervalo=Math.max(1,Number(c.cobranca_intervalo_dias)||3);
    const lista=filtrarPorAlvo(await all(SQL_EMPRESTIMOS_COBRAVEIS+" AND (ep.cobranca_em IS NULL OR ep.cobranca_em<=datetime('now',?))",[`-${intervalo} days`]),c.cobranca_alvo);
    for(const ep of lista){ try{ await cobrarDevolucao(ep,{canal:c.cobranca_canal,automatico:true}); }catch(e){ console.warn('Cobrança automática:',e.message); } }
  }catch(e){ console.warn('Cobrança automática:',e.message); }
  finally{ cobrandoAuto=false; }
}

async function garantirEstrutura(){
  // Migração para permitir cadastros aguardando aprovação da Gestão.
  // Bancos antigos tinham apenas ativo/inativo; recriamos a tabela mantendo os dados.
  try{
    const info=await get("SELECT sql FROM sqlite_master WHERE type='table' AND name='leitores'");
    if(info?.sql && !info.sql.includes("'pendente'")){
      await run('PRAGMA foreign_keys=OFF');
      await run(`CREATE TABLE IF NOT EXISTS leitores_nova (id INTEGER PRIMARY KEY AUTOINCREMENT,nome TEXT NOT NULL,email TEXT NOT NULL UNIQUE,telefone TEXT,senha_hash TEXT NOT NULL,tipo TEXT NOT NULL CHECK(tipo IN ('aluno','professor','gestao')),status TEXT NOT NULL DEFAULT 'ativo' CHECK(status IN ('ativo','inativo','pendente')),criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
      await run(`INSERT INTO leitores_nova(id,nome,email,telefone,senha_hash,tipo,status,criado_em) SELECT id,nome,email,telefone,senha_hash,tipo,status,criado_em FROM leitores`);
      await run('DROP TABLE leitores');
      await run('ALTER TABLE leitores_nova RENAME TO leitores');
      await run('CREATE INDEX IF NOT EXISTS idx_leitores_tipo_status ON leitores(tipo,status)');
      await run('PRAGMA foreign_keys=ON');
    }
  }catch(e){
    try{await run('PRAGMA foreign_keys=ON')}catch(_){}
    throw e;
  }
  // Proteção estrutural: Gestão administra a biblioteca, mas nunca é um leitor.
  await run(`CREATE TRIGGER IF NOT EXISTS trg_emprestimos_somente_leitores BEFORE INSERT ON emprestimos BEGIN SELECT CASE WHEN (SELECT tipo FROM leitores WHERE id=NEW.usuario_id)='gestao' THEN RAISE(ABORT,'Gestão não pode ser destinatária de empréstimo.') END; END`);
  await run(`CREATE TRIGGER IF NOT EXISTS trg_reservas_somente_leitores BEFORE INSERT ON reservas BEGIN SELECT CASE WHEN (SELECT tipo FROM leitores WHERE id=NEW.usuario_id)='gestao' THEN RAISE(ABORT,'Gestão não pode fazer reservas de livros.') END; END`);
  await run(`CREATE TRIGGER IF NOT EXISTS trg_solicitacoes_somente_leitores BEFORE INSERT ON solicitacoes_emprestimo BEGIN SELECT CASE WHEN (SELECT tipo FROM leitores WHERE id=NEW.usuario_id)='gestao' THEN RAISE(ABORT,'Gestão não pode solicitar empréstimos.') END; END`);
  await run(`CREATE TRIGGER IF NOT EXISTS trg_penalidades_somente_leitores BEFORE INSERT ON penalidades BEGIN SELECT CASE WHEN (SELECT tipo FROM leitores WHERE id=NEW.usuario_id)='gestao' THEN RAISE(ABORT,'Gestão não pode receber penalidades de leitor.') END; END`);
  await run(`CREATE TRIGGER IF NOT EXISTS trg_nao_transformar_leitor_em_gestao BEFORE UPDATE OF tipo ON leitores WHEN OLD.tipo IN ('aluno','professor') AND NEW.tipo='gestao' BEGIN SELECT RAISE(ABORT,'Um leitor não pode ser transformado em Gestão.'); END`);
  try{ await run("ALTER TABLE alunos ADD COLUMN ra_digito TEXT"); }catch(e){ if(!String(e.message).includes('duplicate column')) throw e; }
  try{ await run("ALTER TABLE reservas ADD COLUMN prazo_retirada DATETIME"); }catch(e){ if(!String(e.message).includes('duplicate column')) throw e; }
  try{ await run("ALTER TABLE emprestimos ADD COLUMN codigo_devolucao TEXT"); }catch(e){ if(!String(e.message).includes('duplicate column')) throw e; }
  try{ await run("ALTER TABLE emprestimos ADD COLUMN codigo_devolucao_criado_em DATETIME"); }catch(e){ if(!String(e.message).includes('duplicate column')) throw e; }
  try{ await run("ALTER TABLE emprestimos ADD COLUMN retirada_confirmada INTEGER NOT NULL DEFAULT 1"); }catch(e){ if(!String(e.message).includes('duplicate column')) throw e; }
  // Guarda o momento do último login para a mensagem "bem-vindo de volta" (aluno/professor).
  try{ await run("ALTER TABLE leitores ADD COLUMN ultimo_acesso DATETIME"); }catch(e){ if(!String(e.message).includes('duplicate column')) throw e; }
  // Segundo e-mail (professor: Gmail pessoal + institucional). O Gmail pessoal costuma ser o que realmente recebe.
  try{ await run("ALTER TABLE leitores ADD COLUMN email_alternativo TEXT"); }catch(e){ if(!String(e.message).includes('duplicate column')) throw e; }
  await run("CREATE UNIQUE INDEX IF NOT EXISTS idx_leitores_email_alt ON leitores(LOWER(email_alternativo)) WHERE email_alternativo IS NOT NULL");
  // Capas ficam DENTRO do banco: ao copiar/compactar só o database.sqlite, as capas vão junto.
  await run(`CREATE TABLE IF NOT EXISTS capas_arquivos (nome TEXT PRIMARY KEY,tipo TEXT NOT NULL,dados BLOB NOT NULL,criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await run(`CREATE TABLE IF NOT EXISTS capas_cache (isbn TEXT PRIMARY KEY,tipo TEXT NOT NULL,dados BLOB NOT NULL,criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await importarCapasDoDisco();
  // Cobrança de devolução (Gestão pede para a pessoa devolver o livro)
  for(const [col,def] of [['cobranca_em','DATETIME'],['cobranca_total','INTEGER NOT NULL DEFAULT 0'],['cobranca_canal','TEXT'],['cobranca_msg','TEXT'],['cobranca_tela','INTEGER NOT NULL DEFAULT 0']]){
    try{ await run(`ALTER TABLE emprestimos ADD COLUMN ${col} ${def}`); }catch(e){ if(!String(e.message).includes('duplicate column')) throw e; }
  }
  for(const [col,def] of [['cobranca_auto','INTEGER NOT NULL DEFAULT 0'],['cobranca_canal',"TEXT NOT NULL DEFAULT 'ambos'"],['cobranca_alvo',"TEXT NOT NULL DEFAULT 'atrasados'"],['cobranca_intervalo_dias','INTEGER NOT NULL DEFAULT 3']]){
    try{ await run(`ALTER TABLE configuracoes ADD COLUMN ${col} ${def}`); }catch(e){ if(!String(e.message).includes('duplicate column')) throw e; }
  }
  await run(`CREATE INDEX IF NOT EXISTS idx_reservas_status_prazo ON reservas(status,prazo_retirada)`);
  await run(`CREATE TABLE IF NOT EXISTS turmas (id INTEGER PRIMARY KEY AUTOINCREMENT,nome TEXT NOT NULL,ano INTEGER,etapa TEXT,status TEXT NOT NULL DEFAULT 'ativo' CHECK(status IN ('ativo','inativo')),criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(nome,ano))`);
  await run(`CREATE INDEX IF NOT EXISTS idx_turmas_status_nome ON turmas(status,nome)`);
  await run(`CREATE TABLE IF NOT EXISTS penalidades (id INTEGER PRIMARY KEY AUTOINCREMENT,usuario_id INTEGER NOT NULL,emprestimo_id INTEGER,descricao TEXT NOT NULL,tipo TEXT NOT NULL DEFAULT 'advertencia' CHECK(tipo IN ('advertencia','bloqueio_3','bloqueio_7','bloqueio_15','bloqueio_regularizacao')),dias_bloqueio INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'ativa' CHECK(status IN ('ativa','cumprida','cancelada')),criada_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,inicio_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,fim_em DATETIME,FOREIGN KEY(usuario_id) REFERENCES leitores(id) ON DELETE CASCADE,FOREIGN KEY(emprestimo_id) REFERENCES emprestimos(id) ON DELETE SET NULL)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_penalidades_usuario_status ON penalidades(usuario_id,status)`);
  await run(`CREATE TABLE IF NOT EXISTS preferencias_notificacao (usuario_id INTEGER PRIMARY KEY,livros INTEGER NOT NULL DEFAULT 1,emprestimos INTEGER NOT NULL DEFAULT 1,reservas INTEGER NOT NULL DEFAULT 1,atrasos INTEGER NOT NULL DEFAULT 1,devolucoes INTEGER NOT NULL DEFAULT 1,cadastros INTEGER NOT NULL DEFAULT 1,informativos INTEGER NOT NULL DEFAULT 1,atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(usuario_id) REFERENCES leitores(id) ON DELETE CASCADE)`);
  await run(`INSERT OR IGNORE INTO preferencias_notificacao(usuario_id) SELECT id FROM leitores`);
  await run(`CREATE TABLE IF NOT EXISTS email_categorias (categoria TEXT PRIMARY KEY,ativo INTEGER NOT NULL DEFAULT 1,para_aluno INTEGER NOT NULL DEFAULT 1,para_professor INTEGER NOT NULL DEFAULT 1,para_gestao INTEGER NOT NULL DEFAULT 1,atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  for(const c of CATEGORIAS_EMAIL) await run('INSERT OR IGNORE INTO email_categorias(categoria) VALUES(?)',[c.id]);
  await run(`CREATE TABLE IF NOT EXISTS email_fila (id INTEGER PRIMARY KEY AUTOINCREMENT,para TEXT NOT NULL,conta TEXT NOT NULL,assunto TEXT NOT NULL,texto TEXT NOT NULL,html TEXT NOT NULL,tentativas INTEGER NOT NULL DEFAULT 1,proxima_em DATETIME NOT NULL,ultimo_erro TEXT,criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  const grupos=await all(`SELECT DISTINCT turma,serie,etapa FROM alunos WHERE TRIM(COALESCE(turma,''))<>''`);
  for(const g of grupos){
    const nome=String(g.turma).trim(), ano=parseInt(String(g.serie||'').match(/\d+/)?.[0]||'',10)||null, etapa=g.etapa||null;
    await run("INSERT OR IGNORE INTO turmas(nome,ano,etapa,status) VALUES(?,?,?,'ativo')",[nome,ano,etapa]);
  }
}

async function seed(){
  await run("UPDATE alunos SET ra=REPLACE(ra,'-','') WHERE ra LIKE '%-%'");
  await run('INSERT OR IGNORE INTO configuracoes(id) VALUES(1)');
  for(const c of ['Literatura','Ficção','História','Ciências','Infantil'])
    await run('INSERT OR IGNORE INTO categorias(nome) VALUES(?)',[c]);

  // Mantém somente a conta administrativa necessária para o primeiro acesso.
  // Não cria alunos ou professores de demonstração.
  async function ensureDemo({email:em,nome,telefone='',senha,tipo,perfil={}}){
    em=email(em);
    let u=await get('SELECT id FROM leitores WHERE email=?',[em]);
    const h=scryptHash(senha);
    let id;
    if(!u){
      const r=await run("INSERT INTO leitores(nome,email,telefone,senha_hash,tipo,status) VALUES(?,?,?,?,?,'ativo')",[nome,em,telefone,h,tipo]);
      id=r.id;
    }else{
      id=u.id;
      await run("UPDATE leitores SET nome=?,telefone=?,senha_hash=?,tipo=?,status='ativo' WHERE id=?",[nome,telefone,h,tipo,id]);
    }
    if(tipo==='gestao'){
      await run('INSERT OR IGNORE INTO gestao(usuario_id,cargo,nivel_acesso) VALUES(?,?,?)',[id,'Administrador','admin']);
      await run('UPDATE gestao SET cargo=?,nivel_acesso=? WHERE usuario_id=?',['Administrador','admin',id]);
    }
    if(tipo==='aluno'){
      await run('INSERT OR IGNORE INTO alunos(usuario_id,ra,serie,turma) VALUES(?,?,?,?)',[id,perfil.ra,perfil.serie,perfil.turma]);
      await run('UPDATE alunos SET ra=?,serie=?,turma=? WHERE usuario_id=?',[perfil.ra,perfil.serie,perfil.turma,id]);
    }
    if(tipo==='professor'){
      await run('INSERT OR IGNORE INTO professores(usuario_id,matricula,disciplina) VALUES(?,?,?)',[id,perfil.matricula||'CP-001',perfil.disciplina||'Literatura']);
      await run('UPDATE professores SET matricula=?,disciplina=? WHERE usuario_id=?',[perfil.matricula||'CP-001',perfil.disciplina||'Literatura',id]);
    }
  }

  await ensureDemo({email:'bibliobeta20@gmail.com',nome:'Gestão BiblioBeta',senha:'Vasco123!',tipo:'gestao'});
}
async function garantirColunasSolicitacaoEmprestimo(){
  const cols=await all('PRAGMA table_info(solicitacoes_emprestimo)');
  if(!cols.some(c=>c.name==='codigo_seguranca')){
    await run('ALTER TABLE solicitacoes_emprestimo ADD COLUMN codigo_seguranca TEXT');
  }
  const ecols=await all('PRAGMA table_info(emprestimos)');
  if(!ecols.some(c=>c.name==='codigo_seguranca')){
    await run('ALTER TABLE emprestimos ADD COLUMN codigo_seguranca TEXT');
  }
}
// Front-end: HTML/CSS/JS sempre revalidados (o navegador pergunta se mudou e recebe 304 rápido, sem baixar de novo);
// imagens e fontes ficam em cache por 7 dias.
app.use(express.static(FRONTEND_PATH,{etag:true,lastModified:true,setHeaders:(res,filePath)=>{
  if(/\.(png|jpe?g|webp|gif|svg|ico|woff2?)$/i.test(filePath)) res.set('Cache-Control','public, max-age=604800');
  else res.set('Cache-Control','no-cache');
}}));
app.use('/uploads',express.static(UPLOADS_PATH,{etag:true,lastModified:true,maxAge:'30d'}));
app.get('/api/versao',(_req,res)=>res.set('Cache-Control','no-store').json({versao:'1.9-fluxos-email-completos',codigo_retirada:'6 números',codigo_devolucao:'6 números',notificacoes:'site+email',papeis:'gestao-separada-de-leitores'}));
app.get('/',(req,res)=>res.sendFile(path.join(FRONTEND_PATH,'Index.html')));

db.serialize(()=>{
  db.run('PRAGMA foreign_keys=ON');
  const schema=fs.readFileSync(path.join(__dirname,'schema.sql'),'utf8');
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='usuarios'",(err,oldTable)=>{
    if(err) throw err;
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='leitores'",(err2,newTable)=>{
      if(err2) throw err2;
      const continuar=()=>db.exec(schema,e=>{
        if(e) throw e;
        db.all("PRAGMA table_info(emprestimos)",(e3,cols)=>{
          if(e3) throw e3;
          const temColuna=(cols||[]).some(c=>c.name==='aviso_devolucao');
          const prosseguir=()=>db.run(`CREATE TABLE IF NOT EXISTS multas (id INTEGER PRIMARY KEY AUTOINCREMENT,emprestimo_id INTEGER NOT NULL UNIQUE,usuario_id INTEGER NOT NULL,valor_dia REAL NOT NULL DEFAULT 5,status TEXT NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente','paga','cancelada')),criada_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,paga_em DATETIME,FOREIGN KEY(emprestimo_id) REFERENCES emprestimos(id) ON DELETE CASCADE,FOREIGN KEY(usuario_id) REFERENCES leitores(id) ON DELETE CASCADE)`,e5=>{
            if(e5) throw e5;
            db.run('CREATE INDEX IF NOT EXISTS idx_multas_status_usuario ON multas(status,usuario_id)',e6=>{
              if(e6) throw e6;
              garantirEstrutura().then(()=>garantirGeneros({run,all,get})).then(()=>garantirColunasSolicitacaoEmprestimo()).then(()=>seed()).then(async()=>{ await run("UPDATE leitores SET status='ativo' WHERE status='pendente'"); await processarPrazos(); await processarReservas(); console.log('Banco SQLite pronto:',DB_PATH); }).catch(e=>console.error('Falha ao preparar o banco:',e));
            });
          });
          if(!temColuna){
            db.run('ALTER TABLE emprestimos ADD COLUMN aviso_devolucao INTEGER NOT NULL DEFAULT 0',e4=>{
              if(e4) throw e4;
              console.log('Coluna aviso_devolucao adicionada em emprestimos.');
              db.run('ALTER TABLE emprestimos ADD COLUMN codigo_seguranca TEXT',e5b=>{ if(e5b && !String(e5b.message).includes('duplicate column')) console.warn('Migração codigo_seguranca:',e5b.message); });
              prosseguir();
            });
          }else prosseguir();
        });
      });
      if(oldTable && !newTable){
        db.run('ALTER TABLE usuarios RENAME TO leitores',e=>{
          if(e) throw e;
          console.log('Tabela usuarios renomeada para leitores.');
          continuar();
        });
      }else continuar();
    });
  });
});
async function garantirColunaTokenEmprestimo(){const cols=await all('PRAGMA table_info(emprestimos)');if(!cols.some(c=>c.name==='codigo_seguranca')){await run('ALTER TABLE emprestimos ADD COLUMN codigo_seguranca TEXT');}}
setInterval(()=>{processarPrazos().catch(e=>console.warn('Falha ao processar prazos:',e.message));processarReservas().catch(e=>console.warn('Falha ao processar reservas:',e.message));},60*60*1000);
app.get('/api/health',async(req,res)=>res.json({ok:true,banco:'SQLite',usuarios:(await get("SELECT COUNT(*) total FROM leitores WHERE tipo IN ('aluno','professor')")).total,leitores:(await get("SELECT COUNT(*) total FROM leitores WHERE tipo IN ('aluno','professor')")).total}));
app.post('/api/auth/login',async(req,res)=>{try{const em=email(req.body.email);let u=null;if(!emailValido(em))return res.status(401).json({erro:'Informe um e-mail válido.'});u=await get("SELECT * FROM leitores WHERE LOWER(email)=? OR LOWER(email_alternativo)=? LIMIT 1",[em,em]);if(!u||!(await verifyPassword(String(req.body.senha||''),u.senha_hash)))return res.status(401).json({erro:'E-mail ou senha inválidos.'});if(u.status==='pendente')return res.status(403).json({erro:'Seu cadastro está aguardando aprovação da Gestão da biblioteca.'});if(u.status!=='ativo')return res.status(403).json({erro:'Esta conta está desativada. Procure a Gestão da biblioteca.',codigo:'CONTA_DESATIVADA'});if(req.body.tipo&&u.tipo!==req.body.tipo)return res.status(401).json({erro:'Tipo de usuário não corresponde.'});const ultimoAcessoAnterior=u.ultimo_acesso||null;try{await run("UPDATE leitores SET ultimo_acesso=CURRENT_TIMESTAMP WHERE id=?",[u.id])}catch(_){}res.json({mensagem:'Login realizado.',token:token(u),usuario:await perfil(u),ultimo_acesso_anterior:ultimoAcessoAnterior})}catch(e){res.status(500).json({erro:e.message})}});
app.get('/api/auth/me',auth,async(req,res)=>{const u=await get('SELECT * FROM leitores WHERE id=?',[req.usuario.id]);res.json({usuario:await perfil(u)})});
app.put('/api/auth/me',auth,async(req,res)=>{try{const nome=String(req.body.nome||'').trim(),em=email(req.body.email),telefone=String(req.body.telefone||'').trim()||null;if(!nome)return res.status(400).json({erro:'Nome é obrigatório.'});if(!emailValido(em))return res.status(400).json({erro:'E-mail inválido.'});const uAtual=await get('SELECT * FROM leitores WHERE id=?',[req.usuario.id]);if(!uAtual)return res.status(404).json({erro:'Usuário não encontrado.'});const p=await perfil(uAtual);const regra=politicaEmail(em,uAtual.tipo,p.perfil?.ra,p.perfil?.ra_digito);if(!regra.ok)return res.status(400).json({erro:regra.erro});const outro=await get('SELECT id FROM leitores WHERE (LOWER(email)=? OR LOWER(email_alternativo)=?) AND id<>?',[em,em,req.usuario.id]);if(outro)return res.status(409).json({erro:'Este e-mail já está cadastrado.'});let alt=uAtual.email_alternativo||null;if(uAtual.tipo==='professor'&&req.body.email_alternativo!==undefined){const a=validarEmailAlternativo(req.body.email_alternativo,em);if(!a.ok)return res.status(400).json({erro:a.erro});alt=a.valor;if(alt){const o2=await get('SELECT id FROM leitores WHERE (LOWER(email)=? OR LOWER(email_alternativo)=?) AND id<>?',[alt,alt,req.usuario.id]);if(o2)return res.status(409).json({erro:'O segundo e-mail já está cadastrado em outra conta.'})}}await run('UPDATE leitores SET nome=?,email=?,email_alternativo=?,telefone=? WHERE id=?',[nome,em,alt,req.body.telefone===undefined?uAtual.telefone:telefone,req.usuario.id]);const u=await get('SELECT * FROM leitores WHERE id=?',[req.usuario.id]);res.json({usuario:await perfil(u)})}catch(e){res.status(400).json({erro:e.message})}});
app.put('/api/auth/me/senha',auth,async(req,res)=>{try{const atual=String(req.body.senha_atual||''),nova=String(req.body.nova_senha||'');const u=await get('SELECT senha_hash FROM leitores WHERE id=?',[req.usuario.id]);if(!u||!(await verifyPassword(atual,u.senha_hash)))return res.status(400).json({erro:'Senha atual incorreta.'});if(!senhaValida(nova))return res.status(400).json({erro:'A nova senha precisa ter 8 caracteres, maiúscula, minúscula, número e símbolo.'});await run('UPDATE leitores SET senha_hash=? WHERE id=?',[scryptHash(nova),req.usuario.id]);res.json({ok:true})}catch(e){res.status(400).json({erro:e.message})}});
app.post('/api/auth/esqueci-senha',async(req,res)=>{
  try{
    const identificador=String(req.body.identificador||req.body.email||'').trim();
    const nome=String(req.body.nome||'').trim();
    if(!identificador) return res.status(400).json({erro:'Informe seu e-mail, RA ou matrícula.'});
    if(nome.length<3 || !nome.includes(' ')) return res.status(400).json({erro:'Informe seu nome completo.'});

    const em=email(identificador);
    let u=null;
    if(emailValido(em)){
      u=await get("SELECT * FROM leitores WHERE status='ativo' AND (LOWER(email)=? OR LOWER(email_alternativo)=?) LIMIT 1",[em,em]);
    } else if(/^\d+$/.test(identificador)){
      const valor=identificador.replace(/^0+(?=\d)/,'');
      u=await get(`SELECT l.* FROM leitores l INNER JOIN alunos a ON a.usuario_id=l.id
                   WHERE l.status='ativo' AND (a.ra=? OR CASE WHEN ltrim(a.ra,'0')='' THEN '0' ELSE ltrim(a.ra,'0') END=?)
                   LIMIT 1`,[identificador,valor]);
      if(!u){
        u=await get(`SELECT l.* FROM leitores l INNER JOIN professores p ON p.usuario_id=l.id
                     WHERE l.status='ativo' AND p.matricula=? LIMIT 1`,[identificador]);
      }
    } else {
      u=await get(`SELECT l.* FROM leitores l INNER JOIN professores p ON p.usuario_id=l.id
                   WHERE l.status='ativo' AND LOWER(COALESCE(p.matricula,''))=LOWER(?) LIMIT 1`,[identificador]);
    }

    if(!u || String(u.nome||'').trim().toLocaleLowerCase('pt-BR') !== nome.toLocaleLowerCase('pt-BR')){
      return res.status(400).json({erro:'Os dados informados não conferem com um usuário ativo.'});
    }
    if(!emailValido(u.email)) return res.status(400).json({erro:'Este usuário não possui um e-mail válido cadastrado para recuperação.'});

    // Aluno/professor usa a conta de e-mail separada (SMTP_USER_ALUNOS), se
    // configurada; Gestão continua usando a conta principal.
    const conta=u.tipo==='gestao' ? 'gestao' : 'usuarios';
    if(!smtpConfigurado(conta)) return res.status(503).json({erro:'O envio de e-mail ainda não está configurado no BiblioBeta.'});

    // Código de exatamente 6 números, armazenado somente como hash e válido por 15 minutos.
    const codigoRecuperacao=String(crypto.randomInt(100000,1000000));
    const codigoHash=crypto.createHash('sha256').update(codigoRecuperacao).digest('hex');
    await run("UPDATE recuperacao_senha SET usado=1 WHERE usuario_id=? AND usado=0",[u.id]);
    const rec=await run("INSERT INTO recuperacao_senha(usuario_id,codigo_hash,expira_em) VALUES(?,?,datetime('now','+15 minutes'))",[u.id,codigoHash]);

    // Professor pode ter dois e-mails (pessoal + institucional): enviamos para os dois.
    // Basta UM chegar para a recuperação funcionar (o institucional às vezes é barrado pela escola).
    const destinos=destinosEmail(u);
    const enviados=[]; let ultimoErroEnvio=null;
    for(const to of destinos){
      try{ await enviarEmailSMTP({to,codigo:codigoRecuperacao,minutos:15,conta}); enviados.push(to); }
      catch(emailError){ ultimoErroEnvio=emailError; console.error('Erro ao enviar e-mail de recuperação para '+to+':',emailError.message); }
    }
    if(!enviados.length){
      await run("UPDATE recuperacao_senha SET usado=1 WHERE id=?",[rec.id]);
      return res.status(502).json({erro:'Não foi possível enviar o e-mail de recuperação. Verifique a configuração do Gmail SMTP no servidor.'});
    }

    const mascarar=d=>String(d).replace(/^(.{2}).*(@.*)$/,'$1••••$2');
    const mascarado=enviados.map(mascarar).join(' e ');
    return res.json({
      mensagem:'Código de recuperação enviado por e-mail.',
      email_destino:mascarado,
      expira_em_minutos:15
    });
  }catch(e){
    console.error('Erro em /api/auth/esqueci-senha:',e);
    return res.status(500).json({erro:'Não foi possível iniciar a recuperação de senha.'})
  }
});

app.post('/api/auth/resetar-senha',async(req,res)=>{
  try{
    const identificador=String(req.body.identificador||req.body.email||'').trim();
    const codigo=String(req.body.codigo||'').replace(/\D/g,'');
    const novaSenha=String(req.body.nova_senha||'');
    if(!identificador) return res.status(400).json({erro:'Identificador da recuperação não informado.'});
    if(codigo.length!==6) return res.status(400).json({erro:'Informe o código de recuperação de 6 números.'});
    if(!senhaValida(novaSenha)) return res.status(400).json({erro:'A nova senha deve ter no mínimo 8 caracteres, incluindo maiúscula, minúscula, número e símbolo.'});

    const em=email(identificador);
    let u=null;
    if(emailValido(em)){
      u=await get("SELECT * FROM leitores WHERE status='ativo' AND (LOWER(email)=? OR LOWER(email_alternativo)=?) LIMIT 1",[em,em]);
    } else if(/^\d+$/.test(identificador)){
      const valor=identificador.replace(/^0+(?=\d)/,'');
      u=await get(`SELECT l.* FROM leitores l INNER JOIN alunos a ON a.usuario_id=l.id
                   WHERE l.status='ativo' AND (a.ra=? OR CASE WHEN ltrim(a.ra,'0')='' THEN '0' ELSE ltrim(a.ra,'0') END=?)
                   LIMIT 1`,[identificador,valor]);
      if(!u) u=await get(`SELECT l.* FROM leitores l INNER JOIN professores p ON p.usuario_id=l.id
                          WHERE l.status='ativo' AND p.matricula=? LIMIT 1`,[identificador]);
    } else {
      u=await get(`SELECT l.* FROM leitores l INNER JOIN professores p ON p.usuario_id=l.id
                   WHERE l.status='ativo' AND LOWER(COALESCE(p.matricula,''))=LOWER(?) LIMIT 1`,[identificador]);
    }

    if(!u) return res.status(400).json({erro:'Código de recuperação inválido ou expirado.'});
    const hash=crypto.createHash('sha256').update(codigo).digest('hex');
    const rec=await get("SELECT id FROM recuperacao_senha WHERE usuario_id=? AND codigo_hash=? AND usado=0 AND expira_em>datetime('now') ORDER BY id DESC LIMIT 1",[u.id,hash]);
    if(!rec) return res.status(400).json({erro:'Código de recuperação inválido ou expirado.'});

    await run('UPDATE leitores SET senha_hash=? WHERE id=?',[scryptHash(novaSenha),u.id]);
    await run('UPDATE recuperacao_senha SET usado=1 WHERE id=?',[rec.id]);
    return res.json({mensagem:'Senha redefinida com sucesso. Agora você já pode entrar.'});
  }catch(e){return res.status(500).json({erro:'Não foi possível redefinir a senha.'})}
});

app.post('/api/contato',async(req,res)=>{
  try{
    const nome=String(req.body.nome||'').trim(), em=email(req.body.email), mensagem=String(req.body.mensagem||'').trim();
    if(!nome||!emailValido(em)||!mensagem)return res.status(400).json({erro:'Preencha nome, e-mail e mensagem.'});
    if(nome.length>100)return res.status(400).json({erro:'O nome pode ter no máximo 100 caracteres.'});
    if(em.length>254)return res.status(400).json({erro:'O e-mail pode ter no máximo 254 caracteres.'});
    if(mensagem.length>1000)return res.status(400).json({erro:'A mensagem pode ter no máximo 1000 caracteres.'});
    const r=await run('INSERT INTO contatos(nome,email,mensagem) VALUES(?,?,?)',[nome,em,mensagem]);
    const gestoes=await all("SELECT id FROM leitores WHERE tipo='gestao' AND status='ativo'");
    for(const g of gestoes) await registrarNotificacao(g.id,'Nova mensagem de contato',`${nome} enviou uma mensagem pelo site: ${mensagem.slice(0,180)}`,'contato',{assunto:'BiblioBeta — nova mensagem de contato',detalhes:[{label:'Nome',valor:nome},{label:'E-mail',valor:em||'Não informado'}]});
    res.status(201).json({ok:true,id:r.id,mensagem:'Mensagem recebida com sucesso.'});
  }catch(e){res.status(500).json({erro:e.message})}
});

app.post('/api/cadastro',async(req,res)=>{
  const {nome,telefone,senha,tipo}=req.body; const em=email(req.body.email);
  const raBase=String(req.body.ra||'').trim(); const raDig=String(req.body.ra_digito||'').trim().toUpperCase();
  // O RA aceita quantidade variável de números e pode ter zeros à esquerda.
  // Exemplos: 0000, 000, 1234, 123. O dígito, quando usado, é separado e tem 1 número.
  const ra=raBase; const turmaInformada=String(req.body.turma||'').trim(); const etapa=String(req.body.etapa||'').trim()||null;
  if(tipo==='aluno' && (!/^(?:\d{9}|\d{12}|\d{13})$/.test(ra) || !/^$|^[0-9A-Z]$/.test(raDig))) return res.status(400).json({erro:'RA inválido. Use exatamente 9, 12 ou 13 números. O dígito deve ter apenas 1 caractere (número ou letra).'});
  if(!['aluno','professor','gestao'].includes(tipo)) return res.status(400).json({erro:'Tipo de cadastro inválido.'});
  if(!String(nome||'').trim() || String(nome).trim().length<3 || !String(nome).trim().includes(' ')) return res.status(400).json({erro:'Informe o nome completo.'});
  const emailCheck=politicaEmail(em,tipo,ra,raDig);
  if(!emailCheck.ok) return res.status(400).json({erro:emailCheck.erro});
  // Professor: segundo e-mail opcional (institucional ou Gmail pessoal), usado também para receber avisos.
  let emailAlt=null;
  if(tipo==='professor'){
    const alt=validarEmailAlternativo(req.body.email_institucional??req.body.email_alternativo,em);
    if(!alt.ok) return res.status(400).json({erro:alt.erro});
    emailAlt=alt.valor;
    if(emailAlt){ const usado=await get('SELECT id FROM leitores WHERE LOWER(email)=? OR LOWER(email_alternativo)=?',[emailAlt,emailAlt]); if(usado) return res.status(409).json({erro:'O segundo e-mail já está cadastrado em outra conta.'}); }
  }
  { const usado=await get('SELECT id FROM leitores WHERE LOWER(email_alternativo)=?',[em]); if(usado) return res.status(409).json({erro:'Este e-mail já está cadastrado.'}); }
  if(!senhaValida(senha)) return res.status(400).json({erro:'A senha deve ter no mínimo 8 caracteres, incluindo maiúscula, minúscula, número e símbolo.'});
  if(Object.prototype.hasOwnProperty.call(req.body,'confirmar_senha') && String(req.body.confirmar_senha)!==String(senha)) return res.status(400).json({erro:'As senhas não coincidem.'});
  if(tipo==='aluno'&&(!ra||!turmaInformada||!etapa)) return res.status(400).json({erro:'RA, etapa de ensino, ano e turma são obrigatórios.'});
  if(tipo==='aluno' && !['fundamental','medio'].includes(etapa)) return res.status(400).json({erro:'Etapa de ensino inválida.'});
  if(tipo==='aluno' && ((etapa==='fundamental' && !/^([1-9])$/.test(String(req.body.serie||''))) || (etapa==='medio' && !/^[1-3]$/.test(String(req.body.serie||''))))) return res.status(400).json({erro:'Ano inválido para a etapa de ensino selecionada.'});
  let serie=String(req.body.serie||'').trim()||null, turma=turmaInformada||null;
  if(tipo==='aluno'){
    const raNorm=normalizarRA(ra), existente=await get("SELECT id FROM alunos WHERE CASE WHEN ltrim(ra,'0')='' THEN '0' ELSE ltrim(ra,'0') END=?",[raNorm]);
    if(existente) return res.status(409).json({erro:'Este RA já está cadastrado.'});
  }
  if(tipo==='aluno'&&!serie&&turma){ const m=turma.match(/^(.+?)\s*[-–—/]?\s*(?:turma\s*)?([A-Za-z0-9]+)$/i); if(m&&m[1].trim().match(/ano|º|°|serie|série/i)){serie=m[1].trim();turma=m[2].trim().toUpperCase();} }
  try {
    await run('BEGIN TRANSACTION');
    const h=await bcrypt.hash(String(senha),10);
    // Todos os cadastros de aluno/professor ficam ativos imediatamente. A Gestão apenas acompanha os novos cadastros.
    const statusInicial=tipo==='gestao'?'pendente':'ativo';
    const r=await run('INSERT INTO leitores(nome,email,email_alternativo,telefone,senha_hash,tipo,status) VALUES(?,?,?,?,?,?,?)',[String(nome).trim(),em,emailAlt,telefone||null,h,tipo,statusInicial]);
    if(tipo==='aluno') await run('INSERT INTO alunos(usuario_id,ra,ra_digito,etapa,serie,turma,numero_chamada) VALUES(?,?,?,?,?,?,?)',[r.id,ra,raDig||null,etapa,serie,turma,req.body.numero_chamada||null]);
    if(tipo==='professor') await run('INSERT INTO professores(usuario_id,matricula,disciplina) VALUES(?,?,?)',[r.id,null,null]);
    if(tipo==='gestao') await run('INSERT INTO gestao(usuario_id,cargo,nivel_acesso) VALUES(?,?,?)',[r.id,null,'bibliotecario']);
    await run('COMMIT');
    await run('INSERT OR IGNORE INTO preferencias_notificacao(usuario_id) VALUES(?)',[r.id]);
    try{await run('UPDATE leitores SET ultimo_acesso=CURRENT_TIMESTAMP WHERE id=?',[r.id])}catch(_){}
    const u=await get('SELECT * FROM leitores WHERE id=?',[r.id]);
    if(tipo==='gestao'){
      // Conta de Gestão nunca entra sozinha: um administrador precisa aprovar.
      const admins=await all("SELECT l.id FROM leitores l JOIN gestao g ON g.usuario_id=l.id WHERE l.tipo='gestao' AND l.status='ativo' AND COALESCE(g.nivel_acesso,'gestao')<>'bibliotecario'");
      for(const a of admins) await registrarNotificacao(a.id,'Novo pedido de acesso à Gestão',`${String(nome).trim()} (${em}) pediu acesso à Gestão. Aprove ou recuse em Configurações > Equipe da Gestão.`,'cadastro',{assunto:'BiblioBeta — pedido de acesso à Gestão',detalhes:[{label:'Nome',valor:String(nome).trim()},{label:'E-mail',valor:em}]});
      return res.status(202).json({pendente:true,mensagem:'Cadastro enviado! Um administrador da Gestão precisa aprovar o seu acesso antes do primeiro login.'});
    }
    // Aviso para a Gestão: o cadastro foi concluído e a conta já está ativa.
    const gestoes=await all("SELECT id FROM leitores WHERE tipo='gestao' AND status='ativo'");
    for(const g of gestoes){
      await registrarNotificacao(g.id,'Novo cadastro realizado',
        `${String(nome).trim()} acabou de se cadastrar como ${tipo==='aluno'?'aluno':'professor'}. O acesso já está ativo. Veja os dados em Novos cadastros.`,
        'cadastro',
        {assunto:'BiblioBeta — novo cadastro realizado',
         detalhes:[
           {label:'Nome',valor:String(nome).trim()},
           {label:'Tipo',valor:tipo==='aluno'?'Aluno':'Professor'},
           {label:'E-mail',valor:em},
           ...(emailAlt?[{label:'2º e-mail',valor:emailAlt}]:[]),
           {label:'Status',valor:'Ativo'}
         ]});
    }
    const tipoNome = tipo==='professor' ? 'professor' : tipo==='aluno' ? 'aluno' : 'usuário';
    const tituloBoasVindas = tipo==='professor' ? '👋 Bem-vindo(a), professor(a)!' : tipo==='aluno' ? '👋 Bem-vindo(a), aluno(a)!' : '👋 Bem-vindo(a) ao BiblioBeta!';
    const mensagemBoasVindas = tipo==='professor'
      ? 'Sua conta de professor foi criada com sucesso. Agora você pode acessar o catálogo, consultar livros, acompanhar seus empréstimos e receber avisos da biblioteca pelo BiblioBeta.'
      : tipo==='aluno'
        ? 'Sua conta de aluno foi criada com sucesso. Agora você pode acessar o catálogo, solicitar livros, acompanhar seus empréstimos e receber avisos da biblioteca pelo BiblioBeta.'
        : 'Sua conta foi criada com sucesso e está pronta para uso.';
    await registrarNotificacao(r.id,tituloBoasVindas,mensagemBoasVindas,'info',{categoria:'boas_vindas',assunto:`BiblioBeta — Bem-vindo(a), ${tipoNome}!`,detalhes:[{label:'Tipo de acesso',valor:tipoNome.charAt(0).toUpperCase()+tipoNome.slice(1)},{label:'Status',valor:'Conta ativa'}]});
    return res.status(201).json({mensagem:'Cadastro realizado com sucesso.',token:token(u),usuario:await perfil(u)});
  } catch(e) {
    try{await run('ROLLBACK')}catch(_){}
    if(String(e.message).includes('leitores.email')||String(e.message).includes('idx_leitores_email_alt')) return res.status(409).json({erro:'Este e-mail já está cadastrado.'});
    if(String(e.message).includes('alunos.ra')) return res.status(409).json({erro:'Este RA já está cadastrado.'});
    return res.status(400).json({erro:'Não foi possível concluir o cadastro: '+e.message});
  }
});
app.get('/api/categorias',auth,async(req,res)=>res.json(await all('SELECT * FROM categorias ORDER BY nome'))); app.post('/api/categorias',auth,only('gestao'),async(req,res)=>{const r=await run('INSERT INTO categorias(nome,descricao) VALUES(?,?)',[req.body.nome,req.body.descricao||null]);res.status(201).json(await get('SELECT * FROM categorias WHERE id=?',[r.id]))});
function normalizarISBN(v){ return String(v||'').toUpperCase().replace(/[^0-9X]/g,''); }
function isbnValido(v){
  const isbn=normalizarISBN(v);
  if(/^\d{13}$/.test(isbn)){
    let soma=0; for(let i=0;i<13;i++) soma+=Number(isbn[i])*(i%2?3:1);
    return soma%10===0;
  }
  if(/^\d{9}X$/.test(isbn)||/^\d{10}$/.test(isbn)){
    let soma=0; for(let i=0;i<10;i++) soma+=(isbn[i]==='X'?10:Number(isbn[i]))*(10-i);
    return soma%11===0;
  }
  return false;
}
function livroSelect(){return `SELECT l.*,c.nome categoria,(SELECT COUNT(*) FROM exemplares e WHERE e.livro_id=l.id) quantidade,(SELECT COUNT(*) FROM exemplares e WHERE e.livro_id=l.id AND e.status='disponivel') disponiveis FROM livros l LEFT JOIN categorias c ON c.id=l.categoria_id WHERE l.ativo=1`}
// Anexa a cada livro a lista de gêneros: [{id,nome,icone,cor}].
async function comGeneros(entrada){
  const unico=!Array.isArray(entrada); const lista=unico?(entrada?[entrada]:[]):entrada;
  if(!lista.length) return entrada;
  const ids=lista.map(l=>Number(l.id)).filter(Boolean);
  const mapa=new Map();
  if(ids.length){
    const linhas=await all(`SELECT lg.livro_id,g.id,g.nome,g.icone,g.cor FROM livro_generos lg JOIN generos g ON g.id=lg.genero_id WHERE lg.livro_id IN (${ids.map(()=>'?').join(',')}) ORDER BY g.ordem,g.nome`,ids);
    for(const r of linhas){ if(!mapa.has(r.livro_id)) mapa.set(r.livro_id,[]); mapa.get(r.livro_id).push({id:r.id,nome:r.nome,icone:r.icone,cor:r.cor}); }
  }
  for(const l of lista) l.generos=mapa.get(l.id)||[];
  return entrada;
}
// Troca os gêneros de um livro. Aceita ids (número) ou nomes (texto).
async function salvarGeneros(livroId,entradas){
  if(!Array.isArray(entradas)) return;
  const ids=new Set();
  for(const e of entradas){
    const g=typeof e==='object'&&e!==null?(e.id??e.nome):e;
    const linha=Number.isInteger(Number(g))&&String(g).trim()!==''?await get('SELECT id FROM generos WHERE id=?',[Number(g)]):await get('SELECT id FROM generos WHERE lower(nome)=lower(?)',[String(g||'').trim()]);
    if(linha) ids.add(linha.id);
  }
  await run('DELETE FROM livro_generos WHERE livro_id=?',[livroId]);
  for(const gid of ids) await run('INSERT OR IGNORE INTO livro_generos(livro_id,genero_id) VALUES(?,?)',[livroId,gid]);
}
// Pergunta às APIs de ISBN em quais gêneros o livro se encaixa.
async function sugerirGeneros(isbn,dados){
  const textos=[].concat(dados?.categorias||[],dados?.categoria||[]);
  let nomes=mapearGeneros(textos);
  if(!nomes.length && isbn){
    const g=await consultarGoogleBooks(isbn); if(g) nomes=mapearGeneros([].concat(g.categorias||[],g.categoria||[]));
    if(!nomes.length){ const o=await consultarOpenLibrary(isbn); if(o) nomes=mapearGeneros(o.categorias||[]); }
  }
  if(!nomes.length) return [];
  const todos=await all('SELECT id,nome,icone,cor FROM generos');
  return nomes.map(n=>todos.find(g=>g.nome===n)).filter(Boolean);
}
app.get('/api/livros',auth,async(req,res)=>{try{const q='%'+String(req.query.busca||'').trim()+'%';const g=String(req.query.genero||'').trim();const params=[q,q,q,q];let extra='';if(g){extra=' AND l.id IN (SELECT lg.livro_id FROM livro_generos lg JOIN generos ge ON ge.id=lg.genero_id WHERE ge.id=? OR lower(ge.nome)=lower(?))';params.push(Number(g)||0,g)}res.json(await comGeneros(await all(`${livroSelect()} AND (l.titulo LIKE ? OR l.autor LIKE ? OR l.isbn LIKE ? OR l.id IN (SELECT lg2.livro_id FROM livro_generos lg2 JOIN generos g2 ON g2.id=lg2.genero_id WHERE g2.nome LIKE ?))${extra} ORDER BY l.titulo`,params)))}catch(e){res.status(500).json({erro:e.message})}});
// ---- Gêneros ----
app.get('/api/generos',auth,async(req,res)=>{try{res.json(await all(`SELECT g.id,g.nome,g.icone,g.cor,g.descricao,g.ordem,(SELECT COUNT(*) FROM livro_generos lg JOIN livros l ON l.id=lg.livro_id AND l.ativo=1 WHERE lg.genero_id=g.id) total FROM generos g ORDER BY g.ordem,g.nome`))}catch(e){res.status(500).json({erro:e.message})}});
app.post('/api/generos',auth,only('gestao'),async(req,res)=>{try{const nome=String(req.body.nome||'').trim();if(!nome)return res.status(400).json({erro:'Informe o nome do gênero.'});const ordem=((await get('SELECT COALESCE(MAX(ordem),0) m FROM generos')).m||0)+1;const r=await run('INSERT INTO generos(nome,icone,cor,descricao,ordem) VALUES(?,?,?,?,?)',[nome,String(req.body.icone||'📘').trim()||'📘',/^#[0-9a-f]{6}$/i.test(req.body.cor||'')?req.body.cor:'#475569',String(req.body.descricao||'').trim()||null,ordem]);res.status(201).json(await get('SELECT * FROM generos WHERE id=?',[r.id]))}catch(e){res.status(String(e.message).includes('UNIQUE')?409:400).json({erro:String(e.message).includes('UNIQUE')?'Já existe um gênero com esse nome.':e.message})}});
app.put('/api/generos/:id',auth,only('gestao'),async(req,res)=>{try{const g=await get('SELECT * FROM generos WHERE id=?',[req.params.id]);if(!g)return res.status(404).json({erro:'Gênero não encontrado.'});const nome=String(req.body.nome||g.nome).trim();if(!nome)return res.status(400).json({erro:'Informe o nome do gênero.'});await run('UPDATE generos SET nome=?,icone=?,cor=?,descricao=? WHERE id=?',[nome,String(req.body.icone||g.icone||'📘').trim(),/^#[0-9a-f]{6}$/i.test(req.body.cor||'')?req.body.cor:g.cor,req.body.descricao===undefined?g.descricao:(String(req.body.descricao).trim()||null),g.id]);res.json(await get('SELECT * FROM generos WHERE id=?',[g.id]))}catch(e){res.status(String(e.message).includes('UNIQUE')?409:400).json({erro:String(e.message).includes('UNIQUE')?'Já existe um gênero com esse nome.':e.message})}});
app.delete('/api/generos/:id',auth,only('gestao'),async(req,res)=>{try{const r=await run('DELETE FROM generos WHERE id=?',[req.params.id]);if(!r.changes)return res.status(404).json({erro:'Gênero não encontrado.'});res.json({ok:true})}catch(e){res.status(400).json({erro:e.message})}});
// Busca o gênero do livro nas APIs de ISBN (Google Books / Open Library / BrasilAPI) e grava.
async function detectarGenerosDoLivro(l,{substituir=false}={}){
  if(!l.isbn) return {livro_id:l.id,titulo:l.titulo,generos:[],motivo:'Livro sem ISBN.'};
  const base=await consultarISBNBrasilAPI(l.isbn)||await consultarGoogleBooks(l.isbn)||await consultarOpenLibrary(l.isbn);
  const sugeridos=await sugerirGeneros(l.isbn,base||{});
  if(!sugeridos.length) return {livro_id:l.id,titulo:l.titulo,generos:[],motivo:'As APIs não informaram o gênero deste livro.'};
  const atuais=substituir?[]:(await all('SELECT genero_id FROM livro_generos WHERE livro_id=?',[l.id])).map(x=>x.genero_id);
  await salvarGeneros(l.id,[...new Set([...atuais,...sugeridos.map(g=>g.id)])]);
  return {livro_id:l.id,titulo:l.titulo,generos:sugeridos.map(g=>g.nome)};
}
app.post('/api/livros/:id/detectar-generos',auth,only('gestao'),async(req,res)=>{try{const l=await get('SELECT id,titulo,isbn FROM livros WHERE id=?',[req.params.id]);if(!l)return res.status(404).json({erro:'Livro não encontrado.'});res.json(await detectarGenerosDoLivro(l,{substituir:!!req.body?.substituir}))}catch(e){res.status(500).json({erro:e.message})}});
app.post('/api/generos/detectar-todos',auth,only('gestao'),async(req,res)=>{try{const livros=await all('SELECT id,titulo,isbn FROM livros WHERE ativo=1 AND id NOT IN (SELECT livro_id FROM livro_generos)');const resultados=[];for(const l of livros) resultados.push(await detectarGenerosDoLivro(l));res.json({analisados:livros.length,com_genero:resultados.filter(r=>r.generos.length).length,resultados})}catch(e){res.status(500).json({erro:e.message})}});
async function fetchJsonComTimeout(url, timeoutMs=7000){
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(()=>controller.abort(), timeoutMs) : null;
  try {
    const resposta = await fetch(url, {
      headers: {'Accept':'application/json','User-Agent':'BiblioBeta/1.0'},
      signal: controller?.signal
    });
    let dados=null; try { dados=await resposta.json(); } catch(_) {}
    if(!resposta.ok) throw new Error('HTTP '+resposta.status);
    return dados;
  } finally { if(timer) clearTimeout(timer); }
}

async function consultarISBNBrasilAPI(isbn){
  try{
    const dados=await fetchJsonComTimeout('https://brasilapi.com.br/api/isbn/v1/'+encodeURIComponent(isbn));
    if(!dados || !dados.title) return null;
    return {
      isbn: normalizarISBN(dados.isbn||isbn),
      titulo: dados.title || '',
      autor: Array.isArray(dados.authors) ? dados.authors.join(', ') : String(dados.authors||''),
      editora: dados.publisher || '',
      ano_publicacao: Number(dados.year)||null,
      categoria: Array.isArray(dados.subjects) ? (dados.subjects[0]||'') : '',
      categorias: Array.isArray(dados.subjects) ? dados.subjects : [],
      descricao: dados.synopsis || '',
      capa: String(dados.cover_url||'').replace(/^http:/,'https:'),
      fonte: 'BrasilAPI'
    };
  }catch(e){ return null; }
}

async function consultarGoogleBooks(isbn){
  try{
    const dados=await fetchJsonComTimeout('https://www.googleapis.com/books/v1/volumes?q=isbn:'+encodeURIComponent(isbn)+'&maxResults=1');
    const info=dados?.items?.[0]?.volumeInfo;
    if(!info) return null;
    return {
      isbn, titulo:info.title||'', autor:(info.authors||[]).join(', '), editora:info.publisher||'',
      ano_publicacao:info.publishedDate?Number(String(info.publishedDate).slice(0,4))||null:null,
      categoria:(info.categories||[])[0]||'', categorias:info.categories||[], descricao:info.description||'',
      capa:(info.imageLinks?.thumbnail||info.imageLinks?.smallThumbnail||'').replace(/^http:/,'https:'),
      fonte:'Google Books'
    };
  }catch(e){ return null; }
}

async function consultarOpenLibrary(isbn){
  try{
    const dados=await fetchJsonComTimeout('https://openlibrary.org/search.json?isbn='+encodeURIComponent(isbn)+'&limit=1');
    const d=dados?.docs?.[0];
    if(!d) return null;
    const capa=d.cover_i ? 'https://covers.openlibrary.org/b/id/'+d.cover_i+'-M.jpg' : 'https://covers.openlibrary.org/b/isbn/'+isbn+'-M.jpg';
    return {
      isbn, titulo:d.title||'', autor:(d.author_name||[]).join(', '), editora:(d.publisher||[])[0]||'',
      ano_publicacao:Number(d.first_publish_year)||null, categoria:(d.subject||[])[0]||'', categorias:(d.subject||[]).slice(0,25), descricao:'', capa, fonte:'Open Library'
    };
  }catch(e){ return null; }
}

// Procura a capa separadamente. Isso é importante porque uma fonte pode
// encontrar todos os dados do livro, mas não disponibilizar a imagem da capa.
async function consultarCapaISBN(isbn){
  const google = await consultarGoogleBooks(isbn);
  if(google?.capa) return google.capa;
  try{
    const dados=await fetchJsonComTimeout('https://openlibrary.org/search.json?isbn='+encodeURIComponent(isbn)+'&limit=1');
    const d=dados?.docs?.[0];
    if(d?.cover_i) return 'https://covers.openlibrary.org/b/id/'+d.cover_i+'-M.jpg';
    // A URL por ISBN funciona para muitos títulos mesmo quando a busca não retorna cover_i.
    return 'https://covers.openlibrary.org/b/isbn/'+encodeURIComponent(isbn)+'-M.jpg';
  }catch(e){
    return 'https://covers.openlibrary.org/b/isbn/'+encodeURIComponent(isbn)+'-M.jpg';
  }
}


// Proxy de capas: o navegador pede a imagem à própria BiblioBeta e o servidor
// tenta fontes conhecidas. Isso evita capas quebradas por bloqueios/hotlink.
const CAPA_FONTES_FIXAS = {
  // Capa oficial encontrada no catálogo da Editora Record para este ISBN.
  '9786559816897': 'https://www.record.com.br/cdn/shop/files/626c6c82f1f28b5c1500b92510a1fe97_04b39ac1-48be-4dea-9eaf-2a74d5847050_1000x.jpg?v=1787704305'
};
async function buscarUrlCapaExterna(isbn){
  if(CAPA_FONTES_FIXAS[isbn]) return CAPA_FONTES_FIXAS[isbn];
  const google = await consultarGoogleBooks(isbn);
  if(google?.capa) return google.capa;
  try{
    const dados=await fetchJsonComTimeout('https://openlibrary.org/search.json?isbn='+encodeURIComponent(isbn)+'&limit=1');
    const d=dados?.docs?.[0];
    if(d?.cover_i) return 'https://covers.openlibrary.org/b/id/'+d.cover_i+'-L.jpg';
    return 'https://covers.openlibrary.org/b/isbn/'+encodeURIComponent(isbn)+'-L.jpg';
  }catch(e){ return 'https://covers.openlibrary.org/b/isbn/'+encodeURIComponent(isbn)+'-L.jpg'; }
}
// As capas enviadas ficam guardadas DENTRO do banco (tabela capas_arquivos) e também em
// uploads/capas. Assim, se alguém copiar/compactar só o banco (ou esquecer a pasta uploads),
// as capas continuam aparecendo. Se o arquivo sumir do disco, o servidor serve a cópia do banco.
const MIME_CAPA={'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.gif':'image/gif'};
async function importarCapasDoDisco(){
  try{
    for(const nome of fs.readdirSync(CAPAS_PATH)){
      const tipo=MIME_CAPA[path.extname(nome).toLowerCase()]; if(!tipo) continue;
      const ja=await get('SELECT nome FROM capas_arquivos WHERE nome=?',[nome]); if(ja) continue;
      const dados=fs.readFileSync(path.join(CAPAS_PATH,nome));
      await run('INSERT OR IGNORE INTO capas_arquivos(nome,tipo,dados) VALUES(?,?,?)',[nome,tipo,dados]);
    }
  }catch(e){ console.warn('Aviso: não foi possível importar as capas da pasta uploads:',e.message); }
}
const storage=multer.memoryStorage();
const uploadCapa=multer({
  storage,
  limits:{fileSize:5*1024*1024},
  fileFilter:(req,file,cb)=>{
    if(['image/jpeg','image/png','image/webp','image/gif'].includes(String(file.mimetype||'').toLowerCase())) cb(null,true);
    else cb(new Error('A capa deve ser JPG, PNG, WEBP ou GIF.'));
  }
});
app.post('/api/capas/upload',auth,only('gestao'),(req,res)=>{
  uploadCapa.single('capa')(req,res,err=>{
    if(err) return res.status(400).json({erro:err.code==='LIMIT_FILE_SIZE'?'A capa deve ter no máximo 5 MB.':err.message||'Não foi possível enviar a capa.'});
    if(!req.file) return res.status(400).json({erro:'Selecione uma imagem de capa.'});
    (async()=>{
      const tipo=String(req.file.mimetype||'').toLowerCase();
      const ext=({'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','image/gif':'.gif'})[tipo]||'.jpg';
      const nomeArq=crypto.randomBytes(16).toString('hex')+ext;
      await run('INSERT INTO capas_arquivos(nome,tipo,dados) VALUES(?,?,?)',[nomeArq,tipo,req.file.buffer]);
      try{ fs.writeFileSync(path.join(CAPAS_PATH,nomeArq),req.file.buffer); }catch(e){ console.warn('Aviso: capa salva só no banco:',e.message); }
      res.json({ok:true,url:'/uploads/capas/'+encodeURIComponent(nomeArq),nome:req.file.originalname,tamanho:req.file.size});
    })().catch(e=>res.status(500).json({erro:'Não foi possível salvar a capa: '+e.message}));
  });
});
// Chega aqui quando o arquivo não existe em uploads/capas (o express.static acima não achou).
app.get('/uploads/capas/:nome',async(req,res)=>{
  try{
    const nome=path.basename(String(req.params.nome||''));
    const r=await get('SELECT tipo,dados FROM capas_arquivos WHERE nome=?',[nome]);
    if(r){ res.set('Content-Type',r.tipo); res.set('Cache-Control','public, max-age=86400'); return res.send(r.dados); }
    // Capa enviada que se perdeu: tenta a capa automática pelo ISBN do livro.
    const l=await get("SELECT isbn FROM livros WHERE capa LIKE ? AND isbn IS NOT NULL LIMIT 1",['%/uploads/capas/'+nome]);
    if(l && l.isbn) return res.redirect(302,'/api/capas/isbn/'+encodeURIComponent(l.isbn));
    res.status(404).send('Capa não encontrada.');
  }catch(e){ res.status(500).send('Não foi possível carregar a capa.'); }
});

app.get('/api/capas/isbn/:isbn',async(req,res)=>{
  try{
    const isbn=normalizarISBN(req.params.isbn);
    if(!isbnValido(isbn)) return res.status(400).send('ISBN inválido');
    // Capa já baixada antes: usa a cópia do banco (funciona sem internet e acompanha o database.sqlite).
    const guardada=await get('SELECT tipo,dados FROM capas_cache WHERE isbn=?',[isbn]);
    if(guardada){ res.set('Content-Type',guardada.tipo); res.set('Cache-Control','public, max-age=86400'); return res.send(guardada.dados); }
    const candidatos=[];
    const livro=await get('SELECT capa FROM livros WHERE isbn=?',[isbn]);
    if(livro?.capa && /^https?:\/\//i.test(String(livro.capa)) && !String(livro.capa).includes('/api/capas/isbn/')) candidatos.push(String(livro.capa));
    if(CAPA_FONTES_FIXAS[isbn]) candidatos.push(CAPA_FONTES_FIXAS[isbn]);
    try { const google=await consultarGoogleBooks(isbn); if(google?.capa) candidatos.push(google.capa); } catch(_) {}
    try {
      const ol=await fetchJsonComTimeout('https://openlibrary.org/search.json?isbn='+encodeURIComponent(isbn)+'&limit=1');
      const d=ol?.docs?.[0];
      if(d?.cover_i) candidatos.push('https://covers.openlibrary.org/b/id/'+d.cover_i+'-L.jpg');
      candidatos.push('https://covers.openlibrary.org/b/isbn/'+encodeURIComponent(isbn)+'-L.jpg');
    } catch(_) {}
    const unicos=[...new Set(candidatos)];
    for(const url of unicos){
      try{
        const resposta=await fetch(url,{headers:{'User-Agent':'BiblioBeta/1.0','Accept':'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'}});
        if(!resposta.ok) continue;
        const tipo=(resposta.headers.get('content-type')||'image/jpeg').split(';')[0];
        if(!tipo.startsWith('image/')) continue;
        const bytes=Buffer.from(await resposta.arrayBuffer());
        if(bytes.length<1000) continue;
        if(bytes.length<=5*1024*1024){ try{ await run('INSERT OR REPLACE INTO capas_cache(isbn,tipo,dados) VALUES(?,?,?)',[isbn,tipo,bytes]); }catch(_){} }
        res.set('Content-Type',tipo);
        res.set('Cache-Control','public, max-age=86400');
        return res.send(bytes);
      }catch(_){}
    }
    // 1x1 transparente para não deixar ícone de imagem quebrada.
    const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
    res.set('Content-Type','image/png'); res.set('Cache-Control','public, max-age=300'); return res.send(pixel);
  }catch(e){ res.status(500).send('Não foi possível carregar a capa.'); }
});

app.get('/api/livros/isbn/:isbn',auth,only('gestao'),async(req,res)=>{
  try{
    const isbn=normalizarISBN(req.params.isbn);
    if(!isbnValido(isbn)) return res.status(400).json({erro:'ISBN inválido. Informe um ISBN-10 ou ISBN-13 válido.'});
    const existente=await get('SELECT id,titulo,autor,isbn FROM livros WHERE isbn=?',[isbn]);
    if(existente) return res.status(409).json({erro:'Este ISBN já está cadastrado.',livro:existente});

    // Para livros brasileiros, BrasilAPI é a primeira fonte. Se estiver indisponível,
    // usamos Google Books e depois Open Library como fallback.
    const dados = await consultarISBNBrasilAPI(isbn) || await consultarGoogleBooks(isbn) || await consultarOpenLibrary(isbn);
    if(!dados) return res.status(502).json({erro:'Não foi possível consultar os catálogos de ISBN agora. Verifique sua conexão com a internet e tente novamente.'});

    // Mesmo quando a fonte principal não traz capa, fazemos uma busca específica
    // para que o cadastro possa exibir a capa real do livro.
    if(!dados.capa) dados.capa = await consultarCapaISBN(isbn);
    try{ dados.generos_sugeridos = await sugerirGeneros(isbn,dados); }catch(_){ dados.generos_sugeridos = []; }
    res.json(dados);
  }catch(e){res.status(500).json({erro:'Erro ao consultar ISBN: '+e.message})}
});
app.post('/api/livros',auth,only('gestao'),async(req,res)=>{
  try{
    const b=req.body, isbn=normalizarISBN(b.isbn);
    if(!String(b.titulo||'').trim()||!String(b.autor||'').trim()) return res.status(400).json({erro:'Título e autor são obrigatórios.'});
    if(isbn && !isbnValido(isbn)) return res.status(400).json({erro:'ISBN inválido. Informe um ISBN-10 ou ISBN-13 válido.'});
    if(isbn){
      const existenteISBN=await get('SELECT id,titulo FROM livros WHERE isbn=? AND ativo=1',[isbn]);
      if(existenteISBN) return res.status(409).json({erro:'Este ISBN já está cadastrado. Use "Gerenciar exemplares" para adicionar outra cópia.',livro_existente_id:existenteISBN.id});
    }
    const tituloBusca=String(b.titulo).trim();
    const autorBusca=String(b.autor).trim();
    const existenteTitulo=await get('SELECT id,titulo FROM livros WHERE ativo=1 AND lower(trim(titulo))=lower(trim(?)) AND lower(trim(autor))=lower(trim(?)) LIMIT 1',[tituloBusca,autorBusca]);
    if(existenteTitulo) return res.status(409).json({erro:'Este livro já existe no catálogo. Use "Gerenciar exemplares" para adicionar outra cópia.',livro_existente_id:existenteTitulo.id});
    await run('BEGIN TRANSACTION');
    const r=await run('INSERT INTO livros(categoria_id,titulo,autor,editora,isbn,ano_publicacao,descricao,capa) VALUES(?,?,?,?,?,?,?,?)',[b.categoria_id||null,String(b.titulo).trim(),String(b.autor).trim(),b.editora||null,isbn||null,b.ano_publicacao||null,b.descricao||null,b.capa||null]);
    const quantidade=Math.max(1,Math.min(999,Number(b.quantidade)||1));
    for(let i=1;i<=quantidade;i++) await run('INSERT INTO exemplares(livro_id,localizacao_id,codigo,status) VALUES(?,?,?,\'disponivel\')',[r.id,null,`L${r.id}-${String(i).padStart(3,'0')}`]);
    if(Array.isArray(b.generos)) await salvarGeneros(r.id,b.generos);
    await run('COMMIT');

    // Notifica os leitores ativos sobre o novo livro.
    // A notificação aparece no BiblioBeta e também é enviada por e-mail
    // quando o Gmail SMTP estiver configurado.
    try{
      const leitoresAtivos=await all("SELECT id FROM leitores WHERE tipo IN ('aluno','professor') AND status='ativo'");
      for(const leitor of leitoresAtivos){
        await registrarNotificacao(
          leitor.id,
          `Novo livro no catálogo: ${tituloBusca}`,
          `Um novo livro foi adicionado ao catálogo: "${tituloBusca}", de ${autorBusca}. Já está disponível para consulta no BiblioBeta.`,
          'livro',
          {
            assunto:`BiblioBeta — novo livro no catálogo: ${tituloBusca}`,
            detalhes:[
              {label:'Livro',valor:tituloBusca},
              {label:'Autor',valor:autorBusca},
              {label:'Status',valor:'Disponível no catálogo'}
            ]
          }
        );
      }
    }catch(notificacaoError){
      console.error('Aviso: livro cadastrado, mas as notificações não puderam ser processadas:',notificacaoError.message);
    }

    res.status(201).json(await comGeneros(await get(`${livroSelect()} AND l.id=?`,[r.id])));
  }catch(e){try{await run('ROLLBACK')}catch(_){}; if(String(e.message).includes('UNIQUE')) return res.status(409).json({erro:'ISBN ou código de exemplar já cadastrado.'}); res.status(400).json({erro:e.message})}
});
app.put('/api/livros/:id',auth,only('gestao'),async(req,res)=>{try{const b=req.body,isbn=normalizarISBN(b.isbn);if(isbn&&!isbnValido(isbn))return res.status(400).json({erro:'ISBN inválido.'});const atual=await get('SELECT id,titulo,autor FROM livros WHERE id=?',[req.params.id]);if(!atual)return res.status(404).json({erro:'Livro não encontrado.'});const outro=isbn?await get('SELECT id FROM livros WHERE isbn=? AND id<>?',[isbn,req.params.id]):null;if(outro)return res.status(409).json({erro:'Este ISBN já está cadastrado em outro livro.'});await run('UPDATE livros SET categoria_id=?,titulo=?,autor=?,editora=?,isbn=?,ano_publicacao=?,descricao=?,capa=? WHERE id=?',[b.categoria_id||null,String(b.titulo||'').trim(),String(b.autor||'').trim(),b.editora||null,isbn||null,b.ano_publicacao||null,b.descricao||null,b.capa||null,req.params.id]);if(Array.isArray(b.generos))await salvarGeneros(req.params.id,b.generos);const leitores=await all("SELECT id FROM leitores WHERE tipo IN ('aluno','professor') AND status='ativo'");for(const leitor of leitores){await registrarNotificacao(leitor.id,`Livro atualizado no catálogo: ${String(b.titulo||atual.titulo).trim()}`,`O livro "${String(b.titulo||atual.titulo).trim()}" foi atualizado no catálogo do BiblioBeta.`, 'livro',{assunto:`BiblioBeta — livro atualizado: ${String(b.titulo||atual.titulo).trim()}`,detalhes:[{label:'Livro',valor:String(b.titulo||atual.titulo).trim()},{label:'Autor',valor:String(b.autor||atual.autor).trim()},{label:'Status',valor:'Atualizado no catálogo'}]});}res.json(await comGeneros(await get(`${livroSelect()} AND l.id=?`,[req.params.id])))}catch(e){res.status(400).json({erro:e.message})}});
app.delete('/api/livros/:id',auth,only('gestao'),async(req,res)=>{try{const l=await get('SELECT id,titulo,autor,ativo FROM livros WHERE id=?',[req.params.id]);if(!l)return res.status(404).json({erro:'Livro não encontrado.'});if(Number(l.ativo)===0)return res.status(400).json({erro:'Este livro já está desativado.'});await run('UPDATE livros SET ativo=0 WHERE id=?',[req.params.id]);const leitores=await all("SELECT id FROM leitores WHERE tipo IN ('aluno','professor') AND status='ativo'");for(const leitor of leitores){await registrarNotificacao(leitor.id,`Livro removido do catálogo: ${l.titulo}`,`O livro "${l.titulo}", de ${l.autor}, foi removido do catálogo ativo do BiblioBeta.`, 'livro',{assunto:`BiblioBeta — livro removido do catálogo: ${l.titulo}`,detalhes:[{label:'Livro',valor:l.titulo},{label:'Autor',valor:l.autor},{label:'Status',valor:'Removido do catálogo'}]});}res.json({ok:true,mensagem:'Livro desativado e os leitores ativos foram notificados por e-mail.'})}catch(e){res.status(400).json({erro:e.message})}});
app.get('/api/livros-desativados',auth,only('gestao'),async(req,res)=>{try{const q='%'+String(req.query.busca||'').trim()+'%';const lista=await all(`SELECT l.*,c.nome categoria,(SELECT COUNT(*) FROM exemplares e WHERE e.livro_id=l.id) quantidade FROM livros l LEFT JOIN categorias c ON c.id=l.categoria_id WHERE l.ativo=0 AND (l.titulo LIKE ? OR l.autor LIKE ? OR l.isbn LIKE ?) ORDER BY l.titulo`,[q,q,q]);res.json(lista)}catch(e){res.status(500).json({erro:e.message})}});
app.post('/api/livros/:id/reativar',auth,only('gestao'),async(req,res)=>{try{const l=await get('SELECT id,titulo,autor,ativo FROM livros WHERE id=?',[req.params.id]);if(!l)return res.status(404).json({erro:'Livro não encontrado.'});if(Number(l.ativo)===1)return res.status(400).json({erro:'Este livro já está ativo no catálogo.'});await run('UPDATE livros SET ativo=1 WHERE id=?',[req.params.id]);const disponiveis=Number((await get("SELECT COUNT(*) total FROM exemplares WHERE livro_id=? AND status='disponivel'",[l.id])).total||0);if(disponiveis>0){const leitores=await all("SELECT id FROM leitores WHERE tipo IN ('aluno','professor') AND status='ativo'");for(const leitor of leitores){await registrarNotificacao(leitor.id,`Livro novamente disponível: ${l.titulo}`,`O livro "${l.titulo}", de ${l.autor}, voltou ao catálogo e possui exemplar disponível para solicitação.`, 'livro',{assunto:`BiblioBeta — livro novamente disponível: ${l.titulo}`,detalhes:[{label:'Livro',valor:l.titulo},{label:'Autor',valor:l.autor},{label:'Status',valor:'Disponível no catálogo'}]});}}res.json({ok:true,livro:await get(`${livroSelect()} AND l.id=?`,[req.params.id]),mensagem:'Livro reativado e voltou ao catálogo.'})}catch(e){res.status(400).json({erro:e.message})}});
app.get('/api/livros/:id/exemplares',auth,async(req,res)=>res.json(await all('SELECT e.*,lo.nome localizacao FROM exemplares e LEFT JOIN localizacoes lo ON lo.id=e.localizacao_id WHERE livro_id=? ORDER BY e.codigo',[req.params.id])));
app.post('/api/livros/:id/exemplares',auth,only('gestao'),async(req,res)=>{
  try{
    const livro=await get('SELECT id,titulo,ativo FROM livros WHERE id=?',[req.params.id]);
    if(!livro||!livro.ativo)return res.status(404).json({erro:'Livro não encontrado no catálogo.'});
    let codigo=String(req.body.codigo||'').trim();
    if(!codigo){
      const qtd=await get('SELECT COUNT(*) total FROM exemplares WHERE livro_id=?',[req.params.id]);
      codigo=`L${req.params.id}-${String(Number(qtd.total)+1).padStart(3,'0')}`;
      let existe=await get('SELECT id FROM exemplares WHERE codigo=?',[codigo]);
      let n=Number(qtd.total)+1;
      while(existe){n++;codigo=`L${req.params.id}-${String(n).padStart(3,'0')}`;existe=await get('SELECT id FROM exemplares WHERE codigo=?',[codigo]);}
    }
    const r=await run('INSERT INTO exemplares(livro_id,localizacao_id,codigo,observacao) VALUES(?,NULL,?,?)',[req.params.id,codigo,String(req.body.observacao||'').trim()||null]);
    res.status(201).json(await get('SELECT e.*,lo.nome localizacao FROM exemplares e LEFT JOIN localizacoes lo ON lo.id=e.localizacao_id WHERE e.id=?',[r.id]));
  }catch(e){res.status(400).json({erro:String(e.message).includes('UNIQUE')?'Código de exemplar já cadastrado.':e.message})}
});
app.get('/api/exemplares',auth,only('gestao'),async(req,res)=>res.json(await all("SELECT e.*,l.titulo,lo.nome localizacao,ep.id emprestimo_id,u.nome usuario_emprestimo,ep.data_prevista_devolucao FROM exemplares e JOIN livros l ON l.id=e.livro_id LEFT JOIN localizacoes lo ON lo.id=e.localizacao_id LEFT JOIN emprestimos ep ON ep.exemplar_id=e.id AND ep.status IN ('ativo','atrasado') LEFT JOIN leitores u ON u.id=ep.usuario_id ORDER BY l.titulo,e.codigo")));
app.get('/api/localizacoes',auth,only('gestao'),async(req,res)=>res.json(await all('SELECT * FROM localizacoes ORDER BY nome')));
app.post('/api/localizacoes',auth,only('gestao'),async(req,res)=>{try{const nome=String(req.body.nome||'').trim();if(!nome)return res.status(400).json({erro:'Nome da localização é obrigatório.'});const r=await run('INSERT INTO localizacoes(nome,descricao) VALUES(?,?)',[nome,String(req.body.descricao||'').trim()||null]);res.status(201).json(await get('SELECT * FROM localizacoes WHERE id=?',[r.id]))}catch(e){res.status(400).json({erro:e.message})}});
app.put('/api/localizacoes/:id',auth,only('gestao'),async(req,res)=>{try{const nome=String(req.body.nome||'').trim();if(!nome)return res.status(400).json({erro:'Nome da localização é obrigatório.'});await run('UPDATE localizacoes SET nome=?,descricao=? WHERE id=?',[nome,String(req.body.descricao||'').trim()||null,req.params.id]);res.json(await get('SELECT * FROM localizacoes WHERE id=?',[req.params.id]))}catch(e){res.status(400).json({erro:e.message})}});
app.delete('/api/localizacoes/:id',auth,only('gestao'),async(req,res)=>{try{const usados=(await get('SELECT COUNT(*) total FROM exemplares WHERE localizacao_id=?',[req.params.id])).total;if(usados>0)return res.status(409).json({erro:'Localização possui exemplares vinculados. Mova os exemplares antes de excluir.'});await run('DELETE FROM localizacoes WHERE id=?',[req.params.id]);res.json({ok:true})}catch(e){res.status(400).json({erro:e.message})}});
app.get('/api/exemplares/disponiveis',auth,only('gestao'),async(req,res)=>res.json(await all(`SELECT e.id,e.codigo,e.status,l.id livro_id,l.titulo,l.autor,l.isbn FROM exemplares e JOIN livros l ON l.id=e.livro_id WHERE e.status='disponivel' AND l.ativo=1 ORDER BY l.titulo,e.codigo`)));
app.post('/api/emprestimos',auth,only('gestao'),async(req,res)=>{try{const {usuario_id,exemplar_id}=req.body;const e=await get("SELECT e.*,l.titulo FROM exemplares e JOIN livros l ON l.id=e.livro_id WHERE e.id=? AND e.status='disponivel'",[exemplar_id]);if(!e)return res.status(400).json({erro:'Exemplar indisponível.'});const u=await get("SELECT id,nome,email,tipo,status FROM leitores WHERE id=? AND tipo IN ('aluno','professor') AND status='ativo'",[usuario_id]);if(!u)return res.status(404).json({erro:'Leitor não encontrado ou inativo.'});const bloqueio=await bloqueioAtivo(usuario_id);if(bloqueio)return res.status(403).json({erro:bloqueio.fim_em?`Usuário possui uma penalidade ativa até ${new Date(bloqueio.fim_em).toLocaleDateString('pt-BR')}.`:'Usuário está bloqueado até regularizar o livro em atraso.'});const claim=await run("UPDATE exemplares SET status='emprestado' WHERE id=? AND status='disponivel'",[exemplar_id]);if(claim.changes!==1)return res.status(409).json({erro:'Este exemplar acabou de ser reservado por outra operação. Atualize a página e tente novamente.'});const cfg=await get('SELECT * FROM configuracoes WHERE id=1');const lim=u.tipo==='aluno'?cfg.limite_livros_aluno:cfg.limite_livros_professor;const at=(await get("SELECT COUNT(*) total FROM emprestimos WHERE usuario_id=? AND status IN ('ativo','atrasado')",[usuario_id])).total;if(at>=lim)return res.status(400).json({erro:`Limite de ${lim} empréstimo(s) atingido.`});const data=new Date(Date.now()+cfg.dias_emprestimo*86400000).toISOString();let codigoSeguranca=gerarTokenEmprestimo();while(await get('SELECT id FROM emprestimos WHERE codigo_seguranca=?',[codigoSeguranca])) codigoSeguranca=gerarTokenEmprestimo();let r;try{r=await run('INSERT INTO emprestimos(usuario_id,exemplar_id,data_prevista_devolucao,codigo_seguranca) VALUES(?,?,?,?)',[usuario_id,exemplar_id,data,codigoSeguranca]);}catch(err){await run("UPDATE exemplares SET status='disponivel' WHERE id=? AND status='emprestado'",[exemplar_id]);throw err;}await registrarNotificacao(usuario_id,`Empréstimo registrado: ${e.titulo}`,`O livro foi registrado em seu nome. A devolução está prevista para ${new Date(data).toLocaleDateString('pt-BR')}.`,'emprestimo',{assunto:`BiblioBeta — empréstimo registrado: ${e.titulo}`});
const gestores=await all("SELECT id FROM leitores WHERE tipo='gestao' AND status='ativo'"); for(const g of gestores) await registrarNotificacao(g.id,`Novo empréstimo: ${e.titulo}`,`${u.nome} recebeu o exemplar ${e.codigo}. A devolução está prevista para ${new Date(data).toLocaleDateString('pt-BR')}.`,'emprestimo',{detalhes:[{label:'Usuário',valor:u.nome},{label:'E-mail',valor:u.email},{label:'Exemplar',valor:e.codigo},{label:'Devolução prevista',valor:new Date(data).toLocaleDateString('pt-BR')}]});
res.status(201).json(await get(`SELECT ep.*,u.nome usuario,u.email,l.titulo,e.codigo FROM emprestimos ep JOIN leitores u ON u.id=ep.usuario_id JOIN exemplares e ON e.id=ep.exemplar_id JOIN livros l ON l.id=e.livro_id WHERE ep.id=?`,[r.id]))}catch(e){res.status(400).json({erro:e.message})}});
app.post('/api/emprestimos/:id/confirmar-retirada',auth,only('gestao'),async(req,res)=>{try{const codigo=String(req.body.codigo_retirada||'').trim();if(!/^\d{6}$/.test(codigo))return res.status(400).json({erro:'Informe o código de retirada com 6 números.'});const ep=await get(`SELECT ep.*,u.nome usuario,u.email,l.titulo,e.codigo exemplar_codigo FROM emprestimos ep JOIN leitores u ON u.id=ep.usuario_id JOIN exemplares e ON e.id=ep.exemplar_id JOIN livros l ON l.id=e.livro_id WHERE ep.id=? AND ep.status!='devolvido'`,[req.params.id]);if(!ep)return res.status(404).json({erro:'Empréstimo não encontrado.'});if(Number(ep.retirada_confirmada))return res.status(400).json({erro:'A retirada deste livro já foi confirmada.'});if(String(ep.codigo_seguranca||'')!==codigo)return res.status(400).json({erro:'Código de retirada inválido. Confira o código informado pelo aluno/professor.'});const cfg=await get('SELECT * FROM configuracoes WHERE id=1');const data=new Date();const prevista=new Date(data.getTime()+cfg.dias_emprestimo*86400000).toISOString();const baixa=await run("UPDATE emprestimos SET retirada_confirmada=1,data_emprestimo=CURRENT_TIMESTAMP,data_prevista_devolucao=?,status='ativo' WHERE id=? AND retirada_confirmada=0",[prevista,ep.id]);if(baixa.changes!==1)return res.status(409).json({erro:'A retirada já foi confirmada por outra operação.'});const ex=await run("UPDATE exemplares SET status='emprestado' WHERE id=? AND status='reservado'",[ep.exemplar_id]);if(ex.changes!==1){await run("UPDATE emprestimos SET retirada_confirmada=0 WHERE id=?",[ep.id]);return res.status(409).json({erro:'O exemplar não está reservado corretamente. Atualize a página e tente novamente.'});}await registrarNotificacao(ep.usuario_id,`Retirada confirmada: ${ep.titulo}`,`A Gestão confirmou a retirada de "${ep.titulo}". A devolução está prevista para ${new Date(prevista).toLocaleDateString('pt-BR')}.`,'emprestimo',{assunto:`BiblioBeta — retirada confirmada: ${ep.titulo}`,detalhes:[{label:'Livro',valor:ep.titulo},{label:'Exemplar',valor:ep.exemplar_codigo},{label:'Devolução prevista',valor:new Date(prevista).toLocaleDateString('pt-BR')}]});res.json({ok:true,data_prevista_devolucao:prevista})}catch(e){res.status(400).json({erro:e.message})}});
app.get('/api/emprestimos/meus',auth,async(req,res)=>res.json(await all(`SELECT ep.*,l.id livro_id,l.titulo,l.autor,l.capa,e.codigo FROM emprestimos ep JOIN exemplares e ON e.id=ep.exemplar_id JOIN livros l ON l.id=e.livro_id WHERE ep.usuario_id=? ORDER BY ep.data_emprestimo DESC`,[req.usuario.id]))); app.get('/api/emprestimos',auth,only('gestao'),async(req,res)=>res.json(await all(`SELECT ep.*,l.id livro_id,u.nome usuario,l.titulo,e.codigo FROM emprestimos ep JOIN leitores u ON u.id=ep.usuario_id JOIN exemplares e ON e.id=ep.exemplar_id JOIN livros l ON l.id=e.livro_id ORDER BY ep.data_emprestimo DESC`)));
app.post('/api/emprestimos/:id/devolver',auth,only('gestao'),async(req,res)=>{const ep=await get("SELECT ep.*,u.nome usuario,u.email,l.titulo,e.codigo exemplar_codigo FROM emprestimos ep JOIN leitores u ON u.id=ep.usuario_id JOIN exemplares e ON e.id=ep.exemplar_id JOIN livros l ON l.id=e.livro_id WHERE ep.id=? AND ep.status!='devolvido'",[req.params.id]);if(!ep)return res.status(404).json({erro:'Empréstimo não encontrado.'});if(!Number(ep.aviso_devolucao)||!String(ep.codigo_devolucao||'').trim())return res.status(400).json({erro:'O usuário ainda não avisou que vai devolver este livro. Aguarde o aviso e o código de devolução.'});const codigo=String(req.body.codigo_devolucao||'').trim().toUpperCase();if(!/^\d{6}$/.test(codigo))return res.status(400).json({erro:'Informe o código de devolução com 6 números.'});const codigoEsperado=String(ep.codigo_devolucao).trim().toUpperCase();if(codigo!==codigoEsperado)return res.status(400).json({erro:'Código de devolução inválido. Confira o código informado pelo aluno/professor.'});const baixa=await run("UPDATE emprestimos SET status='devolvido',data_devolucao=CURRENT_TIMESTAMP,codigo_devolucao=NULL,aviso_devolucao=0 WHERE id=? AND status!='devolvido'",[ep.id]);if(baixa.changes!==1)return res.status(409).json({erro:'Este empréstimo já foi devolvido por outra operação.'});await run("UPDATE exemplares SET status='disponivel' WHERE id=? AND status='emprestado'",[ep.exemplar_id]);await encerrarBloqueiosRegularizacao(ep.usuario_id);await registrarNotificacao(ep.usuario_id,`Devolução registrada: ${ep.titulo}`,`A Gestão confirmou a devolução de "${ep.titulo}". O exemplar ${ep.exemplar_codigo} voltou a ficar disponível no acervo.`,'devolucao',{assunto:`BiblioBeta — devolução registrada: ${ep.titulo}`,detalhes:[{label:'Livro',valor:ep.titulo},{label:'Exemplar',valor:ep.exemplar_codigo}]});const gestores=await all("SELECT id FROM leitores WHERE tipo='gestao' AND status='ativo'");for(const g of gestores) await registrarNotificacao(g.id,`Devolução confirmada: ${ep.titulo}`,`${ep.usuario} devolveu o livro. O exemplar ${ep.exemplar_codigo} já voltou a ficar disponível no acervo.`,'devolucao',{detalhes:[{label:'Usuário',valor:ep.usuario},{label:'Livro',valor:ep.titulo},{label:'Exemplar',valor:ep.exemplar_codigo}]});const reserva=await get("SELECT r.id,r.usuario_id FROM reservas r WHERE r.livro_id=(SELECT livro_id FROM exemplares WHERE id=?) AND r.status='fila' ORDER BY r.data_reserva LIMIT 1",[ep.exemplar_id]);if(reserva){await run("UPDATE reservas SET status='pronto' WHERE id=?",[reserva.id]);await registrarNotificacao(reserva.usuario_id,`Reserva disponível: ${ep.titulo}`,`O livro reservado já está disponível para retirada na biblioteca.`,'reserva',{assunto:`BiblioBeta — reserva disponível: ${ep.titulo}`});}res.json({ok:true})});
app.post('/api/emprestimos/:id/renovar',auth,async(req,res)=>{const ep=await get('SELECT ep.*,l.titulo FROM emprestimos ep JOIN exemplares e ON e.id=ep.exemplar_id JOIN livros l ON l.id=e.livro_id WHERE ep.id=?',[req.params.id]);if(!ep||ep.usuario_id!==req.usuario.id)return res.status(404).json({erro:'Empréstimo não encontrado.'});if(ep.status==='devolvido')return res.status(400).json({erro:'Este empréstimo já foi devolvido.'});const c=await get('SELECT * FROM configuracoes WHERE id=1');if(ep.renovacoes>=c.maximo_renovacoes)return res.status(400).json({erro:'Limite de renovações atingido.'});const d=new Date(Date.now()+c.dias_emprestimo*86400000).toISOString();await run("UPDATE emprestimos SET renovacoes=renovacoes+1,data_prevista_devolucao=?,status='ativo' WHERE id=?",[d,ep.id]);await registrarNotificacao(ep.usuario_id,`Empréstimo renovado: ${ep.titulo}`,`A nova data prevista de devolução é ${new Date(d).toLocaleDateString('pt-BR')}.`,'renovacao',{assunto:`BiblioBeta — empréstimo renovado: ${ep.titulo}`,detalhes:[{label:'Nova devolução',valor:new Date(d).toLocaleDateString('pt-BR')},{label:'Renovações usadas',valor:Number(ep.renovacoes)+1}]});res.json({ok:true,data_prevista_devolucao:d})});
// Aluno/professor avisa que está devolvendo o livro (a confirmação física continua sendo feita pela Gestão em "Devoluções")
app.post('/api/emprestimos/:id/avisar-devolucao',auth,async(req,res)=>{
  const ep=await get('SELECT ep.*,l.titulo,u.nome usuario FROM emprestimos ep JOIN exemplares e ON e.id=ep.exemplar_id JOIN livros l ON l.id=e.livro_id JOIN leitores u ON u.id=ep.usuario_id WHERE ep.id=?',[req.params.id]);
  if(!ep||ep.usuario_id!==req.usuario.id)return res.status(404).json({erro:'Empréstimo não encontrado.'});
  if(ep.status==='devolvido')return res.status(400).json({erro:'Este empréstimo já foi devolvido.'});
  if(Number(ep.aviso_devolucao))return res.status(400).json({erro:'A Gestão já foi avisada sobre esta devolução.'});
  let codigoDevolucao=String(ep.codigo_devolucao||'').trim().toUpperCase();
  if(!codigoDevolucao){ codigoDevolucao=gerarCodigoDevolucao(); while(await get('SELECT id FROM emprestimos WHERE codigo_devolucao=?',[codigoDevolucao])) codigoDevolucao=gerarCodigoDevolucao(); await run('UPDATE emprestimos SET aviso_devolucao=1,codigo_devolucao=?,codigo_devolucao_criado_em=CURRENT_TIMESTAMP WHERE id=?',[codigoDevolucao,ep.id]); }
  else await run('UPDATE emprestimos SET aviso_devolucao=1 WHERE id=?',[ep.id]);
  const gestores=await all("SELECT id FROM leitores WHERE tipo='gestao' AND status='ativo'");
  for(const g of gestores){
    await registrarNotificacao(g.id,`Devolução a confirmar: ${ep.titulo}`,`${ep.usuario} avisou que vai devolver "${ep.titulo}". Confirme o recebimento em Devoluções.`,'devolucao',{assunto:`BiblioBeta — devolução a confirmar: ${ep.titulo}`,detalhes:[{label:'Usuário',valor:ep.usuario},{label:'Livro',valor:ep.titulo}]});
  }
  await registrarNotificacao(ep.usuario_id,`Código de devolução: ${codigoDevolucao}`,`Guarde o código ${codigoDevolucao}. Ele será usado pela Gestão no momento em que você devolver o livro.`,'devolucao',{assunto:`BiblioBeta — código de devolução: ${ep.titulo}`});
  res.json({ok:true,codigo_devolucao:codigoDevolucao});
});
// ---------- Cobrança de devolução ----------
// Usuário: livros que a Gestão pediu para devolver (alimenta a tela de aviso no painel).
app.get('/api/emprestimos/cobrancas',auth,async(req,res)=>{try{res.json(await all(`SELECT ep.id,ep.data_prevista_devolucao,ep.status,ep.cobranca_em,ep.cobranca_msg,ep.cobranca_total,l.titulo,l.autor,l.capa,e.codigo FROM emprestimos ep JOIN exemplares e ON e.id=ep.exemplar_id JOIN livros l ON l.id=e.livro_id WHERE ep.usuario_id=? AND ep.status!='devolvido' AND ep.cobranca_tela=1 AND ep.cobranca_em IS NOT NULL ORDER BY ep.data_prevista_devolucao`,[req.usuario.id]))}catch(e){res.status(500).json({erro:e.message})}});
// Gestão: cobra um empréstimo específico.
app.post('/api/emprestimos/:id/cobrar-devolucao',auth,only('gestao'),async(req,res)=>{try{
  const canal=CANAIS_COBRANCA.includes(req.body.canal)?req.body.canal:'ambos';
  const ep=await get(SQL_EMPRESTIMOS_COBRAVEIS+' AND ep.id=?',[req.params.id]);
  if(!ep)return res.status(404).json({erro:'Empréstimo em aberto não encontrado (ou a retirada ainda não foi confirmada).'});
  if(canal!=='site'&&!smtpConfigurado('usuarios'))return res.status(503).json({erro:'O envio de e-mail ainda não está configurado. Use o canal "Site" ou configure o Gmail.'});
  if(canal!=='site'&&!emailValido(ep.email))return res.status(400).json({erro:'Este usuário não tem um e-mail válido cadastrado.'});
  const r=await cobrarDevolucao(ep,{canal,mensagem:String(req.body.mensagem||'').slice(0,500)});
  res.json({ok:true,email_falhou:r.emailFalhou,mensagem:r.emailFalhou?`${ep.usuario} foi avisado(a) no site, mas o e-mail não saiu agora (${statusEmail.ultimoErro}). Se for falha temporária, o sistema tenta reenviar sozinho.`:`${ep.usuario} foi avisado(a) para devolver "${ep.titulo}".`});
}catch(e){res.status(400).json({erro:e.message})}});
// Gestão: cobra vários de uma vez (atrasados, vencendo em até 3 dias, ou ambos).
app.post('/api/emprestimos/cobrar-devolucao-lote',auth,only('gestao'),async(req,res)=>{try{
  const canal=CANAIS_COBRANCA.includes(req.body.canal)?req.body.canal:'ambos';
  const alvo=['atrasados','vencendo','todos'].includes(req.body.alvo)?req.body.alvo:'atrasados';
  if(canal!=='site'&&!smtpConfigurado('usuarios'))return res.status(503).json({erro:'O envio de e-mail ainda não está configurado. Use o canal "Site" ou configure o Gmail.'});
  const lista=filtrarPorAlvo(await all(SQL_EMPRESTIMOS_COBRAVEIS),alvo);
  if(!lista.length)return res.status(404).json({erro:'Nenhum empréstimo se encaixa nesse grupo.'});
  const mensagem=String(req.body.mensagem||'').slice(0,500);
  res.status(202).json({ok:true,total:lista.length,mensagem:`Avisando ${lista.length} empréstimo(s)...`});
  (async()=>{for(const ep of lista){try{await cobrarDevolucao(ep,{canal,mensagem});}catch(e){console.error('Cobrança em lote:',e.message);}}})();
}catch(e){if(!res.headersSent)res.status(400).json({erro:e.message})}});
// Configuração do envio automático (somente administrador).
app.get('/api/configuracoes/cobranca',auth,only('gestao'),onlyAdmin,async(req,res)=>{try{res.json(await get('SELECT cobranca_auto,cobranca_canal,cobranca_alvo,cobranca_intervalo_dias FROM configuracoes WHERE id=1'))}catch(e){res.status(500).json({erro:e.message})}});
app.put('/api/configuracoes/cobranca',auth,only('gestao'),onlyAdmin,async(req,res)=>{try{
  const b=req.body||{};
  const canal=CANAIS_COBRANCA.includes(b.canal)?b.canal:'ambos';
  const alvo=['atrasados','vencendo','todos'].includes(b.alvo)?b.alvo:'atrasados';
  const intervalo=Math.min(30,Math.max(1,parseInt(b.intervalo_dias,10)||3));
  await run('UPDATE configuracoes SET cobranca_auto=?,cobranca_canal=?,cobranca_alvo=?,cobranca_intervalo_dias=? WHERE id=1',[b.auto?1:0,canal,alvo,intervalo]);
  if(b.auto) processarCobrancasAutomaticas().catch(()=>{});
  res.json(await get('SELECT cobranca_auto,cobranca_canal,cobranca_alvo,cobranca_intervalo_dias FROM configuracoes WHERE id=1'));
}catch(e){res.status(400).json({erro:e.message})}});
// ---------- Solicitações de empréstimo feitas pelo aluno/professor ----------
app.get('/api/solicitacoes-emprestimo/minhas',auth,async(req,res)=>res.json(await all(`SELECT s.*,l.titulo,l.autor,l.capa FROM solicitacoes_emprestimo s JOIN livros l ON l.id=s.livro_id WHERE s.usuario_id=? ORDER BY s.data_solicitacao DESC`,[req.usuario.id])));
app.post('/api/solicitacoes-emprestimo',auth,only('aluno','professor'),async(req,res)=>{
  try{
    const livroId=Number(req.body.livro_id), dataDesejada=req.body.data_desejada||null;
    const l=await get(`SELECT l.id,l.titulo,l.autor,(SELECT COUNT(*) FROM exemplares e WHERE e.livro_id=l.id AND e.status='disponivel') disponiveis FROM livros l WHERE l.id=? AND l.ativo=1`,[livroId]);
    if(!l)return res.status(404).json({erro:'Livro não encontrado.'});
    const bloqueioSol=await bloqueioAtivo(req.usuario.id);
    if(bloqueioSol)return negarPorPunicao(res,bloqueioSol);
    if(Number(l.disponiveis)<1)return res.status(400).json({erro:'Este livro está sem exemplares disponíveis. Faça uma reserva para entrar na fila.'});
    if(dataDesejada){
      const hoje=new Date(); hoje.setHours(0,0,0,0);
      const desejada=new Date(String(dataDesejada)+'T00:00:00');
      if(Number.isNaN(desejada.getTime())) return res.status(400).json({erro:'Data desejada inválida.'});
      if(desejada<hoje) return res.status(400).json({erro:'A data desejada não pode ser anterior a hoje.'});
    }
    const jaEmprestado=await get(`SELECT ep.id FROM emprestimos ep JOIN exemplares e ON e.id=ep.exemplar_id WHERE ep.usuario_id=? AND e.livro_id=? AND ep.status IN ('ativo','atrasado') LIMIT 1`,[req.usuario.id,livroId]);
    if(jaEmprestado)return res.status(409).json({erro:'Você já possui este livro emprestado.'});
    const cfg=await get('SELECT * FROM configuracoes WHERE id=1');
    const lim=req.usuario.tipo==='aluno'?cfg.limite_livros_aluno:cfg.limite_livros_professor;
    const at=(await get("SELECT COUNT(*) total FROM emprestimos WHERE usuario_id=? AND status IN ('ativo','atrasado')",[req.usuario.id])).total;
    if(at>=lim)return res.status(400).json({erro:`Limite de ${lim} empréstimo(s) atingido.`});
    const ja=await get("SELECT id FROM solicitacoes_emprestimo WHERE usuario_id=? AND livro_id=? AND status='pendente' LIMIT 1",[req.usuario.id,livroId]);
    if(ja)return res.status(409).json({erro:'Você já possui uma solicitação pendente para este livro.'});
    const r=await run('INSERT INTO solicitacoes_emprestimo(usuario_id,livro_id,data_desejada) VALUES(?,?,?)',[req.usuario.id,livroId,dataDesejada]);
    const gestoes=await all("SELECT id FROM leitores WHERE tipo='gestao' AND status='ativo'");
    const solicitante=await get('SELECT nome,email FROM leitores WHERE id=?',[req.usuario.id]); for(const g of gestoes) await registrarNotificacao(g.id,'Nova solicitação de empréstimo',`${solicitante.nome} solicitou o livro "${l.titulo}"${dataDesejada?' para '+new Date(dataDesejada+'T12:00:00').toLocaleDateString('pt-BR'):''}.`,'solicitacao',{detalhes:[{label:'Solicitante',valor:solicitante.nome},{label:'E-mail',valor:solicitante.email},{label:'Livro',valor:l.titulo},{label:'Data desejada',valor:dataDesejada?new Date(dataDesejada+'T12:00:00').toLocaleDateString('pt-BR'):'Não informada'}]});
    await registrarNotificacao(req.usuario.id,'Solicitação enviada',`Sua solicitação do livro "${l.titulo}" foi enviada para a Gestão. Aguarde a aprovação. Quando a Gestão aprovar, você receberá um código de retirada.`,'solicitacao');
    res.status(201).json(await get(`SELECT s.*,l.titulo,l.autor FROM solicitacoes_emprestimo s JOIN livros l ON l.id=s.livro_id WHERE s.id=?`,[r.id]));
  }catch(e){res.status(400).json({erro:e.message})}
});
app.delete('/api/solicitacoes-emprestimo/:id',auth,async(req,res)=>{const r=await get("SELECT * FROM solicitacoes_emprestimo WHERE id=? AND usuario_id=? AND status='pendente'",[req.params.id,req.usuario.id]);if(!r)return res.status(404).json({erro:'Solicitação não encontrada ou já analisada.'});await run("UPDATE solicitacoes_emprestimo SET status='cancelada',analisado_em=CURRENT_TIMESTAMP WHERE id=?",[r.id]);res.json({ok:true})});
app.get('/api/solicitacoes-emprestimo',auth,only('gestao'),async(req,res)=>res.json(await all(`SELECT s.*,u.nome usuario,u.email,l.titulo,l.autor,(SELECT COUNT(*) FROM exemplares e WHERE e.livro_id=l.id AND e.status='disponivel') disponiveis FROM solicitacoes_emprestimo s JOIN leitores u ON u.id=s.usuario_id JOIN livros l ON l.id=s.livro_id ORDER BY CASE s.status WHEN 'pendente' THEN 0 ELSE 1 END,s.data_solicitacao DESC`)));
app.post('/api/solicitacoes-emprestimo/:id/aprovar',auth,only('gestao'),async(req,res)=>{
  try{
    const s=await get("SELECT s.*,u.nome usuario,u.email,u.tipo usuario_tipo,l.titulo FROM solicitacoes_emprestimo s JOIN leitores u ON u.id=s.usuario_id JOIN livros l ON l.id=s.livro_id WHERE s.id=? AND s.status='pendente'",[req.params.id]);
    if(!s)return res.status(404).json({erro:'Solicitação não encontrada ou já analisada.'});
    const bloqueioApr=await bloqueioAtivo(s.usuario_id);
    if(bloqueioApr)return res.status(403).json({erro:`${s.usuario} está com os empréstimos bloqueados por penalidade. Recuse a solicitação ou encerre a penalidade antes de aprovar.`});
    const ex=await get("SELECT id,codigo FROM exemplares WHERE livro_id=? AND status='disponivel' ORDER BY id LIMIT 1",[s.livro_id]);
    if(!ex)return res.status(400).json({erro:'Não há exemplar disponível para aprovar esta solicitação. O aluno pode aguardar ou fazer uma reserva.'});
    const cfg=await get('SELECT * FROM configuracoes WHERE id=1');
    const lim=s.usuario_tipo;
    const limite=lim==='aluno'?cfg.limite_livros_aluno:cfg.limite_livros_professor;
    const ativos=(await get("SELECT COUNT(*) total FROM emprestimos WHERE usuario_id=? AND status IN ('ativo','atrasado')",[s.usuario_id])).total;
    if(ativos>=limite)return res.status(400).json({erro:`O usuário já atingiu o limite de ${limite} empréstimo(s).`});
    let codigoSeguranca=gerarTokenEmprestimo();
    while(await get('SELECT id FROM emprestimos WHERE codigo_seguranca=?',[codigoSeguranca])) codigoSeguranca=gerarTokenEmprestimo();
    const dataPrevista=new Date(Date.now()+cfg.dias_emprestimo*86400000).toISOString();
    // Duas pessoas da Gestão podem clicar em "aprovar" ao mesmo tempo: primeiro "pegamos" a
    // solicitação e o exemplar de forma atômica; quem chegar depois recebe 409, sem duplicar nada.
    const pegouSolic=await run("UPDATE solicitacoes_emprestimo SET status='aprovada',analisado_em=CURRENT_TIMESTAMP,analisado_por=? WHERE id=? AND status='pendente'",[req.usuario.id,s.id]);
    if(pegouSolic.changes!==1)return res.status(409).json({erro:'Esta solicitação acabou de ser analisada por outra pessoa da Gestão. Atualize a página.'});
    const pegouEx=await run("UPDATE exemplares SET status='reservado' WHERE id=? AND status='disponivel'",[ex.id]);
    if(pegouEx.changes!==1){await run("UPDATE solicitacoes_emprestimo SET status='pendente',analisado_em=NULL,analisado_por=NULL WHERE id=?",[s.id]);return res.status(409).json({erro:'O exemplar acabou de ser separado por outra operação. Tente aprovar novamente.'});}
    let r;
    try{r=await run('INSERT INTO emprestimos(usuario_id,exemplar_id,data_prevista_devolucao,codigo_seguranca,retirada_confirmada) VALUES(?,?,?,?,0)',[s.usuario_id,ex.id,dataPrevista,codigoSeguranca]);}
    catch(err){await run("UPDATE exemplares SET status='disponivel' WHERE id=? AND status='reservado'",[ex.id]);await run("UPDATE solicitacoes_emprestimo SET status='pendente',analisado_em=NULL,analisado_por=NULL WHERE id=?",[s.id]);throw err;}
    await run("UPDATE solicitacoes_emprestimo SET emprestimo_id=? WHERE id=?",[r.id,s.id]);
    await registrarNotificacao(s.usuario_id,`Empréstimo aprovado: ${s.titulo}`,`Sua solicitação foi aprovada. O exemplar ${ex.codigo} está separado para você. Seu código de retirada é ${codigoSeguranca}. Apresente esse código na biblioteca para pegar o livro.`,'emprestimo',{assunto:`BiblioBeta — livro pronto para retirada: ${s.titulo}`,detalhes:[{label:'Livro',valor:s.titulo},{label:'Exemplar',valor:ex.codigo},{label:'Código de retirada',valor:codigoSeguranca}]});
    res.json({ok:true,emprestimo_id:r.id,codigo_retirada:codigoSeguranca});
  }catch(e){res.status(400).json({erro:e.message})}
});
app.post('/api/solicitacoes-emprestimo/:id/recusar',auth,only('gestao'),async(req,res)=>{try{const s=await get("SELECT s.*,l.titulo FROM solicitacoes_emprestimo s JOIN livros l ON l.id=s.livro_id WHERE s.id=? AND s.status='pendente'",[req.params.id]);if(!s)return res.status(404).json({erro:'Solicitação não encontrada ou já analisada.'});const motivo=String(req.body.motivo||'Solicitação não aprovada pela Gestão.').trim();await run("UPDATE solicitacoes_emprestimo SET status='recusada',motivo=?,analisado_em=CURRENT_TIMESTAMP,analisado_por=? WHERE id=?",[motivo,req.usuario.id,s.id]);await registrarNotificacao(s.usuario_id,`Solicitação recusada: ${s.titulo}`,motivo,'solicitacao',{assunto:`BiblioBeta — solicitação recusada: ${s.titulo}`});res.json({ok:true})}catch(e){res.status(400).json({erro:e.message})}});
app.get('/api/reservas/minhas',auth,async(req,res)=>res.json(await all('SELECT r.*,l.titulo,l.autor,l.capa FROM reservas r JOIN livros l ON l.id=r.livro_id WHERE r.usuario_id=? ORDER BY r.data_reserva DESC',[req.usuario.id]))); app.post('/api/reservas',auth,async(req,res)=>{const cfg=await get('SELECT permitir_reservas FROM configuracoes WHERE id=1');if(cfg && !cfg.permitir_reservas)return res.status(400).json({erro:'As reservas estão desativadas pela Gestão.'});const bloqueioRes=await bloqueioAtivo(req.usuario.id);if(bloqueioRes)return negarPorPunicao(res,bloqueioRes);const l=await get('SELECT id FROM livros WHERE id=? AND ativo=1',[req.body.livro_id]);if(!l)return res.status(404).json({erro:'Livro não encontrado.'});const ja=await get("SELECT id FROM reservas WHERE usuario_id=? AND livro_id=? AND status IN ('fila','pronto') LIMIT 1",[req.usuario.id,l.id]);if(ja)return res.status(409).json({erro:'Você já possui uma reserva ativa para este livro.'});const r=await run('INSERT INTO reservas(usuario_id,livro_id) VALUES(?,?)',[req.usuario.id,l.id]);const livroReserva=await get('SELECT titulo FROM livros WHERE id=?',[l.id]);const reservaUser=await get('SELECT nome,email FROM leitores WHERE id=?',[req.usuario.id]);const gestoes=await all("SELECT id FROM leitores WHERE tipo='gestao' AND status='ativo'");for(const g of gestoes) await registrarNotificacao(g.id,'Nova reserva',`${reservaUser.nome} fez uma reserva para o livro "${livroReserva.titulo}".`,'reserva',{detalhes:[{label:'Usuário',valor:reservaUser.nome},{label:'E-mail',valor:reservaUser.email},{label:'Livro',valor:livroReserva.titulo}]});await registrarNotificacao(req.usuario.id,`Reserva registrada: ${livroReserva.titulo}`,`Sua reserva foi registrada e você entrou na fila de espera.`,`reserva`,{assunto:`BiblioBeta — reserva registrada: ${livroReserva.titulo}`});res.status(201).json(await get('SELECT * FROM reservas WHERE id=?',[r.id]))}); app.delete('/api/reservas/:id',auth,async(req,res)=>{await run("UPDATE reservas SET status='cancelada' WHERE id=? AND usuario_id=?",[req.params.id,req.usuario.id]);res.json({ok:true})}); app.get('/api/reservas',auth,only('gestao'),async(req,res)=>res.json(await all('SELECT r.*,u.nome usuario,l.titulo FROM reservas r JOIN leitores u ON u.id=r.usuario_id JOIN livros l ON l.id=r.livro_id ORDER BY r.data_reserva')));
// Administração complementar: usuários, categorias, exemplares, reservas e contatos.
app.put('/api/usuarios/:id',auth,only('gestao'),async(req,res)=>{try{const b=req.body;const nome=String(b.nome||'').trim(),em=email(b.email);if(!nome)return res.status(400).json({erro:'Nome é obrigatório.'});if(!emailValido(em))return res.status(400).json({erro:'E-mail inválido.'});const uAtual=await get("SELECT * FROM leitores WHERE id=? AND tipo IN ('aluno','professor')",[req.params.id]);if(!uAtual)return res.status(404).json({erro:'Leitor não encontrado.'});const pAtual=await perfil(uAtual);const regra=politicaEmail(em,uAtual.tipo,pAtual.perfil?.ra,pAtual.perfil?.ra_digito);if(!regra.ok)return res.status(400).json({erro:regra.erro});const outro=await get('SELECT id FROM leitores WHERE (LOWER(email)=? OR LOWER(email_alternativo)=?) AND id<>?',[em,em,req.params.id]);if(outro)return res.status(409).json({erro:'Este e-mail já está cadastrado.'});let alt=uAtual.email_alternativo||null;if(uAtual.tipo==='professor'&&b.email_alternativo!==undefined){const a=validarEmailAlternativo(b.email_alternativo,em);if(!a.ok)return res.status(400).json({erro:a.erro});alt=a.valor;if(alt){const o2=await get('SELECT id FROM leitores WHERE (LOWER(email)=? OR LOWER(email_alternativo)=?) AND id<>?',[alt,alt,req.params.id]);if(o2)return res.status(409).json({erro:'O segundo e-mail já está cadastrado em outra conta.'})}}await run('UPDATE leitores SET nome=?,email=?,email_alternativo=?,telefone=? WHERE id=?',[nome,em,alt,b.telefone===undefined?uAtual.telefone:(String(b.telefone||'').trim()||null),req.params.id]);res.json(await get('SELECT id,nome,email,email_alternativo,telefone,tipo,status,criado_em FROM leitores WHERE id=?',[req.params.id]))}catch(e){res.status(400).json({erro:e.message})}});
app.put('/api/usuarios/:id/senha',auth,only('gestao'),async(req,res)=>{try{const senha=String(req.body.senha||'');if(!senhaValida(senha))return res.status(400).json({erro:'A senha precisa ter 8 caracteres, maiúscula, minúscula, número e símbolo.'});await run('UPDATE leitores SET senha_hash=? WHERE id=?',[scryptHash(senha),req.params.id]);res.json({ok:true})}catch(e){res.status(400).json({erro:e.message})}});
app.put('/api/usuarios/:id/status',auth,only('gestao'),async(req,res)=>{try{const status=req.body.status==='inativo'?'inativo':'ativo';const u=await get("SELECT id,tipo,status FROM leitores WHERE id=? AND tipo IN ('aluno','professor')",[req.params.id]);if(!u)return res.status(404).json({erro:'Leitor não encontrado.'});if(u.id===req.usuario.id&&status==='inativo')return res.status(400).json({erro:'Você não pode desativar a própria conta.'});await run('UPDATE leitores SET status=? WHERE id=?',[status,u.id]);if(status==='inativo'&&u.status!=='inativo')avisarContaDesativada(u.id);res.json({ok:true,status})}catch(e){res.status(400).json({erro:e.message})}});
app.put('/api/categorias/:id',auth,only('gestao'),async(req,res)=>{try{const nome=String(req.body.nome||'').trim();if(!nome)return res.status(400).json({erro:'Nome da categoria é obrigatório.'});await run('UPDATE categorias SET nome=?,descricao=? WHERE id=?',[nome,String(req.body.descricao||'').trim()||null,req.params.id]);res.json(await get('SELECT * FROM categorias WHERE id=?',[req.params.id]))}catch(e){res.status(400).json({erro:e.message})}});
app.delete('/api/categorias/:id',auth,only('gestao'),async(req,res)=>{try{const usados=(await get('SELECT COUNT(*) total FROM livros WHERE categoria_id=? AND ativo=1',[req.params.id])).total;if(usados>0)return res.status(409).json({erro:'Categoria possui livros ativos. Altere a categoria dos livros antes de excluir.'});await run('DELETE FROM categorias WHERE id=?',[req.params.id]);res.json({ok:true})}catch(e){res.status(400).json({erro:e.message})}});
app.put('/api/exemplares/:id',auth,only('gestao'),async(req,res)=>{try{const ex=await get('SELECT * FROM exemplares WHERE id=?',[req.params.id]);if(!ex)return res.status(404).json({erro:'Exemplar não encontrado.'});if(ex.status==='emprestado' && req.body.status && req.body.status!=='emprestado')return res.status(400).json({erro:'Não altere o status de um exemplar emprestado. Registre a devolução.'});const status=['disponivel','emprestado','reservado','danificado','perdido'].includes(req.body.status)?req.body.status:ex.status;await run('UPDATE exemplares SET localizacao_id=?,codigo=?,status=?,observacao=? WHERE id=?',[req.body.localizacao_id||null,String(req.body.codigo||ex.codigo).trim(),status,String(req.body.observacao||'').trim()||null,req.params.id]);res.json(await get('SELECT e.*,lo.nome localizacao FROM exemplares e LEFT JOIN localizacoes lo ON lo.id=e.localizacao_id WHERE e.id=?',[req.params.id]))}catch(e){res.status(400).json({erro:e.message})}});
app.delete('/api/exemplares/:id',auth,only('gestao'),async(req,res)=>{try{const ex=await get('SELECT status FROM exemplares WHERE id=?',[req.params.id]);if(!ex)return res.status(404).json({erro:'Exemplar não encontrado.'});if(ex.status==='emprestado')return res.status(409).json({erro:'Não é possível excluir exemplar emprestado.'});await run("UPDATE exemplares SET status='perdido',observacao=COALESCE(observacao,'') || CASE WHEN COALESCE(observacao,'')='' THEN 'Exemplar retirado do acervo.' ELSE ' Exemplar retirado do acervo.' END WHERE id=?",[req.params.id]);res.json({ok:true})}catch(e){res.status(400).json({erro:e.message})}});
app.put('/api/reservas/:id/status',auth,only('gestao'),async(req,res)=>{try{const novo=['fila','pronto','retirada','cancelada'].includes(req.body.status)?req.body.status:null;if(!novo)return res.status(400).json({erro:'Status de reserva inválido.'});const r=await get('SELECT r.*,l.titulo FROM reservas r JOIN livros l ON l.id=r.livro_id WHERE r.id=?',[req.params.id]);if(!r)return res.status(404).json({erro:'Reserva não encontrada.'});await run("UPDATE reservas SET status=?,prazo_retirada=CASE WHEN ?='pronto' THEN datetime('now','+2 days') ELSE NULL END WHERE id=?",[novo,novo,r.id]);if(novo==='pronto')await registrarNotificacao(r.usuario_id,`Reserva disponível: ${r.titulo}`,'Seu livro está disponível para retirada na biblioteca.','reserva');if(novo==='retirada')await registrarNotificacao(r.usuario_id,`Reserva retirada: ${r.titulo}`,'A retirada da reserva foi registrada pela Gestão.','reserva');res.json({ok:true,status:novo})}catch(e){res.status(400).json({erro:e.message})}});
app.get('/api/contatos',auth,only('gestao'),async(req,res)=>res.json(await all("SELECT * FROM contatos ORDER BY CASE status WHEN 'novo' THEN 0 WHEN 'lido' THEN 1 ELSE 2 END,criado_em DESC")));
app.put('/api/contatos/:id/status',auth,only('gestao'),async(req,res)=>{try{const status=['novo','lido','respondido'].includes(req.body.status)?req.body.status:null;if(!status)return res.status(400).json({erro:'Status de contato inválido.'});await run('UPDATE contatos SET status=? WHERE id=?',[status,req.params.id]);res.json(await get('SELECT * FROM contatos WHERE id=?',[req.params.id]))}catch(e){res.status(400).json({erro:e.message})}});

// Relatórios e multas são calculados a partir do SQLite (sem dados fictícios no frontend).
const VALOR_MULTA_DIA = 5;
app.get('/api/penalidades',auth,async(req,res)=>{try{const where=req.usuario.tipo==='gestao'?'':' AND p.usuario_id=?';const params=req.usuario.tipo==='gestao'?[]:[req.usuario.id];res.json(await all(`SELECT p.*,u.nome usuario,u.email,ep.id emprestimo_id,l.titulo FROM penalidades p JOIN leitores u ON u.id=p.usuario_id LEFT JOIN emprestimos ep ON ep.id=p.emprestimo_id LEFT JOIN exemplares ex ON ex.id=ep.exemplar_id LEFT JOIN livros l ON l.id=ex.livro_id WHERE 1=1${where} ORDER BY p.criada_em DESC`,params))}catch(e){res.status(500).json({erro:e.message})}});
// Bloqueio de empréstimos: penalidade ativa que impede novos empréstimos/solicitações.
// 'advertencia' não bloqueia; bloqueios por dias valem até fim_em; 'bloqueio_regularizacao' vale até devolver o livro.
async function bloqueioAtivo(usuarioId){
  const lista=await all("SELECT id,tipo,fim_em,descricao,dias_bloqueio,emprestimo_id,criada_em FROM penalidades WHERE usuario_id=? AND status='ativa' AND tipo!='advertencia'",[usuarioId]);
  return lista.find(p=>!p.fim_em||new Date(p.fim_em)>new Date())||null;
}
function textoBloqueio(b){return b.fim_em?`Você está com os empréstimos bloqueados até ${new Date(b.fim_em).toLocaleDateString('pt-BR')} por causa de um atraso.`:'Você está com os empréstimos bloqueados até devolver o livro em atraso e regularizar sua situação com a biblioteca.'}
// Dados da punição que o site mostra na tela de bloqueio (e que vão junto do erro 403 "PUNIDO").
async function dadosPunicao(p){
  const l=p.emprestimo_id?await get('SELECT l.titulo FROM emprestimos ep JOIN exemplares e ON e.id=ep.exemplar_id JOIN livros l ON l.id=e.livro_id WHERE ep.id=?',[p.emprestimo_id]):null;
  return {id:p.id,tipo:p.tipo,descricao:p.descricao,dias_bloqueio:p.dias_bloqueio||0,fim_em:p.fim_em||null,livro:l?l.titulo:null,criada_em:p.criada_em||null,mensagem:textoBloqueio(p)};
}
async function negarPorPunicao(res,b){return res.status(403).json({erro:textoBloqueio(b),codigo:'PUNIDO',punicao:await dadosPunicao(b)})}
// Avisa o aluno/professor da punição: e-mail pelo Gmail (sempre enviado, mesmo que a categoria esteja
// desligada em Configurações) + aviso no painel + evento em tempo real para abrir a tela no site.
async function avisarPunicao(penId){
  const p=await get(`SELECT p.*,u.nome usuario,l.titulo,ep.data_prevista_devolucao,ep.data_devolucao FROM penalidades p JOIN leitores u ON u.id=p.usuario_id LEFT JOIN emprestimos ep ON ep.id=p.emprestimo_id LEFT JOIN exemplares ex ON ex.id=ep.exemplar_id LEFT JOIN livros l ON l.id=ex.livro_id WHERE p.id=?`,[penId]);
  if(!p) return false;
  const br=v=>new Date(v).toLocaleDateString('pt-BR');
  const regularizacao=p.tipo==='bloqueio_regularizacao', bloqueio=p.tipo!=='advertencia';
  let diasAtraso=0;
  if(p.data_prevista_devolucao){
    const fimAtraso=p.data_devolucao?new Date(String(p.data_devolucao).replace(' ','T')+'Z'):new Date();
    diasAtraso=Math.max(1,Math.ceil((fimAtraso-new Date(p.data_prevista_devolucao))/86400000));
  }
  const livro=p.titulo?`"${p.titulo}"`:'o livro emprestado';
  const motivo=p.titulo?(p.data_devolucao?`${livro} foi devolvido com ${diasAtraso} dia(s) de atraso.`:`${livro} está com ${diasAtraso} dia(s) de atraso.`):'Houve um atraso na devolução de um livro.';
  const punicao=regularizacao?'Bloqueio até devolver o livro em atraso':bloqueio?`Bloqueio de ${p.dias_bloqueio} dias`:'Advertência';
  const efeito=regularizacao?'Enquanto o livro não for devolvido, você não pode pedir, reservar nem retirar novos livros.'
    :bloqueio?`Até ${br(p.fim_em)} você não pode pedir, reservar nem retirar livros. Quando o prazo terminar, tudo volta a funcionar sozinho.`
    :'Nada fica bloqueado, mas uma nova advertência pode virar bloqueio.';
  const titulo=bloqueio?'⚠️ Você recebeu uma punição na biblioteca':'⚠️ Você recebeu uma advertência da biblioteca';
  const mensagem=`${motivo} Por isso, a Gestão aplicou a seguinte punição: ${punicao}. ${efeito}${p.descricao&&!/^(Bloqueio de empréstimos|Advertência por atraso|Empréstimos bloqueados)/.test(p.descricao)?` Motivo informado pela Gestão: ${p.descricao}`:''} Se tiver dúvidas, procure a Gestão da biblioteca.`;
  const detalhes=[{label:'Livro',valor:p.titulo||'—'},{label:'Atraso',valor:diasAtraso?`${diasAtraso} dia(s)`:''},{label:'Punição',valor:punicao},{label:'Bloqueado até',valor:regularizacao?'Até devolver o livro':bloqueio?br(p.fim_em):'Sem bloqueio'},{label:'O que acontece',valor:bloqueio?'Não pode pedir, reservar nem retirar livros':'Apenas aviso'}];
  await registrarNotificacao(p.usuario_id,titulo,mensagem,'penalidade',{assunto:`BiblioBeta — ${bloqueio?'você recebeu uma punição':'advertência'}: ${p.titulo||'atraso na devolução'}`,detalhes,ignorarDuplicata:true,forcar:true});
  enviarEventoTempoReal(p.usuario_id,'punicao',await dadosPunicao(p));
  return true;
}
// Aluno/professor consulta se está bloqueado (a tela de bloqueio usa isso).
app.get('/api/penalidades/bloqueio',auth,async(req,res)=>{try{const b=await bloqueioAtivo(req.usuario.id);res.json(b?{bloqueado:true,punicao:await dadosPunicao(b)}:{bloqueado:false})}catch(e){res.status(500).json({erro:e.message})}});
// Gestão reenvia o aviso de punição (Gmail + site) para o aluno.
app.post('/api/penalidades/:id/avisar',auth,only('gestao'),async(req,res)=>{try{const p=await get('SELECT id,status FROM penalidades WHERE id=?',[req.params.id]);if(!p)return res.status(404).json({erro:'Penalidade não encontrada.'});if(p.status!=='ativa')return res.status(400).json({erro:'Só é possível avisar sobre uma punição ativa.'});await avisarPunicao(p.id);res.json({ok:true,mensagem:'Aviso enviado por Gmail e pelo site.'})}catch(e){res.status(400).json({erro:e.message})}});
// Gestão decide a punição de um atraso: advertência, bloqueio por 3/7/15 dias, bloqueio até regularizar, ou dispensar.
app.post('/api/penalidades',auth,only('gestao'),async(req,res)=>{try{
  const usuarioId=Number(req.body.usuario_id),emprestimoId=req.body.emprestimo_id?Number(req.body.emprestimo_id):null;
  const u=await get("SELECT id,nome FROM leitores WHERE id=? AND tipo IN ('aluno','professor') AND status='ativo'",[usuarioId]);
  if(!u)return res.status(404).json({erro:'Leitor não encontrado ou inativo.'});
  if(emprestimoId){
    const ep=await get('SELECT id,usuario_id FROM emprestimos WHERE id=?',[emprestimoId]);
    if(!ep||ep.usuario_id!==usuarioId)return res.status(400).json({erro:'Empréstimo não pertence a este leitor.'});
    const jaDecidido=await get('SELECT id FROM penalidades WHERE emprestimo_id=? LIMIT 1',[emprestimoId]);
    if(jaDecidido)return res.status(409).json({erro:'Este atraso já tem uma decisão registrada.'});
  }
  const modo=String(req.body.tipo||'').toLowerCase();
  const dispensar=modo==='dispensar', regularizacao=modo==='regularizacao'||modo==='bloqueio_regularizacao';
  let dias=regularizacao||dispensar?0:([0,3,7,15].includes(Number(req.body.dias_bloqueio))?Number(req.body.dias_bloqueio):3);
  if(modo==='advertencia')dias=0;
  const tipo=regularizacao?'bloqueio_regularizacao':(dias===0?'advertencia':`bloqueio_${dias}`);
  const padrao=dispensar?'Atraso dispensado pela Gestão, sem punição.':regularizacao?'Empréstimos bloqueados até a devolução do livro em atraso.':(dias?`Bloqueio de empréstimos por ${dias} dias devido a atraso.`:'Advertência por atraso na devolução.');
  const descricao=String(req.body.descricao||'').trim()||padrao;
  const fim=dias?new Date(Date.now()+dias*86400000).toISOString():null;
  const r=await run('INSERT INTO penalidades(usuario_id,emprestimo_id,descricao,tipo,dias_bloqueio,status,fim_em) VALUES(?,?,?,?,?,?,?)',[usuarioId,emprestimoId,descricao,tipo,dias,dispensar?'cancelada':'ativa',fim]);
  if(!dispensar)await avisarPunicao(r.id);
  res.status(201).json(await get('SELECT * FROM penalidades WHERE id=?',[r.id]));
}catch(e){res.status(400).json({erro:e.message})}});
app.put('/api/penalidades/:id/status',auth,only('gestao'),async(req,res)=>{const st=['ativa','cumprida','cancelada'].includes(req.body.status)?req.body.status:null;if(!st)return res.status(400).json({erro:'Status inválido.'});const p=await get('SELECT * FROM penalidades WHERE id=?',[req.params.id]);if(!p)return res.status(404).json({erro:'Penalidade não encontrada.'});await run('UPDATE penalidades SET status=? WHERE id=?',[st,p.id]);if(st!=='ativa')await registrarNotificacao(p.usuario_id,'Penalidade encerrada','A penalidade registrada em seu nome foi encerrada.','penalidade');res.json(await get('SELECT * FROM penalidades WHERE id=?',[p.id]))});
// Tela de multa: todo empréstimo cujo prazo passou aparece aqui automaticamente.
// "aguardando" = ainda sem decisão da Gestão; "decididos" = já têm punição (ou foram dispensados).
app.get('/api/multas',auth,only('gestao'),async(req,res)=>{
  try{
    await processarPrazos();
    const atrasados=await all(`SELECT ep.id emprestimo_id,ep.usuario_id,u.nome usuario,u.email,u.tipo usuario_tipo,a.turma,a.serie,l.id livro_id,l.titulo,l.capa,e.codigo,ep.data_prevista_devolucao,ep.data_emprestimo,
      MAX(1,CAST(julianday('now')-julianday(ep.data_prevista_devolucao) AS INTEGER)) dias_atraso,
      (SELECT COUNT(*) FROM penalidades p0 WHERE p0.usuario_id=ep.usuario_id AND p0.status='ativa') penalidades_ativas
      FROM emprestimos ep JOIN leitores u ON u.id=ep.usuario_id JOIN exemplares e ON e.id=ep.exemplar_id JOIN livros l ON l.id=e.livro_id LEFT JOIN alunos a ON a.usuario_id=u.id
      WHERE ep.status!='devolvido' AND julianday(ep.data_prevista_devolucao)<julianday('now') ORDER BY ep.data_prevista_devolucao ASC`);
    const aguardando=[],decididos=[];
    for(const m of atrasados){
      const pen=await get('SELECT id,tipo,descricao,status,dias_bloqueio,criada_em,fim_em FROM penalidades WHERE emprestimo_id=? ORDER BY id DESC LIMIT 1',[m.emprestimo_id]);
      if(pen){m.penalidade=pen;decididos.push(m)}else aguardando.push(m);
    }
    const ativas=await get("SELECT COUNT(*) total FROM penalidades WHERE status='ativa'");
    res.json({aguardando,decididos,multas:aguardando,usuarios_com_multa:new Set(atrasados.map(x=>x.usuario_id)).size,total_atrasados:atrasados.length,total_aguardando:aguardando.length,penalidades_ativas:ativas.total});
  }catch(e){res.status(500).json({erro:e.message})}
});
app.put('/api/multas/:id/status',auth,only('gestao'),async(req,res)=>{try{const status=['pendente','paga','cancelada'].includes(req.body.status)?req.body.status:null;if(!status)return res.status(400).json({erro:'Status de multa inválido.'});const m=await get('SELECT * FROM multas WHERE id=?',[req.params.id]);if(!m)return res.status(404).json({erro:'Multa não encontrada.'});await run("UPDATE multas SET status=?,paga_em=CASE WHEN ?='paga' THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id=?",[status,status,m.id]);res.json(await get('SELECT * FROM multas WHERE id=?',[m.id]))}catch(e){res.status(400).json({erro:e.message})}});
app.get('/api/relatorios',auth,only('gestao'),async(req,res)=>{
  try{
    const periodo=await all(`SELECT date(data_emprestimo) dia,COUNT(*) total FROM emprestimos WHERE date(data_emprestimo)>=date('now','-29 day') GROUP BY date(data_emprestimo) ORDER BY dia`);
    const maisEmprestados=await all(`SELECT l.id,l.titulo,COUNT(*) emprestimos FROM emprestimos ep JOIN exemplares e ON e.id=ep.exemplar_id JOIN livros l ON l.id=e.livro_id GROUP BY l.id,l.titulo ORDER BY emprestimos DESC,l.titulo LIMIT 10`);
    const categorias=await all(`SELECT COALESCE(c.nome,'Sem categoria') categoria,COUNT(*) total FROM emprestimos ep JOIN exemplares e ON e.id=ep.exemplar_id JOIN livros l ON l.id=e.livro_id LEFT JOIN categorias c ON c.id=l.categoria_id GROUP BY c.id,c.nome ORDER BY total DESC`);
    const atendimentos=await get(`SELECT COUNT(*) total FROM emprestimos WHERE data_emprestimo>=datetime('now','-6 day')`);
    const media_semanal=Number((Number(atendimentos.total||0)/1).toFixed(0));
    res.json({periodo,mais_emprestados:maisEmprestados,categorias,media_semanal});
  }catch(e){res.status(500).json({erro:e.message})}
});
app.get('/api/relatorios/emprestimos.csv',auth,only('gestao'),async(req,res)=>{
  try{
    const rows=await all(`SELECT ep.id,u.nome usuario,u.email,l.titulo,l.autor,e.codigo,ep.data_emprestimo,ep.data_prevista_devolucao,ep.data_devolucao,ep.status FROM emprestimos ep JOIN leitores u ON u.id=ep.usuario_id JOIN exemplares e ON e.id=ep.exemplar_id JOIN livros l ON l.id=e.livro_id ORDER BY ep.data_emprestimo DESC`);
    const esc=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
    const csv='ID,Usuário,E-mail,Livro,Autor,Código,Empréstimo,Devolução prevista,Devolução,Status\n'+rows.map(r=>[r.id,r.usuario,r.email,r.titulo,r.autor,r.codigo,r.data_emprestimo,r.data_prevista_devolucao,r.data_devolucao,r.status].map(esc).join(',')).join('\n');
    res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="bibliobeta-emprestimos.csv"');res.send('\ufeff'+csv);
  }catch(e){res.status(500).json({erro:e.message})}
});

app.get('/api/favoritos',auth,async(req,res)=>res.json(await all('SELECT f.*,l.titulo,l.autor,l.capa FROM favoritos f JOIN livros l ON l.id=f.livro_id WHERE f.usuario_id=?',[req.usuario.id]))); app.post('/api/favoritos/:livroId',auth,async(req,res)=>{await run('INSERT OR IGNORE INTO favoritos(usuario_id,livro_id) VALUES(?,?)',[req.usuario.id,req.params.livroId]);res.json({ok:true})}); app.delete('/api/favoritos/:livroId',auth,async(req,res)=>{await run('DELETE FROM favoritos WHERE usuario_id=? AND livro_id=?',[req.usuario.id,req.params.livroId]);res.json({ok:true})});
app.get('/api/tempo-real',async(req,res)=>{
  try{
    const t=String(req.query.token||''); if(!t) return res.status(401).end();
    const u=jwt.verify(t,JWT_SECRET);
    const existe=await get('SELECT id FROM leitores WHERE id=?',[u.id]);
    res.set({'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
    if(!existe){ res.flushHeaders?.(); res.write(`event: conta_excluida\ndata: ${JSON.stringify({mensagem:'Sua conta foi excluída pela Gestão da biblioteca.'})}\n\n`); return res.end(); }
    const stAtual=await get('SELECT status FROM leitores WHERE id=?',[u.id]);
    if(stAtual&&stAtual.status==='inativo'){ res.flushHeaders?.(); res.write(`event: conta_desativada\ndata: ${JSON.stringify({mensagem:'Sua conta foi desativada pela Gestão da biblioteca.'})}\n\n`); return res.end(); }
    res.flushHeaders?.(); res.write(`event: conectado\ndata: ${JSON.stringify({ok:true})}\n\n`);
    registrarClienteTempoReal(u.id,res);
    const keep=setInterval(()=>{try{res.write(': ping\n\n')}catch{clearInterval(keep)}},25000);
    res.on('close',()=>clearInterval(keep));
  }catch{res.status(401).end();}
});
app.get('/api/notificacoes/preferencias',auth,async(req,res)=>{try{await run('INSERT OR IGNORE INTO preferencias_notificacao(usuario_id) VALUES(?)',[req.usuario.id]);res.json(await get('SELECT * FROM preferencias_notificacao WHERE usuario_id=?',[req.usuario.id]))}catch(e){res.status(500).json({erro:e.message})}});
app.put('/api/notificacoes/preferencias',auth,async(req,res)=>{try{await run('INSERT OR IGNORE INTO preferencias_notificacao(usuario_id) VALUES(?)',[req.usuario.id]);const campos=['livros','emprestimos','reservas','atrasos','devolucoes','cadastros','informativos'];const valores=campos.map(c=>Object.prototype.hasOwnProperty.call(req.body,c)?(req.body[c]?1:0):null);const atual=await get('SELECT * FROM preferencias_notificacao WHERE usuario_id=?',[req.usuario.id]);const v=campos.map((c,i)=>valores[i]===null?atual[c]:valores[i]);await run(`UPDATE preferencias_notificacao SET livros=?,emprestimos=?,reservas=?,atrasos=?,devolucoes=?,cadastros=?,informativos=?,atualizado_em=CURRENT_TIMESTAMP WHERE usuario_id=?`,[...v,req.usuario.id]);res.json(await get('SELECT * FROM preferencias_notificacao WHERE usuario_id=?',[req.usuario.id]))}catch(e){res.status(400).json({erro:e.message})}});

app.get('/api/notificacoes',auth,async(req,res)=>res.json(await all('SELECT * FROM notificacoes WHERE usuario_id=? ORDER BY criado_em DESC',[req.usuario.id])));
app.get('/api/notificacoes/nao-lidas/count',auth,async(req,res)=>res.json({total:(await get('SELECT COUNT(*) total FROM notificacoes WHERE usuario_id=? AND lida=0',[req.usuario.id])).total}));
app.put('/api/notificacoes/:id/lida',auth,async(req,res)=>{await run('UPDATE notificacoes SET lida=1 WHERE id=? AND usuario_id=?',[req.params.id,req.usuario.id]);res.json({ok:true})});
app.put('/api/notificacoes/marcar-todas-lidas',auth,async(req,res)=>{await run('UPDATE notificacoes SET lida=1 WHERE usuario_id=?',[req.usuario.id]);res.json({ok:true})});
app.post('/api/notificacoes',auth,only('gestao'),async(req,res)=>{try{const usuarioId=Number(req.body.usuario_id);const titulo=String(req.body.titulo||'').trim();const mensagem=String(req.body.mensagem||'').trim();if(!usuarioId||!titulo||!mensagem)return res.status(400).json({erro:'Destinatário, título e mensagem são obrigatórios.'});const alvo=await get("SELECT id,nome,email,status FROM leitores WHERE id=? AND status='ativo' LIMIT 1",[usuarioId]);if(!alvo)return res.status(404).json({erro:'Destinatário não encontrado ou inativo.'});await registrarNotificacao(usuarioId,titulo,mensagem,req.body.tipo||'info',{enviar:true,assunto:req.body.assunto||`BiblioBeta — ${titulo}`});res.status(201).json({ok:true,email_enviado:'processado'})}catch(e){res.status(400).json({erro:e.message})}});
app.get('/api/turmas',auth,only('gestao'),async(req,res)=>res.json(await all(`SELECT t.*, (SELECT COUNT(*) FROM alunos a WHERE TRIM(COALESCE(a.turma,''))=t.nome) alunos FROM turmas t ORDER BY t.status DESC,t.ano,t.nome`)));
app.post('/api/turmas',auth,only('gestao'),async(req,res)=>{try{const nome=String(req.body.nome||'').trim();if(!nome)return res.status(400).json({erro:'Nome da turma é obrigatório.'});const ano=Number(req.body.ano)||null;const etapa=String(req.body.etapa||'').trim()||null;const r=await run("INSERT INTO turmas(nome,ano,etapa,status) VALUES(?,?,?,'ativo')",[nome,ano,etapa]);res.status(201).json(await get('SELECT * FROM turmas WHERE id=?',[r.id]))}catch(e){res.status(400).json({erro:e.message})}});
app.put('/api/turmas/:id',auth,only('gestao'),async(req,res)=>{try{const nome=String(req.body.nome||'').trim();if(!nome)return res.status(400).json({erro:'Nome da turma é obrigatório.'});const atual=await get('SELECT nome FROM turmas WHERE id=?',[req.params.id]);if(!atual)return res.status(404).json({erro:'Turma não encontrada.'});const ano=Number(req.body.ano)||null,etapa=String(req.body.etapa||'').trim()||null;await run('UPDATE turmas SET nome=?,ano=?,etapa=?,status=? WHERE id=?',[nome,ano,etapa,req.body.status==='inativo'?'inativo':'ativo',req.params.id]);if(atual.nome!==nome)await run("UPDATE alunos SET turma=? WHERE TRIM(COALESCE(turma,''))=?",[nome,atual.nome]);res.json(await get('SELECT * FROM turmas WHERE id=?',[req.params.id]))}catch(e){res.status(400).json({erro:e.message})}});
app.delete('/api/turmas/:id',auth,only('gestao'),async(req,res)=>{try{const t=await get('SELECT nome FROM turmas WHERE id=?',[req.params.id]);if(!t)return res.status(404).json({erro:'Turma não encontrada.'});const usados=(await get("SELECT COUNT(*) total FROM alunos WHERE TRIM(COALESCE(turma,''))=?",[t.nome])).total;if(usados>0)return res.status(409).json({erro:'A turma possui alunos. Transfira os alunos antes de desativá-la.'});await run("UPDATE turmas SET status='inativo' WHERE id=?",[req.params.id]);res.json({ok:true})}catch(e){res.status(400).json({erro:e.message})}});
app.get('/api/configuracoes',auth,only('gestao'),async(req,res)=>res.json(await get('SELECT * FROM configuracoes WHERE id=1')));
// ---- E-mails automáticos por categoria (somente administrador da Gestão) ----
app.get('/api/configuracoes/email-categorias',auth,only('gestao'),onlyAdmin,async(req,res)=>{
  try{
    const regras=await all('SELECT * FROM email_categorias');
    const porId=new Map(regras.map(r=>[r.categoria,r]));
    res.json(CATEGORIAS_EMAIL.map(c=>{const r=porId.get(c.id)||{};return {...c,ativo:r.ativo===undefined?1:r.ativo,para_aluno:r.para_aluno===undefined?1:r.para_aluno,para_professor:r.para_professor===undefined?1:r.para_professor,para_gestao:r.para_gestao===undefined?1:r.para_gestao};}));
  }catch(e){res.status(500).json({erro:e.message})}
});
app.put('/api/configuracoes/email-categorias',auth,only('gestao'),onlyAdmin,async(req,res)=>{
  try{
    const lista=Array.isArray(req.body&&req.body.regras)?req.body.regras:null;
    if(!lista)return res.status(400).json({erro:'Envie a lista de regras.'});
    for(const r of lista){
      if(!r||!IDS_CATEGORIAS_EMAIL.has(r.categoria))continue;
      await run('INSERT INTO email_categorias(categoria,ativo,para_aluno,para_professor,para_gestao,atualizado_em) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(categoria) DO UPDATE SET ativo=excluded.ativo,para_aluno=excluded.para_aluno,para_professor=excluded.para_professor,para_gestao=excluded.para_gestao,atualizado_em=CURRENT_TIMESTAMP',[r.categoria,r.ativo?1:0,r.para_aluno?1:0,r.para_professor?1:0,r.para_gestao?1:0]);
    }
    res.json({ok:true});
  }catch(e){res.status(400).json({erro:e.message})}
});
app.get('/api/configuracoes/mensagens-automaticas',auth,only('gestao'),onlyAdmin,(req,res)=>res.json(MENSAGENS_AUTOMATICAS.map((m,i)=>({id:i,...m,categoria_nome:(CATEGORIAS_EMAIL.find(c=>c.id===m.categoria)||{}).nome||m.categoria}))));
// Envia uma mensagem de uma categoria para um grupo de usuários cadastrados (aviso no painel + e-mail).
app.post('/api/configuracoes/email-categorias/enviar',auth,only('gestao'),onlyAdmin,async(req,res)=>{
  try{
    const b=req.body||{};
    const categoria=IDS_CATEGORIAS_EMAIL.has(b.categoria)?b.categoria:'informativo';
    const titulo=String(b.titulo||'').trim().slice(0,120), mensagem=String(b.mensagem||'').trim().slice(0,2000);
    if(!titulo||!mensagem)return res.status(400).json({erro:'Informe o título e a mensagem.'});
    const filtros={leitores:"tipo IN ('aluno','professor')",alunos:"tipo='aluno'",professores:"tipo='professor'",gestao:"tipo='gestao'",todos:"tipo IN ('aluno','professor','gestao')"};
    let alvos;
    if(b.destinatarios==='usuario'){
      alvos=await all("SELECT id FROM leitores WHERE id=? AND status='ativo'",[Number(b.usuario_id)||0]);
      if(!alvos.length)return res.status(404).json({erro:'Usuário não encontrado ou inativo.'});
    }else{
      const filtro=filtros[b.destinatarios];
      if(!filtro)return res.status(400).json({erro:'Escolha quem deve receber a mensagem.'});
      alvos=await all(`SELECT id FROM leitores WHERE status='ativo' AND ${filtro}`);
    }
    if(!alvos.length)return res.status(404).json({erro:'Nenhum usuário ativo nesse grupo.'});
    res.status(202).json({ok:true,total:alvos.length,mensagem:`Enviando para ${alvos.length} usuário(s).`});
    // Envio em segundo plano, um e-mail por vez, para não estourar o limite do Gmail.
    (async()=>{for(const a of alvos){try{await registrarNotificacao(a.id,titulo,mensagem,'info',{categoria,forcar:true,aguardar:true,assunto:`BiblioBeta — ${titulo}`});}catch(e){console.error('Envio por categoria:',e.message);}}})();
  }catch(e){if(!res.headersSent)res.status(400).json({erro:e.message})}
});
app.get('/api/configuracoes/status-email',auth,only('gestao'),onlyAdmin,async(req,res)=>{
  try{ res.json({
    gestao:{configurado:smtpConfigurado('gestao'),usuario:process.env.SMTP_USER||null},
    usuarios:{configurado:smtpConfigurado('usuarios'),usuario:process.env.SMTP_USER_ALUNOS||process.env.SMTP_USER||null,usa_conta_propria:!!String(process.env.SMTP_USER_ALUNOS||'').trim()},
    ultimo_sucesso_em:statusEmail.ultimoSucessoEm,
    ultimo_erro:statusEmail.ultimoErro,
    ultimo_erro_em:statusEmail.ultimoErroEm,
    falhas_seguidas:statusEmail.totalFalhasSeguidas,
    pendentes_reenvio:(await get('SELECT COUNT(*) total FROM email_fila')).total
  }); }catch(e){ res.status(500).json({erro:e.message}); }
});
app.post('/api/configuracoes/teste-email',auth,only('gestao'),onlyAdmin,async(req,res)=>{
  try{
    if(!smtpConfigurado('gestao')) return res.status(503).json({erro:'Gmail SMTP não configurado. Preencha SMTP_USER e SMTP_PASS no backend/.env.'});
    const u=await get("SELECT nome,email FROM leitores WHERE id=? AND tipo='gestao' AND status='ativo'",[req.usuario.id]);
    if(!u || !emailValido(u.email)) return res.status(400).json({erro:'A conta da Gestão precisa ter um e-mail válido.'});
    await enviarEmailSMTP({
      to:u.email,
      codigo:'',
      conta:'gestao',
      subject:'BiblioBeta — teste de e-mail (Gestão)',
      text:`Olá, ${u.nome||'Gestão'}!\n\nEste é um e-mail de teste do BiblioBeta (conta da Gestão). Se você recebeu esta mensagem, o envio pelo Gmail está funcionando corretamente.\n\nConta remetente: ${process.env.SMTP_USER}\n\nBiblioBeta — Gestão`,
      html:montarEmailBiblioBeta({nome:u.nome,titulo:'Teste de e-mail (Gestão)',mensagem:'Este é um e-mail de teste do BiblioBeta, enviado pela conta da Gestão. Se você recebeu esta mensagem, o envio pelo Gmail está funcionando corretamente.',tipo:'info',detalhes:[{label:'Remetente',valor:process.env.SMTP_USER},{label:'Status',valor:'Envio SMTP realizado com sucesso'}]})
    });
    statusEmail.ultimoSucessoEm=new Date().toISOString();
    statusEmail.totalFalhasSeguidas=0;
    res.json({ok:true,mensagem:`E-mail de teste enviado para ${u.email}.`});
  }catch(e){
    statusEmail.ultimoErro=e.message;
    statusEmail.ultimoErroEm=new Date().toISOString();
    statusEmail.totalFalhasSeguidas++;
    console.error('Erro no teste de e-mail:',e);
    res.status(502).json({erro:`Falha no envio pelo Gmail: ${e.message}`});
  }
});
app.post('/api/configuracoes/teste-email-usuarios',auth,only('gestao'),onlyAdmin,async(req,res)=>{
  try{
    if(!smtpConfigurado('usuarios')) return res.status(503).json({erro:'Conta de e-mail de alunos/professores não configurada. Preencha SMTP_USER_ALUNOS e SMTP_PASS_ALUNOS no backend/.env (ou deixe em branco para usar a conta da Gestão).'});
    const destino=email(req.body.email||'');
    if(!emailValido(destino)) return res.status(400).json({erro:'Informe um e-mail válido para receber o teste.'});
    await enviarEmailSMTP({
      to:destino,
      codigo:'',
      conta:'usuarios',
      subject:'BiblioBeta — teste de e-mail (Alunos/Professores)',
      text:`Olá!\n\nEste é um e-mail de teste do BiblioBeta (conta de alunos/professores). Se você recebeu esta mensagem, o envio pelo Gmail está funcionando corretamente.\n\nConta remetente: ${process.env.SMTP_USER_ALUNOS || process.env.SMTP_USER}\n\nBiblioBeta`,
      html:montarEmailBiblioBeta({nome:'',titulo:'Teste de e-mail (Alunos/Professores)',mensagem:'Este é um e-mail de teste do BiblioBeta, enviado pela conta de alunos/professores. Se você recebeu esta mensagem, o envio pelo Gmail está funcionando corretamente.',tipo:'info',detalhes:[{label:'Status',valor:'Envio SMTP realizado com sucesso'}]})
    });
    statusEmail.ultimoSucessoEm=new Date().toISOString();
    statusEmail.totalFalhasSeguidas=0;
    res.json({ok:true,mensagem:`E-mail de teste enviado para ${destino}.`});
  }catch(e){
    statusEmail.ultimoErro=e.message;
    statusEmail.ultimoErroEm=new Date().toISOString();
    statusEmail.totalFalhasSeguidas++;
    console.error('Erro no teste de e-mail (usuários):',e);
    res.status(502).json({erro:`Falha no envio pelo Gmail: ${e.message}`});
  }
});
 app.put('/api/configuracoes',auth,only('gestao'),onlyAdmin,async(req,res)=>{const b=req.body;await run('UPDATE configuracoes SET dias_emprestimo=?,limite_livros_aluno=?,limite_livros_professor=?,maximo_renovacoes=?,permitir_reservas=? WHERE id=1',[b.dias_emprestimo,b.limite_livros_aluno,b.limite_livros_professor,b.maximo_renovacoes,b.permitir_reservas?1:0]);res.json(await get('SELECT * FROM configuracoes WHERE id=1'))});
// Excluir aluno/professor (somente administrador). Bloqueia se houver empréstimo em aberto ou
// multa pendente; o histórico de empréstimos devolvidos e as reservas da pessoa são apagados junto.
app.delete('/api/usuarios/:id',auth,only('gestao'),onlyAdmin,async(req,res)=>{
  try{
    const u=await get("SELECT id,nome,tipo FROM leitores WHERE id=? AND tipo IN ('aluno','professor')",[req.params.id]);
    if(!u) return res.status(404).json({erro:'Leitor não encontrado.'});
    const aberto=await get("SELECT COUNT(*) total FROM emprestimos WHERE usuario_id=? AND status!='devolvido'",[u.id]);
    if(Number(aberto.total)>0) return res.status(409).json({erro:`${u.nome} ainda tem ${aberto.total} empréstimo(s) em aberto. Registre a devolução antes de excluir.`});
    const multa=await get("SELECT COUNT(*) total FROM multas WHERE usuario_id=? AND status='pendente'",[u.id]);
    if(Number(multa.total)>0) return res.status(409).json({erro:`${u.nome} possui multa pendente. Quite ou cancele a multa antes de excluir.`});
    await run('DELETE FROM reservas WHERE usuario_id=?',[u.id]);
    await run('DELETE FROM emprestimos WHERE usuario_id=?',[u.id]);
    await run('DELETE FROM leitores WHERE id=?',[u.id]);
    avisarContaExcluida(u.id);
    res.json({ok:true,mensagem:`${u.nome} foi excluído(a).`});
  }catch(e){res.status(400).json({erro:e.message})}
});

// Equipe da Gestão (somente administrador): várias pessoas podem ter acesso ao mesmo tempo.
app.get('/api/equipe-gestao',auth,only('gestao'),onlyAdmin,async(req,res)=>{
  const lista=await all("SELECT l.id,l.nome,l.email,l.status,l.criado_em,l.ultimo_acesso,COALESCE(g.nivel_acesso,'gestao') nivel FROM leitores l LEFT JOIN gestao g ON g.usuario_id=l.id WHERE l.tipo='gestao' ORDER BY CASE l.status WHEN 'pendente' THEN 0 ELSE 1 END,l.nome");
  res.json(lista.map(x=>({...x,nivel:x.nivel==='bibliotecario'?'bibliotecario':'admin',voce:x.id===req.usuario.id})));
});
app.post('/api/equipe-gestao',auth,only('gestao'),onlyAdmin,async(req,res)=>{
  try{
    const nome=String(req.body.nome||'').trim(),em=email(req.body.email),nivel=req.body.nivel==='admin'?'admin':'bibliotecario';
    if(nome.length<3||!nome.includes(' ')) return res.status(400).json({erro:'Informe o nome completo.'});
    if(!emailValido(em)) return res.status(400).json({erro:'Informe um e-mail válido.'});
    if(!senhaValida(req.body.senha)) return res.status(400).json({erro:'A senha deve ter no mínimo 8 caracteres, incluindo maiúscula, minúscula, número e símbolo.'});
    if(await get('SELECT id FROM leitores WHERE email=?',[em])) return res.status(409).json({erro:'Este e-mail já está cadastrado.'});
    const h=await bcrypt.hash(String(req.body.senha),10);
    const r=await run("INSERT INTO leitores(nome,email,senha_hash,tipo,status) VALUES(?,?,?,'gestao','ativo')",[nome,em,h]);
    await run('INSERT INTO gestao(usuario_id,cargo,nivel_acesso) VALUES(?,?,?)',[r.id,nivel==='admin'?'Administrador':'Bibliotecário',nivel]);
    await run('INSERT OR IGNORE INTO preferencias_notificacao(usuario_id) VALUES(?)',[r.id]);
    res.status(201).json({ok:true,id:r.id});
  }catch(e){res.status(400).json({erro:e.message})}
});
app.put('/api/equipe-gestao/:id',auth,only('gestao'),onlyAdmin,async(req,res)=>{
  try{
    const alvo=await get("SELECT l.id,l.nome,l.status,COALESCE(g.nivel_acesso,'gestao') nivel FROM leitores l LEFT JOIN gestao g ON g.usuario_id=l.id WHERE l.id=? AND l.tipo='gestao'",[req.params.id]);
    if(!alvo) return res.status(404).json({erro:'Membro da Gestão não encontrado.'});
    const nivel=req.body.nivel===undefined?(alvo.nivel==='bibliotecario'?'bibliotecario':'admin'):(req.body.nivel==='admin'?'admin':'bibliotecario');
    const status=req.body.status===undefined?alvo.status:(['ativo','inativo'].includes(req.body.status)?req.body.status:null);
    if(!status) return res.status(400).json({erro:'Status inválido.'});
    if(alvo.id===req.usuario.id&&(nivel!=='admin'||status!=='ativo')) return res.status(400).json({erro:'Você não pode rebaixar nem desativar a sua própria conta.'});
    const outrosAdmins=await get("SELECT COUNT(*) total FROM leitores l JOIN gestao g ON g.usuario_id=l.id WHERE l.tipo='gestao' AND l.status='ativo' AND COALESCE(g.nivel_acesso,'gestao')<>'bibliotecario' AND l.id<>?",[alvo.id]);
    if(Number(outrosAdmins.total)===0&&(nivel!=='admin'||status!=='ativo')) return res.status(400).json({erro:'Precisa existir pelo menos um administrador ativo.'});
    await run('UPDATE leitores SET status=? WHERE id=?',[status,alvo.id]);if(status==='inativo'&&alvo.status!=='inativo')avisarContaDesativada(alvo.id);
    await run('INSERT OR IGNORE INTO gestao(usuario_id,cargo,nivel_acesso) VALUES(?,?,?)',[alvo.id,null,nivel]);
    await run('UPDATE gestao SET nivel_acesso=?,cargo=? WHERE usuario_id=?',[nivel,nivel==='admin'?'Administrador':'Bibliotecário',alvo.id]);
    if(alvo.status==='pendente'&&status==='ativo') await registrarNotificacao(alvo.id,'Acesso à Gestão aprovado','Seu acesso à Gestão foi aprovado. Você já pode entrar.','info',{categoria:'cadastro',assunto:'BiblioBeta — acesso à Gestão aprovado'});
    res.json({ok:true,status,nivel});
  }catch(e){res.status(400).json({erro:e.message})}
});
app.get('/api/alunos',auth,only('gestao'),async(req,res)=>res.json(await all(`SELECT u.id,u.nome,u.email,u.telefone,u.status,u.criado_em,a.ra,a.etapa,a.serie,a.turma,a.numero_chamada FROM leitores u JOIN alunos a ON a.usuario_id=u.id WHERE u.tipo='aluno' ORDER BY a.serie,a.turma,u.nome`)));
app.get('/api/cadastros-recentes',auth,only('gestao'),async(req,res)=>res.json(await all(`SELECT l.id,l.nome,l.email,l.email_alternativo,l.telefone,l.tipo,l.status,l.criado_em,a.ra,a.ra_digito,a.etapa,a.serie,a.turma,a.numero_chamada,p.matricula,p.disciplina FROM leitores l LEFT JOIN alunos a ON a.usuario_id=l.id LEFT JOIN professores p ON p.usuario_id=l.id WHERE l.tipo IN ('aluno','professor') AND l.status='ativo' ORDER BY l.criado_em DESC,l.nome LIMIT 50`)));app.get('/api/usuarios',auth,only('gestao'),async(req,res)=>res.json(await all("SELECT id,nome,email,email_alternativo,telefone,tipo,status,criado_em FROM leitores WHERE tipo IN ('aluno','professor') ORDER BY criado_em DESC,nome"))); app.get('/api/dashboard',auth,only('gestao'),async(req,res)=>{const d=await get(`SELECT (SELECT COUNT(*) FROM leitores WHERE tipo IN ('aluno','professor')) usuarios,(SELECT COUNT(*) FROM leitores WHERE tipo IN ('aluno','professor') AND status='pendente') cadastros_pendentes,(SELECT COUNT(*) FROM livros WHERE ativo=1) livros,(SELECT COUNT(*) FROM exemplares WHERE status='disponivel') exemplares_disponiveis,(SELECT COUNT(*) FROM emprestimos WHERE status IN ('ativo','atrasado')) emprestimos_ativos,(SELECT COUNT(*) FROM exemplares WHERE status='emprestado') exemplares_emprestados,(SELECT COUNT(*) FROM emprestimos WHERE status!='devolvido' AND data_prevista_devolucao<CURRENT_TIMESTAMP) atrasados,(SELECT COUNT(*) FROM reservas WHERE status IN ('fila','pronto')) reservas`);res.json({...d,leitores:d.usuarios})});
app.use((req,res)=>res.status(404).json({erro:'Rota não encontrada.'}));
// O SQLite em modo WAL guarda as últimas alterações num arquivo à parte (database.sqlite-wal).
// Se só o database.sqlite for copiado/compactado, essas alterações (ex.: capas e livros recentes) ficam de fora.
// Por isso o banco é "fechado" (checkpoint) ao iniciar, a cada 2 minutos e ao encerrar.
function checkpointBanco(){ try{ db.run('PRAGMA wal_checkpoint(TRUNCATE)'); }catch(_){} }
setInterval(checkpointBanco,120000).unref();
setTimeout(checkpointBanco,15000).unref();
for(const sig of ['SIGINT','SIGTERM','SIGBREAK']){ try{ process.on(sig,()=>{ try{ db.run('PRAGMA wal_checkpoint(TRUNCATE)',()=>db.close(()=>process.exit(0))); setTimeout(()=>process.exit(0),3000).unref(); }catch(_){ process.exit(0); } }); }catch(_){} }
app.listen(PORT,'0.0.0.0',()=>console.log(`BiblioBeta API rodando na porta ${PORT} (rede local habilitada)`));
setInterval(()=>{processarFilaEmail();},60*1000);