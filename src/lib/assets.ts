/**
 * 静态资源的目录约定。
 *
 * 以前文章配图、壁纸、音频全堆在 `public/uploads/` 一个目录里，
 * 想找某个文件只能靠文件名猜（而且壁纸和文章配图混在一起，删错一个就是 404）。
 * 现在按类型分目录：
 *
 * | 目录 | 放什么 | 怎么引用 |
 * | --- | --- | --- |
 * | `public/images/<文章名>_image/` | 文章配图（**每篇一个文件夹**，Obsidian 也是这么写的） | 编辑器里写 `../../public/images/<文章名>_image/x.jpg`（站点上就是 `/images/<文章名>_image/x.jpg`） |
 * | `public/wallpapers/` | 站点壁纸大图 | 设置面板里填 `/wallpapers/x.jpg` |
 * | `public/music/` | 音频（mp3 / wav / flac …） | `musicUrl("x.mp3")`、`<AudioPlayer src="/music/x.mp3" />` |
 * | `public/lyrics/` | 歌词（`.lrc`） | `src/lib/music.ts` 里给曲目填 `lyrics: lyricUrl("x.lrc")` |
 * | `public/emojis/` | 评论区图片表情包（`index.json` 是清单） | `emojiUrl("x.png")` |
 * | `public/uploads/` | TinaCMS 媒体库与「上传到仓库」的落点（混杂区） | `/uploads/x.jpg` |
 *
 * 文章配图为什么按文章分文件夹
 * ----------------------------
 * Obsidian 的仓库根目录就是**仓库根**，它的附件插件按
 * `public/images/${filename}_image` 把插图写进每篇文章自己的图库 —— 图片直接落在 `public/` 下，
 * 也就是站点能取用的地方，**不需要任何同步步骤**。
 *
 * 唯一的代价是文章里的路径：笔记在 `content/posts/`，图在 `public/images/`，
 * 「相对路径」写法会是 `../../public/images/…`（有点长，但 Obsidian 和 Typora 都能解析）。
 * `resolveImageSrc()` 负责把它规整成站点上的 `/images/…`。
 *
 * ⚠️ `public/uploads/` **不能删**：
 * - `tina/config.ts` 的 `media.mediaRoot` 写的是 `uploads`
 * - 设置面板里「上传到仓库」走的是 `github-upload.ts` 的 `UPLOAD_DIR`
 *
 * 两者都指向这一个目录。它现在只作为**上传的落点**，
 * 整理之后建议按类型移到上面几个目录里，避免长期混杂。
 *
 * 另外：新增资源目录后要同步三个地方，否则行为会不一致 ——
 * `public/_headers`（缓存）、`nginx.conf`（缓存）、`eslint.config.mjs`（忽略检查）。
 */

/** 站内可访问的目录（浏览器看到的路径） */
export const ASSET_DIRS = {
  /** 文章配图与封面 */
  images: "/images",
  /** 站点壁纸 */
  wallpapers: "/wallpapers",
  /** 音频 */
  music: "/music",
  /** 歌词 */
  lyrics: "/lyrics",
  /** 评论区图片表情包 */
  emojis: "/emojis",
  /** 上传落点（TinaCMS 媒体库 / 直传仓库） */
  uploads: "/uploads",
} as const;

export type AssetDir = keyof typeof ASSET_DIRS;

/** 仓库内的目录（给 GitHub Contents API 用，前缀 `public`） */
export const ASSET_REPO_DIRS: Record<AssetDir, string> = {
  images: "public/images",
  wallpapers: "public/wallpapers",
  music: "public/music",
  lyrics: "public/lyrics",
  emojis: "public/emojis",
  uploads: "public/uploads",
};

/**
 * 所有资源目录的站内路径。
 *
 * `resolveImageSrc()` 用它来识别「省略了前导斜杠」的写法（例如 `images/a.jpg`），
 * 两处必须共用同一份列表，否则会出现「正文的图能显示、列表页缩略图 404」。
 */
export const ASSET_DIR_LIST: readonly string[] = Object.values(ASSET_DIRS);

/** 判断一个地址是不是外链（http(s) / 协议相对 / data:） */
export function isExternalUrl(value: string): boolean {
  return /^(https?:)?\/\//i.test(value) || value.startsWith("data:");
}

/**
 * 拼一个站内资源地址。
 *
 * 文件名里的中文与空格必须编码 —— 仓库里就有
 * `白鲨jaws-dive back in time.mp3` 这种带空格的文件名，
 * 直接拼进 `src` 会取不到。
 *
 * ```ts
 * musicUrl("demo-01.wav")   // "/music/demo-01.wav"
 * musicUrl("白鲨 x.mp3")     // "/music/%E7%99%BD%E9%B2%8A%20x.mp3"
 * ```
 *
 * ⚠️ 返回值**不带 basePath**：音频/图片地址要过 `withBasePath()`
 * 或 `resolveImageSrc()`，子路径部署时才不会 404。
 */
export function assetUrl(dir: AssetDir, fileName: string): string {
  const clean = fileName.replace(/\\/g, "/").replace(/^\.?\/*/, "");
  const encoded = clean
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
  return `${ASSET_DIRS[dir]}/${encoded}`;
}

/** 文章配图 / 封面 */
export const imageUrl = (fileName: string): string => assetUrl("images", fileName);

/** 壁纸 */
export const wallpaperUrl = (fileName: string): string => assetUrl("wallpapers", fileName);

/** 音频 */
export const musicUrl = (fileName: string): string => assetUrl("music", fileName);

/** 歌词（LRC） */
export const lyricUrl = (fileName: string): string => assetUrl("lyrics", fileName);

/** 评论区图片表情包 */
export const emojiUrl = (fileName: string): string => assetUrl("emojis", fileName);
