"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GripHorizontal, Mic2, Palette, RotateCcw, X } from "lucide-react";
import { isBoolean, isNumber, isString, usePersistentState } from "@/hooks/usePersistentState";
import { findActiveLine, parseLrc, type LyricSheet } from "@/lib/lyrics";
import { cn } from "@/lib/utils";

/**
 * 悬浮歌词窗。
 *
 * 三个刻意的设计选择：
 *
 * 1. **用 `createPortal` 挂到 `document.body`**，而不是就地 `position: fixed`。
 *    侧栏在有壁纸时会加 `backdrop-blur-xl`，移动端抽屉有 `translate-x-*` ——
 *    这两个都会给 `fixed` 子元素创建**包含块**，就地渲染的话歌词窗会被定位到
 *    侧栏内部并被 `overflow-hidden` 裁掉。挂到 body 上才真正是「贴着视口」。
 *
 * 2. **位置用 right / bottom 存**，不用 left / top。
 *    这样默认值（`{ right: 24, bottom: 24 }`）不需要先量视口宽高 ——
 *    否则就得在 effect 里读 `window.innerWidth` 再 setState 回写，
 *    那是 React 19 明确禁止的「effect 里同步 setState」。
 *
 * 3. **自动滚动用 `transform` 平移整段歌词，而不是 `scrollTo`**。
 *    `scrollTo` 是「跳到某一行」，看着是断续的；`transform` + CSS transition
 *    是真正的连续滚动。位移量直接写进 DOM style，**不进 React state** ——
 *    每句歌词都 setState 一次太浪费，而且 effect 里 setState 会被 lint 拦。
 */

export interface LyricBox {
  /** 距视口右边的距离，px */
  right: number;
  /** 距视口下边的距离，px */
  bottom: number;
  width: number;
  height: number;
}

const LYRIC_BOX_KEY = "hc-blog:lyrics-box";

/** 默认贴着右下角浮着 */
const DEFAULT_LYRIC_BOX: LyricBox = { right: 24, bottom: 24, width: 300, height: 260 };

const MIN_WIDTH = 240;
const MIN_HEIGHT = 180;
const MAX_WIDTH = 560;
const MAX_HEIGHT = 560;
/** 留出边距，免得拖到屏幕外找不回来 */
const MARGIN = 8;

function clampBox(box: LyricBox): LyricBox {
  const width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, box.width));
  const height = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, box.height));
  const maxRight = Math.max(MARGIN, window.innerWidth - width - MARGIN);
  const maxBottom = Math.max(MARGIN, window.innerHeight - height - MARGIN);
  return {
    width,
    height,
    right: Math.min(maxRight, Math.max(MARGIN, box.right)),
    bottom: Math.min(maxBottom, Math.max(MARGIN, box.bottom)),
  };
}

function isLyricBox(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const box = value as LyricBox;
  return (
    typeof box.right === "number" &&
    typeof box.bottom === "number" &&
    typeof box.width === "number" &&
    typeof box.height === "number"
  );
}

/* ------------------------------------------------------------------ */
/* 外观：字号与配色                                                     */
/* ------------------------------------------------------------------ */

/** `theme` 表示跟着站点深浅色走，颜色交给 Tailwind 的类名 */
export type LyricTheme = "theme" | "light" | "dark" | "custom";

export interface LyricStyle {
  /** 歌词字号，px */
  fontSize: number;
  theme: LyricTheme;
  /** 正文颜色（theme === "custom" 时生效） */
  textColor: string;
  /** 当前句的颜色 */
  activeColor: string;
  /** 背景板颜色 */
  bgColor: string;
  /** 背景不透明度 0–100，0 就是完全透明（只剩文字浮在壁纸上） */
  bgAlpha: number;
  /** 鼠标移开后整块变全透明，移回来再显示 */
  autoHide: boolean;
}

const LYRIC_STYLE_KEY = "hc-blog:lyrics-style";

