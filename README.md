# Field Notes · 旅行地图册样张

手机优先的意大利 / 东京双主题静态 PWA 样张。两份攻略复用同一套设计与代码，但通过独立地址展示给不同旅行者；所有行程、价格和预约内容均为版式示例，不代表真实旅行建议。

## 本地查看

在本目录启动任意静态服务器，例如：

```powershell
python -m http.server 4177
```

然后打开入口目录 `http://127.0.0.1:4177/`。对外分享时分别使用：

- 意大利：`http://127.0.0.1:4177/italy/`
- 东京：`http://127.0.0.1:4177/tokyo/`

两份页面拥有独立的 PWA 清单和本地管理状态。Service Worker、离线缓存和安装功能不能通过直接双击 `index.html` 验证。

## 内容维护

- `data/trips.json`：旅行、每日地点、预约、预算和清单数据。
- `styles.css`：双主题视觉系统和响应式布局。
- `src/core.mjs`：校验、预算、预约状态和本地数据迁移。
- `src/view.mjs`：可测试的 HTML 渲染层。
- `src/app.mjs`：浏览器事件、本地存储和离线提示。
- `italy/`、`tokyo/`：面向不同旅行者的独立入口与安装清单。

字体来自 Google Fonts 官方仓库，许可文件保存在 `fonts/`。两张封面图由 OpenAI 图像生成工具生成，并由 `scripts/process_hero.py` 从原创双联图裁切压缩为 WebP。

## 晚间推荐媒体工作流

媒体来源按安全顺序选择：先核验场所官方发布的可复用实景照片，再核验 Wikimedia Commons / Openverse 中身份与许可都明确的场所照片；无法确认场所身份、许可或稳定下载时，使用带“示意插画”标记的项目原创插画。不要复制 Google、Tripadvisor 等聚合平台图片，也不要把候选搜索结果当作已获许可的素材。

更新 `scripts/evening-media-catalog.json` 及对应来源文件后，按以下顺序重建和校验：

```powershell
npm.cmd run media:build
node scripts/build_trip_data.mjs
npm.cmd run media:audit
npm.cmd test
```

`media:build` 会从受控来源文件生成 `assets/evening/*.webp` 与署名数据；`media:audit` 会阻止完全重复或近似重复的成品进入发布版本。每次媒体目录或元数据变化后，必须先重新生成 `data/trips.json`，再运行测试，确保页面与 Service Worker 缓存的是当前清单。
