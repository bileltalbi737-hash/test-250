@echo off
REM Construit un exécutable autonome DofusMultiSwitch.exe (optionnel).
REM Prérequis : Python 3 installé et accessible dans le PATH.

python -m pip install --upgrade pyinstaller
python -m PyInstaller --noconsole --onefile --name DofusMultiSwitch DofusMultiSwitch.pyw

echo.
echo Termine ! L'executable se trouve dans le dossier dist\
pause
