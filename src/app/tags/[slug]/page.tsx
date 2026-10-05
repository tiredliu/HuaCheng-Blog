import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/PageHeader";
import { PostCard } from "@/components/PostCard";
import { getAllTags, getPostsByTagSlug, getTagBySlug } from "@/lib/posts";

/**
 * 路由参数用的是 **ASCII slug**，不是原始标签名。
 *
 * 原因是 Next 会拿「URL 里原始的（已编码的）路径段」去和 `generateStaticParams()`
 * 的返回值做匹配。中文标签于是两难：
 *
 * | generateStaticParams 返回 | dev 首次访问 | 静态产物目录 |
 * | --- | --- | --- |
 * | `"部署"`（解码值） | ❌ missing param → 500 | ✅ `out/tags/部署/` |
 * | `%E9%83%A8%E7%BD%B2`（编码值） | ✅ 200 | ❌ `out/tags/%E9%83%A8%E7%BD%B2/` |
 *
 * 第二种在 dev 下能跑，但产物目录名带 `%`，一旦静态托管先解码路径就 404 ——
 * 属于「修好了开发、弄坏了生产」，而且没法在本地验证各托管商的行为。
 *
 * 换成 ASCII slug（`部署` → `deploy`）之后 `encodeURIComponent(slug) === slug`，
 * 编码歧义从根上消失：dev、构建、任何静态托管的行为都一致。
 * 对照表在 `src/lib/posts.ts` 的 `TAG_SLUG_OVERRIDES`。
 */
export function generateStaticParams() {
  return getAllTags().map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tag = getTagBySlug(slug);

  if (!tag) return { title: "标签不存在" };

  return {
    title: `标签：${tag}`,
    description: `「${tag}」标签下的全部文章。`,
  };
}

export default async function TagPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tag = getTagBySlug(slug);

  if (!tag) notFound();

  const posts = getPostsByTagSlug(slug);

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
        title={`#${tag}`}
        description={`该标签下共 ${posts.length} 篇文章。`}
      />

      {posts.length === 0 ? (
        <EmptyState title="这个标签下还没有文章" />
      ) : (
        <div className="space-y-4">
          {posts.map((post, index) => (
            <PostCard key={post.slug} post={post} featured={index === 0} fromHref={`/tags/${slug}`} />
          ))}
        </div>
      )}
    </>
  );
}
