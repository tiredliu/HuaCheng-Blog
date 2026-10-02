import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock, CalendarDays } from "lucide-react";
import { MdxContent } from "@/components/MdxContent";
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
import { SITE } from "@/lib/site";
import { formatDate, formatDateISO } from "@/lib/utils";

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

  // @next/mdx：把 content/posts/*.mdx 编译成 React 组件
  const { default: Post } = await import(`@/content/posts/${slug}.mdx`);

  const toc = extractToc(post.source);
  const { previous, next } = getAdjacentPosts(slug);
  const related = getRelatedPosts(slug);

  return (
    <>
      <ReadingProgress />

      <article className="animate-fade-up">
        {/* 返回 */}
        <Link
          href="/posts"
          className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 transition-colors hover:text-brand-600 dark:text-stone-400"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          返回文章列表
        </Link>

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
              <Clock className="h-3.5 w-3.5" />约 {post.readingTime} 分钟
            </span>
            <span>作者：{post.author}</span>
          </div>

          {post.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <TagBadge key={tag} tag={tag} />
              ))}
            </div>
          )}
        </header>

        {/* 目录 */}
        <TableOfContents items={toc} className="mb-8" />

        {/* 正文：MDX 编译结果 + .article 排版 */}
        <MdxContent>
          <Post />
        </MdxContent>

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
