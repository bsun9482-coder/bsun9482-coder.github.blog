# 代码规范评审报告

- **项目**：`bsun9482-coder.github.blog`（学习日志 · 个人知识库）
- **评审时间**：2026-11-08
- **评审范围**：`src/`、`vite-plugins/`、`scripts/`、根配置文件、`content/`、`notes/`
- **评审方式**：只读诊断，未修改任何源码
- **代码基线**：`a5cf079` + 工作区未提交改动（`src/components/article/article-card.tsx`，+61/−3，r19）
- **结论**：混乱程度 **3 / 10**（0 最整洁）

---

## 1. 总体评价

这套代码**不混乱**，但「规范」只兑现了一半：结构和类型是专业水准，工具链和一致性是业余水准。

目录分层（`pages` / `components{ui,layout,article,fx}` / `lib` / `config` / `hooks` / `types`）职责清楚；TS strict 全绿，全仓零 `any`、零 `console`、零 `ts-ignore`、零 `eslint-disable`；设计令牌集中在 `index.css`，没有 `tailwind.config` 的双重来源。这几条很多个人项目做不到。

真正的债集中在三处：

1. **门禁假绿** —— `typecheck` 空转，还被项目自带的体检脚本报成 PASS；
2. **格式门槛形同虚设** —— `prettier --check .` 33 个文件红，且没有任何 check 脚本进门禁；
3. **「配置是唯一来源」没兑现** —— 死配置键、硬编码品牌色、写死的 UI 文案。

所以它不需要重构，需要的是**把已经写下来的约定执行到底**。

### 实测基线

| 检查项     | 命令                       | 结果                                                                 |
| ---------- | -------------------------- | -------------------------------------------------------------------- |
| 类型检查   | `tsc -b`                   | ✅ 0 error（45 个编译单元）                                          |
| ESLint     | `eslint .`                 | ✅ 0 problem                                                         |
| Prettier   | `prettier --check .`       | ❌ **33 个文件失败**（19 纯行尾 + 14 真实格式）                      |
| 项目体检   | `npm run health -- --fast` | ⚠️ 0 FAIL / 1 WARN（favicon）/ 9 项检查                              |
| 伪类型检查 | `npm run typecheck`        | ⚠️ **空转，永远退出 0**                                              |
| 产物体积   | `dist/assets`              | JS 4 个 / CSS 1 个，合计 700.4 kB；最大 `index-DsfOIwWw.js` 467.7 kB |

---

## 2. 问题清单

### 2.1 高

| #   | 问题类别      | 涉及文件或位置                                                                                                                         | 问题描述                                                                                                                                                                                                                         | 为什么是问题                                                                                                                                                                    | 改进方向                                                                                                                            |
| --- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| H1  | 工程化 / 门禁 | `package.json:11`、`tsconfig.json:2`、`scripts/health-check.mjs:66-82`                                                                 | 根 `tsconfig.json` 只有 `references` + `files: []`，`tsc --noEmit` **一个文件都不编译**（实测 `--listFiles` 输出 0 行，`tsconfig.app.json` 是 45 行）；而 `checkScripts()` 把它的 exit 0 无条件记成 `[PASS] TypeScript 类型检查` | **假绿**。`npm run health -- --fast` 和任何「我只跑 typecheck」的场合都等于没检查；真正的类型检查只藏在 `build` 的 `tsc -b` 里。这是唯一一个会让人**误以为安全**的问题          | `typecheck` 改为 `tsc -b --noEmit`；体检脚本改为读脚本真实退出码，或在 `--fast` 模式下单独跑一次 `tsc -b`                           |
| H2  | 样式 / 工程化 | 仓库根缺 `.gitattributes`；`.prettierrc:2`（`endOfLine: "lf"`）；`package.json:10`（`format` 只写 `**/*.{ts,tsx}`）；无 `format:check` | `prettier --check .` 33 个文件红 = **19 个纯 CRLF** + **14 个真实格式差异**；`git diff` 已在警告 `LF will be replaced by CRLF`                                                                                                   | ① 57% 是行尾噪点，真格式债被埋在里面；② `format` 的覆盖范围和裁判（全仓）不一致 ⇒ 跑过 format 仍然红；③ 没有 check 脚本 ⇒ Prettier 进不了门禁，而 `health` 里也完全没有格式检查 | 加 `.gitattributes`（`* text=auto eol=lf`）+ 一次 `git add --renormalize .`；拆 `format` / `format:check` 两个脚本；health 增加一项 |

