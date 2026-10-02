import type { ReactNode } from "react";
import { Info, Lightbulb, OctagonAlert, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

type CalloutType = "info" | "tip" | "warning" | "danger";

const styles: Record<CalloutType, { wrap: string; icon: string; label: string; Icon: typeof Info }> = {
  info: {
    wrap: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200",
    icon: "text-sky-500",
    label: "说明",
    Icon: Info,
  },
  tip: {
    wrap: "border-jade-400/40 bg-jade-400/10 text-jade-600 dark:border-jade-500/40 dark:text-jade-400",
    icon: "text-jade-500",
    label: "提示",
    Icon: Lightbulb,
  },
  warning: {
    wrap: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
    icon: "text-amber-500",
    label: "注意",
    Icon: TriangleAlert,
  },
  danger: {
    wrap: "border-brand-300 bg-brand-50 text-brand-800 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-200",
    icon: "text-brand-500",
    label: "警告",
    Icon: OctagonAlert,
  },
};

export interface CalloutProps {
  type?: CalloutType;
  title?: string;
  children: ReactNode;
}

/** MDX 里的提示框：`<Callout type="tip" title="小技巧">…</Callout>` */
export function Callout({ type = "info", title, children }: CalloutProps) {
  const style = styles[type] ?? styles.info;
  const { Icon } = style;

  return (
    <div className={cn("my-6 flex gap-3 rounded-xl border px-4 py-3.5 text-sm", style.wrap)}>
      <Icon className={cn("mt-0.5 h-4.5 w-4.5 shrink-0", style.icon)} aria-hidden />
      <div className="min-w-0 flex-1 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
        <p className="mb-1 font-semibold">{title ?? style.label}</p>
        <div className="leading-relaxed [&_a]:underline [&_code]:rounded [&_code]:bg-black/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em] dark:[&_code]:bg-white/10">
          {children}
        </div>
      </div>
    </div>
  );
}

export default Callout;
