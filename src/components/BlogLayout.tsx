"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ContentArea } from "./ContentArea";
import { MessagePanel } from "./MessagePanel";
import { SearchDialog } from "./SearchDialog";
import { SettingsPanel } from "./SettingsPanel";
import { MouseCursorEffect, CURSOR_DEFAULT_COLOR, CODE_DEFAULT_COLOR, isCursorColor, isCodeColor } from "./MouseCursorEffect";
import { Sidebar } from "./Sidebar";
import { ThemeProvider } from "./ThemeContext";
import { TopBar, type Theme } from "./TopBar";
import { WallpaperLayer } from "./WallpaperLayer";
import { useIsDesktop, useMediaQuery } from "@/hooks/useMediaQuery";
import { isBoolean, isNumber, usePersistentState } from "@/hooks/usePersistentState";
import { cn } from "@/lib/utils";
import type { PostMeta } from "@/lib/posts";
import {
  WALLPAPER_STORAGE_KEY,
  WALLPAPER_UPLOADS_KEY,
  isWallpaperSettings,
  isWallpaperUploadArray,
  resolveWallpaper,
  type WallpaperSettings,
  type WallpaperUpload,
} from "@/lib/wallpaper";
import {
  FONT_SIZES,
  type ContentWidth,
  type FontScale,
  type SiteSettings,
  type ThemePreference,
} from "@/lib/site-settings";
import { probeImageUrl } from "@/lib/image-utils";
import type { CommentItem } from "@/lib/interactions";

export type { ContentWidth, FontScale, SiteSettings, ThemePreference } from "@/lib/site-settings";

export interface BlogLayoutProps {
  children: React.ReactNode;
  recentPosts: PostMeta[];
  stats: { posts: number; tags: number; words: number };
  /** 构建期从 content/site-settings.json 读到的站点默认值 */
  siteSettings: SiteSettings;
  /** 构建期从 content/guestbook.json 读到的公开留言（站长发布、所有人可见） */
  repoMessages: CommentItem[];
}

const isThemePreference = (value: unknown): boolean =>
  value === "system" || value === "light" || value === "dark";
const isFontScale = (value: unknown): boolean => value === "sm" || value === "md" || value === "lg";
const isContentWidth = (value: unknown): boolean => value === "comfortable" || value === "wide";

/**
 * 应用外壳，对应设计图：
 *
 * ┌──────────────────────────────────────────────┐
 * │ [隐藏]  logo        [🔍 搜索]  留言 主题 设置 │  ← TopBar
 * ├────────────┬───────────────────┬─────────────┤
 * │ 可隐藏导航 │      内容         │ 可隐藏留言区│
 * └────────────┴───────────────────┴─────────────┘
 *
 * 状态分两层：
 * - **站点默认值**来自 `content/site-settings.json`，构建期注入，首屏就是对的
 * - **访客偏好**存在 localStorage，一旦设过就覆盖站点默认值
 */
