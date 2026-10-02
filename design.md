# 华城博客 · 设计文档

> **这份文档回答「为什么这样建」。**
> 怎么跑起来、怎么写文章、怎么部署，见 [README.md](README.md)。
> 两者刻意分开：README 会随着操作步骤变，设计文档只在架构变了才改。

---

## 一、需求与约束

### 四条互相打架的需求

项目一开始就定了四条硬需求：

| 需求 | 含义 |
| --- | --- |
| 网页后台直接写作 | 想改一个错别字，不该走一遍完整的部署流程 |
| 国内访问快 | 页面和字体不能依赖被墙的 CDN |
| 免费托管 | 不打算为个人博客付服务器钱 |
| 源码可公开 | 仓库本身就是作品的一部分 |

这四条其实互相冲突：**网页后台意味着要有服务端**，而服务端意味着不能纯静态、
不能白嫖 CDN、不能零成本。

转折点是 TinaCMS。它把「后台」做成了一个**纯前端应用**：
编辑器跑在浏览器里，保存时直接调 GitHub API 提交到仓库。
于是「网页后台」这件事不再需要我维护任何常驻进程。

### 结论：静态站点

|  | 静态网站 | 动态网站 |
| --- | --- | --- |
| **内容生成时机** | 构建时提前生成 | 用户访问时实时生成 |
| **服务器做什么** | 直接发送已生成的文件 | 执行代码、查询数据库、拼接页面 |
| **页面内容** | 所有人看到的一样 | 不同用户可能看到不同内容 |
| **典型例子** | 个人博客、文档站、企业官网 | 淘宝、微博、B站（登录后内容不同） |
| **需要后端** | ❌ 不需要 | ✅ 必须 |
| **访问速度** | ⚡ 极快（文件直接下发） | 较慢（需要计算） |
| **服务器成本** | 极低（CDN 分发即可） | 较高（需要持续运行服务器） |

判断标准很简单：**内容的更新频率远低于页面的读取频率，就该选静态。**
我的文章一天最多改几次，但页面一天要被读很多次——而 CDN 恰好最擅长后者。

---

## 二、文件类型速查

| 文件类型 | 一句话 | 类比 |
| --- | --- | --- |
| `.html` | 网页骨架 | 毛坯房的承重墙 |
| `.css` | 网页皮肤 | 装修（颜色、材质、灯光） |
| `.js` | 网页动作 | 电器开关、门窗开合 |
| `.ts` | 带说明书的 JS | 有安全认证的电器 |
| `.jsx` | JS 里写 HTML | 会动的设计图纸 |
| `.tsx` | TS 里写 HTML | 带安全认证的设计图纸 |
| `.json` | 数据配置 | 产品参数表 |
| `.mdx` | 能写 JSX 的 Markdown | 可以现场改结构的设计图纸 |

---

## 三、技术栈总览

以下版本号为 `package.json` 中实际锁定并验证过的版本。

| 层级 | 技术 | 版本 | 作用 |
| --- | --- | --- | --- |
| 框架 | Next.js（App Router） | 16.2.6 | 路由与静态导出 |
| UI 库 | React | 19.2.4 | 组件化开发 |
| 语言 | TypeScript | 5.6.3 | 类型安全 |
| 样式 | Tailwind CSS | 4.3.0 | 原子化 CSS，主题写在 `@theme` 里 |
| 内容格式 | MDX | `@next/mdx` 16.3.8 | Markdown + React 组件 |
| 内容管理 | TinaCMS | 3.8.1 / CLI 2.3.1 | 网页编辑器，保存即提交 GitHub |
| 版本存储 | GitHub | — | 源码与文章仓库 |
| 托管 | Cloudflare Pages | — | 全球 CDN，国内速度较好 |
| 视频嵌入 | Bilibili iframe | — | 国内可直接播放、免流量 |
| 图标 | lucide-react | 1.16.0 | 按需 tree-shaking 的图标 |
| 包管理 | npm | 10.9.2（Node 22.14） | 依赖管理 |

