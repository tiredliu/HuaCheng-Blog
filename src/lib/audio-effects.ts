/**
 * 用浏览器内置的 **Web Audio API** 给播放器加音效。
 *
 * 这是一个**零成本**方案：
 * - 不需要任何第三方库（Web Audio 是浏览器标准，Chrome / Edge / Firefox / Safari 都支持）
 * - 不需要下载任何音频素材（混响用的脉冲响应是**现场算出来**的白噪声衰减）
 * - 不需要联网、不需要后端、不需要 API Key
 *
 * 音效链（整条链只在「第一次点开音效」时建一次）：
 *
 * ```text
 * <audio> → MediaElementSource → 输入增益
 *            → 高通 → 五段均衡（低架 / 峰值 ×3 / 高架）→ 低通
 *            → 动态压缩
 *            → 干声 ─────────────────────────────────────────────┐
 *            → 混响（Convolver，按「空间」现场算 IR）→ 湿声 ───────┴→ 输出增益 → 扬声器
 * ```
 *
 * 每个预设就是「在这条链上摆一组参数」：五段均衡增益、混响湿度与空间、
 * 高通 / 低通、压缩强度、输出补偿。所谓「环绕 / 宽场 / 旷野」都是用
 * **去相关混响（左右声道独立的 IR）+ 两端均衡**做出的空间感 ——
 * 不引入任何素材，也就不存在版权问题。
 *
 * ## 三条必须知道的约束
 *
 * 1. **一个 `<audio>` 只能建一次 `MediaElementSource`**，第二次会直接抛
 *    `InvalidStateError`。所以这里用 `WeakMap` 按元素缓存整条链。
 * 2. **建了链之后声音就只走 AudioContext 了**。如果 context 处于 `suspended`
 *    （浏览器在没有用户手势时会这样），声音会被**静音** —— 所以每次切音效
 *    都要 `resume()`，并且额外监听 `play` 事件兜底。
 * 3. **`MediaElementSource` 要求音频是同源的，或者带 CORS 头**。外链直链
 *    （网易云之类）没有 CORS 头，接上之后会**直接没声音**，所以外链一律不开音效。
 *
 * 因为第 2、3 两条，默认（`none`）**完全不碰 AudioContext** ——
 * 不点开音效就没有任何行为变化，这是刻意的：音效是锦上添花，不能让「播放」本身出风险。
 */

import { useCallback, useSyncExternalStore } from "react";

export type AudioEffectId =
  | "none"
  | "monitor"
  | "hifi"
  | "bass"
  | "deepbass"
  | "vocal"
  | "dynamic"
  | "clear"
  | "bright"
  | "air"
  | "live"
  | "hall"
  | "concert"
  | "karaoke"
  | "surround"
  | "wide"
  | "wild"
  | "speaker"
  | "dj";

export interface AudioEffectPreset {
  id: AudioEffectId;
  /** 界面上显示的名字 */
  name: string;
  /** 一句话说明，鼠标悬停时能看到 */
  hint: string;
  /**
   * 五段均衡增益（dB）：
   * [120Hz 低架, 350Hz 峰值, 1.2kHz 峰值, 3.5kHz 峰值, 9kHz 高架]
   */
  eq: [number, number, number, number, number];
  /** 混响湿度 0–1，0 表示不加混响 */
  reverb: number;
  /** 混响空间 0–1，越大尾巴越长 */
  size: number;
  /** 高通频率（Hz），0 表示关闭 —— 用来削掉隆隆的低频 */
  highpass: number;
  /** 低通频率（Hz），0 表示关闭 —— 用来柔化刺耳的高频 */
  lowpass: number;
  /** 压缩强度 0–1，0 表示不压缩 */
  compress: number;
  /** 输出补偿增益（dB）：把整体响度拉回一致，免得「换个音效音量忽大忽小」 */
  makeup: number;
}

/** 均衡与滤波共用的频点（Hz）与 Q 值 */
const EQ_FREQS = [120, 350, 1200, 3500, 9000] as const;
const EQ_Q = [0.7, 0.9, 1, 0.9, 0.7] as const;

