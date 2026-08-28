# BiblioBeta — Backend de teste

Backend inicial para integrar o frontend HTML/CSS/JS do BiblioBeta a um banco SQLite.

## Requisitos

- Node.js 18+ recomendado
- npm

## Instalação

Dentro desta pasta:

```bash
npm install
npm start
```

A API ficará em:

`http://localhost:3000`

Teste de saúde:

`GET http://localhost:3000/api/health`

## Usuário de teste

- E-mail: `aluno@bibliobeta.local`
- Senha: `123456`
- Tipo: `aluno`

Escola e livros básicos são criados automaticamente na primeira execução.

## Cadastro

`POST /api/cadastro`

Exemplo aluno:

```json
{
  "tipo": "aluno",
  "nome": "João da Silva",
  "telefone": "11999999999",
  "ra": "123456-8",
  "serie": "3º ano do Ensino Médio",
  "turma": "A",
  "email": "joao@example.com",
  "senha": "123456"
}
```

Professor:

```json
{
  "tipo": "professor",
  "nome": "Maria Professora",
  "telefone": "11988888888",
  "email": "maria@example.com",
  "senha": "123456",
  "matricula": "PROF001",
  "disciplina": "Português"
}
```

Gestão:

```json
{
  "tipo": "gestao",
  "nome": "Administrador BiblioBeta",
  "telefone": "11977777777",
  "email": "gestao@example.com",
  "senha": "123456",
  "data_nascimento": "1990-01-01",
  "rg": "123456789",
  "cargo": "Gestor",
  "nivel_acesso": "gestao"
}
```

## Login

`POST /api/auth/login`

```json
{
  "email": "aluno@bibliobeta.local",
  "senha": "123456",
  "tipo": "aluno"
}
```

A resposta retorna um JWT. Nas próximas requisições protegidas, use:

`Authorization: Bearer SEU_TOKEN`

## Observação

A senha nunca é salva em texto puro: o backend usa `bcryptjs` para armazenar o hash.

A chave JWT presente no código é apenas para desenvolvimento. Em produção, defina `JWT_SECRET` como variável de ambiente.
