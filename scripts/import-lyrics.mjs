#!/usr/bin/env node
/**
 * 歌词一键导入。
 *
 *   npm run lyrics
 *
 * 用法
 * ----
 * 1. 把歌词文件放进项目根的 `lyrics-src/`（目录不存在时会先提示你创建）
 * 2. 文件名用**歌单里的标题或 id** 都行，扩展名 `.lrc` 或 `.txt` 都认：
 *
 *      lyrics-src/还是分开.lrc          ← 按标题匹配
 *      lyrics-src/ivory-tower.lrc       ← 按 id 匹配
 *      lyrics-src/春娇与志明.txt         ← 纯文本也行（会生成无时间轴歌词）
 *
 * 3. 跑一次 `npm run lyrics`，脚本会：
 *    - 把文件复制成 `public/lyrics/<id>.lrc`（顺便补上 [ti:] / [ar:] 元信息）
 *    - 在 `src/lib/music.ts` 对应条目里插一行 `lyrics: lyricSrc("<id>.lrc"),`
 *    - 已经登记过的会跳过，不会重复写
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

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, parse as parsePath, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC_DIR = join(ROOT, "lyrics-src");
const OUT_DIR = join(ROOT, "public", "lyrics");
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
 * `npm run lyrics:init` 生成的待填模板整篇都是注释 ——
 * 靠这个判断就能把「还没填」和「填了」区分开，不会生成一堆空歌词文件。
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
  const body = stripComments(text);
  return `[ti:${title}]\n[ar:${artist}]\n\n${body}\n`;
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

/* ---------------- 生成待填模板 ---------------- */

/** `npm run lyrics:init`：给歌单里每首歌生成一个待填的歌词模板 */
function initTemplates(tracks) {
  mkdirSync(SRC_DIR, { recursive: true });
  let created = 0;

  for (const track of tracks) {
    const path = join(SRC_DIR, `${track.id}.txt`);
    if (existsSync(path)) continue;

    writeFileSync(
      path,
      [
        `# 《${track.title}》— ${track.artist}`,
        `#`,
        `# 把歌词粘贴到下面，一行一句（开头的 # 是注释，导入时会被丢掉）`,
        `# 如果手上有带时间轴的 LRC，直接整段粘进来也认：`,
        `#   [00:12.34]这是一句歌词`,
        `#`,
        `# 歌词从哪来：网易云音乐 / QQ音乐 / Apple Music 的歌词面板都能复制。`,
        `# 填好之后跑：npm run lyrics`,
        ``,
      ].join("\n"),
      "utf8",
    );
    created += 1;
  }

  console.log(`已在 lyrics-src/ 生成 ${created} 个模板（已存在的不动）。\n`);
  return created;
}

/* ---------------- 状态对照表 ---------------- */

/** 判断一首歌目前处于哪种状态：已导入 / 待导入 / 模板待填 / 还没建模板 */
function statusOf(track) {
  const lrcPath = join(OUT_DIR, `${track.id}.lrc`);
  if (track.hasLyrics && existsSync(lrcPath)) return "done";

  // lyrics-src/ 里的模板填了没有（标题命名也算）
  for (const name of [`${track.id}.txt`, `${track.id}.lrc`, `${track.title}.txt`, `${track.title}.lrc`]) {
    const path = join(SRC_DIR, name);
    if (!existsSync(path)) continue;
    return stripComments(readFileSync(path, "utf8")) ? "ready" : "empty";
  }
  return track.hasLyrics ? "done" : "missing";
}

const STATUS_MARK = { done: "✓ 已导入", ready: "● 待导入", empty: "○ 待填写", missing: "— 无模板" };

/**
 * 终端里的显示宽度：中日韩字符占 **两格**，`"abc".padEnd()` 只按字符数算，
 * 所以混合中英文的表格必须自己算，否则列会歪。
 */
