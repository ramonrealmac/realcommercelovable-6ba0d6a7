@echo off
set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

echo === REINICIANDO SISTEMA REALCOMMERCE (VITE) ===
echo Pasta: %ROOT_DIR%
echo.

echo 1. Limpando processos do sistema...
powershell -ExecutionPolicy Bypass -File "%ROOT_DIR%mata-sistema.ps1"

echo.
echo 2. Iniciando sistema em uma nova janela...
start "SISTEMA - Realcommerce" cmd /k "npm run dev"

echo.
echo === TUDO PRONTO! O SISTEMA ESTA SUBINDO NA OUTRA JANELA ===
timeout /t 3
