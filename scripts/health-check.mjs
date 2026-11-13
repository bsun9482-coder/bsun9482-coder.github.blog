#!/usr/bin/env node
/**
 * 项目体检脚本 —— 覆盖 typecheck / lint / build 之外、它们抓不到的那几类问题。
 *
 * 用法：
 *   npm run health              # 全量体检（含生产构建）
 *   npm run health -- --fast    # 跳过构建，只跑静态检查
 *   npm run health -- --json    # 输出机器可读 JSON（给自动化 / CI 用）
 *
 * 退出码：0 = 全部通过；1 = 存在 FAIL。
 */

import { execFileSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import process from "node:process"
import { DatabaseSync } from "node:sqlite"

import remarkGfm from "remark-gfm"
import remarkParse from "remark-parse"
import { unified } from "unified"

/* 第 38 轮之前，文章是 content/resources/*.mdx 文件，这个脚本直接读文件校验。
   现在文章存在 SQLite 里（backend/data/app.db），所以「文章内容」「文章结构」两项
   改成查库 —— 否则文件删掉之后，这两项会对着空目录返回 PASS，
   体检报告看着全绿，其实什么都没检查。那种「假通过」比没有检查更危险。 */
const DB_PATH = path.join(
  import.meta.dirname,
  "..",
  "backend",
  "data",
  "app.db"
)

const ROOT = path.resolve(import.meta.dirname, "..")
const args = process.argv.slice(2)
const FAST = args.includes("--fast")
const JSON_OUT = args.includes("--json")

const results = []
const record = (level, area, message, detail) =>
  results.push({ level, area, message, detail })

/* ---------- 通用小工具 ---------- */

function walk(dir, predicate, out = []) {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, predicate, out)
    else if (predicate(full)) out.push(full)
  }
  return out
}

const toPosix = (p) => p.split(path.sep).join("/")
const rel = (p) => toPosix(path.relative(ROOT, p))

function runNpmScript(name) {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm"
  try {
    const stdout = execFileSync(npm, ["run", name], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
    })
    return { ok: true, output: stdout }
  } catch (error) {
    return {
      ok: false,
      output: `${error.stdout ?? ""}${error.stderr ?? ""}`.trim(),
    }
  }
}

/* ---------- 检查 0：typecheck 的调用方式本身是否有效 ---------- */

/* 根 tsconfig.json 是「解决方案文件」（files: [] + 只有 references），它自己不含任何
   源文件。不带 -b 时 tsc 只读这个空壳，编译 0 个文件、永远退出 0 —— 等于没检查。
   实测：--listFiles 对根配置输出 0 行，对 tsconfig.app.json 输出 252 行。
   守这里而不是守「结果」，是因为一旦写法错了，下面所有 PASS 都失去了意义。 */
function checkTypecheckContract() {
  const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"))
  const script = pkg.scripts?.typecheck ?? ""
  const usesBuildMode = /(^|\s)(-b|--build)(\s|$)/.test(script)

  if (usesBuildMode) {
    record("PASS", "类型检查契约", `typecheck 走 build 模式（${script}）`)
    return
  }

  record(
    "FAIL",
    "类型检查契约",
    `typecheck 没有走 build 模式（当前：${script || "未定义"}）`,
    [
      "根 tsconfig.json 不含任何源文件，这样调用会编译 0 个文件并永远通过",
      "改回 tsc -b --noEmit（TS 5.x 早期不支持 --noEmit 与 -b 同用，退化成 tsc -b）",
    ].join("\n")
  )
}

/* ---------- 检查 1：typecheck / lint / format / build ---------- */

function checkScripts() {
  const targets = [
    ["typecheck", "TypeScript 类型检查"],
    ["lint", "ESLint 代码规范"],
    /* 格式也当门禁：format 是「改」，format:check 是「查」，两个脚本的覆盖范围都是全仓，
       和 prettier --check . 这个裁判完全一致 —— 以前 format 只覆盖 ts/tsx 两类文件，
       跑完 format 仍然是红的，等于没有。 */
    ["format:check", "代码格式"],
  ]
  if (!FAST) targets.push(["build", "生产构建"])

  for (const [script, label] of targets) {
    const { ok, output } = runNpmScript(script)
    if (ok) {
      record("PASS", label, `npm run ${script} 通过`)
    } else {
      const tail = output.split("\n").filter(Boolean).slice(-12).join("\n")
      record("FAIL", label, `npm run ${script} 失败`, tail)
    }
  }
}

