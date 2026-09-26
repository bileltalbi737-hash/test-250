@echo off
REM ============================================================
REM  Dofus MultiSwitch - verification de l'environnement,
REM  installation automatique de Python si besoin, puis lancement.
REM  Double-cliquez simplement sur ce fichier.
REM ============================================================
setlocal
cd /d "%~dp0"
title Dofus MultiSwitch - installation / lancement

rem ---- Python avec tkinter deja present ? ----
py -3 -c "import tkinter" >nul 2>&1
if not errorlevel 1 goto :launch_py
python -c "import tkinter" >nul 2>&1
if not errorlevel 1 goto :launch_python

echo Python n'est pas installe sur ce PC.
echo Tentative d'installation automatique (winget)...
echo.
winget install --id Python.Python.3.12 -e --accept-source-agreements --accept-package-agreements
if errorlevel 1 (
    echo.
    echo Installation automatique impossible : la page de telechargement
    echo officielle va s'ouvrir. Installez Python en laissant cochees les
    echo options par defaut, puis relancez ce script.
    start "" https://www.python.org/downloads/
    pause
    exit /b 1
)
echo.
echo Python est installe ! Relancez ce script pour demarrer l'outil.
pause
exit /b 0

:launch_py
where pyw >nul 2>&1
if not errorlevel 1 (
    start "" pyw -3 "%~dp0DofusMultiSwitch.pyw"
) else (
    start "" "%~dp0DofusMultiSwitch.pyw"
)
exit /b 0

:launch_python
where pythonw >nul 2>&1
if not errorlevel 1 (
    start "" pythonw "%~dp0DofusMultiSwitch.pyw"
) else (
    start "" "%~dp0DofusMultiSwitch.pyw"
)
exit /b 0
