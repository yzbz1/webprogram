@echo off
title SafeMover - http://127.0.0.1:3005
cd /d "%~dp0"

netstat -ano | findstr "127.0.0.1:3005" | findstr "LISTENING" >nul
if %errorlevel%==0 (
    echo [SafeMover] Already running. Opening browser...
    start "" "http://127.0.0.1:3005/"
    exit /b 0
)

echo [SafeMover] Starting local service on http://127.0.0.1:3005 ...
start "" /b node "server.mjs"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:3005/"
echo [SafeMover] Running! Keep this window open while transferring, or use the .vbs script for silent background mode.
pause >nul
