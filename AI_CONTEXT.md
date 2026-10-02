# AI 交接文档 · 花城博客

> **这份文档是给「刚接手这个项目的 AI / 新对话」看的。**
>
> 目标：读完这一份，就能在不翻遍代码的前提下安全地改这个项目。
> 人类向的使用说明在 [README.md](README.md)，设计取舍在 [design.md](design.md)。
> 三者的分工是：**这份讲「怎么快速上手且不踩坑」，README 讲「怎么用」，design 讲「为什么」。**

---

## 一、30 秒速览

| 项目 | 内容 |
| --- | --- |
| 是什么 | 个人博客，纯静态（构建期生成 HTML，运行期没有 Node） |
| 栈 | Next.js 16 App Router · React 19 · TypeScript 5 · Tailwind CSS 4 · MDX · TinaCMS 3 |
| 内容在哪 | `content/posts/*.mdx`（frontmatter + 正文），**这是唯一的内容真相来源** |
| 站点配置 | `content/site-settings.json`（默认设置）+ `src/lib/site.ts`（站点常量） |
| 产物 | `out/`，部署到 Cloudflare Pages |
| 包管理 | npm（Node 22） |
| 语言 | 注释、文档、UI 文案、commit message **全部用中文** |

### 起手三件事

```bash
npm install
npm run dev          # http://localhost:3000，后台 /admin
npm run build        # 静态导出到 out/
```

改完**必须**跑一遍：

```bash
npx tsc --noEmit && npx eslint . && npx next build
```

三项全绿才算改完。构建应当 **0 warning**。

---

## 二、必须知道的 9 条硬约束

违反这些会「构建成功但线上坏掉」，或者让 dev 直接 500。前 4 条最要命。

### 1. `images: { unoptimized: true }` 不能删

静态导出没有服务端，而 `next/image` 的默认优化器**就是一个服务端端点**。
删掉这一行，构建照样成功，但产出的 HTML 会变成：

```html
<img src="/_next/image/?url=...&w=256&q=75" />
```

`out/` 里没有这个路径 → **线上所有图片 404，且构建期不报错**。
MDX 正文里的图片走 `src/mdx-components.tsx` 里覆写的原生 `<img>`，不受影响。

### 2. `src/lib/posts.ts` 只能在服务端用

它 import 了 `node:fs`。**任何带 `"use client"` 的文件都不能 import 它**，
否则会把 `fs` 打进浏览器 bundle，构建直接失败。

客户端要用的站点常量放在 `src/lib/site.ts`（那里没有任何 node 依赖）。
只引用类型时用 `import type { PostMeta } from "@/lib/posts"`（会被完全擦除，安全）。

### 3. Turbopack 下 remark/rehype 插件只能传「字符串名 + 可序列化选项」

不能传函数。插件配置都在 `next.config.ts`：

```ts
remarkPlugins: ["remark-frontmatter", "remark-gfm", "remark-math"],
rehypePlugins: [
  "rehype-slug",
  ["@shikijs/rehype", { themes: {...}, defaultColor: false, ... }],
  ["rehype-katex", { output: "html", throwOnError: false, strict: false }],
],
```

所以**不能用 `rehype-pretty-code` 的 transformers、不能用 `rehype-autolink-headings`**
（它们的默认选项里带函数）。标题锚点是自己写在 `mdx-components.tsx` 里的。

### 4. `path.join` 的路径段要写成字面量

```ts
// ✅ Turbopack 能静态分析
path.join(process.cwd(), "content", "site-settings.json")

// ❌ 会被判定「整个项目都被追踪」，构建出现 NFT 警告
path.join(process.cwd(), SITE_SETTINGS_PATH)
```

### 5. `usePersistentState` 的 `initialValue` 必须是稳定引用

它出现在 `getSnapshot` 的 `useCallback` 依赖里。传对象时要用
`const [defaults] = useState(siteSettings)` 固定住。
**不要用 `useRef` + `.current`** —— 渲染期读 ref 会被 `react-hooks/refs` 拦下。

### 6. effect 里不要同步 `setState`

