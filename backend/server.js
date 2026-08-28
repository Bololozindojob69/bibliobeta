require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'bibliobeta-chave-de-teste-troque-em-producao';

const db = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'bibliobeta',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
});

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

async function run(sql, params = []) {
  const [result] = await db.execute(sql, params);
  return { id: result.insertId, changes: result.affectedRows };
}

async function get(sql, params = []) {
  const [rows] = await db.execute(sql, params);
  return rows[0];
}

async function all(sql, params = []) {
  const [rows] = await db.execute(sql, params);
  return rows;
}

async function testarBanco() {
  const [rows] = await db.query('SELECT 1 AS ok');
  if (!rows[0]?.ok) throw new Error('MySQL não respondeu corretamente.');
  console.log('MySQL conectado com sucesso.');
  console.log(`Banco utilizado: ${process.env.MYSQL_DATABASE || 'bibliobeta'}`);
}

function normalizarEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function gerarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, escola_id: usuario.escola_id, tipo: usuario.tipo },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const [tipo, token] = header.split(' ');
  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({ erro: 'Token não informado.' });
  }

  try {
    req.usuario = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ erro: 'Token inválido ou expirado.' });
  }
}

function validarCadastro(body) {
  const { tipo, nome, telefone, email, senha } = body;
  if (!['aluno', 'professor', 'gestao'].includes(tipo)) return 'Tipo de usuário inválido.';
  if (!nome || String(nome).trim().length < 3) return 'Nome completo é obrigatório.';
  if (!email || !String(email).includes('@')) return 'E-mail inválido.';
  if (!senha || String(senha).length < 6) return 'A senha deve ter ao menos 6 caracteres.';
  if (!telefone) return 'Telefone é obrigatório.';
  if (tipo === 'aluno' && !body.ra) return 'RA é obrigatório para aluno.';
  if (tipo === 'aluno' && !body.turma) return 'Série/Turma é obrigatória para aluno.';
  return null;
}

// ---------- Saúde ----------
app.get('/api/health', async (req, res) => {
  const row = await get('SELECT COUNT(*) AS total FROM usuarios');
  res.json({ ok: true, banco: 'MySQL', usuarios: row.total });
});

// ---------- Autenticação ----------
app.post('/api/auth/login', async (req, res) => {
  try {
    const email = normalizarEmail(req.body.email);
    const senha = String(req.body.senha || '');
    const tipo = req.body.tipo ? String(req.body.tipo) : null;

    if (!email || !senha) return res.status(400).json({ erro: 'E-mail e senha são obrigatórios.' });

    let usuario = await get(`SELECT * FROM usuarios WHERE email = ? AND status = 'ativo'`, [email]);
    if (!usuario) return res.status(401).json({ erro: 'E-mail ou senha inválidos.' });
    if (tipo && usuario.tipo !== tipo) return res.status(401).json({ erro: 'Tipo de usuário não corresponde à conta.' });

    const senhaOk = await bcrypt.compare(senha, usuario.senha_hash);
    if (!senhaOk) return res.status(401).json({ erro: 'E-mail ou senha inválidos.' });

    const token = gerarToken(usuario);
    const perfil = await getPerfil(usuario);

    res.json({
      mensagem: 'Login realizado com sucesso.',
      token,
      usuario: perfil
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro interno no login.' });
  }
});

app.get('/api/auth/me', auth, async (req, res) => {
  const usuario = await get('SELECT id, escola_id, nome, email, telefone, tipo, status, criado_em FROM usuarios WHERE id = ?', [req.usuario.id]);
  if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });
  res.json({ usuario: await getPerfil(usuario) });
});

async function getPerfil(usuario) {
  const escola = await get('SELECT * FROM escolas WHERE id = ?', [usuario.escola_id]);
  let perfil = null;
  if (usuario.tipo === 'aluno') perfil = await get('SELECT * FROM alunos WHERE usuario_id = ?', [usuario.id]);
  if (usuario.tipo === 'professor') perfil = await get('SELECT * FROM professores WHERE usuario_id = ?', [usuario.id]);
  if (usuario.tipo === 'gestao') perfil = await get('SELECT * FROM administradores WHERE usuario_id = ?', [usuario.id]);
  return {
    id: usuario.id,
    escola_id: usuario.escola_id,
    nome: usuario.nome,
    email: usuario.email,
    telefone: usuario.telefone,
    tipo: usuario.tipo,
    status: usuario.status,
    escola,
    perfil
  };
}

