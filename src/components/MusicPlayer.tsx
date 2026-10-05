"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AudioWaveform,
  ListMusic,
  LoaderCircle,
  Mic2,
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
import { LyricsPanel } from "@/components/LyricsPanel";
import {
  AUDIO_EFFECT_LABEL,
  AUDIO_EFFECT_PRESETS,
  applyAudioEffect,
  getEffectPreset,
  isAudioEffectId,
  useIsEffectAvailable,
  type AudioEffectId,
} from "@/lib/audio-effects";
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
const LYRICS_OPEN_KEY = "hc-blog:music-lyrics-open";
const EFFECT_KEY = "hc-blog:music-effect";

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
 * 支持三种模式（列表循环 / 单曲循环 / 随机播放）、音量调节、
 * 展开查看播放列表、**悬浮歌词窗**，以及用 Web Audio 做的**音效**。
 * 模式、音量、歌词窗开关、音效都记在浏览器里，刷新后保留。
 *
 * 整份歌单共用一个 <audio>，切歌时只换 src —— 避免多首同时解码。
 */
export function MusicPlayer({ tracks, className }: MusicPlayerProps) {
  const list = useMemo(() => playableTracks(tracks), [tracks]);

  const audioRef = useRef<HTMLAudioElement>(null);
  /**
   * 「换歌之后是否要接着播」的意图标记。
   *
   * 由播完自动下一首 / 上一首下一首 / 点列表置位，等新歌的 `loadedmetadata`
   * 到了再真正 `play()` —— **绝不**在这里当场 play，否则会和 `<audio>` 的重新加载抢时序。
   */
  const pendingPlayRef = useRef(false);
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
  const [lyricsOpen, setLyricsOpen] = usePersistentState<boolean>(LYRICS_OPEN_KEY, false, isBoolean);
  const [effect, setEffect] = usePersistentState<AudioEffectId>(EFFECT_KEY, "none", isAudioEffectId);

  // 音效面板是临时展开，不持久化（和「播放列表」不同：那是长期偏好）
  const [effectOpen, setEffectOpen] = useState(false);
  const [effectFailed, setEffectFailed] = useState(false);

  const track = list[index];
  const effectAvailable = useIsEffectAvailable(track?.src);
  /** 这首歌登记歌词了没有 —— 决定歌词按钮的提示与播放列表里的标记 */
  const hasLyrics = Boolean(track?.lyrics);

  /**
   * 把当前音效接到 <audio> 上。
   *
   * 只在**用户操作**（选音效、点播放）里调用，不在 effect 里 ——
   * 建 AudioContext 需要用户手势，effect 里建大概率是 suspended 的。
   */
  const applyEffect = useCallback(
    (id: AudioEffectId) => {
      const audio = audioRef.current;
      // 外链音频接进音效链会直接没声音，所以这里先挡一道
      if (!audio || !effectAvailable) return;
      setEffectFailed(!applyAudioEffect(audio, id));
    },
    [effectAvailable],
  );

  /* ---------------- 切歌 ---------------- */

  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !track) return;
    pendingPlayRef.current = false;
    try {
      await audio.play();
      setPlaying(true);
      // 播放成功后才接音效链：这时一定已经有用户手势，AudioContext 不会被挂起
      if (effect !== "none" && effectAvailable) applyEffect(effect);
    } catch {
      // 浏览器可能因「缺少用户手势」拒绝播放，保持暂停状态即可
      setPlaying(false);
    }
  }, [applyEffect, effect, effectAvailable, track]);

  /**
   * 切到某一首：先清掉上一首的进度显示与失败态，再换 index。
   *
   * `autoplay` 会写进「续播意图」，等新歌的 `loadedmetadata` 到了再真正 `play()`。
   *
   * ⚠️ 换歌时**不要**调 `audio.load()`：`src` 属性一变，浏览器本来就会重新加载；
   * 而 `load()` 会把 `paused` 置回 `true` 并抛出一个 `pause` 事件 —— 若此时新歌
   * 刚被 `play()` 起来，就会立刻又被按停（这正是「播完自动下一首后直接暂停」的原因）。
   */
  const goTo = useCallback((nextIndex: number, autoplay: boolean) => {
    pendingPlayRef.current = autoplay;
    setCurrent(0);
    setDuration(0);
    setFailed(false);
    setIndex(nextIndex);
  }, []);

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
    };
    // 新歌的元数据就绪 = 可以安全续播了（此时再 play，不会被加载流程按停）
    const onLoadedMetadata = () => {
      onMeta();
      setLoading(false);
      if (pendingPlayRef.current) {
        pendingPlayRef.current = false;
        void play();
      }
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
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("durationchange", onMeta);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("durationchange", onMeta);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("error", onError);
    };
  }, [play, track?.src]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !track) return;
    if (audio.paused) {
      void play();
    } else {
      // 用户主动暂停：取消「换歌后续播」的意图，免得之后莫名自己响起来
      pendingPlayRef.current = false;
      audio.pause();
    }
  }, [play, track]);

  /** 点列表里的某一首 */
  const playAt = useCallback(
    (nextIndex: number) => {
      if (nextIndex === index) {
        void play();
        return;
      }
      goTo(nextIndex, true);
    },
    [goTo, index, play],
  );

  /** 手动上一首 / 下一首 */
  const step = useCallback(
    (delta: number) => {
      if (list.length === 0) return;
      const next =
        mode === "shuffle" && delta > 0
          ? randomIndexExcept(index, list.length)
          : stepIndex(index, delta, list.length);

      // 歌单只有一首（或随机到了自己）：上下首等于重播
      if (next === index) {
        if (playing) {
          const audio = audioRef.current;
          if (audio) audio.currentTime = 0;
          void play();
        }
        return;
      }

      goTo(next, playing);
    },
    [goTo, index, list.length, mode, playing, play],
  );

  /** 一曲播完 */
  const handleEnded = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || list.length === 0) return;

    // 单曲循环：原地重播
    if (mode === "one") {
      audio.currentTime = 0;
      void play();
      return;
    }

    const next =
      mode === "shuffle" ? randomIndexExcept(index, list.length) : stepIndex(index, 1, list.length);

    // 歌单只有一首（或随机到了自己）：也原地重播
    if (next === index) {
      audio.currentTime = 0;
      void play();
      return;
    }

    // 换歌 + 交给新歌的 loadedmetadata 续播
    goTo(next, true);
  }, [goTo, index, list.length, mode, play]);

  /** 点模式按钮：列表循环 → 单曲循环 → 随机播放 → 列表循环 */
  const cycleMode = useCallback(() => {
    const at = PLAY_MODE_ORDER.indexOf(mode);
    setMode(PLAY_MODE_ORDER[(at + 1) % PLAY_MODE_ORDER.length]);
  }, [mode, setMode]);

  /** 选一个音效（点列表里的项） */
  const chooseEffect = useCallback(
    (id: AudioEffectId) => {
      setEffect(id);
      setEffectOpen(false);
      applyEffect(id);
      if (id === "none") setEffectFailed(false);
    },
    [applyEffect, setEffect],
  );

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
        把音频放进 <code>public/music/</code>，再在 <code>src/lib/music.ts</code> 里登记即可。
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
          音频加载失败，检查 <code>public/music/</code> 里是否有这个文件
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

      {/* 歌词窗与音效 */}
      <div className="mt-1.5 flex items-center gap-1">
        <SmallButton
          label={
            hasLyrics
              ? lyricsOpen
                ? "关闭歌词窗"
                : "打开歌词窗（可拖动、可缩放）"
              : "打开歌词窗 —— 这首还没有歌词"
          }
          onClick={() => setLyricsOpen((prev) => !prev)}
          active={lyricsOpen}
          className={!hasLyrics && !lyricsOpen ? "opacity-50" : undefined}
        >
          <Mic2 className="h-3.5 w-3.5" />
        </SmallButton>

        <button
          type="button"
          onClick={() => setEffectOpen((prev) => !prev)}
          disabled={!effectAvailable}
          title={
            effectAvailable
              ? "音效（Web Audio 实时处理，免费）"
              : "外链音频不支持音效：浏览器不允许跨域音频接入音效链"
          }
          aria-label="音效"
          aria-expanded={effectOpen}
          className={cn(
            "flex h-7 min-w-0 flex-1 items-center gap-1 rounded-md px-1.5 text-[10px] transition-colors disabled:opacity-40",
            effect !== "none"
              ? "bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-300"
              : "text-stone-500 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100",
          )}
        >
          <AudioWaveform className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{AUDIO_EFFECT_LABEL[effect]}</span>
        </button>
      </div>

      {/* 音效列表：和播放列表一样就地展开，不用浮层（侧栏有 overflow 会裁掉浮层） */}
      {effectOpen && effectAvailable && (
        <div className="mt-1.5 rounded-lg border border-stone-200 p-1 dark:border-stone-700">
          {/* 预设多了（十几个），改成两列网格 + 限高滚动，别把侧栏撑太长 */}
          <div className="grid max-h-52 grid-cols-2 gap-0.5 overflow-y-auto">
            {AUDIO_EFFECT_PRESETS.map((preset) => {
              const chosen = preset.id === effect;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => chooseEffect(preset.id)}
                  title={preset.hint}
                  aria-current={chosen ? "true" : undefined}
                  className={cn(
                    "truncate rounded-md px-2 py-1 text-left text-[11px] transition-colors",
                    chosen
                      ? "bg-brand-50 font-medium text-brand-700 dark:bg-brand-950/50 dark:text-brand-300"
                      : "text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800",
                  )}
                >
                  {preset.name}
                </button>
              );
            })}
          </div>
          {/* 当前音效的说明，替代原来每个条目下面那行小字 */}
          <p className="mt-1 px-2 text-[10px] leading-tight text-stone-400">
            {AUDIO_EFFECT_LABEL[effect]} · {getEffectPreset(effect).hint}
          </p>
          {effectFailed && (
            <p className="px-2 pt-1 text-[10px] text-amber-600 dark:text-amber-400">
              这个浏览器没能启用音效，已保持原声
            </p>
          )}
        </div>
      )}

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
                  {/* 有没有歌词一眼看得出来：有词的挂一个小话筒，没词的写「无歌词」 */}
                  {item.lyrics ? (
                    <span className="shrink-0" title="有歌词">
                      <Mic2 className="h-3 w-3 text-stone-400" aria-label="有歌词" />
                    </span>
                  ) : (
                    <span
                      className="shrink-0 text-[9px] text-stone-300 dark:text-stone-600"
                      title="还没有歌词"
                    >
                      无歌词
                    </span>
                  )}
                  <span className="w-14 shrink-0 truncate text-right text-[10px] text-stone-400">
                    {item.artist}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {/*
        歌词窗挂到 document.body 上（组件内部用 createPortal），
        所以这里放在播放器里只是「谁负责渲染」，不影响定位。
        key 跟着歌词地址变：换歌时重新挂载，自动重新拉一次歌词。
      */}
      {lyricsOpen && (
        <LyricsPanel
          key={track.lyrics ?? `no-lyrics-${track.id}`}
          src={track.lyrics}
          title={track.title}
          artist={track.artist}
          currentTime={current}
          onSeek={seek}
          onClose={() => setLyricsOpen(false)}
        />
      )}
    </div>
  );
}

export default MusicPlayer;
