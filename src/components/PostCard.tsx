import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { TagBadge } from "@/components/TagBadge";
import { cn, formatDate } from "@/lib/utils";
import type { PostMeta } from "@/lib/posts";

export interface PostCardProps {
  post: PostMeta;
  /** 首屏第一篇文章用更醒目的样式 */
  featured?: boolean;
  className?: string;
}

export function PostCard({ post, featured = false, className }: PostCardProps) {
  return (
    <article
      className={cn(
        "group animate-fade-up rounded-2xl border border-stone-200 bg-white p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-float dark:border-stone-800 dark:bg-stone-900 dark:hover:border-brand-800/70",
        className,
      )}
    >
      <Link href={`/posts/${post.slug}`} className="block">
        <div className="mb-2 flex items-center gap-2 text-xs text-stone-400">
          <time dateTime={post.date}>{formatDate(post.date)}</time>
          <span aria-hidden>·</span>
          <span>约 {post.readingTime} 分钟</span>
          {featured && (
            <span className="ml-auto rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-600 dark:bg-brand-950/60 dark:text-brand-300">
              最新
            </span>
          )}
        </div>

        <h3
          className={cn(
            "flex items-start gap-1 font-semibold tracking-tight text-stone-900 transition-colors group-hover:text-brand-600 dark:text-stone-100 dark:group-hover:text-brand-400",
            featured ? "text-2xl" : "text-lg",
          )}
        >
          {post.title}
          <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
        </h3>

        {post.summary && (
          <p
            className={cn(
              "mt-2 leading-relaxed text-stone-500 dark:text-stone-400",
              featured ? "text-sm sm:text-base" : "line-clamp-2 text-sm",
            )}
          >
            {post.summary}
          </p>
        )}
      </Link>

      {post.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {post.tags.map((tag) => (
            <TagBadge key={tag} tag={tag} />
          ))}
        </div>
      )}
    </article>
  );
}

export default PostCard;
