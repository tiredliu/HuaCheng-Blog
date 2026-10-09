# 浏览量接口（Cloudflare Pages Function + D1）
 
给纯静态博客补一个**全站共享**的浏览量计数。它跟着 Pages 站点一起部署，不需要单独维护 Worker。
 
## 为什么是 D1，而不是 Workers KV
 
|        | Workers KV（旧方案）                         | **D1（本方案）**                      |
| ------ | --------------------------------------- | -------------------------------- |
| 免费写入额度 | **1,000 次 / 天** —— 访问一上来 `/hit` 就开始 500 | **100,000 行 / 天**                |
| 并发自增   | ❌ 无事务，「读→改→写」会丢计数                       | ✅ `count = count + 1` 原子自增       |
| 部署形态   | 单独的 Worker 项目 + KV                      | **跟站点一起部署**（仓库根的 `functions/`）   |
| 接口地址   | `https://xxx.workers.dev`（跨域）           | `/api/*`（**同源**，无 CORS、无外域连通性问题） |
 
## 部署步骤（约 3 分钟，两步：建库 → 绑定）
 
### 方案 A：全在 Dashboard 里点（不用装 wrangler，推荐）
 
① **建库**：Cloudflare Dashboard 侧边栏 → **存储和数据库 → D1 SQL 数据库** → **创建数据库**，
名字填 `hc-blog-views`（随便取也行，绑定时选对即可）。
 
> 控制台改过版，入口位置也挪过，所以对不上别慌：
> 新版是「**存储和数据库 → D1 SQL 数据库**」，部分账号仍显示成「**Workers & Pages → D1**」。
> 两个都找不到时，直接用页面顶部的**搜索框搜 `D1`**，能直达创建页。
 
② **绑定**：打开你的 **Pages 项目 → 设置 → 绑定（Bindings）→ 添加 → D1 数据库**：
 
- **变量名称 / Variable name**：`BLOG_DB`（必须一字不差，代码里写死了这个名字）
- **D1 数据库**：选刚创建的 `hc-blog-views`
 
> 旧版控制台这一步在「Settings → Functions → D1 database bindings」，
> 名字不同但填的东西一样：变量名 `BLOG_DB` + 选库。
 
③ **重新部署**：往 `main` 推一次（或在该项目的 Deployments 里点 “Retry deployment”）。
 
### 方案 B：用 wrangler CLI
 
```
npx wrangler login
npx wrangler d1 create hc-blog-views   # 会打印 database_id
```
 
然后按方案 A 的 ②③ 去绑定并重新部署。
 
> ⚠️ **Windows 上 `npx wrangler` 的常见报错**：
> `Error: The package "@cloudflare/workerd-windows-64" could not be found`。
> 这不是你的配置问题，而是 npx 临时安装时**漏掉了 workerd 的平台二进制包**
> （它在 `optionalDependencies` 里）。别去修 npx 缓存，直接装一份本地的：
>
> ```bash
> ```
> npm i -g wrangler              # 全局装一份最省事
> # 或者不想全局装：npm i wrangler 之后用 node node\_modules/wrangler/bin/wrangler.js ...
> ```
> ```
>
> 装完再跑 `wrangler login` / `wrangler d1 create`。只是建个库的话，**方案 A 完全不需要 CLI**。
 
> 表结构不用手动建：第一次请求时 `functions/api/[[route]].js` 会
> `CREATE TABLE IF NOT EXISTS views(...)`（幂等，每个 isolate 只跑一次）。
 
### 最后：让前端开始用它
 
`content/site-settings.json`：
 
```
"interactions": {
  "provider": "remote",
  "apiBase": "/api"
}
```
 
改完重新构建 / 部署。`apiBase` 用**相对路径** `/api` 是有意的：
接口与页面同源，既省掉跨域，也不会因为第三方域名被墙而连不上。
 
## 验证
 
```
# 读（不存在的 path 返回 0）
curl -s "https://你的域名/api/stats?path=hello-world"
# → {"views":0}
# 计数 +1，再读一次
curl -s -X POST "https://你的域名/api/hit" \
  -H "Content-Type: application/json" -d '{"path":"hello-world"}'
# → {"views":1}
```
 
本机预览（`npm run dev`）时没有 Pages Function，接口会 404 ——
前端会\*\*自动退回「本机计数」\*\*并在界面上标注「（本机）」，页面不会出错。
想在本机联调，先 `npm run build:app` 生成 `out/`，再起一个带绑定的预览服务：
 
```
wrangler pages dev out --d1 BLOG_DB
```
 
（本机联调需要真跑 workerd，所以这条**必须**用装好的 wrangler，不能用 `npx` 那个缺二进制的版本。
只是想确认接口好不好使，也可以直接用方案 A 部署完再 `curl` 线上地址。）
 
## 免费额度（D1，写这份文档时查到的官方数值）
 
| 项目  | 免费版        |
| --- | ---------- |
| 行读取 | 500 万行 / 天 |
| 行写入 | 10 万行 / 天  |
| 存储  | 5 GB       |
 
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
 