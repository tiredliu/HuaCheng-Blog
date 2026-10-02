"use client";

import { GiscusComments } from "@/components/GiscusComments";
import { useThemeState } from "@/components/ThemeContext";
import type { GiscusConfig } from "@/lib/site-settings";

export interface PostCommentsProps {
  config: GiscusConfig | null;
}

/**
 * 文章底部的评论区。
 *
 * 单独包一层的理由：Giscus 需要知道「当前是不是深色」来同步配色，
 * 而这是客户端才知道的状态（类名 + 系统偏好共同决定），
 * 所以从 ThemeContext 里取，服务端的站点配置则通过 props 传进来。
 */
export function PostComments({ config }: PostCommentsProps) {
  const { isDark } = useThemeState();
  return <GiscusComments config={config} isDark={isDark} />;
}

export default PostComments;