/**
 * 全部音效预设。
 *
 * ⚠️ `none` / `bass` / `vocal` / `clear` / `hall` 这五个 id 是**初版就有的**，
 * 已存在的 `localStorage` 里可能存着它们，**不要改名或删除**，否则用户的
 * 音效偏好会在下次打开时悄悄退回「原声」。
 */
export const AUDIO_EFFECT_PRESETS: AudioEffectPreset[] = [
  {
    id: "none",
    name: "原声",
    hint: "不做任何处理，也不启用音效链",
    eq: [0, 0, 0, 0, 0],
    reverb: 0,
    size: 0.3,
    highpass: 0,
    lowpass: 0,
    compress: 0,
    makeup: 0,
  },
  {
    id: "monitor",
    name: "监听还原",
    hint: "平直少染，接近参考听感",
    eq: [0, -1, 0, 0, -1],
    reverb: 0,
    size: 0.2,
    highpass: 0,
    lowpass: 0,
    compress: 0,
    makeup: 0.5,
  },
  {
    id: "hifi",
    name: "高保真",
    hint: "两端微提，细节更清晰",
    eq: [2, 0, 0, 1, 3],
    reverb: 0,
    size: 0.2,
    highpass: 0,
    lowpass: 19000,
    compress: 0.15,
    makeup: -1,
  },
  {
    id: "bass",
    name: "低音增强",
    hint: "抬低频、压高频，适合电子与鼓点",
    eq: [7, 3, -1, -1, -2],
    reverb: 0,
    size: 0.3,
    highpass: 0,
    lowpass: 0,
    compress: 0,
    makeup: -1.5,
  },
  {
    id: "deepbass",
    name: "重低音",
    hint: "大幅强化低频，下潜更深",
    eq: [9, 4, 0, -2, -3],
    reverb: 0,
    size: 0.3,
    highpass: 0,
    lowpass: 16000,
    compress: 0.1,
    makeup: -2,
  },
  {
    id: "vocal",
    name: "人声增强",
    hint: "抬中频，人声从伴奏里浮出来",
    eq: [-3, 1, 5, 3, 1],
    reverb: 0,
    size: 0.3,
    highpass: 80,
    lowpass: 0,
    compress: 0.1,
    makeup: -1,
  },
  {
    id: "dynamic",
    name: "动态人声",
    hint: "压缩 + 抬中频，小声也听得清",
    eq: [-4, 0, 6, 3, 1],
    reverb: 0.25,
    size: 0.55,
    highpass: 70,
    lowpass: 0,
    compress: 0.5,
    makeup: -1,
  },
  {
    id: "clear",
    name: "清亮",
    hint: "抬高频，适合钢琴与弦乐",
    eq: [-2, 0, 1, 4, 7],
    reverb: 0,
    size: 0.3,
    highpass: 40,
    lowpass: 0,
    compress: 0.05,
    makeup: -1,
  },
  {
    id: "bright",
    name: "解析增强",
    hint: "拉高高频，齿音与泛音更亮",
    eq: [-1, -1, 0, 3, 6],
    reverb: 0,
    size: 0.2,
    highpass: 60,
    lowpass: 0,
    compress: 0.1,
    makeup: -0.5,
  },
  {
    id: "air",
    name: "空灵",
    hint: "空气感 + 长混响，空旷飘渺",
    eq: [0, -2, 0, 3, 6],
    reverb: 0.5,
    size: 0.95,
    highpass: 90,
    lowpass: 0,
    compress: 0,
    makeup: -1.5,
  },
  {
    id: "live",
    name: "现场亲临",
    hint: "中频 + 短堂音，像坐在台下",
    eq: [-2, 1, 3, 2, 1],
    reverb: 0.35,
    size: 0.6,
    highpass: 50,
    lowpass: 15000,
    compress: 0.3,
    makeup: -1,
  },
  {
    id: "hall",
    name: "大厅混响",
    hint: "现场算一段脉冲响应，做出空间感",
    eq: [0, -1, 0, 0, 1],
    reverb: 0.35,
    size: 0.7,
    highpass: 0,
    lowpass: 0,
    compress: 0,
    makeup: -0.5,
  },
  {
    id: "concert",
    name: "音乐厅",
    hint: "大空间混响，尾音拖得更长",
    eq: [1, 0, 1, 0, 1],
    reverb: 0.5,
    size: 0.95,
    highpass: 0,
    lowpass: 0,
    compress: 0,
    makeup: -1.5,
  },
  {
    id: "karaoke",
    name: "回音壁",
    hint: "长尾混响，KTV 包厢味",
    eq: [-1, 0, 2, 1, 1],
    reverb: 0.55,
    size: 0.85,
    highpass: 60,
    lowpass: 0,
    compress: 0.1,
    makeup: -1.5,
  },
  {
    id: "surround",
    name: "环绕增强",
    hint: "两端 + 中度混响，包围感更强",
    eq: [3, -1, 0, 1, 3],
    reverb: 0.4,
    size: 0.75,
    highpass: 0,
    lowpass: 17000,
    compress: 0.15,
    makeup: -1.5,
  },
  {
    id: "wide",
    name: "宽场",
    hint: "开阔声场，低频收紧不轰头",
    eq: [4, -2, -1, 0, 3],
    reverb: 0.45,
    size: 1,
    highpass: 0,
    lowpass: 18000,
    compress: 0.1,
    makeup: -1.5,
  },
  {
    id: "wild",
    name: "旷野",
    hint: "削低频 + 大空间，空旷辽远",
    eq: [1, -2, 0, 1, 4],
    reverb: 0.6,
    size: 1,
    highpass: 120,
    lowpass: 0,
    compress: 0.1,
    makeup: -2,
  },
  {
    id: "speaker",
    name: "外放增强",
    hint: "削低频补中高，模拟手机外放",
    eq: [-3, 2, 5, 4, 2],
    reverb: 0,
    size: 0.3,
    highpass: 150,
    lowpass: 13000,
    compress: 0.25,
    makeup: -1,
  },
  {
    id: "dj",
    name: "电音 DJ",
    hint: "低音 + 高频 + 轻压缩，动感更足",
    eq: [8, 2, 0, 2, 4],
    reverb: 0.15,
    size: 0.5,
    highpass: 0,
    lowpass: 18000,
    compress: 0.4,
    makeup: -1.5,
  },
];

