# “今晚怎么过”彩色图文卡 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把意大利与东京的 136 条城市晚间推荐升级为鲜艳、易读、带本地授权图片与更完整介绍的图文卡。

**Architecture:** `scripts/build_trip_data.mjs` 继续拥有旅行 JSON，新增晚间媒体目录并在生成时写入媒体和扩充文案字段；`src/core.mjs` 验证契约，`src/view.mjs` 只负责安全渲染。图片由构建脚本从 Wikimedia Commons 授权元数据下载并转换，无法精确匹配时回退到同日最后一站的已有授权图片；运行时不调用图片 API。

**Tech Stack:** 原生 HTML/CSS/ES Modules、Node.js 测试与数据生成、Wikimedia Commons API、WebP 静态资源、Service Worker、Playwright。

## Global Constraints

- 不引入 React 或运行时图片服务。
- 城市推荐必须离线显示正文和本地图片；机场模式保持文字提示。
- 图片只使用官网明确可复用媒体或 Wikimedia Commons 授权资源，不直接热链 Google Maps 图片。
- 餐厅色为 `#F06A4F/#FFE2C7`，酒吧色为 `#4B61D1/#DDE5FF`，其他娱乐色为 `#9A4FD0/#F0DFFF`，评分色为 `#D7EF61`。
- 推荐标题桌面 22px、手机 20px；正文 15–16px，行高至少 1.7。
- 390×844、768×1024、1440×900 均不得横向溢出；交互目标至少 44px。
- `data/trips.json` 是生成产物，只通过 `scripts/build_trip_data.mjs` 更新。
- 当前目录不是 Git 仓库；每个任务以测试结果和 SHA-256 文件哈希作为可恢复检查点。

---

### Task 1: 扩展晚间推荐数据契约

**Files:**
- Modify: `tests/core.test.mjs`
- Modify: `tests/data.test.mjs`
- Modify: `src/core.mjs`
- Modify: `scripts/build_trip_data.mjs`

**Interfaces:**
- Consumes: 现有 `Recommendation` 字段与 `validateTrips(trips)`。
- Produces: 每条城市推荐新增 `image`, `imageAlt`, `imageCredit`, `imageSource`, `highlights`, `practicalTips`, `links.images`。

- [ ] **Step 1: 写失败的数据验证测试**

```js
for (const field of ['image', 'imageAlt', 'imageCredit', 'imageSource', 'practicalTips']) {
  assert.ok(recommendation[field]?.trim(), `${recommendation.id}.${field} 缺失`);
}
assert.ok(recommendation.highlights.length >= 2);
assert.match(recommendation.image, /^assets\/evening\/.+\.webp$/);
assert.match(recommendation.imageSource, /^https:\/\//);
assert.match(recommendation.links.images, /^https:\/\/www\.google\.com\/search\?/);
```

- [ ] **Step 2: 运行测试确认因缺少新字段失败**

Run: `node --test tests/core.test.mjs tests/data.test.mjs`

Expected: FAIL，错误路径指向首条城市推荐的 `image` 或 `highlights`。

- [ ] **Step 3: 在验证器中加入城市模式字段和安全 URL 规则**

```js
const mediaFields = ['image', 'imageAlt', 'imageCredit', 'imageSource', 'practicalTips'];
for (const field of mediaFields) {
  if (!item?.[field]?.trim()) errors.push(`${itemPath}.${field} 不能为空`);
}
if (!Array.isArray(item?.highlights) || item.highlights.length < 2) {
  errors.push(`${itemPath}.highlights 至少包含 2 项`);
}
```

机场推荐数组仍为空，不要求媒体字段。

- [ ] **Step 4: 扩展 `recommendation()` 的输出契约**

```js
const buildGoogleImagesUrl = (name, area) =>
  `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${name} ${area}`)}`;

