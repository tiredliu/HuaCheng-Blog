"use client";

import { createContext, useContext } from "react";
import type { Theme } from "@/components/TopBar";

export interface ThemeState {
  /** 当前实际生效的主题（已经把「跟随系统」解析过） */
  theme: Theme;
  isDark: boolean;
}

const FALLBACK: ThemeState = { theme: "light", isDark: false };

const ThemeContext = createContext<ThemeState>(FALLBACK);

export const ThemeProvider = ThemeContext.Provider;

/**
 * 读取「当前是不是深色」。
 *
 * 深色是由类名 + 系统偏好共同决定的，只有 `BlogLayout` 知道最终结果。
 * 深层组件（比如文章底部的 Giscus 评论）需要它来同步配色，
 * 用 Context 而不是去读 DOM 或轮询 localStorage —— 后者既不响应式也很难维护。
 */
export function useThemeState(): ThemeState {
  return useContext(ThemeContext);
}
