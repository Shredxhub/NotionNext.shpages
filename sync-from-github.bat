@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo === 正在从 GitHub 拉取最新内容 ===
git fetch origin
git pull origin shredxhub.com
echo.
echo === 完成 ===
pause
