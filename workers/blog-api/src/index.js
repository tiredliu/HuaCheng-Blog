/**
 * 花城博客 · 互动 API（Cloudflare Worker）
 * ================================================================
 *
 * 给纯静态博客补充「浏览量 / 点赞 / 评论（含站长回复）」三件事。
 *
 * 设计要点：
 * - 纯 JavaScript（ESM），零 npm 依赖，只用 Web 标准 API + Workers 的 KV binding。
 * - 无状态：所有数据都在 KV 里，isolate 随时可以被回收。
 * - 前端是静态站点，浏览器会直接跨域调用，所以每个响应（含错误响应）都带 CORS 头。
 * - 站长身份用「只授权本仓库、只给 Contents: Read and write 的 GitHub fine-grained PAT」证明。
 *   ⚠️ 这种 token 调 `GET /user` 会返回 403（细粒度 token 没有 user 权限），
 *   所以这里改为读仓库详情接口，看 `permissions.push === true`。
 * - 校验必须「失败即拒」：GitHub 超时 / 报错一律不算站长，绝不放行。
 *
 * 接口（前端已按此写死，不要改名）：
 *   GET  /stats?path=<path>                     → { views, likes }
 *   POST /hit                                   → { views, likes }
 *   POST /like                                  → { views, likes }
 *   GET  /comments?path=<path>                  → { comments }
 *   POST /comments                              → { comments }（发表 / 回复 / 删除）
 *
 * KV（binding 名固定 BLOG_KV）：
 *   stats:<path>    → { views: number, likes: number }
 *   likers:<path>   → string[]（点过赞的 visitor，最多 2000 个，超出丢最旧的）
 *   comments:<path> → Comment[]（最多 500 条，新的排在末尾）
 *
 * ⚠️ KV 没有事务，并发写做不到严格原子：同一瞬间的两次写会互相覆盖，
 *    计数在高并发下可能少量丢失。对个人博客完全够用，详见 README。
 */

/* ============================== 常量 ============================== */

/** 请求体大小上限（字节） */
const MAX_BODY_BYTES = 32 * 1024;
/** 单个 path 的评论条数上限 */
const MAX_COMMENTS = 500;
/** 单个 path 记录的点赞访客上限，超出丢弃最旧的 */
const MAX_LIKERS = 2000;
/** path 长度上限 */
const MAX_PATH_LENGTH = 160;
/** path 允许的字符集：字母、数字、点、下划线、连字符（`guestbook` 这类特殊值也符合） */
const PATH_PATTERN = /^[A-Za-z0-9._-]+$/;
/** 昵称长度上限 */
const MAX_AUTHOR_LENGTH = 24;
/** 评论正文长度上限 */
const MAX_CONTENT_LENGTH = 1000;
/** 站长回复长度上限 */
const MAX_REPLY_LENGTH = 1000;
/** visitor 长度上限（正常是 UUID，留足余量即可） */
const MAX_VISITOR_LENGTH = 128;
/** 客户端自带 id 的允许格式，防止塞进奇怪字符或超长值 */
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
/** 昵称为空时的兜底值 */
const DEFAULT_AUTHOR = "匿名访客";
/** 向 GitHub 校验站长身份的超时时间（毫秒） */
const GITHUB_TIMEOUT_MS = 8000;
/** GitHub 要求的 API 版本头 */
const GITHUB_API_VERSION = "2022-11-28";

/** 站长身份校验的三种结论 */
const VERDICT_OWNER = "owner";
const VERDICT_NOT_OWNER = "not_owner";
const VERDICT_UNAVAILABLE = "unavailable";

/* ============================== 入口 ============================== */

/**
 * Worker 入口：任何未捕获异常都收敛成 500，绝不把堆栈泄露给前端。
 *
 * （写成具名变量再 export default，是为了过仓库里 eslint 的
 * `import/no-anonymous-default-export` 规则 —— 本项目的验收标准是 0 warning。）
 */
const worker = {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      console.error("未捕获异常：", error && error.stack ? error.stack : error);
      return jsonResponse({ error: "服务端异常" }, 500, env);
    }
  },
};

export default worker;

/* ============================== 路由 ============================== */

