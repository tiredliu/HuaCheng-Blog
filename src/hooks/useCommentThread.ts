"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useOwnerMode } from "@/hooks/useOwnerMode";
import { usePersistentState } from "@/hooks/usePersistentState";
import {
  COMMENT_LIKES_KEY,
  appendLocalComment,
  createLocalComment,
  fetchRemoteComments,
  isBooleanMap,
  isRemoteReady,
  mergeComments,
  mutateRemoteComments,
  type CommentItem,
  type InteractionSettings,
} from "@/lib/interactions";
import { deleteCommentFromRepo, saveCommentToRepo } from "@/lib/repo-comments";

export interface CommentThreadOptions {
  /**
   * 仓库里的目标：`GUESTBOOK_PATH`（全站留言板）或文章 slug。
   * 站长发布的留言 / 回复会提交到 `content/guestbook.json` 或 `content/comments.json`。
   */
  target: string;
  /** 互动服务里的 path（文章 slug 需要过 `toPathKey()`，中文 slug 才不会 400） */
  pathKey: string;
  /** 构建期从仓库读到的公开评论 */
  repoComments: CommentItem[];
  settings: InteractionSettings;
  /** 只存在这台浏览器里的评论 */
  localComments: CommentItem[];
  setLocalComments: (updater: (prev: CommentItem[]) => CommentItem[]) => void;
}

export interface CommentThreadNotice {
  kind: "ok" | "error";
  text: string;
}

