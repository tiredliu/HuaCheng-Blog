/**
 * 标签名 ⇄ URL slug。
 *
 * 这个文件必须保持「客户端安全」：不能 import 任何 `node:*`。
 * 因为 `TagBadge` 这类组件会在客户端 bundle 里用到 `tagToSlug()`。
 *
 * ## 为什么标签 URL 用 ASCII slug 而不是中文
 *
 * Next 会拿「URL 里原始的（已编码的）路径段」去和 `generateStaticParams()`
 * 的返回值做匹配。中文标签于是两难：
 *
 * | generateStaticParams 返回 | dev 首次访问 `/tags/…` | 静态产物目录 |
 * | --- | --- | --- |
 * | `"部署"`（解码值） | ❌ missing param → 500 | ✅ `out/tags/部署/` |
 * | `%E9%83%A8%E7%BD%B2`（编码值） | ✅ 200 | ❌ `out/tags/%E9%83%A8%E7%BD%B2/` |
 *
 * 第二种在 dev 下能跑，但产物目录名带 `%`，一旦静态托管先解码路径就 404 ——
 * 属于「修好了开发、弄坏了生产」，而且没法在本地验证各托管商的行为。
 *
 * 换成 ASCII slug 之后 `encodeURIComponent(slug) === slug`，
 * 编码歧义从根上消失：dev、构建、任何静态托管的行为都一致。
 */

/**
 * 中文标签 → 英文 slug 的对照表。
 *
 * 新增中文标签时在这里补一行。忘了补也不会坏：会落到 `tag-xxxx` 的兜底 slug，
 * 只是可读性差一点。
 */
export const TAG_SLUG_OVERRIDES: Record<string, string> = {
  部署: "deploy",
  静态导出: "static-export",
  内容工程: "content-engineering",
  主题: "theme",
  读书笔记: "reading-notes",
  工程实践: "engineering-practice",
};

/** 标签名 → slug。纯函数，客户端与服务端结果一致。 */
export function tagToSlug(tag: string): string {
  const override = TAG_SLUG_OVERRIDES[tag];
  if (override) return override;

  const ascii = tag
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (ascii) return ascii;

  // 纯非 ASCII 且没写映射：用确定性短哈希兜底，保证每次构建结果一致
  let hash = 0;
  for (let index = 0; index < tag.length; index += 1) {
    hash = (hash * 31 + tag.charCodeAt(index)) >>> 0;
  }
  return `tag-${hash.toString(36)}`;
}

/**
 * 检查 slug 是否撞车（例如 `Next.js` 和 `NextJS` 都会得到 `next-js`）。
 *
 * 撞车会让两个标签指向同一个 URL，属于**必须让构建失败**的错误 ——
 * 静默地合并两个标签，比构建报错难查得多。
 *
 * 在 `getAllTags()` 里调用，所以每次构建都会检查。
 */
export function findTagSlugCollisions(tags: string[]): Array<{ slug: string; tags: string[] }> {
  const bySlug = new Map<string, string[]>();

  for (const tag of new Set(tags)) {
    const slug = tagToSlug(tag);
    const list = bySlug.get(slug);
    if (list) list.push(tag);
    else bySlug.set(slug, [tag]);
  }

  return [...bySlug]
    .filter(([, list]) => list.length > 1)
    .map(([slug, list]) => ({ slug, tags: list.sort((a, b) => a.localeCompare(b, "zh-CN")) }));
}

/** slug → 标签名 的反查表（由服务端用完整标签列表构建） */
export function buildSlugToTagMap(tags: string[]): Map<string, string> {
  return new Map([...new Set(tags)].map((tag) => [tagToSlug(tag), tag]));
}
