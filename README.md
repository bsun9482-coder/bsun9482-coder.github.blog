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
- `/community` 社区交流占位页面
- `/profile` 博客主页、占位资料与登录入口
- 明暗主题切换

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

当前版本只负责本地内容与阅读体验，部署平台、正式视觉方案和 SEO 留到后续阶段决定。
