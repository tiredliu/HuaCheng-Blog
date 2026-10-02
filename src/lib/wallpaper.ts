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

/** 壁纸来源：内置预设 / 外链图片 / 本地上传 */
export type WallpaperSource = "preset" | "url" | "upload";

export interface WallpaperSettings {
  source: WallpaperSource;
  /** source === "preset" 时生效 */
  presetId: string;
  /** source === "url" 时生效，例如 https://... 或 /uploads/bg.jpg */
  url: string;
  /** source === "upload" 时生效，压缩后的 data URL */
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

export interface ResolvedWallpaper {
  /** 直接喂给 style.backgroundImage */
  backgroundImage: string;
  /** 用于 aria-label / 说明文字 */
  label: string;
}

/** 把设置解析成可渲染的 background-image；返回 null 表示不显示壁纸 */
export function resolveWallpaper(
  settings: WallpaperSettings,
  isDark: boolean,
): ResolvedWallpaper | null {
  if (settings.strength <= 8) return null;

  if (settings.source === "upload") {
    return settings.dataUrl
      ? { backgroundImage: `url("${settings.dataUrl}")`, label: "自定义上传图片" }
      : null;
  }

  if (settings.source === "url") {
    const url = settings.url.trim();
    if (!url) return null;
    return { backgroundImage: `url("${url.replace(/"/g, "%22")}")`, label: "自定义图片链接" };
  }

  if (settings.presetId === NO_WALLPAPER) return null;
  const preset = getPreset(settings.presetId);
  if (!preset) return null;

  return {
    backgroundImage: isDark ? preset.dark : preset.light,
    label: preset.name,
  };
}

/* ------------------------------------------------------------------ */
/* 本地上传：压缩                                                            */
/* ------------------------------------------------------------------ */

/** localStorage 一般只有 5MB，转成 base64 还会膨胀约 1/3，所以卡在 2.2MB 字符以内 */
const MAX_DATA_URL_LENGTH = 2_200_000;

async function loadBitmap(file: File): Promise<ImageBitmap> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file);
  }

  // 很老的浏览器兜底：走 <img> + object URL
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext("2d")?.drawImage(image, 0, 0);
    return await createImageBitmap(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function drawToDataUrl(bitmap: ImageBitmap, maxEdge: number, quality: number): string {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器不支持 canvas 2d 上下文");
  context.drawImage(bitmap, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", quality);
}

/**
 * 把用户选择的图片压缩成适合放进 localStorage 的 data URL。
 *
 * 逐级降级：1920/0.82 → 1600/0.72 → 1280/0.62，
 * 还是太大就抛错，让界面给出明确提示，而不是静默写入失败。
 */
export async function compressImageFile(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("请选择图片文件（jpg / png / webp / gif 等）");
  }

  const bitmap = await loadBitmap(file);
  try {
    const attempts: Array<[number, number]> = [
      [1920, 0.82],
      [1600, 0.72],
      [1280, 0.62],
    ];

    let smallest = "";
    for (const [maxEdge, quality] of attempts) {
      const dataUrl = drawToDataUrl(bitmap, maxEdge, quality);
      smallest = dataUrl;
      if (dataUrl.length <= MAX_DATA_URL_LENGTH) return dataUrl;
    }

    throw new Error(
      `图片压缩后仍有 ${(smallest.length / 1024 / 1024).toFixed(1)}MB，超出浏览器本地存储的容量，请换一张更小的图片`,
    );
  } finally {
    bitmap.close?.();
  }
}

/** 探测 localStorage 是否真的放得下这个 data URL */
export function canPersistDataUrl(dataUrl: string): boolean {
  const probeKey = "hc-blog:wallpaper-probe";
  try {
    window.localStorage.setItem(probeKey, dataUrl);
    window.localStorage.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
}

/** 随机换一张内置壁纸（不重复当前的） */
export function randomPresetId(currentId: string): string {
  const pool = WALLPAPER_PRESETS.filter((preset) => preset.id !== currentId);
  const list = pool.length > 0 ? pool : WALLPAPER_PRESETS;
  return list[Math.floor(Math.random() * list.length)].id;
}
