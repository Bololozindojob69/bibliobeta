# Backend BiblioBeta

Abra o terminal nesta pasta e rode:

```bash
npm install
npm start
```

Depois acesse `http://localhost:3000`.


## Gmail SMTP — recuperação de senha

O BiblioBeta mantém usuários, senhas e códigos de recuperação no SQLite. O Gmail é usado somente para enviar o código de recuperação.

No `backend/.env`, configure:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=bibliobeta20@gmail.com
SMTP_PASS=COLOQUE_AQUI_A_SENHA_DE_APP
SMTP_FROM=BiblioBeta <bibliobeta20@gmail.com>
```

`SMTP_PASS` deve ser a Senha de app do Google (16 caracteres), e nunca deve ser colocada no frontend ou enviada pelo chat.

Não é necessário Firebase/Firestore/Blaze para esse envio. O servidor usa SMTP diretamente e não adiciona dependência npm para o envio.


### Recuperação de senha por Gmail SMTP
O código é enviado por SMTP para o e-mail cadastrado. O frontend mantém o código apenas em memória para enviá-lo ao endpoint de redefinição; o SQLite armazena somente o hash.


## Gmail oficial e notificações por e-mail

O BiblioBeta está preparado para usar `bibliobeta20@gmail.com` como remetente oficial.
O sistema envia por e-mail os códigos de recuperação de senha e também pode enviar as notificações do sistema (reservas, devoluções e atrasos).

**Importante:** o Gmail não deve usar a senha normal da conta no SMTP. Use uma **Senha de app do Google** (16 caracteres), mantenha-a somente no arquivo `backend/.env` e nunca coloque essa senha no frontend.

No `backend/.env`:
- `SMTP_USER=bibliobeta20@gmail.com`
- `SMTP_FROM=BiblioBeta <bibliobeta20@gmail.com>`
- `SMTP_PASS=COLOQUE_AQUI_A_SENHA_DE_APP_DO_GOOGLE`

As notificações continuam aparecendo dentro do BiblioBeta e, quando configuradas para e-mail, também são enviadas para o endereço cadastrado do usuário.
