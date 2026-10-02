/**
 * 壁纸定义与解析。
 *
 * 内置壁纸全部用 CSS 渐变/网格实现，**不引用任何外部图片**：
 * 这样零网络请求、国内加载同样快，也不会因为图床挂掉而白屏。
 *
 * 想要真实照片时有两种方式：
 * - 在设置面板里粘贴一个图片直链
 * - 上传本地图片（会先压缩再存进浏览器 localStorage）
 */

export interface WallpaperPreset {
  id: string;
  name: string;
  /** 一句话说明，显示在设置面板里 */
  hint: string;
  /** 浅色主题下的 background-image 值 */
  light: string;
  /** 深色主题下的 background-image 值 */
  dark: string;
}

/** 「无壁纸」用纯色背景，单独处理 */
export const NO_WALLPAPER = "none";

export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  {
    id: "ink",
    name: "水墨",
    hint: "宣纸上的两团淡墨",
    light:
      "radial-gradient(closest-side at 28% 26%, #e7e5e4 0%, rgba(231,229,228,0) 72%), radial-gradient(closest-side at 76% 72%, #d6d3d1 0%, rgba(214,211,209,0) 70%), linear-gradient(150deg, #fbfaf9 0%, #ece9e6 100%)",
    dark:
      "radial-gradient(closest-side at 28% 26%, #2a2725 0%, rgba(42,39,37,0) 72%), radial-gradient(closest-side at 76% 72%, #1c1917 0%, rgba(28,25,23,0) 70%), linear-gradient(150deg, #121110 0%, #0a0908 100%)",
  },
  {
    id: "grid",
    name: "蓝图",
    hint: "56px 的方格纸",
    light:
      "repeating-linear-gradient(0deg, rgba(120,113,108,0.14) 0 1px, transparent 1px 56px), repeating-linear-gradient(90deg, rgba(120,113,108,0.14) 0 1px, transparent 1px 56px), linear-gradient(160deg, #fcfcfb 0%, #f0efed 100%)",
    dark:
      "repeating-linear-gradient(0deg, rgba(214,211,209,0.07) 0 1px, transparent 1px 56px), repeating-linear-gradient(90deg, rgba(214,211,209,0.07) 0 1px, transparent 1px 56px), linear-gradient(160deg, #131211 0%, #090908 100%)",
  },
  {
    id: "paper",
    name: "纸纹",
    hint: "很淡的斜向纹理",
    light:
      "repeating-linear-gradient(45deg, rgba(120,113,108,0.035) 0 2px, transparent 2px 6px), linear-gradient(160deg, #fdfcfa 0%, #f4f1eb 100%)",
    dark:
      "repeating-linear-gradient(45deg, rgba(255,255,255,0.016) 0 2px, transparent 2px 6px), linear-gradient(160deg, #131110 0%, #0a0908 100%)",
  },
  {
    id: "kapok",
    name: "木棉",
    hint: "广州的市花，暖红",
    light:
      "radial-gradient(1200px 620px at 12% 6%, #ffd9cf 0%, rgba(255,217,207,0) 62%), radial-gradient(900px 520px at 88% 88%, #ffe9d6 0%, rgba(255,233,214,0) 66%), linear-gradient(160deg, #fff7f3 0%, #ffe4dc 55%, #ffd2c5 100%)",
    dark:
      "radial-gradient(1200px 620px at 12% 6%, #7c2f22 0%, rgba(124,47,34,0) 62%), radial-gradient(900px 520px at 88% 88%, #5c2a1d 0%, rgba(92,42,29,0) 66%), linear-gradient(160deg, #2b1411 0%, #1b0c0a 100%)",
  },
  {
    id: "lingnan",
    name: "岭南",
    hint: "青绿，雨后榕荫",
    light:
      "radial-gradient(1000px 700px at 86% 8%, #cdf3e9 0%, rgba(205,243,233,0) 62%), radial-gradient(900px 620px at 8% 92%, #d9f0e4 0%, rgba(217,240,228,0) 60%), linear-gradient(200deg, #f4fbf8 0%, #ddf2ea 100%)",
    dark:
      "radial-gradient(1000px 700px at 86% 8%, #0f4c41 0%, rgba(15,76,65,0) 62%), radial-gradient(900px 620px at 8% 92%, #123f36 0%, rgba(18,63,54,0) 60%), linear-gradient(200deg, #08211d 0%, #051311 100%)",
  },
  {
    id: "pearl",
    name: "珠江夜",
    hint: "江面与灯光的冷蓝",
    light:
      "radial-gradient(900px 600px at 84% 14%, #dbeafe 0%, rgba(219,234,254,0) 60%), radial-gradient(760px 520px at 12% 88%, #e0e7ff 0%, rgba(224,231,255,0) 62%), linear-gradient(180deg, #f9fbff 0%, #e5eaff 100%)",
    dark:
      "radial-gradient(900px 600px at 84% 14%, #1d3a8f 0%, rgba(29,58,143,0) 60%), radial-gradient(760px 520px at 12% 88%, #241f5e 0%, rgba(36,31,94,0) 62%), linear-gradient(180deg, #0a1020 0%, #101425 100%)",
  },
  {
    id: "dusk",
    name: "暮色",
    hint: "晚霞渐变的紫粉",
    light:
      "linear-gradient(200deg, #fff2f4 0%, #fde9f5 45%, #ebe6ff 100%)",
    dark:
      "linear-gradient(200deg, #2b1622 0%, #1d1533 45%, #0f1021 100%)",
  },
];