### 2.2 中

| #   | 问题类别        | 涉及文件或位置                                                                                                                                                                                                                 | 问题描述                                                                                                                                                                      | 为什么是问题                                                                                                                                                                           | 改进方向                                                                                                                                                         |
| --- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | 样式 / 可维护性 | `src/index.css:334,356-358`；`src/components/article/article-card.tsx:56,69`；`src/components/layout/site-ambience.tsx:25,28`；`src/index.css:217`                                                                             | `--brand`（#2563eb）被写成 `rgb(37 99 235 / …)` / `rgba(37, 99, 235, …)` 共 6 处；氛围层另有 `#bfdbfe` / `#ddd6fe` / `#e9e9ee` 三个裸色值                                     | 与 `index.css:60` 自己写的「改色只改一处」直接冲突。这个项目换过两轮主题（暗色赛博 → 极简浅色），漏一处就是「蓝得不一致」，肉眼很难发现                                                | 统一换成 `color-mix(in srgb, var(--brand) 8%, transparent)` 之类；氛围色抽成 `--ambience-grid` / `--ambience-blob-a` / `--ambience-blob-b`                       |
| M2  | 组件设计        | `src/pages/profile-page.tsx`（317 行）；`MusicPlaceholderCard:33-69`；`LyricsBar:78-101`；`208-210`、`220-222`                                                                                                                 | 一个页面文件里同时有 3 个组件、个人卡、统计、轮播、最新文章、状态条；7 处 `TODO`；两个按钮的 `onClick` 是空的                                                                 | 页面职责过载，任何一块改动都要在 317 行里找位置；空 `onClick` 是**可点的死交互**（用户点了没反应），比不渲染更糟                                                                       | 拆到 `components/profile/{music-card,lyrics-bar,profile-hero}.tsx`；占位按钮要么接 `siteContent.links.douyin`（配置里现成），要么先不渲染                        |
| M3  | 组件设计 / 耦合 | `src/components/ui/card.tsx:3-4`、`26-41`                                                                                                                                                                                      | shadcn 的 `Card` 里 import 了 `@/lib/tilt`、`@/lib/spotlight`，并在 `onPointerMove/Leave/Cancel` 里直接挂业务特效                                                             | `components/ui/` 的隐含契约是「可以从 shadcn 重新生成或整体升级的层」，现在它依赖 `lib/` 和站点视觉规格；而且每次用 `Card` 都默认带倾斜 + 发光，其它地方只能靠 `tilt={false}` 一个个关 | 保持 `Card` 纯净；把「会倾斜 / 发光」的卡抽成 `components/fx/tilt-card.tsx` 包装组件，业务处用它                                                                 |
| M4  | 配置 / 死代码   | `src/config/site.ts`：`blog.publicResources:49`、`links.douyin:53-57`、`weather.geocodingApiUrl:61`、`ui.profile.heroEyebrow/heroTitle/heroSubtitle/contact/writing/noTagResults:127-135`                                      | 76 个配置键里 **9 个全仓无任何引用**（约 12%）；另外 `ui.sidebar.*` 这个命名空间已经没有 sidebar（现在只有 `StatusBar` 在用）                                                 | 配置是「唯一来源」的承诺，留死键会让人以为改了生效（改 `heroTitle` 页面不会变）；`sidebar` 这种过期命名会让人去找一个不存在的组件                                                      | 删掉无引用键；`ui.sidebar` 改名 `ui.statusBar`；health 增加一条「配置键无引用」检查，防止再长出来                                                                |
| M5  | 文案一致性      | `src/pages/article-page.tsx:21,34,83`；`src/pages/not-found-page.tsx:29,32`；`src/pages/resources-page.tsx:15,64,85,88,94,109-110`；`src/pages/profile-page.tsx:278,284`；`src/components/layout/site-header.tsx:46,74,89`     | 十余处 UI 文案（含 `aria-label`、`placeholder`、计数文案）写死在组件里；`profile-page.tsx:278` 写死「最新文章」，而配置里同位置是 `ui.profile.latestResources` = 「最新资料」 | 这套代码最强的约定就是「UI 文案进 `siteContent`」，一有例外就不成立；而且**已经发生实质分叉**（资料 / 文章）                                                                           | 把漏网文案补进 `siteContent`（含 `aria-label` / `placeholder` / 计数文案），删掉重复的旧键                                                                       |
| M6  | 样式            | `src/components/ui/card.tsx:50`（`py-(--card-spacing)`、`gap-(--card-spacing)`、`data-[size=sm]:[--card-spacing:--spacing(3)]`）、`64`、`112`、`123`                                                                           | 产物 CSS 里 `--card-spacing` **只有一处定义**，作用域是 `[data-size=sm]`；默认尺寸没有定义 ⇒ 这些 `padding / gap: var(--card-spacing)` 是无效声明（IACVT），实际按 0 处理     | `CardHeader` / `CardContent` / `CardFooter` 的默认内边距全部失效，所以 9 个调用点各写各的 `p-6` / `p-7` / `p-9`；新写一个裸 `<Card>` 会直接贴边                                        | Card 根节点补默认档 `[--card-spacing:--spacing(6)]`，`data-[size=sm]` 覆盖成 3；再把调用点里手写的 `p-*` 逐步收回                                                |
| M7  | 重复代码        | `src/pages/home-page.tsx:13`、`src/pages/profile-page.tsx:103`、`src/lib/reveal.ts:9`；`home-page.tsx:39-53` vs `profile-page.tsx:120-134`；`scripts/health-check.mjs:213-229` vs `vite-plugins/remark-post-metadata.ts:57-77` | `prefersReducedMotion()` 有**三份实现**；「双 rAF 再翻状态」的入场写法两处逐行同构；解析辅助函数在体检脚本里复制了一份                                                        | `lib/reveal.ts` 早就导出了却没被复用 ⇒ lib 的边界没被遵守；双 rAF 是踩过坑的写法，复制一份就多一个改漏的地方；复制的那份注释里自己写了「改一处要改两处」，等于把漂移写进了设计         | 统一从 `lib/reveal.ts` 导入；抽 `useEnterTransition()`（或 `useMountAnimation`）；把插件拆成 `remark-post-metadata.ts` + `post-parse.ts`，脚本直接 import 纯函数 |
| M8  | 工程化          | `eslint.config.js:11`（`files: ["**/*.{ts,tsx}"]`）、`:19`（`globals.browser`）                                                                                                                                                | `.mjs` 的体检脚本**既不 lint 也不 typecheck**（两个 tsconfig 的 `include` 都不含它）；`vite.config.ts` / `vite-plugins/*.ts` 跑在 Node 环境却拿的是 browser globals           | 唯一那个 505 行的构建 / 体检脚本是「零守卫区」；globals 配错会漏掉真正的全局变量误用                                                                                                   | 加一条 `files: ["**/*.mjs"]` + `globals.node` 的配置块；vite 侧单独一块 `globals.node`                                                                           |
| M9  | 命名 / 一致性   | `src/lib/utils.ts`（只有 `export { cn } from "cn"`）；14 个文件 `from "cn"`，3 个 `from "@/lib/utils"`（`mdx-components.tsx:5`、`table-of-contents.tsx:6`、`not-found-page.tsx:7`）                                            | 同一个 `cn` 有两个导入入口                                                                                                                                                    | 谁都能再新增第三种写法；`utils.ts` 现在零附加值，是纯转发层，读者会以为里面有定制逻辑                                                                                                  | 二选一并全局统一（建议都走 `@/lib/utils`，将来放 `formatDate` 之类有地方去）                                                                                     |

