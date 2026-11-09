@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title BiblioBeta - Servidor Local
color 0A

echo.
echo ================================================
echo          BIBLIOBETA - SERVIDOR LOCAL
echo ================================================
echo.

REM ============================================================
REM 1) Verifica Node.js
REM    Esta versao do BiblioBeta usa sqlite3 6.x e aceita
REM    Node.js 18, 20, 22 e 24 (incluindo Node 24 LTS).
REM ============================================================
where node >nul 2>nul
if errorlevel 1 goto SEM_NODE

for /f "tokens=1" %%V in ('node -p "process.versions.node.split('.')[0]"') do set "NODE_MAJOR=%%V"
set "NODE_VERSION="
for /f "delims=" %%V in ('node -v') do set "NODE_VERSION=%%V"

echo [1/5] Node encontrado: !NODE_VERSION!

if "!NODE_MAJOR!"=="18" goto NODE_OK
if "!NODE_MAJOR!"=="20" goto NODE_OK
if "!NODE_MAJOR!"=="22" goto NODE_OK
if "!NODE_MAJOR!"=="24" goto NODE_OK

echo.
echo [ERRO] Versao do Node.js nao suportada por esta versao do BiblioBeta.
echo.
echo Versao encontrada: !NODE_VERSION!
echo Versoes aceitas: Node 18, 20, 22 ou 24.
echo.
echo Se voce estiver usando Node 25 ou superior, instale uma versao LTS aceita.
goto PAUSA

:NODE_OK
where npm >nul 2>nul
if errorlevel 1 goto SEM_NPM

for /f "delims=" %%V in ('npm.cmd -v') do set "NPM_VERSION=%%V"
echo npm encontrado: !NPM_VERSION!
echo.

cd /d "%~dp0backend"
if not exist "package.json" goto SEM_PASTA

REM ============================================================
REM 2) Instala dependencias
REM    O package.json atualizado usa sqlite3 6.x, que possui
REM    suporte moderno a Node-API e evita a compilacao antiga.
REM ============================================================
if not exist "node_modules\express" goto INSTALAR
if not exist "node_modules\sqlite3" goto INSTALAR
if not exist "node_modules\body-parser\lib\types\json.js" goto INSTALAR
if not exist "node_modules\compression" goto INSTALAR

echo [2/5] Dependencias encontradas e verificadas.
goto PORTA

:INSTALAR
echo [2/5] Instalando dependencias atualizadas do BiblioBeta...
echo Isso pode levar alguns minutos na primeira vez.
echo.
if exist "node_modules" (
    echo Removendo node_modules antigo/corrompido...
    rmdir /s /q "node_modules"
)
call npm.cmd install --no-audit --no-fund
if errorlevel 1 goto ERRO_NPM

echo.
echo [OK] Dependencias instaladas.

:PORTA
REM Libera a porta 3000 antes de iniciar o servidor.
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo Encerrando processo anterior na porta 3000: %%P
    taskkill /F /PID %%P >nul 2>nul
)

echo.
echo [3/5] Iniciando servidor em uma nova janela...
start "BiblioBeta - Servidor" cmd /k "cd /d ""%~dp0backend"" && node server.js"

echo.
echo [4/5] Aguardando o servidor...
timeout /t 3 /nobreak >nul

echo.
echo [5/5] Abrindo o BiblioBeta no navegador...
start "" "http://127.0.0.1:3000/"
echo.
echo ================================================
echo Site aberto automaticamente.
echo.
echo Neste computador: http://127.0.0.1:3000
echo Na rede local: http://IP-DA-MAQUINA:3000
echo.
echo A janela preta do servidor deve permanecer aberta.
echo ================================================
echo.
echo Esta janela sera fechada automaticamente.
timeout /t 3 /nobreak >nul
endlocal
exit /b 0

:SEM_NODE
echo [ERRO] Node.js nao esta instalado ou nao esta no PATH.
echo Instale uma versao LTS do Node.js e abra o BAT novamente.
goto PAUSA

:SEM_NPM
echo [ERRO] npm nao foi encontrado.
echo Reinstale o Node.js LTS e abra o BAT novamente.
goto PAUSA

:SEM_PASTA
echo [ERRO] A pasta backend nao foi encontrada.
echo Extraia o ZIP completo antes de executar este BAT.
goto PAUSA

:ERRO_NPM
echo.
echo [ERRO] Nao foi possivel instalar as dependencias.
echo.
echo O BiblioBeta agora usa sqlite3 6.x.
echo Verifique a internet e tente executar este BAT novamente.
echo Se o erro mencionar proxy, firewall ou timeout, verifique a conexao.
goto PAUSA

:PAUSA
echo.
echo ================================================
echo Pressione qualquer tecla para fechar esta janela.
echo ================================================
pause >nul
exit /b 1
