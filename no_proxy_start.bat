@echo off
title VAR Tracker
color 0A

echo ================================
echo   VAR Electrochem Labor Tracker
echo ================================
echo.

:: Check Node
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed.
    echo Go to https://nodejs.org and install it first.
    echo.
    pause
    exit
)

echo Node.js found. Good.
echo.

:: Bypass proxy for npm
npm config set proxy null
npm config set https-proxy null
npm config set no-proxy localhost,127.0.0.1

:: Install dependencies
if not exist "node_modules" (
    echo Installing dependencies - this may take 5 minutes...
    echo DO NOT CLOSE THIS WINDOW.
    echo.
    npm install
    if %errorlevel% neq 0 (
        echo.
        echo ERROR: npm install failed.
        echo Screenshot this window and send to Phani.
        echo.
        pause
        exit
    )
    echo.
    echo Dependencies installed successfully.
    echo.
)

:: Database setup
echo Setting up database...
npx prisma migrate deploy
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Database setup failed.
    echo Screenshot this window and send to Phani.
    echo.
    pause
    exit
)

npx prisma db seed 2>nul
echo Database ready.
echo.

:: Launch
echo ================================
echo   App is starting...
echo   Opening Chrome automatically.
echo   
echo   If Chrome does not open, go to:
echo   http://localhost:3000
echo ================================
echo.
timeout /t 4 >nul
start chrome http://localhost:3000
npm start
pause
