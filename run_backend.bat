@echo off
echo ========================================================
echo Starting ResearchPilot AI Backend API (FastAPI + Uvicorn)
echo ========================================================
cd /d "%~dp0backend"
python -m alembic upgrade head
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
pause
