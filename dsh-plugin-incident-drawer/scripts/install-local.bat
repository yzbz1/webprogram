@echo off
setlocal EnableDelayedExpansion
for %%I in ("%~dp0..") do set "PLUGIN_DIR=%%~fI"
if "%PLUGIN_DIR:~-1%"=="\" set "PLUGIN_DIR=%PLUGIN_DIR:~0,-1%"
set "DSH_CLI=%~1"
set "PROFILE=%~2"
if "%PROFILE%"=="" set "PROFILE=desktop"
if "%DSH_CLI%"=="" if defined DSH_CMD set "DSH_CLI=%DSH_CMD%"
if "%DSH_CLI%"=="" (
  for /f "delims=" %%D in ('where dsh.cmd 2^>nul') do if "!DSH_CLI!"=="" set "DSH_CLI=%%D"
)
if "%DSH_CLI%"=="" (
  for /f "delims=" %%D in ('where dsh 2^>nul') do if "!DSH_CLI!"=="" set "DSH_CLI=%%D"
)
if "%DSH_CLI%"=="" (
  echo [ERROR] Cannot find dsh.cmd or dsh in PATH.
  echo Usage: %~nx0 "^<path-to-dsh.cmd^>" [profile]
  exit /b 1
)
echo Installing plugin from "%PLUGIN_DIR%" into profile "%PROFILE%"...
call "%DSH_CLI%" plugin --profile "%PROFILE%" add "%PLUGIN_DIR%"
if errorlevel 1 exit /b %errorlevel%
echo Done. Restart DeepSeek Harness to load the plugin.
endlocal
