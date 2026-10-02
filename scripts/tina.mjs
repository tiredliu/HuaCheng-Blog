#!/usr/bin/env node
/**
 * TinaCMS CLI 启动器 —— 把编译临时目录挪进项目内部。
 *
 * 背景
 * ----
 * TinaCMS 会先用 esbuild 把 `tina/config.ts` 编译成一个临时模块，
 * 路径写死为 `os.tmpdir()/<时间戳>/config.build.jsx`
 * （见 @tinacms/cli/dist/index.js 里的 `const tmpdir = path.join(os.tmpdir(), ...)`）。
 *
 * 问题
 * ----
 * 在某些 Windows 环境里（杀毒软件 / 企业策略 / 受限的临时目录 ACL），
 * esbuild 这个原生二进制**无法写入系统 %TEMP%**，报错：
 *
 *   error: Failed to write to output file:
 *     open C:\Users\<你>\AppData\Local\Temp\<时间戳>\config.build.jsx: Access is denied.
 *
 * 而同一个目录用 Node 自己的 `fs` 写得进去 —— 说明是进程级的写入限制，
 * 跟 Tina 配置、跟项目代码都没关系。
 *
 * 做法
 * ----
 * Node 的 `os.tmpdir()` 在 Windows 上优先读 `TEMP` 环境变量。
 * 把 `TEMP` / `TMP` 指到项目内的 `.tina-tmp/`，esbuild 就写到工作区内，
 * 问题消失；顺带也让构建过程完全自包含，不污染系统临时目录。
 *
 * 用法：node scripts/tina.mjs <dev|build|...> [...传给 tinacms 的参数]
 */

import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** 项目内的临时目录，已加入 .gitignore */
const tempDir = join(projectRoot, ".tina-tmp");
mkdirSync(tempDir, { recursive: true });

/** 解析 TinaCMS 的 CLI 入口；万一 exports 字段挡住了深层路径就退回直连 */
function resolveTinaCli() {
  try {
    return require.resolve("@tinacms/cli/bin/tinacms");
  } catch {
    return join(projectRoot, "node_modules", "@tinacms", "cli", "bin", "tinacms");
  }
}

const cli = resolveTinaCli();
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("用法: node scripts/tina.mjs <dev|build|...> [...args]");
  process.exit(1);
}

const child = spawn(process.execPath, [cli, ...args], {
  cwd: projectRoot,
  // stdio 必须是 inherit：沙箱环境下 pipe 会因命名管道被拒而失败
  stdio: "inherit",
  env: {
    ...process.env,
    TEMP: tempDir,
    TMP: tempDir,
    TMPDIR: tempDir,
  },
});

child.on("error", (error) => {
  console.error("启动 TinaCMS 失败：", error.message);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
