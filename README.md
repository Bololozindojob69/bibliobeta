# BiblioBeta — V1.4 Teste em Tempo Real

Sistema de biblioteca escolar para teste local em computadores da mesma rede.

## Como iniciar

1. No computador que será o **servidor**, extraia o ZIP.
2. Execute **Iniciar BiblioBeta.bat**.
3. Aguarde aparecer no terminal que a API está rodando na porta **3000**.
4. No próprio servidor, abra:
   `http://127.0.0.1:3000`

## Teste em dois notebooks

Os dois computadores precisam estar conectados à **mesma rede da escola**.

No computador servidor, descubra o IPv4 com `ipconfig`. Exemplo:

`192.168.1.25`

No segundo notebook, abra:

`http://192.168.1.25:3000`

> Não use `192.168.15.15` na escola. Esse era o IP da rede de casa e pode mudar em outra rede.

## Tempo real

A V1.4 usa atualização em tempo real para eventos da biblioteca.

Exemplo de teste:
- Notebook 2: faça uma solicitação de empréstimo.
- Notebook 1: confira a solicitação sem precisar apertar F5.
- Depois aprove a solicitação no Notebook 1 e confira a atualização no Notebook 2.

## Se o segundo notebook não acessar

- confirme que os dois estão na mesma Wi-Fi/rede;
- confira o IPv4 do computador servidor;
- use o IPv4 correto seguido de `:3000`;
- se necessário, permita o Node.js/porta 3000 no Firewall do Windows.

## Observação

Este pacote é para **teste local**. Para acessar o BiblioBeta de redes diferentes (por exemplo, escola e casa), será necessário publicar o sistema em um servidor acessível pela internet.

O pacote não inclui `node_modules` nem o banco SQLite pronto. O script de inicialização prepara as dependências/banco conforme a configuração do projeto.

## Novidades da versão 0.5

**Gêneros dos livros**
- Cada livro pode ter vários gêneros (Fantasia, Romance, Feminismo, Cultura Afro-brasileira...). Os 10 livros que já estavam no banco já receberam seus gêneros.
- Gestão: no cadastro/edição do livro há chips para escolher os gêneros. Ao buscar pelo ISBN o sistema sugere o gênero lendo a categoria que a API (BrasilAPI / Google Books / Open Library) devolve. O botão **Detectar gêneros** (tela Livros) faz isso para todos os livros sem gênero.
- API: `GET /api/generos`, `GET /api/livros?genero=Fantasia` (também aceita o id), `POST /api/livros/:id/detectar-generos`, `POST /api/generos/detectar-todos`. O campo `generos` vem em cada livro.
- Alunos e professores: o catálogo tem a galeria de gêneros e prateleiras por gênero.

**Multas e punições (Gestão > Multas)**
- Passou do prazo? A pessoa aparece sozinha em "Aguardando decisão", com o número no menu.
- A Gestão escolhe: advertência, bloqueio de 3/7/15 dias, bloqueio até devolver, ou dispensar. A punição sugerida muda conforme os dias de atraso.
- Enquanto há bloqueio, a pessoa não consegue solicitar nem receber empréstimo. O bloqueio por dias termina sozinho; o "até devolver" termina quando o livro é devolvido.
