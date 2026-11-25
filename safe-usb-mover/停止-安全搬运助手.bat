@echo off
title Stop SafeMover (Port 3005)

echo [SafeMover] Stopping service on port 3005...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr "127.0.0.1:3005" ^| findstr "LISTENING"') do (
    taskkill /F /T /PID %%a >nul 2>&1
)
echo [SafeMover] Stopped.
timeout /t 2 /nobreak >nul
