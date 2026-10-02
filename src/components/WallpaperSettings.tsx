"use client";

import { useMemo, useRef, useState } from "react";
import {
  Check,
  CloudUpload,
  ImagePlus,
  Link2,
  LoaderCircle,
  Shuffle,
  Trash2,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePersistentState } from "@/hooks/usePersistentState";
import {
  GithubTokenConfig,
  EMPTY_GITHUB_CONFIG,
  isGithubConfigured,
} from "@/components/GithubTokenConfig";
import {
  MAX_WALLPAPER_UPLOADS,
  NO_WALLPAPER,
  WALLPAPER_PRESETS,
  WALLPAPER_UPLOADS_KEY,
  isWallpaperUploadArray,
  randomPresetId,
  sortAndTrimUploads,
  type WallpaperSettings,
  type WallpaperUpload,
} from "@/lib/wallpaper";
import {
  GITHUB_CONFIG_KEY,
  deleteRepoFile,
  isGithubConfig,
  uploadImageToRepo,
  type GithubConfig,
} from "@/lib/github-upload";
import {
  buildUploadFileName,
  canPersistDataUrl,
  compressImageFile,
  makeThumbnail,
} from "@/lib/image-utils";

export interface WallpaperSectionProps {
  settings: WallpaperSettings;
  onChange: (update: React.SetStateAction<WallpaperSettings>) => void;
  /** 当前实际生效的是不是深色 */
  isDark: boolean;
}

type Feedback = { kind: "error" | "ok"; text: string } | null;

/**
 * 壁纸设置。
 *
 * 四种来源：内置预设（纯 CSS，零请求）、图片链接、
 * 直传仓库 `public/uploads/`（不需要后端，见 github-upload.ts）、
 * 以及只存在本机浏览器的图片。
 */
