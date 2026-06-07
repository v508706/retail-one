@echo off
title RetailOne Launcher
color 0A

echo ============================================================
echo   RetailOne — Starting All Services
echo ============================================================
echo.

cd /d "%~dp0"

:: ── 1. Check / Start MySQL ───────────────────────────────────
echo [1/3] Checking MySQL...
"C:\xampp\mysql\bin\mysqladmin.exe" -u root status >nul 2>&1
if errorlevel 1 (
    echo       MySQL not running — launching XAMPP Control Panel.
    echo       Please click START next to MySQL, then come back and
    echo       press any key to continue.
    start "" "C:\xampp\xampp-control.exe"
    pause
) else (
    echo       MySQL OK.
)

:: ── 2. Start PHP Backend on port 3001 ───────────────────────
echo.
echo [2/3] Starting PHP Backend (port 3001)...
start "RetailOne PHP Backend" /min "C:\xampp\php\php.exe" -S localhost:3001 "%~dp0backend-php\index.php"
timeout /t 2 /nobreak >nul
echo       Backend started.

:: ── 3. Start React Frontend ─────────────────────────────────
echo.
echo [3/3] Starting React Frontend (port 5173)...
start "RetailOne Frontend" /min cmd /k "cd /d %~dp0frontend && npm run dev"
timeout /t 4 /nobreak >nul
echo       Frontend started.

:: ── Open browser ─────────────────────────────────────────────
start "" "http://localhost:5173"

echo.
echo ============================================================
echo   All services are running!
echo.
echo   Frontend : http://localhost:5173
echo   Backend  : http://localhost:3001
echo.
echo   Login    : admin@demo.com
echo   Password : admin123
echo.
echo   To stop: close the two minimised windows, then
echo   stop MySQL in XAMPP Control Panel.
echo ============================================================
echo.
pause
