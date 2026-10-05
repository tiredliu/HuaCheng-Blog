/**
 * 评论区表情栏的候选表情。
 *
 * 想换表情**改这个文件就行**：
 *
 * - `char`：直接写 emoji 字符，点击后复制这个字符
 * - `image`：写图片地址（`public/images/` 下的文件），点击后复制 Markdown 图片语法
 *   —— GitHub 评论框会把它渲染成图片，这就是「自定义图片表情包」的入口
 * - `name`：鼠标悬停时的说明，也是无障碍标签
 *
 * 两者给一个即可；都给了以 `image` 为准（复制图片语法）。
 */
export interface EmojiItem {
  /** emoji 字符，例如 "🎉" */
  char?: string;
  /** 图片表情的地址，例如 "/images/emoji/cheer.png" */
  image?: string;
  /** 表情名字，用于提示与无障碍标签 */
  name: string;
}

export const COMMENT_EMOJIS: EmojiItem[] = [
  { char: "😀", name: "微笑" },
  { char: "😄", name: "开心" },
  { char: "🤣", name: "笑哭" },
  { char: "😊", name: "害羞" },
  { char: "😍", name: "喜欢" },
  { char: "🤔", name: "思考" },
  { char: "😴", name: "困了" },
  { char: "😭", name: "哭了" },
  { char: "😡", name: "生气" },
  { char: "👍", name: "赞" },
  { char: "🙏", name: "感谢" },
  { char: "🎉", name: "庆祝" },
  { char: "❤️", name: "爱心" },
  { char: "🔥", name: "火" },
  { char: "🌸", name: "花" },
  { char: "✨", name: "闪光" },
];
