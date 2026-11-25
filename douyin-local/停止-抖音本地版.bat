@echo off
title Stop Douyin Local (Port 3002)

echo [DouyinLocal] Stopping service on port 3002...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr "127.0.0.1:3002" ^| findstr "LISTENING"') do (
    taskkill /F /T /PID %%a >nul 2>&1
)
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'douyin-local' -and $_.Name -match '^(node|esbuild)\.exe$' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
echo [DouyinLocal] Stopped.
timeout /t 2 /nobreak >nul
