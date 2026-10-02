import type { Metadata } from "next";
import { ArrowUpRight, GitBranch, Mail, MessageSquare, Rss } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "联系",
  description: "通过邮件、GitHub 或者页面右侧的留言板联系我。",
};

const CHANNELS = [
  {
    Icon: Mail,
    label: "邮箱",
    value: SITE.email,
    href: `mailto:${SITE.email}`,
    note: "技术交流、合作、约稿都可以，通常 2 个工作日内回复",
  },
  {
    Icon: GitBranch,
    label: "GitHub",
    value: "hua-cheng",
    href: SITE.repository,
    note: "这个博客的源码就是公开的，欢迎提 Issue 或 PR",
  },
  {
    Icon: Rss,
    label: "订阅",
    value: "/rss.xml",
    href: "/rss.xml",
    note: "用任意 RSS 阅读器订阅更新",
  },
];

export default function ContactPage() {
  return (
    <>
      <PageHeader
        eyebrow="Contact"
        title="联系我"
        description="比起私信，我更愿意把讨论留在公开的地方 —— 这样后来的人也能看到。"
      />

      <div className="animate-fade-up space-y-3">
        {CHANNELS.map(({ Icon, label, value, href, note }) => (
          <a
            key={label}
            href={href}
            target={href.startsWith("http") ? "_blank" : undefined}
            rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
            className="group flex items-start gap-4 rounded-2xl border border-stone-200 bg-white p-4 transition-colors hover:border-brand-300 dark:border-stone-800 dark:bg-stone-900 dark:hover:border-brand-800"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-300">
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 text-xs text-stone-400">
                {label}
                <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
              </p>
              <p className="mt-0.5 truncate text-sm font-medium text-stone-800 group-hover:text-brand-600 dark:text-stone-100 dark:group-hover:text-brand-400">
                {value}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-stone-400">{note}</p>
            </div>
          </a>
        ))}
      </div>

      <section className="animate-fade-up mt-8 rounded-2xl border border-dashed border-stone-300 p-5 dark:border-stone-700">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-stone-800 dark:text-stone-100">
          <MessageSquare className="h-4 w-4 text-brand-500" />
          关于留言板
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-500 dark:text-stone-400">
          点击右上角的留言图标可以打开右侧留言区。因为整站是纯静态导出的，
          留言目前保存在你自己的浏览器里（localStorage），换设备看不到 ——
          它是这块版面的演示，而不是真实的公共评论。
        </p>
        <p className="mt-2 text-sm leading-relaxed text-stone-500 dark:text-stone-400">
          如果你希望有真正公开的评论区，接入{" "}
          <a
            href="https://giscus.app/zh-CN"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            Giscus
          </a>{" "}
          即可：它基于 GitHub Discussions，同样免费、同样不需要后端。
        </p>
      </section>
    </>
  );
}
