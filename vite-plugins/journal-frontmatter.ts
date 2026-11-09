import path from "node:path"
import { parse as parseYaml } from "yaml"
import type { Plugin } from "vite"

/* 日记的 frontmatter → ESM 导出。
   为什么需要这一步：页面按规格用 `import.meta.glob("…/content/journal/*.mdx", { eager: true })`
   收集日记，但 @mdx-js/rollup 默认把 `---` 块交给 remark-frontmatter 解析成 yaml 节点后
   就丢弃，模块里只剩 default（组件），拿不到 date / mood。
   这里在 MDX 编译之前把 YAML 头改写成一句真的 `export const frontmatter = {...}`：
   MDX 对顶层 ESM 是一等公民，编译后 glob 拿到的模块就自然带 frontmatter 了。
   —— 不走「注入 mdxjsEsm 节点」那条路：那种节点必须自己造 estree，容易和 @mdx-js 的
   版本绑死；改源码文本更稳，且报错信息直指文件行。

   只对 content/journal 生效，content/resources 的文章元数据仍由
   vite-plugins/remark-post-metadata.ts 的 virtual 模块提供，两条链路互不影响。 */

const JOURNAL_DIRECTORY = path
  .resolve(import.meta.dirname, "../content/journal")
  .replaceAll("\\", "/")

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

type JournalFrontmatter = {
  date: string
  mood?: string
}

function assertDate(value: unknown, filename: string): string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
    throw new Error(
      `[journal] ${filename} 的 frontmatter.date 必须是 YYYY-MM-DD 字符串（当前：${JSON.stringify(value)}）`
    )
  }

  /* 2026-02-31 这种「格式对但不存在」的日期 Date.parse 会静默进位，这里挡掉。 */
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`[journal] ${filename} 的 date 不是有效日期：${value}`)
  }

  return value
}

function readFrontmatter(
  source: string,
  filename: string
): { data: JournalFrontmatter; body: string } {
  const match = source.match(
    /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/
  )

  if (!match) {
    throw new Error(`[journal] ${filename} 缺少 frontmatter（至少要有 date）`)
  }

  const parsed: unknown = parseYaml(match[1])
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error(`[journal] ${filename} 的 frontmatter 不是键值对`)
  }

  const fields = parsed as Record<string, unknown>
  const date = assertDate(fields.date, filename)

  if (fields.mood !== undefined && typeof fields.mood !== "string") {
    throw new Error(`[journal] ${filename} 的 mood 必须是字符串`)
  }

  const mood =
    typeof fields.mood === "string" && fields.mood.trim() !== ""
      ? fields.mood.trim()
      : undefined

  return {
    data: mood ? { date, mood } : { date },
    body: source.slice(match[0].length),
  }
}

export function journalFrontmatterPlugin(): Plugin {
  return {
    name: "journal-frontmatter",
    /* 必须早于 @mdx-js/rollup（它也是 enforce:pre）。同为 pre 时按插件数组顺序执行，
       所以本插件要排在 mdx() 之前。 */
    enforce: "pre",
    transform(source, id) {
      const [filePath] = id.split("?")
      const normalized = filePath.replaceAll("\\", "/")

      if (!normalized.endsWith(".mdx")) return null
      if (!normalized.startsWith(`${JOURNAL_DIRECTORY}/`)) return null

      const filename = normalized.slice(JOURNAL_DIRECTORY.length + 1)
      const { data, body } = readFrontmatter(source, filename)

      /* 导出语句后面留空行：MDX 的 ESM 块与后续 Markdown 之间需要分隔，
         紧贴着下一行正文容易被当成同一个块的延续。 */
      return {
        code: `export const frontmatter = ${JSON.stringify(data)}\n\n${body}`,
        map: null,
      }
    },
  }
}
