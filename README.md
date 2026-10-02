# 华城博客 · hua-cheng-blog

一个**纯静态**的个人博客：内容写在 MDX 里，后台用 TinaCMS 编辑，
构建产物直接托管到 Cloudflare Pages。

- 前台：<http://localhost:3000>
- 后台：<http://localhost:3000/admin>
- 部署：`git push` 之后 Cloudflare Pages 自动重新构建

> **两份文档的分工**
> 这份 README 讲**怎么用**：跑起来、写文章、改配置、部署。
> 想了解**为什么这样设计**（架构取舍、踩过的坑、被否决的方案），看 [design.md](design.md)。

## 目录

- [它是什么](#它是什么) · [快速开始](#快速开始) · [目录结构](#目录结构)
- [写一篇新文章](#写一篇新文章) · [界面说明](#界面说明) · [壁纸](#壁纸)
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
| 后台 | TinaCMS 3 | 网页编辑器，保存即提交 GitHub |
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
│   │   └── not-found.tsx           404
│   ├── components/                 界面组件
│   │   ├── BlogLayout.tsx          应用外壳：顶栏 + 三栏布局
│   │   ├── TopBar.tsx              主题 / 设置 / 留言开关
│   │   ├── Sidebar.tsx             可隐藏、可拖拽宽度的导航
│   │   ├── ContentArea.tsx         内容区
│   │   ├── MessagePanel.tsx        可隐藏留言区
│   │   ├── WallpaperLayer.tsx      全屏壁纸层（fixed + -z-10）
│   │   ├── SettingsPanel.tsx       外观设置抽屉
│   │   ├── WallpaperSettings.tsx   壁纸设置（预设 / 外链 / 上传）
│   │   ├── MdxContent.tsx          MDX 渲染容器
│   │   ├── BilibiliVideo.tsx       B 站视频嵌入
│   │   ├── AudioPlayer.tsx         单曲播放器
│   │   ├── MusicPlayer.tsx         侧栏迷你播放器
│   │   └── Callout.tsx             MDX 提示框
│   ├── hooks/                      持久化状态、断点判断
│   ├── lib/
│   │   ├── posts.ts                构建期读取 content/posts（Node API）
│   │   ├── site.ts                 站点常量（客户端可安全引用）
│   │   ├── wallpaper.ts            壁纸预设、解析、图片压缩
│   │   ├── music.ts                歌单
│   │   └── utils.ts                日期与 className 工具
│   └── mdx-components.tsx          MDX 全局组件注册
├── content/posts/*.mdx             文章本体
├── public/uploads/                 TinaCMS 上传目录（图片、音频）
├── scripts/tina.mjs                TinaCMS 启动器（把编译临时目录放进项目内）
├── tina/config.ts                  内容模型定义
└── next.config.ts                  静态导出 + MDX 插件
```

---

## 写一篇新文章

### 方式一：网页后台

打开 `/admin`，新建「博客文章」，填标题、日期、标签，写完点保存。
本地开发时保存在文件系统，连上 TinaCloud 之后会通过 GitHub API 直接提交到仓库。

### 方式二：直接写文件

在 `content/posts/` 下新建 `my-post.mdx`：

```mdx
---
title: 文章标题
date: 2025-06-18
tags: [Next.js, MDX]
summary: 列表页显示的一段摘要，可省略（省略时自动截取正文首段）
author: 华城
draft: false
---

## 小标题

正文……支持 **Markdown** 与 JSX。
```

`draft: true` 的文章只在本机 `npm run dev` 时可见，`next build` 时会自动过滤掉。

### MDX 里可以直接用的组件

| 写法 | 作用 |
| --- | --- |
| `<BilibiliVideo bvid="BV1xx411c7mD" title="说明" />` | B 站视频，`loading="lazy"` |
| `<AudioPlayer src="/uploads/bgm.mp3" title="曲名" artist="作者" />` | HTML5 音频播放器 |
| `<Callout type="tip" title="小技巧">…</Callout>` | 提示框（`info` / `tip` / `warning` / `danger`） |

它们都在 `src/mdx-components.tsx` 里全局注册，**不需要 import**。
文章内的 `h2` / `h3` 会自动获得锚点，目录（TOC）由 `src/lib/posts.ts`
里的 `extractToc()` 生成，和 `rehype-slug` 使用同一套 slug 规则。

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

- **左侧导航**：桌面端可整体隐藏，右边缘拖拽可调宽度（220–400px）
- **右侧留言区**：可隐藏；留言保存在浏览器 `localStorage`
- **主题**：浅色 / 深色，首次访问跟随系统；`<head>` 里有内联脚本防闪屏
- **壁纸**：内置预设 / 外链 / 本地上传，可调强度与模糊（见下文「壁纸」一节）
- **设置**：主题、字号、壁纸、内容区宽度、导航宽度，全部持久化到本地

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

## 壁纸

### 怎么用

点右上角**设置** → **壁纸**，有三种来源：

| 方式 | 说明 |
| --- | --- |
| 内置预设 | 7 套纯 CSS 渐变/网格（水墨、蓝图、纸纹、木棉、岭南、珠江夜、暮色）+「无」 |
| 图片直链 | 粘贴 `https://…`、`/uploads/bg.jpg` 或 `data:image/…` |
| 上传本地图片 | 选一张本地图片，浏览器内压缩后存进 `localStorage`，**不会上传到任何服务器** |

另外还有两个滑杆：

- **壁纸强度**（0–100%）：越低遮罩越浓，把壁纸推远，保证正文可读；拉到最左等于关闭
- **模糊**（0–24px）：虚化背景，让前景更聚焦

> **提示**：有壁纸时，外壳、顶栏、左侧导航、留言区会自动变成毛玻璃
> （半透明 + `backdrop-blur`），壁纸才能真正透出来。

### 改站点默认壁纸

访客没设置过时使用 `DEFAULT_WALLPAPER`。想换默认值，改
[src/lib/wallpaper.ts](src/lib/wallpaper.ts) 即可：

```ts
export const DEFAULT_WALLPAPER: WallpaperSettings = {
  source: "preset",
  presetId: "ink",   // ← 换成 "none" 就没有默认壁纸；也可填 "kapok" / "lingnan" …
  url: "",
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
外链和本地上传两条路都已经留好了。

### 实现上的两个要点

**1. 壁纸层为什么是 `-z-10`**

按 CSS 的绘制顺序，`position: fixed` 且 `z-index: 0` 的元素会盖在正文上面。
所以外层容器加了 `isolate`（建立新的层叠上下文），壁纸层用负的 `-z-10`，
这样它画在「容器底色之上、其它内容之下」，既盖住底色又不压住正文。

**2. 上传的图片会被压缩**

`localStorage` 一般只有 5MB，转成 base64 还会膨胀约 1/3。
`compressImageFile()` 会按 `1920/0.82 → 1600/0.72 → 1280/0.62` 逐级降级，
仍然超限就明确报错，而不是静默写入失败。写入前还会用
`canPersistDataUrl()` 真实试写一次，避免「看起来成功了，刷新就没了」。

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
| `NEXT_PUBLIC_TINA_CLIENT_ID` | TinaCloud 项目 ID | 要用后台就填 |
| `TINA_TOKEN` | TinaCloud 读写 token | 要用后台就填 |

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
3. 项目设置里能拿到：
   - **Client ID** → 填给 `NEXT_PUBLIC_TINA_CLIENT_ID`
   - **Read Only Token** → 只读场景用
   - **Read/Write Token** → **构建和写作都需要它**，填给 `TINA_TOKEN`
4. 本地写进 `.env.local`；线上写进部署平台的环境变量
5. 重新部署，然后访问 `https://<你的域名>/admin/index.html`

为什么构建也需要读写 token：`tinacms build` 会顺带把内容**索引**上传到 TinaCloud，
这样后台里的搜索和关系字段才能工作。

> `TINA_TOKEN` 是敏感信息，不要提交到仓库。
> [.gitignore](.gitignore) 已经忽略了除 `.env.example` 之外的所有 `.env*` 文件。

### 部署后自查清单

| 检查 | 期望 |
| --- | --- |
| 首页 | 正常渲染，样式没丢 |
| 随便点进一篇文章 | 目录能跳转、上下篇正常、代码块有样式 |
| 刷新文章页 | 直接访问不 404（`trailingSlash` 生效） |
| 访问 `/rss.xml` | 返回 XML，浏览器不下载而是直接显示 |
| 访问一个不存在的地址 | 显示自定义 404 |
| 切深色模式并刷新 | 不闪白屏 |
| `view-source` 看 `<head>` | 有 `hc-blog:theme` 那段内联脚本 |
| 手机打开 | 侧栏和留言区变成抽屉，能正常开关 |
| 想要后台的话 | `/admin/index.html` 能打开编辑器 |

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
| 音乐播放 | ✅ | 侧栏播放器 + MDX 内嵌播放器 |
| 标签 / 归档 | ✅ | 标签总览、标签详情、年份归档 |
| RSS 订阅 | ✅ | `/rss.xml`，构建期生成，无需后端 |
| 自定义壁纸 | ✅ | 7 套内置预设 / 外链图片 / 本地上传，可调强度与模糊 |
| 深浅色主题 | ✅ | 跟随系统 / 浅色 / 深色，无闪屏 |
| 评论系统 | ⬜ | 现为浏览器本地留言板；要真评论请接 Giscus |
| 站内搜索 | ⬜ | 建议用 Pagefind 在构建期生成索引，无需后端 |
| 后端 API | ⬜ | 纯静态方案，需要时再加 Workers + D1 |

### 已知取舍

- 留言板只存在本机 `localStorage`。纯静态站点没有服务端，
  这是不做后端时的必然结果，界面上已经写清楚了。
- 代码块暂时没有语法高亮（引入 Shiki 会明显增加构建时间）。
- 文章配图使用原生 `<img>` + `loading="lazy"`，
  因为静态导出下 `next/image` 的默认优化器不可用。
