/* 线上对账：本地 dist 与线上站点是不是同一版。
   用途很具体 —— 这个站是手动部署（build → scp），GitHub 有新提交线上不会自动变，
   所以「我推了代码，网站怎么没变」是常态。跑一下这个脚本就知道到底换没换。

   判定不看时间戳（时区、缓存、nginx 的 304 都会骗人），而是逐字节比内容：
   · index.html 本身 —— 它一变（比如加了一行 <link rel="icon">）就说明不是同一版；
   · /assets/* —— 名字一样但内容可能被截断，所以比 sha256 而不是文件名；
   · 图标这类不在 /assets/ 下的静态文件 —— 按 index.html 里的引用单独取。
   为什么要有第三条：第一次写这个脚本只比了 /assets/，结果加完 favicon 后
   线上明明还缺 favicon.svg，脚本却报「一致」—— 因为图标根本不在 assets 里。

   用法：
     node scripts/deploy-status.mjs                              # 比对 https://learnailab.cn
     node scripts/deploy-status.mjs --url http://127.0.0.1:4173  # 比对本地 preview
   退出码：一致 0 / 不一致或出错 1（可以直接用在 CI 里） */
import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const DIST = path.join(ROOT, "dist")

const argIndex = process.argv.indexOf("--url")
const BASE = (
  (argIndex > -1 ? process.argv[argIndex + 1] : "") ||
  process.env.LIVE_URL ||
  "https://learnailab.cn"
).replace(/\/$/, "")

const ASSET_PATTERN = /\/assets\/[A-Za-z0-9_.-]+/g
/* index.html 里「指向某个静态文件」的引用（图标最典型），取路径好去比对 */
const ICON_PATTERN =
  /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+)["']/gi

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex")

const fail = (message, hint = "") => {
  console.error(`\n❌ ${message}`)
  if (hint) console.error(`   ${hint}`)
  process.exit(1)
}

const download = async (url) => {
  const response = await fetch(url, { cache: "no-store" })
  if (!response.ok) return { ok: false, status: response.status }
  return { ok: true, body: Buffer.from(await response.arrayBuffer()) }
}

const main = async () => {
  const localHtmlPath = path.join(DIST, "index.html")
  if (!existsSync(localHtmlPath)) {
    fail(
      "没有 dist/index.html",
      "先构建：node scripts/clean-dist.mjs && tsc -b && vite build"
    )
  }

  const localHtml = readFileSync(localHtmlPath)
  const localText = localHtml.toString("utf8")
  const localAssets = [...new Set(localText.match(ASSET_PATTERN) ?? [])].sort()
  const localIcons = [
    ...new Set([...localText.matchAll(ICON_PATTERN)].map((m) => m[1])),
  ]
    .filter((href) => href.startsWith("/"))
    .sort()

  let live
  try {
    live = await download(`${BASE}/`)
  } catch (error) {
    fail(
      `打不开 ${BASE}/`,
      String(error?.cause?.code ?? error?.message ?? error)
    )
  }
  if (!live.ok) fail(`${BASE}/ 返回 ${live.status}`)

  const liveText = live.body.toString("utf8")
  const liveAssets = [...new Set(liveText.match(ASSET_PATTERN) ?? [])].sort()

  const rows = []
  const problems = []

  /* ---------- ① index.html 本身 ---------- */
  const htmlSame = sha256(localHtml) === sha256(live.body)
  rows.push({
    same: htmlSame,
    label: "index.html",
    detail: `本地 ${localHtml.length} 字节 / 线上 ${live.body.length} 字节`,
  })
  if (!htmlSame)
    problems.push("index.html 内容不同（多半是这次提交还没传上去）")

  /* ---------- ② /assets/ 清单 ---------- */
  for (const a of localAssets.filter((a) => !liveAssets.includes(a))) {
    problems.push(`本地有、线上没有：${a}`)
  }
  for (const a of liveAssets.filter((a) => !localAssets.includes(a))) {
    problems.push(`线上有、本地没有：${a}（线上是旧版，或传的不是这次的产物）`)
  }

  /* ---------- ③ 逐个比内容 ---------- */
  const compare = async (url, localBuffer, label) => {
    const remote = await download(url).catch(() => ({
      ok: false,
      status: "网络错误",
    }))
    if (!remote.ok) {
      rows.push({
        same: false,
        label,
        detail: `线上取不到（${remote.status}）`,
      })
      problems.push(`${label} 线上取不到`)
      return
    }
    const same = sha256(localBuffer) === sha256(remote.body)
    rows.push({
      same,
      label,
      detail: `本地 ${localBuffer.length} 字节 / 线上 ${remote.body.length} 字节`,
    })
    if (!same) problems.push(`${label} 内容不一致`)
  }

  for (const asset of localAssets) {
    await compare(
      `${BASE}${asset}`,
      readFileSync(path.join(DIST, asset.replace(/^\//, ""))),
      asset
    )
  }

  for (const icon of localIcons) {
    const localPath = path.join(DIST, icon.replace(/^\//, ""))
    if (!existsSync(localPath)) {
      problems.push(`index.html 引用了 ${icon}，但 dist 里没有这个文件`)
      continue
    }
    await compare(`${BASE}${icon}`, readFileSync(localPath), icon)
  }

  /* ---------- 输出 ---------- */
  console.log(`本地 dist：${localAssets.join(" ") || "（没有 /assets/ 引用）"}`)
  console.log(`线上站点：${liveAssets.join(" ") || "（没有 /assets/ 引用）"}`)
  console.log("\n逐项核对（比 sha256，不比文件名）：")
  for (const row of rows) {
    console.log(`   ${row.same ? "✅" : "❌"} ${row.label}  ${row.detail}`)
  }

  if (problems.length > 0) {
    console.error(
      `\n❌ 结论：${BASE} 不是本地这一版（${problems.length} 处不一致）`
    )
    for (const p of problems) console.error(`   · ${p}`)
    process.exit(1)
  }

  console.log(
    `\n✅ 结论：${BASE} 就是本地 dist 这一版（${rows.length} 个文件逐字节相同）`
  )
}

await main()
