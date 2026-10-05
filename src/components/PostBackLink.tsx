"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

const LINK_CLASS =
  "mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 transition-colors hover:text-brand-600 dark:text-stone-400";

/** 只接受站内绝对路径，避免 `?from=` 被构造成外部跳转 */
function safeFrom(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className={LINK_CLASS}>
      <ArrowLeft className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}

function BackLinkFromQuery() {
  const from = safeFrom(useSearchParams().get("from"));
  // 从标签详情页进来的：回到「该标签的文章列表」
  if (from?.startsWith("/tags/")) {
    return <BackLink href={from} label="返回该标签的文章" />;
  }
  return <BackLink href={from ?? "/posts"} label="返回文章列表" />;
}

/**
 * 文章页顶部的「返回」链接。
 *
 * 默认回「全部文章」；但如果是从某个列表页（例如标签详情页）点进来的，
 * 就回到那个列表 —— 看完一篇接着浏览同一批文章更顺手。
 * 来源由列表页在链接上带 `?from=` 传递（见 `PostCard` 的 `fromHref`）。
 */
export function PostBackLink() {
  // 静态导出下 `useSearchParams` 必须包在 Suspense 边界里；
  // fallback 就是最普通的「返回文章列表」，与服务端预渲染的 HTML 一致。
  return (
    <Suspense fallback={<BackLink href="/posts" label="返回文章列表" />}>
      <BackLinkFromQuery />
    </Suspense>
  );
}

export default PostBackLink;
