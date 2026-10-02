import type { MDXComponents } from "mdx/types";
import type { AnchorHTMLAttributes, ImgHTMLAttributes, ReactNode } from "react";
import { AudioPlayer } from "@/components/AudioPlayer";
import { BilibiliVideo } from "@/components/BilibiliVideo";
import { Callout } from "@/components/Callout";

type HeadingProps = {
  id?: string;
  children?: ReactNode;
  className?: string;
};

/** 带悬停锚点的标题：id 由 rehype-slug 提供，与 posts.ts 的目录保持一致 */
function createHeading(level: 2 | 3 | 4) {
  const Tag = `h${level}` as const;

  return function Heading({ id, children, className, ...rest }: HeadingProps) {
    return (
      <Tag id={id} className={className} {...rest}>
        {children}
        {id ? (
          <a href={`#${id}`} className="heading-anchor" aria-label="本节锚点链接">
            #
          </a>
        ) : null}
      </Tag>
    );
  };
}

function MdxLink({ href = "", children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const isExternal = /^https?:\/\//.test(href);

  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
        {children}
      </a>
    );
  }

  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}

function MdxImage({ src = "", alt = "", ...rest }: ImgHTMLAttributes<HTMLImageElement>) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} loading="lazy" decoding="async" {...rest} />
  );
}

function MdxTable({ children }: { children?: ReactNode }) {
  return (
    <div className="my-6 w-full overflow-x-auto rounded-lg border border-stone-200 dark:border-stone-700">
      <table className="!my-0">{children}</table>
    </div>
  );
}

/** 行内 `<kbd>` 快捷键样式 */
function MdxKbd({ children }: { children?: ReactNode }) {
  return (
    <kbd className="rounded-md border border-stone-300 bg-stone-100 px-1.5 py-0.5 font-mono text-[0.8em] text-stone-700 shadow-sm dark:border-stone-600 dark:bg-stone-800 dark:text-stone-300">
      {children}
    </kbd>
  );
}

const components: MDXComponents = {
  h2: createHeading(2),
  h3: createHeading(3),
  h4: createHeading(4),
  a: MdxLink,
  img: MdxImage,
  table: MdxTable,
  kbd: MdxKbd,
  // 文章里可以直接使用这些组件，无需 import
  BilibiliVideo,
  AudioPlayer,
  Callout,
};

export function useMDXComponents(): MDXComponents {
  return components;
}