async function handleRequest(request, env) {
  // 预检请求：任何路径都直接放行，带上完整 CORS 头
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(env) });
  }

  const url = new URL(request.url);
  const route = normalizeRoute(url.pathname);

  switch (route) {
    case "/stats": {
      if (request.method !== "GET") return methodNotAllowed("GET, OPTIONS", env);
      return handleGetStats(url, env);
    }
    case "/hit": {
      if (request.method !== "POST") return methodNotAllowed("POST, OPTIONS", env);
      return handleHit(request, env);
    }
    case "/like": {
      if (request.method !== "POST") return methodNotAllowed("POST, OPTIONS", env);
      return handleLike(request, env);
    }
    case "/comments": {
      if (request.method === "GET") return handleGetComments(url, env);
      if (request.method === "POST") return handlePostComments(request, env);
      return methodNotAllowed("GET, POST, OPTIONS", env);
    }
    default:
      return jsonResponse({ error: "未知接口" }, 404, env);
  }
}

/** 把 `/stats/` 这类带尾部斜杠的路径归一化；根路径保持 `/` */
function normalizeRoute(pathname) {
  if (typeof pathname !== "string" || pathname === "") return "/";
  let route = pathname;
  while (route.length > 1 && route.endsWith("/")) route = route.slice(0, -1);
  return route;
}

/* ========================= 统计 / 浏览量 ========================= */

/** GET /stats?path=<path> */
async function handleGetStats(url, env) {
  const path = normalizePath(url.searchParams.get("path"));
  if (!path) return invalidPathResponse(env);

  const stats = await readStats(env, path);
  return jsonResponse({ views: stats.views, likes: stats.likes }, 200, env);
}

/** POST /hit，body { path } */
async function handleHit(request, env) {
  const parsed = await readJsonBody(request);
  if (parsed.error) return jsonResponse({ error: parsed.error }, 400, env);

  const path = normalizePath(parsed.data.path);
  if (!path) return invalidPathResponse(env);

  const stats = await readStats(env, path);
  stats.views += 1;
  await writeJson(env, statsKey(path), stats);

  return jsonResponse({ views: stats.views, likes: stats.likes }, 200, env);
}

/* ============================== 点赞 ============================== */

/** POST /like，body { path, action: "like" | "unlike", visitor } */
async function handleLike(request, env) {
  const parsed = await readJsonBody(request);
  if (parsed.error) return jsonResponse({ error: parsed.error }, 400, env);

  const body = parsed.data;
  const path = normalizePath(body.path);
  if (!path) return invalidPathResponse(env);

  // 前端只会发 like / unlike；其它取值按「点赞」处理，不为此报错
  const action = body.action === "unlike" ? "unlike" : "like";

  // visitor 缺失或不是字符串时按「无去重」处理，不报错
  const visitor =
    typeof body.visitor === "string" && body.visitor.trim()
      ? truncate(body.visitor.trim(), MAX_VISITOR_LENGTH)
      : "";

  const stats = await readStats(env, path);
  const likers = await readLikers(env, path);
  let changed = false;

  if (action === "like") {
    if (!visitor) {
      stats.likes += 1;
      changed = true;
    } else if (!likers.includes(visitor)) {
      likers.push(visitor);
      stats.likes += 1;
      changed = true;
    }
    // 同一个 visitor 重复 like：什么都不做（幂等）
  } else {
    if (!visitor) {
      stats.likes = Math.max(0, stats.likes - 1);
      changed = true;
    } else {
      const index = likers.indexOf(visitor);
      if (index !== -1) {
        likers.splice(index, 1);
        stats.likes = Math.max(0, stats.likes - 1);
        changed = true;
      }
      // 没点过赞就 unlike：不减数（幂等）
    }
  }

  // 只有真的发生变化才写 KV：省免费额度，也少一次并发覆盖的机会
  if (changed) {
    const trimmedLikers = likers.length > MAX_LIKERS ? likers.slice(-MAX_LIKERS) : likers;
    await Promise.all([
      writeJson(env, statsKey(path), stats),
      writeJson(env, likersKey(path), trimmedLikers),
    ]);
  }

  return jsonResponse({ views: stats.views, likes: stats.likes }, 200, env);
}

/* ============================== 评论 ============================== */

/** GET /comments?path=<path> */
async function handleGetComments(url, env) {
  const path = normalizePath(url.searchParams.get("path"));
  if (!path) return invalidPathResponse(env);

  const comments = await readComments(env, path);
  return jsonResponse({ comments }, 200, env);
}

