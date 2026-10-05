"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, Heart, LoaderCircle } from "lucide-react";
import { GISCUS_METADATA_EVENT, type GiscusMetadata } from "@/components/GiscusComments";
import { cn, formatCount } from "@/lib/utils";
import {
  registerView,
  toPathKey,
  toggleLike as togglePostLike,
  type InteractionCounters,
  type InteractionSettings,
} from "@/lib/interactions";

export interface PostStatsBarProps {
  slug: string;
  settings: InteractionSettings;
  /**
   * 配了 Giscus（本站默认）时：点赞数改从**评论区讨论上的 GitHub 反应**读，
   * 不再使用互动服务的点赞；没配 Giscus 时才退回本机 / 互动服务的点赞按钮。
   */
  likesFromGiscus?: boolean;
}

/**
 * 文章头部的「浏览次数 + 点赞」。
 *
 * - **浏览数**：读 `/api/stats`（Pages Function + D1，全站共享的数字）；
 *   后端没部署 / 连不上时自动退回本机计数，并在界面上如实标注「（本机）」。
 * - **点赞**：配了 Giscus 时用讨论上的 **GitHub 反应数** —— 真实、全站共享，
 *   而且计数保存在 GitHub 侧，不受本站流量影响。点赞动作本身在评论区点 👍，
 *   这里只做展示 + 跳转（跨域 iframe 里没法替访客点反应）。
 */
export function PostStatsBar({ slug, settings, likesFromGiscus = false }: PostStatsBarProps) {
  const [counters, setCounters] = useState<InteractionCounters | null>(null);
  const [busy, setBusy] = useState(false);
  const [giscusLikes, setGiscusLikes] = useState<number | null>(null);

  const connection = useMemo(
    () => ({ provider: settings.provider, apiBase: settings.apiBase }),
    [settings.provider, settings.apiBase],
  );
  const pathKey = toPathKey(slug);

  useEffect(() => {
    let cancelled = false;

    void registerView(pathKey, connection).then((next) => {
      if (!cancelled) setCounters(next);
    });

    return () => {
      cancelled = true;
    };
  }, [connection, pathKey]);

  // Giscus 加载完成（且讨论已存在）后会把反应数广播出来
  useEffect(() => {
    if (!likesFromGiscus) return;

    const onMetadata = (event: Event) => {
      const detail = (event as CustomEvent<GiscusMetadata>).detail;
      if (detail && typeof detail.reactionCount === "number") {
        setGiscusLikes(detail.reactionCount);
      }
    };

    window.addEventListener(GISCUS_METADATA_EVENT, onMetadata);
    return () => window.removeEventListener(GISCUS_METADATA_EVENT, onMetadata);
  }, [likesFromGiscus]);

  const like = async () => {
    setBusy(true);
    try {
      setCounters(await togglePostLike(pathKey, connection));
    } finally {
      setBusy(false);
    }
  };

  if (!counters) {
    // 还没读到时不要显示「0 次浏览」—— 那是在说假话
    return (
      <span className="flex items-center gap-1.5 text-stone-400">
        <Eye className="h-3.5 w-3.5" />
        <span aria-hidden>—</span>
        <span className="sr-only">浏览与点赞统计加载中</span>
      </span>
    );
  }

  return (
    <>
      <span
        className="flex items-center gap-1.5"
        title={counters.source === "remote" ? "全站计数" : "只统计本机浏览器（后端未部署）"}
      >
        <Eye className="h-3.5 w-3.5" />
        {formatCount(counters.views)} 次浏览
        {counters.source === "local" && (
          <span className="text-stone-300 dark:text-stone-600">（本机）</span>
        )}
      </span>

      {likesFromGiscus ? (
        <a
          href="#comments"
          title="点赞在评论区里点 👍（数据记在 GitHub Discussions 上）"
          className="flex items-center gap-1.5 rounded-md px-1 py-0.5 text-stone-400 transition-colors hover:text-brand-500"
        >
          <Heart className="h-3.5 w-3.5" />
          {giscusLikes === null ? <span aria-hidden>—</span> : <>{formatCount(giscusLikes)} 个赞</>}
        </a>
      ) : (
        <button
          type="button"
          onClick={() => void like()}
          disabled={busy}
          aria-pressed={counters.liked}
          title={counters.liked ? "取消点赞" : "点赞这篇文章"}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-1 py-0.5 transition-colors disabled:opacity-60",
            counters.liked
              ? "text-brand-600 dark:text-brand-400"
              : "text-stone-400 hover:text-brand-500",
          )}
        >
          {busy ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Heart className={cn("h-3.5 w-3.5", counters.liked && "fill-current")} />
          )}
          {formatCount(counters.likes)} 个赞
        </button>
      )}
    </>
  );
}

export default PostStatsBar;
