import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BlogLayout } from "@/components/BlogLayout";
import { getAllPostMeta, getSiteStats } from "@/lib/posts";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} · ${SITE.description}`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  keywords: ["华城博客", "前端", "Next.js", "React", "TypeScript", "Tailwind CSS", "MDX", "个人博客"],
  authors: [{ name: SITE.author }],
  creator: SITE.author,
  openGraph: {
    type: "website",
    locale: "zh_CN",
    siteName: SITE.name,
    title: SITE.name,
    description: SITE.description,
    url: SITE.url,
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
 * 在浏览器绘制之前同步主题，避免深色模式用户看到一闪而过的白屏。
 * 必须内联、必须放在 <head> 里，不能交给 React 的 useEffect。
 */
const THEME_SCRIPT = `(function(){try{
var raw=localStorage.getItem('hc-blog:theme');
var theme=raw?JSON.parse(raw):null;
if(theme!=='light'&&theme!=='dark'){
  theme=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
}
var sizes={sm:'15px',md:'16px',lg:'17.5px'};
var fs=localStorage.getItem('hc-blog:font-scale');
var scale=fs?JSON.parse(fs):'md';
if(sizes[scale])document.documentElement.style.fontSize=sizes[scale];
if(theme==='dark')document.documentElement.classList.add('dark');
document.documentElement.style.colorScheme=theme;
}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // 构建期读一次内容目录，把「最近文章」和站点统计交给外壳组件
  const recentPosts = getAllPostMeta().slice(0, 5);
  const stats = getSiteStats();

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <BlogLayout
          recentPosts={recentPosts}
          stats={{ posts: stats.posts, tags: stats.tags, words: stats.words }}
        >
          {children}
        </BlogLayout>
      </body>
    </html>
  );
}
