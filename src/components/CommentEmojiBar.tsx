"use client";

import { useEffect, useState } from "react";
import { Check, Smile, X } from "lucide-react";
import { COMMENT_EMOJIS, type EmojiItem } from "@/lib/emojis";
import { cn } from "@/lib/utils";

/**
 * 评论区旁边的小表情栏。
 *
 * 为什么只能做成「点一下复制」：评论框是 **GitHub 的组件**，跑在 giscus 的跨域 iframe 里
 * —— 浏览器不让第三方页面读它的 DOM，更别说往里塞自定义表情包了。
 * 这是同源策略决定的，不是配置没写对（giscus 官方也没有任何表情相关的选项）。
 *
 * 所以退一步：把表情摆在评论框**旁边**，点一下复制，再粘进评论框。
 * GitHub 评论框认 emoji，也认 Markdown 图片语法（`图片` 那条就走这个）。
 */

/** 复制成功 / 失败的提示停留多久 */
const HINT_DURATION = 2000;

function textOf(item: EmojiItem): string {
  // 图片表情复制 Markdown 语法，粘进 GitHub 评论框会渲染成图
  return item.image ? `![${item.name}](${item.image})` : (item.char ?? "");
}

export function CommentEmojiBar({
  items = COMMENT_EMOJIS,
  /** `card` 带边框卡片（文章评论区）；`plain` 不带边框（留言板里已经有一层卡片了） */
  variant = "card",
  className,
}: {
  items?: EmojiItem[];
  variant?: "card" | "plain";
  className?: string;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  // 提示自动消失（copied / failed 变了就重新计时）
  useEffect(() => {
    if (!copied && !failed) return;
    const timer = setTimeout(() => {
      setCopied(null);
      setFailed(false);
    }, HINT_DURATION);
    return () => clearTimeout(timer);
  }, [copied, failed]);

  if (items.length === 0) return null;

  const handleClick = async (item: EmojiItem) => {
    const text = textOf(item);
    if (!text) return;

    try {
      // 剪贴板 API 只在 https（或 localhost）下可用，http 站点会直接抛错
      await navigator.clipboard.writeText(text);
      setFailed(false);
      setCopied(item.name);
    } catch {
      setCopied(null);
      setFailed(true);
    }
  };

  return (
    <div
      className={cn(
        "mb-3 flex items-center gap-2",
        variant === "card" &&
          "rounded-xl border border-stone-200 bg-white px-3 py-2 dark:border-stone-800 dark:bg-stone-900/60",
        className,
      )}
    >
      <span className="flex shrink-0 items-center gap-1 text-[11px] text-stone-400">
        <Smile className="h-3.5 w-3.5" />
        表情
      </span>

      {/* 表情多了就横向滚，别把卡片撑开 */}
      <div className="flex min-w-0 flex-1 gap-0.5 overflow-x-auto">
        {items.map((item) => (
          <button
            key={item.name}
            type="button"
            onClick={() => void handleClick(item)}
            title={item.image ? `${item.name}（复制图片代码）` : item.name}
            aria-label={`复制表情：${item.name}`}
            className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-md text-base leading-none transition-colors hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            {item.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.image} alt={item.name} className="h-5 w-5 object-contain" />
            ) : (
              <span aria-hidden>{item.char}</span>
            )}
          </button>
        ))}
      </div>

      {copied && (
        <span className="flex shrink-0 items-center gap-1 text-[11px] text-brand-600 dark:text-brand-400">
          <Check className="h-3 w-3" />
          已复制「{copied}」，去评论框粘贴
        </span>
      )}
      {failed && (
        <span className="flex shrink-0 items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
          <X className="h-3 w-3" />
          这个浏览器不让复制，请手动选表情
        </span>
      )}
    </div>
  );
}

export default CommentEmojiBar;
