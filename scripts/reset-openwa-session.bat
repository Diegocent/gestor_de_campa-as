@echo off
setlocal EnableExtensions
cd /d "%~dp0.."

echo.
echo ============================================
echo   Reset sesion OpenWA (Chromium lock)
echo ============================================
echo.
echo Esto detiene OpenWA y el worker, limpia bloqueos
echo de Chromium y reinicia. Deberas reconectar WhatsApp.
echo.
pause

echo [reset] Deteniendo worker y openwa-api...
docker compose stop worker openwa-api

echo [reset] Eliminando bloqueos de Chromium en el volumen...
docker run --rm -v gestor-campanas_openwa_data:/data alpine sh -c "find /data/sessions -name 'SingletonLock' -delete 2>/dev/null; find /data/sessions -name 'SingletonCookie' -delete 2>/dev/null; find /data/sessions -name 'SingletonSocket' -delete 2>/dev/null; echo Limpieza OK"

echo [reset] Reiniciando OpenWA...
docker compose up -d openwa-api

echo [reset] Esperando API...
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\wait-openwa-healthy.ps1"

echo.
echo ============================================
echo   Siguiente paso (manual en el dashboard)
echo ============================================
echo.
echo 1. Abri http://localhost:2886
echo 2. Elimina la sesion "gestor-campanas" si esta Failed
echo 3. Crea una nueva sesion o usa Reconnect
echo 4. Escanea el QR con WhatsApp
echo.
echo Cuando este conectada, ejecuta:
echo   docker compose up -d worker
echo.

endlocal
