# mata-sistema.ps1 - Finaliza o Frontend e o Backend do sistema
$currentDir = Get-Location

Write-Host "Limpando processos do Sistema em: $currentDir" -ForegroundColor Cyan

# Busca processos node/vite que estejam rodando nesta pasta, exceto o fiscal-worker
$processos = Get-CimInstance Win32_Process -Filter "name='node.exe'" | Where-Object { 
    ($_.CommandLine -like "*vite*" -or $_.CommandLine -like "*RealcommerceLovable*") -and 
    $_.CommandLine -notlike "*fiscal-worker*"
}

if ($processos) {
    foreach ($p in $processos) {
        Write-Host "Finalizando $($p.Name) (PID: $($p.ProcessId))..." -ForegroundColor Yellow
        try {
            Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop
        } catch {
            taskkill /F /PID $p.ProcessId /T | Out-Null
        }
    }
    Write-Host "Sistema finalizado!" -ForegroundColor Green
} else {
    Write-Host "Nenhum processo do sistema encontrado." -ForegroundColor Gray
}