> **和初版设计稿的两处偏差**
> 1. 设计稿写的是 Next.js 15，实际用的是 16——文档规则要求先读
>    `node_modules/next/dist/docs/`，那里已经是 16 的文档。
> 2. 设计稿列了 `shadcn/ui` 和 `tailwind.config.ts`。前者没引入（见第十四节），
>    后者在 Tailwind v4 里已不存在——主题配置搬进了 CSS 本身。

---

## 四、架构

### 4.1 构建期 vs 运行期

这是整个项目最重要的一张图。**同一份代码，在构建期做的事和运行期做的事完全不同。**

```text
构建期（next build，跑在 Node 里）                 运行期（用户浏览器）
─────────────────────────────────────         ─────────────────────────
读 content/posts/*.mdx                         接收 CDN 发来的静态 HTML
  ↓ gray-matter 解析 frontmatter                  ↓
  ↓ 过滤 draft                                   下载 _next/static 下的 JS/CSS
  ↓ 计算阅读时长 / 目录 / 相关文章                  ↓
  ↓                                              React 接管交互：
编译 MDX → React 组件                              · 主题切换、侧栏开合
  ↓                                                · 壁纸、字号等偏好
渲染成 HTML（每个路由一份）                          · 留言板
  ↓                                                · 视频/音频播放
写进 out/ 目录
                                                服务器全程只做一件事：
                                                把已经生成好的文件发出去，
                                                不执行任何代码、不查任何数据库。
```

### 4.2 数据流

```text
                 ┌──────────────────────────────┐
                 │  content/posts/*.mdx          │  ← 唯一的真相来源
                 │  （frontmatter + 正文）        │
                 └───────────┬──────────────────┘
                             │
        ┌────────────────────┴────────────────────┐
        │                                          │
   src/lib/posts.ts                        @next/mdx 编译
   （构建期读文件，Node API）                 （h2/h3 自动加 id）
        │                                          │
   PostMeta[]（纯数据）                      React 组件树
        │                                          │
        ├──────────────┬───────────────┐            │
        ↓              ↓               ↓            ↓
    首页/列表      侧栏「最近文章」   标签/归档   文章详情页
        │              │               │            │
        └──────────────┴───────┬───────┴────────────┘
                               ↓
                     src/app/layout.tsx（服务端）
                               ↓
                     BlogLayout（客户端外壳）
                               ↓
                          静态 HTML
```

关键约束：`src/lib/posts.ts` 用了 `node:fs`，**只能被服务端组件引用**。
一旦某个文件顶部写了 `"use client"`，再 import 它就会把 `fs` 打进浏览器 bundle，
构建直接失败。所以站点常量被拆到了 `src/lib/site.ts`，客户端组件只引用那一个。

### 4.3 为什么没有后端

| 需要后端的场景 | 本项目的处理 |
| --- | --- |
| 保存文章 | TinaCMS 直接调 GitHub API |
| 评论 | 用浏览器 `localStorage` 做留言板（明确标注是本机留言） |
| 搜索 | 未实现；建议用 Pagefind 在构建期生成索引 |
| 阅读量统计 | 未实现；建议用 Cloudflare Workers + D1 或 Umami |
| 动态内容 | 不需要——所有访客看到的内容都一样 |

真正的临界点是「**开始需要每个用户看到不同内容**」。到那一天再加 Worker 也不迟。

---

## 五、项目结构