/* ---------- 检查 2：静态资源引用 → 真实文件 ---------- */

/* 只认"像文件路径"的以 / 开头的字面量（带扩展名），
   这样 /profile、/resources 这类路由不会被误报成缺失资源。 */
const ASSET_REF =
  /(?:src|url|avatarUrl|href|srcSet)\s*:\s*"(\/[^"]*\.[a-z0-9]{2,5})"/gi

function checkAssetReferences() {
  const sources = walk(
    path.join(ROOT, "src"),
    (f) => f.endsWith(".ts") || f.endsWith(".tsx")
  )
  const missing = []

  for (const file of sources) {
    const text = readFileSync(file, "utf8")
    for (const match of text.matchAll(ASSET_REF)) {
      const url = match[1]
      const onDisk = path.join(ROOT, "public", url.slice(1))
      if (!existsSync(onDisk)) {
        missing.push({ url, definedIn: rel(file) })
      }
    }
  }

  if (missing.length === 0) {
    record("PASS", "静态资源引用", "所有引用的资源都能在 public/ 中找到")
  } else {
    for (const item of missing) {
      record(
        "FAIL",
        "静态资源引用",
        `${item.url} 在 public/ 中不存在（定义于 ${item.definedIn}）`,
        "运行时会 404，相关 UI 会走进错误分支"
      )
    }
  }
}

/* ---------- 检查 3：数据库里的文章内容 ---------- */

/* 第 38 轮之前文章是 content/resources/*.mdx 文件，这里直接读文件校验 frontmatter。
   现在文章存在 SQLite（backend/data/app.db），所以改成查库。
   ⚠️ 为什么非要改：文件删掉之后，原来那段代码会对着空目录数出 0 个文件、
      然后开心地打一个 PASS —— 报告全绿，其实一个字都没检查。假通过比没检查更糟。 */

const REQUIRED_STRING_FIELDS = ["title", "category"]

/* 正文里引用的本地资源。三种写法都抓：
     ![说明](/images/a.webp)   Markdown 图片
     <img src="/images/a.webp">  HTML 图片
     [点这里](/images/a.webp)   普通链接（下载资料也会这么写）
   宁可多抓几个（比如正文里举例提到的路径），也不想漏掉真会 404 的那种。 */