export const AUDIO_EFFECT_ORDER: AudioEffectId[] = AUDIO_EFFECT_PRESETS.map((item) => item.id);

export const AUDIO_EFFECT_LABEL: Record<AudioEffectId, string> = Object.fromEntries(
  AUDIO_EFFECT_PRESETS.map((item) => [item.id, item.name]),
) as Record<AudioEffectId, string>;

export function isAudioEffectId(value: unknown): boolean {
  return typeof value === "string" && AUDIO_EFFECT_ORDER.includes(value as AudioEffectId);
}

export function getEffectPreset(id: AudioEffectId): AudioEffectPreset {
  return AUDIO_EFFECT_PRESETS.find((item) => item.id === id) ?? AUDIO_EFFECT_PRESETS[0];
}

/* ------------------------------------------------------------------ */
/* 音效链                                                              */
/* ------------------------------------------------------------------ */

interface EffectChain {
  ctx: AudioContext;
  highpass: BiquadFilterNode;
  /** 五段均衡，顺序与 EQ_FREQS 一致 */
  eq: BiquadFilterNode[];
  lowpass: BiquadFilterNode;
  compressor: DynamicsCompressorNode;
  dry: GainNode;
  wet: GainNode;
  output: GainNode;
  convolver: ConvolverNode;
  /** 当前 convolver 上挂的脉冲响应对应的 size 档位，避免重复生成 */
  impulseKey: number | null;
}

/** 按 <audio> 元素缓存，避免重复 createMediaElementSource 抛错 */
const chains = new WeakMap<HTMLMediaElement, EffectChain>();

/**
 * 按 AudioContext 缓存「某一档空间对应的脉冲响应」。
 *
 * 混响的空间大小变了就得换一条 IR，而生成一条几秒的 IR 要跑几十万次循环，
 * 所以按 size 档位缓存，来回切音效时不用重算。
 */
const impulses = new WeakMap<BaseAudioContext, Map<number, AudioBuffer>>();

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 分贝 → 线性增益 */
function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

function createContext(): AudioContext | null {
  type LegacyWindow = Window & { webkitAudioContext?: typeof AudioContext };
  const Ctor = window.AudioContext ?? (window as LegacyWindow).webkitAudioContext;
  if (!Ctor) return null;
  try {
    return new Ctor();
  } catch {
    return null;
  }
}

