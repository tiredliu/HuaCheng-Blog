# 花城博客 · hua-cheng-blog

一个**纯静态**的个人博客：内容写在 MDX 里，后台用 TinaCMS 编辑，
构建产物直接托管到 Cloudflare Pages。

- 前台：<http://localhost:3000>
- 后台：<http://localhost:3000/admin>
- 部署：`git push` 之后 Cloudflare Pages 自动重新构建

> **三份文档的分工**
>
> | 文档 | 回答的问题 |
> | --- | --- |
> | **[AI_CONTEXT.md](AI_CONTEXT.md)** | 怎么快速上手且不踩坑（**AI / 新对话先读这份**） |
> | 这份 README | 怎么用：跑起来、写文章、改配置、部署 |
> | [design.md](design.md) | 为什么这样设计、哪些方案被否决过 |

## 目录

- [它是什么](#它是什么) · [快速开始](#快速开始) · [目录结构](#目录结构)
- [写一篇新文章](#写一篇新文章) ← 含**代码高亮**、**数学公式**与**缩略框配图**
- [**本地写作**](#本地写作长文推荐) ← 双栏预览、`npm run new`、面向写作的编辑器配置
- [界面说明](#界面说明) · [音乐播放器](#音乐播放器) · [站内搜索](#站内搜索)
- [壁纸](#壁纸) · [**设置存在哪**](#设置存在哪)
- [**互动：浏览量 · 点赞 · 评论区**](#互动浏览量--点赞--评论区) ← 含**统计后端怎么部署**
- [**留言与评论怎么回复**](#留言与评论怎么回复) ← 谁的评论谁看得见、谁能回复
- [评论系统](#评论系统) · [头像与站点信息](#头像与站点信息)
- [部署](#部署) ← Cloudflare Pages / GitHub Pages / Vercel / Nginx / Docker
- [疑难排查](#疑难排查) · [当前能力边界](#当前能力边界)

---

## 它是什么

| 项目 | 说明 |
| --- | --- |
| 定位 | 个人博客 |
| 核心需求 | 网页后台直接写作 · 国内访问快 · 免费托管 · 源码公开 |
| 形态 | 静态站点（构建时生成 HTML，运行时不需要 Node） |

### 技术栈

| 层级 | 技术 | 作用 |
| --- | --- | --- |
| 框架 | Next.js 16（App Router） | 路由与静态导出 |
| UI | React 19 | 组件化开发 |
| 语言 | TypeScript 5 | 类型安全 |
| 样式 | Tailwind CSS 4 | 原子化 CSS，主题写在 `@theme` 里 |
| 内容 | MDX | Markdown + React 组件 |
| 代码高亮 | Shiki 4 | 构建期着色，双主题、运行期零成本 |
| 数学公式 | KaTeX 0.19 | 构建期渲染，字体按需下载 |
| 后台 | TinaCMS 3 | 网页编辑器，保存即提交 GitHub |
| 评论 | 本机评论 / 互动服务 / Giscus | 默认零配置；想要全站可见的评论就部署一个可选的 Cloudflare Worker |
| 托管 | Cloudflare Pages | 全球 CDN，免费额度足够 |

---

## 快速开始

```bash
npm install
cp .env.example .env.local   # Windows: copy .env.example .env.local
npm run dev
```

打开 <http://localhost:3000>。本地开发时 `TINA_PUBLIC_IS_LOCAL=true`，
TinaCMS 直接读写本地文件，不需要注册 TinaCloud 账号。

### 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动开发服务器（含 TinaCMS 后台） |
| `npm run dev:next` | 只启动 Next.js，跳过 TinaCMS，冷启动更快 |
| `npm run build` | 构建 TinaCMS 后台 + 静态导出到 `out/` |
| `npm run build:cms` | 只构建 TinaCMS 后台（需要 TinaCloud 凭据） |
| `npm run build:app` | 只做静态导出，不重新生成后台 |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run lint` | ESLint |

> 还没配置 TinaCloud 时，`npm run build` 会在第一步停下并提示缺少 `clientId` / `token`。
> 这时用 `npm run build:app` 只导出前台即可。

---

## 目录结构

```text
hua-cheng-blog/
├── src/
│   ├── app/                        App Router 路由
│   │   ├── layout.tsx              根布局（顶部栏 + 左右侧栏外壳）
│   │   ├── page.tsx                首页
│   │   ├── posts/page.tsx          全部文章
│   │   ├── posts/[slug]/page.tsx   文章详情（构建期编译 MDX）
│   │   ├── tags/…                  标签总览 / 标签详情
│   │   ├── archive/page.tsx        按年份归档
│   │   ├── about/page.tsx          关于（技术栈与能力边界）
│   │   ├── contact/page.tsx        联系方式
│   │   ├── rss.xml/route.ts        RSS 订阅源（构建期生成静态 XML）
│   │   ├── search-index.json/route.ts  搜索索引（构建期生成静态 JSON）
│   │   └── not-found.tsx           404
│   ├── components/                 界面组件
│   │   ├── BlogLayout.tsx          应用外壳：顶栏 + 三栏布局
│   │   ├── ThemeContext.tsx        把「当前是否深色」传给深层组件
│   │   ├── TopBar.tsx              搜索 / 主题 / 设置 / 留言开关
│   │   ├── SearchDialog.tsx        ⌘K 搜索弹窗（高亮、键盘导航）
│   │   ├── Sidebar.tsx             可隐藏、可拖拽宽度的导航
│   │   ├── ContentArea.tsx         内容区
│   │   ├── MessagePanel.tsx        可隐藏留言板（仓库留言 + 本机留言 + 站长回复）
│   │   ├── CommentThreadView.tsx   评论 / 留言的展示与输入（评论区与留言板共用）
│   │   ├── PostInteractions.tsx     文章底部评论区（本机 / 互动服务 / Giscus）
│   │   ├── PostStatsBar.tsx        文章头部的浏览次数与点赞
│   │   ├── WallpaperLayer.tsx      全屏壁纸层（fixed + -z-10）
│   │   ├── SettingsPanel.tsx       设置抽屉 + 站点默认值保存
│   │   ├── WallpaperSettings.tsx   壁纸设置（预设 / 直传仓库 / 本机）
│   │   ├── GithubTokenConfig.tsx   GitHub Token 配置（三处共用）
│   │   ├── GiscusComments.tsx      Giscus 接入
│   │   ├── MdxContent.tsx          MDX 渲染容器
│   │   ├── BilibiliVideo.tsx       B 站视频嵌入
│   │   ├── AudioPlayer.tsx         MDX 里的单曲播放器
│   │   ├── MusicPlayer.tsx         侧栏播放器（模式 / 音量 / 播放列表）
│   │   ├── PostCard.tsx            文章卡片
│   │   ├── TagBadge.tsx            标签徽标
│   │   ├── TableOfContents.tsx     文章目录
│   │   ├── ReadingProgress.tsx     顶部阅读进度条
│   │   ├── PageHeader.tsx          页面标题 / 空状态
│   │   └── Callout.tsx             MDX 提示框
│   ├── hooks/                      持久化状态、断点判断
│   ├── lib/
│   │   ├── posts.ts                构建期读取 content/posts（Node API）
│   │   ├── interactions.ts         互动层：浏览量/点赞/评论的本机与远程实现
│   │   ├── interactions-file.ts    构建期读取留言与评论（Node API）
│   │   ├── repo-comments.ts        站长用 GitHub API 把留言/回复写进仓库
│   │   ├── site-settings.ts        站点默认值的类型/校验/引导脚本
│   │   ├── site-settings-file.ts   构建期读取 content/site-settings.json
│   │   ├── search.ts               搜索打分与切词（客户端安全）
│   │   ├── site.ts                 站点常量、basePath、图片路径规整
│   │   ├── wallpaper.ts            壁纸预设、解析、上传记录
│   │   ├── github-upload.ts        直传 GitHub 仓库（无需后端）
│   │   ├── image-utils.ts          图片压缩、缩略图、base64
│   │   ├── music.ts                歌单与播放模式
│   │   └── utils.ts                日期与 className 工具
│   ├── hooks/
│   │   ├── usePersistentState.ts   localStorage ⇄ React
│   │   ├── useOwnerMode.ts         站长模式（本机有没有 GitHub Token）
│   │   └── useCommentThread.ts     评论区/留言板的共同逻辑
│   └── mdx-components.tsx          MDX 全局组件注册
├── content/
│   ├── posts/*.md(x)               文章本体（.md 与 .mdx 等价）
│   ├── guestbook.json              ★ 站长发布的公开留言（所有人可见）
│   ├── comments.json               ★ 站长发布的公开评论与回复（所有人可见）
│   └── site-settings.json          ★ 站点默认设置（可提交到仓库）
├── workers/blog-api/               ★ 可选的 Cloudflare Worker：浏览量/点赞/评论后端
├── public/uploads/                 上传的图片与音频
├── scripts/tina.mjs                TinaCMS 启动器（把编译临时目录放进项目内）
├── tina/config.ts                  内容模型定义
└── next.config.ts                  静态导出 + MDX 插件
```

---

## 写一篇新文章

三种方式，按篇幅选：

| 场景 | 用哪个 |
| --- | --- |
| 改错别字、换封面图、发一条短随笔 | [方式一：网页后台](#方式一网页后台) |
| 已经想清楚要写什么，就是补一个文件 | [方式二：直接写文件](#方式二直接写文件) |
| **写长文** | [本地写作](#本地写作长文推荐)——双栏预览 + `npm run new` |

### 方式一：网页后台

打开 `/admin`，新建「博客文章」，填标题、日期、标签，写完点保存。
本地开发时保存在文件系统，连上 TinaCloud 之后会通过 GitHub API 直接提交到仓库。

### 方式二：直接写文件

在 `content/posts/` 下新建 `my-post.md`（`.mdx` 也行，两种等价 —— 见[本地写作](#本地写作长文推荐)）：

```mdx
---
title: 文章标题
date: 2025-06-18
tags: [Next.js, MDX]
summary: 列表页显示的一段摘要，可省略（省略时自动截取正文首段）
author: 花城
draft: false
---

## 小标题

正文……支持 **Markdown** 与 JSX。
```

`draft: true` 的文章只在本机 `npm run dev` 时可见，`next build` 时会自动过滤掉
（连静态页面都不会生成，不存在「生成了但没链接」的漏网情况）。

### 列表页那张卡片（缩略框）上会显示什么图

文章列表和首页的卡片有**两种图片语言**，各自独立、按有无封面自动切换：

| 你在文章里写了什么 | 卡片上会变成什么 |
| --- | --- |
| frontmatter 的 `cover` | **整张卡片以它为背景**，压一层深色渐变保证标题可读；文章页顶部也会显示这张图 |
| 正文里插入的图片（最多取前 4 张） | 卡片底部一条**缩略图带**（首屏那张大卡最多 4 张，其余 3 张），让人一眼看出「这篇里有图」 |

**有 `cover` 时不再显示缩略图带** —— 两种图片堆在同一张卡片里会互相打架。
想让某张正文图片当背景，把它填进 `cover` 就行。

```mdx
---
title: 文章标题
date: 2025-06-18
cover: /uploads/20260618-cover.jpg   # ← 卡片背景图 + 文章页顶部大图
---

![正文里的第一张图](/uploads/a.jpg)
![第二张](/uploads/b.jpg)

<img src="/uploads/c.jpg" alt="原生标签写法也认" />
```

细节：

- `cover` 也可以填外链（`https://…`），不限于仓库里的图
- 后台写作时用 **TinaCMS 后台 →「封面图（列表页缩略框的背景）」** 从媒体库选图，
  它会把文件提交到 `public/uploads/` 并自动写好 frontmatter
- 正文里的图片两种写法都认：Markdown 的 `![说明](/uploads/x.jpg)` 和原生 `<img src="…">`
- **代码块与行内代码里的图片会被跳过** —— 贴一段示例代码不该让卡片多出几张缩略图
- `data:` 开头的内联图片和相对路径会被忽略：前者会让卡片背上几百 KB 的 base64，
  后者在列表页（URL 层级和文章页不同）会解析到错误的位置
- 站内绝对路径会自动补上 `basePath`，所以子路径部署（GitHub Pages 项目页）时
  **正文里的图和卡片上的缩略图是同一个地址**，不会出现「正文好好的、列表页 404」

> **想看实际效果？** 仓库里自带两篇自检文章：
> [图片与封面自检](content/posts/image-cover-demo.mdx)（带 `cover`，卡片是背景图）
> 与 [对照文章](content/posts/image-thumbnails-demo.mdx)（不带 `cover`，卡片是缩略图带）。
> 配图由 [scripts/make-demo-images.py](scripts/make-demo-images.py) 生成。
> 这四样东西都只是用来验收的，确认没问题后一起删掉即可。

### 代码块会自动高亮

````mdx
```ts
const x: number = 1;
```
````

用 [Shiki](https://shiki.style) 在**构建期**着色，所以：

- 访客的浏览器里没有任何高亮代码，只有现成的 HTML 和 CSS 变量
- **深浅色两套配色同时写在同一份 HTML 里**，切换主题不需要重新渲染
- 右上角会自动显示语言名

支持的语言就是 Shiki 内置的那些（`ts` / `tsx` / `js` / `bash` / `json` / `css` / `html` / `python` …）。
不写语言的代码块按纯文本处理，样式一致。

### 数学公式

用标准的 LaTeX 语法，`remark-math` 识别、`rehype-katex` 渲染：

| 写法 | 效果 |
| --- | --- |
| `$E = mc^2$` | 行内公式 $E = mc^2$ |
| `$$ … $$`（独立成段） | 行间公式，居中显示 |

```mdx
质能方程 $E = mc^2$ 就是这么写的。

$$
\int_{-\infty}^{\infty} e^{-x^2}\,\mathrm{d}x = \sqrt{\pi}
$$
```

写错了**不会让构建失败**，而是把 KaTeX 的错误信息直接渲染在页面上，方便发现和修改。

> KaTeX 的字体只在**真的渲染了公式的页面**才会被下载。
> 一篇没有公式的文章，Font 请求数是 0。

### MDX 里可以直接用的组件

| 写法 | 作用 |
| --- | --- |
| `<BilibiliVideo bvid="BV1xx411c7mD" title="说明" />` | B 站视频，`loading="lazy"` |
| `<AudioPlayer src="/uploads/bgm.mp3" title="曲名" artist="作者" />` | HTML5 音频播放器 |
| `<Callout type="tip" title="小技巧">…</Callout>` | 提示框（`info` / `tip` / `warning` / `danger`） |

它们都在 `src/mdx-components.tsx` 里全局注册，**不需要 import**。
文章内的 `h2` / `h3` 会自动获得锚点，目录（TOC）由 `src/lib/posts.ts`
里的 `extractToc()` 生成，和 `rehype-slug` 使用同一套 slug 规则。

### 标签页的 URL 是英文 slug

中文标签的地址不是 `/tags/部署`，而是 `/tags/deploy`：

| 标签 | URL |
| --- | --- |
| 部署 | `/tags/deploy` |
| 静态导出 | `/tags/static-export` |
| 内容工程 | `/tags/content-engineering` |
| Next.js | `/tags/next-js` |

原因是 Next 会拿 URL 里已编码的路径段去和 `generateStaticParams()` 的返回值匹配，
中文参数会让 dev 直接 500、或者把 `%E9%83%A8...` 写进产物目录名。
换成 ASCII 之后两边行为一致（详见 design.md 7.5）。

**新增中文标签时**，在 [src/lib/tag-slug.ts](src/lib/tag-slug.ts) 的
`TAG_SLUG_OVERRIDES` 里补一行，就能得到可读的 URL。
忘了补也不会坏，会落到 `tag-xxxx` 的兜底 slug。

> ⚠️ **站内链接请用 Markdown 语法**：
>
> | 写法 | 会自动带 `basePath` |
> | --- | :---: |
> | `[另一篇](/posts/foo)` | ✅ |
> | `<a href="/posts/foo">另一篇</a>` | ❌ |
>
> 手写的原生 `<a>` **不会**经过组件映射。子路径部署（GitHub Pages 项目页）时会 404。

---

## 本地写作（长文推荐）

网页后台适合改错别字、换封面图、发一条短随笔。**但写长文，本地更舒服** ——
`content/posts/` 下的文章就是普通的文本文件，用任何编辑器打开都行，
而且能一边写一边看**真实渲染**的效果。

### `.md` 和 `.mdx` 都能用（推荐 `.md`）

| 扩展名 | 支持情况 |
| --- | --- |
| **`.md`** | ✅ **写作工具最认这个** —— Typora、Obsidian 都原生支持 |
| `.mdx` | ✅ 一样能跑（仓库原来的文章都是这个） |

**两者走的是同一条管线**，能力完全一致：`.md` 里照样能写 `<Callout>`、
`<BilibiliVideo>`、Shiki 代码高亮和 KaTeX 公式。区别只在文件名。

所以：**想用 Typora / Obsidian 写，就把新文章存成 `.md`。**
`npm run new` 生成的是 `.mdx`；想用 `.md` 就自己把后缀改掉，或者建完直接改名（都不影响构建）。

> 为什么两个都要支持：Typora 和 Obsidian 这类工具**原生只认 `.md`**；
> 而且 Typora 在部分平台上保存时会把 `.mdx` 悄悄改名成 `.md` ——
> 以前这会让整个构建失败，现在两种后缀都收，改名也不再有影响。

### 双栏工作流

```text
┌────────────────────────┬────────────────────────┐
│  VS Code / Typora      │  浏览器                  │
│  写 content/posts/x.md  │  localhost:3000          │
│  行号关掉、中文字体      │  npm run dev 的真实渲染   │
└────────────────────────┴────────────────────────┘
```

```bash
npm run dev          # 一直开着，改完自动刷新
```

Windows 上按 `Win` + `←/→` 可以把两个窗口各占半屏，然后就这么写。

**为什么预览走浏览器而不是编辑器自带的预览**：VS Code 的 Markdown 预览
（`Ctrl+K V`）不认 MDX 组件，Typora 也会把 `<Callout>` 当普通文本显示。
而 `npm run dev` 渲染的是**和线上一模一样**的页面 —— 代码高亮、公式、卡片样式、目录全都在。

### 新建文章：`npm run new`

```bash
npm run new
# 文章标题：为什么我又换了个博客
# 文件名（直接回车用 why-new-blog）：why-new-blog
```

它会：生成 `content/posts/<文件名>.mdx` → 写好 frontmatter（日期自动填今天）→ 用 VS Code 打开。

也可以不带交互直接用：

```bash
npm run new -- "文章标题" my-slug
```

> 想让新文章是 `.md`（给 Typora / Obsidian 用），建完把后缀改掉即可 —— 两种后缀等价。

> ⚠️ **文件名必须是 ASCII**（小写字母 + 数字 + 连字符），不能用中文。
> 实测：`content/posts/中文文件名测试.mdx` 在本机访问
> `/posts/中文文件名测试/` 会 500 / 404，而 ASCII 文件名一切正常 ——
> 原因和上面「标签页用英文 slug」是同一个（Next 拿已编码的路径段去比较）。
> `npm run new` 会把中文输入直接挡掉，退回 `post-2026-10-03` 这种兜底名。
>
> 三道防线，所以它不会悄悄溜到线上：
>
> | 环节 | 行为 |
> | --- | --- |
> | `npm run new` | 挡下中文输入，退回 `post-<日期>` |
> | `npm run dev` | 终端里打一条警告（不打断其它页面） |
> | **构建 / 部署** | ⛔ **直接失败并指名文件**：`文章文件名必须是 ASCII：content/posts/未命名.md` |
>
> 用 Obsidian 的话这条特别要紧：**它新建笔记的默认名就是「未命名」**，
> 在 Obsidian 里完全看不出异常 —— 建完记得立刻改成英文名。

### 编辑器已经帮你配好了

仓库里的 [.vscode/settings.json](.vscode/settings.json) 是**面向写作**的配置，
只作用于 Markdown / MDX（不影响你编辑 TS/TSX 的习惯）：

| 设置 | 为什么 |
| --- | --- |
| 关掉行号、缩略图、空白符渲染 | 「像代码」的感觉一半来自这些 |
| md/mdx 换成中文字体、行高 30 | 不换成非等宽字体，满屏 `#` `\|` 怎么都像在看代码 |
| 每行 80 列换行 + 一条竖线标尺 | 整屏铺满的长行很难读 |
| `files.trimTrailingWhitespace: false` | ⚠️ **这条别删**：Markdown 里行尾两个空格表示换行，被自动删掉就静默改了内容 |
| 切窗口时自动保存 | 从 VS Code 切到浏览器时已经存好了，页面也刷新好了 |

不喜欢哪条就删哪条，删掉就回到 VS Code 默认值；整套不要就把那个文件删了，**不影响构建**。

[.vscode/blog.code-snippets](.vscode/blog.code-snippets) 里还有几个片段，
打前缀 + `Tab` 展开，日常写作就不用记那些「像代码」的写法了：

| 打这个 + Tab | 得到 |
| --- | --- |
| `post` | 完整的 frontmatter 骨架（日期自动填今天） |
| `callout` | 提示框 |
| `bili` | B 站视频 |
| `audio` | 音频播放器 |
| `img` | 图片语法 |
| `math` | 行间公式 |

### 插图片

**把图片文件丢进 `public/uploads/`，然后在文章里写 `![](/uploads/文件名.jpg)`。**

路径怎么写都能认 —— 下面几种等价，怎么方便怎么来（`resolveImageSrc()` 会统一规整）：

| 写法 | 结果 |
| --- | :---: |
| `/uploads/x.jpg` | ✅ |
| `public/uploads/x.jpg` | ✅ |
| `uploads/x.jpg` | ✅ |
| `public\uploads\x.jpg`（Windows 反斜杠） | ✅ |

> **上传前先压一下。** 这个项目**不做图片优化**（静态导出下 `next/image` 的优化器
> 不可用，见[为什么不做图片优化](#为什么不做图片优化)），原图多大就下发多大。
> 一张 3.6MB 的 PNG 会让手机读者等很久 —— 转成 JPEG/WebP 通常能小一个数量级。

### 发布

```bash
git add .
git commit -m "post: 文章标题"
git push
```

然后等 1–2 分钟，Cloudflare 会自动重新构建。

**不想碰命令行就用 [GitHub Desktop](https://desktop.github.com/)**：
它会列出你改动的文件，填一句说明，点 `Commit to main` 再点 `Push origin` 就完事了。

### 用 Typora / Obsidian 写

如果连 Markdown 标记都不想看见，可以用所见即所得的编辑器 —— **现在两款都能直接编辑了**：

| 软件 | 特点 | 价格 |
| --- | --- | --- |
| [Typora](https://typora.io/) | 真·所见即所得，输入时直接显示排版后的样子 | 约 $15 买断 |
| [Obsidian](https://obsidian.md/) | 可以把文章目录当作文库打开，实时预览，拖图能自动放进附件目录 | 免费 |

**两条使用要点：**

1. **文章存成 `.md`。** 这两款原生只认 `.md`，不显示 `.mdx`
   （`.mdx` 在 Obsidian 里根本不出现在文件树中）。
   仓库两种后缀都收，所以直接存 `.md` 就行。
2. **⚠️ Obsidian 的「仓库」要开在 `content/posts` 本身，不要开在它下面的某个子文件夹。**

   Obsidian 会在仓库根目录生成一个 `.obsidian/` 配置文件夹（已加进 `.gitignore`），
   而**文章目录的子文件夹不会被扫描** —— `content/posts/` 下的文章是按
   「一层文件名」收集的（`src/lib/posts.ts` 的 `listPostFiles()` 不做递归）。
   把仓库开成 `content/posts/Blog`，你在里面写的文章**一篇都不会出现在站点上**，
   而且不会报错。这是这个流程里唯一需要记住的坑。

> **Typora 的保存行为**：它在部分平台保存时会把 `.mdx` 改名成 `.md`。
> 因为这个仓库两种后缀都收，改名不会再让构建失败 —— 但文件确实会被重命名，
> `git status` 里会看到 rename。介意的话就把文章直接存成 `.md`。

---

## 界面说明

整体是一个应用外壳，对应 `image/design_image/主页.png`：

```text
┌────────────────────────────────────────────────┐
│ [隐藏]  logo              留言  主题  设置     │  ← 顶栏
├──────────┬──────────────────────┬──────────────┤
│ 可隐藏导航│        内容          │ 可隐藏留言区 │
│ （可拖拽）│                      │              │
└──────────┴──────────────────────┴──────────────┘
```

- **左侧导航**：桌面端可整体隐藏，右边缘拖拽可调宽度（220–400px），头像来自 `public/avatar.png`
- **右侧留言板**：可隐藏；访客的留言存在浏览器 `localStorage`，
  **站长发布与回复的留言会提交进仓库、对所有访客可见**（见[留言与评论怎么回复](#留言与评论怎么回复)）
- **文章头部的浏览量与点赞**：默认只统计本机，部署互动服务后是全站数字
- **文章底部评论区**：本机评论 + 站长回复；配置了 Giscus 时下面还会多一条 GitHub 通道
- **顶栏搜索**：桌面端显示成输入框，按 `⌘K` / `Ctrl+K` 随时唤起
- **主题**：浅色 / 深色，首次访问跟随系统；`<head>` 里有内联脚本防闪屏
- **壁纸**：内置预设 / 直传仓库 / 只存本机，可调强度与模糊（见下文「壁纸」一节）
- **设置**：主题、字号、壁纸、内容区宽度、导航宽度，全部持久化到本地

---

## 头像与站点信息

头像和分享图都是**仓库里的静态文件**，换图不用改代码：

| 文件 | 尺寸 | 用在哪 |
| --- | --- | --- |
| [public/avatar.png](public/avatar.png) | 512×512 | 关于页、分享图 |
| [public/avatar-128.png](public/avatar-128.png) | 128×128 | 顶栏、左侧导航（省流量） |
| [public/og-cover.png](public/og-cover.png) | 1200×630 | 社交平台分享卡片 |
| [src/app/icon.png](src/app/icon.png) | 192×192 | 浏览器图标 |
| [src/app/favicon.ico](src/app/favicon.ico) | 16/32/48/64 | 老浏览器兜底 |

**换头像**：直接替换前两个 PNG（保持文件名），重新构建即可。

**改站点名称 / 作者 / 邮箱 / 域名**：改 [src/lib/site.ts](src/lib/site.ts) 的 `SITE`，
头像路径也在那里（`avatar` / `avatarSmall` / `ogImage`）。

> 仓库名 `hua-cheng-blog` 是「花城」的拼音，不需要改；
> 改名会连带影响 GitHub 仓库地址、Cloudflare 项目绑定和 TinaCMS 的仓库配置。


---

## 音乐播放器

侧栏底部那个小面板，整份歌单共用一个 `<audio>`，切歌只换 `src`。

| 小按钮 | 作用 |
| --- | --- |
| ⟳ / ⟲¹ / ⤨ | 循环切换播放模式：**列表循环 → 单曲循环 → 随机播放** |
| ⏮ / ▶ / ⏭ | 上一首 / 播放暂停 / 下一首（随机模式下「下一首」是随机挑一首） |
| ☰ | 展开 / 收起**播放列表**，点列表里的任意一首直接播 |
| 🔊 | 静音开关 |
| 滑杆 | 音量（0–100，实时显示百分比） |

播放模式和音量都会记在浏览器里（`hc-blog:music-mode` / `hc-blog:music-volume`），刷新后保留。

### 换成自己的歌

1. 把音频文件放进 `public/uploads/`
2. 在 [src/lib/music.ts](src/lib/music.ts) 的 `defaultPlaylist` 里登记一行

```ts
export const defaultPlaylist: Track[] = [
  { id: "my-song", title: "曲名", artist: "歌手", src: uploadUrl("我的歌.mp3") },
];
```

`uploadUrl()` 会自动做 URL 编码 —— 中文文件名和空格都能正常播放，别手写 `/uploads/xxx`。

> 仓库里现在有一首 mp3（`白鲨jaws-dive back in time.mp3`）和三段用脚本生成的
> `demo-0*.wav` 占位音频。**这三段 demo 只是为了让你点开就能听到声音**，
> 不需要就删掉文件并从 `defaultPlaylist` 里移除对应条目。

---

## 站内搜索

点顶栏的搜索框，或者按 `⌘K`（Windows 用 `Ctrl+K`）打开搜索弹窗。

- 匹配范围：**标题 + 标签 + 摘要 + 正文全文**
- 打分权重：标题 > 标签 > 摘要 > 正文；标题完全相等、以关键词开头都有额外加分
- 多个关键词用空格分隔，默认要求**全部命中**（AND）
- 如果一个都没命中，会自动退化成「部分匹配」并明确提示，匹配越多排越前
- 结果里命中的词会高亮，并显示命中的上下文片段
- 键盘操作：`↑` `↓` 选择、`Enter` 打开、`Esc` 关闭

### 排序方式

出现多条结果后，结果列表上方会出现三个切换按钮：

| 排序 | 说明 |
| --- | --- |
| **相关度**（默认） | 按打分高低；分数相同时新文章靠前 |
| **时间倒序** | 最新发布在前；同一天则按相关度 |
| **时间正序** | 最早发布在前；同一天则按相关度 |

选择会记在浏览器里（`hc-blog:search-sort`），下次打开还是这个排序。

> 排序在**截断结果之前**做，所以「时间倒序」拿到的是「所有命中里最新的几条」，
> 而不是「按相关度取前 12 条再排序」。

### 它是怎么做到不用后端的

索引在**构建期**生成成一份静态 JSON：

```text
content/posts/*.md(x)
   ↓ src/lib/posts.ts 的 getSearchIndex()（去掉 Markdown 语法，保留代码内容）
   ↓ src/app/search-index.json/route.ts
out/search-index.json          ← 构建产物，6 篇约 22KB
```

浏览器只在**第一次打开搜索时**才去下载它，之后缓存在内存里，匹配全部在本地完成，
所以既不占用首屏，也没有任何请求延迟。

### 中文搜索的一点限制

中文没有空格，所以「静态导出」会作为一个整体去匹配子串 —— 这在大多数情况下够用。
但如果你输入一整个长句（比如「静态导出的五个坑」），它会被当成一个词，
可能匹配不到。**建议用较短的词，或者用空格分成几个词。**

---

## 壁纸

### 怎么用

点右上角**设置** → **壁纸**：

| 方式 | 说明 | 谁看得到 |
| --- | --- | --- |
| 内置预设 | 7 套纯 CSS 渐变/网格（水墨、蓝图、纸纹、木棉、岭南、珠江夜、暮色）+「无」 | 所有人 |
| **上传到仓库** | 提交到 `public/uploads/`，之后出现在「我的上传」里随时选用 | **所有访客** |
| 只存本机 | 压缩后存进浏览器 `localStorage`，不上传任何服务器 | 只有你自己 |
| 图片直链 | 粘贴 `https://…`、`/uploads/bg.jpg` 或 `data:image/…` | 所有人 |

还有两个滑杆：

- **壁纸强度**（0–100%）：越低遮罩越浓，把壁纸推远，保证正文可读；拉到最左等于关闭
- **模糊**（0–24px）：虚化背景，让前景更聚焦

> **提示**：有壁纸时，外壳、顶栏、左侧导航、留言区会自动变成毛玻璃
> （半透明 + `backdrop-blur`），壁纸才能真正透出来。

### 不用后端，怎么把图片传进 `public/uploads/`？

`public/uploads/` 是仓库里的目录，浏览器不能直接写服务器文件系统。
纯静态站要「上传」，只有两条真正可行的路：

1. **TinaCMS 媒体库**（项目里已经装好了）
   打开 `/admin` → Media Manager → 上传。TinaCMS 通过 TinaCloud 的 GitHub App
   授权提交文件，**不需要你手输任何 token**。适合已经在用 TinaCloud 的场景。
2. **浏览器直连 GitHub Contents API**（本项目「上传到仓库」按钮用的就是这条）
   GitHub 的 API 支持跨域直连，实测响应头是：

   ```text
   Access-Control-Allow-Origin: *
   access-control-allow-headers: Authorization, Content-Type, …
   access-control-allow-methods: GET, POST, PATCH, PUT, DELETE
   ```

   也就是说浏览器带上一个 token 就能 `PUT` 一个文件进去，**完全不需要后端**。

**第三种方式（自己的 Serverless 函数）也能做，但那就等于引入后端了**，与「纯静态、免费托管」的定位冲突。

### 配置 GitHub Token（走第 2 条路才需要）

1. 打开 GitHub → Settings → Developer settings → **Fine-grained tokens** → Generate new token
2. **Repository access** 只勾这一个博客仓库
3. **Permissions** → Repository permissions → **Contents: Read and write**（其它一律不给）
4. 复制 token，回到站点的 设置 → 壁纸 → **GitHub Token 配置**，填进去

owner / repo / branch 会自动带出默认值（从 `src/lib/site.ts` 的 `SITE.repository` 推断），不对就手动改。

**安全边界**（很重要）：

- token 只保存在**你自己的浏览器** `localStorage` 里，也只会发往 `api.github.com`
- 但它确实是一个「能往仓库写文件」的凭据 —— 一旦站点被 XSS 注入就会被读走
- 所以：**只给 Contents 读写这一项权限、只授权这一个仓库**，并且不要往站点里引入来路不明的第三方脚本
- 换设备要重新填一次；不想留了就点「清除 token」

### 上传后为什么要等 1–2 分钟

「上传到仓库」会提交一次 commit，Cloudflare Pages 检测到更新后重新构建部署，
这个过程大约 1–2 分钟。在这之前，站内的 `/uploads/xxx.jpg` 还是 404。

为了不让用户对着空白发呆，上传成功后会自动记下一个**临时地址**
（`raw.githubusercontent.com` 上的原始文件，提交完立即可用），
等探测到站内地址真正可用了，再把临时地址丢掉。所以你上传完是**马上能看到效果**的。

### 删掉不想要的壁纸

「我的上传」里每张图右上角有个小垃圾桶：可以只从列表移除，也可以**同时删除仓库里的文件**
（后者会再提交一次 commit 并触发重新部署，会有确认提示）。

### 改站点默认壁纸

访客没设置过时使用 `DEFAULT_WALLPAPER`，改 [src/lib/wallpaper.ts](src/lib/wallpaper.ts) 即可：

```ts
export const DEFAULT_WALLPAPER: WallpaperSettings = {
  source: "preset",
  presetId: "ink",   // ← 换成 "none" 就没有默认壁纸；也可填 "kapok" / "lingnan" …
  url: "",           // 也可以填 "/uploads/你上传的图.jpg" 当成全站默认壁纸
  dataUrl: "",
  strength: 100,
  blur: 0,
};
```

要加一套自己的预设，往 `WALLPAPER_PRESETS` 里追加一项就行 ——
`light` / `dark` 直接写 CSS `background-image` 的值（可以叠加多层渐变），
因为不引用外部图片，所以不会有任何网络请求。

### 为什么内置壁纸用 CSS 而不是图片

外链图床在国内经常加载不出来，一张 4K 大图还会明显拖慢首屏。
CSS 渐变是零请求、零解码成本的，用来做背景刚刚好；真需要照片时，
「上传到仓库」和「只存本机」两条路都已经留好了。

### 实现上的三个要点

**1. 壁纸层为什么是 `-z-10`**

按 CSS 的绘制顺序，`position: fixed` 且 `z-index: 0` 的元素会盖在正文上面。
所以外层容器加了 `isolate`（建立新的层叠上下文），壁纸层用负的 `-z-10`，
这样它画在「容器底色之上、其它内容之下」，既盖住底色又不压住正文。

**2. 上传前一定先压缩**

不管是传仓库还是存本机，图片都会先在浏览器里用 canvas 压到
`1920/0.82`（必要时降到 `1600/0.72`、`1280/0.62`），通常能压到 200–600KB。
不压缩的话，6MB 的原图走 base64 上传会变成 8MB 的请求体。

**3. 「我的上传」里的缩略图是另存的小图**

选择面板里每张图只有约 10–30KB 的缩略图，不是原图 ——
否则十几张 4K 壁纸的 base64 会把 `localStorage` 直接撑爆（一般只有 5MB）。

---

## 关于 Tailwind CSS 4 的配置位置

设计稿的项目结构里有一个 `tailwind.config.ts`，但 Tailwind v4
已经把主题配置搬进了 CSS 本身，所以这个项目**没有**该文件：

```css
/* src/app/globals.css */
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --color-brand-500: #e4513a;   /* 木棉红 */
  --font-sans: "PingFang SC", "Microsoft YaHei", sans-serif;
}
```

好处是主题值变成了真正的 CSS 变量，可以在开发者工具里直接看到、也能被 JS 读取。

---

## 设置存在哪

这是本项目里最需要先说清楚的一件事：**设置分两层，存的地方完全不同。**

| | 访客偏好 | 站点默认值 |
| --- | --- | --- |
| **存哪** | 浏览器 `localStorage` | 仓库的 `content/site-settings.json` |
| **谁能改** | 任何访客，但只影响自己 | 只有仓库有写权限的人 |
| **何时生效** | 打开页面后（hydration 之后） | **构建期注入 HTML，首屏就是对的** |
| **换设备** | 没了，回到站点默认值 | 跟着仓库走，永远在 |
| **包含** | 主题、字号、内容区宽度、侧栏宽/开合、留言区开合、壁纸、播放模式、音量 | 同一套字段的**默认值** |

### 为什么访客偏好不能存仓库

技术上做得到（和「壁纸上传」用的是同一个 GitHub API），但**不该做**：

1. **commit 风暴** —— 每个访客切一次主题就产生一次提交，还会触发一次重新部署
2. **权限问题** —— 要让访客能写，就得把仓库写权限发给所有人，这显然不行
3. **写冲突** —— 并发修改需要比对 `sha`，两个人同时改就会 409

所以正确的切法是：**访客偏好留在本地，站点默认值放进仓库。** 后者才是「设置每次都能保存」真正想要的东西。

### 站点默认值怎么用

**方式一：直接改文件**（最简单）

编辑 [content/site-settings.json](content/site-settings.json)：

```json
{
  "theme": "dark",          // system | light | dark
  "fontScale": "lg",        // sm | md | lg
  "contentWidth": "wide",   // comfortable | wide
  "sidebarOpen": true,
  "sidebarWidth": 300,      // 220–400
  "messageOpen": false,
  "wallpaper": {
    "source": "preset",     // preset | url | upload
    "presetId": "kapok",    // ink | grid | paper | kapok | lingnan | pearl | dusk | none
    "url": "",
    "dataUrl": "",
    "strength": 100,
    "blur": 0
  },
  "giscus": null,
  "interactions": {
    "provider": "local",    // local = 只统计本机；remote = 调用下面的互动服务
    "apiBase": ""           // provider 为 remote 时填，例如 https://hc-blog-api.xxx.workers.dev
  }
}
```

push 之后 Cloudflare 重新构建，对所有访客生效。

**方式二：在前台保存**

设置 → **站点默认值** → 「保存为站点默认」。它会把这组设置通过 GitHub API 写进
`content/site-settings.json`，同样需要 GitHub Token。按钮上方会提示
「当前设置和站点默认值有哪些不同」。

> 想用**上传到仓库的壁纸**当全站默认：把 `wallpaper.url` 填成 `/uploads/你的图.jpg`、
> `source` 改成 `"url"` 即可。

**恢复**：设置抽屉底部的「恢复站点默认值」会清掉本机偏好，回到仓库里的那一套。

### 健壮性

`content/site-settings.json` 是**逐字段校验**的，不是整体信任或整体丢弃：

| 情况 | 行为 |
| --- | --- |
| 文件不存在 | 用代码里的默认值 |
| 不是合法 JSON | 控制台警告 + 用默认值，**构建不会失败** |
| 只写了部分字段 | 写了的生效，没写的用默认值 |
| 某个字段类型不对 | 只有那个字段回退到默认值 |
| 文件带 UTF-8 BOM | 自动去掉后再解析（记事本保存常常会带 BOM） |

> BOM 这一条是实测踩出来的：`JSON.parse` 遇到 `\uFEFF` 会**直接抛错**，
> 不处理的话整份设置会被静默忽略，而你在界面上完全看不出来。

---

## 互动：浏览量 · 点赞 · 评论区

### 文章页上会出现什么

| 位置 | 内容 |
| --- | --- |
| 文章头部 | `123 次浏览` + 一个心形点赞按钮（点一下变红，再点取消） |
| 文章底部 | 评论区：条数、输入框、评论列表、站长回复 |
| 文章列表卡片 | 与统计无关，只显示封面图 / 正文缩略图（见[缩略框配图](#列表页那张卡片缩略框上会显示什么图)） |

### 两种数字来源

浏览量、点赞、评论都属于「需要有人记住」的数据，而静态站点没有服务端。
所以这里有两档，由 `content/site-settings.json` 的 `interactions` 决定：

| | `provider: "local"`（默认） | `provider: "remote"` |
| --- | --- | --- |
| 数据存在哪 | 访客自己的浏览器 `localStorage` | Cloudflare Worker 的 KV（**所有人的数据在一起**） |
| 浏览 / 点赞数字 | 只是这台电脑的记录 | **全站真实数字** |
| 访客的评论 | 只有自己看得见 | 所有访客都看得见 |
| 需要部署什么 | 什么都不用 | 部署一次 `workers/blog-api`（见下） |
| 界面上怎么标注 | 数字后面写「（本机）」 | 不标注，鼠标悬停显示「全站计数」 |

**默认是 `local`**：不部署任何东西也能用，并且站点一个第三方请求都不发。
远程服务连不上时（没部署、断网、被拦截）会自动退化成本机模式，不会白屏。

### 为什么不直接用一个现成的第三方计数器

因为「免费的公众计数器」几乎全是个人在维护，而这正是最容易消失的一类服务：

| 方案 | 现在还能用吗 |
| --- | --- |
| 不蒜子（busuanzi） | ❌ 原站已经整站 502，大量博客的阅读量一起挂掉 |
| CountAPI | ❌ 已停止服务 |
| Google Analytics / Microsoft Clarity / Cloudflare Web Analytics | ⚠️ 服务本身很稳，但**都要求用带密钥的服务端接口去读数字**。把密钥放进纯静态页面等于公开它；GA 一类在国内还访问不了 |
| Firebase（Google） | ⚠️ 厂商够稳，但国内直连不稳定，与「国内访问快」冲突 |
| **自己的一小段代码跑在大厂 serverless 上** | ✅ 这就是本项目选的方案 |

结论：**能同时满足「免费、不会倒闭、国内可访问、不需要常驻服务器」的只有一条路 ——
把几十行代码部署到你已经用着的 Cloudflare 上。** 厂商（Cloudflare）不会倒，
代码和数据都在你自己的账号里，最坏情况下也只是自己重新部署一次。
源码就在 [`workers/blog-api/`](workers/blog-api/)，独立部署、与博客构建互不影响。

### 部署统计后端（一次性，约 5 分钟）

```bash
npm install -g wrangler
wrangler login

cd workers/blog-api
wrangler kv namespace create BLOG_KV
# 输出里有 [[kv_namespaces]] binding/id 两行，把它取消注释并填进 wrangler.toml
wrangler deploy
```

部署完会得到一个地址，例如 `https://hc-blog-api.你的子域.workers.dev`。
把它写进 [content/site-settings.json](content/site-settings.json)：

```json
"interactions": {
  "provider": "remote",
  "apiBase": "https://hc-blog-api.你的子域.workers.dev"
}
```

push 之后重新构建，浏览量、点赞、评论就都是全站的了（刷新页面就能看到，不必等构建）。

细节都写在 [workers/blog-api/README.md](workers/blog-api/README.md) 里，包括：

- 免费额度（Workers 10 万请求/天、KV 读 10 万/天 + 写 1000/天）
- 站长身份怎么校验（用你写文章那一个 GitHub Token）
- **KV 没有事务**：同一瞬间的并发写会互相覆盖，计数可能少量丢失。
  对个人博客完全够用，但它不是精确的计数系统，这里如实说明
- `/hit` 没有做防刷：浏览量可以被脚本刷。要防就得引入验证码或更复杂的限流，
  对个人博客不划算

### 把自己的域名限制进 CORS（可选）

Worker 默认 `ALLOWED_ORIGIN = "*"`，也就是任何网站都能调它。
想收紧就把 [workers/blog-api/wrangler.toml](workers/blog-api/wrangler.toml) 里的
`ALLOWED_ORIGIN` 改成你的域名，再 `wrangler deploy` 一次。
（改完之后，本地 `npm run dev` 的 `localhost:3000` 会被 CORS 挡掉，需要临时改回来。）

---

## 留言与评论怎么回复

先直接回答三个最常问的问题。

### 一、现在这个博客是不是只有仓库主人能写？

| 动作 | 需要什么凭据 | 现在谁能做 |
| --- | --- | :---: |
| 写 / 改文章 | TinaCMS（走 TinaCloud 的 GitHub App 授权）或仓库写权限 | **只有仓库主人** |
| 上传图片、保存站点默认值 | GitHub fine-grained token | **只有仓库主人** |
| 发表留言 / 评论 | 什么都不用 | **任何访客**（默认只存在他自己浏览器里） |
| **回复**留言 / 评论 | GitHub token 或部署互动服务 | **只有仓库主人** |
| 用 GitHub 账号公开评论（Giscus） | GitHub 账号 | 任何有 GitHub 账号的人（**默认没启用**） |

所以：**文章确实只有仓库主人写得了。**
仓库里已经内置了 Giscus 的接入代码，但
[content/site-settings.json](content/site-settings.json) 里 `giscus` 是 `null`，
**所以文章底部默认不会渲染任何 Giscus 评论区**；一旦按下面配置好，任何有
GitHub 账号的人都能评论 —— 那时就**不是**只有主人能写了。

### 二、访客的留言 / 评论，站长怎么回？

回复入口只在**站长模式**下出现。判定站长的方式很朴素：
**本机浏览器里存着能写仓库的 GitHub Token**，那它就是站长 ——
和写文章、传图片用的是同一个凭据，不需要再发明一套登录系统。

**操作步骤（3 步）**

1. 打开右上角 **设置 → 展开「GitHub Token 配置」**，填入 fine-grained token
   （只授权这一个仓库、只给 `Contents: Read and write`，见
   [配置 GitHub Token](#配置-github-token走第-2-条路才需要)）
2. 到留言板或文章底部的评论区，每条留言右下角会出现 **「回复」** 按钮；
   点开写内容、点「发布回复」
3. 等 1–2 分钟重新构建完成，**所有访客**都能看到这条回复

回复写到哪儿，取决于 `interactions.provider`：

| provider | 回复存到哪 | 谁看得见 | 生效时间 |
| --- | --- | --- | --- |
| `"remote"`（部署了互动服务） | Worker 的 KV | 所有人 | **立即**（评论本身也是全站可见的） |
| `"local"`（默认） | 提交进仓库的 `content/comments.json` / `guestbook.json` | 所有人 | 重新构建后（约 1–2 分钟） |

两条路上的**权限都是服务端强制的**，不是「把按钮藏起来」：

- 写仓库文件本来就必须有仓库写权限，没有 token 根本提交不上去
- 互动服务会拿 token 去问 GitHub「这个 token 对这个仓库有 push 权限吗」，
  不是站长就返回 `403 只有站长可以回复或删除评论`，且**一个字节都不写**

### 三、访客的评论存在哪里？站长看不到怎么办

这是纯静态站最需要说清楚的一条边界：

| provider | 访客的评论 | 站长能不能看到 |
| --- | --- | :---: |
| `"local"` | 只写进访客自己的 `localStorage` | ❌ **看不到**，所以也就回不了 |
| `"remote"` | 写进互动服务的 KV | ✅ 能看到、能回复 |

纯静态站没有「收件箱」——**访客提交的内容没有任何通道能被站长收到**。
想让「访客评论 → 站长回复」真正闭环，只有三条路：

1. **部署互动服务**（推荐）：访客发完所有人立刻可见，站长在页面上直接回复
2. **配置 Giscus**：访客用 GitHub 账号评论，站长在仓库的 Discussions 里回复。
   这是 GitHub 原生功能，评论下方自带 Reply。
   配置见 [推荐方案：Giscus](#推荐方案giscus)
3. **走邮件**：留言板里就是这么提示访客的 —— 想做真正的交流就发邮件

### 四、留言板和文章评论区有什么区别

两者共用同一套逻辑与权限模型（`useCommentThread` + `CommentThreadView`），
只是位置和数据文件不同：

| | 右侧留言板 | 文章底部评论区 |
| --- | --- | --- |
| 面向 | 站点整体的一句话 | 某一篇文章的讨论 |
| 公开留言存到 | `content/guestbook.json` | `content/comments.json` |
| 互动服务里的 path | `guestbook` | 文章 slug |
| 面板里的「清空本机留言」 | 只删**你自己浏览器**里的，**不会**动仓库里站长发布的那些 | 同左 |

### 五、公开留言 / 评论文件长什么样

两个文件都是「手改也安全」的：字段类型不对的那一条会被丢掉并打一行警告，
**不会让构建失败**（和 `site-settings.json` 一样是逐条/逐字段校验）。

```jsonc
// content/guestbook.json
{
  "$comment": "留言板的公开留言。只有站长能写这个文件……",
  "updatedAt": "2026-10-03T01:00:00.000Z",
  "messages": [
    {
      "id": "seed-2",
      "author": "小林",
      "content": "请问 MDX 里嵌入 B 站视频会不会拖慢首屏？",
      "createdAt": "2026-10-02T09:12:00.000Z",
      "likes": 1,
      "reply": "不会。iframe 用了 loading=\"lazy\"，滚到位置才会加载。",
      "replyAt": "2026-10-02T11:40:00.000Z"
    }
  ]
}
```

```jsonc
// content/comments.json
{
  "$comment": "每篇文章的公开评论与站长回复，按 slug 分组……",
  "updatedAt": "2026-10-03T01:00:00.000Z",
  "posts": {
    "hello-world": [
      { "id": "…", "author": "阿城", "content": "写得好", "createdAt": "…", "likes": 0 }
    ]
  }
}
```

| 字段 | 说明 |
| --- | --- |
| `id` | 唯一标识；**前后端用同一个 id 去重**，所以站长回复后不会出现两条 |
| `author` / `content` / `createdAt` | 展示用；`createdAt` 由服务端覆盖成服务器时间 |
| `likes` | 仓库里的基线（互动服务模式下由 KV 记） |
| `reply` / `replyAt` | **站长回复**，只有站长能写 |
| `owner: true` | 这条是站长自己发的（留言板里会带一个「站长」徽标） |

> 评论里的那个心形按钮**只记在本机**：它属于「顺手点一下」的交互，
> 为它单独走一次后端请求不划算。点赞文章的那个才是全站计数。

---

## 评论系统

> 这一节讲的是 **Giscus 这条通道**的细节。
> 三条评论通道的分工、权限与回复方式，见上面的
> [互动](#互动浏览量--点赞--评论区) 与 [留言与评论怎么回复](#留言与评论怎么回复)。

### 现状：三个位置，三种东西

| 位置 | 是什么 | 谁能看到 | 谁能回复 |
| --- | --- | --- | --- |
| 文章底部（本机） | 访客自己浏览器里的评论 | 只有评论者自己 | —（站长看不到，所以回不了） |
| 文章底部 / 留言板（互动服务） | 部署了 `workers/blog-api` 之后的全站评论 | 所有人 | **只有站长** |
| 文章底部（Giscus） | GitHub Discussions，**默认没启用** | 所有访客，需要 GitHub 账号 | 站长在 Discussions 里回复 |
| 右侧留言板（仓库） | 站长发布的公开留言 | 所有人 | **只有站长** |

几条通道互不干扰，可以同时存在。没配 Giscus 时，文章底部不会渲染 Giscus 区块。

### 推荐方案：Giscus

先说结论：**这个项目用 Giscus 最合适**，因为它是少数能同时满足「免费」和「长久」的方案。

| 方案 | 免费 | 长久性 | 需要后端 | 需要登录 | 数据归属 |
| --- | :---: | --- | :---: | :---: | --- |
| **Giscus**（GitHub Discussions） | ✅ 永远 | ✅ 依附 GitHub | ❌ | GitHub 账号 | **你自己的仓库** |
| Utterances（GitHub Issues） | ✅ | ✅ | ❌ | GitHub 账号 | 自己的仓库 |
| Waline / Twikoo / Artalk | ✅ 有免费额度 | ⚠️ 取决于托管方 | ✅ 要部署 | 可匿名 | 自己的数据库 |
| Disqus | ⚠️ 免费版有广告 | ⚠️ 商业公司说了算 | ❌ | 可选 | **对方的** |
| 自建（Workers + D1） | ✅ 有免费额度 | ✅ 靠自己维护 | ✅ | 自己实现 | 自己的 |

为什么推荐 Giscus：

- **不会过期** —— 它只是 GitHub Discussions 的一个前端，没有自己的服务器要养，
  不存在「免费额度用完」这回事
- **数据是你的** —— 评论就是仓库里的 Discussions，随时能导出、迁移、备份
- **零维护** —— 不用管数据库、不用管反垃圾、不用管证书
- **客户端渲染** —— iframe 懒加载，不影响静态导出的首屏

代价也说清楚：**评论者需要有 GitHub 账号**。对技术博客通常不是问题；
但如果读者大多没有 GitHub 账号，就得选 Waline 那一类（要自己部署，但可匿名）。

### 关于「用户评论后直接提交到你的仓库」

这个思路本质上**就是 Giscus 在做的事**（Discussions 就在你的仓库里），
但自己直接实现有几个绕不过去的坎：

| 做法 | 问题 |
| --- | --- |
| 浏览器直连 GitHub API 写评论 | 得把**仓库写权限的 token 发给每个访客**，等于公开写权限 |
| 访客提 PR / Issue，你审批 | 每条评论都要手动合并，很快就不想管了 |
| 自己写后端代理 | 那就不是纯静态站了，要养一个服务 |

Giscus 之所以没这些问题，是因为它走的是 **GitHub OAuth App**：
访客用自己的 GitHub 身份授权，**由 GitHub 鉴权**，评论以访客的名义写进 Discussions。
**不需要你审批，也不需要你交出任何凭据。**

### 怎么接入（约 5 分钟）

1. 仓库必须是 **public**，并开启 **Discussions**：
   仓库 Settings → General → Features → 勾上 Discussions
2. 新建一个分类（比如 `Announcements`），或使用现成的
3. 打开 <https://giscus.app/zh-CN>，填入仓库名，它会生成配置
4. 把生成的两段 ID 抄进 `content/site-settings.json` 的 `giscus` 字段：

```json
"giscus": {
  "repo": "你的用户名/仓库名",
  "repoId": "R_kgDOxxxxxxx",
  "category": "Announcements",
  "categoryId": "DIC_kwDOxxxxxxx",
  "mapping": "pathname",
  "reactionsEnabled": true,
  "inputPosition": "bottom",
  "lang": "zh-CN"
}
```

5. 安装 Giscus App：<https://github.com/apps/giscus> → Install → 选择这个仓库
6. push，等重新构建完成，文章底部就会出现评论区

> `mapping` 决定「哪篇文章对应哪个 discussion」，默认 `pathname` 够用。
> 但文章 URL 变了会对应不上——旧评论还在，只是挂到了新的 discussion 下。

### 主题同步

评论区自动跟随站点的深色/浅色：切主题时通过 `postMessage` 通知 iframe 换配色，
不会整块重新加载。

---

## 部署

本项目的产物是一整个 `out/` 目录，**任何能托管静态文件的地方都能跑**。
下面按推荐程度排序，选一个就行，不用全做。

先说共同的三件事：

```bash
npm run build          # 产物在 out/
npx serve out          # 本地预览一下产物（或者 python -m http.server -d out 8080）
```

`next.config.ts` 里开了 `trailingSlash`，所以路由长这样：

```text
out/
├── index.html                    →  /
├── 404.html
├── posts/
│   ├── index.html                →  /posts/
│   └── hello-world/index.html    →  /posts/hello-world/
├── tags/…
├── rss.xml
└── _next/static/…                带内容哈希的 JS/CSS
```

> 因为每个路由都有独立的 `index.html`，**所有平台都不需要写 rewrite 规则**。
> 这是当初选 `trailingSlash: true` 的主要理由。

### 方案一：Cloudflare Pages（推荐）

免费的全球 CDN，国内访问实测比 Vercel 稳；和 GitHub 打通后 `git push` 就自动发布。

**1. 先把仓库推到 GitHub**

```bash
git init
git add .
git commit -m "feat: 初始化博客"
git branch -M main
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

**2. 在 Cloudflare 建 Pages 项目**

Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** →
**Connect to Git** → 选中刚推上去的仓库。

**3. 填构建配置**

| 字段 | 值 |
| --- | --- |
| Framework preset | `Next.js (Static HTML Export)`，或直接选 `None` |
| Build command | `npm run build` |
| Build output directory | `out` |
| Root directory | 留空（仓库根就是项目根） |

**4. 加环境变量**（Settings → Environment variables）

| 变量 | 值 | 必需 |
| --- | --- | :---: |
| `NODE_VERSION` | `22` | ✅ |
| `NEXT_PUBLIC_TINA_CLIENT_ID` | TinaCloud 项目 ID（公开信息） | 要用后台就填 |
| `TINA_TOKEN` | TinaCloud **只读** token（Read Only） | 要用后台就填 |

> 没配 TinaCloud 时，`npm run build` 会在 `tinacms build` 那一步停下。
> 这时把 Build command 改成 `npm run build:app` 就能先把前台发出去，
> 后台以后随时可以补。

**5. 保存并等第一次构建**

大约 1～2 分钟。成功后 Cloudflare 会给你一个 `xxx.pages.dev` 的地址。

**6. 自定义域名（可选）**

Pages 项目 → **Custom domains** → 添加你的域名 → 按提示去 DNS 加一条 `CNAME`。
CF 托管的域名会自动配好证书；域名不在 CF 的话，先把 NS 转过来最省事。

**缓存策略已经内置**：[public/_headers](public/_headers) 会被复制进 `out/`，
Cloudflare Pages 会自动读取它（这个文件本身不会被当成静态资源下发）：
`_next/static/*` 永久缓存、`/uploads/*` 缓存一天、`/rss.xml` 带正确的 MIME 并交给 ETag 校验，
其余请求加上几条基础安全头。

> 注意 Cloudflare 的规则语义：**一个请求匹配多条规则时，同名 Header 是用逗号拼接的**，
> 不是后者覆盖前者。所以 `_headers` 里每类资源只允许命中一条含 `Cache-Control` 的规则，
> 否则会出现 `max-age=0, max-age=31536000` 这种自相矛盾的值。

### 方案二：GitHub Pages

适合「只想用 GitHub 一家」的场景。**注意项目页会部署在子路径下**
（`https://<用户名>.github.io/<仓库名>/`），所以要额外设 `basePath`。

**1. 把 Pages 的 Source 改成 GitHub Actions**

仓库 Settings → Pages → Build and deployment → Source → **GitHub Actions**。

**2. 关于 `.nojekyll`**

仓库里的 [public/.nojekyll](public/.nojekyll) 会被复制进 `out/`，先留着，原因分两种情况：

- **用本节的 Actions 流程部署**：GitHub Pages 直接发布上传的产物，**不会跑 Jekyll**，
  所以严格来说不需要这个文件。而且 `actions/upload-pages-artifact@v3` 是把整个目录
  `tar` 成单个文件再上传的，隐藏文件也不会丢。
- **改用「Deploy from a branch」（比如把 `out/` 提交到 `gh-pages` 分支）**：这时 Jekyll
  会介入，而它会**跳过所有以 `_` 开头的目录**，也就是 `_next/`——页面会因为拿不到
  CSS/JS 而裸奔。`.nojekyll` 就是用来关掉 Jekyll 的，这也是各种 CI 模板都会带上它的原因。

两种方式都留着它，最省心。

**3. 新建 `.github/workflows/deploy.yml`**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      # 关键：子路径。仓库名是 hua-cheng-blog 就填 /hua-cheng-blog
      - run: npm run build:app
        env:
          NEXT_PUBLIC_BASE_PATH: /${{ github.event.repository.name }}
          NEXT_TELEMETRY_DISABLED: "1"

      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: out

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

> 这里刻意用 `build:app` 而不是 `build`：它只导出前台，不重新生成 `public/admin`，
> 所以部署出去的站点上没有 `/admin` 编辑器，也就不必把**读写权限的 token** 交给 CI。
> 日常写作在本地 `npm run dev` 就够了。
>
> 如果你确实想在 GitHub Pages 上也能在线写作，把这一步换成 `npm run build`，
> 并在 workflow 里补上 `NEXT_PUBLIC_TINA_CLIENT_ID` 和 `TINA_TOKEN` 两个 secret
> （注意 `public/admin` 默认在 `.gitignore` 里，是每次构建现生成的）。

**3. 推上去**

之后每次 `git push` 都会自动重新部署。

> 用了 `basePath` 时，`/admin` 后台的跳转地址不会带上前缀。
> 如果你确实要在子路径下用后台，记得同步调整 `tina/config.ts` 里 `ui.router` 的返回值。

### 方案三：Vercel / Netlify

两个平台都能识别 `output: "export"`，基本是零配置。

| 平台 | Build command | Output directory |
| --- | --- | --- |
| Vercel | `npm run build` | `out`（框架预设选 Next.js 会自动识别） |
| Netlify | `npm run build` | `out` |

环境变量和方案一完全一样。Netlify 还可以把 [public/_headers](public/_headers) 直接复用
（两家平台用的是同一套语法），本项目目前不需要 `_redirects`。

### 方案四：自己的服务器（Nginx）

适合想要完全掌控、或者要针对国内做特别优化的场景。把 `out/` 传到服务器即可：

```bash
npm run build
rsync -avz --delete out/ user@your-server:/var/www/hua-cheng-blog/
```

服务器上的 Nginx：

```nginx
server {
    listen 443 ssl http2;
    server_name blog.example.com;

    root /var/www/hua-cheng-blog;
    index index.html;

    location /_next/static/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
        access_log off;
        try_files $uri =404;
    }

    location / {
        try_files $uri $uri/ $uri.html =404;
    }

    error_page 404 /404.html;

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml application/rss+xml;
}
```

仓库里的 [nginx.conf](nginx.conf) 是同一份配置的完整版（多了 gzip 细项、安全头、日志控制），
可以直接用。

### 方案五：Docker

仓库里带了多阶段构建的 [Dockerfile](Dockerfile)：Node 里做静态导出，再用 Nginx 兜住。

```bash
# 只发布前台（不需要任何凭据）
docker build -t hua-cheng-blog .
docker run -d --name blog -p 8080:80 --restart unless-stopped hua-cheng-blog

# 连 TinaCMS 后台一起打进去
docker build \
  --build-arg NEXT_PUBLIC_TINA_CLIENT_ID=xxx \
  --build-arg TINA_TOKEN=xxx \
  -t hua-cheng-blog .
```

`docker build` 会自动判断：有 TinaCloud 凭据就跑 `npm run build`，
没有就跑 `npm run build:app`，所以任何环境都不会因为缺 token 而失败。

配合 Nginx Proxy Manager 或 Caddy 加 HTTPS 即可。

### 配好 TinaCMS 后台（想在线写作才需要）

上面所有方案里，「前台」是纯静态的，谁都能部署。
但**在网页后台写文章**这一步依赖 TinaCloud，需要额外配置一次：

1. 用 GitHub 账号登录 <https://app.tina.io>
2. 创建项目，关联这个博客仓库，分支填 `main`
3. 项目里能拿到两样东西，分别在两个选项卡：
   - **Client ID**（「概述 / Overview」选项卡）→ 填给 `NEXT_PUBLIC_TINA_CLIENT_ID`，
     它本来就是公开的，写进前端也没关系
   - **Read Only Token**（「令牌 / Tokens」选项卡，新建时选 **Read Only**）→ 填给 `TINA_TOKEN`
4. 建 token 时把 **Git 分支**填成 `main` —— 那是「这个 token 能读哪些分支」的白名单
5. 本地写进 `.env.local`；线上写进部署平台的环境变量
6. 重新部署，然后访问 `https://<你的域名>/admin/index.html`

**为什么「只读」token 就够**（这一节曾经写成「读写 token」，2026-10 按官方文档更正）：

- **写权限不来自这个 token**，而是你在 `/admin` 里**用 TinaCloud 账号登录**后拿到的会话。
  保存文章走的是那个登录态，跟静态 token 无关。所以 TinaCloud 的令牌选项里
  本来就没有「读写」这一项，只有 **Read Only** 和 **Search** 两种。
- **Search token 是另一回事**，它只服务于 TinaCMS 内置的内容搜索
  （配置项 `search.tina.indexerToken`）。本仓库**没有启用**它 ——
  `tina/config.ts` 里没有 `search` 字段，站内搜索是自建的 `search-index.json`
  （见 [站内搜索](#站内搜索)），所以不需要建 search token。

来源：[使用 TinaCloud 进行生产部署](https://tina.io/zh/docs/tinacloud/overview)、
[Configuring TinaCloud](https://tina.io/tinadocs/docs/going-live/tinacloud/configuring-tinacloud)、
[只读令牌说明](https://tina.io/zh/blog/read-only-tokens-content-anytime)。

> `TINA_TOKEN` 是敏感信息，不要提交到仓库。
> [.gitignore](.gitignore) 已经忽略了除 `.env.example` 之外的所有 `.env*` 文件。

### 部署后自查清单

| 检查 | 期望 |
| --- | --- |
| 首页 | 正常渲染，样式没丢 |
| 随便点进一篇文章 | 目录能跳转、上下篇正常、代码块有样式 |
| 刷新文章页 | 直接访问不 404（`trailingSlash` 生效） |
| 访问 `/rss.xml` | 返回 XML，浏览器不下载而是直接显示 |
| 访问 `/search-index.json` | 返回 JSON，`count` 等于线上文章数（不含草稿） |
| 改一下 `content/site-settings.json` 再构建 | 首屏的主题/字号/壁纸跟着变（说明站点默认值生效） |
| 桌面端点留言区的 × | 面板收起（**曾经失效，已修**） |
| 留言板能看到 3 条公开留言 | 其中一条带「站长」徽标、一条带站长回复 |
| 打开一篇文章 | 头部有「— 次浏览」占位，底部有评论区与输入框 |
| 刷新文章页几次 | 浏览量会涨；点一下心形会变红并 +1（默认模式下标题写的「（本机）」） |
| 配好 GitHub Token 后打开一篇文章 | 每条评论右下角出现「回复」按钮 |
| 有 `cover` 的文章 | 列表页那张卡片是图片背景，文章页顶部也有大图 |
| 正文里有图的文章 | 列表页卡片底部有一条缩略图带 |
| 按 `⌘K` / `Ctrl+K` | 搜索弹窗打开，输入关键词能出结果 |
| 侧栏音乐播放器 | 点播放能出声；切换三种模式图标会变；展开播放列表能点选 |
| 访问一个不存在的地址 | 显示自定义 404 |
| 切深色模式并刷新 | 不闪白屏 |
| `view-source` 看 `<head>` | 有 `hc-blog:theme` 那段内联脚本 |
| 手机打开 | 侧栏和留言区变成抽屉，能正常开关 |
| 想要后台的话 | `/admin/index.html` 能打开编辑器 |
| 想要上传壁纸的话 | 设置 → 壁纸 → 填好 token 后「上传到仓库」能成功 |

### 常见部署问题

**CSS/JS 全部 404，页面是裸的**
最常见于 GitHub Pages：忘了 `.nojekyll`，Jekyll 把 `_next/` 删了。
其次是项目页忘了设 `NEXT_PUBLIC_BASE_PATH`。

**构建报 `Missing clientId, token`**
`tinacms build` 找不到 TinaCloud 凭据。要么补齐环境变量，要么把构建命令换成
`npm run build:app`。

**构建报 `Failed to write to output file: … config.build.jsx: Access is denied`**
Windows 本地出现的概率较高，原因和绕法见下面的「疑难排查」。
线上（Linux）一般不会遇到。

**图片/音频不显示**
`public/` 下新增的资源要重新构建才会进入 `out/`；`public/uploads/` 里的文件
记得一起提交到仓库。

**改了文章但线上没更新**
确认改动已经 push 到 Cloudflare Pages 监听的那个分支，再去项目的
**Deployments** 页面看最近一次构建是否真的跑了。

**搜索一直提示「索引加载失败」**
多半是子路径部署但没设 `NEXT_PUBLIC_BASE_PATH`。
搜索索引的地址是 `withBasePath("/search-index.json")`，
如果构建时漏了这个变量，浏览器就会去错的路径拿。

**壁纸上传报 403 / 权限不足**
GitHub token 的权限不对。必须是 **fine-grained token**，
Repository access 勾中这一个仓库，Permissions 里给 **Contents: Read and write**。
classic token 的 `repo` 全量权限虽然也能用，但不建议。

**壁纸上传成功了，但站点上看不到**
正常现象，等 1–2 分钟让 Cloudflare 重新构建完。这期间界面会自动用
GitHub 原始地址顶着显示，所以不会白屏。

**改了 `content/site-settings.json` 但站点没变**
依次检查：① 是否 push 并等构建跑完；② 构建日志里有没有
`[site-settings] … 解析失败，已回退到默认设置`；
③ 你自己的浏览器是不是存过访客偏好 —— 那会覆盖站点默认值，
点设置里的「恢复站点默认值」清掉即可。

**「保存为站点默认」报 404 / 403**
404 通常是 owner / repo / branch 填错，或者 token 没有授权这个仓库；
403 是权限不足，需要 `Contents: Read and write`。

**文章底部没有 Giscus 评论区**
Giscus 需要 `content/site-settings.json` 里 `giscus` 配置完整
（`repo` / `repoId` / `category` / `categoryId` 四个都不能少），
并且仓库开启了 Discussions、装过 Giscus App。
**注意这是刻意默认关闭的** —— 顶部那个评论区（本机 / 互动服务）不受它影响。

**浏览量一直显示「（本机）」**
说明 `interactions.provider` 还是 `"local"`。想变成全站数字，
部署 `workers/blog-api` 后把 `provider` 改成 `"remote"`、填上 `apiBase`，见
[部署统计后端](#部署统计后端一次性约-5-分钟)。

**配了 `apiBase` 但数字没变，控制台一堆 CORS 报错**
三个地方按顺序查：① `apiBase` 结尾有没有多余的 `/`（代码会容错，但值得看一眼）；
② `wrangler.toml` 里的 `ALLOWED_ORIGIN` 是不是被改成了某个域名，
导致你当前的域名不在白名单里；③ 浏览器控制台里那条请求的实际状态码 ——
`500 服务端异常` 通常意味着 KV 绑定没配好（`wrangler.toml` 里那段是注释状态）。

**点赞了刷新就没了**
默认 `local` 模式下点赞本来就只有本机（而且"取消点赞"会把数字减回去）；
`remote` 模式下如果刷新后丢，多半是 KV 写入失败或请求被 CORS 挡了，
看控制台里 `/like` 的响应。

**站长回复提交成功了，但页面上还是旧样子**
正常现象。`provider: "local"` 时回复是**提交进仓库**的，
要等 Cloudflare 重新构建（约 1–2 分钟）才会出现在所有人的页面上；
你本机会先看到一条带「待构建」标记的临时版本。
想立刻生效就部署互动服务，回复会直接写进 KV。

**点「回复」没反应 / 提示「只有站长可以回复或删除评论」**
说明当前浏览器里的 GitHub Token 不对。互动服务会拿这个 token 去问 GitHub
「你对这个仓库有 push 权限吗」，用的是仓库详情接口的 `permissions.push`。
检查：token 是不是 **fine-grained**、有没有勾中这一个仓库、
有没有给 `Contents: Read and write`。

**列表页卡片的缩略图 404，但点进文章图是好的**
两者的地址由同一个 `resolveImageSrc()` 生成，理论上不会不一致。
真出现的话先确认图片确实提交到了 `public/uploads/`（`git status` 看一眼），
再确认子路径部署时 `NEXT_PUBLIC_BASE_PATH` 是构建时设的而不是运行时设的。

**`cover` 填了但卡片上没变化**
`cover` 要写在 frontmatter 里（不是正文里），值必须是站内绝对路径
（`/uploads/x.jpg`）或 http(s) 外链；`data:` 内联图片会被忽略。
另外**有封面的卡片不会再显示正文缩略图带**，这是有意的。

---

## 疑难排查

### `Failed to write to output file: ... config.build.jsx: Access is denied`

完整报错长这样：

```text
🦙 TinaCMS Dev Server is initializing...

Build failed with 1 error:
error: Failed to write to output file:
  open C:\Users\<你>\AppData\Local\Temp\<时间戳>\config.build.jsx: Access is denied.

Unable to start dev server, please fix your Tina config ...
```

**原因**：TinaCMS 会先用 esbuild 把 `tina/config.ts` 编译成一个临时模块，
输出路径写死为 `os.tmpdir()/<时间戳>/config.build.jsx`。
在某些 Windows 环境里（杀毒软件、Windows Defender 受控文件夹访问、企业策略、
受限的临时目录 ACL），esbuild 这个原生二进制**没有权限写系统 `%TEMP%`**——
但同一个目录用 Node 自己的 `fs` 却能写进去，所以这不是 Tina 配置或项目代码的问题。

**项目已经内置了绕法**：`package.json` 里的 `dev` / `build` 不再直接调用 `tinacms`，
而是先经过 [scripts/tina.mjs](scripts/tina.mjs)。这个启动器把 `TEMP` / `TMP` / `TMPDIR`
指向项目内的 `.tina-tmp/`（已加入 `.gitignore`），esbuild 就写在工作区内，问题消失，
同时构建过程也变得自包含，不再污染系统临时目录。

如果哪天这个目录被误删，Tina 启动器会自动重建，不需要手动处理。

### 想确认是不是同一个问题

```bash
node -e "console.log(require('os').tmpdir())"   # 看看系统临时目录在哪
```

然后在 `node_modules/@tinacms/cli/dist/index.js` 里搜索 `os.tmpdir()`，
你会看到那两行写死的路径（`database.build.mjs` 和 `config.build.jsx`）。

---

## 当前能力边界

| 能力 | 状态 | 说明 |
| --- | :---: | --- |
| 文章展示 | ✅ | 首页 + 列表 + 详情 + 目录 + 上下篇 + 相关文章 |
| 网页后台写作 | ✅ | TinaCMS，保存自动提交 GitHub |
| 国内访问速度 | ✅ | Cloudflare CDN，无外链字体与外链 JS |
| 视频播放 | ✅ | Bilibili iframe，懒加载 |
| 音乐播放 | ✅ | 侧栏播放器：三种播放模式 + 音量 + 播放列表 |
| **代码高亮** | ✅ | Shiki，构建期着色，深浅色双主题、运行期零成本 |
| **数学公式** | ✅ | KaTeX，构建期渲染，字体只在实际用到时下载 |
| **头像 / 分享图** | ✅ | 都是仓库里的静态文件，换图不用改代码 |
| 标签 / 归档 | ✅ | 标签总览、标签详情、年份归档 |
| RSS 订阅 | ✅ | `/rss.xml`，构建期生成，无需后端 |
| **站内搜索** | ✅ | 构建期生成索引，标题/标签/摘要/全文匹配，无需后端 |
| 自定义壁纸 | ✅ | 7 套预设 + **直传仓库** + 只存本机，可调强度与模糊 |
| 站点默认值 | ✅ | 存仓库的 `content/site-settings.json`，构建期注入，首屏即生效 |
| 深浅色主题 | ✅ | 跟随系统 / 浅色 / 深色，无闪屏 |
| **浏览量 / 点赞** | ✅ | 默认只统计本机（零配置）；部署 `workers/blog-api` 后变成全站真实数字 |
| **评论区** | ✅ | 三通道：本机评论（零配置）/ 互动服务（全站可见）/ Giscus（默认未启用） |
| **留言与评论的回复** | ✅ | **只有仓库主人能做**，回复写进仓库或互动服务，所有访客可见 |
| **列表页缩略框配图** | ✅ | `cover` 当卡片背景；没有封面时自动展示正文前 4 张图的缩略图带 |
| Giscus 评论 | ✅ | 已接入，配置即启用；**默认不开**，所以现在文章底部没有 Giscus 区块 |
| 后端 API | ⬜ | 纯静态方案；只有可选的互动服务（Workers + KV）算半个后端 |
| 精确的阅读量 | ⬜ | KV 没有事务，并发写会覆盖；要精确得上 D1 + 事务 |
| 浏览量的防刷 | ⬜ | `/hit` 谁都能调，可以被脚本刷；个人博客不做这个投入 |

### 已知取舍

- **访客偏好不跨设备**：这是有意的设计，不是缺陷。访客偏好存 `localStorage`，
  站点默认值存仓库 —— 想让某个设置跟着自己走，就把它保存成站点默认值。
- **默认不部署互动服务时，留言与评论只存在本机 `localStorage`**，
  站长看不到，也就回复不了。界面上如实写明了这一点，
  并且给了三条出路（部署互动服务 / 配置 Giscus / 发邮件）。
- **回复一律只有站长能做**，这是刻意的：让任意访客写入「对所有人可见」的内容，
  就必须把仓库写权限发出去或引入一个后端 —— 前者不可接受，后者就是互动服务。
  详见 [留言与评论怎么回复](#留言与评论怎么回复)。
- **互动服务的计数不是精确值**：KV 没有事务，高并发下会互相覆盖。
  对个人博客够用，但不承诺精确。
- 搜索是**子串匹配**：中文长句会被当成一个词，建议用较短的词或空格分词。
  要做到真正的分词检索，得上 Pagefind 这类专门的方案。
- **Giscus 需要 GitHub 账号**才能评论。要匿名评论就得换成 Waline 一类
  （那需要部署一个服务，不再是无后端）。
- **图片没有自动优化**：静态导出下 `next/image` 的优化器不可用（详见下一节）。
  列表页的缩略图也是**原图直接缩放显示**，没有生成小图 —— 图片多起来之后
  这里是最该先优化的一处。
- 代码块暂时没有**行号与行高亮**：Shiki 的 `transformers` 需要传函数，
  而 Turbopack 只接受可序列化的插件选项。
- 直传仓库与「保存为站点默认」用的 token 都存在浏览器 `localStorage`。
  详见「配置 GitHub Token」里的安全边界说明。

### 为什么不做图片优化

结论：**遇到了真实阻碍，所以不做**。而且这个阻碍比想象的更危险。

静态导出没有服务端，而 `next/image` 的默认优化器**就是一个服务端端点**。
如果不加处理，构建会**成功**，但产出的 HTML 是：

```html
<img src="/_next/image/?url=%2Fuploads%2Fx.png&w=256&q=75" />
```

而 `out/` 里根本没有 `_next/image` 这个路径 —— 也就是
**构建期不报错，运行期所有图片静默 404**。

| 配置 | `next/image` 输出 | 结果 |
| --- | --- | --- |
| `images: {}`（默认） | `src="/_next/image/?url=…"` | 构建通过，线上 404 |
| `images: { unoptimized: true }` | `src="/uploads/x.png"` | 正常 |

所以 `next.config.ts` 里那行 `unoptimized: true` 是**必需的**，不能删。
MDX 正文里的图片走 `src/mdx-components.tsx` 里覆写的原生 `<img>`（带
`loading="lazy"` 和 `decoding="async"`），不受这条影响。

<details>
<summary>如果以后真的需要图片优化，有这三条路</summary>

1. **构建期预处理**：写个脚本用 `sharp` 把 `public/uploads/` 里的图压成 WebP
   并生成多尺寸，缺点是构建变慢、要自己维护
2. **外部图床 / CDN**：`images: { loader: "custom", loaderFile: "./image-loader.ts" }`
   指向 Cloudinary 之类的服务，缺点是多一个外部依赖
3. **换成有服务端的托管**：放弃纯静态，缺点与本项目定位冲突

三条都不是「免费的午餐」，目前仓库里也还没有任何图片，所以先不做。

</details>
