"use client";

import { useEffect, useRef } from "react";
import { MessageSquare } from "lucide-react";
import type { GiscusConfig } from "@/lib/site-settings";

export interface GiscusCommentsProps {
  config: GiscusConfig | null;
  /** 当前实际生效的主题，用来同步 iframe 的配色 */
  isDark: boolean;
  /** 嵌在文章评论区里时不要再套一层分隔线与上边距 */
  embedded?: boolean;
  heading?: string;
  hint?: string;
  /** 是否渲染自带的小标题。留言板面板头部已有标题，可关掉避免重复 */
  showHeading?: boolean;
  /** 覆盖 config.mapping —— 留言板用 "specific" 绑定到一个固定讨论 */
  mapping?: GiscusConfig["mapping"];
  /** mapping="specific" 时对应的讨论标题（giscus 会按它查找 / 创建 discussion） */
  term?: string;
}

const GISCUS_SCRIPT = "https://giscus.app/client.js";
const ORIGIN = "https://giscus.app";

/**
 * giscus 会把讨论元数据 postMessage 过来（需要脚本上带 `data-emit-metadata="1"`）。
 * 我们把它转成一个 window 事件广播出去 —— 文章头部的「点赞」就用讨论里的
 * **GitHub 反应数**：真实、全站共享，而且计数保存在 GitHub 侧，不怕突发流量。
 */
export const GISCUS_METADATA_EVENT = "hc-blog:giscus-metadata";

export interface GiscusMetadata {
  /** 讨论上的反应总数（👍 等） */
  reactionCount: number;
  totalCommentCount: number;
}

/**
 * Giscus 评论（基于 GitHub Discussions）。
 *
 * 为什么选它：
 * - **真正免费且不会过期** —— 它只是 GitHub Discussions 的一个前端，没有自己的服务器要养
 * - 数据在你自己的仓库里（Discussions），导出、迁移、备份都不求人
 * - 没有广告、没有追踪、没有数据库要维护
 *
 * 代价：评论者需要有 GitHub 账号。
 *
 * 配置写在 `content/site-settings.json` 的 `giscus` 字段里：
 * 文章底部与右侧留言板都用它渲染（留言板传 `mapping="specific"` + `term`
 * 绑定到一条固定的 GitHub Discussion），没有配置就不渲染 —— 那时文章底部退回本机评论。
 */
export function GiscusComments({
  config,
  isDark,
  embedded = false,
  heading = "评论",
  hint = "评论由 GitHub Discussions 提供，需要登录 GitHub 账号；数据保存在仓库的 Discussions 里，可以随时导出。",
  showHeading = true,
  mapping,
  term,
}: GiscusCommentsProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // 留言板会传 mapping="specific" 覆盖文章用的 pathname 映射
  const effectiveMapping = mapping ?? config?.mapping ?? "pathname";

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !config) return;

    // 换文章（客户端导航）时要先清空，否则会残留上一篇的评论区
    container.innerHTML = "";

    const script = document.createElement("script");
    script.src = GISCUS_SCRIPT;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.setAttribute("data-repo", config.repo);
    script.setAttribute("data-repo-id", config.repoId);
    script.setAttribute("data-category", config.category);
    script.setAttribute("data-category-id", config.categoryId);
    script.setAttribute("data-mapping", effectiveMapping);
    if (effectiveMapping === "specific" && term) {
      script.setAttribute("data-term", term);
    }
    script.setAttribute("data-strict", "1");
    script.setAttribute("data-reactions-enabled", config.reactionsEnabled === false ? "0" : "1");
    script.setAttribute("data-emit-metadata", "1");
    script.setAttribute("data-input-position", config.inputPosition ?? "bottom");
    script.setAttribute("data-theme", isDark ? "dark_dimmed" : "light");
    script.setAttribute("data-lang", config.lang ?? "zh-CN");
    script.setAttribute("data-loading", "lazy");

    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
    // 主题变化不应该重建 iframe，交给下面那个 effect 用 postMessage 同步
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, effectiveMapping, term]);

  /**
   * 主题同步：用 postMessage 通知 iframe，而不是重建（重建会闪一下、还会丢草稿）。
   *
   * ⚠️ 要处理两个时序问题，否则会出现「页面深色、评论框却是浅色」：
   * 1. giscus 的 iframe 是**异步**插入的，同步那一刻 `querySelector` 往往还取不到；
   * 2. 首屏 hydration 时「跟随系统」还没解析出真实值（`useMediaQuery` 的服务端快照是
   *    `false`），脚本可能先以浅色创建。
   * 所以除了「主题变化时发一次」，还要在 **iframe 插入 / 加载完成**后补发一次。
   */
  useEffect(() => {
    if (!config) return;
    const container = containerRef.current;
    if (!container) return;

    const theme = isDark ? "dark_dimmed" : "light";
    const post = () => {
      container
        .querySelector("iframe")
        ?.contentWindow?.postMessage({ giscus: { setConfig: { theme } } }, ORIGIN);
    };

    post(); // iframe 已经在了（主题切换的场景）就立即同步

    const attach = () => container.querySelector("iframe")?.addEventListener("load", post);
    attach(); // 可能已经插入

    // iframe 是异步加进来的：一插入就挂上 load，加载完成后再补发一次主题
    const observer = new MutationObserver(() => {
      attach();
      post();
    });
    observer.observe(container, { childList: true });

    return () => observer.disconnect();
  }, [config, isDark]);

  // giscus → 父页面：把讨论元数据（反应数、评论数）广播成 window 事件
  useEffect(() => {
    if (!config) return;

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== ORIGIN) return;
      const giscus = (event.data as { giscus?: { discussion?: unknown } } | null)?.giscus;
      const discussion = giscus?.discussion as
        | { reactionCount?: unknown; totalCommentCount?: unknown }
        | undefined;
      if (!discussion) return;

      const detail: GiscusMetadata = {
        reactionCount: typeof discussion.reactionCount === "number" ? discussion.reactionCount : 0,
        totalCommentCount:
          typeof discussion.totalCommentCount === "number" ? discussion.totalCommentCount : 0,
      };
      window.dispatchEvent(new CustomEvent<GiscusMetadata>(GISCUS_METADATA_EVENT, { detail }));
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [config]);

  if (!config) return null;

  return (
    <section
      className={
        embedded ? "" : "mt-12 border-t border-stone-200 pt-8 dark:border-stone-800"
      }
    >
      {showHeading && (
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold tracking-wide text-stone-500 uppercase dark:text-stone-400">
          <MessageSquare className="h-4 w-4 text-brand-500" />
          {heading}
        </h2>
      )}
      <div ref={containerRef} className="min-h-[120px]" />
      <p className="mt-3 text-[11px] leading-relaxed text-stone-400">{hint}</p>
    </section>
  );
}

export default GiscusComments;