### 2.3 低

| #   | 问题类别          | 涉及文件或位置                                                                                                                                                 | 问题描述                                                                                                                           | 为什么是问题                                                                                                       | 改进方向                                                                                                                 |
| --- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| L1  | 样式 / 令牌       | `src/index.css:108`（`--radius-xl: 10px`）；`rounded-[10px]` 在 8 个文件出现 9 次，`rounded-xl` 出现 0 次                                                      | 令牌注册了但没人用，组件全部写任意值                                                                                               | 改圆角要 grep 9 处；任意值不会跟着令牌走                                                                           | 统一用 `rounded-xl`（或 `rounded-(--radius-*)`），任意值只留给真例外                                                     |
| L2  | 项目结构          | `notes/`（4 个 2026-09-20 的产品 / 设计讨论稿，已被 git 跟踪）                                                                                                 | 早期文档堆在仓库根目录，且被 `prettier --check .` 纳入检查                                                                         | 仓库根应该只有工程入口文件；它们既不是代码也不参与构建，却贡献了 4 个格式红                                        | 移到 `docs/`，或加进 `.prettierignore`；README 里给链接                                                                  |
| L3  | 死代码 / 依赖     | `src/components/ui/scroll-area.tsx`（无任何引用，health 报 INFO）；`package.json:17,26,27`（`tailwindcss` / `@tailwindcss/vite` / `shadcn` 在 `dependencies`） | 一个 60 行的未使用组件；三个构建期依赖写在运行时依赖里（`shadcn` 是 CLI，根本不该是运行时依赖）                                    | 死组件会被后来者当成可用原语直接 import（它恰好是「只给 max-h 不能滚」那个坑）；依赖分类错会让生产安装多装一堆东西 | 删 `scroll-area.tsx`；三个包移到 `devDependencies`                                                                       |
| L4  | 可维护性 / 健壮性 | `src/pages/not-found-page.tsx`（无 `useDocumentTitle`）；`src/App.tsx:9-14`（6 个页面静态导入）；全仓无 ErrorBoundary                                          | `*` 路由和 `/resources/:bad-slug` 不会正确设置 `document.title`；主 chunk 467.7 kB，页面级没有代码分割；MDX chunk 加载失败没有兜底 | 部署漏一个 chunk 就是白屏；首页要等整包（含文章页相关代码）下载完才能交互                                          | `NotFoundPage` 内部调 `useDocumentTitle`；用 `React.lazy` 包 `/resources/:slug` 与 `/works`；加最简 ErrorBoundary + 重试 |

