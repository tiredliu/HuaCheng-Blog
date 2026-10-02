/**
 * 站内搜索。
 *
 * 纯静态站点没有后端，所以索引在**构建期**生成成一份 JSON
 * （见 `src/app/search-index.json/route.ts`），浏览器首次打开搜索时才拉取。
 *
 * 这个文件必须保持「客户端安全」：不能 import 任何 `node:*`。
 * 索引的生成（需要读文件）放在 `src/lib/posts.ts` 里。
 */

export interface SearchEntry {
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  date: string;
  /** 全文字数（中日韩按字、西文按词） */
  wordCount: number;
  /** 去掉 Markdown 语法后的正文纯文本，用于全文匹配与摘要生成 */
  text: string;
}

export interface SearchHit extends SearchEntry {
  score: number;
  /** 命中位置附近的片段 */
  snippet: string;
}

/** 标题/标签命中权重最高，正文最低 */
const WEIGHT = {
  titleExact: 40,
  titlePrefix: 22,
  title: 14,
  tag: 10,
  summary: 5,
  text: 2,
  /** 正文里重复出现时的额外加分，设上限避免长文霸榜 */
  textRepeat: 1,
  textRepeatMax: 6,
} as const;

/**
 * 切词。
 *
 * 中文没有空格，所以短语（例如「静态导出」）会作为一个整体词元保留，
 * 用子串匹配就能命中。多个词用空白或常见标点分隔。
 *
 * ⚠️ 不要把「整串查询」也加进词元：那样「静态 部署」会要求文档里
 * 字面出现带空格的 `静态 部署`，任何多词查询都会变成 0 条结果。
 */
export function tokenize(query: string): string[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];

  return [
    ...new Set(
      normalized
        .split(/[\s,，、;；/\\|]+/)
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  ];
}

function countOccurrences(haystack: string, needle: string, max: number): number {
  if (!needle) return 0;
  let count = 0;
  let from = 0;
  while (count < max) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) break;
    count += 1;
    from = at + needle.length;
  }
  return count;
}

/**
 * 给一条索引打分。
 *
 * `requireAll` 为 true 时是 AND 语义：只要有一个词没命中就返回 0。
 * 为 false 时是 OR 语义：命中越多分越高，用于「严格匹配没有结果」的兜底。
 */
export function scoreEntry(
  entry: SearchEntry,
  tokens: string[],
  requireAll = true,
): number {
  if (tokens.length === 0) return 0;

  const title = entry.title.toLowerCase();
  const summary = entry.summary.toLowerCase();
  const text = entry.text.toLowerCase();
  const tags = entry.tags.map((tag) => tag.toLowerCase());

  let score = 0;
  let matched = 0;

  for (const token of tokens) {
    let tokenScore = 0;

    if (title.includes(token)) {
      tokenScore += WEIGHT.title;
      if (title.startsWith(token)) tokenScore += WEIGHT.titlePrefix;
      if (title === token) tokenScore += WEIGHT.titleExact;
    }
    if (tags.some((tag) => tag.includes(token))) tokenScore += WEIGHT.tag;
    if (summary.includes(token)) tokenScore += WEIGHT.summary;

    const repeats = countOccurrences(text, token, WEIGHT.textRepeatMax + 1);
    if (repeats > 0) {
      tokenScore += WEIGHT.text + Math.min(repeats - 1, WEIGHT.textRepeatMax) * WEIGHT.textRepeat;
    }

    if (tokenScore > 0) {
      matched += 1;
      score += tokenScore;
    } else if (requireAll) {
      return 0;
    }
  }

  if (matched === 0) return 0;

  // OR 模式下按命中比例加权，避免「只命中一个常见词」的长文压过精准结果
  if (!requireAll) score *= matched / tokens.length;

  // 稍新的文章略微靠前
  const age = Date.now() - new Date(entry.date).getTime();
  const freshness = Math.max(0, 3 - age / (1000 * 60 * 60 * 24 * 365));
  return score + freshness;
}

/** 截取第一个命中词附近的片段 */
export function buildSnippet(text: string, tokens: string[], radius = 60): string {
  const lower = text.toLowerCase();

  let at = -1;
  let matchedLength = 0;
  for (const token of tokens) {
    const found = lower.indexOf(token);
    if (found !== -1 && (at === -1 || found < at)) {
      at = found;
      matchedLength = token.length;
    }
  }

  if (at === -1) {
    return text.length > radius * 2 ? `${text.slice(0, radius * 2)}…` : text;
  }

  const start = Math.max(0, at - radius);
  const end = Math.min(text.length, at + matchedLength + radius);

  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

export interface SearchOutcome {
  hits: SearchHit[];
  /** all = 所有词都命中；partial = 严格匹配没结果，退化成部分匹配 */
  mode: "all" | "partial";
}

/** 结果排序方式 */
export type SearchSort = "relevance" | "newest" | "oldest";

export const SEARCH_SORT_LABEL: Record<SearchSort, string> = {
  relevance: "相关度",
  newest: "时间倒序",
  oldest: "时间正序",
};

export function isSearchSort(value: unknown): value is SearchSort {
  return value === "relevance" || value === "newest" || value === "oldest";
}

const byDateDesc = (a: SearchHit, b: SearchHit) =>
  new Date(b.date).getTime() - new Date(a.date).getTime();

/**
 * 排序。
 *
 * 时间排序时**分数仍然参与**：日期相同时（同一天发的两篇）按相关度排，
 * 否则同一天的文章顺序会随机漂移。相关度排序时反过来，用日期做稳定的兜底。
 */
function sortHits(hits: SearchHit[], sort: SearchSort): SearchHit[] {
  const sorted = [...hits];

  if (sort === "newest") {
    sorted.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.score - a.score);
  } else if (sort === "oldest") {
    sorted.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || b.score - a.score);
  } else {
    sorted.sort((a, b) => b.score - a.score || byDateDesc(a, b));
  }

  return sorted;
}

function rank(
  entries: SearchEntry[],
  tokens: string[],
  requireAll: boolean,
  limit: number,
  sort: SearchSort,
): SearchHit[] {
  const hits = entries
    .map((entry) => ({ entry, score: scoreEntry(entry, tokens, requireAll) }))
    .filter((item) => item.score > 0)
    .map(({ entry, score }) => ({ ...entry, score, snippet: buildSnippet(entry.text, tokens) }));

  return sortHits(hits, sort).slice(0, limit);
}

/**
 * 检索。
 *
 * 先按 AND 语义找「所有词都命中」的文章；如果一个都没有，
 * 再退化成 OR 语义并把 mode 标成 partial，让界面如实告诉用户
 * 「没有完全匹配的结果，以下是部分匹配」——比直接显示「无结果」有用得多。
 *
 * ⚠️ 排序在 `slice` **之前**做，否则「按时间倒序」只会对已经按相关度
 * 截断出来的前 N 条排序，结果是不对的。
 */
export function searchEntries(
  entries: SearchEntry[],
  query: string,
  options: { limit?: number; sort?: SearchSort } = {},
): SearchOutcome {
  const { limit = 12, sort = "relevance" } = options;
  const tokens = tokenize(query);
  if (tokens.length === 0) return { hits: [], mode: "all" };

  const strict = rank(entries, tokens, true, limit, sort);
  if (strict.length > 0) return { hits: strict, mode: "all" };

  const loose = rank(entries, tokens, false, limit, sort);
  return { hits: loose, mode: loose.length > 0 ? "partial" : "all" };
}

/** 索引里的条目数（用于在界面上告诉用户搜了多少篇） */
export function indexSize(entries: SearchEntry[]): number {
  return entries.length;
}
