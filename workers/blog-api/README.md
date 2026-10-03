# 博客互动 API（Cloudflare Worker）

给这个**纯静态**博客补上「浏览量 / 点赞 / 评论（含站长回复）」的独立后端。

- 纯 JavaScript（ESM），**零 npm 依赖**，只用 Web 标准 API + Workers 的 KV。
- 独立部署，和博客本身完全解耦：博客还是静态站点，不需要服务器、不需要数据库。
- 所有响应都带 CORS 头，浏览器可以直接跨域调用。

---

## 1. 什么时候需要它？

**不需要也能用。** 前端默认把浏览量、点赞、评论存在**访客自己的浏览器 localStorage** 里，
换设备 / 换浏览器就看不到，别人也看不到你的评论。

部署这个 Worker 之后：

| | 默认（localStorage） | 部署本 Worker 后 |
| --- | --- | --- |
| 数据存在哪 | 访客浏览器里 | Cloudflare KV（全站共享） |
| 换设备还能看到吗 | ❌ | ✅ |
| 别人能看到我的评论吗 | ❌ | ✅ |
| 站长能回复 / 删除吗 | ❌ | ✅ |
| 需要花钱吗 | — | 免费额度内免费 |

也就是说：**这是可选项**，只有你部署了它、并把地址填进 `content/site-settings.json`，
前端才会去调它（详见第 3 步）。

---

## 2. 一键部署步骤

需要 Node.js 环境（本仓库本来就要用 Node 构建）。命令可以直接复制粘贴。

```bash
# ① 安装 wrangler（Cloudflare 官方 CLI），只需一次
npm i -g wrangler

# ② 登录 Cloudflare 账号（会打开浏览器授权），只需一次
wrangler login

# ③ 创建 KV namespace —— 只需一次
wrangler kv namespace create BLOG_KV
```

第 ③ 步会打印出这样一段（`id` 每次生成都不一样，下面只是示例）：

```toml
[[kv_namespaces]]
binding = "BLOG_KV"
id = "0123456789abcdef0123456789abcdef"
```

```bash
# ④ 进到 Worker 目录
cd workers/blog-api

# ⑤ 编辑 wrangler.toml：把上面输出的真实 id 填进文件末尾那段
#    「[[kv_namespaces]]」注释模板里，然后取消这三行的注释。
#    ⚠️ 不填 id 直接 deploy 会失败，这是故意的：假的 id 没有意义。

# ⑥ 部署
wrangler deploy
```

部署成功后 wrangler 会打印访问地址：

```
https://hc-blog-api.<你的子域>.workers.dev
```

想先在本机试跑（会用本地模拟的 KV，不碰线上数据）：

```bash
cd workers/blog-api
wrangler dev
# 默认监听 http://localhost:8787
```

之后每次改了 `src/index.js`，重新 `wrangler deploy` 即可。

> 说明：`wrangler kv namespace create` 也可以写成 `npx wrangler ...`，
> 不用全局安装。上面用全局安装只是为了后面命令更短。

---

## 3. 把地址填进博客配置

部署完拿到 `https://hc-blog-api.<你的子域>.workers.dev` 之后，
编辑仓库根目录的 `content/site-settings.json`，加上（或修改）`interactions` 这一段：

```json
{
  "interactions": {
    "provider": "remote",
    "apiBase": "https://hc-blog-api.你的子域.workers.dev"
  }
}
```

- `apiBase` 填 Worker 的地址，**结尾不要带 `/`**。
- `provider` 必须是 `"remote"`；保持默认（或删掉这一段）时前端继续走 localStorage。
- 改完记得重新构建 / 重新部署博客（`npm run build`），静态导出才会带上新配置。

> 注意：`content/site-settings.json` 是**站点默认值**，会进入构建产物。
> 访客自己浏览器里的偏好（localStorage）优先级更高，可能覆盖这里的默认值 ——
> 如果访客之前用过旧配置，让他清一下浏览器本地存储，或者换一个无痕窗口验证。

