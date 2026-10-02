"use client";

import { usePersistentState } from "@/hooks/usePersistentState";
import {
  EMPTY_GITHUB_CONFIG,
  GITHUB_CONFIG_KEY,
  isGithubConfig,
  isGithubConfigured,
  type GithubConfig,
} from "@/lib/github-upload";

/**
 * 读取本机保存的 GitHub 配置。
 *
 * `EMPTY_GITHUB_CONFIG` 是模块级常量，引用稳定 —— 这是
 * `usePersistentState` 的硬性要求（见 AI_CONTEXT.md 硬约束 5）。
 */
export function useGithubConfig(): GithubConfig {
  const [config] = usePersistentState<GithubConfig>(
    GITHUB_CONFIG_KEY,
    EMPTY_GITHUB_CONFIG,
    isGithubConfig,
  );
  return config;
}

export interface OwnerMode {
  config: GithubConfig;
  /**
   * 是不是「站长模式」。
   *
   * 判据就是本机有没有配好 GitHub Token —— 它意味着这台浏览器持有仓库写权限，
   * 而这正是写文章、传图片、发留言、回复评论需要的**同一个凭据**。
   * 所以站点不需要再发明一套登录系统：能写仓库的人就是站长。
   */
  isOwner: boolean;
}

export function useOwnerMode(): OwnerMode {
  const config = useGithubConfig();
  return { config, isOwner: isGithubConfigured(config) };
}
