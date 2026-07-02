# 在线自动版部署说明

## 目标架构

本项目采用轻量静态部署方案：

- 前端：GitHub Pages 托管 `index.html`、`src/`、`data/`。
- 自动采集：GitHub Actions 定时运行 `npm run update:live`。
- 数据源：GDELT DOC API 候选报道。
- 数据文件：`data/live-incidents.json`。
- 人工基准数据：`data/incidents.json`。

## 上线步骤

1. 创建 GitHub 仓库。
2. 上传项目全部文件，包括隐藏目录 `.github/` 和 `.nojekyll`。
3. 打开仓库设置。
4. 进入 `Pages`。
5. 将部署来源设置为 `GitHub Actions`。
6. 推送代码到 `main` 或 `master`。
7. 等待 `Deploy live OSINT map` 工作流完成。
8. 使用 GitHub Pages 给出的公开 URL 访问页面。

## 自动更新逻辑

`.github/workflows/deploy-pages.yml` 会：

- 每小时运行一次。
- 调用 GDELT 查询近 3 天候选报道。
- 合并人工核验事件和自动候选事件。
- 校验数据字段。
- 部署最新静态站点。

## 人工核验建议

自动候选不应直接作为最终事实引用。建议人工核验：

- 是否确为恐怖袭击，而非普通刑案、军事行动或旧闻重发。
- 日期是否为事件发生日期，而非报道发布时间。
- 地点是否可精确到城市、区县或设施。
- 伤亡数字是否有多源印证。
- 组织声称负责是否来自可信报道。
- 图片是否有明确图注、摄影署名和来源页面。

核验后，将事件从候选报道整理进 `data/incidents.json`，并把 `reviewStatus` 设为 `reviewed`。
