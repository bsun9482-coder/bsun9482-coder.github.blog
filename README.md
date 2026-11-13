# 学习日志

面向 Python 与 AI 初学者的个人技术知识库。

线上地址：<https://learnailab.cn>

## 已完成

- `/` 单屏入口首页（下滑或点箭头进入博客）
- `/profile` 博客主页：个人名片、音乐卡（占位）、歌词条（占位）、轮播、最新文章、时间天气条
- `/resources` 文章列表：分类筛选 + 标题/标签/正文搜索 + 空状态
- `/resources/:slug` 文章详情：Markdown 正文（运行时渲染）、代码高亮、表格、图片、左侧目录（滚动高亮）
- `/works` 项目页与空状态
- `/journal` 日记：一页聚合，无详情路由
- `/admin` 后台：文章列表 / 新建 / 编辑、日记管理、编辑器内上传插图（登录后可见）
- 未知路径落到 404 页（自带 `document.title`）
- 页面级兜底：渲染异常或页面代码没下载下来时给「重新加载 / 返回首页」，不留白屏
- 浅色极简主题（白底 + 黑字 + 品牌蓝），暗色赛博主题已废弃、深浅色切换已移除

## 技术栈

前端：

- Vite + React + TypeScript
- Tailwind CSS v4（CSS-first，设计令牌全在 `src/index.css`，没有 config 文件）
- shadcn/ui（Radix 风格）
- React Router
- react-markdown + remark-gfm + rehype-highlight（正文在浏览器里现渲染，**构建期不再解析文章**）

后端（`backend/`，FastAPI + SQLite）：

- 文章 `/api/posts`、日记 `/api/journals`、图片上传 `/api/upload`、登录 `/api/auth`
- 写操作要 JWT 登录，读操作公开
- 正文和元数据都存在 `backend/data/app.db`，图片存在 `backend/uploads/`

## 本地开发

前端和后台要走起来，需要**两个终端**：

```bash
# 终端 1：后端（127.0.0.1:8000）
cd backend
pip install -r requirements.txt
cp .env.example .env          # 然后改掉里面的 SECRET_KEY
python create_admin.py        # 建一个管理员账号（只需一次）
uvicorn main:app --reload

# 终端 2：前端（127.0.0.1:5173）
npm install
npm run dev
```

然后打开 `http://localhost:5173/`。后台在 `http://localhost:5173/admin`。
开发期 `/api` 和 `/uploads` 都由 vite 代理转到 8000，不用配 CORS。

## 写文章 / 写日记

都在后台写：`/admin` 写文章，`/admin/journal` 写日记。**不再需要创建文件、也不用重新构建**，
保存后前台刷新就能看到。

写作时注意几点（都是踩过的坑）：

- 代码块**必须标语言**（` ```python `），不标就不会着色；
- 正文从 `##` 起（页面已经渲染了 h1）；
- 中文里要加粗时，标点放在 `**` 外面：写 `**数据范围**：……`，不要写 `**数据范围：**……`；
- 图片可以直接拖进编辑区，或点工具栏最右边的图片按钮 —— 会自动插入并上传到 `backend/uploads/`；
- 存成草稿的文章不会出现在公开列表和详情里。

> 历史说明：2026-11-13 之前文章是 `content/resources/*.mdx`、日记是 `content/journal/*.mdx`，
> 由构建期的 MDX 编译进包里。第 38 轮把这套链路整条删掉了（数据已迁到数据库），
> 需要旧文件时从 git 历史里取：`git show 31f29c8:content/resources/ai-prompt-cards.mdx`。

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
**数据库里**的文章字段是否完整、正文引用的 `/images/*` 与 `/uploads/*` 是否都能落到文件（裂图检查）、
文章结构（代码围栏是否闭合、同级标题是否重名，用的是与渲染一致的解析器）、
`src/components/ui/` 下有没有无人引用的死组件（INFO，不阻断）、
`public/` 下有没有无人引用的文件、`siteContent` 里的配置键是否都有人用，并汇报产物体积。
有 FAIL 时退出码为 1。

本机已把 git hooks 指向 `.githooks/`（`core.hooksPath` 是本地配置，换台机器要重跑）：

```bash
git config core.hooksPath .githooks
```

装好之后每次 `git commit` 都会先跑一遍体检（含生产构建），有 FAIL 直接中止提交。
确需跳过用 `git commit --no-verify`。

## 部署

线上是**两个进程 + 一个 nginx**，共用 `learnailab.cn` 的 443 端口。浏览器眼里只有一个域名，
nginx 按路径把请求分流（这就是「反向代理」）：

