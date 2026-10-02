"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, RotateCcw, X } from "lucide-react";
import { CommentThreadView } from "@/components/CommentThreadView";
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

export type { CommentItem as GuestMessage } from "@/lib/interactions";

const NAME_KEY = "hc-blog:visitor-name";

export interface MessagePanelProps {
  isOpen: boolean;
  onClose: () => void;
  isDesktop: boolean;
  /** 有壁纸时留言区跟着变半透明 */
  frosted?: boolean;
  /** 构建期从 `content/guestbook.json` 读到的公开留言（含站长回复） */
  repoMessages: CommentItem[];
  /** 站点设置里的互动后端配置 */
  settings: InteractionSettings;
}

/**
 * 右侧「可隐藏留言板」。
 *
 * 权限模型和文章评论区完全一致（共用 `useCommentThread`）：
 *
 * - **访客**写下的留言先落在自己的浏览器里，界面上如实写明
 * - **站长**（本机配好了 GitHub Token）写的留言与回复会提交进
 *   `content/guestbook.json`，重新构建后**所有访客**都能看到
 *
 * 之所以把「公开可见」这件事限定给站长，是因为纯静态站没有服务端：
 * 要让任意访客写的东西对所有人可见，就必须把仓库写权限发给所有人，
 * 或者引入一个后端（见 README 的互动服务一节）。
 */
export function MessagePanel({
  isOpen,
  onClose,
  isDesktop,
  frosted = false,
  repoMessages,
  settings,
}: MessagePanelProps) {
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

  useEffect(() => {
    if (!isOpen) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [isOpen, thread.comments.length]);

  const resetLocal = () => {
    setLocalMessages(() => []);
    setResetHint(true);
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
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3 dark:border-stone-800">
          <div>
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-stone-900 dark:text-stone-100">
              <MessageSquare className="h-4 w-4 text-brand-500" />
              留言板
            </h2>
            <p className="mt-0.5 text-[11px] text-stone-500 dark:text-stone-400">
              {thread.comments.length} 条 · {likeCount} 个赞 ·{" "}
              {thread.remoteReady ? "全站可见" : "公开留言由站长发布"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="隐藏留言区"
            className="grid h-7 w-7 place-items-center rounded-md text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

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