/**
 * POST /comments —— 三种形态：
 *   1. 访客发表：{ path, comment: { id, author, content, createdAt } }
 *   2. 站长发表 / 回复：{ path, comment: { …, owner?, reply?, replyAt? }, githubToken }
 *      或 { path, replyTo, reply, githubToken }
 *   3. 站长删除：{ path, deleteId, githubToken }
 *
 * 安全边界：`owner` / `replyTo` / `deleteId` 是站长专属。
 * 非站长碰这三个字段 → 403，且不写入任何数据。
 * 访客提交的 `owner` / `reply` / `replyAt` / `likes` 一律剥离。
 */
async function handlePostComments(request, env) {
  const parsed = await readJsonBody(request);
  if (parsed.error) return jsonResponse({ error: parsed.error }, 400, env);

  const body = parsed.data;
  const path = normalizePath(body.path);
  if (!path) return invalidPathResponse(env);

  const deleteId = typeof body.deleteId === "string" ? body.deleteId.trim() : "";
  const replyTo = typeof body.replyTo === "string" ? body.replyTo.trim() : "";
  const rawComment =
    body.comment && typeof body.comment === "object" && !Array.isArray(body.comment)
      ? body.comment
      : null;
  // owner 字段只要是「真值」就当作站长意图，宁可严格一点
  const wantsOwnerFlag = Boolean(rawComment && rawComment.owner);
  const ownerOnlyIntent = Boolean(deleteId || replyTo || wantsOwnerFlag);

  const token = extractToken(request, body);
  let isOwner = false;

  // 只有出现「站长意图」或者带了 token 时才去问 GitHub，普通访客评论不做上游请求
  if (ownerOnlyIntent || token) {
    const verdict = await verifyOwner(env, token);
    if (verdict === VERDICT_UNAVAILABLE) {
      return jsonResponse({ error: "站长身份校验暂时不可用" }, 503, env);
    }
    if (verdict !== VERDICT_OWNER) {
      if (ownerOnlyIntent) {
        // 关键安全边界：先判定身份，再决定写不写，这里直接返回，绝不落库
        return jsonResponse({ error: "只有站长可以回复或删除评论" }, 403, env);
      }
      // 带了个无效 token 但没有越权意图：按普通访客评论处理（下面会剥离越权字段）
    } else {
      isOwner = true;
    }
  }

  // ---------- 站长删除 ----------
  if (deleteId) {
    if (!ID_PATTERN.test(deleteId)) return jsonResponse({ error: "评论 id 格式不合法" }, 400, env);
    const comments = await readComments(env, path);
    const next = comments.filter((item) => item.id !== deleteId);
    // 删除一个本来就不存在的 id：幂等处理，直接返回当前列表
    if (next.length !== comments.length) await writeJson(env, commentsKey(path), next);
    return jsonResponse({ comments: next }, 200, env);
  }

  // ---------- 站长回复已有评论 ----------
  if (replyTo) {
    if (!ID_PATTERN.test(replyTo)) return jsonResponse({ error: "评论 id 格式不合法" }, 400, env);
    const replyText = typeof body.reply === "string" ? body.reply : "";
    if (!replyText.trim()) return jsonResponse({ error: "回复内容不能为空" }, 400, env);
    if (countChars(replyText) > MAX_REPLY_LENGTH) {
      return jsonResponse({ error: `回复内容过长（上限 ${MAX_REPLY_LENGTH} 个字符）` }, 400, env);
    }

    const comments = await readComments(env, path);
    const index = comments.findIndex((item) => item.id === replyTo);
    if (index === -1) return jsonResponse({ error: "要回复的评论不存在" }, 404, env);

    comments[index] = {
      ...comments[index],
      reply: truncate(replyText, MAX_REPLY_LENGTH),
      // 回复时间同样用服务器时间，不信任客户端
      replyAt: new Date().toISOString(),
    };
    await writeJson(env, commentsKey(path), comments);
    return jsonResponse({ comments }, 200, env);
  }

  // ---------- 发表评论（访客 / 站长） ----------
  if (!rawComment) return jsonResponse({ error: "缺少 comment 字段" }, 400, env);

  const content = typeof rawComment.content === "string" ? rawComment.content : "";
  if (!content.trim()) return jsonResponse({ error: "评论内容不能为空" }, 400, env);
  if (countChars(content) > MAX_CONTENT_LENGTH) {
    return jsonResponse({ error: `评论内容过长（上限 ${MAX_CONTENT_LENGTH} 个字符）` }, 400, env);
  }

  const authorRaw = typeof rawComment.author === "string" ? rawComment.author.trim() : "";
  if (countChars(authorRaw) > MAX_AUTHOR_LENGTH) {
    return jsonResponse({ error: `昵称过长（上限 ${MAX_AUTHOR_LENGTH} 个字符）` }, 400, env);
  }

  // 只有站长才允许带 reply，先校验长度，避免读到 KV 之后才发现要 400
  const replyText = isOwner && typeof rawComment.reply === "string" ? rawComment.reply : "";
  if (replyText.trim() && countChars(replyText) > MAX_REPLY_LENGTH) {
    return jsonResponse({ error: `回复内容过长（上限 ${MAX_REPLY_LENGTH} 个字符）` }, 400, env);
  }

  const comments = await readComments(env, path);
  if (comments.length >= MAX_COMMENTS) {
    // 顺带把现有列表返回：前端即使在报错分支里也直接读 data.comments 也不会拿到 undefined
    return jsonResponse({ error: "评论数已达上限", comments }, 400, env);
  }

  const now = new Date().toISOString();
  const comment = {
    id: pickCommentId(rawComment.id, comments),
    author: authorRaw ? truncate(authorRaw, MAX_AUTHOR_LENGTH) : DEFAULT_AUTHOR,
    content: truncate(content, MAX_CONTENT_LENGTH),
    // createdAt 一律用服务器时间，不信任客户端
    createdAt: now,
    // likes 一律从 0 开始，客户端传什么都不认
    likes: 0,
  };

  if (isOwner) {
    if (wantsOwnerFlag) comment.owner = true;
    if (replyText.trim()) {
      comment.reply = truncate(replyText, MAX_REPLY_LENGTH);
      comment.replyAt = now;
    }
  }
  // 非站长路径：上面根本没写入 owner / reply / replyAt / likes（likes 固定 0），
  // 所以访客塞进来的这些字段等于被剥离。

  // 新评论排在末尾，前端按时间正序展示
  comments.push(comment);
  await writeJson(env, commentsKey(path), comments);

  return jsonResponse({ comments }, 200, env);
}

