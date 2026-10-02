import Link from "next/link";
import { House, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="animate-fade-up flex min-h-[50vh] flex-col items-center justify-center text-center">
      <p className="font-mono text-6xl font-bold text-brand-200 dark:text-brand-900">404</p>
      <h1 className="mt-4 text-xl font-semibold text-stone-800 dark:text-stone-100">
        这里什么都没有
      </h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-stone-500 dark:text-stone-400">
        页面可能已经被移动或删除。静态站点没有服务端路由，所以找不到就是真的找不到。
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600"
        >
          <House className="h-4 w-4" />
          回到首页
        </Link>
        <Link
          href="/posts"
          className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 transition-colors hover:border-brand-300 hover:text-brand-600 dark:border-stone-700 dark:text-stone-300"
        >
          <Search className="h-4 w-4" />
          浏览全部文章
        </Link>
      </div>
    </div>
  );
}
