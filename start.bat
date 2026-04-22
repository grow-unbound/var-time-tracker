@echo off
title VAR Tracker

echo Starting VAR Labor Tracker...
echo.

:: Check if Node is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed.
    echo Please download and install it from https://nodejs.org
    echo Then double-click this file again.
    pause
    exit
)

:: Install dependencies if node_modules missing
if not exist "node_modules" (
    echo First time setup - installing dependencies...
    npm install
    echo.
)

:: Run DB migrations if needed
echo Setting up database...
npx prisma migrate deploy
npx prisma db seed 2>nul

:: Start the app
echo.
echo ✓ VAR Tracker is running.
echo ✓ Open Chrome and go to: http://localhost:3000
echo.
echo Press Ctrl+C to stop the app.
echo.

timeout /t 3 >nul
start chrome http://localhost:3000

npm start
pause
