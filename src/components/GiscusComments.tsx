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
}

const GISCUS_SCRIPT = "https://giscus.app/client.js";
const ORIGIN = "https://giscus.app";

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
 * 配置写在 `content/site-settings.json` 的 `giscus` 字段里，
 * 没有配置就不渲染 —— 此时右侧留言板是本机留言，两者可以并存。
 */
export function GiscusComments({
  config,
  isDark,
  embedded = false,
  heading = "评论",
  hint = "评论由 GitHub Discussions 提供，需要登录 GitHub 账号；数据保存在仓库的 Discussions 里，可以随时导出。",
}: GiscusCommentsProps) {
  const containerRef = useRef<HTMLDivElement>(null);

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
    script.setAttribute("data-mapping", config.mapping ?? "pathname");
    script.setAttribute("data-strict", "1");
    script.setAttribute("data-reactions-enabled", config.reactionsEnabled === false ? "0" : "1");
    script.setAttribute("data-emit-metadata", "0");
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
  }, [config]);

  // 主题切换时通过 postMessage 通知 iframe，避免整块重新加载
  useEffect(() => {
    if (!config) return;
    const frame = containerRef.current?.querySelector("iframe");
    frame?.contentWindow?.postMessage(
      { giscus: { setConfig: { theme: isDark ? "dark_dimmed" : "light" } } },
      ORIGIN,
    );
  }, [config, isDark]);

  if (!config) return null;

  return (
    <section
      className={
        embedded ? "" : "mt-12 border-t border-stone-200 pt-8 dark:border-stone-800"
      }
    >
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold tracking-wide text-stone-500 uppercase dark:text-stone-400">
        <MessageSquare className="h-4 w-4 text-brand-500" />
        {heading}
      </h2>
      <div ref={containerRef} className="min-h-[120px]" />
      <p className="mt-3 text-[11px] leading-relaxed text-stone-400">{hint}</p>
    </section>
  );
}

export default GiscusComments;
