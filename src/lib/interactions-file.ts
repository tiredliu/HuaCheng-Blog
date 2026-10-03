import fs from "node:fs";
import path from "node:path";
import type { CommentItem } from "@/lib/interactions";

/**
 * 读取仓库里的「站长发布的留言 / 评论」（**只在构建期执行**）。
 *
 * 为什么要有这两个文件：纯静态站没有后端，访客的评论只能留在自己浏览器里，
 * 而**站长的回复必须让所有人看见**。既然写文章本来就是「站长用 GitHub Token
 * 提交进仓库 → 触发重新构建」，回复也走同一条路最自然 ——
 * 这就是「回复和写作一样，只有仓库主人能做」的落地方式。
 *
 * ⚠️ 路径必须写成字面量分段（`'content', 'guestbook.json'`），
 * 不能拼一个变量进来，否则 Turbopack 会判定「整个项目都被追踪」并给出 NFT 警告。
 *
 * 文件缺失 / 非法 JSON / 字段类型不对都**不能让构建失败**：
 * 退回空数组，构建日志里给一行警告即可。
 */

/** 只保留形状正确的评论，避免一个手改坏掉的字段把整页渲染搞崩 */
function normalizeComments(value: unknown): CommentItem[] {
  if (!Array.isArray(value)) return [];

  const items: CommentItem[] = [];

  for (const raw of value) {
    if (typeof raw !== "object" || raw === null) continue;
    const item = raw as Partial<CommentItem>;
    if (typeof item.id !== "string" || typeof item.content !== "string") continue;

    items.push({
      id: item.id,
      author: typeof item.author === "string" && item.author.trim() ? item.author : "匿名访客",
      content: item.content,
      createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date(0).toISOString(),
      likes: typeof item.likes === "number" && Number.isFinite(item.likes) ? item.likes : 0,
      ...(typeof item.reply === "string" && item.reply ? { reply: item.reply } : {}),
      ...(typeof item.replyAt === "string" ? { replyAt: item.replyAt } : {}),
      ...(item.owner === true ? { owner: true } : {}),
    });
  }

  return items;
}

/** 去掉 UTF-8 BOM 再解析（记事本保存会带 BOM，而 JSON.parse 遇到它会直接抛错） */
function readJson(file: string): unknown {
  if (!fs.existsSync(file)) return null;

  try {
    return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "")) as unknown;
  } catch (error) {
    console.warn(
      `[interactions] ${path.basename(file)} 解析失败，已当作空数据：`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/** 留言板的公开留言（`content/guestbook.json`） */
export function readGuestbook(): CommentItem[] {
  const file = path.join(process.cwd(), "content", "guestbook.json");
  const parsed = readJson(file);
  if (typeof parsed !== "object" || parsed === null) return [];

  return normalizeComments((parsed as { messages?: unknown }).messages);
}

/**
 * 全部文章的公开评论（`content/comments.json`）。
 *
 * 结构是 `{ posts: { "<slug>": CommentItem[] } }`，
 * 一次读进来比每篇文章各读一次文件更省事（文章数量不大）。
 */
export function readRepoComments(): Record<string, CommentItem[]> {
  const file = path.join(process.cwd(), "content", "comments.json");
  const parsed = readJson(file);
  if (typeof parsed !== "object" || parsed === null) return {};

  const posts = (parsed as { posts?: unknown }).posts;
  if (typeof posts !== "object" || posts === null || Array.isArray(posts)) return {};

  const result: Record<string, CommentItem[]> = {};
  for (const [slug, value] of Object.entries(posts as Record<string, unknown>)) {
    const items = normalizeComments(value);
    if (items.length > 0) result[slug] = items;
  }
  return result;
}

/** 单篇文章的公开评论 */
export function readPostComments(slug: string): CommentItem[] {
  return readRepoComments()[slug] ?? [];
}