```text
hua-cheng-blog/
├── src/
│   ├── app/                          Next.js App Router
│   │   ├── layout.tsx                根布局：内联主题脚本 + 把外壳包起来
│   │   ├── globals.css               Tailwind v4 主题令牌 + 文章排版
│   │   ├── page.tsx                  首页：Hero + 最新文章 + 标签云
│   │   ├── posts/
│   │   │   ├── page.tsx              全部文章
│   │   │   └── [slug]/page.tsx       文章详情（构建期 import MDX）
│   │   ├── tags/
│   │   │   ├── page.tsx              标签总览
│   │   │   └── [tag]/page.tsx        标签详情
│   │   ├── archive/page.tsx          按年份归档
│   │   ├── about/page.tsx            关于（技术栈与能力边界）
│   │   ├── contact/page.tsx          联系方式
│   │   ├── rss.xml/route.ts          RSS（构建期渲染成静态 XML）
│   │   └── not-found.tsx             404
│   │
│   ├── components/                   界面组件
│   │   ├── BlogLayout.tsx            ★ 应用外壳：持有全部偏好状态
│   │   ├── TopBar.tsx                顶栏：导航/留言/主题/设置
│   │   ├── Sidebar.tsx               左侧导航（可隐藏、可拖拽调宽）
│   │   ├── ContentArea.tsx           中间内容区
│   │   ├── MessagePanel.tsx          右侧留言区（可隐藏）
│   │   ├── SettingsPanel.tsx         设置抽屉（外观 + 布局）
│   │   ├── WallpaperLayer.tsx        ★ 全屏壁纸层
│   │   ├── WallpaperSettings.tsx     壁纸设置（预设/外链/上传）
│   │   ├── MdxContent.tsx            MDX 渲染容器（只负责套 .article）
│   │   ├── BilibiliVideo.tsx         B 站视频嵌入
│   │   ├── AudioPlayer.tsx           单曲播放器
│   │   ├── MusicPlayer.tsx           侧栏迷你播放器
│   │   ├── Callout.tsx               提示框（MDX 全局组件）
│   │   ├── PostCard.tsx              文章卡片
│   │   ├── TagBadge.tsx              标签徽标
│   │   ├── TableOfContents.tsx       文章目录（原生 <details>）
│   │   ├── ReadingProgress.tsx       顶部阅读进度条
│   │   └── PageHeader.tsx            页面标题 / 空状态
│   │
│   ├── hooks/
│   │   ├── usePersistentState.ts     ★ localStorage ⇄ React 状态
│   │   └── useMediaQuery.ts          断点判断
│   │
│   ├── lib/
│   │   ├── posts.ts                  ★ 构建期内容层（Node API）
│   │   ├── site.ts                   站点常量（客户端可安全引用）
│   │   ├── wallpaper.ts              壁纸预设、解析、图片压缩
│   │   ├── music.ts                  歌单
│   │   └── utils.ts                  日期/数字/className 工具
│   │
│   └── mdx-components.tsx            MDX 全局组件注册（Next 约定文件）
│
├── content/posts/*.mdx               文章本体
├── public/
│   ├── uploads/                      TinaCMS 上传目录
│   ├── admin/                        TinaCMS 后台（构建产物，不入库）
│   ├── _headers                      Cloudflare Pages 缓存策略
│   └── .nojekyll                     GitHub Pages 用（别让 Jekyll 吃掉 _next）
├── scripts/tina.mjs                  TinaCMS 启动器（见 11.5）
├── tina/config.ts                    内容模型定义
├── next.config.ts                    静态导出 + MDX 插件 + basePath
├── postcss.config.mjs                Tailwind v4 的 PostCSS 桥
├── Dockerfile / nginx.conf           自建服务器部署
└── .env.example                      环境变量模板
```

---

## 六、内容模型

### 6.1 frontmatter 字段

`content/posts/*.mdx` 的 YAML 头，由 `src/lib/posts.ts` 读取：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `title` | string | ✅ | 标题；缺失时退化为文件名 |
| `date` | date | 建议 | 发布日期；缺失时用文件 mtime |
| `tags` | string[] | — | 支持 `[a, b]` 与 `a, b, c` 两种写法 |
| `summary` | string | — | 列表页摘要；缺失时自动截取正文首段 96 字 |
| `author` | string | — | 默认取站点作者 |
| `cover` | string | — | 封面图（预留给未来的卡片样式） |
| `draft` | boolean | — | `true` 时只在 `npm run dev` 可见 |

### 6.2 TinaCMS 字段映射

`tina/config.ts` 里的字段**必须和上表一一对应**，否则后台存出来的文章前台读不到。
这是两块代码之间唯一的耦合点，也是最容易出错的地方。

TinaCMS 的 `router` 指向 `/posts/${filename}`，所以保存后会跳转到前台对应地址。

### 6.3 草稿机制

