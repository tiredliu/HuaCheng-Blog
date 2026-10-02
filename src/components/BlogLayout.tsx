"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ContentArea } from "./ContentArea";
import { MessagePanel } from "./MessagePanel";
import { SettingsPanel, type ContentWidth, type FontScale } from "./SettingsPanel";
import { Sidebar } from "./Sidebar";
import { TopBar, type Theme } from "./TopBar";
import { WallpaperLayer } from "./WallpaperLayer";
import { useIsDesktop, useMediaQuery } from "@/hooks/useMediaQuery";
import { isBoolean, isNumber, usePersistentState } from "@/hooks/usePersistentState";
import { cn } from "@/lib/utils";
import type { PostMeta } from "@/lib/posts";
import {
  DEFAULT_WALLPAPER,
  WALLPAPER_STORAGE_KEY,
  isWallpaperSettings,
  resolveWallpaper,
  type WallpaperSettings,
} from "@/lib/wallpaper";

const DEFAULT_SIDEBAR_WIDTH = 272;
const FONT_SIZES: Record<FontScale, string> = { sm: "15px", md: "16px", lg: "17.5px" };

export interface BlogLayoutProps {
  children: React.ReactNode;
  recentPosts: PostMeta[];
  stats: { posts: number; tags: number; words: number };
}

/** 主题偏好：可以明确选浅色 / 深色，也可以交给系统 */
export type ThemePreference = "system" | "light" | "dark";

const isThemePreference = (value: unknown): boolean =>
  value === "system" || value === "light" || value === "dark";
const isFontScale = (value: unknown): boolean => value === "sm" || value === "md" || value === "lg";
const isContentWidth = (value: unknown): boolean => value === "comfortable" || value === "wide";

/**
 * 应用外壳，对应设计图：
 *
 * ┌──────────────────────────────────────────────┐
 * │ [隐藏]  logo              主题 设置  留言    │  ← TopBar
 * ├────────────┬───────────────────┬─────────────┤
 * │ 可隐藏导航 │      内容         │ 可隐藏留言区│
 * └────────────┴───────────────────┴─────────────┘
 */
