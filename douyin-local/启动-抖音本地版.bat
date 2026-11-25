@echo off
title Douyin Local - http://127.0.0.1:3002
cd /d "%~dp0"

netstat -ano | findstr "127.0.0.1:3002" | findstr "LISTENING" >nul
if %errorlevel%==0 (
    echo [DouyinLocal] Already running. Opening browser...
    start "" "http://127.0.0.1:3002/"
    exit /b 0
)

echo [DouyinLocal] Starting local service on http://127.0.0.1:3002 ...
start "" /b node "server\index.mjs"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:3002/"
echo [DouyinLocal] Running! Keep this window open, or use the .vbs script for silent background mode.
pause >nul
