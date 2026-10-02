import Link from "next/link";
import { Hash } from "lucide-react";
import { cn } from "@/lib/utils";
import { tagToSlug } from "@/lib/tag-slug";

export function TagBadge({
  tag,
  count,
  size = "sm",
  className,
}: {
  tag: string;
  count?: number;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <Link
      href={`/tags/${tagToSlug(tag)}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white font-medium text-stone-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 dark:hover:border-brand-700 dark:hover:bg-brand-950/40 dark:hover:text-brand-300",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs",
        className,
      )}
    >
      <Hash className="h-3 w-3 opacity-60" />
      {tag}
      {typeof count === "number" && (
        <span className="ml-0.5 text-stone-400 dark:text-stone-500">{count}</span>
      )}
    </Link>
  );
}

export default TagBadge;
