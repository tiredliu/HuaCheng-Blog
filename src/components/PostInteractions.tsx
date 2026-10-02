"use client";

import { useCallback } from "react";
import { MessageSquare } from "lucide-react";
import { CommentThreadView } from "@/components/CommentThreadView";
import { GiscusComments } from "@/components/GiscusComments";
import { useThemeState } from "@/components/ThemeContext";
import { useCommentThread } from "@/hooks/useCommentThread";
import { isString, usePersistentState } from "@/hooks/usePersistentState";
import {
  POST_COMMENTS_KEY,
  isCommentMap,
  toPathKey,
  type CommentItem,
  type InteractionSettings,
} from "@/lib/interactions";
import type { GiscusConfig } from "@/lib/site-settings";

export interface PostInteractionsProps {
  slug: string;
  /** 构建期从 `content/comments.json` 读到的公开评论（含站长回复） */
  repoComments: CommentItem[];
  /** 站点设置里的互动后端配置 */
  settings: InteractionSettings;
  /** 配置了 Giscus 才有：作为「用 GitHub 账号公开评论」的额外通道 */
  giscus: GiscusConfig | null;
}

/**
 * 文章底部的评论区。
 *
 * 三种评论通道并存，各自解决不同的问题：
 *
 * | 通道 | 需要什么 | 谁看得见 | 站长怎么回复 |
 * | --- | --- | --- | --- |
 * | 本机评论 | 什么都不用 | 只有自己 | 看不到，也就回不了（这是纯静态站的硬边界） |
 * | 互动服务（Cloudflare Worker） | 部署一次 Worker | 所有人 | 页面上直接回复，服务端校验站长身份 |
 * | Giscus（GitHub Discussions） | 配置 giscus 字段 | 所有人 | 直接在 GitHub Discussions 里回复 |
 *
 * 「回复只有站长能做」在三条通道上都是强制的，而不是靠隐藏按钮。
 */
export function PostInteractions({ slug, repoComments, settings, giscus }: PostInteractionsProps) {
  const { isDark } = useThemeState();
  const pathKey = toPathKey(slug);

  const [name, setName] = usePersistentState<string>("hc-blog:visitor-name", "", isString);
  const [commentMap, setCommentMap] = usePersistentState<Record<string, CommentItem[]>>(
    POST_COMMENTS_KEY,
    {},
    isCommentMap,
  );

  const localComments = commentMap[slug] ?? [];

  // useCommentThread 想要「这一个 slug 的列表 + 一个 setter」，这里把 map 收窄成它要的形状
  const setLocalComments = useCallback(
    (updater: (prev: CommentItem[]) => CommentItem[]) => {
      setCommentMap((prev) => ({ ...prev, [slug]: updater(prev[slug] ?? []) }));
    },
    [setCommentMap, slug],
  );

  const thread = useCommentThread({
    target: slug,
    pathKey,
    repoComments,
    settings,
    localComments,
    setLocalComments,
  });

  return (
    <section className="mt-12 border-t border-stone-200 pt-8 dark:border-stone-800">
      <h2 className="mb-4 flex flex-wrap items-center gap-2 text-sm font-semibold tracking-wide text-stone-500 uppercase dark:text-stone-400">
        <MessageSquare className="h-4 w-4 text-brand-500" />
        评论
        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-normal normal-case text-stone-500 dark:bg-stone-800 dark:text-stone-400">
          {thread.comments.length}
        </span>
      </h2>

      <CommentThreadView
        thread={thread}
        name={name}
        onNameChange={setName}
        placeholder="写评论…（Ctrl / ⌘ + Enter 发送；回复只有站长能做）"
        emptyHint="还没有评论，来写第一条吧。"
      />

      {/* Giscus 是可选的第二条通道：走 GitHub 账号，站长在 Discussions 里回复 */}
      {giscus && (
        <div className="mt-8">
          <GiscusComments
            config={giscus}
            isDark={isDark}
            embedded
            heading="用 GitHub 账号公开评论"
            hint="这条通道由 GitHub Discussions 提供，需要登录 GitHub 账号；站长在仓库的 Discussions 里直接回复。"
          />
        </div>
      )}

      {!giscus && !thread.remoteReady && (
        <p className="mt-4 rounded-xl border border-dashed border-stone-300 px-3 py-2.5 text-[11px] leading-relaxed text-stone-400 dark:border-stone-700">
          想要「所有访客都看得见、站长能回复」的评论区，两条路选一条：部署仓库里自带的互动服务
          （<code>workers/blog-api</code>，见 README），或者配置 Giscus。
          现在既没配也没部署，所以上面的评论只存在各自的浏览器里。
        </p>
      )}
    </section>
  );
}

export default PostInteractions;
