import type { Metadata } from "next";
import { PageHeader, EmptyState } from "@/components/PageHeader";
import { PostCard } from "@/components/PostCard";
import { getAllPostMeta } from "@/lib/posts";

export const metadata: Metadata = {
  title: "全部文章",
  description: "按时间倒序排列的全部文章，共收录前端、工程实践与生活随笔。",
};

export default function PostsPage() {
  const posts = getAllPostMeta();

  return (
    <>
      <PageHeader
        eyebrow="Archive"
        title="全部文章"
        description={`共 ${posts.length} 篇文章，按发布时间从新到旧排列。`}
      />

      {posts.length === 0 ? (
        <EmptyState
          title="还没有文章"
          description="在 content/posts 下新建 .mdx 文件即可，也可以在 /admin 用 TinaCMS 后台写作。"
        />
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