const LOCAL_ASSET_REF = /["'(](\/(?:images|uploads)\/[^"')\s)]+)/g

/* 数据库句柄开一次就够。ESM 是单例，模块级变量在进程里只有一份。 */
let cachedDb

function getDb() {
  if (cachedDb !== undefined) return cachedDb

  if (!existsSync(DB_PATH)) {
    cachedDb = null
    return cachedDb
  }

  try {
    /* readOnly：体检脚本绝不该写生产数据。真写坏了，等于体检把病人弄伤。 */
    cachedDb = new DatabaseSync(DB_PATH, { readOnly: true })
  } catch (error) {
    record(
      "WARN",
      "文章内容",
      "数据库打不开，跳过库内检查",
      String(error?.message ?? error)
    )
    cachedDb = null
  }
  return cachedDb
}

function loadPosts() {
  const db = getDb()
  if (!db) return null
  try {
    return db
      .prepare(
        "select id, slug, title, description, category, tags, is_draft, content from posts order by id"
      )
      .all()
  } catch (error) {
    record(
      "WARN",
      "文章内容",
      "posts 表读不出来",
      String(error?.message ?? error)
    )
    return null
  }
}

function checkContent() {
  const posts = loadPosts()
  if (posts === null) {
    record(
      "WARN",
      "文章内容",
      "还没有数据库（backend/data/app.db），跳过库内检查",
      "先把后端跑起来（cd backend && uvicorn main:app），或用 import_mdx.py 迁移数据"
    )
    return
  }
  if (posts.length === 0) {
    record("WARN", "文章内容", "posts 表是空的，没有任何文章")
    return
  }

  let problems = 0

  for (const post of posts) {
    const where = `posts#${post.id}（${post.slug}）`

    for (const field of REQUIRED_STRING_FIELDS) {
      const value = post[field]
      if (typeof value !== "string" || value.trim() === "") {
        record("FAIL", "文章内容", `${where} 的 ${field} 是空的`)
        problems++
      }
    }

    if (!post.content || post.content.trim() === "") {
      record("FAIL", "文章内容", `${where} 的正文是空的`)
      problems++
    }

    /* 数据库里的 tags 是一列 JSON 文本（SQLAlchemy 的 JSON 类型），
       解析一次才知道它到底存了几个标签。存坏了会直接抛异常，正好当校验用。 */
    try {
      const tags = JSON.parse(post.tags ?? "[]")
      if (!Array.isArray(tags) || tags.some((tag) => typeof tag !== "string")) {
        record("FAIL", "文章内容", `${where} 的 tags 不是字符串数组`)
        problems++
      }
    } catch {
      record("FAIL", "文章内容", `${where} 的 tags 不是合法 JSON`)
      problems++
    }

    /* 裂图检查：正文里每一条 /images/... 和 /uploads/... 都得能落到真实文件。
       这是这一项里最值钱的一条 —— 图片文件被误删、路径打错，都会在这里现形。
       分成两个目录找：
         /images/...  → public/images/...   （随前端一起部署）
         /uploads/... → backend/uploads/... （用户在后台上传的） */
    for (const match of post.content.matchAll(LOCAL_ASSET_REF)) {
      const url = match[1]
      const onDisk = url.startsWith("/uploads/")
        ? path.join(ROOT, "backend", url.slice(1))
        : path.join(ROOT, "public", url.slice(1))

      if (!existsSync(onDisk)) {
        record(
          "FAIL",
          "文章内容",
          `${where} 引用的 ${url} 找不到文件`,
          `期望在 ${rel(onDisk)}，页面上会显示成裂图`
        )
        problems++
      }
    }
  }

  if (problems === 0) {
    record(
      "PASS",
      "文章内容",
      `${posts.length} 篇文章字段完整，正文里的图片引用都能落到文件`
    )
  }
}

/* ---------- 检查 4：文章结构（围栏闭合 / 目录标题重名） ---------- */

/* 用 remark 真解析一遍每篇正文，而不是拿正则扫行：
   代码块里的 `##` 不是标题、列表里缩进的 ``` 仍是围栏 —— 手写规则永远差一点点，
   差的那一点会变成「体检说没问题，目录却点不动」。
   （remark-parse + remark-gfm 本来就是 react-markdown 的依赖，这里没有新增安装包。） */
const markdownProcessor = unified().use(remarkParse).use(remarkGfm)

function walkNodes(node, visit) {
  visit(node)
  if (Array.isArray(node.children))
    for (const child of node.children) walkNodes(child, visit)
}

function headingText(node) {
  if (node.type === "text" || node.type === "inlineCode")
    return node.value ?? ""
  if (!Array.isArray(node.children)) return ""
  return node.children.map(headingText).join("")
}

/* 只收 h2 / h3：正文目录只列这两级（h1 是文章标题，h4 以下太碎）。
   脚注区整块跳过 —— 它是渲染时另起的一块，里面的标题进目录只会添乱。 */
function collectHeadings(node, out) {
  if (node.type === "footnoteDefinition") return
  if (node.type === "heading" && (node.depth === 2 || node.depth === 3)) {
    out.push(node)
    return
  }
  if (Array.isArray(node.children))
    for (const child of node.children) collectHeadings(child, out)
}

function checkArticleStructure() {
  const posts = loadPosts()
  if (!posts || posts.length === 0) return

  let problems = 0

  for (const post of posts) {
    const raw = post.content ?? ""
    if (!raw.trim()) continue

    const where = `posts#${post.id}（${post.slug}）`

    let tree
    try {
      tree = markdownProcessor.parse(raw)
    } catch (error) {
      record(
        "FAIL",
        "文章结构",
        `${where} 解析失败`,
        String(error?.message ?? error)
      )
      problems++
      continue
    }

    /* 围栏没闭合时，解析器会产出一个一直延伸到正文末尾的代码节点。
       所以「代码节点结束于最后一行」是可疑信号 —— 但要排除「最后一行正好是闭合围栏」
       这种正常情况：拿代码块自己的首尾两行比一下，闭合围栏得是同种字符且不短于开启。 */
    const lines = raw.split(/\r?\n/)
    let lastContentLine = lines.length
    while (lastContentLine > 0 && lines[lastContentLine - 1].trim() === "")
      lastContentLine--

    const FENCE_ONLY = /^[ \t]*(`{3,}|~{3,})[ \t]*$/
    const FENCE_ANY = /^[ \t]*(`{3,}|~{3,})/

    let unclosed = false
    walkNodes(tree, (node) => {
      if (node.type !== "code" || !node.position) return
      const endLine = node.position.end.line
      if (endLine < lastContentLine) return

      /* 围栏可能挂在容器标记后面（`> ``` `、`- ``` `），直接拿原始行匹配会认不出来，
         于是误报「未闭合」。position.start.column 给的是围栏自身那一列，
         从那里切掉容器前缀再比。 */
      const cut = node.position.start.column - 1
      const open = (lines[node.position.start.line - 1] ?? "")
        .slice(cut)
        .match(FENCE_ANY)
      const close = (lines[endLine - 1] ?? "").slice(cut).match(FENCE_ONLY)
      const closed =
        open &&
        close &&
        close[1][0] === open[1][0] &&
        close[1].length >= open[1].length
      if (!closed) unclosed = true
    })

    if (unclosed) {
      record(
        "FAIL",
        "文章结构",
        `${where} 有未闭合的代码围栏`,
        "之后的内容会被整段当成代码，正文与目录一起失效"
      )
      problems++
    }

    const headings = []
    collectHeadings(tree, headings)

    const seen = new Set()
    for (const node of headings) {
      const level = node.depth
      const title = headingText(node).trim()
      if (title === "") continue

      const key = `${level}:${title}`
      if (seen.has(key)) {
        record(
          "WARN",
          "文章结构",
          `${where} 有重复的 ${"#".repeat(level)} 标题「${title}」`,
          "目录里会出现两条同名项，读者分不清点哪个"
        )
        problems++
      }
      seen.add(key)
    }
  }

  if (problems === 0) {
    record("PASS", "文章结构", "围栏闭合、同级标题无重名")
  }
}

/* ---------- 检查 5：未被引用的 UI 组件（死代码） ---------- */

function checkUnusedUiComponents() {
  const uiDir = path.join(ROOT, "src", "components", "ui")
  if (!existsSync(uiDir)) return

  const allSources = walk(
    path.join(ROOT, "src"),
    (f) => f.endsWith(".ts") || f.endsWith(".tsx")
  )
  const unused = []

  for (const file of readdirSync(uiDir).filter((f) => f.endsWith(".tsx"))) {
    const stem = file.slice(0, -4)
    const referenced = allSources.some(
      (src) =>
        src !== path.join(uiDir, file) &&
        readFileSync(src, "utf8").includes(`components/ui/${stem}"`)
    )
    if (!referenced) unused.push(`src/components/ui/${file}`)
  }

  if (unused.length === 0) {
    record("PASS", "UI 组件", "src/components/ui/ 下无未引用组件")
  } else {
    record(
      "INFO",
      "UI 组件",
      `${unused.length} 个组件未被任何页面引用`,
      unused.join("\n")
    )
  }
}

/* ---------- 检查 6：产物体积 ---------- */

function checkBundleSize() {
  const assets = path.join(ROOT, "dist", "assets")
  if (!existsSync(assets)) {
    record("INFO", "产物体积", "尚未构建，跳过")
    return
  }

  const js = readdirSync(assets).filter((f) => f.endsWith(".js"))
  const css = readdirSync(assets).filter((f) => f.endsWith(".css"))
  const total = [...js, ...css]
    .map((f) => statSync(path.join(assets, f)).size)
    .reduce((a, b) => a + b, 0)
  const kb = (n) => `${(n / 1024).toFixed(1)} kB`

  const biggest = js
    .map((f) => ({ f, size: statSync(path.join(assets, f)).size }))
    .sort((a, b) => b.size - a.size)[0]

  record(
    "INFO",
    "产物体积",
    `JS ${js.length} 个 / CSS ${css.length} 个，合计 ${kb(total)}`,
    biggest ? `最大 chunk：${biggest.f}（${kb(biggest.size)}）` : undefined
  )
}

/* ---------- 检查 7：public/ 下没人用的文件 ---------- */

/* public/ 里的东西会被原样拷进 dist 一起部署，所以「全仓库没人引用」= 白占带宽。
   判定方式是拿文件名去全仓库文本里搜，排除 node_modules / dist / .git / .workbuddy
   以及 public 自身 —— 否则文件自己的路径就能匹配上，永远判不出孤儿。

   ⚠️ 第 38 轮补的一条：文章正文现在存在数据库里，不再躺在仓库文件中。
      只搜仓库文本的话，文章插图会全部被判成「没人引用」——
      明明每张图都被两篇文章用着，报告却说它们是孤儿。
      所以把库里所有正文也拼进搜索样本（这是「数据也是引用来源」的一次性承认）。 */
const TEXT_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|html|css|md|mdx|ya?ml|txt)$/
const SEARCH_SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".git",
  ".workbuddy",
  ".workbuddy-ai",
  "public",
])
const MAX_TEXT_BYTES = 200_000

