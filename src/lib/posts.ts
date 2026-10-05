import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import GithubSlugger from "github-slugger";
import type { SearchEntry } from "@/lib/search";

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
  /**
   * 正文里插入的图片（最多 4 张，路径已补上 basePath）。
   *
   * 列表页的缩略框用它展示「这篇文章里有哪些图」；
   * frontmatter 里的 `cover` 则用来当整张卡片的背景图。
   */
  images: string[];
  author: string;
  draft: boolean;
  /**
   * 全文字数：中日韩字符按字计，西文按词计。
   *
   * 曾经这里放的是「预估阅读时长」，但「约 2 分钟」这种描述既没说清是
   * 「读多久」还是「写多久」，又隐含了一个拍脑袋的阅读速度假设。
   * 换成字数之后是**可核对的事实**：打开文章数一数就知道对不对。
   */
  wordCount: number;
}

export interface Post extends PostMeta {
  /** 原始 MDX 正文（不含 frontmatter） */
  source: string;
  /**
   * 磁盘上的真实文件名（含扩展名，例如 `hello-world.mdx`）。
   *
   * 文章可以是 `.mdx` 也可以是 `.md` —— Typora / Obsidian 这类写作工具原生只认 `.md`，
   * 而 Typora 在某些平台上保存时还会把 `.mdx` 改名成 `.md`。
   * `slug` 两者相同，所以文章页必须靠这个字段才知道该 import 哪个文件。
   */
  fileName: string;
}

export interface TocItem {
  id: string;
  text: string;
  depth: 2 | 3;
}

export { SITE } from "@/lib/site";
import { SITE, resolveImageSrc } from "@/lib/site";
import { buildSlugToTagMap, findTagSlugCollisions, tagToSlug } from "@/lib/tag-slug";

/** 正文里最多为列表页取几张缩略图 */
const CARD_IMAGE_LIMIT = 4;

/** 去掉代码块与行内代码：示例代码里的图片地址不算「文章里插了图」 */
function stripCode(source: string): string {
  return source
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/~~~[\s\S]*?~~~/g, " ")
    .replace(/`[^`\n]*`/g, " ");
}

/**
 * 从 MDX 正文里提取插入的图片（构建期执行）。
 *
 * 支持的两种写法：
 * - Markdown：`![说明](/images/x.jpg)`
 * - 原生标签：`<img src="/images/x.jpg" />`
 *
 * 刻意**跳过 data URL 与相对路径**：前者会让卡片背上几百 KB 的 base64，
 * 后者在列表页（URL 层级不同）会解析到错误的位置。
 * 地址的规整统一走 `resolveImageSrc()`，和正文里的 `<img>` 完全一致。
 */
export function extractImages(source: string, limit = CARD_IMAGE_LIMIT): string[] {
  const text = stripCode(source);
  const found: string[] = [];

  const patterns = [
    // ![说明](/images/x.jpg "可选标题")
    /!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g,
    // <img src="/images/x.jpg" …>
    /<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi,
  ];

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const src = resolveImageSrc(match[1]);
      if (!src || src.startsWith("data:")) continue;

      // 相对路径在列表页会解析错位置，直接跳过
      const isAbsolute = src.startsWith("/") || /^(https?:)?\/\//i.test(src);
      if (!isAbsolute) continue;
      if (found.includes(src)) continue;

      found.push(src);
      if (found.length >= limit) return found;
    }
  }

  return found;
}

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

/**
 * 统计字数：中日韩字符按「字」计，西文按「词」计。
 *
 * 不统计 Markdown 语法符号（`#`、`*`、`|` 等），否则表格多的文章会被明显高估。
 */