export function WallpaperSection({ settings, onChange, isDark }: WallpaperSectionProps) {
  const [urlDraft, setUrlDraft] = useState(settings.url);
  const [busy, setBusy] = useState<"" | "repo" | "local">("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  /** 两个上传按钮共用一个 file input，用它记住这次是谁触发的 */
  const uploadIntent = useRef<"repo" | "local">("repo");

  const [config] = usePersistentState<GithubConfig>(
    GITHUB_CONFIG_KEY,
    EMPTY_GITHUB_CONFIG,
    isGithubConfig,
  );
  const [uploads, setUploads] = usePersistentState<WallpaperUpload[]>(
    WALLPAPER_UPLOADS_KEY,
    [],
    isWallpaperUploadArray,
  );

  const configured = isGithubConfigured(config);

  const activeUploadUrl = useMemo(
    () => (settings.source === "url" ? settings.url : ""),
    [settings.source, settings.url],
  );

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
    setFeedback({ kind: "ok", text: "已应用这张图片" });
    patch({ source: "url", url });
  };

  /** 直传仓库：这是「无后端上传」的主路径 */
  const handleRepoUpload = async (file: File | undefined) => {
    if (!file) return;
    if (!configured) {
      setFeedback({
        kind: "error",
        text: "请先展开下面的「GitHub Token 配置」填好 token 与仓库信息",
      });
      return;
    }

    setBusy("repo");
    setFeedback(null);
    try {
      const [compressed, thumb] = await Promise.all([
        compressImageFile(file),
        makeThumbnail(file).catch(() => ""),
      ]);

      const fileName = buildUploadFileName(file.name);
      const result = await uploadImageToRepo(config, compressed.blob, fileName);

      const entry: WallpaperUpload = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        url: result.url,
        path: result.path,
        name: fileName,
        size: compressed.size,
        createdAt: new Date().toISOString(),
        thumb,
        fallbackUrl: result.fallbackUrl,
      };

      setUploads((prev) => sortAndTrimUploads([entry, ...prev]));
      patch({ source: "url", url: result.url });
      setUrlDraft(result.url);
      setFeedback({
        kind: "ok",
        text:
          `已提交到仓库（${Math.round(compressed.size / 1024)}KB）。` +
          `Cloudflare Pages 重新构建需要 1–2 分钟，期间会先用 GitHub 原始地址显示。`,
      });
    } catch (error) {
      setFeedback({
        kind: "error",
        text: error instanceof Error ? error.message : "上传失败，请稍后再试",
      });
    } finally {
      setBusy("");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  /** 只存本机：不需要任何配置，但换设备就没了 */
  const handleLocalUpload = async (file: File | undefined) => {
    if (!file) return;
    setBusy("local");
    setFeedback(null);
    try {
      const compressed = await compressImageFile(file, { requireDataUrl: true });
      if (!canPersistDataUrl(compressed.dataUrl)) {
        throw new Error("浏览器本地存储放不下这张图片，请换一张更小的，或改用「上传到仓库」");
      }
      patch({ source: "upload", dataUrl: compressed.dataUrl });
      setFeedback({
        kind: "ok",
        text: `已压缩到约 ${Math.round(compressed.dataUrl.length / 1024)}KB，只保存在本机浏览器`,
      });
    } catch (error) {
      setFeedback({
        kind: "error",
        text: error instanceof Error ? error.message : "图片处理失败，请换一张试试",
      });
    } finally {
      setBusy("");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeUpload = async (entry: WallpaperUpload, alsoDeleteFile: boolean) => {
    if (alsoDeleteFile) {
      if (!configured) {
        setFeedback({ kind: "error", text: "要同时删除仓库里的文件，需要先配置 GitHub Token" });
        return;
      }
      const confirmed = window.confirm(
        `确定要从仓库删除 ${entry.path} 吗？\n这会提交一次 commit，并触发一次重新部署。`,
      );
      if (!confirmed) return;

      setBusy("repo");
      try {
        await deleteRepoFile(config, entry.path);
        setFeedback({ kind: "ok", text: `已从仓库删除 ${entry.name}` });
      } catch (error) {
        setFeedback({
          kind: "error",
          text: error instanceof Error ? error.message : "删除失败",
        });
        setBusy("");
        return;
      }
      setBusy("");
    }

    setUploads((prev) => prev.filter((item) => item.id !== entry.id));
    if (settings.url === entry.url) {
      patch({ source: "preset", presetId: "ink", url: "" });
      setUrlDraft("");
    }
  };

  const clearCustom = () => {
    setUrlDraft("");
    setFeedback(null);
    patch({
      source: "preset",
      presetId: settings.presetId === NO_WALLPAPER ? "ink" : settings.presetId,
      url: "",
      dataUrl: "",
    });
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

      {/* 内置预设 */}
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

      {/* 我的上传：直传仓库的壁纸都在这里选 */}
      <div className="mt-4">
        <p className="mb-1.5 flex items-center gap-1 text-[11px] font-medium text-stone-500 dark:text-stone-400">
          <CloudUpload className="h-3 w-3" />
          我的上传（{uploads.length}/{MAX_WALLPAPER_UPLOADS}）
        </p>

        {uploads.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-300 px-3 py-3 text-[11px] leading-relaxed text-stone-400 dark:border-stone-700">
            还没有上传过图片。上传成功后会出现在这里，点一下就切换过去。
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {uploads.map((entry) => (
              <UploadSwatch
                key={entry.id}
                entry={entry}
                selected={activeUploadUrl === entry.url}
                onSelect={() => {
                  setFeedback(null);
                  setUrlDraft(entry.url);
                  patch({ source: "url", url: entry.url });
                }}
                onRemove={(alsoDeleteFile) => void removeUpload(entry, alsoDeleteFile)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 上传按钮 */}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            uploadIntent.current = "repo";
            fileRef.current?.click();
          }}
          disabled={busy !== ""}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-stone-200 px-2.5 py-2 text-xs font-medium text-stone-600 transition-colors hover:border-brand-300 hover:text-brand-600 disabled:opacity-60 dark:border-stone-700 dark:text-stone-300"
        >
          {busy ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CloudUpload className="h-3.5 w-3.5" />
          )}
          {busy === "repo" ? "上传中…" : "上传到仓库"}
        </button>

        <button
          type="button"
          onClick={() => {
            uploadIntent.current = "local";
            fileRef.current?.click();
          }}
          disabled={busy !== ""}
          title="只保存在本机浏览器，不上传任何服务器"
          className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-stone-200 px-2.5 py-2 text-xs font-medium text-stone-500 transition-colors hover:border-stone-300 disabled:opacity-60 dark:border-stone-700 dark:text-stone-400"
        >
          <ImagePlus className="h-3.5 w-3.5" />
          只存本机
        </button>

        {hasCustom && (
          <button
            type="button"
            onClick={clearCustom}
            title="清除自定义图片"
            className="flex shrink-0 items-center rounded-lg border border-stone-200 px-2 py-2 text-xs text-stone-500 transition-colors hover:border-brand-300 hover:text-brand-600 dark:border-stone-700 dark:text-stone-400"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
        )}

        {/* 两个入口共用一个 file input，靠触发它的按钮区分去向 —— 这里用 ref 上挂的意图 */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            if (uploadIntent.current === "local") void handleLocalUpload(file);
            else void handleRepoUpload(file);
          }}
        />
      </div>

      <p className="mt-1.5 text-[11px] leading-relaxed text-stone-400">
        「上传到仓库」会把图片提交到 <code>public/uploads/</code>，任何访客都能看到，
        适合当站点壁纸；「只存本机」不会上传，只有你自己看得见。
      </p>

      {/* 图片直链 */}
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
              activeUploadUrl
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

{/* GitHub 配置：与「保存为站点默认」共用同一份配置 */}
<div className="mt-3">
  <GithubTokenConfig onNotice={(message) => setFeedback({ kind: "ok", text: message })} />
</div>

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
        强度调到最左等于关闭壁纸。上传到仓库的图片由 GitHub 保存，
        会随仓库一起公开；只存本机的图片不会离开这台设备。
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 子组件                                                              */
/* ------------------------------------------------------------------ */

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

/** 已上传的壁纸：点选切换，右上角按钮可以删（可选是否同时删仓库文件） */
function UploadSwatch({
  entry,
  selected,
  onSelect,
  onRemove,
}: {
  entry: WallpaperUpload;
  selected: boolean;
  onSelect: () => void;
  onRemove: (alsoDeleteFile: boolean) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onSelect}
        title={`${entry.name}（${Math.round(entry.size / 1024)}KB）`}
        aria-pressed={selected}
        className={cn(
          "group relative h-14 w-full overflow-hidden rounded-lg border transition-all",
          selected
            ? "border-brand-500 ring-2 ring-brand-500/40"
            : "border-stone-200 hover:border-brand-300 dark:border-stone-700",
        )}
      >
        {entry.thumb ? (
          <span className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url("${entry.thumb}")` }} />
        ) : (
          <span className="absolute inset-0 bg-stone-200 dark:bg-stone-700" />
        )}
        <span
          className={cn(
            "absolute inset-x-0 bottom-0 truncate bg-black/45 px-1 py-0.5 text-[9px] font-medium text-white backdrop-blur-sm",
            selected && "bg-brand-600/75",
          )}
        >
          {selected ? "使用中" : entry.name.replace(/\.jpg$/, "")}
        </span>
      </button>

      <button
        type="button"
        onClick={() => setMenuOpen((prev) => !prev)}
        aria-label="删除这张壁纸"
        className="absolute -top-1.5 -right-1.5 grid h-5 w-5 place-items-center rounded-full border border-stone-200 bg-white text-stone-400 shadow-sm transition-colors hover:text-brand-600 dark:border-stone-600 dark:bg-stone-800"
      >
        <Trash2 className="h-2.5 w-2.5" />
      </button>

      {menuOpen && (
        <div className="absolute top-4 right-0 z-10 w-36 overflow-hidden rounded-lg border border-stone-200 bg-white text-[11px] shadow-float dark:border-stone-700 dark:bg-stone-800">
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onRemove(false);
            }}
            className="block w-full px-2.5 py-1.5 text-left text-stone-600 hover:bg-stone-50 dark:text-stone-300 dark:hover:bg-stone-700"
          >
            从列表移除
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onRemove(true);
            }}
            className="block w-full px-2.5 py-1.5 text-left text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
          >
            同时删除仓库文件
          </button>
        </div>
      )}
    </div>
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
