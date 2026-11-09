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