function collectRepoText(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SEARCH_SKIP_DIRS.has(entry.name)) continue
      collectRepoText(path.join(dir, entry.name), acc)
      continue
    }
    if (!TEXT_EXT.test(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (statSync(full).size > MAX_TEXT_BYTES) continue
    acc.push(readFileSync(full, "utf8"))
  }
  return acc
}

function checkOrphanPublicAssets() {
  const publicDir = path.join(ROOT, "public")
  if (!existsSync(publicDir)) return

  const files = walk(publicDir, () => true).filter(
    (f) => path.basename(f) !== ".gitkeep"
  )
  if (files.length === 0) return

  /* 仓库文本 + 数据库里的正文。db 可能不存在（没跑过后端），那就只有仓库文本。 */
  const dbContents = (loadPosts() ?? []).map((post) => post.content ?? "")
  const haystack = [...collectRepoText(ROOT), ...dbContents].join("\n")
  const orphans = files
    .filter((f) => !haystack.includes(path.basename(f)))
    .map((f) => rel(f))

  if (orphans.length === 0) {
    record("PASS", "静态资源冗余", `public/ 下 ${files.length} 个文件都有引用`)
  } else {
    record(
      "INFO",
      "静态资源冗余",
      `${orphans.length} 个文件无人引用，仍会被部署`,
      orphans.join("\n")
    )
  }
}

