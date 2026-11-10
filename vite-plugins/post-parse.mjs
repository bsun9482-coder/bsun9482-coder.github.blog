/* 文章解析的共用底座：frontmatter 切分、正文纯文本、标题抽取、目录、阅读时长。

   为什么是 `.mjs` 而不是 `.ts`：两个消费者分属两种运行环境 ——
   vite 插件 `remark-post-metadata.ts` 由 esbuild 转译，体检脚本
   `scripts/health-check.mjs` 由 node 直接跑。node 不能直接 import `.ts`，
   所以两边的公约数是「原生 ESM + 一份手写的 `.d.mts` 声明」。

   以前这里是两份复制，体检脚本那份注释自己写着「改一处要改两处」——
   漂移的后果不是报错，而是**体检通过、站点目录锚点却是错的**，
   这种坏法没人会发现。抽成一份之后，「解析口径」只有一个来源。 */

import { createProcessor } from "@mdx-js/mdx"
import GithubSlugger from "github-slugger"
import remarkFrontmatter from "remark-frontmatter"
import remarkGfm from "remark-gfm"
import { parse as parseYaml } from "yaml"

/* frontmatter 只认文件开头那一块，且必须紧贴第一行。
   `\r?\n` 兼容 CRLF：本机 core.autocrlf 打开，工作区里的 mdx 可能带 \r。 */
export const FRONTMATTER_PATTERN = /^---\s*\r?\n([\s\S]*?)\r?\n---/

/* 拆出 frontmatter。不抛异常，把三种结果都摊开给调用方：
   · 没有 frontmatter（found: false）
   · 有，但 YAML 写坏了（found: true + error）
   · 正常（found: true + data）
   为什么要区分「没有」和「解析失败」：构建期要给出不同的报错
   （「缺 frontmatter」vs「YAML 语法错」），诊断信息不能糊成一团。 */
export function splitFrontmatter(raw) {
  const match = raw.match(FRONTMATTER_PATTERN)
  if (!match) return { found: false }

  try {
    return { found: true, data: parseYaml(match[1]) }
  } catch (error) {
    return { found: true, error }
  }
}

/* 去掉 markdown 记号，只留能读的字，用于「阅读时长」和「搜索正文」。
   顺序有讲究：先剥整段（frontmatter / 代码块），再去行内记号，
   否则代码块里的 `#` `*` 会被当成标题和强调处理。 */
export function stripMarkdown(value) {
  return value
    .replace(/^---[\s\S]*?---/m, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_`>#|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/* 目录从真解析器里取，不再手写行扫描。
   渲染侧是 MDX（@mdx-js/mdx —— vite.config.ts 里 mdx() 的底层就是它），
   它关掉了缩进代码块、懂列表/引用容器、懂行内强调、懂 frontmatter；
   手写规则永远对不齐，对不齐的后果就是目录点不动（幽灵锚点）或者漏项。
   踩过的坑：`## 命名用 snake_case` 手写版把下划线当强调符号删掉，
   目录 id 变成 …-snakecase，正文锚点却是 …-snake_case —— 点进去不动。
   这里只用 parse() 同步拿 mdast，不进 rehype/recma，所以构建管线不用改 async。
   remarkFrontmatter / remarkGfm 必须和 vite.config.ts 里 mdx() 的配置一致，
   否则解析出来的不是渲染侧那棵树。 */
const articleProcessor = createProcessor({
  remarkPlugins: [remarkFrontmatter, remarkGfm],
})

/* 解析成 mdast。类型上只声明用得到的字段（见 post-parse.d.mts），
   没必要把整棵 mdast 的类型拖进来。 */
export function parseArticle(raw) {
  return articleProcessor.parse(raw)
}

/* 标题文本的收集语义要对齐渲染侧 rehype-slug 用的 hast-util-to-string：
   它只认文本节点 —— 图片（<img>）和换行（<br>）不贡献文字，行内代码贡献它的值。
   这里多一步加工，就多一种「目录 id 与正文 id 不一致」的可能，别自作聪明。

   已知限制（刻意不修）：标题里写脚注引用，比如 `## 标题[^1]`。
   页面上它渲染成上标序号（`标题1`），这里收不到那个序号，id 会变成 `标题`。
   要修得复现 GFM 的「按引用出现先后编号」规则，为一个不会出现的写法不值得。 */
export function headingText(node) {
  if (node.type === "text" || node.type === "inlineCode")
    return node.value ?? ""
  if (!Array.isArray(node.children)) return ""
  return node.children.map(headingText).join("")
}

/* 收集 h2 / h3。脚注区是渲染时另起的一块（永远排在正文之后，还自带一个
   footnote-label 标题），里面的标题进目录只会添乱，整块跳过。
   跳过不会打乱 slugger 的编号：正文标题在渲染顺序里的先后关系和这里一致。 */
export function collectHeadings(node, out) {
  if (node.type === "footnoteDefinition") return

  if (node.type === "heading" && (node.depth === 2 || node.depth === 3)) {
    out.push(node)
    return
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) collectHeadings(child, out)
  }
}

export function getTableOfContents(raw) {
  const slugger = new GithubSlugger()
  const nodes = []

  /* parse() 拿到的 mdast 里，frontmatter 是独立的 yaml 节点，不会被当成标题，
     所以这里不用再手动剥 frontmatter。 */
  collectHeadings(parseArticle(raw), nodes)

  return nodes.flatMap((node) => {
    const text = headingText(node)
    if (text.trim() === "") return []

    /* 注意：slug 用未 trim 的原文，跟 rehype-slug 完全一致；
       展示用 trim 过的，别让目录里出现多余空白。 */
    return [
      {
        id: slugger.slug(text),
        title: text.trim(),
        level: node.depth,
      },
    ]
  })
}

/* 中文按字数、西文按词数，合计每 300 算一分钟，最少 1 分钟。 */
export function getReadingMinutes(raw) {
  const content = stripMarkdown(raw)
  const chineseCharacters = content.match(/[\u3400-\u9fff]/g)?.length ?? 0
  const latinWords = content.match(/[a-zA-Z0-9_]+/g)?.length ?? 0

  return Math.max(1, Math.ceil((chineseCharacters + latinWords) / 300))
}
