@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在推送到 GitHub: Shredxhub/NotionNext.shpages
echo 分支: shredxhub.com
echo.
git push origin shredxhub.com
if errorlevel 1 (
  echo 推送失败。请检查: 1) 网络 2) 是否已 commit 3) 远程权限
) else (
  echo 已推送到 https://github.com/Shredxhub/NotionNext.shpages
)
echo.
pause
