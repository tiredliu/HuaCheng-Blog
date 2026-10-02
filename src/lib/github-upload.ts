"use client";

import { blobToBase64 } from "@/lib/image-utils";
import { SITE } from "@/lib/site";

/**
 * 不用后端，直接把文件写进仓库的 `public/uploads/`。
 *
 * 原理：GitHub 的 Contents API 支持浏览器跨域直连
 * （预检返回 `Access-Control-Allow-Origin: *`，且允许 `Authorization` 头与 `PUT` 方法），
 * 所以带上一个 **fine-grained PAT** 就能从浏览器直接提交文件，
 * 提交后仓库更新 → Cloudflare Pages 自动重新构建。
 *
 * ⚠️ 安全边界：
 * - token 只存在访问者自己的浏览器里，也只会发往 `api.github.com`
 * - 请使用**仅限这一个仓库、仅 Contents: Read and write** 的细粒度 token，
 *   不要用 classic token，更不要给 `repo` 全量权限
 * - 一旦站点被 XSS 注入，localStorage 里的 token 会被读走，
 *   所以不要引入来路不明的第三方脚本
 */

export interface GithubConfig {
  token: string;
  owner: string;
  repo: string;
  branch: string;
}

export const GITHUB_CONFIG_KEY = "hc-blog:github";

/** 上传目标目录（相对仓库根） */
export const UPLOAD_DIR = "public/uploads";

/** 浏览器端可访问的目录（用于拼 URL） */
export const UPLOAD_URL_DIR = "/uploads";

export function isGithubConfig(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const config = value as GithubConfig;
  return (
    typeof config.token === "string" &&
    typeof config.owner === "string" &&
    typeof config.repo === "string" &&
    typeof config.branch === "string"
  );
}

/** 从仓库地址里解析 owner / repo */
export function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  const match = /github\.com[/:]([^/]+)\/([^/#?]+)/i.exec(url.trim());
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/i, "") };
}

const GUESSED_REPO = parseRepoUrl(SITE.repository);

/** owner / repo 从站点里的仓库地址推断，站长只需要填 token */
export const EMPTY_GITHUB_CONFIG: GithubConfig = {
  token: "",
  owner: GUESSED_REPO?.owner ?? "",
  repo: GUESSED_REPO?.repo ?? "",
  branch: "main",
};

/**
 * 「站长模式」的判定依据。
 *
 * 本机存着 GitHub Token 就说明这台浏览器持有仓库写权限 ——
 * 写文章、传壁纸、保存站点默认值、发布/回复留言，用的都是这一个凭据。
 * 所以不需要另做一套登录系统：能不能写仓库，就是「是不是站长」。
 */
export function isGithubConfigured(config: GithubConfig): boolean {
  return Boolean(config.token && config.owner && config.repo);
}

export interface UploadedFile {
  /** 仓库内的路径，例如 public/uploads/xxx.jpg */
  path: string;
  /** 站内可访问的路径，例如 /uploads/xxx.jpg */
  url: string;
  /** 部署完成前可用的临时地址（GitHub 原始文件） */
  fallbackUrl: string;
  fileName: string;
  /** 提交后的 commit 地址，方便核对 */
  commitUrl?: string;
}

const API = "https://api.github.com";

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

/** 把 GitHub 的报错翻译成能看懂的提示 */
async function describeError(response: Response): Promise<string> {
  let detail = "";
  try {
    const body = (await response.json()) as { message?: string };
    detail = body.message ?? "";
  } catch {
    // 忽略
  }

  switch (response.status) {
    case 401:
      return "Token 无效或已过期，请重新生成一个 fine-grained token";
    case 403:
      return `权限不足或触发了限流。请确认 token 勾选了该仓库的 Contents: Read and write。${detail ? `（${detail}）` : ""}`;
    case 404:
      return `找不到仓库或分支。请检查 owner / repo / branch 是否正确，以及 token 是否授权了这个仓库。${detail ? `（${detail}）` : ""}`;
    case 409:
      return "同名文件已存在，换个文件名再试";
    case 422:
      return `提交被拒绝，可能是分支不存在或文件过大。${detail ? `（${detail}）` : ""}`;
    default:
      return `上传失败：HTTP ${response.status}${detail ? ` · ${detail}` : ""}`;
  }
}

/**
 * 上传一张图片到 `public/uploads/`。
 *
 * 用 base64 走 Contents API，单文件建议控制在 1MB 以内
 * （我们上传前已经压到 1920px / q0.82，通常 200–600KB）。
 */
