# Shredhub 保留文件说明

与上游 [tangly1024/NotionNext](https://github.com/tangly1024/NotionNext) 同步时，以下文件**始终保留 Shredhub 版本**，不会被上游覆盖：

| 文件 | 说明 |
|------|------|
| `blog.config.js` | 站点配置：虾滑/Shredhub 标题、链接、Notion 页面 ID、社交链接等 |
| `themes/heo/config.js` | Heo 主题配置：欢迎语、英雄区文案、Shredxhub 链接与品牌 |
| `components/NotionPage.js` | 文章页渲染组件（你的修改会保留） |
| `styles/notion.css` | Notion 样式覆盖（你的修改会保留） |
| `components/CustomCollection.js` | 已删除，同步后仍保持删除 |

## 如何同步到 NotionNext 最新版

在项目根目录**双击运行**：

```
sync-from-notionnext.bat
```

或在命令行执行：

```bash
sync-from-notionnext.bat
```

脚本会：备份上述文件 → 拉取并合并 `upstream/main` → 用备份覆盖回来，保证你的定制不丢。
