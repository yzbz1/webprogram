@echo off
chcp 65001 >nul
title 停止 - 抖音本地沉浸版

echo 正在停止抖音本地沉浸版相关进程...

:: 1. 停止监听 3002 端口的进程
for /f "tokens=5" %%a in ('netstat -ano ^| findstr "127.0.0.1:3002" ^| findstr "LISTENING"') do (
    taskkill /F /T /PID %%a >nul 2>&1
)

:: 2. 清理命令行中包含 douyin-local 的 node / esbuild / vite 进程
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'douyin-local' -and $_.Name -match '^(node|esbuild|cmd|powershell)\.exe$' -and $_.ProcessId -ne $PID } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

echo 抖音本地沉浸版已停止。
timeout /t 2 /nobreak >nul
