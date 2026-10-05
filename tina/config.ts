import { defineConfig } from "tinacms";

/**
 * TinaCMS 内容模型。
 *
 * 这里的字段必须和 `src/lib/posts.ts` 里读取的 frontmatter 一一对应，
 * 否则后台保存出来的文章在前台会读不到数据。
 */

const branch =
  process.env.GITHUB_BRANCH ||
  process.env.CF_PAGES_BRANCH ||
  process.env.VERCEL_GIT_COMMIT_REF ||
  process.env.HEAD ||
  "main";

export default defineConfig({
  branch,

  // https://app.tina.io 上创建项目后拿到
  clientId: process.env.NEXT_PUBLIC_TINA_CLIENT_ID,
  token: process.env.TINA_TOKEN,

  build: {
    outputFolder: "admin",
    publicFolder: "public",
  },

  // 本地开发默认允许，线上按需开放其它来源
  // server: { allowedOrigins: ["https://your-site.pages.dev"] },

  media: {
    /**
     * 后台写作时插入的图片落到 `public/images/`（文章配图目录）。
     *
     * 壁纸走 `public/wallpapers/`（在设置面板里上传，见 github-upload.ts），
     * 音频在 `public/music/`，歌词在 `public/lyrics/` ——
     * 目录约定统一写在 `src/lib/assets.ts` 里。
     */
    tina: {
      mediaRoot: "images",
      publicFolder: "public",
    },
  },

  schema: {
    collections: [
      {
        name: "post",
        label: "博客文章",
        path: "content/posts",
        format: "mdx",
        fields: [
          {
            type: "string",
            name: "title",
            label: "标题",
            isTitle: true,
            required: true,
          },
          {
            type: "datetime",
            name: "date",
            label: "发布日期",
            required: true,
            ui: { dateFormat: "YYYY-MM-DD" },
          },
          {
            type: "string",
            name: "summary",
            label: "摘要",
            description: "列表页显示的一段话，留空则自动截取正文首段",
            ui: { component: "textarea" },
          },
          {
            type: "string",
            name: "tags",
            label: "标签",
            list: true,
            description: "回车添加下一个标签",
          },
          {
            type: "string",
            name: "author",
            label: "作者",
          },
          {
            type: "image",
            name: "cover",
            label: "封面图（列表页缩略框的背景）",
            description:
              "从媒体库选一张图，它会成为列表页那张卡片、以及文章页顶部的背景图；留空时卡片会自动展示正文里插入的图片缩略图。",
          },
          {
            type: "boolean",
            name: "draft",
            label: "草稿",
            description: "打开后只在本机 `npm run dev` 时可见，不会出现在线上",
          },
          {
            type: "rich-text",
            name: "body",
            label: "正文",
            isBody: true,
          },
        ],
        ui: {
          // 点「保存」之后跳转到前台对应的文章地址
          router: ({ document }) => `/posts/${document._sys.filename}`,
          filename: {
            // 用标题生成文件名，中文字符会被替换掉，也可以手改
            slugify: (values) =>
              String(values?.title ?? "untitled")
                .toLowerCase()
                .replace(/\s+/g, "-")
                .replace(/[^\w\u4e00-\u9fa5-]/g, "")
                .slice(0, 60) || "untitled",
          },
        },
      },
    ],
  },
});
