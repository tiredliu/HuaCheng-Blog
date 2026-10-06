/**
 * 生成评论区「图片表情包」的图片与清单。
 *
 * ```bash
 * npm run emoji:pack
 * ```
 *
 * 图片来自**微软 Fluent Emoji**（仓库 `microsoft/fluentui-emoji`），
 * 授权是 **MIT** —— 可以商用、可以修改、可以不署名，只要保留版权声明。
 * 这条很重要：本站是公开仓库，提交进去等于公开分发，
 * 所以这里只敢放明确允许再发布的素材。
 *
 * ## 想换成「自己画 / 自己找」的表情包
 *
 * 这个脚本也负责给 `public/emojis/` 做清单。所以只要：
 *
 * 1. 把图片丢进 `public/emojis/`（png / gif / jpg / webp 都行）
 * 2. 再跑一次 `npm run emoji:pack`
 *
 * 脚本会扫描目录里所有图片，**自动登记**未在内置清单里的文件 ——
 * 显示名缺省就用文件名（去掉扩展名、下划线转空格），之后可以自己在
 * `index.json` 里改好看一点。已在内置清单里的不会被覆盖。
 *
 * ⚠️ 不能联网时也不会把整个脚本搞挂：下载失败的文件会被跳过，
 * 只剩下 manufacturing 出来的清单是缺项 —— 下次联网重跑即可补齐。
 */
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const OUT_DIR = "public/emojis";
const OUT_INDEX = path.join(OUT_DIR, "index.json");
const DATA_FILE = "public/emoji-data.json";
const CACHE_DIR = ".workbuddy/tmp";

/** Fluent Emoji 的原始仓库与我们要的风格分支 */
const FLUENT_BASE = "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets";
/** 3D 是唯一提供 PNG 的风格（其它风格只有 SVG，SVG 在 GitHub 评论区不一定渲染） */
const FLUENT_STYLE = "3D";

/** 清单里记录的图片格式 */
const IMAGE_EXTS = [".png", ".gif", ".jpg", ".jpeg", ".webp"];

/**
 * 要抓哪些表情。
 *
 * 不是全表 —— 全表 3000 多张图会平白给仓库加十几 MB。
 * 这里挑的是「评论区真的用得上」的：反应、手势、爱心、动物、梗图符号，
 * 以及一堆程序员常用的。改这一行就能调整包的内容。
 */
const PICKS = [
  // 表情反应
  "😂", "🤣", "😭", "😅", "😊", "😍", "🥰", "😘", "😉", "😎", "🥳", "😜",
  "🤔", "😐", "😑", "😴", "🥱", "😤", "😡", "🤯", "😱", "😳", "🥺", "😬",
  "🤡", "👻", "💀", "🤖", "😈", "👽", "🎃", "😇", "🙃", "😶‍🌫️", "🤗", "🫠",
  // 手势
  "👍", "👎", "👌", "✌️", "🤞", "👏", "🙌", "🙏", "💪", "🤝", "👋", "🫶",
  "👀", "🫡", "🤌", "👇", "👉", "🖕",
  // 爱心与闪光
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🤍", "🖤", "💔", "💖", "💯", "✨",
  "⭐", "🌟", "🔥", "🎉", "🎊", "⚡", "🌈",
  // 动物自然
  "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮",
  "🐷", "🐸", "🐵", "🐔", "🐧", "🦆", "🦄", "🐝", "🦋", "🐌", "🐛", "🐢",
  "🐳", "🐬", "🐙", "🦀", "🌸", "🌺", "🌻", "🌹", "🍀", "🌵", "🌙", "☀️",
  "⛅", "❄️", "🌊", "🌍",
  // 吃喝
  "🍎", "🍊", "🍋", "🍉", "🍇", "🍓", "🍑", "🥑", "🌽", "🍞", "🧀", "🍜",
  "🍚", "🍔", "🍟", "🍕", "🌮", "🍣", "🍰", "🎂", "🍪", "🍫", "🍿", "☕",
  "🍺", "🍻", "🧋",
  // 程序员 & 日常
  "💻", "⌨️", "🖥️", "📱", "🎧", "🎮", "🕹️", "📷", "🎬", "📚", "📝", "✏️",
  "📌", "📎", "🔍", "💡", "🔧", "🔨", "🛠️", "🧩", "📦", "🚀", "🛸", "🛏️",
  "⏰", "⌛", "💤", "💩", "🐛", "🦠", "🤖",
  // 注：`:shipit:`、`:octocat:` 这类 GitHub 特有短代码没有 Unicode 字符，
  // 在图片包里不存在，只能走「GitHub 表情」那个 Tab。
];

