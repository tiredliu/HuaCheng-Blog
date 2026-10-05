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
| 内容在哪 | `content/posts/*.md(x)`（frontmatter + 正文），**这是唯一的内容真相来源**。`.md` 与 `.mdx` **等价**，都走 MDX 管线 |
| 静态资源 | `public/images/`（文章配图）· `public/wallpapers/`（壁纸）· `public/music/`（音频）· `public/lyrics/`（歌词）· `public/uploads/`（上传落点）—— 约定在 `src/lib/assets.ts` |
| 公开留言/评论 | 走 **Giscus**（GitHub Discussions，配置在 `site-settings.json` 的 `giscus`）；`content/guestbook.json` + `comments.json` 只在**没配 Giscus** 时作为本机兜底 |
| 站点配置 | `content/site-settings.json`（默认设置）+ `src/lib/site.ts`（站点常量） |
| 浏览量后端 | `functions/api/[[route]].js`（Pages Function + D1，同源 `/api`，**跟站点一起部署**；见 `functions/README.md`） |
| 点赞 / 评论 | 都不需要自建后端：点赞 = 评论区讨论上的 GitHub 反应数；评论 = Giscus（Discussions） |
| 产物 | `out/`，部署到 Cloudflare Pages |
| 包管理 | npm（Node 22） |
| 语言 | 注释、文档、UI 文案、commit message **全部用中文** |

### 起手三件事

```bash
npm install
npm run dev          # http://localhost:3000，后台 /admin
npm run new          # 新建一篇文章（自动 ASCII 文件名 + frontmatter）
npm run build        # 静态导出到 out/
```

改完**必须**跑一遍：

```bash
npx tsc --noEmit && npx eslint . && npx next build
```

三项全绿才算改完。构建应当 **0 warning**。

---

## 二、必须知道的 13 条硬约束

违反这些会「构建成功但线上坏掉」，或者让 dev 直接 500。前 4 条最要命。
第 12 条是唯一一条**违反了也不会报错**的 —— 它只会让内容悄悄变样。

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

### 9. 动态路由的参数不能用中文（标签 URL 用 ASCII slug）

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

#### 这条对**文章文件名**同样成立（2026-10 实测）

```text
content/posts/中文文件名测试.mdx   ← 文件确实存在

/posts/hello-world/           → 200 ✅
/posts/image-cover-demo/      → 200 ✅
/posts/中文文件名测试/          → 500 / 404 ❌
```

静态产物里也真的出现了 `out/posts/中文文件名测试/` 这样的目录名，
和当初 `out/tags/部署/` 一模一样。

**所以文章的文件名必须是 ASCII**（小写字母 + 数字 + 连字符）。
（这跟扩展名无关：`中文.md` 和 `中文.mdx` 一样打不开。）

**`src/lib/posts.ts` 里有构建期检查**：非 ASCII 的 slug 在
`NODE_ENV=production` 时**直接 throw**（信息里带文件名），dev 下只 `console.warn`
（否则整个开发服务器都会跟着报错，太吵）。
起因是 Obsidian 新建笔记的默认名就是「未命名」—— 在 Obsidian 里看不出任何异常。
`npm run new` 也会挡下中文输入、退回 `post-<日期>`。

⚠️ **还有一个没修的雷**：`tina/config.ts` 的 `ui.filename.slugify` 是
`[^\w\u4e00-\u9fa5-]` —— **它保留汉字**。也就是说在网页后台新建文章时，
默认文件名会跟着中文标题走。目前靠人工改文件名躲过去（线上那篇 `test_1.mdx` 就是），
但迟早会踩。要修就把那个正则里的 `\u4e00-\u9fa5` 拿掉，
让它生成 ASCII 名字（改完要同步 README 里关于后台文件名的那一段）。

### 10. `data-scroll-behavior="smooth"` 不能删

站点在 `globals.css` 里给 `<html>` 设了 `scroll-behavior: smooth`。
Next 16 起**默认不再**在导航时覆盖它 —— 不加这个属性，
每次切页面都会「平滑滚到顶部」，观感很拖沓。
加上它，导航时 Next 会临时切成 `auto`（瞬时滚顶），页内锚点仍然平滑。

### 11. 所有图片地址都要过 `resolveImageSrc()`

