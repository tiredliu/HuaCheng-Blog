import type { Metadata } from "next";
import { PageHeader, EmptyState } from "@/components/PageHeader";
import { TagBadge } from "@/components/TagBadge";
import { getAllTags } from "@/lib/posts";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "标签",
  description: "按主题浏览文章。",
};

export default function TagsPage() {
  const tags = getAllTags();

  return (
    <>
      <PageHeader
        eyebrow="Tags"
        title="标签"
        description={`共 ${tags.length} 个标签。点击任意标签查看该主题下的全部文章。`}
      />

      {tags.length === 0 ? (
        <EmptyState title="还没有标签" description="在文章 frontmatter 里加上 tags 字段即可。" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {tags.map((item) => (
            <div
              key={item.tag}
              className="animate-fade-up flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 dark:border-stone-800 dark:bg-stone-900"
            >
              <TagBadge tag={item.tag} size="md" />
              <div className="text-right">
                <p className="text-sm font-semibold text-stone-700 dark:text-stone-200">
                  {item.count} 篇
                </p>
                <p className="text-[11px] text-stone-400">最近 {formatDate(item.latest)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
