import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays, FileText } from "lucide-react";
import { MdxContent } from "@/components/MdxContent";
import { PostBackLink } from "@/components/PostBackLink";
import { PostInteractions } from "@/components/PostInteractions";
import { PostStatsBar } from "@/components/PostStatsBar";
import { ReadingProgress } from "@/components/ReadingProgress";
import { TableOfContents } from "@/components/TableOfContents";
import { TagBadge } from "@/components/TagBadge";
import {
  extractToc,
  getAdjacentPosts,
  getAllSlugs,
  getPostBySlug,
  getRelatedPosts,
} from "@/lib/posts";
import { readPostComments } from "@/lib/interactions-file";
import { SITE } from "@/lib/site";
import { readSiteSettings } from "@/lib/site-settings-file";
import { formatDate, formatDateISO, formatWordCount } from "@/lib/utils";

/** 只允许预渲染 generateStaticParams 里列出的 slug，其余交给静态托管的 404 */
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: "文章不存在" };

  return {
    title: post.title,
    description: post.summary,
    keywords: post.tags,
    openGraph: {
      type: "article",
      title: post.title,
      description: post.summary,
      url: `${SITE.url}/posts/${post.slug}/`,
      publishedTime: post.date,
      authors: [post.author],
      tags: post.tags,
    },
  };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  /**
   * @next/mdx：把 content/posts 下的文章编译成 React 组件。
   *
   * 这里 import 的是 `fileName`（**含扩展名**，来自 `readdirSync`），
   * 所以 `.md` 和 `.mdx` 用同一行代码就够了 —— 不需要按扩展名分支。
   *
   * ⚠️ **不要「优化」成 `content/posts/${slug}.mdx` 或按扩展名分两个分支。**
   * Turbopack 会为模板字面量生成一个「上下文模块」，把匹配到的一批文件一起打包；
   * 而这个上下文**不能为空**。曾经写成两个分支：
   *
   *   post.fileName.endsWith(".md")
   *     ? import(`@/content/posts/${slug}.md`)     // ← 仓库里一篇 .md 都没有时
   *     : import(`@/content/posts/${slug}.mdx`)    //    Turbopack 直接报
   *                                                //   "Can't resolve '@/content/posts/' <dynamic> '.md'"
   *
   * 也就是说，那种写法会让「仓库里至少得有一篇 .md 文章」变成一条隐式硬约束 ——
   * 把唯一的 `.md` 文章删掉，或者改成 `.mdx`，构建就挂了。
   *
   * 用 `${fileName}`（一个插值、glob 是 `content/posts/*`）就没有这个问题：
   * 只要还有任何一篇文章，上下文就非空。
   */
  const { default: Post } = await import(`@/content/posts/${post.fileName}`);

  const toc = extractToc(post.source);
  const { previous, next } = getAdjacentPosts(slug);
  const related = getRelatedPosts(slug);
  const siteSettings = readSiteSettings();
  const repoComments = readPostComments(slug);

  return (
    <>
      <ReadingProgress />

      <article className="animate-fade-up">
        {/* 返回：从标签页进来就回该标签的文章列表 */}
        <PostBackLink />

        {/* 文章头部 */}
        <header className="mb-8 border-b border-stone-200 pb-6 dark:border-stone-800">
          {post.draft && (
            <p className="mb-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
              草稿
            </p>
          )}

          <h1 className="text-3xl leading-tight font-bold tracking-tight text-stone-900 sm:text-[2.5rem] dark:text-stone-50">
            {post.title}
          </h1>

          {post.summary && (
            <p className="mt-4 leading-relaxed text-stone-500 dark:text-stone-400">{post.summary}</p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-stone-400">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              <time dateTime={formatDateISO(post.date)}>{formatDate(post.date)}</time>
            </span>
            <span className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              全文 {formatWordCount(post.wordCount)}
            </span>
            <span>作者：{post.author}</span>
            {/* 浏览次数与点赞：数字只有浏览器知道，所以这里是客户端组件 */}
            <PostStatsBar slug={slug} settings={siteSettings.interactions} />
          </div>

          {post.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <TagBadge key={tag} tag={tag} />
              ))}
            </div>
          )}
        </header>

        {/* 封面图（frontmatter 的 cover）：列表页的缩略框背景用的也是它 */}
        {post.cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.cover}
            alt=""
            loading="lazy"
            decoding="async"
            className="mb-8 w-full rounded-2xl border border-stone-200 object-cover dark:border-stone-800"
          />
        )}

        {/* 目录 */}
        <TableOfContents items={toc} className="mb-8" />

        {/* 正文：MDX 编译结果 + .article 排版 */}
        <MdxContent>
          <Post />
        </MdxContent>

        {/* 评论区：本机评论 + 站长回复（仓库）+ 可选的 Giscus */}
        <PostInteractions
          slug={slug}
          repoComments={repoComments}
          settings={siteSettings.interactions}
          giscus={siteSettings.giscus}
        />

        {/* 上一篇 / 下一篇 */}
        {(previous || next) && (
          <nav className="mt-14 grid gap-3 border-t border-stone-200 pt-8 sm:grid-cols-2 dark:border-stone-800">
            {previous ? (
              <Link
                href={`/posts/${previous.slug}`}
                className="group rounded-xl border border-stone-200 p-4 transition-colors hover:border-brand-300 hover:bg-white dark:border-stone-800 dark:hover:border-brand-800 dark:hover:bg-stone-900"
              >
                <span className="flex items-center gap-1 text-[11px] text-stone-400">
                  <ArrowLeft className="h-3 w-3" /> 上一篇
                </span>
                <p className="mt-1 text-sm font-medium text-stone-700 group-hover:text-brand-600 dark:text-stone-200 dark:group-hover:text-brand-400">
                  {previous.title}
                </p>
              </Link>
            ) : (
              <span />
            )}

            {next && (
              <Link
                href={`/posts/${next.slug}`}
                className="group rounded-xl border border-stone-200 p-4 transition-colors hover:border-brand-300 hover:bg-white sm:text-right dark:border-stone-800 dark:hover:border-brand-800 dark:hover:bg-stone-900"
              >
                <span className="flex items-center gap-1 text-[11px] text-stone-400 sm:justify-end">
                  下一篇 <ArrowRight className="h-3 w-3" />
                </span>
                <p className="mt-1 text-sm font-medium text-stone-700 group-hover:text-brand-600 dark:text-stone-200 dark:group-hover:text-brand-400">
                  {next.title}
                </p>
              </Link>
            )}
          </nav>
        )}

        {/* 相关文章 */}
        {related.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-3 text-sm font-semibold tracking-wide text-stone-500 uppercase dark:text-stone-400">
              相关文章
            </h2>
            <ul className="space-y-2">
              {related.map((item) => (
                <li key={item.slug}>
                  <Link
                    href={`/posts/${item.slug}`}
                    className="flex items-baseline gap-3 rounded-lg px-3 py-2 text-sm text-stone-600 transition-colors hover:bg-white hover:text-brand-600 dark:text-stone-300 dark:hover:bg-stone-900 dark:hover:text-brand-400"
                  >
                    <span className="flex-1">{item.title}</span>
                    <span className="shrink-0 text-[11px] text-stone-400">
                      {formatDate(item.date)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </>
  );
}