export function countWords(source: string): number {
  const plain = toPlainText(source);
  const cjk = (plain.match(/[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/g) ?? []).length;
  const words = (plain.replace(/[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/g, " ").match(/[A-Za-z0-9]+/g) ?? [])
    .length;
  return cjk + words;
}

function readPostFile(fileName: string): Post {
  const slug = fileName.replace(/\.mdx?$/, "");

  /**
   * 文件名必须是 ASCII。
   *
   * 非 ASCII（中文）文件名会让这篇文章**打不开**：Next 拿 URL 里已编码的路径段
   * 去和 `generateStaticParams()` 的返回值比，中文永远不相等 ——
   * dev 下 500/404，产物里还会出现 `out/posts/中文名/` 这种目录。
   * 详见 AI_CONTEXT 硬约束 9。
   *
   * 这条检查是**故意加的**，起因是 Obsidian 新建笔记的默认名就是「未命名」——
   * 一个中文名，而它在 Obsidian 里看不出任何异常。
   * 没有这条检查的话，失败方式是「文章悄悄不出现」，最难查。
   *
   * dev 下只警告（否则整个开发服务器会跟着报错，太吵）；
   * 构建时直接抛错 —— 让它在**部署之前**就停下来。
   */
  if (!/^[A-Za-z0-9._-]+$/.test(slug)) {
    const message =
      `文章文件名必须是 ASCII：content/posts/${fileName}\n` +
      `  非 ASCII（中文）文件名会让这篇文章打不开：dev 下 500/404，产物目录名也会变成中文。\n` +
      `  把它改成英文 / 数字 / 连字符即可；标题写在 frontmatter 的 title 里，不受影响。`;
    if (process.env.NODE_ENV === "production") throw new Error(message);
    console.warn(`[posts] ${message}`);
  }

  const raw = fs.readFileSync(path.join(POSTS_DIR, fileName), "utf8");
  const { data, content } = matter(raw);
  const stat = fs.statSync(path.join(POSTS_DIR, fileName));
  const cover = resolveImageSrc(data.cover);

  return {
    slug,
    title: typeof data.title === "string" && data.title.trim() ? data.title.trim() : slug,
    date: normalizeDate(data.date, stat.mtimeMs),
    summary:
      typeof data.summary === "string" && data.summary.trim()
        ? data.summary.trim()
        : buildSummary(content),
    tags: normalizeTags(data.tags),
    ...(cover && !cover.startsWith("data:") ? { cover } : {}),
    images: extractImages(content),
    author: typeof data.author === "string" && data.author.trim() ? data.author.trim() : SITE.author,
    draft: data.draft === true,
    wordCount: countWords(content),
    source: content,
    fileName,
  };
}

/**
 * 把 MDX 正文压成纯文本，供搜索索引与摘要使用。
 *
 * 代码块的内容会保留 —— 搜 `useSyncExternalStore` 这类 API 名字时很有用；
 * 但围栏标记、JSX 标签、Markdown 装饰符都会去掉。
 */
export function toPlainText(source: string): string {
  return source
    // 代码围栏标记去掉，保留里面的代码
    .replace(/^\s*(```|~~~)[^\n]*$/gm, " ")
    // 行内代码保留内容
    .replace(/`([^`]*)`/g, "$1")
    // 图片整个丢掉（文件名对搜索没意义）
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    // 链接只留文字
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    // MDX / HTML 标签去掉，保留标签之间的文字
    .replace(/<\/?[A-Za-z][^>]*>/g, " ")
    // 标题、引用、列表的前缀符号
    .replace(/^\s{0,3}#{1,6}\s+/gm, " ")
    .replace(/^\s{0,3}>\s?/gm, " ")
    .replace(/^\s{0,3}([-*+]|\d+\.)\s+/gm, " ")
    // 强调、删除线
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .replace(/~~(.*?)~~/g, "$1")
    // 表格分隔行
    .replace(/^\s*\|?[\s:|-]+\|[\s:|-]*$/gm, " ")
    .replace(/\|/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 没有手写 summary 时，用正文兜底 */
function buildSummary(source: string): string {
  const plain = toPlainText(source.replace(/```[\s\S]*?```/g, " "));
  return plain.length > 96 ? `${plain.slice(0, 96)}…` : plain;
}

/**
 * 文章文件：`.mdx` 和 `.md` 都收。
 *
 * 两种扩展名走的是**同一条 MDX 管线**（`@next/mdx` 默认就同时处理这两个后缀），
 * 所以 `.md` 里照样能用 `<Callout>`、Shiki 高亮和 KaTeX 公式 —— 区别只在文件名。
 * 这样 Typora / Obsidian 就能直接编辑（它们原生只认 `.md`）。
 */
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

/** 只取元信息，避免把整篇正文传进客户端组件（`fileName` 也只在服务端用） */
export function getAllPostMeta(options?: { includeDrafts?: boolean }): PostMeta[] {
  return getAllPosts(options).map(({ source: _source, fileName: _fileName, ...meta }) => meta);
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
  /** URL 里用的 ASCII 标识，见 `src/lib/tag-slug.ts` */
  slug: string;
  count: number;
  latest: string;
}

export function getAllTags(): TagSummary[] {
  const posts = getAllPostMeta();

  // slug 撞车会让两个标签指向同一个 URL，必须在构建期就炸掉而不是静默合并
  const collisions = findTagSlugCollisions(posts.flatMap((post) => post.tags));
  if (collisions.length > 0) {
    const detail = collisions
      .map((item) => `  ${item.slug} ← ${item.tags.join(" / ")}`)
      .join("\n");
    throw new Error(
      `标签 slug 冲突：不同的标签生成了相同的 URL 标识。\n${detail}\n` +
        `请在 src/lib/tag-slug.ts 的 TAG_SLUG_OVERRIDES 里给其中一个指定不同的 slug。`,
    );
  }

  const bucket = new Map<string, TagSummary>();

  for (const post of posts) {
    for (const tag of post.tags) {
      const existing = bucket.get(tag);
      if (existing) {
        existing.count += 1;
        if (new Date(post.date).getTime() > new Date(existing.latest).getTime()) {
          existing.latest = post.date;
        }
      } else {
        bucket.set(tag, { tag, slug: tagToSlug(tag), count: 1, latest: post.date });
      }
    }
  }

  return [...bucket.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "zh-CN"));
}

/** slug → 原始标签名；找不到返回 undefined */
export function getTagBySlug(slug: string): string | undefined {
  return buildSlugToTagMap(getAllPostMeta().flatMap((post) => post.tags)).get(slug);
}

export function getPostsByTag(tag: string): PostMeta[] {
  return getAllPostMeta().filter((post) => post.tags.includes(tag));
}

export function getPostsByTagSlug(slug: string): PostMeta[] {
  const tag = getTagBySlug(slug);
  return tag ? getPostsByTag(tag) : [];
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
  const words = posts.reduce((total, post) => total + post.wordCount, 0);

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

/** 单篇文章进入搜索索引的最大正文字数，防止索引文件无限膨胀 */
const SEARCH_TEXT_LIMIT = 6000;

/**
 * 生成站内搜索索引（构建期执行）。
 *
 * 由 `src/app/search-index.json/route.ts` 输出成 `/search-index.json`，
 * 浏览器只在首次打开搜索时才下载。
 */
export function getSearchIndex(): SearchEntry[] {
  return getAllPosts().map((post) => {
    const text = toPlainText(post.source);
    return {
      slug: post.slug,
      title: post.title,
      summary: post.summary,
      tags: post.tags,
      date: post.date,
      wordCount: post.wordCount,
      text: text.length > SEARCH_TEXT_LIMIT ? text.slice(0, SEARCH_TEXT_LIMIT) : text,
    };
  });
}