React 19 的 `react-hooks/set-state-in-effect` 会直接报错。
需要「打开时重置状态」就用「**条件挂载子组件**」代替
（见 `SearchDialog`：外壳不管状态，`open` 时才渲染内部面板，卸载即清空）。

### 7. MDX 里的站内链接要用 Markdown 语法，不要手写 `<a>`

| 写法 | 走 `MdxLink` | 带 `basePath` |
| --- | :---: | :---: |
| `[文字](/posts/foo)` | ✅ | ✅ |
| `<a href="/posts/foo">文字</a>` | ❌ | ❌ |

实测结论：**手写的原生 `<a>` 不会经过 `useMDXComponents` 的映射**。
子路径部署（GitHub Pages 项目页）时它会 404。

### 8. Tailwind v4 没有 `tailwind.config.ts`

主题配置在 `src/app/globals.css` 的 `@theme` 里。深色模式是
`@custom-variant dark (&:where(.dark, .dark *))`，靠 `<html class="dark">` 切换。

### 8. 动态路由的参数不能用中文（标签 URL 用 ASCII slug）

`/tags/[slug]` 的 `generateStaticParams()` **必须返回 ASCII**。

原因是 Next 拿「URL 里原始的（已编码的）路径段」去和 `generateStaticParams()` 的
返回值做匹配，而不是先解码再比。中文参数于是出现两难：

| `generateStaticParams` 返回 | dev 首次访问 | 静态产物目录 |
| --- | --- | --- |
| `"部署"`（解码值） | ❌ `missing param` → 500 | ✅ `out/tags/部署/` |
| `%E9%83%A8%E7%BD%B2`（编码值） | ✅ 200 | ❌ `out/tags/%E9%83%A8%E7%BD%B2/` |

第二种在 dev 下能跑，但产物目录名带 `%`，一旦静态托管先解码路径就会 404。
所以标签走 `tagToSlug()`（`部署` → `deploy`），`encodeURIComponent(slug) === slug`，
两边行为一致。

**新增中文标签时要在 `src/lib/tag-slug.ts` 的 `TAG_SLUG_OVERRIDES` 里补一行。**
忘了补不会坏，会落到 `tag-xxxx` 的兜底 slug，只是不好看。
两个标签算出同一个 slug 会让**构建直接失败**（故意的，静默合并更难查）。

### 9. `data-scroll-behavior="smooth"` 不能删

站点在 `globals.css` 里给 `<html>` 设了 `scroll-behavior: smooth`。
Next 16 起**默认不再**在导航时覆盖它 —— 不加这个属性，
每次切页面都会「平滑滚到顶部」，观感很拖沓。
加上它，导航时 Next 会临时切成 `auto`（瞬时滚顶），页内锚点仍然平滑。

---

## 三、数据流：构建期 vs 运行期

理解这一张图，基本就理解了这个项目。

```text
构建期（next build，跑在 Node 里）              运行期（访客浏览器）
──────────────────────────────────────         ─────────────────────────
读 content/posts/*.mdx                          接收 CDN 发来的静态 HTML
  ↓ gray-matter 解析 frontmatter
  ↓ 过滤 draft（生产环境）
  ↓ 统计字数 / 提取目录 / 算相关文章
读 content/site-settings.json
  ↓ 生成防闪屏内联脚本（注入主题/字号）
编译 MDX → React 组件
  ↓ remark: frontmatter / gfm / math
  ↓ rehype: slug / shiki 高亮 / katex 公式
渲染成 HTML（每个路由一份）
  ↓
写进 out/
                                                服务器只做一件事：
                                                把已生成的文件发出去。
```

**没有后端。** 所有「写操作」都是浏览器直连 GitHub Contents API
（需要站长自己的 fine-grained token，存在访客本地）。

---

## 四、设置的两层结构（最容易搞混的地方）

| | 访客偏好 | 站点默认值 |
| --- | --- | --- |
| 存哪 | 浏览器 `localStorage` | 仓库 `content/site-settings.json` |
| 谁能改 | 任何访客（只影响自己） | 有仓库写权限的人 |
| 生效时机 | hydration 之后 | **构建期注入 HTML，首屏即正确** |
| 换设备 | ❌ 没了 | ✅ 跟着仓库走 |
| 代码 | `src/hooks/usePersistentState.ts` | `src/lib/site-settings*.ts` |

