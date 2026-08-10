# Travel Interaction and Evening Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复两份攻略的新增与删除交互，放松时间轴版式，加入东京往返航班，并为每个住宿夜晚提供最后景点附近的餐厅与酒吧横向指南。

**Architecture:** 保留原生 HTML、CSS、ES Modules 与 JSON 架构。将面板开关和滑动判定拆成纯函数模块，主应用只协调 DOM 与持久化；`Trip.eveningGuides` 作为静态、可验证、可离线缓存的数据，由统一夜间指南组件渲染。

**Tech Stack:** HTML5、CSS、JavaScript ES Modules、Node.js test runner、Playwright、Service Worker、Wikimedia 本地图片、Google Maps/Tripadvisor HTTPS 外链。

## Global Constraints

- 意大利与东京页面、状态和分享地址保持独立，但复用同一套组件。
- Google Maps 当前评分不低于 4.5；Tripadvisor 评分仅在可核实时展示。
- 每个城市住宿夜晚优先提供 5 家餐厅与 5 家酒吧，公开结果不足时各保留 3 家，不降低评分门槛。
- 意大利 2026-08-30 与东京 2026-10-10 使用机场餐饮与候机提示，不推荐市区酒吧。
- 不接入 Google Places 或 Tripadvisor 付费 API，不承诺实时评分、营业时间或订位。
- 所有交互目标不小于 44px，支持键盘、减少动态效果与离线阅读。
- 项目没有 Git 仓库；每个任务以测试通过和目标文件 SHA256 清单作为可恢复检查点。

---

### Task 1: 面板状态与手势判定模块

**Files:**
- Create: `src/interaction.mjs`
- Create: `tests/interaction.test.mjs`

**Interfaces:**
- Produces: `classifyHorizontalGesture({ deltaX, deltaY, threshold }) -> 'reveal' | 'close' | 'none'`
- Produces: `nextPanelState(current, action) -> { type, dayDate, originId } | null`

- [ ] **Step 1: 写失败测试**

```js
test('left gesture reveals delete for touch, mouse and trackpad-equivalent deltas', () => {
  assert.equal(classifyHorizontalGesture({ deltaX: -72, deltaY: 8, threshold: 52 }), 'reveal');
  assert.equal(classifyHorizontalGesture({ deltaX: 46, deltaY: 4, threshold: 32 }), 'close');
  assert.equal(classifyHorizontalGesture({ deltaX: -20, deltaY: 80, threshold: 52 }), 'none');
});

test('panel state opens for a date and closes deterministically', () => {
  const opened = nextPanelState(null, { type: 'open-editor', dayDate: '2026-10-05', originId: 'add-1' });
  assert.deepEqual(opened, { type: 'editor', dayDate: '2026-10-05', originId: 'add-1' });
  assert.equal(nextPanelState(opened, { type: 'close' }), null);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/interaction.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: 实现纯函数**

实现方向优先级、阈值和明确的 panel action 枚举；无 DOM 依赖，未知 action 抛出可读错误。

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test tests/interaction.test.mjs`
Expected: 2 tests PASS.

- [ ] **Step 5: 记录检查点**

Run: `Get-FileHash src/interaction.mjs,tests/interaction.test.mjs -Algorithm SHA256`

### Task 2: 用应用内底部抽屉替换原生 dialog

**Files:**
- Modify: `src/view.mjs`
- Modify: `src/app.mjs`
- Modify: `styles.css`
- Modify: `tests/view.test.mjs`
- Modify: `tests/browser.test.mjs`

**Interfaces:**
- Consumes: `nextPanelState()` from Task 1.
- Produces DOM: `[data-panel="place-editor"]`, `[data-panel-backdrop]`, `[data-action="close-editor"]`.

- [ ] **Step 1: 扩展失败测试**

```js
assert.match(html, /data-panel="place-editor"/);
assert.doesNotMatch(html, /<dialog/);
```

Playwright 测试依次点击意大利与东京每天的首个 `[data-action="add-place"]`，断言面板 `hidden === false`；填写三语名称、地址与时间，保存后断言对应日期新增卡片且刷新后仍存在。

- [ ] **Step 2: 运行测试确认当前原生 dialog 结构导致失败**

Run: `node --test tests/view.test.mjs tests/browser.test.mjs`
Expected: view test FAIL because `<dialog>` still exists.

- [ ] **Step 3: 最小替换渲染结构**

