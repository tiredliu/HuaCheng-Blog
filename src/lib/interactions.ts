/**
 * 互动层：浏览量、点赞、评论 / 留言（含站长回复）。
 *
 * 这个文件必须保持**客户端安全**（不能 import 任何 `node:*`），
 * 因为 `site-settings.ts` 会引用这里的类型与校验函数，而它同时被服务端使用。
 *
 * ---------------------------------------------------------------------------
 * 后端有两档，由 `content/site-settings.json` 的 `interactions` 决定：
 *
 * | provider   | 数字从哪来                             | 需要部署什么 |
 * | ---------- | -------------------------------------- | ------------ |
 * | `"local"`  | 只统计本机浏览器（默认，零配置）        | 什么都不用   |
 * | `"remote"` | 调用 `apiBase` 上的互动服务（全局计数） | Cloudflare Worker，见 workers/blog-api |
 *
 * 为什么不是「第三方现成计数器」：不蒜子一类免费公众计数器都是个人在维护，
 * 已经出现过整站 502 的情况（见 README）。真正「不会倒闭」的只有自己
 * 托管在大厂 serverless 上的一小段代码 —— 本站已经部署在 Cloudflare Pages，
 * 所以 Worker + KV 是唯一同时满足「免费、不倒闭、国内可访问、无需常驻服务」的方案。
 *
 * `remote` 不可用时（没部署、网络失败、被墙）自动退化成本机计数，
 * 界面上会如实标注数字来源。
 * ---------------------------------------------------------------------------
 */

export type InteractionProvider = "local" | "remote";

export interface InteractionSettings {
  provider: InteractionProvider;
  /** 互动服务地址，例如 https://hc-blog-api.example.workers.dev（结尾不要带斜杠） */
  apiBase: string;
}

export const DEFAULT_INTERACTIONS: InteractionSettings = {
  provider: "local",
  apiBase: "",
};

/** 全站留言板在互动服务里的 path（留言不挂在任何一篇文章上） */
export const GUESTBOOK_PATH = "guestbook";

/** 后端 GitHub 仓库路径：站长发布的留言 / 评论会提交到这里 */
export const GUESTBOOK_REPO_PATH = "content/guestbook.json";
export const COMMENTS_REPO_PATH = "content/comments.json";

/* ------------------------------------------------------------------ */
/* 数据类型                                                            */
/* ------------------------------------------------------------------ */

export interface CommentItem {
  id: string;
  author: string;
  content: string;
  createdAt: string;
  likes: number;
  /** 当前访客是否点过赞（只存在本机） */
  liked?: boolean;
  /** 站长回复 —— 只有站长能写，见 worker 的权限校验 */
  reply?: string;
  replyAt?: string;
  /** 站长自己发的（留言板里的公告式留言就是这一种） */
  owner?: boolean;
  /** 已经写进本地/远端，但还没随构建发布出去 */
  pending?: boolean;
}

export interface InteractionCounters {
  views: number;
  likes: number;
  /** 当前访客是否点过赞 */
  liked: boolean;
  /** 数字来源：remote = 互动服务（全局），local = 只统计本机 */
  source: "remote" | "local";
}

/* ------------------------------------------------------------------ */
/* localStorage 键                                                     */
/* ------------------------------------------------------------------ */

export const MESSAGES_KEY = "hc-blog:messages";
export const POST_COMMENTS_KEY = "hc-blog:post-comments";
export const COMMENT_LIKES_KEY = "hc-blog:comment-likes";
export const VIEWS_KEY = "hc-blog:views";
export const LIKES_KEY = "hc-blog:likes";
export const VISITOR_KEY = "hc-blog:visitor-id";

/** 本机留言 / 评论最多保留多少条，避免 localStorage 被写爆 */
export const MAX_LOCAL_COMMENTS = 200;

/* ------------------------------------------------------------------ */
/* 校验函数（给 usePersistentState 用）                                 */
/* ------------------------------------------------------------------ */

export function isInteractionSettings(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as InteractionSettings;
  return (
    (candidate.provider === "local" || candidate.provider === "remote") &&
    typeof candidate.apiBase === "string"
  );
}

export function isCommentArray(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as CommentItem).id === "string" &&
        typeof (item as CommentItem).content === "string",
    )
  );
}

export function isCommentMap(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every(isCommentArray);
}

export function isNumberMap(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every(
    (item) => typeof item === "number" && Number.isFinite(item),
  );
}

export function isBooleanMap(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every((item) => typeof item === "boolean");
}

/* ------------------------------------------------------------------ */
/* 纯函数                                                              */
/* ------------------------------------------------------------------ */

/**
 * 把文章 slug 变成互动服务认识的 path。
 *
 * 互动服务的 path 只接受 `[A-Za-z0-9._-]`（便于 KV 用键、也避免注入），
 * 而文章 slug 可能是中文（TinaCMS 的 slugify 会保留汉字）。
 * 所以非 ASCII 的 slug 走 UTF-8 十六进制编码：可逆、无碰撞、仍在允许字符集内。
 */