```ts
const includeDrafts = options.includeDrafts ?? process.env.NODE_ENV !== "production";
```

`next build` 时 `NODE_ENV` 是 `production`，草稿被自动过滤——**同时也会从
`generateStaticParams` 里消失**，所以草稿连静态 HTML 都不会生成，不存在「生成了但没链接」
的漏网情况。

---

## 七、MDX 管线

### 7.1 编译链路

```text
content/posts/hello-world.mdx
      │
      │  @next/mdx（Turbopack loader）
      ├── remark-frontmatter   去掉 YAML 头（否则会被当成正文渲染）
      ├── remark-gfm           表格、任务列表、删除线
      ├── rehype-slug          给 h2/h3 自动加 id
      ↓
React 组件
      ↓  src/app/posts/[slug]/page.tsx
      │  const { default: Post } = await import(`@/content/posts/${slug}.mdx`)
      ↓
<MdxContent><Post /></MdxContent>      套上 .article 排版
```

**注意**：Turbopack 下 remark/rehype 插件只能用**字符串名**传递，不能用函数，
因为函数无法序列化给 Rust 侧。所以 `next.config.ts` 里写的是
`remarkPlugins: ["remark-frontmatter", "remark-gfm"]`。

### 7.2 目录与锚点如何对齐

这是本项目最容易出错的一处设计：

- 标题的 `id` 由 `rehype-slug` 在编译期生成
- 目录（TOC）的 `id` 由 `src/lib/posts.ts` 的 `extractToc()` 从**原始 Markdown** 生成

两边必须产出完全一样的结果，否则点目录跳不到位置。做法是**两边都用
`github-slugger`**：`rehype-slug` 内部就是它，`extractToc()` 直接 import 同一个包。
不自己写 slug 函数，是因为中文标点和重复标题去重（`-1` / `-2`）的规则很容易写歪。

`extractToc()` 还需要跳过代码块里的 `#` 注释，所以维护了一个 `inFence` 状态。

### 7.3 全局组件

`src/mdx-components.tsx` 是 Next 的约定文件，**必须导出 `useMDXComponents`**。
Next 16 里这个函数**不接受任何参数**，直接返回组件表（老版本签名不同）。

注册进去的组件在 MDX 里可以直接写标签名，不用 import：

| 组件 | 用途 |
| --- | --- |
| `<BilibiliVideo bvid="…" />` | B 站视频，`loading="lazy"` 的 16:9 iframe |
| `<AudioPlayer src="…" />` | HTML5 音频播放器 |
| `<Callout type="tip">…</Callout>` | 提示框（info / tip / warning / danger） |
| `h2` `h3` `h4` | 覆盖为带悬停 `#` 锚点的版本 |
| `a` | 外链自动加 `target="_blank" rel="noopener"` |
| `img` | 原生 `<img>` + `loading="lazy"`（静态导出下 `next/image` 优化器不可用） |
| `table` | 包一层横向滚动容器 |
| `kbd` | 快捷键样式 |

---

## 八、界面设计

### 8.1 设计图

![主页设计图](image/design_image/主页.png)

设计图上一共 6 个标注，全部实现：

| 标注 | 实现 |
| --- | --- |
| 隐藏按钮（左上） | `TopBar` 里的 `PanelLeft` / `PanelLeftClose` |
| 主题（右上） | `TopBar` 里的太阳/月亮按钮 |
| 设置（右上） | `TopBar` → `SettingsPanel` 抽屉 |
| 可隐藏导航预留空间（左） | `Sidebar`，可隐藏 + 右缘拖拽调宽 220–400px |
| 内容（中） | `ContentArea` |
| 可隐藏留言区（右，含自己的隐藏按钮） | `MessagePanel` |

### 8.2 布局

```text
┌────────────────────────────────────────────────┐
│ [隐藏]  logo              留言  主题  设置     │  ← TopBar  h-14
├──────────┬──────────────────────┬──────────────┤
│ 可隐藏导航│        内容          │ 可隐藏留言区 │
│ （可拖拽）│                      │              │
└──────────┴──────────────────────┴──────────────┘
```

实现要点：