### 2.4 其余小项

| 问题           | 位置                                 | 说明                                                                                                                           |
| -------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| 中止被当失败   | `src/hooks/use-weather.ts:134`       | `controller.abort()` 触发的 reject 也走进 `catch`，会把 `hasError` 置 true；卸载 / 切换时会把正常中止误标成「天气不可用」      |
| 缓存校验不完整 | `src/hooks/use-weather.ts:93-104`    | 只校验 `parsed.name` 和 `latitude`，`longitude` 缺失也能通过，会把 `NaN` 坐标发出去                                            |
| 定时器未清理   | `src/pages/home-page.tsx:67`         | 退场用的 `setTimeout(450)` 没有在卸载时清掉，组件提前卸载仍会 `navigate`                                                       |
| 筛选逻辑内联   | `src/pages/resources-page.tsx:32-42` | `useMemo` 里的过滤规则写在组件内，下放到 `lib/posts.ts` 更好复用、也好写单测                                                   |
| 文档与代码相反 | `README.md:15,100`                   | 仍写「暗色赛博主题是唯一主题」，实际 `2aad5fa` 已全站换浅色                                                                    |
| 零测试         | 全仓                                 | 纯静态博客可以接受，但 `lib/toc.ts`、`lib/posts.ts`、`lib/tags.ts`、`lib/person.ts` 都是纯函数，是最容易补、收益也最直接的一批 |

---

## 3. 最值得优先处理的 Top 3

### ① 修 `typecheck` 空转 + 体检假绿

**位置**：`package.json:11`、`scripts/health-check.mjs:66-82`

**理由**：其它所有质量结论都建立在「类型检查通过」上。这一条不修，任何「tsc 0 error」都不算证据，而且它是唯一一个会让人**误以为安全**的问题 —— 体检报告上明明写着 PASS。

**预期收益**：一行脚本改动 + 三行体检逻辑，`--fast` 模式立刻有真兜底，后续每次体检的 PASS 才有意义。

### ② 补 `.gitattributes` + 建格式门槛

**位置**：仓库根、`.prettierrc`、`package.json` 的 `format` 脚本

**理由**：33 个红里 19 个是纯行尾噪声，真正的 14 个格式债被埋在里面 —— 这种状态持续下去的结果就是「反正一直红，不管了」。

**预期收益**：一次 `--renormalize` 消掉 57% 的红，剩下的 14 个才需要真改；之后 `prettier --check .` 可以和 `eslint` 同级当门禁用，同时消掉 `git diff` 的 CRLF 警告。

### ③ 品牌色与文案收敛（令牌 + `siteContent`）

**位置**：`src/index.css`、`article-card.tsx`、`site-ambience.tsx`、`src/config/site.ts`、各页面

**理由**：这是「改一处」承诺的实际兑现率，而**换主题是这个项目的高频动作**（已经换过两轮）。现在换一次要改 6 处色值 + 十几个文案点，漏了不会报错。

**预期收益**：换肤从「grep 全仓」变成「改 `:root` 一段」；同时把死配置键和「最新资料 / 最新文章」这类分叉一并清掉。

---

## 4. 做得好的地方