---

## 4. 站长怎么「证明自己是站长」

站长身份 = **平时那个 GitHub fine-grained PAT**，无需额外配置。

要求：

- 类型：**Fine-grained personal access token**（细粒度 token）。
- 授权范围：**只勾这一个仓库**（`tiredliu/HuaCheng-Blog`）。
- 权限：**Contents → Read and write**（只给这一个就够）。

校验流程（Worker 内部实现）：

1. 从请求头 `Authorization: Bearer <token>` 或 body 的 `githubToken` 字段取 token。
2. 请求 `GET https://api.github.com/repos/tiredliu/HuaCheng-Blog`（带 `Accept: application/vnd.github+json`、
   `X-GitHub-Api-Version: 2022-11-28`）。
3. 要求 HTTP 200，且返回 JSON 里 `permissions.push === true`。
4. 任何异常、超时、报错 → **一律判定为「不是站长」**，绝不因为 GitHub 抽风就放行。

> ⚠️ **为什么不去调 `GET /user`？**
> 因为只授权了 Contents 权限的 fine-grained token 调 `/user` 会返回 **403**
> （细粒度 token 没有 user 级别的权限），用它判断会把真正的站长也挡在门外。
> 所以这里改成读仓库详情、看 `permissions.push`。

**安全提醒**：token 只在前端「站长模式」下由你自己输入、只发给这个 Worker，
Worker 不会存储它，也不会写进日志。请不要把 token 提交进仓库。

---

## 5. 免费额度（2026 年已核实）

数值以 Cloudflare 官方文档为准，下面是写这份文档时实际查到的结果：

| 项目 | 免费版额度 | 说明 |
| --- | --- | --- |
| Workers 请求 | **100,000 次 / 天** | 超出后当天返回 Cloudflare 1027 错误 |
| Workers CPU 时间 | 10 ms / 请求 | 这个 Worker 只做 KV 读写，远低于上限 |
| KV 读取 | **100,000 次 / 天** | 看一次评论 ≈ 1 次读 |
| KV 写入 | **1,000 次 / 天** | ⚠️ 这是最容易先撞到的上限 |
| KV 删除 | 1,000 次 / 天 | 本 Worker 不用 delete |
| KV 列表 | 1,000 次 / 天 | 本 Worker 不用 list |
| KV 存储 | 1 GB | 500 条评论 × 1KB ≈ 0.5 MB，够用很久 |

来源：

