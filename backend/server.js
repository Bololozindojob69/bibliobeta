const path=require('path'),fs=require('fs'),crypto=require('crypto'),express=require('express'),cors=require('cors'),bcrypt=require('bcryptjs'),jwt=require('jsonwebtoken'),sqlite3=require('sqlite3').verbose();
const PORT=process.env.PORT||3000, JWT_SECRET=process.env.JWT_SECRET||'troque-esta-chave-em-producao', DB_PATH=path.join(__dirname,'database.sqlite'), FRONTEND_PATH=path.join(__dirname,'..','Frontend');
const app=express(); app.use(cors()); app.use(express.json()); app.use(express.urlencoded({extended:true})); const db=new sqlite3.Database(DB_PATH);
const run=(sql,p=[])=>new Promise((res,rej)=>db.run(sql,p,function(e){e?rej(e):res({id:this.lastID,changes:this.changes})})); const get=(sql,p=[])=>new Promise((res,rej)=>db.get(sql,p,(e,r)=>e?rej(e):res(r))); const all=(sql,p=[])=>new Promise((res,rej)=>db.all(sql,p,(e,r)=>e?rej(e):res(r)));
function email(v){return String(v||'').trim().toLowerCase()}
function senhaValida(s){
  s=String(s||'');
  return s.length>=8 && /[A-Z]/.test(s) && /[a-z]/.test(s) && /\d/.test(s) && /[^A-Za-z0-9]/.test(s);
}
function emailValido(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||''))}
function politicaEmail(v,tipo){
  const em=email(v);
  if(!emailValido(em)) return {ok:false,erro:'Informe um e-mail válido.'};
  // Alunos podem usar e-mail normal ou um dos dois domínios institucionais oficiais aceitos.
  if(tipo==='aluno'){
    const dominio=em.split('@')[1];
    const institucionais=['aluno.educacao.sp.gov.br','al.educacao.sp.gov.br'];
    if(institucionais.includes(dominio)) return {ok:true,tipo:'institucional'};
    return {ok:true,tipo:'normal'};
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
} function token(u){return jwt.sign({id:u.id,tipo:u.tipo},JWT_SECRET,{expiresIn:'8h'})} function auth(req,res,next){try{const t=(req.headers.authorization||'').split(' ')[1];if(!t)throw 0;req.usuario=jwt.verify(t,JWT_SECRET);next()}catch{return res.status(401).json({erro:'Token inválido ou não informado.'})}} function only(...tipos){return (req,res,next)=>tipos.includes(req.usuario.tipo)?next():res.status(403).json({erro:'Sem permissão.'})}
async function perfil(u){let p=null;if(u.tipo==='aluno')p=await get('SELECT * FROM alunos WHERE usuario_id=?',[u.id]);if(u.tipo==='professor')p=await get('SELECT * FROM professores WHERE usuario_id=?',[u.id]);if(u.tipo==='gestao')p=await get('SELECT * FROM gestao WHERE usuario_id=?',[u.id]);return {...u,senha_hash:undefined,perfil:p}}
async function seed(){
  await run("UPDATE alunos SET ra=REPLACE(ra,'-','') WHERE ra LIKE '%-%'");
  await run('INSERT OR IGNORE INTO configuracoes(id) VALUES(1)');
  for(const c of ['Literatura','Ficção','História','Ciências','Infantil'])
    await run('INSERT OR IGNORE INTO categorias(nome) VALUES(?)',[c]);

  // Contas oficiais de demonstração. Elas são sincronizadas em todo início
  // para evitar que uma senha/tipo antigo no SQLite faça um dos três logins falhar.
  async function ensureDemo({email:em,nome,telefone='',senha,tipo,perfil={}}){
    em=email(em);
    let u=await get('SELECT id FROM usuarios WHERE email=?',[em]);
    const h=scryptHash(senha);
    let id;
    if(!u){
      const r=await run("INSERT INTO usuarios(nome,email,telefone,senha_hash,tipo,status) VALUES(?,?,?,?,?,'ativo')",[nome,em,telefone,h,tipo]);
      id=r.id;
    }else{
      id=u.id;
      await run("UPDATE usuarios SET nome=?,telefone=?,senha_hash=?,tipo=?,status='ativo' WHERE id=?",[nome,telefone,h,tipo,id]);
    }
    if(tipo==='gestao'){
      await run('INSERT OR IGNORE INTO gestao(usuario_id,cargo,nivel_acesso) VALUES(?,?,?)',[id,'Administrador','gestao']);
      await run('UPDATE gestao SET cargo=?,nivel_acesso=? WHERE usuario_id=?',['Administrador','gestao',id]);
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

  await ensureDemo({email:'gestao@bibliobeta.local',nome:'Gestão BiblioBeta',senha:'Vasco123!',tipo:'gestao'});
  await ensureDemo({email:'aluno@bibliobeta.local',nome:'Aluno Demonstração',senha:'123456',tipo:'aluno',perfil:{ra:'0123456789',serie:'3º ano',turma:'A'}});
  await ensureDemo({email:'carla.pires@escola.com',nome:'Carla Pires',senha:'123456',tipo:'professor',perfil:{matricula:'CP-001',disciplina:'Literatura'}});
  await ensureDemo({email:'sophialarabc18@gmail.com',nome:'Sophia lara bezerra cavalcanti',senha:'Sophia3004',tipo:'aluno',perfil:{ra:'1114501815',serie:'3º ano',turma:'A'}});
}
app.use(express.static(FRONTEND_PATH));
app.get('/',(req,res)=>res.sendFile(path.join(FRONTEND_PATH,'Index.html')));

db.serialize(()=>{db.run('PRAGMA foreign_keys=ON');db.exec(fs.readFileSync(path.join(__dirname,'schema.sql'),'utf8'),e=>{if(e)throw e;seed().then(()=>console.log('Banco SQLite pronto:',DB_PATH))})});
app.get('/api/health',async(req,res)=>res.json({ok:true,banco:'SQLite',usuarios:(await get('SELECT COUNT(*) total FROM usuarios')).total}));
app.post('/api/auth/login',async(req,res)=>{try{const identificador=String(req.body.email||'').trim();const em=email(identificador);const ra=identificador.replace(/\D/g,'');const u=await get("SELECT u.* FROM usuarios u LEFT JOIN alunos a ON a.usuario_id=u.id WHERE u.status='ativo' AND (LOWER(u.email)=? OR (u.tipo='aluno' AND a.ra=?)) LIMIT 1",[em,ra]);if(!u||!(await verifyPassword(String(req.body.senha||''),u.senha_hash)))return res.status(401).json({erro:'E-mail/RA ou senha inválidos.'});if(req.body.tipo&&u.tipo!==req.body.tipo)return res.status(401).json({erro:'Tipo de usuário não corresponde.'});res.json({mensagem:'Login realizado.',token:token(u),usuario:await perfil(u)})}catch(e){res.status(500).json({erro:e.message})}});
app.get('/api/auth/me',auth,async(req,res)=>{const u=await get('SELECT * FROM usuarios WHERE id=?',[req.usuario.id]);res.json({usuario:await perfil(u)})});
app.post('/api/cadastro',async(req,res)=>{
  const {nome,telefone,senha,tipo}=req.body; const em=email(req.body.email);
  const raBase=String(req.body.ra||'').replace(/\D/g,''); const raDig=String(req.body.ra_digito||'').replace(/\D/g,'');
  // Se o RA já vier completo (10 dígitos), não duplica o dígito verificador.
  const ra=(raBase.length>=10?raBase:raBase+raDig).slice(0,10); const turmaInformada=String(req.body.turma||'').trim();
  // RA deve conter somente números (sem hífen, letras ou espaços), mantendo zeros à esquerda.
  if(tipo==='aluno' && !/^\d{10}$/.test(ra)) return res.status(400).json({erro:'RA inválido. Use somente números, de 10 dígitos, sem hífen ou espaços.'});
  if(!['aluno','professor','gestao'].includes(tipo)) return res.status(400).json({erro:'Tipo de cadastro inválido.'});
  if(!String(nome||'').trim() || String(nome).trim().length<3 || !String(nome).trim().includes(' ')) return res.status(400).json({erro:'Informe o nome completo.'});
  const emailCheck=politicaEmail(em,tipo);
  if(!emailCheck.ok) return res.status(400).json({erro:emailCheck.erro});
  if(!senhaValida(senha)) return res.status(400).json({erro:'A senha deve ter no mínimo 8 caracteres, incluindo maiúscula, minúscula, número e símbolo.'});
  if(Object.prototype.hasOwnProperty.call(req.body,'confirmar_senha') && String(req.body.confirmar_senha)!==String(senha)) return res.status(400).json({erro:'As senhas não coincidem.'});
  if(tipo==='aluno'&&(!ra||!turmaInformada)) return res.status(400).json({erro:'RA e Série / Turma são obrigatórios.'});
  let serie=String(req.body.serie||'').trim()||null, turma=turmaInformada||null;
  if(tipo==='aluno'&&!serie&&turma){ const m=turma.match(/^(.+?)\s*[-–—/]?\s*(?:turma\s*)?([A-Za-z0-9]+)$/i); if(m&&m[1].trim().match(/ano|º|°|serie|série/i)){serie=m[1].trim();turma=m[2].trim().toUpperCase();} }
  try {
    await run('BEGIN TRANSACTION');
    const h=await bcrypt.hash(String(senha),10);
    const r=await run('INSERT INTO usuarios(nome,email,telefone,senha_hash,tipo,status) VALUES(?,?,?,?,?,?)',[String(nome).trim(),em,telefone||null,h,tipo,'ativo']);
    if(tipo==='aluno') await run('INSERT INTO alunos(usuario_id,ra,serie,turma,numero_chamada) VALUES(?,?,?,?,?)',[r.id,ra,serie,turma,req.body.numero_chamada||null]);
    if(tipo==='professor') await run('INSERT INTO professores(usuario_id,matricula,disciplina) VALUES(?,?,?)',[r.id,null,null]);
    if(tipo==='gestao') await run('INSERT INTO gestao(usuario_id,cargo,nivel_acesso) VALUES(?,?,?)',[r.id,null,'gestao']);
    await run('COMMIT');
    const u=await get('SELECT * FROM usuarios WHERE id=?',[r.id]);
    return res.status(201).json({mensagem:'Cadastro realizado com sucesso.',token:token(u),usuario:await perfil(u)});
  } catch(e) {
    try{await run('ROLLBACK')}catch(_){}
    if(String(e.message).includes('usuarios.email')) return res.status(409).json({erro:'Este e-mail já está cadastrado.'});
    if(String(e.message).includes('alunos.ra')) return res.status(409).json({erro:'Este RA já está cadastrado.'});
    return res.status(400).json({erro:'Não foi possível concluir o cadastro: '+e.message});
  }
});
app.get('/api/categorias',auth,async(req,res)=>res.json(await all('SELECT * FROM categorias ORDER BY nome'))); app.post('/api/categorias',auth,only('gestao'),async(req,res)=>{const r=await run('INSERT INTO categorias(nome,descricao) VALUES(?,?)',[req.body.nome,req.body.descricao||null]);res.status(201).json(await get('SELECT * FROM categorias WHERE id=?',[r.id]))});
app.get('/api/livros',auth,async(req,res)=>{const q='%'+String(req.query.busca||'')+'%';res.json(await all(`SELECT l.*,c.nome categoria,(SELECT COUNT(*) FROM exemplares e WHERE e.livro_id=l.id AND e.status='disponivel') disponiveis,(SELECT COUNT(*) FROM exemplares e WHERE e.livro_id=l.id) quantidade FROM livros l LEFT JOIN categorias c ON c.id=l.categoria_id WHERE l.ativo=1 AND (l.titulo LIKE ? OR l.autor LIKE ? OR l.isbn LIKE ?) ORDER BY l.titulo`,[q,q,q]))});
app.post('/api/livros',auth,only('gestao'),async(req,res)=>{const b=req.body,r=await run('INSERT INTO livros(categoria_id,titulo,autor,editora,isbn,ano_publicacao,descricao,capa) VALUES(?,?,?,?,?,?,?,?)',[b.categoria_id||null,b.titulo,b.autor,b.editora||null,b.isbn||null,b.ano_publicacao||null,b.descricao||null,b.capa||null]);res.status(201).json(await get('SELECT * FROM livros WHERE id=?',[r.id]))}); app.put('/api/livros/:id',auth,only('gestao'),async(req,res)=>{const b=req.body;await run('UPDATE livros SET categoria_id=?,titulo=?,autor=?,editora=?,isbn=?,ano_publicacao=?,descricao=?,capa=? WHERE id=?',[b.categoria_id||null,b.titulo,b.autor,b.editora||null,b.isbn||null,b.ano_publicacao||null,b.descricao||null,b.capa||null,req.params.id]);res.json(await get('SELECT * FROM livros WHERE id=?',[req.params.id]))}); app.delete('/api/livros/:id',auth,only('gestao'),async(req,res)=>{await run('UPDATE livros SET ativo=0 WHERE id=?',[req.params.id]);res.json({ok:true})});
app.get('/api/livros/:id/exemplares',auth,async(req,res)=>res.json(await all('SELECT e.*,lo.nome localizacao FROM exemplares e LEFT JOIN localizacoes lo ON lo.id=e.localizacao_id WHERE livro_id=?',[req.params.id]))); app.post('/api/livros/:id/exemplares',auth,only('gestao'),async(req,res)=>{const b=req.body,r=await run('INSERT INTO exemplares(livro_id,localizacao_id,codigo,observacao) VALUES(?,?,?,?)',[req.params.id,b.localizacao_id||null,b.codigo,b.observacao||null]);res.status(201).json(await get('SELECT * FROM exemplares WHERE id=?',[r.id]))});
app.post('/api/emprestimos',auth,only('gestao'),async(req,res)=>{try{const {usuario_id,exemplar_id}=req.body,e=await get("SELECT * FROM exemplares WHERE id=? AND status='disponivel'",[exemplar_id]);if(!e)return res.status(400).json({erro:'Exemplar indisponível.'});const u=await get('SELECT tipo FROM usuarios WHERE id=?',[usuario_id]),cfg=await get('SELECT * FROM configuracoes WHERE id=1'),lim=u.tipo==='aluno'?cfg.limite_livros_aluno:cfg.limite_livros_professor,at=(await get("SELECT COUNT(*) total FROM emprestimos WHERE usuario_id=? AND status IN ('ativo','atrasado')",[usuario_id])).total;if(at>=lim)return res.status(400).json({erro:'Limite de empréstimos atingido.'});const data=new Date(Date.now()+cfg.dias_emprestimo*86400000).toISOString(),r=await run('INSERT INTO emprestimos(usuario_id,exemplar_id,data_prevista_devolucao) VALUES(?,?,?)',[usuario_id,exemplar_id,data]);await run("UPDATE exemplares SET status='emprestado' WHERE id=?",[exemplar_id]);res.status(201).json(await get('SELECT * FROM emprestimos WHERE id=?',[r.id]))}catch(e){res.status(400).json({erro:e.message})}});
app.get('/api/emprestimos/meus',auth,async(req,res)=>res.json(await all(`SELECT ep.*,l.titulo,l.autor,l.capa,e.codigo FROM emprestimos ep JOIN exemplares e ON e.id=ep.exemplar_id JOIN livros l ON l.id=e.livro_id WHERE ep.usuario_id=? ORDER BY ep.data_emprestimo DESC`,[req.usuario.id]))); app.get('/api/emprestimos',auth,only('gestao'),async(req,res)=>res.json(await all(`SELECT ep.*,u.nome usuario,l.titulo,e.codigo FROM emprestimos ep JOIN usuarios u ON u.id=ep.usuario_id JOIN exemplares e ON e.id=ep.exemplar_id JOIN livros l ON l.id=e.livro_id ORDER BY ep.data_emprestimo DESC`)));
app.post('/api/emprestimos/:id/devolver',auth,only('gestao'),async(req,res)=>{const ep=await get("SELECT * FROM emprestimos WHERE id=? AND status!='devolvido'",[req.params.id]);if(!ep)return res.status(404).json({erro:'Empréstimo não encontrado.'});await run("UPDATE emprestimos SET status='devolvido',data_devolucao=CURRENT_TIMESTAMP WHERE id=?",[ep.id]);await run("UPDATE exemplares SET status='disponivel' WHERE id=?",[ep.exemplar_id]);res.json({ok:true})}); app.post('/api/emprestimos/:id/renovar',auth,async(req,res)=>{const ep=await get('SELECT * FROM emprestimos WHERE id=?',[req.params.id]);if(!ep||ep.usuario_id!==req.usuario.id)return res.status(404).json({erro:'Empréstimo não encontrado.'});const c=await get('SELECT * FROM configuracoes WHERE id=1');if(ep.renovacoes>=c.maximo_renovacoes)return res.status(400).json({erro:'Limite de renovações atingido.'});const d=new Date(Date.now()+c.dias_emprestimo*86400000).toISOString();await run("UPDATE emprestimos SET renovacoes=renovacoes+1,data_prevista_devolucao=?,status='ativo' WHERE id=?",[d,ep.id]);res.json({ok:true})});
app.get('/api/reservas/minhas',auth,async(req,res)=>res.json(await all('SELECT r.*,l.titulo,l.autor,l.capa FROM reservas r JOIN livros l ON l.id=r.livro_id WHERE r.usuario_id=? ORDER BY r.data_reserva DESC',[req.usuario.id]))); app.post('/api/reservas',auth,async(req,res)=>{const l=await get('SELECT id FROM livros WHERE id=? AND ativo=1',[req.body.livro_id]);if(!l)return res.status(404).json({erro:'Livro não encontrado.'});const r=await run('INSERT INTO reservas(usuario_id,livro_id) VALUES(?,?)',[req.usuario.id,l.id]);res.status(201).json(await get('SELECT * FROM reservas WHERE id=?',[r.id]))}); app.delete('/api/reservas/:id',auth,async(req,res)=>{await run("UPDATE reservas SET status='cancelada' WHERE id=? AND usuario_id=?",[req.params.id,req.usuario.id]);res.json({ok:true})}); app.get('/api/reservas',auth,only('gestao'),async(req,res)=>res.json(await all('SELECT r.*,u.nome usuario,l.titulo FROM reservas r JOIN usuarios u ON u.id=r.usuario_id JOIN livros l ON l.id=r.livro_id ORDER BY r.data_reserva')));
app.get('/api/favoritos',auth,async(req,res)=>res.json(await all('SELECT f.*,l.titulo,l.autor,l.capa FROM favoritos f JOIN livros l ON l.id=f.livro_id WHERE f.usuario_id=?',[req.usuario.id]))); app.post('/api/favoritos/:livroId',auth,async(req,res)=>{await run('INSERT OR IGNORE INTO favoritos(usuario_id,livro_id) VALUES(?,?)',[req.usuario.id,req.params.livroId]);res.json({ok:true})}); app.delete('/api/favoritos/:livroId',auth,async(req,res)=>{await run('DELETE FROM favoritos WHERE usuario_id=? AND livro_id=?',[req.usuario.id,req.params.livroId]);res.json({ok:true})});
app.get('/api/notificacoes',auth,async(req,res)=>res.json(await all('SELECT * FROM notificacoes WHERE usuario_id=? ORDER BY criado_em DESC',[req.usuario.id]))); app.post('/api/notificacoes',auth,only('gestao'),async(req,res)=>{const r=await run('INSERT INTO notificacoes(usuario_id,titulo,mensagem,tipo) VALUES(?,?,?,?)',[req.body.usuario_id,req.body.titulo,req.body.mensagem,req.body.tipo||'info']);res.status(201).json(await get('SELECT * FROM notificacoes WHERE id=?',[r.id]))});
app.get('/api/configuracoes',auth,only('gestao'),async(req,res)=>res.json(await get('SELECT * FROM configuracoes WHERE id=1'))); app.put('/api/configuracoes',auth,only('gestao'),async(req,res)=>{const b=req.body;await run('UPDATE configuracoes SET dias_emprestimo=?,limite_livros_aluno=?,limite_livros_professor=?,maximo_renovacoes=?,permitir_reservas=? WHERE id=1',[b.dias_emprestimo,b.limite_livros_aluno,b.limite_livros_professor,b.maximo_renovacoes,b.permitir_reservas?1:0]);res.json(await get('SELECT * FROM configuracoes WHERE id=1'))});
app.get('/api/alunos',auth,only('gestao'),async(req,res)=>res.json(await all(`SELECT u.id,u.nome,u.email,u.telefone,u.status,u.criado_em,a.ra,a.serie,a.turma,a.numero_chamada FROM usuarios u JOIN alunos a ON a.usuario_id=u.id WHERE u.tipo='aluno' ORDER BY a.serie,a.turma,u.nome`)));
app.get('/api/usuarios',auth,only('gestao'),async(req,res)=>res.json(await all('SELECT id,nome,email,telefone,tipo,status,criado_em FROM usuarios ORDER BY nome'))); app.get('/api/dashboard',auth,only('gestao'),async(req,res)=>{const one=async s=>(await get(s)).total;res.json({usuarios:await one('SELECT COUNT(*) total FROM usuarios'),livros:await one('SELECT COUNT(*) total FROM livros WHERE ativo=1'),exemplares_disponiveis:await one("SELECT COUNT(*) total FROM exemplares WHERE status='disponivel'"),emprestimos_ativos:await one("SELECT COUNT(*) total FROM emprestimos WHERE status IN ('ativo','atrasado')"),atrasados:await one("SELECT COUNT(*) total FROM emprestimos WHERE status!='devolvido' AND data_prevista_devolucao<CURRENT_TIMESTAMP"),reservas:await one("SELECT COUNT(*) total FROM reservas WHERE status IN ('fila','pronto')")})});
app.use((req,res)=>res.status(404).json({erro:'Rota não encontrada.'})); app.listen(PORT,()=>console.log(`BiblioBeta API rodando em http://localhost:${PORT}`));
