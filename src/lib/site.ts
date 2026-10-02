/**
 * 站点级常量。
 *
 * 单独放一个文件，是为了让客户端组件也能安全引用，
 * 而不会把 `node:fs` 之类的服务端依赖打进浏览器 bundle。
 */
export const SITE = {
  name: "华城博客",
  shortName: "华城",
  description: "记录技术与生活 —— 一名前端工程师的写作空间",
  author: "华城",
  email: "huacheng@example.com",
  location: "广东 · 广州",
  url: "https://hua-cheng-blog.pages.dev",
  repository: "https://github.com/hua-cheng/hua-cheng-blog",
  startYear: 2024,
} as const;

export const NAV_ITEMS = [
  { label: "首页", href: "/", icon: "house", description: "最新文章与站点概览" },
  { label: "文章", href: "/posts", icon: "file-text", description: "全部文章列表" },
  { label: "标签", href: "/tags", icon: "tag", description: "按主题浏览" },
  { label: "归档", href: "/archive", icon: "archive", description: "按时间浏览" },
  { label: "关于", href: "/about", icon: "user", description: "关于我和这个博客" },
  { label: "联系", href: "/contact", icon: "mail", description: "留言与联系方式" },
] as const;
