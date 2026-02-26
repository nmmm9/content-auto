@echo off
echo ==========================================
echo   Auto Upload System
echo ==========================================
echo.
echo Starting Backend Server (port 8000)...
start cmd /k "cd backend && venv\Scripts\activate && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"

timeout /t 3 /nobreak > nul

echo Starting Frontend Server (port 5173)...
start cmd /k "cd frontend && npm run dev"

echo.
echo ==========================================
echo   Servers Started!
echo ==========================================
echo.
echo   Backend API: http://localhost:8000
echo   API Docs:    http://localhost:8000/docs
echo   Frontend:    http://localhost:5173
echo.
echo Press any key to exit this window...
pause > nul
