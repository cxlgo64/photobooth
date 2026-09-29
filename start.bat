@echo off
rem ============================================================
rem  Photo Booth launcher (Windows)
rem  1. Start the node server (skip if already running)
rem  2. Wait until it responds
rem  3. Open browser in fullscreen kiosk mode
rem  Exit kiosk: Alt+F4
rem ============================================================
setlocal
cd /d "%~dp0"

set "NODE=%USERPROFILE%\.workbuddy\binaries\node\versions\22.22.2-3\node.exe"
set "URL=http://localhost:8787"

rem ---- 1. check if server is already up ----
curl -s "%URL%/api/config" 2>nul | find "idle" >nul
if %errorlevel%==0 (
    echo [PhotoBooth] Server already running.
    goto open_browser
)

rem ---- 2. start server minimized ----
echo [PhotoBooth] Starting server...
start "PhotoBooth Server" /min "" %NODE% server.js

rem ---- 3. wait until ready (max ~30s) ----
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
rem ---- 4. open browser in kiosk fullscreen, Chrome first, Edge fallback ----
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
