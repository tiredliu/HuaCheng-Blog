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

  /**
   * ⚠️ 这一行不能删。
   *
   * 静态导出没有服务端，而 `next/image` 的**默认优化器是一个服务端端点**。
   * 实测（`images: {}` + 一个 `<Image>`）：构建会**成功**，但产出的 HTML 是
   *
   *   <img src="/_next/image/?url=%2Fuploads%2Fx.png&w=256&q=75" …>
   *
   * 而 `out/` 里根本没有 `_next/image` 这个端点 —— 也就是说
   * **构建期不报错，运行期所有图片静默 404**。
   *
   * 开 `unoptimized` 之后才会输出原图地址 `src="/uploads/x.png"`。
   * MDX 正文里的图片走的是 `mdx-components.tsx` 里覆盖过的原生 `<img>`，不受影响。
   */
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
  /**
   * Turbopack 下插件只能用「字符串名 + 可序列化的选项」传递，不能传函数。
   *
   * remark（Markdown → AST）
   *   remark-frontmatter  去掉 YAML 头
   *   remark-gfm          表格、任务列表、删除线
   *   remark-math         把 $…$ / $$…$$ 识别成数学节点
   *
   * rehype（AST → HTML）
   *   rehype-slug         给 h2 / h3 加 id，目录与锚点依赖它
   *   @shikijs/rehype     代码块语法高亮（Shiki）
   *   rehype-katex        把数学节点渲染成 KaTeX HTML
   */
  options: {
    remarkPlugins: ["remark-frontmatter", "remark-gfm", "remark-math"],
    rehypePlugins: [
      "rehype-slug",
      [
        "@shikijs/rehype",
        {
          // 双主题：产出 --shiki-light / --shiki-dark 两组 CSS 变量，
          // 由 globals.css 根据 .dark 类名切换，不用重新高亮
          themes: { light: "github-light", dark: "github-dark" },
          // 不写死颜色，只输出变量，交给 CSS 决定用哪一套
          defaultColor: false,
          // 给 <code> 加上 language-xxx 类名，mdx-components 里据此渲染语言标签
          addLanguageClass: true,
          // 没写语言的代码块也走 Shiki（按纯文本处理），样式才一致
          defaultLanguage: "text",
        },
      ],
      [
        "rehype-katex",
        {
          // 输出 HTML 而不是 MathML，兼容性更好
          output: "html",
          // 公式写错时给出可见的错误提示，而不是让整篇构建失败
          throwOnError: false,
          strict: false,
        },
      ],
    ],
  },
});

export default withMDX(nextConfig);
