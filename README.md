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
