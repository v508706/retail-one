@echo off
echo Starting RetailOne PHP backend on port 3001...
echo Press Ctrl+C to stop.
echo.
"C:\xampp\php\php.exe" -S localhost:3001 "%~dp0index.php"
