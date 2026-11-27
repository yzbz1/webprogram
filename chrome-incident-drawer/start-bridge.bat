@echo off
setlocal EnableDelayedExpansion
set "ROOT_DIR=%~dp0"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"
set "NODE_CMD=%~1"
if "%NODE_CMD%"=="" if defined NODE_EXE set "NODE_CMD=%NODE_EXE%"
if "%NODE_CMD%"=="" (
  for /f "delims=" %%N in ('where node.exe 2^>nul') do if "!NODE_CMD!"=="" set "NODE_CMD=%%N"
)
if "%NODE_CMD%"=="" (
  echo [ERROR] Cannot find node.exe in PATH.
  echo Usage: %~nx0 ["path-to-node.exe"]
  pause
  exit /b 1
)
echo Starting chrome-incident-drawer bridge on http://127.0.0.1:17892 ...
"%NODE_CMD%" "%ROOT_DIR%\bridge\server.mjs"
endlocal