/** 并发下载的路数。太高会被 GitHub 限流，太低本机网络差时会很慢 */
const CONCURRENCY = 6;

/** 压缩脚本。python 命令在本机不一定存在，找不到就跳过这一步 */
const SHRINK_SCRIPT = "scripts/shrink-emoji-pack.py";
const PYTHON_CANDIDATES = process.platform === "win32" ? ["python", "py"] : ["python3", "python"];

/**
 * 把下载来的 256px 原图缩到 128px 左右。
 *
 * 原图平均 34 KB，一波下来好几 MB，而它们在面板里只显示 24px。
 * 缩完观感几乎没差别，仓库流量都省一大半 —— 但**这一步可有可无**，
 * 没装 Python / Pillow 时保持原图，功能不受影响。
 */
async function shrinkImages() {
  for (const bin of PYTHON_CANDIDATES) {
    try {
      // ⑨ 不需要 stdio 继承，但错误要看得见
      const { stdout, stderr } = await execFileAsync(bin, [SHRINK_SCRIPT], { encoding: "utf8" });
      const text = `${stdout}${stderr}`.trim();
      console.log(`  ${text || "压缩完成"}`);
      return true;
    } catch {
      // 换下一个候选
    }
  }
  console.log("  跳过压缩：本机没有可用的 python 或 Pillow（不影响使用，只是图会大一点）");
  return false;
}

function parseCldr(file) {
  const xml = fsSync.readFileSync(file, "utf8");
  const map = new Map();
  const re = /<annotation cp="([^"]+)"(?:\s+type="([^"]*)")?>([^<]*)<\/annotation>/g;
  let match;
  while ((match = re.exec(xml)) !== null) {
    const [, cp, type, text] = match;
    const entry = map.get(cp) ?? { short: "", keywords: [] };
    if (type === "tts") entry.short = text.trim();
    map.set(cp, entry);
  }
  return map;
}

/** 同上：带 VS16 的（如 ❤️）要退化到裸码点再查一次 */
function lookup(map, char) {
  const direct = map.get(char);
  if (direct) return direct;
  const stripped = char.replace(/\uFE0F/g, "");
  if (stripped !== char) return map.get(stripped);
  return undefined;
}

/**
 * 算出 Fluent Emoji 的图片地址。
 *
 * 它的目录名就是 Unicode CLDR 的英文短名，只是首字母大写；
 * 文件名是短名小写、空格换下划线，再拼风格后缀（例如 `_3d`）。
 *
 * ⚠️ **支持肤色的表情路径不一样**：Fluent 的手势类（👍👏🙏…）放在
 * `<名称>/Default/3D/<slug>_3d_default.png`，而不是 `<名称>/3D/<slug>_3d.png`。
 * 这一类在 gemoji 里带 `skin_tones: true`，可以**直接判定**，不用猜。
 * 猜错的会 404，在下载阶段被丢掉，不影响其它图片。
 */
function fluentUrl(char, enShort, needsSkinTone) {
  if (!enShort) return null;
  const folder = enShort.charAt(0).toUpperCase() + enShort.slice(1);
  const slug = enShort.toLowerCase().replace(/\s+/g, "_");
  const enc = encodeURIComponent;
  const base = `${FLUENT_BASE}/${enc(folder)}`;
  return needsSkinTone
    ? `${base}/Default/${FLUENT_STYLE}/${enc(slug)}_${FLUENT_STYLE.toLowerCase()}_default.png`
    : `${base}/${FLUENT_STYLE}/${enc(slug)}_${FLUENT_STYLE.toLowerCase()}.png`;
}

async function download(url, target) {
  try {
    await execFileAsync(
      "curl",
      [
        "-sS", "-L", "-f",
        "--retry", "4", "--retry-all-errors", "--retry-delay", "2",
        "--connect-timeout", "15", "--max-time", "60",
        "-o", target,
        url,
      ],
      { encoding: "utf8" },
    );
    return true;
  } catch {
    return false;
  }
}

