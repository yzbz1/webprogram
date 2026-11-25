@echo off
chcp 65001 >nul
title 抖音本地沉浸版 (http://127.0.0.1:3002)
cd /d "d:\WorkSpaceAi\webprogram\douyin-local"

:: Check if already running on port 3002
netstat -ano | findstr "127.0.0.1:3002" | findstr "LISTENING" >nul
if %errorlevel%==0 (
    echo 抖音本地服务已在运行，正在打开浏览器...
    start "" "http://127.0.0.1:3002/"
    exit /b
)

echo 正在启动抖音本地播放器服务...
start "" /b node "server\index.mjs"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:3002/"
echo 服务已运行在 http://127.0.0.1:3002/ （关闭本窗口将停止服务，如需无窗口后台运行请使用 .vbs 脚本）
pause >nul