- 桌面端左右两栏是**弹性子元素**，靠 `width` 过渡挤压中间，不需要计算 `margin`
- 移动端（< 1024px）两栏变成**覆盖式抽屉**，带半透明遮罩
- 断点判断用 `useMediaQuery("(min-width: 1024px)")`，服务端返回 `false`
- 收起时用 `inert` 禁止键盘 focus 进入，否则 Tab 会跳进看不见的链接

### 8.3 设计令牌

全部写在 `src/app/globals.css` 的 `@theme` 里，是真正的 CSS 变量：

| 令牌 | 值 | 含义 |
| --- | --- | --- |
| `--color-brand-500` | `#e4513a` | 木棉红——广州的市花 |
| `--color-jade-500` | `#17947e` | 岭南青，用于「提示」类语义色 |
| `--font-sans` | PingFang SC / Microsoft YaHei … | 系统中文字体栈，**不外链字体** |
| `--shadow-card` | 双层柔和阴影 | 卡片 |
| `--shadow-float` | 大范围投影 | 浮层/抽屉 |
| `--animate-fade-up` | 0.45s 上浮淡入 | 卡片入场 |

选木棉红而不是「随便挑一个蓝」，是因为它和站点名字（花城）有关系——
有理由的颜色更容易长期坚持。

### 8.4 毛玻璃与壁纸

有壁纸时，外壳 / 顶栏 / 侧栏 / 留言区会切成半透明 + `backdrop-blur`，
让壁纸真正透出来。否则壁纸只会露在 `sm:p-3` 的缝隙里，等于白做。

切换方式是把 `frosted` 布尔值传给这几个组件，而不是用 CSS 全局选择器——
显式传参比暗中依赖 DOM 结构更好维护。

### 8.5 响应式策略

只有两个断点：`sm`（640px，外壳出现圆角与内边距）和 `lg`（1024px，侧栏从抽屉变固定）。
再多的断点对个人博客是过度设计。

---

## 九、状态与持久化

### 9.1 localStorage 清单

纯静态站点没有账号系统，所有访客偏好只能存在浏览器里。

| key | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `hc-blog:theme` | `"system"｜"light"｜"dark"` | `system` | 主题偏好 |
| `hc-blog:font-scale` | `"sm"｜"md"｜"lg"` | `md` | 正文字号（改 `html` 的 font-size） |
| `hc-blog:content-width` | `"comfortable"｜"wide"` | `comfortable` | 内容区最大宽度 |
| `hc-blog:sidebar-open` | boolean | `true` | 桌面端侧栏是否展开 |
| `hc-blog:sidebar-width` | number | `272` | 侧栏宽度 |
| `hc-blog:message-open` | boolean | `false` | 桌面端留言区是否展开 |
| `hc-blog:wallpaper` | object | 见 10.2 | 壁纸设置 |
| `hc-blog:messages` | array | 内置示例 | 本机留言 |
| `hc-blog:visitor-name` | string | `""` | 留言昵称 |

### 9.2 为什么用 `useSyncExternalStore`

最初的实现是 `useState` + `useEffect` 里 `setState`，有两个问题：

1. **React 19 的 `react-hooks/set-state-in-effect` 规则直接报错**，
   指出这会造成级联渲染
2. hydration 时服务端和客户端首帧不一致，容易闪一下

`localStorage` 本质上就是「React 之外的数据源」，正是 `useSyncExternalStore` 的适用场景：

- `getServerSnapshot()` 返回默认值 → hydration 不会不匹配
- hydration 之后浏览器立刻读到真实值并重渲染
- `getSnapshot()` 按**原始字符串缓存**解析结果，保证引用稳定、不会无限循环
- 顺带支持了多标签页同步（监听 `storage` 事件）

`useMediaQuery` 同理——`matchMedia` 也是外部数据源。

### 9.3 主题防闪屏

如果只靠 `useEffect` 给 `<html>` 加 `.dark`，深色用户一定会看到一闪而过的白屏。

唯一的解法是在 `<head>` 里放一段**同步执行的内联脚本**，
在浏览器绘制之前就把类名和 `font-size` 改好
（见 `src/app/layout.tsx` 的 `THEME_SCRIPT`）。