/**
 * 现场合成一段混响用的脉冲响应。
 *
 * 就是「指数衰减的白噪声」—— 这是最简单的混响近似，
 * 好处是不用下载任何 IR 音频文件（那类文件动辄几百 KB，还得考虑版权）。
 * 左右声道各算一条**独立**的噪声，这样混响才是「立体声」的，
 * 听感上就有了空间宽度（这也是不做专门宽度矩阵的原因）。
 */
function createImpulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);

  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      const progress = i / length;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - progress, decay);
    }
  }
  return buffer;
}

/** 取（必要时生成）某一档「空间大小」的脉冲响应 */
function getImpulse(ctx: AudioContext, size: number): AudioBuffer {
  // 量化到 1/20 档，避免浮点抖动导致反复生成
  const key = Math.round(clamp(size, 0, 1) * 20);
  let bucket = impulses.get(ctx);
  if (!bucket) {
    bucket = new Map<number, AudioBuffer>();
    impulses.set(ctx, bucket);
  }
  let buffer = bucket.get(key);
  if (!buffer) {
    const ratio = key / 20;
    // 空间越大 → 尾巴越长、衰减越慢
    buffer = createImpulse(ctx, 0.5 + ratio * 3, 3.2 - ratio * 1.4);
    bucket.set(key, buffer);
  }
  return buffer;
}

function ensureChain(element: HTMLMediaElement): EffectChain | null {
  const existing = chains.get(element);
  if (existing) return existing;

  const ctx = createContext();
  if (!ctx) return null;

  try {
    // ⚠️ 同一个元素只能建一次，第二次会抛 InvalidStateError
    const source = ctx.createMediaElementSource(element);

    // 三段均衡会整体抬高音量，用一个输入增益先把电平压回去，避免削波
    const input = ctx.createGain();
    input.gain.value = 0.85;

    const highpass = ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 10; // 约等于关闭
    highpass.Q.value = 0.7;

    // 五段均衡：[低架, 峰值, 峰值, 峰值, 高架]
    const eq = EQ_FREQS.map((frequency, index) => {
      const filter = ctx.createBiquadFilter();
      if (index === 0) filter.type = "lowshelf";
      else if (index === EQ_FREQS.length - 1) filter.type = "highshelf";
      else {
        filter.type = "peaking";
        filter.Q.value = EQ_Q[index];
      }
      filter.frequency.value = frequency;
      filter.gain.value = 0;
      return filter;
    });

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = ctx.sampleRate / 2; // 约等于关闭
    lowpass.Q.value = 0.7;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = 0;
    compressor.knee.value = 6;
    compressor.ratio.value = 1; // ratio = 1 即「不压缩」
    compressor.attack.value = 0.004;
    compressor.release.value = 0.25;

    const dry = ctx.createGain();
    const wet = ctx.createGain();
    wet.gain.value = 0;
    const output = ctx.createGain();

    const convolver = ctx.createConvolver();

    source.connect(input);
    input.connect(highpass);

    // 串联五段均衡
    let node: AudioNode = highpass;
    for (const filter of eq) {
      node.connect(filter);
      node = filter;
    }
    node.connect(lowpass);
    lowpass.connect(compressor);

    // 干声：直通
    compressor.connect(dry);
    dry.connect(output);

    // 湿声：过混响
    compressor.connect(convolver);
    convolver.connect(wet);
    wet.connect(output);

    output.connect(ctx.destination);

    const chain: EffectChain = {
      ctx,
      highpass,
      eq,
      lowpass,
      compressor,
      dry,
      wet,
      output,
      convolver,
      impulseKey: null,
    };
    chains.set(element, chain);

    // 兜底：context 被浏览器挂起（切标签页、自动播放策略）之后再点播放时恢复
    element.addEventListener("play", () => {
      if (ctx.state === "suspended") void ctx.resume();
    });

    return chain;
  } catch {
    return null;
  }
}

function hasAudioContext(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    window.AudioContext ?? (window as Window & { webkitAudioContext?: unknown }).webkitAudioContext,
  );
}

/**
 * 只看路径就能判断的部分：**站内相对地址一定同源**。
 *
 * 这一半不需要 `window`，所以可以用在服务端快照里 ——
 * 否则静态导出时「音效」按钮会被渲染成 disabled，hydration 之后才亮起来。
 */
