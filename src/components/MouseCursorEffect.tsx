"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

/**
 * 鼠标特效：
 * 1. **六芒星光标** —— 两枚三角形拼成的六芒星，持续旋转；
 *    六条边按相位错开地「逐渐消失 → 重新绘制」，循环往复。颜色可自定义。
 * 2. **拖尾拨开代码** —— 指针划过的地方像被抹开一层，露出底下的**代码背景**
 *    （等宽字体的伪代码行，按视口宽度分成若干列并排铺满；锚定在页面坐标上，
 *    所以同一处露出的代码是连续的）。揭示区做径向羽化，看不出圆形边界。
 * 3. **点击 / 按键音效** —— Web Audio 现场合成的短促音，无音频文件。
 *
 * 性能关键：拖尾**不是**「每个印记各自裁剪 + 贴图」，而是
 * 「先把软点叠进一张半分辨率遮罩 → 再在**存活印记的并集包围盒**里，
 * 贴一次代码纹理并用 `destination-in` 抠出揭示区」。
 * 每帧成本只跟拖尾范围有关，**与屏幕大小、印记数量都近乎无关**
 * —— HiDPI 大屏上也不会因为「点几下 / 划一下」就掉帧（见 `drawReveal`）。
 *
 * 设计取舍（对照项目「极简克制、国内快、不往前台塞动画、JS 体积受控」）：
 * - 默认开启，可在「外观设置 → 鼠标特效」一键关闭（这就是它唯一的开关）；
 * - 全程 Canvas 绘制，不引入第三方库、不下载素材，国内访问零额外网络请求；
 * - 代码背景预渲染到离屏 canvas（仅 resize / 主题 / 配色变化时重建）；
 * - 音效懒加载 AudioContext（首次手势才创建），不碰首屏性能。
 *
 * ⚠️ 这里**刻意不读取 `prefers-reduced-motion`**：效果本身可能就是用户想要的展示，
 * 且已有明确的手动开关；如果跟系统降级联动，会出现「开关开着却什么都没发生」的困惑。
 */

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

/* ---------------- 六芒星光标 ---------------- */
const STAR_R = 14; // 星形外接圆半径（px）
const ROTATION_SPEED = 0.7; // 旋转角速度（rad/s）
const EDGE_CYCLE = 2200; // ms，每条边「消失 → 重绘」一轮

/* ---------------- 拖尾：拨开代码 ---------------- */
const STAMP_R = 42; // 每个笔刷印记的半径
const FEATHER_SIZE = STAMP_R * 2; // 软点直径
const STAMP_SPACING = 14; // 相邻印记间距，保证连续
const CODE_LIFE = 900; // ms，露出的代码淡出时间
const STAMP_MAX = 36; // 印记数量上限
const RIPPLE_LIFE = 560; // ms，点击涟漪存活时间
const KEY_THROTTLE = 28; // ms，按键音最小间隔
const NOTE_THROTTLE = 80; // ms，连点时的钢琴音最小间隔（别把音频节点堆爆）
const BURST_THROTTLE = 140; // ms，连点时限制「揭开一片」的频率，避免堆积
const MASK_SCALE = 0.5; // 遮罩画布相对视口的分辨率（软边，半分辨率足够且更省）
/**
 * ms。「指针可能已经离开页面」（`pointerout` 的 `relatedTarget` 为 null）之后，
 * 等这么久仍没有任何指针事件，才确认「真的离开了」并收起自绘。
 *
 * ⚠️ 必须延迟一拍：指针下的元素被替换掉（换页、列表重排）时浏览器**同样**给 null，
 * 但那种情况紧跟着就会有 `pointerover` / `pointermove`；而真的移出去（到浏览器工具栏、
 * 别的窗口）则一条事件都不会再来。
 */
const LEAVE_CONFIRM = 160;
/**
 * ms。收起自绘之后，如果**这么长时间里一条指针事件都没有**，就按当前坐标强制恢复自绘。
 *
 * ⚠️ 这是「鼠标处一个光标都没有」的最后一道保险，**必须保留**。
 * 实测：浏览器在「拖拽被接管」（原生拖拽 / Edge 超级拖拽 / 指针停在浏览器界面上）之后
 * 可能**再也不发 `pointermove` 也不发 `dragend`**，日志只剩一行 `收起自绘 ← pointercancel`。
 * 此时若只等事件来解除，就会一直没光标（用户看到「卡住、动鼠标也不恢复」）。
 */
const STUCK_RECOVER = 1000;

// 被「拨开」露出的代码内容（伪代码，仅作视觉纹理）
const CODE_LINES = [
  "const TAU = Math.PI * 2;",
  "function createStar(points, radius) {",
  "  return Array.from({ length: points }, (_, i) => {",
  "    const angle = (i / points) * TAU - Math.PI / 2;",
  "    return [Math.cos(angle) * radius, Math.sin(angle) * radius];",
  "  });",
  "}",
  "let rotation = 0;",
  "export function tick(delta) {",
  "  rotation += delta * 0.7;",
  "  if (rotation > TAU) rotation -= TAU;",
  "  return render(star, rotation);",
  "}",
  "const a = 1;",
  "while (a < 6) draw(edge);",
  "// 每隔一段时间重绘每条边",
];

// 六芒星的两枚三角形（角度制，顺时针为正，-90° 指向正上方）
const TRIANGLE_UP = [-90, 30, 150];
const TRIANGLE_DOWN = [90, 210, 330];

// 点击音的随机音高（MIDI 音符号）：C 大调约两个八度的白键，听着舒服
const PIANO_NOTES = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84];
// 每个谐波的相对振幅（基频 + 4 个泛音，越高的泛音衰减越快）
const PIANO_PARTIALS = [1, 2, 3, 4.2, 5.4];
const PIANO_AMPS = [1, 0.42, 0.22, 0.1, 0.05];

