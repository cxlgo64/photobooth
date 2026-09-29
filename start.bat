@echo off
rem ============================================================
rem  Photo Booth launcher (Windows)
rem    start.bat          start server + open fullscreen browser
rem    start.bat server   server only (close window to stop)
rem  Exit kiosk mode: Alt+F4
rem ============================================================
setlocal
cd /d "%~dp0"
set "URL=http://localhost:8787"

rem ---- locate Node.js ----
set "NODE="
where node >nul 2>nul && set "NODE=node"
if not defined NODE if exist "C:\Program Files\nodejs\node.exe" set "NODE=C:\Program Files\nodejs\node.exe"
if not defined NODE if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE=%LOCALAPPDATA%\Programs\nodejs\node.exe"
if not defined NODE if exist "%USERPROFILE%\.workbuddy\binaries\node\versions\22.22.2-3\node.exe" set "NODE=%USERPROFILE%\.workbuddy\binaries\node\versions\22.22.2-3\node.exe"
if not defined NODE (
    echo [PhotoBooth] ERROR: Node.js not found. Install Node.js LTS from https://nodejs.org
    pause
    exit /b 1
)

rem ---- first run: install dependencies ----
rem (goto-style on purpose: %NPM% must NOT be set and used inside
rem  the same ( ) block - cmd expands it at parse time and it breaks)
if exist "node_modules\qrcode\package.json" goto deps_ok
echo [PhotoBooth] First run: installing dependencies...
set "NPM=npm"
if /i not "%NODE%"=="node" for %%i in ("%NODE%") do set "NPM=%%~dpinpm.cmd"
call "%NPM%" install --no-audit --no-fund
if errorlevel 1 (
    echo [PhotoBooth] ERROR: npm install failed. Check your network.
    pause
    exit /b 1
)
:deps_ok

rem ---- server-only mode ----
if /i "%~1"=="server" goto server_only

rem ---- start server if not already running ----
curl -s "%URL%/api/config" 2>nul | find "idle" >nul
if %errorlevel%==0 goto open_browser
echo [PhotoBooth] Starting server...
start "PhotoBooth Server" /min "" "%NODE%" server.js

set /a tries=0
:wait_loop
set /a tries+=1
if %tries% gtr 30 (
    echo [PhotoBooth] Server did not respond in time.
    pause
    exit /b 1
)
timeout /t 1 /nobreak >nul
curl -s "%URL%/api/config" 2>nul | find "idle" >nul
if errorlevel 1 goto wait_loop

:open_browser
rem ---- open kiosk fullscreen: Chrome first, Edge fallback ----
for %%B in (
    "C:\Program Files\Google\Chrome\Application\chrome.exe"
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
) do if exist %%B (
    start "" %%B --kiosk "%URL%"
    goto done
)
for %%B in (
    "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
) do if exist %%B (
    start "" %%B --kiosk "%URL%" --edge-kiosk-type=fullscreen
    goto done
)
echo [PhotoBooth] Chrome/Edge not found, opening default browser.
start "" "%URL%"
goto done

:server_only
echo [PhotoBooth] Server mode. Close this window to stop.
"%NODE%" server.js
pause

:done
endlocal
