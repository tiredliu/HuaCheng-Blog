"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Music, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Track } from "@/lib/music";

interface MusicPlayerProps {
  tracks: Track[];
  className?: string;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

/**
 * 侧栏迷你音乐播放器（设计文档里「音乐播放 ✅ 支持」的落点）。
 *
 * 静态站点没有后端，歌单写在 `src/lib/music.ts`，
 * 音频文件放进 `public/uploads/` 即可。
 */
export function MusicPlayer({ tracks, className }: MusicPlayerProps) {
  const playable = tracks.filter((track) => track.src);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  const track = playable[index];

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrent(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
    };
  }, [track?.src]);

  const toggle = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !track) return;
    if (audio.paused) {
      try {
        await audio.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
      }
    } else {
      audio.pause();
      setPlaying(false);
    }
  }, [track]);

  const step = useCallback(
    (delta: number) => {
      if (playable.length === 0) return;
      setIndex((prev) => (prev + delta + playable.length) % playable.length);
      setPlaying(false);
      setCurrent(0);
    },
    [playable.length],
  );

  if (!track) {
    return (
      <div
        className={cn(
          "rounded-xl border border-dashed border-stone-300 p-3 text-xs leading-relaxed text-stone-500 dark:border-stone-700 dark:text-stone-400",
          className,
        )}
      >
        <p className="mb-1 flex items-center gap-1.5 font-medium text-stone-600 dark:text-stone-300">
          <Music className="h-3.5 w-3.5" /> 音乐播放器
        </p>
        把 mp3 放进 <code>public/uploads/</code>，再在 <code>src/lib/music.ts</code> 里登记即可。
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-stone-200 bg-white p-3 dark:border-stone-700 dark:bg-stone-900",
        className,
      )}
    >
      <audio ref={audioRef} src={track.src} preload="none" onEnded={() => step(1)} />

      <div className="mb-2 flex items-center gap-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 text-white">
          <Music className={cn("h-4 w-4", playing && "animate-pulse")} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-stone-800 dark:text-stone-100">{track.title}</p>
          <p className="truncate text-[11px] text-stone-500 dark:text-stone-400">{track.artist}</p>
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={current}
        onChange={(event) => {
          const audio = audioRef.current;
          if (!audio) return;
          audio.currentTime = Number(event.target.value);
          setCurrent(audio.currentTime);
        }}
        aria-label="播放进度"
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-stone-200 accent-brand-500 dark:bg-stone-700"
      />

      <div className="mt-2 flex items-center justify-between">
        <span className="font-mono text-[10px] text-stone-400">
          {formatTime(current)} / {formatTime(duration)}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="上一首"
            className="grid h-7 w-7 place-items-center rounded-md text-stone-500 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
          >
            <SkipBack className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={toggle}
            aria-label={playing ? "暂停" : "播放"}
            className="grid h-7 w-7 place-items-center rounded-full bg-brand-500 text-white hover:bg-brand-600"
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="下一首"
            className="grid h-7 w-7 place-items-center rounded-md text-stone-500 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
          >
            <SkipForward className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              const audio = audioRef.current;
              if (!audio) return;
              audio.muted = !audio.muted;
              setMuted(audio.muted);
            }}
            aria-label={muted ? "取消静音" : "静音"}
            className="grid h-7 w-7 place-items-center rounded-md text-stone-500 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
          >
            {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default MusicPlayer;
