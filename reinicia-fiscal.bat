@echo off
set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

echo === REINICIANDO FISCAL WORKER ===
echo Pasta: %ROOT_DIR%
echo.

echo 1. Limpando processos antigos...
powershell -ExecutionPolicy Bypass -File "%ROOT_DIR%mata-fiscal.ps1"

echo.
echo 2. Iniciando novo servico em uma nova janela...
cd /d "%ROOT_DIR%\fiscal-worker"
start "FISCAL WORKER - ACBr" cmd /k "npm start"

echo.
echo === TUDO PRONTO! O WORKER ESTA SUBINDO NA OUTRA JANELA ===
timeout /t 3
