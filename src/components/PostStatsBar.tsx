"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, Heart, LoaderCircle } from "lucide-react";
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
}

/**
 * 文章头部的「浏览次数 + 点赞」。
 *
 * 单独做成客户端组件，是因为这两个数字只有浏览器才知道：
 * 本机模式读 localStorage，远程模式要等互动服务返回。
 * 服务端渲染时先给一个占位，hydration 之后填上真实数字。
 *
 * 数字来源会如实标注：`remote` 是全局计数，`local` 只是这台浏览器自己的记录。
 */
export function PostStatsBar({ slug, settings }: PostStatsBarProps) {
  const [counters, setCounters] = useState<InteractionCounters | null>(null);
  const [busy, setBusy] = useState(false);

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
        title={counters.source === "remote" ? "全站计数" : "只统计本机浏览器"}
      >
        <Eye className="h-3.5 w-3.5" />
        {formatCount(counters.views)} 次浏览
        {counters.source === "local" && <span className="text-stone-300 dark:text-stone-600">（本机）</span>}
      </span>

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
    </>
  );
}

export default PostStatsBar;
