"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Music, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useMediaSession } from "@/hooks/useMediaSession";
import type { Track } from "@/lib/music";
import { cn } from "@/lib/utils";

export interface AudioPlayerProps {
  src: string;
  title?: string;
  artist?: string;
  cover?: string;
  /** 是否自动播放（浏览器通常会拦截，默认关闭） */
  autoPlay?: boolean;
  className?: string;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * HTML5 音频播放器。
 *
 * 纯静态方案下没有后端，音频文件放在 `public/music/` 里直接引用即可。
 *
 * ```mdx
 * <AudioPlayer src="/music/bgm.mp3" title="城南花已开" artist="三亩地" />
 * ```
 */
export function AudioPlayer({
  src,
  title = "未命名音频",
  artist = "未知艺术家",
  cover,
  autoPlay = false,
  className,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => setCurrent(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration);
    const onEnd = () => setPlaying(false);

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnd);
    };
  }, []);

  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      await audio.play();
      setPlaying(true);
    } catch {
      // 浏览器可能因「缺少用户手势」拒绝播放，保持暂停状态即可
      setPlaying(false);
    }
  }, []);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    setPlaying(false);
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void play();
    } else {
      pause();
    }
  };

  const seek = useCallback((value: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const at = Number.isFinite(value) ? Math.min(Math.max(value, 0), audio.duration || value) : 0;
    audio.currentTime = at;
    setCurrent(at);
  }, []);

  /** 快退 / 快进若干秒。通知栏的前进后退按钮走这里 */
  const seekBy = useCallback((delta: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    seek(audio.currentTime + delta);
  }, [seek]);

  /** 通知栏同样显示这首歌的信息（没有上一首/下一首，就只注册播放暂停） */
  const track = useMemo<Track>(
    () => ({ id: src, title, artist, src, cover }),
    [artist, cover, src, title],
  );
  useMediaSession({
    track,
    playing,
    duration,
    position: current,
    onPlay: play,
    onPause: pause,
    // 内嵌播放器没有歌单，但进度条还是该能拖
    onSeek: seek,
    onSeekBy: seekBy,
  });

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setMuted(audio.muted);
  };

  return (
    <div
      className={cn(
        "my-8 flex items-center gap-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-card dark:border-stone-700 dark:bg-stone-900",
        className,
      )}
    >
      <audio ref={audioRef} src={src} preload="metadata" autoPlay={autoPlay} loop />

      <div className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={title} className="h-full w-full object-cover" />
        ) : (
          <Music className={cn("h-6 w-6", playing && "animate-pulse")} />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-semibold text-stone-900 dark:text-stone-100">{title}</p>
          <span className="shrink-0 font-mono text-[11px] text-stone-400">
            {formatTime(current)} / {formatTime(duration)}
          </span>
        </div>
        <p className="truncate text-xs text-stone-500 dark:text-stone-400">{artist}</p>

        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={current}
          onChange={(event) => seek(Number(event.target.value))}
          aria-label="播放进度"
          className="mt-2 h-1 w-full cursor-pointer appearance-none rounded-full bg-stone-200 accent-brand-500 dark:bg-stone-700"
        />
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "暂停" : "播放"}
          className="grid h-9 w-9 place-items-center rounded-full bg-brand-500 text-white transition hover:bg-brand-600"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? "取消静音" : "静音"}
          className="grid h-9 w-9 place-items-center rounded-full text-stone-500 transition hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export default AudioPlayer;
