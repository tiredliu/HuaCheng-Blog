"use client";

import { useState } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { SITE } from "@/lib/site";
import { usePersistentState } from "@/hooks/usePersistentState";
import {
  GITHUB_CONFIG_KEY,
  isGithubConfig,
  parseRepoUrl,
  type GithubConfig,
} from "@/lib/github-upload";

const GUESSED_REPO = parseRepoUrl(SITE.repository);

export const EMPTY_GITHUB_CONFIG: GithubConfig = {
  token: "",
  owner: GUESSED_REPO?.owner ?? "",
  repo: GUESSED_REPO?.repo ?? "",
  branch: "main",
};

export function isGithubConfigured(config: GithubConfig): boolean {
  return Boolean(config.token && config.owner && config.repo);
}

/**
 * GitHub Token 配置块。
 *
 * 两处会用到它：壁纸的「上传到仓库」、以及设置的「保存为站点默认」。
 * 都是走 GitHub Contents API 直接写仓库，所以共用同一份配置。
 */
export function GithubTokenConfig({
  defaultOpen = false,
  onNotice,
}: {
  defaultOpen?: boolean;
  onNotice?: (message: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [showToken, setShowToken] = useState(false);
  const [config, setConfig] = usePersistentState<GithubConfig>(
    GITHUB_CONFIG_KEY,
    EMPTY_GITHUB_CONFIG,
    isGithubConfig,
  );

  const configured = isGithubConfigured(config);

  return (
    <div className="rounded-lg border border-stone-200 dark:border-stone-700">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-[11px] font-medium text-stone-600 dark:text-stone-300"
      >
        <KeyRound className="h-3 w-3" />
        GitHub Token 配置
        <span
          className={cn(
            "ml-auto rounded-full px-1.5 py-0.5 text-[10px]",
            configured
              ? "bg-jade-400/15 text-jade-600 dark:text-jade-400"
              : "bg-stone-100 text-stone-400 dark:bg-stone-800",
          )}
        >
          {configured ? "已配置" : "未配置"}
        </span>
      </button>

      {open && (
        <div className="space-y-2 border-t border-stone-200 px-3 py-2.5 dark:border-stone-700">
          <p className="text-[11px] leading-relaxed text-stone-500 dark:text-stone-400">
            需要 GitHub 的 <strong>fine-grained token</strong>，权限只勾这一个仓库的{" "}
            <code>Contents: Read and write</code>。token 只保存在本机浏览器，
            也只会发往 <code>api.github.com</code>。
          </p>

          <label className="block">
            <span className="text-[11px] text-stone-500 dark:text-stone-400">Token</span>
            <div className="mt-0.5 flex gap-1">
              <input
                type={showToken ? "text" : "password"}
                value={config.token}
                onChange={(event) => setConfig((prev) => ({ ...prev, token: event.target.value }))}
                placeholder="github_pat_…"
                autoComplete="off"
                spellCheck={false}
                className="min-w-0 flex-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 font-mono text-[11px] text-stone-700 focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200"
              />
              <button
                type="button"
                onClick={() => setShowToken((prev) => !prev)}
                aria-label={showToken ? "隐藏 token" : "显示 token"}
                className="grid w-8 shrink-0 place-items-center rounded-lg border border-stone-200 text-stone-400 dark:border-stone-700"
              >
                {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </label>

          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                ["owner", "owner", "hua-cheng"],
                ["repo", "repo", "hua-cheng-blog"],
                ["branch", "分支", "main"],
              ] as const
            ).map(([field, label, placeholder]) => (
              <label key={field} className="block">
                <span className="text-[11px] text-stone-500 dark:text-stone-400">{label}</span>
                <input
                  value={config[field]}
                  onChange={(event) =>
                    setConfig((prev) => ({ ...prev, [field]: event.target.value.trim() }))
                  }
                  placeholder={placeholder}
                  spellCheck={false}
                  className="mt-0.5 w-full rounded-lg border border-stone-200 bg-white px-2 py-1.5 font-mono text-[11px] text-stone-700 focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200"
                />
              </label>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                window.localStorage.removeItem(GITHUB_CONFIG_KEY);
                setConfig(EMPTY_GITHUB_CONFIG);
                onNotice?.("已清除本机保存的 token");
              }}
              className="rounded-lg border border-stone-200 px-2 py-1 text-[11px] text-stone-500 hover:border-brand-300 hover:text-brand-600 dark:border-stone-700 dark:text-stone-400"
            >
              清除 token
            </button>
            <p className="text-[10px] leading-tight text-stone-400">换设备需要重新填一次。</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default GithubTokenConfig;
