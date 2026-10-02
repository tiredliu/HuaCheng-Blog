"use client";

/**
 * 浏览器端的图片处理工具。
 *
 * 全站没有后端，所以「压缩」这件事必须在浏览器里做完，
 * 否则要么上传太慢，要么把 localStorage 撑爆。
 */

export interface CompressedImage {
  /** 用于上传的二进制 */
  blob: Blob;
  /** 用于本地预览 / 存储的 data URL */
  dataUrl: string;
  width: number;
  height: number;
  /** 字节数 */
  size: number;
}

/** localStorage 一般 5MB，base64 还会膨胀约 1/3，所以卡在 2.2MB 字符以内 */
export const MAX_DATA_URL_LENGTH = 2_200_000;

async function loadBitmap(file: Blob): Promise<ImageBitmap> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file);
  }

  // 很老的浏览器兜底：走 <img> + object URL
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return await createImageBitmap(image);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function drawToCanvas(bitmap: ImageBitmap, maxEdge: number): HTMLCanvasElement {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));

  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器不支持 canvas 2d 上下文");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("图片编码失败"))),
      "image/jpeg",
      quality,
    );
  });
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.readAsDataURL(blob);
  });
}

/** Blob → 纯 base64（不带 data: 前缀），GitHub Contents API 需要 */
export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

/**
 * 压缩一张图片。
 *
 * 逐级降级：1920/0.82 → 1600/0.72 → 1280/0.62。
 * `requireDataUrl` 为 true 时（要存进 localStorage），还会检查 base64 长度上限。
 */
export async function compressImageFile(
  file: File,
  options: { requireDataUrl?: boolean } = {},
): Promise<CompressedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("请选择图片文件（jpg / png / webp / gif 等）");
  }

  const bitmap = await loadBitmap(file);
  try {
    const attempts: Array<[number, number]> = [
      [1920, 0.82],
      [1600, 0.72],
      [1280, 0.62],
    ];

    let last: CompressedImage | null = null;

    for (const [maxEdge, quality] of attempts) {
      const canvas = drawToCanvas(bitmap, maxEdge);
      const blob = await canvasToBlob(canvas, quality);
      const dataUrl = await blobToDataUrl(blob);
      last = { blob, dataUrl, width: canvas.width, height: canvas.height, size: blob.size };

      if (!options.requireDataUrl || dataUrl.length <= MAX_DATA_URL_LENGTH) {
        return last;
      }
    }

    throw new Error(
      `图片压缩后仍有 ${(last!.size / 1024 / 1024).toFixed(1)}MB，` +
        `超出浏览器本地存储的容量，请换一张更小的图片`,
    );
  } finally {
    bitmap.close?.();
  }
}

/** 生成一张小缩略图，用于设置面板里的壁纸网格（约 10–30KB） */
export async function makeThumbnail(file: File, maxEdge = 320): Promise<string> {
  const bitmap = await loadBitmap(file);
  try {
    const canvas = drawToCanvas(bitmap, maxEdge);
    const blob = await canvasToBlob(canvas, 0.6);
    return await blobToDataUrl(blob);
  } finally {
    bitmap.close?.();
  }
}

/** 探测 localStorage 是否真的放得下这个 data URL */
export function canPersistDataUrl(dataUrl: string): boolean {
  const probeKey = "hc-blog:storage-probe";
  try {
    window.localStorage.setItem(probeKey, dataUrl);
    window.localStorage.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
}

/** 探测一个图片 URL 是否已经可以访问（用于等待部署完成） */
export function probeImageUrl(url: string, timeoutMs = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }
    const image = new Image();
    const timer = window.setTimeout(() => {
      image.onload = null;
      image.onerror = null;
      resolve(false);
    }, timeoutMs);

    image.onload = () => {
      window.clearTimeout(timer);
      resolve(true);
    };
    image.onerror = () => {
      window.clearTimeout(timer);
      resolve(false);
    };
    image.src = url;
  });
}

/** 生成一个带时间戳、不会撞名的文件名 */
export function buildUploadFileName(originalName: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

  // 保留原文件名的可读部分，去掉扩展名和危险字符
  const base = originalName
    .replace(/\.[^.]+$/, "")
    .replace(/[^\w\u4e00-\u9fa5-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);

  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base ? `${base}-` : ""}${stamp}-${suffix}.jpg`;
}
