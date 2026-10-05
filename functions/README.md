# 浏览量接口（Cloudflare Pages Function + D1）

给纯静态博客补一个**全站共享**的浏览量计数。它跟着 Pages 站点一起部署，不需要单独维护 Worker。

## 为什么是 D1，而不是 Workers KV

| | Workers KV（旧方案） | **D1（本方案）** |
| --- | --- | --- |
| 免费写入额度 | **1,000 次 / 天** —— 访问一上来 `/hit` 就开始 500 | **100,000 行 / 天** |
| 并发自增 | ❌ 无事务，「读→改→写」会丢计数 | ✅ `count = count + 1` 原子自增 |
| 部署形态 | 单独的 Worker 项目 + KV | **跟站点一起部署**（仓库根的 `functions/`） |
| 接口地址 | `https://xxx.workers.dev`（跨域） | `/api/*`（**同源**，无 CORS、无外域连通性问题） |

## 部署步骤（约 3 分钟）

```bash
# ① 创建 D1 数据库（会打印 database_id，先记下来）
npx wrangler d1 create hc-blog-views

# ② 登录（如未登录）
npx wrangler login
```

③ 打开 **Cloudflare Dashboard → Workers & Pages → 你的 Pages 项目 → Settings → Functions → D1 database bindings**，
新增一条绑定：

- **Variable name**：`BLOG_DB`（必须一字不差，代码里写死了）
- **D1 database**：选刚创建的 `hc-blog-views`

④ **重新部署**：往 `main` 推一次（或在该项目的 Deployments 里点 “Retry deployment”）。

> 表结构不用手动建：第一次请求时 `functions/api/[[route]].js` 会
> `CREATE TABLE IF NOT EXISTS views(...)`（幂等，每个 isolate 只跑一次）。

⑤ 让前端开始用它 —— `content/site-settings.json`：

```json
"interactions": {
  "provider": "remote",
  "apiBase": "/api"
}
```

改完重新构建 / 部署。`apiBase` 用**相对路径** `/api` 是有意的：
接口与页面同源，既省掉跨域，也不会因为第三方域名被墙而连不上。

## 验证

```bash
# 读（不存在的 path 返回 0）
curl -s "https://你的域名/api/stats?path=hello-world"
# → {"views":0}

# 计数 +1，再读一次
curl -s -X POST "https://你的域名/api/hit" \
  -H "Content-Type: application/json" -d '{"path":"hello-world"}'
# → {"views":1}
```

本机预览（`npm run dev`）时没有 Pages Function，接口会 404 ——
前端会**自动退回「本机计数」**并在界面上标注「（本机）」，页面不会出错。
想在本机联调可以先让 `npx wrangler pages dev out --d1 BLOG_DB` 起一个带绑定的预览服务。

## 免费额度（D1，写这份文档时查到的官方数值）

| 项目 | 免费版 |
| --- | --- |
| 行读取 | 500 万行 / 天 |
| 行写入 | 10 万行 / 天 |
| 存储 | 5 GB |

按 10 万写/天算，一天能扛 **10 万次浏览**（每次浏览 1 次写），足够个人博客。
数值以 [Cloudflare D1 定价页](https://developers.cloudflare.com/d1/platform/pricing/) 为准。

## 安全与边界

- `path` 只允许 `[A-Za-z0-9._-]`、长度 ≤ 160，否则 `400`（前端已把中文 slug 归一化成 `x-<hex>`）。
- `POST /api/hit` **没有鉴权**，任何人都能刷 —— 浏览量本来就是模糊指标，不承诺精确、也不防刷。
- 接口不存任何个人信息，只有「path → 次数」。
- 未绑定 D1 时返回 `503`，前端退回本机计数（不会白屏、不会报错）。

> 相关：仓库里另外那份 `workers/blog-api`（Worker + KV，带评论/点赞/站长回复）
> 是更早的可选方案。本站的评论已经统一走 Giscus、点赞走 GitHub 反应，
> 所以**只剩浏览量还需要后端**，由本目录这个 Function 承担。
