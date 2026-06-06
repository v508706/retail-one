@echo off
echo ============================================================
echo  RetailOne - Starting Application
echo ============================================================
echo.

cd /d "%~dp0"

echo [1/2] Starting Backend (port 3001)...
start "RetailOne Backend" cmd /k "cd /d %~dp0backend && npm run dev"

timeout /t 3 /nobreak >nul

echo [2/2] Starting Frontend (port 5173)...
start "RetailOne Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

timeout /t 5 /nobreak >nul

echo.
echo ============================================================
echo  RetailOne is starting up!
echo.
echo  Frontend : http://localhost:5173
echo  Backend  : http://localhost:3001
echo  API      : http://localhost:3001/api/v1
echo  Health   : http://localhost:3001/health
echo.
echo  Demo Login:
echo    Email   : admin@retailone.app
echo    Password: demo1234
echo ============================================================
echo.
pause