用固定定位 `<section role="dialog" aria-modal="true" hidden>` 渲染抽屉；保留现有表单字段、联网搜索与手动保存数据接口。

- [ ] **Step 4: 接入开关、焦点和滚动恢复**

`app.mjs` 保存触发按钮 id，打开时移除 `hidden`、锁定 body 滚动并聚焦搜索框；关闭时恢复滚动和焦点。Esc、关闭按钮与遮罩调用同一个 `closePanel()`。

- [ ] **Step 5: 样式与响应式**

手机抽屉占视口高度不超过 88svh，桌面最大宽度 720px；底部安全区和固定导航互不遮挡；减少动态效果时取消位移动画。

- [ ] **Step 6: 运行聚焦测试**

Run: `node --test tests/view.test.mjs tests/browser.test.mjs`
Expected: add editor opens, saves, closes and persists for both trips.

- [ ] **Step 7: 记录检查点**

Run: `Get-FileHash src/view.mjs,src/app.mjs,styles.css -Algorithm SHA256`

### Task 3: 删除轨道兼容触摸、鼠标、触控板与键盘

**Files:**
- Modify: `src/app.mjs`
- Modify: `src/view.mjs`
- Modify: `styles.css`
- Modify: `tests/browser.test.mjs`

**Interfaces:**
- Consumes: `classifyHorizontalGesture()` from Task 1.
- Preserves: `removePlace()`, `restorePlace()` and 6-second undo state.

- [ ] **Step 1: 写跨输入失败测试**

Playwright 创建 `hasTouch: true` 手机上下文与普通桌面上下文：分别派发左向 pointer 序列，断言卡片获得 `is-swiped`；点击常显 `[data-action="place-menu"]` 也必须露出删除轨道。删除后数量减一，撤销后恢复。

- [ ] **Step 2: 运行测试确认桌面失败**

Run: `node --test tests/browser.test.mjs --test-name-pattern="delete rail"`
Expected: desktop mouse case FAIL because current code ignores `pointerType === 'mouse'`.

- [ ] **Step 3: 移除输入类型屏蔽并统一手势状态**

所有 pointer 类型走同一 delta 判定；纵向位移优先时不阻止滚动。加入省略号操作按钮与 `Delete` 键盘快捷键，删除仍显示撤销。

- [ ] **Step 4: 运行测试确认通过**

Run: `node --test tests/interaction.test.mjs tests/browser.test.mjs`
Expected: touch, mouse, menu, keyboard, delete and undo cases PASS.

- [ ] **Step 5: 记录检查点**

Run: `Get-FileHash src/app.mjs,src/view.mjs,styles.css -Algorithm SHA256`

### Task 4: 放松时间轴视觉节奏

**Files:**
- Modify: `styles.css`
- Modify: `tests/browser.test.mjs`

**Interfaces:**
- Preserves all existing card and timeline class names.

- [ ] **Step 1: 增加几何断言**

在 390、768、1440 宽度读取相邻 `.timeline-item` rect，断言垂直间距至少 18px；收起卡片高度至少 132px；页面无横向溢出；底部最后一个操作按钮不被导航遮挡。

- [ ] **Step 2: 运行测试确认紧凑版式失败**

Run: `node --test tests/browser.test.mjs --test-name-pattern="spacing"`
Expected: FAIL on current 12px item gap.

- [ ] **Step 3: 调整 CSS token**

新增 `--timeline-gap: clamp(18px, 2.3vw, 26px)` 与 `--day-gap: clamp(72px, 9vw, 120px)`；提高卡片、图片与详情分组留白，同时保持 30% 左右图片占比。

- [ ] **Step 4: 截图 QA**

在 390×844、768×1024、1440×900 为意大利和东京分别截取首日收起态、展开态和每日尾部；检查文字截断、删除轨道、添加抽屉与固定导航。

- [ ] **Step 5: 运行测试确认通过**

Run: `node --test tests/browser.test.mjs`
Expected: all responsive geometry tests PASS.

### Task 5: 东京往返航班与首末日缓冲

**Files:**
- Modify: `scripts/build_trip_data.mjs`
- Modify: `data/trips.json` through generator
- Modify: `tests/data.test.mjs`

**Interfaces:**
- Adds Tokyo places `tokyo-ca929-arrival`, `tokyo-narita-transfer`, `tokyo-ca930-departure`.
- Uses fixed `timeMode` for both flights.

