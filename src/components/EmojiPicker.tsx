"use client";

import { useMemo, useRef, useState } from "react";
import { Check, ImageIcon, LoaderCircle, Smile, Search, X } from "lucide-react";
import { COMMENT_EMOJIS, type EmojiItem } from "@/lib/emojis";
import { SITE, withBasePath } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * 评论区的表情选择面板。
 *
 * 两个 Tab：
 *
 * 1. **GitHub 表情** —— 复制 `:smile:` 这样的短代码。GitHub 评论框认它，
 *    会渲染成 GitHub 自己的 emoji 图（render 出来的样子在所有设备上一致）。
 * 2. **图片表情包** —— 复制 `![名字](图片地址)`。GitHub 会渲染成图片，
 *    这就是「表情包」的入口：换 `public/emojis/` 里的图即可。
 *
 * ## 为什么只能做成「点一下复制」
 *
 * 评论框是 **GitHub 的组件**，跑在 giscus 的跨域 iframe 里 ——
 * 浏览器不让第三方页面读它的 DOM，更别说往输入框里插入内容了。
 * 这是同源策略决定的，不是配置没写对（giscus 官方也没有任何表情相关的选项）。
 * 所以退一步：把表情摆在评论框**旁边**，点一下复制，再粘进评论框。
 */

/** GitHub 表情数据：为了省体积用数组而不是对象，字段都是定长有序的 */
type GitHubRow = readonly [string, string, string, string, number];
interface GitHubData {
  v: number;
  cats: string[];
  list: GitHubRow[];
}

interface StickerRow {
  f: string;
  n: string;
  c: string;
  k: string;
}
interface StickerData {
  v: number;
  list: StickerRow[];
}

/** 图片表情的公开地址必须是绝对 URL：评论是在 github.com 上看的，相对路径取不到图 */
const stickerUrl = (file: string): string =>
  `${SITE.url.replace(/\/$/, "")}${withBasePath(`/emojis/${file}`)}`;

/** 一次最多渲染多少个，超了要点「显示更多」—— 1870 个节点一次性铺开会卡 */
const PAGE_SIZE = 120;

/** 复制成功的提示停留多久 */
const HINT_DURATION = 2000;

