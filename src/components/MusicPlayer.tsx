"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ListMusic,
  LoaderCircle,
  Music,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { isBoolean, isNumber, usePersistentState } from "@/hooks/usePersistentState";
import {
  PLAY_MODE_LABEL,
  PLAY_MODE_ORDER,
  formatDuration,
  isPlayMode,
  playableTracks,
  randomIndexExcept,
  stepIndex,
  type PlayMode,
  type Track,
} from "@/lib/music";
import { cn } from "@/lib/utils";

const MODE_KEY = "hc-blog:music-mode";
const VOLUME_KEY = "hc-blog:music-volume";
const LIST_OPEN_KEY = "hc-blog:music-list-open";

interface MusicPlayerProps {
  tracks: Track[];
  className?: string;
}

const MODE_ICON = { list: Repeat, one: Repeat1, shuffle: Shuffle } as const;

/** 控制区的小按钮，统一尺寸与激活态 */
function SmallButton({
  label,
  onClick,
  active,
  disabled,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "grid h-7 w-7 place-items-center rounded-md transition-colors disabled:opacity-40",
        active
          ? "bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-300"
          : "text-stone-500 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100",
        className,
      )}
    >
      {children}
    </button>
  );
}

/**
 * 侧栏迷你音乐播放器。
 *
 * 支持三种模式（列表循环 / 单曲循环 / 随机播放）、音量调节，
 * 以及展开查看播放列表。模式和音量都记在浏览器里，刷新后保留。
 *
 * 整份歌单共用一个 <audio>，切歌时只换 src —— 避免多首同时解码。
 */
