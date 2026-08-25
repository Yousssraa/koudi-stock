@echo off
setlocal
title KOUDI STOCK - Demo Launcher
cd /d "%~dp0"

echo ============================================================
echo   KOUDI STOCK - Vente & Gestion de Stock du Bois (demo presentation)
echo   Adresse unique : http://127.0.0.1:8001
echo ============================================================
echo.

echo [1/4] Construction du frontend...
cd frontend
call npm run build
if errorlevel 1 (
  echo.
  echo ERREUR : la construction du frontend a echoue.
  pause
  exit /b 1
)
cd ..

echo [2/4] Collecte des fichiers statiques (compression + cache headers)...
cd backend
python manage.py collectstatic --noinput
if errorlevel 1 (
  echo.
  echo ERREUR : la collecte des statiques a echoue.
  pause
  exit /b 1
)
cd ..

echo [3/4] Demarrage du serveur (API + interface) sur le port 8001...
echo       (fenetre separee : "KOUDI STOCK backend 8001")
start "KOUDI STOCK backend 8001" cmd /k "cd /d ""%~dp0backend"" & python manage.py runserver 127.0.0.1:8001 --noreload"

echo [4/4] Ouverture du navigateur...
timeout /t 6 /nobreak >nul
start "" http://127.0.0.1:8001

echo.
echo KOUDI STOCK est disponible sur  http://127.0.0.1:8001
echo.
echo - Le backend (API + interface) tourne dans la fenetre
echo   "KOUDI STOCK backend 8001" : fermez-la pour arreter.
echo - Si le port 8001 est deja utilise, arretez l'ancienne
echo   instance puis relancez ce script.
echo.
pause
