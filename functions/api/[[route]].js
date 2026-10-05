/**
 * 浏览量 API —— Cloudflare Pages Function + **D1**（SQLite）。
 *
 * 为什么不用仓库里那个 Worker + KV：
 * - KV 免费版每天只有 **1000 次写**，页面一多、访问一上来，`/hit` 就会开始报错；
 * - KV 也没有事务，「读出来 → 改 → 写回去」在并发下会丢计数。
 * D1 支持 `count = count + 1` 这样的**原子自增**，免费额度是 10 万行写 / 天，量级完全不同。
 *
 * 为什么挂在 Pages 上而不是单独发一个 Worker：
 * 本站本来就部署在 Cloudflare Pages —— 把函数放进仓库根的 `functions/` 目录，
 * Pages 会**跟着站点一起部署**，不用维护第二个项目；而且接口与页面**同源**，
 * 既不需要 CORS，也不受第三方域名在国内的连通性影响。
 *
 * 路由（与 `src/lib/interactions.ts` 里的约定一致）：
 *   GET  /api/stats?path=<path>   → { views }
 *   POST /api/hit   { path }      → { views }
 *
 * 绑定：在 Pages 项目的 Settings → Functions → D1 database bindings 里，
 * 把变量名设为 **BLOG_DB**，指向你创建的 D1 库（步骤见 functions/README.md）。
 * 没有绑定 / 没建库时，这个接口返回 503，前端会自动退回「本机计数」，页面不会坏。
 */

const TABLE = "views";

/** 和 Worker 版同一套 path 规则：只允许 `[A-Za-z0-9._-]`，长度 ≤ 160 */
const PATH_RE = /^[A-Za-z0-9._-]{1,160}$/;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function normalizePath(value) {
  if (typeof value !== "string") return null;
  const path = value.trim();
  return PATH_RE.test(path) ? path : null;
}

/**
 * 建表（幂等）。每个 isolate 只跑一次，失败则清掉缓存以便下次重试 ——
 * 这样部署时**不需要**再手动执行迁移命令，第一次请求会自己把表建好。
 */
let tableReady = null;
function ensureTable(db) {
  if (!tableReady) {
    tableReady = db
      .prepare(
        `CREATE TABLE IF NOT EXISTS ${TABLE} (
           path  TEXT PRIMARY KEY,
           count INTEGER NOT NULL DEFAULT 0
         )`,
      )
      .run()
      .catch((error) => {
        tableReady = null;
        throw error;
      });
  }
  return tableReady;
}

async function readViews(db, path) {
  const row = await db.prepare(`SELECT count FROM ${TABLE} WHERE path = ?`).bind(path).first();
  return typeof row?.count === "number" ? row.count : 0;
}

export async function onRequest({ request, env }) {
  const db = env?.BLOG_DB;
  if (!db) {
    return json({ error: "缺少 BLOG_DB 绑定，请在 Pages 的 D1 绑定里配置" }, 503);
  }

  const url = new URL(request.url);
  // "/api/stats/" → "stats"
  const route = url.pathname.replace(/^\/api\/?/, "").replace(/\/+$/, "");

  try {
    if (route === "stats" && request.method === "GET") {
      const path = normalizePath(url.searchParams.get("path"));
      if (!path) return json({ error: "path 不合法" }, 400);
      await ensureTable(db);
      return json({ views: await readViews(db, path) });
    }

    if (route === "hit" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "请求体不是合法 JSON" }, 400);
      }

      const path = normalizePath(body?.path);
      if (!path) return json({ error: "path 不合法" }, 400);

      await ensureTable(db);
      // 原子自增：并发下也不会互相覆盖（这正是 KV 做不到的）
      await db
        .prepare(
          `INSERT INTO ${TABLE} (path, count) VALUES (?, 1)
           ON CONFLICT(path) DO UPDATE SET count = count + 1`,
        )
        .bind(path)
        .run();

      return json({ views: await readViews(db, path) });
    }

    return json({ error: "未知接口" }, 404);
  } catch (error) {
    // 只在日志里留一条，别把堆栈返回给浏览器
    console.error("[views-api]", error);
    return json({ error: "服务端异常" }, 500);
  }
}