/* ---------------- 颜色 ---------------- */
/** 光标颜色（六芒星 / 涟漪主线），也是色板的默认值 */export const CURSOR_DEFAULT_COLOR = "#e4513a";

/** 代码背景颜色：空字符串 = 跟随主题（浅色下青绿、深色下亮青） */
export const CODE_DEFAULT_COLOR = "";

/** 可选的调色板（光标颜色、代码颜色共用） */
export const COLOR_PRESETS: { name: string; value: string }[] = [
  { name: "木棉红", value: "#e4513a" },
  { name: "岭南青", value: "#17947e" },
  { name: "霓虹青", value: "#22d3ee" },
  { name: "电光紫", value: "#8b5cf6" },
  { name: "琥珀金", value: "#f59e0b" },
  { name: "云白", value: "#f5f5f4" },
];

/** 向后兼容：旧代码里用的名字 */
export const CURSOR_COLORS = COLOR_PRESETS;

export function isCursorColor(value: unknown): boolean {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

/** 代码颜色允许为空串（= 跟随主题） */
export function isCodeColor(value: unknown): boolean {
  return value === "" || isCursorColor(value);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return { r: 228, g: 81, b: 58 };
  const n = parseInt(match[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

interface Stamp {
  x: number;
  y: number;
  t: number;
}

/**
 * 上一次已知的指针位置（**模块级**，故意不放进 effect 里）。
 *
 * ⚠️ 必须放在 effect 外：`CursorLayer` 的 effect 依赖是 `[color, codeColor]`，
 * 用户在设置里改一次光标颜色 / 代码颜色就会重跑一次。如果位置只在 effect 内初始化，
 * 重跑后光标会被重置到**视口中心** —— 表现就是「改了颜色之后光标不见了」，
 * 得动一下鼠标才回到指针处。放在模块级即可让位置跨 effect 重跑延续。
 * （同时只有一个页面实例，所以用模块级变量是安全的。）
 */
const lastPointer = { x: 0, y: 0, seen: false };

export function MouseCursorEffect({
  enabled,
  color,
  codeColor,
}: {
  enabled: boolean;
  color: string;
  codeColor: string;
}) {
  // 服务端为 false、客户端为 true：不需要 setState，天然避免水合不一致与级联渲染
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  // 服务端不渲染；首帧（hydration）也不渲染，避免任何水合不一致
  if (!mounted || !enabled) return null;
  return createPortal(<CursorLayer color={color} codeColor={codeColor} />, document.body);
}

function CursorLayer({ color, codeColor }: { color: string; codeColor: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const root = document.documentElement;
    root.setAttribute("data-cursor-fx", "on");

    const rgb = hexToRgb(color);
    const glow = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`;
    const rgbStr = `${rgb.r}, ${rgb.g}, ${rgb.b}`;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let vw = window.innerWidth;
    let vh = window.innerHeight;

    /* ---------------- 代码背景纹理（离屏预渲染） ---------------- */
    let codeTexture: HTMLCanvasElement | null = null;
    let textureDark = root.classList.contains("dark");

    const buildCodeTexture = (): HTMLCanvasElement | null => {
      const dark = root.classList.contains("dark");
      textureDark = dark;
      const tex = document.createElement("canvas");
      tex.width = Math.floor(vw * dpr);
      tex.height = Math.floor(vh * dpr);
      const tctx = tex.getContext("2d");
      if (!tctx) return null;
      tctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const lineH = 20;
      tctx.textBaseline = "middle";
      tctx.font = "13px ui-monospace, SFMono-Regular, Menlo, monospace";

      // 代码颜色：优先用自定义色，否则跟随主题
      const custom = codeColor ? hexToRgb(codeColor) : null;
      const codeFill = custom
        ? `rgba(${custom.r}, ${custom.g}, ${custom.b}, 0.92)`
        : dark
          ? "rgba(45, 212, 191, 0.92)"
          : "rgba(13, 148, 136, 0.92)";
      const numFill = custom
        ? `rgba(${custom.r}, ${custom.g}, ${custom.b}, 0.45)`
        : dark
          ? "rgba(148, 163, 184, 0.45)"
          : "rgba(120, 113, 108, 0.4)";

      // 按宽度分成若干列并排铺满，避免「只有左半屏有代码」
      const cols = vw < 720 ? 1 : Math.min(4, Math.max(2, Math.round(vw / 420)));
      const pitch = vw / cols;
      const rows = Math.ceil(vh / lineH);

      for (let c = 0; c < cols; c += 1) {
        const colX = Math.round(c * pitch) + 14;
        tctx.save();
        tctx.beginPath();
        tctx.rect(colX - 8, 0, pitch - 8, vh);
        tctx.clip();
        for (let row = 0; row < rows; row += 1) {
          const y = row * lineH + lineH / 2 + 6;
          const li = row + c * 7; // 每列错开，读起来像各自独立的代码
          tctx.fillStyle = numFill;
          tctx.fillText(String((li % 99) + 1).padStart(2, "0"), colX, y);
          tctx.fillStyle = codeFill;
          tctx.fillText(CODE_LINES[li % CODE_LINES.length], colX + 26, y);
        }
        tctx.restore();
      }
      return tex;
    };

    /* ---------------- 软点 + 遮罩（拖尾用，复用离屏画布） ---------------- */
    // 一枚羽化圆点，贴到遮罩上；叠加即为「被拨开」的区域
    const DOT_PX = 64;
    const dot = document.createElement("canvas");
    dot.width = DOT_PX;
    dot.height = DOT_PX;
    const dotCtx = dot.getContext("2d");
    if (dotCtx) {
      const g = dotCtx.createRadialGradient(
        DOT_PX / 2,
        DOT_PX / 2,
        DOT_PX * 0.05,
        DOT_PX / 2,
        DOT_PX / 2,
        DOT_PX / 2,
      );
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.68, "rgba(255,255,255,0.92)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      dotCtx.fillStyle = g;
      dotCtx.fillRect(0, 0, DOT_PX, DOT_PX);
    }

    const mask = document.createElement("canvas");
    const mctx = mask.getContext("2d");

    const resize = () => {
      vw = window.innerWidth;
      vh = window.innerHeight;
      canvas.width = Math.floor(vw * dpr);
      canvas.height = Math.floor(vh * dpr);
      canvas.style.width = vw + "px";
      canvas.style.height = vh + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      mask.width = Math.max(1, Math.floor(vw * MASK_SCALE));
      mask.height = Math.max(1, Math.floor(vh * MASK_SCALE));
      codeTexture = buildCodeTexture();
    };
    resize();
    window.addEventListener("resize", resize);

    // 主题切换时重建代码纹理，保证在深浅色下都清晰
    const observer = new MutationObserver(() => {
      if (root.classList.contains("dark") !== textureDark) codeTexture = buildCodeTexture();
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });

    /* ---------------- 状态 ---------------- */
    // 位置优先沿用上一次（模块级），避免 effect 重跑时把光标重置到视口中心
    const pointer = lastPointer.seen
      ? { x: lastPointer.x, y: lastPointer.y }
      : { x: vw / 2, y: vh / 2 };
    let stamps: Stamp[] = [];
    // 印记锚点：只有真正放下印记时才推进，否则小步移动永远不会积累到间距
    let anchorX = pointer.x;
    let anchorY = pointer.y;
    const ripples: { x: number; y: number; t: number }[] = [];
    let raf = 0;
    let lastKeyAt = 0;
    let lastBurstAt = 0;
    /** 上一次「心跳复算」的时刻（见 draw）：用来把「误判成收起」兜回来 */
    let lastValidate = 0;
    /**
     * 是否要把自绘光标「收起来、交还给系统」。
     *
     * 两种情况：
     *  ① **指针已不再被页面跟踪**（`untracked`，见下）：浏览器**不再派发 `pointermove`**，
     *     自绘拿不到新坐标，只能冻在最后位置；而全局 CSS 又设了 `cursor: none` ——
     *     于是屏幕上一个光标都不剩（鼠标处没有光标、自绘停在别处）。必须收起、交还系统。
     *  ② **几何上确凿**：坐标落在 iframe 上、或已经不在页面视口内。
     *
     * ⚠️ 判定要坚持「能被事件纠正」：任何一次真实的 `pointermove` / `pointerdown`
     * 都会清掉 ①，所以收起只是**临时**的，指针一回到页面立刻恢复自绘。
     */
    let pointerOutside = false;
    /** 「已收起」状态下是否已经清过屏：清一次就够，不必每帧重复 clearRect */
    let outsideCleared = false;
    /**
     * 指针是否已「不再受页面跟踪」。
     *
     * ⚠️ 这是「光标和鼠标一起消失」的**根因**：在链接上**按下时手抖**（快速连点很常见）
     * 会触发浏览器的**原生拖拽**（`dragstart` → `pointercancel`），此后浏览器只发 `drag`
     * 事件、**不再发 `pointermove`**；指针移到浏览器工具栏 / 别的窗口也一样收不到事件。
     * 这两种情况下自绘都拿不到坐标，只能收起（系统光标在那些区域本来就可见）。
     */
    let untracked = false;
    /** `untracked` 置位的时刻：供 `draw` 里的兜底复算判断「已经收起多久了」 */
    let untrackedSince = 0;
    /** 「可能离开页面」的确认定时器（见 `LEAVE_CONFIRM`） */
    let untrackTimer = 0;
    /** 是否收到过真实的指针事件（没有的话，坐标还是初始值，不能拿它做几何判定） */
    let pointerSeen = lastPointer.seen;

    /**
     * 判断一个节点是不是 iframe。
     *
     * ⚠️ **不能用 `instanceof`**：指针移进/移出 iframe 时浏览器给的 `relatedTarget`
     * 可能来自 iframe 的**另一个 realm**（跨文档节点在本窗口里 instanceof 判定为 false），
     * 也可能直接是 null。这里只认 `tagName`，并且把「连属性都读不出来」的跨域节点
     * 一律当成 iframe —— 读不到属性的节点本来就只可能来自别的文档。
     */
    const isIframe = (node: unknown): boolean => {
      if (!node) return false;
      try {
        return (node as Element).tagName === "IFRAME";
      } catch {
        return true;
      }
    };

    /**
     * 几何兜底：坐标是否落在某个 iframe 的矩形里。
     * 部分浏览器在「刚进入 iframe」那一刻会把事件 target 报成外层容器，
     * 只看 tagName 会漏判 —— 再用矩形确认一次（页面上 iframe 通常只有一两个，开销可忽略）。
     */
    const pointInIframe = (x: number, y: number): boolean => {
      const list = document.querySelectorAll("iframe");
      for (let i = 0; i < list.length; i += 1) {
        const r = list[i].getBoundingClientRect();
        if (
          r.width > 0 &&
          r.height > 0 &&
          x >= r.left &&
          x <= r.right &&
          y >= r.top &&
          y <= r.bottom
        ) {
          return true;
        }
      }
      return false;
    };

    /** 指针此刻是否压在 iframe 上（视频播放器、评论框都是跨域 iframe） */
    const overIframe = (target: EventTarget | null, x: number, y: number): boolean =>
      isIframe(target) || pointInIframe(x, y);

    /** 坐标是否已经不在页面视口内（进了 DevTools 停靠区、或被挪到窗口外） */
    const outsideViewport = (x: number, y: number): boolean =>
      x < 0 || y < 0 || x > vw || y > vh;

    /**
     * 坐标是否**贴着（或已越出）视口边界** —— 只有这种情况才可能是「指针真的离开页面」。
     *
     * ⚠️ 用来过滤 `pointerout` 的 `relatedTarget === null`：指针下的元素被替换
     * （换页、列表重排、**giscus 反复重建 iframe**）时浏览器**同样给 null**，
     * 但那一刻坐标在页面中间；而真的移出去必然贴着某条边。少了这道过滤，
     * 快速切页时会被误判成「离开」→ 收起自绘 → 鼠标处一个光标都没有（要等下次移动才恢复）。
     */
    const EDGE_TOLERANCE = 12;
    const atViewportEdge = (x: number, y: number): boolean =>
      x < EDGE_TOLERANCE ||
      y < EDGE_TOLERANCE ||
      x > vw - EDGE_TOLERANCE ||
      y > vh - EDGE_TOLERANCE;

    /**
     * **唯一**的「该不该收起自绘光标」判定。只看几何，不看 `relatedTarget` —— 后者
     * 在「指针下的元素刚被替换」时也会是 null，会把正常页面误判成「已离开」。
     */
    const shouldHide = (target: EventTarget | null, x: number, y: number): boolean =>
      outsideViewport(x, y) || overIframe(target, x, y);

    /** 记下指针位置（跨 effect 重跑沿用，避免光标被重置到视口中心） */
    const rememberPointer = (x: number, y: number) => {
      pointer.x = x;
      pointer.y = y;
      pointerSeen = true;
      lastPointer.x = x;
      lastPointer.y = y;
      lastPointer.seen = true;
    };

    /**
     * 页面重新拿到指针事件了 => 恢复跟踪，并撤掉「可能已离开」的待确认定时器。
     * ⚠️ 只有 `pointermove` / `pointerdown`、以及「从页面内另一个元素移过来」的
     * `pointerover` 才算数 —— 拖拽结束、从窗口外回到页面时浏览器补发的那条
     * `pointerover`（`relatedTarget` 为 null、坐标还是旧值）不能当作「回来了」，
     * 否则会立刻在旧位置画出一个「冻住的」光标。
     */
    const markTracking = () => {
      if (untrackTimer) {
        clearTimeout(untrackTimer);
        untrackTimer = 0;
      }
      untracked = false;
    };

    /**
     * 「指针可能已经离开页面」（`relatedTarget` 为 null）。
     * 延迟 `LEAVE_CONFIRM` 再确认：元素被替换导致的 null 紧接着会有事件到达，
     * 那时 `markTracking()` 会把定时器撤掉；真的移出去则一条事件都不会再来。
     */
    const scheduleUntrack = (x: number, y: number) => {
      if (untrackTimer) clearTimeout(untrackTimer);
      const where = `${Math.round(x)},${Math.round(y)}`;
      untrackTimer = window.setTimeout(() => {
        untrackTimer = 0;
        setUntracked(`指针离开页面：pointerout 的 relatedTarget 为 null（坐标 ${where}）且 ${LEAVE_CONFIRM}ms 内没有任何事件`);
      }, LEAVE_CONFIRM);
    };

    /**
     * dev 下把「收起 / 恢复」的**原因**打到控制台。
     *
     * Next.js 的 dev 会把浏览器的 `console` 转发到终端（终端里带 `[browser]` 前缀），
     * 所以复现时能在终端直接看到「为什么收起」，不必再靠猜。只在**状态真的变化**时打一行，
     * 平时完全静默；生产构建里 `process.env.NODE_ENV === "production"` 会被静态替换，是空操作。
     */
    let lastTraced = false;
    const trace = (reason: string) => {
      if (process.env.NODE_ENV === "production") return;
      if (pointerOutside === lastTraced) return;
      lastTraced = pointerOutside;
      console.log(
        `[cursor-fx] ${pointerOutside ? "收起自绘（交还系统光标）" : "恢复自绘"} ← ${reason}`,
      );
    };

    /** 把「指针已不再受页面跟踪」置位（并记下时刻，供 draw 里的兜底复算用） */
    const setUntracked = (reason: string) => {
      if (!untracked) {
        untracked = true;
        untrackedSince = performance.now();
      }
      revalidate(reason);
    };

    /**
     * 按**当前坐标**重新判定一次几何层面「是否收起」。
     *
     * 事件之外也会被周期性调用（见 `draw` 里的心跳）：因为几何层面的收起一旦被误置，
     * 若之后恰好没有指针事件（原地点击、鼠标停着不动、换页时元素被替换……），
     * 就永远等不到一条能纠正它的事件 —— 屏幕上一个光标都没有。
     *
     * ⚠️ 它**只清几何层面的判断，绝不清 `untracked`**：后者代表「浏览器不再给我们
     * 坐标」（拖拽中 / 指针在浏览器界面上），只能由真实的指针事件来解除。
     */
    const revalidate = (reason = "周期性复算") => {
      if (!pointerSeen) return;
      pointerOutside =
        untracked ||
        shouldHide(document.elementFromPoint(pointer.x, pointer.y), pointer.x, pointer.y);
      trace(reason);
    };

    revalidate("初始化"); // 恢复上次位置后先按「当前视口」判定一次（视口可能已经变了）
    // 视口尺寸变化（DevTools 开合、窗口缩放）后立刻重算：坐标可能已经落到视口外，
    // 或者原本压在指针下的 iframe 被挪走了。心跳也能兜住，但这里能快 200ms。
    const onResizeRevalidate = () => revalidate("视口尺寸变化（resize）");
    window.addEventListener("resize", onResizeRevalidate);

    /** 从锚点向目标点走，每隔 STAMP_SPACING 放一个印记，保证拖尾连续 */
    const addStamps = (toX: number, toY: number) => {
      let dx = toX - anchorX;
      let dy = toY - anchorY;
      let dist = Math.hypot(dx, dy);
      if (dist < STAMP_SPACING) return;
      const now = performance.now();
      let guard = 0;
      while (dist >= STAMP_SPACING && guard < 20) {
        const k = STAMP_SPACING / dist;
        anchorX += dx * k;
        anchorY += dy * k;
        stamps.push({ x: anchorX, y: anchorY, t: now });
        dx = toX - anchorX;
        dy = toY - anchorY;
        dist = Math.hypot(dx, dy);
        guard += 1;
      }
      if (stamps.length > STAMP_MAX) stamps = stamps.slice(stamps.length - STAMP_MAX);
    };

    /* ---------------- 音效（懒加载 AudioContext） ---------------- */
    let audio: AudioContext | null = null;
    const ensureAudio = (): AudioContext | null => {
      if (!audio) {
        const Ctor =
          window.AudioContext ??
          (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return null;
        try {
          audio = new Ctor();
        } catch {
          return null;
        }
      }
      if (audio.state === "suspended") void audio.resume();
      return audio;
    };

    const blip = (freq: number, type: OscillatorType, dur: number, vol: number) => {
      const ac = ensureAudio();
      if (!ac) return;
      const t = ac.currentTime;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.6), t + dur);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(vol, t + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(ac.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    };

    const playKey = () => blip(1200, "sine", 0.05, 0.025);

    let lastNoteAt = 0;

    /**
     * 点击音：随机一个钢琴琴键音。
     * 用「基频 + 若干泛音」做加性合成，高次泛音衰减更快，
     * 再加一个短促起音 + 指数衰减的包络 —— 听感接近被敲击的琴弦。
     *
     * 连点时用 NOTE_THROTTLE 限制频率，并在每条泛音结束后 disconnect() ——
     * 否则拼命点会在音频图里堆起几十个振荡器，主线程 / 音频线程都要抖一下。
     */
    const playPiano = () => {
      const nowMs = performance.now();
      if (nowMs - lastNoteAt < NOTE_THROTTLE) return;
      lastNoteAt = nowMs;

      const ac = ensureAudio();
      if (!ac) return;
      const t = ac.currentTime;
      const midi = PIANO_NOTES[Math.floor(Math.random() * PIANO_NOTES.length)];
      const f0 = 440 * Math.pow(2, (midi - 69) / 12);

      const master = ac.createGain();
      master.gain.setValueAtTime(0.0001, t);
      master.gain.exponentialRampToValueAtTime(0.09, t + 0.008);
      master.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);

      // 轻微低通，柔化过量的高次泛音
      const tone = ac.createBiquadFilter();
      tone.type = "lowpass";
      tone.frequency.value = Math.min(6500, f0 * 9);
      tone.Q.value = 0.6;
      master.connect(tone);
      tone.connect(ac.destination);

      PIANO_PARTIALS.forEach((partial, i) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(f0 * partial, t);
        gain.gain.setValueAtTime(PIANO_AMPS[i], t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.1 / (1 + i * 0.7));
        osc.connect(gain);
        gain.connect(master);
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
          // 最长的那条泛音（i === 0）结束后，总线与滤波器也断掉，整张子图就能被回收
          if (i === 0) {
            master.disconnect();
            tone.disconnect();
          }
        };
        osc.start(t);
        osc.stop(t + 1.2);
      });
    };

    /* ---------------- 事件 ---------------- */
    const onMove = (e: PointerEvent) => {
      // 收到真实的 pointermove 就说明「刚才的拖拽结束了 / 指针回到页面了」
      markTracking();
      rememberPointer(e.clientX, e.clientY);
      // 指针压在 iframe 上（视频、评论区）：立刻收起自绘、交还系统光标。
      // 这一步必须「一次到位」—— 命中 iframe 之后顶层文档就收不到 pointermove 了。
      if (shouldHide(e.target, e.clientX, e.clientY)) {
        pointerOutside = true;
        trace("pointermove：坐标压在 iframe 上 / 已出视口");
        return;
      }
      pointerOutside = false;
      trace("pointermove");
      addStamps(e.clientX, e.clientY);
    };

    /**
     * 指针离开某个元素。
     *
     * 两种需要收起的情况：
     *  - `relatedTarget` 就是 iframe：一步跨进 iframe，此后顶层收不到任何事件；
     *  - `relatedTarget` 为 null：可能离开了页面（移到浏览器工具栏、别的窗口），
     *    但要**延迟确认** —— 指针下的元素被替换时（换页、列表重排）浏览器同样给 null。
     *
     * ⚠️ 曾经把 null 一律当「离开」→ 换页时被误判 → 停画 + `cursor:none` => 一个光标都不剩；
     * 后来又改成「完全不信 null」→ 拖拽/移到浏览器界面时自绘冻在旧位置 => 鼠标处也没有光标。
     * 两种都错，正解是「延迟确认 + 事件可撤销」。
     */
    const onPointerOut = (e: PointerEvent) => {
      const related = e.relatedTarget as Node | null;
      if (isIframe(related)) {
        markTracking();
        setUntracked("pointerout：relatedTarget 就是 iframe（一步跨进 iframe）");
        return;
      }
      if (related === null) {
        // ⚠️ 必须再确认「坐标贴着视口边界」：元素被替换（换页、giscus 重建 iframe）时也给 null，
        // 但那时坐标在页面中间，不能当成「离开了页面」。
        if (atViewportEdge(e.clientX, e.clientY)) scheduleUntrack(e.clientX, e.clientY);
        return;
      }
      // 页面内部换元素：什么都不用做（几何判断交给 move / over / 心跳）
    };

    /**
     * ⚠️ 指针压到 iframe 上时，要**主动把状态置为「已离开」**，
     * 而不是「判到 iframe 就放过不管」。
     *
     * 早先那种写法会在这样的顺序下失灵：进入 iframe 的瞬间浏览器先派发一次
     * target 是**外层容器**的 `pointerover`（那一刻坐标已经在 iframe 里了），
     * 于是状态被复位成「还在文档内」；紧接着浏览器把后续事件全部交给 iframe，
     * 顶层再也收不到任何事件 —— 表现就是「系统光标已经进了 iframe，
     * 自定义光标却冻在边界外一动不动」。
     */
    const onPointerOver = (e: PointerEvent) => {
      const related = e.relatedTarget as Node | null;
      // 只有「从页面内另一个元素移过来」才说明跟踪正常；拖拽结束 / 从窗口外回来时
      // 浏览器补发的那条 pointerover 是 `relatedTarget === null` + 旧坐标，不能当数。
      if (related !== null && !isIframe(related)) markTracking();
      rememberPointer(e.clientX, e.clientY);
      // ⚠️ 必须带上 `untracked`：漏掉它的话，拖拽结束后那条补发的 pointerover 会把光标
      // 又画回旧位置（看起来就是「光标冻在那儿」）。
      pointerOutside = untracked || shouldHide(e.target, e.clientX, e.clientY);
      trace(`pointerover（related=${related === null ? "null" : "元素"}）`);
    };

    /**
     * `pointercancel` 表示**指针已不再受页面跟踪**（最典型就是「按下时手抖」触发了
     * 浏览器原生拖拽：`dragstart` → `pointercancel`，之后只有 `drag` 事件）。
     * 此后自绘再也拿不到新坐标，必须收起、把光标交给系统（拖拽有浏览器自己的光标）。
     */
    const onPointerCancel = () => {
      if (untrackTimer) {
        clearTimeout(untrackTimer);
        untrackTimer = 0;
      }
      setUntracked("pointercancel：指针已不再受页面跟踪（多为按下的同时手抖触发了原生拖拽）");
    };

    /** 原生拖拽开始（拖链接 / 拖图片）：同上，收起自绘 */
    const onDragStart = (e: DragEvent) => {
      onPointerCancel();
      trace(`dragstart：开始拖拽（target=${(e.target as Element | null)?.tagName ?? "?"}）`);
    };

    /**
     * 拖拽过程中浏览器**只发 `drag`**（不发 `pointermove`），但 `drag` 事件带着坐标 ——
     * 用它让「最后已知位置」保持新鲜，这样松手那一刻的判定才是准的。
     */
    const onDrag = (e: DragEvent) => {
      if (e.clientX || e.clientY) rememberPointer(e.clientX, e.clientY);
    };

    /**
     * 拖拽结束：按**最新坐标**重新判定一次。
     *
     * ⚠️ 这是「卡住」的正解：`pointercancel` 之后浏览器可能一直不发 `pointermove`
     * （拖拽中、或指针停在浏览器工具栏上），光靠「等一个 pointermove」永远等不到 ——
     * 用户看到的就是「光标没了、动鼠标也不回来」。`dragend` 一定会来，在这里收尾即可：
     * 指针还在页面上就恢复自绘（坐标是新鲜的，位置准确），落在页面外就继续收起。
     */
    const onDragEnd = (e: DragEvent) => {
      if (e.clientX || e.clientY) rememberPointer(e.clientX, e.clientY);
      markTracking();
      revalidate("dragend（拖拽结束，按最新坐标重新判定）");
    };

    /** 手势收尾（点击结束、触控被取消后）：给「已不再跟踪」一个及时解除的机会 */
    const onPointerUp = () => {
      markTracking();
      revalidate("pointerup（手势结束）");
    };

    const onScroll = () => {
      revalidate("滚动（scroll）");
    };

    const onDown = (e: PointerEvent) => {
      ensureAudio(); // 首次手势即解锁音频
      // 点击本身也是一次「指针确实在页面里」的确认：据当前坐标重算一次状态，
      // 让任何被误判成「已离开」的情况能**立刻自愈**（原地连点时没有 move/over，
      // 少了这一步就得等用户移动鼠标才恢复）。
      // 点 iframe 时顶层根本收不到 pointerdown，无需在这里处理。
      markTracking();
      rememberPointer(e.clientX, e.clientY);
      pointerOutside = shouldHide(e.target, e.clientX, e.clientY);
      trace("pointerdown");
      playPiano();
      // 点击处来一小片「揭开」的代码；连点时限制频率，避免印记堆积导致卡顿
      const now = performance.now();
      if (now - lastBurstAt >= BURST_THROTTLE) {
        lastBurstAt = now;
        // 2 个印记就够点亮点击处了；连点时别让印记数瞬间冲高（会拉高那一秒的每帧成本）
        for (let i = 0; i < 2; i += 1) {
          const ang = (i / 2) * TAU;
          stamps.push({
            x: e.clientX + Math.cos(ang) * 11,
            y: e.clientY + Math.sin(ang) * 11,
            t: now,
          });
        }
        if (stamps.length > STAMP_MAX) stamps = stamps.slice(stamps.length - STAMP_MAX);
      }
      ripples.push({ x: e.clientX, y: e.clientY, t: now });
      if (ripples.length > 8) ripples.shift();
      anchorX = e.clientX;
      anchorY = e.clientY;
    };

    const isEditable = (el: EventTarget | null): boolean => {
      const node = el as HTMLElement | null;
      if (!node) return false;
      const tag = node.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || node.isContentEditable;
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const now = performance.now();
      if (now - lastKeyAt < KEY_THROTTLE) return;
      lastKeyAt = now;
      // 正在输入框打字时不响，避免恼人；其它 UI 按键给轻反馈
      if (isEditable(e.target)) return;
      ensureAudio();
      playKey();
    };

    /**
     * 连点同一处时，浏览器会把它当成「双击选词 / 三击选段」；
     * 选中之后 Edge（以及部分 Chromium 系）会弹出**原生的「选中迷你菜单」**。
     * 那个菜单是系统浮层，弹出期间页面收不到 `pointermove` ——
     * 于是自定义光标「停在原地，等菜单消失后瞬移到新位置」。
     *
     * 这里把「第 2 次及以后」按下的默认行为拦掉（并顺手清掉已经产生的选区）。
     * 单击、以及按住拖拽选择文字都照常可用；只在输入框里放行，
     * 免得「双击选中一个词」这种正常操作被影响。
     */
    const suppressMultiClickSelection = (e: MouseEvent) => {
      if (e.detail < 2) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || el?.isContentEditable) return;
      e.preventDefault();
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) selection.removeAllRanges();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerCancel, { passive: true });
    window.addEventListener("keydown", onKey, { passive: true });
    window.addEventListener("mousedown", suppressMultiClickSelection, true);
    // 原生拖拽（拖链接/图片）：拖拽期间浏览器不发 pointermove，必须收起自绘；
    // 拖拽中靠 `drag` 保持坐标新鲜，`dragend` 时收尾（否则会一直收不起来）
    document.addEventListener("dragstart", onDragStart, true);
    document.addEventListener("drag", onDrag, true);
    document.addEventListener("dragend", onDragEnd, true);
    document.addEventListener("pointerout", onPointerOut, { passive: true });
    document.addEventListener("pointerover", onPointerOver, { passive: true });
    // 滚动事件不冒泡，用捕获阶段才收得到外壳里那个滚动容器
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });

    /* ---------------- 绘制 ---------------- */
    /** 画六芒星光标：持续旋转 + 每条边错相位地消失/重绘 */
    const drawStar = (now: number) => {
      const cx = pointer.x;
      const cy = pointer.y;
      const rot = (now / 1000) * ROTATION_SPEED;

      const edges: [number, number, number, number][] = [];
      for (const tri of [TRIANGLE_UP, TRIANGLE_DOWN]) {
        const pts = tri.map((deg) => {
          const a = deg * DEG + rot;
          return [cx + Math.cos(a) * STAR_R, cy + Math.sin(a) * STAR_R] as const;
        });
        for (let i = 0; i < 3; i += 1) {
          const p = pts[i];
          const q = pts[(i + 1) % 3];
          edges.push([p[0], p[1], q[0], q[1]]);
        }
      }

      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      edges.forEach((edge, i) => {
        const u = ((now / EDGE_CYCLE) + i / edges.length) % 1;
        // 前半段：从整条逐渐缩短到消失；后半段：从端点重新生长出来
        const f = u < 0.5 ? 1 - u / 0.5 : (u - 0.5) / 0.5;
        if (f <= 0.001) return;

        const [x1, y1, x2, y2] = edge;
        const ex = x1 + (x2 - x1) * f;
        const ey = y1 + (y2 - y1) * f;

        ctx.strokeStyle = glow;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(ex, ey);
        ctx.stroke();

        ctx.strokeStyle = color;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      });

      // 中心点（热点）
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(cx, cy, 1.8, 0, TAU);
      ctx.fill();
    };

    /**
     * 拖尾：两趟合成。
     * ① 把软点按印记画进遮罩（半分辨率，随便叠，很便宜）；
     * ② 只在**存活印记的并集包围盒**内：贴代码子图 → 用 `destination-in` 按遮罩抠出揭示区。
     *
     * ⚠️ 关键是第 ② 步的「固定包围盒」：早先是整幅 `drawImage(codeTexture)` + 整幅遮罩，
     * 在 HiDPI / 大屏上每帧要合成几千万像素（2560×1440@2x ≈ 15M 像素 ×2 次），
     * 一旦有印记存活就掉帧 —— 表现就是「点几下之后移动鼠标，光标短暂卡在原地」。
     * 现在成本只跟拖尾范围有关，跟屏幕大小无关。
     */
    const drawReveal = (now: number) => {
      if (!codeTexture || !mctx) return;

      // ① 收集仍存活的印记，顺手淘汰过期的，并求出并集包围盒
      mctx.setTransform(1, 0, 0, 1, 0, 0);
      mctx.clearRect(0, 0, mask.width, mask.height);
      mctx.setTransform(MASK_SCALE, 0, 0, MASK_SCALE, 0, 0);

      let alive = 0;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      for (let i = stamps.length - 1; i >= 0; i -= 1) {
        const p = stamps[i];
        const since = Math.max(0, now - p.t);
        const age = since / CODE_LIFE;
        if (age >= 1) {
          stamps.splice(i, 1);
          continue;
        }
        const alpha = (1 - age) * Math.min(1, since / 70);
        if (alpha <= 0.01) continue;

        mctx.globalAlpha = alpha;
        mctx.drawImage(dot, p.x - STAMP_R, p.y - STAMP_R, FEATHER_SIZE, FEATHER_SIZE);
        alive += 1;

        if (p.x - STAMP_R < minX) minX = p.x - STAMP_R;
        if (p.y - STAMP_R < minY) minY = p.y - STAMP_R;
        if (p.x + STAMP_R > maxX) maxX = p.x + STAMP_R;
        if (p.y + STAMP_R > maxY) maxY = p.y + STAMP_R;
      }
      mctx.globalAlpha = 1;
      if (alive === 0) return;

      // 裁剪到视口内，左右各留 1px 余量防止边缘缺一列
      const bx = Math.max(0, Math.floor(minX) - 1);
      const by = Math.max(0, Math.floor(minY) - 1);
      const bw = Math.min(vw - bx, Math.ceil(maxX - minX) + 2);
      const bh = Math.min(vh - by, Math.ceil(maxY - minY) + 2);
      if (bw <= 0 || bh <= 0) return;

      // ② 只在这个包围盒里做合成
      const sx = Math.max(0, Math.floor(bx * dpr));
      const sy = Math.max(0, Math.floor(by * dpr));
      const sw = Math.min(codeTexture.width - sx, Math.ceil(bw * dpr));
      const sh = Math.min(codeTexture.height - sy, Math.ceil(bh * dpr));
      const mx = Math.max(0, Math.floor(bx * MASK_SCALE));
      const my = Math.max(0, Math.floor(by * MASK_SCALE));
      const mw = Math.min(mask.width - mx, Math.ceil(bw * MASK_SCALE));
      const mh = Math.min(mask.height - my, Math.ceil(bh * MASK_SCALE));
      if (sw <= 0 || sh <= 0 || mw <= 0 || mh <= 0) return;

      // ⚠️ 这一段的 ctx 状态（clip + 混合模式）必须保证被还原：
      // 若 `drawImage` 抛错，下面的 `restore()` 就会被跳过 —— clip 与
      // `destination-in` 会**永久**留在上下文里，之后每帧的 clearRect / 描边
      // 都被裁进那个小矩形、还按 destination-in 互相擦除，画布永远是空的
      // （只能刷新页面才恢复）。所以包进 try/finally。
      ctx.save();
      try {
        ctx.beginPath();
        ctx.rect(bx, by, bw, bh);
        ctx.clip();
        // 代码纹理：主画布已按 dpr 缩放，所以目标用 CSS 像素
        ctx.drawImage(codeTexture, sx, sy, sw, sh, sx / dpr, sy / dpr, sw / dpr, sh / dpr);
        ctx.globalCompositeOperation = "destination-in";
        ctx.drawImage(mask, mx, my, mw, mh, mx / MASK_SCALE, my / MASK_SCALE, mw / MASK_SCALE, mh / MASK_SCALE);
      } finally {
        ctx.restore();
      }
    };

    /**
     * ⚠️ 整帧绘制包在 `try/finally` 里，`finally` 中**无条件续帧**。
     *
     * 视觉特效不值得因为某一帧的偶发异常（例如坐标异常让 `arc` 半径算成负数）
     * 就把 rAF 链断掉：链一断就不再重绘，而系统光标又被 `cursor: none` 藏着，
     * 用户看到的就是「光标和鼠标都不见了」，且只能刷新页面才能恢复。
     * 异常仍照常抛到控制台便于排查，但绘制循环不会死。
     */
    const draw = () => {
      try {
        // 帧时间统一用 performance.now()：事件里记的也是它。
        // rAF 回调的时间戳是「帧开始」时刻，可能早于事件发生时刻，
        // 两者混用会让 age 变成负数 —— 涟漪半径算出负值，arc 直接抛错。
        const now = performance.now();

        // 心跳复算（每 200ms）：按当前坐标重新判定一次「是否收起」。
        // 这是「光标卡在不可见状态」的兜底 —— 不管是什么原因把它误置成了收起，
        // 只要指针坐标确实落在页面上，最多一两百毫秒就会自己恢复，**不需要**任何
        // 用户操作（原地连点、鼠标停着不动、换页时元素被替换都不会产生指针事件）。
        if (pointerSeen && now - lastValidate >= 200) {
          lastValidate = now;
          revalidate();
          // 兜底：收起之后如果**一条事件都没有**（拖拽被浏览器接管、超级拖拽、指针停在
          // 浏览器界面上……），不能永远不出光标。超过 STUCK_RECOVER 且当前坐标可画、
          // 页面仍有焦点时，就按当前坐标恢复自绘。
          if (
            untracked &&
            now - untrackedSince >= STUCK_RECOVER &&
            document.hasFocus() &&
            !shouldHide(document.elementFromPoint(pointer.x, pointer.y), pointer.x, pointer.y)
          ) {
            untracked = false;
            revalidate(`兜底：收起已超过 ${STUCK_RECOVER}ms 且期间没有任何事件，按当前坐标恢复自绘`);
          }
        }

        // 指针在 iframe 上 / 已经出了视口：整层清空停止绘制，
        // 免得没有跟随的光标「冻」在边界外（清一次就够，不必每帧重来）
        if (pointerOutside) {
          if (!outsideCleared) {
            ctx.clearRect(0, 0, vw, vh);
            outsideCleared = true;
          }
          return;
        }
        outsideCleared = false;

        ctx.clearRect(0, 0, vw, vh);
        drawReveal(now);

        // 点击涟漪（与光标同色）
        for (let i = ripples.length - 1; i >= 0; i -= 1) {
          const r = ripples[i];
          const age = Math.max(0, (now - r.t) / RIPPLE_LIFE);
          if (age >= 1) {
            ripples.splice(i, 1);
            continue;
          }
          ctx.strokeStyle = `rgba(${rgbStr}, ${(1 - age) * 0.55})`;
          ctx.lineWidth = 1.6 * (1 - age) + 0.3;
          ctx.beginPath();
          ctx.arc(r.x, r.y, 6 + age * 28, 0, TAU);
          ctx.stroke();
        }

        drawStar(now);
      } finally {
        raf = requestAnimationFrame(draw);
      }
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      if (untrackTimer) clearTimeout(untrackTimer);
      window.removeEventListener("resize", resize);
      window.removeEventListener("resize", onResizeRevalidate);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", suppressMultiClickSelection, true);
      document.removeEventListener("dragstart", onDragStart, true);
      document.removeEventListener("drag", onDrag, true);
      document.removeEventListener("dragend", onDragEnd, true);
      document.removeEventListener("pointerout", onPointerOut);
      document.removeEventListener("pointerover", onPointerOver);
      document.removeEventListener("scroll", onScroll, { capture: true });
      observer.disconnect();
      root.removeAttribute("data-cursor-fx");
      if (audio) void audio.close().catch(() => {});
    };
    // 颜色变化时重建（罕见操作），换取不用在渲染期写 ref
  }, [color, codeColor]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 100,
      }}
    />
  );
}

export default MouseCursorEffect;
