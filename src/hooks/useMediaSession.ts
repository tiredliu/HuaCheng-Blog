"use client";

import { useEffect } from "react";
import type { Track } from "@/lib/music";
import { SITE, withBasePath } from "@/lib/site";

/**
 * 把播放器状态同步给系统的「媒体控制中心」—— 手机上就是通知栏与锁屏那块。
 *
 * 不做这件事时，通知栏通常只有一个光秃秃的播放按钮（Chrome 还会显示成域名），
 * 既没有封面也没有曲目名。补上元数据之后它会显示：封面 + 标题 + 艺术家 + 专辑，
 * 并且上一首 / 后退 / 播放暂停 / 前进 / 下一首都能直接点，进度条还能拖。
 *
 * ## 边界：通知栏长什么样，网页说了不算
 *
 * 媒体通知是**浏览器和系统画的**，网页只能通过 `Media Session` 告诉它元数据，
 * 再响应几个**规定好**的动作。W3C 规范里没有被允许的第三类东西 —— 所以：
 *
 * | 想要的东西 | 能不能做 |
 * | --- | --- |
 * | 封面 / 歌名 / 歌手 / 专辑 | ✅ `MediaMetadata` |
 * | 能拖动的进度条 | ✅ `setPositionState()` + 注册 `seekto` |
 * | 上一首 / 后退 / 播放暂停 / 前进 / 下一首 | ✅ 这五个都是规范里的 action |
 * | 自定义按钮（比如「音效」） | ❌ 只有原生 App 能做到 |
 * | 歌词 | ❌ 元数据里没有任何放正文的字段 |
 * | 自定义布局 / 配色 | ❌ 同上 |
 *
 * 这些都是**尽力而为**的：不支持的浏览器直接跳过，不会报错，也不影响页面本身。
 */

/** 没有封面时的兜底图 —— 通知栏至少有个方块，不然看起来像坏了 */
const FALLBACK_ARTWORK = SITE.avatar;

/** artwork 里给一批尺寸，系统按自己需要挑一张合适的（都是同一张图） */
const ARTWORK_SIZES = [96, 128, 192, 256, 384, 512];

/** 快进快退的默认步长；系统一般会自己告诉我们 seekOffset，这个值只在没给时用 */
const SEEK_STEP = 10;

export interface MediaSessionOptions {
  /** 当前曲目；不传（或 undefined）就什么都不做 */
  track?: Track;
  playing: boolean;
  /** 总时长（秒），未知时传 0 */
  duration: number;
  /** 当前进度（秒） */
  position: number;
  onPlay: () => void;
  onPause: () => void;
  /** 不传就不注册上一首按钮（歌单只有一首时没什么可切的） */
  onPrevious?: () => void;
  onNext?: () => void;
  /**
   * 跳到指定时间点（秒）。
   *
   * ⚠️ **不注册它，通知栏的进度条就不能拖** —— 这是能不能拖的唯一开关。
   */
  onSeek?: (time: number) => void;
  /** 快退 / 快进，参数是秒数（正数前进、负数后退） */
  onSeekBy?: (delta: number) => void;
}

function supported(): boolean {
  return typeof window !== "undefined" && "mediaSession" in navigator;
}

/**
 * MediaMetadata 的 artwork 要求**绝对地址**，相对路径在部分浏览器里会被直接忽略
 * （表现就是「别的都有，唯独没封面」）。
 */
function toAbsoluteUrl(src: string): string {
  const path = /^https?:\/\//i.test(src) ? src : withBasePath(src);
  try {
    return new URL(path, window.location.href).href;
  } catch {
    return path;
  }
}

function mimeOf(src: string): string {
  const lower = src.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

export function useMediaSession({
  track,
  playing,
  duration,
  position,
  onPlay,
  onPause,
  onPrevious,
  onNext,
  onSeek,
  onSeekBy,
}: MediaSessionOptions): void {
  /*
   * ① 元数据：切歌或开始播放时更新。
   *
   * ⚠️ 只在**自己正在播**的时候写：一篇文章里可能同时有侧栏播放器和正文内嵌播放器，
   * 谁都能写 metadata，最后写的那个说了算 —— 不播的那个要是也写，就会把正在播的那首
   * 的封面盖掉（表现：通知栏显示的歌名对不上）。
   */
  useEffect(() => {
    if (!supported() || !track || !playing) return;

    const src = toAbsoluteUrl(track.cover || FALLBACK_ARTWORK);
    const type = mimeOf(src);

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist || "未知歌手",
      album: SITE.name,
      artwork: ARTWORK_SIZES.map((size) => ({
        src,
        sizes: `${size}x${size}`,
        type,
      })),
    });
  }, [track, playing]);

  /* ② 播放状态：通知栏上显示的是播放还是暂停按钮 */
  useEffect(() => {
    if (!supported()) return;
    navigator.mediaSession.playbackState = playing ? "playing" : "paused";
  }, [playing]);

  /* ③ 进度条：按整秒更新，别跟着 timeupdate 每 250ms 刷一次 */
  const seconds = Math.floor(position);
  useEffect(() => {
    if (!supported() || !Number.isFinite(duration) || duration <= 0) return;
    navigator.mediaSession.setPositionState({
      duration,
      playbackRate: 1,
      position: Math.min(Math.max(seconds, 0), duration),
    });
  }, [duration, seconds]);

  /* ④ 通知栏上的按钮 */
  useEffect(() => {
    if (!supported()) return;

    const actions: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ["play", () => onPlay()],
      ["pause", () => onPause()],
      ["stop", () => onPause()],
    ];
    if (onPrevious) actions.push(["previoustrack", () => onPrevious()]);
    if (onNext) actions.push(["nexttrack", () => onNext()]);

    if (onSeekBy) {
      // 系统一般会自己带 seekOffset（各家都不一样），没带就退回默认步长
      actions.push(["seekbackward", (details) => onSeekBy(-(details?.seekOffset ?? SEEK_STEP))]);
      actions.push(["seekforward", (details) => onSeekBy(details?.seekOffset ?? SEEK_STEP)]);
    }

    if (onSeek) {
      /*
       * `fastSeek` 表示用户正抓着进度条快速拖动，中间值可以先不理会 ——
       * 但音频不像 video 有 `fastSeek()`，所以一律当作「确定了的位置」处理。
       */
      actions.push([
        "seekto",
        (details) => {
          if (typeof details?.seekTime === "number") onSeek(details.seekTime);
        },
      ]);
    }

    for (const [action, handler] of actions) {
      // 老浏览器可能不认识某个 action，抛错就当它不存在
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        /* 忽略：不支持的按钮不注册即可 */
      }
    }

    return () => {
      for (const [action] of actions) {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          /* 同上 */
        }
      }
    };
  }, [onPlay, onPause, onPrevious, onNext, onSeek, onSeekBy]);
}

export default useMediaSession;
