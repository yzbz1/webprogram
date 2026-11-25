@echo off
chcp 65001 >nul
title 停止 - 特斯拉行车记录仪

echo 正在停止特斯拉行车记录仪相关进程...

:: 1. 停止监听 3000 端口的进程
for /f "tokens=5" %%a in ('netstat -ano ^| findstr "127.0.0.1:3000" ^| findstr "LISTENING"') do (
    taskkill /F /T /PID %%a >nul 2>&1
)

:: 2. 清理命令行中包含 tesla-dashcam 的 node / esbuild / vite 进程
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'tesla-dashcam' -and $_.Name -match '^(node|esbuild|cmd|powershell)\.exe$' -and $_.ProcessId -ne $PID } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

echo 特斯拉行车记录仪已停止。
timeout /t 2 /nobreak >nul