/** 改颜色前先给一套能看的默认值，省得自定义面板一开始是全黑 */
const DEFAULT_LYRIC_STYLE: LyricStyle = {
  fontSize: 13,
  theme: "theme",
  textColor: "#57534e",
  activeColor: "#c2410c",
  bgColor: "#ffffff",
  bgAlpha: 92,
  autoHide: true,
};

const FONT_MIN = 10;
const FONT_MAX = 24;

/** 两套现成配色，不想一个个调色就选它（只管颜色，不管字号与自动隐藏） */
const PRESET_COLORS: Record<
  "light" | "dark",
  Omit<LyricStyle, "fontSize" | "theme" | "autoHide">
> = {
  light: { textColor: "#57534e", activeColor: "#c2410c", bgColor: "#ffffff", bgAlpha: 92 },
  // 正文色要够实：背景拉到全透明时，歌词是浮在壁纸上的，太浅会看不清
  dark: { textColor: "#d6d3d1", activeColor: "#fbbf24", bgColor: "#1c1917", bgAlpha: 92 },
};

function isLyricStyle(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const style = value as LyricStyle;
  return (
    isNumber(style.fontSize) &&
    (style.theme === "theme" ||
      style.theme === "light" ||
      style.theme === "dark" ||
      style.theme === "custom") &&
    isString(style.textColor) &&
    isString(style.activeColor) &&
    isString(style.bgColor) &&
    isNumber(style.bgAlpha) &&
    // autoHide 是后加的字段：老数据里没有，宽松放行，读取时按默认处理
    (isBoolean(style.autoHide) || style.autoHide === undefined)
  );
}

