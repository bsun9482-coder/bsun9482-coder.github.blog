import type { MDXComponents } from "mdx/types"
import type { ComponentType } from "react"

/* 日记：短内容，一页聚合，没有详情路由。
   收集方式和文章一样走 import.meta.glob，但这里用 eager ——
   日记都很短，一次性进主包反而省掉每条一个 chunk 的请求；
   文章是长文，所以那边仍是懒加载 + virtual 元数据模块。

   frontmatter 是 vite-plugins/journal-frontmatter.ts 在编译期注入的
   `export const frontmatter = {...}`，所以 eager glob 能直接读到。

   ⚠️ 第 36 轮起，前台日记已改从 GET /api/journals 读（lib/api-journals.ts），
   这个文件**不再有人 import** —— 它被特意保留下来当回滚方案：
   万一数据库那条路出问题，把 journal-page 换回 journalEntries 就能回到
   「构建期读 MDX」的老样子。确认稳定后可以连同 content/journal/*.mdx 一起删。
   因为没人 import，Vite 不会把它打进包里（tree-shaking 会整个丢掉这个模块）。 */

export type JournalEntry = {
  /** 文件名去掉 .mdx，仅用于 React key，不对外暴露路由 */
  slug: string
  /** YYYY-MM-DD，frontmatter 里已校验过格式 */
  date: string
  mood?: string
  Content: ComponentType<{ components?: MDXComponents }>
}

type JournalModule = {
  default: ComponentType<{ components?: MDXComponents }>
  frontmatter?: {
    date?: unknown
    mood?: unknown
  }
}

const journalModules = import.meta.glob<JournalModule>(
  "/content/journal/*.mdx",
  {
    eager: true,
  }
)

function getSlug(path: string) {
  const filename = path.split("/").at(-1)

  return filename?.endsWith(".mdx") ? filename.slice(0, -4) : (filename ?? path)
}

function getTimestamp(date: string) {
  const timestamp = Date.parse(date)

  return Number.isNaN(timestamp) ? 0 : timestamp
}

function createEntries(): JournalEntry[] {
  return Object.entries(journalModules)
    .map(([path, module]) => {
      const date = module.frontmatter?.date
      if (typeof date !== "string") {
        /* 正常情况下插件已经挡在前面了，这里是 type-safe 的兜底 */
        throw new Error(`日记缺少 date：${path}`)
      }

      const mood = module.frontmatter?.mood

      return {
        slug: getSlug(path),
        date,
        mood: typeof mood === "string" && mood !== "" ? mood : undefined,
        Content: module.default,
      }
    })
    .sort((a, b) => {
      const byDate = getTimestamp(b.date) - getTimestamp(a.date)

      /* 同一天写了两条时按文件名倒序，保证每次渲染顺序稳定 */
      return byDate !== 0 ? byDate : b.slug.localeCompare(a.slug)
    })
}

export const journalEntries = createEntries()

/* 日期格式化的实现在 lib/journal-date.ts —— 从那里再导出一次，
   只是为了「老代码 import from "@/lib/journal" 也还能跑」。
   别在这里重新写一份：两份实现迟早会漂移，一处改了另一处忘改。 */
export { formatJournalDate, formatJournalWeekday } from "@/lib/journal-date"
