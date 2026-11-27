@echo off
setlocal
for %%I in ("%~dp0..") do set "PLUGIN_DIR=%%~fI"
if "%PLUGIN_DIR:~-1%"=="\" set "PLUGIN_DIR=%PLUGIN_DIR:~0,-1%"
cd /d "%PLUGIN_DIR%"
if not exist "dist" mkdir "dist"
call npm run build
if errorlevel 1 exit /b %errorlevel%
call npm pack --pack-destination "%PLUGIN_DIR%\dist"
if errorlevel 1 exit /b %errorlevel%
echo Offline tarball generated in "%PLUGIN_DIR%\dist".
endlocal
