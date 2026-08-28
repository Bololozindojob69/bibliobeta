@echo off
setlocal
cd /d "%~dp0backend"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao foi encontrado.
  echo Instale o Node.js LTS e execute este arquivo novamente.
  pause
  exit /b 1
)
if not exist "node_modules" (
  echo Instalando as dependencias pela primeira vez...
  call npm install
  if errorlevel 1 (
    echo Falha ao instalar as dependencias.
    pause
    exit /b 1
  )
)
echo.
echo BiblioBeta sera aberto em http://localhost:3000
start "" "http://localhost:3000"
npm start
pause
