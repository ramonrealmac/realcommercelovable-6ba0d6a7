$replacements = @{
    "mdf_veiculo_reboque" = "fiscal_mdf_veiculo_reboque"
    "nfe_recebida_status_log" = "fiscal_nfe_status_log"
    "mdf_historicoxml" = "fiscal_mdf_historicoxml"
    "mdf_descarrega" = "fiscal_mdf_descarrega"
    "mdf_componente" = "fiscal_mdf_componente"
    "mdf_manifesto" = "fiscal_mdf_manifesto"
    "mdf_motorista" = "fiscal_mdf_motorista"
    "mdf_pagamento" = "fiscal_mdf_pagamento"
    "mdf_cabecalho" = "fiscal_mdf_cabecalho"
    "nfe_cabecalho" = "fiscal_nfe_cabecalho"
    "mdf_documento" = "fiscal_mdf_documento"
    "mdf_condutor" = "fiscal_mdf_condutor"
    "mdf_percurso" = "fiscal_mdf_percurso"
    "nfe_recebida" = "fiscal_nfe_recebida"
    "mdf_carrega" = "fiscal_mdf_carrega"
    "mdf_veiculo" = "fiscal_mdf_veiculo"
    "mdf_pagtos" = "fiscal_mdf_pagtos"
    "nfe_item" = "fiscal_nfe_item"
    "mdf_log" = "fiscal_mdf_log"
    "mdf_nf" = "fiscal_mdf_nf"
}

$files = Get-ChildItem -Path "d:\Projetos\IA\RealcommerceLovable\src\components\forms" -Recurse -Include *.tsx,*.ts

foreach ($file in $files) {
    $content = Get-Content -Path $file.FullName -Raw
    $originalContent = $content
    $changed = $false

    # Sort keys by length descending to avoid partial matches
    $keys = $replacements.Keys | Sort-Object Length -Descending

    foreach ($key in $keys) {
        $val = $replacements[$key]
        if ($content -match $key) {
            $content = $content -replace "\b$key\b", $val
            $changed = $true
        }
    }

    if ($changed) {
        Set-Content -Path $file.FullName -Value $content
        Write-Host "Updated $($file.FullName)"
    }
}
