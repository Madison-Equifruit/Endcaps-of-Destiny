@echo off
echo Starting Banana Badass: Endcaps of Destiny...
echo.
echo Game will open at: http://localhost:8000
echo Leaderboard display: http://localhost:8000/leaderboard.html
echo.
echo Press Ctrl+C to stop the server when done.
echo.
cd /d "%~dp0output"
start "" "chrome" "http://localhost:8000"
python -m http.server 8000
pause
