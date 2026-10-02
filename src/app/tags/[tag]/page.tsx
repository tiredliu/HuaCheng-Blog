import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/PageHeader";
import { PostCard } from "@/components/PostCard";
import { getAllTags, getPostsByTag } from "@/lib/posts";

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllTags().map((item) => ({ tag: item.tag }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tag: string }>;
}): Promise<Metadata> {
  const { tag } = await params;
  const decoded = decodeURIComponent(tag);
  return {
    title: `标签：${decoded}`,
    description: `「${decoded}」标签下的全部文章。`,
  };
}

export default async function TagPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params;
  const decoded = decodeURIComponent(tag);
  const posts = getPostsByTag(decoded);

  if (posts.length === 0) notFound();

  return (
    <>
      <Link
        href="/tags"
        className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 transition-colors hover:text-brand-600 dark:text-stone-400"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        全部标签
      </Link>

      <PageHeader
        eyebrow="Tag"
        title={`#${decoded}`}
        description={`该标签下共 ${posts.length} 篇文章。`}
      />

      {posts.length === 0 ? (
        <EmptyState title="这个标签下还没有文章" />
      ) : (
        <div className="space-y-4">
          {posts.map((post, index) => (
            <PostCard key={post.slug} post={post} featured={index === 0} />
          ))}
        </div>
      )}
    </>
  );
}
