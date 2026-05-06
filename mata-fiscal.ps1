# mata-fiscal.ps1 - Finaliza agressivamente o Worker Fiscal
$currentDir = Get-Location
$workerPath = Join-Path $currentDir "fiscal-worker"

Write-Host "Buscando processos do Fiscal em: $workerPath" -ForegroundColor Cyan

# Busca processos node que tenham o caminho do fiscal-worker OU o comando de inicialização padrão
$processos = Get-CimInstance Win32_Process -Filter "name='node.exe'" | Where-Object { 
    $_.CommandLine -like "*fiscal-worker*" -or 
    $_.CommandLine -like "*src/index.js*" -or
    $_.CommandLine -like "*index.js*" -and $_.CommandLine -notlike "*vite*"
}

if ($processos) {
    foreach ($p in $processos) {
        Write-Host "Matando processo $($p.Name) (PID: $($p.ProcessId))..." -ForegroundColor Yellow
        # Tenta pelo PowerShell, se falhar usa o taskkill bruto
        try {
            Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop
        } catch {
            taskkill /F /PID $p.ProcessId /T | Out-Null
        }
    }
    Write-Host "Limpeza do Fiscal concluída!" -ForegroundColor Green
} else {
    Write-Host "Nenhum processo do Fiscal Worker encontrado." -ForegroundColor Gray
}