export function MusicPlayer({ tracks, className }: MusicPlayerProps) {
  const list = useMemo(() => playableTracks(tracks), [tracks]);

  const audioRef = useRef<HTMLAudioElement>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);

  const [mode, setMode] = usePersistentState<PlayMode>(MODE_KEY, "list", isPlayMode);
  const [volume, setVolume] = usePersistentState<number>(VOLUME_KEY, 0.8, isNumber);
  const [listOpen, setListOpen] = usePersistentState<boolean>(LIST_OPEN_KEY, false, isBoolean);

  const track = list[index];

  /* ---------------- 音量 ---------------- */

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = Math.min(1, Math.max(0, volume));
    audio.muted = muted;
  }, [volume, muted, track?.src]);

  /* ---------------- 事件绑定 ---------------- */

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => setCurrent(audio.currentTime);
    const onMeta = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
      setLoading(false);
    };
    const onWaiting = () => setLoading(true);
    const onPlaying = () => {
      setLoading(false);
      setFailed(false);
      setPlaying(true);
    };
    const onPause = () => setPlaying(false);
    const onError = () => {
      setLoading(false);
      setPlaying(false);
      setFailed(true);
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("durationchange", onMeta);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("durationchange", onMeta);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("error", onError);
    };
  }, [track?.src]);

  /* ---------------- 切歌 ---------------- */

  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !track) return;
    try {
      await audio.play();
      setPlaying(true);
    } catch {
      // 浏览器可能因「缺少用户手势」拒绝播放，保持暂停状态即可
      setPlaying(false);
    }
  }, [track]);

  // 换 src 之后浏览器不会自动重新加载，需要显式 load()
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrent(0);
    setDuration(0);
    setFailed(false);
    audio.load();
  }, [track?.src]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !track) return;
    if (audio.paused) void play();
    else audio.pause();
  }, [play, track]);

  /** 点列表里的某一首 */
  const playAt = useCallback(
    (nextIndex: number) => {
      if (nextIndex === index) {
        void play();
        return;
      }
      setIndex(nextIndex);
      // src 要等下一次 render 才变，所以延后一帧再播
      requestAnimationFrame(() => void play());
    },
    [index, play],
  );

  /** 手动上一首 / 下一首 */
  const step = useCallback(
    (delta: number) => {
      if (list.length === 0) return;
      const next =
        mode === "shuffle" && delta > 0
          ? randomIndexExcept(index, list.length)
          : stepIndex(index, delta, list.length);
      setIndex(next);
      if (playing) requestAnimationFrame(() => void play());
    },
    [index, list.length, mode, playing, play],
  );

  /** 一曲播完 */
  const handleEnded = useCallback(() => {
    const audio = audioRef.current;

    if (mode === "one" && audio) {
      audio.currentTime = 0;
      void play();
      return;
    }

    if (list.length === 0) return;

    const next =
      mode === "shuffle" ? randomIndexExcept(index, list.length) : stepIndex(index, 1, list.length);

    setIndex(next);
    requestAnimationFrame(() => void play());
  }, [index, list.length, mode, play]);

  /** 点模式按钮：列表循环 → 单曲循环 → 随机播放 → 列表循环 */
  const cycleMode = useCallback(() => {
    const at = PLAY_MODE_ORDER.indexOf(mode);
    setMode(PLAY_MODE_ORDER[(at + 1) % PLAY_MODE_ORDER.length]);
  }, [mode, setMode]);

  const seek = (value: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value;
    setCurrent(value);
  };

  const changeVolume = (value: number) => {
    setVolume(value);
    if (value > 0) setMuted(false);
  };

  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  const ModeIcon = MODE_ICON[mode];
  const shownVolume = muted ? 0 : volume;

  /* ---------------- 没有可播曲目时的占位 ---------------- */

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
        把音频放进 <code>public/uploads/</code>，再在 <code>src/lib/music.ts</code> 里登记即可。
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
      <audio ref={audioRef} src={track.src} preload="metadata" onEnded={handleEnded} />

      {/* 当前曲目 */}
      <div className="mb-2 flex items-center gap-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 text-white">
          {track.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={track.cover} alt="" className="h-full w-full object-cover" />
          ) : (
            <Music className={cn("h-4 w-4", playing && "animate-pulse")} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-stone-800 dark:text-stone-100">
            {track.title}
          </p>
          <p className="truncate text-[11px] text-stone-500 dark:text-stone-400">{track.artist}</p>
        </div>
        <span className="shrink-0 font-mono text-[10px] text-stone-400">
          {formatDuration(current)} / {formatDuration(duration)}
        </span>
      </div>

      {/* 进度 */}
      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={current}
        onChange={(event) => seek(Number(event.target.value))}
        aria-label="播放进度"
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-stone-200 accent-brand-500 dark:bg-stone-700"
      />

      {failed && (
        <p className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400">
          音频加载失败，检查 <code>public/uploads/</code> 里是否有这个文件
        </p>
      )}

      {/* 控制按钮 */}
      <div className="mt-2 flex items-center justify-center gap-0.5">
        <SmallButton
          label={`播放模式：${PLAY_MODE_LABEL[mode]}（点击切换）`}
          onClick={cycleMode}
          active={mode !== "list"}
        >
          <ModeIcon className="h-3.5 w-3.5" />
        </SmallButton>

        <SmallButton label="上一首" onClick={() => step(-1)} disabled={list.length < 2}>
          <SkipBack className="h-3.5 w-3.5" />
        </SmallButton>

        <button
          type="button"
          onClick={toggle}
          title={playing ? "暂停" : "播放"}
          aria-label={playing ? "暂停" : "播放"}
          className="grid h-8 w-8 place-items-center rounded-full bg-brand-500 text-white transition-colors hover:bg-brand-600"
        >
          {loading ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : playing ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </button>

        <SmallButton label="下一首" onClick={() => step(1)} disabled={list.length < 2}>
          <SkipForward className="h-3.5 w-3.5" />
        </SmallButton>

        <SmallButton
          label={listOpen ? "收起播放列表" : `查看播放列表（${list.length} 首）`}
          onClick={() => setListOpen((prev) => !prev)}
          active={listOpen}
        >
          <ListMusic className="h-3.5 w-3.5" />
        </SmallButton>
      </div>

      {/* 音量 */}
      <div className="mt-2 flex items-center gap-1.5">
        <SmallButton
          label={muted ? "取消静音" : "静音"}
          onClick={() => setMuted((prev) => !prev)}
        >
          <VolumeIcon className="h-3.5 w-3.5" />
        </SmallButton>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={shownVolume}
          onChange={(event) => changeVolume(Number(event.target.value))}
          aria-label="音量"
          className="h-1 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-stone-200 accent-brand-500 dark:bg-stone-700"
        />
        <span className="w-7 shrink-0 text-right font-mono text-[10px] text-stone-400">
          {Math.round(shownVolume * 100)}
        </span>
      </div>

      {/* 播放列表 */}
      {listOpen && (
        <ol className="mt-2 max-h-44 space-y-0.5 overflow-y-auto border-t border-stone-200 pt-2 dark:border-stone-700">
          {list.map((item, itemIndex) => {
            const active = itemIndex === index;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => playAt(itemIndex)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[11px] transition-colors",
                    active
                      ? "bg-brand-50 font-medium text-brand-700 dark:bg-brand-950/50 dark:text-brand-300"
                      : "text-stone-500 hover:bg-stone-100 hover:text-stone-800 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100",
                  )}
                >
                  <span className="w-3 shrink-0 text-center font-mono text-[10px] text-stone-400">
                    {active && playing ? "♪" : itemIndex + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  <span className="shrink-0 truncate text-[10px] text-stone-400">{item.artist}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export default MusicPlayer;