export async function uploadImageToRepo(
  config: GithubConfig,
  file: Blob,
  fileName: string,
): Promise<UploadedFile> {
  if (!config.token) throw new Error("还没有配置 GitHub Token");
  if (!config.owner || !config.repo) throw new Error("还没有配置仓库 owner / repo");

  const path = `${UPLOAD_DIR}/${fileName}`;
  const content = await blobToBase64(file);

  const response = await fetch(`${API}/repos/${config.owner}/${config.repo}/contents/${path}`, {
    method: "PUT",
    headers: { ...authHeaders(config.token), "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `chore(uploads): 添加图片 ${fileName}`,
      content,
      branch: config.branch || undefined,
    }),
  });

  if (!response.ok) {
    throw new Error(await describeError(response));
  }

  const result = (await response.json()) as { commit?: { html_url?: string } };

  return {
    path,
    url: `${UPLOAD_URL_DIR}/${encodeURIComponent(fileName)}`,
    // 提交完成后原始文件立即可用，用它顶过 Cloudflare 重新构建的 1–2 分钟
    fallbackUrl: `https://raw.githubusercontent.com/${config.owner}/${config.repo}/${config.branch || "main"}/${path}`,
    fileName,
    commitUrl: result.commit?.html_url,
  };
}

/** 从仓库里删除一个已上传的文件（可选操作，配合设置面板里的删除按钮） */
export async function deleteRepoFile(config: GithubConfig, path: string): Promise<void> {
  const endpoint = `${API}/repos/${config.owner}/${config.repo}/contents/${path}`;
  const query = config.branch ? `?ref=${encodeURIComponent(config.branch)}` : "";

  // 先拿到 sha，DELETE 必须带上它
  const head = await fetch(`${endpoint}${query}`, { headers: authHeaders(config.token) });
  if (!head.ok) throw new Error(await describeError(head));
  const meta = (await head.json()) as { sha?: string };
  if (!meta.sha) throw new Error("拿不到文件 sha，无法删除");

  const response = await fetch(endpoint, {
    method: "DELETE",
    headers: { ...authHeaders(config.token), "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `chore(uploads): 删除图片 ${path.split("/").pop()}`,
      sha: meta.sha,
      branch: config.branch || undefined,
    }),
  });

  if (!response.ok) throw new Error(await describeError(response));
}

/** UTF-8 文本 → base64（`btoa` 遇到中文会炸，必须先转成字节） */
async function textToBase64(text: string): Promise<string> {
  return blobToBase64(new Blob([text], { type: "application/json" }));
}

/**
 * 读取仓库里某个文本文件；不存在时返回 null。
 *
 * 写文件前需要先拿到 `sha`，否则 GitHub 会因为「不知道你在改哪个版本」而拒绝。
 */
export async function readRepoFile(
  config: GithubConfig,
  path: string,
): Promise<{ content: string; sha: string } | null> {
  const query = config.branch ? `?ref=${encodeURIComponent(config.branch)}` : "";
  const response = await fetch(
    `${API}/repos/${config.owner}/${config.repo}/contents/${path}${query}`,
    { headers: authHeaders(config.token) },
  );

  if (response.status === 404) return null;
  if (!response.ok) throw new Error(await describeError(response));

  const body = (await response.json()) as { content?: string; sha?: string; encoding?: string };
  if (!body.content || !body.sha) return null;

  // GitHub 返回的 base64 带换行，而且要按 UTF-8 解码
  const binary = atob(body.content.replace(/\n/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

  return { content: new TextDecoder().decode(bytes), sha: body.sha };
}

/** 把文本写入（或新建）仓库里的一个文件，返回 commit 地址 */
export async function writeRepoFile(
  config: GithubConfig,
  path: string,
  content: string,
  message: string,
): Promise<{ commitUrl?: string }> {
  if (!config.token) throw new Error("还没有配置 GitHub Token");

  // 已存在就必须带上 sha，否则会 409
  const existing = await readRepoFile(config, path);
  const body: Record<string, unknown> = {
    message,
    content: await textToBase64(content),
    branch: config.branch || undefined,
  };
  if (existing) body.sha = existing.sha;

  const response = await fetch(`${API}/repos/${config.owner}/${config.repo}/contents/${path}`, {
    method: "PUT",
    headers: { ...authHeaders(config.token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) throw new Error(await describeError(response));

  const result = (await response.json()) as { commit?: { html_url?: string } };
  return { commitUrl: result.commit?.html_url };
}

