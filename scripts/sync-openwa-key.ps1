param(
    [string]$EnvFile = ".env",
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

Set-Location $ProjectRoot

if (-not (Test-Path $EnvFile)) {
    Copy-Item ".env.docker.example" $EnvFile
    Write-Host "[sync-openwa-key] Creado $EnvFile desde .env.docker.example"
}

Write-Host "[sync-openwa-key] Leyendo logs de openwa-api..."
$logs = docker compose logs openwa-api 2>&1 | Out-String

$key = $null

if ($logs -match '(owa_k1_[a-f0-9]{64})') {
    $key = $Matches[1]
} elseif ($logs -match 'dev-admin-key') {
    $key = 'dev-admin-key'
}

if (-not $key) {
    Write-Host "[sync-openwa-key] No se encontro API key en logs. Espera a que openwa-api termine de iniciar."
    exit 1
}

$content = Get-Content $EnvFile -Raw
if ($content -match '(?m)^OPENWA_API_KEY=') {
    $content = $content -replace '(?m)^OPENWA_API_KEY=.*', "OPENWA_API_KEY=$key"
} else {
    $content = $content.TrimEnd() + "`nOPENWA_API_KEY=$key`n"
}

Set-Content -Path $EnvFile -Value $content.TrimEnd() -NoNewline
Add-Content -Path $EnvFile -Value ""

Write-Host "[sync-openwa-key] OPENWA_API_KEY actualizado en $EnvFile"
Write-Host "[sync-openwa-key] Clave: $key"
exit 0