export function BlogLayout({ children, recentPosts, stats }: BlogLayoutProps) {
  const isDesktop = useIsDesktop();

  // 桌面端：左右两栏是可隐藏的弹性子元素，状态持久化
  const [sidebarOpen, setSidebarOpen] = usePersistentState("hc-blog:sidebar-open", true, isBoolean);
  const [messageOpen, setMessageOpen] = usePersistentState("hc-blog:message-open", false, isBoolean);
  const [sidebarWidth, setSidebarWidth] = usePersistentState(
    "hc-blog:sidebar-width",
    DEFAULT_SIDEBAR_WIDTH,
    isNumber,
  );

  // 移动端：两栏都是覆盖式抽屉，用一次性的临时状态，避免进站就弹出来
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileMessageOpen, setMobileMessageOpen] = useState(false);

  // 主题偏好：默认交给系统，「首次访问跟随系统」这句话才成立
  const [themePreference, setThemePreference] = usePersistentState<ThemePreference>(
    "hc-blog:theme",
    "system",
    isThemePreference,
  );
  const systemPrefersDark = useMediaQuery("(prefers-color-scheme: dark)");
  const theme: Theme =
    themePreference === "system" ? (systemPrefersDark ? "dark" : "light") : themePreference;

  const [fontScale, setFontScale] = usePersistentState<FontScale>("hc-blog:font-scale", "md", isFontScale);
  const [contentWidth, setContentWidth] = usePersistentState<ContentWidth>(
    "hc-blog:content-width",
    "comfortable",
    isContentWidth,
  );

  const [settingsOpen, setSettingsOpen] = useState(false);

  // 壁纸：站点在 wallpaper.ts 里给一个默认值，访客可以自己换
  const [wallpaper, setWallpaper] = usePersistentState<WallpaperSettings>(
    WALLPAPER_STORAGE_KEY,
    DEFAULT_WALLPAPER,
    isWallpaperSettings,
  );
  const wallpaperActive = resolveWallpaper(wallpaper, theme === "dark") !== null;

  // 首帧不写 class：layout.tsx 里的内联脚本已经根据 localStorage / 系统偏好
  // 把 `dark` 加好了，这里再动一次反而会闪一下白屏
  const themeApplied = useRef(false);
  useEffect(() => {
    if (!themeApplied.current) {
      themeApplied.current = true;
      return;
    }
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.fontSize = FONT_SIZES[fontScale] ?? FONT_SIZES.md;
  }, [fontScale]);

  // 顶部栏那个按钮在「跟随系统」时也会把结果写死成明确的一侧，符合直觉
  const toggleTheme = useCallback(() => {
    setThemePreference(theme === "light" ? "dark" : "light");
  }, [setThemePreference, theme]);

  const toggleSidebar = useCallback(() => {
    if (isDesktop) setSidebarOpen((prev) => !prev);
    else setMobileNavOpen((prev) => !prev);
  }, [isDesktop, setSidebarOpen]);

  const toggleMessage = useCallback(() => {
    if (isDesktop) setMessageOpen((prev) => !prev);
    else setMobileMessageOpen((prev) => !prev);
  }, [isDesktop, setMessageOpen]);

  const resetLayout = useCallback(() => {
    setSidebarOpen(true);
    setMessageOpen(false);
    setSidebarWidth(DEFAULT_SIDEBAR_WIDTH);
    setThemePreference("system");
    setFontScale("md");
    setContentWidth("comfortable");
    setWallpaper(DEFAULT_WALLPAPER);
  }, [
    setContentWidth,
    setFontScale,
    setMessageOpen,
    setSidebarOpen,
    setSidebarWidth,
    setThemePreference,
    setWallpaper,
  ]);

  const effectiveSidebarOpen = isDesktop ? sidebarOpen : mobileNavOpen;
  const effectiveMessageOpen = isDesktop ? messageOpen : mobileMessageOpen;

  // Esc 关闭最上层的浮层
  useEffect(() => {
    if (!settingsOpen && !effectiveSidebarOpen && !effectiveMessageOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (settingsOpen) setSettingsOpen(false);
      else if (!isDesktop && effectiveSidebarOpen) setMobileNavOpen(false);
      else if (!isDesktop && effectiveMessageOpen) setMobileMessageOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isDesktop, settingsOpen, effectiveSidebarOpen, effectiveMessageOpen]);

  return (
    // isolate 会建立新的层叠上下文，壁纸层的 -z-10 才能「盖住底色、但不压住内容」
    <div
      className="relative isolate h-dvh bg-stone-100 p-0 sm:p-3 dark:bg-stone-950"
      data-wallpaper={wallpaperActive ? "on" : "off"}
    >
      <WallpaperLayer settings={wallpaper} isDark={theme === "dark"} />

      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-100 focus:rounded-lg focus:bg-brand-500 focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        跳到正文
      </a>

      <div
        className={cn(
          "flex h-full flex-col overflow-hidden border-stone-200 sm:rounded-2xl sm:border sm:shadow-card dark:border-stone-800",
          // 有壁纸时外壳变毛玻璃，让壁纸透出来
          wallpaperActive
            ? "bg-stone-50/72 backdrop-blur-2xl dark:bg-stone-900/68"
            : "bg-stone-50 dark:bg-stone-900",
        )}
      >
        <TopBar
          theme={theme}
          onToggleTheme={toggleTheme}
          sidebarOpen={effectiveSidebarOpen}
          onToggleSidebar={toggleSidebar}
          messageOpen={effectiveMessageOpen}
          onToggleMessage={toggleMessage}
          onOpenSettings={() => setSettingsOpen(true)}
          frosted={wallpaperActive}
        />

        <div className="relative flex min-h-0 flex-1">
          <Sidebar
            isOpen={effectiveSidebarOpen}
            width={sidebarWidth}
            onWidthChange={setSidebarWidth}
            onClose={() => setMobileNavOpen(false)}
            recentPosts={recentPosts}
            stats={stats}
            isDesktop={isDesktop}
            frosted={wallpaperActive}
          />

          <ContentArea width={contentWidth} isSettingsOpen={settingsOpen}>
            {children}
          </ContentArea>

          <MessagePanel
            isOpen={effectiveMessageOpen}
            onClose={() => setMobileMessageOpen(false)}
            isDesktop={isDesktop}
            frosted={wallpaperActive}
          />
        </div>
      </div>

      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        themePreference={themePreference}
        onThemePreferenceChange={setThemePreference}
        fontScale={fontScale}
        onFontScaleChange={setFontScale}
        contentWidth={contentWidth}
        onContentWidthChange={setContentWidth}
        sidebarWidth={sidebarWidth}
        onSidebarWidthChange={setSidebarWidth}
        wallpaper={wallpaper}
        onWallpaperChange={setWallpaper}
        isDark={theme === "dark"}
        onReset={resetLayout}
      />
    </div>
  );
}

export default BlogLayout;
