"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 文章页右下角的「回到顶部 / 跳到底部」。
 *
 * ⚠️ 滚动容器是外壳里的 `<main id="content">`，**不是 window** ——
 * 直接滚 window 会毫无反应（和 `ReadingProgress` 踩的是同一个坑）。
 */

/** 滚过这个距离才显示「回到顶部」，免得一进页面就杵在那儿 */
const SHOW_TOP_AFTER = 320;
/** 距底部小于这个距离就算已经到底了，隐藏「跳到底部」 */
const BOTTOM_EPSILON = 64;

export function PostScrollButtons({ className }: { className?: string }) {
  const [showTop, setShowTop] = useState(false);
  const [showBottom, setShowBottom] = useState(false);

  useEffect(() => {
    const container = document.getElementById("content");
    if (!container) return;

    let frame = 0;

    const measure = () => {
      frame = 0;
      const max = container.scrollHeight - container.clientHeight;
      setShowTop(container.scrollTop > SHOW_TOP_AFTER);
      // 内容压根滚不动（或已经到底）时，「跳到底部」没有意义
      setShowBottom(max > SHOW_TOP_AFTER && container.scrollTop < max - BOTTOM_EPSILON);
    };

    // 滚动事件比渲染帧密集得多，用 rAF 合并成「一帧最多算一次」
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(measure);
    };

    schedule();
    container.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      container.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  if (!showTop && !showBottom) return null;

  const scrollTo = (top: number) => {
    const container = document.getElementById("content");
    container?.scrollTo({ top, behavior: "smooth" });
  };

  return (
    <div
      className={cn(
        // z-30：在内容之上，但低于抽屉的遮罩（z-40），打开侧栏/设置时被遮住是应该的
        "fixed right-4 bottom-5 z-30 flex flex-col gap-2 sm:right-6 sm:bottom-6",
        className,
      )}
    >
      {showTop && (
        <button
          type="button"
          onClick={() => scrollTo(0)}
          title="回到顶部"
          aria-label="回到顶部"
          className="grid h-10 w-10 animate-fade-in place-items-center rounded-full border border-stone-200 bg-white/85 text-stone-600 shadow-float backdrop-blur transition-colors hover:border-brand-300 hover:text-brand-600 dark:border-stone-700 dark:bg-stone-900/85 dark:text-stone-300 dark:hover:border-brand-800 dark:hover:text-brand-300"
        >
          <ArrowUp className="h-4.5 w-4.5" />
        </button>
      )}

      {showBottom && (
        <button
          type="button"
          onClick={() => {
            const container = document.getElementById("content");
            if (container) scrollTo(container.scrollHeight);
          }}
          title="跳到底部"
          aria-label="跳到底部"
          className="grid h-10 w-10 animate-fade-in place-items-center rounded-full border border-stone-200 bg-white/85 text-stone-600 shadow-float backdrop-blur transition-colors hover:border-brand-300 hover:text-brand-600 dark:border-stone-700 dark:bg-stone-900/85 dark:text-stone-300 dark:hover:border-brand-800 dark:hover:text-brand-300"
        >
          <ArrowDown className="h-4.5 w-4.5" />
        </button>
      )}
    </div>
  );
}

export default PostScrollButtons;
