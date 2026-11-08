@echo off
setlocal
chcp 65001 >nul
title 相机框架编辑器 - 构建编辑器
if not exist "%~dp0scripts\build-editor.ps1" goto missing_script
set "BUILD_NO_PAUSE="
if /I "%~1"=="--no-pause" set "BUILD_NO_PAUSE=-NoPause"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-editor.ps1" %BUILD_NO_PAUSE%
exit /b %errorlevel%
:missing_script
echo 构建失败：缺少 scripts\build-editor.ps1，请完整拉取源码后重试。
if /I not "%~1"=="--no-pause" pause
exit /b 1
