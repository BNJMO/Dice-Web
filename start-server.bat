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

REM Start the development server
echo [INFO] Starting Vite development server...
echo.
echo The game will open automatically in your browser.
echo If not, navigate to: http://localhost:3000
echo.
echo Press Ctrl+C to stop the server.
echo.

call npm run dev

pause

