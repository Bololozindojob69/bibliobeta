# BiblioBeta — MySQL

Este backend foi preparado para usar MySQL no lugar do SQLite.

## Configuração
1. Copie `.env.example` para `.env`.
2. Preencha `MYSQL_PASSWORD` com a senha do seu usuário MySQL.
3. Confirme que o banco `bibliobeta` contém as tabelas migradas do SQLite.
4. Execute `npm install`.
5. Execute `npm start`.

O servidor testa a conexão com o MySQL antes de abrir a API na porta 3000.

O arquivo `database.sqlite` pode ser mantido como backup, mas não é mais usado pelo servidor.
