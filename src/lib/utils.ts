/** 轻量 className 合并（不引入 clsx / tailwind-merge） */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/** 2024-05-01 → 2024 年 5 月 1 日 */
export function formatDate(input: string | Date): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}

/** 2024-05-01 → 2024-05-01 */
export function formatDateISO(input: string | Date): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 2024-05-01 → 5 月 1 日 */
export function formatDateShort(input: string | Date): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}

/** 相对时间：3 天前 / 2 个月前 */
export function formatRelative(input: string | Date, now: Date = new Date()): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return "";

  const diff = now.getTime() - date.getTime();
  const day = 24 * 60 * 60 * 1000;

  if (diff < 60 * 1000) return "刚刚";
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))} 分钟前`;
  if (diff < day) return `${Math.floor(diff / (60 * 60 * 1000))} 小时前`;
  if (diff < 30 * day) return `${Math.floor(diff / day)} 天前`;
  if (diff < 365 * day) return `${Math.floor(diff / (30 * day))} 个月前`;
  return `${Math.floor(diff / (365 * day))} 年前`;
}

/** 12345 → 1.2 万 */
export function formatCount(value: number): string {
  if (value < 1000) return String(value);
  if (value < 10000) return `${(value / 1000).toFixed(1)}k`;
  return `${(value / 10000).toFixed(1)} 万`;
}

/**
 * 字数展示：`862 字` / `1.2k 字` / `1.3 万字`。
 *
 * 刻意不用千分位（`1,240 字`）——中文排版里逗号容易和顿号混淆，
 * 用 k / 万 更符合中文阅读习惯。
 */
export function formatWordCount(value: number): string {
  if (value < 1000) return `${value} 字`;
  if (value < 10000) return `${(value / 1000).toFixed(1)}k 字`;
  return `${(value / 10000).toFixed(1)} 万字`;
}

