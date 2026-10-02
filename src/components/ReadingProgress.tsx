"use client";

import { useEffect, useState } from "react";

/**
 * 顶部阅读进度条。
 *
 * 真正的滚动容器是外壳里的 `<main id="content">`，
 * 不是 window，所以这里监听的是那个元素。
 */
export function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const container = document.getElementById("content");
    if (!container) return;

    const update = () => {
      const scrollable = container.scrollHeight - container.clientHeight;
      setProgress(scrollable <= 0 ? 0 : Math.min(100, (container.scrollTop / scrollable) * 100));
    };

    update();
    container.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      container.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div
      className="pointer-events-none fixed top-0 left-0 z-100 h-0.5 bg-brand-500 transition-[width] duration-150 ease-out"
      style={{ width: `${progress}%` }}
      aria-hidden
    />
  );
}

export default ReadingProgress;