1. **分层边界是有理由的，不是摆样子。** `lib/` 放纯逻辑（`toc` / `tags` / `person` / `posts` / `dom`），`fx/` 放 DOM 特效组件 —— 分开是因为 react-refresh 只允许组件文件导出组件，`src/lib/toc.ts:8-9` 把这个理由直接写在注释里。这种「把约束写在代码旁边」的习惯，比目录结构本身更值钱。

2. **类型与代码卫生是真的干净。** `strict` + `noUnusedLocals` / `noUnusedParameters` + `verbatimModuleSyntax`，全仓 0 处 `any`、0 处 `@ts-ignore`、0 处 `eslint-disable`、0 处 `console`（体检脚本里的除外）。个人项目能做到这个的不多。

3. **动效全部可降级，且不拿可用性换效果。** 每处动画都有 `prefers-reduced-motion` 分支；入场动画的隐藏态由 JS 加类（`.reveal-armed`）而不是写在基础样式里 —— 没有 JS / 观察器不可用时内容照样可见（`src/lib/reveal.ts:13-18`、`src/components/fx/terminal-typer.tsx:7-12`）。内容管线也是同样的思路：加一篇 = 丢一个 `.mdx`，零代码改动，frontmatter 有构建期校验，目录用真解析器算。

---

## 附录 A：Prettier 失败明细（33 个）

### A.1 纯行尾差异（19 个，加 `.gitattributes` + renormalize 即可消）

```text
.prettierrc
README.md
src/components/person-name.tsx
src/components/ui/avatar.tsx
src/components/ui/carousel.tsx
src/components/ui/scroll-area.tsx
src/components/ui/separator.tsx
src/components/ui/skeleton.tsx
src/hooks/use-document-title.ts
src/lib/person.ts
src/lib/posts.ts
src/lib/utils.ts
src/main.tsx
src/pages/home-page.tsx
src/types/post.ts
src/vite-env.d.ts
tsconfig.app.json
tsconfig.json
tsconfig.node.json
```

### A.2 真实格式差异（14 个）

```text
content/resources/ai-prompt-cards.mdx
index.html
notes/2026-09-20-blog-product-plan-grill.md
notes/2026-09-20-personal-homepage-grill.md
notes/2026-09-20-profile-editing-grill.md
notes/2026-09-20-react-shadcn-setup-grill.md
scripts/health-check.mjs
src/components/article/article-card.tsx
src/components/article/table-of-contents.tsx
src/components/layout/container.tsx
src/hooks/use-weather.ts
src/lib/dom.ts
src/lib/toc.ts
vite-plugins/remark-post-metadata.ts
```

> 注意：`article-card.tsx` 在评审时有未提交的 r19 改动，格式化请等工作落定后再动，避免和进行中的修改冲突。

---

## 附录 B：复现命令

```bash
# 类型检查（真）
node node_modules/typescript/bin/tsc -b

# 类型检查（伪 —— 退出码 0 但没有编译任何文件）
node node_modules/typescript/bin/tsc --noEmit

# 验证「空转」：0 行 vs 45 行
node node_modules/typescript/bin/tsc -p tsconfig.json    --noEmit --listFiles
node node_modules/typescript/bin/tsc -p tsconfig.app.json --noEmit --listFiles

# 代码规范
node node_modules/eslint/bin/eslint.js .
node node_modules/prettier/bin/prettier.cjs --check .

# 项目体检
node scripts/health-check.mjs --fast
```

---

## 附录 C：本次评审未覆盖 / 信息不足

- `src/components/ui/` 下除 `card.tsx` 外的 shadcn 组件（`avatar` / `button` / `badge` / `carousel` / `sheet` / `input` / `separator` / `skeleton`）只核查了「改动面 / 是否被业务逻辑侵入」，**未逐行评审**。要补需明确指定文件。
- `content/resources/*.mdx` 的正文写作质量、图片体积与压缩率不在本次范围。
- 部署链路（`scp` / 远端 nginx 配置）不在本次范围，只从 `dist/` 产物侧看了体积。

## 附录 D：不需要做的事

按项目实际技术栈，以下**不建议引入**：

- 状态管理库（Redux / Zustand）：全局状态只有路由和一两处 UI 态，`posts` 是构建期数据。
- 请求库（axios / React Query）：全站只有 `use-weather.ts` 一处 `fetch`，且带 `AbortController` 与运行时校验，已经够用。
- CSS-in-JS / CSS Modules：Tailwind v4 + `@layer components` 已经承担了全部职责，令牌也集中在 `index.css`。
- SSR / SSG 框架：当前是纯静态 SPA，内容在构建期就确定了，迁移收益低于成本。