脚本要能处理三种情况：`localStorage` 里有明确值 → 用它；没有 → 读系统偏好；
`localStorage` 被禁用 → 静默降级，不能让脚本抛错把页面卡住。

React 侧则用一个 `themeApplied` ref **跳过第一次 effect**——
因为 DOM 已经被内联脚本改好了，React 再动一次反而会把白屏闪出来。

---

## 十、壁纸子系统

### 10.1 三种来源

| 来源 | 实现 | 取舍 |
| --- | --- | --- |
| 内置预设 | 7 套纯 CSS 渐变/网格 | 零网络请求、零解码成本 |
| 图片直链 | 存 URL，交给浏览器加载 | 灵活，但受对方站点可用性影响 |
| 本地上传 | Canvas 压缩成 data URL 存 localStorage | 不依赖任何外部服务 |

内置预设刻意**不用图片**：外链图床在国内经常打不开，一张 4K 大图还会明显拖慢首屏。

### 10.2 数据结构

```ts
interface WallpaperSettings {
  source: "preset" | "url" | "upload";
  presetId: string;   // source === "preset" 时生效，含特殊的 "none"
  url: string;        // source === "url"
  dataUrl: string;    // source === "upload"
  strength: number;   // 0–100，越低遮罩越浓（把壁纸推远，保证正文可读）
  blur: number;       // 0–24px
}
```

`resolveWallpaper()` 是纯函数：`(settings, isDark) → { backgroundImage, label } | null`。
返回 `null` 表示不显示壁纸——**这个函数同时被渲染层和「是否毛玻璃」的判断使用**，
保证两处永远一致。

### 10.3 为什么壁纸层是 `-z-10`

按 CSS 的绘制顺序（CSS 2.1 附录 E），`position: fixed` 且 `z-index: 0` 的元素
画在**行内内容之上**——壁纸会直接把正文盖住。

所以外层容器加了 `isolate`（`isolation: isolate`）建立新的层叠上下文，
壁纸层用负的 `-z-10`。这样它画在「容器底色之上、其它内容之下」，
既盖住页面底色，又不压住正文。

### 10.4 上传图片的压缩

`localStorage` 一般只有 5MB，转成 base64 还会膨胀约 1/3。所以：

```text
1920 / q0.82  →  1600 / q0.72  →  1280 / q0.62  →  仍然超限就明确报错
```

并且写入前用 `canPersistDataUrl()` **真实试写一次**再删掉，
避免「看起来保存成功了，刷新就没了」这种最难查的问题。

---

## 十一、关键配置

### 11.1 `next.config.ts`

```ts
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",                       // 生成静态 HTML
  images: { unoptimized: true },          // 静态导出必须关掉默认图片优化
  trailingSlash: true,                    // 产物是 posts/x/index.html
  basePath,                               // GitHub Pages 子路径部署用
  assetPrefix: basePath || undefined,
  pageExtensions: ["js", "jsx", "ts", "tsx", "md", "mdx"],
};

export default createMDX({
  options: {
    remarkPlugins: ["remark-frontmatter", "remark-gfm"],
    rehypePlugins: ["rehype-slug"],
  },
})(nextConfig);
```

**`trailingSlash: true` 的意义**：产物是 `posts/hello-world/index.html`，
任何静态服务器（含 Cloudflare Pages、GitHub Pages、Nginx）都能直接按目录找到它，
**不需要写任何 rewrite 规则**。

### 11.2 `src/app/globals.css`

Tailwind v4 把配置搬进了 CSS：

```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));   /* 类名驱动的深色模式 */

@theme {
  --color-brand-500: #e4513a;
  --font-sans: "PingFang SC", "Microsoft YaHei", …;
}
```

文章排版（`.article`）是手写的，没引入 `@tailwindcss/typography`——
这样中文的行高、标点、标题左侧色条都能精确控制，也少一个依赖。

### 11.3 `tina/config.ts`

要点三条：

