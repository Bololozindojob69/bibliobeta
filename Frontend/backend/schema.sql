PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS escolas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  cnpj TEXT UNIQUE,
  codigo_inep TEXT UNIQUE,
  telefone TEXT,
  email TEXT,
  cep TEXT,
  estado TEXT,
  cidade TEXT,
  endereco TEXT,
  numero TEXT,
  complemento TEXT,
  diretor TEXT,
  status TEXT NOT NULL DEFAULT 'ativa',
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  escola_id INTEGER NOT NULL,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  telefone TEXT,
  senha_hash TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('aluno','professor','gestao')),
  status TEXT NOT NULL DEFAULT 'ativo',
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (escola_id) REFERENCES escolas(id)
);

CREATE TABLE IF NOT EXISTS alunos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL UNIQUE,
  escola_id INTEGER NOT NULL,
  ra TEXT NOT NULL UNIQUE,
  serie TEXT,
  turma TEXT,
  numero_chamada INTEGER,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (escola_id) REFERENCES escolas(id)
);

CREATE TABLE IF NOT EXISTS professores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL UNIQUE,
  escola_id INTEGER NOT NULL,
  matricula TEXT UNIQUE,
  disciplina TEXT,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (escola_id) REFERENCES escolas(id)
);

CREATE TABLE IF NOT EXISTS administradores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL UNIQUE,
  escola_id INTEGER NOT NULL,
  data_nascimento TEXT,
  rg TEXT,
  cargo TEXT,
  nivel_acesso TEXT NOT NULL DEFAULT 'gestao',
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (escola_id) REFERENCES escolas(id)
);

CREATE TABLE IF NOT EXISTS livros (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  escola_id INTEGER NOT NULL,
  titulo TEXT NOT NULL,
  autor TEXT NOT NULL,
  editora TEXT,
  isbn TEXT,
  ano_publicacao INTEGER,
  categoria TEXT,
  descricao TEXT,
  capa TEXT,
  quantidade INTEGER NOT NULL DEFAULT 1,
  disponiveis INTEGER NOT NULL DEFAULT 1,
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (escola_id) REFERENCES escolas(id)
);

CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_alunos_ra ON alunos(ra);
CREATE INDEX IF NOT EXISTS idx_livros_titulo ON livros(titulo);