function displayWidth(text) {
  let width = 0;
  for (const char of text) {
    width += /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹯＀-｠￠-￦]/.test(char)
      ? 2
      : 1;
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
  const artistWidth = Math.min(
    Math.max(...rows.map((r) => displayWidth(r.artist)), 6),
    18,
  );
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
          ? `lyrics-src/${row.id}.txt  ← 跑 npm run lyrics 导入`
          : row.state === "empty"
            ? `lyrics-src/${row.id}.txt  ← 还没粘歌词`
            : `跑 npm run lyrics:init 建模板`;

    console.log(
      `${padTo(STATUS_MARK[row.state], 11)} ${padTo(row.title, titleWidth)}  ${padTo(cut(row.artist, artistWidth), artistWidth)}  ${detail}`,
    );
  }

  const done = rows.filter((r) => r.state === "done").length;
  console.log(line);
  console.log(`已导入 ${done} / ${rows.length} 首歌词。\n`);
}

/* ---------------- 主流程 ---------------- */

function main() {
  const isInit = process.argv.includes("--init");

  if (!existsSync(SRC_DIR)) {
    mkdirSync(SRC_DIR, { recursive: true });
    console.log(`已创建 ${SRC_DIR}`);
    console.log("把歌词文件放进去（文件名用歌单里的标题或 id），再跑一次 npm run lyrics。\n");
  }

  const tracks = readPlaylist();
  if (tracks.length === 0) {
    console.error("没从 src/lib/music.ts 里读到任何曲目，检查一下文件格式。");
    return 1;
  }

  if (isInit) {
    initTemplates(tracks);
    printStatus(tracks);
    console.log("把歌词粘进 lyrics-src/ 之后跑：npm run lyrics\n");
    return 0;
  }

  const files = existsSync(SRC_DIR)
    ? readdirSync(SRC_DIR).filter((name) => /\.(lrc|txt)$/i.test(name))
    : [];

  if (files.length === 0) {
    console.log(`lyrics-src/ 里还没有歌词文件。跑 npm run lyrics:init 可以按歌单生成一套待填模板。\n`);
    printStatus(tracks);
    return 0;
  }

  let musicSource = readFileSync(MUSIC_FILE, "utf8");
  let imported = 0;
  let skipped = 0;
  let pending = 0;
  const unmatched = [];

  for (const name of files) {
    const { name: base, ext } = parsePath(name);
    const track = tracks.find((item) => item.id === base || item.title === base);

    if (!track) {
      unmatched.push(name);
      continue;
    }

    const raw = readFileSync(join(SRC_DIR, name), "utf8");

    // 模板还没填（去掉注释后没有正文）→ 跳过，别生成空歌词文件
    if (!stripComments(raw)) {
      pending += 1;
      continue;
    }

    const content =
      ext.toLowerCase() === ".txt"
        ? textToLrc(raw, track.title, track.artist)
        : ensureMeta(raw, track.title, track.artist);

    const outName = `${track.id}.lrc`;
    writeFileSync(join(OUT_DIR, outName), content, "utf8");

    if (track.hasLyrics) {
      skipped += 1;
      console.log(`  ↷ ${track.title}  歌词文件已更新（music.ts 里已经登记过）`);
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

  console.log(`\n导入 ${imported} 首，更新 ${skipped} 首${pending > 0 ? `，待填 ${pending} 首` : ""}。`);

  if (unmatched.length > 0) {
    console.log(`\n没匹配上的文件（文件名要用歌单里的标题或 id）：`);
    for (const name of unmatched) console.log(`  ${name}`);
  }

  console.log("");
  // 重新读一次歌单：上面刚往 music.ts 里写过 lyrics，旧的 tracks 还是导入前的状态
  printStatus(readPlaylist());

  if (imported > 0) {
    console.log(`记得跑一遍验证：npx tsc --noEmit && npx eslint .\n`);
  }

  return 0;
}

process.exit(main());
