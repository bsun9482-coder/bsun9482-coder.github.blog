# 学习日志

面向 Python 与 AI 初学者的本地技术知识库 MVP。

## 已完成

- 首页、顶部导航与响应式移动菜单
- 按时间倒序的资料列表
- 标题、标签与正文搜索
- 分类筛选与空状态
- MDX 资料详情、代码高亮、提示卡片与目录
- `/works` 作品页面与空状态
- 独立的 `/` 入口首页与 `/resources` 资料页
- `/profile` 博客主页与占位资料
- 暗色赛博主题（唯一主题，深浅色切换已移除）

## 前端技术栈

- Vite + React + TypeScript
- Tailwind CSS v4
- shadcn/ui（Radix Nova 风格）
- React Router
- MDX + Shiki

## 本地开发

```bash
npm install
npm run dev
```

然后打开 `http://localhost:5173/`。

## 添加资料

在 `content/resources/` 中创建 `.mdx` 文件。文件名会成为资料 URL，例如
`python-basics.mdx` 对应 `/resources/python-basics`。

```mdx
---
title: "资料标题"
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

可在正文中使用 `<Note title="提示">...</Note>`。二级、三级标题会自动进入资料目录；草稿资料设置 `draft: true`。

## 添加 shadcn/ui 组件

组件按需加入项目，例如：

```bash
npx shadcn@latest add card
```

生成的通用界面组件位于 `src/components/ui/`，通过 `@/components/ui/*` 导入。

## 检查与构建

```bash
npm run lint
npm run typecheck
npm run build
```

### 项目体检（提交前把关）

```bash
npm run health            # 全量体检：typecheck + lint + build + 四类静态检查
npm run health -- --fast  # 跳过构建，只跑静态检查
npm run health -- --json  # 输出 JSON，供 CI / 自动化消费
```

除了上面三个命令，体检还会额外核对：`src/` 里引用的静态资源是否真的存在于 `public/`、
文章 frontmatter 与 slug 是否合法、文章结构（代码围栏是否闭合、目录同级标题是否重名，
用与渲染一致的解析器判定）、`src/components/ui/` 下有没有无人引用的死组件（INFO，不阻断），
并汇报产物体积。有 FAIL 时退出码为 1。

本机已把 git hooks 指向 `.githooks/`（`core.hooksPath` 是本地配置，换台机器要重跑）：

```bash
git config core.hooksPath .githooks
```

装好之后每次 `git commit` 都会先跑一遍 `npm run health`（含生产构建），有 FAIL 直接中止提交。
确需跳过用 `git commit --no-verify`。

## 部署与主题现状

- 暗色（赛博 AI 风）是**唯一主题**，深浅色切换已移除。
- 部署平台尚未确定，仓库暂无 CI 配置。

当前版本只负责本地内容与阅读体验，部署平台、正式视觉方案和 SEO 留到后续阶段决定。
