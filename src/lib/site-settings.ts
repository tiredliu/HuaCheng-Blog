import {
  DEFAULT_INTERACTIONS,
  isInteractionSettings,
  type InteractionSettings,
} from "@/lib/interactions";
import { DEFAULT_WALLPAPER, isWallpaperSettings, type WallpaperSettings } from "@/lib/wallpaper";

/**
 * 站点级默认设置。
 *
 * 和「访客偏好」是两回事，这一点很关键：
 *
 * | | 访客偏好 | 站点默认值 |
 * | --- | --- | --- |
 * | 存在哪 | 访客自己的 localStorage | 仓库里的 `content/site-settings.json` |
 * | 谁能改 | 任何人（只影响自己） | 只有仓库有写权限的人 |
 * | 何时生效 | 打开页面后（hydration 之后） | **构建期注入 HTML，首屏就是对的** |
 *
 * 为什么不把访客偏好也存仓库：每个访客切一次主题就会产生一次 commit，
 * 还会触发一次重新部署；而且要让访客能写，就得把仓库写权限发给所有人。
 *
 * 这个文件必须保持「客户端安全」：不能 import 任何 `node:*`。
 * 读取文件的部分在 `src/lib/site-settings-file.ts`。
 */

export type ThemePreference = "system" | "light" | "dark";
export type FontScale = "sm" | "md" | "lg";
export type ContentWidth = "comfortable" | "wide";

/** Giscus 评论（基于 GitHub Discussions）的配置；为 null 表示不启用 */
export interface GiscusConfig {
  /** `owner/repo` */
  repo: string;
  /** 形如 R_kgDOxxxx，从 giscus.app 的配置生成器拿 */
  repoId: string;
  /** Discussions 分类名，例如 Announcements */
  category: string;
  /** 形如 DIC_kwDOxxxx */
  categoryId: string;
  /** 文章与 discussion 的映射方式 */
  mapping?: "pathname" | "url" | "title" | "og:title" | "specific";
  reactionsEnabled?: boolean;
  inputPosition?: "top" | "bottom";
  lang?: string;
}

export interface SiteSettings {
  theme: ThemePreference;
  fontScale: FontScale;
  contentWidth: ContentWidth;
  sidebarOpen: boolean;
  sidebarWidth: number;
  messageOpen: boolean;
  wallpaper: WallpaperSettings;
  giscus: GiscusConfig | null;
  /**
   * 浏览量 / 点赞 / 评论的后端。
   *
   * 默认 `local`：零配置，只统计访客自己的浏览器；
   * 改成 `remote` 并填上 `apiBase` 之后才是全局数字
   * （后端源码在 `workers/blog-api/`，部署一次即可）。
   */
  interactions: InteractionSettings;
  /** 上次保存时间，仅用于界面提示 */
  updatedAt?: string;
}

export const SITE_SETTINGS_PATH = "content/site-settings.json";

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  theme: "system",
  fontScale: "md",
  contentWidth: "comfortable",
  sidebarOpen: true,
  sidebarWidth: 272,
  messageOpen: false,
  wallpaper: DEFAULT_WALLPAPER,
  giscus: null,
  interactions: DEFAULT_INTERACTIONS,
};

export const SIDEBAR_MIN_WIDTH = 220;
export const SIDEBAR_MAX_WIDTH = 400;

export const FONT_SIZES: Record<FontScale, string> = {
  sm: "15px",
  md: "16px",
  lg: "17.5px",
};

const isThemePreference = (value: unknown): value is ThemePreference =>
  value === "system" || value === "light" || value === "dark";
const isFontScale = (value: unknown): value is FontScale =>
  value === "sm" || value === "md" || value === "lg";
const isContentWidth = (value: unknown): value is ContentWidth =>
  value === "comfortable" || value === "wide";

function isGiscusConfig(value: unknown): value is GiscusConfig {
  if (typeof value !== "object" || value === null) return false;
  const config = value as GiscusConfig;
  return (
    typeof config.repo === "string" &&
    typeof config.repoId === "string" &&
    typeof config.category === "string" &&
    typeof config.categoryId === "string"
  );
}

/**
 * 把任意来源（JSON 文件、GitHub API）的数据规整成完整的 SiteSettings。
 *
 * 逐字段校验 + 回退到默认值，而不是整体信任或整体丢弃 ——
 * 这样文件里少写一个字段、或者写错一个字段，都不会让整份设置失效。
 */
