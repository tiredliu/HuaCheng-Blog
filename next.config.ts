import type { NextConfig } from "next";
import createMDX from "@next/mdx";

/**
 * 子路径部署支持（GitHub Pages 的项目页会被放在 /<repo>/ 下）。
 *
 * Cloudflare Pages / Vercel / Netlify 用自定义域名或根路径时留空即可。
 * GitHub Pages 需要在构建时设置 NEXT_PUBLIC_BASE_PATH=/仓库名。
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/$/, "") ?? "";

const nextConfig: NextConfig = {
  // 生成纯静态 HTML，可直接部署到任意静态托管
  output: "export",

  // 静态导出必须禁用默认的图片优化（需要服务端）
  images: {
    unoptimized: true,
  },

  // 让 `/posts/hello-world` 输出成 `posts/hello-world/index.html`，
  // 这样 Cloudflare Pages / GitHub Pages / Nginx 都不需要额外 rewrite 规则
  trailingSlash: true,

  // 子路径部署时才生效；根路径部署时这两个值都是空
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),

  // 允许 `.md` / `.mdx` 既作为内容源，也可以直接当作页面
  pageExtensions: ["js", "jsx", "ts", "tsx", "md", "mdx"],
};

const withMDX = createMDX({
  // Turbopack 下插件只能用「字符串名」传递（不能用函数），
  // 所以这里使用 remark-frontmatter 去掉 YAML 头，remark-gfm 支持表格/任务列表
  options: {
    remarkPlugins: ["remark-frontmatter", "remark-gfm"],
    // rehype-slug 给 h2 / h3 自动加上 id，目录（TOC）与锚点链接都依赖它
    rehypePlugins: ["rehype-slug"],
  },
});

export default withMDX(nextConfig);