/**
 * 选一个唯一的评论 id：客户端给的合法且没撞车就用它，否则服务端生成 UUID。
 * （撞车时重新生成而不是报错，保证「id 唯一」且不会让前端反复提交失败。）
 */
function pickCommentId(rawId, comments) {
  if (typeof rawId === "string") {
    const candidate = rawId.trim();
    if (ID_PATTERN.test(candidate) && !comments.some((item) => item.id === candidate)) {
      return candidate;
    }
  }
  return crypto.randomUUID();
}

/* ======================== 站长身份校验 ======================== */

/** 优先取 `Authorization: Bearer <token>`，其次取 body 里的 githubToken */
function extractToken(request, body) {
  const header = request.headers.get("Authorization");
  if (typeof header === "string") {
    const matched = /^Bearer\s+(.+)$/i.exec(header.trim());
    if (matched && matched[1].trim()) return matched[1].trim();
  }
  if (body && typeof body.githubToken === "string" && body.githubToken.trim()) {
    return body.githubToken.trim();
  }
  return "";
}

/**
 * 校验请求者是不是仓库主人。
 *
 * 做法：拿 token 调 `GET https://api.github.com/repos/{owner}/{repo}`，
 * 要求 `response.ok` 且 `data.permissions.push === true`。
 *
 * 为什么不调 `GET /user`：fine-grained PAT 只给了 Contents: Read and write 时
 * `/user` 会返回 403，用它会把真正的站长也挡在门外。
 *
 * 结论只在本函数内使用，不跨请求做内存缓存（isolate 会被回收，缓存容易出隐蔽 bug）。
 *
 * @returns {Promise<"owner"|"not_owner"|"unavailable">}
 */