export interface CommentThreadState {
  comments: CommentItem[];
  /** 本机点赞过的评论 id */
  likedIds: Record<string, boolean>;
  isOwner: boolean;
  /** 远程互动服务可用（此时访客的评论是全局可见的） */
  remoteReady: boolean;
  busyId: string | null;
  notice: CommentThreadNotice | null;
  setNotice: (notice: CommentThreadNotice | null) => void;
  submit: (author: string, content: string) => Promise<void>;
  reply: (id: string, text: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  toggleLike: (id: string) => void;
}

/**
 * 评论 / 留言的共同逻辑：合并三个来源、发表、回复、删除。
 *
 * 三条来源分别是：
 *
 * | 来源 | 谁能写 | 谁看得见 |
 * | --- | --- | --- |
 * | 仓库文件（`content/guestbook.json` / `comments.json`） | 站长（GitHub Token） | 所有人 |
 * | 互动服务（Cloudflare Worker + KV） | 访客可发表；回复/删除需要站长凭据 | 所有人 |
 * | 本机 `localStorage` | 任何人 | 只有自己 |
 *
 * 「**访客能发言、回复只有站长能做**」这条规则在两个后端上都是强制的：
 * Worker 会拿 token 去 GitHub 校验 `permissions.push`，
 * 而写仓库文件本来就必须有仓库写权限。前端只是把入口显示出来而已。
 */
export function useCommentThread({
  target,
  pathKey,
  repoComments,
  settings,
  localComments,
  setLocalComments,
}: CommentThreadOptions): CommentThreadState {
  const { config, isOwner } = useOwnerMode();

  // 把配置收敛成稳定引用：它要进 effect 依赖，直接依赖对象会反复触发
  const connection = useMemo(
    () => ({ provider: settings.provider, apiBase: settings.apiBase }),
    [settings.provider, settings.apiBase],
  );
  const remoteReady = isRemoteReady(connection);

  const [remoteComments, setRemoteComments] = useState<CommentItem[] | null>(null);
  /** 本地没写进任何后端、但已经生效的改动（回复后立刻显示，不等重新构建） */
  const [overrides, setOverrides] = useState<Record<string, Partial<CommentItem>>>({});
  const [likedIds, setLikedIds] = usePersistentState<Record<string, boolean>>(
    COMMENT_LIKES_KEY,
    {},
    isBooleanMap,
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<CommentThreadNotice | null>(null);

  // 远程模式下把服务端已有的评论拉下来（本机模式不会发任何请求）
  useEffect(() => {
    if (!remoteReady) return;
    let cancelled = false;

    void fetchRemoteComments(pathKey, connection).then((list) => {
      if (!cancelled && list) setRemoteComments(list);
    });

    return () => {
      cancelled = true;
    };
  }, [connection, pathKey, remoteReady]);

  const comments = useMemo(() => {
    const serverSide = [...repoComments, ...(remoteComments ?? [])];
    const merged = mergeComments(serverSide, localComments);
    return merged.map((item) => {
      const patch = overrides[item.id];
      return patch ? { ...item, ...patch } : item;
    });
  }, [localComments, overrides, remoteComments, repoComments]);

  const removeLocal = useCallback(
    (id: string) => {
      setLocalComments((prev) => prev.filter((item) => item.id !== id));
    },
    [setLocalComments],
  );

  const submit = useCallback(
    async (author: string, content: string) => {
      const text = content.trim();
      if (!text) return;

      const comment = createLocalComment(author, text, isOwner);

      // 先落到本机：哪怕后端挂了、或者站长还没提交完，写下的字也不会丢
      setLocalComments((prev) => appendLocalComment(prev, comment));
      setNotice(null);
      setBusyId(comment.id);

      try {
        // ① 远程可用：交给互动服务，所有人都能看到
        if (remoteReady) {
          const result = await mutateRemoteComments(pathKey, connection, {
            comment,
            ...(isOwner ? { githubToken: config.token } : {}),
          });

          if (result.ok) {
            setRemoteComments(result.data);
            removeLocal(comment.id);
            setNotice({
              kind: "ok",
              text: isOwner ? "已发布（站长身份）" : "已发布，所有人都能看到",
            });
            return;
          }

          // 站长遇到远程失败 → 退回仓库提交；普通访客只能如实说明
          if (!isOwner) {
            setNotice({ kind: "error", text: `${result.error}。这条评论只保存在本机浏览器。` });
            return;
          }
        }

        // ② 站长但远程不可用：提交进仓库，构建后对所有访客生效
        if (isOwner) {
          await saveCommentToRepo(config, target, comment);
          setOverrides((prev) => ({ ...prev, [comment.id]: { pending: true } }));
          setNotice({
            kind: "ok",
            text: remoteReady
              ? "互动服务不可用，已改为提交到仓库。重新构建（约 1–2 分钟）后对所有访客可见。"
              : "已提交到仓库。Cloudflare 重新构建（约 1–2 分钟）后对所有访客可见。",
          });
          return;
        }

        // ③ 普通访客且没有远程服务：如实说明它只在这台浏览器里
        setNotice({
          kind: "ok",
          text: "已保存在本机浏览器。纯静态站点没有收件箱，站长看不到这条内容 —— 想让他看到，请用邮件或 GitHub 联系。",
        });
      } catch (error) {
        setNotice({
          kind: "error",
          text: error instanceof Error ? error.message : "发布失败，请稍后再试",
        });
      } finally {
        setBusyId(null);
      }
    },
    [
      config,
      connection,
      isOwner,
      pathKey,
      remoteReady,
      removeLocal,
      setLocalComments,
      target,
    ],
  );

  const reply = useCallback(
    async (id: string, text: string) => {
      const value = text.trim();
      if (!value || !isOwner) return;

      const current = comments.find((item) => item.id === id);
      if (!current) return;

      const replyAt = new Date().toISOString();
      setBusyId(id);
      setNotice(null);

      try {
        // 这条评论在互动服务里 → 让服务端写回复（服务端会校验站长身份）
        if (remoteReady && remoteComments?.some((item) => item.id === id)) {
          const result = await mutateRemoteComments(pathKey, connection, {
            replyTo: id,
            reply: value,
            githubToken: config.token,
          });

          if (result.ok) {
            setRemoteComments(result.data);
            setNotice({ kind: "ok", text: "回复已发布" });
            return;
          }

          // 服务端拒绝（例如 token 没有仓库写权限）时不要装作成功
          if (result.error.includes("站长")) {
            setNotice({ kind: "error", text: result.error });
            return;
          }
        }

        // 否则把「这条评论 + 回复」一起 upsert 进仓库文件
        await saveCommentToRepo(config, target, {
          ...current,
          reply: value,
          replyAt,
        });
        setOverrides((prev) => ({ ...prev, [id]: { reply: value, replyAt } }));
        setNotice({
          kind: "ok",
          text: "回复已提交到仓库，重新构建（约 1–2 分钟）后对所有访客可见。",
        });
      } catch (error) {
        setNotice({
          kind: "error",
          text: error instanceof Error ? error.message : "回复失败，请稍后再试",
        });
      } finally {
        setBusyId(null);
      }
    },
    [comments, config, connection, isOwner, pathKey, remoteComments, remoteReady, target],
  );

  const remove = useCallback(
    async (id: string) => {
      setNotice(null);

      // 本机那份直接删掉（访客也能删自己的）
      removeLocal(id);

      if (!isOwner) return;

      setBusyId(id);
      try {
        if (remoteReady && remoteComments?.some((item) => item.id === id)) {
          const result = await mutateRemoteComments(pathKey, connection, {
            deleteId: id,
            githubToken: config.token,
          });
          if (result.ok) setRemoteComments(result.data);
          else setNotice({ kind: "error", text: result.error });
          return;
        }

        if (repoComments.some((item) => item.id === id)) {
          await deleteCommentFromRepo(config, target, id);
          setNotice({ kind: "ok", text: "已从仓库删除，重新构建后对访客生效。" });
        }
      } catch (error) {
        setNotice({
          kind: "error",
          text: error instanceof Error ? error.message : "删除失败，请稍后再试",
        });
      } finally {
        setBusyId(null);
      }
    },
    [
      config,
      connection,
      isOwner,
      pathKey,
      remoteComments,
      remoteReady,
      removeLocal,
      repoComments,
      target,
    ],
  );

  const toggleLike = useCallback(
    (id: string) => {
      setLikedIds((prev) => ({ ...prev, [id]: !prev[id] }));
    },
    [setLikedIds],
  );

  return {
    comments,
    likedIds,
    isOwner,
    remoteReady,
    busyId,
    notice,
    setNotice,
    submit,
    reply,
    remove,
    toggleLike,
  };
}
