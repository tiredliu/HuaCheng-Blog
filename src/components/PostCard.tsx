import Link from "next/link";
import { ArrowUpRight, ImageIcon } from "lucide-react";
import { TagBadge } from "@/components/TagBadge";
import { cn, formatDate, formatWordCount } from "@/lib/utils";
import type { PostMeta } from "@/lib/posts";

export interface PostCardProps {
  post: PostMeta;
  /** 首屏第一篇文章用更醒目的样式 */
  featured?: boolean;
  className?: string;
}

/**
 * 文章卡片（列表页的「缩略框」）。
 *
 * 关于图片，有两条互相独立的设计：
 *
 * | frontmatter / 正文 | 卡片上表现成什么 |
 * | --- | --- |
 * | `cover: /uploads/x.jpg` | **整张卡片以它为背景**，压一层深色渐变保证文字可读 |
 * | 正文里插入的图片 | 卡片底部一条缩略图（最多 3–4 张），让人一眼看出文章里有图 |
 *
 * 封面存在时不再显示缩略图条：两种图片放在同一张卡片里会互相打架，
 * 想让某张正文图片当背景，把它填进 `cover` 就行（TinaCMS 后台的「封面图」字段）。
 */
export function PostCard({ post, featured = false, className }: PostCardProps) {
  const hasCover = Boolean(post.cover);
  // 封面已经承担了「视觉第一眼」的职责，缩略图条只在没有封面时出现
  const thumbs = hasCover ? [] : post.images.slice(0, featured ? 4 : 3);

  return (
    <article
      className={cn(
        "group animate-fade-up relative overflow-hidden rounded-2xl border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-float",
        hasCover
          ? "border-stone-800/60 dark:border-stone-700"
          : "border-stone-200 bg-white hover:border-brand-200 dark:border-stone-800 dark:bg-stone-900 dark:hover:border-brand-800/70",
        className,
      )}
    >
      {hasCover && (
        <>
          {/* 背景图 + 遮罩：两者都是纯装饰，不进无障碍树 */}
          <div
            aria-hidden
            className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-[1.04]"
            style={{ backgroundImage: `url("${post.cover}")` }}
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-stone-950/92 via-stone-950/72 to-stone-950/40"
          />
        </>
      )}

      <div className="relative">
        <Link
          href={`/posts/${post.slug}`}
          className={cn(
            "block px-5 pb-4",
            // 有封面时把文字压到图片下半部分，让图片本身露出来
            hasCover ? (featured ? "pt-28" : "pt-16") : "pt-5",
          )}
        >
          <div
            className={cn(
              "mb-2 flex items-center gap-2 text-xs",
              hasCover ? "text-stone-300" : "text-stone-400",
            )}
          >
            <time dateTime={post.date}>{formatDate(post.date)}</time>
            <span aria-hidden>·</span>
            <span>{formatWordCount(post.wordCount)}</span>
            {post.images.length > 0 && (
              <span className="flex items-center gap-1">
                <span aria-hidden>·</span>
                <ImageIcon className="h-3 w-3" aria-hidden />
                <span className="sr-only">文中包含图片</span>
                {post.images.length}
              </span>
            )}
            {featured && (
              <span
                className={cn(
                  "ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium",
                  hasCover
                    ? "bg-white/15 text-white backdrop-blur-sm"
                    : "bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-300",
                )}
              >
                最新
              </span>
            )}
          </div>

          <h3
            className={cn(
              "flex items-start gap-1 font-semibold tracking-tight transition-colors",
              hasCover
                ? "text-white group-hover:text-white/85"
                : "text-stone-900 group-hover:text-brand-600 dark:text-stone-100 dark:group-hover:text-brand-400",
              featured ? "text-2xl" : "text-lg",
            )}
          >
            {post.title}
            <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
          </h3>

          {post.summary && (
            <p
              className={cn(
                "mt-2 leading-relaxed",
                hasCover ? "text-stone-200/90" : "text-stone-500 dark:text-stone-400",
                featured ? "text-sm sm:text-base" : "line-clamp-2 text-sm",
              )}
            >
              {post.summary}
            </p>
          )}

          {/* 正文里插入的图片：一条缩略图，说明「这篇里有图」 */}
          {thumbs.length > 0 && (
            <div
              className={cn(
                "mt-3 grid gap-2",
                thumbs.length === 1 ? "grid-cols-1" : thumbs.length === 2 ? "grid-cols-2" : "grid-cols-3",
              )}
            >
              {thumbs.map((src) => (
                <span
                  key={src}
                  className="block aspect-4/3 overflow-hidden rounded-lg border border-stone-200 bg-stone-100 dark:border-stone-700 dark:bg-stone-800"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </span>
              ))}
            </div>
          )}
        </Link>

        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-5 pb-5">
            {post.tags.map((tag) => (
              <TagBadge key={tag} tag={tag} />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

export default PostCard;
