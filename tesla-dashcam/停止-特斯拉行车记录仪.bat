@echo off
title Stop Tesla Dashcam (Port 3000)

echo [TeslaDashcam] Stopping service on port 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr "127.0.0.1:3000" ^| findstr "LISTENING"') do (
    taskkill /F /T /PID %%a >nul 2>&1
)
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'tesla-dashcam' -and $_.Name -match '^(node|esbuild)\.exe$' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
echo [TeslaDashcam] Stopped.
timeout /t 2 /nobreak >nul
