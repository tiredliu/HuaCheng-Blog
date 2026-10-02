import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import GithubSlugger from "github-slugger";

/** 文章目录：与 tina/config.ts 中的 collection path 保持一致 */
export const POSTS_DIR = path.join(process.cwd(), "content", "posts");

export interface PostMeta {
  slug: string;
  title: string;
  /** ISO 字符串，便于排序与序列化 */
  date: string;
  summary: string;
  tags: string[];
  cover?: string;
  author: string;
  draft: boolean;
  /** 预估阅读时长（分钟） */
  readingTime: number;
}

export interface Post extends PostMeta {
  /** 原始 MDX 正文（不含 frontmatter） */
  source: string;
}

export interface TocItem {
  id: string;
  text: string;
  depth: 2 | 3;
}

export { SITE } from "@/lib/site";
import { SITE } from "@/lib/site";

/** 把 frontmatter 的任意写法统一成字符串数组 */
function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((tag) => String(tag).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/[,，\s]+/)
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeDate(value: unknown, fallback: number): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date(fallback).toISOString();
}

/** 中文按字符数、英文按单词数粗略估算阅读时长 */
function estimateReadingTime(source: string): number {
  const cjk = (source.match(/[\u4e00-\u9fa5]/g) ?? []).length;
  const words = (source.replace(/[\u4e00-\u9fa5]/g, " ").match(/[A-Za-z0-9]+/g) ?? []).length;
  return Math.max(1, Math.round(cjk / 400 + words / 220));
}

function readPostFile(fileName: string): Post {
  const slug = fileName.replace(/\.mdx?$/, "");
  const raw = fs.readFileSync(path.join(POSTS_DIR, fileName), "utf8");
  const { data, content } = matter(raw);
  const stat = fs.statSync(path.join(POSTS_DIR, fileName));

  return {
    slug,
    title: typeof data.title === "string" && data.title.trim() ? data.title.trim() : slug,
    date: normalizeDate(data.date, stat.mtimeMs),
    summary:
      typeof data.summary === "string" && data.summary.trim()
        ? data.summary.trim()
        : buildSummary(content),
    tags: normalizeTags(data.tags),
    cover: typeof data.cover === "string" ? data.cover : undefined,
    author: typeof data.author === "string" && data.author.trim() ? data.author.trim() : SITE.author,
    draft: data.draft === true,
    readingTime: estimateReadingTime(content),
    source: content,
  };
}

/** 没有手写 summary 时，用正文首段兜底 */
function buildSummary(source: string): string {
  const plain = source
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*`_~-]/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return plain.length > 96 ? `${plain.slice(0, 96)}…` : plain;
}

function listPostFiles(): string[] {
  if (!fs.existsSync(POSTS_DIR)) return [];
  return fs.readdirSync(POSTS_DIR).filter((file) => /\.mdx?$/.test(file));
}

/** 按日期倒序返回全部文章（构建期执行，静态导出时会预渲染） */
export function getAllPosts(options: { includeDrafts?: boolean } = {}): Post[] {
  const includeDrafts = options.includeDrafts ?? process.env.NODE_ENV !== "production";

  return listPostFiles()
    .map(readPostFile)
    .filter((post) => includeDrafts || !post.draft)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/** 只取元信息，避免把整篇正文传进客户端组件 */
export function getAllPostMeta(options?: { includeDrafts?: boolean }): PostMeta[] {
  return getAllPosts(options).map(({ source: _source, ...meta }) => meta);
}

export function getPostBySlug(slug: string): Post | null {
  const file = listPostFiles().find((name) => name.replace(/\.mdx?$/, "") === slug);
  return file ? readPostFile(file) : null;
}

export function getAllSlugs(): string[] {
  return getAllPosts().map((post) => post.slug);
}

/** 上一篇 / 下一篇（按时间倒序的列表中，previous 更早，next 更新） */
export function getAdjacentPosts(slug: string): { previous: PostMeta | null; next: PostMeta | null } {
  const posts = getAllPostMeta();
  const index = posts.findIndex((post) => post.slug === slug);
  if (index === -1) return { previous: null, next: null };

  return {
    previous: posts[index + 1] ?? null,
    next: posts[index - 1] ?? null,
  };
}

/** 相关文章：标签重合度最高的前 N 篇 */
export function getRelatedPosts(slug: string, limit = 3): PostMeta[] {
  const posts = getAllPostMeta();
  const current = posts.find((post) => post.slug === slug);
  if (!current) return [];

  return posts
    .filter((post) => post.slug !== slug)
    .map((post) => ({
      post,
      score: post.tags.filter((tag) => current.tags.includes(tag)).length,
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || new Date(b.post.date).getTime() - new Date(a.post.date).getTime())
    .slice(0, limit)
    .map((item) => item.post);
}

export interface TagSummary {
  tag: string;
  count: number;
  latest: string;
}

export function getAllTags(): TagSummary[] {
  const bucket = new Map<string, TagSummary>();

  for (const post of getAllPostMeta()) {
    for (const tag of post.tags) {
      const existing = bucket.get(tag);
      if (existing) {
        existing.count += 1;
        if (new Date(post.date).getTime() > new Date(existing.latest).getTime()) {
          existing.latest = post.date;
        }
      } else {
        bucket.set(tag, { tag, count: 1, latest: post.date });
      }
    }
  }

  return [...bucket.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "zh-CN"));
}

export function getPostsByTag(tag: string): PostMeta[] {
  return getAllPostMeta().filter((post) => post.tags.includes(tag));
}

export interface ArchiveGroup {
  year: string;
  posts: PostMeta[];
}

export function getArchive(): ArchiveGroup[] {
  const groups = new Map<string, PostMeta[]>();

  for (const post of getAllPostMeta()) {
    const year = String(new Date(post.date).getFullYear());
    const list = groups.get(year) ?? [];
    list.push(post);
    groups.set(year, list);
  }

  return [...groups.entries()]
    .map(([year, posts]) => ({ year, posts }))
    .sort((a, b) => Number(b.year) - Number(a.year));
}

/** 站点统计：文章数、标签数、总字数 */
export function getSiteStats() {
  const posts = getAllPosts();
  const words = posts.reduce((total, post) => {
    const cjk = (post.source.match(/[\u4e00-\u9fa5]/g) ?? []).length;
    const en = (post.source.replace(/[\u4e00-\u9fa5]/g, " ").match(/[A-Za-z0-9]+/g) ?? []).length;
    return total + cjk + en;
  }, 0);

  return {
    posts: posts.length,
    tags: getAllTags().length,
    words,
    updatedAt: posts[0]?.date ?? new Date().toISOString(),
  };
}

/**
 * 从原始 MDX 中提取 h2 / h3 标题，生成目录。
 * id 使用 github-slugger，与 rehype-slug 保持一致。
 */
export function extractToc(source: string): TocItem[] {
  const slugger = new GithubSlugger();
  const toc: TocItem[] = [];
  const lines = source.split("\n");
  let inFence = false;

  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const match = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) continue;

    const depth = match[1].length as 2 | 3;
    const text = match[2]
      .replace(/`([^`]*)`/g, "$1")
      .replace(/\*\*([^*]*)\*\*/g, "$1")
      .replace(/\*([^*]*)\*/g, "$1")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/<[^>]+>/g, "")
      .trim();

    if (!text) continue;
    toc.push({ id: slugger.slug(text), text, depth });
  }

  return toc;
}
