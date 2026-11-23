@echo off
chcp 65001 >nul
title BiblioBeta - Enviar e-mails agora
cd /d "%~dp0backend"
echo ==========================================
echo   BiblioBeta - ENVIAR E-MAILS AGORA
echo ==========================================
echo.
echo  1 = Reenviar avisos importantes dos ultimos 7 dias (todos os alunos)
echo  2 = Enviar um aviso escrito por voce (todos os alunos)
echo  3 = Reenviar avisos para UM e-mail especifico
echo  4 = SIMULAR a opcao 1 (nao envia nada, so mostra)
echo.
set /p op=Escolha 1, 2, 3 ou 4: 
if "%op%"=="1" node reenviar-emails.js --para=alunos --pendentes --dias=7
if "%op%"=="2" (
  set /p assunto=Titulo do aviso: 
  set /p msg=Mensagem: 
  node reenviar-emails.js --para=alunos "--assunto=%assunto%" "--mensagem=%msg%"
)
if "%op%"=="3" (
  set /p quem=E-mail do aluno: 
  node reenviar-emails.js --para=%quem% --pendentes --dias=30
)
if "%op%"=="4" node reenviar-emails.js --para=alunos --pendentes --dias=7 --simular
echo.
pause
