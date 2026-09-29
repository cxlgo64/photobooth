@echo off
rem ============================================================
rem  Photo Booth server only (no browser)
rem  Keeps the window open so you can see logs (saved captures).
rem  Close this window to stop the server.
rem ============================================================
setlocal
cd /d "%~dp0"

set "NODE=%USERPROFILE%\.workbuddy\binaries\node\versions\22.22.2-3\node.exe"
set "URL=http://localhost:8787"

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
%NODE% server.js

echo.
echo [PhotoBooth] Server stopped.
pause
endlocal
