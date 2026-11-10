# 学习日志

面向 Python 与 AI 初学者的个人技术知识库。

线上地址：<https://learnailab.cn>

## 已完成

- `/` 单屏入口首页（下滑或点箭头进入博客）
- `/profile` 博客主页：个人名片、音乐卡（占位）、歌词条（占位）、轮播、最新文章、时间天气条
- `/resources` 文章列表：分类筛选 + 标题/标签/正文搜索 + 空状态
- `/resources/:slug` 文章详情：MDX 正文、代码高亮、提示卡片、左侧目录（滚动高亮）
- `/works` 项目页与空状态
- `/journal` 日记：一页聚合，无详情路由
- 未知路径落到 404 页（自带 `document.title`）
- 页面级兜底：渲染异常或页面代码没下载下来时给「重新加载 / 返回首页」，不留白屏
- 浅色极简主题（白底 + 黑字 + 品牌蓝），暗色赛博主题已废弃、深浅色切换已移除

## 前端技术栈

- Vite + React + TypeScript
- Tailwind CSS v4（CSS-first，设计令牌全在 `src/index.css`，没有 config 文件）
- shadcn/ui（Radix 风格）
- React Router
- MDX（`@mdx-js/rollup`）+ rehype-pretty-code + Shiki

## 本地开发

```bash
npm install
npm run dev
```

然后打开 `http://localhost:5173/`。

## 添加文章

在 `content/resources/` 中创建 `.mdx` 文件。文件名会成为文章 URL，例如
`python-basics.mdx` 对应 `/resources/python-basics`。

```mdx
---
title: "文章标题"
description: "一句话摘要"
date: "2026-09-20"
category: "Python"
tags:
  - "Python"
  - "入门"
draft: false
---

## 第一节

正文内容。
```

几点必须注意（踩过坑）：

- `date` **要加引号**，否则 YAML 会把它解析成日期对象；
- 正文里的 `{` `}` 必须写成 `\{` `\}`（表格里也一样），否则 MDX 会当成表达式直接构建失败；
- 代码块**必须标语言**，不标就不会着色，还会把页面撑坏；
- 正文从 `##` 起（页面已经渲染了 h1）；
- 中文里要加粗时，标点放在 `**` 外面：写 `**数据范围**：……`，不要写 `**数据范围：**……`。

可在正文中使用 `<Note title="提示">...</Note>`。二级、三级标题会自动进入目录；`draft: true` 的文章不会出现在列表和详情里。

## 添加日记

在 `content/journal/` 中创建 `.mdx`，frontmatter 只需要 `date`（`YYYY-MM-DD`，必填），可选 `mood`。
新增文件即生效，无需注册；缺 `date` 会在构建期直接报错。

## 添加 shadcn/ui 组件

组件按需加入项目，例如：

```bash
npx shadcn@latest add card
```

生成的通用界面组件位于 `src/components/ui/`，通过 `@/components/ui/*` 导入。
⚠️ 这一层要保持「能整体重新生成」：不要在这里 import 本站的 `lib/`，也不要在里面挂业务逻辑
（需要鼠标特效的卡片用 `src/components/fx/tilt-card.tsx`）。

## 检查与构建

```bash
npm run lint
npm run typecheck
npm run format:check
npm run build
```

### 项目体检（提交前把关）

```bash
npm run health            # 全量体检：typecheck + lint + format + build + 若干静态检查
npm run health -- --fast  # 跳过构建，只跑静态检查
npm run health -- --json  # 输出 JSON，供 CI / 自动化消费
```

除了上面几个命令，体检还会额外核对：`src/` 引用的静态资源是否真的存在于 `public/`、
文章 frontmatter 与 slug 是否合法、文章结构（代码围栏是否闭合、同级标题是否重名，
用的是与渲染一致的解析器）、`src/components/ui/` 下有没有无人引用的死组件（INFO，不阻断）、
`public/` 下有没有无人引用的文件、`siteContent` 里的配置键是否都有人用，并汇报产物体积。
有 FAIL 时退出码为 1。

本机已把 git hooks 指向 `.githooks/`（`core.hooksPath` 是本地配置，换台机器要重跑）：

```bash
git config core.hooksPath .githooks
```

装好之后每次 `git commit` 都会先跑一遍体检（含生产构建），有 FAIL 直接中止提交。
确需跳过用 `git commit --no-verify`。

## 部署

目前是手动部署，没有 CI：

1. `npm run build` 产出 `dist/`；
2. 用 `scp` 把 `dist/` 里的内容同步到服务器的站点目录；
3. 在线上跑一遍浏览器复测（`scp` 只增不删，旧的哈希文件需要手动清理或移入备份目录）。

## 主题现状

浅色极简是**唯一主题**。设计令牌集中在 `src/index.css`：白底、`#18181b` 主文字、`#2563eb` 品牌蓝
（链接 / 进度条 / 光标），按钮用近黑 `#18181b`。改色只改令牌，不要在组件里写裸色值。