- [ ] **Step 1: 写航班失败测试**

```js
assert.deepEqual(pick('tokyo-ca929-arrival'), {
  time: '14:00', name: '国航 CA929 · 抵达成田', terminal: 'NRT T1'
});
assert.equal(pick('tokyo-ca930-departure').time, '15:20');
```

测试同时断言去程 PVG T2 10:00、回程 PVG T2 17:50、首日机场到市区缓冲不低于 150 分钟、末日最晚 12:20 抵达 NRT。

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/data.test.mjs --test-name-pattern="Tokyo flights"`
Expected: FAIL because flight IDs do not exist.

- [ ] **Step 3: 更新生成器与时间安排**

加入 CA929、入境取行李、成田到市区交通与 CA930；10月5日市区活动从实际可用时间开始，10月10日保留至少 3 小时国际航班提前量。

- [ ] **Step 4: 生成并验证数据**

Run: `node scripts/build_trip_data.mjs && node --test tests/data.test.mjs`
Expected: Tokyo date window and all flight assertions PASS.

- [ ] **Step 5: 记录检查点**

Run: `Get-FileHash scripts/build_trip_data.mjs,data/trips.json -Algorithm SHA256`

### Task 6: 夜间指南数据契约与验证

**Files:**
- Modify: `src/core.mjs`
- Modify: `scripts/build_trip_data.mjs`
- Modify: `tests/core.test.mjs`
- Modify: `tests/data.test.mjs`

**Interfaces:**
- Adds `Trip.eveningGuides: EveningGuide[]`.
- `EveningGuide = { date, anchorPlaceId, mode, verifiedAt, restaurants, bars, airportTips }`.
- `Recommendation = { id, name, nameLocal, category, summary, googleRating, googleReviewCount, tripadvisorRating, distanceText, links, verificationNote }`.

- [ ] **Step 1: 写契约失败测试**

断言每个 trip 的每个日期恰有一个 guide；城市 guide 的每个列表长度为 3 或 5，`googleRating >= 4.5`，链接为 HTTPS；机场 guide 的 `airportTips.length >= 3` 且 bars 为空。

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/core.test.mjs tests/data.test.mjs`
Expected: FAIL because `eveningGuides` is absent.

- [ ] **Step 3: 扩展校验器与生成器 schema**

`validateTrips()` 输出精确 JSON path，例如 `trips[1].eveningGuides[2].restaurants[0].googleRating 必须不低于 4.5`；机场和城市模式分别校验必需字段。

- [ ] **Step 4: 添加日期与锚点骨架**

意大利锚点：`italy-capitoline`、`italy-navona-trevi`、`italy-signoria-vecchio`、`italy-michelangelo`、`italy-san-severo`、`italy-naples-waterfront`、`italy-trastevere`、`italy-fco-departure`；东京锚点为每天重排后的最后市区地点以及 `tokyo-ca930-departure`。

- [ ] **Step 5: 运行契约测试**

Run: `node --test tests/core.test.mjs tests/data.test.mjs`
Expected: schema cases PASS; content count remains expected to fail until Task 7.

### Task 7: 核对并填充 12 个城市夜晚与 2 个机场日

**Files:**
- Modify: `scripts/build_trip_data.mjs`
- Regenerate: `data/trips.json`
- Create: `data/evening-sources.json`
- Modify: `tests/data.test.mjs`

**Interfaces:**
- Produces complete `eveningGuides` consumed by Task 8.
- `evening-sources.json` records recommendation id, Google/Tripadvisor source URL and `verifiedAt: '2026-08-10'`.

- [ ] **Step 1: 按锚点建立候选清单**

逐日核对 Piazza Venezia、Trevi、Ponte Vecchio、Piazzale Michelangelo、Sansevero、Naples waterfront、Trastevere、Shibuya、Yanaka、Zojoji、Komachi-dori 与 Tokyo vintage route 附近具体分店；排除评分低于 4.5、关闭、同名错店和无法定位的条目。

- [ ] **Step 2: 填充城市推荐**

每个城市 guide 写入 5+5，只有公开结果确实不足时使用 3+3；每条包含本地名、特色、评分、评论量可用值、步行距离、Google Maps 和 Tripadvisor 链接、核验说明。

- [ ] **Step 3: 填充机场提示**

