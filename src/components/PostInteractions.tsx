"use client";

import { useCallback } from "react";
import { MessageSquare } from "lucide-react";
import { CommentEmojiBar } from "@/components/CommentEmojiBar";
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
  /** 构建期从 `content/comments.json` 读到的公开评论（含站长回复），仅本机评论模式用 */
  repoComments: CommentItem[];
  /** 站点设置里的互动后端配置，仅本机评论模式用 */
  settings: InteractionSettings;
  /** 配置了 Giscus（本站默认已配）时，文章底部只渲染这一条评论区 */
  giscus: GiscusConfig | null;
}

/**
 * 文章底部的评论区。
 *
 * 只走**一条**通道，不再同时出现两个评论框：
 *
 * - **配了 Giscus（本站默认）** → 只渲染 GitHub Discussions 评论区，
 *   访客用 GitHub 账号评论，站长在仓库的 Discussions 里回复。
 * - **没配 Giscus** → 退回「零配置可用」的本机评论（复制这个项目的人无需任何设置），
 *   保持这个模板开箱即用的底线。
 */
export function PostInteractions({ slug, repoComments, settings, giscus }: PostInteractionsProps) {
  const { isDark } = useThemeState();

  if (giscus) {
    // id="comments" 给「留言板」里那个「跳到正文评论」按钮当锚点
    return (
      <div id="comments">
        <GiscusComments
          config={giscus}
          isDark={isDark}
          heading="评论"
          hint="评论由 GitHub Discussions 提供：登录一次 GitHub 账号即可在全站通用（各篇文章与留言板共用同一个登录），换账号可在评论区内点击退出登录；数据保存在仓库的 Discussions 里，可随时导出。下面这排表情点一下就复制，粘进评论框即可使用。"
        />
        {/*
          表情栏放在评论区**下方**：giscus 的输入框在 iframe 里，而 iframe 是按照
          「评论列表 + 输入框」一起渲染的，放在上面会被评论列表顶到看不见的地方。
        */}
        <CommentEmojiBar />
      </div>
    );
  }

  return <LocalComments slug={slug} repoComments={repoComments} settings={settings} />;
}

/**
 * 本机评论模式（仅在没配 Giscus 时使用）。
 *
 * 访客写下的评论只存在自己的浏览器里；站长配了 GitHub Token 后可以把
 * 评论与回复提交进 `content/comments.json`，重新构建后对所有访客可见。
 */
function LocalComments({ slug, repoComments, settings }: Omit<PostInteractionsProps, "giscus">) {
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
    <section id="comments" className="mt-12 border-t border-stone-200 pt-8 dark:border-stone-800">
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

      {!thread.remoteReady && (
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
