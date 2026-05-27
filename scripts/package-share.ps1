param(
    [string]$OutputDir = "dist"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$stamp = Get-Date -Format "yyyyMMdd-HHmm"
$zipName = "gestor-campanas-instalacion-$stamp.zip"
$staging = Join-Path $env:TEMP "gestor-campanas-pack-$stamp"
$zipPath = Join-Path (Join-Path $root $OutputDir) $zipName

$excludeDirs = @(
    "node_modules",
    ".next",
    "out",
    "backups",
    ".git",
    "dist",
    "coverage",
    ".vercel",
    "_IGNORE_gestor-campanas",
    "open-wa-session"
)

$excludeFiles = @(
    ".env",
    ".env.local"
)

Write-Host "[package] Preparando carpeta temporal..."
if (Test-Path $staging) {
    Remove-Item $staging -Recurse -Force
}
New-Item -ItemType Directory -Path $staging | Out-Null

Write-Host "[package] Copiando proyecto (sin datos locales ni dependencias)..."
robocopy $root $staging /E /NFL /NDL /NJH /NJS /NC /NS /NP `
    /XD $excludeDirs `
    /XF $excludeFiles | Out-Null

if ($LASTEXITCODE -ge 8) {
    throw "robocopy fallo con codigo $LASTEXITCODE"
}

Write-Host "[package] Agregando guia de instalacion..."
Copy-Item (Join-Path $root "INSTALAR-OTRA-PC.txt") (Join-Path $staging "INSTALAR-OTRA-PC.txt") -Force
Copy-Item (Join-Path $root ".env.docker.example") (Join-Path $staging ".env.docker.example") -Force

$manifestPath = Join-Path $staging "PAQUETE-INFO.txt"
@"
Gestor de Campanas - paquete para otra PC
Generado: $(Get-Date -Format "yyyy-MM-dd HH:mm")
Origen: $root

Incluye: codigo fuente, Docker, scripts de instalacion, documentacion.
Excluye: node_modules, .next, .env, backups, volumenes Docker, sesion WhatsApp.

Instalar: descomprimir y ejecutar scripts\setup.bat
"@ | Set-Content -Path $manifestPath -Encoding UTF8

$outputFolder = Join-Path $root $OutputDir
if (-not (Test-Path $outputFolder)) {
    New-Item -ItemType Directory -Path $outputFolder | Out-Null
}

if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

Write-Host "[package] Comprimiendo ZIP..."
Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $zipPath -CompressionLevel Optimal

Remove-Item $staging -Recurse -Force

$sizeMb = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)
Write-Host ""
Write-Host "[package] Listo: $zipPath ($sizeMb MB)"
Write-Host "[package] Compartir este archivo. En la otra PC: descomprimir y ejecutar scripts\setup.bat"
