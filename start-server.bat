@echo off
echo.
echo ========================================
echo   Mines Game - Starting Server
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed!
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist "node_modules\" (
    echo [INFO] Installing dependencies...
    echo.
    call npm install
    echo.
)

REM Update Vite base path before starting the dev server
set "CONFIG_FILE=vite.config.js"
set "ORIGINAL_BASE=/Dice-Web/"
set "TEMP_BASE=/_Games/dice_crash/"

echo [INFO] Temporarily setting Vite base to %TEMP_BASE%
powershell -NoProfile -Command "(Get-Content -Raw '%CONFIG_FILE%') -replace 'base:\s*''[^'']*''', 'base: ''%TEMP_BASE%''' | Set-Content '%CONFIG_FILE%'"

REM Start the development server
echo [INFO] Starting Vite development server...
echo.
echo The game will open automatically in your browser.
echo If not, navigate to: http://localhost:3000
echo.
echo Press Ctrl+C to stop the server.
echo.

call npm run dev

echo [INFO] Restoring original Vite base path (%ORIGINAL_BASE%)
powershell -NoProfile -Command "(Get-Content -Raw '%CONFIG_FILE%') -replace 'base:\s*''[^'']*''', 'base: ''%ORIGINAL_BASE%''' | Set-Content '%CONFIG_FILE%'"

pause

