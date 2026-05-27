@echo off
setlocal EnableExtensions
cd /d "%~dp0.."

set BACKUP_DIR=backups

if not exist "%BACKUP_DIR%" (
    echo [ERROR] No existe la carpeta %BACKUP_DIR%
    exit /b 1
)

echo.
echo Archivos de backup disponibles:
dir /B "%BACKUP_DIR%\*.tar.gz" 2>nul
echo.

set /p OPENWA_FILE=Nombre del backup OpenWA (ej. openwa-20260527.tar.gz): 
set /p PG_FILE=Nombre del backup Postgres (ej. postgres-20260527.tar.gz, Enter para omitir): 
set /p ENV_FILE=Nombre del .env backup (ej. .env-20260527.bak, Enter para omitir): 

if "%OPENWA_FILE%"=="" (
    echo [ERROR] Debes indicar el backup de OpenWA
    exit /b 1
)

if not exist "%BACKUP_DIR%\%OPENWA_FILE%" (
    echo [ERROR] No existe %BACKUP_DIR%\%OPENWA_FILE%
    exit /b 1
)

if not "%ENV_FILE%"=="" (
    copy /Y "%BACKUP_DIR%\%ENV_FILE%" ".env" >nul
    echo [restore] .env restaurado
) else if not exist ".env" (
    copy /Y ".env.docker.example" ".env" >nul
    echo [restore] .env creado desde ejemplo
)

echo [restore] Creando volumen OpenWA...
docker volume create gestor-campanas_openwa_data >nul 2>&1
docker run --rm -v gestor-campanas_openwa_data:/data -v "%cd%\%BACKUP_DIR%":/backup alpine sh -c "rm -rf /data/* && tar xzf /backup/%OPENWA_FILE% -C /data"

if not "%PG_FILE%"=="" (
    if exist "%BACKUP_DIR%\%PG_FILE%" (
        echo [restore] Restaurando PostgreSQL...
        docker volume create gestor-campanas_postgres_data >nul 2>&1
        docker run --rm -v gestor-campanas_postgres_data:/data -v "%cd%\%BACKUP_DIR%":/backup alpine sh -c "rm -rf /data/* && tar xzf /backup/%PG_FILE% -C /data"
    )
)

echo [restore] Levantando stack...
call scripts\setup.bat

endlocal
