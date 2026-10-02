import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface MdxContentProps {
  children: ReactNode;
  className?: string;
}

/**
 * MDX 内容渲染容器。
 *
 * 编译本身交给 `@next/mdx`（见 next.config.ts 与 src/mdx-components.tsx），
 * 这个组件只负责套上文章正文的排版样式（.article，定义在 globals.css）。
 *
 * ```tsx
 * const { default: Post } = await import(`@/content/posts/${slug}.mdx`);
 * return <MdxContent><Post /></MdxContent>;
 * ```
 */
export function MdxContent({ children, className }: MdxContentProps) {
  return <div className={cn("article", className)}>{children}</div>;
}

export default MdxContent;
