"use client";

import Link from "next/link";
import {
  Moon,
  PanelLeft,
  PanelLeftClose,
  PanelRight,
  PanelRightClose,
  Search,
  Settings,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { withBasePath, SITE } from "@/lib/site";

export type Theme = "light" | "dark";

interface TopBarProps {
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  onToggleMessage: () => void;
  messageOpen: boolean;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onOpenSearch: () => void;
  theme: Theme;
  /** 有壁纸时顶栏跟着变半透明 */
  frosted?: boolean;
}

/** 图标按钮：统一 hover / 激活态 */
function IconButton({
  label,
  active,
  onClick,
  className,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-lg transition-colors",
        active
          ? "bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-300"
          : "text-stone-500 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100",
        className,
      )}
    >
      {children}
    </button>
  );
}

/**
 * 顶部工具栏。对应设计图右上角的两个按钮（主题 / 设置），
 * 左上角的方块是「隐藏按钮」，用来收起左侧导航。
 */
export function TopBar({
  onToggleSidebar,
  sidebarOpen,
  onToggleMessage,
  messageOpen,
  onToggleTheme,
  onOpenSettings,
  onOpenSearch,
  theme,
  frosted = false,
}: TopBarProps) {
  return (
    <header
      className={cn(
        "flex h-14 shrink-0 items-center gap-2 border-b border-stone-200 px-3 dark:border-stone-800",
        frosted
          ? "bg-white/60 backdrop-blur-xl dark:bg-stone-900/55"
          : "bg-white/85 backdrop-blur-md dark:bg-stone-900/85",
      )}
    >
      {/* 左上角：隐藏 / 显示左侧导航 */}
      <IconButton
        label={sidebarOpen ? "隐藏导航栏" : "显示导航栏"}
        active={sidebarOpen}
        onClick={onToggleSidebar}
      >
        {sidebarOpen ? (
          <PanelLeftClose className="h-5 w-5" />
        ) : (
          <PanelLeft className="h-5 w-5" />
        )}
      </IconButton>

      <Link href="/" className="flex items-center gap-2 rounded-lg px-1 py-1">
        {/* 头像来自仓库里的 public/avatar.png，换图不用改代码 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={withBasePath(SITE.avatarSmall)}
          alt={SITE.author}
          width={32}
          height={32}
          className="h-8 w-8 rounded-lg shadow-sm"
        />
        <span className="hidden text-[15px] font-semibold tracking-tight text-stone-900 sm:block dark:text-stone-100">
          {SITE.name}
        </span>
      </Link>

      <div className="flex-1" />

      {/* 搜索：桌面端做成「输入框」的样子，让它一眼可见；移动端只留图标 */}
      <button
        type="button"
        onClick={onOpenSearch}
        title="搜索文章（⌘K / Ctrl+K）"
        aria-label="搜索文章"
        className="hidden h-9 items-center gap-2 rounded-lg border border-stone-200 px-2.5 text-stone-400 transition-colors hover:border-brand-300 hover:text-brand-600 md:flex dark:border-stone-700 dark:hover:border-brand-700 dark:hover:text-brand-400"
      >
        <Search className="h-4 w-4" />
        <span className="text-xs">搜索文章…</span>
        <kbd className="rounded border border-stone-200 px-1 font-mono text-[10px] dark:border-stone-700">
          ⌘K
        </kbd>
      </button>

      <IconButton label="搜索文章" onClick={onOpenSearch} className="md:hidden">
        <Search className="h-5 w-5" />
      </IconButton>

      {/* 右上角：主题 / 设置（设计图） + 留言区开关 */}
      <IconButton label={messageOpen ? "隐藏留言区" : "显示留言区"} active={messageOpen} onClick={onToggleMessage}>
        {messageOpen ? (
          <PanelRightClose className="h-5 w-5" />
        ) : (
          <PanelRight className="h-5 w-5" />
        )}
      </IconButton>

      <IconButton label={theme === "light" ? "切换到深色主题" : "切换到浅色主题"} onClick={onToggleTheme}>
        {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
      </IconButton>

      <IconButton label="设置" onClick={onOpenSettings}>
        <Settings className="h-5 w-5" />
      </IconButton>
    </header>
  );
}

export default TopBar;
