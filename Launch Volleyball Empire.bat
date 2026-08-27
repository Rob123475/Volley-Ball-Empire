@echo off
cd /d "%~dp0"
echo Starting Volleyball Empire...
echo.
call pnpm electron:dev
if errorlevel 1 (
  echo.
  echo ---------------------------------------------
  echo The app exited with an error - see above.
  echo ---------------------------------------------
  pause
)
