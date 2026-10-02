"use client";

import { resolveWallpaper, type WallpaperSettings } from "@/lib/wallpaper";

export interface WallpaperLayerProps {
  settings: WallpaperSettings;
  isDark: boolean;
}

/**
 * 全屏壁纸层，固定在视口最底层。
 *
 * 关键点是 `-z-10` 配合外层的 `isolate`：
 * 负 z-index 的子元素会画在「父元素自身背景之上、其它内容之下」，
 * 所以它既能盖住页面的底色，又不会压在正文上。
 *
 * 模糊时用 `-inset-10` 把画布撑大，避免边缘出现透明羽化带。
 */
export function WallpaperLayer({ settings, isDark }: WallpaperLayerProps) {
  const resolved = resolveWallpaper(settings, isDark);
  if (!resolved) return null;

  // 强度越低，遮罩越浓 —— 浅色用白、深色用黑，都是「把壁纸推远」
  const veil = ((100 - Math.min(100, Math.max(0, settings.strength))) / 100) * 0.85;
  const blur = Math.min(24, Math.max(0, settings.blur));

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div
        className="absolute -inset-10 bg-cover bg-center bg-no-repeat transition-[background-image,filter] duration-500 ease-out"
        style={{
          backgroundImage: resolved.backgroundImage,
          filter: blur > 0 ? `blur(${blur}px)` : undefined,
        }}
      />
      {veil > 0 && (
        <div
          className="absolute inset-0"
          style={{ backgroundColor: isDark ? `rgb(0 0 0 / ${veil})` : `rgb(255 255 255 / ${veil})` }}
        />
      )}
    </div>
  );
}

export default WallpaperLayer;
