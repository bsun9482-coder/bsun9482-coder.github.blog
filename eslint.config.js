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
    /* 构建侧（vite 配置）跑在 Node 里，下面单独给 node 全局。
       这里把它排除掉，是为了让「Node 文件里误用浏览器全局」真的能被抓到 ——
       如果两块 globals 叠加，`document` 在 Node 文件里也变成合法，检查就等于没有。 */
    ignores: ["vite.config.ts"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      /* 以 _ 开头的参数 / 变量 = 「我知道它没用，但我必须接住它」。
         TypeScript 自己的 noUnusedLocals 本来就是这条约定（所以 tsc 不报 _node），
         ESLint 这边跟上，免得两个检查器对同一段代码给出相反结论。
         实际用处：react-markdown 给每个自定义组件都塞一个 node，必须解构掉
         才能安全地 {...props} 展开到 DOM 上，但接下来确实用不到它。 */
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    /* 构建侧：Node 环境，没有 DOM，也不该有 React 规则
       （vite-plugins/ 那一堆构建期插件第 38 轮已删，现在只剩配置文件本身） */
    files: ["vite.config.ts"],
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
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
])
