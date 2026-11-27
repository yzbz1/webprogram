@echo off
setlocal
set "ROOT_DIR=%~dp0"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"
set "PID_FILE=%ROOT_DIR%\bridge\.bridge.pid"
if not exist "%PID_FILE%" (
  echo No active bridge PID file found.
  exit /b 0
)
set /p BRIDGE_PID=<"%PID_FILE%"
if "%BRIDGE_PID%"=="" (
  del /q "%PID_FILE%" >nul 2>&1
  exit /b 0
)
taskkill /PID %BRIDGE_PID% /F >nul 2>&1
del /q "%PID_FILE%" >nul 2>&1
echo Stopped chrome-incident-drawer bridge (PID %BRIDGE_PID%).
endlocal
