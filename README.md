# 涉恐开源情报的可视化呈现 - 以巴基斯坦恐袭案件为例

这是一个可直接运行并可部署上线的静态前端项目，用于展示公开报道中的巴基斯坦涉恐事件。页面支持按时间、地区、事件类型和关键词筛选，并在地图上交互查看详情。

事件详情支持展示图片信源。图片只收录带有明确来源页面、图注和摄影/机构署名的信息；无法确认现场关联性的示意图、AI 生成图或无出处图片不作为证据图片展示。

项目已预置在线自动更新链路：GitHub Actions 定时查询 GDELT 候选报道，生成 `data/live-incidents.json`，再部署到 GitHub Pages。自动候选会标注为“待核验”，不与人工核验事件混同。

## 快速运行

```bash
cd /Users/fangfangfangfang/涉恐开源情报的可视化呈现-以巴基斯坦恐袭案件为例
npm run dev
```

然后访问：

```text
http://localhost:4173
```

也可以不用 npm，直接运行：

```bash
python3 -m http.server 4173
```

## 在线部署

1. 在 GitHub 新建仓库。
2. 上传本项目全部文件。
3. 进入仓库 `Settings -> Pages`。
4. 在 `Build and deployment` 中选择 `GitHub Actions`。
5. 推送到 `main` 或 `master` 分支后，`.github/workflows/deploy-pages.yml` 会自动部署。
6. 部署完成后，GitHub 会给出公开访问网址。

定时更新规则：

- 每小时第 17 分钟运行一次。
- 自动运行 `npm run update:live` 查询 GDELT。
- 自动运行 `npm run validate` 校验数据。
- 自动发布最新静态网站。

## 项目结构

```text
.
├── index.html                  # 页面入口，引用 Leaflet 地图和前端脚本
├── src/
│   ├── app.js                  # 数据加载、筛选、地图标记、详情面板
│   └── styles.css              # 页面样式
├── data/
│   ├── incidents.json          # 已核验并手动整理的事件数据，含来源和图片信源字段
│   └── live-incidents.json     # 在线版读取的数据；部署时由自动脚本刷新
├── scripts/
│   ├── fetch-gdelt.mjs         # 自动搜索近一周候选报道
│   ├── update-live-data.mjs    # 生成在线实时数据
│   └── validate-data.mjs       # 校验 incidents.json 结构
├── .github/workflows/
│   └── deploy-pages.yml        # GitHub Pages 定时部署与自动更新
├── docs/
│   ├── data-methodology.md     # 数据方法和更新流程
│   └── source-log.md           # 初版来源记录
├── AGENTS.md                   # 给 Codex 的项目说明
└── CLAUDE.md                   # 给 Claude Code 的项目说明
```

## 数据更新流程

1. 运行候选报道搜索：

```bash
npm run fetch:data
```

2. 人工核验 `data/gdelt-articles.latest.json` 中的候选报道。
3. 将确认的案件整理进 `data/incidents.json`。
4. 校验数据：

```bash
npm run validate
```

## 自动更新流程

本地或 GitHub Actions 中运行：

```bash
npm run update:live
```

该命令会：

- 读取 `data/incidents.json` 中的人工核验事件。
- 查询 GDELT 近 3 天巴基斯坦涉恐候选报道。
- 转换为带 `reviewStatus: "auto-candidate"` 的候选事件。
- 写入 `data/live-incidents.json`。
- 保留原始候选报道到 `data/gdelt-articles.latest.json`。

自动候选只用于态势发现，进入正式分析或论文引用前仍需人工核验。

## 当前数据说明

初版数据最后核验日期为 2026-06-30。页面优先读取 `data/live-incidents.json`；若不存在或读取失败，则回退到 `data/incidents.json`。页面默认显示“恐袭”类型；“关联反恐行动”和“未核验候选”可通过事件类型筛选查看。

过去一周公开报道中，能明确定位并由主流公开来源核验的核心巴基斯坦境内恐袭案件为卡拉奇 Sindh Rangers 总部袭击。后续更新只需追加 `data/incidents.json`，前端筛选和地图会自动读取。
