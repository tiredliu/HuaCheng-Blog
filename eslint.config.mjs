import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // TinaCMS 自动生成的产物，不参与代码规范检查
    "tina/__generated__/**",
    // public/ 下是静态资源（含 TinaCMS 生成的后台与图片/音频/歌词），不是我们的代码
    "public/admin/**",
    "public/**",
    // 独立部署的 Cloudflare Worker：不在 Next 的构建里，也不该走 Next 的规则
    "workers/**",
    /**
     * 本地写作工具（Obsidian / Typora）留下的目录。
     *
     * Obsidian 把配置建在「仓库」根目录，如果仓库开在 content/posts，
     * 就会出现 content/posts/.obsidian/。里面的社区插件是**第三方压缩过的 JS**
     * （实测某个插件单文件 2.4MB），ESLint 读它会直接崩：
     *
     *   RangeError: Invalid string length
     *     at text-table.js  ← 它想把那一行塞进终端表格
     *
     * 这些文件既不是我们的代码，也不该进版本库（.gitignore 已忽略）。
     */
    "**/.obsidian/**",
  ]),
  {
    rules: {
      // 解构时为了「排除某个字段」而留下的兄弟变量是常见写法
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
    },
  },
]);

export default eslintConfig;
