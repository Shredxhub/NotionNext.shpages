@echo off
chcp 65001 >nul
cd /d "%~dp0"

set BACKUP=.shredhub-backup
echo === 1/6 备份 Shredhub 定制文件 ===
if not exist "%BACKUP%" mkdir "%BACKUP%"
if not exist "%BACKUP%\themes\heo" mkdir "%BACKUP%\themes\heo"
if not exist "%BACKUP%\components" mkdir "%BACKUP%\components"
if not exist "%BACKUP%\styles" mkdir "%BACKUP%\styles"
copy /Y "blog.config.js" "%BACKUP%\blog.config.js" >nul
copy /Y "themes\heo\config.js" "%BACKUP%\themes\heo\config.js" >nul
copy /Y "components\NotionPage.js" "%BACKUP%\components\NotionPage.js" >nul
copy /Y "styles\notion.css" "%BACKUP%\styles\notion.css" >nul
echo 已备份: blog.config.js, themes/heo/config.js, components/NotionPage.js, styles/notion.css

echo.
echo === 2/6 拉取 NotionNext 上游 (tangly1024/NotionNext) ===
git fetch upstream
if errorlevel 1 ( echo git fetch 失败 & pause & exit /b 1 )

echo.
echo === 3/6 合并 upstream/main ===
git merge upstream/main
set MERGE_ERR=0
if errorlevel 1 set MERGE_ERR=1

echo.
echo === 4/6 恢复 Shredhub 定制文件（覆盖合并结果）===
copy /Y "%BACKUP%\blog.config.js" "blog.config.js" >nul
copy /Y "%BACKUP%\themes\heo\config.js" "themes\heo\config.js" >nul
copy /Y "%BACKUP%\components\NotionPage.js" "components\NotionPage.js" >nul
copy /Y "%BACKUP%\styles\notion.css" "styles\notion.css" >nul
git add blog.config.js themes/heo/config.js components/NotionPage.js styles/notion.css
echo 已恢复并暂存上述 4 个文件

REM 若上游带回了 CustomCollection.js，保持 Shredhub 的“删除”状态
if exist "components\CustomCollection.js" (
  del "components\CustomCollection.js"
  git add components/CustomCollection.js
  echo 已保持 components/CustomCollection.js 为删除状态
)

if %MERGE_ERR%==1 (
  echo.
  echo 合并时有冲突，已用你的版本覆盖了上述 4 个文件。请检查其他冲突文件并手动解决后运行 push-to-github.bat 推送到 GitHub。
) else (
  echo.
  echo === 5/6 提交并推送到 GitHub (Shredxhub/NotionNext.shpages) ===
  git add .
  git diff --cached --quiet
  if errorlevel 1 (
    git commit -m "chore: sync from NotionNext upstream, keep Shredhub customizations"
    git push origin shredxhub.com
    if errorlevel 1 ( echo 推送失败，请检查网络或权限后运行 push-to-github.bat ) else ( echo 已推送到 https://github.com/Shredxhub/NotionNext.shpages )
  ) else (
    echo 没有新的更改需要提交，当前已与上游一致。
  )
)

echo.
echo === 完成 ===
pause
