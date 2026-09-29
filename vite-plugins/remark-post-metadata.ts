import { createProcessor } from "@mdx-js/mdx"
import GithubSlugger from "github-slugger"
import remarkFrontmatter from "remark-frontmatter"
import remarkGfm from "remark-gfm"
import { parse as parseYaml } from "yaml"

type Frontmatter = {
  title: string
  description: string
  date: string
  category: string
  tags: string[]
  draft?: boolean
}

function stripMarkdown(value: string) {
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
const tocProcessor = createProcessor({
  remarkPlugins: [remarkFrontmatter, remarkGfm],
})

/* 只用到这几个字段，没必要把整棵 mdast 的类型拖进来 */
type TocNode = {
  type?: string
  depth?: number
  value?: string
  children?: TocNode[]
}

/* 标题文本的收集语义要对齐渲染侧 rehype-slug 用的 hast-util-to-string：
   它只认文本节点 —— 图片（<img>）和换行（<br>）不贡献文字，行内代码贡献它的值。
   这里多一步加工，就多一种「目录 id 与正文 id 不一致」的可能，别自作聪明。

   已知限制（刻意不修）：标题里写脚注引用，比如 `## 标题[^1]`。
   页面上它渲染成上标序号（`标题1`），这里收不到那个序号，id 会变成 `标题`。
   要修得复现 GFM 的「按引用出现先后编号」规则，为一个不会出现的写法不值得。
   脚注定义里的标题是另一回事，见下面 collectHeadings。 */
function headingText(node: TocNode): string {
  if (node.type === "text" || node.type === "inlineCode") return node.value ?? ""
  if (!Array.isArray(node.children)) return ""
  return node.children.map(headingText).join("")
}

function collectHeadings(node: TocNode, out: TocNode[]) {
  /* 脚注区是渲染时另起的一块（永远排在正文之后，还自带一个 footnote-label 标题），
     里面的标题进目录只会添乱，整块跳过。
     跳过不会打乱 slugger 的编号：正文标题在渲染顺序里的先后关系和这里一致。 */
  if (node.type === "footnoteDefinition") return

  if (node.type === "heading" && (node.depth === 2 || node.depth === 3)) {
    out.push(node)
    return
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) collectHeadings(child, out)
  }
}

function getTableOfContents(rawContent: string) {
  const slugger = new GithubSlugger()
  const nodes: TocNode[] = []

  /* parse() 拿到的 mdast 里，frontmatter 是独立的 yaml 节点，不会被当成标题，
     所以这里不用再手动剥 frontmatter —— health-check 那边同理，两边保持一致。 */
  collectHeadings(tocProcessor.parse(rawContent) as unknown as TocNode, nodes)

  return nodes.flatMap((node) => {
    const text = headingText(node)
    if (text.trim() === "") return []

    /* 注意：slug 用未 trim 的原文，跟 rehype-slug 完全一致；
       展示用 trim 过的，别让目录里出现多余空白。 */
    return [{ id: slugger.slug(text), title: text.trim(), level: node.depth as 2 | 3 }]
  })
}

function getReadingMinutes(rawContent: string) {
  const content = stripMarkdown(rawContent)
  const chineseCharacters = content.match(/[\u3400-\u9fff]/g)?.length ?? 0
  const latinWords = content.match(/[a-zA-Z0-9_]+/g)?.length ?? 0

  return Math.max(1, Math.ceil((chineseCharacters + latinWords) / 300))
}

function assertFrontmatter(
  value: unknown,
  path: string
): asserts value is Frontmatter {
  if (typeof value !== "object" || value === null) {
    throw new Error(`Missing frontmatter in ${path}`)
  }

  const fields = value as Record<string, unknown>
  const requiredStringFields = [
    "title",
    "description",
    "date",
    "category",
  ] as const

  for (const field of requiredStringFields) {
    if (typeof fields[field] !== "string" || fields[field].trim() === "") {
      throw new Error(`Invalid ${field} in ${path}`)
    }
  }

  if (
    !Array.isArray(fields.tags) ||
    fields.tags.some((tag) => typeof tag !== "string" || tag.trim() === "")
  ) {
    throw new Error(`Invalid tags in ${path}`)
  }
}

export function getPostMetadata(rawContent: string, path: string) {
  const match = rawContent.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/)
  const frontmatter: unknown = match ? parseYaml(match[1]) : undefined

  assertFrontmatter(frontmatter, path)

  const searchableContent = stripMarkdown(rawContent)

  return {
    ...frontmatter,
    readingMinutes: getReadingMinutes(rawContent),
    searchText: [
      frontmatter.title,
      frontmatter.description,
      frontmatter.category,
      ...frontmatter.tags,
      searchableContent,
    ]
      .join(" ")
      .toLocaleLowerCase(),
    tableOfContents: getTableOfContents(rawContent),
  }
}
