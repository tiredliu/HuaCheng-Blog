import Link from "next/link";
import { ArrowRight, BookOpen, Hash, Sparkles } from "lucide-react";
import { PostCard } from "@/components/PostCard";
import { TagBadge } from "@/components/TagBadge";
import { EmptyState } from "@/components/PageHeader";
import { getAllPostMeta, getAllTags, getSiteStats } from "@/lib/posts";
import { SITE } from "@/lib/site";
import { formatCount, formatDate } from "@/lib/utils";

export default function HomePage() {
  const posts = getAllPostMeta();
  const tags = getAllTags().slice(0, 10);
  const stats = getSiteStats();
  const [lead, ...rest] = posts;

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="animate-fade-up">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium tracking-[0.18em] text-brand-500 uppercase">
          <Sparkles className="h-3.5 w-3.5" />
          {SITE.location} · 个人博客
        </p>
        <h1 className="text-3xl leading-tight font-bold tracking-tight text-stone-900 sm:text-4xl dark:text-stone-50">
          你好，我是{SITE.author}
        </h1>
        <p className="mt-4 max-w-2xl leading-relaxed text-stone-500 dark:text-stone-400">
          在这里记录生活，分享一些学习中的代码和有趣的事。
          这是一个纯静态的 Next.js 博客，内容写在 MDX 里，
          后台用 TinaCMS 编辑，构建产物直接托管在全球 CDN 上。
        </p>

        <dl className="mt-6 grid max-w-lg grid-cols-3 gap-3">
          {[
            { label: "篇文章", value: formatCount(stats.posts), Icon: BookOpen },
            { label: "个标签", value: formatCount(stats.tags), Icon: Hash },
            { label: "字内容", value: formatCount(stats.words), Icon: Sparkles },
          ].map(({ label, value, Icon }) => (
            <div
              key={label}
              className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 dark:border-stone-800 dark:bg-stone-900"
            >
              <dt className="flex items-center gap-1 text-[11px] text-stone-400">
                <Icon className="h-3 w-3" />
                {label}
              </dt>
              <dd className="mt-0.5 text-lg font-semibold text-stone-800 dark:text-stone-100">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 文章列表 */}
      <section>
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
              最新文章
            </h2>
            <p className="mt-1 text-xs text-stone-400">
              {stats.posts > 0 && `最近更新于 ${formatDate(stats.updatedAt)}`}
            </p>
          </div>
          <Link
            href="/posts"
            className="flex shrink-0 items-center gap-1 text-sm font-medium text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400"
          >
            全部文章
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {posts.length === 0 ? (
          <EmptyState
            title="还没有文章"
            description="在 content/posts 下新建一个 .mdx 文件，或者打开 /admin 用 TinaCMS 后台写作。"
          />
        ) : (
          <div className="space-y-4">
            {lead && <PostCard post={lead} featured />}
            {rest.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        )}
      </section>

      {/* 标签云 */}
      {tags.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
            按标签浏览
          </h2>
          <div className="flex flex-wrap gap-2">
            {tags.map((item) => (
              <TagBadge key={item.tag} tag={item.tag} count={item.count} size="md" />
            ))}
            <Link
              href="/tags"
              className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              全部标签 →
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