return {
  ...base,
  image: media.image,
  imageAlt: media.imageAlt,
  imageCredit: media.imageCredit,
  imageSource: media.imageSource,
  highlights: copy.highlights,
  practicalTips: copy.practicalTips,
  links: { ...base.links, images: buildGoogleImagesUrl(nameLocal, area) },
};
```

- [ ] **Step 5: 生成 JSON 并重新运行聚焦测试**

Run: `node scripts/build_trip_data.mjs && node --test tests/core.test.mjs tests/data.test.mjs`

Expected: 在 Task 2 媒体目录尚未完成前仍 FAIL，但只剩媒体目录或文件存在性错误。

- [ ] **Step 6: 记录检查点**

Run: `Get-FileHash src/core.mjs,scripts/build_trip_data.mjs,tests/core.test.mjs,tests/data.test.mjs -Algorithm SHA256`

---

### Task 2: 建立授权图片目录和扩充介绍

**Files:**
- Create: `scripts/build_evening_media.mjs`
- Create: `scripts/evening-media-catalog.json`
- Create: `assets/evening/credits.json`
- Create: `assets/evening/*.webp`
- Modify: `scripts/build_trip_data.mjs`
- Test: `tests/data.test.mjs`

**Interfaces:**
- Consumes: 136 个唯一推荐 ID、名称、分类、日期和最后一站图片。
- Produces: `EVENING_MEDIA[id]`，形状为 `{ image, imageAlt, imageCredit, imageSource }`；`EVENING_COPY[id]`，形状为 `{ highlights: string[], practicalTips: string }`。

- [ ] **Step 1: 写失败的资源完整性测试**

```js
const file = new URL(`../${recommendation.image}`, import.meta.url);
assert.ok((await stat(file)).size > 8_000, `${recommendation.id} 晚间图片无效`);
assert.ok(credits.some((credit) => credit.file === recommendation.image));
assert.ok(recommendation.highlights.every((text) => text.length >= 8));
assert.ok(recommendation.practicalTips.length >= 18);
```

- [ ] **Step 2: 运行资源测试确认失败**

Run: `node --test --test-name-pattern="evening recommendation media" tests/data.test.mjs`

Expected: FAIL，首个缺失文件为 `assets/evening/<recommendation-id>.webp`。

- [ ] **Step 3: 创建媒体目录构建器**

`build_evening_media.mjs` 必须：

```js
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharp = require('sharp');

export async function resolveCommonsImage({ query, fallbackImage }) {
  const endpoint = new URL('https://commons.wikimedia.org/w/api.php');
  endpoint.search = new URLSearchParams({
    action: 'query', generator: 'search', gsrnamespace: '6', gsrlimit: '1',
    gsrsearch: query, prop: 'imageinfo', iiprop: 'url|extmetadata',
    iiurlwidth: '960', format: 'json', origin: '*',
  });
  // 只接受带 LicenseShortName、Artist、canonical title 和 thumburl 的结果；
  // 无结果时复制 fallbackImage，并保留其原署名。
}
```

下载文件写入临时文件，成功解码并转为 WebP 后再原子移动到 `assets/evening/<id>.webp`；网络失败不得覆盖已存在文件。

- [ ] **Step 4: 建立 136 条媒体查询目录**

`scripts/evening-media-catalog.json` 每条记录包含：

```json
{
  "id": "it-r-piccolo-buco",
  "query": "Piccolo Buco Rome restaurant",
  "fallbackPlaceId": "italy-navona-trevi",
  "imageAlt": "罗马特莱维喷泉附近餐厅环境"
}
```

测试断言目录 ID 与两地全部城市推荐 ID 集合完全一致，不允许多项或漏项。

- [ ] **Step 5: 运行媒体构建器并审阅来源清单**

Run:

```powershell
$env:NODE_PATH='C:\Users\BAODI-JIAOYAN\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
node scripts/build_evening_media.mjs
```

Expected: 输出 `MEDIA_OK exact=<n> fallback=<n> total=136`，其中 `exact + fallback = 136`；所有来源写入 `assets/evening/credits.json`。

- [ ] **Step 6: 扩充每条推荐介绍**

`scripts/build_trip_data.mjs` 为每条推荐生成 2–3 条 `highlights`，覆盖体验特色、氛围或代表内容；`practicalTips` 覆盖预约、开放时间复核、着装/年龄限制或交通返回。禁止用同一句模板填充全部条目。

- [ ] **Step 7: 生成数据并通过资源测试**

Run: `node scripts/build_trip_data.mjs && node --test tests/core.test.mjs tests/data.test.mjs`

Expected: PASS。

- [ ] **Step 8: 记录检查点**

Run: `Get-FileHash scripts/build_evening_media.mjs,scripts/evening-media-catalog.json,assets/evening/credits.json,data/trips.json -Algorithm SHA256`

---

### Task 3: 渲染图文推荐卡

**Files:**
- Modify: `tests/view.test.mjs`
- Modify: `src/view.mjs`

**Interfaces:**
- Consumes: Task 1 的完整 `Recommendation`。
- Produces: `.recommendation-media`, `.recommendation-body`, `.recommendation-highlights`, `.recommendation-tips` 和图片来源链接。

- [ ] **Step 1: 写失败的 HTML 结构测试**

```js
assert.match(html, /class="recommendation-media"/);
assert.match(html, /loading="lazy"/);
assert.match(html, /class="recommendation-highlights"/);
assert.match(html, /class="recommendation-tips"/);
assert.match(html, />图片来源</);
assert.match(html, /data-category-theme="restaurant"/);
```

- [ ] **Step 2: 运行视图测试确认失败**

Run: `node --test tests/view.test.mjs`

Expected: FAIL，缺少 `.recommendation-media`。

- [ ] **Step 3: 将分类映射为稳定主题键**

```js
function recommendationTheme(pageType) {
  return pageType === 'restaurants' ? 'restaurant'
    : pageType === 'bars' ? 'bar'
      : 'activity';
}
```

调用 `renderRecommendation(item, theme)`，不得根据翻译后的类别文本推断主题。

- [ ] **Step 4: 实现安全图文结构**

```js
return `<article class="recommendation-card" data-category-theme="${theme}">
  <figure class="recommendation-media">
    <img src="${escapeHtml(`${assetBase}${item.image}`)}" alt="${escapeHtml(item.imageAlt)}" loading="lazy" decoding="async">
    <figcaption>图片：${escapeHtml(item.imageCredit)} · <a href="${escapeHtml(item.imageSource)}" target="_blank" rel="noopener noreferrer" data-external="true">来源</a></figcaption>
  </figure>
  <div class="recommendation-body">
    <header><div><small>${escapeHtml(item.category)}</small><h4>${escapeHtml(item.name)}</h4><p lang="en">${escapeHtml(item.nameEn)}</p><p lang="und">${escapeHtml(item.nameLocal)}</p></div><strong>Google ${escapeHtml(item.googleRating)}</strong></header>
    <p>${escapeHtml(item.summary)}</p>
    <ul class="recommendation-highlights">${item.highlights.map((text) => `<li>${escapeHtml(text)}</li>`).join('')}</ul>
    <p class="recommendation-tips"><strong>到访提醒</strong>${escapeHtml(item.practicalTips)}</p>
  </div>
</article>`;
```

所有文本和 URL 继续经过 `escapeHtml()`；图片 `error` 时由 CSS 背景占位，不能写内联事件处理器。

- [ ] **Step 5: 运行视图测试**

Run: `node --test tests/view.test.mjs`

Expected: PASS。

- [ ] **Step 6: 记录检查点**

Run: `Get-FileHash src/view.mjs,tests/view.test.mjs -Algorithm SHA256`

---

### Task 4: 应用三类鲜艳视觉系统

**Files:**
- Modify: `styles.css`
- Modify: `tests/browser.test.mjs`

**Interfaces:**
- Consumes: Task 3 的 `data-category-theme` 和图文结构。
- Produces: 三套类别变量、桌面双栏卡和手机纵向卡。

- [ ] **Step 1: 写失败的浏览器样式与尺寸测试**

```js
const restaurant = firstGuide.locator('[data-guide-page="restaurants"] .recommendation-card').first();
assert.equal(await restaurant.getAttribute('data-category-theme'), 'restaurant');
const style = await restaurant.evaluate((node) => getComputedStyle(node));
assert.equal(style.getPropertyValue('--card-accent').trim(), '#F06A4F');
assert.ok(parseFloat(await restaurant.locator('h4').evaluate((node) => getComputedStyle(node).fontSize)) >= 20);
assert.ok(await restaurant.locator('img').evaluate((node) => node.naturalWidth > 0));
```

- [ ] **Step 2: 运行聚焦浏览器测试确认失败**

Run: `$env:TRAVEL_ATLAS_BASE_URL='http://127.0.0.1:4180/'; node --test --test-name-pattern="colorful evening cards" tests/browser.test.mjs`

Expected: FAIL，缺少 `--card-accent` 或图片自然宽度为 0。

- [ ] **Step 3: 实现主题变量和标签状态**

```css
[data-category-theme="restaurant"] { --card-accent:#F06A4F; --card-tint:#FFE2C7; }
[data-category-theme="bar"] { --card-accent:#4B61D1; --card-tint:#DDE5FF; }
[data-category-theme="activity"] { --card-accent:#9A4FD0; --card-tint:#F0DFFF; }
.recommendation-card { background:color-mix(in srgb,var(--card-tint) 38%,#fffefa); }
.recommendation-card h4 { font-size:22px; }
.recommendation-card > .recommendation-body > p { font-size:15px; line-height:1.75; }
```

标签激活态根据对应页面主题使用实色，评分徽章固定使用 `#D7EF61`。

- [ ] **Step 4: 实现响应式图文布局**

桌面 `.recommendation-card` 使用 `grid-template-columns:minmax(220px,36%) 1fr`；`max-width: 620px` 时切为单列，图片 `aspect-ratio:16/9` 且 `object-fit:cover`。

- [ ] **Step 5: 运行响应式与视觉相关浏览器测试**

Run: `$env:TRAVEL_ATLAS_BASE_URL='http://127.0.0.1:4180/'; node --test --test-name-pattern="colorful evening cards|daily evening guide|responsive" tests/browser.test.mjs`

Expected: PASS。

- [ ] **Step 6: 记录检查点**

Run: `Get-FileHash styles.css,tests/browser.test.mjs -Algorithm SHA256`

---

### Task 5: 离线缓存、全量回归和截图复核

**Files:**
- Modify: `sw.js`
- Modify: `tests/pwa.test.mjs`
- Modify: `qa/evening-crops.mjs`

**Interfaces:**
- Consumes: `data/trips.json` 中所有推荐图片路径。
- Produces: `travel-atlas-v9` 离线缓存与六组视口截图。

- [ ] **Step 1: 写失败的 PWA 图片缓存测试**

```js
const firstImage = trips[0].eveningGuides[0].restaurants[0].image;
await page.goto(`${baseUrl}${firstImage}`);
assert.ok((await page.locator('body').evaluate(() => navigator.onLine)) === false);
```

离线测试先在线访问意大利和东京，再切换离线；两地各抽查一张推荐图可加载。

- [ ] **Step 2: 运行 PWA 测试确认失败**

Run: `$env:TRAVEL_ATLAS_BASE_URL='http://127.0.0.1:4180/'; node --test tests/pwa.test.mjs`

Expected: FAIL，晚间图片未进入安装缓存。

- [ ] **Step 3: 扩展 Service Worker 图片清单并升级缓存版本**

```js
const eveningImages = trips.flatMap((trip) => trip.eveningGuides.flatMap((guide) =>
  ['restaurants', 'bars', 'activities'].flatMap((key) => guide[key].map((item) => `./${item.image}`))
));
await cache.addAll([...new Set([...placeImages, ...eveningImages])]);
```

将 `CACHE_NAME` 从 `travel-atlas-v8` 升级到 `travel-atlas-v9`。

- [ ] **Step 4: 运行全部自动化测试**

Run: `npm.cmd test`

Expected: 现有和新增单元测试全部 PASS。

Run: `$env:TRAVEL_ATLAS_BASE_URL='http://127.0.0.1:4180/'; npm.cmd run test:browser`

Expected: 浏览器与 PWA 测试全部 PASS。

- [ ] **Step 5: 生成并目视检查六组截图**

Run: `node qa/evening-crops.mjs`

检查 Italy/Tokyo 的 390、768、1440 截图：图片无拉伸、文字不小于规格、三类颜色可辨、底部导航不遮挡、无横向溢出。

- [ ] **Step 6: 同步到正式目录并验证哈希**

只复制本计划列出的源文件、生成数据与 `assets/evening/`；逐一比较 staging 与 `D:\Codex\旅行攻略` 的 SHA-256，要求输出 `FINAL_SYNC_HASHES_OK`。

- [ ] **Step 7: 在正式服务验证关键路径**

Run: `$env:TRAVEL_ATLAS_BASE_URL='http://127.0.0.1:4177/'; node --test --test-name-pattern="colorful evening cards|daily evening guide|offline" tests/browser.test.mjs tests/pwa.test.mjs`

Expected: PASS。