/* ---------- 检查 8：favicon ---------- */

/* 页面没声明图标时，浏览器会自动去请求 /favicon.ico，拿不到就留一条 404。
   不影响功能，所以判 WARN 而不是 FAIL。 */
function checkFavicon() {
  const htmlPath = path.join(ROOT, "index.html")
  if (!existsSync(htmlPath)) return

  const html = readFileSync(htmlPath, "utf8")
  const declared =
    /<link[^>]+rel=["'](?:shortcut icon|icon|apple-touch-icon)["']/i.test(html)
  const hasIco = existsSync(path.join(ROOT, "public", "favicon.ico"))

  if (declared || hasIco) {
    record("PASS", "favicon", "已声明图标或存在 public/favicon.ico")
  } else {
    record(
      "WARN",
      "favicon",
      "index.html 未声明图标，public/ 也没有 favicon.ico",
      "浏览器会自动请求 /favicon.ico，每次页面加载都会留一条 404"
    )
  }
}

/* ---------- 检查 9：配置键是否真的有人用 ---------- */

/* 配置是「文案唯一来源」这个承诺的载体。留一个没人引用的键，比不写它更糟：
   改它页面不会有任何变化，读代码的人会以为自己找对了地方。
   实测曾经 77 个键里有 9 个是死的（改 ui.profile.heroTitle 毫无反应）。

   判定拿完整路径 siteContent.a.b.c 去搜，而不是只搜末段键名 —— 后者会被同名键干扰：
   title / description / label 这类键名到处都是，按名字搜永远「有引用」。
   本仓库所有取值都写成 siteContent.x.y.z（siteContent 没有被解构过），所以路径匹配是精确的。

   数组整体算一个键（如 profileSlides），数组元素里的字段不单独检查；
   确实要保留暂未启用的键，在该行加注释 health-allow-orphan 即可跳过。 */
const CONFIG_ALLOW_MARKER = "health-allow-orphan"

function parseSiteContentKeys(text) {
  const lines = text.split(/\r?\n/)
  const stack = []
  const keys = []
  let inside = false

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const trimmed = raw.trim()

    if (!inside) {
      if (trimmed.startsWith("export const siteContent = {")) inside = true
      continue
    }
    if (/^\}\s*as const\s*$/.test(trimmed)) break

    const match = /^([A-Za-z_$][\w$]*)\s*:\s*(.*)$/.exec(trimmed)
    if (!match) continue

    const indent = raw.length - raw.trimStart().length
    /* 同一缩进的兄弟键出现时，说明上一个块已经收尾（闭括号那行不是 key: 形式，不会触发） */
    while (stack.length > 0 && stack[stack.length - 1].indent >= indent)
      stack.pop()

    const [, key, rest] = match
    const insideArray = stack.some((entry) => entry.isArray)
    const open = rest[0]

    if (!insideArray && open !== "{") {
      keys.push({
        path: [...stack.map((entry) => entry.key), key].join("."),
        line: i + 1,
        raw,
      })
    }
    if (open === "{" || open === "[") {
      stack.push({ indent, key, isArray: open === "[" })
    }
  }

  return keys
}