export function normalizeSiteSettings(input: unknown): SiteSettings {
  if (typeof input !== "object" || input === null) return { ...DEFAULT_SITE_SETTINGS };
  const raw = input as Partial<SiteSettings>;

  const width =
    typeof raw.sidebarWidth === "number" && Number.isFinite(raw.sidebarWidth)
      ? Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(raw.sidebarWidth)))
      : DEFAULT_SITE_SETTINGS.sidebarWidth;

  return {
    theme: isThemePreference(raw.theme) ? raw.theme : DEFAULT_SITE_SETTINGS.theme,
    fontScale: isFontScale(raw.fontScale) ? raw.fontScale : DEFAULT_SITE_SETTINGS.fontScale,
    contentWidth: isContentWidth(raw.contentWidth)
      ? raw.contentWidth
      : DEFAULT_SITE_SETTINGS.contentWidth,
    sidebarOpen:
      typeof raw.sidebarOpen === "boolean" ? raw.sidebarOpen : DEFAULT_SITE_SETTINGS.sidebarOpen,
    sidebarWidth: width,
    messageOpen:
      typeof raw.messageOpen === "boolean" ? raw.messageOpen : DEFAULT_SITE_SETTINGS.messageOpen,
    wallpaper: isWallpaperSettings(raw.wallpaper)
      ? (raw.wallpaper as WallpaperSettings)
      : DEFAULT_WALLPAPER,
    giscus: isGiscusConfig(raw.giscus) ? raw.giscus : null,
    interactions: isInteractionSettings(raw.interactions)
      ? (raw.interactions as InteractionSettings)
      : DEFAULT_INTERACTIONS,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined,
  };
}

/** 写进仓库时用这个，字段顺序固定、便于 diff */
export function serializeSiteSettings(settings: SiteSettings): string {
  return `${JSON.stringify(
    {
      $comment:
        "站点默认设置。可以直接改这个文件，也可以在前台「设置 → 站点默认」里保存（需要 GitHub Token）。访客自己的偏好存在浏览器里，会覆盖这里的值。",
      theme: settings.theme,
      fontScale: settings.fontScale,
      contentWidth: settings.contentWidth,
      sidebarOpen: settings.sidebarOpen,
      sidebarWidth: settings.sidebarWidth,
      messageOpen: settings.messageOpen,
      wallpaper: settings.wallpaper,
      giscus: settings.giscus,
      interactions: settings.interactions,
      updatedAt: settings.updatedAt,
    },
    null,
    2,
  )}\n`;
}

/** 把两个 set 比较出差异，界面用来说明「有哪些改动待保存」 */
export function diffSiteSettings(current: SiteSettings, saved: SiteSettings): string[] {
  const changed: string[] = [];
  if (current.theme !== saved.theme) changed.push("主题");
  if (current.fontScale !== saved.fontScale) changed.push("字号");
  if (current.contentWidth !== saved.contentWidth) changed.push("内容区宽度");
  if (current.sidebarOpen !== saved.sidebarOpen) changed.push("导航栏展开状态");
  if (current.sidebarWidth !== saved.sidebarWidth) changed.push("导航栏宽度");
  if (current.messageOpen !== saved.messageOpen) changed.push("留言区展开状态");
  if (JSON.stringify(current.wallpaper) !== JSON.stringify(saved.wallpaper)) changed.push("壁纸");
  if (JSON.stringify(current.giscus) !== JSON.stringify(saved.giscus)) changed.push("评论配置");
  if (JSON.stringify(current.interactions) !== JSON.stringify(saved.interactions))
    changed.push("互动统计后端");
  return changed;
}

/** 把值安全地嵌进内联 <script>（`<` 会提前结束 script 标签） */
function safeJsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/-->/g, "--\\u003e");
}

/**
 * 生成防闪屏的内联脚本。
 *
 * 关键在于**把站点默认值编译进脚本**：如果只读 localStorage，
 * 那么「站点默认是深色」的首次访客一定会先看到一帧浅色。
 */
export function buildBootstrapScript(settings: SiteSettings): string {
  const fallbackTheme = safeJsonForScript(settings.theme);
  const fallbackFont = safeJsonForScript(settings.fontScale);

  return `(function(){try{
var SIZES={sm:'15px',md:'16px',lg:'17.5px'};
var SITE_THEME=${fallbackTheme};
var SITE_FONT=${fallbackFont};
var read=function(k){try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}};
var theme=read('hc-blog:theme');
if(theme!=='light'&&theme!=='dark'){
  theme=(SITE_THEME==='light'||SITE_THEME==='dark')?SITE_THEME:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
}
var font=read('hc-blog:font-scale');
if(!SIZES[font])font=(SIZES[SITE_FONT]?SITE_FONT:'md');
document.documentElement.style.fontSize=SIZES[font];
if(theme==='dark')document.documentElement.classList.add('dark');
document.documentElement.style.colorScheme=theme;
}catch(e){}})();`;
}
