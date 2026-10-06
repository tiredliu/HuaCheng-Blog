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
- [静态资源放在哪](#静态资源放在哪) ← 图片 / 壁纸 / 音频 / 歌词各放哪个目录
- [界面说明](#界面说明) · [音乐播放器](#音乐播放器) · [站内搜索](#站内搜索)
- [壁纸](#壁纸) · [**设置存在哪**](#设置存在哪)
- [**互动：浏览量 · 点赞 · 评论区**](#互动浏览量--点赞--评论区) ← 三个数字各自的来源
- [浏览量的后端：Pages Function + D1](#浏览量的后端pages-function--d1) ← **全站浏览数怎么部署**
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
| 评论 | Giscus（GitHub Discussions） | 零后端；fork 后可换成自带的本机评论或互动服务 |
| 浏览数 | Cloudflare Pages Function + D1 | 与站点同源的 `/api`，建一个 D1 库即可，**约 3 分钟** |
| 点赞 | 评论区的 GitHub 反应数 | 计数存在 GitHub 侧，本站流量再大也不会把它压垮 |
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
│   │   ├── MessagePanel.tsx        可隐藏留言板（非文章页 = 全站留言；文章页改提示跳到正文评论）
│   │   ├── CommentThreadView.tsx   本机评论 / 留言的展示与输入（没配 Giscus 时的兜底）
│   │   ├── PostInteractions.tsx     文章底部评论区（Giscus；未配置时退回本机评论）
│   │   ├── PostStatsBar.tsx        文章头部的浏览次数（D1）与点赞（GitHub 反应数）
│   │   ├── PostBackLink.tsx        文章顶部的「返回」：从标签页进来会回到那个标签
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
├── functions/
│   ├── api/[[route]].js            ★ 浏览量后端：Pages Function + D1（GET /api/stats、POST /api/hit）
│   └── README.md                   ★ D1 的创建、绑定与验证步骤
├── workers/blog-api/               ☆ 旧方案：Worker + KV 的互动服务（评论/点赞/站长回复）
│                                      本站已不用；保留给想要「页面内直接回复」的人，见对应 README
├── public/
│   ├── images/                     文章配图与封面
│   ├── wallpapers/                 站点壁纸
│   ├── music/                      音频
│   ├── lyrics/                     歌词（.lrc）
│   └── uploads/                    TinaCMS 媒体库与直传落点
├── scripts/tina.mjs                TinaCMS 启动器（把编译临时目录放进项目内）
├── tina/config.ts                  内容模型定义
└── next.config.ts                  静态导出 + MDX 插件
```

---

## 静态资源放在哪

以前图片、壁纸、音频全堆在一个 `public/uploads/` 里，现在**按类型分目录**：

| 目录 | 放什么 | 怎么引用 |
| --- | --- | --- |
| `public/images/` | 文章正文配图、封面图 | `![说明](/images/x.jpg)`、`cover: /images/x.jpg` |
| `public/wallpapers/` | 站点壁纸大图 | 设置 → 壁纸 → 上传，或填 `/wallpapers/x.jpg` |
| `public/music/` | 音频（mp3 / wav / flac …） | `musicUrl("x.mp3")`、`<AudioPlayer src="/music/x.mp3" />` |
| `public/lyrics/` | 歌词（`.lrc`） | 在 `src/lib/music.ts` 里给曲目填 `lyrics` |
| `public/uploads/` | TinaCMS 媒体库与「上传到仓库」的**兜底落点** | `/uploads/x.jpg` |

约定统一写在 [src/lib/assets.ts](src/lib/assets.ts) 里（`ASSET_DIRS`），
加新目录只改那一处，再同步 `public/_headers` 与 `nginx.conf` 的缓存规则。

> `public/uploads/` **不要删**：TinaCMS 的 `media.mediaRoot` 和直传逻辑都指向它，
> 它现在只是「没指明类型时的兜底」。TinaCMS 后台插入的图片会落到 `public/images/`。

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
cover: /images/20260618-cover.jpg   # ← 卡片背景图 + 文章页顶部大图
---

![正文里的第一张图](/images/a.jpg)
![第二张](/images/b.jpg)

<img src="/images/c.jpg" alt="原生标签写法也认" />
```

细节：

- `cover` 也可以填外链（`https://…`），不限于仓库里的图
- 后台写作时用 **TinaCMS 后台 →「封面图（列表页缩略框的背景）」** 从媒体库选图，
  它会把文件提交到 `public/images/` 并自动写好 frontmatter
- 正文里的图片两种写法都认：Markdown 的 `![说明](/images/x.jpg)` 和原生 `<img src="…">`
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
| `<AudioPlayer src="/music/bgm.mp3" title="曲名" artist="作者" />` | HTML5 音频播放器 |
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

**把图片文件丢进 `public/images/`，然后在文章里写 `![](/images/文件名.jpg)`。**

路径怎么写都能认 —— 下面几种等价，怎么方便怎么来（`resolveImageSrc()` 会统一规整）：

| 写法 | 结果 |
| --- | :---: |
| `/images/x.jpg` | ✅ |
| `public/images/x.jpg` | ✅ |
| `images/x.jpg` | ✅ |
| `public\images\x.jpg`（Windows 反斜杠） | ✅ |

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
- **右侧留言板**：可隐藏；在首页 / 列表 / 关于等页面就是**全站留言板**（一条名为「留言板」的 Discussion）；
  在文章页会提示「本页评论在正文底部」并给你一个跳转（原因见[评论区](#评论区giscus一页只留一个实例)）
- **文章头部的浏览数与点赞**：浏览数来自 D1（全站真实数字，没配后端时显示「（本机）」）；
  点赞数是评论区那条 Discussion 上的 GitHub 反应数，**点赞动作在评论区里点 👍**
- **文章底部评论区**：Giscus（GitHub Discussions）一条通道；没配 Giscus 时退回本机评论；
  下方有一排表情，点一下复制到剪贴板（见[评论区](#评论区giscus一页只留一个实例)）
- **文章右下角的两个圆钮**：回到顶部 / 跳到底部，滚过一段距离才出现
- **从标签页打开的文章**：顶部「返回」回到那个标签的文章列表，而不是全部文章
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
| 🎤 | 打开 / 关闭**悬浮歌词窗** |
| 🎛️ | **音效**（原声 / 低音增强 / 人声增强 / 清亮 / 大厅混响） |
| 🔊 | 静音开关 |
| 滑杆 | 音量（0–100，实时显示百分比） |

播放模式、音量、歌词窗开关、音效都会记在浏览器里
（`hc-blog:music-mode` / `hc-blog:music-volume` / `hc-blog:music-lyrics-open` / `hc-blog:music-effect`），
刷新后保留。

### 手机上的通知栏 / 锁屏

播放器把曲目信息同步给了系统的媒体控制中心（Media Session API），
所以**用手机浏览器听歌时，通知栏与锁屏会显示封面、歌名、歌手和进度条** ——
不再是一个光秃秃的播放按钮。

通知栏上能用的控制：

| 控件 | 条件 |
| --- | --- |
| 上一首 / 下一首 | 歌单有 2 首以上才出现 |
| 后退 10 秒 / 前进 10 秒 | 注册了 `seekbackward` / `seekforward`，步长由系统给（iOS 与 Android 不一样） |
| **拖动进度条** | 注册了 `seekto` —— **不注册它，那条进度条就只能看不能拖** |
| 播放 / 暂停 | 一直都有 |

要点：

- 封面取 `track.cover`，没登记封面时用站点头像兜底（通知栏至少有个方块，不然像坏了）
- 不支持这个 API 的浏览器只是没有通知栏美化，播放器本身照常工作
- 一篇文章里可能同时有侧栏播放器和正文内嵌的 `<AudioPlayer />`，
  **只有真正在播的那个会写通知栏**，所以不会出现「显示的是另一首」

⚠️ **通知栏长什么样，网页说了不算。** 它是浏览器和系统画的，网页只能给元数据和响应
几个规定好的动作。想要「歌词」或「音效按钮」是不可能的 —— 元数据里没有放正文的字段，
自定义 action 也只有原生 App 能做到。这两样只能在站点内自己做的界面里实现
（歌词已经在悬浮歌词窗里了，见下）。

> 唯一的例外是一个**实验性**接口：`MediaMetadata.chapterInfo`（Chrome 127+ 支持）。
> 它可以把每一句歌词做成一个「章节」，在部分系统的媒体面板里能挑选并跳转 ——
> 但兼容性不可靠，本站没有接入，这里只是记一笔。

### 歌词窗

点 🎤 会浮出一个歌词窗：

- **拖动标题栏**移动，**拖右下角**调整大小（位置和大小都记在浏览器里）
- **自动滚动**：整段歌词连续平移，当前这句始终停在窗口中间（不是跳行）
- **点某一句可以跳到那个时间点**
- 换歌会自动重新加载歌词；标题栏第二个按钮恢复默认位置

底栏可以调外观，全都记在浏览器里：

| 控件 | 作用 |
| --- | --- |
| `A−` / `A+` | 歌词字号（10–24px） |
| 🎨 | 配色面板：**跟随主题 / 浅色 / 深色 / 自定义** |
| 自定义时 | 正文、当前句、背景板各一个取色器 + 背景不透明度滑杆（**拉到 0 就是完全透明**，只剩文字浮在壁纸上） |

配色面板里还有一个开关：**鼠标移开后整块隐藏**，移回来立刻显示（默认开）。
打开窗口时会先亮 2 秒再决定要不要淡出 —— 否则鼠标还在播放器上时窗口一打开就是透明的。

> 隐藏用的是 `opacity: 0` 而**不是** `pointer-events: none`：
> 后者会让鼠标再也唤不醒它。

歌词是 `.lrc` 文件，放在 `public/lyrics/`，再在歌单里登记：

```ts
{
  id: "my-song",
  title: "曲名",
  artist: "歌手",
  src: withBasePath(musicUrl("我的歌.mp3")),
  lyrics: withBasePath(lyricUrl("我的歌.lrc")),   // ← 加这一行
}
```

**`lyrics` 留空是正常的** —— 歌词窗会显示「这首歌还没有歌词」，不会报错。
歌单里只有示例曲目一填了歌词，其余刻意留空（真人歌曲的歌词有版权，需要的自己放）。
格式说明见 [public/lyrics/README.md](public/lyrics/README.md)。

### 音效

🎛️ 里有 5 档，**全部用浏览器自带的 Web Audio API 实时处理，完全免费**：

| 档位 | 效果 |
| --- | --- |
| 原声 | 不处理（默认，连音频处理链都不建） |
| 低音增强 | 抬低频、压高频 |
| 人声增强 | 抬中频，人声浮出来 |
| 清亮 | 抬高频，适合钢琴与弦乐 |
| 大厅混响 | 现场算出一段脉冲响应做混响，不用下载任何音频素材 |

三条实现上的约束（写在 [src/lib/audio-effects.ts](src/lib/audio-effects.ts) 里）：

1. 一个 `<audio>` 只能建一次音频源节点，所以按元素缓存整条链
2. 建了链之后声音只走 AudioContext，所以每次切音效都要 `resume()`
3. **外链音频没有 CORS 头，接上会直接没声音** —— 所以外链曲目那个按钮是禁用的

默认是「原声」，不点开就**完全不碰音频管线**，原有播放行为没有任何变化。

### 换成自己的歌

1. 把音频文件放进 `public/music/`
2. 在 [src/lib/music.ts](src/lib/music.ts) 的 `defaultPlaylist` 里登记一行

```ts
export const defaultPlaylist: Track[] = [
  { id: "my-song", title: "曲名", artist: "歌手", src: withBasePath(musicUrl("我的歌.mp3")) },
];
```

`musicUrl()` 会自动做 URL 编码 —— 中文文件名和空格都能正常播放，别手写 `/music/xxx`。

> **文件名里的 `&` 不用怕**：播放器按 URL 编码取文件，
> `街道办GDC&欧阳耀莹-春娇与志明.mp3` 这种名字能正常播。
> 但如果文件名里出现了 `&amp;` 这种转义残留（某些下载工具会这样），要改回 `&`。

### 加歌词：`npm run lyrics`

歌词**只放一个地方**：`public/lyrics/`（没有额外的暂存目录）。

```bash
# 1. 把歌词文件直接丢进 public/lyrics/
#    文件名用歌单里的 id 或标题都行，.lrc / .txt 都认：
#      public/lyrics/ivory-tower.lrc     ← 按 id（推荐）
#      public/lyrics/还是分开.lrc         ← 按标题
#      public/lyrics/春娇与志明.txt       ← 纯文本（一行一句，会转成无时间轴歌词）

# 2. 归一化 + 登记
npm run lyrics
```

脚本会补好 `[ti:]` / `[ar:]`、统一改名成 `public/lyrics/<id>.lrc`
（按标题命名或 `.txt` 的会就地改名，不在目录里留两份），
并在 `src/lib/music.ts` 对应条目里插好 `lyrics:` 那一行。
文件里没有正文的会被跳过，不会生成空歌词文件；跑完打印「歌词 ⇄ 歌曲」对照表。
完整说明见 [public/lyrics/README.md](public/lyrics/README.md)。

> ⚠️ **版权**：音乐和歌词都是受版权保护的作品，而这个博客是**公开仓库** ——
> 把音频 / 歌词提交进去等于公开分发。只放你有权利放的内容
> （自己写的、已授权的、公有领域的，或从正版渠道购买后自用的）。
> 脚本不会替你去网站抓取歌词，歌词文本需要你自己提供。

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
| **上传到仓库** | 提交到 `public/wallpapers/`，之后出现在「我的上传」里随时选用 | **所有访客** |
| 只存本机 | 压缩后存进浏览器 `localStorage`，不上传任何服务器 | 只有你自己 |
| 图片直链 | 粘贴 `https://…`、`/wallpapers/bg.jpg` 或 `data:image/…` | 所有人 |

还有两个滑杆：

- **壁纸强度**（0–100%）：越低遮罩越浓，把壁纸推远，保证正文可读；拉到最左等于关闭
- **模糊**（0–24px）：虚化背景，让前景更聚焦

> **提示**：有壁纸时，外壳、顶栏、左侧导航、留言区会自动变成毛玻璃
> （半透明 + `backdrop-blur`），壁纸才能真正透出来。

### 不用后端，怎么把图片传进 `public/wallpapers/`？

`public/wallpapers/` 是仓库里的目录，浏览器不能直接写服务器文件系统。
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
这个过程大约 1–2 分钟。在这之前，站内的 `/wallpapers/xxx.jpg` 还是 404。

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
  url: "",           // 也可以填 "/wallpapers/你上传的图.jpg" 当成全站默认壁纸
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
  "giscus": null,           // null = 不启用；填入对象即启用（见「评论系统 → 推荐方案：Giscus」）
  "interactions": {
    "provider": "remote",   // local = 只统计本机；remote = 读下面的 apiBase
    "apiBase": "/api"       // 浏览量后端；Pages Function + D1 用同源的 "/api"（见「浏览量的后端」）
  }
}
```

push 之后 Cloudflare 重新构建，对所有访客生效。

**方式二：在前台保存**

设置 → **站点默认值** → 「保存为站点默认」。它会把这组设置通过 GitHub API 写进
`content/site-settings.json`，同样需要 GitHub Token。按钮上方会提示
「当前设置和站点默认值有哪些不同」。

> 想用**上传到仓库的壁纸**当全站默认：把 `wallpaper.url` 填成 `/wallpapers/你的图.jpg`、
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
| 文章头部 | `123 次浏览` + `N 个赞` —— 前者是 D1 里的全站数字，后者是评论区那条 Discussion 上的 GitHub 反应数 |
| 文章底部 | Giscus 评论区（GitHub Discussions），`#comments` 是它的锚点 |
| 文章列表卡片 | 与统计无关，只显示封面图 / 正文缩略图（见[缩略框配图](#列表页那张卡片缩略框上会显示什么图)） |

### 三个数字，三个来源

浏览数、点赞数、评论都属于「需要有人记住」的数据，而纯静态站点没有服务端。
本站把它们分给了三个不同的地方 —— **哪个最不容易崩，就由谁来记**：

| 东西 | 记在哪 | 全站共享 | 需要部署吗 | 拿不到会怎样 |
| --- | --- | :---: | --- | --- |
| **浏览数** | Cloudflare **D1**（`functions/api`，与页面同源的 `/api`） | ✅ | 建一次 D1 库（约 3 分钟） | 退回「本机计数」，标注「（本机）」 |
| **点赞数** | 评论区那条 Discussion 上的 **GitHub 反应数** | ✅ | ❌ | 显示占位「—」，不会假装是 0 |
| **评论 / 留言** | 仓库的 **GitHub Discussions**（Giscus） | ✅ | ❌（但要装 Giscus App） | 未配置时退回本机评论 |

**为什么不用一套后端把它们全包了**：因为代价最小的那条路刚好各不相同。

- **点赞**要的只是一个计数，而 GitHub 讨论上的反应天生就是计数 ——
  数据在 GitHub 侧，**本站访问量再大也不会把它压垮**，连额外请求都不必发。
- **评论**要的是「互相看得见、能回复」，而 Discussions 本来就是 GitHub 原生的评论区。
- 只剩下**浏览数**没有现成归属，才给它挂一个几十行的 Function + D1。

浏览数走哪条路，由 `content/site-settings.json` 的 `interactions` 决定：

| | `provider: "local"` | `provider: "remote"` + `apiBase: "/api"` |
| --- | --- | --- |
| 浏览数存在哪 | 访客自己的浏览器 `localStorage` | Cloudflare D1（**所有人的数据在一起**） |
| 需要部署什么 | 什么都不用 | 建一个 D1 库并绑定（见下） |
| 界面上怎么标注 | 数字后面写「（本机）」 | 不标注，鼠标悬停显示「全站计数」 |

远程连不上时（没部署、断网、被拦截）**自动退化成本机**，不打扰访客，也不显示 `0` 这种假数字。

### 评论区：Giscus（一页只留一个实例）

这是本站唯一一个「和直觉不一样」的限制，值得单独记一笔：

**giscus 的 `client.js` 会复用页面上第一个 `.giscus` 容器，且 iframe 的高度消息不带发送方标识 ——
所以它天然只支持「一个页面一个实例」。**

后果与本站的做法：

| 页面 | 显示什么 |
| --- | --- |
| 文章页 | 正文底部是这篇文章的讨论（按 `pathname` 映射）；此时右侧留言板**不再内嵌 Giscus**，改显示「本页评论在正文底部」+ 一个跳转按钮 |
| 其他页面（首页 / 列表 / 关于 / 联系…） | 右侧留言板是**全站留言板**：一条名为「留言板」的固定 Discussion（`mapping: "specific"`） |

如果强行在同一页挂两个，表现就是「留言板里显示了某篇文章的评论」—— 这不是配置写错，
而是第二个实例复用了第一个的容器。

**登录只需要一次**：会话按站点存在 `localStorage`（键 `giscus-session`），
同一个域名下各篇文章的评论区与留言板**共用同一个登录**；
换账号在评论区内部的「退出登录」里操作即可。
（`localhost` 和线上域名是**不同的源**，各自登一次是正常的。）

### 表情面板

评论区下方有一排常用表情 + 一个「更多表情」面板，点一下复制到剪贴板，粘进评论框即可。

面板有两个 Tab：

| Tab | 数量 | 复制的内容 | 粘进评论框之后 |
| --- | --- | --- | --- |
| **GitHub 表情** | 1870 个 | `:face_with_tears_of_joy:` 这样的短代码 | GitHub 渲染成它自己的 emoji 图，各设备长得一样 |
| **图片表情包** | 164 张 | `![笑哭](https://…/emojis/xxx.png)` | GitHub 渲染成图片 |

两个 Tab 都支持**搜索**（中文名、英文名、短代码都能搜）与分类筛选；
一次渲染 120 个，多了点「显示更多」继续。

数据怎么来的：

- `public/emoji-data.json` 由 `npm run emoji:data` 生成，源是两个官方仓库 ——
  **`github/gemoji`**（GitHub 自己认的短代码列表，MIT）与
  **Unicode CLDR 的 `annotations/zh.xml`**（官方中文名与搜索关键词，Unicode License）。
  1870 个里有 1563 个带官方中文名。
  ⚠️ 必须用 gemoji 而不是 Unicode 全表：GitHub 不一定有某个 emoji 的短代码，
  而 `:shipit:`、`:octocat:` 这些 GitHub 特有的短代码 Unicode 表里也没有 ——
  复制一个 GitHub 不认识的短代码，粘贴过去只会原样显示成文字。
- `public/emojis/` 里的图片由 `npm run emoji:pack` 生成，来自
  **微软 Fluent Emoji**（仓库 `microsoft/fluentui-emoji`，**MIT 授权**）。
  原图 256px，之内脚本会调用 `scripts/shrink-emoji-pack.py` 压到 128px
  （需要 Python + Pillow；没装就跳过，原图照常能用，只是大一些）。

**换成自己的表情包**：把图片丢进 `public/emojis/`，再跑一次 `npm run emoji:pack` ——
脚本会扫描目录，自动登记不在内置清单里的文件（显示名默认取文件名）。
想要更好听的名字，改 `public/emojis/index.json` 里的 `n` 字段即可。
常用那排手写emoji在 `src/lib/emojis.ts`。

⚠️ 图片语法里的地址必须是**绝对 URL**（取 `SITE.url`）：评论是在 github.com 上看的，
写成相对路径会取不到图。换域名记得同步 `src/lib/site.ts` 里的 `url`。

### 表情：为什么只能「点一下复制」

这不是偷懒 —— **评论框是 GitHub 的组件，跑在 giscus 的跨域 iframe 里**，
浏览器不允许第三方页面读它的 DOM，更没法往里塞自定义表情选择器；
giscus 官方的配置项里也完全没有表情这一项（`data-*` 只有主题、映射、语言那几类）。
所以自定义表情这条路只剩两个走法：

| 做法 | 代价 |
| --- | --- |
| **本站的方案**：表情面板 + 复制粘贴 | 多一次粘贴；换来零后端、评论仍然躺在仓库的 Discussions 里 |
| 换成 Waline / Twikoo / Artalk 一类 | 表情包是真的能自定义了，但**必须另起一个常驻后端和数据库**（Vercel / 云函数 / 自己的服务器 + 免费额度），与本站「零后端、数据在 GitHub」的路线冲突，数据也不再归仓库所有 |

### 关于图片表情包的版权

`public/emojis/` 里只用**明确允许再发布**的素材。这个仓库是公开的，
提交进去等于公开分发 —— 所以社区的梗图、二创作品**一律不放**，理由很实际：

- 作品画完那一刻就自动享有著作权，不需要作者标 ©，「网友自制」不等于没版权；
- 二创 / 同人图还会**额外**叠加原 IP 的版权；
- MIT / CC-BY 这类授权才是「可以直接放进公开仓库」的。

所以这里放的是 MIT 授权的 Fluent Emoji。想要梗图，自己丢进 `public/emojis/` 也支持，
只是那份责任由你自己承担。

细节见 [评论系统](#评论系统)。

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
本站把它放在 **Pages Function** 里（`functions/`），连「另一个 Worker 项目」都省了。

---

## 浏览量的后端：Pages Function + D1

源码就是仓库根的 [`functions/api/[[route]].js`](functions/api/%5B%5Broute%5D%5D.js)，只有两个接口：

| 接口 | 作用 |
| --- | --- |
| `GET /api/stats?path=<slug>` | 读浏览数（不存在返回 `{"views":0}`） |
| `POST /api/hit` `{"path":"<slug>"}` | 计数 +1，返回最新数字 |

四个刻意的选择：

1. **挂在 Pages 而不是单独 Worker** —— `functions/` 跟着站点一起构建部署，不用再维护第二个项目
2. **与页面同源**（`/api`）—— 省掉跨域，也不会因为某个 `*.workers.dev` 域名连不上而失败
3. **用 D1 而不是 KV** —— 见下面的对比
4. 表结构**首次请求自动创建**（`CREATE TABLE IF NOT EXISTS`，幂等），不用手动迁移

### 为什么换掉了旧的 Worker + KV

仓库里的 `workers/blog-api`（Worker + KV）能跑，但它恰好是「访问一上来就崩」的那一档：

| | Workers KV（旧） | **D1（现在）** |
| --- | --- | --- |
| 免费写入额度 | **1,000 次 / 天** —— 超出后 `/hit` 直接报错 | **100,000 行 / 天** |
| 并发自增 | ❌ 没有事务，「读 → 改 → 写」会丢计数 | ✅ `count = count + 1` 原子自增 |
| 部署形态 | 独立的 Worker 项目 + KV 命名空间 | **跟站点一起部署** |
| 接口地址 | `https://xxx.workers.dev`（跨域） | `/api/*`（**同源**） |
| 要维护的东西 | Worker 代码 + KV + CORS 白名单 | 一个 D1 绑定 |

### 部署（一次性，约 3 分钟）

① **建库**（两种都行）：

- **Dashboard**：**存储和数据库 → D1 SQL 数据库 → 创建数据库**，名字填 `hc-blog-views`
  （控制台改过版，有些账号里它还在「Workers & Pages → D1」；都找不到就用顶部搜索框搜 `D1`）
- **CLI**：`npx wrangler d1 create hc-blog-views`

> Windows 上 `npx wrangler` 可能报 `The package "@cloudflare/workerd-windows-64" could not be found`
> —— npx 漏装了它的平台二进制包。解决办法是 `npm i -g wrangler` 装一份本地的；
> 或者干脆用上面那条 Dashboard 路径，建库这件事本来也不需要 CLI。

② Cloudflare Dashboard → **你的 Pages 项目 → 设置 → 绑定（Bindings）→ 添加 → D1 数据库**
（旧版控制台是「Settings → Functions → D1 database bindings」）→ 新增一条：

- **Variable name**：`BLOG_DB`（必须一字不差，代码里写死了）
- **D1 database**：选刚创建的 `hc-blog-views`

③ **重新部署**：往 `main` 推一次，或在该项目的 Deployments 里点 “Retry deployment”。

④ 让前端开始用它 —— [content/site-settings.json](content/site-settings.json)：

```json
"interactions": {
  "provider": "remote",
  "apiBase": "/api"
}
```

完整说明（免费额度、验证命令、本机怎么联调）都在
[functions/README.md](functions/README.md)。

### 边界要说清楚

- `POST /api/hit` **没有鉴权**，任何人都能刷 —— 浏览量本来就是个模糊指标，
  不承诺精确、也不防刷。要防就得上验证码或更复杂的限流，个人博客不划算。
- `path` 只允许 `[A-Za-z0-9._-]`、长度 ≤ 160（前端已把中文 slug 归一化成 `x-<hex>`）。
- 接口只存「path → 次数」，不存任何个人信息。
- 未绑定 D1 时返回 `503`，前端退回本机计数。
- 本机 `npm run dev` 没有 Pages Function，`/api` 会 404 —— 前端同样退回本机计数并标注「（本机）」，
  **这是预期行为，不是 bug**。想在本机联调可以用
  `npx wrangler pages dev out --d1 BLOG_DB`。

> 旧的 `workers/blog-api` 保留在仓库里没删：它带的是**页面内的评论与站长回复**
> （本站这两件事已经交给 Giscus）。想要那套的人可以读它自己的 README。

---

## 留言与评论怎么回复

先直接回答三个最常问的问题。

### 一、现在这个博客是不是只有仓库主人能写？

| 动作 | 需要什么凭据 | 现在谁能做 |
| --- | --- | :---: |
| 写 / 改文章 | TinaCMS（走 TinaCloud 的 GitHub App 授权）或仓库写权限 | **只有仓库主人** |
| 上传图片、保存站点默认值 | GitHub fine-grained token | **只有仓库主人** |
| 发表留言 / 评论（Giscus） | GitHub 账号 | **任何有 GitHub 账号的人**（本站已启用） |
| **回复**留言 / 评论 | GitHub 账号 | 站长在 Discussions 里回复；任何人也能在 GitHub 上继续回复 |
| 没配 Giscus 时的本机留言 / 评论 | 什么都不用 | 任何访客（但只存在他自己浏览器里） |

所以：**文章确实只有仓库主人写得了。**
仓库里已经内置了 Giscus 的接入代码，本站
[content/site-settings.json](content/site-settings.json) 里的 `giscus` 已配置并启用，
**评论与留言统一走 Giscus**：文章底部是这篇文章自己的讨论，
非文章页的右侧留言板是全站留言板 —— 任何有 GitHub 账号的人都能评论 / 留言，
此时就**不是**只有主人能写了。
（代码里的默认值仍是 `null`：fork 这个项目后，需要按下面步骤自行配置，
并把 Giscus App 装到自己的仓库上；没配时文章底部退回本机评论。）

### 二、访客的留言 / 评论，站长怎么回？

**本站不需要「在页面里回复」这套流程了** —— 评论就是 GitHub Discussions，
站长直接在那儿回：

1. 打开仓库的 **Discussions**，找到那条讨论（每篇文章一条；留言板是名为「留言板」的那条）
2. 在评论下方点 **Reply**，写内容、保存
3. **立刻对所有访客生效** —— 不用重新构建，也不用任何 token

比在页面上回复更好的地方：**GitHub 会给站长发通知**，而且回复是 GitHub 原生的
（支持 Markdown、@ 提醒、表情反应、编辑与删除）。

> **没配 Giscus 时**（代码默认值 `null`）才走老流程：回复按钮只在**站长模式**下出现，
> 判定方式很朴素 —— **本机浏览器里存着能写仓库的 GitHub Token**，那它就是站长，
> 和写文章、传图片用的是同一个凭据，不需要再发明一套登录系统。
> 三步：① 打开右上角 **设置 → 展开「GitHub Token 配置」**，填入 fine-grained token
> （只授权这一个仓库、只给 `Contents: Read and write`，见
> [配置 GitHub Token](#配置-github-token走第-2-条路才需要)）；
> ② 留言板 / 评论区每条右下角出现 **「回复」**，点开写内容、点「发布回复」；
> ③ 等 1–2 分钟重新构建完成，**所有访客**都能看到。
>
> 这时回复写进 `content/comments.json` / `guestbook.json`，权限是**服务端强制**的：
> 没有仓库写权限根本提交不上去，不是「把按钮藏起来」。

### 三、访客的评论存在哪里？站长看不到怎么办

这是纯静态站最需要说清楚的一条边界，而**本站的答案已经变了**：

| 评论通道 | 访客的评论在哪 | 站长能不能看到 |
| --- | --- | :---: |
| **Giscus（本站启用）** | 写在仓库的 **GitHub Discussions** 上 | ✅ **看得到**，还会收到 GitHub 通知，直接在里面回复 |
| 本机评论（没配 Giscus 时的兜底） | 只写进访客自己的 `localStorage` | ❌ **看不到**，所以也就回不了 |

所以：**配好 Giscus 之后，「访客评论 → 站长回复」这个闭环就成立了**，
不需要任何自建后端 —— 这是本站把评论统一到它的主要原因。

没配 Giscus 才是那句老实话：纯静态站没有「收件箱」，
**访客提交的内容没有任何通道能被站长收到**。那时只剩三条路 ——
① 配置 Giscus（推荐）；② 部署 `workers/blog-api`（**旧方案**：Worker + KV，能在页面里直接回复，
本站已不用 —— 它的写入额度与事务限制见下节）；③ 走邮件。

### 四、留言板和文章评论区有什么区别

走 Giscus 之后，两者的差别只剩「挂在哪个讨论上」和「什么时候出现」：

| | 右侧留言板 | 文章底部评论区 |
| --- | --- | :---: | :---: |
| 面向 | 站点整体的一句话 | 某一篇文章的讨论 |
| 对应的 Discussion | 名为「留言板」的那一条（`mapping: "specific"`） | 按 `pathname` 映射的那一条 |
| 在文章页 | 显示「本页评论在正文底部」+ 跳转按钮（**一页只能有一个 giscus 实例**） | ✅ 正常显示 |
| 在其他页面（首页 / 列表 / 关于 / 联系…） | ✅ 显示全站留言板 | ——（不是文章页） |

两者的讨论都在**同一个仓库的 Discussions** 里，数据随时能导出；
登录也只需一次 —— 同一个域名下它们共用同一个 GitHub 登录会话。

> 没配 Giscus 时，两者共用同一套本机逻辑（`useCommentThread` + `CommentThreadView`），
> 只是数据文件不同：留言板写 `content/guestbook.json`，文章评论写 `content/comments.json`；
> 面板里的「清空本机留言」只删**你自己浏览器**里的那一份，不会动仓库里站长发布的那些。

### 五、公开留言 / 评论文件长什么样

> 这一节讲的是 **`content/guestbook.json` 与 `content/comments.json` 这两个仓库文件**，
> 它们只在**没配 Giscus** 时才承担评论展示 —— 本站启用 Giscus 后，
> 评论与留言都在 GitHub Discussions 里，这两个文件不再参与前台。
> 保留这段是为了想用「仓库文件 + 构建期注入」这条纯离线链路的人。

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
| `likes` | 仓库里的点赞基线（部署了**旧**互动服务时由 KV 记；本站改用 Giscus 后，文章头部的「N 个赞」读的是 GitHub 反应数，与这个字段无关） |
| `reply` / `replyAt` | **站长回复**，只有站长能写 |
| `owner: true` | 这条是站长自己发的（留言板里会带一个「站长」徽标） |

> 评论里的那个心形按钮**只记在本机**：它属于「顺手点一下」的交互，
> 为它单独走一次后端请求不划算。
> 文章头部的「N 个赞」才是全站计数 —— 本站启用 Giscus 后，它读的是评论区那条
> Discussion 上的 GitHub 反应数（见[三个数字，三个来源](#三个数字三个来源)）。

---

## 评论系统

> 这一节讲的是 **Giscus** 的细节。
> 评论 / 留言的分工、权限与回复方式，见上面的
> [互动](#互动浏览量--点赞--评论区) 与 [留言与评论怎么回复](#留言与评论怎么回复)。

### 现状：本站统一走 Giscus

| 位置 | 是什么 | 谁能看到 | 谁能回复 |
| --- | --- | --- | --- |
| 文章底部 | 按文章路径（`pathname`）映射的 GitHub Discussion，**本站已启用** | 所有访客，需要 GitHub 账号 | 站长和任何人在 Discussions 里回复 |
| 右侧留言板（非文章页） | 绑定到「留言板」这条 Discussion 的 Giscus（`specific` 映射） | 所有访客，需要 GitHub 账号 | 同上 |
| 右侧留言板（文章页） | 不内嵌 Giscus —— 改显示「本页评论在正文底部」+ 跳转按钮 | —— | —— |

第三条是**故意的**：giscus 的 `client.js` 会复用页面上第一个 `.giscus` 容器，
且 iframe 的高度消息不带发送方标识，**所以一个页面只能有一个实例**。
强行挂两个的表现就是「留言板显示了某篇文章的评论」。

文章与留言板的评论都落在仓库的 Discussions 里、对所有访客可见，数据可随时导出。
没配 Giscus 时（代码默认 `null`）会退回「本机评论 + 站长发布」的老逻辑。

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

代价也说清楚，**三条**：

1. **评论者需要有 GitHub 账号**。对技术博客通常不是问题；
   但如果读者大多没有 GitHub 账号，就得选 Waline 那一类（要自己部署，但可匿名）。
2. **一个页面只能挂一个实例**（原因见上一张表），所以文章页的留言板要让位给正文评论。
3. 评论框是**跨域 iframe**：改成页面样式（字体、圆角）只能整套替换它的主题 CSS，
   维护成本不小；自定义光标也无法跟随到 iframe 内部（浏览器同源隔离，
   代码只能做到「进 iframe 时隐藏自定义光标」）。

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
   （**这一步不能省**：没装 App 时 iframe 会提示 “giscus is not installed”）
6. push，等重新构建完成，文章底部就会出现评论区

> `mapping` 决定「哪篇文章对应哪个 discussion」，默认 `pathname` 够用。
> 但文章 URL 变了会对应不上——旧评论还在，只是挂到了新的 discussion 下。

拿到两个 ID 的最快方式其实不用填表：`repoId` 和 `categoryId` 都能用 GitHub API 取
（`repository { id }` 与 `discussionCategories { nodes { id name } }`），
Discussions 也能直接 `PATCH` 打开。

### 登录与配色

**登录一次，全站通用**：会话按站点存在 `localStorage`（键 `giscus-session`），
同一个域名下各篇文章的评论区与留言板**共用同一个登录**。
换账号在评论区内部的「退出登录」里操作即可 —— 这是 iframe 内的功能，
页面外面接管不了它的 OAuth。
（`localhost` 与线上域名是**不同的源**，各自登一次是正常的。）

**配色跟随深色 / 浅色**：切主题时用 `postMessage` 通知 iframe 换配色，不整块重新加载。
iframe 是懒加载 + 异步插入的，所以这份同步不会只在挂载那一次做 ——
它会在 iframe 就绪后再补发一次，避免「深色页面里评论框是浅色」。
另外只要配了 Giscus，页面 `<head>` 就会带上 `giscus.app` 的
`preconnect` / `dns-prefetch`，省一次握手。

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
>
> 还有一件事要提前知道：**只有 Cloudflare Pages 能带上 `functions/` 这个浏览量后端**。
> GitHub Pages / Nginx / Docker 这类纯静态托管跑不了它 ——
> 那时浏览数会退回「本机计数」并在界面上标注「（本机）」，其余功能不受影响。

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

**6. 绑定 D1 数据库（可选，约 3 分钟）—— 想要全站浏览数才需要**

```bash
npx wrangler d1 create hc-blog-views
```

然后 Pages 项目 → **Settings → Functions → D1 database bindings** → 新增一条：
**Variable name** 必须是 `BLOG_DB`（代码里写死了），**D1 database** 选刚创建的那个库，
最后重新部署一次。再把 [content/site-settings.json](content/site-settings.json) 的
`interactions` 改成 `{ "provider": "remote", "apiBase": "/api" }`。
完整说明见 [浏览量的后端：Pages Function + D1](#浏览量的后端pages-function--d1)。

**不做这一步站点照样能跑** —— 只是浏览数显示「（本机）」，不会报错也不会白屏。

**7. 自定义域名（可选）**

Pages 项目 → **Custom domains** → 添加你的域名 → 按提示去 DNS 加一条 `CNAME`。
CF 托管的域名会自动配好证书；域名不在 CF 的话，先把 NS 转过来最省事。

**缓存策略已经内置**：[public/_headers](public/_headers) 会被复制进 `out/`，
Cloudflare Pages 会自动读取它（这个文件本身不会被当成静态资源下发）：
`_next/static/*` 永久缓存、`/images/*` `/wallpapers/*` `/music/*` `/lyrics/*` `/uploads/*` 缓存一天、`/rss.xml` 带正确的 MIME 并交给 ETag 校验，
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
| 首页等非文章页点开留言板 | 是全站留言板（Giscus），登录 GitHub 后可留言 |
| 打开一篇文章 | 头部先是浏览/点赞的占位「—」，很快换成真实数字；底部有 Giscus 评论区 |
| 刷新文章页几次 | 浏览数每次 +1；绑好 D1 后**没有**「（本机）」字样 |
| 在文章页点开右侧留言板 | 显示「本页评论在正文底部」+ 跳转按钮（一页只有一个 giscus 实例） |
| 在评论区给讨论点个赞 👍 | 文章头部的点赞数跟着变（读的是 GitHub 反应数） |
| 从标签详情页点进一篇文章 | 顶部「返回」写的是「返回该标签的文章」，点回去正好是那个标签列表 |
| `curl https://<域名>/api/stats?path=hello-world` | 返回 `{"views":N}`；404 / 503 说明 Pages Function 或 D1 还没生效 |
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
`public/` 下新增的资源要重新构建才会进入 `out/`；`public/images/` 等资源目录里的文件
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
按顺序查三件事：① `content/site-settings.json` 里 `giscus` 配置是否完整
（`repo` / `repoId` / `category` / `categoryId` 四个都不能少）；
② 仓库 Settings → Features 里 **Discussions 开了吗**；
③ <https://github.com/apps/giscus> 的 App **装到这个仓库了吗**（没装时 iframe 会提示
“giscus is not installed”）。
代码里的默认值是 `null`，所以 fork 之后默认确实不会出现评论区 —— 这是刻意的，那时会退回本机评论。

**浏览量一直显示「（本机）」**
说明后端没接通，按这个顺序查：① `content/site-settings.json` 里是不是
`{ "provider": "remote", "apiBase": "/api" }`；② Pages 项目的
**Settings → Functions → D1 database bindings** 里有没有变量名为 `BLOG_DB` 的绑定；
③ 浏览器控制台看 `/api/stats` 的状态码 —— `503` 就是 D1 没绑好，`404` 说明
这次部署没有带上 `functions/`；④ 本机 `npm run dev` 本来就没有 Pages Function，
显示「（本机）」是预期的。
详见 [浏览量的后端：Pages Function + D1](#浏览量的后端pages-function--d1)。

**配了 `apiBase` 却出现跨域 / 请求失败**
本站的浏览数接口是**同源**的 `/api`（Pages Function），本来就不存在跨域。
如果你填的是某个 `https://xxx.workers.dev`（旧的 Worker 方案）才会遇到 CORS，
那是 Worker 的 `ALLOWED_ORIGIN` 白名单没放行当前域名。
用 `/api` 却失败的话，看 `/api/stats` 的状态码：`503` = D1 没绑好，
`404` = 这次部署没带上 `functions/`。

**文章头部的点赞数一直是占位符「—」**
它读的是评论区那条 Discussion 上的 **GitHub 反应数**，
要等 giscus iframe 加载完成后才有值。一直不出现就查三处：① 评论区本身渲染出来了吗；
② 那条 discussion 创建了没（第一条评论发出后才会创建）；
③ giscus 版本太旧不支持 `data-emit-metadata`。
没配 Giscus 时用的是本机点赞，本来就只有这台电脑有 —— 那是预期行为。

**站长回复了，但页面上还是旧样子**
启用 Giscus 后回复是**立刻生效**的（评论本来就在 Discussions 上），刷新即可看到。
只有**没配 Giscus** 时才走「提交进仓库」那条路 —— 那时要等 Cloudflare 重新构建
（约 1–2 分钟）才会出现在所有人的页面上，你本机会先看到一条带「待构建」标记的临时版本。

**点「回复」没反应 / 提示「只有站长可以回复或删除评论」**
这条只在「没配 Giscus + 部署了 `workers/blog-api`」时出现：服务会拿浏览器里的
GitHub Token 去问 GitHub「你对这个仓库有 push 权限吗」（看仓库详情的
`permissions.push`），不是站长就返回 403 且一个字节都不写。
检查：token 是不是 **fine-grained**、有没有勾中这一个仓库、
有没有给 `Contents: Read and write`。
本站启用 Giscus 之后不在这个流程里 —— 回复直接在 GitHub Discussions 里做。

**列表页卡片的缩略图 404，但点进文章图是好的**
两者的地址由同一个 `resolveImageSrc()` 生成，理论上不会不一致。
真出现的话先确认图片确实提交到了 `public/images/`（`git status` 看一眼），
再确认子路径部署时 `NEXT_PUBLIC_BASE_PATH` 是构建时设的而不是运行时设的。

**`cover` 填了但卡片上没变化**
`cover` 要写在 frontmatter 里（不是正文里），值必须是站内绝对路径
（`/images/x.jpg`）或 http(s) 外链；`data:` 内联图片会被忽略。
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
| **浏览数** | ✅ | Cloudflare **Pages Function + D1**（同源 `/api`）；没绑 D1 时退回本机并标注「（本机）」 |
| **文章点赞** | ✅ | 评论区那条 Discussion 上的 **GitHub 反应数** —— 真实全站，计数存在 GitHub 侧，不怕突发流量 |
| **评论区** | ✅ | 走 Giscus（GitHub Discussions）：文章底部 + 右侧留言板，登录 GitHub 即可评论 |
| **留言与评论的回复** | ✅ | 在 GitHub Discussions 里回复；数据与文字都在自己的仓库里，可随时导出 |
| **列表页缩略框配图** | ✅ | `cover` 当卡片背景；没有封面时自动展示正文前 4 张图的缩略图带 |
| Giscus 评论 | ✅ | 已接入并**在本站启用**：文章底部与留言板都用它（代码默认值仍为 `null`，fork 需自行配置 + 装 App） |
| 后端 API | ⬜ | 纯静态方案；只有一个同源的浏览量接口（Pages Function + D1）算半个后端 |
| 并发下的精确计数 | ✅ | D1 用 `count = count + 1` 原子自增，不会互相覆盖 |
| 浏览量的防刷 | ⬜ | `/api/hit` 没有鉴权，可以被脚本刷；浏览量本就是模糊指标，个人博客不做这个投入 |

### 已知取舍

- **访客偏好不跨设备**：这是有意的设计，不是缺陷。访客偏好存 `localStorage`，
  站点默认值存仓库 —— 想让某个设置跟着自己走，就把它保存成站点默认值。
- **没配 Giscus 时，留言与评论只存在本机 `localStorage`**，站长看不到、也回复不了。
  界面上如实写明了这一点，并给了出路（配置 Giscus / 部署互动服务 / 发邮件）。
  本站已启用 Giscus，所以评论与留言都在 GitHub Discussions 上，站长**看得到、回得了**。
- **回复的身份交给 GitHub 把着**：评论就是 Discussions，站长在那里回复（会收到通知），
  任何有 GitHub 账号的人也能接力回复 —— 但**没人能冒充站长**，因为身份由 GitHub 鉴权。
  没配 Giscus 时才有「只有站长能回复」那条老规则：回复写进仓库文件，
  没有仓库写权限就提交不上去。详见 [留言与评论怎么回复](#留言与评论怎么回复)。
- **浏览数的后端是可选的**：没绑 D1 就显示「（本机）」，页面照样能用。
  旧方案用的 Workers KV 没有事务、每天只有 1000 次写 —— 那才是「访问一上来就崩」的原因，
  换成 Pages Function + D1 就是为了解决它（10 万写/天、自增原子、与页面同源）。
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

1. **构建期预处理**：写个脚本用 `sharp` 把 `public/images/` 里的图压成 WebP
   并生成多尺寸，缺点是构建变慢、要自己维护
2. **外部图床 / CDN**：`images: { loader: "custom", loaderFile: "./image-loader.ts" }`
   指向 Cloudinary 之类的服务，缺点是多一个外部依赖
3. **换成有服务端的托管**：放弃纯静态，缺点与本项目定位冲突

三条都不是「免费的午餐」，目前仓库里也还没有任何图片，所以先不做。

</details>
