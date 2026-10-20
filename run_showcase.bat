@echo off
title STARK INDUSTRIES // SPIDER-MAN HOLOGRAPHIC AR SUIT SELECTOR
echo ==============================================================================
echo [STARK INDUSTRIES] INITIALIZING HOLOTABLE AR SHOWCASE SYSTEM...
echo ==============================================================================
cd /d "%~dp0Spider_Holo_Showcase"

echo Starting Local Hologram Server...
start "" cmd /c "npm run dev"

timeout /t 3 /nobreak >nul

echo Launching Holographic HUD Interface in Fullscreen...
start "" "http://localhost:5173"

echo.
echo ==============================================================================
echo  SYSTEM ONLINE! Web App running at http://localhost:5173
echo  Webcam & Hand Tracking: Active
echo  3D Hologram Pedestals: Ready
echo ==============================================================================
pause
