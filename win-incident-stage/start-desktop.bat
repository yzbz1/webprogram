@echo off
setlocal
set "ROOT_DIR=%~dp0"
if "%ROOT_DIR:~-1%"=="\" set "ROOT_DIR=%ROOT_DIR:~0,-1%"
cd /d "%ROOT_DIR%"
if exist "%ROOT_DIR%\release\win-incident-stage-portable\IncidentStage.exe" (
  start "" "%ROOT_DIR%\release\win-incident-stage-portable\IncidentStage.exe"
  exit /b 0
)
if exist "%ROOT_DIR%\node_modules\.bin\electron.cmd" (
  call "%ROOT_DIR%\node_modules\.bin\electron.cmd" "%ROOT_DIR%"
  exit /b %errorlevel%
)
echo [ERROR] Neither IncidentStage.exe nor node_modules\electron was found.
echo Run "npm install && npm run build && npm run pack:portable" first.
pause
exit /b 1
