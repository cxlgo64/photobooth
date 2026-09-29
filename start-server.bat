@echo off
rem ============================================================
rem  Photo Booth server only (no browser)
rem  Keeps the window open so you can see logs (saved captures).
rem  Close this window to stop the server.
rem ============================================================
setlocal
cd /d "%~dp0"

set "URL=http://localhost:8787"

rem ---- locate Node.js: PATH first, then common install dirs ----
set "NODE="
where node >nul 2>nul
if %errorlevel%==0 set "NODE=node"
if not defined NODE if exist "C:\Program Files\nodejs\node.exe" set "NODE=C:\Program Files\nodejs\node.exe"
if not defined NODE if exist "C:\Program Files (x86)\nodejs\node.exe" set "NODE=C:\Program Files (x86)\nodejs\node.exe"
if not defined NODE if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
if not defined NODE if exist "%USERPROFILE%\.workbuddy\binaries\node\versions\22.22.2-3\node.exe" set "NODE=%USERPROFILE%\.workbuddy\binaries\node\versions\22.22.2-3\node.exe"
if not defined NODE (
    echo [PhotoBooth] ERROR: Node.js was not found on this computer.
    echo [PhotoBooth] Please install Node.js LTS from https://nodejs.org and run this file again.
    echo.
    pause
    exit /b 1
)
echo [PhotoBooth] Using Node.js: %NODE%

rem ---- install dependencies on first run (fresh clone has no node_modules) ----
if exist "node_modules\qrcode\package.json" goto deps_ok
echo [PhotoBooth] First run: installing dependencies...
set "NPM=npm"
if /i not "%NODE%"=="node" (
    for %%i in ("%NODE%") do set "NPM=%%~dpinpm.cmd"
)
call "%NPM%" install --no-audit --no-fund
if errorlevel 1 (
    echo [PhotoBooth] ERROR: dependency install failed. Check your network connection.
    echo.
    pause
    exit /b 1
)
:deps_ok

rem ---- already running? ----
curl -s "%URL%/api/config" 2>nul | find "idle" >nul
if %errorlevel%==0 (
    echo [PhotoBooth] Server is already running at %URL%
    echo.
    pause
    exit /b 0
)

echo [PhotoBooth] Starting server...
echo [PhotoBooth] Close this window to stop it.
echo.
"%NODE%" server.js

echo.
echo [PhotoBooth] Server stopped.
pause
endlocal