async function verifyOwner(env, token) {
  // 没带 token 不用问 GitHub，直接判定「不是站长」
  if (!token) return VERDICT_NOT_OWNER;

  const owner = typeof env.GH_OWNER === "string" ? env.GH_OWNER.trim() : "";
  const repo = typeof env.GH_REPO === "string" ? env.GH_REPO.trim() : "";
  if (!owner || !repo) {
    console.error("缺少 GH_OWNER / GH_REPO 配置，无法校验站长身份");
    return VERDICT_UNAVAILABLE;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GITHUB_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": GITHUB_API_VERSION,
          "User-Agent": "hc-blog-api",
        },
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      const remaining = response.headers.get("x-ratelimit-remaining");
      // 把 body 读掉，释放连接（内容不需要）
      try {
        await response.text();
      } catch {
        /* 忽略：只为释放连接 */
      }
      // 上游自己坏了 → 校验不可用
      if (response.status >= 500) return VERDICT_UNAVAILABLE;
      // 触发限流 → 也是上游状态问题，不是「你不是站长」
      if ((response.status === 403 || response.status === 429) && remaining === "0") {
        return VERDICT_UNAVAILABLE;
      }
      // 401 / 403 / 404：这个 token 对仓库没有权限（或仓库不存在）
      return VERDICT_NOT_OWNER;
    }

    const data = await response.json().catch(() => null);
    if (!data || typeof data !== "object") return VERDICT_UNAVAILABLE;

    const permissions = data.permissions;
    if (permissions && typeof permissions === "object" && permissions.push === true) {
      return VERDICT_OWNER;
    }
    return VERDICT_NOT_OWNER;
  } catch (error) {
    // 超时 / 断网 / DNS 失败：一律当作「校验不可用」，绝不放行为站长
    console.error("站长身份校验失败：", error && error.message ? error.message : error);
    return VERDICT_UNAVAILABLE;
  } finally {
    clearTimeout(timer);
  }
}

/* ============================ KV 读写 ============================ */

const statsKey = (path) => `stats:${path}`;
const likersKey = (path) => `likers:${path}`;
const commentsKey = (path) => `comments:${path}`;

/**
 * 读 KV 并解析 JSON。
 *
 * 需要区分两种情况：
 * - **脏数据**（KV 里的值不是合法 JSON / 结构不对）：退回默认值，绝不能让 Worker 抛 500；
 * - **KV 真的坏了**（绑定缺失、网络故障）：向上抛，由入口收敛成 500。
 *   这类错误绝不能悄悄当成「读到了 0」，否则 /hit 会把已有浏览量覆盖成 1。
 *
 * 做法：先用 `get(key, "json")`；抛错时再按文本读一次来判断到底是哪种情况 ——
 * 文本能读到说明只是 JSON 脏，自己 parse 失败就返回 null；文本也读不到说明 KV 故障。
 */
async function readJson(env, key) {
  if (!env || !env.BLOG_KV) {
    throw new Error("缺少 BLOG_KV 绑定，请检查 wrangler.toml");
  }
  try {
    return await env.BLOG_KV.get(key, "json");
  } catch (error) {
    console.error(`读取 KV 失败（${key}）：`, error && error.message ? error.message : error);
    const text = await env.BLOG_KV.get(key, "text"); // KV 真故障时这里会再抛一次
    if (text === null || text === undefined || text === "") return null;
    try {
      return JSON.parse(text);
    } catch {
      return null; // 脏数据：退回默认值
    }
  }
}

/** 写 KV。失败时向上抛，由入口收敛成 500「服务端异常」 */
async function writeJson(env, key, value) {
  if (!env || !env.BLOG_KV) {
    throw new Error("缺少 BLOG_KV 绑定，请检查 wrangler.toml");
  }
  await env.BLOG_KV.put(key, JSON.stringify(value));
}

/** 读计数，脏数据（负数、NaN、字符串、对象…）一律退回 0 */
async function readStats(env, path) {
  const raw = await readJson(env, statsKey(path));
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return { views: toCount(source.views), likes: toCount(source.likes) };
}

async function readLikers(env, path) {
  const raw = await readJson(env, likersKey(path));
  if (!Array.isArray(raw)) return [];
  const list = [];
  for (const item of raw) {
    if (typeof item === "string" && item) list.push(truncate(item, MAX_VISITOR_LENGTH));
  }
  return list.length > MAX_LIKERS ? list.slice(-MAX_LIKERS) : list;
}

