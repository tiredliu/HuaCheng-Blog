"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowUpRight, MessageSquare, RotateCcw, X } from "lucide-react";
import { CommentEmojiBar } from "@/components/CommentEmojiBar";
import { CommentThreadView } from "@/components/CommentThreadView";
import { GiscusComments } from "@/components/GiscusComments";
import { useThemeState } from "@/components/ThemeContext";
import { cn } from "@/lib/utils";
import { isString, usePersistentState } from "@/hooks/usePersistentState";
import { useCommentThread } from "@/hooks/useCommentThread";
import {
  GUESTBOOK_PATH,
  MESSAGES_KEY,
  isCommentArray,
  type CommentItem,
  type InteractionSettings,
} from "@/lib/interactions";
import type { GiscusConfig } from "@/lib/site-settings";

export type { CommentItem as GuestMessage } from "@/lib/interactions";

const NAME_KEY = "hc-blog:visitor-name";

/** 留言板绑定到的 GitHub Discussion 标题（giscus 按它查找 / 创建这条讨论） */
const GUESTBOOK_DISCUSSION_TERM = "留言板";

export interface MessagePanelProps {
  isOpen: boolean;
  onClose: () => void;
  isDesktop: boolean;
  /** 有壁纸时留言区跟着变半透明 */
  frosted?: boolean;
  /** 构建期从 `content/guestbook.json` 读到的公开留言（含站长回复），仅本机留言模式用 */
  repoMessages: CommentItem[];
  /** 站点设置里的互动后端配置，仅本机留言模式用 */
  settings: InteractionSettings;
  /** 配了 Giscus（本站默认已配）时，留言板改成内嵌一条 GitHub Discussions 留言区 */
  giscus: GiscusConfig | null;
}

/**
 * 右侧「可隐藏留言板」。
 *
 * ⚠️ **giscus 一个页面只支持一个实例**：它的 `client.js` 会复用页面上第一个
 * `.giscus` 容器（`document.querySelector`，跨实例不隔离），而 iframe 的高度消息
 * 也不带发送方标识 —— 两个实例会互相顶替容器、互相抢高度。实测表现就是
 * 「留言板里显示了某篇文章的评论」。
 *
 * 所以这里做了明确分工：
 * - **文章页**：正文底部已经有一条 Giscus，留言板就不再内嵌 Giscus，
 *   改为提示「本页评论在正文底部」并给一个跳转按钮；
 * - **其他页面**：留言板内嵌全站留言板（绑定「留言板」这条 Discussion）。
 */