改「站点默认长什么样」→ 改 JSON。
改「某个访客自己的偏好」→ 那本来就不该你操心，它存在对方浏览器里。

**不要把访客偏好也搬到仓库**：每个访客切一次主题 = 一次 commit + 一次重新部署。
理由写在 design.md 的 17.8。

---

## 五、文件地图

### 我要改…该动哪个文件？

| 需求 | 文件 |
| --- | --- |
| 站点名称 / 作者 / 邮箱 / 头像路径 | `src/lib/site.ts` 的 `SITE` |
| 换头像 | 替换 `public/avatar.png`（+ `avatar-128.png`），不用改代码 |
| 换主题色 / 字体 / 动画 | `src/app/globals.css` 的 `@theme` |
| 站点默认主题/字号/壁纸 | `content/site-settings.json` |
| 首页布局 | `src/app/page.tsx` |
| 文章列表卡片样式 | `src/components/PostCard.tsx` | |
| 标签页 URL | `src/lib/tag-slug.ts` 的 `TAG_SLUG_OVERRIDES` | |
| 文章详情页结构 | `src/app/posts/[slug]/page.tsx` |
| 外壳（顶栏 + 三栏） | `src/components/BlogLayout.tsx` |
| 顶栏按钮 | `src/components/TopBar.tsx` |
| 左侧导航 | `src/components/Sidebar.tsx` |
| 右侧留言板 | `src/components/MessagePanel.tsx` |
| 设置抽屉 | `src/components/SettingsPanel.tsx` |
| 壁纸逻辑 | `src/lib/wallpaper.ts` + `WallpaperLayer/Settings.tsx` |
| 搜索结果排序 / 打分 | `src/lib/search.ts` + `SearchDialog.tsx` |
| 文章元信息（字数等） | `src/lib/posts.ts` 的 `PostMeta` |
| MDX 里能用的组件 | `src/mdx-components.tsx` |
| 代码块 / 公式样式 | `src/app/globals.css` 末尾两节 |
| 部署相关 | `next.config.ts` / `Dockerfile` / `nginx.conf` / `public/_headers` |

### 关键文件职责

| 文件 | 职责 | 注意 |
| --- | --- | --- |
| `src/lib/posts.ts` | **构建期**内容层：解析、过滤、字数、目录、相关文章、搜索索引 | 服务端专用 |
| `src/lib/search.ts` | 切词、打分、排序（**纯函数，客户端安全**） | 标签 slug 见下 |
| `src/lib/tag-slug.ts` | 标签名 ⇄ URL slug（**纯函数，客户端安全**） | 中文标签要在这里登记 |
| `src/lib/site-settings.ts` | 站点默认值的类型、校验、**防闪屏脚本生成** | 客户端安全 |
| `src/lib/site-settings-file.ts` | 构建期读 JSON | 服务端专用 |
| `src/lib/github-upload.ts` | 直连 GitHub API：传图、删图、读写设置文件 | 客户端专用 |
| `src/hooks/usePersistentState.ts` | localStorage ⇄ React（`useSyncExternalStore`） | 见硬约束 5 |
| `src/mdx-components.tsx` | MDX 全局组件映射 | Next 约定文件，签名不能改 |

---

## 六、踩过的坑（不要重犯）

### 1. 搜索多词查询永远返回 0 条

`tokenize()` 曾经把「整串查询」也当成一个词元，于是「静态 部署」要求文档里
**字面出现带空格的 `静态 部署`**。单关键词时无影响，多关键词时全灭。

**教训**：这类「顺手加一点优化」的逻辑，不跑真实数据看不出来。
所以 `search.ts` 保持无依赖，可以直接用 Node 验证：

```bash
node --experimental-strip-types your-test.mjs   # import "./src/lib/search.ts"
```

### 2. 站点设置带 BOM 被静默忽略

`JSON.parse` 遇到 `\uFEFF` **直接抛错**，被 `catch` 吞掉后回退默认值 ——
用户改了 JSON 却毫无反馈。已在 `readSiteSettings` 里去掉 BOM。

