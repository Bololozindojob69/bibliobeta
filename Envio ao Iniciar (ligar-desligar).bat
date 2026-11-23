@echo off
chcp 65001 >nul
title BiblioBeta - Envio de e-mails ao ligar o servidor
cd /d "%~dp0backend"
echo ==========================================
echo   ENVIO DE E-MAILS QUANDO O SERVIDOR LIGA
echo ==========================================
echo.
if exist envio-ao-iniciar.txt (echo Configuracao atual: & type envio-ao-iniciar.txt & echo.)
echo  1 = LIGAR - avisar LIVROS NOVOS ao iniciar (recomendado)
echo  2 = LIGAR - reenviar AVISOS (emprestimo, devolucao...) ao iniciar
echo  3 = LIGAR - livros novos + avisos
echo  4 = DESLIGAR (nao envia nada ao iniciar)
echo  5 = Zerar o historico (volta a enviar como se fosse a 1a vez)
echo.
set /p op=Escolha 1 a 5: 
if "%op%"=="1" call :gravar livros
if "%op%"=="2" call :gravar avisos
if "%op%"=="3" call :gravar ambos
if "%op%"=="4" call :gravar nao
if "%op%"=="5" (del /q envio-ao-iniciar.estado.json 2>nul & echo Historico zerado.)
echo.
pause
exit /b
:gravar
(echo MODO=%1& echo DIAS_PRIMEIRA_VEZ=7& echo PARA=alunos) > envio-ao-iniciar.txt
echo Pronto! Configuracao salva: MODO=%1
exit /b
