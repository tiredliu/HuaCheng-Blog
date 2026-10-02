import type { MDXComponents } from "mdx/types";
import { isValidElement } from "react";
import type { AnchorHTMLAttributes, ImgHTMLAttributes, ReactNode } from "react";
import { AudioPlayer } from "@/components/AudioPlayer";
import { BilibiliVideo } from "@/components/BilibiliVideo";
import { Callout } from "@/components/Callout";
import { withBasePath } from "@/lib/site";

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

/**
 * 链接。
 *
 * 两个细节：
 * - 外链自动加 `target="_blank" rel="noopener noreferrer"`
 * - **站内链接要手动补 basePath**：Markdown/MDX 里的链接渲染成的是原生 `<a>`，
 *   不像 `next/link` 那样会自动带上 `basePath`。子路径部署（GitHub Pages 项目页）
 *   时，`[某篇](/posts/foo)` 不加前缀就会 404。
 */
function MdxLink({ href = "", children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const isExternal = /^(https?:)?\/\//.test(href) || href.startsWith("mailto:");

  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
        {children}
      </a>
    );
  }

  // 只处理站内绝对路径；`#锚点` 和相对路径保持原样
  const resolved = href.startsWith("/") ? withBasePath(href) : href;

  return (
    <a href={resolved} {...rest}>
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

/** 从 Shiki 生成的 `<code class="language-xxx">` 里取出语言名 */
function extractLanguage(node: ReactNode): string | null {
  const child = Array.isArray(node) ? node[0] : node;
  if (!isValidElement(child)) return null;

  const className = (child.props as { className?: string }).className ?? "";
  const match = /language-([\w+#-]+)/.exec(className);
  return match ? match[1] : null;
}

/**
 * 代码块外层包一层，用来放语言标签。
 *
 * 标签没法用纯 CSS 做：Shiki 把语言写在 `<code class="language-xxx">` 上，
 * 而 CSS 的 `content` 取不到类名（`attr()` 只能读属性值）。
 * 所以在这里把类名读出来，渲染成一个真正的元素。
 */
function MdxPre({ children, ...rest }: React.ComponentPropsWithoutRef<"pre">) {
  const language = extractLanguage(children);
  if (!language) return <pre {...rest}>{children}</pre>;

  return (
    <div className="code-block">
      <span className="code-lang" aria-hidden>
        {language}
      </span>
      <pre {...rest}>{children}</pre>
    </div>
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
  pre: MdxPre,
  // 文章里可以直接使用这些组件，无需 import
  BilibiliVideo,
  AudioPlayer,
  Callout,
};

export function useMDXComponents(): MDXComponents {
  return components;
}
