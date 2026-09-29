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

import { createProcessor } from "@mdx-js/mdx"
import { execFileSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import process from "node:process"
import remarkFrontmatter from "remark-frontmatter"
import remarkGfm from "remark-gfm"
import { parse as parseYaml } from "yaml"

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

/* ---------- 检查 1：typecheck / lint / build ---------- */

function checkScripts() {
  const targets = [
    ["typecheck", "TypeScript 类型检查"],
    ["lint", "ESLint 代码规范"],
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
const ASSET_REF = /(?:src|url|avatarUrl|href|srcSet)\s*:\s*"(\/[^"]*\.[a-z0-9]{2,5})"/gi

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

/* ---------- 检查 3：MDX 文章 frontmatter 与 slug ---------- */

const REQUIRED_STRING_FIELDS = ["title", "description", "date", "category"]

function checkContent() {
  const dir = path.join(ROOT, "content", "resources")
  if (!existsSync(dir)) {
    record("WARN", "文章内容", "content/resources/ 目录不存在")
    return
  }

  const files = readdirSync(dir).filter((f) => f.endsWith(".mdx"))
  const seen = new Map()
  let problems = 0

  for (const name of files) {
    const full = path.join(dir, name)
    const raw = readFileSync(full, "utf8")
    const match = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/)
    const where = `content/resources/${name}`

    if (!match) {
      record("FAIL", "文章内容", `${where} 缺少 frontmatter`)
      problems++
      continue
    }

    let frontmatter
    try {
      frontmatter = parseYaml(match[1])
    } catch (error) {
      record("FAIL", "文章内容", `${where} frontmatter YAML 解析失败`, String(error))
      problems++
      continue
    }

    for (const field of REQUIRED_STRING_FIELDS) {
      const value = frontmatter?.[field]
      if (typeof value !== "string" || value.trim() === "") {
        record("FAIL", "文章内容", `${where} 的 ${field} 缺失或为空`)
        problems++
      }
    }

    if (
      !Array.isArray(frontmatter?.tags) ||
      frontmatter.tags.some((t) => typeof t !== "string" || t.trim() === "")
    ) {
      record("FAIL", "文章内容", `${where} 的 tags 必须是非空字符串数组`)
      problems++
    }

    if (
      typeof frontmatter?.date === "string" &&
      Number.isNaN(Date.parse(frontmatter.date))
    ) {
      record(
        "WARN",
        "文章内容",
        `${where} 的 date「${frontmatter.date}」无法被 Date.parse 解析`,
        "排序时会退化成 0，文章会被排到最后"
      )
    }

    const slug = name.slice(0, -4)
    if (seen.has(slug)) {
      record("FAIL", "文章内容", `slug 冲突：${slug}`)
      problems++
    }
    seen.set(slug, full)
  }

  if (problems === 0) {
    record("PASS", "文章内容", `${files.length} 篇文章 frontmatter 与 slug 均正常`)
  }
}

/* ---------- 检查 4：文章结构（围栏闭合 / 目录标题重名） ---------- */

/* 目录抽取和这里都走真解析器（插件见 vite-plugins/remark-post-metadata.ts），
   所以「代码块里的 ## 会污染目录」这类手写扫描的老毛病已经不成立了。
   改盯两个真会出问题的点：
   1) 围栏没闭合 —— 之后整篇会被当成代码，正文和目录一起塌掉；
   2) 同级标题重名 —— 目录里出现两条一模一样的项，读者分不清点哪个。
   解析配置必须和插件保持一致，否则判出来的不是插件看到的那棵树。 */
const articleProcessor = createProcessor({
  remarkPlugins: [remarkFrontmatter, remarkGfm],
})

/* 下面两个函数与插件里的 headingText / collectHeadings 同逻辑，改一处要改两处。
   脚本不能 import TS 插件，这份重复是刻意的。 */
function articleHeadingText(node) {
  if (node.type === "text" || node.type === "inlineCode") return node.value ?? ""
  if (!Array.isArray(node.children)) return ""
  return node.children.map(articleHeadingText).join("")
}

function collectArticleHeadings(node, out) {
  /* 脚注区渲染时另起一块，里面的标题不进目录，判重也一并跳过 */
  if (node.type === "footnoteDefinition") return
  if (node.type === "heading" && (node.depth === 2 || node.depth === 3)) {
    out.push(node)
    return
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) collectArticleHeadings(child, out)
  }
}

function walkNodes(node, visit) {
  visit(node)
  if (Array.isArray(node.children)) for (const child of node.children) walkNodes(child, visit)
}

function checkArticleStructure() {
  const dir = path.join(ROOT, "content", "resources")
  if (!existsSync(dir)) return

  const files = readdirSync(dir).filter((f) => f.endsWith(".mdx"))
  let problems = 0

  for (const name of files) {
    const raw = readFileSync(path.join(dir, name), "utf8")
    const where = `content/resources/${name}`

    let tree
    try {
      tree = articleProcessor.parse(raw)
    } catch (error) {
      record("FAIL", "文章结构", `${where} 解析失败`, String(error?.message ?? error))
      problems++
      continue
    }

    /* 围栏没闭合时，解析器会产出一个一直延伸到文件末尾的代码节点。
       所以「代码节点结束于最后一行」是可疑信号 —— 但要排除「文件末尾正好是闭合围栏」
       这种正常情况：拿代码块自己的首尾两行比一下，闭合围栏得是同种字符且不短于开启。 */
    const lines = raw.split(/\r?\n/)
    let lastContentLine = lines.length
    while (lastContentLine > 0 && lines[lastContentLine - 1].trim() === "") lastContentLine--

    const FENCE_ONLY = /^[ \t]*(`{3,}|~{3,})[ \t]*$/
    const FENCE_ANY = /^[ \t]*(`{3,}|~{3,})/

    let unclosed = false
    walkNodes(tree, (node) => {
      if (node.type !== "code" || !node.position) return
      const endLine = node.position.end.line
      if (endLine < lastContentLine) return

      /* 围栏可能挂在容器标记后面（`> ``` `、`- ``` `），直接拿原始行匹配会认不出来，
         于是误报「未闭合」卡住合法提交。position.start.column 给的是围栏自身那一列，
         从那里切掉容器前缀再比。 */
      const cut = node.position.start.column - 1
      const open = (lines[node.position.start.line - 1] ?? "").slice(cut).match(FENCE_ANY)
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
    collectArticleHeadings(tree, headings)

    const seen = new Set()
    for (const node of headings) {
      const level = node.depth
      const title = articleHeadingText(node).trim()
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

/* ---------- 输出 ---------- */

checkScripts()
checkAssetReferences()
checkContent()
checkArticleStructure()
checkUnusedUiComponents()
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
