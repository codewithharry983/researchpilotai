@echo off
echo ========================================================
echo Launching ResearchPilot AI — Full Stack Environment
echo ========================================================
cd /d "%~dp0"

echo [1/2] Starting Backend API in new window...
start "ResearchPilot AI - Backend" run_backend.bat

echo Waiting 3 seconds for backend initialization...
timeout /t 3 /nobreak >nul

echo [2/2] Starting Frontend in new window...
start "ResearchPilot AI - Frontend" run_frontend.bat

echo.
echo ========================================================
echo Both services are now running:
echo - Frontend Web Application: http://localhost:5173
echo - Backend REST API:         http://127.0.0.1:8000
echo - Interactive OpenAPI Docs: http://127.0.0.1:8000/api/docs
echo ========================================================
