@echo off
setlocal EnableExtensions
cd /d "%~dp0.."

set BACKUP_DIR=backups
set STAMP=%date:~-4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set STAMP=%STAMP: =0%

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

echo [backup] Deteniendo contenedores...
docker compose down

echo [backup] Exportando volumen OpenWA (sesion WhatsApp + API key)...
docker run --rm -v gestor-campanas_openwa_data:/data -v "%cd%\%BACKUP_DIR%":/backup alpine tar czf /backup/openwa-%STAMP%.tar.gz -C /data .

echo [backup] Exportando volumen PostgreSQL (campanas)...
docker run --rm -v gestor-campanas_postgres_data:/data -v "%cd%\%BACKUP_DIR%":/backup alpine tar czf /backup/postgres-%STAMP%.tar.gz -C /data .

echo [backup] Copiando .env...
copy /Y ".env" "%BACKUP_DIR%\.env-%STAMP%.bak" >nul

echo.
echo [backup] Listo. Archivos en %BACKUP_DIR%\
dir /B "%BACKUP_DIR%\*%STAMP%*"
echo.
echo Para restaurar en otra PC: scripts\restore-docker.bat

endlocal
