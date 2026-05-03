@echo off
title EnerQoT Master Launcher
echo ==========================================
echo   EnerQoT - One-Click Launcher
echo ==========================================

:: 1. Sync IP Address
echo [1/3] Syncing Local IP for Mobile App...
python sync_env.py

:: 2. Check for secret files
if not exist "backend\.env" (
    echo [ERROR] backend\.env is missing! Please ask the lead for this file.
    pause
    exit
)

:: 3. Start Backend
echo [2/3] Starting Backend Server...
start cmd /k "cd backend && python run.py"

:: 4. Start Mobile App
echo [3/3] Starting Mobile App (Expo)...
echo (Tip: Press 'r' in the next window if you just changed Wi-Fi)
start cmd /k "cd mobile-app && npx expo start"

echo ==========================================
echo   ALL SYSTEMS STARTING...
echo ==========================================
pause