FCO 与 NRT 分别提供至少 3 条航站楼内餐饮/候机提示，标明安检前后区域和“以当日航站楼营业为准”；bars 保持空数组。

- [ ] **Step 4: 生成数据并运行硬门槛测试**

Run: `node scripts/build_trip_data.mjs && node --test tests/data.test.mjs`
Expected: every date, count, rating, anchor, source and HTTPS assertion PASS.

- [ ] **Step 5: 抽样人工复核**

每个城市至少打开 1 家餐厅和 1 家酒吧的两平台链接，确认城市和分店一致；将抽样 id 写入测试输出日志。

### Task 8: 夜间指南横向页面与标签切换

**Files:**
- Modify: `src/view.mjs`
- Modify: `src/app.mjs`
- Modify: `styles.css`
- Modify: `tests/view.test.mjs`
- Modify: `tests/browser.test.mjs`

**Interfaces:**
- Consumes: `Trip.eveningGuides` from Tasks 6–7.
- Produces DOM: `[data-action="open-evening"]`, `[data-panel="evening-guide"]`, `[data-evening-date]`, `[data-action="evening-tab"]`.

- [ ] **Step 1: 写失败渲染测试**

断言每个 day 具有对应 night entry；餐厅/酒吧推荐名称、Google rating、核验日期和两种外链被安全转义；机场模式不渲染空酒吧标签。

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/view.test.mjs`
Expected: FAIL because night entry and panel are missing.

- [ ] **Step 3: 渲染入口、横向日期页和推荐卡片**

入口置于添加按钮之后；面板日期容器使用 `display:grid; grid-auto-flow:column; grid-auto-columns:100%; scroll-snap-type:x mandatory`。推荐卡片显示距离、评分、核验日和链接。

- [ ] **Step 4: 接入打开位置、日期切换与标签状态**

点击某日入口后滚动到对应 `[data-evening-date]`；箭头、横滑和键盘左右键切换日期；餐厅/酒吧标签只更新当前日期内容。

- [ ] **Step 5: 浏览器交互测试**

Playwright 从 10月5日入口打开，断言当前日期、5家餐厅、5家酒吧；切到下一日后日期与锚点更新；机场日只出现候机提示；离线点击外链出现联网提示。

- [ ] **Step 6: 运行测试确认通过**

Run: `node --test tests/view.test.mjs tests/browser.test.mjs`
Expected: night guide rendering and interaction cases PASS.

### Task 9: Service Worker、回归与正式同步

**Files:**
- Modify: `sw.js`
- Modify: `tests/pwa.test.mjs`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**
- Cache version increments from `travel-atlas-v5` to `travel-atlas-v6`.

- [ ] **Step 1: 写离线失败测试**

首次在线访问两地后切换离线，重新加载并断言航班、夜间推荐、编辑器和图片仍可见；外链点击停留本页并显示联网提示。

- [ ] **Step 2: 更新缓存清单**

缓存新增模块与完整 `trips.json`；数据仍通过现有动态图片列表缓存，保证自定义状态不进入 Service Worker。

- [ ] **Step 3: 运行全部自动测试**

Run: `node --test tests/core.test.mjs tests/data.test.mjs tests/entrypoints.test.mjs tests/interaction.test.mjs tests/itinerary.test.mjs tests/search.test.mjs tests/view.test.mjs`

Run: `node --test tests/browser.test.mjs tests/pwa.test.mjs`

Expected: all unit, browser and offline tests PASS with no page or console errors.

- [ ] **Step 4: 最终视觉 QA**

在 390×844、768×1024、1440×900 截图两地首日、夜间指南、添加抽屉、删除轨道与机场日；检查留白、底部安全区、横向滚动和焦点。

- [ ] **Step 5: 同步正式目录并重新验证**

从验证工作区同步 `assets`、`data`、`docs`、`fonts`、`italy`、`scripts`、`src`、`tests`、`tokyo` 与根文件到 `D:\Codex\旅行攻略`，不复制 `node_modules` 或 QA 截图。随后在 `http://127.0.0.1:4177/` 重跑浏览器与 PWA 测试。

- [ ] **Step 6: 记录最终检查点**

Run: `Get-FileHash D:\Codex\旅行攻略\src\*.mjs,D:\Codex\旅行攻略\data\trips.json,D:\Codex\旅行攻略\styles.css,D:\Codex\旅行攻略\sw.js -Algorithm SHA256`