export function MessagePanel({
  isOpen,
  onClose,
  isDesktop,
  frosted = false,
  repoMessages,
  settings,
  giscus,
}: MessagePanelProps) {
  const { isDark } = useThemeState();
  const pathname = usePathname();
  const [localMessages, setLocalMessages] = usePersistentState<CommentItem[]>(
    MESSAGES_KEY,
    [],
    isCommentArray,
  );
  const [name, setName] = usePersistentState<string>(NAME_KEY, "", isString);
  const listRef = useRef<HTMLDivElement>(null);
  const [resetHint, setResetHint] = useState(false);

  const thread = useCommentThread({
    target: GUESTBOOK_PATH,
    pathKey: GUESTBOOK_PATH,
    repoComments: repoMessages,
    settings,
    localComments: localMessages,
    setLocalComments: setLocalMessages,
  });

  const likeCount = useMemo(
    () => thread.comments.reduce((total, item) => total + item.likes, 0),
    [thread.comments],
  );

  // 文章页正文底部已有 Giscus，留言板让位（见组件顶部说明）
  const isPostPage = pathname?.startsWith("/posts/") ?? false;
  const showGuestbook = Boolean(giscus) && !isPostPage;

  useEffect(() => {
    if (!isOpen || giscus) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [isOpen, giscus, thread.comments.length]);

  const resetLocal = () => {
    setLocalMessages(() => []);
    setResetHint(true);
  };

  const scrollToComments = () => {
    onClose();
    // 等面板收起动画开始后再滚动，移动端才不会被面板挡住
    window.setTimeout(() => {
      document
        .getElementById("comments")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  };

  const panel = (
    <aside
      style={isDesktop ? { width: isOpen ? 320 : 0 } : undefined}
      className={cn(
        "flex shrink-0 flex-col overflow-hidden border-stone-200 transition-all duration-300 ease-out dark:border-stone-800",
        frosted
          ? "bg-white/62 backdrop-blur-xl dark:bg-stone-900/58"
          : "bg-white dark:bg-stone-900",
        isDesktop
          ? "relative border-l"
          : "fixed inset-y-0 right-0 z-50 w-[88vw] max-w-[360px] border-l shadow-float",
        !isDesktop && (isOpen ? "translate-x-0" : "translate-x-full"),
      )}
      aria-hidden={!isOpen}
      // 收起时禁止键盘 focus 进入（宽度 0 / 移出可视区，内容仍留在 DOM 里）
      inert={!isOpen}
      aria-label="留言区"
    >
      <div className="flex h-full flex-col" style={{ width: isDesktop ? 320 : undefined }}>
        <div className="flex items-center justify-between gap-2 border-b border-stone-200 px-4 py-3 dark:border-stone-800">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-300">
              <MessageSquare className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">留言板</h2>
              <p className="mt-0.5 truncate text-[11px] text-stone-500 dark:text-stone-400">
                {giscus
                  ? showGuestbook
                    ? "由 GitHub Discussions 提供"
                    : "本页评论在正文底部"
                  : `${thread.comments.length} 条 · ${likeCount} 个赞 · ${
                      thread.remoteReady ? "全站可见" : "公开留言由站长发布"
                    }`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="隐藏留言区"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 dark:hover:bg-stone-800 dark:hover:text-stone-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {giscus ? (
          showGuestbook ? (
            <>
              <div ref={listRef} className="flex-1 overflow-y-auto px-3.5 py-4">
                <div className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white/80 p-1 shadow-sm dark:border-stone-800 dark:bg-stone-950/40">
                  <GiscusComments
                    config={giscus}
                    isDark={isDark}
                    embedded
                    showHeading={false}
                    mapping="specific"
                    term={GUESTBOOK_DISCUSSION_TERM}
                    hint="登录一次 GitHub 账号即可留言，全站通用；换账号在评论区内点退出登录。内容对所有访客公开。"
                  />
                  {/* 侧栏窄，用不带边框的那版，横着滚 */}
                  <CommentEmojiBar variant="plain" className="mt-1 px-2 pb-1" />
                </div>
              </div>

              <div className="border-t border-stone-200 px-4 py-2.5 dark:border-stone-800">
                <a
                  href={`https://github.com/${giscus.repo}/discussions`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-stone-400 underline-offset-2 transition-colors hover:text-brand-500 hover:underline"
                >
                  <ArrowUpRight className="h-3 w-3" />
                  在 GitHub Discussions 里查看
                </a>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-stone-100 text-stone-400 dark:bg-stone-800 dark:text-stone-500">
                <MessageSquare className="h-5 w-5" />
              </span>
              <p className="text-sm font-medium text-stone-600 dark:text-stone-300">
                本页评论在正文底部
              </p>
              <p className="text-[11px] leading-relaxed text-stone-400">
                每篇文章都有自己的 GitHub Discussions 评论区；全站留言板请在首页等其他页面打开。
              </p>
              <button
                type="button"
                onClick={scrollToComments}
                className="mt-1 rounded-lg border border-stone-200 px-3 py-1.5 text-[11px] text-stone-500 transition-colors hover:border-brand-300 hover:text-brand-600 dark:border-stone-700 dark:text-stone-400 dark:hover:border-brand-800 dark:hover:text-brand-400"
              >
                跳到正文评论 ↓
              </button>
            </div>
          )
        ) : (
          <>
            <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4">
              <CommentThreadView
                thread={thread}
                name={name}
                onNameChange={setName}
                dense
                placeholder="写下留言…（Ctrl / ⌘ + Enter 发送）"
                emptyHint="还没有留言。"
              />
            </div>

            <div className="border-t border-stone-200 px-3 py-2 dark:border-stone-800">
              <button
                type="button"
                onClick={resetLocal}
                className="flex items-center gap-1 text-[11px] text-stone-400 underline-offset-2 hover:text-brand-500 hover:underline"
              >
                <RotateCcw className="h-3 w-3" />
                清空本机留言
              </button>
              {resetHint && (
                <p className="mt-1 text-[10px] leading-relaxed text-stone-400">
                  已清空。站长发布在仓库里的留言不会被删掉 —— 那些对所有访客可见。
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  );

  if (isDesktop) return panel;

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-stone-900/40 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden
        />
      )}
      {panel}
    </>
  );
}

export default MessagePanel;
