@echo off
setlocal EnableExtensions
cd /d "%~dp0.."

echo.
echo ============================================
echo   Generar ZIP para otra PC (instalacion limpia)
echo ============================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\package-share.ps1"
if errorlevel 1 (
    echo [ERROR] No se pudo generar el ZIP
    exit /b 1
)

echo.
endlocal
exit /b 0
