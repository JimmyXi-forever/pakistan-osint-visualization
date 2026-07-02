# Claude Code 项目说明

## 项目定位

这是一个静态 HTML/JavaScript 可视化项目，主题为“涉恐开源情报的可视化呈现 - 以巴基斯坦恐袭案件为例”。

## 启动方式

```bash
npm run dev
```

打开 `http://localhost:4173`。

## 文件导航

- `index.html`：页面入口。
- `src/app.js`：筛选、列表、地图和详情交互。
- `src/styles.css`：视觉样式。
- `data/incidents.json`：人工核验后的事件数据。
- `data/live-incidents.json`：在线自动版读取的数据。
- `scripts/fetch-gdelt.mjs`：近一周候选报道搜索脚本。
- `scripts/update-live-data.mjs`：生成在线实时数据。
- `scripts/validate-data.mjs`：数据结构校验脚本。
- `.github/workflows/deploy-pages.yml`：GitHub Pages 定时更新与部署。
- `docs/data-methodology.md`：数据方法。
- `docs/source-log.md`：来源记录。

## 开发原则

- 保持无构建工具依赖，方便在不同 AI 编码环境中直接运行。
- 新增事件先核验来源，再写入 `incidents.json`。
- 自动候选只进入 `live-incidents.json`，不要直接当作已核验事实。
- 不确定信息使用 `confidence` 和 `fatalities.note` 明确说明。