```ts
// src/lib/site.ts
resolveImageSrc(value) → 站内绝对路径补 basePath；http(s) 原样；其余原样
```

**三个引用点必须用同一个函数**：MDX 正文的 `<img>`（`mdx-components.tsx` 的
`MdxImage`）、列表页卡片的缩略图（`posts.ts` 的 `extractImages`）、
frontmatter 的 `cover`。任何一处自己拼 `basePath`，子路径部署
（GitHub Pages 项目页）时就会出现「正文的图好好的、列表页缩略图 404」
这种**只在子路径构建才暴露**的不一致。

「省略了前导斜杠」的目录清单在 `src/lib/assets.ts` 的 `ASSET_DIR_LIST` 里，
和 `resolveImageSrc()` **共用同一份** —— 加资源目录只改那一处。

另外，卡片上「有 cover 就不显示正文缩略图带」是**有意的**，别顺手改成两个都显示
（两种图片语言堆在同一张卡片里很难看）。

### 12. 文章的 `.md` / `.mdx` 靠 `next.config.ts` 里两行撑着，**缺一不可**

`content/posts/` 下的文章 `.md` 和 `.mdx` **等价**（Typora / Obsidian 原生只认 `.md`）。
这件事全靠 `createMDX({...})` 上的两项配置：

```ts
createMDX({
  extension: /\.mdx?$/,        // ① 默认只匹配 .mdx
  options: { format: "mdx" },  // ② 默认 'detect' 会按扩展名把 .md 当纯 Markdown
})
```

| 删掉哪一行 | 后果 |
| --- | --- |
| `extension` | `.md` 文件没有 loader → Turbopack 报 `Unknown module type`，**构建失败**（响的，好查） |
| `options.format` | ⚠️ **`.md` 里的 JSX 被静默丢掉** —— `<Callout>` 标签消失、只剩里面的文字；`{1 + 1}` 原样输出。**页面不报错，只是所有富文本组件变成普通段落**（不响的，极难发现） |

根因：`@mdx-js/mdx` 的 `format` 默认 `'detect'`，而它按扩展名猜 ——
扩展名落在 `mdExtensions`（含 `.md`）里就按纯 Markdown 编译。完整推导见 design.md 7.1 / 17.16。

**改这两行之前先做那个对照实验**：同一份内容存成 `.md` 和 `.mdx`，
里面放 `<Callout>` 和 `{1 + 1}`，构建后比对两份 HTML 是否一致。

**另外一处别动**：文章页的 import 必须写成

```ts
await import(`@/content/posts/${post.fileName}`)   // fileName 含扩展名
```

**不要**改成按扩展名分两个分支（`? import(…${slug}.md) : import(…${slug}.mdx)`）。
Turbopack 为每个模板字面量生成一个「上下文」，而**上下文不能为空** ——
仓库里没有 `.md` 文章时，`.md` 那个分支会让整个构建报
`Can't resolve '@/content/posts/' <dynamic> '.md'`。
那种写法等于给仓库加了一条隐式约束「必须至少留一篇 .md」，而且报错看不出因果。

### 13. 音频音效链：只建一次、只在用户操作里建、只给同源音频

`src/lib/audio-effects.ts` 有三条不能违反的约束，违反了都是**声音没了**而不是报错：

| 约束 | 违反的后果 |
| --- | --- |
| 一个 `<audio>` 只能 `createMediaElementSource()` 一次 | 第二次直接抛 `InvalidStateError` |
| AudioContext 必须在**用户手势之后**创建/恢复 | 在 effect 里建会是 `suspended`，**接上就静音** |
| 音频必须同源或带 CORS 头 | 外链（网易云之类）接进链里会**直接没声音** |

所以：`applyAudioEffect()` 只在「点音效按钮」和「`play()` 成功之后」调用；
外链曲目由 `isEffectAvailable()` 挡掉（界面上按钮是禁用的）；
默认档位是「原声」，**不建任何 AudioContext**，原有播放行为不受影响。

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

**默认没有后端。** 所有「写操作」都是浏览器直连 GitHub Contents API
（需要站长自己的 fine-grained token，存在访客本地）。

**唯一还需要后端的只剩浏览数** —— `functions/api/[[route]].js`（Pages Function + D1），
挂在站点同源的 `/api` 上，跟着 Pages 一起构建部署。
点赞读的是评论区那条 Discussion 的 GitHub 反应数，评论与留言本身就是 GitHub Discussions ——
这两件都不用你自己跑后端，也不受本站流量影响。关系是这样：

