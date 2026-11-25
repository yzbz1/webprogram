@echo off
title Tesla Dashcam - http://127.0.0.1:3000
cd /d "%~dp0"

netstat -ano | findstr "127.0.0.1:3000" | findstr "LISTENING" >nul
if %errorlevel%==0 (
    echo [TeslaDashcam] Already running. Opening browser...
    start "" "http://127.0.0.1:3000/"
    exit /b 0
)

echo [TeslaDashcam] Starting preview server on http://127.0.0.1:3000 ...
start "" /b cmd /c "npx vite preview --port 3000 --host 127.0.0.1"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:3000/"
echo [TeslaDashcam] Running! Keep this window open while using the app.
pause >nul
