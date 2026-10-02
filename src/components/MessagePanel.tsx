"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Heart, MessageSquare, Send, Trash2, X } from "lucide-react";
import { cn, formatRelative } from "@/lib/utils";
import { SITE } from "@/lib/site";
import { usePersistentState } from "@/hooks/usePersistentState";

export interface GuestMessage {
  id: string;
  author: string;
  content: string;
  createdAt: string;
  likes: number;
  liked?: boolean;
  /** 站长回复 */
  reply?: string;
}

/** 内置的示例留言，让静态站首次访问不显得空荡 */
const SEED_MESSAGES: GuestMessage[] = [
  {
    id: "seed-1",
    author: "阿城",
    content: "博客改版后清爽多了，左侧导航收起来之后读文章很专注。",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    likes: 3,
  },
  {
    id: "seed-2",
    author: "小林",
    content: "请问 MDX 里嵌入 B 站视频会不会拖慢首屏？",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    likes: 1,
    reply: "不会，iframe 用了 loading=\"lazy\"，滚到位置才会加载。",
  },
];

const STORAGE_KEY = "hc-blog:messages";
const NAME_KEY = "hc-blog:visitor-name";

function isMessageArray(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as GuestMessage).content === "string" &&
        typeof (item as GuestMessage).id === "string",
    )
  );
}

export interface MessagePanelProps {
  isOpen: boolean;
  onClose: () => void;
  isDesktop: boolean;
  /** 有壁纸时留言区跟着变半透明 */
  frosted?: boolean;
}

/**
 * 右侧「可隐藏留言区」。
 *
 * 纯静态导出没有后端，留言保存在浏览器 localStorage，
 * 也就是说这是一块只属于当前访客的留言板；
 * 后续要真实评论可以接 Giscus（基于 GitHub Discussions，同样免费）。
 */
export function MessagePanel({ isOpen, onClose, isDesktop, frosted = false }: MessagePanelProps) {
  const [messages, setMessages] = usePersistentState<GuestMessage[]>(
    STORAGE_KEY,
    SEED_MESSAGES,
    isMessageArray,
  );
  const [name, setName] = usePersistentState<string>(NAME_KEY, "", (value) => typeof value === "string");
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const likeCount = useMemo(() => messages.reduce((total, item) => total + item.likes, 0), [messages]);

  useEffect(() => {
    if (!isOpen) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [isOpen, messages.length]);

  const submit = () => {
    const content = input.trim();
    if (!content) return;

    setMessages((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        author: name.trim() || "匿名访客",
        content: content.slice(0, 500),
        createdAt: new Date().toISOString(),
        likes: 0,
      },
    ]);
    setInput("");
  };

  const toggleLike = (id: string) => {
    setMessages((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, liked: !item.liked, likes: item.likes + (item.liked ? -1 : 1) }
          : item,
      ),
    );
  };

  const remove = (id: string) => {
    setMessages((prev) => prev.filter((item) => item.id !== id));
  };

  const reset = () => setMessages(SEED_MESSAGES);

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
              {messages.length} 条留言 · {likeCount} 个赞 · 存在本机浏览器
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

        <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.map((message) => (
            <article
              key={message.id}
              className="group rounded-xl border border-stone-200 bg-stone-50/70 p-3 dark:border-stone-700 dark:bg-stone-800/50"
            >
              <header className="mb-1 flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-[10px] font-bold text-white">
                  {message.author.slice(0, 1)}
                </span>
                <span className="text-xs font-medium text-stone-800 dark:text-stone-100">
                  {message.author}
                </span>
                <span className="ml-auto text-[10px] text-stone-400">
                  {formatRelative(message.createdAt)}
                </span>
              </header>

              <p className="text-[13px] leading-relaxed break-words text-stone-600 dark:text-stone-300">
                {message.content}
              </p>

              {message.reply && (
                <p className="mt-2 rounded-lg border-l-2 border-brand-400 bg-white px-2 py-1.5 text-[12px] text-stone-500 dark:bg-stone-900 dark:text-stone-400">
                  <span className="font-medium text-brand-600 dark:text-brand-400">
                    {SITE.author} 回复：
                  </span>
                  {message.reply}
                </p>
              )}

              <footer className="mt-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => toggleLike(message.id)}
                  aria-pressed={message.liked}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] transition-colors",
                    message.liked
                      ? "text-brand-600 dark:text-brand-400"
                      : "text-stone-400 hover:text-brand-500",
                  )}
                >
                  <Heart className={cn("h-3 w-3", message.liked && "fill-current")} />
                  {message.likes}
                </button>
                <button
                  type="button"
                  onClick={() => remove(message.id)}
                  aria-label="删除这条留言"
                  className="ml-auto rounded-md p-1 text-stone-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-brand-500 focus-visible:opacity-100"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </footer>
            </article>
          ))}
        </div>

        <div className="border-t border-stone-200 p-3 dark:border-stone-800">
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={20}
            placeholder="你的昵称（可留空）"
            className="mb-2 w-full rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-700 placeholder:text-stone-400 focus:border-brand-400 focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200"
          />
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) submit();
              }}
              maxLength={500}
              rows={2}
              placeholder="写下留言…（Ctrl / ⌘ + Enter 发送）"
              className="flex-1 resize-none rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-700 placeholder:text-stone-400 focus:border-brand-400 focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200"
            />
            <button
              type="button"
              onClick={submit}
              disabled={!input.trim()}
              aria-label="发送留言"
              className="grid w-9 shrink-0 place-items-center self-end rounded-lg bg-brand-500 py-2 text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={reset}
            className="mt-2 text-[11px] text-stone-400 underline-offset-2 hover:text-brand-500 hover:underline"
          >
            重置为示例留言
          </button>
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
