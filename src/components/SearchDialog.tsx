"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, CornerDownLeft, LoaderCircle, Search, SearchX, X } from "lucide-react";
import { cn, formatDate, formatWordCount } from "@/lib/utils";
import { withBasePath } from "@/lib/site";
import { usePersistentState } from "@/hooks/usePersistentState";
import {
  SEARCH_SORT_LABEL,
  isSearchSort,
  searchEntries,
  tokenize,
  type SearchEntry,
  type SearchSort,
} from "@/lib/search";

export interface SearchDialogProps {
  open: boolean;
  onClose: () => void;
}

/** 把命中的词包进 <mark>，其余原样输出 */
function highlight(text: string, tokens: string[]): React.ReactNode {
  if (tokens.length === 0) return text;

  const lower = text.toLowerCase();
  const ranges: Array<[number, number]> = [];

  for (const token of tokens) {
    let from = 0;
    while (from <= lower.length - token.length) {
      const at = lower.indexOf(token, from);
      if (at === -1) break;
      ranges.push([at, at + token.length]);
      from = at + token.length;
    }
  }
  if (ranges.length === 0) return text;

  // 合并重叠区间，避免出现嵌套的 <mark>
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  merged.forEach(([start, end], index) => {
    if (start > cursor) nodes.push(text.slice(cursor, start));
    nodes.push(
      <mark
        key={`${start}-${index}`}
        className="rounded bg-brand-100 px-0.5 text-brand-800 dark:bg-brand-900/70 dark:text-brand-200"
      >
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  });
  if (cursor < text.length) nodes.push(text.slice(cursor));

  return nodes;
}

const INDEX_URL = withBasePath("/search-index.json");

/** 索引只在第一次打开搜索时下载，之后缓存在模块作用域里 */
let indexCache: SearchEntry[] | null = null;
let indexPromise: Promise<SearchEntry[]> | null = null;

function loadIndex(): Promise<SearchEntry[]> {
  if (indexCache) return Promise.resolve(indexCache);
  indexPromise ??= fetch(INDEX_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json() as Promise<{ entries: SearchEntry[] }>;
    })
    .then((data) => {
      indexCache = data.entries ?? [];
      return indexCache;
    })
    .catch((error: unknown) => {
      indexPromise = null;
      throw error;
    });
  return indexPromise;
}

/**
 * 站内搜索弹窗。
 *
 * 索引是构建期生成的静态 JSON，全部匹配都在浏览器里完成，
 * 所以没有任何后端请求，输入也不会卡顿。
 *
 * 快捷键：⌘K / Ctrl+K 打开，Esc 关闭，↑↓ 选择，Enter 进入。
 *
 * 结构上刻意拆成「外壳 + 内部面板」：外壳在关闭时直接不渲染内部组件，
 * 于是查询词、选中项这些状态会随着卸载自然清空 ——
 * 比在 effect 里手动 setState 重置更干净（也不会触发
 * react-hooks/set-state-in-effect 规则）。
 */
export function SearchDialog({ open, onClose }: SearchDialogProps) {
  if (!open) return null;
  return <SearchPanel onClose={onClose} />;
}

function SearchPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [entries, setEntries] = useState<SearchEntry[]>(indexCache ?? []);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    indexCache ? "ready" : "loading",
  );
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [sort, setSort] = usePersistentState<SearchSort>("hc-blog:search-sort", "relevance", isSearchSort);

  /* 懒加载索引：只在 Promise 回调里 setState */
  useEffect(() => {
    if (indexCache) return;
    let cancelled = false;

    loadIndex()
      .then((loaded) => {
        if (cancelled) return;
        setEntries(loaded);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /* 挂载后聚焦输入框（纯 DOM 副作用，不涉及 setState） */
  useEffect(() => {
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, []);

  const tokens = useMemo(() => tokenize(query), [query]);
  const outcome = useMemo(
    () =>
      query.trim()
        ? searchEntries(entries, query, { sort })
        : { hits: [], mode: "all" as const },
    [entries, query, sort],
  );
  const results = outcome.hits;

  // 结果变少时把选中项夹回有效范围，避免越界（不需要额外 effect）
  const activeIndex = results.length > 0 ? Math.min(active, results.length - 1) : 0;

  const go = useCallback(
    (slug: string) => {
      onClose();
      router.push(`/posts/${slug}`);
    },
    [onClose, router],
  );

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (results.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((activeIndex + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((activeIndex - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const hit = results[activeIndex];
      if (hit) go(hit.slug);
    }
  };

  return (
    <div
      className="fixed inset-0 z-90 flex items-start justify-center px-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="站内搜索"
    >
      <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm" onClick={onClose} aria-hidden />

      <div className="animate-fade-up relative w-full max-w-xl overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-float dark:border-stone-700 dark:bg-stone-900">
        {/* 输入区 */}
        <div className="flex items-center gap-2 border-b border-stone-200 px-4 dark:border-stone-700">
          <Search className="h-4 w-4 shrink-0 text-stone-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="搜索文章标题、标签或正文…"
            aria-label="搜索关键词"
            className="h-12 min-w-0 flex-1 bg-transparent text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none dark:text-stone-100"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setActive(0);
                inputRef.current?.focus();
              }}
              aria-label="清空"
              className="grid h-6 w-6 shrink-0 place-items-center rounded text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded border border-stone-200 px-1.5 py-0.5 font-mono text-[10px] text-stone-400 dark:border-stone-700"
            aria-label="关闭搜索"
          >
            Esc
          </button>
        </div>

        {/* 结果区 */}
        <div className="max-h-[52vh] overflow-y-auto">
          {status === "loading" && (
            <p className="flex items-center justify-center gap-2 px-4 py-8 text-xs text-stone-400">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              正在加载搜索索引…
            </p>
          )}

          {status === "error" && (
            <p className="px-4 py-8 text-center text-xs leading-relaxed text-amber-600 dark:text-amber-400">
              搜索索引加载失败。
              <br />
              如果站点部署在子路径下，请确认构建时设置了 <code>NEXT_PUBLIC_BASE_PATH</code>。
            </p>
          )}

          {status === "ready" && !query.trim() && (
            <p className="px-4 py-8 text-center text-xs leading-relaxed text-stone-400">
              输入关键词开始搜索，共收录 {entries.length} 篇文章。
              <br />
              中文建议用较短的词；多个词用空格分隔，默认要求**全部命中**。
            </p>
          )}

          {status === "ready" && query.trim() && results.length === 0 && (
            <p className="flex flex-col items-center gap-2 px-4 py-8 text-center text-xs leading-relaxed text-stone-400">
              <SearchX className="h-5 w-5" />
              没有找到匹配「{query.trim()}」的文章
              <span className="text-[11px]">
                试试更短的关键词，或者换一个说法
              </span>
            </p>
          )}

          {results.length > 0 && outcome.mode === "partial" && (
            <p className="border-b border-stone-100 bg-amber-50/70 px-4 py-2 text-[11px] leading-relaxed text-amber-700 dark:border-stone-800 dark:bg-amber-950/30 dark:text-amber-300">
              没有同时包含全部关键词的文章，以下是<strong>部分匹配</strong>的结果（匹配越多越靠前）。
            </p>
          )}

          {/* 排序切换：出现结果后才需要 */}
          {results.length > 1 && (
            <div className="flex items-center gap-1 border-b border-stone-100 px-3 py-1.5 dark:border-stone-800">
              <span className="mr-1 text-[10px] text-stone-400">排序</span>
              {(Object.keys(SEARCH_SORT_LABEL) as SearchSort[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setSort(option);
                    setActive(0);
                  }}
                  aria-pressed={sort === option}
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-[10px] transition-colors",
                    sort === option
                      ? "bg-brand-50 font-medium text-brand-600 dark:bg-brand-950/60 dark:text-brand-300"
                      : "text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200",
                  )}
                >
                  {SEARCH_SORT_LABEL[option]}
                </button>
              ))}
            </div>
          )}

          {results.length > 0 && (
            <ul className="p-2">
              {results.map((hit, hitIndex) => (
                <li key={hit.slug}>
                  <Link
                    href={`/posts/${hit.slug}`}
                    onClick={onClose}
                    onMouseEnter={() => setActive(hitIndex)}
                    className={cn(
                      "block rounded-lg px-3 py-2.5 transition-colors",
                      hitIndex === activeIndex
                        ? "bg-brand-50 dark:bg-brand-950/50"
                        : "hover:bg-stone-50 dark:hover:bg-stone-800/60",
                    )}
                  >
                    <p className="flex items-center gap-2 text-sm font-medium text-stone-800 dark:text-stone-100">
                      <span className="min-w-0 flex-1">{highlight(hit.title, tokens)}</span>
                      <span className="shrink-0 text-[10px] font-normal text-stone-400">
                        {formatDate(hit.date)} · {formatWordCount(hit.wordCount)}
                      </span>
                    </p>

                    <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-stone-500 dark:text-stone-400">
                      {highlight(hit.snippet, tokens)}
                    </p>

                    {hit.tags.length > 0 && (
                      <p className="mt-1 flex flex-wrap gap-1">
                        {hit.tags.map((tag) => (
                          <span
                            key={tag}
                            className={cn(
                              "rounded-full px-1.5 py-0.5 text-[10px]",
                              tokens.some((token) => tag.toLowerCase().includes(token))
                                ? "bg-brand-100 text-brand-700 dark:bg-brand-900/70 dark:text-brand-200"
                                : "bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400",
                            )}
                          >
                            #{tag}
                          </span>
                        ))}
                      </p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 底部快捷键提示 */}
        <div className="flex items-center gap-3 border-t border-stone-200 px-4 py-2 text-[10px] text-stone-400 dark:border-stone-700">
          <span className="flex items-center gap-1">
            <ArrowUp className="h-3 w-3" />
            <ArrowDown className="h-3 w-3" />
            选择
          </span>
          <span className="flex items-center gap-1">
            <CornerDownLeft className="h-3 w-3" />
            打开
          </span>
          {results.length > 0 && <span className="ml-auto">{results.length} 条结果</span>}
        </div>
      </div>
    </div>
  );
}

export default SearchDialog;