```
浏览器 ──https──▶ nginx(443)
                   ├── /            → /var/www/blog 里的静态文件（React 打包产物）
                   ├── /api/        → 转发给 127.0.0.1:8000（FastAPI，systemd 守护）
                   └── /uploads/    → 直接读 /var/www/blog-backend/uploads 里的图片
```

| 东西     | 服务器路径                          | 说明                                   |
| -------- | ----------------------------------- | -------------------------------------- |
| 前端产物 | `/var/www/blog`                     | nginx 直接发文件，不经过任何进程       |
| 后端代码 | `/var/www/blog-backend`             | `.venv` + 代码 + `.env`（`chmod 600`） |
| 数据库   | `/var/www/blog-backend/data/app.db` | SQLite 单文件，**不进 git**            |
| 上传的图 | `/var/www/blog-backend/uploads/`    | **不进 git**，由 `backup.sh` 一起备份  |
| 备份     | `/var/www/blog-backup/`             | cron 每天 03:30，留 7 天               |

服务器：Ubuntu 24.04 / Python 3.12 / nginx 1.24；SSH 用 `~/.ssh/wb_deploy_learnailab`。

> **推代码不会让线上更新**（没有 CI，这是刻意为之）：`git push` 只是把代码放进仓库，
> 线上跑的是服务器上那份文件。每次都得手动走下面的步骤。

### 前端（改了页面、样式、文案）

```bash
npm run build                                            # 产出 dist/
ssh ... "sudo mkdir -p /var/www/blog.new && sudo chown ubuntu:ubuntu /var/www/blog.new"
scp -r dist/. ubuntu@<服务器>:/var/www/blog.new/         # 先放到新目录
ssh ... "sudo mv /var/www/blog /var/www/blog.old-$(date +%s) && sudo mv /var/www/blog.new /var/www/blog"
npm run deploy:status                                    # 逐文件 sha256 对账
```

**为什么不直接覆盖旧目录**：`mv` 换名是瞬间完成的，不会有「删了一半、用户正好访问」的中间态；
旧目录留着，出问题一条 `mv` 就回滚。

`deploy:status` 是回答「我明明传了，网站怎么还是老的」这个问题的：它把线上的文件逐个下载算
sha256，和本地 `dist` 比，不一致会指名道姓说是哪个文件对不上。退出码 0 = 一致，1 = 不一致。
也可以拿来验本地 preview：`npm run deploy:status -- --url http://127.0.0.1:4173`。

### 后端（改了接口、字段、依赖）

```bash
scp -r backend/. ubuntu@<服务器>:/var/www/blog-backend/   # ⚠️ 别覆盖 .env / data / uploads
ssh ... "cd /var/www/blog-backend && .venv/bin/pip install -r requirements.txt"
ssh ... "sudo systemctl restart blog-backend"
ssh ... "sudo journalctl -u blog-backend -n 50 --no-pager"   # 看有没有起来
```

改完 `.env` 也要 `restart`（配置只在启动时读一次）。

### 出问题时按这个顺序查（一步排除一层）

1. `curl -s 127.0.0.1:8000/api/health` —— 本机通不通？**不通是后端的事**，看
   `sudo journalctl -u blog-backend -n 80`。
2. `curl -s https://learnailab.cn/api/health` —— 公网通不通？**本机通、公网不通是 nginx 的事**，
   看 `sudo nginx -t` 和 `sudo tail /var/log/nginx/error.log`。
3. 页面能打开但数据空 —— 按 F12 看 Network：`/api/...` 是不是 4xx/5xx，还是被浏览器拦了（CORS）。
4. 图片碎 —— 直接访问那张图的 `/uploads/xxx.png`：404 说明文件没传上去；403 是目录权限。

### 两个已经踩过的坑

- **nginx 的 `client_max_body_size` 默认只有 1MB**，而后端允许 5MB 的图。不改成 `6m`，
  后台上传大图会看到 nginx 的 413 页面，特别容易被误判成「后端坏了」。
- **`location` 必须写 `^~ /api/`**。这个配置里还有一条「按扩展名走静态文件」的正则 location，
  正则的优先级高于普通前缀匹配；不加 `^~`，`/api/xxx.json` 会被静态规则抢走变成 404。

## 主题现状

浅色极简是**唯一主题**。设计令牌集中在 `src/index.css`：白底、`#18181b` 主文字、`#2563eb` 品牌蓝
（链接 / 进度条 / 光标），按钮用近黑 `#18181b`。改色只改令牌，不要在组件里写裸色值。