function isSiteRelative(src: string): boolean {
  return !/^(https?:)?\/\//i.test(src) && !src.startsWith("data:");
}

/**
 * 当前音频能不能上音效。
 *
 * 只有两种情况会返回 false：浏览器不支持 Web Audio，或者音频是**跨域外链**
 * （没有 CORS 头的音频接进 AudioContext 会直接静音，宁可不给选项）。
 */
export function isEffectAvailable(src?: string): boolean {
  if (typeof window === "undefined") return src ? isSiteRelative(src) : true;
  if (!hasAudioContext()) return false;
  if (!src || isSiteRelative(src)) return true;

  try {
    return new URL(src, window.location.href).origin === window.location.origin;
  } catch {
    // 解析不了就当外链处理，保守一点
    return false;
  }
}

/**
 * 客户端专用的「当前音频能不能上音效」。
 *
 * ⚠️ 不能直接在渲染里调 `isEffectAvailable()`：它读 `window`，
 * 服务端（静态导出时组件也会 SSR）和客户端的值不一样，
 * 直接渲染会让按钮的 `disabled` 两端不一致。
 *
 * 用 `useSyncExternalStore` 的第三个参数（getServerSnapshot）绕开：
 * 服务端只用「路径判断」那一半（相对地址 → 可用），
 * hydration 之后再切到带 `window` 的完整判断。
 */
export function useIsEffectAvailable(src?: string): boolean {
  const subscribe = useCallback(() => () => {}, []);
  const getSnapshot = useCallback(() => isEffectAvailable(src), [src]);
  const getServerSnapshot = useCallback(() => (src ? isSiteRelative(src) : true), [src]);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * 切换音效。返回 false 表示没生效（浏览器不支持 / 外链 / 建链失败）。
 *
 * 传 `"none"` 且链还没建过时**不会**创建 AudioContext —— 默认行为保持原样。
 */
export function applyAudioEffect(element: HTMLMediaElement, id: AudioEffectId): boolean {
  const chain = chains.get(element);
  if (!chain && id === "none") return true;

  const target = ensureChain(element);
  if (!target) return false;

  const preset = getEffectPreset(id);

  try {
    // 用 setTargetAtTime 而不是直接赋值：直接改增益会有「咔」的一声
    const now = target.ctx.currentTime;
    const RAMP = 0.02;
    const nyquist = target.ctx.sampleRate / 2;

    target.highpass.frequency.setTargetAtTime(preset.highpass > 0 ? preset.highpass : 10, now, RAMP);
    target.lowpass.frequency.setTargetAtTime(
      preset.lowpass > 0 ? Math.min(preset.lowpass, nyquist * 0.95) : nyquist,
      now,
      RAMP,
    );

    target.eq.forEach((filter, index) => {
      filter.gain.setTargetAtTime(preset.eq[index], now, RAMP);
    });

    // compress === 0 时把 ratio 设为 1（不压缩），保证「原声」真的透明
    target.compressor.threshold.setTargetAtTime(
      preset.compress > 0 ? -8 - preset.compress * 28 : 0,
      now,
      RAMP,
    );
    target.compressor.ratio.setTargetAtTime(preset.compress > 0 ? 1 + preset.compress * 11 : 1, now, RAMP);

    const wet = clamp(preset.reverb, 0, 1);
    if (wet > 0) {
      const impulse = getImpulse(target.ctx, preset.size);
      const key = Math.round(clamp(preset.size, 0, 1) * 20);
      if (target.impulseKey !== key || target.convolver.buffer !== impulse) {
        target.convolver.buffer = impulse;
        target.impulseKey = key;
      }
    }
    target.wet.gain.setTargetAtTime(wet, now, RAMP);
    // 混响会提高整体响度，干声相应压一点，避免加了混响就变吵
    target.dry.gain.setTargetAtTime(wet > 0 ? 1 - wet * 0.35 : 1, now, RAMP);

    target.output.gain.setTargetAtTime(dbToLinear(preset.makeup), now, 0.03);

    if (target.ctx.state === "suspended") void target.ctx.resume();
    return true;
  } catch {
    return false;
  }
}
