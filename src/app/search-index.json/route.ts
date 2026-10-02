import { getSearchIndex } from "@/lib/posts";

/**
 * 站内搜索索引。
 *
 * `output: "export"` 下只有 GET 允许，且会在构建期渲染成静态文件，
 * 所以它在 CDN 上就是一份普通的 JSON，不需要任何运行时。
 */
export const dynamic = "force-static";

export function GET() {
  const entries = getSearchIndex();

  return new Response(JSON.stringify({ count: entries.length, entries }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      // 内容随每次构建变化，交给 ETag 校验
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}