/** 一串任务，同时最多跑 CONCURRENCY 个 */
async function mapLimit(items, worker) {
  const results = [];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (cursor < items.length) {
        const at = cursor;
        cursor += 1;
        results[at] = await worker(items[at], at);
      }
    }),
  );
  return results;
}

async function main() {
  console.log("① 读取表情数据");
  const data = JSON.parse(fsSync.readFileSync(DATA_FILE, "utf8"));
  // char → { slug, name, keywords }
  const byChar = new Map();
  for (const [char, slug, name, keywords] of data.list) {
    if (!byChar.has(char)) byChar.set(char, { slug, name, keywords });
  }

  const en = parseCldr(path.join(CACHE_DIR, "cldr-en.xml"));
  // 只有 gemoji 这份源里才有「是否支持肤色」的标记，用来选路径分支
  const gemoji = JSON.parse(fsSync.readFileSync(path.join(CACHE_DIR, "gemoji.json"), "utf8"));
  const skinToneChars = new Set(
    gemoji.filter((item) => item.skin_tones).map((item) => item.emoji.replace(/\uFE0F/g, "")),
  );
  await fs.mkdir(OUT_DIR, { recursive: true });

  console.log(`② 下载 ${PICKS.length} 张 @ Fluent Emoji (MIT)`);
  const jobs = PICKS.map((char) => {
    const info = byChar.get(char);
    if (!info) return { char, skip: "GitHub 没有这个短代码" };
    const fileName = `${info.slug}.png`;
    const url = fluentUrl(char, lookup(en, char)?.short, skinToneChars.has(char.replace(/\uFE0F/g, "")));
    if (!url) return { char, skip: "CLDR 里查不到英文名" };
    return { char, info, fileName, url, target: path.join(OUT_DIR, fileName) };
  }).filter((job) => {
    if (job.skip) console.log(`  - ${job.char} 跳过：${job.skip}`);
    return !job.skip;
  });

  const results = await mapLimit(jobs, async (job) => {
    const target = job.target;
    if (fsSync.existsSync(target) && fsSync.statSync(target).size > 0) {
      return { ...job, state: "cached" };
    }
    const ok = await download(job.url, target);
    return { ...job, state: ok ? "downloaded" : "failed" };
  });

  const ok = results.filter((r) => r.state !== "failed");
  const failed = results.filter((r) => r.state === "failed");
  console.log(`  成功 ${ok.length} 张${failed.length ? `，失败 ${failed.length} 张` : ""}`);
  if (failed.length) {
    console.log(`  失败清单（下次重跑会重试）：${failed.slice(0, 20).map((r) => r.char).join(" ")}`);
  }

  console.log("③ 压缩到 128px");
  await shrinkImages();

  console.log("④ 扫描目录里额外放进去的图片");
  const builtinFiles = new Set(ok.map((r) => r.fileName));
  const known = new Map(
    ok.map((r) => [r.fileName, { char: r.char, name: r.info.name, keywords: r.info.keywords }]),
  );

  const dirEntries = await fs.readdir(OUT_DIR, { withFileTypes: true });
  for (const entry of dirEntries) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!IMAGE_EXTS.includes(ext) || builtinFiles.has(entry.name)) continue;
    known.set(entry.name, {
      // 自己丢进来的图默认没有对应字符：面板里就只显示图片
      char: "",
      name: path.basename(entry.name, ext).replace(/_/g, " "),
      keywords: path.basename(entry.name, ext).replace(/_/g, " "),
    });
  }

  const list = [...known.entries()].map(([file, meta]) => ({
    f: file,
    n: meta.name,
    c: meta.char,
    k: meta.keywords,
  }));

  await fs.mkdir(path.dirname(OUT_INDEX), { recursive: true });
  await fs.writeFile(OUT_INDEX, `${JSON.stringify({ v: 1, list }, null, 0)}\n`, "utf8");

  let bytes = 0;
  for (const item of list) {
    try {
      bytes += fsSync.statSync(path.join(OUT_DIR, item.f)).size;
    } catch {
      /* 文件缺失不影响清单 */
    }
  }

  console.log(`⑤ 已写入 ${OUT_INDEX}`);
  console.log(`   ${list.length} 张图 / 合计 ${(bytes / 1024 / 1024).toFixed(2)} MB`);
}

main();
