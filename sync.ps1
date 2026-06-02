# Script de Sincronização do Git para o Realcommerce Lovable
# Garante que o Git está na variável PATH para esta execução
$gitPath = "C:\Program Files\Git\cmd"
if ($env:Path -notlike "*$gitPath*") {
    $env:Path += ";$gitPath"
}

# Verifica se a pasta atual é um repositório git válido
if (!(Test-Path .git)) {
    Write-Host "[ERRO] Esta pasta não é um repositório Git válido." -ForegroundColor Red
    Exit 1
}

Write-Host "=== Iniciando Verificação de Sincronização ===" -ForegroundColor Cyan

# Busca as últimas atualizações do repositório remoto sem mesclar
Write-Host "Buscando atualizações do remoto (git fetch)..."
git fetch origin

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERRO] Falha ao conectar ao GitHub. Verifique sua conexão ou credenciais." -ForegroundColor Red
    Exit 1
}

# Obtém a branch atual
$currentBranch = (git branch --show-current).Trim()
Write-Host "Branch atual: $currentBranch" -ForegroundColor Yellow

# Compara o estado local e remoto
$localCommit = (git rev-parse HEAD).Trim()
$remoteCommit = (git rev-parse "origin/$currentBranch").Trim()
$baseCommit = (git merge-base HEAD "origin/$currentBranch").Trim()

# Verifica se há modificações locais pendentes (arquivos não comitados)
$statusOutput = git status --porcelain
$hasLocalChanges = $statusOutput -ne $null -and $statusOutput.Length -gt 0

if ($localCommit -eq $remoteCommit) {
    Write-Host "[SUCESSO] Seu repositório local já está totalmente sincronizado com o GitHub." -ForegroundColor Green
} elseif ($localCommit -eq $baseCommit) {
    Write-Host "[ATUALIZAÇÃO] O repositório remoto possui atualizações pendentes." -ForegroundColor Yellow
    
    if ($hasLocalChanges) {
        Write-Host "Existem alterações locais não comitadas!" -ForegroundColor Magenta
        Write-Host "Salvando alterações locais temporariamente (git stash)..."
        git stash
        
        Write-Host "Puxando atualizações do remoto (git pull)..."
        git pull origin $currentBranch
        
        Write-Host "Restaurando suas alterações locais (git stash pop)..."
        git stash pop
    } else {
        Write-Host "Puxando atualizações do remoto (git pull)..."
        git pull origin $currentBranch
    }
    Write-Host "[SUCESSO] Atualização concluída com sucesso." -ForegroundColor Green
} elseif ($remoteCommit -eq $baseCommit) {
    Write-Host "[AVISO] Você possui commits locais que ainda não foram enviados para o GitHub (Ahead)." -ForegroundColor Yellow
    Write-Host "Para enviar suas alterações, execute: git push origin $currentBranch" -ForegroundColor Cyan
} else {
    Write-Host "[ALERTA] Os commits local e remoto divergiram!" -ForegroundColor Red
    Write-Host "Você precisará mesclar as alterações manualmente." -ForegroundColor Yellow
}

# Mostra resumo do status local
if ($hasLocalChanges) {
    Write-Host "`nArquivos modificados localmente:" -ForegroundColor Yellow
    git status -s
}
Write-Host "==============================================" -ForegroundColor Cyan
