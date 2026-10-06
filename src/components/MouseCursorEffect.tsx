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
    const pointer = { x: vw / 2, y: vh / 2 };
    let stamps: Stamp[] = [];
    // 印记锚点：只有真正放下印记时才推进，否则小步移动永远不会积累到间距
    let anchorX = pointer.x;
    let anchorY = pointer.y;
    const ripples: { x: number; y: number; t: number }[] = [];
    let raf = 0;
    let lastKeyAt = 0;
    let lastBurstAt = 0;
    /**
     * 指针是否已经离开顶层文档（进入 iframe —— 例如 Giscus 评论框、B 站视频 ——
     * 或移出窗口）。
     *
     * iframe 是**独立文档**：指针移进去之后顶层窗口收不到 `pointermove`，
     * 自定义光标会「冻」在 iframe 边界外不动（而 iframe 里显示的是系统光标）。
     * 所以一旦判定进入 iframe，就把整层清空、停止绘制，**把光标交还给系统**。
     */
    let pointerOutside = false;
    /** 「已进入 iframe」状态下是否已经清过屏：清一次就够，不必每帧重复 clearRect */
    let outsideCleared = false;
    /** 是否收到过真实的 pointermove（没有的话，指针坐标还是初始的视口中心，不能拿它做几何判定） */
    let pointerSeen = false;

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
      // 指针压在 iframe 上（视频、评论区）：立刻隐藏特效，光标交还系统。
      // 这一步必须「一次到位」—— 命中 iframe 之后顶层文档就收不到 pointermove 了。
      if (overIframe(e.target, e.clientX, e.clientY)) {
        pointerOutside = true;
        pointerSeen = true;
        return;
      }
      pointerOutside = false;
      pointerSeen = true;
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      addStamps(e.clientX, e.clientY);
    };

    /**
     * 指针离开顶层文档：`relatedTarget` 为 null（进了 iframe / 移出窗口），
     * 或者直接就是 iframe（部分浏览器的行为）。
     */
    const onPointerOut = (e: PointerEvent) => {
      const related = e.relatedTarget as Node | null;
      if (related === null || isIframe(related)) pointerOutside = true;
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
      pointerOutside = overIframe(e.target, e.clientX, e.clientY);
    };

    /**
     * 滚动不产生 `pointermove`，但会把 iframe 挪到指针底下（或从指针底下挪走），
     * 所以滚动后要按「指针当前所在位置」重新判定一次。
     * 没收到过真实移动时坐标是初始的视口中心，不能拿来做判定。
     */
    const onScroll = () => {
      if (!pointerSeen) return;
      pointerOutside = overIframe(document.elementFromPoint(pointer.x, pointer.y), pointer.x, pointer.y);
    };

    const onDown = (e: PointerEvent) => {
      ensureAudio(); // 首次手势即解锁音频
      pointer.x = e.clientX;
      pointer.y = e.clientY;
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
    window.addEventListener("keydown", onKey, { passive: true });
    window.addEventListener("mousedown", suppressMultiClickSelection, true);
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

      ctx.save();
      ctx.beginPath();
      ctx.rect(bx, by, bw, bh);
      ctx.clip();
      // 代码纹理：主画布已按 dpr 缩放，所以目标用 CSS 像素
      ctx.drawImage(codeTexture, sx, sy, sw, sh, sx / dpr, sy / dpr, sw / dpr, sh / dpr);
      ctx.globalCompositeOperation = "destination-in";
      ctx.drawImage(mask, mx, my, mw, mh, mx / MASK_SCALE, my / MASK_SCALE, mw / MASK_SCALE, mh / MASK_SCALE);
      ctx.globalCompositeOperation = "source-over";
      ctx.restore();
    };

    const draw = () => {
      // 帧时间统一用 performance.now()：事件里记的也是它。
      // rAF 回调的时间戳是「帧开始」时刻，可能早于事件发生时刻，
      // 两者混用会让 age 变成负数 —— 涟漪半径算出负值，arc 直接抛错。
      const now = performance.now();

      // 指针进了 iframe / 出了窗口：拿不到 pointermove，整层清空停止绘制，
      // 免得没有跟随的光标「冻」在 iframe 边界外（清一次就够，不必每帧重来）
      if (pointerOutside) {
        if (!outsideCleared) {
          ctx.clearRect(0, 0, vw, vh);
          outsideCleared = true;
        }
        raf = requestAnimationFrame(draw);
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
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", suppressMultiClickSelection, true);
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
