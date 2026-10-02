"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * 响应式断点判断。
 *
 * 桌面端侧栏是「占据宽度的弹性子元素」，移动端是「覆盖式抽屉」，
 * 两种行为差别很大，所以需要知道当前在哪个断点。
 *
 * `matchMedia` 天然就是外部数据源，用 `useSyncExternalStore` 订阅它，
 * 服务端返回 false，hydration 之后立刻得到真实值。
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onStoreChange);
      return () => media.removeEventListener("change", onStoreChange);
    },
    [query],
  );

  // 返回布尔值（原始类型），引用天然稳定，不会触发额外渲染
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Tailwind 的 lg 断点 */
export const useIsDesktop = () => useMediaQuery("(min-width: 1024px)");
