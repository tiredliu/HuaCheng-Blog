import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CircleCheck, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { SITE, withBasePath } from "@/lib/site";
import { getSiteStats } from "@/lib/posts";
import { formatCount } from "@/lib/utils";

export const metadata: Metadata = {
  title: "关于",
  description: "关于花城博客：技术栈、写作方式与这个站点是怎么跑起来的。",
};

const STACK = [
  { layer: "框架", tech: "Next.js", version: "16", note: "App Router · 静态导出" },
  { layer: "UI 库", tech: "React", version: "19", note: "服务端组件 + 客户端交互" },
  { layer: "语言", tech: "TypeScript", version: "5", note: "类型安全的 JavaScript" },
  { layer: "语法", tech: "JSX / TSX", version: "—", note: "在 JS 里写 HTML 结构" },
  { layer: "样式", tech: "Tailwind CSS", version: "4", note: "原子化 CSS + 自定义主题" },
  { layer: "内容管理", tech: "TinaCMS", version: "3", note: "网页后台，保存即提交 GitHub" },
  { layer: "内容格式", tech: "MDX", version: "—", note: "Markdown 里嵌 React 组件" },
  { layer: "代码高亮", tech: "Shiki", version: "4", note: "构建期着色，双主题零运行时" },
  { layer: "数学公式", tech: "KaTeX", version: "0.19", note: "构建期渲染，字体按需加载" },
  { layer: "评论", tech: "本机 / 互动服务 / Giscus", version: "—", note: "默认零配置；全站公开评论需要部署一个可选 Worker" },
  { layer: "托管", tech: "Cloudflare Pages", version: "—", note: "全球 CDN，国内速度较好" },
  { layer: "视频", tech: "Bilibili iframe", version: "—", note: "国内可直接播放，免流量" },
];

const CAPABILITIES = [
  { name: "文章展示", done: true, note: "首页列表 + 详情页 + 目录 + 上下篇 + 相关文章" },
  { name: "网页后台写作", done: true, note: "TinaCMS 编辑器，保存自动推送 GitHub" },
  { name: "国内访问速度", done: true, note: "Cloudflare CDN + 无外链字体与外链 JS" },
  { name: "代码高亮 / 公式", done: true, note: "Shiki 双主题 + KaTeX，都在构建期完成" },
  { name: "站内搜索", done: true, note: "构建期生成索引，支持按时间排序" },
  { name: "评论与回复", done: true, note: "评论区 + 留言板；回复只有站长能做，写进仓库对所有人生效" },
  { name: "浏览量 / 点赞", done: true, note: "默认只统计本机；部署自带的 Cloudflare Worker 后是全站数字" },
  { name: "视频 / 音乐播放", done: true, note: "<BilibiliVideo /> 与侧栏播放器" },
  { name: "标签 / 归档", done: true, note: "标签页、标签详情、年份归档" },
  { name: "列表页配图", done: true, note: "cover 当卡片背景；没有封面时展示正文前 4 张图的缩略图带" },
  { name: "自定义壁纸", done: true, note: "内置预设 + 直传仓库 + 只存本机" },
  { name: "站点默认值", done: true, note: "存仓库的 JSON，构建期注入，首屏即生效" },
  { name: "深浅色主题", done: true, note: "跟随系统 + 手动切换，内联脚本防闪屏" },
  { name: "图片自动优化", done: false, note: "静态导出下 next/image 优化器不可用，见设计文档" },
  { name: "精确的阅读量", done: false, note: "KV 没有事务，要精确得上 D1" },
  { name: "浏览量的防刷", done: false, note: "个人博客不做这个投入" },
];

export default function AboutPage() {
  const stats = getSiteStats();

  return (
    <>
      <div className="animate-fade-up mb-8 flex items-center gap-5">
        {/* 头像就是仓库里的 public/avatar.png */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={withBasePath(SITE.avatar)}
          alt={SITE.author}
          width={96}
          height={96}
          className="h-24 w-24 shrink-0 rounded-2xl shadow-float"
        />
        <PageHeader
          className="mb-0"
          eyebrow="About"
          title={`关于${SITE.author}`}
          description={`${SITE.location}的前端工程师。喜欢把复杂的东西拆成可以讲清楚的零件，也喜欢把讲清楚的东西写成文章。`}
        />
      </div>

      <section className="animate-fade-up mb-10 rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-900">
        <h2 className="mb-3 text-base font-semibold text-stone-900 dark:text-stone-100">
          这个博客是怎么跑起来的
        </h2>
        <p className="text-sm leading-relaxed text-stone-500 dark:text-stone-400">
          整站是<strong className="font-medium text-stone-700 dark:text-stone-200">纯静态</strong>的：
          写作时打开 <code className="rounded bg-stone-100 px-1 py-0.5 text-xs dark:bg-stone-800">/admin</code>{" "}
          用 TinaCMS 编辑，保存后通过 GitHub API 提交到仓库；
          Cloudflare Pages 检测到更新就重新构建，把 HTML 直接推到全球 CDN。
          访客访问时服务器只负责发送已经生成好的文件，不执行任何查询，
          所以既快又几乎零成本。
        </p>
        <p className="mt-3 text-sm leading-relaxed text-stone-500 dark:text-stone-400">
          目前站内有 {formatCount(stats.posts)} 篇文章、{formatCount(stats.tags)} 个标签，
          约 {formatCount(stats.words)} 字。
        </p>
      </section>

      <section className="animate-fade-up mb-10">
        <h2 className="mb-4 text-base font-semibold text-stone-900 dark:text-stone-100">技术栈</h2>
        <div className="overflow-x-auto rounded-xl border border-stone-200 dark:border-stone-800">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-stone-100 dark:bg-stone-800">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-stone-600 dark:text-stone-300">
                  层级
                </th>
                <th className="px-3 py-2 text-left font-medium text-stone-600 dark:text-stone-300">
                  技术
                </th>
                <th className="px-3 py-2 text-left font-medium text-stone-600 dark:text-stone-300">
                  版本
                </th>
                <th className="px-3 py-2 text-left font-medium text-stone-600 dark:text-stone-300">
                  说明
                </th>
              </tr>
            </thead>
            <tbody>
              {STACK.map((row) => (
                <tr key={row.layer} className="border-t border-stone-200 dark:border-stone-800">
                  <td className="px-3 py-2 text-stone-500 dark:text-stone-400">{row.layer}</td>
                  <td className="px-3 py-2 font-medium text-stone-800 dark:text-stone-100">
                    {row.tech}
                  </td>
                  <td className="px-3 py-2 text-stone-500 dark:text-stone-400">{row.version}</td>
                  <td className="px-3 py-2 text-stone-500 dark:text-stone-400">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="animate-fade-up mb-10">
        <h2 className="mb-4 text-base font-semibold text-stone-900 dark:text-stone-100">
          能力边界
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {CAPABILITIES.map((item) => (
            <li
              key={item.name}
              className="flex items-start gap-2.5 rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 dark:border-stone-800 dark:bg-stone-900"
            >
              {item.done ? (
                <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-jade-500" />
              ) : (
                <X className="mt-0.5 h-4 w-4 shrink-0 text-stone-300 dark:text-stone-600" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-stone-700 dark:text-stone-200">{item.name}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-stone-400">{item.note}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <Link
        href="/contact"
        className="animate-fade-up inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-600"
      >
        联系我
        <ArrowRight className="h-4 w-4" />
      </Link>
    </>
  );
}