/** `#rrggbb` → `rgba(...)`，背景要能调透明度 */
function withAlpha(hex: string, alphaPercent: number): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return hex;
  const value = parseInt(match[1], 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alphaPercent / 100})`;
}

/** 把「主题 + 自定义」解析成一组实际要用的颜色；返回 null 表示跟随站点主题 */
function resolveColors(style: LyricStyle) {
  if (style.theme === "theme") return null;
  if (style.theme === "custom") {
    return {
      text: style.textColor,
      active: style.activeColor,
      bg: style.bgColor,
      alpha: style.bgAlpha,
    };
  }
  const preset = PRESET_COLORS[style.theme];
  return { text: preset.textColor, active: preset.activeColor, bg: preset.bgColor, alpha: preset.bgAlpha };
}

/* ------------------------------------------------------------------ */
/* 组件                                                                */
/* ------------------------------------------------------------------ */

type LyricStatus = "empty" | "loading" | "ready" | "error";

type DragMode = "move" | "resize";

export interface LyricsPanelProps {
  /** 歌词地址（`.lrc`）；**留空是正常的** —— 会显示「还没有歌词」 */
  src?: string;
  title: string;
  artist: string;
  /** 当前播放时间，秒 */
  currentTime: number;
  /** 点某一行时跳到那个时间点（可选） */
  onSeek?: (time: number) => void;
  onClose: () => void;
}

export function LyricsPanel({
  src,
  title,
  artist,
  currentTime,
  onSeek,
  onClose,
}: LyricsPanelProps) {
  const [box, setBox] = usePersistentState<LyricBox>(
    LYRIC_BOX_KEY,
    DEFAULT_LYRIC_BOX,
    isLyricBox,
  );
  const [style, setStyle] = usePersistentState<LyricStyle>(
    LYRIC_STYLE_KEY,
    DEFAULT_LYRIC_STYLE,
    isLyricStyle,
  );
  const [panelOpen, setPanelOpen] = useState(false);
  const [hovering, setHovering] = useState(false);

  // 初始值直接由 props 决定，所以不需要在 effect 里再 setState 一次
  const [status, setStatus] = useState<LyricStatus>(src ? "loading" : "empty");
  const [sheet, setSheet] = useState<LyricSheet | null>(null);

  // 老数据可能没有 autoHide 这个字段
  const autoHide = style.autoHide ?? true;

  /**
   * 刚打开时先亮 2 秒，之后交给鼠标决定。
   *
   * 为什么要这一下：鼠标不在面板上时是不会触发 `mouseleave` 的，
   * 只靠 hover 状态的话窗口一打开就是透明的（鼠标多半还在播放器上）。
   */
  const [awake, setAwake] = useState(true);
  useEffect(() => {
    if (!autoHide) return;
    const timer = setTimeout(() => setAwake(false), 2200);
    return () => clearTimeout(timer);
  }, [autoHide]);

  const visible = !autoHide || awake || hovering;

  useEffect(() => {
    if (!src) return;
    let cancelled = false;

    void fetch(src)
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.text();
      })
      .then((text) => {
        if (cancelled) return;
        setSheet(parseLrc(text));
        setStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [src]);

  const lines = sheet?.lines ?? [];
  const active = findActiveLine(lines, currentTime);

  const colors = resolveColors(style);

  /* ---------------- 拖动与缩放 ---------------- */

  const drag = useRef<{ mode: DragMode; x: number; y: number; from: LyricBox } | null>(null);

  const startDrag = useCallback(
    (mode: DragMode) => (event: React.PointerEvent) => {
      // 标题栏里的按钮不该触发拖动
      if ((event.target as HTMLElement).closest("button")) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { mode, x: event.clientX, y: event.clientY, from: box };
    },
    [box],
  );

  const onDragMove = useCallback(
    (event: React.PointerEvent) => {
      const state = drag.current;
      if (!state) return;
      const dx = event.clientX - state.x;
      const dy = event.clientY - state.y;

      // move：整块跟着指针走（right / bottom 变小 = 往右 / 往下）
      // resize：右下角把手跟着指针走，同时**保持左上角不动** ——
      //         因为盒子是靠 right / bottom 定位的，所以 right 减多少，width 就得加多少
      setBox(
        state.mode === "move"
          ? clampBox({ ...state.from, right: state.from.right - dx, bottom: state.from.bottom - dy })
          : clampBox({
              ...state.from,
              right: state.from.right - dx,
              bottom: state.from.bottom - dy,
              width: state.from.width + dx,
              height: state.from.height + dy,
            }),
      );
    },
    [setBox],
  );

  const endDrag = useCallback(() => {
    drag.current = null;
  }, []);

  /* ---------------- 自动滚动 ---------------- */

  const viewportRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const lineRefs = useRef<Array<HTMLLIElement | null>>([]);

  /**
   * 整段歌词平移，让当前这句停在视口中间。
   *
   * 直接写 `listRef.current.style.transform`，不用 setState ——
   * 歌词随时间一秒变好几次，走 React 状态既浪费又会被 lint 规则拦。
   */
  const applyScroll = useCallback(() => {
    const viewport = viewportRef.current;
    const list = listRef.current;
    if (!viewport || !list) return;

    const line = lineRefs.current[active];
    const target = line
      ? line.offsetTop - viewport.clientHeight / 2 + line.clientHeight / 2
      : 0;

    list.style.transform = `translateY(${-Math.max(0, target)}px)`;
  }, [active]);

  // active 变化、窗口大小变化、盒子被拖动缩放时都要重算
  useEffect(() => {
    applyScroll();
    window.addEventListener("resize", applyScroll);
    return () => window.removeEventListener("resize", applyScroll);
  }, [applyScroll, box.width, box.height, style.fontSize]);

  /* ---------------- 外观调整 ---------------- */

  const patchStyle = useCallback(
    (patch: Partial<LyricStyle>) => {
      setStyle((prev) => ({ ...prev, ...patch }));
    },
    [setStyle],
  );

  /** 切到自定义配色时，用当前正在显示的颜色打底，别跳回默认值 */
  const switchTo = useCallback(
    (theme: LyricTheme) => {
      setStyle((prev) => {
        if (theme !== "custom") return { ...prev, theme };
        // 用当前正在显示的颜色打底，别跳回默认值
        const shown = resolveColors(prev);
        const light = PRESET_COLORS.light;
        return {
          ...prev,
          theme: "custom",
          textColor: shown?.text ?? light.textColor,
          activeColor: shown?.active ?? light.activeColor,
          bgColor: shown?.bg ?? light.bgColor,
          bgAlpha: shown?.alpha ?? light.bgAlpha,
        };
      });
    },
    [setStyle],
  );

  const resetStyle = useCallback(() => {
    setStyle({ ...DEFAULT_LYRIC_STYLE, fontSize: style.fontSize });
  }, [setStyle, style.fontSize]);

  /* ---------------- 渲染 ---------------- */

  // SSR（静态导出）时没有 document；组件只在客户端挂载后才可能出现
  if (typeof document === "undefined") return null;

  const panelBackground = colors ? withAlpha(colors.bg, colors.alpha) : undefined;

  return createPortal(
    <section
      aria-label={`歌词：${title}`}
      style={{
        right: box.right,
        bottom: box.bottom,
        width: box.width,
        height: box.height,
        // 鼠标移开时只撤掉背景板，歌词文字始终可见（见 visible 的处理）
        backgroundColor: visible ? panelBackground : "transparent",
        color: colors?.text,
      }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onTouchStart={() => setHovering(true)}
      className={cn(
        "fixed z-[60] flex max-h-[calc(100vh-16px)] max-w-[calc(100vw-16px)] flex-col overflow-hidden rounded-2xl",
        // 装饰（边框 / 阴影 / 毛玻璃）只在有鼠标时显示；歌词本身不在这层，不受影响
        visible && "border border-stone-200 shadow-float backdrop-blur-xl dark:border-stone-700",
        !colors && visible && "bg-white/92 dark:bg-stone-900/92",
      )}
    >
      {/* 标题栏：拖动区 */}
      <header
        onPointerDown={startDrag("move")}
        onPointerMove={onDragMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{ touchAction: "none" }}
        className={cn(
          visible ? "flex" : "hidden",
          "cursor-grab items-center gap-1.5 border-b border-stone-200 px-2.5 py-1.5 active:cursor-grabbing dark:border-stone-700",
          colors && "border-white/15",
        )}
      >
        <GripHorizontal className="h-3.5 w-3.5 shrink-0 text-stone-300" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className={cn("truncate text-[11px] font-medium", !colors && "text-stone-800 dark:text-stone-100")}>
            {title}
          </p>
          <p className={cn("truncate text-[10px]", !colors && "text-stone-500 dark:text-stone-400")}>
            {artist}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setBox(clampBox(DEFAULT_LYRIC_BOX))}
          title="恢复默认位置与大小"
          aria-label="恢复默认位置与大小"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200"
        >
          <RotateCcw className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={onClose}
          title="关闭歌词窗"
          aria-label="关闭歌词窗"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </header>

      {/* 歌词区：自动滚动的视口 */}
      <div ref={viewportRef} className="relative min-h-0 flex-1 overflow-hidden">
        {status === "loading" && (
          <p className="grid h-full place-items-center px-4 text-center text-[11px] text-stone-400">
            歌词载入中…
          </p>
        )}

        {status === "error" && (
          <p className="grid h-full place-items-center px-4 text-center text-[11px] text-amber-600 dark:text-amber-400">
            歌词加载失败，检查 <code>public/lyrics/</code> 里有没有这个文件
          </p>
        )}

        {status === "empty" && (
          <div className="grid h-full place-items-center gap-1.5 px-4 text-center">
            <p className={cn("flex items-center gap-1.5 text-[11px] font-medium", !colors && "text-stone-600 dark:text-stone-300")}>
              <Mic2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
              这首歌还没有歌词
            </p>
            <p className="text-[10px] leading-relaxed text-stone-400">
              把 <code>&lt;id&gt;.lrc</code> 放进 <code>public/lyrics/</code>，
              <br />
              再跑 <code>npm run lyrics</code> 登记
            </p>
          </div>
        )}

        {status === "ready" && sheet && sheet.lines.length > 0 && (
          <ol
            ref={listRef}
            style={{
              fontSize: `${style.fontSize}px`,
              // 关键：连续平移而不是跳行
              transition: "transform 450ms cubic-bezier(0.22, 0.61, 0.36, 1)",
            }}
            className="absolute inset-x-0 top-0 space-y-2 px-3 py-3 text-center will-change-transform"
          >
            {sheet.lines.map((line, index) => {
              const isActive = index === active;
              return (
                <li
                  key={`${index}-${line.time}`}
                  ref={(element) => {
                    lineRefs.current[index] = element;
                  }}
                >
                  <button
                    type="button"
                    disabled={!onSeek}
                    onClick={() => onSeek?.(line.time)}
                    title={onSeek ? "跳到这一句" : undefined}
                    // ⚠️ 别给非当前句加 opacity —— 那样整段歌词会发虚、看不清。
                    // 层次感靠**颜色**做：当前句用高亮色 + 字重，其余用正文色。
                    // 注意 active / text 都得在这里给：inline style 会盖掉容器上的正文色，
                    // 漏掉 text 的话自定义配色下每一行都会变成高亮色。
                    style={colors ? { color: isActive ? colors.active : colors.text } : undefined}
                    className={cn(
                      "mx-auto block max-w-full rounded-md px-1.5 py-0.5 leading-relaxed transition-colors duration-300",
                      isActive ? "font-semibold" : "font-normal",
                      !colors &&
                        (isActive
                          ? "text-brand-600 dark:text-brand-300"
                          : "text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100"),
                      onSeek && "cursor-pointer",
                    )}
                  >
                    {line.text || "♪"}
                  </button>
                </li>
              );
            })}
          </ol>
        )}

        {/* 没有时间轴的纯文本歌词：整段显示，不滚动也不高亮 */}
        {status === "ready" && sheet && sheet.lines.length === 0 && (
          <div className="h-full overflow-y-auto px-4 py-3">
            <p
              style={{ fontSize: `${style.fontSize}px` }}
              className="whitespace-pre-wrap text-center leading-relaxed"
            >
              {sheet.plainText || "这个歌词文件是空的"}
            </p>
          </div>
        )}

        {/* 配色面板：浮在歌词上，不撑高窗口（鼠标移开时收起，避免挡住歌词） */}
        {panelOpen && visible && (
          <div
            className={cn(
              "absolute inset-0 space-y-2 overflow-y-auto p-2.5 text-[10px]",
              colors ? "bg-black/25" : "bg-white/95 dark:bg-stone-900/95",
            )}
          >
            <div>
              <p className="mb-1 opacity-70">配色</p>
              <div className="flex gap-1">
                {(
                  [
                    ["theme", "跟随主题"],
                    ["light", "浅色"],
                    ["dark", "深色"],
                    ["custom", "自定义"],
                  ] as Array<[LyricTheme, string]>
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => switchTo(value)}
                    aria-pressed={style.theme === value}
                    className={cn(
                      "flex-1 rounded px-1 py-1 transition-colors",
                      style.theme === value
                        ? "bg-brand-500 text-white"
                        : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {style.theme === "custom" && (
              <>
                {(
                  [
                    ["正文", "textColor"],
                    ["当前句", "activeColor"],
                    ["背景板", "bgColor"],
                  ] as Array<[string, "textColor" | "activeColor" | "bgColor"]>
                ).map(([label, key]) => (
                  <label key={key} className="flex items-center gap-2">
                    <span className="w-10 shrink-0 opacity-70">{label}</span>
                    <input
                      type="color"
                      value={style[key]}
                      onChange={(event) => patchStyle({ [key]: event.target.value })}
                      className="h-6 w-9 shrink-0 cursor-pointer rounded border border-stone-300 bg-transparent dark:border-stone-600"
                    />
                    <span className="font-mono opacity-60">{style[key]}</span>
                  </label>
                ))}

                <label className="flex items-center gap-2">
                  <span className="w-10 shrink-0 opacity-70">不透明</span>
                  <input
                    type="range"
                    // 0 = 背景板完全透明，只剩文字浮在壁纸上
                    min={0}
                    max={100}
                    value={style.bgAlpha}
                    onChange={(event) => patchStyle({ bgAlpha: Number(event.target.value) })}
                    className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-stone-300 accent-brand-500 dark:bg-stone-600"
                  />
                  <span className="w-7 shrink-0 text-right font-mono opacity-60">
                    {style.bgAlpha}
                  </span>
                </label>
              </>
            )}

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoHide}
                onChange={(event) => patchStyle({ autoHide: event.target.checked })}
                className="h-3 w-3 shrink-0 accent-brand-500"
              />
              <span className="opacity-70">鼠标移开后只留歌词、收起控制条（移回来显示）</span>
            </label>

            <button
              type="button"
              onClick={resetStyle}
              className="w-full rounded bg-stone-100 py-1 text-stone-600 transition-colors hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300"
            >
              恢复默认配色
            </button>
          </div>
        )}
      </div>

      {/* 底部工具条：字号 + 配色（鼠标移开时收起，只留歌词） */}
      <footer
        className={cn(
          visible ? "flex" : "hidden",
          "items-center gap-1 border-t border-stone-200 px-2 py-1 dark:border-stone-700",
          colors && "border-white/15",
        )}
      >
        <button
          type="button"
          onClick={() => patchStyle({ fontSize: Math.max(FONT_MIN, style.fontSize - 1) })}
          title="缩小字号"
          aria-label="缩小字号"
          className="grid h-5 w-5 shrink-0 place-items-center rounded text-[10px] text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200"
        >
          A−
        </button>
        <span className="w-8 shrink-0 text-center font-mono text-[10px] opacity-60">
          {style.fontSize}
        </span>
        <button
          type="button"
          onClick={() => patchStyle({ fontSize: Math.min(FONT_MAX, style.fontSize + 1) })}
          title="放大字号"
          aria-label="放大字号"
          className="grid h-5 w-5 shrink-0 place-items-center rounded text-[11px] text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200"
        >
          A+
        </button>

        <span className="flex-1" />

        <button
          type="button"
          onClick={() => setPanelOpen((prev) => !prev)}
          title="配色"
          aria-label="配色"
          aria-expanded={panelOpen}
          className={cn(
            "grid h-5 w-5 shrink-0 place-items-center rounded transition-colors",
            panelOpen
              ? "bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-300"
              : "text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200",
          )}
        >
          <Palette className="h-3 w-3" />
        </button>
      </footer>

      {/* 右下角缩放把手 */}
      <div
        onPointerDown={startDrag("resize")}
        onPointerMove={onDragMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{ touchAction: "none" }}
        role="separator"
        aria-label="拖拽调整歌词窗大小"
        className={cn(
          visible ? "grid" : "hidden",
          "group absolute right-0 bottom-0 z-10 h-4 w-4 cursor-nwse-resize place-items-center",
        )}
      >
        <span
          aria-hidden
          className="block h-2.5 w-2.5 translate-x-[-2px] translate-y-[-2px] rounded-br-sm border-r-2 border-b-2 border-stone-300 transition-colors group-hover:border-brand-500"
        />
      </div>
    </section>,
    document.body,
  );
}

export default LyricsPanel;
