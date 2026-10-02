"use client";

import { useRef, useState } from "react";
import { Check, ImagePlus, Link2, Loader2, Shuffle, TriangleAlert, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  NO_WALLPAPER,
  WALLPAPER_PRESETS,
  canPersistDataUrl,
  compressImageFile,
  randomPresetId,
  type WallpaperSettings,
  type WallpaperSource,
} from "@/lib/wallpaper";

export interface WallpaperSectionProps {
  settings: WallpaperSettings;
  onChange: (update: React.SetStateAction<WallpaperSettings>) => void;
  /** 当前实际生效的是不是深色 */
  isDark: boolean;
}

type Feedback = { kind: "error" | "ok"; text: string } | null;

function sameSource(settings: WallpaperSettings, source: WallpaperSource): boolean {
  return settings.source === source;
}

/**
 * 壁纸设置。
 *
 * 三种来源：内置预设（纯 CSS，零请求）、外链图片、本地上传（压缩后存 localStorage）。
 * 站点默认值写在 `src/lib/wallpaper.ts` 的 `DEFAULT_WALLPAPER`，
 * 访客在这里做的选择只覆盖自己的浏览器。
 */
export function WallpaperSection({ settings, onChange, isDark }: WallpaperSectionProps) {
  const [urlDraft, setUrlDraft] = useState(settings.url);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const patch = (partial: Partial<WallpaperSettings>) => {
    onChange((prev) => ({ ...prev, ...partial }));
  };

  const pickPreset = (presetId: string) => {
    setFeedback(null);
    patch({ source: "preset", presetId });
  };

  const shuffle = () => {
    setFeedback(null);
    patch({ source: "preset", presetId: randomPresetId(settings.presetId) });
  };

  const applyUrl = () => {
    const url = urlDraft.trim();
    if (!url) {
      setFeedback({ kind: "error", text: "请先粘贴一个图片地址" });
      return;
    }
    if (!/^(https?:\/\/|\/|data:image\/)/i.test(url)) {
      setFeedback({ kind: "error", text: "地址需要以 http(s):// 、/ 或 data:image/ 开头" });
      return;
    }
    setFeedback({ kind: "ok", text: "已应用外链图片" });
    patch({ source: "url", url });
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setFeedback(null);
    try {
      const dataUrl = await compressImageFile(file);
      if (!canPersistDataUrl(dataUrl)) {
        throw new Error("浏览器本地存储放不下这张图片，请换一张更小的");
      }
      patch({ source: "upload", dataUrl });
      setFeedback({
        kind: "ok",
        text: `已压缩到约 ${Math.round(dataUrl.length / 1024)}KB 并保存到本机`,
      });
    } catch (error) {
      setFeedback({
        kind: "error",
        text: error instanceof Error ? error.message : "图片处理失败，请换一张试试",
      });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const clearCustom = () => {
    setUrlDraft("");
    setFeedback(null);
    patch({ source: "preset", presetId: NO_WALLPAPER === settings.presetId ? "ink" : settings.presetId, url: "", dataUrl: "" });
  };

  const hasCustom = settings.source !== "preset";

  return (
    <div className="border-b border-stone-100 py-4 dark:border-stone-800">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-stone-800 dark:text-stone-100">壁纸</p>
          <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
            设为背景后，外壳会变成毛玻璃，让壁纸透出来
          </p>
        </div>
        <button
          type="button"
          onClick={shuffle}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-stone-200 px-2 py-1 text-[11px] font-medium text-stone-600 transition-colors hover:border-brand-300 hover:text-brand-600 dark:border-stone-700 dark:text-stone-300 dark:hover:border-brand-700 dark:hover:text-brand-400"
        >
          <Shuffle className="h-3 w-3" />
          换一张
        </button>
      </div>

      {/* 内置壁纸 */}
      <div className="grid grid-cols-3 gap-2">
        <Swatch
          label="无"
          selected={settings.source === "preset" && settings.presetId === NO_WALLPAPER}
          onClick={() => pickPreset(NO_WALLPAPER)}
          style={{ backgroundColor: isDark ? "#1c1917" : "#f5f5f4" }}
        />
        {WALLPAPER_PRESETS.map((preset) => (
          <Swatch
            key={preset.id}
            label={preset.name}
            title={preset.hint}
            selected={settings.source === "preset" && settings.presetId === preset.id}
            onClick={() => pickPreset(preset.id)}
            style={{ backgroundImage: isDark ? preset.dark : preset.light }}
          />
        ))}
      </div>

      {/* 外链 */}
      <div className="mt-3">
        <label className="mb-1 flex items-center gap-1 text-[11px] font-medium text-stone-500 dark:text-stone-400">
          <Link2 className="h-3 w-3" />
          图片直链
        </label>
        <div className="flex gap-1.5">
          <input
            type="url"
            value={urlDraft}
            onChange={(event) => setUrlDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") applyUrl();
            }}
            placeholder="https://… 或 /uploads/bg.jpg"
            className={cn(
              "min-w-0 flex-1 rounded-lg border bg-white px-2.5 py-1.5 text-xs text-stone-700 placeholder:text-stone-400 focus:outline-none dark:bg-stone-800 dark:text-stone-200",
              sameSource(settings, "url")
                ? "border-brand-400 dark:border-brand-600"
                : "border-stone-200 dark:border-stone-700",
            )}
          />
          <button
            type="button"
            onClick={applyUrl}
            className="shrink-0 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-600"
          >
            应用
          </button>
        </div>
      </div>

      {/* 上传 */}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors disabled:opacity-60",
            sameSource(settings, "upload")
              ? "border-brand-400 text-brand-600 dark:border-brand-600 dark:text-brand-400"
              : "border-stone-200 text-stone-600 hover:border-brand-300 hover:text-brand-600 dark:border-stone-700 dark:text-stone-300",
          )}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
          {busy ? "压缩中…" : "上传本地图片"}
        </button>
        {hasCustom && (
          <button
            type="button"
            onClick={clearCustom}
            title="清除自定义图片"
            className="flex shrink-0 items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-2 text-xs font-medium text-stone-500 transition-colors hover:border-brand-300 hover:text-brand-600 dark:border-stone-700 dark:text-stone-400"
          >
            <Undo2 className="h-3.5 w-3.5" />
            还原
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />
      </div>

      {feedback && (
        <p
          className={cn(
            "mt-2 flex items-start gap-1 text-[11px] leading-relaxed",
            feedback.kind === "error"
              ? "text-amber-600 dark:text-amber-400"
              : "text-jade-600 dark:text-jade-400",
          )}
        >
          {feedback.kind === "error" && <TriangleAlert className="mt-px h-3 w-3 shrink-0" />}
          {feedback.text}
        </p>
      )}

      {/* 强度 / 模糊 */}
      <div className="mt-4 space-y-3">
        <Slider
          label="壁纸强度"
          value={settings.strength}
          min={0}
          max={100}
          step={5}
          display={`${settings.strength}%`}
          onChange={(value) => patch({ strength: value })}
        />
        <Slider
          label="模糊"
          value={settings.blur}
          min={0}
          max={24}
          step={1}
          display={`${settings.blur}px`}
          onChange={(value) => patch({ blur: value })}
        />
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-stone-400">
        上传的图片只做压缩后存在你自己的浏览器里，不会上传到服务器；外链图片由对方站点提供。
        强度调到最左等于关闭壁纸。
      </p>
    </div>
  );
}

function Swatch({
  label,
  title,
  selected,
  onClick,
  style,
}: {
  label: string;
  title?: string;
  selected: boolean;
  onClick: () => void;
  style: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? label}
      aria-pressed={selected}
      className={cn(
        "group relative h-14 overflow-hidden rounded-lg border transition-all",
        selected
          ? "border-brand-500 ring-2 ring-brand-500/40"
          : "border-stone-200 hover:border-brand-300 dark:border-stone-700",
      )}
    >
      <span className="absolute inset-0 bg-cover bg-center" style={style} />
      <span
        className={cn(
          "absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 bg-black/45 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm",
          selected && "bg-brand-600/75",
        )}
      >
        {selected && <Check className="h-2.5 w-2.5" />}
        {label}
      </span>
    </button>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-[11px] font-medium text-stone-500 dark:text-stone-400">
        {label}
        <span className="font-mono text-stone-400">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={label}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-stone-200 accent-brand-500 dark:bg-stone-700"
      />
    </label>
  );
}

export default WallpaperSection;
