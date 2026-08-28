const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'bibliobeta-chave-de-teste-troque-em-producao';
const DB_PATH = path.join(__dirname, 'database.sqlite');
const FRONTEND_ROOT = path.resolve(__dirname, '..');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON');
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema, (err) => {
    if (err) {
      console.error('Erro ao criar tabelas:', err.message);
      process.exit(1);
    }
    seedDatabase();
  });
});

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
  });
}

async function seedDatabase() {
  try {
    let escola = await get('SELECT id FROM escolas ORDER BY id LIMIT 1');
    if (!escola) {
      const result = await run(`INSERT INTO escolas
        (nome, telefone, email, cidade, estado, endereco, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)`, [
        'BiblioBeta - Escola de Teste',
        '(11) 99999-9999',
        'escola@bibliobeta.local',
        'São Paulo',
        'SP',
        'Rua de Teste, 100',
        'ativa'
      ]);
      escola = { id: result.id };
    }

    const livros = [
      ['Dom Casmurro', 'Machado de Assis', 'Literatura', 5],
      ['O Pequeno Príncipe', 'Antoine de Saint-Exupéry', 'Infantil', 4],
      ['1984', 'George Orwell', 'Ficção', 3]
    ];

    for (const [titulo, autor, categoria, quantidade] of livros) {
      const exists = await get('SELECT id FROM livros WHERE escola_id = ? AND titulo = ?', [escola.id, titulo]);
      if (!exists) {
        await run(`INSERT INTO livros
          (escola_id, titulo, autor, categoria, quantidade, disponiveis)
          VALUES (?, ?, ?, ?, ?, ?)`, [escola.id, titulo, autor, categoria, quantidade, quantidade]);
      }
    }

    const demoEmail = 'aluno@bibliobeta.local';
    const userExists = await get('SELECT id FROM usuarios WHERE email = ?', [demoEmail]);
    if (!userExists) {
      const senhaHash = await bcrypt.hash('123456', 10);
      const result = await run(`INSERT INTO usuarios
        (escola_id, nome, email, telefone, senha_hash, tipo)
        VALUES (?, ?, ?, ?, ?, 'aluno')`, [
        escola.id,
        'Aluno Demonstração',
        demoEmail,
        '(11) 98888-8888',
        senhaHash
      ]);
      await run(`INSERT INTO alunos
        (usuario_id, escola_id, ra, serie, turma)
        VALUES (?, ?, ?, ?, ?)`, [
        result.id,
        escola.id,
        '123456-7',
        '3º ano do Ensino Médio',
        'A'
      ]);
    }

    console.log(`Banco SQLite pronto: ${DB_PATH}`);
    console.log('Usuário de teste: aluno@bibliobeta.local / 123456');
  } catch (err) {
    console.error('Erro no seed:', err.message);
  }
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
  res.json({ ok: true, banco: 'SQLite', usuarios: row.total });
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

    await run('BEGIN TRANSACTION');
    try {
      const usuarioResult = await run(`INSERT INTO usuarios
        (escola_id, nome, email, telefone, senha_hash, tipo)
        VALUES (?, ?, ?, ?, ?, ?)`, [escola.id, nome, email, telefone, senhaHash, tipo]);

      if (tipo === 'aluno') {
        await run(`INSERT INTO alunos
          (usuario_id, escola_id, ra, serie, turma, numero_chamada)
          VALUES (?, ?, ?, ?, ?, ?)`, [
          usuarioResult.id,
          escola.id,
          String(req.body.ra).trim(),
          req.body.serie || req.body.turma || null,
          req.body.turma || null,
          req.body.numero_chamada || null
        ]);
      }

      if (tipo === 'professor') {
        await run(`INSERT INTO professores
          (usuario_id, escola_id, matricula, disciplina)
          VALUES (?, ?, ?, ?)`, [
          usuarioResult.id,
          escola.id,
          req.body.matricula || null,
          req.body.disciplina || null
        ]);
      }

      if (tipo === 'gestao') {
        await run(`INSERT INTO administradores
          (usuario_id, escola_id, data_nascimento, rg, cargo, nivel_acesso)
          VALUES (?, ?, ?, ?, ?, ?)`, [
          usuarioResult.id,
          escola.id,
          req.body.data_nascimento || null,
          req.body.rg || null,
          req.body.cargo || null,
          req.body.nivel_acesso || 'gestao'
        ]);
      }

      await run('COMMIT');

      const usuario = await get('SELECT id, escola_id, nome, email, telefone, tipo, status, criado_em FROM usuarios WHERE id = ?', [usuarioResult.id]);
      const token = gerarToken(usuario);
      res.status(201).json({
        mensagem: 'Cadastro realizado com sucesso.',
        token,
        usuario: await getPerfil(usuario)
      });
    } catch (err) {
      await run('ROLLBACK').catch(() => {});
      throw err;
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

app.listen(PORT, () => {
  console.log(`BiblioBeta API rodando em http://localhost:${PORT}`);
});

process.on('SIGINT', () => {
  db.close(() => process.exit(0));
});
