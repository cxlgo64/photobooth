@echo off
rem ============================================================
rem  Photo Booth deployment script
rem  Run this file on the TARGET (booth) machine. It will:
rem    1. Download and install Node.js LTS if missing
rem    2. Copy this project to %USERPROFILE%\Documents\photobooth
rem    3. Install dependencies there
rem    4. Add a launcher to the Windows Startup folder so the
rem       booth starts automatically at every logon
rem ============================================================
setlocal
cd /d "%~dp0"

set "SRC=%~dp0"
if "%SRC:~-1%"=="\" set "SRC=%SRC:~0,-1%"
set "DEST=%USERPROFILE%\Documents\photobooth"
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "NODE_VER=v22.22.2"
set "NODE_MSI=node-%NODE_VER%-x64.msi"
set "NODE_URL=https://nodejs.org/dist/%NODE_VER%/%NODE_MSI%"

echo [Deploy] Photo Booth deployment started.

rem ---- 1. Node.js ----
where node >nul 2>nul && goto node_ok
if exist "C:\Program Files\nodejs\node.exe" goto node_ok

echo [Deploy] Node.js not found. Downloading %NODE_VER% ...
curl -L -o "%TEMP%\%NODE_MSI%" "%NODE_URL%"
if errorlevel 1 (
    echo [Deploy] ERROR: download failed. Check your network connection.
    pause
    exit /b 1
)
echo [Deploy] Installing Node.js, please wait...
msiexec /i "%TEMP%\%NODE_MSI%" /qn /norestart
if errorlevel 1 (
    echo [Deploy] Silent install needs admin rights, launching installer...
    msiexec /i "%TEMP%\%NODE_MSI%"
)
if not exist "C:\Program Files\nodejs\node.exe" (
    echo [Deploy] ERROR: Node.js installation failed.
    pause
    exit /b 1
)
:node_ok
echo [Deploy] Node.js OK.

rem ---- 2. copy project to Documents ----
echo [Deploy] Copying project to %DEST% ...
robocopy "%SRC%" "%DEST%" /E /XD node_modules captures .git /XF _*.txt *.log /NFL /NDL /NJH /NJS
if errorlevel 8 (
    echo [Deploy] ERROR: copy failed.
    pause
    exit /b 1
)

rem ---- 3. install dependencies ----
if exist "%DEST%\node_modules\qrcode\package.json" goto deps_ok
set "NPM=npm"
if exist "C:\Program Files\nodejs\node.exe" set "NPM=C:\Program Files\nodejs\npm.cmd"
echo [Deploy] Installing dependencies...
pushd "%DEST%"
call "%NPM%" install --no-audit --no-fund
popd
rem (check the result by file existence: npm.cmd does not reliably
rem  propagate its exit code through `call`)
if not exist "%DEST%\node_modules\qrcode\package.json" (
    echo [Deploy] ERROR: npm install failed. Check your network connection.
    pause
    exit /b 1
)
:deps_ok

rem ---- 4. Startup folder launcher ----
echo [Deploy] Creating Startup launcher...
(
    echo @echo off
    echo call "%DEST%\start.bat"
) > "%STARTUP_DIR%\photobooth.bat"

echo.
echo [Deploy] Done! The photo booth will start automatically at every logon.
echo [Deploy] To start it right now, run: %DEST%\start.bat
echo.
pause
endlocal
