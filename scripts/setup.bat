@echo off
setlocal EnableExtensions
cd /d "%~dp0.."

echo.
echo ============================================
echo   Gestor de Campanas - Instalacion Docker
echo ============================================
echo.

where docker >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker no esta instalado o no esta en el PATH.
    echo Instala Docker Desktop: https://www.docker.com/products/docker-desktop/
    exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker Desktop no esta corriendo. Inicialo y vuelve a ejecutar setup.bat
    exit /b 1
)

if not exist ".env" (
    echo [setup] Creando .env desde .env.docker.example...
    copy /Y ".env.docker.example" ".env" >nul
) else (
    echo [setup] Usando .env existente
)

echo.
echo [setup] Construyendo y levantando contenedores (puede tardar varios minutos la primera vez)...
docker compose up -d --build
if errorlevel 1 (
    echo [ERROR] Fallo docker compose up
    exit /b 1
)

echo.
echo [setup] Esperando que OpenWA API este lista...
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\wait-openwa-healthy.ps1"
if errorlevel 1 (
    echo [ERROR] OpenWA no respondio. Revisa: docker compose logs openwa-api
    exit /b 1
)

echo.
echo [setup] Extrayendo API key de OpenWA y guardando en .env...
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\sync-openwa-key.ps1"
if errorlevel 1 (
    echo [WARN] No se pudo sincronizar la API key automaticamente.
    echo Ejecuta manualmente: docker compose logs openwa-api ^| findstr owa_k1
    goto :show_urls
)

echo.
echo [setup] Reiniciando worker con la API key actualizada...
docker compose up -d worker
if errorlevel 1 (
    echo [WARN] No se pudo reiniciar el worker
)

:show_urls
echo.
echo ============================================
echo   Instalacion completada
echo ============================================
echo.
echo   App:        http://localhost:3000
echo   OpenWA UI:  http://localhost:2886
echo   OpenWA API: http://localhost:2785/api
echo.
echo   Ver estado:  docker compose ps
echo   Ver logs:    npm run docker:logs
echo   API key:     type .env ^| findstr OPENWA_API_KEY
echo.
echo   Si es la primera vez, escanea el QR en http://localhost:2886
echo.

endlocal
exit /b 0
