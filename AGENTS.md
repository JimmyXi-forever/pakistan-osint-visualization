# Codex 项目说明

## 目标

本项目用于把巴基斯坦涉恐开源情报以在线 HTML 方式可视化展示。优先保持静态、透明、易运行。

## 运行

```bash
npm run dev
```

访问 `http://localhost:4173`。

## 常用任务

- 更新事件数据：编辑 `data/incidents.json`。
- 校验数据结构：运行 `npm run validate`。
- 抓取候选报道：运行 `npm run fetch:data`，再人工核验。
- 生成在线数据：运行 `npm run update:live`，会写入 `data/live-incidents.json`。
- 修改页面逻辑：编辑 `src/app.js`。
- 修改样式：编辑 `src/styles.css`。

## 约定

- 不把“恐袭”和“反恐行动”混写；用 `incidentType` 区分。
- 涉及伤亡数字分歧时，保留区间和来源说明。
- 新增事件必须包含至少一个来源链接。
- 自动候选必须保留 `reviewStatus: "auto-candidate"`，人工确认后再改为 `reviewed`。
- 地图坐标可以先精确到城市中心，但要在摘要中说明具体地点。
