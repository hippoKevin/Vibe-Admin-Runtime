@echo off
chcp 65001 >nul
cd /d %~dp0
title 汇创ETP ADMIN 项目启动器
echo.
echo   正在启动，请勿关闭本窗口...
echo   停止服务请按 Ctrl+C
echo.
node QuickStart\quick_start.js
echo.
echo   服务已停止，按任意键退出...
pause >nul