export function getPreset(id: string): WallpaperPreset | undefined {
  return WALLPAPER_PRESETS.find((preset) => preset.id === id);
}

/* ------------------------------------------------------------------ */
/* 访客设置                                                            */
/* ------------------------------------------------------------------ */

/** 壁纸来源：内置预设 / 图片链接（含直传仓库的图）/ 本机浏览器内的图片 */
export type WallpaperSource = "preset" | "url" | "upload";

export interface WallpaperSettings {
  source: WallpaperSource;
  /** source === "preset" 时生效 */
  presetId: string;
  /** source === "url" 时生效，例如 https://... 或 /uploads/bg.jpg */
  url: string;
  /** source === "upload" 时生效，压缩后的 data URL（只存本机） */
  dataUrl: string;
  /** 壁纸强度 0–100，越低越淡（把壁纸推远，保证正文可读） */
  strength: number;
  /** 模糊半径 0–24px */
  blur: number;
}

export const WALLPAPER_STORAGE_KEY = "hc-blog:wallpaper";

export const DEFAULT_WALLPAPER: WallpaperSettings = {
  source: "preset",
  presetId: "ink",
  url: "",
  dataUrl: "",
  strength: 100,
  blur: 0,
};

export function isWallpaperSettings(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as WallpaperSettings;
  return (
    (candidate.source === "preset" ||
      candidate.source === "url" ||
      candidate.source === "upload") &&
    typeof candidate.presetId === "string" &&
    typeof candidate.url === "string" &&
    typeof candidate.dataUrl === "string" &&
    typeof candidate.strength === "number" &&
    typeof candidate.blur === "number"
  );
}

/* ------------------------------------------------------------------ */
/* 直传仓库的壁纸（我的上传）                                          */
/* ------------------------------------------------------------------ */

export interface WallpaperUpload {
  id: string;
  /** 站内路径，例如 /uploads/xxx.jpg */
  url: string;
  /** 仓库内路径，例如 public/uploads/xxx.jpg */
  path: string;
  name: string;
  /** 字节数 */
  size: number;
  createdAt: string;
  /** 小缩略图（data URL），用于选择面板，约 10–30KB */
  thumb: string;
  /**
   * 部署完成前的临时地址（GitHub 原始文件）。
   * Cloudflare 重新构建要 1–2 分钟，这期间站内的 /uploads/xxx 还是 404，
   * 用它可以立刻看到效果；探测到正式地址可用后会自动清掉。
   */
  fallbackUrl?: string;
}

export const WALLPAPER_UPLOADS_KEY = "hc-blog:wallpaper-uploads";

/** 最多保留多少张上传的壁纸，超出后丢弃最旧的 */
export const MAX_WALLPAPER_UPLOADS = 12;

export function isWallpaperUploadArray(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as WallpaperUpload).id === "string" &&
        typeof (item as WallpaperUpload).url === "string" &&
        typeof (item as WallpaperUpload).thumb === "string",
    )
  );
}

export interface ResolvedWallpaper {
  /** 直接喂给 style.backgroundImage */
  backgroundImage: string;
  /** 用于 aria-label / 说明文字 */
  label: string;
  /** 是否用的是临时地址（界面可以提示「等待部署完成」） */
  pending?: boolean;
}

/**
 * 把设置解析成可渲染的 background-image；返回 null 表示不显示壁纸。
 *
 * `fallbackUrl` 只在「刚上传到仓库、站点还没重新构建完」时传入，
 * 用来顶过那 1–2 分钟的空窗期。
 */
export function resolveWallpaper(
  settings: WallpaperSettings,
  isDark: boolean,
  fallbackUrl?: string,
): ResolvedWallpaper | null {
  if (settings.strength <= 8) return null;

  if (settings.source === "upload") {
    return settings.dataUrl
      ? { backgroundImage: `url("${settings.dataUrl}")`, label: "本机图片" }
      : null;
  }

  if (settings.source === "url") {
    const url = settings.url.trim();
    if (!url) return null;

    // 刚上传到仓库、还没部署完 → 先用 GitHub 原始地址顶着
    if (fallbackUrl) {
      return {
        backgroundImage: `url("${fallbackUrl.replace(/"/g, "%22")}")`,
        label: "自定义图片（等待部署）",
        pending: true,
      };
    }

    return { backgroundImage: `url("${url.replace(/"/g, "%22")}")`, label: "自定义图片" };
  }

  if (settings.presetId === NO_WALLPAPER) return null;
  const preset = getPreset(settings.presetId);
  if (!preset) return null;

  return {
    backgroundImage: isDark ? preset.dark : preset.light,
    label: preset.name,
  };
}

/** 随机换一张内置壁纸（不重复当前的） */
export function randomPresetId(currentId: string): string {
  const pool = WALLPAPER_PRESETS.filter((preset) => preset.id !== currentId);
  const list = pool.length > 0 ? pool : WALLPAPER_PRESETS;
  return list[Math.floor(Math.random() * list.length)].id;
}

/** 按时间倒序整理上传列表，并裁剪到上限 */
export function sortAndTrimUploads(uploads: WallpaperUpload[]): WallpaperUpload[] {
  return [...uploads]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, MAX_WALLPAPER_UPLOADS);
}
