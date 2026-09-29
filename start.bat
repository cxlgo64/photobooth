@echo off
rem ============================================================
rem  Photo Booth launcher (Windows)
rem  1. Find Node.js on this computer
rem  2. Install dependencies on first run
rem  3. Start the server (skip if already running)
rem  4. Open browser in fullscreen kiosk mode
rem  Exit kiosk: Alt+F4
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

rem ---- check if server is already up ----
curl -s "%URL%/api/config" 2>nul | find "idle" >nul
if %errorlevel%==0 (
    echo [PhotoBooth] Server already running.
    goto open_browser
)

rem ---- start server minimized ----
echo [PhotoBooth] Starting server...
start "PhotoBooth Server" /min "" "%NODE%" server.js

rem ---- wait until ready (max ~30s) ----
set /a tries=0
:wait_loop
set /a tries+=1
if %tries% gtr 30 (
    echo [PhotoBooth] Server did not respond in time. Check the server window.
    pause
    exit /b 1
)
timeout /t 1 /nobreak >nul
curl -s "%URL%/api/config" 2>nul | find "idle" >nul
if errorlevel 1 goto wait_loop
echo [PhotoBooth] Server is ready.

:open_browser
rem ---- open browser in kiosk fullscreen, Chrome first, Edge fallback ----
set "CHROME1=C:\Program Files\Google\Chrome\Application\chrome.exe"
set "CHROME2=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
set "EDGE1=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
set "EDGE2=C:\Program Files\Microsoft\Edge\Application\msedge.exe"

if exist "%CHROME1%" (
    start "" "%CHROME1%" --kiosk "%URL%"
    goto done
)
if exist "%CHROME2%" (
    start "" "%CHROME2%" --kiosk "%URL%"
    goto done
)
if exist "%EDGE1%" (
    start "" "%EDGE1%" --kiosk "%URL%" --edge-kiosk-type=fullscreen
    goto done
)
if exist "%EDGE2%" (
    start "" "%EDGE2%" --kiosk "%URL%" --edge-kiosk-type=fullscreen
    goto done
)

echo [PhotoBooth] Chrome/Edge not found, opening default browser.
start "" "%URL%"

:done
endlocal