function checkConfigKeys() {
  const configPath = path.join(ROOT, "src", "config", "site.ts")
  if (!existsSync(configPath)) return

  const keys = parseSiteContentKeys(readFileSync(configPath, "utf8"))
  if (keys.length === 0) {
    record("WARN", "配置键引用", "没能从 src/config/site.ts 解析出配置键")
    return
  }

  const sources = walk(
    path.join(ROOT, "src"),
    (f) => (f.endsWith(".ts") || f.endsWith(".tsx")) && f !== configPath
  ).map((f) => readFileSync(f, "utf8"))

  /* 一个键算「有引用」的两种情况：
     1) 完整路径出现（siteContent.a.b.c）；
     2) 某个祖先被整体取用（`return siteContent.weather.defaultLocation`）——
        这时子树逃出了静态分析范围，里面的键算是间接在用，不能判死。
     两条都要求路径后面不紧跟标识符字符，否则 ui.profile.hero 会命中 ui.profile.heroTitle。 */
  const appears = (needlePath) => {
    const needle = `siteContent.${needlePath}`
    return sources.some((text) => {
      let from = 0
      for (;;) {
        const at = text.indexOf(needle, from)
        if (at === -1) return false
        const after = text[at + needle.length]
        if (!after || !/[\w$]/.test(after)) return true
        from = at + needle.length
      }
    })
  }

  const referenced = (fullPath) => {
    if (appears(fullPath)) return true
    const segments = fullPath.split(".")
    for (let i = segments.length - 1; i >= 1; i--) {
      if (appears(segments.slice(0, i).join("."))) return true
    }
    return false
  }

  const orphans = keys.filter(
    (entry) =>
      !entry.raw.includes(CONFIG_ALLOW_MARKER) && !referenced(entry.path)
  )

  if (orphans.length === 0) {
    record("PASS", "配置键引用", `${keys.length} 个配置键都有引用`)
    return
  }

  record(
    "FAIL",
    "配置键引用",
    `${orphans.length}/${keys.length} 个配置键无人引用`,
    [
      ...orphans.map(
        (entry) => `src/config/site.ts:${entry.line}  ${entry.path}`
      ),
      "没人用的键改了也不会生效：删掉，或在行内注明 health-allow-orphan 表示刻意保留",
    ].join("\n")
  )
}

/* ---------- 输出 ---------- */

checkTypecheckContract()
checkScripts()
checkAssetReferences()
checkContent()
checkArticleStructure()
checkUnusedUiComponents()
checkOrphanPublicAssets()
checkConfigKeys()
checkFavicon()
checkBundleSize()

const failures = results.filter((r) => r.level === "FAIL")
const warnings = results.filter((r) => r.level === "WARN")

if (JSON_OUT) {
  process.stdout.write(
    `${JSON.stringify({ ok: failures.length === 0, results }, null, 2)}\n`
  )
  process.exit(failures.length === 0 ? 0 : 1)
}

const ICON = { PASS: "PASS", FAIL: "FAIL", WARN: "WARN", INFO: "INFO" }
console.log("\n项目体检报告")
console.log("=".repeat(52))
for (const r of results) {
  console.log(`[${ICON[r.level]}] ${r.area} · ${r.message}`)
  if (r.detail) {
    for (const line of String(r.detail).split("\n")) {
      console.log(`         ${line}`)
    }
  }
}
console.log("=".repeat(52))
console.log(
  `结论：${failures.length} 个 FAIL / ${warnings.length} 个 WARN / ${results.length} 项检查\n`
)

process.exit(failures.length === 0 ? 0 : 1)
