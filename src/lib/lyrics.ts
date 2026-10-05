/**
 * LRC 歌词解析。
 *
 * 纯函数、零依赖 —— 可以像 `src/lib/search.ts` 那样直接用 Node 验证：
 *
 * ```bash
 * node --experimental-strip-types your-test.mjs   # import "./src/lib/lyrics.ts"
 * ```
 *
 * 支持的写法（都是网上 LRC 文件里真实会出现的）：
 *
 * ```text
 * [ti:曲名]                 元信息
 * [ar:歌手]
 * [offset:500]              整体偏移，单位是**毫秒**，正数表示延后
 * [00:12.34]一句歌词        分:秒.百分秒
 * [00:12.345]同上           三位是千分秒
 * [00:12:34]同上            分:秒:帧（百帧制）
 * [01:02.00][02:10.00]副歌  一行多个时间标签（合唱/重复段）
 * ```
 *
 * ⚠️ 没有时间轴的纯文本歌词（网上很多手写歌词就是这样）**不能丢**：
 * 解析不出来时间就整段放进 `plainText`，界面按静态文本显示。
 */

export interface LyricLine {
  /** 起始时间，秒 */
  time: number;
  text: string;
}

export interface LyricMeta {
  /** [ti:] 曲名 */
  title?: string;
  /** [ar:] 歌手 */
  artist?: string;
  /** [al:] 专辑 */
  album?: string;
  /** [by:] 歌词制作人 */
  by?: string;
}

export interface LyricSheet {
  /** 有时间戳的歌词，已按时间升序排好 */
  lines: LyricLine[];
  /**
   * 没有时间轴时的整段文本。
   *
   * `lines` 为空且这一项非空 → 界面按静态文本整段显示（不滚动、不高亮）。
   */
  plainText: string;
  meta: LyricMeta;
  /** 整体偏移（秒），来自 `[offset:]`，已经加进每一行的 time 里 */
  offset: number;
}

/** 空歌词：既没有时间轴也没有文本 */
export const EMPTY_LYRIC_SHEET: LyricSheet = {
  lines: [],
  plainText: "",
  meta: {},
  offset: 0,
};

/** `[mm:ss.xx]` / `[mm:ss.xxx]` / `[mm:ss:ff]` */
const TIME_TAG = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;

/** `[ti:xxx]` 这类独占一行的元信息标签 */
const META_TAG = /^\[(ti|ar|al|by|offset):\s*([^\]]*)\]\s*$/i;

/** 去掉 BOM（记事本保存的 LRC 经常带）与 CRLF */
function normalize(input: string): string {
  return input.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
}

/** 时间标签 → 秒 */
function toSeconds(minute: string, second: string, fraction?: string): number {
  const min = Number(minute);
  const sec = Number(second);
  if (!Number.isFinite(min) || !Number.isFinite(sec)) return 0;

  let frac = 0;
  if (fraction) {
    // 一位 = 十分秒、两位 = 百分秒、三位 = 千分秒
    const scale = fraction.length === 3 ? 1000 : fraction.length === 2 ? 100 : 10;
    const value = Number(fraction);
    frac = Number.isFinite(value) ? value / scale : 0;
  }
  return min * 60 + sec + frac;
}

/**
 * 解析 LRC 文本。
 *
 * 永远返回一个 `LyricSheet`，**不抛异常** —— 歌词是锦上添花的东西，
 * 格式再怪也不该让播放器挂掉。
 */
export function parseLrc(input: unknown): LyricSheet {
  if (typeof input !== "string" || !input.trim()) return EMPTY_LYRIC_SHEET;

  const text = normalize(input);
  const meta: LyricMeta = {};
  const collected: LyricLine[] = [];
  let offset = 0;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const metaMatch = META_TAG.exec(line);
    if (metaMatch) {
      const key = metaMatch[1].toLowerCase();
      const value = metaMatch[2].trim();
      if (key === "offset") {
        const value2 = Number(value);
        if (Number.isFinite(value2)) offset = value2 / 1000;
      } else if (key === "ti") meta.title = value;
      else if (key === "ar") meta.artist = value;
      else if (key === "al") meta.album = value;
      else if (key === "by") meta.by = value;
      continue;
    }

    // 只吃**开头连续**的时间标签：正文里出现 `[00:12]` 这种巧合不算时间轴
    const times: number[] = [];
    TIME_TAG.lastIndex = 0;
    let cursor = 0;
    let match: RegExpExecArray | null;
    while ((match = TIME_TAG.exec(line)) !== null) {
      if (match.index !== cursor) break;
      cursor = match.index + match[0].length;
      times.push(toSeconds(match[1], match[2], match[3]));
    }
    if (times.length === 0) continue;

    const body = line.slice(cursor).trim();
    for (const time of times) collected.push({ time, text: body });
  }

  if (collected.length === 0) {
    return { lines: [], plainText: text.trim(), meta, offset };
  }

  const lines = collected
    .map((item) => ({ time: Math.max(0, item.time + offset), text: item.text }))
    .sort((a, b) => a.time - b.time);

  return { lines, plainText: "", meta, offset };
}

/**
 * 找出当前时间对应的那一行；返回 -1 表示「还没唱到第一句」。
 *
 * 用二分而不是遍历：`timeupdate` 每秒会触发好几次。
 */
export function findActiveLine(lines: LyricLine[], time: number): number {
  if (lines.length === 0 || !Number.isFinite(time)) return -1;

  let low = 0;
  let high = lines.length - 1;
  let found = -1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (lines[mid].time <= time) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
}

/** 是否带时间轴（决定界面要不要滚动高亮） */
export function hasTimeline(sheet: LyricSheet): boolean {
  return sheet.lines.length > 0;
}
