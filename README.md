# BiblioBeta — versão corrigida

## Como iniciar no Windows

1. Instale o Node.js LTS.
2. Abra o terminal nesta pasta: `backend`.
3. Execute `npm install`.
4. Execute `npm start`.
5. Abra no navegador: `http://localhost:3000`

Não abra `Frontend/Index.html` com duplo clique. O sistema agora serve o Frontend pelo próprio backend, e o login usa a API relativa `/api`.

### Contas de teste
- Gestão: `gestao@bibliobeta.local` / `Vasco123!`
- Aluno: `aluno@bibliobeta.local` / `123456`
- Professor: `carla.pires@escola.com` / `123456`
- Sophia: `sophialarabc18@gmail.com` / `Sophia3004`

O banco SQLite já está incluído em `backend/database.sqlite`.


Conta Sophia: sophialarabc18@gmail.com / Sophia3004. A senha é armazenada com hash e o login valida a senha cadastrada.


### Login e senhas

O banco usa hash de senha e o backend aceita tanto as senhas antigas em bcrypt quanto as novas em scrypt.

**Regra importante:** ao iniciar o sistema, as contas de demonstração existentes são apenas reativadas se necessário. O sistema **não sobrescreve a senha de uma conta existente**. Portanto, uma senha escolhida pelo usuário continua funcionando depois de reiniciar o servidor.

Contas de teste incluídas nesta versão:
- Gestão: `gestao@bibliobeta.local` / `Vasco123!`
- Sophia: `sophialarabc18@gmail.com` / `Sophia3004`

Novos cadastros usam a senha informada no próprio cadastro.


## Política de e-mail

- Alunos podem cadastrar e-mail normal ou institucional.
- Domínios institucionais de aluno reconhecidos: `@aluno.educacao.sp.gov.br` e `@al.educacao.sp.gov.br`.
- E-mails são normalizados para minúsculas e espaços são removidos antes do cadastro e login.
- O mesmo e-mail não pode ser usado por duas contas.
