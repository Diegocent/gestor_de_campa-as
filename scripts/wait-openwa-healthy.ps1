param(
    [int]$MaxAttempts = 60,
    [int]$IntervalSeconds = 5,
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

Set-Location $ProjectRoot

for ($i = 1; $i -le $MaxAttempts; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:2785/api/health" -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            Write-Host "[wait-openwa] OpenWA API lista (intento $i/$MaxAttempts)"
            exit 0
        }
    } catch {
        # sigue esperando
    }

    Write-Host "[wait-openwa] Esperando OpenWA... ($i/$MaxAttempts)"
    Start-Sleep -Seconds $IntervalSeconds
}

Write-Host "[wait-openwa] Timeout: OpenWA no respondio a tiempo"
exit 1
