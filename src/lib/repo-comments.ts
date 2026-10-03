"use client";

import { readRepoFile, writeRepoFile, type GithubConfig } from "@/lib/github-upload";
import {
  COMMENTS_REPO_PATH,
  GUESTBOOK_PATH,
  GUESTBOOK_REPO_PATH,
  type CommentItem,
} from "@/lib/interactions";

/**
 * 站长把留言 / 评论 / 回复写进仓库。
 *
 * 这是「回复只有仓库主人能做」的**本地实现**：不需要任何后端，
 * 用的就是写文章那一个 GitHub Token，提交一次 commit，构建后所有人可见。
 *
 * 另一条路是 `interactions.provider === "remote"` 时由 Cloudflare Worker 收下
 * （Worker 会拿同一个 token 向 GitHub 校验 `permissions.push`）。
 * 两条路产出的数据结构完全一样，所以前端渲染不用区分。
 */

interface GuestbookFile {
  $comment?: string;
  updatedAt?: string;
  messages?: CommentItem[];
}

interface CommentsFile {
  $comment?: string;
  updatedAt?: string;
  posts?: Record<string, CommentItem[]>;
}

const GUESTBOOK_NOTE =
  "留言板的公开留言。只有站长能写这个文件 —— 在前台用 GitHub Token 发布/回复会自动提交到这里，也可以直接编辑后 push。访客自己的留言只存在他自己的浏览器里，不会写进来。";

const COMMENTS_NOTE =
  "每篇文章的公开评论与站长回复，按 slug 分组。只有站长能写这个文件 —— 在前台回复评论时会自动提交到这里。访客的评论只存在他自己的浏览器里，站长需要先在页面上「收录」才会写进来。";

function parseFile<T>(content: string | null, fallback: T): T {
  if (!content) return fallback;
  try {
    const parsed: unknown = JSON.parse(content.replace(/^\uFEFF/, ""));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

function isGuestbook(target: string): boolean {
  return target === GUESTBOOK_PATH;
}

/** 把一个评论 upsert 进目标文件的内容里，返回新的文件文本 */
function buildNextContent(
  target: string,
  current: string | null,
  comment: CommentItem,
): string {
  const stamp = new Date().toISOString();

  if (isGuestbook(target)) {
    const file = parseFile<GuestbookFile>(current, {});
    const messages = Array.isArray(file.messages) ? [...file.messages] : [];
    const index = messages.findIndex((item) => item.id === comment.id);

    if (index >= 0) messages[index] = { ...messages[index], ...comment, pending: undefined };
    else messages.push({ ...comment, pending: undefined });

    const next: GuestbookFile = { $comment: GUESTBOOK_NOTE, updatedAt: stamp, messages };
    return `${JSON.stringify(next, null, 2)}\n`;
  }

  const file = parseFile<CommentsFile>(current, {});
  const posts = typeof file.posts === "object" && file.posts !== null ? { ...file.posts } : {};
  const list = Array.isArray(posts[target]) ? [...posts[target]] : [];
  const index = list.findIndex((item) => item.id === comment.id);

  if (index >= 0) list[index] = { ...list[index], ...comment, pending: undefined };
  else list.push({ ...comment, pending: undefined });

  posts[target] = list;

  const next: CommentsFile = { $comment: COMMENTS_NOTE, updatedAt: stamp, posts };
  return `${JSON.stringify(next, null, 2)}\n`;
}

/** 从目标文件里删掉一条评论，返回新的文件文本 */
function buildDeletedContent(target: string, current: string | null, id: string): string {
  const stamp = new Date().toISOString();

  if (isGuestbook(target)) {
    const file = parseFile<GuestbookFile>(current, {});
    const messages = (Array.isArray(file.messages) ? file.messages : []).filter(
      (item) => item.id !== id,
    );
    return `${JSON.stringify({ $comment: GUESTBOOK_NOTE, updatedAt: stamp, messages }, null, 2)}\n`;
  }

  const file = parseFile<CommentsFile>(current, {});
  const posts = typeof file.posts === "object" && file.posts !== null ? { ...file.posts } : {};
  const list = (Array.isArray(posts[target]) ? posts[target] : []).filter((item) => item.id !== id);

  if (list.length > 0) posts[target] = list;
  else delete posts[target];

  return `${JSON.stringify({ $comment: COMMENTS_NOTE, updatedAt: stamp, posts }, null, 2)}\n`;
}

/**
 * 发表 / 更新一条评论或回复。
 *
 * `comment` 里带上 `reply` 就是「站长回复」；带上 `owner: true` 就是「站长自己发的」。
 * 两者都只有拿到 GitHub Token 的浏览器才写得了 —— 因为它必须能写仓库。
 */
export async function saveCommentToRepo(
  config: GithubConfig,
  target: string,
  comment: CommentItem,
): Promise<string | undefined> {
  const repoPath = isGuestbook(target) ? GUESTBOOK_REPO_PATH : COMMENTS_REPO_PATH;
  const existing = await readRepoFile(config, repoPath);
  const content = buildNextContent(target, existing?.content ?? null, comment);

  const { commitUrl } = await writeRepoFile(
    config,
    repoPath,
    content,
    comment.reply
      ? `feat(comments): 站长回复 ${comment.id}`
      : `feat(comments): 站长发布评论 ${comment.id}`,
  );

  return commitUrl;
}

/** 站长删除仓库里的一条评论 */
export async function deleteCommentFromRepo(
  config: GithubConfig,
  target: string,
  id: string,
): Promise<string | undefined> {
  const repoPath = isGuestbook(target) ? GUESTBOOK_REPO_PATH : COMMENTS_REPO_PATH;
  const existing = await readRepoFile(config, repoPath);
  const content = buildDeletedContent(target, existing?.content ?? null, id);

  const { commitUrl } = await writeRepoFile(
    config,
    repoPath,
    content,
    `chore(comments): 站长删除评论 ${id}`,
  );

  return commitUrl;
}
