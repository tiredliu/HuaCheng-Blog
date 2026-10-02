"use client";

import { useState } from "react";
import { CloudUpload, LoaderCircle, Monitor, Moon, RotateCcw, Sun, SunMoon, TriangleAlert, Type, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SITE } from "@/lib/site";
import { WallpaperSection } from "@/components/WallpaperSettings";
import { GithubTokenConfig, isGithubConfigured } from "@/components/GithubTokenConfig";
import type { ThemePreference } from "@/components/BlogLayout";
import type { WallpaperSettings } from "@/lib/wallpaper";
import { usePersistentState } from "@/hooks/usePersistentState";
import {
  GITHUB_CONFIG_KEY,
  isGithubConfig,
  writeRepoFile,
  type GithubConfig,
} from "@/lib/github-upload";
import {
  SITE_SETTINGS_PATH,
  diffSiteSettings,
  serializeSiteSettings,
  type ContentWidth,
  type FontScale,
  type SiteSettings,
} from "@/lib/site-settings";

export type { ContentWidth, FontScale };

export interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  themePreference: ThemePreference;
  onThemePreferenceChange: (preference: ThemePreference) => void;
  fontScale: FontScale;
  onFontScaleChange: (scale: FontScale) => void;
  contentWidth: ContentWidth;
  onContentWidthChange: (width: ContentWidth) => void;
  sidebarWidth: number;
  onSidebarWidthChange: (width: number) => void;
  wallpaper: WallpaperSettings;
  onWallpaperChange: (update: React.SetStateAction<WallpaperSettings>) => void;
  /** 当前实际生效的是不是深色（用于壁纸预览配色） */
  isDark: boolean;
  /** 构建期读到的站点默认值 */
  siteSettings: SiteSettings;
  /** 当前这组设置，用于和站点默认值比对 */
  currentSettings: SiteSettings;
  onReset: () => void;
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-stone-100 py-4 last:border-b-0 dark:border-stone-800">
      <div className="mb-2">
        <p className="text-sm font-medium text-stone-800 dark:text-stone-100">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string; icon?: React.ReactNode }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg bg-stone-100 p-1 dark:bg-stone-800">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            "flex flex-1 items-center justify-center gap-1 rounded-md px-1.5 py-1.5 text-[11px] font-medium whitespace-nowrap transition-colors",
            value === option.value
              ? "bg-white text-brand-600 shadow-sm dark:bg-stone-700 dark:text-brand-300"
              : "text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100",
          )}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * 设置抽屉。对应设计图右上角的「设置」按钮。
 *
 * 分成两层：
 * - **访客偏好**（已登录的那几个控件）写进 localStorage，只影响自己
 * - **站点默认值**存在仓库的 `content/site-settings.json`，构建期注入 HTML，
 *   对所有访客生效；修改它需要 GitHub Token（见下面的「站点默认」区块）
 */
export function SettingsPanel({
  isOpen,
  onClose,
  themePreference,
  onThemePreferenceChange,
  fontScale,
  onFontScaleChange,
  contentWidth,
  onContentWidthChange,
  sidebarWidth,
  onSidebarWidthChange,
  wallpaper,
  onWallpaperChange,
  isDark,
  siteSettings,
  currentSettings,
  onReset,
}: SettingsPanelProps) {
  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-60 bg-stone-900/30 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden
        />
      )}

      <section
        role="dialog"
        aria-label="站点设置"
        aria-hidden={!isOpen}
        inert={!isOpen}
        className={cn(
          "fixed inset-y-0 right-0 z-70 flex w-[88vw] max-w-[360px] flex-col border-l border-stone-200 bg-white shadow-float transition-transform duration-300 ease-out dark:border-stone-800 dark:bg-stone-900",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex items-center justify-between border-b border-stone-200 px-4 py-3 dark:border-stone-800">
          <div>
            <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">外观设置</h2>
            <p className="mt-0.5 text-[11px] text-stone-500 dark:text-stone-400">
              偏好保存在本机浏览器
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭设置"
            className="grid h-7 w-7 place-items-center rounded-md text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4">
          <Row label="主题" hint="「跟随系统」会随着操作系统的深浅色设置切换">
            <Segmented<ThemePreference>
              value={themePreference}
              onChange={onThemePreferenceChange}
              options={[
                { value: "system", label: "跟随系统", icon: <SunMoon className="h-3.5 w-3.5" /> },
                { value: "light", label: "浅色", icon: <Sun className="h-3.5 w-3.5" /> },
                { value: "dark", label: "深色", icon: <Moon className="h-3.5 w-3.5" /> },
              ]}
            />
          </Row>

          <Row label="正文字号" hint="同时影响全站界面尺寸">
            <Segmented<FontScale>
              value={fontScale}
              onChange={onFontScaleChange}
              options={[
                { value: "sm", label: "小" },
                { value: "md", label: "标准" },
                { value: "lg", label: "大", icon: <Type className="h-3.5 w-3.5" /> },
              ]}
            />
          </Row>

          <Row label="内容区宽度" hint="阅读感受更紧凑，还是显示更多信息">
            <Segmented<ContentWidth>
              value={contentWidth}
              onChange={onContentWidthChange}
              options={[
                { value: "comfortable", label: "舒适" },
                { value: "wide", label: "宽敞", icon: <Monitor className="h-3.5 w-3.5" /> },
              ]}
            />
          </Row>

          <WallpaperSection settings={wallpaper} onChange={onWallpaperChange} isDark={isDark} />

          <Row label="左侧导航宽度" hint={`当前 ${sidebarWidth}px，也可以直接拖拽导航栏右边缘`}>
            <input
              type="range"
              min={220}
              max={400}
              step={4}
              value={sidebarWidth}
              onChange={(event) => onSidebarWidthChange(Number(event.target.value))}
              aria-label="左侧导航宽度"
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-stone-200 accent-brand-500 dark:bg-stone-700"
            />
          </Row>

          <SiteDefaultsSection
            siteSettings={siteSettings}
            currentSettings={currentSettings}
            onResetToSiteDefaults={onReset}
          />

          <Row label="偏好存储" hint="访客偏好与站点默认值是两个独立的层">
            <div className="space-y-2 text-xs leading-relaxed text-stone-500 dark:text-stone-400">
              <p>
                <strong className="font-medium text-stone-600 dark:text-stone-300">访客偏好</strong>
                （主题、字号、壁纸、侧栏宽度）存在浏览器 <code>localStorage</code>，
                只影响你自己，换设备或清理缓存后会回到站点默认值。
              </p>
              <p>
                <strong className="font-medium text-stone-600 dark:text-stone-300">站点默认值</strong>
                存在仓库的 <code>{SITE_SETTINGS_PATH}</code>，构建时注入 HTML ——
                所以「站点默认深色」的首次访客也不会闪白屏。改它需要 GitHub Token。
              </p>
            </div>
          </Row>
        </div>

        <footer className="border-t border-stone-200 p-4 dark:border-stone-800">
          <button
            type="button"
            onClick={onReset}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-xs font-medium text-stone-600 transition-colors hover:border-brand-300 hover:text-brand-600 dark:border-stone-700 dark:text-stone-300 dark:hover:border-brand-700 dark:hover:text-brand-400"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            恢复站点默认值
          </button>
          <p className="mt-3 text-center text-[11px] text-stone-400">
            {SITE.name} · Next.js 静态导出 · Cloudflare Pages 托管
          </p>
        </footer>
      </section>
    </>
  );
}

