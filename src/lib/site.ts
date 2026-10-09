import { ASSET_DIR_LIST } from "@/lib/assets";

/**
 * 站点级常量。
 *
 * 单独放一个文件，是为了让客户端组件也能安全引用，
 * 而不会把 `node:fs` 之类的服务端依赖打进浏览器 bundle。
 */
export const SITE = {
  name: "花城博客",
  shortName: "花城",
  description: "记录技术与生活 —— 一名开发者的写作空间",
  author: "花城",
  email: "1325882743@qq.com",
  location: "湖南 · 衡阳",
  url: "https://hua-cheng-blog.pages.dev",
  repository: "https://github.com/tiredliu/HuaCheng-Blog",
  startYear: 2026,
  /**
   * 头像与分享图，都是仓库里的静态文件（`public/` 下）。
   * 换头像只要替换 `public/avatar.png`，不用改代码。
   */
  avatar: "/avatar.png",
  avatarSmall: "/avatar-128.png",
  ogImage: "/og-cover.png",
} as const;

export const NAV_ITEMS = [
  { label: "首页", href: "/", icon: "house", description: "最新文章与站点概览" },
  { label: "文章", href: "/posts", icon: "file-text", description: "全部文章列表" },
  { label: "标签", href: "/tags", icon: "tag", description: "按主题浏览" },
  { label: "归档", href: "/archive", icon: "archive", description: "按时间浏览" },
  { label: "关于", href: "/about", icon: "user", description: "关于我和这个博客" },
  { label: "联系", href: "/contact", icon: "mail", description: "留言与联系方式" },
] as const;

/**
 * 子路径部署前缀（GitHub Pages 项目页会用到）。
 *
 * 构建时由 `next.config.ts` 读取同一个环境变量，
 * 两处必须一致，否则 `fetch()` 出来的静态资源会 404。
 */
export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");

/** 拼接站内静态资源路径，自动带上 basePath */
export function withBasePath(pathname: string): string {
  return `${BASE_PATH}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

/**
 * 把图片地址规整成浏览器真的能取到的地址。
 *
 * 除了补 `basePath`，这里还负责**容忍各种编辑器插入的写法** ——
 * 「图片显示不出来」最常见的两个原因，就是路径里多了 / 少了 `public`，
 * 以及 Windows 上插进来的是反斜杠。
 *
 * | 输入的写法 | 规整成 |
 * | --- | --- |
 * | `/images/x.jpg` | `/images/x.jpg`（带 basePath） |
 * | `public/images/x.jpg` | 同上 —— `public/` 就是站点的根目录 |
 * | `./public\images\x.jpg` | 同上（`./` 与反斜杠都会先被清理） |
 * | `images/x.jpg` | 同上（`images/` `wallpapers/` `music/` `lyrics/` `uploads/` 的前导斜杠都可以省） |
 * | `../../public/images/x.jpg` | `/images/x.jpg` —— Obsidian / Typora 插入的**相对**写法（编辑器直接能显示） |
 * | `https://…` / `data:…` / 其它 | 原样返回 |
 *
 * 目录清单来自 `src/lib/assets.ts`（`ASSET_DIR_LIST`），新增资源目录只要改那一处。
 *
 * ⚠️ 文章正文的 `<img>`、列表页的缩略图、frontmatter 的封面图
 * **必须都走这一个函数**，否则子路径部署时会出现
 * 「正文里好好的，列表页缩略图 404」这种很难查的不一致。
 */
export function resolveImageSrc(value: unknown): string | null {
  if (typeof value !== "string") return null;

  // Windows 上的编辑器可能插入反斜杠；URL 里不存在合法的反斜杠路径
  let src = value.trim().replace(/\\/g, "/");
  if (!src) return null;

  if (src.startsWith("./")) src = src.slice(2);

  /**
   * 去掉开头的 `../`。
   *
   * Obsidian 的仓库根目录是**仓库根**（`hua-cheng-blog`），而文章在 `content/posts/`，
   * 所以「新链接格式 = 相对路径」时它插入的是
   * `../../public/images/<文章名>_image/图.png` —— Typora 按文件相对路径也能解析到同一处。
   * 站点只认 `/images/…`，所以先把 `../` 剥掉，后面的 `public/` 规则才能接上。
   */
  while (src.startsWith("../")) src = src.slice(3);

  // `public/` 是 Next 的静态目录，也就是站点的根
  if (src.startsWith("/public/")) src = src.slice("/public".length);
  else if (src.startsWith("public/")) src = `/${src.slice("public/".length)}`;

  // 协议相对地址（`//example.com/a.png`）也是外链，不能当站内路径加前缀 ——
  // 否则会拼成 `/base//example.com/a.png` 这种取不到的地址。
  if (src.startsWith("//")) return src;

  if (src.startsWith("/")) return withBasePath(src);

  // 只省略了前导斜杠的资源路径（images/…、music/…、uploads/…）
  // 目录列表在 src/lib/assets.ts 里，两处共用同一份，别在这里手写
  if (ASSET_DIR_LIST.some((dir) => src.startsWith(`${dir.slice(1)}/`))) {
    return withBasePath(`/${src}`);
  }

  return src;
}

