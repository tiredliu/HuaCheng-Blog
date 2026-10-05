import type { Metadata, Viewport } from "next";
import "./globals.css";
// KaTeX 的样式与字体都从 node_modules 走构建打包（自托管，不请求外部 CDN）。
// 字体文件只有在页面真的渲染了公式时才会被浏览器下载。
import "katex/dist/katex.min.css";
import { BlogLayout } from "@/components/BlogLayout";
import { getAllPostMeta, getSiteStats } from "@/lib/posts";
import { readGuestbook } from "@/lib/interactions-file";
import { SITE } from "@/lib/site";
import { readSiteSettings } from "@/lib/site-settings-file";
import { buildBootstrapScript } from "@/lib/site-settings";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} · ${SITE.description}`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  keywords: ["花城博客", "前端", "Next.js", "React", "TypeScript", "Tailwind CSS", "MDX", "个人博客"],
  authors: [{ name: SITE.author }],
  creator: SITE.author,
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName: SITE.name,
    title: SITE.name,
    description: SITE.description,
    url: SITE.url,
    // 分享图也是仓库里的静态文件：public/og-cover.png
    images: [{ url: SITE.ogImage, width: 1200, height: 630, alt: SITE.name }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE.name,
    description: SITE.description,
    images: [SITE.ogImage],
  },
  icons: {
    icon: [{ url: "/icon.png", type: "image/png" }],
    apple: [{ url: "/icon.png" }],
  },
  robots: { index: true, follow: true },
  alternates: {
    canonical: "/",
    types: { "application/rss+xml": "/rss.xml" },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0a09" },
  ],
};

/**
 * 在浏览器绘制之前同步主题与字号，避免深色用户看到一闪而过的白屏。
 *
 * 必须内联、必须放在 <head> 里、不能交给 React 的 useEffect。
 * 站点默认值会被编译进这段脚本（见 `buildBootstrapScript`），
 * 所以「站点默认深色」的首次访客也不会闪。
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  // 构建期读一次：内容目录、站点统计、站点默认设置
  const recentPosts = getAllPostMeta().slice(0, 5);
  const stats = getSiteStats();
  const siteSettings = readSiteSettings();
  const bootstrapScript = buildBootstrapScript(siteSettings);
  // 留言板里「站长发布、所有人可见」的那部分：构建期读，和文章一样随仓库走
  const repoMessages = readGuestbook();

  return (
    <html lang="zh-CN" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootstrapScript }} />
        {/* 配了 Giscus 才提前建连：评论区的脚本与 iframe 都在 giscus.app 上。
            能省掉一次 DNS + TLS 握手，但真正快慢取决于到 giscus.app / GitHub 的网络。 */}
        {siteSettings.giscus && (
          <>
            <link rel="preconnect" href="https://giscus.app" crossOrigin="anonymous" />
            <link rel="dns-prefetch" href="https://giscus.app" />
          </>
        )}
      </head>
      <body>
        <BlogLayout
          recentPosts={recentPosts}
          stats={{ posts: stats.posts, tags: stats.tags, words: stats.words }}
          siteSettings={siteSettings}
          repoMessages={repoMessages}
        >
          {children}
        </BlogLayout>
      </body>
    </html>
  );
}
