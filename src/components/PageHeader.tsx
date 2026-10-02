import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  meta?: ReactNode;
  className?: string;
}

export function PageHeader({ eyebrow, title, description, meta, className }: PageHeaderProps) {
  return (
    <header className={cn("animate-fade-up mb-8", className)}>
      {eyebrow && (
        <p className="mb-1.5 text-xs font-medium tracking-[0.18em] text-brand-500 uppercase">
          {eyebrow}
        </p>
      )}
      <h1 className="text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl dark:text-stone-50">
        {title}
      </h1>
      {description && (
        <p className="mt-3 max-w-2xl leading-relaxed text-stone-500 dark:text-stone-400">
          {description}
        </p>
      )}
      {meta && <div className="mt-4">{meta}</div>}
    </header>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 px-6 py-14 text-center dark:border-stone-700">
      <p className="text-sm font-medium text-stone-600 dark:text-stone-300">{title}</p>
      {description && (
        <p className="mt-1.5 text-xs text-stone-400 dark:text-stone-500">{description}</p>
      )}
    </div>
  );
}

export default PageHeader;
