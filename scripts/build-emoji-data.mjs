/**
 * 生成评论区「GitHub 原生表情」的数据文件 public/emoji-data.json。
 *
 * ```bash
 * npm run emoji:data
 * ```
 *
 * 数据源是两个**官方**仓库，两边都没有第三方整理误差：
 *
 * | 源 | 提供什么 | 授权 |
 * | --- | --- | --- |
 * | `github/gemoji` 的 `db/emoji.json` | GitHub 自己的短代码列表（`:lol:` 这种才是评论区认的写法） | MIT |
 * | Unicode CLDR `annotations/en.xml` / `zh.xml` | 每个 emoji 的官方名称与搜索关键词（含大量中文） | Unicode License |
 *
 * ⚠️ 为什么必须用 gemoji 而不是 Unicode 全表：
 * GitHub 评论框只认它自己那份别名表（约 1870 个）。Unicode 里有的 emoji，
 * GitHub 不一定有短代码；反过来 `:shipit:`、`:octocat:`、`:trollface:`
 * 这些 GitHub 特有的短代码，Unicode 表里也没有。
 * 复制一个 GitHub 不认识的 `:xxx:`，粘贴过去只会原样显示成文字。
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

/** 缓存下载的中间文件，避免每次重跑都打网络（`.workbuddy/` 已被 gitignore） */
const CACHE_DIR = ".workbuddy/tmp";

const SOURCES = {
  gemoji: {
    file: "gemoji.json",
    url: "https://raw.githubusercontent.com/github/gemoji/master/db/emoji.json",
  },
  cldrEn: {
    file: "cldr-en.xml",
    url: "https://raw.githubusercontent.com/unicode-org/cldr/main/common/annotations/en.xml",
  },
  cldrZh: {
    file: "cldr-zh.xml",
    url: "https://raw.githubusercontent.com/unicode-org/cldr/main/common/annotations/zh.xml",
  },
};

const OUT_FILE = "public/emoji-data.json";

/** gemoji 的九个大类 → 中文 + 一个配它是第几位的序号 */
const CATEGORY_LABELS = {
  "Smileys & Emotion": "表情",
  "People & Body": "人物",
  "Animals & Nature": "动物与自然",
  "Food & Drink": "食物与饮品",
  "Travel & Places": "旅行与地点",
  Activities: "活动",
  Objects: "物品",
  Symbols: "符号",
  Flags: "旗帜",
};

/**
 * 下载（缺缓存时才打网络）。
 *
 * 本机到 GitHub 的连接经常抽风，`--retry-all-errors` 必须带上，
 * 否则一次 5xx / 连接重置就会让整段脚本白跑。
 */
function ensureSource({ file, url }) {
  const target = path.join(CACHE_DIR, file);
  if (fs.existsSync(target) && fs.statSync(target).size > 0) {
    console.log(`  缓存命中 ${file}`);
    return target;
  }
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  console.log(`  下载 ${file} …`);
  execFileSync(
    "curl",
    [
      "-sS", "-L",
      "--retry", "5", "--retry-all-errors", "--retry-delay", "3",
      "--connect-timeout", "20",
      "-o", target,
      url,
    ],
    { stdio: "inherit" },
  );
  return target;
}

/**
 * 解析 CLDR annotations 文件。
 *
 * 它的格式是每行一个 `<annotation>`，`type="tts"` 的那条是正式名称，
 * 其余的是搜索关键词（用 `|` 分隔）。
 */
function parseCldr(file) {
  const xml = fs.readFileSync(file, "utf8");
  const map = new Map();
  const re = /<annotation cp="([^"]+)"(?:\s+type="([^"]*)")?>([^<]*)<\/annotation>/g;
  let match;
  while ((match = re.exec(xml)) !== null) {
    const [, cp, type, text] = match;
    const entry = map.get(cp) ?? { short: "", keywords: [] };
    if (type === "tts") {
      entry.short = text.trim();
    } else {
      for (const part of text.split("|")) {
        const kw = part.trim();
        if (kw) entry.keywords.push(kw);
      }
    }
    map.set(cp, entry);
  }
  return map;
}

/**
 * 按 cp 取值，找不到就退化到「去掉变体选择符」的版本。
 *
 * ❤️ 这类字符是 U+2764 + U+FE0F（VS16），而 CLDR 的表里只登记了 U+2764，
 * 直接查会漏掉一大批。
 */
function lookup(map, char) {
  const direct = map.get(char);
  if (direct) return direct;
  const stripped = char.replace(/\uFE0F/g, "");
  if (stripped !== char) return map.get(stripped);
  return undefined;
}

/** 去掉重复、去空，限制条数（关键词太多只会让 JSON 变大、搜索变慢） */
function dedupe(list, limit) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const key = item.toLowerCase();
    if (!item || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

function main() {
  console.log("① 准备数据源");
  const gemojiFile = ensureSource(SOURCES.gemoji);
  const enFile = ensureSource(SOURCES.cldrEn);
  const zhFile = ensureSource(SOURCES.cldrZh);

  console.log("② 解析数据");
  const gemoji = JSON.parse(fs.readFileSync(gemojiFile, "utf8"));
  const en = parseCldr(enFile);
  const zh = parseCldr(zhFile);
  console.log(`  gemoji ${gemoji.length} 个 / CLDR 中文 ${zh.size} 条 / 英文 ${en.size} 条`);

  console.log("③ 合并生成");
  const cats = [];
  const list = [];
  let zhNamed = 0;

  for (const item of gemoji) {
    const char = item.emoji;
    // 主别名就是 `:xxx:` 里那个 xxx，也是 GitHub 官方推荐的写法
    const slug = item.aliases[0];
    if (!slug) continue;

    let catIndex = cats.indexOf(item.category);
    if (catIndex === -1) {
      cats.push(item.category);
      catIndex = cats.length - 1;
    }

    const zhEntry = lookup(zh, char);
    const enEntry = lookup(en, char);
    // 显示名：优先中文正式名，没有就退回 gemoji 的英文 description
    const name = zhEntry?.short || enEntry?.short || item.description || slug;
    if (zhEntry?.short) zhNamed += 1;

    const keywords = dedupe(
      [
        ...(zhEntry?.keywords ?? []),
        name,
        ...item.aliases,
        ...(item.tags ?? []),
        // 英文正式名留着：搜 "smile"、"cry" 这类反而比中文更常用
        enEntry?.short ?? "",
      ],
      10,
    );

    list.push([char, slug, name, keywords.join(" "), catIndex]);
  }

  const payload = {
    /** 数据格式版本，将来改结构时让前端能识别要不要重新拉 */
    v: 1,
    cats: cats.map((id) => CATEGORY_LABELS[id] ?? id),
    /** [字符, 短代码, 显示名, 搜索关键词, 分类序号] —— 数组比对象省一大半体积 */
    list,
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, `${JSON.stringify(payload)}\n`, "utf8");

  const kb = Math.round(fs.statSync(OUT_FILE).size / 1024);
  console.log(`④ 已写入 ${OUT_FILE}`);
  console.log(`   ${list.length} 个表情 / ${cats.length} 个分类 / 中文名覆盖 ${zhNamed} 个 / 约 ${kb} KB`);
}

main();