1. `format: "mdx"` + `path: "content/posts"` 必须和内容层一致
2. `router` 指向 `/posts/${filename}`，保存后跳到前台
3. `media.mediaRoot: "uploads"` + `publicFolder: "public"`

### 11.4 环境变量

| 变量 | 何时需要 | 说明 |
| --- | --- | --- |
| `TINA_PUBLIC_IS_LOCAL` | 仅本地 | `true` 时用文件系统，不需要 TinaCloud 账号 |
| `NEXT_PUBLIC_TINA_CLIENT_ID` | 线上 | TinaCloud 项目 ID |
| `TINA_TOKEN` | 线上 | 读写 token，构建时用于内容索引 |
| `GITHUB_BRANCH` | 可选 | 默认 `main` |
| `NEXT_PUBLIC_BASE_PATH` | 可选 | 子路径部署（GitHub Pages 项目页） |

### 11.5 `scripts/tina.mjs` 存在的理由

TinaCMS 会先用 esbuild 把 `tina/config.ts` 编译到
`os.tmpdir()/<时间戳>/config.build.jsx`，这个路径在它源码里是写死的。

在部分 Windows 环境（杀毒软件、受控文件夹访问、企业策略）下，
esbuild 这个原生二进制**没有权限写系统 `%TEMP%`**，于是报
`Failed to write to output file: … Access is denied`。
同一个目录用 Node 的 `fs` 却能写——说明是进程级限制，跟项目代码无关。

Node 的 `os.tmpdir()` 在 Windows 上优先读 `TEMP`，所以启动器把它指向项目内的
`.tina-tmp/`，问题消失，顺带让构建变得自包含。详见 README 的疑难排查一节。

---

## 十二、性能与取舍

### 12.1 为了「国内快」做的事

| 措施 | 收益 |
| --- | --- |
| 不外链 Google Fonts | 少一次可能被墙的请求；`next/font/google` 在构建期也可能失败 |
| 视频走 B 站 iframe + `loading="lazy"` | 免流量，滚到位置才加载 |
| 图标按需引入 lucide-react | tree-shaking 后每个图标约 1KB |
| 内置壁纸用 CSS | 零请求、零解码 |
| 纯静态 + CDN | 文件直接下发，无计算 |
| 单页 JS 体积受控 | 没有引入动画/图表/富文本编辑器到前台 |

### 12.2 明确接受的代价

| 代价 | 为什么接受 |
| --- | --- |
| 不能用 Server Actions / ISR / cookies | 这些都需要常驻 Node 进程 |
| `next/image` 优化器不可用 | 博客配图少且已手动压过，多一层优化收益不大、多一个失败点 |
| 留言只存在本机 | 不做后端的必然结果，界面上已如实说明 |
| 代码块没有语法高亮 | 引入 Shiki 会明显拖慢构建，收益不成正比（待评估） |
| 搜索未实现 | 需要额外的索引方案，等文章量上来再说 |

---

## 十三、能力边界

| 能力 | 状态 | 说明 |
| --- | :---: | --- |
| 文章展示 | ✅ | 首页 + 列表 + 详情 + 目录 + 上下篇 + 相关文章 |
| 网页后台写作 | ✅ | TinaCMS，保存自动提交 GitHub |
| 国内访问速度 | ✅ | Cloudflare CDN，无外链字体与外链 JS |
| 视频播放 | ✅ | Bilibili iframe，懒加载 |
| 音乐播放 | ✅ | 侧栏播放器 + MDX 内嵌播放器 |
| 标签 / 归档 | ✅ | 标签总览、标签详情、年份归档 |
| RSS 订阅 | ✅ | `/rss.xml`，构建期生成 |
| 自定义壁纸 | ✅ | 7 套预设 / 外链 / 本地上传，可调强度与模糊 |
| 深浅色主题 | ✅ | 跟随系统 / 浅色 / 深色，无闪屏 |
| 评论系统 | ⬜ | 现为本机留言板；建议接 Giscus（GitHub Discussions，同样免费） |
| 站内搜索 | ⬜ | 建议用 Pagefind，构建期生成索引，无需后端 |
| 阅读量统计 | ⬜ | 建议 Cloudflare Workers + D1，或 Umami |
| 后端 API | ⬜ | 纯静态方案，需要时再加 Workers + D1 |

