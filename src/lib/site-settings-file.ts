import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_SITE_SETTINGS,
  normalizeSiteSettings,
  type SiteSettings,
} from "@/lib/site-settings";

/**
 * 读取仓库里的站点默认设置（**只在构建期 / 服务端执行**）。
 *
 * ⚠️ 路径必须写成字面量分段（`'content', 'site-settings.json'`），
 * 不能拼一个变量进来：否则 Turbopack 无法静态分析，
 * 会判定「整个项目都被追踪了」并给出 NFT 警告。
 *
 * 文件不存在或格式不对都不要让构建失败 —— 直接退回默认值，
 * 这样删掉 `content/site-settings.json` 也能正常构建。
 */
export function readSiteSettings(): SiteSettings {
  const file = path.join(process.cwd(), "content", "site-settings.json");

  if (!fs.existsSync(file)) return { ...DEFAULT_SITE_SETTINGS };

  try {
    // 去掉 UTF-8 BOM：Windows 上的记事本 / 部分编辑器保存时会带上，
    // 而 JSON.parse 遇到 \uFEFF 会直接抛错 —— 那样整份设置会被静默忽略
    const raw = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
    const parsed: unknown = JSON.parse(raw);
    return normalizeSiteSettings(parsed);
  } catch (error) {
    console.warn(
      "[site-settings] content/site-settings.json 解析失败，已回退到默认设置：",
      error instanceof Error ? error.message : error,
    );
    return { ...DEFAULT_SITE_SETTINGS };
  }
}
