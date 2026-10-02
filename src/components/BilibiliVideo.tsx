import { cn } from "@/lib/utils";

export interface BilibiliVideoProps {
  /** 视频 BV 号，例如 BV1xx411c7mD */
  bvid?: string;
  /** 旧版 av 号（不带 av 前缀） */
  aid?: string | number;
  /** 分 P，默认 1 */
  page?: number;
  /** 是否开启弹幕，默认关闭，页面更清爽 */
  danmaku?: boolean;
  /** 是否自动播放，默认关闭 */
  autoplay?: boolean;
  /** 视频说明文字，同时用作 iframe 的 title（无障碍） */
  title?: string;
  /** 高码率（需要登录 B 站账号时才生效） */
  highQuality?: boolean;
  className?: string;
}

/**
 * Bilibili 视频嵌入。
 *
 * 选用 B 站而非 YouTube：国内可直接播放、免流量、加载快，
 * 且是纯 iframe，静态导出后无需任何后端。
 *
 * ```mdx
 * <BilibiliVideo bvid="BV1xx411c7mD" title="Next.js 静态博客实战" />
 * ```
 */
export function BilibiliVideo({
  bvid,
  aid,
  page = 1,
  danmaku = false,
  autoplay = false,
  highQuality = true,
  title = "Bilibili 视频",
  className,
}: BilibiliVideoProps) {
  if (!bvid && !aid) {
    return (
      <div className="my-6 rounded-xl border border-dashed border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-700">
        <code>&lt;BilibiliVideo /&gt;</code> 需要提供 <code>bvid</code> 或 <code>aid</code> 参数。
      </div>
    );
  }

  const params = new URLSearchParams({
    page: String(page),
    high_quality: highQuality ? "1" : "0",
    danmaku: danmaku ? "1" : "0",
    autoplay: autoplay ? "1" : "0",
  });
  if (bvid) params.set("bvid", bvid);
  if (aid) params.set("aid", String(aid));

  return (
    <figure className={cn("my-8", className)}>
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-stone-200 bg-black shadow-card dark:border-stone-700">
        <iframe
          src={`https://player.bilibili.com/player.html?${params.toString()}`}
          title={title}
          loading="lazy"
          scrolling="no"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          className="absolute inset-0 h-full w-full"
        />
      </div>
      <figcaption className="mt-2 text-center text-xs text-stone-500 dark:text-stone-400">
        {title} · 视频来自 Bilibili
      </figcaption>
    </figure>
  );
}

export default BilibiliVideo;