export function toPathKey(slug: string): string {
  if (/^[A-Za-z0-9._-]{1,160}$/.test(slug)) return slug;

  const bytes = new TextEncoder().encode(slug);
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return `x-${hex.slice(0, 150)}`;
}

/**
 * 合并「仓库里的评论」与「本机的评论」。
 *
 * - 按 id 去重，**仓库优先**（仓库那条可能已经被站长回复过）
 * - 按时间正序，方便像聊天记录一样往下读
 */
export function mergeComments(
  repoComments: readonly CommentItem[],
  localComments: readonly CommentItem[],
): CommentItem[] {
  const seen = new Set<string>();
  const merged: CommentItem[] = [];

  for (const item of [...repoComments, ...localComments]) {
    if (!item || typeof item.id !== "string" || seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }

  return merged.sort((a, b) => {
    const left = Date.parse(a.createdAt);
    const right = Date.parse(b.createdAt);
    if (Number.isNaN(left) || Number.isNaN(right)) return 0;
    return left - right;
  });
}

/** 追加一条，并裁掉最旧的，防止 localStorage 无限增长 */
export function appendLocalComment(list: CommentItem[], item: CommentItem): CommentItem[] {
  const next = [...list, item];
  return next.length > MAX_LOCAL_COMMENTS ? next.slice(next.length - MAX_LOCAL_COMMENTS) : next;
}

export function makeId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createLocalComment(author: string, content: string, owner = false): CommentItem {
  return {
    id: makeId(owner ? "owner" : "local"),
    author: author.trim() || "匿名访客",
    content: content.slice(0, 1000),
    createdAt: new Date().toISOString(),
    likes: 0,
    ...(owner ? { owner: true } : {}),
  };
}

/** 匿名访客 id：只用来给「点赞」去重，不含任何身份信息 */
export function getVisitorId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(VISITOR_KEY);
    if (existing) return existing;

    const id =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `v-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    return "";
  }
}

/* ------------------------------------------------------------------ */
/* 本机数字                                                            */
/* ------------------------------------------------------------------ */

function readMap<T>(key: string): Record<string, T> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    return parsed as Record<string, T>;
  } catch {
    return {};
  }
}

function writeMap<T>(key: string, value: Record<string, T>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 容量超限或被禁用时静默降级
  }
}

export function readLocalViews(): Record<string, number> {
  const map = readMap<number>(VIEWS_KEY);
  const clean: Record<string, number> = {};
  for (const [key, value] of Object.entries(map)) {
    if (typeof value === "number" && Number.isFinite(value)) clean[key] = value;
  }
  return clean;
}

export function readLocalLikes(): Record<string, boolean> {
  const map = readMap<boolean>(LIKES_KEY);
  const clean: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(map)) {
    if (typeof value === "boolean") clean[key] = value;
  }
  return clean;
}

/* ------------------------------------------------------------------ */
/* 远程互动服务（Cloudflare Worker，见 workers/blog-api）               */
/* ------------------------------------------------------------------ */

/** 服务地址：结尾斜杠统一去掉，避免拼出 `//stats` */
export function normalizeApiBase(apiBase: string): string {
  return apiBase.trim().replace(/\/+$/, "");
}

export function isRemoteReady(settings: InteractionSettings): boolean {
  return settings.provider === "remote" && normalizeApiBase(settings.apiBase).length > 0;
}

async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs = 6000,
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    // 没部署 / 断网 / 被拦截 / 超时 —— 一律退化成本机，不打扰访客
    return null;
  } finally {
    clearTimeout(timer);
  }
}

interface RemoteStats {
  views?: number;
  likes?: number;
}

interface RemoteComments {
  comments?: CommentItem[];
}

/** 写操作的返回：失败时要能说清原因（比如「只有站长可以回复或删除评论」） */
export type RemoteResult<T> = { ok: true; data: T } | { ok: false; error: string };

interface RemoteErrorBody {
  error?: string;
}

/**
 * 带错误信息的 POST。
 *
 * 读操作（浏览数、点赞数）失败静默退化成本机就够了，
 * 但**写操作必须把原因说出来** —— 否则站长会看到「回复没生效」却不知道为什么：
 * Worker 的 403（不是站长）和「根本没部署」在前端表现会一模一样。
 */
async function postJson<T>(
  url: string,
  body: unknown,
  pick: (payload: unknown) => T | null,
  timeoutMs = 10000,
): Promise<RemoteResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const detail =
        payload && typeof (payload as RemoteErrorBody).error === "string"
          ? (payload as RemoteErrorBody).error
          : "";
      return { ok: false, error: detail || `互动服务返回 HTTP ${response.status}` };
    }

    const picked = pick(payload);
    if (picked === null) return { ok: false, error: "互动服务返回的数据格式不对" };
    return { ok: true, data: picked };
  } catch {
    return { ok: false, error: "连接互动服务失败（可能还没部署、断网或被浏览器拦截）" };
  } finally {
    clearTimeout(timer);
  }
}

