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
    "public/admin/**",
    "public/uploads/**",
    // 独立部署的 Cloudflare Worker：不在 Next 的构建里，也不该走 Next 的规则
    "workers/**",
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
