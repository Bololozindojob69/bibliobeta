CREATE DATABASE IF NOT EXISTS bibliobeta CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE bibliobeta;

CREATE TABLE IF NOT EXISTS escolas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  cnpj VARCHAR(30) UNIQUE,
  codigo_inep VARCHAR(30) UNIQUE,
  telefone VARCHAR(30),
  email VARCHAR(255),
  cep VARCHAR(20),
  estado VARCHAR(100),
  cidade VARCHAR(150),
  endereco VARCHAR(255),
  numero VARCHAR(30),
  complemento VARCHAR(255),
  diretor VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'ativa',
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  escola_id INT NOT NULL,
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  telefone VARCHAR(30),
  senha_hash VARCHAR(255) NOT NULL,
  tipo ENUM('aluno','professor','gestao') NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ativo',
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_usuarios_escola FOREIGN KEY (escola_id) REFERENCES escolas(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS alunos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL UNIQUE,
  escola_id INT NOT NULL,
  ra VARCHAR(50) NOT NULL UNIQUE,
  serie VARCHAR(100),
  turma VARCHAR(50),
  numero_chamada INT,
  CONSTRAINT fk_alunos_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_alunos_escola FOREIGN KEY (escola_id) REFERENCES escolas(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS professores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL UNIQUE,
  escola_id INT NOT NULL,
  matricula VARCHAR(50) UNIQUE,
  disciplina VARCHAR(150),
  CONSTRAINT fk_professores_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_professores_escola FOREIGN KEY (escola_id) REFERENCES escolas(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS administradores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL UNIQUE,
  escola_id INT NOT NULL,
  data_nascimento VARCHAR(30),
  rg VARCHAR(50),
  cargo VARCHAR(150),
  nivel_acesso VARCHAR(50) NOT NULL DEFAULT 'gestao',
  CONSTRAINT fk_admin_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  CONSTRAINT fk_admin_escola FOREIGN KEY (escola_id) REFERENCES escolas(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS livros (
  id INT AUTO_INCREMENT PRIMARY KEY,
  escola_id INT NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  autor VARCHAR(255) NOT NULL,
  editora VARCHAR(255),
  isbn VARCHAR(50),
  ano_publicacao INT,
  categoria VARCHAR(150),
  descricao TEXT,
  capa TEXT,
  quantidade INT NOT NULL DEFAULT 1,
  disponiveis INT NOT NULL DEFAULT 1,
  ativo TINYINT NOT NULL DEFAULT 1,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_livros_escola FOREIGN KEY (escola_id) REFERENCES escolas(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_alunos_ra ON alunos(ra);
CREATE INDEX idx_livros_titulo ON livros(titulo);
