import js from "@eslint/js"
import globals from "globals"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import tseslint from "typescript-eslint"
import { defineConfig, globalIgnores } from "eslint/config"

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    /* 构建侧（vite 配置与插件）跑在 Node 里，下面单独给 node 全局。
       这里把它们排除掉，是为了让「Node 文件里误用浏览器全局」真的能被抓到 ——
       如果两块 globals 叠加，`document` 在 Node 文件里也变成合法，检查就等于没有。 */
    ignores: ["vite.config.ts", "vite-plugins/**/*.ts"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    /* 构建侧：Node 环境，没有 DOM，也不该有 React 规则 */
    files: ["vite.config.ts", "vite-plugins/**/*.ts"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    /* 体检脚本 `scripts/health-check.mjs` 以前是**完全的零守卫区**：
       它既不在 tsconfig 的 include 里（不类型检查），也不在任何 lint 块里。
       偏偏它是唯一会「判别人合不合格」的文件，它自己写错了没人管。
       .mjs 是原生 ESM，用 node 全局即可。 */
    files: ["**/*.mjs"],
    extends: [js.configs.recommended],
    languageOptions: {
      sourceType: "module",
      globals: globals.node,
    },
  },
  {
    files: [
      "src/components/ui/**/*.{ts,tsx}",
      "src/components/article/mdx-components.tsx",
      /* 日记正文的 MDX 组件映射：和文章那份同性质 —— 一个文件里既定义小排版组件、
         又只导出映射表。热更新在这里没有意义（改的是样式映射，整页刷新更干净）。 */
      "src/components/journal/journal-mdx-components.tsx",
    ],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
])