- [Cloudflare Workers 限制（Workers Free = 100,000 请求/天）](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare Workers KV 定价（Free = 100,000 读/天、1,000 写/天）](https://developers.cloudflare.com/kv/platform/pricing/)

> 上面几个数字是写这份文档时（2026 年）照着官方文档核实的，不是凭记忆写的：
> Workers 免费版每天 10 万请求、KV 免费版每天 10 万次读 + 1 千次写。
> Cloudflare 偶尔会调整额度，部署前可以点上面两个链接再确认一眼。
> 所有额度按天重置，重置时间是 UTC 00:00。

**写入额度怎么省着花**（已经实现的优化）：

- `GET /stats`、`GET /comments` 只读不写。
- `POST /hit`：1 次写。
- `POST /like`：真正发生变化才写（重复点同一个赞、在没点过赞时取消赞 → 0 次写）。
- `POST /comments`：1 次写（回复和删除也是 1 次）。

按 1,000 写/天算：每天大约够 **1,000 次浏览**，或者 **500 次点赞**，或者 **1,000 条评论/回复/删除**。
个人博客日常完全够用；如果某天真的写爆了，KV 写操作会开始报错，表现为接口 500，
第二天 UTC 0 点自动恢复。升级到 Workers Paid 后额度是每月 100 万次写。

---

## 6. 安全边界

| 操作 | 需要凭据吗 | 说明 |
| --- | --- | --- |
| 看浏览量 / 点赞数 / 评论 | 不需要 | 纯公开读接口 |
| 浏览量 +1 | 不需要 | 无鉴权（本来也无法防刷，别当真） |
| 点赞 / 取消点赞 | 不需要 | 用匿名 visitor id 去重，仅防误触，不防恶意 |
| **发表评论** | 不需要 | 访客唯一的写权限 |
| **回复评论 / 发站长评论 / 删除评论** | **必须带站长 PAT** | Worker 向 GitHub 校验 `permissions.push` |

具体规则：

- 访客提交的评论里如果带了 `owner` / `reply` / `replyAt` / `likes`，
  服务端**强制剥离**：`likes` 一律从 0 开始，`createdAt` 一律用服务器时间。
- 访客只要碰了 `replyTo` / `deleteId` / `owner` 中的任意一个，
  直接返回 `403 { "error": "只有站长可以回复或删除评论" }`，**并且不写入任何数据**。
- 校验 GitHub 失败 / 超时 / 限流 → `503 { "error": "站长身份校验暂时不可用" }`（不会退化成放行）。
- 前端拿到 token 后只应存在浏览器里你自己那台设备上，不要写进仓库。

其他防护：

- `path` 只允许 `[A-Za-z0-9._-]`，长度 ≤ 160，否则 `400`；全站留言板固定用 `guestbook`。
  （前端会先把文章 slug 归一化：纯 ASCII 的原样用，带中文的转成 `x-<utf8 十六进制>`，
  所以正常情况下前端传过来的 path 一定合法。）
- `author` ≤ 24 字符，`content` ≤ 1000 字符，`reply` ≤ 1000 字符（按码点数，emoji 算 1 个）。
- 单个 path 最多 500 条评论，超出返回 `400 { "error": "评论数已达上限" }`
  （这个响应里**同时带上当前完整列表**，前端即使在报错分支里直接读 `data.comments` 也不会拿到 `undefined`）。
- 单个 path 最多记录 2000 个点赞 visitor，超出丢弃最旧的。
- 请求体不是合法 JSON、或大于 32KB → `400`。
- 未捕获异常 → `500 { "error": "服务端异常" }`，不返回堆栈。
- 未知路由 → `404 { "error": "未知接口" }`；路径存在但方法不对 → `405`。
- `id` 由服务端保证唯一：客户端给的 id 合法且没撞车就直接用（这样前端能对上自己那条本地评论、
  不会显示成两条），否则用 `crypto.randomUUID()` 生成。`createdAt` / `replyAt` 一律用服务器时间。

### 常见问题

| 现象 | 原因 / 处理 |
| --- | --- |
| 所有接口都返回 `500 服务端异常` | 多半是 `wrangler.toml` 里的 `[[kv_namespaces]]` 还没取消注释 / id 没填。看 `wrangler tail` 的日志，会打印「缺少 BLOG_KV 绑定，请检查 wrangler.toml」。 |
| 站长回复时返回 `503 站长身份校验暂时不可用` | Worker 访问 GitHub API 失败（超时 / 限流 / GitHub 抖动）。这是**故意**的：校验不了就绝不放行，过一会儿重试即可。 |
| 站长回复时返回 `403 只有站长可以回复或删除评论` | token 不对：确认是 fine-grained PAT、授权了 `tiredliu/HuaCheng-Blog`、权限是 **Contents: Read and write**（校验看的是 `permissions.push`）。 |
| 接口都正常，但前端数字还是本机的 | `content/site-settings.json` 里 `interactions.provider` 要是 `"remote"`、`apiBase` 要填对且结尾不带 `/`，改完要重新构建博客。 |

---

## 7. 已知限制：KV 写入不是原子的

Workers KV 是**最终一致**的键值存储，**没有事务、没有原子自增**。
本 Worker 的写法是「读出来 → 改 → 写回去」，所以在**同一个瞬间**发生多次写时，
后写的那次会覆盖前一次的结果，计数可能少量丢失。例如：

- 一篇文章同一秒被 3 个人点赞，理论上应该 +3，实际可能只 +1 或 +2。
- 一次 `hit` 和一次 `like` 同时发生，`views` 或 `likes` 其中一项可能少 1。

**这是可以接受的**：个人博客远远达不到会造成问题的并发量，
而且浏览量/点赞数本来就是模糊指标，少 1 少 2 无所谓。
README 里如实说明这一点，是为了不让人误以为它精确 —— 它不精确。

如果哪天真需要精确计数，正确做法是换 Durable Objects（每个 path 一个 DO，串行处理）
或 D1（用 SQL 的 `UPDATE ... SET views = views + 1`），那需要改架构，不在这份代码范围内。

其他小限制：

- KV 免费版每天 1000 次写（见第 5 节），并发写多的时候可能先撞到这个上限。
- 评论没有分页、没有审核、没有删除单个评论的软删除记录：删除就是直接从数组里摘掉。
- 没有防刷：任何人可以无限调 `/hit` 刷浏览量。要防就得加 Turnstile 或 IP 限流，本 Worker 没做。
- 点赞去重依赖前端生成的匿名 visitor id（存在 localStorage），清掉浏览器数据就会重新算一个新访客。

---

## 8. 用 curl 手动验证

把下面的 `BASE` 换成你自己的 Worker 地址。

```bash
BASE="https://hc-blog-api.你的子域.workers.dev"
```

### 8.1 读统计 `GET /stats`

```bash
curl -s "$BASE/stats?path=guestbook"
# → {"views":0,"likes":0}（不存在时返回 0）
```

### 8.2 浏览量 +1 `POST /hit`

```bash
curl -s -X POST "$BASE/hit" \
  -H "Content-Type: application/json" \
  -d '{"path":"guestbook"}'
# → {"views":1,"likes":0}
```

### 8.3 点赞 / 取消点赞 `POST /like`

```bash
# 点赞（同一个 visitor 重复调用不会重复加数）
curl -s -X POST "$BASE/like" \
  -H "Content-Type: application/json" \
  -d '{"path":"guestbook","action":"like","visitor":"demo-visitor-1"}'
# → {"views":1,"likes":1}

# 再点一次：likes 仍然是 1（幂等）
curl -s -X POST "$BASE/like" \
  -H "Content-Type: application/json" \
  -d '{"path":"guestbook","action":"like","visitor":"demo-visitor-1"}'

# 取消点赞
curl -s -X POST "$BASE/like" \
  -H "Content-Type: application/json" \
  -d '{"path":"guestbook","action":"unlike","visitor":"demo-visitor-1"}'
# → {"views":1,"likes":0}
```

### 8.4 读评论 `GET /comments`

```bash
curl -s "$BASE/comments?path=guestbook"
# → {"comments":[]}
```

### 8.5 访客发表评论 `POST /comments`

```bash
curl -s -X POST "$BASE/comments" \
  -H "Content-Type: application/json" \
  -d '{"path":"guestbook","comment":{"id":"c-1001","author":"路人甲","content":"写得好","createdAt":"1970-01-01T00:00:00.000Z"}}'
# → {"comments":[{"id":"c-1001","author":"路人甲","content":"写得好","createdAt":"<服务器时间>","likes":0}]}
# 注意：createdAt 被服务器时间覆盖；客户端传的 likes 被忽略
```

访客尝试越权（应当 `403`，且列表不变）：

```bash
curl -s -i -X POST "$BASE/comments" \
  -H "Content-Type: application/json" \
  -d '{"path":"guestbook","replyTo":"c-1001","reply":"我自己回复我自己"}'
# → HTTP/1.1 403 ... {"error":"只有站长可以回复或删除评论"}
```

### 8.6 站长身份准备

```bash
# 把站长 PAT 放进环境变量，避免出现在 shell 历史里
export OWNER_TOKEN="github_pat_xxxxxxxxxxxxxxxx"
```

### 8.7 站长回复已有评论

```bash
curl -s -X POST "$BASE/comments" \
  -H "Content-Type: application/json" \
  -d "{\"path\":\"guestbook\",\"replyTo\":\"c-1001\",\"reply\":\"谢谢！\",\"githubToken\":\"$OWNER_TOKEN\"}"
# → {"comments":[{"id":"c-1001",...,"reply":"谢谢！","replyAt":"<服务器时间>"}]}
```

### 8.8 站长直接发表带 owner 标记的评论

```bash
curl -s -X POST "$BASE/comments" \
  -H "Content-Type: application/json" \
  -d "{\"path\":\"guestbook\",\"comment\":{\"id\":\"c-1002\",\"author\":\"站长\",\"content\":\"欢迎来留言\",\"owner\":true},\"githubToken\":\"$OWNER_TOKEN\"}"
```

### 8.9 站长删除评论

```bash
curl -s -X POST "$BASE/comments" \
  -H "Content-Type: application/json" \
  -d "{\"path\":\"guestbook\",\"deleteId\":\"c-1001\",\"githubToken\":\"$OWNER_TOKEN\"}"
# → {"comments":[...]}（已经不含 c-1001）
```

### 8.10 CORS 预检

```bash
curl -s -i -X OPTIONS "$BASE/comments" \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type"
# → HTTP/1.1 204，且带有：
#   Access-Control-Allow-Origin: *
#   Access-Control-Allow-Methods: GET,POST,OPTIONS
#   Access-Control-Allow-Headers: Content-Type, Authorization
#   Access-Control-Max-Age: 86400
```

### 8.11 校验与错误分支

```bash
# path 非法 → 400
curl -s "$BASE/stats?path=../etc/passwd"
curl -s "$BASE/stats?path=a/b"

# 请求体不是合法 JSON → 400
curl -s -X POST "$BASE/hit" -H "Content-Type: application/json" -d 'not-json'

# 未知路由 → 404
curl -s "$BASE/nope"

# 用错的 token 冒充站长 → 403（GitHub 校验不通过）
curl -s -X POST "$BASE/comments" -H "Content-Type: application/json" \
  -d '{"path":"guestbook","deleteId":"c-1001","githubToken":"github_pat_假的"}'
# → {"error":"只有站长可以回复或删除评论"}
```

---

## 接口速查

所有响应都是 JSON，都带 CORS 头。

| 方法 | 路径 | 请求 | 响应 |
| --- | --- | --- | --- |
| GET | `/stats?path=` | — | `{ views, likes }` |
| POST | `/hit` | `{ path }` | `{ views, likes }` |
| POST | `/like` | `{ path, action: "like"\|"unlike", visitor? }` | `{ views, likes }` |
| GET | `/comments?path=` | — | `{ comments: Comment[] }` |
| POST | `/comments` | 见下 | `{ comments: Comment[] }` |
| OPTIONS | 任意 | — | `204` + CORS 头 |

`POST /comments` 的三种 body：

```jsonc
// ① 访客发表（owner / reply / replyAt / likes 会被服务端剥离）
{ "path": "guestbook", "comment": { "id": "c-1", "author": "路人甲", "content": "…", "createdAt": "…" } }

// ② 站长发表 / 回复（带 token）
{ "path": "guestbook", "comment": { "id": "c-2", "author": "站长", "content": "…", "owner": true, "reply": "…" }, "githubToken": "PAT" }
{ "path": "guestbook", "replyTo": "c-1", "reply": "…", "githubToken": "PAT" }

// ③ 站长删除
{ "path": "guestbook", "deleteId": "c-1", "githubToken": "PAT" }
```

`Comment` 结构：

```ts
{
  id: string; author: string; content: string; createdAt: string; likes: number;
  liked?: boolean; reply?: string; replyAt?: string; owner?: boolean;
}
```

KV 里存的东西：

| key | value |
| --- | --- |
| `stats:<path>` | `{ "views": number, "likes": number }` |
| `likers:<path>` | `string[]`（点赞过的 visitor，最多 2000 个） |
| `comments:<path>` | `Comment[]`（最多 500 条） |