/** 读评论列表，逐条洗一遍；任何非法结构都被丢掉而不是抛异常 */
async function readComments(env, path) {
  const raw = await readJson(env, commentsKey(path));
  if (!Array.isArray(raw)) return [];
  const list = [];
  for (const item of raw) {
    const comment = sanitizeComment(item);
    if (comment) list.push(comment);
  }
  return list;
}

/** 把 KV 里的一条数据洗成合法的 Comment；无法修复（没有合法 id）时返回 null */
function sanitizeComment(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  if (typeof raw.id !== "string" || !ID_PATTERN.test(raw.id)) return null;

  const author =
    typeof raw.author === "string" && raw.author.trim()
      ? truncate(raw.author.trim(), MAX_AUTHOR_LENGTH)
      : DEFAULT_AUTHOR;

  const comment = {
    id: raw.id,
    author,
    content: typeof raw.content === "string" ? truncate(raw.content, MAX_CONTENT_LENGTH) : "",
    createdAt:
      typeof raw.createdAt === "string" && raw.createdAt.trim()
        ? raw.createdAt
        : new Date(0).toISOString(),
    likes: toCount(raw.likes),
  };

  if (raw.owner === true) comment.owner = true;
  if (typeof raw.reply === "string" && raw.reply.trim()) {
    comment.reply = truncate(raw.reply, MAX_REPLY_LENGTH);
    comment.replyAt =
      typeof raw.replyAt === "string" && raw.replyAt.trim() ? raw.replyAt : comment.createdAt;
  }
  return comment;
}

/* ============================== 工具 ============================== */

/** 校验并归一化 path；不合法返回 null */
function normalizePath(raw) {
  if (typeof raw !== "string") return null;
  const path = raw.trim();
  if (!path || path.length > MAX_PATH_LENGTH) return null;
  if (!PATH_PATTERN.test(path)) return null;
  return path;
}

function toCount(value) {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.floor(num);
}

/**
 * 按「码点」数长度：中文、emoji 都算 1 个字符，
 * 避免把 surrogate pair 从中间截断成乱码。
 */
function countChars(value) {
  return Array.from(value).length;
}

function truncate(value, max) {
  const chars = Array.from(value);
  return chars.length > max ? chars.slice(0, max).join("") : value;
}

/** 读请求体并解析 JSON：非合法 JSON / 超过 32KB / 不是对象 → 返回中文错误 */
async function readJsonBody(request) {
  // 先看 Content-Length，超限就不必读了
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return { error: "请求体过大（上限 32KB）" };
  }

  let buffer;
  try {
    buffer = await request.arrayBuffer();
  } catch (error) {
    console.error("读取请求体失败：", error && error.message ? error.message : error);
    return { error: "请求体读取失败" };
  }
  if (buffer.byteLength > MAX_BODY_BYTES) return { error: "请求体过大（上限 32KB）" };

  let text = "";
  try {
    text = new TextDecoder("utf-8").decode(buffer);
  } catch {
    return { error: "请求体不是合法的 JSON" };
  }
  if (!text.trim()) return { error: "请求体不是合法的 JSON" };

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: "请求体不是合法的 JSON" };
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { error: "请求体必须是 JSON 对象" };
  }
  return { data };
}

/* ============================ 响应封装 ============================ */

/** 预检 / 正常响应共用的 CORS 头 */
function corsHeaders(env) {
  const configured =
    env && typeof env.ALLOWED_ORIGIN === "string" && env.ALLOWED_ORIGIN.trim()
      ? env.ALLOWED_ORIGIN.trim()
      : "*";
  return {
    "Access-Control-Allow-Origin": configured,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function jsonResponse(payload, status, env) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders(env),
      "Content-Type": "application/json; charset=utf-8",
      // 互动数据不该被任何中间层缓存
      "Cache-Control": "no-store",
    },
  });
}

function invalidPathResponse(env) {
  return jsonResponse(
    {
      error: `path 参数不合法（只允许字母、数字、点、下划线、连字符，且不超过 ${MAX_PATH_LENGTH} 个字符）`,
    },
    400,
    env,
  );
}

function methodNotAllowed(allow, env) {
  return new Response(JSON.stringify({ error: "请求方法不被支持" }), {
    status: 405,
    headers: {
      ...corsHeaders(env),
      "Content-Type": "application/json; charset=utf-8",
      Allow: allow,
    },
  });
}
