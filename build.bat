@echo off
REM NeuralPlay Full Build Script for Windows
REM This script cleans and rebuilds everything from scratch

echo ========================================
echo NeuralPlay Full Build Script
echo ========================================
echo.

REM Step 0: Clean previous builds
echo Step 0/5: Cleaning previous builds...
if exist "release" rmdir /s /q "release"
if exist "dist" rmdir /s /q "dist"
if exist "backend-dist" rmdir /s /q "backend-dist"
if exist "build" rmdir /s /q "build"
echo Previous builds cleaned.
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    pause
    exit /b 1
)

REM Check if Node is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed or not in PATH
    pause
    exit /b 1
)

echo Step 1/5: Installing Python dependencies...
pip install pyinstaller
pip install -r backend/requirements.txt

echo.
echo Step 2/5: Building Python backend with PyInstaller...
echo This may take a while (bundling ML models)...
pyinstaller neuralplay-backend.spec --distpath backend-dist --workpath build/pyinstaller --clean -y

echo.
echo Step 3/5: Installing Node dependencies...
call npm install

echo.
echo Step 4/5: Building React frontend (Vite)...
call npm run build

echo.
echo Step 5/5: Building Electron app and creating installer...
call npm run dist:win

echo.
echo ========================================
echo BUILD COMPLETE!
echo ========================================
echo.
echo Output files:
echo   - Installer: release\NeuralPlay-Setup-1.0.0.exe
echo   - Unpacked:  release\win-unpacked\NeuralPlay.exe
echo.
echo To test the app, run:
echo   release\win-unpacked\NeuralPlay.exe
echo.
pause
