@echo off
echo.
echo ========================================
echo   BNJMO - Starting Server
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

REM Prepare Vite base path for export
echo [INFO] Setting Vite base path for export build...
node scripts\updateBuildConfig.cjs --set-vite-path export --skip-metadata
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to set export Vite path.
    exit /b 1
)

REM Start the development server
echo [INFO] Starting Vite build...

REM Update build metadata
echo [INFO] Updating build metadata...
node scripts\updateBuildConfig.cjs
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to update build metadata.
    exit /b 1
)

call npm run build
set buildResult=%ERRORLEVEL%

REM Restore local Vite base path after build
echo [INFO] Restoring local Vite base path...
node scripts\updateBuildConfig.cjs --set-vite-path local --skip-metadata
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to restore local Vite path.
    exit /b 1
)

if %buildResult% NEQ 0 (
    echo [ERROR] Build failed.
    exit /b %buildResult%
)

pause