---

## 十四、关键决策记录

被否决的方案，以及否决的理由。这部分比「用了什么」更有参考价值。

### 14.1 为什么不用 Vercel

体验确实最好，但默认域名和部分 CDN 节点在国内访问不稳定。
Cloudflare Pages 免费额度更大、国内实测更稳。代价是构建产物必须纯静态。

### 14.2 为什么没引入 shadcn/ui

初版设计稿里列了它。实际做下来发现：

- 真正需要的组件只有按钮、滑块、分段控件、抽屉，都不到 50 行
- shadcn 的组件默认依赖 `radix-ui` + `class-variance-authority` + `clsx` + `tailwind-merge`
- 引入后要么为统一的视觉语言重写一遍，要么让站点看起来像「默认的 shadcn 站点」

结论：**组件数量少的时候，自己写比引入更省事**。等需要复杂交互组件
（对话框、命令面板、日期选择器）时再引入也不迟。

### 14.3 为什么不用 `next-mdx-remote`

`@next/mdx` 是官方方案，配 `generateStaticParams` + 静态导入即可，
不需要把 Markdown 源码传给运行时编译。`next-mdx-remote` 更适合
「内容来自 CMS API、构建期不可知」的场景，这里内容就在仓库里，用不上。

### 14.4 为什么主题默认是「跟随系统」而不是「浅色」

原来的实现里，主题默认写死 `light`，然后用一个 effect 去读系统偏好——
结果是**首次访问必然闪一下**。

改成三态（`system` / `light` / `dark`）之后，「跟随系统」变成了一个**推导**而不是一次副作用：

```ts
const theme = themePreference === "system"
  ? (systemPrefersDark ? "dark" : "light")
  : themePreference;
```

没有副作用，也就没有闪屏。

### 14.5 为什么留言板不做成「假的公共评论」

也可以做一个看起来像公共评论、实际每次刷新都重置的演示。但那是欺骗性的：
访客会以为自己的留言被发出去了。现在的做法是在界面上直接写明
「存在本机浏览器」，并在「联系」页给出接 Giscus 的具体路径。

**能做和该做是两件事。**

---

## 十五、后续可扩展点

按「投入产出比」排序：

1. **Giscus 评论** — 基于 GitHub Discussions，免费、无需后端，约 30 分钟
2. **Pagefind 搜索** — 构建期生成静态索引，前端零依赖加载，约 1 小时
3. **代码块语法高亮** — 先评估 Shiki 对构建时间的影响，可考虑只在文章页按需加载
4. **阅读量统计** — Cloudflare Workers + D1，需要开始引入后端概念
5. **文章封面图** — `cover` 字段已经预留，缺的是卡片样式
6. **OG 图片自动生成** — `next/og` 在构建期生成每篇文章的分享图
7. **多语言** — 目前没有需求，且会显著增加内容维护成本

---

## 附：验证记录

| 检查项 | 结果 |
| --- | --- |
| `tsc --noEmit` | 通过 |
| `eslint .` | 0 error / 0 warning |
| `next build`（根路径） | 通过，23 个 HTML + `rss.xml` 导出到 `out/` |
| `next build`（`NEXT_PUBLIC_BASE_PATH=/hua-cheng-blog`） | 通过，47 处资源引用与站内链接均正确加前缀 |
| `npm run dev` | TinaCMS 后台与前台均正常 |
| 路由冒烟测试 | 全部分页 200，未知路径正确 404 |
| 静态资源 | `_next/static` 下 JS/CSS 全部可达 |
| 部署产物 | `_headers` / `.nojekyll` / `rss.xml` / `404.html` 均进入 `out/` |

### 文档之外的验证方式

想自己复现，`out/` 起一个静态服务器即可：

```bash
npm run build
npx serve out          # 或 python -m http.server -d out 8080
```

重点看三件事：刷新文章页是否 404（`trailingSlash` 是否生效）、
`/rss.xml` 返回的是不是 XML、以及深色模式刷新有没有闪屏。
