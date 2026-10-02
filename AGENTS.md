<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# 先读 `AI_CONTEXT.md`

接手这个项目之前，**请先完整读一遍 [AI_CONTEXT.md](AI_CONTEXT.md)**。

那份文档是专门为「AI / 新对话快速接手」写的，包含：

- 30 秒项目速览与起手命令
- **9 条硬约束**（违反会「构建成功但线上坏掉」或让 dev 500）
- 构建期 / 运行期的数据流
- 「我要改 X，该动哪个文件」的对照表
- 已经踩过的坑（不要重犯）
- 验证清单与当前状态边界

三份文档的分工：

| 文档 | 回答的问题 |
| --- | --- |
| **[AI_CONTEXT.md](AI_CONTEXT.md)** | 怎么快速上手且不踩坑 ← **先看这份** |
| [README.md](README.md) | 怎么用、怎么写文章、怎么部署 |
| [design.md](design.md) | 为什么这样设计、哪些方案被否决过 |

## 改完必须验证

```bash
npx tsc --noEmit && npx eslint . && npx next build
```

三项全绿、且构建 **0 warning** 才算改完。

## 语言约定

代码注释、文档、UI 文案、commit message **全部使用中文**。
