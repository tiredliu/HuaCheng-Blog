"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface ContentAreaProps {
  children: React.ReactNode;
  /** 内容区最大宽度偏好 */
  width: "comfortable" | "wide";
  isSettingsOpen: boolean;
}

/**
 * 中间内容区。对应设计图正中的「内容」。
 *
 * 侧栏 / 留言区在桌面端是弹性子元素，会自动挤压内容区宽度，
 * 所以这里不再需要计算 marginLeft / marginRight。
 */
export function ContentArea({ children, width, isSettingsOpen }: ContentAreaProps) {
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);

  // 路由切换后回到顶部，避免客户端导航时保留上一条滚动位置
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [pathname]);

  return (
    <main
      ref={mainRef}
      id="content"
      className="relative flex-1 overflow-y-auto scroll-smooth"
      aria-hidden={isSettingsOpen || undefined}
    >
      <div
        className={cn(
          "mx-auto w-full px-4 py-8 sm:px-6 lg:px-8",
          width === "wide" ? "max-w-5xl" : "max-w-3xl",
        )}
      >
        {children}
      </div>
    </main>
  );
}

export default ContentArea;