export function BlogLayout({ children, recentPosts, stats, siteSettings, repoMessages }: BlogLayoutProps) {
  const isDesktop = useIsDesktop();

  // 把站点默认值固定成组件生命周期内的常量：
  // usePersistentState 的 initialValue 必须是稳定引用，否则会反复重新订阅。
  // 用 useState 而不是 useRef —— 渲染期读取 ref 会被 react-hooks/refs 拦下。
  const [defaults] = useState(siteSettings);

  // 桌面端：左右两栏是可隐藏的弹性子元素，状态持久化
  const [sidebarOpen, setSidebarOpen] = usePersistentState(
    "hc-blog:sidebar-open",
    defaults.sidebarOpen,
    isBoolean,
  );
  const [messageOpen, setMessageOpen] = usePersistentState(
    "hc-blog:message-open",
    defaults.messageOpen,
    isBoolean,
  );
  const [sidebarWidth, setSidebarWidth] = usePersistentState(
    "hc-blog:sidebar-width",
    defaults.sidebarWidth,
    isNumber,
  );

  // 鼠标特效：AI 图标光标 + 拖尾拨开代码 + 点击/按键音效，默认开启、可关闭
  const [cursorEffect, setCursorEffect] = usePersistentState(
    "hc-blog:cursor-effect",
    true,
    isBoolean,
  );
  const [cursorColor, setCursorColor] = usePersistentState(
    "hc-blog:cursor-color",
    CURSOR_DEFAULT_COLOR,
    isCursorColor,
  );
  const [codeColor, setCodeColor] = usePersistentState(
    "hc-blog:code-color",
    CODE_DEFAULT_COLOR,
    isCodeColor,
  );

  // 移动端：两栏都是覆盖式抽屉，用一次性的临时状态，避免进站就弹出来
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileMessageOpen, setMobileMessageOpen] = useState(false);

  // 主题偏好：站点默认通常是 system，「首次访问跟随系统」这句话才成立
  const [themePreference, setThemePreference] = usePersistentState<ThemePreference>(
    "hc-blog:theme",
    defaults.theme,
    isThemePreference,
  );
  const systemPrefersDark = useMediaQuery("(prefers-color-scheme: dark)");
  const theme: Theme =
    themePreference === "system" ? (systemPrefersDark ? "dark" : "light") : themePreference;

  const [fontScale, setFontScale] = usePersistentState<FontScale>(
    "hc-blog:font-scale",
    defaults.fontScale,
    isFontScale,
  );
  const [contentWidth, setContentWidth] = usePersistentState<ContentWidth>(
    "hc-blog:content-width",
    defaults.contentWidth,
    isContentWidth,
  );

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // 壁纸：站点默认值来自 site-settings.json，访客可以自己换
  const [wallpaper, setWallpaper] = usePersistentState<WallpaperSettings>(
    WALLPAPER_STORAGE_KEY,
    defaults.wallpaper,
    isWallpaperSettings,
  );

  // 直传仓库的壁纸列表：刚上传的那张带着 fallbackUrl，
  // 等站内地址真正可用（部署完成）后再把它清掉
  const [uploads, setUploads] = usePersistentState<WallpaperUpload[]>(
    WALLPAPER_UPLOADS_KEY,
    [],
    isWallpaperUploadArray,
  );

  const activeUpload = uploads.find(
    (item) => wallpaper.source === "url" && item.url === wallpaper.url,
  );

  // 探测正式地址是否已经部署好；一旦可用就丢掉临时地址
  useEffect(() => {
    if (!activeUpload?.fallbackUrl) return;
    let cancelled = false;

    void probeImageUrl(activeUpload.url).then((ready) => {
      if (!ready || cancelled) return;
      setUploads((prev) =>
        prev.map((item) => (item.id === activeUpload.id ? { ...item, fallbackUrl: undefined } : item)),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [activeUpload?.fallbackUrl, activeUpload?.id, activeUpload?.url, setUploads]);

  const wallpaperActive =
    resolveWallpaper(wallpaper, theme === "dark", activeUpload?.fallbackUrl) !== null;

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

  /**
   * 收起左右两栏。
   *
   * 桌面端和移动端各有一套状态（桌面端持久化、移动端是一次性的抽屉），
   * 所以「关闭」必须按当前断点分派 —— 否则就会出现
   * 「面板明明开着，点 X 却没反应」这种 bug。
   */
  const closeSidebar = useCallback(() => {
    if (isDesktop) setSidebarOpen(false);
    else setMobileNavOpen(false);
  }, [isDesktop, setSidebarOpen]);

  const closeMessage = useCallback(() => {
    if (isDesktop) setMessageOpen(false);
    else setMobileMessageOpen(false);
  }, [isDesktop, setMessageOpen]);

  /** 把访客偏好清掉，回到仓库里配置的站点默认值 */
  const resetLayout = useCallback(() => {
    setSidebarOpen(defaults.sidebarOpen);
    setMessageOpen(defaults.messageOpen);
    setSidebarWidth(defaults.sidebarWidth);
    setThemePreference(defaults.theme);
    setFontScale(defaults.fontScale);
    setContentWidth(defaults.contentWidth);
    setWallpaper(defaults.wallpaper);
  }, [
    defaults,
    setContentWidth,
    setFontScale,
    setMessageOpen,
    setSidebarOpen,
    setSidebarWidth,
    setThemePreference,
    setWallpaper,
  ]);

  /** 把当前这组设置整理成 SiteSettings，供「保存为站点默认」使用 */
  const currentSettings = useMemo<SiteSettings>(
    () => ({
      theme: themePreference,
      fontScale,
      contentWidth,
      sidebarOpen,
      sidebarWidth,
      messageOpen,
      wallpaper,
      giscus: defaults.giscus,
      interactions: defaults.interactions,
    }),
    [
      contentWidth,
      defaults.giscus,
      defaults.interactions,
      fontScale,
      messageOpen,
      sidebarOpen,
      sidebarWidth,
      themePreference,
      wallpaper,
    ],
  );

  const effectiveSidebarOpen = isDesktop ? sidebarOpen : mobileNavOpen;
  const effectiveMessageOpen = isDesktop ? messageOpen : mobileMessageOpen;

  // 深层组件（文章底部的评论）需要知道最终生效的主题
  const themeState = useMemo(() => ({ theme, isDark: theme === "dark" }), [theme]);

  // Esc 关闭最上层的浮层；⌘K / Ctrl+K 打开搜索
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // ⌘K / Ctrl+K：搜索是全局快捷键，任何状态下都能唤起
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((prev) => !prev);
        return;
      }

      if (event.key !== "Escape") return;
      if (searchOpen) setSearchOpen(false);
      else if (settingsOpen) setSettingsOpen(false);
      else if (effectiveSidebarOpen) closeSidebar();
      else if (effectiveMessageOpen) closeMessage();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    closeMessage,
    closeSidebar,
    settingsOpen,
    searchOpen,
    effectiveSidebarOpen,
    effectiveMessageOpen,
  ]);

  return (
    // isolate 会建立新的层叠上下文，壁纸层的 -z-10 才能「盖住底色、但不压住内容」
    <ThemeProvider value={themeState}>
    <div
      className="relative isolate h-dvh bg-stone-100 p-0 sm:p-3 dark:bg-stone-950"
      data-wallpaper={wallpaperActive ? "on" : "off"}
    >
      <WallpaperLayer
        settings={wallpaper}
        isDark={theme === "dark"}
        fallbackUrl={activeUpload?.fallbackUrl}
      />

      <MouseCursorEffect enabled={cursorEffect} color={cursorColor} codeColor={codeColor} />

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
          onOpenSearch={() => setSearchOpen(true)}
          frosted={wallpaperActive}
        />

        <div className="relative flex min-h-0 flex-1">
          <Sidebar
            isOpen={effectiveSidebarOpen}
            width={sidebarWidth}
            onWidthChange={setSidebarWidth}
            onClose={closeSidebar}
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
            onClose={closeMessage}
            isDesktop={isDesktop}
            frosted={wallpaperActive}
            repoMessages={repoMessages}
            settings={defaults.interactions}
          />
        </div>
      </div>

      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />

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
        cursorEffect={cursorEffect}
        onCursorEffectChange={setCursorEffect}
        cursorColor={cursorColor}
        onCursorColorChange={setCursorColor}
        codeColor={codeColor}
        onCodeColorChange={setCodeColor}
        wallpaper={wallpaper}
        onWallpaperChange={setWallpaper}
        isDark={theme === "dark"}
        siteSettings={defaults}
        currentSettings={currentSettings}
        onReset={resetLayout}
      />
    </div>
    </ThemeProvider>
  );
}

export default BlogLayout;
