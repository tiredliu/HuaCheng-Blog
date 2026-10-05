import { lyricUrl, musicUrl } from "@/lib/assets";
import { withBasePath } from "@/lib/site";

export interface Track {
  id: string;
  title: string;
  artist: string;
  /** 音频地址：`public/music/` 下的文件，或第三方直链 */
  src: string;
  /** 封面图，可选（放 `public/images/`） */
  cover?: string;
  /** 外链（例如网易云 / B 站），点击后新窗口打开 */
  link?: string;
  /**
   * 歌词地址（LRC 文本），**可以留空**。
   *
   * 留空时歌词悬浮窗会显示「这首歌还没有歌词」，不会报错。
   * 想加歌词就把 `.lrc` 放进 `public/lyrics/`，再用 `lyricUrl("文件名.lrc")` 登记。
   */
  lyrics?: string;
}

/** 歌词文件的站内地址（加歌词时用，见 `scripts/import-lyrics.mjs`） */
export function lyricSrc(fileName: string): string {
  return withBasePath(lyricUrl(fileName));
}

/**
 * 默认歌单。
 *
 * 音频放 `public/music/`，歌词放 `public/lyrics/`，各登记一行即可。
 * 也可以在 MDX 里写 `<AudioPlayer src="..." title="..." />` 单独插入一首。
 *
 * 加一首新歌：
 * 1. 把音频丢进 `public/music/`，在这里补一条 `src`
 * 2. 有歌词的话用 `npm run lyrics` 一键导入（见 scripts/import-lyrics.mjs）
 *
 * `lyrics` 是可选的，留空时歌词窗显示「这首歌还没有歌词」，不会报错。
 */
export const defaultPlaylist: Track[] = [
  {
    id: "fool-for-you",
    title: "Fool For You",
    artist: "KASTRA",
    src: withBasePath(musicUrl("KASTRA - Fool For You.mp3")),
    lyrics: lyricSrc("fool-for-you.lrc"),
  },
  {
    // 没找到歌词，留空 —— 歌词窗会显示「这首歌还没有歌词」
    id: "mitsuha-no-theme",
    title: "三葉のテーマ",
    artist: "RADWIMPS",
    src: withBasePath(musicUrl("RADWIMPS - 三葉のテーマ.mp3")),
  },
  {
    id: "deng-deng-deng-deng",
    title: "等等等等",
    artist: "joysaaaa",
    src: withBasePath(musicUrl("joysaaaa - 等等等等.mp3")),
    lyrics: lyricSrc("deng-deng-deng-deng.lrc"),
  },
  {
    id: "insomnia-flight",
    title: "失眠飞行",
    artist: "接个吻，开一枪 & 沈以诚 & 薛明媛",
    src: withBasePath(musicUrl("失眠飞行-接个吻，开一枪&沈以诚&薛明媛.mp3")),
    lyrics: lyricSrc("insomnia-flight.lrc"),
  },
  {
    id: "haru-wo-matsu",
    title: "春を待つ (feat. 倚水)",
    artist: "Islet & 倚水",
    src: withBasePath(musicUrl("春を待つ(feat. 倚水)-Islet&倚水.mp3")),
    lyrics: lyricSrc("haru-wo-matsu.lrc"),
  },
  {
    id: "jie-bu-diao",
    title: "戒不掉（原声版）",
    artist: "欧阳耀莹",
    src: withBasePath(musicUrl("欧阳耀莹 - 戒不掉（原声版）.mp3")),
    lyrics: lyricSrc("jie-bu-diao.lrc"),
  },
  {
    id: "ivory-tower",
    title: "IVORY TOWER",
    artist: "澤野弘之 & SennaRin",
    src: withBasePath(musicUrl("澤野弘之,SennaRin - IVORY TOWER.mp3")),
    lyrics: lyricSrc("ivory-tower.lrc"),
  },
  {
    id: "inochi-no-namae",
    title: "生命之名",
    artist: "千与千寻",
    src: withBasePath(musicUrl("生命之名-千与千寻.mp3")),
  },
  {
    id: "dive-back-in-time",
    title: "Dive Back in Time",
    artist: "白鲨 JAWS",
    src: withBasePath(musicUrl("白鲨jaws-dive back in time.mp3")),
    lyrics: lyricSrc("dive-back-in-time.lrc"),
  },
  {
    id: "kuuchuu-sanpo",
    title: "空中散歩",
    artist: "CIEL",
    src: withBasePath(musicUrl("空中散歩-CIEL.mp3")),
    lyrics: lyricSrc("kuuchuu-sanpo.lrc"),
  },
  {
    id: "chunjiao-yu-zhiming",
    title: "春娇与志明",
    artist: "街道办GDC & 欧阳耀莹",
    src: withBasePath(musicUrl("街道办GDC&欧阳耀莹-春娇与志明.mp3")),
    lyrics: lyricSrc("chunjiao-yu-zhiming.lrc"),
  },
  {
    id: "520am",
    title: "5：20AM（日语版）",
    artist: "三哈",
    src: withBasePath(musicUrl("日语填词《520AM》无损完整版（换源后）.mp3")),
    lyrics: lyricSrc("520am.lrc"),
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