// ---------- Cadastro de usuários ----------
app.post('/api/cadastro', async (req, res) => {
  const erro = validarCadastro(req.body);
  if (erro) return res.status(400).json({ erro });

  const tipo = req.body.tipo;
  const nome = String(req.body.nome).trim();
  const telefone = String(req.body.telefone).trim();
  const email = normalizarEmail(req.body.email);
  const senha = String(req.body.senha);

  try {
    const escola = req.body.escola_id
      ? await get('SELECT id FROM escolas WHERE id = ? AND status = \'ativa\'', [req.body.escola_id])
      : await get('SELECT id FROM escolas WHERE status = \'ativa\' ORDER BY id LIMIT 1');

    if (!escola) return res.status(400).json({ erro: 'Escola não encontrada.' });

    const existente = await get('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (existente) return res.status(409).json({ erro: 'Este e-mail já está cadastrado.' });

    if (tipo === 'aluno') {
      const ra = String(req.body.ra).trim();
      const raExistente = await get('SELECT id FROM alunos WHERE ra = ?', [ra]);
      if (raExistente) return res.status(409).json({ erro: 'Este RA já está cadastrado.' });
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [usuarioResult] = await connection.execute(`INSERT INTO usuarios
        (escola_id, nome, email, telefone, senha_hash, tipo)
        VALUES (?, ?, ?, ?, ?, ?)`, [escola.id, nome, email, telefone, senhaHash, tipo]);

      if (tipo === 'aluno') {
        await connection.execute(`INSERT INTO alunos
          (usuario_id, escola_id, ra, serie, turma, numero_chamada)
          VALUES (?, ?, ?, ?, ?, ?)`, [
          usuarioResult.insertId,
          escola.id,
          String(req.body.ra).trim(),
          req.body.serie || req.body.turma || null,
          req.body.turma || null,
          req.body.numero_chamada || null
        ]);
      }

      if (tipo === 'professor') {
        await connection.execute(`INSERT INTO professores
          (usuario_id, escola_id, matricula, disciplina)
          VALUES (?, ?, ?, ?)`, [
          usuarioResult.insertId,
          escola.id,
          req.body.matricula || null,
          req.body.disciplina || null
        ]);
      }

      if (tipo === 'gestao') {
        await connection.execute(`INSERT INTO administradores
          (usuario_id, escola_id, data_nascimento, rg, cargo, nivel_acesso)
          VALUES (?, ?, ?, ?, ?, ?)`, [
          usuarioResult.insertId,
          escola.id,
          req.body.data_nascimento || null,
          req.body.rg || null,
          req.body.cargo || null,
          req.body.nivel_acesso || 'gestao'
        ]);
      }

      await connection.commit();

      const usuario = await get('SELECT id, escola_id, nome, email, telefone, tipo, status, criado_em FROM usuarios WHERE id = ?', [usuarioResult.insertId]);
      const token = gerarToken(usuario);
      res.status(201).json({
        mensagem: 'Cadastro realizado com sucesso.',
        token,
        usuario: await getPerfil(usuario)
      });
    } catch (err) {
      await connection.rollback().catch(() => {});
      throw err;
    } finally {
      connection.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao realizar cadastro.' });
  }
});

// ---------- Escolas ----------
app.get('/api/escolas', auth, async (req, res) => {
  const escolas = await all('SELECT * FROM escolas ORDER BY nome');
  res.json(escolas);
});

app.post('/api/escolas', auth, async (req, res) => {
  if (req.usuario.tipo !== 'gestao') return res.status(403).json({ erro: 'Apenas gestão pode cadastrar escola.' });
  const { nome } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome da escola é obrigatório.' });
  try {
    const result = await run(`INSERT INTO escolas
      (nome, cnpj, codigo_inep, telefone, email, cep, estado, cidade, endereco, numero, complemento, diretor)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      nome, req.body.cnpj || null, req.body.codigo_inep || null,
      req.body.telefone || null, req.body.email || null, req.body.cep || null,
      req.body.estado || null, req.body.cidade || null, req.body.endereco || null,
      req.body.numero || null, req.body.complemento || null, req.body.diretor || null
    ]);
    const escola = await get('SELECT * FROM escolas WHERE id = ?', [result.id]);
    res.status(201).json(escola);
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
});

// ---------- Livros: já deixa o catálogo pronto para o próximo passo ----------
app.get('/api/livros', auth, async (req, res) => {
  const busca = String(req.query.busca || '').trim();
  const categoria = String(req.query.categoria || '').trim();
  const params = [req.usuario.escola_id];
  let sql = 'SELECT * FROM livros WHERE escola_id = ? AND ativo = 1';
  if (busca) {
    sql += ' AND (titulo LIKE ? OR autor LIKE ? OR descricao LIKE ?)';
    const q = `%${busca}%`;
    params.push(q, q, q);
  }
  if (categoria) {
    sql += ' AND categoria = ?';
    params.push(categoria);
  }
  sql += ' ORDER BY titulo';
  res.json(await all(sql, params));
});

// ---------- 404 e erros ----------
app.use((req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor.' });
});

async function iniciarServidor() {
  try {
    await testarBanco();
    app.listen(PORT, () => {
      console.log(`BiblioBeta API rodando em http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Erro ao conectar ao MySQL:', err.message);
    console.error('Confira MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD e MYSQL_DATABASE.');
    process.exit(1);
  }
}

iniciarServidor();

process.on('SIGINT', async () => {
  await db.end();
  process.exit(0);
});
