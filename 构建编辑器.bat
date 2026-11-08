@echo off
setlocal
chcp 65001 >nul
title Camera Framework Editor - Build Editor
pushd "%~dp0"
if errorlevel 1 exit /b 1
set "BUILD_EXIT=1"
echo [1/3] Checking build environment...
where node.exe >nul 2>&1
if errorlevel 1 goto missing_node
where npm.cmd >nul 2>&1
if errorlevel 1 goto missing_node
node -e "const [major,minor]=process.versions.node.split('.').map(Number);process.exit(major>22 || major===22 && minor>=12 ? 0 : 1)"
if errorlevel 1 goto missing_node
if not exist "package-lock.json" goto missing_files
if not exist "runtime\lua54.exe" goto missing_files
for /f "delims=" %%V in ('node -p "require('./package.json').version"') do set "EDITOR_VERSION=%%V"
if not defined EDITOR_VERSION goto missing_files
if not exist "node_modules\.bin\vite.cmd" goto install_dependencies
if not exist "node_modules\.bin\tsc.cmd" goto install_dependencies
if not exist "node_modules\.bin\electron-builder.cmd" goto install_dependencies
if not exist "node_modules\electron\install.js" goto install_dependencies
goto prepare_electron
:install_dependencies
echo Installing locked dependencies. The first build may need internet access.
call npm.cmd ci --prefer-offline --no-audit --no-fund
if errorlevel 1 goto failed
:prepare_electron
echo Preparing the Electron runtime. The first download may need internet access.
call npm.cmd run electron:install
if errorlevel 1 goto failed
if not exist "node_modules\electron\dist\electron.exe" goto missing_electron
:build
echo [2/3] Compiling editor...
call npm.cmd run build
if errorlevel 1 goto failed
echo [3/3] Creating Windows x64 installer...
call npm.cmd run package:installer
if errorlevel 1 goto failed
if not exist "release\CameraFrameworkEditor-%EDITOR_VERSION%-Setup.exe" goto failed
set "BUILD_EXIT=0"
echo.
echo SUCCESS - Editor output:
echo "%CD%\release\win-unpacked\相机框架编辑器.exe"
echo.
echo Installer output:
echo "%CD%\release\CameraFrameworkEditor-%EDITOR_VERSION%-Setup.exe"
goto done
:missing_node
echo ERROR: Install Node.js 22.12 or newer, then reopen this script.
goto done
:missing_files
echo ERROR: Required project files are missing. Keep this script in the editor root folder.
goto done
:missing_electron
echo ERROR: Electron runtime is missing after installation. Check the download output above.
goto done
:failed
echo.
echo ERROR: Build failed. Review the messages above. No successful build is reported.
:done
echo.
if /I not "%~1"=="--no-pause" pause
popd
exit /b %BUILD_EXIT%