记事本保存就会带 BOM，所以这不是假想问题。

### 3. 留言板在桌面端点 × 没反应

桌面端和移动端各有一套状态（桌面持久化、移动端一次性抽屉），
`onClose` 只改了移动端那套。修法是按断点分派：`closeMessage` / `closeSidebar`。

**教训**：加一套并行的状态时，所有「关闭/重置」入口都要跟着改。

### 4. 壁纸层被正文盖住 / 盖住正文

`position: fixed` + `z-index: 0` 的元素会画在**行内内容之上**。
正确做法是外层 `isolate` + 壁纸层 `-z-10`。

### 5. TinaCMS 在某些 Windows 上写不了 `%TEMP%`

esbuild 写 `os.tmpdir()` 被拒（杀软/策略），报
`Failed to write to output file: ... Access is denied`。
已内置绕法：`scripts/tina.mjs` 把 `TEMP` 指向项目内的 `.tina-tmp/`。
**不要把这个启动器删掉。**

### 6. 中文标签让 dev 反复 500（现象很误导人）

报错是 `Page "/tags/[tag]/page" is missing param ... in "generateStaticParams()"`，
而且**时好时坏**：同一个 URL 有时 200 有时 500。

排查过程值得记下来，因为一开始的结论是错的：

| 观察 | 一度以为的原因 | 实际原因 |
| --- | --- | --- |
| 首次请求 500、再请求 200 | 热启动竞态 | 首次渲染失败后页面被缓存，之后是**缓存命中** |
| 加了 TinaCMS 后时好时坏 | TinaCMS 有 bug | TinaCMS 索引 `content/` 会反复让 Next 失效缓存，于是每次都重新走到那个必然失败的校验 |
| 去掉 `dynamicParams = false` 后「好了一阵」 | 找到解法了 | 只是 `.next` 里还留着上一版**编码方案**成功构建的页面 |

**根因**：Next 拿 URL 里已编码的路径段去和 `generateStaticParams()` 的返回值比，
中文标签两边永远不相等。干净缓存下必然 500。

**教训**：结果**不稳定**时，先怀疑「有缓存/状态残留」，不要急着把它解释成竞态。
把 `.next` 删掉重来，才能看到真实行为。

### 7. 别用「改数据」去迁就框架的匹配规则

修上面那个问题时，第一版方案是让 `generateStaticParams()` 返回
`encodeURIComponent(tag)`。dev 立刻好了，看着很对。

但静态产物目录变成了 `out/tags/%E9%83%A8%E7%BD%B2/` —— 一旦托管商先解码路径就会 404，
而且**本地无法验证各托管商的行为**。这是典型的「修好了开发、弄坏了生产」。

正确做法是换成 ASCII slug，让 `encodeURIComponent(slug) === slug`，
把歧义从根上消除，而不是在两个坏选项里挑一个。

**教训**：一个改动如果让 dev 通过却让产物变奇怪，先去看产物。

---

## 七、常见改动的标准做法

### 加一篇文章

在 `content/posts/` 新建 `.mdx`：

```mdx
---
title: 标题
date: 2025-07-06
tags: [标签A, 标签B]
summary: 列表页摘要（可省略，会自动截取正文首段）
author: 花城
draft: false
---
```

正文可以用 Markdown + JSX。**行内数学用 `$…$`，行间用 `$$…$$`**。
`draft: true` 只在本机 dev 可见，生产构建会自动排除（连静态页面都不会生成）。

> **用了没登记过的中文标签？** 标签页 URL 走的是 ASCII slug，
> 没登记的中文标签会得到 `tag-xxxx` 这种兜底 slug（能跑，但不好看）。
> 想要 `/tags/deploy` 这种可读 URL，就在 `src/lib/tag-slug.ts` 的
> `TAG_SLUG_OVERRIDES` 里补一行。

### 在 MDX 里用组件

`src/mdx-components.tsx` 里注册过的组件**不需要 import**：

