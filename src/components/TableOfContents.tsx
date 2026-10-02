import { List } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TocItem } from "@/lib/posts";

/** 文章目录。用原生 <details> 实现折叠，不依赖任何客户端 JS */
export function TableOfContents({ items, className }: { items: TocItem[]; className?: string }) {
  if (items.length < 2) return null;

  return (
    <nav
      aria-label="文章目录"
      className={cn(
        "rounded-xl border border-stone-200 bg-white px-4 py-3 dark:border-stone-800 dark:bg-stone-900",
        className,
      )}
    >
      <details open>
        <summary className="flex cursor-pointer items-center gap-1.5 text-sm font-medium text-stone-700 select-none dark:text-stone-200">
          <List className="h-3.5 w-3.5 text-brand-500" />
          本文目录
          <span className="ml-1 text-xs font-normal text-stone-400">{items.length} 节</span>
        </summary>
        <ol className="mt-2.5 space-y-1 border-l border-stone-200 pl-3 dark:border-stone-700">
          {items.map((item) => (
            <li key={item.id} className={item.depth === 3 ? "pl-3" : undefined}>
              <a
                href={`#${item.id}`}
                className="block text-[13px] leading-relaxed text-stone-500 transition-colors hover:text-brand-600 dark:text-stone-400 dark:hover:text-brand-400"
              >
                {item.text}
              </a>
            </li>
          ))}
        </ol>
      </details>
    </nav>
  );
}

export default TableOfContents;
