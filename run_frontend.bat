@echo off
echo ========================================================
echo Starting ResearchPilot AI Frontend (Vite + React)
echo ========================================================
cd /d "%~dp0frontend"
call npm.cmd run dev
pause
