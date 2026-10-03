"use client";

import { useState } from "react";
import { Heart, LoaderCircle, MessageSquare, Reply, Send, ShieldCheck, Trash2, TriangleAlert } from "lucide-react";
import { cn, formatRelative } from "@/lib/utils";
import { SITE } from "@/lib/site";
import type { CommentThreadState } from "@/hooks/useCommentThread";

export interface CommentThreadViewProps {
  thread: CommentThreadState;
  name: string;
  onNameChange: (value: string) => void;
  /** 窄面板（右侧留言板）里用更紧凑的排版 */
  dense?: boolean;
  placeholder?: string;
  emptyHint?: string;
}

/**
 * 评论 / 留言的展示与输入。
 *
 * 文章底部的评论区和右侧留言板共用这一个组件，只是 `dense` 不同 ——
 * 两边的权限模型和存储模型完全一样，没有理由写两份。
 */
export function CommentThreadView({
  thread,
  name,
  onNameChange,
  dense = false,
  placeholder = "写下你的想法…（Ctrl / ⌘ + Enter 发送）",
  emptyHint = "还没有评论，来写第一条吧。",
}: CommentThreadViewProps) {
  const { comments, likedIds, isOwner, remoteReady, busyId, notice, submit, reply, remove, toggleLike } =
    thread;

  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");

  const send = () => {
    const value = input.trim();
    if (!value) return;
    void submit(name, value);
    setInput("");
  };

  const sendReply = (id: string) => {
    const value = replyDraft.trim();
    if (!value) return;
    void reply(id, value);
    setReplyTo(null);
    setReplyDraft("");
  };

  return (
    <div className={cn("space-y-3", dense && "space-y-2.5")}>
      {/* 输入区 */}
      <div className="rounded-xl border border-stone-200 bg-white p-3 dark:border-stone-700 dark:bg-stone-900">
        <input
          type="text"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          maxLength={20}
          placeholder="你的昵称（可留空）"
          className="mb-2 w-full rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-700 placeholder:text-stone-400 focus:border-brand-400 focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200"
        />
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              send();
            }
          }}
          maxLength={1000}
          rows={dense ? 2 : 3}
          placeholder={placeholder}
          className="w-full resize-none rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs leading-relaxed text-stone-700 placeholder:text-stone-400 focus:border-brand-400 focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200"
        />
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[10px] text-stone-400">
            {input.length}/1000
            {isOwner && (
              <span className="ml-1.5 inline-flex items-center gap-0.5 text-jade-600 dark:text-jade-400">
                <ShieldCheck className="h-3 w-3" />
                以站长身份发布
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={send}
            disabled={!input.trim() || busyId !== null}
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busyId && busyId !== replyTo ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            发布
          </button>
        </div>
      </div>

      {notice && (
        <p
          className={cn(
            "flex items-start gap-1.5 rounded-lg px-2.5 py-2 text-[11px] leading-relaxed",
            notice.kind === "error"
              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300"
              : "bg-jade-400/10 text-jade-600 dark:text-jade-400",
          )}
        >
          {notice.kind === "error" && <TriangleAlert className="mt-px h-3 w-3 shrink-0" />}
          {notice.text}
        </p>
      )}

      {/* 列表 */}
      {comments.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 px-3 py-6 text-center text-xs text-stone-400 dark:border-stone-700">
          {emptyHint}
        </p>
      ) : (
        <ul className={cn("space-y-3", dense && "space-y-2.5")}>
          {comments.map((comment) => {
            const liked = likedIds[comment.id] === true;
            const likeCount = comment.likes + (liked ? 1 : 0);

            return (
              <li
                key={comment.id}
                className="group rounded-xl border border-stone-200 bg-stone-50/70 p-3 dark:border-stone-700 dark:bg-stone-800/50"
              >
                <header className="mb-1 flex items-center gap-2">
                  <span
                    className={cn(
                      "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white",
                      comment.owner
                        ? "bg-gradient-to-br from-jade-400 to-jade-600"
                        : "bg-gradient-to-br from-brand-400 to-brand-600",
                    )}
                  >
                    {comment.author.slice(0, 1)}
                  </span>
                  <span className="text-xs font-medium text-stone-800 dark:text-stone-100">
                    {comment.author}
                  </span>
                  {comment.owner && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-jade-400/15 px-1.5 py-0.5 text-[10px] text-jade-600 dark:text-jade-400">
                      <ShieldCheck className="h-2.5 w-2.5" />
                      站长
                    </span>
                  )}
                  {comment.pending && (
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                      待构建
                    </span>
                  )}
                  <span className="ml-auto shrink-0 text-[10px] text-stone-400">
                    {formatRelative(comment.createdAt)}
                  </span>
                </header>

                <p className="text-[13px] leading-relaxed break-words whitespace-pre-wrap text-stone-600 dark:text-stone-300">
                  {comment.content}
                </p>

                {comment.reply && (
                  <div className="mt-2 rounded-lg border-l-2 border-brand-400 bg-white px-2.5 py-2 dark:bg-stone-900">
                    <p className="flex items-center gap-1 text-[11px] font-medium text-brand-600 dark:text-brand-400">
                      <Reply className="h-3 w-3" />
                      {SITE.author} 回复
                      {comment.replyAt && (
                        <span className="ml-1 font-normal text-stone-400">
                          {formatRelative(comment.replyAt)}
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed break-words whitespace-pre-wrap text-stone-500 dark:text-stone-400">
                      {comment.reply}
                    </p>
                  </div>
                )}

                <footer className="mt-2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggleLike(comment.id)}
                    aria-pressed={liked}
                    className={cn(
                      "flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] transition-colors",
                      liked ? "text-brand-600 dark:text-brand-400" : "text-stone-400 hover:text-brand-500",
                    )}
                  >
                    <Heart className={cn("h-3 w-3", liked && "fill-current")} />
                    {likeCount}
                  </button>

                  {/* 回复：只有站长看得到这个入口，服务端也会再校验一次 */}
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => {
                        setReplyTo(replyTo === comment.id ? null : comment.id);
                        setReplyDraft(comment.reply ?? "");
                      }}
                      className={cn(
                        "flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] transition-colors",
                        replyTo === comment.id
                          ? "text-brand-600 dark:text-brand-400"
                          : "text-stone-400 hover:text-brand-500",
                      )}
                    >
                      <Reply className="h-3 w-3" />
                      {comment.reply ? "改回复" : "回复"}
                    </button>
                  )}

                  {(isOwner || comment.pending) && (
                    <button
                      type="button"
                      onClick={() => void remove(comment.id)}
                      aria-label="删除这条评论"
                      className="ml-auto rounded-md p-1 text-stone-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-brand-500 focus-visible:opacity-100"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </footer>

                {replyTo === comment.id && (
                  <div className="mt-2 space-y-1.5">
                    <textarea
                      value={replyDraft}
                      onChange={(event) => setReplyDraft(event.target.value)}
                      rows={2}
                      maxLength={1000}
                      placeholder={`以 ${SITE.author} 的身份回复…`}
                      className="w-full resize-none rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-xs leading-relaxed text-stone-700 placeholder:text-stone-400 focus:border-brand-400 focus:outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200"
                    />
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => sendReply(comment.id)}
                        disabled={!replyDraft.trim() || busyId === comment.id}
                        className="flex items-center gap-1 rounded-lg bg-brand-500 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-brand-600 disabled:opacity-40"
                      >
                        {busyId === comment.id ? (
                          <LoaderCircle className="h-3 w-3 animate-spin" />
                        ) : (
                          <Send className="h-3 w-3" />
                        )}
                        发布回复
                      </button>
                      <button
                        type="button"
                        onClick={() => setReplyTo(null)}
                        className="rounded-lg px-2 py-1 text-[11px] text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* 存储模型说明：如实写明，不假装它是公共评论区 */}
      <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-stone-400">
        <MessageSquare className="mt-px h-3 w-3 shrink-0" />
        {remoteReady ? (
          <span>
            评论保存在站点的互动服务里，所有访客都能看到；<strong className="font-medium">回复只有站长能做</strong>。
            点赞只记在本机浏览器。
          </span>
        ) : (
          <span>
            访客的评论先存在<strong className="font-medium">你自己的浏览器</strong>里（纯静态站没有收件箱），
            只有站长发布的留言与回复是写进仓库、所有人都能看到的；点赞也只记在本机。
          </span>
        )}
      </p>
    </div>
  );
}

export default CommentThreadView;