| 写法 | 作用 |
| --- | --- |
| `<Callout type="tip" title="…">…</Callout>` | 提示框，type 可为 info/tip/warning/danger |
| `<BilibiliVideo bvid="BV…" title="…" />` | B 站视频 |
| `<AudioPlayer src="/uploads/x.mp3" title="…" />` | 单曲播放器 |

新增全局组件就在那个文件的 `components` 对象里加一行。

### 改站点默认值

编辑 `content/site-settings.json`，或在前台「设置 → 站点默认值」里保存（需要 GitHub token）。
字段含义见 README 的「设置存在哪」。

**容错是逐字段的**：文件缺失 / 非法 JSON / 类型错误都只影响那个字段，不会让构建失败。

### 换头像

替换 `public/avatar.png`（512×512）和 `public/avatar-128.png`（128×128）即可，
引用点在 `TopBar` / `Sidebar` / `about` 页，都读 `SITE.avatar`。

favicon 是 `src/app/favicon.ico` 和 `src/app/icon.png`，分享图是 `public/og-cover.png`。

---

## 八、验证与排错

### 最低验证（每次改完都要跑）

```bash
npx tsc --noEmit      # 类型
npx eslint .          # 0 error / 0 warning
npx next build        # 0 warning，产物在 out/
```

### 眼睛要看的地方

```bash
npx serve out          # 或 python -m http.server -d out 8080
```

- 刷新文章页是否会 404（`trailingSlash` 是否生效）
- **每个标签页都要点一遍**：`out/tags/` 下的目录名应该全是 ASCII
- `/rss.xml` 是不是 XML，`/search-index.json` 的 `count` 对不对
- 深色模式刷新有没有闪屏
- 侧栏播放器能不能出声、切三种模式
- 桌面端点留言区的 × 会不会收起

### 碰到「时好时坏」的问题，先删缓存

```bash
# 停掉 dev server，然后
rm -rf .next && npm run dev
```

很多「有时候 200 有时候 500」其实是 `.next` 里留着上一版代码的产物。
不删缓存，你会一直在解释一个不存在的竞态。

### 改站点设置的验证方法

改 JSON → 重新构建 → 在 `out/index.html` 里搜 `SITE_THEME` 和 `SITE_FONT`，
看注入的主题与字号是否跟着变。这是唯一能确认「首屏是否正确」的方式。

### 子路径部署要单独验一次

```bash
NEXT_PUBLIC_BASE_PATH=/hua-cheng-blog npx next build
# 然后检查产物里 href="/posts/..." 应该一个都没有
```

---

## 九、当前状态与边界

### 已完成

文章展示 · 后台写作 · 标签归档 · RSS · **站内搜索（含时间排序）** ·
**代码高亮（Shiki 双主题）** · **数学公式（KaTeX）** · 标签 / 归档 ·
视频 / 音乐 · **自定义壁纸（含直传仓库）** · **站点默认值存仓库** ·
**Giscus 评论** · 深浅色主题 · **头像**

### 明确没做（以及原因）

| 没做 | 原因 |
| --- | --- |
| 图片自动优化 | 静态导出下 `next/image` 优化器不可用；且仓库里目前没有图片 |
| 阅读量统计 | 需要引入 Workers + D1 |
| 代码块行号 / 行高亮 | Shiki 的 transformers 需要传函数，Turbopack 下不可用 |
| 匿名评论 | Giscus 需要 GitHub 账号；换 Waline 一类就要部署服务 |

### 性能现状（实测）

| 指标 | 值 |
| --- | --- |
| 构建产物 CSS | 约 86KB（其中 KaTeX 24KB） |
| KaTeX 字体 | 20 个 woff2 / 254KB，**只在实际渲染公式的页面下载** |
| 构建耗时 | 约 15 秒（引入 Shiki 前约 3 秒，代价转移到了构建期） |

---

## 十、文档地图

| 想了解 | 看 |
| --- | --- |
| 怎么用、怎么部署 | [README.md](README.md) |
| 为什么这样设计、被否决的方案 | [design.md](design.md) |
| 快速上手且不踩坑 | 就是本文档 |

改完代码后，**如果改动影响了上述任何一条「硬约束」或「踩过的坑」，
请同步更新这份文档** —— 它的价值就在于「读完不会踩坑」。
