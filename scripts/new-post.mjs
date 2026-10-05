#!/usr/bin/env node
/**
 * 新建一篇文章：`npm run new`
 *
 * 它只做三件事：
 *   1. 问你标题
 *   2. 生成一个**合法的 ASCII 文件名**和 frontmatter 骨架
 *   3. 用 VS Code 打开它
 *
 * 为什么值得有这个脚本
 * --------------------
 * 手写新文章的摩擦力全在「想文件名、抄 frontmatter、算日期」这三件事上。
 * 更麻烦的是**文件名必须是 ASCII**：
 *
 *   实测（2026-10）：`content/posts/中文文件名测试.mdx` 在本机 `npm run dev` 下
 *   访问 `/posts/中文文件名测试/` 会 500 / 404，而 ASCII 文件名一切正常。
 *   原因和「中文标签」那个坑是同一个 —— Next 拿 URL 里**已编码的**路径段
 *   去和 `generateStaticParams()` 的返回值比，中文永远不相等。
 *   静态产物里还真的会出现 `out/posts/中文文件名测试/` 这种目录名。
 *
 *   所以这个脚本会把非 ASCII 的文件名直接挡掉，而不是让你上线之后才发现。
 *
 * 用法
 * ----
 *   npm run new                       # 交互式问标题和文件名
 *   npm run new -- "文章标题"          # 只给标题，文件名自动推导
 *   npm run new -- "标题" my-slug      # 标题 + 指定文件名
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const postsDir = join(projectRoot, "content", "posts");

/** 把任意输入压成 URL 里安全的 slug；全是非 ASCII 时返回空串 */
function toSlug(input) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function today() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** 标题没有可用的 ASCII 时，退回「post-日期」，保证一定能生成合法文件名 */
function suggestSlug(title) {
  return toSlug(title) || `post-${today()}`;
}

/** 撞名时加 -2 / -3，不覆盖已有文章 */
function uniqueSlug(base) {
  let candidate = base;
  let index = 2;
  while (existsSync(join(postsDir, `${candidate}.mdx`))) {
    candidate = `${base}-${index}`;
    index += 1;
  }
  return candidate;
}

function renderPost(title) {
  return [
    "---",
    `title: ${title}`,
    `date: ${today()}`,
    "tags: []",
    'summary: ""',
    "draft: false",
    "---",
    "",
    "",
  ].join("\n");
}

/** 把文件丢给 VS Code 打开；没装 / 不在 PATH 就安静跳过 */
function openInEditor(file) {
  try {
    const child = spawn("code", [file], {
      cwd: projectRoot,
      stdio: "ignore",
      detached: true,
      shell: true,
    });
    child.on("error", () => {});
    child.unref();
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!existsSync(postsDir)) {
    console.error(`找不到 ${postsDir} —— 请在仓库根目录运行（npm run new 会自动用根目录）。`);
    return 1;
  }

  const [, , argTitle, argSlug] = process.argv;
  let title = argTitle?.trim() ?? "";
  let slug = argSlug ? toSlug(argSlug) : "";

  // 只在**交互终端**里提问。管道 / CI 里 stdin 不是 TTY，
  // 这时候去 question() 会一直挂住 —— 所以宁可退回到自动推导的文件名。
  const interactive = Boolean(process.stdin.isTTY);
  const rl = interactive ? createInterface({ input: process.stdin, output: process.stdout }) : null;

  try {
    if (!title) {
      if (!rl) {
        console.error('没有提供标题，而且当前不是交互终端。用法：npm run new -- "文章标题"');
        return 1;
      }
      title = (await rl.question("文章标题：")).trim();
    }
    if (!title) {
      console.error("标题不能为空。");
      return 1;
    }

    const fallback = suggestSlug(title);

    if (!slug && rl) {
      console.log("");
      console.log("文件名只影响网址，建议用英文或数字（例：hello-world）。");
      console.log("⚠️ 不能用中文 —— 中文文件名会让这篇文章在本机 npm run dev 下打不开。");
      console.log("");
      const answer = (await rl.question(`文件名（直接回车用 ${fallback}）：`)).trim();
      slug = toSlug(answer);
      if (answer && !slug) {
        console.log("");
        console.log(`「${answer}」里没有可用的英文字母或数字，改用 ${fallback}。`);
        console.log("（想要更好看的网址，可以之后直接给文件改名，记得同时改标题。）");
      }
    }

    if (!slug) slug = fallback;

    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
      console.error(`文件名不合法：${slug}。只允许小写字母、数字和连字符。`);
      return 1;
    }

    const finalSlug = uniqueSlug(slug);
    const file = join(postsDir, `${finalSlug}.mdx`);

    mkdirSync(postsDir, { recursive: true });
    writeFileSync(file, renderPost(title), "utf8");

    const opened = openInEditor(file);

    console.log("");
    console.log(`✅ 已创建 content/posts/${finalSlug}.mdx`);
    console.log("");
    console.log("接下来：");
    console.log("  · 预览：另开一个终端跑 npm run dev，然后打开");
    console.log(`      http://localhost:3000/posts/${finalSlug}/`);
    console.log("  · 想先当草稿：把 frontmatter 里的 draft 改成 true");
    console.log("      （那样只在本机可见，不会出现在线上）");
    console.log("  · 发布：git add . && git commit -m \"post: " + title + "\" && git push");
    console.log("      或者用 GitHub Desktop 点一下 Commit + Push");
    if (!opened) {
      console.log("");
      console.log("（没能自动打开编辑器 —— 确认 VS Code 的 code 命令在 PATH 里）");
    }
    return 0;
  } finally {
    rl?.close();
  }
}

process.exit(await main());