/**
 * 站点默认值区块。
 *
 * 把当前这组设置写进仓库的 `content/site-settings.json`，
 * 提交后 Cloudflare Pages 会重新构建，之后**所有访客**（包括换设备的你）
 * 打开站点看到的默认值就是这一套。
 */
function SiteDefaultsSection({
  siteSettings,
  currentSettings,
  onResetToSiteDefaults,
}: {
  siteSettings: SiteSettings;
  currentSettings: SiteSettings;
  onResetToSiteDefaults: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [config] = usePersistentState<GithubConfig>(
    GITHUB_CONFIG_KEY,
    { token: "", owner: "", repo: "", branch: "main" },
    isGithubConfig,
  );

  const changed = diffSiteSettings(currentSettings, siteSettings);
  const configured = isGithubConfigured(config);

  const save = async () => {
    if (!configured) {
      setNotice({ kind: "error", text: "请先展开下面的「GitHub Token 配置」" });
      return;
    }

    setBusy(true);
    setNotice(null);
    try {
      const payload: SiteSettings = {
        ...currentSettings,
        updatedAt: new Date().toISOString(),
      };
      await writeRepoFile(
        config,
        SITE_SETTINGS_PATH,
        serializeSiteSettings(payload),
        "chore(settings): 更新站点默认设置",
      );
      setNotice({
        kind: "ok",
        text: "已提交到仓库。Cloudflare 重新构建（约 1–2 分钟）后对所有访客生效。",
      });
    } catch (error) {
      setNotice({
        kind: "error",
        text: error instanceof Error ? error.message : "保存失败，请稍后再试",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Row
      label="站点默认值"
      hint={`写入仓库的 ${SITE_SETTINGS_PATH}，对所有访客生效`}
    >
      <div className="space-y-2">
        {changed.length > 0 ? (
          <p className="rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] leading-relaxed text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
            当前设置和站点默认值不同：{changed.join("、")}。保存后会覆盖站点默认值。
          </p>
        ) : (
          <p className="rounded-lg bg-jade-400/10 px-2.5 py-2 text-[11px] leading-relaxed text-jade-600 dark:text-jade-400">
            当前设置与站点默认值一致。
          </p>
        )}

        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-500 px-2.5 py-2 text-xs font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-60"
          >
            {busy ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CloudUpload className="h-3.5 w-3.5" />
            )}
            {busy ? "提交中…" : "保存为站点默认"}
          </button>
          <button
            type="button"
            onClick={onResetToSiteDefaults}
            title="清掉本机偏好，回到站点默认值"
            className="shrink-0 rounded-lg border border-stone-200 px-2.5 py-2 text-xs text-stone-500 transition-colors hover:border-brand-300 hover:text-brand-600 dark:border-stone-700 dark:text-stone-400"
          >
            恢复
          </button>
        </div>

        {notice && (
          <p
            className={cn(
              "flex items-start gap-1 text-[11px] leading-relaxed",
              notice.kind === "error"
                ? "text-amber-600 dark:text-amber-400"
                : "text-jade-600 dark:text-jade-400",
            )}
          >
            {notice.kind === "error" && <TriangleAlert className="mt-px h-3 w-3 shrink-0" />}
            {notice.text}
          </p>
        )}

        <p className="text-[10px] leading-relaxed text-stone-400">
          访客自己改过的偏好会覆盖站点默认值，不会影响别人。
          想直接改文件也行：编辑 <code>{SITE_SETTINGS_PATH}</code> 后 push。
        </p>

        <GithubTokenConfig onNotice={(message) => setNotice({ kind: "ok", text: message })} />
      </div>
    </Row>
  );
}

export default SettingsPanel;
