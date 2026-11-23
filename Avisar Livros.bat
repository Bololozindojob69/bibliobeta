@echo off
chcp 65001 >nul
title BiblioBeta - Aviso de livros por e-mail
cd /d "%~dp0backend"
echo ==========================================
echo   BiblioBeta - AVISO DE LIVROS POR E-MAIL
echo ==========================================
echo.
echo  1 = Livros NOVOS dos ultimos 7 dias (todos os alunos)
echo  2 = Livros NOVOS dos ultimos 30 dias (todos os alunos)
echo  3 = Lista do ACERVO COMPLETO (todos os alunos)
echo  4 = Livros novos dos ultimos 7 dias para UM e-mail so
echo  5 = SIMULAR a opcao 2 (nao envia nada, so mostra)
echo.
set /p op=Escolha 1, 2, 3, 4 ou 5: 
if "%op%"=="1" node avisar-livros.js --dias=7
if "%op%"=="2" node avisar-livros.js --dias=30
if "%op%"=="3" node avisar-livros.js --todos
if "%op%"=="4" (
  set /p quem=E-mail do aluno: 
  node avisar-livros.js --dias=7 --para=%quem%
)
if "%op%"=="5" node avisar-livros.js --dias=30 --simular
echo.
pause