/** 从服务端响应里安全地取出浏览数（字段缺失或类型不对时退回 0） */
function readViews(payload: RemoteStats | null): number {
  const value = payload?.views;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** 这一次页面访问里已经计过数的 path（防止 StrictMode 或重渲染重复计数） */
const countedThisVisit = new Set<string>();

/** 只读地取一次当前数字，**不**计数 */
export async function loadCounters(
  path: string,
  settings: InteractionSettings,
): Promise<InteractionCounters> {
  const views = readLocalViews();
  const liked = readLocalLikes()[path] === true;

  const fallback = (): InteractionCounters => ({
    views: views[path] ?? 0,
    likes: liked ? 1 : 0,
    liked,
    source: "local",
  });

  if (!isRemoteReady(settings)) return fallback();

  const payload = await fetchJson<RemoteStats>(
    `${normalizeApiBase(settings.apiBase)}/stats?path=${encodeURIComponent(path)}`,
  );
  if (!payload) return fallback();

  return {
    views: readViews(payload),
    likes: typeof payload.likes === "number" ? payload.likes : 0,
    liked,
    source: "remote",
  };
}

/**
 * 上报一次浏览，并返回该 path 的最新数字。
 *
 * - **一次页面访问只计一次**：React 的 StrictMode 会跑两遍 effect，
 *   不做这个保护的话开发时每次刷新都会 +2
 * - 无论远程能不能用，本机的浏览数都会 +1 —— 界面上永远有东西可看；
 *   远程是全局真值，所以远程可用时显示的是远程数字，不会把本机数字累加进去
 */
export async function registerView(
  path: string,
  settings: InteractionSettings,
): Promise<InteractionCounters> {
  if (countedThisVisit.has(path)) return loadCounters(path, settings);
  countedThisVisit.add(path);

  const views = readLocalViews();
  views[path] = (views[path] ?? 0) + 1;
  writeMap(VIEWS_KEY, views);

  const liked = readLocalLikes()[path] === true;

  const fallback = (): InteractionCounters => ({
    views: views[path],
    likes: liked ? 1 : 0,
    liked,
    source: "local",
  });

  if (!isRemoteReady(settings)) return fallback();

  const payload = await fetchJson<RemoteStats>(`${normalizeApiBase(settings.apiBase)}/hit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });

  if (!payload) return fallback();

  return {
    views: readViews(payload),
    likes: typeof payload.likes === "number" ? payload.likes : 0,
    liked,
    source: "remote",
  };
}

/** 点赞 / 取消点赞（远程模式下由服务端按匿名 visitor id 去重） */
export async function toggleLike(
  path: string,
  settings: InteractionSettings,
): Promise<InteractionCounters> {
  const likes = readLocalLikes();
  const nextLiked = likes[path] !== true;
  likes[path] = nextLiked;
  writeMap(LIKES_KEY, likes);

  const views = readLocalViews();

  if (!isRemoteReady(settings)) {
    return {
      views: views[path] ?? 0,
      likes: nextLiked ? 1 : 0,
      liked: nextLiked,
      source: "local",
    };
  }

  const payload = await fetchJson<RemoteStats>(`${normalizeApiBase(settings.apiBase)}/like`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path,
      action: nextLiked ? "like" : "unlike",
      visitor: getVisitorId(),
    }),
  });

  if (!payload) {
    return {
      views: views[path] ?? 0,
      likes: nextLiked ? 1 : 0,
      liked: nextLiked,
      source: "local",
    };
  }

  return {
    views: typeof payload.views === "number" ? payload.views : (views[path] ?? 0),
    likes: typeof payload.likes === "number" ? payload.likes : 0,
    liked: nextLiked,
    source: "remote",
  };
}

/** 拉取评论（不含本机评论，调用方自己 merge） */
export async function fetchRemoteComments(
  path: string,
  settings: InteractionSettings,
): Promise<CommentItem[] | null> {
  if (!isRemoteReady(settings)) return null;

  const payload = await fetchJson<RemoteComments>(
    `${normalizeApiBase(settings.apiBase)}/comments?path=${encodeURIComponent(path)}`,
  );
  if (!payload || !Array.isArray(payload.comments)) return null;
  return payload.comments.filter((item) => item && typeof item.id === "string");
}

/**
 * 发表评论 / 回复 / 删除。
 *
 * `githubToken` 只在站长的浏览器里存在（和写文章用的是同一个凭据），
 * 只有带上它服务端才会接受 `reply` / `owner` / 删除 —— 这就是
 * 「访客能发言、回复只有站长能做」的强制点。
 */
export interface CommentMutation {
  comment?: CommentItem;
  replyTo?: string;
  reply?: string;
  deleteId?: string;
  githubToken?: string;
}

export async function mutateRemoteComments(
  path: string,
  settings: InteractionSettings,
  mutation: CommentMutation,
): Promise<RemoteResult<CommentItem[]>> {
  if (!isRemoteReady(settings)) {
    return { ok: false, error: "没有配置互动服务（interactions.provider 不是 remote）" };
  }

  return postJson(
    `${normalizeApiBase(settings.apiBase)}/comments`,
    { path, ...mutation },
    (payload) => {
      const comments = (payload as RemoteComments | null)?.comments;
      if (!Array.isArray(comments)) return null;
      return comments.filter((item) => item && typeof item.id === "string");
    },
  );
}
