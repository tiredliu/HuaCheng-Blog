export interface Track {
  id: string;
  title: string;
  artist: string;
  /** 音频地址：可以是 `public/uploads/` 下的文件，也可以是第三方直链 */
  src: string;
  /** 封面图，可选 */
  cover?: string;
  /** 外链（例如网易云 / B 站），点击后新窗口打开 */
  link?: string;
}

/** 把文件名转成安全的 URL —— 中文名和空格都必须编码 */
export function uploadUrl(fileName: string): string {
  return `/uploads/${fileName.split("/").map(encodeURIComponent).join("/")}`;
}

/**
 * 默认歌单。把音频文件放进 `public/uploads/`，再在这里登记一行即可。
 * 也可以在 MDX 里写 `<AudioPlayer src="..." title="..." />` 单独插入一首。
 */
export const defaultPlaylist: Track[] = [
  {
    id: "dive-back-in-time",
    title: "Dive Back in Time",
    artist: "白鲨 JAWS",
    src: uploadUrl("白鲨jaws-dive back in time.mp3"),
  },
  {
    id: "demo-01",
    title: "示例曲目一 · 琶音",
    artist: "本站生成",
    src: uploadUrl("demo-01.wav"),
  },
  {
    id: "demo-02",
    title: "示例曲目二 · 小调",
    artist: "本站生成",
    src: uploadUrl("demo-02.wav"),
  },
  {
    id: "demo-03",
    title: "示例曲目三 · 五声音阶",
    artist: "本站生成",
    src: uploadUrl("demo-03.wav"),
  },
];

/* ------------------------------------------------------------------ */
/* 播放模式                                                            */
/* ------------------------------------------------------------------ */

export type PlayMode = "list" | "one" | "shuffle";

export const PLAY_MODE_ORDER: PlayMode[] = ["list", "one", "shuffle"];

export const PLAY_MODE_LABEL: Record<PlayMode, string> = {
  list: "列表循环",
  one: "单曲循环",
  shuffle: "随机播放",
};

export function isPlayMode(value: unknown): boolean {
  return value === "list" || value === "one" || value === "shuffle";
}

/* ------------------------------------------------------------------ */
/* 工具                                                                */
/* ------------------------------------------------------------------ */

export function hasPlayableTrack(tracks: Track[]): boolean {
  return tracks.some((track) => Boolean(track.src));
}

/** 过滤出真正能播的曲目（src 为空的占位项会被丢掉） */
export function playableTracks(tracks: Track[]): Track[] {
  return tracks.filter((track) => Boolean(track.src));
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** 随机挑一个与当前不同的下标；只有一首时返回它自己 */
export function randomIndexExcept(current: number, total: number): number {
  if (total <= 1) return 0;
  let next = current;
  while (next === current) next = Math.floor(Math.random() * total);
  return next;
}

/** 循环取下一个 / 上一个下标 */
export function stepIndex(current: number, delta: number, total: number): number {
  if (total <= 0) return 0;
  return (current + delta + total) % total;
}
