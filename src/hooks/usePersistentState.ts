"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * 与 localStorage 同步的状态。
 *
 * 静态导出的博客没有后端，用户的偏好（主题、侧栏宽度等）只能存在浏览器里。
 *
 * 用 `useSyncExternalStore` 而不是 `useState + useEffect`：
 * - 服务端（`getServerSnapshot`）返回默认值，hydration 时不会出现属性不匹配
 * - 浏览器在 hydration 之后会立刻读到真实值并重渲染
 * - 顺带支持了多标签页同步（监听 `storage` 事件）
 */

type Listener = () => void;

const listeners = new Map<string, Set<Listener>>();
/** 按「原始字符串」缓存解析结果，保证 getSnapshot 的引用稳定 */
const snapshotCache = new Map<string, { raw: string | null; value: unknown }>();

function bucket(key: string): Set<Listener> {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  return set;
}

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // 隐私模式下 localStorage 可能直接抛错
    return null;
  }
}

function writeRaw(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 容量超限或被禁用时静默降级为「仅本次会话有效」
  }
}

function emit(key: string): void {
  snapshotCache.delete(key);
  bucket(key).forEach((listener) => listener());
}

function subscribe(key: string, onStoreChange: Listener): () => void {
  const set = bucket(key);
  set.add(onStoreChange);

  const onStorage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) {
      snapshotCache.delete(key);
      onStoreChange();
    }
  };
  window.addEventListener("storage", onStorage);

  return () => {
    set.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function usePersistentState<T>(
  key: string,
  initialValue: T,
  isValid?: (value: unknown) => boolean,
): [T, (update: React.SetStateAction<T>) => void] {
  const getSnapshot = useCallback((): T => {
    const raw = readRaw(key);
    const cached = snapshotCache.get(key);
    if (cached && cached.raw === raw) return cached.value as T;

    let value = initialValue;
    if (raw !== null) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (!isValid || isValid(parsed)) value = parsed as T;
      } catch {
        // 存进去的不是合法 JSON，退回默认值
      }
    }

    snapshotCache.set(key, { raw, value });
    return value;
  }, [initialValue, isValid, key]);

  const getServerSnapshot = useCallback(() => initialValue, [initialValue]);
  const subscribeToKey = useCallback((onStoreChange: Listener) => subscribe(key, onStoreChange), [key]);

  const value = useSyncExternalStore(subscribeToKey, getSnapshot, getServerSnapshot);

  const setValue = useCallback(
    (update: React.SetStateAction<T>) => {
      const previous = getSnapshot();
      const next =
        typeof update === "function" ? (update as (prev: T) => T)(previous) : update;
      writeRaw(key, next);
      emit(key);
    },
    [getSnapshot, key],
  );

  return [value, setValue];
}

export const isBoolean = (value: unknown): boolean => typeof value === "boolean";
export const isNumber = (value: unknown): boolean =>
  typeof value === "number" && Number.isFinite(value);
export const isString = (value: unknown): boolean => typeof value === "string";
