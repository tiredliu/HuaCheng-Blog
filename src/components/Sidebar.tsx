"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useRef } from "react";
import {
  Archive,
  FileText,
  GripVertical,
  House,
  Mail,
  SquarePen,
  Tag,
  User,
  X,
} from "lucide-react";
import { MusicPlayer } from "@/components/MusicPlayer";
import { defaultPlaylist } from "@/lib/music";
import { NAV_ITEMS, SITE, withBasePath } from "@/lib/site";
import { cn, formatCount, formatDateShort } from "@/lib/utils";
import type { PostMeta } from "@/lib/posts";

const ICONS = {
  house: House,
  "file-text": FileText,
  tag: Tag,
  archive: Archive,
  user: User,
  mail: Mail,
} as const;

export interface SidebarProps {
  isOpen: boolean;
  width: number;
  onWidthChange: (width: number) => void;
  onClose: () => void;
  recentPosts: PostMeta[];
  stats: { posts: number; tags: number; words: number };
  isDesktop: boolean;
  /** 有壁纸时侧栏跟着变半透明 */
  frosted?: boolean;
}

/**
 * 左侧导航。对应设计图里左侧那条「可隐藏导航预留空间」，
 * 右边框拖拽可以调整宽度（虚线边框 + 中间的握把图标）。
 */
export function Sidebar({
  isOpen,
  width,
  onWidthChange,
  onClose,
  recentPosts,
  stats,
  isDesktop,
  frosted = false,
}: SidebarProps) {
  const pathname = usePathname() ?? "/";
  const resizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(width);

  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      resizing.current = true;
      startX.current = event.clientX;
      startWidth.current = width;
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";

      const onMove = (moveEvent: MouseEvent) => {
        if (!resizing.current) return;
        const next = startWidth.current + (moveEvent.clientX - startX.current);
        onWidthChange(Math.min(400, Math.max(220, next)));
      };

      const onUp = () => {
        resizing.current = false;
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [onWidthChange, width],
  );

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  const aside = (
    <aside
      style={isDesktop ? { width: isOpen ? width : 0 } : undefined}
      className={cn(
        "flex shrink-0 flex-col overflow-hidden border-stone-200 transition-all duration-300 ease-out dark:border-stone-800",
        frosted
          ? "bg-white/62 backdrop-blur-xl dark:bg-stone-900/58"
          : "bg-white dark:bg-stone-900",
        isDesktop
          ? "relative border-r"
          : "fixed inset-y-0 left-0 z-50 w-[84vw] max-w-[320px] border-r shadow-float",
        isDesktop
          ? undefined
          : isOpen
            ? "translate-x-0"
            : "-translate-x-full",
      )}
      aria-hidden={!isOpen}
      // 收起时（宽度 0 或移出可视区）禁止键盘 focus 进入，否则 Tab 会跳进看不见的链接
      inert={!isOpen}
    >
      <div className="flex h-full flex-col" style={{ width: isDesktop ? width : undefined }}>
        {/* 博主信息 */}
        <div className="flex items-start gap-3 px-4 pt-4 pb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={withBasePath(SITE.avatarSmall)}
            alt={SITE.author}
            width={44}
            height={44}
            className="h-11 w-11 shrink-0 rounded-full shadow-sm"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-stone-900 dark:text-stone-100">
              {SITE.author}
            </p>
            <p className="truncate text-xs text-stone-500 dark:text-stone-400">
              {SITE.location} · 前端工程师
            </p>
          </div>
          {!isDesktop && (
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭导航栏"
              className="grid h-7 w-7 place-items-center rounded-md text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4">
          {/* 后台写作入口：对应「网页后台直接写作」的核心需求 */}
          <Link
            href="/admin/index.html"
            className="mb-3 flex items-center gap-2 rounded-lg bg-stone-100 px-3 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
          >
            <SquarePen className="h-4 w-4" />
            写文章（TinaCMS 后台）
          </Link>

          <nav className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const Icon = ICONS[item.icon];
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => !isDesktop && onClose()}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-brand-50 font-medium text-brand-700 dark:bg-brand-950/50 dark:text-brand-300"
                      : "text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* 站点统计 */}
          <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-stone-200 p-2.5 text-center dark:border-stone-700">
            {[
              { label: "文章", value: formatCount(stats.posts) },
              { label: "标签", value: formatCount(stats.tags) },
              { label: "字数", value: formatCount(stats.words) },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-sm font-semibold text-stone-800 dark:text-stone-100">{item.value}</p>
                <p className="text-[11px] text-stone-500 dark:text-stone-400">{item.label}</p>
              </div>
            ))}
          </div>

          {/* 最近文章 */}
          {recentPosts.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 px-1 text-[11px] font-medium tracking-wider text-stone-400 uppercase">
                最近文章
              </p>
              <ul className="space-y-0.5">
                {recentPosts.map((post, index) => (
                  <li key={post.slug}>
                    <Link
                      href={`/posts/${post.slug}`}
                      onClick={() => !isDesktop && onClose()}
                      className={cn(
                        "flex items-baseline gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                        pathname === `/posts/${post.slug}`
                          ? "bg-stone-100 text-stone-900 dark:bg-stone-800 dark:text-stone-100"
                          : "text-stone-500 hover:bg-stone-50 hover:text-stone-800 dark:text-stone-400 dark:hover:bg-stone-800/60 dark:hover:text-stone-100",
                      )}
                    >
                      <span className="truncate">{post.title}</span>
                      <span className="ml-auto shrink-0 text-[10px] text-stone-400">
                        {index === 0 ? "最新" : formatDateShort(post.date)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <MusicPlayer tracks={defaultPlaylist} className="mt-5" />
        </div>
      </div>

      {/* 拖拽把手：只在桌面端、且侧栏展开时出现 */}
      {isDesktop && isOpen && (
        <div
          onMouseDown={handleMouseDown}
          role="separator"
          aria-orientation="vertical"
          aria-label="拖拽调整导航栏宽度"
          className="group absolute inset-y-0 right-0 z-10 flex w-3 cursor-col-resize items-center justify-center border-r border-dashed border-stone-300 transition-colors hover:bg-brand-50/70 dark:border-stone-600 dark:hover:bg-brand-950/40"
        >
          <GripVertical className="h-3.5 w-3.5 text-stone-300 transition-colors group-hover:text-brand-500" />
        </div>
      )}
    </aside>
  );

  if (isDesktop) return aside;

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-stone-900/40 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden
        />
      )}
      {aside}
    </>
  );
}

export default Sidebar;
