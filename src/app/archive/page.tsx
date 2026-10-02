import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, EmptyState } from "@/components/PageHeader";
import { getArchive } from "@/lib/posts";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "归档",
  description: "按年份浏览全部文章。",
};

export default function ArchivePage() {
  const groups = getArchive();
  const total = groups.reduce((sum, group) => sum + group.posts.length, 0);

  return (
    <>
      <PageHeader
        eyebrow="Archive"
        title="归档"
        description={`共 ${total} 篇文章，跨越 ${groups.length} 个年份。`}
      />

      {groups.length === 0 ? (
        <EmptyState title="还没有文章" />
      ) : (
        <div className="space-y-10">
          {groups.map((group) => (
            <section key={group.year} className="animate-fade-up">
              <div className="mb-4 flex items-baseline gap-3">
                <h2 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
                  {group.year}
                </h2>
                <span className="text-xs text-stone-400">{group.posts.length} 篇</span>
                <span className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
              </div>

              <ol className="relative space-y-3 border-l border-stone-200 pl-5 dark:border-stone-800">
                {group.posts.map((post) => (
                  <li key={post.slug} className="relative">
                    <span className="absolute top-2 -left-[23px] h-2 w-2 rounded-full bg-brand-400" />
                    <Link
                      href={`/posts/${post.slug}`}
                      className="group flex flex-wrap items-baseline gap-x-3 gap-y-1"
                    >
                      <span className="text-sm font-medium text-stone-700 transition-colors group-hover:text-brand-600 dark:text-stone-200 dark:group-hover:text-brand-400">
                        {post.title}
                      </span>
                      <span className="text-[11px] text-stone-400">{formatDate(post.date)}</span>
                    </Link>
                    {post.tags.length > 0 && (
                      <p className="mt-0.5 text-[11px] text-stone-400">
                        {post.tags.map((tag) => `#${tag}`).join("  ")}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
