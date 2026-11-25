@echo off
chcp 65001 >nul
title 特斯拉行车记录仪 (http://127.0.0.1:3000)
cd /d "d:\WorkSpaceAi\webprogram\tesla-dashcam"

netstat -ano | findstr "127.0.0.1:3000" | findstr "LISTENING" >nul
if %errorlevel%==0 (
    echo 特斯拉行车记录仪已在运行，正在打开浏览器...
    start "" "http://127.0.0.1:3000/"
    exit /b
)

echo 正在启动特斯拉行车记录仪...
start "" /b cmd /c "npx vite preview --port 3000 --host 127.0.0.1"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:3000/"
echo 服务已运行在 http://127.0.0.1:3000/ （关闭本窗口将停止服务）
pause >nul