export function EmojiPicker({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"github" | "sticker">("github");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const [github, setGithub] = useState<GitHubData | null>(null);
  const [stickers, setStickers] = useState<StickerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  /** 数据只在第一次打开时拉一次，之后靠这两条 ref 挡住重复请求 */
  const loadedRef = useRef(false);

  /** 提示自动消失 */
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = (text: string | null, isError = false) => {
    if (hintTimer.current) clearTimeout(hintTimer.current);
    setCopied(isError ? null : text);
    setFailed(isError);
    hintTimer.current = setTimeout(() => {
      setCopied(null);
      setFailed(false);
    }, HINT_DURATION);
  };

  /**
   * 拉数据。
   *
   * ⚠️ 放在**点击处理里**而不是 effect 里 —— eslint 的 react-compiler 规则
   * 不允许在 effect 里 setState，而「展开面板」天然就是个用户手势。
   */
  const load = async () => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    setLoading(true);
    try {
      const [gRes, sRes] = await Promise.all([
        fetch(withBasePath("/emoji-data.json")),
        fetch(withBasePath("/emojis/index.json")),
      ]);
      if (gRes.ok) setGithub((await gRes.json()) as GitHubData);
      // 图片包可能还没生成（跑过 npm run emoji:pack 才有），缺了就当没有这一页
      if (sRes.ok) setStickers((await sRes.json()) as StickerData);
    } catch {
      // 取不到就保持空：面板会显示「加载失败」，不会连带评论区一起坏掉
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    if (!open) void load();
    setOpen((prev) => !prev);
  };

  /** 换 Tab / 改关键词 / 切分类都要把「显示更多」重置，否则会漏表情 */
  const changeScope = (next: { tab?: typeof tab; category?: number | null; query?: string }) => {
    if (next.tab !== undefined) setTab(next.tab);
    if (next.category !== undefined) setCategory(next.category);
    if (next.query !== undefined) setQuery(next.query);
    setLimit(PAGE_SIZE);
  };

  /* ---------------- 过滤结果 ---------------- */

  const kw = query.trim().toLowerCase();

  const ghFiltered = useMemo<GitHubRow[]>(() => {
    if (!github) return [];
    return github.list.filter((row) => {
      if (category !== null && row[4] !== category) return false;
      if (!kw) return true;
      // row = [字符, 短代码, 显示名, 搜索关键词, 分类]
      return `${row[1]} ${row[2]} ${row[3]}`.toLowerCase().includes(kw);
    });
  }, [github, category, kw]);

  const stickerFiltered = useMemo<StickerRow[]>(() => {
    if (!stickers) return [];
    return stickers.list.filter((row) => {
      if (!kw) return true;
      return `${row.n} ${row.k} ${row.f}`.toLowerCase().includes(kw);
    });
  }, [stickers, kw]);

  const shownGithub = ghFiltered.slice(0, limit);
  const shownStickers = stickerFiltered.slice(0, limit);
  const remain =
    (tab === "github" ? ghFiltered.length : stickerFiltered.length) -
    Math.min(limit, tab === "github" ? ghFiltered.length : stickerFiltered.length);

  /* ---------------- 复制 ---------------- */

  const copy = async (text: string, label: string) => {
    if (!text) return;
    try {
      // 剪贴板 API 只在 https（或 localhost）下可用，http 站点会直接抛错
      await navigator.clipboard.writeText(text);
      flash(label);
    } catch {
      flash(null, true);
    }
  };

  const quickCopy = (item: EmojiItem) =>
    copy(item.image ? `![${item.name}](${item.image})` : (item.char ?? ""), item.name);

  const hasAnyData = Boolean(github?.list.length || stickers?.list.length);

  return (
    <div className={className}>
      {/* 快捷栏：常用几颗永远在手边，省得每次都展开面板 */}
      <div className="mb-2 flex min-w-0 items-center gap-1 overflow-x-auto">
        {COMMENT_EMOJIS.map((item) => (
          <button
            key={item.name}
            type="button"
            onClick={() => void quickCopy(item)}
            title={item.name}
            aria-label={`复制表情：${item.name}`}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-base leading-none transition-colors hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            <span aria-hidden>{item.char}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs text-stone-600 transition-colors hover:bg-stone-50 dark:border-stone-800 dark:text-stone-300 dark:hover:bg-stone-800/60"
      >
        <Smile className="h-3.5 w-3.5" />
        {open ? "收起表情面板" : "更多表情"}
      </button>

      {open && (
        <div className="mt-2 rounded-xl border border-stone-200 bg-white p-2 dark:border-stone-800 dark:bg-stone-900">
          {/* Tab + 搜索 */}
          <div className="mb-2 flex items-center gap-1">
            {(
              [
                ["github", "GitHub 表情", Smile, github?.list.length ?? 0],
                ["sticker", "图片表情包", ImageIcon, stickers?.list.length ?? 0],
              ] as const
            ).map(([id, label, Icon, count]) => (
              <button
                key={id}
                type="button"
                onClick={() => changeScope({ tab: id })}
                aria-pressed={tab === id}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] transition-colors",
                  tab === id
                    ? "bg-brand-50 font-medium text-brand-700 dark:bg-brand-950/60 dark:text-brand-300"
                    : "text-stone-500 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800",
                )}
              >
                <Icon className="h-3 w-3" />
                {label}
                {count > 0 && <span className="text-[10px] opacity-60">{count}</span>}
              </button>
            ))}

            <label className="ml-auto flex min-w-0 flex-1 items-center gap-1 rounded-md border border-stone-200 px-1.5 dark:border-stone-800">
              <Search className="h-3 w-3 shrink-0 text-stone-400" />
              <input
                value={query}
                onChange={(event) => changeScope({ query: event.target.value })}
                placeholder="搜：开心 / lol / 鼓掌"
                aria-label="搜索表情"
                className="min-w-0 flex-1 bg-transparent py-1 text-[11px] outline-none placeholder:text-stone-400"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => changeScope({ query: "" })}
                  aria-label="清空搜索"
                  className="shrink-0 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </label>
          </div>

          {/* 分类筛选（只有 GitHub 表情有分类） */}
          {tab === "github" && github && github.cats.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
              <FilterChip active={category === null} onClick={() => changeScope({ category: null })}>
                全部
              </FilterChip>
              {github.cats.map((label, catIndex) => (
                <FilterChip
                  key={label}
                  active={category === catIndex}
                  onClick={() => changeScope({ category: catIndex })}
                >
                  {label}
                </FilterChip>
              ))}
            </div>
          )}

          {/* 表情网格 */}
          <div className="max-h-56 overflow-y-auto">
            {loading && (
              <p className="flex items-center justify-center gap-1.5 py-8 text-[11px] text-stone-400">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                正在载入表情数据…
              </p>
            )}

            {!loading && !hasAnyData && (
              <p className="py-8 text-center text-[11px] leading-relaxed text-stone-400">
                数据没能载入。先在项目根目录跑
                <br />
                <code>npm run emoji:data</code> 与 <code>npm run emoji:pack</code>
                <br />
                生成 <code>public/emoji-data.json</code> 与 <code>public/emojis/</code>
              </p>
            )}

            {!loading && hasAnyData && tab === "github" && (
              <Grid>
                {shownGithub.map((row) => (
                  <GridButton
                    key={row[1]}
                    onClick={() => void copy(`:${row[1]}:`, row[2])}
                    title={`${row[2]}　:${row[1]}:`}
                    aria-label={`复制表情：${row[2]}`}
                  >
                    <span className="text-lg leading-none" aria-hidden>
                      {row[0]}
                    </span>
                  </GridButton>
                ))}
              </Grid>
            )}

            {!loading && hasAnyData && tab === "sticker" && (
              <Grid>
                {shownStickers.map((row) => (
                  <GridButton
                    key={row.f}
                    onClick={() => void copy(`![${row.n}](${stickerUrl(row.f)})`, row.n)}
                    title={`${row.n}　（点一下复制图片代码）`}
                    aria-label={`复制表情包：${row.n}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={withBasePath(`/emojis/${row.f}`)}
                      alt={row.n}
                      loading="lazy"
                      className="h-6 w-6 object-contain"
                    />
                  </GridButton>
                ))}
                {stickerFiltered.length === 0 && (
                  <p className="col-span-full py-6 text-center text-[11px] leading-relaxed text-stone-400">
                    还没有图片表情包。
                    <br />
                    把图片丢进 <code>public/emojis/</code>，再跑一次{" "}
                    <code>npm run emoji:pack</code> 即可。
                  </p>
                )}
              </Grid>
            )}

            {remain > 0 && (
              <button
                type="button"
                onClick={() => setLimit((prev) => prev + PAGE_SIZE)}
                className="mt-1 w-full rounded-md py-1.5 text-[11px] text-stone-500 transition-colors hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
              >
                显示更多（还有 {remain} 个）
              </button>
            )}
          </div>

          {/* 反馈 */}
          <p className="mt-1.5 min-h-[16px] text-[11px] leading-none">
            {copied && (
              <span className="flex items-center gap-1 text-brand-600 dark:text-brand-400">
                <Check className="h-3 w-3" />
                已复制「{copied}」，去评论框粘贴
              </span>
            )}
            {failed && (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <X className="h-3 w-3" />
                这个浏览器不让复制，请手动选
              </span>
            )}
            {!copied && !failed && (
              <span className="text-stone-400">
                {tab === "github"
                  ? "复制的是 GitHub 短代码，粘进评论框会渲染成图。"
                  : "复制的是图片语法，粘进评论框会渲染成表情包。"}
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-8 gap-0.5 sm:grid-cols-10">{children}</div>;
}

function GridButton({
  onClick,
  title,
  "aria-label": ariaLabel,
  children,
}: {
  onClick: () => void;
  title: string;
  "aria-label": string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      className="grid aspect-square place-items-center overflow-hidden rounded-md transition-colors hover:bg-stone-100 dark:hover:bg-stone-800"
    >
      {children}
    </button>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-md px-1.5 py-0.5 text-[10px] transition-colors",
        active
          ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900"
          : "text-stone-500 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800",
      )}
    >
      {children}
    </button>
  );
}

export default EmojiPicker;