```text
浏览数 ──┬─ `provider = "local"`            → localStorage，零请求（界面标「（本机）」）
        └─ `provider = "remote"` + `apiBase = "/api"` → Pages Function → D1
                                            （D1 未绑 / 断网自动退回上面那条）

点赞数 ─── 评论区那条 Discussion 的 GitHub 反应数（`data-emit-metadata` 广播出来）
评论   ─── Giscus → 仓库的 Discussions（登录一次，全站通用）

站长的写操作 ─┬─ 文章 / 图片 / 站点设置 → GitHub Contents API
              ├─ 回复评论 / 留言       → 直接在 GitHub Discussions 里回（有通知，即时生效）
              └─ 没配 Giscus 时的回复   → 提交 `content/*.json`，构建后生效
```

⚠️ 走 Giscus 之后，评论的**权限由 GitHub 把着**：身份是 OAuth 授权的 GitHub 账号，
没人能冒充站长，也不需要你交出任何凭据。
只有在「没配 Giscus + 用了旧互动服务 `workers/blog-api`」那条老路上，
`reply` / `owner` / 删除才需要站长凭据，而且是**服务端强制**的 ——
Worker 会去 `GET /repos/{owner}/{repo}` 看 `permissions.push`，
不是站长就 403，且一个字节都不写。改这块代码时不要在前端「顺手放宽」，
那等于把仓库写权限发给所有人。

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
| 右侧留言板 | `src/components/MessagePanel.tsx`（配了 Giscus 时内嵌 `GiscusComments`，绑定「留言板」Discussion） |
| 文章底部评论区 | `src/components/PostInteractions.tsx`（配了 Giscus 只渲染 `GiscusComments`，否则退回 `CommentThreadView`） |
| 文章页的浏览量与点赞 | `src/components/PostStatsBar.tsx` |
| 互动数据存哪（本机 / 远程） | `content/site-settings.json` 的 `interactions` |
| 站长回复写进仓库的格式 | `src/lib/repo-comments.ts` |
| 列表页卡片的封面与缩略图 | `src/components/PostCard.tsx` + `src/lib/posts.ts` 的 `extractImages()` |
| 浏览量后端 | `functions/api/[[route]].js`（Pages Function + D1，跟站点一起部署） |
| 旧互动服务（评论/点赞/回复，本站已不用） | `workers/blog-api/` |
| 设置抽屉 | `src/components/SettingsPanel.tsx` |
| 壁纸逻辑 | `src/lib/wallpaper.ts` + `WallpaperLayer/Settings.tsx` |
| **资源目录约定**（图片/壁纸/音乐/歌词） | `src/lib/assets.ts` 的 `ASSET_DIRS` |
| 歌单 / 播放模式 | `src/lib/music.ts` |
| 歌词解析（LRC） | `src/lib/lyrics.ts`（纯函数，可以直接用 Node 验） |
| 悬浮歌词窗 | `src/components/LyricsPanel.tsx`（挂到 `document.body`） |
| 音效（Web Audio） | `src/lib/audio-effects.ts` |
| 搜索结果排序 / 打分 | `src/lib/search.ts` + `SearchDialog.tsx` |
| 文章元信息（字数等） | `src/lib/posts.ts` 的 `PostMeta` |
| MDX 里能用的组件 | `src/mdx-components.tsx` |
| **文章支持哪些扩展名** | `next.config.ts` 的 `extension` + `options.format` —— 见硬约束 12，**缺一不可** |
| 代码块 / 公式样式 | `src/app/globals.css` 末尾两节 |
| 部署相关 | `next.config.ts` / `Dockerfile` / `nginx.conf` / `public/_headers` |
| 新建文章（本地写作入口） | `scripts/new-post.mjs`（`npm run new`） |
| 面向写作的编辑器配置 | `.vscode/settings.json` + `.vscode/blog.code-snippets`（**只影响本地编辑体验，不参与构建**） |
| 图片地址规整 | `src/lib/site.ts` 的 `resolveImageSrc()` —— 正文图 / 卡片缩略图 / 封面图**共用这一个** |

### 关键文件职责

| 文件 | 职责 | 注意 |
| --- | --- | --- |
| `src/lib/posts.ts` | **构建期**内容层：解析、过滤、字数、目录、相关文章、搜索索引、正文配图、文章文件名（`Post.fileName`） | 服务端专用 |
| `src/lib/interactions.ts` | 互动层：本机存储、远程协议、path 规整、评论合并（**零 import，可直接用 Node 跑**） | 客户端安全 |
| `src/lib/interactions-file.ts` | 构建期读 `content/guestbook.json` / `comments.json` | 服务端专用 |
| `src/lib/repo-comments.ts` | 站长用 GitHub API 把留言/回复 upsert 进仓库 | 客户端专用 |
| `src/hooks/useCommentThread.ts` | 评论区与留言板的共同逻辑（发表/回复/删除/合并三来源） | 见硬约束 5 |
| `src/hooks/useOwnerMode.ts` | 站长模式 = 本机有没有 GitHub Token | — |
| `src/lib/search.ts` | 切词、打分、排序（**纯函数，客户端安全**） | 标签 slug 见下 |
| `src/lib/tag-slug.ts` | 标签名 ⇄ URL slug（**纯函数，客户端安全**） | 中文标签要在这里登记 |
| `src/lib/site-settings.ts` | 站点默认值的类型、校验、**防闪屏脚本生成** | 客户端安全 |
| `src/lib/site-settings-file.ts` | 构建期读 JSON | 服务端专用 |
| `src/lib/github-upload.ts` | 直连 GitHub API：传图、删图、读写设置文件（传图目录由 `AssetDir` 指定） | 客户端专用 |
| `src/lib/assets.ts` | 资源目录约定：`ASSET_DIRS` / `assetUrl()` / `musicUrl()` / `lyricUrl()` | 零依赖，客户端安全 |
| `src/lib/lyrics.ts` | LRC 解析与「当前唱到哪一句」（**纯函数，可直接用 Node 跑**） | 客户端安全 |
| `src/lib/audio-effects.ts` | Web Audio 音效链：三段均衡 + 现场生成的混响 | 客户端专用，见硬约束 13 |
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

### 8. 用 PowerShell 检查产物里的中文，会「假失败」

曾经这样验证产物：

```powershell
$html = Get-Content out/index.html -Raw
if ($html -match '这条置顶说明由站长发布') { ... }   # 永远 FAIL
```

同一份 HTML 用 `grep`/ripgrep 搜得到，用 PowerShell 的命令行参数传中文字面量就是搜不到 ——
**中文在经过 `pwsh -Command` 这一层时被转坏了**，而且不会报错，只是安静地匹配失败。
当时差点得出「留言没渲染出来」的错误结论。

**教训**：验证脚本里出现中文期望值时，用 Node 或 ripgrep，别用 PowerShell 的行内中文字面量。
ASCII 部分（`workers/blog-api` 这种）反而是好的，所以失败会一半一半，特别像「功能坏了一半」。

### 9. 静态导出的 HTML 里有 RSC 数据，「字符串在里面」≠「渲染出来了」

`out/**.html` 末尾跟着一大段 `self.__next_f.push(...)`，
里面是**序列化后的原始 props**。曾经这样验证「有封面时不该显示缩略图」：

```js
html.includes("/images/zz-a.jpg")   // true —— 但页面上根本没显示它
```

因为那篇文章的 `post.images` 数组本身就包含 zz-a，props 被原样写进了 flight 数据。

**做法**：判断「渲染出来了没有」之前先切掉这段：

```js
const dom = (html) => html.slice(0, html.indexOf("self.__next_f"));
```

顺带一个同源的小坑：React 会在 `{表达式}` 和后面的文本之间插 `<!-- -->`，
所以 `花城 回复` 这种拼接出来的文案要写成 `/花城(<!-- -->)?\s*回复/` 才匹配得到。

**教训**：产物验证要区分「数据在页面里」和「用户看得见」。

### 10. `.md` 加进来时，JSX 被**静默丢掉**（构建成功、页面正常、内容变样）

给 `.md` 加支持时，第一版只加了 `extension: /\.mdx?$/`。
构建通过、页面生成了、文字也都在 —— **看起来完全成功**。

直到做了一次对照实验（同一份内容，一份 `.md` 一份 `.mdx`）才发现：

```text
.md  ：A 表达式：{1 + 1}                 ← 没求值
       B 单行组件：<!-- -->单行内容        ← <Callout> 标签整个消失

.mdx ：A 表达式：2
       B 单行组件：<div class="...">单行标题...单行内容</div>
```

根因是 `@mdx-js/mdx` 的 `format` 默认 `'detect'`，**按扩展名猜格式**：
`.md` 落在 `mdExtensions` 里 → 按纯 Markdown 编译 → JSX 当原始 HTML 被丢掉
（内容文字留着，所以肉眼看不出少了东西）。

**教训**（这一条比 bug 本身重要）：
**「支持一种新格式」不能靠「构建通过 + 页面能打开」来验收 ——
必须拿同一份内容跑两种格式做对照。**
只加 `extension` 的那版，如果没做对照实验，会以「看起来成功了」的样子进仓库。

同类问题的通用检查法：**预期会出现的东西（组件外壳、特有 class、求值结果）
在不在产物里**，而不是「页面能不能打开」。

### 11. 动态 `import()` 的上下文**不能为空**

同一个功能里的第二个坑。文章页一度写成按扩展名分两个分支：

```ts
post.fileName.endsWith(".md")
  ? import(`@/content/posts/${slug}.md`)     // 仓库里一篇 .md 都没有时
  : import(`@/content/posts/${slug}.mdx`)    // → 整个构建失败
```

```text
Module not found: Can't resolve '@/content/posts/' <dynamic> '.md'
```

Turbopack 为每个模板字面量生成一个「上下文模块」（把匹配到的一批文件一起打包），
**匹配不到任何文件就报错**。于是那条写法凭空造出一条隐式硬约束：
「仓库里必须至少留一篇 `.md` 文章」—— 而报错信息里完全看不出这层因果。

**写法**：一个插值 + 含扩展名的真实文件名。

```ts
await import(`@/content/posts/${post.fileName}`)   // glob = content/posts/*
```

**教训**：`import()` 里插值的**每一段静止部分都会被当成 glob**。
新增任何「按后缀/类型分支」的动态 import 时，都要想一遍
「这个分支匹配不到文件会怎样」—— 它不会静默跳过，而是让整个构建挂掉。

### 12. `position: fixed` 的浮层，只要祖先有 `backdrop-blur` / `transform` 就会被「关进」那个祖先

歌词窗（`LyricsPanel`）第一版是就地 `fixed` 渲染在侧栏里的，结果：

- 有壁纸时侧栏带 `backdrop-blur-xl`，移动端抽屉带 `translate-x-*` ——
  **这两个都会给 fixed 子元素创建包含块**，于是「贴着视口右下角」变成了
  「贴着侧栏右下角」，还被侧栏的 `overflow-hidden` 裁掉一截。

**做法**：用 `createPortal(…, document.body)` 挂出去。

顺带两个同源的小坑：

- 侧栏内容区是 `overflow-y-auto`（按 CSS 规范 `overflow-x` 会跟着变成 `auto`），
  所以**就地展开的浮层菜单也会被裁**。播放列表、音效列表都做成**就地展开**而不是浮层，
  正是因为这个 —— 别顺手改成 absolute 浮层。
- 浮层的位置**用 `right` / `bottom` 存**而不是 `left` / `top`：
  默认值 `{ right: 24, bottom: 24 }` 不需要先量视口尺寸，
  也就不用在 effect 里读 `window.innerWidth` 再 setState 回写（硬约束 6）。

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
| `<AudioPlayer src="/music/x.mp3" title="…" />` | 单曲播放器 |

新增全局组件就在那个文件的 `components` 对象里加一行。

### 给文章加封面 / 正文配图

| 想要的效果 | 怎么写 |
| --- | --- |
| 列表页卡片用某张图当**背景**、文章页顶部也显示它 | frontmatter 写 `cover: /images/x.jpg`（后台写作时用 TinaCMS 的「封面图」字段） |
| 卡片底部显示正文里的图片缩略图带 | 正文里正常插图：`![说明](/images/a.jpg)` 或 `<img src="/images/a.jpg" />` |

`extractImages()` 会自动跳过代码块/行内代码里的图片、`data:` 内联图和相对路径，
最多取 4 张。**有 `cover` 时不再显示缩略图带**（有意的，见硬约束 11）。

### 改互动（浏览量 / 点赞 / 评论）的行为

| 想改什么 | 动哪里 |
| --- | --- |
| 后端是本机还是全站 | `content/site-settings.json` 的 `interactions.provider` / `apiBase` |
| 本机模式的存储与合并规则 | `src/lib/interactions.ts`（纯函数，优先在这里改，可以直接用 Node 验） |
| 发表/回复/删除的编排 | `src/hooks/useCommentThread.ts` |
| 本机评论/留言的排版（兜底时） | `src/components/CommentThreadView.tsx`（评论区与留言板共用） |
| Giscus 评论区的接入 | `src/components/GiscusComments.tsx`（文章用 `pathname` 映射；留言板传 `mapping="specific"` + `term="留言板"`） |
| 站长写进仓库的文件格式 | `src/lib/repo-comments.ts` + `src/lib/interactions-file.ts`（**读写两侧要同时改**） |
| 浏览数的服务端逻辑（计数 / 校验 / 额度） | `functions/api/[[route]].js`（跟站点一起部署） |
| 旧互动服务的权限校验 / 限流 / 上限 | `workers/blog-api/src/index.js`（本站已不用；改完要单独 `wrangler deploy`） |

⚠️ 动第 5 行之前先想清楚：`interactions-file.ts` 读的字段和
`repo-comments.ts` 写的字段必须一一对应，而且都要能在
`content/*.json` 里被手改坏之后**优雅降级**（丢那一条 + 打一行警告，不让构建失败）。

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
- **留言板**：配了 Giscus 时面板里应出现 Giscus（HTML 里有「由 GitHub Discussions 提供」与底部 Discussions 链接），且**不再**有本机留言输入框
- 文章页头部有没有「— 次浏览」占位；**底部只应有一条 Giscus 评论区**（HTML 里有「评论」标题，且不再有本机评论输入框）
- **有 `cover` 的文章**：列表页卡片是不是图片背景、文章页顶部有没有大图
- **正文有图的文章**：卡片底部有没有缩略图带（且代码块里的图没被算进去）

### 验产物时的两个坑（都真实踩过）

1. **别用 PowerShell 的行内中文去匹配 HTML** —— 中文经过 `pwsh -Command` 会被转坏，
   匹配永远失败且不报错。用 Node 或 ripgrep。
2. **`out/**.html` 末尾有 RSC（flight）数据**，里面是原始 props。
   判断「有没有渲染出来」之前先切掉：
   `html.slice(0, html.indexOf("self.__next_f"))`。
   否则会出现「`post.images` 里有这张图 → 以为卡片显示了缩略图」这种假阳性。

详细经过见「六、踩过的坑」第 8、9 条。

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
深浅色主题 · **头像** · **列表页封面图与正文缩略图** ·
**浏览数（D1 全站 / 本机两档）** · **点赞（评论区讨论上的 GitHub 反应数）** ·
**评论区（Giscus：文章底部 + 非文章页的留言板）** ·
**Giscus 接入（本站已启用；代码默认未启用，未配时退回本机评论）** ·
**资源按类型分目录**（图片 / 壁纸 / 音乐 / 歌词） · **悬浮歌词窗（可拖动缩放）** ·
**Web Audio 音效（免费，默认关闭）**

### 明确没做（以及原因）

| 没做 | 原因 |
| --- | --- |
| 图片自动优化 | 静态导出下 `next/image` 优化器不可用；列表页缩略图也是原图缩放，图多了这里最该先优化 |
| 非 Cloudflare 托管时的全站浏览数 | Pages Function 只在 Cloudflare Pages 上跑得起来；换成 GitHub Pages / Nginx / Docker 会自动退回本机计数 |
| 浏览量的防刷 | `/api/hit` 没有鉴权，可以被脚本刷；浏览量本就是模糊指标，个人博客不做这个投入 |
| 并发下的精确计数 | ✅ **已解决**：D1 用 `count = count + 1` 原子自增；旧的 Worker + KV 没有事务、每天只有 1000 次写，那才是「访问一上来就崩」的原因 |
| 代码块行号 / 行高亮 | Shiki 的 transformers 需要传函数，Turbopack 下不可用 |
| 匿名的全站评论 | 本站统一走 Giscus，需要 GitHub 账号；想要匿名评论得换 Waline 一类（那要部署服务） |

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
