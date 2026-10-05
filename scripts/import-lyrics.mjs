#!/usr/bin/env node
/**
 * 歌词登记 / 归一化。
 *
 *   npm run lyrics
 *
 * 歌词**只放一个地方**：`public/lyrics/`。
 *
 * 用法
 * ----
 * 1. 把歌词文件直接丢进 `public/lyrics/`，文件名用**歌单里的 id 或标题**都行：
 *
 *      public/lyrics/ivory-tower.lrc    ← 按 id（推荐，也是最终形态）
 *      public/lyrics/还是分开.lrc        ← 按标题
 *      public/lyrics/春娇与志明.txt      ← 纯文本也行（会转成无时间轴歌词）
 *
 * 2. 跑一次 `npm run lyrics`，脚本会：
 *    - 补上缺失的 [ti:] / [ar:] 元信息
 *    - 统一成 `public/lyrics/<id>.lrc`；标题命名或 `.txt` 的会**就地改名**并删掉原文件
 *      （避免同一首歌在目录里留下两份）
 *    - 在 `src/lib/music.ts` 对应条目里插一行 `lyrics: lyricSrc("<id>.lrc"),`
 *    - 已经登记过的只更新文件内容，不重复写
 *
 * 文件格式
 * --------
 * - `.lrc`：带时间轴的，原样保留（`[mm:ss.xx]歌词`）
 * - `.txt`：纯文本歌词，一行一句，会转成**无时间轴**的歌词
 *   （歌词窗会整段显示，不滚动也不高亮）
 *
 * ⚠️ 版权
 * --------
 * 歌词是**受版权保护的作品**。这个脚本只做格式转换和登记，
 * **不会去任何网站抓取歌词** —— 歌词文本需要你自己提供（从正版渠道复制、
 * 自己的原创、或者已经获得授权的内容）。
 *
 * 博客是公开仓库，往 `public/lyrics/` 里提交歌词等于**公开分发**。
 * 只放你有权利放的内容。
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, parse as parsePath, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LYRICS_DIR = join(ROOT, "public", "lyrics");
const MUSIC_FILE = join(ROOT, "src", "lib", "music.ts");

/* ---------------- 读歌单 ---------------- */

/**
 * 从 `src/lib/music.ts` 里扒出歌单条目。
 *
 * 用正则而不是 import —— 这是个 .mjs 脚本，解析 TS 太重了，
 * 而且我们只关心 `id` / `title` 这两个字段。
 */
function readPlaylist() {
  const source = readFileSync(MUSIC_FILE, "utf8");
  const tracks = [];

  const seen = new Set();

  for (const block of source.split("{").slice(1)) {
    const id = /id:\s*"([^"]+)"/.exec(block)?.[1];
    const title = /title:\s*"([^"]+)"/.exec(block)?.[1];
    const artist = /artist:\s*"([^"]+)"/.exec(block)?.[1] ?? "";
    if (!id || !title) continue;

    // 重复的 id 会让「按 id 找歌词」永远命中第一条 —— 后面的那首等于废了
    if (seen.has(id)) {
      console.warn(`⚠️  歌单里有重复的 id："${id}"（${title}），请改掉其中一个。`);
      continue;
    }
    seen.add(id);

    tracks.push({
      id,
      title,
      artist,
      hasLyrics: /lyrics:\s*lyricSrc\(/.test(block.slice(0, block.indexOf("},"))),
    });
  }
  return tracks;
}

/* ---------------- 格式转换 ---------------- */

/**
 * 去掉注释行（`#` 开头）与空行，剩下的就是真正的歌词。
 *
 * 用来判断一个文件「到底有没有正文」，避免生成空歌词文件
 * （歌词窗显示「这个歌词文件是空的」比不显示更糟）。
 */
function stripComments(text) {
  return text
    .replace(/^﻿/, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .join("\n");
}

/** 把纯文本歌词转成没有时间轴的 LRC（保留元信息，正文原样） */
function textToLrc(text, title, artist) {
  return `[ti:${title}]\n[ar:${artist}]\n\n${stripComments(text)}\n`;
}

/** 给已有的 LRC 补上缺失的元信息 */
function ensureMeta(lrc, title, artist) {
  let text = lrc.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  if (!/^\s*\[ti:/im.test(text)) text = `[ti:${title}]\n${text}`;
  if (!/^\s*\[ar:/im.test(text)) text = text.replace(/^(\[ti:[^\]]*\]\n?)/i, `$1[ar:${artist}]\n`);
  return text.endsWith("\n") ? text : `${text}\n`;
}

/* ---------------- 写回 music.ts ---------------- */

/** 在某个 id 的条目里插入 `lyrics: lyricSrc("xxx.lrc"),` */
function registerLyrics(source, id, fileName) {
  // 定位 `id: "<id>"` 所在的那个条目块
  const anchor = source.indexOf(`id: "${id}"`);
  if (anchor === -1) return null;

  // 找到这一条里 src 那一行的结尾，把 lyrics 插在它后面
  const srcLine = /^(\s*)src: .*$/m.exec(source.slice(anchor));
  if (!srcLine) return null;

  const indent = srcLine[1];
  const at = anchor + srcLine.index + srcLine[0].length;
  const insertion = `\n${indent}lyrics: lyricSrc("${fileName}"),`;
  return source.slice(0, at) + insertion + source.slice(at);
}

/* ---------------- 状态对照表 ---------------- */

/** 判断一首歌目前处于哪种状态：已登记 / 待登记 / 文件是空的 / 还没有歌词 */
function statusOf(track) {
  const canonical = join(LYRICS_DIR, `${track.id}.lrc`);
  if (track.hasLyrics && existsSync(canonical)) return "done";

  // 文件名对得上、但还没登记进 music.ts 的歌词
  for (const name of [`${track.id}.lrc`, `${track.id}.txt`, `${track.title}.lrc`, `${track.title}.txt`]) {
    const path = join(LYRICS_DIR, name);
    if (!existsSync(path)) continue;
    return stripComments(readFileSync(path, "utf8")) ? "ready" : "empty";
  }
  return track.hasLyrics ? "done" : "missing";
}

const STATUS_MARK = {
  done: "✓ 已登记",
  ready: "● 待登记",
  empty: "○ 空文件",
  missing: "— 无歌词",
};

/**
 * 终端里的显示宽度：中日韩字符占 **两格**，`"abc".padEnd()` 只按字符数算，
 * 所以混合中英文的表格必须自己算，否则列会歪。
 */
function displayWidth(text) {
  let width = 0;
  for (const char of text) {
    width += /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹯＀-｠￠-￦]/.test(char) ? 2 : 1;
  }
  return width;
}

function padTo(text, width) {
  return text + " ".repeat(Math.max(0, width - displayWidth(text)));
}

/** 打印「歌曲 ⇄ 歌词」对照表，一眼看出哪首还缺词 */
function printStatus(tracks) {
  const rows = tracks.map((track) => ({ ...track, state: statusOf(track) }));

  const titleWidth = Math.max(...rows.map((r) => displayWidth(r.title)), 6);
  // 歌手名可能很长（多人合唱），截断到 18 格，免得表格被撑爆
  const artistWidth = Math.min(Math.max(...rows.map((r) => displayWidth(r.artist)), 6), 18);
  const cut = (text, width) => {
    let out = "";
    for (const char of text) {
      if (displayWidth(out + char) > width) return `${out}…`;
      out += char;
    }
    return out;
  };

  const line = "─".repeat(12 + titleWidth + artistWidth + 4);

  console.log(`歌词 ⇄ 歌曲对照（${rows.length} 首）`);
  console.log(line);
  for (const row of rows) {
    const detail =
      row.state === "done"
        ? `public/lyrics/${row.id}.lrc`
        : row.state === "ready"
          ? `public/lyrics/ ← 跑 npm run lyrics 归一化并登记`
          : row.state === "empty"
            ? `public/lyrics/ 里的文件没有歌词正文`
            : `把 ${row.id}.lrc 放进 public/lyrics/`;

    console.log(
      `${padTo(STATUS_MARK[row.state], 11)} ${padTo(row.title, titleWidth)}  ${padTo(cut(row.artist, artistWidth), artistWidth)}  ${detail}`,
    );
  }

  const done = rows.filter((r) => r.state === "done").length;
  console.log(line);
  console.log(`已登记 ${done} / ${rows.length} 首歌词。\n`);
}

/* ---------------- 主流程 ---------------- */

function main() {
  if (!existsSync(LYRICS_DIR)) {
    mkdirSync(LYRICS_DIR, { recursive: true });
    console.log(`已创建 ${LYRICS_DIR}`);
  }

  const tracks = readPlaylist();
  if (tracks.length === 0) {
    console.error("没从 src/lib/music.ts 里读到任何曲目，检查一下文件格式。");
    return 1;
  }

  // README.md 也是 .md，不会被这个正则匹配到；只认 .lrc / .txt
  const files = readdirSync(LYRICS_DIR).filter((name) => /\.(lrc|txt)$/i.test(name));

  let musicSource = readFileSync(MUSIC_FILE, "utf8");
  let imported = 0;
  let updated = 0;
  let emptyCount = 0;
  const unmatched = [];

  for (const name of files) {
    const { name: base, ext } = parsePath(name);
    const track = tracks.find((item) => item.id === base || item.title === base);

    if (!track) {
      unmatched.push(name);
      continue;
    }

    const path = join(LYRICS_DIR, name);
    const raw = readFileSync(path, "utf8");

    // 文件里没有正文（只剩注释 / 空）→ 跳过，别生成空歌词文件
    if (!stripComments(raw)) {
      emptyCount += 1;
      continue;
    }

    const content =
      ext.toLowerCase() === ".txt"
        ? textToLrc(raw, track.title, track.artist)
        : ensureMeta(raw, track.title, track.artist);

    const outName = `${track.id}.lrc`;
    writeFileSync(join(LYRICS_DIR, outName), content, "utf8");

    // 文件名不是规范名（按标题命名 / .txt）→ 归一化后删掉原文件，避免同一首留两份
    if (name !== outName) {
      unlinkSync(path);
      console.log(`  ↻ ${track.title}  ${name} → ${outName}`);
    }

    if (track.hasLyrics) {
      updated += 1;
      continue;
    }

    const next = registerLyrics(musicSource, track.id, outName);
    if (!next) {
      console.log(`  ✗ ${track.title}  写进 music.ts 失败，请手工加一行 lyrics`);
      continue;
    }
    musicSource = next;
    imported += 1;
    console.log(`  ✓ ${track.title}  →  public/lyrics/${outName}`);
  }

  if (imported > 0) writeFileSync(MUSIC_FILE, musicSource, "utf8");

  console.log(
    `\n登记 ${imported} 首，更新 ${updated} 首${emptyCount > 0 ? `，空文件跳过 ${emptyCount} 个` : ""}。`,
  );

  if (unmatched.length > 0) {
    console.log(`\n没匹配上的文件（文件名要用歌单里的 id 或标题）：`);
    for (const name of unmatched) console.log(`  ${name}`);
  }

  console.log("");
  // 重新读一次歌单：上面刚往 music.ts 里写过 lyrics，旧的 tracks 还是导入前的状态
  printStatus(readPlaylist());

  if (imported > 0) {
    console.log(`记得跑一遍验证：npm run typecheck && npm run lint\n`);
  }

  return 0;
}

process.exit(main());
